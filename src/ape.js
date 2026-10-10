// 설산의 보스: 하얀 털복숭이 침팬지 (뿔이 두 개). 용머리 보스(boss.js)와 같은 인터페이스를 가진다.
//   throw  벽에 붙어서 큰 눈덩이를 던진다. 패링으로 쳐내면 침팬지에게 되돌아간다
//   jump   뛰어올라 플레이어 위치로 떨어진다. 5번 반복한 뒤 벽으로 돌아간다. 착지하면 잠시 땅에 주저앉아 있다 (그때가 공격 기회)
//   shard  고드름이 오른쪽에서 왼쪽으로, 또는 왼쪽에서 오른쪽으로 가로로 날아온다 (8발, 높이는 낮음/높음 무작위. 쳐낼 수 없다)
//   roll   눈덩이를 굴린다. 반대쪽 벽까지 굴러가며 점점 커진다. 패링으로 못 쳐낸다 (점프/대시로 피한다)
//   5패턴마다 땅에 떨어져 기절한다 (공격 기회)
// 경기장 왼쪽에는 보스가 시작되면 벽이 생기고, 오른쪽은 맵 끝 벽이다. 침팬지는 양쪽 벽에 붙을 수 있다.
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  const BW = 84;
  const BH = 92;
  const BALL_R = 26;
  const THROW_SPEED = 440;
  const REFLECT_SPEED = 680;
  const ROLL_R0 = 18;
  const ROLL_R1 = 54;
  const ROLL_SPEED = 300;
  const JUMPS = 5;
  const SHARD_LEN = 76; // 날아오는 고드름의 길이

  class Body {
    constructor(apeBoss) {
      this.boss = apeBoss;
      this.i = 0;
      this.w = BW;
      this.h = BH;
      this.maxHp = C.BOSS_YETI_HP;
      this.hp = this.maxHp;
      this.alive = true; // 마법 판정(Magic)이 읽는 몬스터 모양 필드
      this.flying = false;
      this.appear = 0;
      this.twoHit = false;
      this.state = 'emerge';
      this.st = 0;
      this.dir = -1; // 바라보는 쪽
      this.glow = 0;
      this.flash = 0;
      this.hitGrace = 0;
      this.dmgFx = 0;
      this.arm = 0;    // 팔을 치켜든 정도 0~1 (던지기 예비동작)
      this.cx = 0;
      this.cy = 0;
      this.x = 0;
      this.y = 0;
      this.from = null;
      this.to = null;
      this.dur = 1;
      this.arc = 0;
      this.after = 'cling';
      this.attacking = false; // 플레이어를 노리고 떨어지는 중 (쳐낼 수 있다)
      this.hold = 0.55;       // 착지 후 주저앉아 있는 시간
    }

    get vulnerable() { return this.alive && (this.state === 'down' || this.state === 'stun' || this.state === 'cling'); }
    get dead() { return this.state === 'dead'; }
    get landing() { return this.state === 'air' && this.attacking && this.st / this.dur > 0.45; }
    damage(n) { this.boss.damageBody(n); }
    applyPoison() { this.boss.damageBody(1); }

    _box() {
      this.x = this.cx - this.w / 2;
      this.y = this.cy - this.h / 2;
    }
  }

  class ApeBoss {
    // left/width: 경기장 안쪽 가로 범위(px, 왼쪽 벽 안쪽부터 맵 끝까지), groundY: 바닥 윗면 y
    constructor(left, width, groundY, ev) {
      this.kind = 'ape';
      this.name = '털복숭이 침팬지';
      this.defeatText = '침팬지를 쓰러뜨렸다!';
      this.weak = 'fire';
      this.hurtDmg = C.SNOW_MOB_DAMAGE;
      this.left = left;
      this.right = left + width;
      this.camLeft = left - T; // 화면은 왼쪽 벽 타일까지 보여준다
      this.groundY = groundY;
      this.ev = ev;
      this.clingY = groundY - 270;
      this.groundCy = groundY - BH / 2;
      this.body = new Body(this);
      this.heads = [this.body]; // main/renderer가 읽는 목록 (머리 하나 = 몸 하나)
      this.side = 1;            // 붙어 있는 벽: 1 오른쪽, -1 왼쪽
      this.body.cx = this.wallX(1);
      this.body.cy = -BH; // 위에서 내려와 벽에 붙는다
      this.body._box();
      this.balls = [];  // 던진 눈덩이
      this.rolls = [];  // 굴러가는 눈덩이
      this.shards = []; // 가로로 날아오는 고드름
      this.phase = 'intro';
      this.timer = 1.8;
      this.pat = null;
      this.patternCount = 0;
      this.playerX = (left + this.right) / 2;
      this.playerY = groundY;
      this.done = false;
      this.time = 0;
    }

    wallX(side) { return side > 0 ? this.right - BW / 2 : this.left + BW / 2; }
    get alive() { return this.body.alive ? [this.body] : []; }
    targets() { return this.body.vulnerable ? [this.body] : []; }

    // 보스가 시작되면 왼쪽 입구가 벽으로 막힌다
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
        b.arm = 0;
        b.attacking = false;
        this.balls.length = 0;
        this.rolls.length = 0;
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

    // 패링: 던진 눈덩이는 침팬지에게 되돌아가고, 노리고 떨어지는 침팬지는 튕겨 큰 피해를 입는다. (굴러오는 눈덩이는 못 쳐낸다)
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
        if (this.pat && this.pat.type === 'jump') this.pat.n += 1;
        n += 1;
      }
      return n;
    }

    // ---------- 움직임 ----------
    _travel(to, dur, arc, after, attacking = false) {
      const b = this.body;
      b.from = { x: b.cx, y: b.cy };
      b.to = to;
      b.dur = dur;
      b.arc = arc;
      b.after = after;
      b.attacking = attacking;
      b.state = 'air';
      b.st = 0;
    }

    _cling(side) {
      this.side = side;
      const b = this.body;
      b.state = 'cling';
      b.cx = this.wallX(side);
      b.cy = this.clingY;
      b.dir = -side;
    }

    _updateBody(dt) {
      const b = this.body;
      b.flash = Math.max(0, b.flash - dt);
      b.hitGrace = Math.max(0, b.hitGrace - dt);
      b.st += dt;
      switch (b.state) {
        case 'emerge': { // 위에서 미끄러져 내려와 오른쪽 벽에 붙는다
          const u = Math.min(1, b.st / 1.4);
          b.cx = this.wallX(1);
          b.cy = -BH + (this.clingY + BH) * (1 - Math.pow(1 - u, 3));
          b.dir = -1;
          if (u >= 1) this._cling(1);
          break;
        }
        case 'cling':
          b.cx = this.wallX(this.side);
          b.cy = this.clingY + Math.sin(this.time * 2) * 3;
          b.dir = -this.side;
          break;
        case 'crouch':
          b.dir = this.playerX < b.cx ? -1 : 1;
          break;
        case 'air': {
          const u = Math.min(1, b.st / b.dur);
          b.cx = b.from.x + (b.to.x - b.from.x) * u;
          b.cy = b.from.y + (b.to.y - b.from.y) * u - 4 * b.arc * u * (1 - u);
          b.dir = b.to.x < b.from.x ? -1 : 1;
          if (u >= 1) {
            b.cx = b.to.x;
            b.cy = b.to.y;
            const was = b.attacking;
            b.attacking = false;
            if (b.after === 'cling') this._cling(this.side);
            else if (b.after === 'rollReady') { // 눈덩이를 굴리러 땅으로 내려왔다
              b.state = 'rollPush';
              b.st = 0;
              this.ev.slamImpact(b.cx, this.groundY);
            } else { // 착지: 충격과 함께 주저앉는다
              b.state = 'down';
              b.st = 0;
              b.hold = 0.55;
              this.ev.slamImpact(b.cx, this.groundY);
              this.landed = was;
              if (was && this.pat && this.pat.type === 'jump') this.pat.n += 1;
            }
          }
          break;
        }
        case 'rollPush': // 벽 옆 땅에 서서 눈덩이를 굴린다
          b.cx = this.wallX(this.side);
          b.cy = this.groundCy;
          b.dir = -this.side;
          break;
        case 'down':
          b.cy = this.groundCy;
          if (b.st >= (b.hold || 0.55)) b.state = 'idleGround';
          break;
        case 'stunFall':
          b.cy += 900 * dt;
          if (b.cy >= this.groundCy) {
            b.cy = this.groundCy;
            b.state = 'stun';
            b.st = 0;
            this.ev.slamImpact(b.cx, this.groundY);
          }
          break;
        case 'stun':
          break; // 스케줄러가 끝낸다
        case 'dying':
          b.cy += (this.groundCy - b.cy) * Math.min(1, 4 * dt);
          if (Math.random() < dt * 14) this.ev.fx('fire', b.cx + rnd(-36, 36), b.cy + rnd(-40, 40));
          if (b.st > 1.5) { b.state = 'dead'; this.ev.fx('boom', b.cx, b.cy); }
          break;
      }
      b._box();
    }

    // ---------- 패턴 ----------
    _startPattern() {
      if (!this.body.alive) return;
      const type = ['throw', 'jump', 'roll', 'shard'][Math.floor(Math.random() * 4)];
      this.pat = { type, t: 0, n: 0, sub: 'start' };
      if (type === 'throw') {
        this.pat.shots = [];
        for (let k = 0; k < 4; k++) this.pat.shots.push({ at: 0.8 + k * 1.0, fired: false });
        this.pat.end = 0.8 + 3 * 1.0 + 0.8;
      }
      this.phase = 'pattern';
    }

    _throw() {
      const b = this.body;
      const sx = b.cx + b.dir * 30;
      const sy = b.cy - 30;
      const dx = this.playerX - sx;
      const dy = this.playerY - sy;
      const len = Math.hypot(dx, dy) || 1;
      this.balls.push({ x: sx, y: sy, vx: (dx / len) * THROW_SPEED, vy: (dy / len) * THROW_SPEED, reflected: false, life: 5, t: 0 });
      this.ev.sound('fire');
    }

    _runPattern(dt) {
      const p = this.pat;
      const b = this.body;
      p.t += dt;
      let finished = false;
      if (p.type === 'throw') {
        b.dir = -this.side;
        b.arm = 0;
        for (const s of p.shots) {
          if (s.fired) continue;
          if (p.t >= s.at) { s.fired = true; b.arm = 0; b.glow = 0; this._throw(); }
          else if (p.t > s.at - 0.55) { b.arm = (p.t - (s.at - 0.55)) / 0.55; b.glow = b.arm; }
        }
        finished = p.t >= p.end;
      } else if (p.type === 'jump') {
        if (p.sub === 'start') { this._crouch(p, 0.8); }
        else if (p.sub === 'crouch') {
          if (p.t - p.t0 < p.cd - 0.3) p.tx = clamp(this.playerX, this.left + BW / 2, this.right - BW / 2);
          if (p.t - p.t0 >= p.cd) {
            this._travel({ x: p.tx, y: this.groundCy }, p.n === 0 ? 0.75 : 0.6, 150, 'land', true);
            p.sub = 'air';
          }
        } else if (p.sub === 'air') {
          if (b.state === 'down') p.sub = 'down';
        } else if (p.sub === 'down') {
          if (b.state === 'idleGround') {
            if (p.n < JUMPS) this._crouch(p, 0.5);
            else {
              const side = Math.random() < 0.5 ? -1 : 1;
              this.side = side;
              this._travel({ x: this.wallX(side), y: this.clingY }, 0.85, 130, 'cling');
              p.sub = 'return';
            }
          }
        } else if (p.sub === 'return') {
          finished = b.state === 'cling';
        }
      } else if (p.type === 'shard') {
        b.glow = 0;
        while (p.n < 8 && p.t >= 0.5 + p.n * 0.5) { // 0.5초마다 한 발씩, 왼쪽/오른쪽 무작위
          p.n += 1;
          const low = Math.random() < 0.5;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.shards.push({ side, low, y: this.groundY - (low ? 24 : 92), h: low ? 24 : 34, st: 'warn', t: 0, x: side > 0 ? this.right : this.left });
        }
        finished = p.n >= 8 && this.shards.length === 0;
      } else { // roll: 벽에서 땅으로 내려와 눈덩이를 직접 굴리고, 다 굴리면 다시 벽으로 올라간다
        b.arm = 0;
        if (p.sub === 'start') { // 벽에서 내려간다
          this._travel({ x: this.wallX(this.side), y: this.groundCy }, 0.6, 70, 'rollReady');
          p.sub = 'descend';
        } else if (p.sub === 'descend') {
          if (b.state === 'rollPush') { p.sub = 'push'; p.t0 = p.t; p.rolled = 0; }
        } else if (p.sub === 'push') {
          if (p.t - p.t0 >= 0.9) {
            this._spawnRoll();
            p.rolled += 1;
            if (p.rolled >= 2) { p.sub = 'wait'; p.tw = p.t; } else p.t0 = p.t + 0.5; // 두 번째 눈덩이
          }
        } else if (p.sub === 'wait') {
          if (this.rolls.length === 0 && p.t > p.tw + 0.3) { // 눈덩이가 다 굴러가면 다시 벽으로
            this._travel({ x: this.wallX(this.side), y: this.clingY }, 0.7, 110, 'cling');
            p.sub = 'return';
          }
        } else if (p.sub === 'return') {
          finished = b.state === 'cling';
        }
      }
      if (finished) {
        this.patternCount += 1;
        this.pat = null;
        b.arm = 0;
        b.glow = 0;
        if (this.patternCount % 5 === 0) {
          this.phase = 'stun';
          this.timer = C.BOSS_STUN_TIME;
          b.state = 'stunFall';
          b.attacking = false;
          this.ev.stunned();
        } else {
          this.phase = 'rest';
          this.timer = rnd(0.5, 1.0);
        }
      }
    }

    _crouch(p, dur) {
      this.body.state = 'crouch';
      this.body.st = 0;
      p.sub = 'crouch';
      p.t0 = p.t;
      p.cd = dur;
      p.tx = clamp(this.playerX, this.left + BW / 2, this.right - BW / 2);
    }

    _spawnRoll() {
      const dir = -this.side;
      this.rolls.push({ x: this.body.cx + dir * (BW / 2 + ROLL_R0), dir, r: ROLL_R0, dist: 0, rot: 0, hit: false });
      this.ev.sound('spawn');
    }

    update(dt, player) {
      this.time += dt;
      this.playerX = player.x + player.w / 2;
      this.playerY = player.y + player.h / 2;
      const b = this.body;
      this._updateBody(dt);

      if (b.state === 'dead') {
        this.balls.length = 0;
        this.rolls.length = 0;
        if (!this.done) { this.done = true; this.ev.defeated(); }
        return;
      }
      if (!b.alive) return;

      if (this.phase === 'intro') {
        this.timer -= dt;
        if (this.timer <= 0 && b.state === 'cling') this._startPattern();
      } else if (this.phase === 'rest') {
        this.timer -= dt;
        if (this.timer <= 0) this._startPattern();
      } else if (this.phase === 'pattern') {
        this._runPattern(dt);
      } else if (this.phase === 'stun') {
        if (b.state === 'stun') {
          this.timer -= dt;
          if (this.timer <= 0) {
            const side = Math.random() < 0.5 ? -1 : 1;
            this.side = side;
            this._travel({ x: this.wallX(side), y: this.clingY }, 0.9, 140, 'cling');
            this.phase = 'rest';
            this.timer = 1.0;
          }
        }
      }

      // 던진 눈덩이
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

      // 가로로 날아오는 고드름: 벽 끝에 경고가 깜빡인 뒤 반대쪽으로 빠르게 날아간다
      for (const k of this.shards) {
        k.t += dt;
        if (k.st === 'warn') { if (k.t >= 0.65) { k.st = 'fly'; k.t = 0; this.ev.sound('shatter'); } }
        else {
          k.x -= k.side * 780 * dt;
          if (k.x < this.left - 80 || k.x > this.right + 80) k.dead = true;
        }
      }
      this.shards = this.shards.filter((k) => !k.dead);

      // 굴러가는 눈덩이: 갈수록 커진다
      const span = this.right - this.left;
      for (const r of this.rolls) {
        const sp = ROLL_SPEED * (1 + 0.6 * (r.dist / span));
        r.x += r.dir * sp * dt;
        r.dist += sp * dt;
        r.rot += (sp * dt) / Math.max(10, r.r);
        r.r = ROLL_R0 + (ROLL_R1 - ROLL_R0) * clamp(r.dist / (span - 40), 0, 1);
        if (r.x < this.left - 10 || r.x > this.right + 10) { r.dead = true; this.ev.fx('burst', r.x, this.groundY - r.r); this.ev.shake(6, 0.2); }
      }
      this.rolls = this.rolls.filter((r) => !r.dead);

      // 플레이어 피해 판정
      // 빠르게 떨어지는 것이 한 프레임에 패링 범위를 건너뛰지 않게, 피해 판정 직전에 몸 주변을 한 번 더 쳐낸다
      if (player.parrying && this.deflect({ x: player.x - 14, y: player.y - 14, w: player.w + 28, h: player.h + 28 })) this.ev.sound('parry');
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const f of this.balls) {
          if (!f.reflected && Math.abs(f.x - this.playerX) < player.w / 2 + BALL_R - 3 && Math.abs(f.y - this.playerY) < player.h / 2 + BALL_R - 3) { f.dead = true; this.ev.fx('burst', f.x, f.y); hurt = true; }
        }
        for (const r of this.rolls) {
          const cx = clamp(r.x, player.x, player.x + player.w);
          const cy = clamp(this.groundY - r.r, player.y, player.y + player.h);
          if ((r.x - cx) * (r.x - cx) + (this.groundY - r.r - cy) * (this.groundY - r.r - cy) < (r.r - 4) * (r.r - 4)) hurt = true;
        }
        for (const k of this.shards) {
          if (k.st === 'warn') continue;
          const x0 = k.side > 0 ? k.x : k.x - SHARD_LEN;
          if (player.overlaps({ x: x0, y: k.y, w: SHARD_LEN, h: k.h })) { k.dead = true; hurt = true; }
        }
        if (b.landing && player.overlaps({ x: b.x + 8, y: b.y + 6, w: b.w - 16, h: b.h - 12 })) hurt = true;
        if (this.landed === true) { // 방금 착지: 충격파
          this.landed = false;
          if (player.y + player.h > this.groundY - 40 && Math.abs(this.playerX - b.cx) < 92) hurt = true;
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
      if (p && p.type === 'jump' && p.sub === 'crouch') this._drawMark(ctx, p.tx, BW + 40, (p.t - p.t0) / p.cd, p.t - p.t0 > p.cd - 0.3);
      for (const k of this.shards) this._drawShard(ctx, k);
      for (const r of this.rolls) this._drawRoll(ctx, r);
      if (!this.body.dead) this._drawApe(ctx, this.body);
      for (const f of this.balls) this._drawSnowball(ctx, f, BALL_R);
      if (p && p.type === 'roll' && p.sub === 'push' && p.t >= p.t0) this._drawPushBall(ctx, p);
    }

    // 떨어질 곳 표시 (용머리 보스와 같은 모양, 푸른색)
    _drawMark(ctx, x, w, a, locked) {
      const gy = this.groundY;
      const blink = locked ? (Math.floor(this.time * 14) % 2 ? 1 : 0.45) : 0.85;
      const al = (0.35 + 0.5 * Math.min(1, a)) * blink;
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, 'rgba(90,190,255,0)');
      g.addColorStop(1, `rgba(90,190,255,${0.62 * al})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, 0, w, gy);
      ctx.fillStyle = `rgba(40,140,255,${al})`;
      ctx.fillRect(x - w / 2, gy - 8, w, 8);
      ctx.fillStyle = `rgba(230,248,255,${al})`;
      ctx.fillRect(x - w / 2, gy - 10, w, 2);
      ctx.strokeStyle = `rgba(230,248,255,${al})`;
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

    // 가로로 날아오는 고드름: 경고(벽 끝의 깜빡이는 화살표와 줄)가 먼저 나온다
    _drawShard(ctx, k) {
      const dir = -k.side;
      const wx = k.side > 0 ? this.right : this.left;
      if (k.st === 'warn') {
        const u = k.t / 0.65;
        const blink = u > 0.5 ? (Math.floor(this.time * 16) % 2 ? 1 : 0.4) : 0.85;
        const span = this.right - this.left;
        ctx.fillStyle = `rgba(90,190,255,${0.1 * blink})`;
        ctx.fillRect(this.left, k.y, span, k.h);
        ctx.fillStyle = `rgba(230,248,255,${0.7 * blink})`;
        ctx.fillRect(this.left, k.y - 1, span, 1);
        ctx.fillRect(this.left, k.y + k.h, span, 1);
        const ax = wx + dir * 24; // 벽 끝: 날아올 방향을 가리키는 큰 화살표
        const ay = k.y + k.h / 2;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.beginPath(); ctx.moveTo(ax + dir * 22, ay); ctx.lineTo(ax - dir * 6, ay - 16); ctx.lineTo(ax - dir * 6, ay + 16); ctx.fill();
        ctx.fillStyle = `rgba(60,150,255,${blink})`;
        ctx.beginPath(); ctx.moveTo(ax + dir * 15, ay); ctx.lineTo(ax - dir * 1, ay - 9); ctx.lineTo(ax - dir * 1, ay + 9); ctx.fill();
        return;
      }
      const cy = k.y + k.h / 2;
      const tail = k.x - dir * SHARD_LEN; // 꼬리 쪽 끝
      for (let i = 1; i <= 4; i++) { // 바람 꼬리
        ctx.fillStyle = `rgba(210,238,255,${0.35 - i * 0.07})`;
        ctx.fillRect(Math.min(tail, tail - dir * i * 14), cy - 3 - i, 12, 5 + i * 2);
      }
      ctx.fillStyle = '#9fd4f5';
      ctx.beginPath();
      ctx.moveTo(k.x + dir * 6, cy);
      ctx.lineTo(tail + dir * 14, cy - k.h * 0.45);
      ctx.lineTo(tail, cy - k.h * 0.3);
      ctx.lineTo(tail, cy + k.h * 0.3);
      ctx.lineTo(tail + dir * 14, cy + k.h * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4fcff';
      ctx.beginPath(); ctx.moveTo(k.x + dir * 6, cy); ctx.lineTo(tail + dir * 20, cy - k.h * 0.15); ctx.lineTo(tail + dir * 20, cy + k.h * 0.15); ctx.fill();
      ctx.strokeStyle = '#4a86c2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(k.x + dir * 6, cy); ctx.lineTo(tail + dir * 14, cy - k.h * 0.45); ctx.lineTo(tail, cy - k.h * 0.3); ctx.lineTo(tail, cy + k.h * 0.3); ctx.lineTo(tail + dir * 14, cy + k.h * 0.45); ctx.closePath(); ctx.stroke();
    }

    _drawSnowball(ctx, f, R) {
      const gold = f.reflected;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, R + 14);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, gold ? 'rgba(255,200,80,0)' : 'rgba(150,210,255,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R - 14, f.y - R - 14, (R + 14) * 2, (R + 14) * 2);
      const ang = Math.atan2(f.vy, f.vx);
      for (let i = 1; i <= 4; i++) {
        ctx.fillStyle = gold ? `rgba(255,220,120,${0.45 - i * 0.08})` : `rgba(210,235,255,${0.5 - i * 0.09})`;
        ctx.beginPath(); ctx.arc(f.x - Math.cos(ang) * i * 12, f.y - Math.sin(ang) * i * 12, R - i * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = gold ? '#ffd45a' : '#cfe4f7';
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(f.x - 4, f.y - 4, R - 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = gold ? '#e0a020' : '#9bb8d4';
      ctx.fillRect(f.x + 5, f.y + 4, 6, 4); ctx.fillRect(f.x - 12, f.y + 8, 5, 4);
    }

    _drawRoll(ctx, r) {
      const cy = this.groundY - r.r;
      ctx.fillStyle = '#9bb8d4';
      ctx.beginPath(); ctx.arc(r.x, cy, r.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f9ff';
      ctx.beginPath(); ctx.arc(r.x - r.r * 0.12, cy - r.r * 0.12, r.r * 0.88, 0, Math.PI * 2); ctx.fill();
      ctx.save(); // 굴러가는 무늬 (눈 뭉치 선과 돌 조각)
      ctx.beginPath(); ctx.arc(r.x, cy, r.r - 2, 0, Math.PI * 2); ctx.clip();
      ctx.translate(r.x, cy);
      ctx.rotate(r.rot * r.dir);
      ctx.strokeStyle = '#b8cfe6'; ctx.lineWidth = Math.max(2, r.r * 0.08);
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, r.r * (0.35 + k * 0.2), k, k + 1.6); ctx.stroke(); }
      ctx.fillStyle = '#6b7f96';
      ctx.fillRect(r.r * 0.4, -r.r * 0.1, r.r * 0.14, r.r * 0.1); ctx.fillRect(-r.r * 0.5, r.r * 0.2, r.r * 0.12, r.r * 0.1);
      ctx.restore();
      // 달리는 먼지
      ctx.fillStyle = 'rgba(240,248,255,0.6)';
      for (let k = 0; k < 3; k++) ctx.fillRect(r.x - r.dir * (r.r + 6 + k * 10), this.groundY - 4 - ((this.time * 40 + k * 7) % 12), 6, 4);
    }

    // 굴리기 준비: 벽 앞에 눈덩이가 뭉쳐진다
    _drawPushBall(ctx, p) {
      const b = this.body;
      const u = clamp((p.t - p.t0) / 0.9, 0, 1);
      const r = ROLL_R0 * (0.4 + 0.6 * u); // 놓아 보내는 눈덩이(ROLL_R0)와 같은 크기까지 커진다
      const x = b.cx + b.dir * (BW / 2 + r * 0.8 + 6 * Math.sin(this.time * 12)); // 팔 끝에서 밀리는 눈덩이
      const y = this.groundY - r;
      ctx.fillStyle = '#f4f9ff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c6d9ec'; ctx.lineWidth = 2;
      const rot = this.time * 5 * b.dir;
      ctx.beginPath(); ctx.arc(x, y, r * 0.65, rot, rot + 2.2); ctx.stroke(); // 굴러가는 눈 결
      ctx.beginPath(); ctx.arc(x, y, r * 0.35, rot + 3, rot + 5); ctx.stroke();
      // 눈가루
      for (let i = 0; i < 4; i++) { const k = (this.time * 2.2 + i * 0.25) % 1; ctx.fillStyle = 'rgba(240,248,255,' + (0.6 * (1 - k)) + ')'; ctx.fillRect(x - b.dir * (r * 0.8 + k * 26) - 2, this.groundY - 4 - k * 18 - i * 2, 4, 4); }
    }

    // 침팬지: 하얀 털의 큰 몸, 긴 팔, 푸른 회색 얼굴, 성난 붉은 눈, 송곳니, 뿔 두 개
    _drawApe(ctx, b) {
      const stunned = b.state === 'stun' || b.state === 'stunFall';
      const fur = b.flash > 0 ? '#ffe4d8' : (b.state === 'dying' ? '#b9c4d0' : '#f6faff');
      const shade = b.flash > 0 ? '#ffc9b4' : '#d6e6f5';
      const out = '#8fa9c4';
      const skin = b.flash > 0 ? '#ffd8c8' : '#9fb4cb';
      ctx.save();
      ctx.translate(b.cx, b.cy);
      let sh = 0;
      if (b.state === 'crouch') sh = Math.sin(this.time * 80) * 2;
      if (b.state === 'dying') sh = Math.sin(this.time * 70) * 4;
      ctx.translate(sh, 0);
      ctx.scale(b.dir > 0 ? -1 : 1, 1); // 기본 모양은 왼쪽을 본다 (벽은 오른쪽 뒤)
      const clinging = b.state === 'cling' || b.state === 'emerge';
      const air = b.state === 'air' && !clinging;
      const crouch = b.state === 'crouch';
      const sit = b.state === 'down' || b.state === 'stun' || b.state === 'stunFall' || b.state === 'idleGround';
      const pushing = b.state === 'rollPush';
      if (crouch) ctx.scale(1.08, 0.86), ctx.translate(0, 8);
      if (sit) ctx.translate(0, 6);
      if (pushing) { ctx.rotate(-0.16); ctx.translate(-4, 2 + Math.abs(Math.sin(this.time * 6)) * 2); } // 앞으로 기울여 힘껏 민다
      if (stunned) ctx.rotate(0.1);
      const lump = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

      // 팔 (뒤쪽 팔 먼저)
      const arms = (back) => {
        const sx = back ? 22 : -24;
        let hx; let hy;
        if (clinging) { hx = back ? 40 : 38; hy = back ? -44 : -4; if (!back && b.arm > 0) { hx = -26; hy = -62 - b.arm * 14; } }
        else if (air) { hx = back ? 20 : -26; hy = back ? -62 : -58; }
        else if (pushing) { hx = back ? -34 : -46; hy = 24 + Math.sin(this.time * 12 + (back ? 1.6 : 0)) * 5; } // 두 팔을 앞으로 뻗어 눈덩이를 민다
        else if (crouch) { hx = back ? 10 : -20; hy = 40; }
        else if (sit) { hx = back ? 28 : -34; hy = 38; }
        else { hx = back ? 30 : -34; hy = 30 + Math.sin(this.time * 3) * 2; }
        ctx.strokeStyle = out; ctx.lineWidth = 17; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, -14); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = back ? shade : fur; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.moveTo(sx, -14); ctx.lineTo(hx, hy); ctx.stroke();
        lump(hx, hy, 11, out); lump(hx, hy, 9, back ? shade : fur);
        ctx.lineCap = 'butt';
        return { hx, hy };
      };
      arms(true);
      // 다리
      ctx.fillStyle = out; ctx.fillRect(-26, 22, 20, 24); ctx.fillRect(4, 22, 20, 24);
      ctx.fillStyle = shade; ctx.fillRect(-24, 22, 16, 22); ctx.fillRect(6, 22, 16, 22);
      // 몸통 털뭉치
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          const wob = Math.sin(this.time * 2 + k) * 1.2;
          lump(Math.cos(a) * (32 + wob), 2 + Math.sin(a) * (36 + wob), pass === 0 ? 16 : 14, pass === 0 ? out : (k % 2 ? shade : fur));
        }
      }
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, 2, 34, 38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(-4, 16, 20, 20, 0, 0, Math.PI * 2); ctx.fill();
      // 머리
      const hy0 = -42;
      // 뿔 두 개
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#e6dcc4'; ctx.strokeStyle = '#a89878'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6 + sx * 10, hy0 - 18);
        ctx.quadraticCurveTo(-6 + sx * 30, hy0 - 24, -6 + sx * 26, hy0 - 52);
        ctx.quadraticCurveTo(-6 + sx * 20, hy0 - 34, -6 + sx * 20, hy0 - 16);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; lump(-6 + Math.cos(a) * 24, hy0 + Math.sin(a) * 21, 11, out); }
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; lump(-6 + Math.cos(a) * 24, hy0 + Math.sin(a) * 21, 9.5, k % 2 ? shade : fur); }
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(-6, hy0, 26, 22, 0, 0, Math.PI * 2); ctx.fill();
      // 얼굴 (침팬지처럼 튀어나온 주둥이)
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-12, hy0 + 2, 17, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.flash > 0 ? '#ffe9e0' : '#c2d3e4'; ctx.beginPath(); ctx.ellipse(-20, hy0 + 8, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
      // 입
      const open = b.glow > 0 ? 3 + 8 * b.glow : (stunned || b.state === 'down' ? 7 : (air ? 8 : 2));
      ctx.fillStyle = '#3a1a2a'; ctx.beginPath(); ctx.ellipse(-20, hy0 + 11 + open / 3, 9, 1.5 + open / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (const sx of [-26, -14]) { ctx.beginPath(); ctx.moveTo(sx, hy0 + 9); ctx.lineTo(sx + 3, hy0 + 15); ctx.lineTo(sx + 6, hy0 + 9); ctx.fill(); }
      ctx.fillStyle = '#3a4a62'; ctx.fillRect(-24, hy0 + 3, 3, 2); ctx.fillRect(-18, hy0 + 3, 3, 2);
      // 눈 + 성난 눈썹
      for (const ex of [-14, 0]) {
        if (stunned || b.state === 'dying') {
          ctx.strokeStyle = '#2a3a52'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(ex - 4, hy0 - 6); ctx.lineTo(ex + 4, hy0 + 2); ctx.moveTo(ex + 4, hy0 - 6); ctx.lineTo(ex - 4, hy0 + 2); ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, hy0 - 3, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d63a2a'; ctx.beginPath(); ctx.arc(ex - 1.5, hy0 - 3, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a1a2a'; ctx.fillRect(ex - 2, hy0 - 5, 2, 4);
        }
      }
      if (!stunned && b.state !== 'dying') {
        ctx.strokeStyle = '#2a3a52'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-22, hy0 - 12); ctx.lineTo(-10, hy0 - 7); ctx.moveTo(6, hy0 - 12); ctx.lineTo(-4, hy0 - 7); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      // 앞쪽 팔
      const fa = arms(false);
      if (clinging && b.arm > 0) { // 던질 눈덩이를 들어 올린다
        const r = 10 + 14 * b.arm;
        lump(fa.hx, fa.hy - r + 2, r, '#cfe4f7'); lump(fa.hx - 2, fa.hy - r, r - 3, '#ffffff');
      }
      ctx.restore();
      if (stunned) {
        for (let k = 0; k < 3; k++) {
          const a = this.time * 4 + (k * Math.PI * 2) / 3;
          const sx = b.cx + Math.cos(a) * 38;
          const sy = b.y - 14 + Math.sin(a) * 8;
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

  G.ApeBoss = ApeBoss;
})(window.Game);
