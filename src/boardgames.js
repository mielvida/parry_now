// 게임쇼의 보드게임 6개 (누구나 아는 것만): 오목, 사목, 틱택토, 점 잇기, 체커, 전함.
// 모두 컴퓨터와 한 판. 내가 먼저 둔다. 이기거나 비기면 통과, 지면 피 -1 (제한 시간 안에 못 두면 그것도 틀린 것으로 치고 대신 아무 데나 둔다).
// 코너 공통 틀(gameshow.js의 Game)을 쓴다: step/draw, result, mistake.
(function (G) {
  const GS = G.GameShow;
  const { text, rnd, rint, pick, clamp, shuffle } = GS;

  class Board extends GS.Game {
    constructor(lv, name, hint) {
      super(lv);
      this.title = name; this.hint = hint; this.tone = ['#1a2a1a', '#3a5a3a'];
      this.turn = 'p'; this.aiWait = 0; this.moveLimit = 12; this.moveT = 0; this.over = false; this.lastMsg = '';
      this.hardness = Math.min(1.1, 0.78 + 0.3 * lv); // 컴퓨터가 얼마나 제대로 두는가 (쇼가 진행될수록 더 제대로 둔다)
    }
    // 내가 두었다: 컴퓨터 차례로
    toAi(wait) { if (!this.noStone) this.snd('stone'); this.turn = 'a'; this.aiWait = wait === undefined ? 0.45 : wait; this.moveT = 0; }
    toPlayer() { if (!this.noStone) this.snd('stone'); this.turn = 'p'; this.moveT = 0; }
    limitNow() { return this.moveLimit * 0.8; } // 한 수에 쓸 수 있는 시간 (쇼는 빠르다)
    // 끝: res = 'win' | 'draw' | 'lose' (비기면 통과)
    finish(res, msg) {
      this.over = true; this.turn = 'x';
      if (res === 'lose') { this.mistake(msg || '졌다!'); this.lose(); } else this.win(msg || (res === 'draw' ? '비겼다 (통과)' : '이겼다!'));
    }
    step(dt, io) {
      if (this.over) return;
      if (this.turn === 'p') {
        this.moveT += dt;
        if (this.moveT > this.limitNow()) { this.mistake('시간 초과! 대신 둔다'); this.autoMove(); return; }
        const c = io.click; if (c) this.playerClick(c, io);
        if (io.mouse) this.hover = io.mouse;
        this.keys(io);
      } else if (this.turn === 'a') {
        this.aiWait -= dt;
        if (this.aiWait <= 0) this.aiMove();
      }
    }
    keys() {}
    status() { return this.turn === 'p' ? '내 차례' : this.turn === 'a' ? '상대 생각 중…' : ''; }
    drawBar(ctx, W, H) {
      if (this.turn === 'p') { const u = 1 - this.moveT / this.limitNow(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 120, 96, 240, 8); ctx.fillStyle = u > 0.3 ? '#8dffa8' : '#ff6a6a'; ctx.fillRect(W / 2 - 119, 97, 238 * Math.max(0, u), 6); }
      text(ctx, this.status(), W / 2, 118, 18, this.turn === 'p' ? '#8dffa8' : '#ffd070');
    }
    draw(ctx, W, H) { this.drawBase(ctx, W, H); this.drawBoard(ctx, W, H); this.drawBar(ctx, W, H); this.drawOver(ctx, W, H); }
  }

  // ---------- 1. 오목 (9x9, 다섯 줄) ----------
  class Omok extends Board {
    constructor(lv) { super(lv, '오목!', '가로·세로·대각선으로 다섯 개를 먼저 이어라'); this.N = 9; this.b = Array.from({ length: 9 }, () => Array(9).fill(0)); this.last = null; this.moveLimit = 10; }
    inb(r, c) { return r >= 0 && r < this.N && c >= 0 && c < this.N; }
    five(r, c, v) { for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let n = 1; for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (this.inb(rr, cc) && this.b[rr][cc] === v) { n++; rr += dr * s; cc += dc * s; } } if (n >= 5) return true; } return false; }
    place(r, c, v) { this.b[r][c] = v; this.last = [r, c]; return this.five(r, c, v); }
    full() { return this.b.every((row) => row.every((x) => x)); }
    playerClick(p) { const c = Math.round((p.x - 304) / 44), r = Math.round((p.y - 140) / 44); if (!this.inb(r, c) || this.b[r][c]) return; this.playerPlace(r, c); }
    playerPlace(r, c) { if (this.place(r, c, 1)) return this.finish('win', '오목 완성!'); if (this.full()) return this.finish('draw'); this.toAi(); }
    autoMove() { const e = []; for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!this.b[r][c]) e.push([r, c]); const [r, c] = pick(e); this.playerPlace(r, c); }
    score(r, c, v) { // 여기에 v를 두면 얼마나 좋은가 (줄 길이와 열린 끝)
      let tot = 0;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let n = 1, open = 0;
        for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (this.inb(rr, cc) && this.b[rr][cc] === v) { n++; rr += dr * s; cc += dc * s; } if (this.inb(rr, cc) && !this.b[rr][cc]) open++; }
        tot += n >= 5 ? 100000 : n === 4 ? (open === 2 ? 10000 : open === 1 ? 1200 : 0) : n === 3 ? (open === 2 ? 900 : open === 1 ? 90 : 0) : n === 2 ? (open === 2 ? 60 : open === 1 ? 8 : 0) : 1;
      }
      return tot;
    }
    aiMove() {
      let best = -1, bm = null;
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        if (this.b[r][c]) continue;
        const near = (this.last ? 6 - Math.hypot(r - this.last[0], c - this.last[1]) : 0) + (4 - Math.hypot(r - 4, c - 4)) * 0.3;
        const s = this.score(r, c, 2) * (1 + 0.1 * this.hardness) + this.score(r, c, 1) * 0.95 + near + Math.random() * 6 * (1.3 - this.hardness);
        if (s > best) { best = s; bm = [r, c]; }
      }
      if (Math.random() > this.hardness + 0.25) { const e = []; for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!this.b[r][c]) e.push([r, c]); bm = pick(e); } // 가끔 헛둔다
      if (this.place(bm[0], bm[1], 2)) return this.finish('lose', '상대가 오목을 완성했다!');
      if (this.full()) return this.finish('draw');
      this.toPlayer();
    }
    drawBoard(ctx) {
      ctx.fillStyle = '#d8aa5a'; ctx.fillRect(268, 104 + 36, 424 + 0, 424); ctx.strokeStyle = '#6a4a1a'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(304, 140 + i * 44); ctx.lineTo(304 + 352, 140 + i * 44); ctx.moveTo(304 + i * 44, 140); ctx.lineTo(304 + i * 44, 140 + 352); ctx.stroke(); }
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const v = this.b[r][c]; if (!v) continue; ctx.fillStyle = v === 1 ? '#161616' : '#f4f4f4'; ctx.beginPath(); ctx.arc(304 + c * 44, 140 + r * 44, 18, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); if (this.last && this.last[0] === r && this.last[1] === c) { ctx.fillStyle = '#ff4a4a'; ctx.fillRect(304 + c * 44 - 3, 140 + r * 44 - 3, 6, 6); } }
      if (this.turn === 'p' && this.hover) { const c = Math.round((this.hover.x - 304) / 44), r = Math.round((this.hover.y - 140) / 44); if (this.inb(r, c) && !this.b[r][c]) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(304 + c * 44, 140 + r * 44, 16, 0, Math.PI * 2); ctx.fill(); } }
    }
  }

  // ---------- 2. 사목 (7x6, 네 개 이어 떨어뜨리기) ----------
  class Connect4 extends Board {
    constructor(lv) { super(lv, '사목!', '가로·세로·대각선으로 네 개를 먼저 이어라 (열을 눌러 떨어뜨린다)'); this.W = 7; this.Hh = 6; this.b = Array.from({ length: 6 }, () => Array(7).fill(0)); this.moveLimit = 8; this.cur = 3; }
    drop(b, c, v) { for (let r = 5; r >= 0; r--) if (!b[r][c]) { b[r][c] = v; return r; } return -1; }
    win4(b, v) { for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let ok = true; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr][cc] !== v) { ok = false; break; } } if (ok) return true; } return false; }
    evalB(b) { let s = 0; for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let a = 0, p = 0, e = 0; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6) { a = -9; break; } const x = b[rr][cc]; if (x === 2) a++; else if (x === 1) p++; else e++; } if (a < 0) continue; if (a && !p) s += [0, 1, 6, 40, 0][a]; if (p && !a) s -= [0, 1, 6, 50, 0][p]; } for (let r = 0; r < 6; r++) if (b[r][3] === 2) s += 3; return s; }
    mm(b, d, al, be, mx) {
      if (this.win4(b, 2)) return 100000 + d; if (this.win4(b, 1)) return -100000 - d;
      const cols = [3, 2, 4, 1, 5, 0, 6].filter((c) => !b[0][c]); if (!cols.length) return 0; if (d === 0) return this.evalB(b);
      let best = mx ? -1e9 : 1e9;
      for (const c of cols) { const nb = b.map((r) => r.slice()); this.drop(nb, c, mx ? 2 : 1); const s = this.mm(nb, d - 1, al, be, !mx); if (mx) { best = Math.max(best, s); al = Math.max(al, s); } else { best = Math.min(best, s); be = Math.min(be, s); } if (al >= be) break; }
      return best;
    }
    playCol(c) { if (c < 0 || c > 6 || this.b[0][c]) return false; this.drop(this.b, c, 1); if (this.win4(this.b, 1)) { this.finish('win', '네 개 완성!'); return true; } if (this.b[0].every((x) => x)) { this.finish('draw'); return true; } this.toAi(); return true; }
    playerClick(p) { this.playCol(Math.floor((p.x - 284) / 56)); }
    keys(io) { if (io.pressed('ArrowLeft', 'KeyA')) this.cur = Math.max(0, this.cur - 1); if (io.pressed('ArrowRight', 'KeyD')) this.cur = Math.min(6, this.cur + 1); if (io.pressed('Enter', 'Space', 'NumpadEnter', 'ArrowDown')) this.playCol(this.cur); }
    autoMove() { const cols = [0, 1, 2, 3, 4, 5, 6].filter((c) => !this.b[0][c]); this.playCol(pick(cols)); }
    aiMove() {
      const cols = [0, 1, 2, 3, 4, 5, 6].filter((c) => !this.b[0][c]);
      let bc = pick(cols);
      if (Math.random() < this.hardness + 0.1) { let best = -1e9; for (const c of shuffle(cols)) { const nb = this.b.map((r) => r.slice()); this.drop(nb, c, 2); const s = this.mm(nb, 3, -1e9, 1e9, false) + Math.random() * 2; if (s > best) { best = s; bc = c; } } }
      this.drop(this.b, bc, 2);
      if (this.win4(this.b, 2)) return this.finish('lose', '상대가 네 개를 이었다!');
      if (this.b[0].every((x) => x)) return this.finish('draw');
      this.toPlayer();
    }
    drawBoard(ctx) {
      ctx.fillStyle = '#1f4aa8'; ctx.fillRect(268, 132, 424, 352);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const v = this.b[r][c]; ctx.fillStyle = v === 1 ? '#ff4a4a' : v === 2 ? '#ffe34a' : '#0e1a3a'; ctx.beginPath(); ctx.arc(284 + c * 56 + 28, 140 + r * 56 + 28, 22, 0, Math.PI * 2); ctx.fill(); }
      if (this.turn === 'p') { ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.moveTo(284 + this.cur * 56 + 28, 128); ctx.lineTo(284 + this.cur * 56 + 14, 112); ctx.lineTo(284 + this.cur * 56 + 42, 112); ctx.closePath(); ctx.fill(); }
    }
  }

  // ---------- 3. 틱택토 (3x3, 컴퓨터는 빈틈없다 — 비기면 통과) ----------
  class TicTacToe extends Board {
    constructor(lv) { super(lv, '틱택토!', '세 개를 한 줄로! 컴퓨터는 거의 완벽하다. 비기면 통과'); this.b = Array(9).fill(0); this.moveLimit = 7; }
    lines() { return [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]; }
    winner(b) { for (const [x, y, z] of this.lines()) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x]; return b.every((v) => v) ? 3 : 0; }
    mm(b, v) { const w = this.winner(b); if (w === 2) return 1; if (w === 1) return -1; if (w === 3) return 0; let best = v === 2 ? -2 : 2; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = v; const s = this.mm(b, 3 - v); b[i] = 0; best = v === 2 ? Math.max(best, s) : Math.min(best, s); } return best; }
    end() { const w = this.winner(this.b); if (!w) return false; this.finish(w === 1 ? 'win' : w === 3 ? 'draw' : 'lose', w === 3 ? '비겼다 (통과)' : w === 1 ? '이겼다!' : '졌다!'); return true; }
    put(i) { if (this.b[i]) return; this.b[i] = 1; if (!this.end()) this.toAi(0.4); }
    playerClick(p) { const c = Math.floor((p.x - 315) / 110), r = Math.floor((p.y - 160) / 110); if (r < 0 || r > 2 || c < 0 || c > 2) return; this.put(r * 3 + c); }
    autoMove() { this.put(pick([...Array(9).keys()].filter((i) => !this.b[i]))); }
    aiMove() { let best = -3, bi = -1; const em = shuffle([...Array(9).keys()].filter((i) => !this.b[i])); for (const i of em) { this.b[i] = 2; const s = this.mm(this.b, 1); this.b[i] = 0; if (s > best) { best = s; bi = i; } } if (Math.random() > this.hardness + 0.35) bi = pick(em); this.b[bi] = 2; if (!this.end()) this.toPlayer(); }
    drawBoard(ctx) { ctx.strokeStyle = '#e8f4e8'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(315 + i * 110, 165); ctx.lineTo(315 + i * 110, 485); ctx.moveTo(320, 160 + i * 110); ctx.lineTo(640, 160 + i * 110); ctx.stroke(); } for (let i = 0; i < 9; i++) { const x = 315 + (i % 3) * 110 + 55, y = 160 + Math.floor(i / 3) * 110 + 55; if (this.b[i] === 1) { ctx.strokeStyle = '#ff6a6a'; ctx.beginPath(); ctx.moveTo(x - 28, y - 28); ctx.lineTo(x + 28, y + 28); ctx.moveTo(x + 28, y - 28); ctx.lineTo(x - 28, y + 28); ctx.stroke(); } else if (this.b[i] === 2) { ctx.strokeStyle = '#6ac0ff'; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke(); } } ctx.lineCap = 'butt'; }
  }

  // ---------- 4. 점 잇기 (상자 따먹기, 3x3 상자) ----------
  class Dots extends Board {
    constructor(lv) { super(lv, '점 잇기!', '점 사이 선을 눌러라. 상자의 네 번째 선을 이으면 내 상자! (한 번 더)'); this.h = Array.from({ length: 4 }, () => Array(3).fill(0)); this.v = Array.from({ length: 3 }, () => Array(4).fill(0)); this.box = Array.from({ length: 3 }, () => Array(3).fill(0)); this.moveLimit = 10; this.sc = [0, 0, 0]; }
    sides(r, c) { return (this.h[r][c] ? 1 : 0) + (this.h[r + 1][c] ? 1 : 0) + (this.v[r][c] ? 1 : 0) + (this.v[r][c + 1] ? 1 : 0); }
    edges() { const e = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) if (!this.h[r][c]) e.push(['h', r, c]); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (!this.v[r][c]) e.push(['v', r, c]); return e; }
    line(e, who) { if (e[0] === 'h') this.h[e[1]][e[2]] = who; else this.v[e[1]][e[2]] = who; let got = 0; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!this.box[r][c] && this.sides(r, c) === 4) { this.box[r][c] = who; this.sc[who]++; got++; } return got; }
    boxesOf(e) { const o = []; if (e[0] === 'h') { if (e[1] > 0) o.push([e[1] - 1, e[2]]); if (e[1] < 3) o.push([e[1], e[2]]); } else { if (e[2] > 0) o.push([e[1], e[2] - 1]); if (e[2] < 4 - 1) o.push([e[1], e[2]]); } return o; }
    after(got, who) { if (this.sc[1] >= 5) return this.finish('win', `상자 ${this.sc[1]}개!`); if (this.sc[2] >= 5) return this.finish('lose', `상대가 상자 ${this.sc[2]}개를 땄다!`); if (got) { if (who === 1) { this.say('한 번 더!', '#8dffa8'); this.moveT = 0; } else this.aiWait = 0.5; } else if (who === 1) this.toAi(); else this.toPlayer(); }
    playerClick(p) { let best = null, bd = 18; const X = (c) => 350 + c * 90, Y = (r) => 170 + r * 90; for (const e of this.edges()) { const cx = e[0] === 'h' ? X(e[2]) + 45 : X(e[2]), cy = e[0] === 'h' ? Y(e[1]) : Y(e[1]) + 45; const d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { bd = d; best = e; } } if (best) this.after(this.line(best, 1), 1); }
    autoMove() { this.after(this.line(pick(this.edges()), 1), 1); }
    aiMove() {
      const es = this.edges(); let pk = null;
      for (const e of shuffle(es)) if (this.boxesOf(e).some(([r, c]) => this.sides(r, c) === 3)) { pk = e; break; } // 딸 수 있으면 딴다
      if (!pk || Math.random() > this.hardness + 0.2) { const safe = es.filter((e) => this.boxesOf(e).every(([r, c]) => this.sides(r, c) < 2)); pk = pick(safe.length ? safe : es); }
      this.after(this.line(pk, 2), 2);
    }
    drawBoard(ctx) {
      const X = (c) => 350 + c * 90, Y = (r) => 170 + r * 90;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (this.box[r][c]) { ctx.fillStyle = this.box[r][c] === 1 ? 'rgba(255,100,100,0.5)' : 'rgba(100,180,255,0.5)'; ctx.fillRect(X(c) + 4, Y(r) + 4, 82, 82); text(ctx, this.box[r][c] === 1 ? '나' : '적', X(c) + 45, Y(r) + 45, 30, '#fff'); }
      ctx.lineCap = 'round'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { ctx.strokeStyle = this.h[r][c] === 1 ? '#ff6a6a' : this.h[r][c] === 2 ? '#6ac0ff' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = this.h[r][c] ? 8 : 4; ctx.beginPath(); ctx.moveTo(X(c) + 8, Y(r)); ctx.lineTo(X(c + 1) - 8, Y(r)); ctx.stroke(); }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.strokeStyle = this.v[r][c] === 1 ? '#ff6a6a' : this.v[r][c] === 2 ? '#6ac0ff' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = this.v[r][c] ? 8 : 4; ctx.beginPath(); ctx.moveTo(X(c), Y(r) + 8); ctx.lineTo(X(c), Y(r + 1) - 8); ctx.stroke(); }
      ctx.lineCap = 'butt'; ctx.fillStyle = '#fff'; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ctx.beginPath(); ctx.arc(X(c), Y(r), 7, 0, Math.PI * 2); ctx.fill(); }
      text(ctx, `나 ${this.sc[1]} : 상대 ${this.sc[2]}`, 480, 500, 20);
    }
  }

  // ---------- 5. 체커 (6x6, 잡기가 의무) ----------
  class Checkers extends Board {
    constructor(lv) {
      super(lv, '체커!', '대각선으로 한 칸, 상대를 뛰어넘어 잡기(잡을 수 있으면 반드시 잡아야 한다). 끝줄에 닿으면 왕!');
      this.b = Array.from({ length: 6 }, () => Array(6).fill(0));
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2) this.b[r][c] = 2;
      for (let r = 4; r < 6; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2) this.b[r][c] = 1;
      this.sel = null; this.moveLimit = 14;
    }
    // 값: 1 내 말, 2 상대 말, 3 내 왕, 4 상대 왕
    own(v) { return v === 1 || v === 3 ? 1 : v === 2 || v === 4 ? 2 : 0; }
    gen(b, side) {
      const out = [], jumps = [];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        const v = b[r][c]; if (this.own(v) !== side) continue;
        const king = v > 2, dirs = king ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : side === 1 ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
        for (const [dr, dc] of dirs) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 6 && cc >= 0 && cc < 6 && !b[rr][cc]) out.push({ from: [r, c], to: [rr, cc], caps: [] }); }
        const dfs = (cr, cc, bb, caps, kingNow) => {
          let any = false;
          const ds = kingNow ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : side === 1 ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
          for (const [dr, dc] of ds) { const mr = cr + dr, mc = cc + dc, lr = cr + 2 * dr, lc = cc + 2 * dc; if (lr < 0 || lr > 5 || lc < 0 || lc > 5) continue; const mv = bb[mr][mc]; if (this.own(mv) === 3 - side && !bb[lr][lc]) { any = true; const nb = bb.map((x) => x.slice()); nb[mr][mc] = 0; nb[cr][cc] = 0; const crowned = !kingNow && (side === 1 ? lr === 0 : lr === 5); nb[lr][lc] = crowned ? side + 2 : nb[cr][cc] || v; nb[lr][lc] = kingNow || crowned ? side + 2 : side; dfs(lr, lc, nb, caps.concat([[mr, mc]]), kingNow || crowned && false); }
          }
          if (!any && caps.length) jumps.push({ from: [r, c], to: [cr, cc], caps });
        };
        dfs(r, c, b, [], king);
      }
      return jumps.length ? jumps : out;
    }
    exec(m, side) {
      const v = this.b[m.from[0]][m.from[1]]; this.b[m.from[0]][m.from[1]] = 0; for (const [r, c] of m.caps) this.b[r][c] = 0;
      const crown = v < 3 && (side === 1 ? m.to[0] === 0 : m.to[0] === 5); this.b[m.to[0]][m.to[1]] = crown ? side + 2 : v; this.last = m.to; if (m.caps.length) this.snd('crit'); if (crown) this.snd('bell');
      const left = this.b.flat().filter((x) => this.own(x) === 3 - side).length;
      if (!left || !this.gen(this.b, 3 - side).length) { this.finish(side === 1 ? 'win' : 'lose', side === 1 ? '상대를 모두 잡거나 막았다!' : '내 말이 모두 잡히거나 막혔다!'); return true; }
      return false;
    }
    playerClick(p) {
      const c = Math.floor((p.x - 288) / 64), r = Math.floor((p.y - 140) / 64); if (r < 0 || r > 5 || c < 0 || c > 5) return;
      const ms = this.gen(this.b, 1);
      if (this.own(this.b[r][c]) === 1) { if (ms.some((m) => m.from[0] === r && m.from[1] === c)) this.sel = [r, c]; else if (ms.length && ms[0].caps.length) this.say('잡을 수 있으면 반드시 잡아야 해요!', '#ffd070'); return; }
      if (this.sel) { const m = ms.find((q) => q.from[0] === this.sel[0] && q.from[1] === this.sel[1] && q.to[0] === r && q.to[1] === c); if (m) { this.sel = null; if (!this.exec(m, 1)) this.toAi(); } }
    }
    autoMove() { const m = pick(this.gen(this.b, 1)); if (!this.exec(m, 1)) this.toAi(); }
    aiMove() {
      const ms = this.gen(this.b, 2); let bm = pick(ms);
      if (Math.random() < this.hardness + 0.1) {
        let best = -1e9;
        for (const m of shuffle(ms)) { const nb = this.b.map((r) => r.slice()); const v = nb[m.from[0]][m.from[1]]; nb[m.from[0]][m.from[1]] = 0; for (const [r, c] of m.caps) nb[r][c] = 0; nb[m.to[0]][m.to[1]] = v; const reply = this.gen(nb, 1); const danger = reply.length && reply[0].caps.length ? reply[0].caps.length : 0; const s = m.caps.length * 3 - danger * 2.5 + m.to[0] * 0.2 + Math.random(); if (s > best) { best = s; bm = m; } }
      }
      if (!this.exec(bm, 2)) this.toPlayer();
    }
    drawBoard(ctx) {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = (r + c) % 2 ? '#5a3a1a' : '#d8b880'; ctx.fillRect(288 + c * 64, 140 + r * 64, 64, 64); const v = this.b[r][c]; if (v) { ctx.fillStyle = this.own(v) === 1 ? '#e84a4a' : '#2a2a2e'; ctx.beginPath(); ctx.arc(288 + c * 64 + 32, 140 + r * 64 + 32, 24, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = this.own(v) === 1 ? '#8a1a1a' : '#888'; ctx.lineWidth = 3; ctx.stroke(); if (v > 2) text(ctx, '♛', 288 + c * 64 + 32, 140 + r * 64 + 32, 26, '#ffe34a', 'center', null); } if (this.sel && this.sel[0] === r && this.sel[1] === c) { ctx.strokeStyle = '#ffe34a'; ctx.lineWidth = 4; ctx.strokeRect(290 + c * 64, 142 + r * 64, 60, 60); } }
      if (this.sel) for (const m of this.gen(this.b, 1)) if (m.from[0] === this.sel[0] && m.from[1] === this.sel[1]) { ctx.fillStyle = 'rgba(120,255,140,0.6)'; ctx.beginPath(); ctx.arc(288 + m.to[1] * 64 + 32, 140 + m.to[0] * 64 + 32, 10, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // ---------- 6. 전함 (6x6, 배 3·2·2칸) ----------
  class Battleship extends Board {
    constructor(lv) {
      super(lv, '전함!', '오른쪽 바다를 눌러 적의 배(3·2·2칸)를 먼저 모두 가라앉혀라'); this.moveLimit = 9; this.noStone = true;
      this.mine = this.fleet(); this.enemy = this.fleet();
      this.shotP = Array.from({ length: 6 }, () => Array(6).fill(0)); this.shotA = Array.from({ length: 6 }, () => Array(6).fill(0)); this.queue = [];
    }
    fleet() { const g = Array.from({ length: 6 }, () => Array(6).fill(0)); for (const [id, len] of [[1, 3], [2, 2], [3, 2]]) { for (let tries = 0; tries < 200; tries++) { const hz = Math.random() < 0.5, r = rint(0, hz ? 5 : 6 - len), c = rint(0, hz ? 6 - len : 5); let ok = true; for (let k = 0; k < len; k++) if (g[hz ? r : r + k][hz ? c + k : c]) ok = false; if (!ok) continue; for (let k = 0; k < len; k++) g[hz ? r : r + k][hz ? c + k : c] = id; break; } } return g; }
    cleared(fleet, shots) { for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (fleet[r][c] && !shots[r][c]) return false; return true; }
    fireP(r, c) { if (this.shotP[r][c]) return; this.shotP[r][c] = 1; const hit = !!this.enemy[r][c]; this.say(hit ? '명중!' : '물보라…', hit ? '#8dffa8' : '#bbb'); this.snd(hit ? 'boom' : 'splash'); if (this.cleared(this.enemy, this.shotP)) return this.finish('win', '적 함대 격침!'); this.toAi(0.5); }
    playerClick(p) { const c = Math.floor((p.x - 530) / 56), r = Math.floor((p.y - 160) / 56); if (r < 0 || r > 5 || c < 0 || c > 5) return; this.fireP(r, c); }
    autoMove() { const e = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!this.shotP[r][c]) e.push([r, c]); const [r, c] = pick(e); this.fireP(r, c); }
    aiMove() {
      let t = null;
      while (this.queue.length && !t) { const q = this.queue.shift(); if (q[0] >= 0 && q[0] < 6 && q[1] >= 0 && q[1] < 6 && !this.shotA[q[0]][q[1]]) t = q; }
      if (!t || Math.random() > this.hardness + 0.2) { const e = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!this.shotA[r][c] && (this.hardness < 0.8 || (r + c) % 2 === 0 || Math.random() < 0.3)) e.push([r, c]); if (!e.length) for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!this.shotA[r][c]) e.push([r, c]); t = t && Math.random() < 0.5 ? t : pick(e); }
      const [r, c] = t; this.shotA[r][c] = 1; this.snd(this.mine[r][c] ? 'boom' : 'splash');
      if (this.mine[r][c]) this.queue.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
      if (this.cleared(this.mine, this.shotA)) return this.finish('lose', '내 함대가 침몰했다!');
      this.toPlayer();
    }
    grid(ctx, x0, y0, fleet, shots, showShips) { for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const x = x0 + c * 56, y = y0 + r * 56; ctx.fillStyle = '#1a4a7a'; ctx.fillRect(x, y, 54, 54); if (showShips && fleet[r][c]) { ctx.fillStyle = '#8a929c'; ctx.fillRect(x + 6, y + 6, 42, 42); } if (shots[r][c]) { if (fleet[r][c]) { ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(x + 27, y + 27, 16, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x + 27, y + 27, 6, 0, Math.PI * 2); ctx.fill(); } } } }
    drawBoard(ctx) { this.grid(ctx, 120, 160, this.mine, this.shotA, true); this.grid(ctx, 530, 160, this.enemy, this.shotP, false); text(ctx, '내 함대', 288, 142, 18, '#cfe'); text(ctx, '적 바다 (눌러서 공격)', 698, 142, 18, '#fc8'); }
  }

  const GAMES = { omok: Omok, connect4: Connect4, tictactoe: TicTacToe, dots: Dots, checkers: Checkers, battleship: Battleship };
  G.BoardGames = { GAMES, Board };
})(window.Game);
