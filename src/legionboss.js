// 군단 요새의 보스 3명. 왕슬라임(king.js)의 틀(몸, 구슬 패링, 기절, 등장/쓰러짐)을 쓰지만 패턴과 모습은 전부 새로 만들었다.
// 서로 겹치는 패턴이 하나도 없다:
//   철갑 거인   : 철퇴 휘두르기(mace) · 방패 부메랑(shield) · 지뢰 투하(mines)
//   마도사 장군 : 번개 기둥(pillars) · 회전 광선(beam) · 분신 사격(clones)
//   군단장      : 일제 포격(barrage) · 창 투척(spears) · 참격파(slash, 패링으로만 막을 수 있다)
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  const DEF = [
    { name: '군단의 철갑 거인', w: 150, h: 136, hp: 16000, tough: 30, weak: 'ice', hurt: 2, pats: ['mace', 'shield', 'mines'], defeat: '철갑 거인을 쓰러뜨렸다!' },
    { name: '군단의 마도사 장군', w: 92, h: 116, hp: 26000, tough: 50, weak: 'shadow', hurt: 3, pats: ['pillars', 'beam', 'clones'], defeat: '마도사 장군을 쓰러뜨렸다!', hover: 22 },
    { name: '군단장', w: 128, h: 156, hp: 40000, tough: 70, weak: 'fire', hurt: 4, pats: ['barrage', 'spears', 'slash'], defeat: '군단장을 쓰러뜨렸다!' },
  ];

  class LegionBoss extends G.KingSlime {
    constructor(left, width, groundY, ev, idx) {
      super(left, width, groundY, ev);
      const d = DEF[idx];
      this.idx = idx;
      this.d = d;
      this.kind = 'legionboss';
      this.name = d.name;
      this.defeatText = d.defeat;
      this.weak = d.weak;
      this.hurtDmg = d.hurt;
      const b = this.body;
      b.w = d.w; b.h = d.h; b.maxHp = d.hp; b.hp = d.hp;
      this.groundCy = groundY - d.h / 2;
      b.cx = this.right - d.w - 30;
      b.cy = -d.h;
      b._box();
      this.maxTough = d.tough; // 보스의 딴딴함 (100을 넘지 않는다). 다 깎아야 체력이 깎인다. 체력이 3분의 2, 3분의 1이 될 때마다 다시 단단해진다
      this.tough = d.tough;
      this.refills = [0.66, 0.33];
      b.damage = (n) => { // 총·마법: 딴딴함 1 = 3발
        if (this.tough > 0) { this.tough = Math.max(0, this.tough - 1 / 3); b.flash = 0.1; return; }
        this.damageBody(n);
      };
      this.zones = [];
      this.beams = [];
      this.clones = [];
      this.grpId = 0;
      this.timer = 1.4;
    }

    // ---------- 몸 ----------
    _updateBody(dt) {
      const b = this.body;
      b.flash = Math.max(0, b.flash - dt);
      b.hitGrace = Math.max(0, b.hitGrace - dt);
      b.st += dt;
      b.poseT = Math.max(0, (b.poseT || 0) - dt);
      if (b.poseT === 0) b.pose = 'idle';
      b.sx = 1; b.sy = 1;
      const hover = this.d.hover ? this.d.hover + 8 * Math.sin(this.time * 2.4) : 0;
      switch (b.state) {
        case 'emerge':
          b.cy += (b.st * 900 + 200) * dt;
          if (b.cy >= this.groundCy - hover) { b.cy = this.groundCy - hover; b.state = 'idle'; b.st = 0; this.ev.slamImpact(b.cx, this.groundY); }
          break;
        case 'idle':
          b.cy = this.groundCy - hover;
          b.dir = this.playerX < b.cx ? -1 : 1;
          break;
        case 'stun':
          b.cy = this.groundCy;
          break;
        case 'dying':
          b.cy += (this.groundCy - b.cy) * Math.min(1, 4 * dt);
          if (Math.random() < dt * 14) this.ev.fx('fire', b.cx + rnd(-50, 50), b.cy + rnd(-40, 40));
          if (b.st > 1.5) { b.state = 'dead'; this.ev.fx('boom', b.cx, b.cy); }
          break;
        default: b.cy = this.groundCy - hover;
      }
      b._box();
    }

    damageBody(n) {
      super.damageBody(n);
      if (!this.body.alive) { this.zones.length = 0; this.beams.length = 0; this.clones.length = 0; this.balls.length = 0; }
    }

    // ---------- 분신 ----------
    _spawnClone(x) {
      const self = this;
      const h = this.d.h;
      const c = { cx: x, cy: this.groundY - h / 2, w: 80, h, x: x - 40, y: this.groundY - h, hp: 200, maxHp: 200, alive: true, flying: false, appear: 0, twoHit: false, t: 0, fireT: 1.3 + Math.random() * 0.8, hit: 0, dmgFx: 0, fade: 0,
        damage(n) { if (!this.alive || this.hit > 0) return; const d = n || 10; this.hp -= d; this.hit = 0.28; this.dmgFx += d; if (this.hp <= 0) { this.alive = false; self.ev.fx('burst', this.cx, this.cy); self.ev.sound('vanish'); } },
        stagger() {} };
      this.clones.push(c);
      this.ev.fx('burst', c.cx, c.cy);
    }
    targets() { return (this.body.vulnerable ? [this.body] : []).concat(this.clones.filter((c) => c.alive)); }
    hitHeads(rect, dmg) {
      const bd = this.body;
      if (this.tough > 0 && bd.vulnerable && bd.hitGrace <= 0 && rect.x < bd.x + bd.w && rect.x + rect.w > bd.x && rect.y < bd.y + bd.h && rect.y + rect.h > bd.y) { // 칼: 딴딴함이 먼저 깎인다
        this.tough = Math.max(0, this.tough - 1);
        bd.hitGrace = 0.28; bd.flash = 0.12;
        if (this.tough <= 0) { this.ev.fx('burst', bd.cx, bd.cy); this.ev.sound('shatter'); }
        return [bd];
      }
      const res = super.hitHeads(rect, dmg);
      for (const c of this.clones) {
        if (c.alive && c.hit <= 0 && rect.x < c.x + c.w && rect.x + rect.w > c.x && rect.y < c.y + c.h && rect.y + rect.h > c.y) { c.damage(dmg); res.push(c); }
      }
      return res;
    }

    // ---------- 도구들 ----------
    _ball(x, y, vx, vy, extra) {
      this.balls.push(Object.assign({ x, y, vx, vy, reflected: false, life: 5, t: 0 }, extra || {}));
      this.ev.sound('spawn');
    }
    _zone(z) { z.t = 0; this.zones.push(z); }
    _pose(name, t) { this.body.pose = name; this.body.poseT = t; }

    // ---------- 패턴 ----------
    _startPattern() {
      if (!this.body.alive) return;
      const pool = this.d.pats.filter((t) => t !== this.lastType);
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.lastType = type;
      this.pat = { type, t: 0, n: 0, sub: 'start' };
      this.phase = 'pattern';
    }

    _runPattern(dt) {
      const p = this.pat;
      const b = this.body;
      p.t += dt;
      const dir = this.playerX < b.cx ? -1 : 1;
      const gy = this.groundY;
      let finished = false;
      b.dir = dir;
      switch (p.type) {
        case 'mace': { // 플레이어에게 걸어가면서 철퇴를 계속 휘두른다 (7번)
          const left = this.left + b.w / 2, right = this.right - b.w / 2;
          if (p.n < 7 || p.t < 0.5 + 7 * 0.8 + 0.4) b.cx = clamp(b.cx + dir * 175 * dt, left, right);
          if (p.n < 7 && p.t >= 0.4 + p.n * 0.8) {
            const x0 = dir > 0 ? b.cx + 30 : b.cx - 30 - 340;
            this._zone({ k: 'rect', x: x0, y: gy - 90, w: 340, h: 90, warn: 0.5, act: 0.25, kind: 'mace', dmg: 3 });
            this._pose('raise', 0.5);
            p.n += 1;
          }
          if (p.n >= 7 && p.t >= 0.4 + 7 * 0.8 + 0.9) finished = true;
          break;
        }
        case 'shield': { // 방패를 아주 빠르게 던진다. 벽에 쾅 박았다가 되돌아온다 (3번)
          const at = [0.6, 2.9, 5.2];
          if (p.n < 3 && p.t >= at[p.n]) { this._ball(b.cx + dir * 70, gy - 46, dir * 780, 0, { boom: 'wall', shield: true, life: 6, dmg: 3 }); this._pose('throw', 0.4); p.n += 1; }
          if (p.t >= 7.4) finished = true;
          break;
        }
        case 'mines': { // 지뢰를 마구 깐다 (14개). 차례로 터진다
          const N = 14;
          if (p.n < N && p.t >= 0.4 + p.n * 0.2) {
            const x = p.n < 2 ? this.playerX + (p.n ? 90 : -90) : rnd(this.left + 70, this.right - 70);
            this._zone({ k: 'circ', cx: clamp(x, this.left + 50, this.right - 50), cy: gy - 4, r: 74, warn: 1.5, act: 0.3, kind: 'mine', dmg: 4 });
            this._pose('throw', 0.2);
            p.n += 1;
          }
          if (p.t >= 0.4 + N * 0.2 + 1.9) finished = true;
          break;
        }
        case 'pillars': { // 번개 기둥이 플레이어 근처부터 줄줄이, 두 물결로 아주 많이 내리친다 (18개)
          const N = 18;
          if (p.n < N && p.t >= 0.3 + p.n * 0.2) {
            const wave = p.n < 9 ? 0 : 1;
            const k = p.n % 9;
            const off = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 105;
            const x = clamp(this.playerX + off + (wave ? rnd(-40, 40) : 0), this.left + 40, this.right - 40);
            this._zone({ k: 'rect', x: x - 36, y: 0, w: 72, h: gy, warn: 0.8, act: 0.3, kind: 'pillar', dmg: 3 });
            this._pose('cast', 0.25);
            p.n += 1;
          }
          if (p.t >= 0.3 + N * 0.2 + 1.4) finished = true;
          break;
        }
        case 'beam': { // 바닥을 훑는 회전 광선: 한쪽 끝에서 반대쪽 끝까지, 다시 되돌아오기를 2바퀴(4번 훑기)
          const far = dir > 0 ? 0.13 : Math.PI - 0.13;
          const near = dir > 0 ? Math.PI - 0.13 : 0.13;
          const sweeps = [[0.3, 3.2, 0.8], [3.7, 2.7, 0.3], [6.6, 2.7, 0.3], [9.5, 2.7, 0.3]];
          if (p.n < 4 && p.t >= sweeps[p.n][0]) {
            const dur = sweeps[p.n][1], warn = sweeps[p.n][2];
            const fwd = p.n % 2 === 0;
            this.beams.push({ t: 0, dur, warn, a0: fwd ? far : near, a1: fwd ? near : far });
            this._pose('cast', dur);
            p.n += 1;
          }
          if (p.t >= 12.5) finished = true;
          break;
        }
        case 'clones': { // 분신 4명씩 나타나 (쌓여서 최대 10명, 체력 200씩) 계속 쏜다. 때려서 없애야 한다 (맞은 만큼 쌓인다)
          const at = [0.3];
          if (p.n < 1 && p.t >= at[p.n]) {
            const alive = this.clones.filter((c) => c.alive).length;
            const W10 = (this.right - this.left) / 10;
            const free = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => !this.clones.some((c) => c.alive && Math.floor((c.cx - this.left) / W10) === k));
            for (let i = 0; i < 4 && alive + i < 10 && free.length; i++) this._spawnClone(this.left + W10 * free.splice(Math.floor(Math.random() * free.length), 1)[0] + rnd(12, W10 - 12)); // 분신은 최대 10명까지 쌓인다
            this._pose('cast', 0.5);
            p.n += 1;
          }
          if (p.t >= 5.0) finished = true;
          break;
        }
        case 'barrage': { // 일제 포격: 한쪽에서 바깥으로 줄줄이 터진다 (2번)
          const rounds = 2;
          for (let r = 0; r < rounds; r++) {
            if ((p.r || 0) === r && p.t >= 0.4 + r * 3.1) {
              p.r = r + 1;
              p.rdir = dir;
              p.rt = p.t;
              p.ri = 0;
            }
          }
          if (p.rt !== undefined && p.ri < 7 && p.t >= p.rt + p.ri * 0.26) {
            const cx = b.cx + p.rdir * (90 + p.ri * 140);
            if (cx > this.left + 30 && cx < this.right - 30) this._zone({ k: 'circ', cx, cy: gy - 6, r: 66, warn: 0.6, act: 0.26, kind: 'boom', dmg: 3 });
            this._pose('raise', 0.2);
            p.ri += 1;
          }
          if (p.t >= 0.4 + 3.1 + 2.7) finished = true;
          break;
        }
        case 'spears': { // 창을 한꺼번에 12자루 던진다. 떨어지는 박자가 모두 다르다 (패링 가능)
          if (p.n === 0 && p.t >= 0.5) {
            const sx = b.cx + dir * 40, sy = b.cy - b.h * 0.4, ay = 900;
            for (let k = 0; k < 12; k++) {
              const tt = 0.9 + Math.random() * 1.6;
              const tx = clamp(this.playerX + rnd(-420, 420), this.left + 30, this.right - 30);
              this.balls.push({ x: sx, y: sy, vx: (tx - sx) / tt, vy: (gy - 30 - sy - 0.5 * ay * tt * tt) / tt, reflected: false, life: 4, t: 0, ay, spear: true, dmg: 2 });
            }
            this.ev.sound('spawn');
            this._pose('throw', 0.5);
            p.n = 1;
          }
          if (p.t >= 4.6) finished = true;
          break;
        }
        case 'slash': { // 큰 검을 치켜든 뒤 높은 참격파를 날린다. 넘을 수 없다: 패링으로 쳐내야 한다
          const at = [1.0, 3.4];
          if (p.n < 2 && p.t >= at[p.n] - 0.9 && !p['w' + p.n]) { p['w' + p.n] = true; this._pose('raise', 0.9); this.ev.sound('charge'); }
          if (p.n < 2 && p.t >= at[p.n]) {
            const g = ++this.grpId;
            for (const dy of [14, 50, 86, 122]) this._ball(b.cx + dir * 72, gy - dy, dir * 370, 0, { wave: true, grp: g, life: 5, dmg: 5 });
            this._pose('swing', 0.3);
            p.n += 1;
          }
          if (p.t >= 5.4) finished = true;
          break;
        }
        default: finished = true;
      }
      if (finished) this._endPattern();
    }

    _endPattern() {
      const b = this.body;
      this.patternCount += 1;
      this.pat = null;
      b.attacking = false;
      if (b.state !== 'dying') b.state = 'idle';
      if (this.patternCount % 6 === 0) { // 6번째마다 기절 (너무 쉽지 않게 조금 드물게)
        this.phase = 'stun';
        this.timer = C.BOSS_STUN_TIME - 0.5;
        b.state = 'stun';
        b.st = 0;
        this.ev.stunned();
      } else {
        this.phase = 'rest';
        this.timer = rnd(0.3, 0.7);
      }
    }

    // ---------- 갱신 ----------
    deflect(rect) {
      const n = super.deflect(rect);
      if (n) { // 참격파는 한 덩어리: 하나를 쳐내면 모두 되돌아간다
        const groups = new Set(this.balls.filter((f) => f.reflected && f.grp).map((f) => f.grp));
        if (groups.size) {
          const b = this.body;
          for (const f of this.balls) {
            if (f.grp && groups.has(f.grp) && !f.reflected) {
              f.reflected = true;
              const dx = b.cx - f.x, dy = b.cy - f.y, len = Math.hypot(dx, dy) || 1;
              f.vx = (dx / len) * 640; f.vy = (dy / len) * 640; f.life = 3;
            }
          }
        }
      }
      return n;
    }

    update(dt, player) {
      const b = this.body;
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      for (const f of this.balls) {
        if (f.boom === 'wall' && !f.reflected && !f.turned && (f.x <= this.left + 22 || f.x >= this.right - 22)) { // 벽에 쾅! 박았다가 돌아온다
          f.vx = -f.vx; f.turned = true; this.ev.shake(8, 0.25); this.ev.fx('burst', f.x, f.y); this.ev.sound('vanish');
        }
      }
      let nearDmg = this.d.hurt; // 가까이 온 투사체의 대미지가 따로 있으면 그만큼 (진짜 센 공격은 5칸)
      for (const f of this.balls) if (f.dmg && !f.reflected && Math.abs(f.x - px) < player.w / 2 + 22 && Math.abs(f.y - py) < player.h / 2 + 22) nearDmg = Math.max(nearDmg, f.dmg);
      this.hurtDmg = nearDmg;
      super.update(dt, player);
      if (!b.alive) return;
      if (this.refills.length && b.hp / b.maxHp <= this.refills[0]) { // 체력이 줄 때마다 다시 단단해진다
        this.refills.shift();
        this.tough = this.maxTough;
        this.ev.sound('charge'); this.ev.shake(8, 0.3); this.ev.fx('burst', b.cx, b.cy);
      }
      // 분신: 때려서 없앨 때까지 계속 플레이어를 향해 쏜다
      for (const c of this.clones) {
        c.t += dt; c.hit = Math.max(0, c.hit - dt);
        if (!c.alive) { c.fade += dt; continue; }
        c.fireT -= dt;
        if (c.fireT <= 0) {
          c.fireT = 2.3;
          const dx = px - c.cx, dy = py - c.cy, len = Math.hypot(dx, dy) || 1;
          this._ball(c.cx, c.cy - 10, (dx / len) * 400, (dy / len) * 400, { bolt: true, life: 3 });
        }
      }
      this.clones = this.clones.filter((c) => c.alive || c.fade < 0.4);
      // 위험 구역
      let hurt = false;
      let zoneDmg = 0;
      for (const z of this.zones) {
        const was = z.t >= z.warn;
        z.t += dt;
        const on = z.t >= z.warn && z.t < z.warn + z.act;
        if (!was && z.t >= z.warn) { this.ev.shake(5, 0.15); this.ev.sound(z.kind === 'pillar' ? 'zap' : 'vanish'); this.ev.fx('burst', z.k === 'circ' ? z.cx : z.x + z.w / 2, z.k === 'circ' ? z.cy : this.groundY - 10); }
        if (on && player.invuln === 0 && !player.dashing) {
          if (z.k === 'rect') { if (px + player.w / 2 > z.x && px - player.w / 2 < z.x + z.w && player.y + player.h > z.y && player.y < z.y + z.h) { hurt = true; zoneDmg = Math.max(zoneDmg, z.dmg || 0); } }
          else { const nx = clamp(z.cx, player.x, player.x + player.w), ny = clamp(z.cy, player.y, player.y + player.h); if ((nx - z.cx) * (nx - z.cx) + (ny - z.cy) * (ny - z.cy) <= z.r * z.r) { hurt = true; zoneDmg = Math.max(zoneDmg, z.dmg || 0); } }
        }
      }
      this.zones = this.zones.filter((z) => z.t < z.warn + z.act);
      // 광선
      for (const bm of this.beams) {
        bm.t += dt;
        if (bm.t >= bm.warn && bm.t < bm.dur && player.invuln === 0 && !player.dashing) {
          const seg = this._beamSeg(bm);
          const vx = seg.x1 - seg.x0, vy = seg.y1 - seg.y0;
          const l2 = vx * vx + vy * vy || 1;
          const u = clamp(((px - seg.x0) * vx + (py - seg.y0) * vy) / l2, 0, 1);
          if (Math.hypot(px - (seg.x0 + vx * u), py - (seg.y0 + vy * u)) < 20) { hurt = true; zoneDmg = Math.max(zoneDmg, 3); }
        }
      }
      this.beams = this.beams.filter((bm) => bm.t < bm.dur);
      if (hurt) this.ev.hurt(Math.max(this.hurtDmg, zoneDmg));
    }

    _beamAngle(bm) { return bm.a0 + (bm.a1 - bm.a0) * clamp((bm.t - bm.warn) / (bm.dur - bm.warn), 0, 1); }
    _beamSeg(bm) {
      const b = this.body;
      const a = bm.t < bm.warn ? bm.a0 : this._beamAngle(bm);
      const dx = Math.cos(a), dy = Math.sin(a);
      const len = dy > 0.04 ? Math.min(1100, (this.groundY - b.cy) / dy) : 1100;
      return { x0: b.cx, y0: b.cy, x1: b.cx + dx * len, y1: b.cy + dy * len };
    }

    // ---------- 그리기 ----------
    drawBack() {}

    drawFront(ctx) {
      const gy = this.groundY;
      for (const z of this.zones) this._drawZone(ctx, z, gy);
      for (const bm of this.beams) this._drawBeam(ctx, bm);
      for (const c of this.clones) this._drawClone(ctx, c);
      if (!this.body.dead) this._paint(ctx, this.body, 1);
      if (!this.body.dead && this.body.alive) { // 딴딴함 표시
        const bd = this.body;
        ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
        const ty = bd.y - 34;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bd.cx - 40, ty, 80, 8);
        ctx.fillStyle = this.tough > 0 ? '#b08aff' : '#555'; ctx.fillRect(bd.cx - 39, ty + 1, 78 * (this.tough / this.maxTough), 6);
        ctx.fillStyle = this.tough > 0 ? '#e0d0ff' : '#aaa'; ctx.fillText(this.tough > 0 ? `딴딴함 ${Math.ceil(this.tough)}` : '금이 갔다!', bd.cx, ty - 3);
        ctx.restore();
      }
      for (const f of this.balls) this._drawBall2(ctx, f);
    }

    _drawZone(ctx, z, gy) {
      const warn = z.t < z.warn;
      const on = !warn;
      const blink = warn ? 0.35 + 0.35 * Math.abs(Math.sin(this.time * 12)) + 0.3 * (z.t / z.warn) : 1;
      const col = { mace: '255,140,60', mine: '255,60,60', pillar: '110,190,255', boom: '255,170,40' }[z.kind] || '255,120,120';
      ctx.save();
      if (z.k === 'rect') {
        ctx.fillStyle = `rgba(${col},${on ? 0.75 : 0.18 * blink})`;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = `rgba(${col},${on ? 1 : blink})`; ctx.lineWidth = 3; ctx.strokeRect(z.x, z.y, z.w, z.h);
        if (z.kind === 'pillar' && on) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(z.x + z.w / 2 - 8, z.y, 16, z.h); }
      } else {
        ctx.fillStyle = `rgba(${col},${on ? 0.8 : 0.2 * blink})`;
        ctx.beginPath(); ctx.arc(z.cx, z.cy, on ? z.r : z.r * (0.4 + 0.6 * (z.t / z.warn)), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${col},${on ? 1 : blink})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.cx, z.cy, z.r, 0, Math.PI * 2); ctx.stroke();
        if (z.kind === 'mine' && warn) { ctx.fillStyle = Math.floor(this.time * 10) % 2 ? '#ff4a4a' : '#552222'; ctx.beginPath(); ctx.arc(z.cx, z.cy - 8, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(z.cx - 3, z.cy - 24, 6, 8); }
      }
      ctx.restore();
    }

    _drawBeam(ctx, bm) {
      const s = this._beamSeg(bm);
      const warn = bm.t < bm.warn;
      ctx.save();
      ctx.lineCap = 'round';
      if (warn) { ctx.strokeStyle = 'rgba(255,80,160,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); }
      else { ctx.strokeStyle = 'rgba(255,60,150,0.55)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke(); ctx.strokeStyle = '#fff4fa'; ctx.lineWidth = 9; }
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
      if (!warn) { ctx.fillStyle = 'rgba(255,200,230,0.85)'; ctx.beginPath(); ctx.arc(s.x1, s.y1, 16 + 4 * Math.sin(this.time * 30), 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    _drawClone(ctx, c) {
      const a = clamp(c.t / 0.6, 0, 1) * (c.alive ? 1 : Math.max(0, 1 - c.fade / 0.4));
      const fake = { cx: c.cx, y: c.y, h: c.h, w: this.d.w, dir: this.playerX < c.cx ? -1 : 1, flash: c.hit > 0 ? 1 : 0, state: 'idle', pose: 'cast' };
      ctx.save(); ctx.globalAlpha = 0.35 + 0.4 * a * (c.alive ? 1 : 0.5);
      this._paint(ctx, fake, 0.85);
      ctx.globalAlpha = 1;
      if (c.alive) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(c.cx - 26, c.y - 14, 52, 7); ctx.fillStyle = '#7fe8ff'; ctx.fillRect(c.cx - 25, c.y - 13, 50 * Math.max(0, c.hp) / c.maxHp, 5); }
      ctx.restore();
    }

    _drawBall2(ctx, f) {
      const g = f.reflected;
      ctx.save();
      if (f.shield) { // 큰 방패
        ctx.translate(f.x, f.y); ctx.rotate(this.time * 14);
        ctx.fillStyle = g ? '#fff0a0' : '#7a8498'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g ? '#ffd45a' : '#4a5262'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g ? '#fff' : '#d4a017'; ctx.fillRect(-3, -19, 6, 38); ctx.fillRect(-19, -3, 38, 6);
      } else if (f.spear) { // 던진 창
        const a = Math.atan2(f.vy, f.vx);
        ctx.translate(f.x, f.y); ctx.rotate(a);
        ctx.fillStyle = g ? '#fff' : '#7a5a2a'; ctx.fillRect(-30, -2, 52, 4);
        ctx.fillStyle = g ? '#ffe9a0' : '#cfd6e0'; ctx.beginPath(); ctx.moveTo(22, -7); ctx.lineTo(40, 0); ctx.lineTo(22, 7); ctx.closePath(); ctx.fill();
      } else if (f.wave) { // 참격파: 세로로 쪼개진 초승달 조각
        ctx.translate(f.x, f.y);
        const d = Math.sign(f.vx) || 1;
        ctx.fillStyle = g ? 'rgba(255,240,170,0.95)' : 'rgba(255,90,70,0.9)';
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g ? '#ffffff' : '#ffe0c0'; ctx.beginPath(); ctx.ellipse(-d * 3, 0, 6, 20, 0, 0, Math.PI * 2); ctx.fill();
      } else { // 전격구
        const R = 16;
        const gr = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, R + 10);
        gr.addColorStop(0, g ? 'rgba(255,240,150,0.95)' : 'rgba(200,240,255,0.95)'); gr.addColorStop(1, g ? 'rgba(255,200,60,0)' : 'rgba(90,160,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(f.x - R - 10, f.y - R - 10, (R + 10) * 2, (R + 10) * 2);
        ctx.fillStyle = g ? '#ffd45a' : '#7fd0ff'; ctx.beginPath(); ctx.arc(f.x, f.y, R * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // 모습: idx마다 다르다 (s = 크기 배율)
    _paint(ctx, b, s) {
      const flash = b.flash > 0 || (b.state === 'dying' && Math.floor(this.time * 20) % 2 === 0);
      const stunned = b.state === 'stun';
      const w = b.w * s, h = b.h * s;
      const cx = b.cx, bottom = b.y !== undefined ? b.y + b.h : this.groundY;
      const dir = b.dir || 1;
      const pose = b.pose || 'idle';
      const col = (a, f) => (flash ? f || '#ffffff' : a);
      ctx.save();
      ctx.translate(cx, bottom);
      ctx.scale(dir, 1); // 앞은 항상 +x
      if (this.idx === 0) { // 철갑 거인: 거대한 철갑, 투구 틈의 붉은 눈, 철퇴
        ctx.fillStyle = col('#3a4150'); ctx.fillRect(-w * 0.32, -h * 0.28, w * 0.24, h * 0.28); ctx.fillRect(w * 0.08, -h * 0.28, w * 0.24, h * 0.28);
        ctx.fillStyle = col('#7a8498'); ctx.fillRect(-w * 0.38, -h * 0.78, w * 0.76, h * 0.54);
        ctx.fillStyle = col('#9aa6bc'); ctx.fillRect(-w * 0.38, -h * 0.78, w * 0.76, h * 0.1);
        ctx.fillStyle = col('#5a6272'); ctx.fillRect(-w * 0.12, -h * 0.7, w * 0.24, h * 0.4);
        ctx.fillStyle = col('#aab4c8'); ctx.beginPath(); ctx.arc(-w * 0.38, -h * 0.74, w * 0.14, 0, Math.PI * 2); ctx.arc(w * 0.38, -h * 0.74, w * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col('#6a7488'); ctx.fillRect(-w * 0.2, -h, w * 0.4, h * 0.24); // 투구
        ctx.fillStyle = stunned ? '#222' : '#ff3a3a'; ctx.fillRect(-w * 0.03, -h * 0.9, w * 0.2, h * 0.04);
        ctx.fillStyle = col('#d4a017'); ctx.fillRect(-w * 0.04, -h * 1.06, w * 0.08, h * 0.08);
        ctx.save(); ctx.translate(w * 0.34, -h * 0.66); ctx.rotate(pose === 'raise' ? -2.3 : pose === 'swing' ? 0.9 : pose === 'throw' ? -1.0 : -0.25);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-4, 0, 8, h * 0.62); ctx.fillStyle = col('#4a5262'); ctx.beginPath(); ctx.arc(0, h * 0.68, w * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col('#c0c8d8'); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.15, h * 0.68 + Math.sin(a) * w * 0.15, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } else if (this.idx === 1) { // 마도사 장군: 떠 있는 붉은 법의, 뾰족한 모자, 전기 구슬
        ctx.fillStyle = col('#5a1a3a'); ctx.beginPath(); ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.28, -h * 0.74); ctx.lineTo(w * 0.28, -h * 0.74); ctx.lineTo(w * 0.5, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col('#a8305a'); ctx.beginPath(); ctx.moveTo(-w * 0.3, 0); ctx.lineTo(-w * 0.16, -h * 0.72); ctx.lineTo(w * 0.16, -h * 0.72); ctx.lineTo(w * 0.3, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col('#e0c8a0'); ctx.beginPath(); ctx.arc(0, -h * 0.82, w * 0.17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col('#3a0a24'); ctx.beginPath(); ctx.moveTo(-w * 0.28, -h * 0.9); ctx.lineTo(0, -h * 1.22); ctx.lineTo(w * 0.28, -h * 0.9); ctx.closePath(); ctx.fill(); ctx.fillRect(-w * 0.32, -h * 0.92, w * 0.64, h * 0.05);
        ctx.fillStyle = stunned ? '#222' : '#7fe8ff'; ctx.fillRect(w * 0.02, -h * 0.84, w * 0.06, h * 0.04); ctx.fillRect(w * 0.12, -h * 0.84, w * 0.06, h * 0.04);
        ctx.save(); ctx.translate(w * 0.42, -h * 0.5); ctx.rotate(pose === 'cast' || pose === 'raise' ? -0.5 : 0.1);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-3, -h * 0.5, 6, h * 0.95);
        const orb = ctx.createRadialGradient(0, -h * 0.55, 1, 0, -h * 0.55, 18); orb.addColorStop(0, '#fff'); orb.addColorStop(1, 'rgba(110,200,255,0)'); ctx.fillStyle = orb; ctx.fillRect(-18, -h * 0.55 - 18, 36, 36);
        ctx.restore();
        for (let k = 0; k < 3; k++) { const a = this.time * 3 + k * 2.1; ctx.fillStyle = 'rgba(140,220,255,0.9)'; ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.62, -h * 0.5 + Math.sin(a) * h * 0.2, 6, 0, Math.PI * 2); ctx.fill(); }
      } else { // 군단장: 붉은 망토, 뿔 투구, 큰 검
        ctx.fillStyle = col('#7a1424'); ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.84); ctx.lineTo(-w * 0.62, 0); ctx.lineTo(w * 0.06, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col('#2a2e3a'); ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.22, h * 0.3); ctx.fillRect(w * 0.06, -h * 0.3, w * 0.22, h * 0.3);
        ctx.fillStyle = col('#3a4052'); ctx.fillRect(-w * 0.34, -h * 0.76, w * 0.68, h * 0.5);
        ctx.fillStyle = col('#d4a017'); ctx.fillRect(-w * 0.34, -h * 0.48, w * 0.68, h * 0.05); ctx.fillRect(-w * 0.04, -h * 0.76, w * 0.08, h * 0.5);
        ctx.fillStyle = col('#4a5266'); ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.7); ctx.lineTo(-w * 0.34, -h * 0.84); ctx.lineTo(-w * 0.2, -h * 0.7); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(w * 0.5, -h * 0.7); ctx.lineTo(w * 0.34, -h * 0.84); ctx.lineTo(w * 0.2, -h * 0.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col('#4a5062'); ctx.fillRect(-w * 0.18, -h, w * 0.36, h * 0.24);
        ctx.fillStyle = col('#e8e0c8'); ctx.beginPath(); ctx.moveTo(-w * 0.18, -h * 0.96); ctx.lineTo(-w * 0.34, -h * 1.14); ctx.lineTo(-w * 0.1, -h * 1.0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(w * 0.18, -h * 0.96); ctx.lineTo(w * 0.34, -h * 1.14); ctx.lineTo(w * 0.1, -h * 1.0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = stunned ? '#222' : '#ff6a2a'; ctx.fillRect(-w * 0.02, -h * 0.9, w * 0.16, h * 0.04);
        ctx.save(); ctx.translate(w * 0.32, -h * 0.6); ctx.rotate(pose === 'raise' ? -2.5 : pose === 'swing' ? 1.0 : -0.5);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-4, -8, 8, 30); ctx.fillStyle = '#d4a017'; ctx.fillRect(-16, 20, 32, 6);
        ctx.fillStyle = col('#dfe6f0'); ctx.fillRect(-7, 26, 14, h * 0.7); ctx.fillStyle = col('#aab4c8'); ctx.fillRect(-2, 26, 4, h * 0.7);
        if (pose === 'raise') { ctx.strokeStyle = 'rgba(255,120,60,0.8)'; ctx.lineWidth = 4; ctx.strokeRect(-9, 24, 18, h * 0.7 + 4); }
        ctx.restore();
      }
      ctx.restore();
      if (stunned) {
        for (let k = 0; k < 3; k++) { const a = this.time * 4 + (k * Math.PI * 2) / 3; const sx = cx + Math.cos(a) * 46, sy = bottom - h - 14 + Math.sin(a) * 8; ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.closePath(); ctx.fill(); }
      }
      if (b.state === 'idle' && this.pat) { // 지금 하려는 패턴 이름 (처음 보는 사람을 위해 머리 위에)
        ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = 'rgba(255,230,170,0.9)';
        ctx.fillText(PAT_NAME[this.pat.type] || '', cx, bottom - h - 14); ctx.restore();
      }
    }
  }

  const PAT_NAME = { mace: '철퇴 휘두르기', shield: '방패 부메랑', mines: '지뢰 투하', pillars: '번개 기둥', beam: '회전 광선', clones: '분신 사격', barrage: '일제 포격', spears: '창 투척', slash: '참격파 (패링!)' };

  LegionBoss.DEF = DEF;
  G.LegionBoss = LegionBoss;
})(window.Game);
