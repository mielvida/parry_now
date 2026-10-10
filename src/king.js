// 숲의 보스: 왕슬라임. 다른 보스(boss.js, ape.js)와 같은 인터페이스를 가진다. 몸이 크고 바닥에서만 움직인다.
//   spawn  몸을 부르르 털어서 슬라임 5마리를 몸에서 튀어나가게 한다 (이 숲의 슬라임은 왕슬라임만 만들어 낸다)
//   slam   뛰어올라 플레이어 위치로 내려찍는다. 3번 반복 (착지하면 잠시 주저앉는다. 그때가 공격 기회)
//   ball   슬라임 볼(끈적한 덩어리)을 쏜다. 패링으로 쳐내면 왕슬라임에게 되돌아간다
//   5패턴마다 주저앉아 기절한다 (공격 기회)
// 가만히 있을 때도 때릴 수 있지만, 몸에 닿으면 (패링 중이 아니면) 피해를 입는다. 시작하면 왼쪽 입구가 벽으로 막힌다.
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  const BW = 120;
  const BH = 100;
  const BALL_R = 18;
  const BALL_SPEED = 400;
  const REFLECT_SPEED = 640;
  const SLAMS = 3;
  const SPAWN_COUNT = 5; // 몸을 털 때 튀어나가는 슬라임 수
  const MAX_SPAWNS = 10; // 왕슬라임이 낳은 슬라임이 이만큼 살아 있으면 더 낳지 않는다

  class Body {
    constructor(king) {
      this.king = king;
      this.i = 0;
      this.w = BW;
      this.h = BH;
      this.maxHp = C.BOSS_KING_HP;
      this.hp = this.maxHp;
      this.alive = true; // 마법 판정(Magic)이 읽는 몬스터 모양 필드
      this.flying = false;
      this.appear = 0;
      this.twoHit = false;
      this.state = 'emerge';
      this.st = 0;
      this.dir = -1;
      this.glow = 0;
      this.flash = 0;
      this.hitGrace = 0;
      this.dmgFx = 0;
      this.cx = 0;
      this.cy = 0;
      this.x = 0;
      this.y = 0;
      this.from = null;
      this.to = null;
      this.dur = 1;
      this.arc = 0;
      this.hold = 0.6;
      this.attacking = false; // 플레이어를 노리고 떨어지는 중 (쳐낼 수 있다)
      this.sx = 1;
      this.sy = 1;
    }

    get vulnerable() { return this.alive && (this.state === 'idle' || this.state === 'down' || this.state === 'stun'); }
    get dead() { return this.state === 'dead'; }
    get landing() { return this.state === 'air' && this.attacking && this.st / this.dur > 0.45; }
    get touchHarm() { return this.alive && (this.state === 'idle' || this.state === 'crouch' || this.state === 'shake' || this.state === 'wind'); }
    damage(n) { this.king.damageBody(n); }
    applyPoison() { this.king.damageBody(1); }

    _box() {
      this.x = this.cx - this.w / 2;
      this.y = this.cy - this.h / 2;
    }
  }

  class KingSlime {
    // left/width: 경기장 안쪽 가로 범위(px), groundY: 바닥 윗면 y
    constructor(left, width, groundY, ev) {
      this.kind = 'king';
      this.name = '왕슬라임';
      this.defeatText = '왕슬라임을 쓰러뜨렸다!';
      this.weak = null;
      this.hurtDmg = 1;
      this.left = left;
      this.right = left + width;
      this.camLeft = left - T;
      this.groundY = groundY;
      this.ev = ev;
      this.groundCy = groundY - BH / 2;
      this.body = new Body(this);
      this.heads = [this.body];
      this.body.cx = this.right - BW;
      this.body.cy = -BH; // 위에서 떨어져 내려온다
      this.body._box();
      this.balls = [];
      this.phase = 'intro';
      this.timer = 1.6;
      this.pat = null;
      this.patternCount = 0;
      this.playerX = (left + this.right) / 2;
      this.playerY = groundY;
      this.done = false;
      this.time = 0;
      this.landed = false;
    }

    get alive() { return this.body.alive ? [this.body] : []; }
    targets() { return this.body.vulnerable ? [this.body] : []; }

    onStart(terrain) {
      const col = Math.round(this.camLeft / T);
      for (let r = 0; r < terrain.rows - 2; r++) terrain.grid[r][col] = true;
    }

    damageBody(n) {
      const b = this.body;
      if (!b.alive) return;
      b.hp -= n;
      b.dmgFx += n;
      b.flash = 0.18;
      if (b.hp <= 0) {
        b.hp = 0;
        b.alive = false;
        b.state = 'dying';
        b.st = 0;
        b.glow = 0;
        b.attacking = false;
        this.balls.length = 0;
        this.ev.clearSpawns();
        this.ev.fx('headDie', b.cx, b.cy);
      }
    }

    hitHeads(rect, dmg) {
      const b = this.body;
      if (!b.vulnerable || b.hitGrace > 0) return [];
      if (rect.x < b.x + b.w && rect.x + rect.w > b.x && rect.y < b.y + b.h && rect.y + rect.h > b.y) {
        b.hitGrace = 0.28;
        this.damageBody(dmg);
        return [b];
      }
      return [];
    }

    // 패링: 슬라임 볼은 왕슬라임에게 되돌아가고, 노리고 떨어지는 왕슬라임은 튕겨 큰 피해를 입는다
    deflect(rect) {
      let n = 0;
      const b = this.body;
      for (const f of this.balls) {
        if (f.reflected) continue;
        if (f.x + BALL_R < rect.x || f.x - BALL_R > rect.x + rect.w || f.y + BALL_R < rect.y || f.y - BALL_R > rect.y + rect.h) continue;
        f.reflected = true;
        const dx = b.cx - f.x;
        const dy = b.cy - f.y;
        const len = Math.hypot(dx, dy) || 1;
        f.vx = (dx / len) * REFLECT_SPEED;
        f.vy = (dy / len) * REFLECT_SPEED;
        f.life = 3;
        n += 1;
      }
      if (b.landing && b.x + b.w >= rect.x && b.x <= rect.x + rect.w && b.y + b.h >= rect.y && b.y <= rect.y + rect.h) {
        b.attacking = false;
        b.cy = this.groundCy;
        b.state = 'down';
        b.st = 0;
        b.hold = 0.7;
        b.flash = 0.25;
        this.damageBody(C.BOSS_PARRY_DAMAGE);
        this.ev.fx('burst', b.cx, b.cy + b.h / 2);
        if (this.pat && this.pat.type === 'slam') this.pat.n += 1;
        n += 1;
      }
      return n;
    }

    // ---------- 움직임 ----------
    _travel(to, dur, arc) {
      const b = this.body;
      b.from = { x: b.cx, y: b.cy };
      b.to = to;
      b.dur = dur;
      b.arc = arc;
      b.attacking = true;
      b.state = 'air';
      b.st = 0;
    }

    _updateBody(dt) {
      const b = this.body;
      b.flash = Math.max(0, b.flash - dt);
      b.hitGrace = Math.max(0, b.hitGrace - dt);
      b.st += dt;
      let sx = 1 + 0.04 * Math.sin(this.time * 3);
      let sy = 1 - 0.04 * Math.sin(this.time * 3);
      switch (b.state) {
        case 'emerge': // 위에서 떨어져 바닥에 철퍼덕
          b.cy += (b.st * 900 + 200) * dt;
          if (b.cy >= this.groundCy) {
            b.cy = this.groundCy;
            b.state = 'idle';
            b.st = 0;
            this.ev.slamImpact(b.cx, this.groundY);
          }
          sy = 1.15; sx = 0.92;
          break;
        case 'idle':
          b.cy = this.groundCy;
          b.dir = this.playerX < b.cx ? -1 : 1;
          break;
        case 'shake': // 털기: 부르르 떨며 몸이 부푼다
          b.dir = this.playerX < b.cx ? -1 : 1;
          sx = 1 + 0.1 * Math.sin(this.time * 70) + 0.1 * clamp(b.st, 0, 1);
          sy = 1 + 0.08 * Math.cos(this.time * 65) - 0.05 * clamp(b.st, 0, 1);
          break;
        case 'wind': // 슬라임 볼을 쏘기 전: 몸을 웅크린다
          b.dir = this.playerX < b.cx ? -1 : 1;
          sx = 1.1 + 0.06 * b.glow;
          sy = 0.9 - 0.06 * b.glow;
          break;
        case 'crouch': {
          b.dir = this.playerX < b.cx ? -1 : 1;
          const u = clamp(b.st / (this.pat ? this.pat.cd : 0.6), 0, 1);
          sx = 1 + 0.25 * u;
          sy = 1 - 0.3 * u;
          break;
        }
        case 'air': {
          const u = Math.min(1, b.st / b.dur);
          b.cx = b.from.x + (b.to.x - b.from.x) * u;
          b.cy = b.from.y + (b.to.y - b.from.y) * u - 4 * b.arc * u * (1 - u);
          b.dir = b.to.x < b.from.x ? -1 : 1;
          sx = 0.92; sy = 1.18;
          if (u >= 1) {
            b.cx = b.to.x;
            b.cy = b.to.y;
            const was = b.attacking;
            b.attacking = false;
            b.state = 'down';
            b.st = 0;
            b.hold = 0.6;
            this.ev.slamImpact(b.cx, this.groundY);
            this.landed = was;
            if (was && this.pat && this.pat.type === 'slam') this.pat.n += 1;
          }
          break;
        }
        case 'down': {
          b.cy = this.groundCy;
          const u = clamp(b.st / b.hold, 0, 1);
          sx = 1.22 - 0.22 * u; sy = 0.75 + 0.25 * u;
          if (b.st >= b.hold) b.state = 'idle';
          break;
        }
        case 'stun':
          b.cy = this.groundCy;
          sx = 1.18; sy = 0.8;
          break;
        case 'dying':
          b.cy += (this.groundCy - b.cy) * Math.min(1, 4 * dt);
          sx = 1 + 0.1 * Math.sin(this.time * 70); sy = 1 - 0.1 * Math.sin(this.time * 70);
          if (Math.random() < dt * 14) this.ev.fx('fire', b.cx + rnd(-50, 50), b.cy + rnd(-40, 40));
          if (b.st > 1.5) { b.state = 'dead'; this.ev.fx('boom', b.cx, b.cy); }
          break;
      }
      b.sx = sx;
      b.sy = sy;
      b._box();
    }

    // ---------- 패턴 ----------
    _startPattern() {
      if (!this.body.alive) return;
      const type = ['spawn', 'slam', 'ball'][Math.floor(Math.random() * 3)];
      this.pat = { type, t: 0, n: 0, sub: 'start' };
      if (type === 'ball') {
        this.pat.shots = [];
        for (let k = 0; k < 4; k++) this.pat.shots.push({ at: 0.9 + k * 0.9, fired: false });
        this.pat.end = 0.9 + 3 * 0.9 + 0.9;
      }
      this.phase = 'pattern';
    }

    _shootBall() {
      const b = this.body;
      const sx = b.cx + b.dir * 30;
      const sy = b.cy - 30;
      const dx = this.playerX - sx;
      const dy = this.playerY - sy;
      const len = Math.hypot(dx, dy) || 1;
      this.balls.push({ x: sx, y: sy, vx: (dx / len) * BALL_SPEED, vy: (dy / len) * BALL_SPEED, reflected: false, life: 5, t: 0 });
      this.ev.sound('spawn');
    }

    _crouch(p, dur) {
      this.body.state = 'crouch';
      this.body.st = 0;
      p.sub = 'crouch';
      p.t0 = p.t;
      p.cd = dur;
      p.tx = clamp(this.playerX, this.left + BW / 2, this.right - BW / 2);
    }

    _runPattern(dt) {
      const p = this.pat;
      const b = this.body;
      p.t += dt;
      let finished = false;
      if (p.type === 'spawn') { // 몸을 털고 슬라임 5마리가 튀어나온다
        if (p.sub === 'start') { b.state = 'shake'; b.st = 0; p.sub = 'shake'; this.ev.sound('hurt'); }
        else if (p.sub === 'shake' && p.t >= 1.2) {
          const room = MAX_SPAWNS - this.ev.countSpawns();
          const dirs = [-1, -1, Math.random() < 0.5 ? -1 : 1, 1, 1];
          const list = dirs.map((dir, i) => ({ dir, vy: -420 - (i % 3) * 50 })).slice(0, Math.max(0, Math.min(SPAWN_COUNT, room)));
          this.ev.spawnSlimes(list.map((s, i) => ({ x: b.cx + s.dir * (20 + i * 8), y: b.cy - 40, dir: s.dir, vy: s.vy, kind: this.minionKind ? this.minionKind() : 'slime' })));
          b.state = 'idle';
          b.st = 0;
          p.sub = 'after';
          p.tw = p.t;
        } else if (p.sub === 'after') finished = p.t >= p.tw + 0.8;
      } else if (p.type === 'slam') { // 뛰어올라 내려찍기 3번
        if (p.sub === 'start') this._crouch(p, 0.8);
        else if (p.sub === 'crouch') {
          if (p.t - p.t0 < p.cd - 0.3) p.tx = clamp(this.playerX, this.left + BW / 2, this.right - BW / 2);
          if (p.t - p.t0 >= p.cd) { this._travel({ x: p.tx, y: this.groundCy }, p.n === 0 ? 0.75 : 0.6, 160); p.sub = 'air'; }
        } else if (p.sub === 'air') {
          if (b.state === 'down') p.sub = 'down';
        } else if (p.sub === 'down') {
          if (b.state === 'idle') {
            if (p.n < SLAMS) this._crouch(p, 0.5);
            else finished = true;
          }
        }
      } else { // ball
        b.dir = this.playerX < b.cx ? -1 : 1;
        if (b.state === 'idle' || b.state === 'wind') {
          let winding = false;
          for (const s of p.shots) {
            if (s.fired) continue;
            if (p.t >= s.at) { s.fired = true; b.glow = 0; this._shootBall(); }
            else if (p.t > s.at - 0.5) { b.glow = (p.t - (s.at - 0.5)) / 0.5; winding = true; }
          }
          b.state = winding ? 'wind' : 'idle';
        }
        finished = p.t >= p.end;
      }
      if (finished) this._endPattern();
    }

    // 패턴이 끝났다: 5번째마다 기절, 아니면 잠깐 쉰다
    _endPattern() {
      const b = this.body;
      this.patternCount += 1;
      this.pat = null;
      b.glow = 0;
      b.attacking = false;
      if (b.state !== 'dying') b.state = 'idle';
      if (this.patternCount % 5 === 0) {
        this.phase = 'stun';
        this.timer = C.BOSS_STUN_TIME;
        b.state = 'stun';
        b.st = 0;
        this.ev.stunned();
      } else {
        this.phase = 'rest';
        this.timer = rnd(0.5, 1.0);
      }
    }

    update(dt, player) {
      this.time += dt;
      this.playerX = player.x + player.w / 2;
      this.playerY = player.y + player.h / 2;
      const b = this.body;
      this._updateBody(dt);

      if (b.state === 'dead') {
        this.balls.length = 0;
        if (!this.done) { this.done = true; this.ev.defeated(); }
        return;
      }
      if (!b.alive) return;

      if (this.phase === 'intro') {
        this.timer -= dt;
        if (this.timer <= 0 && b.state === 'idle') this._startPattern();
      } else if (this.phase === 'rest') {
        this.timer -= dt;
        if (this.timer <= 0) this._startPattern();
      } else if (this.phase === 'pattern') {
        this._runPattern(dt);
      } else if (this.phase === 'stun') {
        this.timer -= dt;
        if (this.timer <= 0) { b.state = 'idle'; this.phase = 'rest'; this.timer = 0.9; }
      }

      for (const f of this.balls) {
        f.t += dt;
        f.life -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y > this.groundY || f.x < this.left - 40 || f.x > this.right + 40 || f.life <= 0) { f.dead = true; if (f.y > this.groundY) this.ev.fx('burst', f.x, this.groundY); continue; }
        if (f.reflected) {
          const dx = b.cx - f.x;
          const dy = b.cy - f.y;
          const len = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, 7 * dt);
          f.vx += ((dx / len) * REFLECT_SPEED - f.vx) * k;
          f.vy += ((dy / len) * REFLECT_SPEED - f.vy) * k;
          if (Math.abs(f.x - b.cx) < b.w / 2 + BALL_R && Math.abs(f.y - b.cy) < b.h / 2 + BALL_R) {
            f.dead = true;
            this.damageBody(C.BOSS_REFLECT_DAMAGE);
            this.ev.fx('burst', f.x, f.y);
            this.ev.sound('parry');
          }
        }
      }
      this.balls = this.balls.filter((f) => !f.dead);

      // 빠르게 떨어지는 것이 한 프레임에 패링 범위를 건너뛰지 않게, 피해 판정 직전에 몸 주변을 한 번 더 쳐낸다
      if (player.parrying && this.deflect({ x: player.x - 14, y: player.y - 14, w: player.w + 28, h: player.h + 28 })) this.ev.sound('parry');
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const f of this.balls) {
          if (!f.reflected && Math.abs(f.x - this.playerX) < player.w / 2 + BALL_R - 3 && Math.abs(f.y - this.playerY) < player.h / 2 + BALL_R - 3) { f.dead = true; this.ev.fx('burst', f.x, f.y); hurt = true; }
        }
        const inset = { x: b.x + 10, y: b.y + 8, w: b.w - 20, h: b.h - 8 };
        if ((b.landing || b.touchHarm) && !player.parrying && player.overlaps(inset)) hurt = true; // 몸에 닿음 (패링 중이면 오히려 때린다)
        if (this.landed === true) { // 방금 착지: 충격파
          this.landed = false;
          if (player.y + player.h > this.groundY - 40 && Math.abs(this.playerX - b.cx) < 100) hurt = true;
        }
        if (hurt) this.ev.hurt(this.hurtDmg);
      } else {
        this.landed = false;
      }
    }

    // ---------- 그리기 ----------
    drawBack() {}

    drawFront(ctx) {
      const p = this.pat;
      if (p && p.type === 'slam' && p.sub === 'crouch') this._drawMark(ctx, p.tx, BW + 30, (p.t - p.t0) / p.cd, p.t - p.t0 > p.cd - 0.3);
      if (!this.body.dead) this._drawKing(ctx, this.body);
      for (const f of this.balls) this._drawBall(ctx, f);
    }

    _drawMark(ctx, x, w, a, locked) {
      const gy = this.groundY;
      const blink = locked ? (Math.floor(this.time * 14) % 2 ? 1 : 0.45) : 0.85;
      const al = (0.35 + 0.5 * Math.min(1, a)) * blink;
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, 'rgba(120,255,120,0)');
      g.addColorStop(1, `rgba(120,255,120,${0.55 * al})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, 0, w, gy);
      ctx.fillStyle = `rgba(60,200,60,${al})`;
      ctx.fillRect(x - w / 2, gy - 8, w, 8);
      ctx.fillStyle = `rgba(235,255,200,${al})`;
      ctx.fillRect(x - w / 2, gy - 10, w, 2);
      ctx.strokeStyle = `rgba(235,255,200,${al})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - w / 2, 0, w, gy - 8);
      const bob = (this.time * 90) % 40;
      for (let k = 0; k < 3; k++) {
        const y = gy - 70 - k * 40 + bob;
        if (y > gy - 24) continue;
        ctx.fillStyle = `rgba(255,255,255,${al})`;
        ctx.beginPath(); ctx.moveTo(x - 14, y - 10); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x, y + 8); ctx.fill();
      }
    }

    _drawBall(ctx, f) {
      const gold = f.reflected;
      const R = BALL_R;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, R + 12);
      g.addColorStop(0, gold ? 'rgba(255,240,150,0.9)' : 'rgba(200,255,180,0.9)'); g.addColorStop(1, gold ? 'rgba(255,200,60,0)' : 'rgba(90,220,90,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R - 12, f.y - R - 12, (R + 12) * 2, (R + 12) * 2);
      const ang = Math.atan2(f.vy, f.vx);
      for (let i = 1; i <= 4; i++) { // 끈적한 꼬리
        ctx.fillStyle = gold ? `rgba(255,220,100,${0.45 - i * 0.08})` : `rgba(110,215,110,${0.5 - i * 0.09})`;
        ctx.beginPath(); ctx.arc(f.x - Math.cos(ang) * i * 11, f.y - Math.sin(ang) * i * 11, R - i * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = gold ? '#ffd45a' : '#4fbf4f';
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = gold ? '#fff0a0' : '#8be88b';
      ctx.beginPath(); ctx.arc(f.x - 2, f.y - 3, R - 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(f.x - 6, f.y - 7, 4, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; // 슬라임 볼의 작은 눈
      ctx.fillRect(f.x + 1, f.y - 2, 4, 5); ctx.fillRect(f.x + 8, f.y - 2, 4, 5);
      ctx.fillStyle = '#222';
      ctx.fillRect(f.x + 2, f.y, 2, 3); ctx.fillRect(f.x + 9, f.y, 2, 3);
    }

    // 왕슬라임: 큰 젤리 몸, 반짝이는 하이라이트, 성난 눈, 머리 위의 작은 왕관
    _drawKing(ctx, b) {
      const stunned = b.state === 'stun';
      const w = BW * b.sx;
      const h = BH * b.sy * 1.1;
      const cx = b.cx;
      const bottom = b.y + b.h;
      const left = cx - w / 2;
      const right = cx + w / 2;
      const shoulder = bottom - h * 0.42;
      const flash = b.flash > 0 || (b.state === 'dying' && Math.floor(this.time * 20) % 2 === 0);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(left, shoulder);
      ctx.quadraticCurveTo(cx, bottom - h * 1.38, right, shoulder);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      g.addColorStop(0, flash ? '#ffffff' : '#8be88b'); g.addColorStop(1, flash ? '#ffe0e0' : '#3fae3f');
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.strokeStyle = b.glow > 0 || b.state === 'shake' ? '#d6ff5a' : '#237a23';
      ctx.stroke();
      // 몸 속 방울
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let k = 0; k < 5; k++) {
        const bx = cx + Math.sin(this.time * 1.2 + k * 2) * w * 0.3;
        const by = bottom - h * (0.18 + 0.1 * ((k * 37) % 5)) - ((this.time * 8 + k * 11) % 10);
        ctx.beginPath(); ctx.arc(bx, by, 4 + (k % 3) * 2, 0, Math.PI * 2); ctx.fill();
      }
      if (b.state === 'shake') { // 털 때 몸 곳곳이 볼록 튀어나온다
        ctx.fillStyle = '#8be88b';
        for (const dx of [-0.35, 0, 0.35]) {
          ctx.beginPath(); ctx.arc(cx + dx * w, shoulder - h * 0.12 + Math.sin(this.time * 50 + dx * 9) * 4, 14, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(cx - w * 0.22, bottom - h * 0.78, w * 0.1, h * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
      // 눈
      const ex = cx + b.dir * w * 0.1;
      const ey = bottom - h * 0.5;
      if (stunned || b.state === 'dying') {
        ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 3;
        for (const dx of [-16, 16]) { ctx.beginPath(); ctx.moveTo(ex + dx - 6, ey - 6); ctx.lineTo(ex + dx + 6, ey + 6); ctx.moveTo(ex + dx + 6, ey - 6); ctx.lineTo(ex + dx - 6, ey + 6); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 24, ey - 10, 18, 22); ctx.fillRect(ex + 6, ey - 10, 18, 22);
        ctx.fillStyle = '#1a1a1a';
        const px = b.dir > 0 ? 6 : 0;
        ctx.fillRect(ex - 24 + px + 2, ey - 2, 9, 12); ctx.fillRect(ex + 6 + px + 2, ey - 2, 9, 12);
        ctx.strokeStyle = '#1a3a1a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; // 성난 눈썹
        ctx.beginPath(); ctx.moveTo(ex - 28, ey - 16); ctx.lineTo(ex - 4, ey - 10); ctx.moveTo(ex + 28, ey - 16); ctx.lineTo(ex + 4, ey - 10); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      // 입
      const open = b.glow > 0 ? 6 + 10 * b.glow : (b.state === 'air' ? 10 : stunned ? 8 : 3);
      ctx.fillStyle = '#1f4a1f';
      ctx.beginPath(); ctx.ellipse(ex, ey + 26, 14, 2 + open / 2, 0, 0, Math.PI * 2); ctx.fill();
      // 왕관
      const topY = bottom - h * 1.02;
      ctx.fillStyle = '#d4a017';
      ctx.beginPath(); ctx.moveTo(cx - 22, topY + 6); ctx.lineTo(cx - 24, topY - 14); ctx.lineTo(cx - 11, topY - 4); ctx.lineTo(cx, topY - 20); ctx.lineTo(cx + 11, topY - 4); ctx.lineTo(cx + 24, topY - 14); ctx.lineTo(cx + 22, topY + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(cx - 22, topY + 1, 44, 5);
      ctx.fillStyle = '#e8334a'; ctx.fillRect(cx - 3, topY - 4, 6, 6);
      ctx.restore();
      if (stunned) {
        for (let k = 0; k < 3; k++) {
          const a = this.time * 4 + (k * Math.PI * 2) / 3;
          const sx = cx + Math.cos(a) * 44;
          const sy = topY - 26 + Math.sin(a) * 8;
          ctx.fillStyle = '#ffe14a';
          ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.fill();
        }
      }
      if (b.state === 'down') {
        ctx.strokeStyle = Math.floor(this.time * 8) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,230,120,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
    }
  }

  G.KingSlime = KingSlime;
})(window.Game);
