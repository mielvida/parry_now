// 해일의 방: 바다 위 오른쪽 끝 문(10000 G) 안. 보스 3마리가 차례로 나온다. 모습도 패턴도 게임 속 다른 보스와 겹치지 않는다.
//   1. 해일의 군주 (심해 아귀)  : 해일 · 전기 해파리 · 먹물
//   2. 집게왕 (거대한 게)       : 집게 협공(pinch) · 거품 기둥(bubbles) · 모래 구멍(sand)
//   3. 크라켄 (거대한 문어)     : 촉수 휘두르기(tentacle) · 응시(stare, 가만히 서 있어야 한다) · 조류(current, 물살에 떠밀린다)
// 보스마다 딴딴함이 있다 (다 깎아야 체력이 깎인다. 체력이 줄 때마다 다시 단단해진다).
// -- 아래는 처음 4가지 패턴 설명 (아귀) --
//   tide     해일: 물 벽이 한쪽 끝에서 밀려온다. 점프로 넘는다 (양쪽에서 번갈아)
//   chain    전기 해파리: 높이가 다른 해파리 둘이 좌우로 떠다니고, 둘 사이에 번개 줄이 이어진다 (줄이 쓸고 지나간다)
//   tentacle 촉수: 바닥에서 솟은 촉수가 시계바늘처럼 한 바퀴 반(위쪽 반원)을 휘젓는다. 시작할 때 바닥에 누워 번쩍인다
//   ink      먹물: 화면이 캄캄해지고(내 주변만 보인다) 쫓아오는 거품이 따라다닌다. 패링으로 쳐낼 수 있다
// 5패턴마다 기절한다 (그때가 공격 기회). 약점은 얼음. 체력 절반 아래면 분노(더 빠르고 더 많이).
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SW = 190, SH = 150;
  // 보스 3마리가 차례로 나온다 (한 마리를 쓰러뜨리면 다음 보스). 갈수록 해일이 높고 빠르고 체력이 많다 (최대 점프 높이 ≈ 114px)
  const TIERS = [
    { name: '해일의 군주', defeat: '해일의 군주를 쓰러뜨렸다!', look: 'angler', pats: ['tide', 'chain', 'ink'], hp: C.BOSS_SEA_HP || 9000, tough: 40, w: 190, h: 150, back: 0.85, sp: 1, wave: 96, hurt: 2, stunEvery: 7, pal: ['#17606e', '#2a8a96', '#1a5a72', '#0c3040', '#0e4150', '#08242e'] },
    { name: '집게왕', defeat: '집게왕을 쓰러뜨렸다!', look: 'crab', pats: ['pinch', 'bubbles', 'sand'], hp: 16000, tough: 60, w: 200, h: 112, back: 0.75, sp: 1.2, wave: 100, hurt: 2, stunEvery: 8, pal: ['#b8431f', '#e0703a', '#8a2e14', '#4a1608', '#6a2210', '#2a0c04'] },
    { name: '크라켄', defeat: '크라켄을 쓰러뜨렸다!', look: 'kraken', pats: ['tentacle', 'stare', 'current'], hp: 26000, tough: 80, w: 150, h: 200, back: 0.75, sp: 1.4, wave: 104, hurt: 3, stunEvery: 9, pal: ['#4a2a7a', '#7a4ab0', '#42207a', '#1e1040', '#2a1458', '#120a28'] },
  ];
  const ARM_L = 300;       // 촉수 길이
  const BUBBLE_R = 18;

  // 선분이 사각형과 겹치는가 (Liang-Barsky)
  function segHitsRect(x0, y0, x1, y1, r, pad = 0) {
    const xmin = r.x - pad, xmax = r.x + r.w + pad, ymin = r.y - pad, ymax = r.y + r.h + pad;
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const p = [-dx, dx, -dy, dy], q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return true;
  }

  class SeaLord extends G.KingSlime {
    constructor(left, width, groundY, ev) {
      super(left, width, groundY, ev);
      this.kind = 'sealord';
      this.name = '해일의 군주';
      this.defeatText = '해일의 군주를 쓰러뜨렸다!';
      this.weak = 'ice';
      this.hurtDmg = 2; // 한 번 맞으면 목숨 2개
      this.rEdge = this.right - 2 * T; // 오른쪽 벽 안쪽
      this.claws = []; this.bubbles = []; this.holes = []; this.stare = null; this.cur = null; // 새 패턴들의 상태
      this.waves = [];
      this.tents = [];
      this.jel = null;     // 해파리 둘 {a, b, t, warn}
      this.inkA = 0;       // 먹물 어둠의 짙기
      this.rage = false;
      this.fury = false;   // 체력 1/4 아래: 더 빨라진다
      this.timer = 0.9;
      this.tier = 1;
      this.setTier(1);
    }
    // 몇 번째 보스인가 (1~3): 모습, 이름, 패턴, 체력, 딴딴함, 해일 높이, 속도가 모두 다르다. 2, 3번째는 처음부터 분노 상태로 시작한다
    setTier(n) {
      const t = TIERS[n - 1], b = this.body;
      this.tier = n; this.name = t.name; this.defeatText = t.defeat;
      this.hurtDmg = t.hurt; this.waveH = t.wave; this.patterns = t.pats;
      b.w = t.w; b.h = t.h; b.maxHp = t.hp; b.hp = t.hp;
      this.groundCy = this.groundY - t.h / 2;
      b.cx = this.rEdge - t.w * t.back; b.cy = -t.h; b._box();
      this.maxTough = t.tough; this.tough = t.tough; this.refills = [0.66, 0.33];
      if (n >= 2) this.rage = true;
      if (n >= 3) this.fury = true;
      b.damage = (m) => { // 총·마법: 딴딴함이 먼저 깎인다 (딴딴함 1 = 3발)
        if (this.tough > 0) { const hp = this._hitPow(); this.tough = Math.max(0, this.tough - Math.max(1, hp - (hp > 1 ? 1 : 0)) / 3); b.flash = 0.1; return; }
        this.damageBody(m);
      };
    }
    _hitPow() { return Math.max(1, (this.ev.hitPower && this.ev.hitPower()) || 1); } // 무기에 붙인 딴딴함 광석이 한 번에 깎는 양
    hitHeads(rect, dmg) { // 칼: 딴딴함이 먼저 깎인다
      const bd = this.body;
      if (this.tough > 0 && bd.alive && bd.vulnerable && bd.hitGrace <= 0 && rect.x < bd.x + bd.w && rect.x + rect.w > bd.x && rect.y < bd.y + bd.h && rect.y + rect.h > bd.y) {
        this.tough = Math.max(0, this.tough - this._hitPow());
        bd.hitGrace = 0.28; bd.flash = 0.12;
        if (this.tough <= 0) { this.ev.fx('burst', bd.cx, bd.cy); this.ev.sound('shatter'); }
        return [bd];
      }
      return super.hitHeads(rect, dmg);
    }
    get sp() { return (1 + (this.rage ? 0.25 : 0) + (this.fury ? 0.25 : 0)) * TIERS[this.tier - 1].sp; } // 속도 배율

    // ---------- 패턴 고르기 ----------
    _startPattern() {
      if (!this.body.alive) return;
      let pool = this.patterns.filter((t) => t !== this.lastType);
      if (!pool.length) pool = this.patterns;
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.lastType = type;
      const W = this.rEdge - this.left;
      const p = { type, t: 0, n: 0, sub: 'run' };
      if (type === 'tide') { p.side = Math.random() < 0.5 ? -1 : 1; p.count = (this.fury ? 5 : this.rage ? 4 : 3) + (this.tier - 1); p.next = 1.1; p.fired = 0; }
      else if (type === 'chain') { p.warn = 0.85; p.dur = this.rage ? 6.4 : 5.4; if (this.rage) { // 분노하면 해파리가 두 쌍: 서로 겹치지 않게 왼쪽 반, 오른쪽 반을 따로 맡는다
          this.jel = { t: 0, amp: W * 0.1, sp: 1.5 * this.sp, ax: this.left + W * 0.16, bx: this.left + W * 0.36, ay: this.groundY - 38, by: this.groundY - 150 };
          this.jel2 = { t: 0, amp: W * 0.1, sp: 1.9 * this.sp, ax: this.left + W * 0.6, bx: this.left + W * 0.8, ay: this.groundY - 150, by: this.groundY - 40 };
        } else { this.jel = { t: 0, amp: W * 0.22, sp: 1.5 * this.sp, ax: this.left + W * 0.28, bx: this.left + W * 0.72, ay: this.groundY - 38, by: this.groundY - 150 }; this.jel2 = null; } }
      else if (type === 'tentacle') {
        const xs = this.rage ? [0.1, 0.34, 0.58] : [0.14, 0.5]; // 촉수끼리, 그리고 오른쪽 끝의 보스 몸과 겹치지 않는 자리
        const sw = (this.rage ? 4 : 3) + (this.tier - 1);
        p.arms = xs.map((f, i) => ({ x: this.left + W * (f + rnd(-0.02, 0.02)), start: 0.9 + i * 0.7, a0: i % 2 ? 0 : Math.PI, a1: i % 2 ? Math.PI : 0, sweeps: sw, done: false }));
        p.sp = 2.8 * this.sp;
        this.tents = p.arms.map((a) => ({ x: a.x, ang: a.a0, vis: 0, live: false, a }));
      } else if (type === 'pinch') { p.rounds = 3 + (this.fury ? 2 : this.rage ? 1 : 0); p.round = 0; p.next = 1.0;
      } else if (type === 'bubbles') { p.dur = this.fury ? 8 : 7; p.nextSp = 0.6;
      } else if (type === 'sand') { p.rounds = 3 + (this.fury ? 1 : 0); p.round = 0; p.next = 1.0;
      } else if (type === 'stare') { p.shots = 2 + (this.rage ? 1 : 0) + (this.fury ? 1 : 0); p.k = 0; p.next = 1.0;
      } else if (type === 'current') { p.dur = 7; this.cur = { dir0: Math.random() < 0.5 ? -1 : 1, dir: 0, active: false };
      } else { p.dur = this.rage ? 8 : 7; p.spawns = this.rage ? [0.8, 1.4, 2.0, 2.6, 3.2, 3.8, 4.4, 5.0].slice(0, 5 + this.tier * 2) : [0.8, 1.7, 2.6, 3.5, 4.4]; p.si = 0; }
      this.pat = p;
      this.phase = 'pattern';
      this.ev.sound('spawn');
    }

    _runPattern(dt) {
      const p = this.pat, b = this.body;
      p.t += dt;
      b.dir = this.playerX < b.cx ? -1 : 1;
      let finished = false;
      if (p.type === 'tide') {
        b.state = p.t < p.next && p.fired < p.count ? 'wind' : 'idle';
        b.glow = clamp((p.t - (p.next - 1.0)) / 1.0, 0, 1);
        if (p.fired < p.count && p.t >= p.next) {
          const spd = 430 * this.sp;
          this.waves.push({ x: p.side > 0 ? this.rEdge + 50 : this.left - 50, dir: -p.side, spd, t: 0 });
          if (this.rage) this.waves.push({ x: p.side > 0 ? this.rEdge + 50 : this.left - 50, dir: -p.side, spd, t: -0.45 }); // 분노: 연달아 두 겹 (두 번 뛰어야 한다)
          this.ev.sound('vanish'); this.ev.shake(7, 0.35);
          p.side = -p.side; p.fired += 1; p.next += this.rage ? 1.15 : 1.5;
        }
        finished = p.fired >= p.count && this.waves.length === 0 && p.t > p.next - 0.8;
      } else if (p.type === 'chain') {
        b.state = 'idle'; b.glow = 0.4 + 0.3 * Math.sin(this.time * 9); // 패턴 중에도 몸을 때릴 수 있다 (닿으면 아프다)
        finished = p.t >= p.warn + p.dur + 0.5;
        if (finished) { this.jel = null; this.jel2 = null; }
      } else if (p.type === 'tentacle') {
        b.state = 'idle'; b.glow = 0.5;
        let all = true;
        for (const t of this.tents) {
          const a = t.a;
          if (a.done) continue;
          all = false;
          if (p.t < a.start - 0.7) continue;
          t.vis = clamp((p.t - (a.start - 0.7)) / 0.5, 0, 1);
          if (p.t < a.start) { t.live = false; continue; } // 바닥에 누워 번쩍인다 (피하라는 신호)
          t.live = true;
          const u = (p.t - a.start) * p.sp; // 지금까지 훑은 각도(라디안)
          const sweepIdx = Math.floor(u / Math.PI);
          if (sweepIdx >= a.sweeps) { a.done = true; t.live = false; t.vis = 0; continue; }
          const frac = (u % Math.PI) / Math.PI;
          const from = sweepIdx % 2 === 0 ? a.a0 : a.a1, to = sweepIdx % 2 === 0 ? a.a1 : a.a0;
          t.ang = from + (to - from) * frac;
        }
        finished = all;
        if (finished) this.tents = [];
      } else if (p.type === 'pinch') { // 집게 협공: 내 양옆 모래에서 집게가 솟아 올라 가운데로 닫힌다 (사이에 있으면 끼인다)
        b.state = 'idle'; b.glow = 0.4 + 0.3 * Math.sin(this.time * 8);
        if (p.round < p.rounds && p.t >= p.next) {
          const gx = clamp(this.playerX, this.left + 140, Math.max(this.left + 141, b.x - 150));
          const warn = Math.max(0.6, 0.95 - 0.08 * this.sp);
          this.claws.push({ gx, t: 0, warn, closeT: 0.26, hold: 0.4, gap: 100 });
          this.ev.sound('spawn'); p.round += 1; p.next = p.t + warn + 0.26 + 0.4 + 0.45;
        }
        finished = p.round >= p.rounds && this.claws.length === 0;
      } else if (p.type === 'bubbles') { // 거품 기둥: 바닥에서 커다란 거품이 흔들리며 떠오른다 (닿으면 터진다)
        b.state = 'idle'; b.glow = 0.3;
        while (p.t >= p.nextSp && p.t < p.dur) {
          p.nextSp += this.fury ? 0.4 : 0.5;
          const x = clamp(this.playerX + rnd(-150, 150), this.left + 30, b.x - 40);
          if (!this.bubbles.some((q) => Math.abs(q.x - x) < 56 && q.y > this.groundY - 140)) this.bubbles.push({ x, y: this.groundY - 6, t: 0, ph: rnd(0, 6), vy: rnd(95, 125) });
        }
        finished = p.t >= p.dur && this.bubbles.length === 0;
      } else if (p.type === 'sand') { // 모래 구멍: 바닥이 소용돌이치다 구멍이 뚫린다 (점프로 넘는다)
        b.state = 'idle'; b.glow = 0.3;
        if (p.round < p.rounds && p.t >= p.next) {
          const lo = this.left + 70, hi = Math.max(lo + 1, b.x - 90), xs = [clamp(this.playerX, lo, hi)];
          const n = this.fury ? 3 : 2;
          for (let tries = 0; xs.length < n && tries < 40; tries++) { const x = rnd(lo, hi); if (xs.every((q) => Math.abs(q - x) >= 140)) xs.push(x); }
          for (const x of xs) this.holes.push({ x, t: 0, warn: 0.9, life: 1.8 });
          this.ev.sound('spawn'); p.round += 1; p.next = p.t + 0.9 + 1.8 + 0.4;
        }
        finished = p.round >= p.rounds && this.holes.length === 0;
      } else if (p.type === 'stare') { // 응시: 눈이 붉게 빛난 뒤 노려보는 동안 움직이거나 뛰면 맞는다 (가만히 서 있어야 한다)
        b.state = 'idle';
        if (p.k < p.shots && p.t >= p.next && !this.stare) { this.stare = { t: 0, warn: 1.0, dur: 1.3 }; p.k += 1; p.next = p.t + 1.0 + 1.3 + 0.7; this.ev.sound('spawn'); }
        b.glow = this.stare ? clamp(this.stare.t / this.stare.warn, 0, 1) : 0;
        finished = p.k >= p.shots && !this.stare;
      } else if (p.type === 'current') { // 조류: 물살이 좌우로 번갈아 떠민다. 왼쪽 끝은 성게 가시, 오른쪽은 보스 (버티거나 대시로 빠져나간다)
        b.state = 'idle'; b.glow = 0.3;
        const c = this.cur;
        c.active = p.t > 0.9;
        const seg = Math.floor(Math.max(0, p.t - 0.9) / 1.7);
        c.dir = c.active ? (seg % 2 === 0 ? c.dir0 : -c.dir0) : c.dir0;
        finished = p.t >= p.dur;
        if (finished) this.cur = null;
      } else { // ink
        b.state = 'idle'; b.glow = 0.35;
        this.inkTarget = p.t > 0.5 && p.t < p.dur - 0.7 ? 1 : 0;
        while (p.si < p.spawns.length && p.t >= p.spawns[p.si]) { // 쫓아오는 거품
          p.si += 1;
          const sx = b.cx + b.dir * 50, sy = b.cy - 30;
          this.balls.push({ x: sx, y: sy, vx: b.dir * 60, vy: -120, reflected: false, life: 6.5, t: 0, homing: true });
          this.ev.sound('spawn');
        }
        finished = p.t >= p.dur;
      }
      if (finished) { this.inkTarget = 0; this._endPattern(); }
    }

    _endPattern() {
      const b = this.body;
      this.patternCount += 1;
      this.pat = null;
      b.glow = 0;
      b.attacking = false;
      if (b.state !== 'dying') b.state = 'idle';
      if (this.patternCount % TIERS[this.tier - 1].stunEvery === 0) { this.phase = 'stun'; this.timer = 1.8; b.state = 'stun'; b.st = 0; this.ev.stunned(); }
      else { this.phase = 'rest'; this.timer = rnd(0.05, 0.22) / this.sp; }
    }

    update(dt, player) {
      if (!this.fury && this.body.alive && this.body.hp < this.body.maxHp * 0.25) { this.fury = true; this.ev.shake(16, 0.7); this.ev.sound('hurt'); this.ev.fx('boom', this.body.cx, this.body.cy); }
      if (!this.rage && this.body.alive && this.body.hp < this.body.maxHp * 0.65) { // 체력이 65% 아래로: 분노
        this.rage = true;
        this.ev.shake(14, 0.6); this.ev.sound('hurt'); this.ev.fx('boom', this.body.cx, this.body.cy);
      }
      for (const f of this.balls) { // 쫓아오는 거품: 천천히 따라온다
        if (!f.homing || f.reflected) continue;
        const dx = this.playerX - f.x, dy = this.playerY - f.y, len = Math.hypot(dx, dy) || 1, k = Math.min(1, 1.7 * dt);
        f.vx += ((dx / len) * 210 * this.sp - f.vx) * k; f.vy += ((dy / len) * 210 * this.sp - f.vy) * k;
      }
      super.update(dt, player);
      this.inkA += ((this.inkTarget || 0) - this.inkA) * Math.min(1, 4 * dt);
      if (this.done || !this.body.alive) { this.waves.length = 0; this.tents = []; this.jel = null; this.jel2 = null; this.inkA = 0; this.claws = []; this.bubbles = []; this.holes = []; this.stare = null; this.cur = null; return; }
      if (this.refills.length && this.body.hp / this.body.maxHp <= this.refills[0]) { // 체력이 줄 때마다 다시 단단해진다
        this.refills.shift();
        this.tough = this.maxTough;
        this.ev.sound('charge'); this.ev.shake(8, 0.3); this.ev.fx('burst', this.body.cx, this.body.cy);
      }
      // (패턴은 한 번에 하나만: 다른 패턴 중에 해일이 섞여 들어오지 않는다)
      for (const c of this.claws) c.t += dt;
      this.claws = this.claws.filter((c) => c.t < c.warn + c.closeT + c.hold + 0.25);
      for (const q of this.bubbles) { q.t += dt; q.y -= q.vy * dt; q.x += Math.cos(q.t * 2.2 + q.ph) * 26 * dt; }
      this.bubbles = this.bubbles.filter((q) => q.y > this.groundY - 400);
      for (const h of this.holes) h.t += dt;
      this.holes = this.holes.filter((h) => h.t < h.warn + h.life + 0.3);
      if (this.stare) { this.stare.t += dt; if (this.stare.t > this.stare.warn + this.stare.dur) this.stare = null; }
      if (this.cur && this.cur.active && !player.dashing) { // 조류가 몸을 떠민다
        player.x = clamp(player.x + this.cur.dir * (this.fury ? 195 : 175) * dt, this.left + 2, this.body.x - player.w - 2);
      }
      // 해일
      for (const w of this.waves) { w.t += dt; if (w.t < 0) continue; w.x += w.dir * w.spd * dt; if (w.x < this.left - 90 || w.x > this.rEdge + 90) w.dead = true; }
      this.waves = this.waves.filter((w) => !w.dead);
      // 해파리
      if (this.jel) { this.jel.t += dt; }
      if (this.jel2) { this.jel2.t += dt; }
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const w of this.waves) if (w.t >= 0 && player.overlaps({ x: w.x - 40, y: this.groundY - this.waveH, w: 80, h: this.waveH })) hurt = true;
        for (const jj of [this.jel, this.jel2]) {
          const J = this._jellyPts(jj);
          if (J && this.pat && this.pat.type === 'chain' && this.pat.t > this.pat.warn && this.pat.t < this.pat.warn + this.pat.dur) {
            if (segHitsRect(J.a.x, J.a.y, J.b.x, J.b.y, { x: player.x, y: player.y, w: player.w, h: player.h }, 4)) hurt = true;
            for (const j of [J.a, J.b]) if (Math.abs(j.x - this.playerX) < 30 && Math.abs(j.y - this.playerY) < 34) hurt = true;
          }
        }
        for (const t of this.tents) {
          if (!t.live) continue;
          const ex = t.x + Math.cos(t.ang) * ARM_L, ey = this.groundY - Math.sin(t.ang) * ARM_L;
          if (segHitsRect(t.x, this.groundY - 6, ex, ey, { x: player.x, y: player.y, w: player.w, h: player.h }, 8)) hurt = true;
        }
        for (const c of this.claws) { // 닫히는 집게
          if (c.t < c.warn || c.t > c.warn + c.closeT + c.hold) continue;
          const off = this._clawOff(c);
          for (const sd of [-1, 1]) if (player.overlaps({ x: c.gx + sd * off - 28, y: this.groundY - 84, w: 56, h: 84 })) hurt = true;
        }
        for (const q of this.bubbles) { // 떠오르는 거품
          const r = Math.min(24, 8 + q.t * 26) * 0.9, nx = clamp(q.x, player.x, player.x + player.w), ny = clamp(q.y, player.y, player.y + player.h);
          if (Math.hypot(q.x - nx, q.y - ny) < r) hurt = true;
        }
        for (const h of this.holes) if (h.t >= h.warn && h.t <= h.warn + h.life && player.overlaps({ x: h.x - 55, y: this.groundY - 30, w: 110, h: 30 })) hurt = true; // 모래 구멍
        if (this.stare && this.stare.t >= this.stare.warn && (Math.abs(player.vx) > 45 || !player.onGround)) hurt = true; // 노려보는 동안 움직이면
        if (this.cur && this.cur.active && player.x < this.left + 72 && player.y + player.h > this.groundY - 44) hurt = true; // 왼쪽 끝 성게 가시
        if (hurt) this.ev.hurt(this.hurtDmg);
      }
    }

    _clawOff(c) { // 집게 한쪽이 가운데에서 떨어진 거리: 솟을 때 gap, 닫히면 14, 물러나며 다시 gap
      const u = c.t < c.warn ? 0 : Math.min(1, (c.t - c.warn) / c.closeT);
      const t2 = c.warn + c.closeT + c.hold, away = c.t > t2 ? Math.min(1, (c.t - t2) / 0.2) : 0;
      return c.gap + (14 - c.gap) * u + (c.gap - 14) * away;
    }

    _jellyPts(j = this.jel) {
      if (!j) return null;
      return {
        a: { x: clamp(j.ax + j.amp * Math.sin(j.t * j.sp), this.left + 30, this.rEdge - 30), y: j.ay + 8 * Math.sin(j.t * 3) },
        b: { x: clamp(j.bx + j.amp * Math.sin(j.t * j.sp + Math.PI), this.left + 30, this.rEdge - 30), y: j.by + 8 * Math.sin(j.t * 3 + 1) },
      };
    }

    // ---------- 그리기 ----------
    drawFront(ctx) {
      const p = this.pat, gy = this.groundY, WAVE_H = this.waveH;
      // 해일 경고: 밀려올 쪽 가장자리에서 화살표가 번쩍인다
      if (p && p.type === 'tide' && p.fired < p.count && p.t > p.next - 1.0) {
        const x = p.side > 0 ? this.rEdge - 20 : this.left + 20, d = -p.side;
        const blink = Math.floor(this.time * 10) % 2 ? 1 : 0.4;
        ctx.fillStyle = `rgba(120,220,255,${0.35 * blink})`; ctx.fillRect(p.side > 0 ? this.rEdge - 90 : this.left, gy - WAVE_H, 90, WAVE_H);
        ctx.fillStyle = `rgba(230,250,255,${0.9 * blink})`;
        for (let k = 0; k < 3; k++) { const ax = x + d * (k * 26 + 6); ctx.beginPath(); ctx.moveTo(ax, gy - 40); ctx.lineTo(ax + d * 20, gy - 28); ctx.lineTo(ax, gy - 16); ctx.lineTo(ax + d * 6, gy - 28); ctx.closePath(); ctx.fill(); }
      }
      for (const w of this.waves) if (w.t >= 0) this._drawWave(ctx, w);
      for (const t of this.tents) if (t.vis > 0) this._drawTentacle(ctx, t);
      this._drawFx(ctx);
      for (const jj of [this.jel, this.jel2]) { const J = this._jellyPts(jj); if (J && p && p.type === 'chain') this._drawChain(ctx, J, p); }
      if (!this.body.dead) this._drawKing(ctx, this.body);
      if (!this.body.dead && this.body.alive) { // 딴딴함 표시
        const bd = this.body, ty = bd.y - 34;
        ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bd.cx - 40, ty, 80, 8);
        ctx.fillStyle = this.tough > 0 ? '#b08aff' : '#555'; ctx.fillRect(bd.cx - 39, ty + 1, 78 * (this.tough / this.maxTough), 6);
        ctx.fillStyle = this.tough > 0 ? '#e0d0ff' : '#aaa'; ctx.fillText(this.tough > 0 ? `딴딴함 ${Math.ceil(this.tough)}` : '금이 갔다!', bd.cx, ty - 3);
        ctx.restore();
      }
      this._drawStareFx(ctx);
      for (const f of this.balls) this._drawBubble(ctx, f);
      if (this.inkA > 0.02) this._drawInk(ctx);
    }

    _drawWave(ctx, w) {
      const gy = this.groundY, d = w.dir, tip = w.x + d * 40, WAVE_H = this.waveH;
      const g = ctx.createLinearGradient(0, gy - WAVE_H, 0, gy);
      g.addColorStop(0, 'rgba(190,245,255,0.95)'); g.addColorStop(1, 'rgba(40,150,200,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(w.x - d * 40, gy); ctx.lineTo(w.x - d * 40, gy - WAVE_H * 0.6);
      ctx.quadraticCurveTo(w.x - d * 10, gy - WAVE_H * 1.25, tip, gy - WAVE_H * 0.5);
      ctx.quadraticCurveTo(tip + d * 8, gy - WAVE_H * 0.2, tip, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; // 물거품
      for (let k = 0; k < 7; k++) { const bx = w.x + d * (-34 + k * 11) , by = gy - WAVE_H * (0.7 + 0.25 * Math.sin(w.t * 12 + k)) - 2; ctx.beginPath(); ctx.arc(bx, by, 4 + (k % 3), 0, Math.PI * 2); ctx.fill(); }
    }

    _drawChain(ctx, J, p) {
      const live = p.t > p.warn && p.t < p.warn + p.dur;
      const warnA = p.t <= p.warn ? 0.25 + 0.5 * (p.t / p.warn) : 1;
      for (const j of [J.a, J.b]) { // 해파리
        ctx.fillStyle = `rgba(200,150,255,${0.9 * warnA})`; ctx.beginPath(); ctx.arc(j.x, j.y, 24, Math.PI, 0); ctx.fill();
        ctx.fillStyle = `rgba(255,220,255,${0.7 * warnA})`; ctx.beginPath(); ctx.arc(j.x - 6, j.y - 10, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(210,170,255,${0.8 * warnA})`; ctx.lineWidth = 3; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(j.x + k * 9, j.y); ctx.quadraticCurveTo(j.x + k * 9 + Math.sin(this.time * 5 + k) * 6, j.y + 18, j.x + k * 9, j.y + 36); ctx.stroke(); }
      }
      ctx.lineCap = 'round';
      if (!live) { ctx.strokeStyle = `rgba(255,255,160,${0.25 * warnA})`; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(J.a.x, J.a.y); ctx.lineTo(J.b.x, J.b.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'; return; }
      const n = 14;
      for (const [col, w, jit] of [['rgba(255,255,120,0.35)', 12, 10], ['rgba(255,255,255,0.95)', 3, 7]]) { // 번개 줄
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(J.a.x, J.a.y);
        for (let i = 1; i < n; i++) { const u = i / n, nx = J.a.x + (J.b.x - J.a.x) * u, ny = J.a.y + (J.b.y - J.a.y) * u; ctx.lineTo(nx + Math.sin(this.time * 55 + i * 3.1) * jit, ny + Math.cos(this.time * 47 + i * 2.3) * jit); }
        ctx.lineTo(J.b.x, J.b.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    _drawTentacle(ctx, t) {
      const gy = this.groundY, L = ARM_L * (t.live ? 1 : t.vis);
      const flash = !t.live && Math.floor(this.time * 12) % 2;
      const pts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14, r = L * u, wob = Math.sin(this.time * 6 + i * 0.7) * 5 * u; pts.push([t.x + Math.cos(t.ang) * r - Math.sin(t.ang) * wob, gy - 4 - Math.sin(t.ang) * r - Math.cos(t.ang) * wob]); }
      ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const u = i / 14;
        ctx.strokeStyle = flash ? '#fff0a0' : (i % 2 ? '#7a3a8a' : '#8a4a9a'); ctx.lineWidth = 26 * (1 - u * 0.75) + 4;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
        if (i % 2 === 0 && i > 0) { ctx.fillStyle = 'rgba(255,220,240,0.8)'; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 3, 0, Math.PI * 2); ctx.fill(); } // 빨판
      }
      ctx.lineCap = 'butt';
      if (!t.live) { ctx.strokeStyle = `rgba(255,255,160,${flash ? 0.9 : 0.4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, gy - 4, 26, 0, Math.PI * 2); ctx.stroke(); }
    }

    _drawBubble(ctx, f) {
      const gold = f.reflected;
      const g = ctx.createRadialGradient(f.x - 5, f.y - 5, 2, f.x, f.y, BUBBLE_R + 6);
      g.addColorStop(0, gold ? 'rgba(255,245,170,0.95)' : 'rgba(240,255,255,0.9)'); g.addColorStop(0.7, gold ? 'rgba(255,200,70,0.6)' : 'rgba(110,200,230,0.55)'); g.addColorStop(1, 'rgba(60,150,200,0.1)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, BUBBLE_R + 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, BUBBLE_R, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(f.x - 6, f.y - 7, 4, 3, -0.5, 0, Math.PI * 2); ctx.fill();
    }

    _drawInk(ctx) { // 먹물: 내 주변만 보이는 어둠 (시야가 좁다)
      const x0 = this.left - 140, x1 = this.rEdge + 140, y0 = -600, y1 = this.groundY + 260;
      const r = this.rage ? 95 : 120, soft = 55, al = 0.95 * this.inkA;
      ctx.save();
      ctx.fillStyle = `rgba(2,6,16,${al})`;
      ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.arc(this.playerX, this.playerY, r + soft, 0, Math.PI * 2, true); ctx.fill('evenodd'); // 먼 곳은 새까맣게
      const g = ctx.createRadialGradient(this.playerX, this.playerY, r, this.playerX, this.playerY, r + soft); // 가장자리는 부드럽게
      g.addColorStop(0, 'rgba(2,6,16,0)'); g.addColorStop(1, `rgba(2,6,16,${al})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.playerX, this.playerY, r + soft, 0, Math.PI * 2); ctx.arc(this.playerX, this.playerY, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
      ctx.restore();
    }

    // 새 패턴들의 그림: 집게, 거품, 모래 구멍, 조류
    _drawFx(ctx) {
      const gy = this.groundY, P = TIERS[this.tier - 1].pal;
      for (const c of this.claws) { // 집게 협공
        const off = this._clawOff(c), rise = c.t < c.warn ? Math.min(1, c.t / c.warn) : 1, blink = Math.floor(this.time * 12) % 2;
        if (c.t < c.warn) { // 경고: 가운데 구간이 번쩍인다
          ctx.fillStyle = `rgba(255,200,90,${blink ? 0.3 : 0.14})`; ctx.fillRect(c.gx - c.gap, gy - 84, c.gap * 2, 84);
          ctx.fillStyle = `rgba(255,230,160,${blink ? 0.9 : 0.5})`; ctx.fillRect(c.gx - 2, gy - 8, 4, 8);
        }
        for (const sd of [-1, 1]) {
          const x = c.gx + sd * off, h = 84 * rise;
          ctx.fillStyle = P[1]; ctx.strokeStyle = P[5]; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.rect(x - 22, gy - h, 44, h); ctx.fill(); ctx.stroke();
          ctx.fillStyle = P[2]; // 안쪽을 향한 이빨
          for (let k = 0; k < 3; k++) { const ty = gy - h + 10 + k * 22; ctx.beginPath(); ctx.moveTo(x - sd * 22, ty); ctx.lineTo(x - sd * 38, ty + 9); ctx.lineTo(x - sd * 22, ty + 18); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        }
      }
      for (const q of this.bubbles) { // 거품 기둥
        const r = Math.min(24, 8 + q.t * 26);
        const g = ctx.createRadialGradient(q.x - r * 0.3, q.y - r * 0.3, 1, q.x, q.y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(150,225,255,0.45)'); g.addColorStop(1, 'rgba(90,190,235,0.2)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      }
      for (const h of this.holes) { // 모래 구멍
        const open = h.t < h.warn ? 0 : Math.min(1, (h.t - h.warn) / 0.15) * (h.t > h.warn + h.life ? Math.max(0, 1 - (h.t - h.warn - h.life) / 0.3) : 1);
        if (h.t < h.warn) { // 경고: 모래가 소용돌이친다
          ctx.strokeStyle = `rgba(255,235,170,${0.4 + 0.4 * Math.sin(this.time * 20)})`; ctx.lineWidth = 3;
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(h.x, gy - 3, 20 + k * 14 + (h.t / h.warn) * 8, 4 + k, 0, 0, Math.PI * 2); ctx.stroke(); }
        } else {
          ctx.fillStyle = '#1a0e06'; ctx.beginPath(); ctx.ellipse(h.x, gy - 2, 55 * open, 14 * open, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 3; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,235,170,0.7)'; ctx.lineWidth = 2;
          for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(h.x, gy - 2, (20 + k * 18) * open, (5 + k * 2) * open, this.time * (k ? -6 : 6), 0, Math.PI * 1.4); ctx.stroke(); }
        }
      }
      const c = this.cur;
      if (c) { // 조류: 물살 줄무늬와 방향 화살표, 왼쪽 끝 성게 가시
        const a = c.active ? 0.55 : 0.22 + 0.2 * Math.sin(this.time * 12);
        ctx.strokeStyle = `rgba(190,240,255,${a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let k = 0; k < 7; k++) {
          const y = gy - 20 - k * 38, ph = ((this.time * 1.4 * (c.active ? 1 : 0.3) + k * 0.37) % 1), x0 = this.left + (this.rEdge - this.left) * (c.dir > 0 ? ph : 1 - ph);
          ctx.beginPath(); ctx.moveTo(x0 - c.dir * 50, y); ctx.lineTo(x0 + c.dir * 50, y); ctx.moveTo(x0 + c.dir * 50, y); ctx.lineTo(x0 + c.dir * 36, y - 8); ctx.moveTo(x0 + c.dir * 50, y); ctx.lineTo(x0 + c.dir * 36, y + 8); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ctx.fillStyle = '#3a1a4a'; ctx.strokeStyle = '#d070ff'; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const x = this.left + 10 + k * 17; ctx.beginPath(); ctx.moveTo(x - 9, gy); ctx.lineTo(x, gy - 44 - (k % 2) * 8); ctx.lineTo(x + 9, gy); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
    }
    _drawStareFx(ctx) { // 응시: 붉은 시야와 경고 글자
      const s = this.stare;
      if (!s) return;
      const live = s.t >= s.warn, W = this.rEdge - this.left;
      ctx.save();
      ctx.fillStyle = live ? `rgba(255,30,60,${0.16 + 0.1 * Math.sin(this.time * 30)})` : `rgba(255,60,80,${0.14 * (s.t / s.warn)})`;
      ctx.fillRect(this.left - 140, this.groundY - 520, W + 280, 600);
      ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#300'; ctx.fillStyle = live ? '#ff6060' : '#ffe080';
      const tx = this.playerX, ty = this.playerY - 52;
      ctx.strokeText(live ? '움직이지 마!' : '곧 노려본다…', tx, ty); ctx.fillText(live ? '움직이지 마!' : '곧 노려본다…', tx, ty);
      ctx.restore();
    }
    _drawStunFx(ctx, b, bottom) {
      if (b.state === 'stun') for (let k = 0; k < 3; k++) { const a = this.time * 4 + (k * Math.PI * 2) / 3, sx = b.cx + Math.cos(a) * 52, sy = b.y - 16 + Math.sin(a) * 8; ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.closePath(); ctx.fill(); }
      if (b.state === 'down' || b.state === 'stun') { ctx.strokeStyle = Math.floor(this.time * 8) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,230,120,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); }
    }

    // 집게왕: 넓적한 거대한 게 (단단한 껍데기, 위로 치켜든 커다란 집게, 눈자루)
    _drawCrab(ctx, b) {
      const stunned = b.state === 'stun', dying = b.state === 'dying', P = TIERS[1].pal;
      const flash = b.flash > 0 || (dying && Math.floor(this.time * 20) % 2 === 0);
      const w = 200 * b.sx, h = 112 * b.sy, bottom = b.y + b.h, tt = this.time;
      const pinching = this.pat && this.pat.type === 'pinch';
      ctx.save(); ctx.translate(b.cx, bottom);
      const C1 = flash ? '#fff' : P[1], C2 = flash ? '#fff' : P[2], C0 = flash ? '#fff' : P[0], OUT = P[5];
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { // 다리
        const wob = Math.sin(tt * 6 + k * 1.3 + sd) * 4;
        ctx.strokeStyle = OUT; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(sd * w * 0.26, -h * 0.34); ctx.lineTo(sd * (w * 0.5 + k * 13), -h * 0.62 + wob); ctx.lineTo(sd * (w * 0.57 + k * 17), 0); ctx.stroke();
        ctx.strokeStyle = C2; ctx.lineWidth = 7; ctx.stroke();
      }
      for (const sd of [-1, 1]) { // 집게팔
        const open = pinching ? 0.55 + 0.4 * Math.sin(tt * 14) : 0.3 + 0.25 * Math.sin(tt * 2.6 + sd);
        const ax = sd * w * 0.52, ay = -h * 0.7, cxx = sd * w * 0.66, cyy = -h * 1.22;
        ctx.strokeStyle = OUT; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(sd * w * 0.36, -h * 0.5); ctx.lineTo(ax, ay); ctx.lineTo(cxx, cyy + 26); ctx.stroke();
        ctx.strokeStyle = C1; ctx.lineWidth = 11; ctx.stroke();
        ctx.save(); ctx.translate(cxx, cyy); ctx.rotate(sd * -0.15); // 집게발: 위아래 두 날
        for (const up of [-1, 1]) {
          ctx.fillStyle = C0; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-17, 0); ctx.quadraticCurveTo(-25, up * (22 + 16 * open), sd * 6, up * (46 + 22 * open)); ctx.quadraticCurveTo(sd * 18, up * (18 + 10 * open), 17, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, C1); g.addColorStop(0.55, C0); g.addColorStop(1, C2); // 껍데기
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -h * 0.46, w * 0.42, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = flash ? '#fff' : P[3];
      for (let k = 0; k < 7; k++) { const sx = -w * 0.3 + k * w * 0.1, sy = -h * 0.46 + Math.sin(k * 1.9) * h * 0.12; ctx.beginPath(); ctx.arc(sx, sy, 5 + (k % 3), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = C2; for (let k = 0; k < 5; k++) { const sx = -w * 0.24 + k * w * 0.12; ctx.beginPath(); ctx.moveTo(sx - 7, -h * 0.82); ctx.lineTo(sx, -h * 1.0 - (k % 2) * 6); ctx.lineTo(sx + 7, -h * 0.82); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      for (const sd of [-0.5, 0.5]) { // 눈자루
        const ex = sd * w * 0.3, ey = -h * 0.95;
        ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex * 0.8, -h * 0.78); ctx.lineTo(ex, ey); ctx.stroke();
        if (stunned || dying) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - 6, ey - 6); ctx.lineTo(ex + 6, ey + 6); ctx.moveTo(ex + 6, ey - 6); ctx.lineTo(ex - 6, ey + 6); ctx.stroke(); }
        else { ctx.fillStyle = '#f8f4d8'; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c01818'; ctx.beginPath(); ctx.arc(ex + b.dir * 3, ey, 4.5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-w * 0.12, -h * 0.3); ctx.quadraticCurveTo(0, -h * 0.2 + (stunned ? 8 : 0), w * 0.12, -h * 0.3); ctx.stroke(); // 입
      ctx.lineCap = 'butt'; ctx.restore();
      this._drawStunFx(ctx, b, bottom);
    }

    // 크라켄: 거대한 문어 (부푼 머리, 슬릿 눈, 여덟 개의 꿈틀대는 다리, 빛나는 점)
    _drawKraken(ctx, b) {
      const stunned = b.state === 'stun', dying = b.state === 'dying', P = TIERS[2].pal;
      const flash = b.flash > 0 || (dying && Math.floor(this.time * 20) % 2 === 0);
      const w = 150 * b.sx, h = 200 * b.sy, bottom = b.y + b.h, tt = this.time;
      const glow = b.glow || 0, staring = !!this.stare && this.stare.t >= this.stare.warn;
      ctx.save(); ctx.translate(b.cx, bottom);
      const C1 = flash ? '#fff' : P[1], C2 = flash ? '#fff' : P[2], C0 = flash ? '#fff' : P[3], OUT = P[5];
      ctx.lineCap = 'round';
      for (let k = 0; k < 8; k++) { // 다리 여덟 개
        const x0 = (k - 3.5) * w * 0.13, sw = Math.sin(tt * 2.4 + k * 0.9), x1 = x0 * 2.1 + sw * 16;
        ctx.strokeStyle = OUT; ctx.lineWidth = 21; ctx.beginPath(); ctx.moveTo(x0, -h * 0.34); ctx.quadraticCurveTo(x0 * 1.5 + sw * 12, -h * 0.12, x1, -4); ctx.stroke();
        ctx.strokeStyle = k % 2 ? C2 : C1; ctx.lineWidth = 15; ctx.stroke();
        ctx.fillStyle = 'rgba(255,220,240,0.7)'; ctx.beginPath(); ctx.arc(x0 * 1.6 + sw * 9, -h * 0.1, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineCap = 'butt';
      const pulse = 1 + 0.04 * Math.sin(tt * 3), g = ctx.createRadialGradient(-w * 0.12, -h * 0.82, 4, 0, -h * 0.62, w * 0.55); // 머리
      g.addColorStop(0, C1); g.addColorStop(0.7, C2); g.addColorStop(1, C0);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -h * 0.62, w * 0.46 * pulse, h * 0.36 * pulse, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      for (let k = 0; k < 9; k++) { const sx = Math.cos(k * 2.4) * w * 0.3, sy = -h * (0.7 + Math.sin(k * 1.7) * 0.18); ctx.fillStyle = `rgba(190,140,255,${0.35 + 0.3 * Math.sin(tt * 3 + k)})`; ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fill(); }
      for (const sd of [-1, 1]) { // 슬릿 눈
        const ex = sd * w * 0.17, ey = -h * 0.55;
        if (stunned || dying) { ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 9, ey - 9); ctx.lineTo(ex + 9, ey + 9); ctx.moveTo(ex + 9, ey - 9); ctx.lineTo(ex - 9, ey + 9); ctx.stroke(); continue; }
        if (glow > 0.05) { const eg = ctx.createRadialGradient(ex, ey, 2, ex, ey, 40 + 30 * glow); eg.addColorStop(0, `rgba(255,70,70,${0.8 * glow})`); eg.addColorStop(1, 'rgba(255,70,70,0)'); ctx.fillStyle = eg; ctx.fillRect(ex - 70, ey - 70, 140, 140); }
        ctx.fillStyle = staring ? '#ff5050' : glow > 0.05 ? '#ffb090' : '#ffe9a0'; ctx.beginPath(); ctx.ellipse(ex, ey, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#100810'; ctx.fillRect(ex - 2.5 + b.dir * 3, ey - 14, 5, 28);
      }
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(0, -h * 0.4, w * 0.07, h * 0.035 + (stunned ? 5 : 0), 0, 0, Math.PI * 2); ctx.fill(); // 입
      ctx.restore();
      this._drawStunFx(ctx, b, bottom);
    }

    // 해일의 군주: 거대한 심해 아귀 (큰 입, 이빨, 빛나는 미끼)
    _drawKing(ctx, b) {
      if (this.tier === 2) { this._drawCrab(ctx, b); return; }
      if (this.tier === 3) { this._drawKraken(ctx, b); return; }
      const stunned = b.state === 'stun', dying = b.state === 'dying';
      const P = TIERS[this.tier - 1].pal; // 보스마다 몸 색이 다르다
      const flash = b.flash > 0 || (dying && Math.floor(this.time * 20) % 2 === 0);
      const w = SW * b.sx, h = SH * b.sy, bottom = b.y + b.h;
      ctx.save();
      ctx.translate(b.cx, bottom); ctx.scale(b.dir >= 0 ? 1 : -1, 1);
      const cy = -h * 0.5;
      // 꼬리지느러미 (뒤쪽 = 왼쪽)
      ctx.fillStyle = flash ? '#fff' : P[0];
      ctx.beginPath(); ctx.moveTo(-w * 0.42, cy); ctx.lineTo(-w * 0.75, cy - h * 0.34); ctx.lineTo(-w * 0.64, cy); ctx.lineTo(-w * 0.75, cy + h * 0.34); ctx.closePath(); ctx.fill();
      // 몸통
      const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, flash ? '#fff' : P[1]); g.addColorStop(0.6, flash ? '#fff' : P[2]); g.addColorStop(1, flash ? '#ffe' : P[3]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P[5]; ctx.lineWidth = 4; ctx.stroke();
      // 등지느러미 가시
      ctx.fillStyle = flash ? '#fff' : P[4];
      for (let k = 0; k < 6; k++) { const ax = -w * 0.3 + k * w * 0.1; ctx.beginPath(); ctx.moveTo(ax - 8, cy - h * 0.46 + Math.abs(k - 2.5) * 3); ctx.lineTo(ax + 2, cy - h * 0.62 - (k % 2) * 6); ctx.lineTo(ax + 12, cy - h * 0.44 + Math.abs(k - 2.5) * 3); ctx.closePath(); ctx.fill(); }
      // 빛나는 반점
      for (let k = 0; k < 9; k++) { const sx = -w * 0.36 + (k % 5) * w * 0.14, sy = cy + h * (-0.1 + 0.16 * Math.floor(k / 5)); ctx.fillStyle = `rgba(140,255,200,${0.35 + 0.3 * Math.sin(this.time * 3 + k)})`; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill(); }
      // 큰 입 + 이빨 (앞쪽 = 오른쪽)
      const open = stunned ? 0.9 : b.glow > 0 ? 0.4 + 0.5 * b.glow : 0.3 + 0.1 * Math.sin(this.time * 2);
      ctx.fillStyle = '#2a0a10'; ctx.beginPath(); ctx.moveTo(w * 0.1, cy + h * 0.02); ctx.lineTo(w * 0.52, cy - h * 0.1 * open - 6); ctx.lineTo(w * 0.52, cy + h * (0.1 + 0.26 * open)); ctx.lineTo(w * 0.1, cy + h * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f4ea';
      for (let k = 0; k < 6; k++) { const tx = w * (0.16 + k * 0.06); ctx.beginPath(); ctx.moveTo(tx, cy + h * 0.03 + k * 1.3); ctx.lineTo(tx + 6, cy + h * 0.03 + 16 + k); ctx.lineTo(tx + 12, cy + h * 0.03 + k * 1.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(tx + 3, cy + h * (0.19 + 0.26 * open) - k * 1.2); ctx.lineTo(tx + 9, cy + h * (0.19 + 0.26 * open) - 16 - k); ctx.lineTo(tx + 15, cy + h * (0.19 + 0.26 * open) - k * 1.2); ctx.fill(); }
      // 눈
      const ex = w * 0.1, ey = cy - h * 0.18;
      if (stunned || dying) { ctx.strokeStyle = P[5]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 10, ey - 10); ctx.lineTo(ex + 10, ey + 10); ctx.moveTo(ex + 10, ey - 10); ctx.lineTo(ex - 10, ey + 10); ctx.stroke(); }
      else { ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = this.rage ? '#ff3030' : '#d02020'; ctx.fillRect(ex + 1, ey - 9, 6, 18); ctx.strokeStyle = P[5]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 18, ey - 16); ctx.lineTo(ex + 14, ey - 8); ctx.stroke(); }
      // 미끼: 머리 위로 휘어진 줄기와 빛나는 방울
      const lx = w * 0.42 + Math.sin(this.time * 2) * 6, ly = cy - h * 0.86 + Math.cos(this.time * 2.3) * 4;
      ctx.strokeStyle = flash ? '#fff' : P[4]; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w * 0.04, cy - h * 0.46); ctx.quadraticCurveTo(w * 0.08, cy - h * 1.1, lx, ly); ctx.stroke();
      const gl = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34); gl.addColorStop(0, 'rgba(255,255,170,0.95)'); gl.addColorStop(1, 'rgba(160,255,120,0)');
      ctx.fillStyle = gl; ctx.fillRect(lx - 34, ly - 34, 68, 68); ctx.fillStyle = '#fffbb0'; ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (stunned) for (let k = 0; k < 3; k++) { const a = this.time * 4 + (k * Math.PI * 2) / 3, sx = b.cx + Math.cos(a) * 52, sy = bottom - SH * 1.05 + Math.sin(a) * 8; ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.closePath(); ctx.fill(); }
      if (b.state === 'down' || stunned) { ctx.strokeStyle = Math.floor(this.time * 8) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,230,120,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); }
    }
  }

  G.SeaLord = SeaLord;
})(window.Game);
