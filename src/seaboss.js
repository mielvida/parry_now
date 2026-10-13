// 해일의 군주: 바다 위 오른쪽 끝 문(10000 G) 안의 방에서 만나는 보스. 다른 보스에 없던 패턴 4가지.
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
  const WAVE_H = 70;       // 해일 높이 (점프로 넘는다)
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
      const b = this.body;
      b.w = SW; b.h = SH;
      b.maxHp = C.BOSS_SEA_HP || 9000;
      b.hp = b.maxHp;
      this.rEdge = this.right - 2 * T; // 오른쪽 벽 안쪽
      this.groundCy = groundY - SH / 2;
      b.cx = this.rEdge - SW * 0.85; // 꼬리가 벽에 파묻히지 않게
      b.cy = -SH;
      b._box();
      this.patterns = ['tide', 'chain', 'tentacle', 'ink'];
      this.waves = [];
      this.tents = [];
      this.jel = null;     // 해파리 둘 {a, b, t, warn}
      this.inkA = 0;       // 먹물 어둠의 짙기
      this.rage = false;
      this.fury = false;   // 체력 1/4 아래: 더 빨라진다
      this.timer = 0.9;
      this.auxT = 3;
    }
    get sp() { return 1 + (this.rage ? 0.25 : 0) + (this.fury ? 0.25 : 0); } // 속도 배율

    // ---------- 패턴 고르기 ----------
    _startPattern() {
      if (!this.body.alive) return;
      const pool = this.patterns.filter((t) => t !== this.lastType);
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.lastType = type;
      const W = this.rEdge - this.left;
      const p = { type, t: 0, n: 0, sub: 'run' };
      if (type === 'tide') { p.side = Math.random() < 0.5 ? -1 : 1; p.count = this.fury ? 5 : this.rage ? 4 : 3; p.next = 1.1; p.fired = 0; }
      else if (type === 'chain') { p.warn = 0.85; p.dur = this.rage ? 6.4 : 5.4; this.jel = { t: 0, amp: W * 0.22, sp: 1.5 * this.sp, ax: this.left + W * 0.28, bx: this.left + W * 0.72, ay: this.groundY - 38, by: this.groundY - 150 };
        if (this.rage) this.jel2 = { t: 0, amp: W * 0.22, sp: 1.9 * this.sp, ax: this.left + W * 0.72, bx: this.left + W * 0.28, ay: this.groundY - 150, by: this.groundY - 40 }; else this.jel2 = null; } // 분노하면 해파리가 둘씩 두 쌍
      else if (type === 'tentacle') {
        const xs = this.rage ? [0.16, 0.5, 0.84] : [0.24, 0.74];
        const sw = this.rage ? 4 : 3;
        p.arms = xs.map((f, i) => ({ x: this.left + W * (f + rnd(-0.04, 0.04)), start: 0.9 + i * 0.7, a0: i % 2 ? 0 : Math.PI, a1: i % 2 ? Math.PI : 0, sweeps: sw, done: false }));
        p.sp = 2.8 * this.sp;
        this.tents = p.arms.map((a) => ({ x: a.x, ang: a.a0, vis: 0, live: false, a }));
      } else { p.dur = this.rage ? 8 : 7; p.spawns = this.rage ? [0.8, 1.5, 2.2, 2.9, 3.6, 4.3] : [0.8, 1.7, 2.6, 3.5, 4.4]; p.si = 0; }
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
      if (this.patternCount % 7 === 0) { this.phase = 'stun'; this.timer = 1.8; b.state = 'stun'; b.st = 0; this.ev.stunned(); }
      else { this.phase = 'rest'; this.timer = rnd(0.12, 0.35) / this.sp; }
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
      if (this.done || !this.body.alive) { this.waves.length = 0; this.tents = []; this.jel = null; this.jel2 = null; this.inkA = 0; return; }
      // 보조 해일: 해일 패턴이 아닐 때도 가끔 낮은 파도가 한쪽에서 밀려온다
      if (this.pat && this.pat.type !== 'tide' && this.pat.t > 1.5) { this.auxT -= dt; if (this.auxT <= 0) { this.auxT = (this.rage ? 2.6 : 4.0) / this.sp; const side = Math.random() < 0.5 ? -1 : 1; this.waves.push({ x: side > 0 ? this.rEdge + 50 : this.left - 50, dir: -side, spd: 400 * this.sp, t: 0 }); this.ev.sound('vanish'); } }
      // 해일
      for (const w of this.waves) { w.t += dt; if (w.t < 0) continue; w.x += w.dir * w.spd * dt; if (w.x < this.left - 90 || w.x > this.rEdge + 90) w.dead = true; }
      this.waves = this.waves.filter((w) => !w.dead);
      // 해파리
      if (this.jel) { this.jel.t += dt; }
      if (this.jel2) { this.jel2.t += dt; }
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const w of this.waves) if (w.t >= 0 && player.overlaps({ x: w.x - 40, y: this.groundY - WAVE_H, w: 80, h: WAVE_H })) hurt = true;
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
        if (hurt) this.ev.hurt(this.hurtDmg);
      }
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
      const p = this.pat, gy = this.groundY;
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
      for (const jj of [this.jel, this.jel2]) { const J = this._jellyPts(jj); if (J && p && p.type === 'chain') this._drawChain(ctx, J, p); }
      if (!this.body.dead) this._drawKing(ctx, this.body);
      for (const f of this.balls) this._drawBubble(ctx, f);
      if (this.inkA > 0.02) this._drawInk(ctx);
    }

    _drawWave(ctx, w) {
      const gy = this.groundY, d = w.dir, tip = w.x + d * 40;
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

    // 해일의 군주: 거대한 심해 아귀 (큰 입, 이빨, 빛나는 미끼)
    _drawKing(ctx, b) {
      const stunned = b.state === 'stun', dying = b.state === 'dying';
      const flash = b.flash > 0 || (dying && Math.floor(this.time * 20) % 2 === 0);
      const w = SW * b.sx, h = SH * b.sy, bottom = b.y + b.h;
      ctx.save();
      ctx.translate(b.cx, bottom); ctx.scale(b.dir >= 0 ? 1 : -1, 1);
      const cy = -h * 0.5;
      // 꼬리지느러미 (뒤쪽 = 왼쪽)
      ctx.fillStyle = flash ? '#fff' : '#17606e';
      ctx.beginPath(); ctx.moveTo(-w * 0.42, cy); ctx.lineTo(-w * 0.75, cy - h * 0.34); ctx.lineTo(-w * 0.64, cy); ctx.lineTo(-w * 0.75, cy + h * 0.34); ctx.closePath(); ctx.fill();
      // 몸통
      const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, flash ? '#fff' : '#2a8a96'); g.addColorStop(0.6, flash ? '#fff' : '#1a5a72'); g.addColorStop(1, flash ? '#ffe' : '#0c3040');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#08242e'; ctx.lineWidth = 4; ctx.stroke();
      // 등지느러미 가시
      ctx.fillStyle = flash ? '#fff' : '#0e4150';
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
      if (stunned || dying) { ctx.strokeStyle = '#08242e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 10, ey - 10); ctx.lineTo(ex + 10, ey + 10); ctx.moveTo(ex + 10, ey - 10); ctx.lineTo(ex - 10, ey + 10); ctx.stroke(); }
      else { ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = this.rage ? '#ff3030' : '#d02020'; ctx.fillRect(ex + 1, ey - 9, 6, 18); ctx.strokeStyle = '#08242e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 18, ey - 16); ctx.lineTo(ex + 14, ey - 8); ctx.stroke(); }
      // 미끼: 머리 위로 휘어진 줄기와 빛나는 방울
      const lx = w * 0.42 + Math.sin(this.time * 2) * 6, ly = cy - h * 0.86 + Math.cos(this.time * 2.3) * 4;
      ctx.strokeStyle = flash ? '#fff' : '#0e4150'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w * 0.04, cy - h * 0.46); ctx.quadraticCurveTo(w * 0.08, cy - h * 1.1, lx, ly); ctx.stroke();
      const gl = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34); gl.addColorStop(0, 'rgba(255,255,170,0.95)'); gl.addColorStop(1, 'rgba(160,255,120,0)');
      ctx.fillStyle = gl; ctx.fillRect(lx - 34, ly - 34, 68, 68); ctx.fillStyle = '#fffbb0'; ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (stunned) for (let k = 0; k < 3; k++) { const a = this.time * 4 + (k * Math.PI * 2) / 3, sx = b.cx + Math.cos(a) * 52, sy = bottom - SH * 1.05 + Math.sin(a) * 8; ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.closePath(); ctx.fill(); }
      if (b.state === 'down' || stunned) { ctx.strokeStyle = Math.floor(this.time * 8) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,230,120,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); }
    }
  }

  G.SeaLord = SeaLord;
})(window.Game);
