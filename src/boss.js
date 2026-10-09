// 화산의 보스: 용머리 3개. 패턴은 무작위로 이어지고, 5번째 패턴이 끝날 때마다 모두 기절한다.
//   fire  화염구: 머리마다 불덩이를 쏜다. 패링으로 쳐내면 쏜 머리에게 되돌아가 큰 피해를 준다
//   tail  꼬리 내려찍기: 꼬리 2개가 경고 표시 뒤에 땅을 내려친다 (두 번 반복)
//   slam  머리 찍기: 머리 하나가 플레이어 위에서 내리찍고, 1.5초 동안 땅에 박혀 있다가 올라간다. 그때가 공격 기회
//   meteor 운석: 바닥에 표시가 뜬 곳에 하늘에서 운석이 연달아 떨어진다
//   lava  용암: 바닥이 붉게 달아오르다가 용암이 차오른다. 위의 발판으로 점프해 피한다
//   stun  5패턴마다 2.5초 동안 모든 머리가 땅에 떨어져 기절한다. 역시 공격 기회
// 이 모듈은 움직임/판정/그리기만 맡는다. 플레이어 피해/효과음/이펙트는 호출한 쪽(main)이 ev 콜백으로 처리한다.
(function (G) {
  const C = G.Config;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  const HEAD_W = 96;
  const HEAD_H = 80;
  const FIRE_SPEED = 520; // 화염구는 빠르다
  const FIRE_R = 11;
  const REFLECT_SPEED = 680;
  const TAIL_W = 52;
  const TAIL_WARN = 0.75; // 꼬리 경고 시간

  class Head {
    constructor(i, slotX, groundY, baseX) {
      this.i = i;
      this.slotX = slotX;
      this.groundY = groundY;
      this.w = HEAD_W;
      this.h = HEAD_H;
      this.cx = baseX; // 세 머리 모두 한 구멍(경기장 가운데)에서 솟아 나와 각자 자리로 퍼진다
      this.idleY = 170;
      this.cy = groundY + 130; // 용암 속에서 시작해 솟아오른다
      this.maxHp = C.BOSS_HEAD_HP;
      this.hp = this.maxHp;
      this.state = 'emerge';
      this.st = 0;
      this.tx = slotX;
      this.glow = 0;
      this.flash = 0;
      this.hitGrace = 0;
      this.dmgFx = 0;
      this.dir = 1;
      this.time = Math.random() * 6;
      this.alive = true; // 마법 판정(Magic)이 읽는 몬스터 모양 필드
      this.flying = false;
      this.appear = 0;
      this.twoHit = false;
      this.x = 0;
      this.y = 0;
      this._box();
    }

    _box() {
      this.x = this.cx - this.w / 2;
      this.y = this.cy - this.h / 2;
    }

    get restY() { return this.groundY - this.h / 2; }
    get vulnerable() { return this.alive && (this.state === 'down' || this.state === 'stun'); }
    get dead() { return this.state === 'dead'; }
    get busy() { return this.state !== 'idle'; }

    damage(n) { this.boss.damageHead(this, n); }
    applyPoison() { this.boss.damageHead(this, 1); } // 독: 보스에겐 한 번에 1

    update(dt, boss) {
      this.time += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.hitGrace = Math.max(0, this.hitGrace - dt);
      const swayY = this.idleY + Math.sin(this.time * 1.6 + this.i) * 9;
      switch (this.state) {
        case 'emerge': // 시작: 용암에서 솟아오른다
          this.st += dt;
          this.cy += (swayY - this.cy) * (1 - Math.exp(-3 * dt));
          if (this.st > 0.5) this.cx += (this.slotX - this.cx) * (1 - Math.exp(-2.5 * dt));
          if (this.st > 1.6) this.state = 'idle';
          break;
        case 'idle':
          this.cx += (this.slotX - this.cx) * (1 - Math.exp(-5 * dt));
          this.cy += (swayY - this.cy) * (1 - Math.exp(-6 * dt));
          break;
        case 'slamPrep': // 플레이어 위로 따라가다가 마지막 순간에 멈추고 떤다
          this.st += dt;
          if (this.st < 0.65) this.tx = boss.playerX;
          this.cx += clamp(this.tx - this.cx, -330 * dt, 330 * dt);
          this.cx = clamp(this.cx, boss.left + 50, boss.right - 50);
          this.cy += (this.idleY - 40 - this.cy) * (1 - Math.exp(-8 * dt));
          this.glow = Math.min(1, this.st / 0.9);
          if (this.st >= 0.95) { this.state = 'slamDown'; this.st = 0; this.glow = 0; }
          break;
        case 'slamDown':
          this.cy += 1250 * dt;
          if (this.cy >= this.restY) {
            this.cy = this.restY;
            this.state = 'down';
            this.st = C.BOSS_SLAM_DOWN;
            boss.ev.slamImpact(this.cx, this.groundY);
          }
          break;
        case 'down':
          this.st -= dt;
          if (this.st <= 0) this.state = 'rise';
          break;
        case 'stunFall':
          this.cx += (this.slotX - this.cx) * (1 - Math.exp(-8 * dt));
          this.cy += 900 * dt;
          if (this.cy >= this.restY) {
            this.cy = this.restY;
            this.state = 'stun';
            boss.ev.slamImpact(this.cx, this.groundY);
          }
          break;
        case 'stun':
          break; // Boss가 끝낸다
        case 'rise':
          this.cy -= 320 * dt;
          this.cx += clamp(this.slotX - this.cx, -220 * dt, 220 * dt);
          if (this.cy <= swayY) { this.cy = swayY; this.state = 'idle'; }
          break;
        case 'dying':
          this.st += dt;
          this.cy += 70 * dt;
          if (Math.random() < dt * 14) boss.ev.fx('fire', this.cx + rnd(-40, 40), this.cy + rnd(-30, 30));
          if (this.st > 1.5) { this.state = 'dead'; boss.ev.fx('boom', this.cx, this.cy); }
          break;
      }
      this._box();
    }
  }

  class Boss {
    // left/width: 경기장 가로 범위(px), groundY: 바닥 윗면 y
    constructor(left, width, groundY, ev) {
      this.left = left;
      this.right = left + width;
      this.groundY = groundY;
      this.ev = ev;
      this.baseX = left + width / 2;
      this.heads = [0, 1, 2].map((i) => {
        const h = new Head(i, left + width * (1 + i * 2) / 6, groundY, left + width / 2);
        h.boss = this;
        return h;
      });
      this.fireballs = [];
      this.tails = [];
      this.meteors = [];
      this.lava = null; // {st:'warn'|'rise'|'stay'|'fall', t, h}
      this.phase = 'intro';
      this.timer = 1.8;
      this.pat = null;
      this.patternCount = 0;
      this.playerX = left + width / 2;
      this.done = false;
      this.time = 0;
    }

    get alive() { return this.heads.filter((h) => h.alive); }
    targets() { return this.heads.filter((h) => h.vulnerable); }

    damageHead(h, n) {
      if (!h.alive) return;
      h.hp -= n;
      h.dmgFx += n;
      h.flash = 0.18;
      if (h.hp <= 0) {
        h.hp = 0;
        h.alive = false;
        h.state = 'dying';
        h.st = 0;
        h.glow = 0;
        this.ev.fx('headDie', h.cx, h.cy);
      }
    }

    // 플레이어의 베기/던진 검이 닿은 (맞을 수 있는) 머리들에게 피해. 맞은 머리 목록을 돌려준다
    hitHeads(rect, dmg) {
      const out = [];
      for (const h of this.targets()) {
        if (h.hitGrace > 0) continue;
        if (rect.x < h.x + h.w && rect.x + rect.w > h.x && rect.y < h.y + h.h && rect.y + rect.h > h.y) {
          h.hitGrace = 0.28;
          this.damageHead(h, dmg);
          out.push(h);
        }
      }
      return out;
    }

    // 패링 중 범위에 들어온 화염구를 쏜 머리 쪽으로 되돌려 보낸다. 쳐낸 개수를 돌려준다
    deflect(rect) {
      let n = 0;
      for (const f of this.fireballs) {
        if (f.reflected) continue;
        if (f.x + FIRE_R < rect.x || f.x - FIRE_R > rect.x + rect.w || f.y + FIRE_R < rect.y || f.y - FIRE_R > rect.y + rect.h) continue;
        f.reflected = true;
        const o = f.owner && f.owner.alive ? f.owner : this.alive[0];
        let dx = -f.vx;
        let dy = -f.vy;
        if (o) { dx = o.cx - f.x; dy = o.cy - f.y; }
        const len = Math.hypot(dx, dy) || 1;
        f.vx = (dx / len) * REFLECT_SPEED;
        f.vy = (dy / len) * REFLECT_SPEED;
        f.life = 3;
        n += 1;
      }
      // 운석: 떨어지는 중에 쳐내면 가장 가까운 머리로 날아가 큰 피해
      for (const m of this.meteors) {
        if (m.st !== 'fall' || m.x + 20 < rect.x || m.x - 20 > rect.x + rect.w || m.y + 20 < rect.y || m.y - 20 > rect.y + rect.h) continue;
        m.st = 'rf';
        m.t = 0;
        const o = this._nearestHead(m.x, m.y);
        const dx = o ? o.cx - m.x : 0;
        const dy = o ? o.cy - m.y : -1;
        const len = Math.hypot(dx, dy) || 1;
        m.vx = (dx / len) * 900;
        m.vy = (dy / len) * 900;
        n += 1;
      }
      // 꼬리: 내려찍는 순간 쳐내면 꼬리가 되튕겨 올라가고, 가까운 머리가 맞는다
      for (const t of this.tails) {
        if (t.hit || t.parried || (t.st !== 'slam' && !(t.st === 'stay' && t.t < 0.2))) continue;
        if (t.x + TAIL_W / 2 < rect.x || t.x - TAIL_W / 2 > rect.x + rect.w) continue;
        t.parried = true;
        t.st = 'retract';
        t.t = 0;
        const o = this._nearestHead(t.x, this.groundY - 100);
        if (o) this.damageHead(o, C.BOSS_PARRY_DAMAGE);
        this.ev.fx('burst', t.x, this.groundY - 20);
        n += 1;
      }
      // 머리: 내리찍는 머리를 쳐내면 튕겨 올라가며 피해를 입는다
      for (const h of this.heads) {
        if (h.state !== 'slamDown' || h.x + h.w < rect.x || h.x > rect.x + rect.w || h.y + h.h < rect.y || h.y > rect.y + rect.h) continue;
        h.state = 'rise';
        h.flash = 0.25;
        this.damageHead(h, C.BOSS_PARRY_DAMAGE);
        this.ev.fx('burst', h.cx, h.cy + h.h / 2);
        n += 1;
      }
      return n;
    }

    _nearestHead(x, y) {
      let best = null;
      let bd = Infinity;
      for (const h of this.alive) {
        const d = Math.hypot(h.cx - x, h.cy - y);
        if (d < bd) { bd = d; best = h; }
      }
      return best;
    }

    _startPattern() {
      const live = this.alive;
      if (live.length === 0) return;
      const type = ['fire', 'tail', 'slam', 'meteor', 'lava'][Math.floor(Math.random() * 5)];
      this.pat = { type, t: 0 };
      if (type === 'fire') {
        this.pat.shots = [];
        live.forEach((h, j) => {
          this.pat.shots.push({ h, at: 0.7 + j * 0.45, fired: false });
          this.pat.shots.push({ h, at: 2.5 + j * 0.45, fired: false });
        });
        this.pat.end = 2.5 + live.length * 0.45 + 0.8;
      } else if (type === 'tail') {
        this.pat.wave = 0;
      } else if (type === 'lava') {
        this.lava = { st: 'warn', t: 0, h: 0 };
        this.ev.sound('spawn');
      } else if (type === 'meteor') {
        this.pat.i = 0;
        this.pat.n = 9;
      } else {
        this.pat.h = live[Math.floor(Math.random() * live.length)];
        this.pat.h.state = 'slamPrep';
        this.pat.h.st = 0;
      }
      this.phase = 'pattern';
    }

    // 꼬리는 번갈아 가며 빠르게 여러 번 내려찍는다: 짝수 번째는 플레이어 위치, 홀수 번째는 옆쪽
    _spawnTail(i) {
      const side = i % 4 === 1 ? -1 : 1;
      const off = i % 2 === 0 ? 0 : side * rnd(110, 190);
      const x = clamp(this.playerX + off, this.left + 50, this.right - 50);
      this.tails.push({ x, off, t: 0, st: 'warn', hit: false, tip: -80 });
    }

    _fire(h) {
      const px = this.playerX;
      const py = this.playerY;
      const sx = h.cx + h.dir * 30;
      const sy = h.cy + 14;
      let dx = px - sx;
      let dy = py - sy;
      const len = Math.hypot(dx, dy) || 1;
      this.fireballs.push({ x: sx, y: sy, vx: (dx / len) * FIRE_SPEED, vy: (dy / len) * FIRE_SPEED, owner: h, reflected: false, life: 5, t: 0 });
      this.ev.sound('fire');
    }

    update(dt, player) {
      this.time += dt;
      this.playerX = player.x + player.w / 2;
      this.playerY = player.y + player.h / 2;
      const live = this.alive;
      for (const h of this.heads) {
        h.dir = this.playerX < h.cx ? -1 : 1;
        h.update(dt, this);
      }
      // 모두 쓰러지면 끝
      if (this.heads.every((h) => h.dead)) {
        this.fireballs.length = 0;
        this.tails.length = 0;
        this.meteors.length = 0;
        this.lava = null;
        if (!this.done) { this.done = true; this.ev.defeated(); }
        return;
      }
      if (live.length === 0) { this.fireballs.length = 0; this.tails.length = 0; this.meteors.length = 0; this.lava = null; return; }

      // ---- 패턴 진행 ----
      if (this.phase === 'intro' || this.phase === 'rest') {
        this.timer -= dt;
        if (this.timer <= 0) this._startPattern();
      } else if (this.phase === 'pattern') {
        const p = this.pat;
        p.t += dt;
        let finished = false;
        if (p.type === 'fire') {
          for (const s of p.shots) {
            if (s.fired || !s.h.alive) continue;
            if (p.t >= s.at) { s.fired = true; s.h.glow = 0; this._fire(s.h); }
            else if (p.t > s.at - 0.55) s.h.glow = (p.t - (s.at - 0.55)) / 0.55;
          }
          finished = p.t >= p.end;
        } else if (p.type === 'tail') {
          while (p.wave < 9 && p.t >= p.wave * 0.4) { this._spawnTail(p.wave); p.wave += 1; }
          finished = p.wave >= 9 && this.tails.length === 0;
        } else if (p.type === 'lava') {
          finished = !this.lava;
        } else if (p.type === 'meteor') {
          while (p.i < p.n && p.t >= p.i * 0.3) { // 첫 운석은 플레이어 위치, 나머지는 주변에 흩어진다
            const x = clamp(this.playerX + (p.i === 0 ? 0 : rnd(-170, 170)), this.left + 30, this.right - 30);
            this.meteors.push({ x, y: -50, t: 0, st: 'warn', hit: false });
            p.i += 1;
          }
          finished = p.i >= p.n && this.meteors.length === 0;
        } else {
          finished = !p.h.alive || p.h.state === 'idle';
        }
        if (finished) {
          this.patternCount += 1;
          this.pat = null;
          if (this.patternCount % 5 === 0) {
            this.phase = 'stun';
            this.timer = C.BOSS_STUN_TIME;
            for (const h of this.alive) { h.state = 'stunFall'; h.glow = 0; }
            this.ev.stunned();
          } else {
            this.phase = 'rest';
            this.timer = rnd(0.5, 1.0);
          }
        }
      } else if (this.phase === 'stun') {
        if (this.alive.every((h) => h.state === 'stun')) this.timer -= dt;
        if (this.timer <= 0) {
          for (const h of this.alive) h.state = 'rise';
          this.phase = 'rest';
          this.timer = 0.9;
        }
      }

      // ---- 꼬리 ----
      for (const t of this.tails) {
        t.t += dt;
        if (t.st === 'warn') {
          if (t.t < TAIL_WARN - 0.3) { // 마지막 0.3초는 위치가 고정된다
            const goal = clamp(this.playerX + t.off, this.left + 50, this.right - 50);
            t.x += clamp(goal - t.x, -420 * dt, 420 * dt);
            t.x = clamp(t.x, this.left + 50, this.right - 50);
          }
          if (t.t >= TAIL_WARN) { t.st = 'slam'; t.t = 0; }
        } else if (t.st === 'slam') {
          t.tip = -80 + (this.groundY + 80) * Math.min(1, t.t / 0.08);
          if (t.t >= 0.08) { t.st = 'stay'; t.t = 0; t.tip = this.groundY; this.ev.slamImpact(t.x, this.groundY); }
        } else if (t.st === 'stay') {
          if (t.t >= 0.3) { t.st = 'retract'; t.t = 0; }
        } else if (t.st === 'retract') {
          t.tip = (t.tip0 === undefined ? (t.tip0 = t.tip) : t.tip0) - (t.tip0 + 80) * Math.min(1, t.t / 0.22);
          if (t.t >= 0.22) t.dead = true;
        }
      }
      this.tails = this.tails.filter((t) => !t.dead);

      // ---- 용암 ----
      const lv = this.lava;
      if (lv) {
        lv.t += dt;
        const H = C.BOSS_LAVA_HEIGHT;
        if (lv.st === 'warn') { if (lv.t >= 1.5) { lv.st = 'rise'; lv.t = 0; this.ev.sound('fire'); this.ev.shake(6, 0.4); } }
        else if (lv.st === 'rise') { lv.h = H * Math.min(1, lv.t / 0.35); if (lv.t >= 0.35) { lv.st = 'stay'; lv.t = 0; } }
        else if (lv.st === 'stay') { lv.h = H; if (lv.t >= 1.6) { lv.st = 'fall'; lv.t = 0; } }
        else { lv.h = H * (1 - Math.min(1, lv.t / 0.6)); if (lv.t >= 0.6) this.lava = null; }
      }

      // ---- 운석 ----
      for (const m of this.meteors) {
        m.t += dt;
        if (m.st === 'rf') { // 쳐낸 운석: 머리를 향해 날아간다
          const o = this._nearestHead(m.x, m.y);
          if (o) {
            const dx = o.cx - m.x;
            const dy = o.cy - m.y;
            const len = Math.hypot(dx, dy) || 1;
            m.vx += ((dx / len) * 900 - m.vx) * Math.min(1, 7 * dt);
            m.vy += ((dy / len) * 900 - m.vy) * Math.min(1, 7 * dt);
            if (Math.abs(m.x - o.cx) < o.w / 2 + 16 && Math.abs(m.y - o.cy) < o.h / 2 + 16) {
              this.damageHead(o, C.BOSS_METEOR_DAMAGE);
              this.ev.fx('burst', m.x, m.y);
              this.ev.sound('parry');
              m.dead = true;
              continue;
            }
          }
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.t > 3 || m.y > this.groundY) m.dead = true;
          continue;
        }
        if (m.st === 'warn') {
          if (m.t >= 0.7) { m.st = 'fall'; m.t = 0; this.ev.sound('fire'); }
        } else if (m.st === 'fall') {
          m.y += 1500 * dt;
          if (m.y >= this.groundY - 10) { m.y = this.groundY - 10; m.st = 'boom'; m.t = 0; m.hit = false; this.ev.slamImpact(m.x, this.groundY); }
        } else if (m.t >= 0.4) m.dead = true;
      }
      this.meteors = this.meteors.filter((m) => !m.dead);

      // ---- 화염구 ----
      for (const f of this.fireballs) {
        f.t += dt;
        f.life -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y > this.groundY || f.x < this.left - 40 || f.x > this.right + 40 || f.life <= 0) { f.dead = true; if (f.y > this.groundY) this.ev.fx('burst', f.x, this.groundY); continue; }
        if (f.reflected) {
          const to = f.owner && f.owner.alive ? f.owner : this.alive[0]; // 되튕긴 화염구는 쏜 머리를 향해 살짝 따라간다
          if (to) {
            const dx = to.cx - f.x;
            const dy = to.cy - f.y;
            const len = Math.hypot(dx, dy) || 1;
            const k = Math.min(1, 7 * dt);
            f.vx += ((dx / len) * REFLECT_SPEED - f.vx) * k;
            f.vy += ((dy / len) * REFLECT_SPEED - f.vy) * k;
          }
          for (const h of this.alive) {
            if (Math.abs(f.x - h.cx) < h.w / 2 + FIRE_R && Math.abs(f.y - h.cy) < h.h / 2 + FIRE_R) {
              f.dead = true;
              this.damageHead(h, C.BOSS_REFLECT_DAMAGE);
              this.ev.fx('burst', f.x, f.y);
              this.ev.sound('parry');
              break;
            }
          }
        }
      }
      this.fireballs = this.fireballs.filter((f) => !f.dead);

      // ---- 플레이어 피해 판정 ----
      // 빨리 떨어지는 것(머리, 운석, 꼬리)이 한 프레임에 패링 범위를 건너뛰지 않게, 피해 판정 직전에 몸 주변을 한 번 더 쳐낸다
      if (player.parrying && this.deflect({ x: player.x - 14, y: player.y - 14, w: player.w + 28, h: player.h + 28 })) this.ev.sound('parry');
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const f of this.fireballs) {
          if (!f.reflected && Math.abs(f.x - (player.x + player.w / 2)) < player.w / 2 + FIRE_R - 2 && Math.abs(f.y - (player.y + player.h / 2)) < player.h / 2 + FIRE_R - 2) {
            f.dead = true;
            this.ev.fx('burst', f.x, f.y);
            hurt = true;
          }
        }
        for (const t of this.tails) {
          const harmful = (t.st === 'slam' && t.t > 0.03) || (t.st === 'stay' && t.t < 0.15);
          if (harmful && !t.hit && !t.parried && t.tip >= player.y && Math.abs(t.x - (player.x + player.w / 2)) < TAIL_W / 2 + player.w / 2 - 4) { t.hit = true; hurt = true; }
        }
        if (this.lava && this.lava.h > 8 && player.y + player.h > this.groundY - this.lava.h + 8) hurt = true; // 용암에 닿음
        for (const m of this.meteors) {
          if (m.hit) continue;
          const near = m.st === 'fall' ? Math.abs(m.x - (player.x + player.w / 2)) < 20 + player.w / 2 - 4 && Math.abs(m.y - (player.y + player.h / 2)) < 18 + player.h / 2 : m.st === 'boom' && m.t < 0.2 && Math.abs(m.x - (player.x + player.w / 2)) < 44 + player.w / 2 - 6 && player.y + player.h > this.groundY - 40;
          if (near) { m.hit = true; hurt = true; }
        }
        for (const h of this.heads) {
          if (h.state === 'slamDown' && player.overlaps({ x: h.x + 8, y: h.y + 4, w: h.w - 16, h: h.h - 8 }) && player.x + player.w > h.x && player.x < h.x + h.w) hurt = true;
        }
        if (hurt) this.ev.hurt();
      }
    }

    // ---------- 그리기 ----------
    // 땅 뒤: 용암에서 올라오는 목
    drawBack(ctx) {
      for (const h of this.heads) {
        if (h.dead) continue;
        const bx = this.baseX; // 목은 모두 같은 구멍에서 뻗는다
        const by = this.groundY + 90;
        const hx = h.cx;
        const hy = h.cy + 24;
        const cpx = (bx + hx) / 2 + (hx - bx) * 0.1;
        const cpy = Math.min(hy + 140, (by + hy) / 2 - 20);
        const pass = (w, color) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(cpx, cpy, hx, hy);
          ctx.stroke();
        };
        pass(46, '#4a0f08');
        pass(38, h.flash > 0 ? '#ffb090' : '#8a2112');
        pass(12, '#d9863a');
        ctx.lineCap = 'butt';
        // 목 비늘 마디
        for (let k = 1; k < 12; k++) {
          const u = k / 12;
          const x = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cpx + u * u * hx;
          const y = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cpy + u * u * hy;
          ctx.fillStyle = '#c0391c';
          ctx.beginPath(); ctx.moveTo(x - 4, y - 22); ctx.lineTo(x + 3, y - 34); ctx.lineTo(x + 10, y - 22); ctx.fill();
        }
      }
    }

    // 땅 앞: 머리, 꼬리, 경고 표시, 화염구
    drawFront(ctx) {
      this._drawLava(ctx);
      for (const h of this.heads) if (h.state === 'slamPrep') this._drawMark(ctx, h.tx, h.w + 12, h.st / 0.95, h.st > 0.65);
      for (const m of this.meteors) if (m.st === 'warn') this._drawMark(ctx, m.x, 76, m.t / 0.7, m.t > 0.4);
      for (const t of this.tails) this._drawTail(ctx, t);
      for (const m of this.meteors) if (m.st !== 'warn') this._drawMeteor(ctx, m);
      for (const h of this.heads) if (!h.dead) this._drawHead(ctx, h);
      for (const f of this.fireballs) this._drawFire(ctx, f);
    }

    // 떨어질 곳 표시: 바닥의 붉은 영역 + 하늘까지 이어지는 빛기둥 + 아래를 가리키는 화살표. 확정되면 빠르게 깜빡인다
    _drawMark(ctx, x, w, a, locked) {
      const gy = this.groundY;
      const blink = locked ? (Math.floor(this.time * 14) % 2 ? 1 : 0.45) : 0.85;
      const al = (0.35 + 0.5 * Math.min(1, a)) * blink;
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, 'rgba(255,60,20,0)');
      g.addColorStop(1, `rgba(255,70,20,${0.62 * al})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, 0, w, gy);
      ctx.fillStyle = `rgba(255,40,10,${al})`;
      ctx.fillRect(x - w / 2, gy - 8, w, 8);
      ctx.fillStyle = `rgba(255,235,150,${al})`;
      ctx.fillRect(x - w / 2, gy - 10, w, 2);
      ctx.strokeStyle = `rgba(255,235,150,${al})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - w / 2, 0, w, gy - 8);
      const bob = (this.time * 90) % 40;
      for (let k = 0; k < 3; k++) { // 아래를 가리키는 화살표가 흘러내린다
        const y = gy - 70 - k * 40 + bob;
        if (y > gy - 24) continue;
        ctx.fillStyle = `rgba(255,255,255,${al})`;
        ctx.beginPath(); ctx.moveTo(x - 14, y - 10); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x, y + 8); ctx.fill();
      }
    }

    // 바닥 용암: 먼저 바닥이 붉게 달아오르며 깜빡이고(경고), 곧 차오른다
    _drawLava(ctx) {
      const lv = this.lava;
      if (!lv) return;
      const gy = this.groundY;
      const w = this.right - this.left;
      if (lv.st === 'warn') {
        const u = Math.min(1, lv.t / 1.5);
        const blink = lv.t > 0.9 ? (Math.floor(this.time * 12) % 2 ? 1 : 0.5) : 0.8;
        ctx.fillStyle = `rgba(255,60,10,${(0.25 + 0.5 * u) * blink})`;
        ctx.fillRect(this.left, gy - 10, w, 10);
        ctx.fillStyle = `rgba(255,220,120,${0.7 * blink})`;
        ctx.fillRect(this.left, gy - 12, w, 2);
        for (let x = this.left + 20; x < this.right; x += 70) { // 달아오른 바닥에서 올라오는 위쪽 화살표
          const y = gy - 24 - ((this.time * 60 + x) % 36);
          ctx.fillStyle = `rgba(255,255,255,${0.8 * blink})`;
          ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x, y - 8); ctx.fill();
        }
        return;
      }
      const h = lv.h;
      const g = ctx.createLinearGradient(0, gy - h, 0, gy);
      g.addColorStop(0, '#ffd45a'); g.addColorStop(0.25, '#ff7a1f'); g.addColorStop(1, '#c62a0a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.left, gy);
      for (let x = this.left; x <= this.right; x += 8) ctx.lineTo(x, gy - h + Math.sin(x * 0.07 + this.time * 7) * 4);
      ctx.lineTo(this.right, gy);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,170,0.8)';
      for (let x = this.left + 10; x < this.right; x += 46) ctx.fillRect(x + ((this.time * 30 + x) % 20), gy - h + 8 + ((x * 7) % 20), 4, 3);
    }

    _drawMeteor(ctx, m) {
      if (m.st === 'boom') {
        const u = m.t / 0.4;
        const r = 20 + 52 * u;
        const g = ctx.createRadialGradient(m.x, this.groundY - 6, 2, m.x, this.groundY - 6, r);
        g.addColorStop(0, `rgba(255,250,200,${1 - u})`); g.addColorStop(0.5, `rgba(255,140,40,${0.8 * (1 - u)})`); g.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(m.x - r, this.groundY - 6 - r, r * 2, r * 2);
        return;
      }
      const rf = m.st === 'rf';
      const sp = rf ? Math.hypot(m.vx, m.vy) || 1 : 1;
      const ux = rf ? m.vx / sp : 0;
      const uy = rf ? m.vy / sp : 1;
      for (let i = 5; i >= 1; i--) { // 날아온 쪽으로 길게 꼬리
        ctx.fillStyle = rf ? `rgba(120,200,255,${0.5 - i * 0.08})` : `rgba(255,${130 + i * 15},40,${0.5 - i * 0.08})`;
        ctx.beginPath(); ctx.arc(m.x - ux * i * 16, m.y - uy * i * 16, 18 - i * 2, 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createRadialGradient(m.x, m.y, 3, m.x, m.y, 34);
      g.addColorStop(0, 'rgba(255,240,170,0.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g; ctx.fillRect(m.x - 34, m.y - 34, 68, 68);
      ctx.fillStyle = '#4a1d10';
      ctx.beginPath(); ctx.moveTo(m.x - 18, m.y - 4); ctx.lineTo(m.x - 8, m.y - 18); ctx.lineTo(m.x + 10, m.y - 16); ctx.lineTo(m.x + 19, m.y); ctx.lineTo(m.x + 8, m.y + 17); ctx.lineTo(m.x - 10, m.y + 16); ctx.fill();
      ctx.fillStyle = '#ff7a2a';
      ctx.fillRect(m.x - 8, m.y - 8, 6, 5); ctx.fillRect(m.x + 3, m.y + 2, 7, 5); ctx.fillRect(m.x - 2, m.y + 7, 5, 4);
    }

    _drawTail(ctx, t) {
      const gy = this.groundY;
      if (t.st === 'warn') { // 바닥의 경고 (또렷한 표시)
        this._drawMark(ctx, t.x, TAIL_W + 24, t.t / TAIL_WARN, t.t > TAIL_WARN - 0.3);
        return;
      }
      const top = -80;
      const tip = t.tip;
      const w0 = TAIL_W;
      for (let y = top; y < tip; y += 8) { // 위가 굵고 끝이 가는 비늘 기둥
        const u = (y - top) / (tip - top + 1);
        const w = w0 * (1 - 0.35 * u);
        ctx.fillStyle = (Math.floor(y / 8) % 2) ? '#8a2112' : '#a22a16';
        ctx.fillRect(t.x - w / 2, y, w, 9);
        ctx.fillStyle = '#4a0f08';
        ctx.fillRect(t.x - w / 2, y, 3, 9);
        ctx.fillRect(t.x + w / 2 - 3, y, 3, 9);
      }
      ctx.fillStyle = '#d9863a'; // 꼬리 끝 가시
      ctx.beginPath(); ctx.moveTo(t.x - 30, tip - 4); ctx.lineTo(t.x, tip + 18); ctx.lineTo(t.x + 30, tip - 4); ctx.lineTo(t.x + 12, tip - 14); ctx.lineTo(t.x - 12, tip - 14); ctx.fill();
      ctx.fillStyle = '#e8d9b0';
      ctx.beginPath(); ctx.moveTo(t.x - 8, tip - 10); ctx.lineTo(t.x, tip + 14); ctx.lineTo(t.x + 8, tip - 10); ctx.fill();
    }

    _drawFire(ctx, f) {
      const col = f.reflected ? ['#e6f6ff', '#6cc4ff', 'rgba(40,120,255,0)'] : ['#fffbe0', '#ffb347', 'rgba(255,90,20,0)'];
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 22);
      g.addColorStop(0, col[0]); g.addColorStop(0.35, col[1]); g.addColorStop(1, col[2]);
      ctx.fillStyle = g; ctx.fillRect(f.x - 22, f.y - 22, 44, 44);
      ctx.fillStyle = f.reflected ? '#3a9bff' : '#ff7a2a';
      ctx.beginPath(); ctx.arc(f.x, f.y, FIRE_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col[0];
      ctx.beginPath(); ctx.arc(f.x, f.y, FIRE_R * 0.5, 0, Math.PI * 2); ctx.fill();
      const ang = Math.atan2(f.vy, f.vx);
      for (let i = 1; i <= 4; i++) { // 꼬리
        ctx.fillStyle = f.reflected ? `rgba(120,200,255,${0.4 - i * 0.07})` : `rgba(255,${150 - i * 15},40,${0.45 - i * 0.08})`;
        ctx.beginPath(); ctx.arc(f.x - Math.cos(ang) * i * 9, f.y - Math.sin(ang) * i * 9, FIRE_R - i * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    _drawHead(ctx, h) {
      ctx.save();
      ctx.translate(h.cx, h.cy);
      let sh = 0;
      if (h.state === 'slamPrep' && h.st > 0.6) sh = Math.sin(this.time * 90) * 3;
      if (h.state === 'dying') sh = Math.sin(this.time * 70) * 4;
      ctx.translate(sh, 0);
      ctx.scale(h.dir === 1 ? -1 : 1, 1); // 기본 모양은 왼쪽을 본다
      const stunned = h.state === 'stun' || h.state === 'stunFall';
      if (stunned) ctx.rotate(0.12);
      const dark = '#5c130a';
      const body = h.flash > 0 ? '#ffd0b8' : (h.state === 'dying' ? '#6a3a30' : '#a32a16');
      const light = h.flash > 0 ? '#fff0e0' : '#c8401f';
      // 불 입김 빛 (화염구 직전)
      if (h.glow > 0) {
        const g = ctx.createRadialGradient(-44, 14, 2, -44, 14, 14 + 34 * h.glow);
        g.addColorStop(0, `rgba(255,240,170,${0.9 * h.glow})`); g.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = g; ctx.fillRect(-100, -40, 100, 110);
      }
      // 뿔
      ctx.fillStyle = '#e8d9b0';
      ctx.beginPath(); ctx.moveTo(10, -26); ctx.lineTo(34, -64); ctx.lineTo(30, -22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(26, -22); ctx.lineTo(58, -48); ctx.lineTo(44, -8); ctx.fill();
      // 아래턱 (예비동작/기절 때 벌어진다)
      const open = h.glow > 0 ? 0.45 * h.glow : (stunned ? 0.3 : h.state === 'slamPrep' || h.state === 'slamDown' ? 0.5 : 0.05);
      ctx.save();
      ctx.translate(2, 18);
      ctx.rotate(open);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(-44, 6); ctx.lineTo(-40, -2); ctx.lineTo(30, -6); ctx.lineTo(36, 14); ctx.lineTo(-6, 22); ctx.lineTo(-42, 16); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(-44, 10); ctx.lineTo(-38, 4); ctx.lineTo(28, 0); ctx.lineTo(34, 12); ctx.lineTo(-6, 20); ctx.fill();
      ctx.fillStyle = '#fff6dd';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-36 + k * 16, 3 - k * 0.3); ctx.lineTo(-30 + k * 16, -9); ctx.lineTo(-25 + k * 16, 2); ctx.fill(); }
      ctx.fillStyle = h.glow > 0 ? '#ffb347' : '#7a1a10'; // 입 안
      ctx.fillRect(-34, -3, 56, 4);
      ctx.restore();
      // 머리 위쪽 (두개골과 주둥이)
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(-52, 14); ctx.lineTo(-46, -12); ctx.lineTo(-10, -34); ctx.lineTo(34, -32); ctx.lineTo(50, -4); ctx.lineTo(44, 24); ctx.lineTo(-4, 20); ctx.lineTo(-40, 20); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(-48, 12); ctx.lineTo(-43, -9); ctx.lineTo(-10, -30); ctx.lineTo(32, -28); ctx.lineTo(45, -4); ctx.lineTo(40, 18); ctx.lineTo(-6, 16); ctx.lineTo(-38, 16); ctx.fill();
      ctx.fillStyle = light; // 비늘 하이라이트
      for (let k = 0; k < 5; k++) ctx.fillRect(-4 + k * 9, -24 + (k % 2) * 6, 6, 3);
      ctx.fillRect(-36, -6, 14, 3);
      ctx.fillStyle = '#fff6dd'; // 윗니
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-40 + k * 16, 14); ctx.lineTo(-34 + k * 16, 25); ctx.lineTo(-28 + k * 16, 14); ctx.fill(); }
      // 콧구멍 연기
      ctx.fillStyle = dark;
      ctx.fillRect(-44, -2, 5, 4);
      // 눈
      if (stunned || h.state === 'dying') {
        ctx.strokeStyle = '#ffeb6a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-24, -20); ctx.lineTo(-12, -8); ctx.moveTo(-12, -20); ctx.lineTo(-24, -8); ctx.stroke();
      } else {
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath(); ctx.moveTo(-26, -12); ctx.lineTo(-10, -22); ctx.lineTo(-8, -10); ctx.lineTo(-22, -6); ctx.fill();
        ctx.fillStyle = '#220000';
        ctx.fillRect(-17, -18, 3, 9);
      }
      ctx.restore();
      if (stunned) { // 머리 위에 도는 별
        for (let k = 0; k < 3; k++) {
          const a = this.time * 4 + (k * Math.PI * 2) / 3;
          const sx = h.cx + Math.cos(a) * 34;
          const sy = h.y - 22 + Math.sin(a) * 8;
          ctx.fillStyle = '#ffe14a';
          ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.fill();
        }
      }
      if (h.state === 'down') { // 땅에 박힌 머리: 맞힐 수 있다는 표시 (깜빡이는 테두리)
        ctx.strokeStyle = Math.floor(this.time * 8) % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(255,230,120,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(h.x - 2, h.y - 2, h.w + 4, h.h + 4);
      }
    }
  }

  G.Boss = Boss;
})(window.Game);
