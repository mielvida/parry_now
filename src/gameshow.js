// 방사능 공장 끝의 "정체 모를 사람"이 여는 게임쇼 (델타룬 텐나의 TV 쇼처럼 정신없이 바뀌는 코너들).
// 지금까지 해 본 놀이(야바위, 표적 맞추기, 결투, 총게임, 방향키, 제련, 풀무질, 낚시)를 훨씬 빠르게 하고,
// 새 보드게임 10개(boardgames.js), 가끔 3D 총게임(fps3d.js)과 제한 시간 퍼즐이 끼어든다.
// 규칙: 하나 틀릴 때마다 (쿨타임·무적과 상관없이) 피가 한 칸 깎인다. 피가 다하면 끝.
// 이 파일 = 쇼 진행(코너 고르기, 전환 연출, 해설), 게임 공통 틀, 빠른 놀이 8개, 제한 시간 퍼즐 3개.
//
// 모든 코너는 같은 모양이다: new Game(난이도 0~1) -> update(dt, io), draw(ctx, W, H), result('win'|'lose'|null), pending(이번에 틀린 횟수)
// io = { pressed(...코드), down(...코드), click: {x,y}|null (이번 프레임 클릭), mouse: {x,y}|null, W, H }
(function (G) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

  // ---------- 그리기 도구 ----------
  function text(ctx, s, x, y, size, color, align, stroke) {
    if (ctx.__defer) { ctx.__defer.push({ m: ctx.getTransform(), a: ctx.globalAlpha, args: [s, x, y, size, color, align, stroke] }); return; } // 도트 화면: 나중에 얹는다
    textNow(ctx, s, x, y, size, color, align, stroke);
  }
  function textNow(ctx, s, x, y, size, color, align, stroke) {
    ctx.font = `bold ${size || 18}px sans-serif`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    if (stroke !== null) { ctx.lineWidth = Math.max(3, (size || 18) / 5); ctx.strokeStyle = stroke || 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color || '#fff';
    ctx.fillText(s, x, y);
  }
  // 개: 게임쇼의 사회자이자 최종 보스. (x, y) = 발 밑 가운데, s = 크기, mood = 'idle' | 'angry' | 'down'. 오른쪽을 본다
  function drawDog(ctx, x, y, s, mood, t, cloak) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const body = '#c8a070', dark = '#7a5a34', white = '#f4ecd8', R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
    if (mood === 'down') { // 옆으로 벌러덩 쓰러져 있다
      R(body, -36, -24, 72, 22); R(white, -36, -10, 72, 8); R(body, 34, -30, 28, 24); R(dark, 40, -38, 8, 12);
      for (const lx of [-24, -10, 10, 24]) R(body, lx - 4, -42, 8, 18);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(48, -24); ctx.lineTo(54, -18); ctx.moveTo(54, -24); ctx.lineTo(48, -18); ctx.stroke();
      R('#ff7a9a', 54, -12, 6, 10); R('#d03a3a', 28, -28, 8, 30); R('#222', 60, -22, 4, 4);
      if (cloak !== false) { // 벗겨진 검은 망토: 그 의문의 사람의 망토였다
        ctx.fillStyle = '#14101c'; ctx.beginPath(); ctx.moveTo(-84, 0); ctx.quadraticCurveTo(-78, -34, -46, -30); ctx.lineTo(-30, -20); ctx.lineTo(-34, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(-58, -26, 14, Math.PI, 0); ctx.fill(); // 모자 부분
        ctx.strokeStyle = '#6a4aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-84, 0); ctx.quadraticCurveTo(-78, -34, -46, -30); ctx.lineTo(-30, -20); ctx.stroke();
      }
      ctx.restore(); return;
    }
    const ang = mood === 'angry', bob = Math.sin(t * (ang ? 14 : 3)) * (ang ? 1.6 : 1);
    ctx.save(); ctx.translate(-34, -34 + bob); ctx.rotate(Math.sin(t * (ang ? 22 : 8)) * 0.4 - 0.7); R(dark, -4, -24, 8, 26); ctx.restore(); // 꼬리
    for (const lx of [-26, -14, 14, 26]) { R(body, lx - 5, -14, 10, 14); R(white, lx - 5, -4, 10, 4); } // 다리
    R(body, -36, -46 + bob, 72, 36); R(white, -36, -18 + bob, 72, 8); // 몸통
    R('#d03a3a', 22, -50 + bob, 10, 36); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(27, -12 + bob, 4, 0, Math.PI * 2); ctx.fill(); // 목걸이
    R(body, 18, -78 + bob, 40, 34); // 머리
    ctx.fillStyle = dark; for (const ex of [20, 46]) { ctx.beginPath(); ctx.moveTo(ex, -78 + bob); ctx.lineTo(ex + 6, -97 + bob); ctx.lineTo(ex + 14, -78 + bob); ctx.closePath(); ctx.fill(); } // 귀
    R(white, 44, -62 + bob, 18, 16); R('#222', 58, -64 + bob, 6, 6); // 주둥이와 코
    if (ang) { // 붉게 빛나는 눈, 사나운 눈썹, 송곳니
      R('#ff3030', 32, -68 + bob, 8, 7); R('#ffd0d0', 34, -67 + bob, 3, 3);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(28, -75 + bob); ctx.lineTo(42, -69 + bob); ctx.stroke();
      R('#401018', 46, -54 + bob, 16, 8); ctx.fillStyle = '#fff'; for (const fx of [48, 56]) { ctx.beginPath(); ctx.moveTo(fx, -54 + bob); ctx.lineTo(fx + 3, -47 + bob); ctx.lineTo(fx + 6, -54 + bob); ctx.fill(); }
    } else { R('#222', 33, -68 + bob, 6, 6); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(54, -54 + bob, 4, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
  }
  const inBox = (p, x, y, w, h) => !!p && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;

  // ---------- 코너 공통 틀 ----------
  class Game {
    constructor(lv) {
      this.lv = lv || 0;      // 0~1: 쇼가 진행될수록 커진다 (더 빠르고 더 빡빡하다)
      this.t = 0;
      this.result = null;
      this.pending = 0;       // 아직 쇼가 피로 바꾸지 않은 틀린 횟수
      this.total = 0;
      this.limit = 0;         // 제한 시간 (0 = 없음)
      this.msg = ''; this.msgT = 0; this.msgC = '#fff';
      this.title = ''; this.hint = '';
      this.tone = ['#14233a', '#25456e'];   // 이 코너의 배경 색
    }
    snd(name) { (this.sounds || (this.sounds = [])).push(name); } // 효과음 요청 (쇼가 모아서 낸다)
    say(s, c) { this.msg = s; this.msgT = 1.3; this.msgC = c || '#fff'; }
    mistake(s) { this.total += 1; this.pending += 1; this.snd('buzzer'); this.say(s || '틀렸다!', '#ff7a7a'); }
    win(s) { if (!this.result) { this.result = 'win'; this.snd('fanfare'); if (s) this.say(s, '#8dffa8'); } }
    lose(s) { if (!this.result) { this.result = 'lose'; if (s) this.say(s, '#ff7a7a'); } }
    left() { return this.limit ? Math.max(0, this.limit - this.t) : 0; }
    update(dt, io) {
      this.t += dt;
      this.msgT = Math.max(0, this.msgT - dt);
      if (this.result) return;
      this.step(dt, io);
      if (this.limit && !this.result && this.t >= this.limit) { this.mistake('시간 초과!'); this.lose(); }
    }
    step() {}
    // 배경 + 제한 시간 막대 + 한마디
    drawBase(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, this.tone[0]); g.addColorStop(1, this.tone[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let k = 0; k < 14; k++) ctx.fillRect(((k * 97 + this.t * 24) % (W + 120)) - 60, 0, 40, H);
    }
    drawOver(ctx, W, H) {
      if (this.limit) { // 제한 시간 막대
        const u = this.left() / this.limit;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 200, 94, 400, 10);
        ctx.fillStyle = u > 0.3 ? '#8dffa8' : '#ff6a6a'; ctx.fillRect(W / 2 - 199, 95, 398 * u, 8);
      }
      if (this.msgT > 0) { const a = Math.min(1, this.msgT * 2); ctx.globalAlpha = a; text(ctx, this.msg, W / 2, 128, 26, this.msgC); ctx.globalAlpha = 1; }
    }
    draw(ctx, W, H) { this.drawBase(ctx, W, H); this.drawOver(ctx, W, H); }
  }

  // ================= 빠른 놀이 8개 =================
  // 1) 야바위: 공이 든 컵을 번개처럼 섞는다
  class Shell extends Game {
    constructor(lv) {
      super(lv); this.title = '야바위!'; this.hint = '공이 든 컵을 맞혀라 (←→ + Enter, 또는 클릭)'; this.tone = ['#2a1a3a', '#6a3a7a'];
      this.cups = [0, 1, 2].map((i) => ({ slot: i, px: i, py: 0, lift: 0 }));
      this.ball = rint(0, 2); this.swaps = []; this.limit = 26;
      const n = 14 + Math.round(lv * 8);
      for (let i = 0; i < n; i++) { const a = rint(0, 2); let b = rint(0, 2); while (b === a) b = rint(0, 2); this.swaps.push([a, b]); }
      this.si = 0; this.sT = 0; this.sdur = Math.max(0.035, 0.07 - 0.03 * lv); this.st = 'show'; this.stT = 0; this.cur = 1; this.pickIdx = -1;
    }
    step(dt, io) {
      this.stT += dt;
      for (const c of this.cups) { c.px = c.slot; c.py = 0; }
      if (this.st === 'show') {
        this.cups.forEach((c, i) => { const want = i === this.ball && this.stT < 0.7 ? 1 : 0; c.lift += (want - c.lift) * Math.min(1, 14 * dt); });
        if (this.stT > 0.95) { this.st = 'shuffle'; this.stT = 0; this.sT = 0; }
      } else if (this.st === 'shuffle') {
        this.sT += dt;
        const sw = this.swaps[this.si], u = Math.min(1, this.sT / this.sdur), e = u * u * (3 - 2 * u);
        const ca = this.cups.find((c) => c.slot === sw[0]), cb = this.cups.find((c) => c.slot === sw[1]);
        ca.px = sw[0] + (sw[1] - sw[0]) * e; ca.py = -Math.sin(u * Math.PI) * 30; cb.px = sw[1] + (sw[0] - sw[1]) * e; cb.py = Math.sin(u * Math.PI) * 14;
        if (u >= 1) { ca.slot = sw[1]; cb.slot = sw[0]; this.snd('tick'); this.si += 1; this.sT = 0; if (this.si >= this.swaps.length) { this.st = 'pick'; this.stT = 0; } }
      } else if (this.st === 'pick') {
        if (io.pressed('ArrowLeft', 'KeyA')) this.cur = Math.max(0, this.cur - 1);
        if (io.pressed('ArrowRight', 'KeyD')) this.cur = Math.min(2, this.cur + 1);
        const at = (p) => (p && p.y > 230 && p.y < 380 ? [0, 1, 2].find((s) => Math.abs(p.x - (300 + s * 180)) < 56) : undefined);
        if (at(io.mouse) !== undefined) this.cur = at(io.mouse);
        const c = at(io.click);
        if (c !== undefined) this.cur = c;
        if (c !== undefined || io.pressed('Enter', 'NumpadEnter', 'Space')) {
          this.pickIdx = this.cups.findIndex((q) => q.slot === this.cur);
          this.st = 'reveal'; this.stT = 0; this.snd('flip');
          if (this.pickIdx === this.ball) this.win('정답!'); else { this.mistake('틀렸다! 공은 저기!'); this.lose(); }
        }
      } else if (this.st === 'reveal') this.cups.forEach((c) => { c.lift += (1 - c.lift) * Math.min(1, 12 * dt); });
    }
    update(dt, io) { super.update(dt, io); if (this.result) { for (const c of this.cups) { c.px = c.slot; } this.cups.forEach((c) => { c.lift += (1 - c.lift) * Math.min(1, 12 * dt); }); } }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(160, 350, 640, 26);
      for (const [i, c] of this.cups.entries()) {
        const x = 300 + c.px * 180, y = 330 + c.py - c.lift * 70;
        if (i === this.ball) { ctx.fillStyle = '#ffe34a'; ctx.beginPath(); ctx.arc(x, 345, 16, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = this.st === 'pick' && c.slot === this.cur ? '#ffb070' : '#d6803a';
        ctx.beginPath(); ctx.moveTo(x - 42, y + 24); ctx.lineTo(x - 30, y - 60); ctx.lineTo(x + 30, y - 60); ctx.lineTo(x + 42, y + 24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - 24, y - 54, 8, 70);
      }
      this.drawOver(ctx, W, H);
    }
  }

  // 2) 표적 맞추기: 빠르게 오가는 작은 표적에 공 5개
  class Target extends Game {
    constructor(lv) {
      super(lv); this.title = '표적 맞추기!'; this.hint = '조준(방향키·마우스) 후 Enter/클릭으로 던져라. 빗나가면 피 -1'; this.tone = ['#1a3a2a', '#3a7a4a']; this.limit = 28;
      this.shots = 5; this.cx = 480; this.cy = 330; this.ball = null; this.marks = []; this.tt = 0; this.tx = 480; this.ty = 235; this.endT = 0;
    }
    step(dt, io) {
      this.tt += dt;
      const spd = 3.0 + 1.6 * this.lv + 0.35 * (5 - this.shots);
      this.tx = 480 + Math.sin(this.tt * spd) * 250; this.ty = 235 + Math.sin(this.tt * spd * 0.8 + 1) * 70;
      for (const m of this.marks) m.t += dt;
      const v = 480;
      this.cx = clamp(this.cx + ((io.down('ArrowRight', 'KeyD') ? 1 : 0) - (io.down('ArrowLeft', 'KeyA') ? 1 : 0)) * v * dt, 130, 830);
      this.cy = clamp(this.cy + ((io.down('ArrowDown', 'KeyS') ? 1 : 0) - (io.down('ArrowUp', 'KeyW') ? 1 : 0)) * v * dt, 100, 460);
      if (io.mouse && !io.down('ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'ArrowDown', 'KeyS', 'ArrowUp', 'KeyW')) { this.cx = clamp(io.mouse.x, 130, 830); this.cy = clamp(io.mouse.y, 100, 460); }
      if (!this.ball && this.shots > 0 && (io.click || io.pressed('Enter', 'NumpadEnter', 'Space'))) { this.ball = { t: 0, ax: this.cx, ay: this.cy }; this.snd('throw'); }
      if (this.ball) {
        this.ball.t += dt;
        if (this.ball.t >= 0.2) {
          const d = Math.hypot(this.ball.ax - this.tx, this.ball.ay - this.ty), pts = d <= 14 ? 50 : d <= 26 ? 30 : d <= 40 ? 20 : 0;
          this.marks.push({ x: this.ball.ax, y: this.ball.ay, pts, t: 0 }); this.shots -= 1; this.ball = null;
          if (pts === 0) { this.mistake('빗나갔다!'); this.snd('thud'); } else this.snd(pts >= 30 ? 'ding' : 'coin');
        }
      } else if (this.shots <= 0) { this.endT += dt; if (this.endT > 0.4) this.win('명사수!'); }
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      for (const [r, c] of [[44, '#f4f1e8'], [30, '#d9473f'], [18, '#f4f1e8'], [8, '#d9473f']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(this.tx, this.ty, r * 0.62, 0, Math.PI * 2); ctx.fill(); }
      for (const m of this.marks) { ctx.fillStyle = m.pts ? '#ffe34a' : '#8a8a8a'; ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.fill(); text(ctx, m.pts ? `+${m.pts}` : 'X', m.x, m.y - 16 - m.t * 20, 16, m.pts ? '#ffe34a' : '#ff8a8a'); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.cx, this.cy, 14, 0, Math.PI * 2); ctx.moveTo(this.cx - 22, this.cy); ctx.lineTo(this.cx + 22, this.cy); ctx.moveTo(this.cx, this.cy - 22); ctx.lineTo(this.cx, this.cy + 22); ctx.stroke();
      if (this.ball) { const u = this.ball.t / 0.2; ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.arc(this.ball.ax, this.ball.ay + (1 - u) * 90, 10 - u * 4, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, `남은 공 ${this.shots}`, W / 2, 470, 20); this.drawOver(ctx, W, H);
    }
  }

  // 3) 결투: "지금!"이 뜨면 번개같이 (일찍 누르거나 늦으면 틀린 것)
  class Duel extends Game {
    constructor(lv) {
      super(lv); this.title = '결투!'; this.hint = '"지금!"이 뜨면 Enter/클릭! 일찍 눌러도 늦어도 피 -1'; this.tone = ['#3a1a1a', '#7a3a2a'];
      this.round = 0; this.need = 3; this.tries = 0; this.react = 0.42 - 0.12 * lv; this.reset();
    }
    reset() { this.st = 'wait'; this.stT = 0; this.wait = rnd(0.7, 1.9); }
    step(dt, io) {
      this.stT += dt;
      const hit = !!io.click || io.pressed('Enter', 'NumpadEnter', 'Space');
      if (this.st === 'wait') {
        if (hit) { this.mistake('너무 일렀다!'); this.tries++; this.st = 'rest'; this.stT = 0; } else if (this.stT >= this.wait) { this.st = 'go'; this.stT = 0; this.snd('drum'); }
      } else if (this.st === 'go') {
        if (hit) { this.round++; this.tries++; this.snd('parry'); this.say(`${Math.round(this.stT * 1000)}ms!`, '#8dffa8'); const ms = Math.round(this.stT * 1000); this.st = 'rest'; this.stT = 0; if (this.round >= this.need) this.win(`${ms}ms! 승리!`); }
        else if (this.stT >= this.react) { this.mistake('늦었다!'); this.tries++; this.st = 'rest'; this.stT = 0; }
      } else if (this.st === 'rest') { if (this.stT > 0.5) { if (this.tries >= 6) this.lose('기회를 모두 썼다!'); else this.reset(); } }
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      text(ctx, `성공 ${this.round}/${this.need}`, W / 2, 190, 22);
      for (const sd of [-1, 1]) { ctx.fillStyle = sd < 0 ? '#2a4a8a' : '#8a2a2a'; ctx.fillRect(W / 2 + sd * 220 - 30, 270, 60, 110); ctx.fillStyle = '#e8b98a'; ctx.fillRect(W / 2 + sd * 220 - 20, 236, 40, 36); ctx.fillStyle = '#e8e8f0'; ctx.fillRect(W / 2 + sd * 220 + (sd < 0 ? 30 : -90), 300, 60, 6); }
      if (this.st === 'go') { const s = 1 + 0.15 * Math.sin(this.t * 40); ctx.save(); ctx.translate(W / 2, 300); ctx.scale(s, s); text(ctx, '지금!!', 0, 0, 80, '#ffe34a'); ctx.restore(); }
      else text(ctx, this.st === 'wait' ? '…' : '', W / 2, 300, 60, '#ffffff88', 'center', null);
      this.drawOver(ctx, W, H);
    }
  }

  // 4) 총게임: 튀어나오는 적을 쏘기 전에 쏴라 (놓치면 맞는다)
  class Gallery extends Game {
    constructor(lv) {
      super(lv); this.title = '총게임!'; this.hint = '조준(마우스·방향키) + 클릭/Enter. 적이 쏘기 전에 쓰러뜨려라'; this.tone = ['#2a2a1a', '#6a5a2a']; this.limit = 26;
      this.cx = 480; this.cy = 300; this.foes = []; this.spawnT = 0.5; this.kills = 0; this.need = 8; this.fuse = 2.0 - 0.55 * lv;
    }
    step(dt, io) {
      const v = 560;
      this.cx = clamp(this.cx + ((io.down('ArrowRight', 'KeyD') ? 1 : 0) - (io.down('ArrowLeft', 'KeyA') ? 1 : 0)) * v * dt, 60, 900);
      this.cy = clamp(this.cy + ((io.down('ArrowDown', 'KeyS') ? 1 : 0) - (io.down('ArrowUp', 'KeyW') ? 1 : 0)) * v * dt, 140, 520);
      if (io.mouse && !io.down('ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'ArrowDown', 'KeyS', 'ArrowUp', 'KeyW')) { this.cx = io.mouse.x; this.cy = io.mouse.y; }
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.foes.filter((q) => !q.dead).length < 2) { this.foes.push({ x: rnd(120, 840), y: rnd(220, 470), t: 0, dead: 0 }); this.snd('pop'); this.spawnT = rnd(0.6, 1.1); }
      const shoot = io.click || io.pressed('Enter', 'NumpadEnter', 'Space');
      for (const f of this.foes) {
        if (f.dead) { f.dead += dt; continue; }
        f.t += dt;
        if (f.t >= this.fuse) { f.dead = 0.001; f.shot = true; this.mistake('맞았다!'); this.snd('gun'); }
      }
      if (shoot) { const f = this.foes.filter((q) => !q.dead && Math.hypot(q.x - this.cx, q.y - 30 - this.cy) < 46).sort((a, b) => b.t - a.t)[0]; this.snd('gun'); if (f) { f.dead = 0.001; this.kills++; this.snd('ding'); if (this.kills >= this.need) this.win('전멸!'); } }
      this.foes = this.foes.filter((f) => !f.dead || f.dead < 0.4);
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      for (const f of this.foes) {
        ctx.globalAlpha = f.dead ? Math.max(0, 1 - f.dead * 2.5) : 1;
        const danger = f.t / this.fuse;
        ctx.fillStyle = f.shot ? '#ff4040' : `rgb(${90 + danger * 160},${70},${70})`; ctx.fillRect(f.x - 22, f.y - 40, 44, 70);
        ctx.fillStyle = '#e8b98a'; ctx.beginPath(); ctx.arc(f.x, f.y - 52, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(f.x + 12, f.y - 24, 26, 6);
        ctx.fillStyle = '#ffe34a'; ctx.fillRect(f.x - 22, f.y - 84, 44 * (1 - danger), 5);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.cx, this.cy, 20, 0, Math.PI * 2); ctx.moveTo(this.cx - 30, this.cy); ctx.lineTo(this.cx + 30, this.cy); ctx.moveTo(this.cx, this.cy - 30); ctx.lineTo(this.cx, this.cy + 30); ctx.stroke();
      text(ctx, `쓰러뜨림 ${this.kills}/${this.need}`, W / 2, 160, 20); this.drawOver(ctx, W, H);
    }
  }

  // 5) 방향키 박자: 내려오는 화살표를 선에 닿을 때 누른다. 아주 빠르고, 뒤로 갈수록 선 가까이에서 사라진다
  class Arrows extends Game {
    constructor(lv) {
      super(lv); this.title = '방향키!'; this.hint = '화살표가 선에 닿을 때 같은 방향키! 아주 빠르고, 뒤에는 안 보인다!'; this.tone = ['#1a2a3a', '#3a5a8a'];
      this.notes = [];
      const gap = Math.max(0.2, 0.42 - 0.2 * lv); // 박자 간격 (아주 빠르다)
      let at = 0.9;
      const n = 26;
      for (let i = 0; i < n; i++) {
        const d = rint(0, 3); this.notes.push({ dir: d, at, done: false, hide: i >= 10 });
        at += gap * (Math.random() < 0.25 ? 0.7 : 1); // 가끔 더 촘촘하다
      }
      this.speed = 560 + 240 * lv; this.lineY = 440; this.lastT = at + 0.8; this.win_ = 0.17; this.late = 0.11;
    }
    step(dt, io) {
      const KEYS = [['ArrowLeft', 'KeyA'], ['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW'], ['ArrowRight', 'KeyD']];
      for (const nt of this.notes) {
        nt.y = this.lineY - (nt.at - this.t) * this.speed;
        if (!nt.done && this.t - nt.at > this.late) { nt.done = true; nt.miss = true; this.mistake('놓쳤다!'); }
      }
      for (let d = 0; d < 4; d++) {
        if (!io.pressed(...KEYS[d])) continue;
        const cand = this.notes.filter((q) => !q.done && q.dir === d && Math.abs(this.t - q.at) < this.win_).sort((a, b) => Math.abs(this.t - a.at) - Math.abs(this.t - b.at))[0];
        if (cand) { cand.done = true; cand.hit = true; this.snd('tick'); this.snd('coin'); this.say('좋아!', '#8dffa8'); }
        else this.mistake(this.notes.some((q) => !q.done && Math.abs(this.t - q.at) < 0.3) ? '틀린 방향!' : '헛누름!');
      }
      if (this.t > this.lastT) this.win('콤보 끝!');
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const X = (d) => 300 + d * 120;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(220, 120, 520, 360);
      ctx.fillStyle = '#ffffff55'; ctx.fillRect(220, this.lineY - 4, 520, 8);
      for (let d = 0; d < 4; d++) this.arrow(ctx, X(d), this.lineY, d, 'rgba(255,255,255,0.25)', 30);
      for (const nt of this.notes) {
        if (nt.hit || nt.y === undefined || nt.y < 100 || nt.y > 520) continue;
        const fade = nt.hide ? Math.max(0, Math.min(1, (this.lineY - 70 - nt.y) / 90)) : 1; // 뒤쪽 화살표는 선에 가까워질수록 사라진다
        if (fade <= 0.03) continue;
        ctx.globalAlpha = fade; this.arrow(ctx, X(nt.dir), nt.y, nt.dir, nt.miss ? '#ff6a6a' : ['#6ac0ff', '#8dffa8', '#ffe34a', '#ff8ac8'][nt.dir], 30); ctx.globalAlpha = 1;
      }
      this.drawOver(ctx, W, H);
    }
    arrow(ctx, x, y, d, col, s) { ctx.save(); ctx.translate(x, y); ctx.rotate([Math.PI, Math.PI / 2, -Math.PI / 2, 0][d]); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.2, -s * 0.9); ctx.lineTo(-s * 0.2, -s * 0.35); ctx.lineTo(-s, -s * 0.35); ctx.lineTo(-s, s * 0.35); ctx.lineTo(-s * 0.2, s * 0.35); ctx.lineTo(-s * 0.2, s * 0.9); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }

  // 6) 제련: 왔다 갔다 하는 온도 표시를 초록 띠 안에서 멈춰라
  class Smelt extends Game {
    constructor(lv) {
      super(lv); this.title = '온도 맞추기!'; this.hint = '표시가 초록 띠 안일 때 Space/클릭! 4번 성공하면 끝'; this.tone = ['#3a1a0a', '#8a3a1a']; this.limit = 24;
      this.hits = 0; this.pos = 0; this.dir = 1; this.band = 0.5; this.bw = 0.17 - 0.05 * lv; this.spd = 1.6 + 1.2 * lv; this.flash = 0;
    }
    step(dt, io) {
      this.pos += this.dir * this.spd * dt;
      if (this.pos > 1) { this.pos = 1; this.dir = -1; } if (this.pos < 0) { this.pos = 0; this.dir = 1; }
      this.flash = Math.max(0, this.flash - dt);
      if (io.click || io.pressed('Space', 'Enter', 'NumpadEnter')) {
        if (Math.abs(this.pos - this.band) < this.bw / 2) { this.hits++; this.flash = 0.3; this.snd('parry'); this.snd('ding'); this.say('딱!', '#8dffa8'); if (this.hits >= 4) this.win('완벽한 온도!'); else { this.band = rnd(0.2, 0.8); this.spd *= 1.12; } }
        else this.mistake('온도가 안 맞다!');
      }
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const x0 = 180, w = 600, y = 300;
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#3a6aff'); g.addColorStop(0.5, '#ffd24a'); g.addColorStop(1, '#ff3a1a');
      ctx.fillStyle = g; ctx.fillRect(x0, y - 22, w, 44);
      ctx.fillStyle = 'rgba(80,255,120,0.75)'; ctx.fillRect(x0 + (this.band - this.bw / 2) * w, y - 26, this.bw * w, 52);
      ctx.fillStyle = '#fff'; ctx.fillRect(x0 + this.pos * w - 4, y - 36, 8, 72);
      text(ctx, `성공 ${this.hits}/4`, W / 2, 210, 24);
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,200,${this.flash})`; ctx.fillRect(0, 0, W, H); }
      this.drawOver(ctx, W, H);
    }
  }

  // 7) 풀무질: 누르고 있으면 차오르고 떼면 멈춘다. 초록 띠에서 떼라
  class Pump extends Game {
    constructor(lv) {
      super(lv); this.title = '풀무질!'; this.hint = 'Space/마우스를 누르고 있다가 초록 띠에서 떼라! (3번)'; this.tone = ['#1a1a2a', '#4a3a6a']; this.limit = 24;
      this.level = 0; this.hits = 0; this.pressing = false; this.band = rnd(0.55, 0.85); this.bw = 0.14 - 0.05 * lv; this.rise = 0.7 + 0.5 * lv;
    }
    step(dt, io) {
      const dn = io.down('Space', 'Enter') || io.mouseDown;
      if (dn) { this.pressing = true; this.level = Math.min(1.05, this.level + this.rise * dt); this.rt = (this.rt || 0) - dt; if (this.rt <= 0) { this.snd('reel'); this.rt = 0.12; } if (this.level >= 1.05) { this.mistake('넘쳤다!'); this.level = 0; this.pressing = false; } }
      else if (this.pressing) {
        this.pressing = false;
        if (Math.abs(this.level - this.band) < this.bw / 2) { this.hits++; this.snd('ding'); this.say('좋아!', '#8dffa8'); this.band = rnd(0.45, 0.88); this.bw = Math.max(0.07, this.bw * 0.85); this.rise *= 1.15; if (this.hits >= 3) this.win('불이 활활!'); }
        else this.mistake('타이밍이 안 맞다!');
        this.level = 0;
      } else this.level = Math.max(0, this.level - 1.2 * dt);
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const x = W / 2 - 40, y = 160, h = 300, w = 80;
      ctx.fillStyle = '#111'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.fillStyle = 'rgba(80,255,120,0.8)'; ctx.fillRect(x, y + h * (1 - this.band - this.bw / 2), w, h * this.bw);
      ctx.fillStyle = '#ff9a3a'; ctx.fillRect(x, y + h * (1 - Math.min(1, this.level)), w, h * Math.min(1, this.level));
      text(ctx, `성공 ${this.hits}/3`, W / 2, 130, 22);
      this.drawOver(ctx, W, H);
    }
  }

  // 8) 낚시: 누르고 있으면 낚시 막대가 올라가 물고기를 따라간다
  class Fishing extends Game {
    constructor(lv) {
      super(lv); this.title = '낚시!'; this.hint = 'Space/마우스를 눌러 초록 막대로 물고기를 따라가라. 놓치면 피 -1'; this.tone = ['#0a2a4a', '#1a6a8a']; this.limit = 22;
      this.bar = 0.5; this.vel = 0; this.fish = 0.5; this.ft = rnd(0, 6); this.prog = 0.3; this.fs = 1.6 + 1.4 * lv; this.lost = 0;
    }
    step(dt, io) {
      const dn = io.down('Space', 'Enter') || io.mouseDown;
      this.rt = (this.rt || 0) - dt; if (dn && this.rt <= 0) { this.snd('reel'); this.rt = 0.14; } this.vel += (dn ? 2.2 : -1.8) * dt; this.vel = clamp(this.vel, -1.2, 1.2); this.bar = clamp(this.bar + this.vel * dt, 0.1, 0.9); if (this.bar <= 0.1 || this.bar >= 0.9) this.vel = 0;
      this.ft += dt * this.fs; this.fish = 0.5 + 0.38 * Math.sin(this.ft) * Math.cos(this.ft * 0.37 + 1);
      const on = Math.abs(this.fish - this.bar) < 0.13;
      this.grace = Math.max(0, (this.grace || 0) - dt);
      this.prog = clamp(this.prog + (on ? 0.32 : this.grace > 0 ? 0 : -0.28) * dt, 0, 1);
      if (this.prog >= 1) { this.snd('splash'); this.win('대어를 낚았다!'); }
      if (this.prog <= 0) { this.mistake('물고기가 도망쳤다!'); this.prog = 0.3; this.grace = 1.6; }
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const x = W / 2 - 30, y = 130, h = 340;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, 60, h);
      ctx.fillStyle = 'rgba(120,255,140,0.6)'; ctx.fillRect(x, y + h * (1 - this.bar - 0.13), 60, h * 0.26);
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(x + 30, y + h * (1 - this.fish), 20, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 50, y + h * (1 - this.fish)); ctx.lineTo(x + 66, y + h * (1 - this.fish) - 9); ctx.lineTo(x + 66, y + h * (1 - this.fish) + 9); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 100, y, 16, h); ctx.fillStyle = '#8dffa8'; ctx.fillRect(x + 100, y + h * (1 - this.prog), 16, h * this.prog);
      this.drawOver(ctx, W, H);
    }
  }

  // ================= 제한 시간 퍼즐 3개 =================
  // 9) 슬라이딩 퍼즐 3x3 (숫자를 순서대로)
  class Sliding extends Game {
    constructor(lv) {
      super(lv); this.title = '퍼즐! 슬라이딩'; this.hint = '빈칸 옆 타일을 눌러 1~8을 순서대로! (제한 시간!)'; this.tone = ['#2a2a4a', '#5a4a8a']; this.limit = 42 - 10 * lv;
      this.b = [1, 2, 3, 4, 5, 6, 7, 8, 0]; let e = 8;
      for (let i = 0; i < 70; i++) { const nb = this.nbrs(e).filter((q) => q !== this.last); const q = pick(nb); this.b[e] = this.b[q]; this.b[q] = 0; this.last = e; e = q; }
      this.e = e;
    }
    nbrs(e) { const r = Math.floor(e / 3), c = e % 3, o = []; if (r > 0) o.push(e - 3); if (r < 2) o.push(e + 3); if (c > 0) o.push(e - 1); if (c < 2) o.push(e + 1); return o; }
    move(i) { if (!this.nbrs(this.e).includes(i)) return; this.snd('clack'); this.b[this.e] = this.b[i]; this.b[i] = 0; this.e = i; if (this.b.every((v, k) => v === (k + 1) % 9)) this.win('완성!'); }
    step(dt, io) {
      const c = io.click; if (c) { const x = Math.floor((c.x - 330) / 100), y = Math.floor((c.y - 170) / 100); if (x >= 0 && x < 3 && y >= 0 && y < 3) this.move(y * 3 + x); }
      const r = Math.floor(this.e / 3), cc = this.e % 3;
      if (io.pressed('ArrowUp', 'KeyW') && r < 2) this.move(this.e + 3); if (io.pressed('ArrowDown', 'KeyS') && r > 0) this.move(this.e - 3);
      if (io.pressed('ArrowLeft', 'KeyA') && cc < 2) this.move(this.e + 1); if (io.pressed('ArrowRight', 'KeyD') && cc > 0) this.move(this.e - 1);
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      this.b.forEach((v, i) => { if (!v) return; const x = 330 + (i % 3) * 100, y = 170 + Math.floor(i / 3) * 100; ctx.fillStyle = v === (i + 1) ? '#7aff9a' : '#ffd070'; ctx.fillRect(x + 3, y + 3, 94, 94); text(ctx, String(v), x + 50, y + 50, 44, '#2a1a0a', 'center', null); });
      this.drawOver(ctx, W, H);
    }
  }
  // 10) 순서대로 누르기: 흩어진 숫자를 1부터 차례로 (틀린 것을 누르면 피 -1)
  class Order extends Game {
    constructor(lv) {
      super(lv); this.title = '퍼즐! 순서대로'; this.hint = '1부터 12까지 차례로 눌러라! 틀린 숫자를 누르면 피 -1'; this.tone = ['#2a1a2a', '#6a3a5a']; this.limit = 16 - 4 * lv;
      this.next = 1; this.cells = shuffle([...Array(12).keys()].map((k) => k + 1)); this.dead = {};
    }
    step(dt, io) {
      const c = io.click; if (!c) return;
      const x = Math.floor((c.x - 250) / 115), y = Math.floor((c.y - 170) / 105);
      if (x < 0 || x > 5 || y < 0 || y > 1) return;
      const n = this.cells[y * 6 + x];
      if (this.dead[n]) return;
      if (n === this.next) { this.dead[n] = true; this.next++; this.snd('tick'); this.snd('coin'); if (this.next > 12) this.win('빠르다!'); } else this.mistake(`${this.next}부터!`);
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      this.cells.forEach((n, i) => { const x = 250 + (i % 6) * 115, y = 170 + Math.floor(i / 6) * 105; ctx.fillStyle = this.dead[n] ? 'rgba(255,255,255,0.08)' : '#ffd070'; ctx.fillRect(x + 4, y + 4, 107, 97); if (!this.dead[n]) text(ctx, String(n), x + 58, y + 52, 46, '#2a1a0a', 'center', null); });
      text(ctx, `다음: ${Math.min(12, this.next)}`, W / 2, 440, 24);
      this.drawOver(ctx, W, H);
    }
  }

  // ================= 쇼 진행 =================
  const CLASSICS = { shell: Shell, target: Target, duel: Duel, gallery: Gallery, arrows: Arrows, smelt: Smelt, pump: Pump, fishing: Fishing };
  const PUZZLES = { sliding: Sliding, order: Order };
  const HOST_LINES_OLD = ['와아아! 시청자 여러분, 다음 코너입니다!', '채널 고정! 틀리면 피가 깎입니다~!', '박수 쳐 주세요! 아직 쓰러지지 않았군요!', '이번엔 빠르게 갑니다!', '자자, 눈 깜빡이면 지는 겁니다!', '쇼는 계속된다! 계속된다!!', '심장이 쫄깃~ 하시죠?', '여기서 광고… 는 없습니다!'];
  const HOST_LINES = ['멍! 다음 코너다!', '멍멍! 틀리면 피가 깎인다!', '아직 안 쓰러졌냐…? 멍!', '이번엔 더 빠르다, 멍!', '눈 깜빡이면 지는 거다! 멍멍!', '끝까지 살아남을 수 있을까, 멍?', '으르릉… 다음!', '30개를 다 깨야 날 쓰러뜨릴 수 있다, 멍!'];
  const STYLES = ['bars', 'curtain', 'zoom', 'static', 'confetti'];

  // 코너 순서: 빠른 놀이 8개는 모두 한 번씩 (보드게임과 번갈아), 보드게임은 몇 번씩 이어서, 가끔 3D 총게임과 퍼즐이 끼어든다
  function buildQueue() {
    const B = G.BoardGames ? Object.keys(G.BoardGames.GAMES) : [];
    const classics = shuffle(Object.keys(CLASSICS)), boards = shuffle(B).slice(0, 6), puz = shuffle(Object.keys(PUZZLES)).slice(0, 2);
    const q = [];
    let ci = 0, bi = 0;
    while (ci < classics.length || bi < boards.length) {
      for (let k = 0; k < 2 && ci < classics.length; k++) q.push({ kind: 'classic', id: classics[ci++] });
      const run = Math.min(boards.length - bi, rint(2, 3)); // 보드게임은 이어서: 이때 텐나처럼 휙휙 넘어간다
      for (let k = 0; k < run; k++) q.push({ kind: 'board', id: boards[bi++] });
      if (q.length === 5 && puz.length) q.push({ kind: 'puzzle', id: puz.shift() });
    }
    if (puz.length) q.splice(Math.floor(q.length * 0.7), 0, { kind: 'puzzle', id: puz.shift() });
    if (G.Fps3D) { // 가끔 3D 게임이 끼어든다: 네 가지 중 두 가지 (중반과 후반)
      const three = shuffle(Object.keys(G.Fps3D.GAMES));
      q.splice(Math.floor(q.length * 0.85), 0, { kind: 'fps', id: three[1] });
      q.splice(Math.floor(q.length * 0.45), 0, { kind: 'fps', id: three[0] });
    }
    // 30개가 될 때까지 뒤쪽에 더 얹는다 (점점 더 빠르고 어려운 후반): 같은 코너가 바로 이어지지 않게
    const pool = [];
    for (const id of Object.keys(CLASSICS)) pool.push({ kind: 'classic', id });
    for (const id of B) pool.push({ kind: 'board', id });
    for (const id of Object.keys(PUZZLES)) pool.push({ kind: 'puzzle', id });
    if (G.Fps3D) for (const id of Object.keys(G.Fps3D.GAMES)) pool.push({ kind: 'fps', id });
    while (q.length < 30) { const last = q[q.length - 1], c = pick(pool); if (!last || last.id !== c.id) q.push({ kind: c.kind, id: c.id }); }
    return q;
  }
  function makeGame(item, lv) {
    if (item.kind === 'classic') return new CLASSICS[item.id](lv);
    if (item.kind === 'puzzle') return new PUZZLES[item.id](lv);
    if (item.kind === 'board') return new G.BoardGames.GAMES[item.id](lv);
    return new G.Fps3D.GAMES[item.id](lv);
  }

  // 쇼를 연다. host = { hurt() -> 남은 피, lives(), sound(name), shake(m, d), done(win, info) }
  function create(host, opts) {
    opts = opts || {};
    const st = { host, queue: opts.practice ? [opts.practice] : buildQueue(), practice: !!opts.practice, idx: -1, game: null, phase: 'intro', t: 0, trans: null, banner: '', hostLine: '', hostT: 0, mistakes: 0, cleared: 0, audience: [], endT: 0, style: 'bars', flash: 0, shakeT: 0, win: null, opts: opts || {} };
    st.total = st.queue.length;
    st.hostLine = '멍! 용케 여기까지 찾아왔군. 쇼 타임이다!'; st.hostT = 3;
    if (opts.cutscene) { st.opts.cutscene = true; st.phase = 'dogdown'; st.t = 0; st.flash = 1; st.shakeT = 1.2; st.hostLine = ''; st.hostT = 0; for (const s of ['crit', 'boom', 'shatter']) host.sound(s); }
    if (st.practice) { st.hostLine = '연습 코너! 틀려도 피는 깎이지 않는다, 멍'; st.nextRoundPending = true; }
    return st;
  }
  // 관리자: 개를 쓰러뜨리는 순간부터 엔딩까지의 컷신만 본다 (쇼를 하지 않는다)
  function createCutscene(host) { const st = create(host, { firstEnding: true, cutscene: true }); return st; }
  function nextRound(st) {
    st.idx++;
    if (st.idx >= st.queue.length) { st.phase = 'finale'; st.t = 0; st.host.sound('drum'); st.host.sound('whoosh'); st.hostLine = '으르르릉… 마지막이다! 엔터를 눌러 날 쓰러뜨려 봐라!'; st.hostT = 99; return; }
    const item = st.queue[st.idx], lv = st.practice ? 0.6 : 0.3 + 0.9 * (st.idx / Math.max(1, st.queue.length - 1)); // 처음부터 빠르고, 갈수록 더 빠르고 어렵다 (0.3 ~ 1.2)
    const prev = st.queue[st.idx - 1];
    st.game = makeGame(item, lv);
    const bb = item.kind === 'board' && prev && prev.kind === 'board';
    st.style = bb ? 'tenna' : pick(STYLES);       // 보드게임에서 보드게임으로 넘어갈 땐 텐나식으로 휙!
    st.trans = { t: 0, dur: bb ? 1.3 : 0.95, style: st.style, hue: rint(0, 359), title: st.game.title, hint: st.game.hint, n: st.idx + 1, kind: item.kind };
    st.phase = 'trans'; st.t = 0;
    st.hostLine = pick(HOST_LINES); st.hostT = 2.5;
    st.host.sound('whoosh'); st.host.sound(bb ? 'drum' : 'bell'); st.host.shake(bb ? 10 : 6, 0.4); st.flash = 0.6;
  }
  function update(st, io, dt) {
    st.t += dt; st.hostT = Math.max(0, st.hostT - dt); st.flash = Math.max(0, st.flash - dt * 2.4);
    for (const a of st.audience) a.t += dt;
    st.audience = st.audience.filter((a) => a.t < 1.4);
    if (io.pressed('Escape')) { st.host.done(false, { quit: true, cleared: st.cleared, practice: st.practice, cutscene: !!st.opts.cutscene }); return; }
    if (st.practice && st.phase === 'intro') { nextRound(st); return; } // 연습은 소개 없이 바로 시작
    if (st.phase === 'intro') { if (st.t > 2.6 || io.pressed('Enter', 'Space', 'NumpadEnter') || io.click) nextRound(st); return; }
    if (st.phase === 'trans') {
      st.trans.t += dt;
      if (st.trans.t >= st.trans.dur) { st.phase = 'play'; st.t = 0; }
      return;
    }
    if (st.phase === 'play') {
      const g = st.game;
      g.update(dt, io);
      if (g.sounds && g.sounds.length) { for (const s of g.sounds.slice(0, 4)) st.host.sound(s); g.sounds = []; }
      while (g.pending > 0) { // 하나 틀릴 때마다 피 한 칸 (쿨타임·무적과 상관없이)
        g.pending--; st.mistakes++;
        if (st.practice) { st.flash = 0.25; st.host.sound('deny'); continue; } // 연습: 피는 깎이지 않는다
        st.flash = 0.9; st.shakeT = 0.4;
        st.host.sound('hurt'); st.host.shake(8, 0.3);
        const left = st.host.hurt();
        st.audience.push({ t: 0, s: pick(['으아…', '아이고!', '엌!', '아야!']), x: rnd(80, 880) });
        if (left <= 0) { st.phase = 'end'; st.t = 0; st.win = false; st.hostLine = '크크, 탈락이다! 멍멍!'; st.hostT = 4; g.pending = 0; return; }
      }
      if (g.result) { st.phase = 'after'; st.t = 0; st.host.sound(g.result === 'win' ? 'cheer' : 'deny'); if (g.result === 'win') { st.cleared++; if (st.cleared % 4 === 0 && st.host.heal) { st.host.heal(); st.hostLine = '쳇… 응원이라니. 피가 한 칸 찼다, 멍!'; st.hostT = 2.5; } st.audience.push({ t: 0, s: pick(['와아!', '짝짝짝!', '굿!', '멋져!']), x: rnd(80, 880) }); } }
      return;
    }
    if (st.phase === 'after') { st.game.update(dt, io); if (st.game.sounds) st.game.sounds = []; if (st.t > (st.game.result === 'win' ? 0.7 : 1.0)) { if (st.practice) { st.phase = 'again'; st.t = 0; } else nextRound(st); } return; }
    if (st.phase === 'again') { st.game.update(dt, io); if (st.t > 0.4 && (io.pressed('Enter', 'Space', 'NumpadEnter') || io.click)) { st.idx = -1; st.cleared = 0; nextRound(st); } return; }
    if (st.phase === 'finale') { // 30개를 모두 깼다: 엔터 한 번으로 개를 쓰러뜨린다
      if (st.t > 0.8 && io.pressed('Enter', 'NumpadEnter')) { st.phase = 'dogdown'; st.t = 0; st.flash = 1; st.shakeT = 1.2; for (const s of ['crit', 'boom', 'shatter']) st.host.sound(s); st.host.shake(16, 0.8); st.hostLine = '크…으… 멍…'; st.hostT = 3; }
      return;
    }
    if (st.phase === 'dogdown') {
      if (st.t > 3.2) { if (st.opts.firstEnding) { st.phase = 'ending'; st.t = 0; st.line = 0; st.lineT = 0; st.host.sound('fanfare'); } else { st.phase = 'end'; st.t = 0; st.win = true; st.host.sound('cheer'); st.host.sound('fanfare'); st.hostLine = '졌다… 멍. 네가 이겼다.'; st.hostT = 5; } }
      return;
    }
    if (st.phase === 'ending') { // 엔딩: 한 줄씩 나온다 (Enter로 넘긴다)
      st.lineT += dt;
      if ((st.lineT > 3.4 || (st.lineT > 0.5 && io.pressed('Enter', 'NumpadEnter', 'Space') || (st.lineT > 0.5 && io.click))) && st.line < END_LINES.length - 1) { st.line++; st.lineT = 0; st.host.sound(st.line === LAST_TITLE ? 'treasure' : st.line === 2 ? 'whoosh' : 'bell'); }
      else if (st.line >= END_LINES.length - 1 && st.lineT > 2 && (io.pressed('Enter', 'NumpadEnter', 'Space') || io.click)) { st.host.done(true, { cleared: st.cleared, mistakes: st.mistakes, ending: true, cutscene: !!st.opts.cutscene }); }
      return;
    }
    if (st.phase === 'end') { if (st.t > 1.5 && (io.pressed('Enter', 'Space', 'NumpadEnter') || io.click)) st.host.done(st.win, { cleared: st.cleared, mistakes: st.mistakes }); }
  }

  const END_LINES = ['개는 쓰러졌다.', '…멍.', '쓰러진 개의 등에서 검은 망토가 스르르 벗겨져 바닥에 떨어졌다.', '낯익은 망토다. 군단 요새 문 앞에서 용사를 차원문으로 던져 버린, 그 의문의 사람의 망토…', '그랬다. 처음부터 그 검은 망토의 정체는 이 강아지였다.', '개: …멍. (개는 희미하게 웃는 것 같았다)', '방사능 공장의 불빛이 하나둘 꺼져 간다.', '용사는 동굴에서 시작해 마을과 왕국, 바다와 하수구를 지나 여기까지 왔다.', '더 이상 용사를 죽이려는 쇼는 없다.', '— THE END —', '플레이해 주셔서 감사합니다!'];
  const LAST_TITLE = END_LINES.length - 2; // THE END

  // ---------- 전환 연출 (텐나 쇼처럼 정신없이) ----------
  function drawTransition(ctx, W, H, tr) {
    const u = Math.min(1, tr.t / tr.dur), c = (a, l) => `hsla(${tr.hue},90%,${l || 55}%,${a})`;
    ctx.save();
    const cover = u < 0.5 ? u * 2 : (1 - u) * 2; // 0 -> 1 -> 0: 화면을 덮었다가 걷힌다
    if (tr.style === 'bars') {
      const n = 12; for (let i = 0; i < n; i++) { const hh = H * cover; const up = i % 2 ? 1 : -1; ctx.fillStyle = c(1, 35 + (i % 4) * 8); ctx.fillRect(i * (W / n), up > 0 ? 0 : H - hh, W / n + 1, hh); }
    } else if (tr.style === 'curtain') {
      ctx.fillStyle = '#a01830'; ctx.fillRect(0, 0, (W / 2) * cover, H); ctx.fillRect(W - (W / 2) * cover, 0, (W / 2) * cover, H);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 14; k++) { ctx.fillRect(k * (W / 28), 0, 4, H); }
    } else if (tr.style === 'zoom') {
      ctx.translate(W / 2, H / 2); ctx.rotate(u * 7);
      for (let k = 10; k >= 1; k--) { const s = (k / 10) * Math.max(0.01, cover) * 1.7; ctx.fillStyle = k % 2 ? c(1, 40) : c(1, 70); ctx.fillRect(-W * s / 2, -H * s / 2, W * s, H * s); }
    } else if (tr.style === 'static') {
      ctx.fillStyle = `rgba(20,20,30,${Math.min(1, cover * 1.6)})`; ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 6) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 * cover})`; ctx.fillRect(Math.random() * 40, y, W, 3); }
      const cols = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f']; cols.forEach((cc, i) => { ctx.fillStyle = cc; ctx.globalAlpha = cover * 0.9; ctx.fillRect(i * (W / 7), H * 0.3, W / 7, H * 0.4); }); ctx.globalAlpha = 1;
    } else if (tr.style === 'tenna') { // 보드게임에서 보드게임으로: 스포트라이트, 별 폭발, 흔들리는 막대와 색 번쩍임
      ctx.fillStyle = `hsla(${(tr.t * 600) % 360},95%,50%,${cover * 0.9})`; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + tr.t * 4; ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(255,230,60,0.9)'; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * W); ctx.lineTo(W / 2 + Math.cos(a + 0.12) * W, H / 2 + Math.sin(a + 0.12) * W); ctx.closePath(); ctx.globalAlpha = cover; ctx.fill(); }
      ctx.globalAlpha = 1;
      for (let k = 0; k < 24; k++) { const x = (k * 137 + tr.t * 700) % W; ctx.fillStyle = `hsla(${k * 40},90%,60%,${cover})`; ctx.fillRect(x, (k * 53) % H, 14, 14); }
    } else { // confetti
      ctx.fillStyle = c(cover, 25); ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 70; k++) { const x = (k * 97) % W, y = ((k * 61 + tr.t * 600) % (H + 40)) - 20; ctx.fillStyle = `hsla(${k * 31},90%,60%,${cover})`; ctx.fillRect(x, y, 10, 6); }
    }
    ctx.restore();
    // 가운데 제목 카드 (화면이 가장 덮였을 때 가장 크게)
    const pop = Math.sin(Math.min(1, u * 1.6) * Math.PI);
    if (pop > 0.02) {
      ctx.save(); ctx.translate(W / 2, H / 2); const s = 0.4 + pop * 0.8; ctx.scale(s, s); ctx.rotate(Math.sin(tr.t * 18) * 0.04 * (tr.style === 'tenna' ? 3 : 1));
      text(ctx, `${tr.n}번째 코너!`, 0, -70, 30, '#ffe34a');
      text(ctx, tr.title, 0, -10, 64, '#ffffff');
      text(ctx, tr.hint, 0, 56, 22, '#bfe8ff');
      text(ctx, '틀리면 피가 한 칸 깎인다!', 0, 96, 22, '#ff8a8a');
      ctx.restore();
    }
  }

  function drawRaw(ctx, st, W, H, flush) {
    ctx.save();
    if (st.shakeT > 0) { st.shakeT -= 0.016; ctx.translate(rnd(-5, 5), rnd(-5, 5)); }
    if (st.phase === 'intro') {
      ctx.fillStyle = '#10101c'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2 + st.t; ctx.fillStyle = k % 2 ? 'rgba(255,230,120,0.06)' : 'rgba(120,200,255,0.06)'; ctx.beginPath(); ctx.moveTo(W / 2, -40); ctx.lineTo(W / 2 + Math.cos(a) * W, Math.sin(a) * W); ctx.lineTo(W / 2 + Math.cos(a + 0.13) * W, Math.sin(a + 0.13) * W); ctx.closePath(); ctx.fill(); }
      drawDog(ctx, W / 2 + 10, 470, 2.6, 'angry', st.t);
      text(ctx, '★ 개의 죽음의 게임쇼 ★', W / 2, 90, 54, '#ffe34a');
      text(ctx, `${st.total}개의 코너 · 틀리면 피 -1 (쿨타임 없음)`, W / 2, 160, 26, '#bfe8ff');
      text(ctx, '야바위 · 표적 · 결투 · 총게임 · 방향키 · 제련 · 풀무질 · 낚시 · 오목·사목 등 보드게임 · 3D 게임 · 퍼즐', W / 2, 205, 16, '#ffffff');
      text(ctx, 'Enter 또는 클릭: 시작 · Esc: 포기', W / 2, 520, 18, '#aaa');
    } else if (st.phase === 'finale' || st.phase === 'dogdown') {
      const dd = st.phase === 'dogdown', k = dd ? Math.min(1, st.t / 1.2) : 0;
      ctx.fillStyle = dd ? '#1a1a22' : `rgb(${40 + Math.round(30 * Math.sin(st.t * 6) ** 2)},8,12)`; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + st.t * 0.6; ctx.fillStyle = dd ? 'rgba(255,255,255,0.05)' : 'rgba(255,60,60,0.10)'; ctx.beginPath(); ctx.moveTo(W / 2, 330); ctx.lineTo(W / 2 + Math.cos(a) * W, 330 + Math.sin(a) * W); ctx.lineTo(W / 2 + Math.cos(a + 0.12) * W, 330 + Math.sin(a + 0.12) * W); ctx.closePath(); ctx.fill(); }
      if (dd) { ctx.save(); ctx.translate(W / 2, 450); drawDog(ctx, 0, 40 * (1 - k) * -1, 3.0 - k * 0.6, k < 0.6 ? 'angry' : 'down', st.t); ctx.restore(); if (st.t < 1.4) for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,${200 - i * 10},60,${1 - st.t / 1.4})`; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(i * 0.52) * st.t * 260, 360 + Math.sin(i * 0.52) * st.t * 200, 10, 0, Math.PI * 2); ctx.fill(); } text(ctx, st.t < 1.4 ? '쾅!!!' : '쓰러졌다…', W / 2, 130, 70, '#ffe34a'); }
      else { drawDog(ctx, W / 2 + 10, 470, 3.0, 'angry', st.t); text(ctx, '30개를 모두 깼다!', W / 2, 90, 44, '#ffe34a'); text(ctx, '마지막이다. 엔터를 눌러 개를 쓰러뜨려라!', W / 2, 150, 28, '#fff'); if (st.t > 0.8 && Math.floor(st.t * 3) % 2 === 0) text(ctx, '[ ENTER ]', W / 2, 230, 56, '#ff8a8a'); }
    } else if (st.phase === 'ending') {
      ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.2 * Math.sin(st.t * 2 + i)})`; ctx.fillRect((i * 97) % W, (i * 53 + st.t * 12) % H, 2, 2); }
      const last = st.line >= END_LINES.length - 1, a = Math.min(1, st.lineT * 1.6);
      if (st.line >= 2 && st.line <= 5) { // 정체 공개 장면: 쓰러진 개와 벗겨진 검은 망토
        ctx.globalAlpha = Math.min(1, (st.line === 2 ? st.lineT * 0.8 : 1)); drawDog(ctx, W / 2 + 40, 470, 2.4, 'down', st.t, true);
        if (st.line >= 4) { const g = ctx.createRadialGradient(W / 2 - 120, 420, 4, W / 2 - 120, 420, 120); g.addColorStop(0, `rgba(190,140,255,${0.25 + 0.15 * Math.sin(st.t * 3)})`); g.addColorStop(1, 'rgba(190,140,255,0)'); ctx.fillStyle = g; ctx.fillRect(W / 2 - 260, 300, 280, 240); }
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = a; text(ctx, END_LINES[st.line], W / 2, st.line >= 2 && st.line <= 5 ? 150 : 270, st.line === LAST_TITLE ? 64 : 26, st.line === LAST_TITLE ? '#ffe34a' : '#ffffff'); ctx.globalAlpha = 1;
      if (last && st.lineT > 2) text(ctx, 'Enter: 이어서 하기', W / 2, 480, 20, '#bbb'); else text(ctx, 'Enter: 다음', W - 80, 540, 14, '#666');
    } else if (st.phase === 'end') {
      ctx.fillStyle = st.win ? '#1a2a1a' : '#2a1a1a'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 60; k++) { const x = (k * 97 + st.t * 120) % W, y = (k * 53 + st.t * (st.win ? 160 : 40)) % H; ctx.fillStyle = st.win ? `hsl(${k * 29},90%,60%)` : '#555'; ctx.fillRect(x, y, 10, 6); }
      text(ctx, st.win ? '우 승 !' : '탈 락…', W / 2, 190, 96, st.win ? '#ffe34a' : '#ff8a8a');
      text(ctx, `성공한 코너 ${st.cleared}/${st.total} · 틀린 횟수 ${st.mistakes}`, W / 2, 300, 28, '#fff');
      if (st.t > 1.5) text(ctx, 'Enter 또는 클릭', W / 2, 450, 20, '#bbb');
    } else if (st.game) {
      st.game.draw(ctx, W, H);
      // 위쪽 쇼 틀: 코너 번호, 남은 피, 진행
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 64);
      text(ctx, `코너 ${st.idx + 1}/${st.total}`, 90, 22, 20, '#ffe34a');
      text(ctx, st.game.title, W / 2, 22, 26, '#fff');
      const lv = st.host.lives(), mx = st.host.maxLives();
      if (st.practice) text(ctx, '연습 모드 (Esc: 나가기)', W - 130, 24, 16, '#8dffa8');
      else for (let i = 0; i < mx; i++) { ctx.fillStyle = i < lv ? '#ff4a6a' : '#442'; ctx.beginPath(); ctx.arc(W - 40 - i * 24, 24, 9, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(20, 46, W - 40, 8); ctx.fillStyle = '#ffe34a'; ctx.fillRect(20, 46, (W - 40) * (st.idx + (st.game.result ? 1 : 0)) / st.total, 8);
      text(ctx, st.game.hint, W / 2, 78, 14, '#cfe', 'center');
      flush();
      if (st.phase === 'trans') { drawTransition(ctx, W, H, st.trans); flush(); }
      if (st.phase === 'again') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 230, W, 120); text(ctx, st.game.result === 'win' ? '성공!' : '실패…', W / 2, 270, 40, st.game.result === 'win' ? '#8dffa8' : '#ff8a8a'); text(ctx, 'Enter/클릭: 다시 하기 · Esc: 나가기', W / 2, 322, 20, '#fff'); }
    }
    // 해설과 관객
    flush();
    if (!st.practice && st.game && st.phase !== 'intro' && st.phase !== 'end' && st.phase !== 'finale' && st.phase !== 'dogdown' && st.phase !== 'ending') drawDog(ctx, 48, H - 62, 0.55, st.flash > 0.3 ? 'angry' : 'idle', st.t);
    if (st.hostT > 0 && st.phase !== 'end') { ctx.globalAlpha = Math.min(1, st.hostT * 2); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(40, H - 56, W - 80, 36); text(ctx, `개: ${st.hostLine}`, W / 2, H - 38, 16, '#ffe9a0'); ctx.globalAlpha = 1; }
    for (const a of st.audience) { ctx.globalAlpha = Math.max(0, 1 - a.t / 1.4); text(ctx, a.s, a.x, H - 90 - a.t * 40, 20, '#fff'); ctx.globalAlpha = 1; }
    if (st.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, st.flash * 0.7)})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  // 게임 본편처럼 도트 느낌으로: 반 해상도 버퍼에 그린 뒤 2배로 (보간 없이) 키운다. 글자만 또렷하게 위에 얹는다. PIXEL = false면 매끄럽게
  const PXS = 2;
  let pbuf = null;
  function draw(ctx, st, W, H) {
    if (!G.GameShow.PIXEL) { drawRaw(ctx, st, W, H, () => {}); return; }
    const bw = Math.round(W / PXS), bh = Math.round(H / PXS);
    if (!pbuf) pbuf = document.createElement('canvas');
    if (pbuf.width !== bw || pbuf.height !== bh) { pbuf.width = bw; pbuf.height = bh; }
    const b = pbuf.getContext('2d');
    const reset = () => { b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, bw, bh); b.setTransform(1 / PXS, 0, 0, 1 / PXS, 0, 0); b.imageSmoothingEnabled = false; b.__defer = []; };
    const flush = () => { // 지금까지 그린 것을 화면에 얹고 버퍼를 비운다 (층 순서를 지키려고 여러 번 부른다)
      const base = ctx.getTransform();
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(pbuf, 0, 0, W, H); ctx.restore();
      for (const d of b.__defer) { ctx.save(); ctx.setTransform(base.multiply(new DOMMatrix([PXS, 0, 0, PXS, 0, 0]).multiply(d.m))); ctx.globalAlpha = d.a; textNow(ctx, ...d.args); ctx.restore(); }
      reset();
    };
    reset();
    drawRaw(b, st, W, H, flush);
    flush();
  }
  G.GameShow = { PIXEL: true, drawDog, createCutscene, create, update, draw, Game, text, inBox, rnd, rint, pick, clamp, shuffle, CLASSICS, PUZZLES };
})(window.Game);
