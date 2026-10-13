// 게임쇼의 3D 게임들: 1인칭 레이캐스터 하나를 바탕으로 네 가지.
//   3D 총게임      : 미로 같은 방에서 다가오는 적 10명을 쏘아 쓰러뜨린다. 적은 쏘기 전에 붉게 빛난다
//   3D 미로 탈출   : 어두운 미로에서 초록 빛 기둥(출구)을 찾아라. 유령이 쫓아온다 (가 본 곳만 지도에 보인다)
//   3D 풍선 사격   : 방 한가운데에서 빙 돌며 사방에서 떠오르는 풍선을 터뜨려라. 검은 폭탄 풍선과 놓친 풍선은 틀린 것
//   3D 복도 달리기 : 저절로 달려가는 복도. 벽의 구멍을 향해 좌우로 비켜라. 부딪히면 틀린 것
// 조작: W/S(↑↓) 앞뒤, A/D 게걸음, 마우스 오른쪽 버튼을 누른 채 좌우로 = 시선 돌리기 (←→, Q/E도 된다), Space/Enter/왼쪽 클릭 = 쏘기 (누르고 있으면 연사)
(function (G) {
  const GS = G.GameShow;
  const { text, rnd, rint, pick, clamp, shuffle } = GS;

  // ================= 공통 레이캐스터 =================
  class Ray extends GS.Game {
    constructor(lv, map, pal) {
      super(lv);
      this.map = map; this.R = map.length; this.Cn = map[0].length;
      this.px = 1.5; this.py = 1.5; this.a = 0; this.tv = 0; this.fov = 1.2; this.zbuf = new Float32Array(240);
      this.pal = Object.assign({ wall: [170, 150, 190], sky: ['#4a4a78', '#8a8ab8'], floor: ['#7a6a4a', '#4a3e2a'], fog: 13, minB: 0.45 }, pal || {}); // 밝은 분위기
      this.eye = 0.5; // 눈높이 (0 = 바닥, 1 = 천장). 점프하면 오르고 엎드리면 내려간다
      this.safe = 0; this.flash = 0; this.hurtFlash = 0; this.shotCd = 0; this.recoil = 0;
    }
    solid(x, y) { const c = Math.floor(x), r = Math.floor(y); return r < 0 || r >= this.R || c < 0 || c >= this.Cn || this.map[r][c] === '#'; }
    move(dx, dy) { const nx = this.px + dx, ny = this.py + dy; if (!this.solid(nx + Math.sign(dx) * 0.2, this.py)) this.px = nx; if (!this.solid(this.px, ny + Math.sign(dy) * 0.2)) this.py = ny; }
    los(x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.2); for (let i = 1; i < n; i++) if (this.solid(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false; return true; }
    // 시선: 오른쪽 버튼을 누른 채 마우스를 좌우로 (감도 낮음), ←→/Q/E는 부드럽게
    steer(io, dt) {
      if (io.rightDown && io.mouse && this.pmx !== undefined) this.a += (io.mouse.x - this.pmx) * 0.0032;
      this.pmx = io.mouse ? io.mouse.x : undefined;
      const tv = ((io.down('ArrowRight', 'KeyE') ? 1 : 0) - (io.down('ArrowLeft', 'KeyQ') ? 1 : 0)) * 2.2;
      this.tv += (tv - this.tv) * Math.min(1, 12 * dt);
      this.a += this.tv * dt;
    }
    // 이동: WASD/↑↓ = 앞뒤, A/D = 게걸음
    walk(io, dt, speed) {
      let fw = (io.down('KeyW', 'ArrowUp') ? 1 : 0) - (io.down('KeyS', 'ArrowDown') ? 1 : 0), sd = (io.down('KeyD') ? 1 : 0) - (io.down('KeyA') ? 1 : 0);
      const ml = Math.hypot(fw, sd) || 1; fw /= ml; sd /= ml;
      const sp = (speed || 3.4) * dt;
      if (fw || sd) this.move((Math.cos(this.a) * fw - Math.sin(this.a) * sd) * sp, (Math.sin(this.a) * fw + Math.cos(this.a) * sd) * sp);
    }
    wallRGB() { return this.pal.wall; }
    // 칸 종류별 높이 범위 [아래, 위] (바닥 0 ~ 천장 1). '#' 벽은 시선을 막고, 'l' 낮은 장애물과 'h' 매달린 장애물은 시선을 막지 않는다
    span(ch) { return ch === 'l' ? [0, 0.4] : ch === 'h' ? [0.55, 1] : [0, 1]; }
    // 배경과 벽 (영역 y0..y0+h)
    cast(ctx, W, y0, h) {
      const cols = 240, cw = W / cols, fov = this.fov;
      const sky = ctx.createLinearGradient(0, y0, 0, y0 + h / 2); sky.addColorStop(0, this.pal.sky[0]); sky.addColorStop(1, this.pal.sky[1]); ctx.fillStyle = sky; ctx.fillRect(0, y0, W, h / 2);
      const fl = ctx.createLinearGradient(0, y0 + h / 2, 0, y0 + h); fl.addColorStop(0, this.pal.floor[0]); fl.addColorStop(1, this.pal.floor[1]); ctx.fillStyle = fl; ctx.fillRect(0, y0 + h / 2, W, h / 2);
      for (let i = 0; i < cols; i++) {
        const ra = this.a - fov / 2 + (i / cols) * fov, rx = Math.cos(ra), ry = Math.sin(ra);
        let mx = Math.floor(this.px), my = Math.floor(this.py); const ddx = Math.abs(1 / (rx || 1e-9)), ddy = Math.abs(1 / (ry || 1e-9));
        let sx, sy, sdx, sdy; if (rx < 0) { sx = -1; sdx = (this.px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - this.px) * ddx; } if (ry < 0) { sy = -1; sdy = (this.py - my) * ddy; } else { sy = 1; sdy = (my + 1 - this.py) * ddy; }
        const hits = []; let side = 0, hit = false, guard = 0;
        while (!hit && guard++ < 160) {
          if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
          const out = my < 0 || my >= this.R || mx < 0 || mx >= this.Cn, ch = out ? '#' : this.map[my][mx];
          if (ch === '#' || ch === 'l' || ch === 'h') { const dd = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy) * Math.cos(ra - this.a); hits.push({ dist: dd, side, mx, my, ch }); if (ch === '#') hit = true; }
        }
        this.zbuf[i] = hits.length && hits[hits.length - 1].ch === '#' ? hits[hits.length - 1].dist : 99;
        for (let k = hits.length - 1; k >= 0; k--) { // 먼 것부터 그린다
          const hh = hits[k], lh = Math.min(h * 3, h / hh.dist * 0.9), sh = clamp(1 - hh.dist / this.pal.fog, this.pal.minB, 1) * (hh.side ? 0.85 : 1), rgb = this.wallRGB(hh.mx, hh.my, hh.ch), sp = this.span(hh.ch);
          const yTop = y0 + h / 2 + lh * (this.eye - sp[1]), yBot = y0 + h / 2 + lh * (this.eye - sp[0]);
          ctx.fillStyle = `rgb(${Math.round(rgb[0] * sh)},${Math.round(rgb[1] * sh)},${Math.round(rgb[2] * sh)})`; ctx.fillRect(i * cw, yTop, cw + 1, yBot - yTop);
        }
      }
    }
    // 스프라이트 (먼 것부터). list = [{x, y, draw(ctx, sx, cy, size, dist), alpha, lift}]
    sprites(ctx, list, W, y0, h) {
      const cols = 240, cw = W / cols, fov = this.fov;
      const sp = list.map((f) => { const dx = f.x - this.px, dy = f.y - this.py; let da = Math.atan2(dy, dx) - this.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; return { f, d: Math.hypot(dx, dy) * Math.cos(da), da }; }).filter((s) => s.d > 0.2 && Math.abs(s.da) < fov).sort((a, b) => b.d - a.d);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0, W, h); ctx.clip();
      for (const s of sp) {
        const sxp = (0.5 + s.da / fov) * W, size = h / s.d * 0.78;
        const c0 = Math.floor((sxp - size / 4) / cw), c1 = Math.floor((sxp + size / 4) / cw);
        ctx.save(); ctx.beginPath(); let run = -1;
        for (let c = c0; c <= c1 + 1; c++) { const vis = c >= 0 && c < cols && c <= c1 && this.zbuf[c] > s.d - 0.1; if (vis && run < 0) run = c; if (!vis && run >= 0) { ctx.rect(run * cw, y0, (c - run) * cw, h); run = -1; } }
        ctx.clip();
        const cy = y0 + h / 2 + size * 0.1 - (s.f.lift || 0) * size;
        ctx.globalAlpha = s.f.alpha === undefined ? 1 : s.f.alpha;
        s.f.draw(ctx, sxp, cy, size, s.d);
        ctx.restore();
      }
      ctx.restore();
    }
    crosshair(ctx, W, y0, h) { const cx = W / 2, cy = y0 + h / 2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12); ctx.stroke(); }
    gun(ctx, W, y0, h) { const cx = W / 2; ctx.fillStyle = '#2a2f3a'; ctx.fillRect(cx + 40, y0 + h - 70 + this.recoil * 14, 90, 70); ctx.fillStyle = '#4a4f5a'; ctx.fillRect(cx + 56, y0 + h - 110 + this.recoil * 14, 26, 50); if (this.flash > 0) { ctx.fillStyle = 'rgba(255,230,120,0.8)'; ctx.beginPath(); ctx.arc(cx + 69, y0 + h - 116, 22, 0, Math.PI * 2); ctx.fill(); } }
    hurtOverlay(ctx, W, y0, h) { if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(255,0,0,${this.hurtFlash * 0.7})`; ctx.fillRect(0, y0, W, h); } }
    tick(dt) { this.safe = Math.max(0, this.safe - dt); this.shotCd = Math.max(0, this.shotCd - dt); this.flash = Math.max(0, this.flash - dt); this.hurtFlash = Math.max(0, this.hurtFlash - dt); this.recoil = Math.max(0, this.recoil - dt * 5); }
    hit(msg) { this.mistake(msg); this.snd('hurt'); this.hurtFlash = 0.5; this.safe = 1.6; } // 맞은 뒤 잠깐은 안전하다
    wantsFire(io) { return (io.click || io.down('Space', 'Enter', 'NumpadEnter') || io.mouseDown) && this.shotCd <= 0; }
    // 작은 지도: seen(r, c)가 참인 칸만 보인다
    minimap(ctx, mm, seen, extra) {
      const w = this.Cn * mm, h = this.R * mm; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 120, w + 4, h + 4);
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.Cn; c++) { if (seen && !seen(r, c)) continue; ctx.fillStyle = this.map[r][c] === '#' ? '#8a8aa0' : 'rgba(255,255,255,0.08)'; ctx.fillRect(10 + c * mm, 122 + r * mm, mm - 1, mm - 1); }
      if (extra) extra(ctx, (x) => 10 + x * mm, (y) => 122 + y * mm);
      ctx.fillStyle = '#8dffa8'; ctx.fillRect(10 + this.px * mm - 2, 122 + this.py * mm - 2, 4, 4); ctx.strokeStyle = '#8dffa8'; ctx.beginPath(); ctx.moveTo(10 + this.px * mm, 122 + this.py * mm); ctx.lineTo(10 + this.px * mm + Math.cos(this.a) * 8, 122 + this.py * mm + Math.sin(this.a) * 8); ctx.stroke();
    }
  }

  // ================= 1. 3D 총게임 =================
  const MAP = ['############', '#..........#', '#.##..##...#', '#.#....#.#.#', '#....#.....#', '#.#..#.##..#', '#.#........#', '#...##..#..#', '#.#......#.#', '#.#..##....#', '#..........#', '############'];
  class Fps extends Ray {
    constructor(lv) {
      super(lv, MAP, { wall: [175, 150, 200], sky: ['#4a4a7a', '#9a9ac8'], floor: ['#8a7a52', '#4a3e2a'], fog: 14, minB: 0.5 });
      this.title = '3D 총게임!'; this.hint = 'WASD 이동 · 우클릭 누른 채 마우스로 돌기(←→도 가능) · 좌클릭/Space = 쏘기(연사)'; this.tone = ['#101018', '#202030']; this.limit = 50;
      this.px = 1.5; this.py = 1.5; this.a = 0.7; this.need = 10; this.kills = 0; this.foes = [];
      const spots = []; for (let r = 1; r < 11; r++) for (let c = 1; c < 11; c++) if (MAP[r][c] === '.' && Math.hypot(c + 0.5 - 1.5, r + 0.5 - 1.5) > 4) spots.push([c + 0.5, r + 0.5]);
      for (let i = 0; i < this.need; i++) { const s = spots.splice(rint(0, spots.length - 1), 1)[0]; this.foes.push({ x: s[0], y: s[1], cd: rnd(1.5, 3), wind: 0, dead: 0, spd: 0.8 + 0.6 * lv }); }
    }
    step(dt, io) {
      this.steer(io, dt); this.walk(io, dt, 3.4); this.tick(dt);
      if (this.wantsFire(io)) { this.shotCd = 0.24; this.flash = 0.08; this.recoil = 1; this.snd('gun'); this.fire(); }
      for (const f of this.foes) {
        if (f.dead) { f.dead += dt; continue; }
        const dx = this.px - f.x, dy = this.py - f.y, d = Math.hypot(dx, dy);
        const see = d < 7 && this.los(f.x, f.y, this.px, this.py);
        if (f.wind > 0) { f.wind -= dt; if (f.wind <= 0) { if (this.los(f.x, f.y, this.px, this.py) && d < 7 && this.safe <= 0) this.hit('맞았다!'); f.cd = rnd(1.8, 3.0); } continue; }
        if (d > 2.2) { const nx = f.x + (dx / d) * f.spd * dt, ny = f.y + (dy / d) * f.spd * dt; if (!this.solid(nx, f.y)) f.x = nx; if (!this.solid(f.x, ny)) f.y = ny; }
        f.cd -= dt;
        if (see && f.cd <= 0) { f.wind = 0.65 - 0.2 * this.lv; this.snd('zap'); } // 쏘기 전 붉게 빛난다
      }
    }
    fire() {
      let best = null, bd = 99;
      for (const f of this.foes) {
        if (f.dead) continue;
        const dx = f.x - this.px, dy = f.y - this.py, d = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - this.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(Math.sin(da)) * d < 0.55 && Math.abs(da) < 0.2 && Math.cos(da) > 0 && d < bd && this.los(this.px, this.py, f.x, f.y)) { bd = d; best = f; } // 조준 보조
      }
      if (best) { best.dead = 0.001; this.kills++; this.snd('ding'); this.say(`명중! ${this.kills}/${this.need}`, '#8dffa8'); if (this.kills >= this.need) this.win('모두 쓰러뜨렸다!'); }
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const y0 = 116, h = 400;
      this.cast(ctx, W, y0, h);
      this.sprites(ctx, this.foes.filter((f) => f.dead < 0.5).map((f) => ({ x: f.x, y: f.y, alpha: f.dead ? Math.max(0, 1 - f.dead * 2) : 1, draw: (c, sxp, cy, size) => {
        const glow = f.wind > 0 ? 0.5 + 0.5 * Math.sin(this.t * 40) : 0;
        c.fillStyle = glow ? `rgb(255,${Math.round(90 - glow * 40)},${Math.round(90 - glow * 40)})` : '#6a4a8a'; c.fillRect(sxp - size * 0.22, cy - size * 0.2, size * 0.44, size * 0.55);
        c.fillStyle = '#e8b98a'; c.beginPath(); c.arc(sxp, cy - size * 0.34, size * 0.14, 0, Math.PI * 2); c.fill();
        c.fillStyle = glow ? '#fff' : '#ffe34a'; c.fillRect(sxp - size * 0.08, cy - size * 0.36, size * 0.05, size * 0.04); c.fillRect(sxp + size * 0.03, cy - size * 0.36, size * 0.05, size * 0.04);
        c.fillStyle = '#222'; c.fillRect(sxp + size * 0.12, cy - size * 0.05, size * 0.3, size * 0.07);
      } })), W, y0, h);
      this.crosshair(ctx, W, y0, h); this.gun(ctx, W, y0, h); this.hurtOverlay(ctx, W, y0, h);
      this.minimap(ctx, 8, null, (c, X, Y) => { for (const f of this.foes) if (!f.dead) { c.fillStyle = f.wind > 0 ? '#ffffff' : '#ff6a6a'; c.fillRect(X(f.x) - 2, Y(f.y) - 2, 4, 4); } });
      text(ctx, `적 ${this.need - this.kills}명 남음`, W - 90, 130, 18);
      text(ctx, 'WASD 이동 · 우클릭 누른 채 마우스 = 돌기 · 좌클릭/Space = 쏘기', W / 2, 500, 14, '#cfe');
      this.drawOver(ctx, W, H);
    }
  }

  // ================= 2. 3D 미로 탈출 =================
  function makeMaze(n) { // n x n 칸의 미로 -> (2n+1) x (2n+1) 격자
    const S = 2 * n + 1, g = Array.from({ length: S }, () => Array(S).fill('#'));
    const seen = Array.from({ length: n }, () => Array(n).fill(false)), st = [[0, 0]]; seen[0][0] = true; g[1][1] = '.';
    while (st.length) {
      const [r, c] = st[st.length - 1], nb = shuffle([[0, 1], [1, 0], [0, -1], [-1, 0]]).filter(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < n && cc >= 0 && cc < n && !seen[rr][cc]; });
      if (!nb.length) { st.pop(); continue; }
      const [dr, dc] = nb[0], rr = r + dr, cc = c + dc; seen[rr][cc] = true; g[2 * r + 1 + dr][2 * c + 1 + dc] = '.'; g[2 * rr + 1][2 * cc + 1] = '.'; st.push([rr, cc]);
    }
    for (let k = 0; k < n; k++) { const r = 2 * rint(0, n - 1) + 1, c = 2 * rint(1, n - 2) + 2; if (g[r][c] === '#') g[r][c] = '.'; } // 막다른 길을 조금 뚫어 돌아갈 수 있게
    return g.map((row) => row.join(''));
  }
  class Maze extends Ray {
    constructor(lv) {
      const n = 9, map = makeMaze(n);
      super(lv, map, { wall: [150, 190, 150], sky: ['#3a3a6a', '#7a7ab0'], floor: ['#6a8a52', '#3a5a3a'], fog: 12, minB: 0.45 });
      this.title = '3D 미로 탈출!'; this.hint = '초록 빛 기둥(출구)까지! 유령에게 닿으면 피 -1. 가 본 곳만 지도에 보인다'; this.limit = 60 - 8 * lv;
      this.px = 1.5; this.py = 1.5; this.a = 0; this.exit = { x: 2 * n - 0.5, y: 2 * n - 0.5 }; this.seen = new Set(); this.ghosts = [];
      const ng = lv > 0.7 ? 2 : 1;
      for (let i = 0; i < ng; i++) this.ghosts.push({ x: this.exit.x - 2 * i, y: this.exit.y - (i ? 0 : 2), spd: 1.0 + 0.55 * lv, next: null, rt: 0 });
      this.mark();
    }
    mark() { const r0 = Math.floor(this.py), c0 = Math.floor(this.px); for (let r = r0 - 2; r <= r0 + 2; r++) for (let c = c0 - 2; c <= c0 + 2; c++) if ((Math.abs(r - r0) <= 1 && Math.abs(c - c0) <= 1) || this.los(this.px, this.py, c + 0.5, r + 0.5)) this.seen.add(r * 100 + c); }
    bfs(sr, sc, tr, tc) { // 유령이 지름길로 쫓아온다: 칸 단위 길찾기 -> 다음 칸
      const q = [[sr, sc]], prev = new Map([[sr * 100 + sc, null]]);
      while (q.length) { const [r, c] = q.shift(); if (r === tr && c === tc) break; for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const rr = r + dr, cc = c + dc, k = rr * 100 + cc; if (rr < 0 || rr >= this.R || cc < 0 || cc >= this.Cn || this.map[rr][cc] === '#' || prev.has(k)) continue; prev.set(k, [r, c]); q.push([rr, cc]); } }
      if (!prev.has(tr * 100 + tc)) return null;
      let cur = [tr, tc], nxt = cur; while (prev.get(cur[0] * 100 + cur[1])) { nxt = cur; cur = prev.get(cur[0] * 100 + cur[1]); } return nxt;
    }
    step(dt, io) {
      this.steer(io, dt); this.walk(io, dt, 3.2); this.tick(dt); this.mark();
      for (const g of this.ghosts) {
        g.rt -= dt;
        if (g.rt <= 0) { g.rt = 0.3; g.next = this.bfs(Math.floor(g.y), Math.floor(g.x), Math.floor(this.py), Math.floor(this.px)); }
        if (g.next) { const tx = g.next[1] + 0.5, ty = g.next[0] + 0.5, d = Math.hypot(tx - g.x, ty - g.y) || 1, sp = g.spd * dt; g.x += ((tx - g.x) / d) * Math.min(sp, d); g.y += ((ty - g.y) / d) * Math.min(sp, d); }
        if (Math.hypot(g.x - this.px, g.y - this.py) < 0.55 && this.safe <= 0) { this.hit('유령에게 잡혔다!'); g.x = this.exit.x; g.y = this.exit.y; }
      }
      if (Math.hypot(this.exit.x - this.px, this.exit.y - this.py) < 0.7) this.win('탈출 성공!');
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const y0 = 116, h = 400;
      this.cast(ctx, W, y0, h);
      const list = [{ x: this.exit.x, y: this.exit.y, draw: (c, sxp, cy, size) => { const g = c.createLinearGradient(0, cy - size * 0.9, 0, cy + size * 0.6); g.addColorStop(0, 'rgba(120,255,160,0)'); g.addColorStop(0.5, `rgba(120,255,160,${0.55 + 0.2 * Math.sin(this.t * 6)})`); g.addColorStop(1, 'rgba(120,255,160,0.2)'); c.fillStyle = g; c.fillRect(sxp - size * 0.12, cy - size * 0.9, size * 0.24, size * 1.5); c.fillStyle = '#eaffee'; c.fillRect(sxp - size * 0.03, cy - size * 0.9, size * 0.06, size * 1.5); } }];
      for (const g of this.ghosts) list.push({ x: g.x, y: g.y, draw: (c, sxp, cy, size) => {
        const wob = Math.sin(this.t * 6 + g.x) * size * 0.03;
        c.fillStyle = 'rgba(235,240,255,0.92)'; c.beginPath(); c.arc(sxp, cy - size * 0.25 + wob, size * 0.2, Math.PI, 0); c.lineTo(sxp + size * 0.2, cy + size * 0.2);
        for (let k = 3; k >= 0; k--) c.lineTo(sxp - size * 0.2 + k * size * 0.1333, cy + size * (k % 2 ? 0.28 : 0.2));
        c.closePath(); c.fill();
        c.fillStyle = '#10101c'; c.beginPath(); c.arc(sxp - size * 0.07, cy - size * 0.26 + wob, size * 0.035, 0, Math.PI * 2); c.arc(sxp + size * 0.07, cy - size * 0.26 + wob, size * 0.035, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(sxp, cy - size * 0.14 + wob, size * 0.04, size * 0.05, 0, 0, Math.PI * 2); c.fill();
      } });
      this.sprites(ctx, list, W, y0, h);
      this.hurtOverlay(ctx, W, y0, h);
      this.minimap(ctx, 8, (r, c) => this.seen.has(r * 100 + c), (c, X, Y) => { c.fillStyle = '#6aff9a'; c.fillRect(X(this.exit.x) - 3, Y(this.exit.y) - 3, 6, 6); for (const g of this.ghosts) if (this.seen.has(Math.floor(g.y) * 100 + Math.floor(g.x))) { c.fillStyle = '#ffffff'; c.fillRect(X(g.x) - 2, Y(g.y) - 2, 4, 4); } });
      text(ctx, `출구까지 약 ${Math.round(Math.hypot(this.exit.x - this.px, this.exit.y - this.py))}칸`, W - 100, 130, 16);
      text(ctx, 'WASD 이동 · 우클릭 누른 채 마우스 = 돌기', W / 2, 500, 14, '#cfe');
      this.drawOver(ctx, W, H);
    }
  }

  // ================= 3. 3D 풍선 사격 =================
  const ROOM = Array.from({ length: 14 }, (_, r) => Array.from({ length: 14 }, (_, c) => (r === 0 || r === 13 || c === 0 || c === 13 ? '#' : '.')).join(''));
  class Range extends Ray {
    constructor(lv) {
      super(lv, ROOM, { wall: [120, 160, 210], sky: ['#4a7ac0', '#bfe0ff'], floor: ['#5a9a52', '#2f5a2c'], fog: 16, minB: 0.55 });
      this.title = '3D 풍선 사격!'; this.hint = '우클릭 누른 채 마우스로 돌면서 풍선을 쏴라! 검은 폭탄은 쏘면 안 되고, 놓친 풍선은 피 -1'; this.limit = 48;
      this.px = 7; this.py = 7; this.a = rnd(0, 6.28); this.balls = []; this.spawnT = 0.5; this.need = 14; this.pops = 0; this.life = 3.6 - 1.1 * lv;
    }
    step(dt, io) {
      this.steer(io, dt); this.tick(dt);
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.balls.filter((b) => !b.dead).length < 4) {
        const ang = this.a + rnd(-1.6, 1.6) + (Math.random() < 0.4 ? Math.PI * (Math.random() < 0.5 ? 1 : -1) * rnd(0.4, 1) : 0), r = rnd(2.4, 5.2);
        this.balls.push({ x: this.px + Math.cos(ang) * r, y: this.py + Math.sin(ang) * r, t: 0, dead: 0, bomb: Math.random() < 0.25, hue: rint(0, 359), lift: rnd(-0.1, 0.1) });
        this.spawnT = rnd(0.45, 0.85); this.snd('pop');
      }
      for (const b of this.balls) { if (b.dead) { b.dead += dt; continue; } b.t += dt; b.lift += dt * 0.025; if (b.t >= this.life) { b.dead = 0.001; if (!b.bomb) this.mistake('풍선을 놓쳤다!'); } }
      this.balls = this.balls.filter((b) => !b.dead || b.dead < 0.4);
      if (this.wantsFire(io)) {
        this.shotCd = 0.2; this.flash = 0.08; this.recoil = 1; this.snd('gun');
        let best = null, bd = 99;
        for (const b of this.balls) { if (b.dead) continue; const dx = b.x - this.px, dy = b.y - this.py, d = Math.hypot(dx, dy); let da = Math.atan2(dy, dx) - this.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(Math.sin(da)) * d < 0.5 && Math.abs(da) < 0.22 && d < bd) { bd = d; best = b; } }
        if (best) {
          best.dead = 0.001;
          if (best.bomb) { this.mistake('폭탄을 쏴 버렸다!'); this.snd('boom'); this.hurtFlash = 0.4; }
          else { this.pops++; this.snd('pop'); this.snd('ding'); this.say(`펑! ${this.pops}/${this.need}`, '#8dffa8'); if (this.pops >= this.need) this.win('사격왕!'); }
        }
      }
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const y0 = 116, h = 400;
      this.cast(ctx, W, y0, h);
      this.sprites(ctx, this.balls.filter((b) => b.dead < 0.4).map((b) => ({ x: b.x, y: b.y, lift: b.lift, alpha: b.dead ? Math.max(0, 1 - b.dead * 3) : 1, draw: (c, sxp, cy, size) => {
        const left = b.dead ? 1 : 1 - b.t / this.life, r = size * (b.dead ? 0.2 + b.dead : 0.2), blink = left < 0.3 && Math.floor(this.t * 10) % 2;
        c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sxp, cy + r); c.lineTo(sxp + size * 0.02, cy + r + size * 0.18); c.stroke();
        if (b.bomb) { c.fillStyle = '#1a1a22'; c.beginPath(); c.arc(sxp, cy, r, 0, Math.PI * 2); c.fill(); c.fillStyle = blink ? '#ff5050' : '#ffd24a'; c.fillRect(sxp - r * 0.12, cy - r * 1.35, r * 0.24, r * 0.4); c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(sxp - r * 0.3, cy - r * 0.3, r * 0.2, 0, Math.PI * 2); c.fill(); }
        else { c.fillStyle = blink ? '#ffffff' : `hsl(${b.hue},85%,60%)`; c.beginPath(); c.ellipse(sxp, cy, r * 0.85, r, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(sxp - r * 0.3, cy - r * 0.35, r * 0.18, r * 0.28, -0.5, 0, Math.PI * 2); c.fill(); }
      } })), W, y0, h);
      this.crosshair(ctx, W, y0, h); this.gun(ctx, W, y0, h); this.hurtOverlay(ctx, W, y0, h);
      this.minimap(ctx, 8, null, (c, X, Y) => { for (const b of this.balls) if (!b.dead) { c.fillStyle = b.bomb ? '#222' : `hsl(${b.hue},85%,60%)`; c.fillRect(X(b.x) - 2, Y(b.y) - 2, 4, 4); } });
      text(ctx, `터뜨린 풍선 ${this.pops}/${this.need}`, W - 110, 130, 18);
      text(ctx, '우클릭 누른 채 마우스 = 돌기 · 좌클릭/Space = 쏘기 · 검은 풍선은 쏘지 마!', W / 2, 500, 14, '#cfe');
      this.drawOver(ctx, W, H);
    }
  }

  // ================= 4. 3D 복도 달리기 =================
  // 벽의 구멍으로 비키고 (A/D), 낮은 장애물은 점프로 (Space/W/↑), 매달린 장애물은 엎드려서 (S/↓/Ctrl) 지나간다. 점점 빨라진다
  //   '#' 벽(구멍이 있다)  'l' 낮은 장애물(점프)  'h' 매달린 장애물(엎드리기)
  function makeCorridor(len) {
    const rows = Array.from({ length: 7 }, () => Array(len).fill('.'));
    for (let c = 0; c < len; c++) { rows[0][c] = '#'; rows[6][c] = '#'; }
    const fill = (c, ch) => { for (let r = 1; r <= 5; r++) rows[r][c] = ch; };
    const kinds = ['gap', 'gap', 'low', 'low', 'hang', 'hang', 'combo', 'combo2'];
    let c = 13;
    while (c < len - 10) {
      const k = pick(kinds);
      if (k === 'gap') { const gaps = new Set([rint(1, 5)]); if (Math.random() < 0.3) gaps.add(rint(1, 5)); for (let r = 1; r <= 5; r++) if (!gaps.has(r)) rows[r][c] = '#'; c += 5; }
      else if (k === 'low') { fill(c, 'l'); c += 5; }
      else if (k === 'hang') { fill(c, 'h'); c += 5; }
      else if (k === 'combo') { fill(c, 'l'); fill(c + 3, 'h'); c += 8; } // 점프 뒤에 바로 엎드리기
      else { fill(c, 'h'); fill(c + 3, 'l'); c += 8; }                     // 엎드리기 뒤에 바로 점프
    }
    return rows.map((r) => r.join(''));
  }
  class Runner extends Ray {
    constructor(lv) {
      const len = 130;
      super(lv, makeCorridor(len), { wall: [235, 215, 175], sky: ['#6aa0e0', '#cfe8ff'], floor: ['#8a8a98', '#4a4a58'], fog: 16, minB: 0.55 });
      this.title = '3D 복도 달리기!'; this.hint = 'A/D 비키기 · Space/W 점프 (낮은 장애물) · S/↓/Ctrl 엎드리기 (매달린 장애물)'; this.limit = 36;
      this.px = 2.5; this.py = 3.5; this.a = 0; this.len = len; this.vx = 5.4 + 2.2 * lv; this.vy = 0; this.fov = 1.35;
      this.z = 0; this.vz = 0; this.cr = 0; this.air = false; this.lastObs = '';
    }
    span(ch) { return ch === 'l' ? [0, 0.4] : ch === 'h' ? [0.5, 1] : [0, 1]; }
    wallRGB(mx, my, ch) { // 벽은 밝은 회색, 낮은 장애물은 주황·흰 줄무늬, 매달린 장애물은 보라·흰 줄무늬
      if (ch === 'l') return (my % 2) ? [255, 150, 40] : [255, 245, 230];
      if (ch === 'h') return (my % 2) ? [200, 90, 230] : [255, 245, 230];
      return my === 0 || my === 6 ? [150, 170, 215] : ((mx + my) % 2 ? [250, 215, 70] : [90, 70, 60]);
    }
    // 이 자리에서 막히는가 (낮은 장애물은 발이 낮을 때, 매달린 장애물은 머리가 높을 때)
    blocked(x, y) {
      const ch = this.solid(x, y) ? '#' : this.map[Math.floor(y)][Math.floor(x)];
      if (ch === '#') return true;
      if (ch === 'l') return this.z < 0.4;
      if (ch === 'h') return this.z + 0.62 - 0.26 * this.cr > 0.5;
      return false;
    }
    step(dt, io) {
      this.tick(dt);
      const sd = (io.down('KeyD', 'ArrowRight', 'KeyE') ? 1 : 0) - (io.down('KeyA', 'ArrowLeft', 'KeyQ') ? 1 : 0);
      const wantJump = io.pressed('Space', 'KeyW', 'ArrowUp'), wantDuck = io.down('KeyS', 'ArrowDown', 'ControlLeft', 'ControlRight', 'ShiftLeft');
      this.a += (0 - this.a) * Math.min(1, 6 * dt);
      if (wantJump && !this.air && this.cr < 0.4) { this.vz = 7.0; this.air = true; this.snd('jump'); } // 점프: 휙 올랐다 휙 내려온다 (빠르다)
      if (this.air) { this.vz -= 30 * dt; this.z += this.vz * dt; if (this.z <= 0) { this.z = 0; this.vz = 0; this.air = false; this.snd('tick'); } }
      this.cr += ((wantDuck && !this.air ? 1 : 0) - this.cr) * Math.min(1, 16 * dt); // 엎드리기는 땅에서만
      this.eye = 0.5 + this.z * 0.85 - 0.24 * this.cr;
      this.vy += (sd * 4.6 - this.vy) * Math.min(1, 14 * dt);
      const nx = this.px + this.vx * dt;
      if (this.blocked(nx + 0.25, this.py + 0.2) || this.blocked(nx + 0.25, this.py - 0.2)) { // 장애물에 부딪혔다
        if (this.safe <= 0) { this.hit('부딪혔다!'); this.snd('thud'); this.px = Math.max(2.5, this.px - 2.4); this.z = 0; this.vz = 0; this.air = false; }
      } else this.px = nx;
      const ny = this.py + this.vy * dt; if (!this.solid(this.px, ny + Math.sign(this.vy || 0) * 0.25)) this.py = ny;
      this.vx = Math.min(this.vx + 0.05 * dt, 8.5); // 갈수록 빨라진다
      if (this.px > this.len - 4) this.win('결승선!');
    }
    next() { // 앞에 있는 가장 가까운 장애물 종류 (8칸 안)
      for (let c = Math.floor(this.px) + 1; c < Math.min(this.len, Math.floor(this.px) + 9); c++) for (let r = 1; r <= 5; r++) { const ch = this.map[r][c]; if (ch === 'l') return { t: '점프!', c: '#ffb050', d: c - this.px }; if (ch === 'h') return { t: '엎드려!', c: '#e090ff', d: c - this.px }; if (ch === '#') return { t: '구멍으로 비켜!', c: '#fff08a', d: c - this.px }; }
      return null;
    }
    draw(ctx, W, H) {
      this.drawBase(ctx, W, H);
      const y0 = 116, h = 400;
      this.cast(ctx, W, y0, h);
      for (let k = 0; k < 8; k++) { const z = 1 + ((k * 1.1 - (this.px % 1.1) + 9) % 8.8), yy = y0 + h / 2 + (h / 2) / z * 0.9 + (this.eye - 0.5) * h * 0.5; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, yy, W, 3 + 6 / z); } // 바닥 줄무늬: 달리는 느낌
      this.hurtOverlay(ctx, W, y0, h);
      const nx = this.next(); if (nx && nx.d < 7) { ctx.globalAlpha = clamp(1.2 - nx.d / 7, 0.4, 1); text(ctx, nx.t, W / 2, y0 + 50, 36, nx.c); ctx.globalAlpha = 1; }
      const u = (this.px - 2.5) / (this.len - 6.5); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 200, 490, 400, 10); ctx.fillStyle = '#ffe34a'; ctx.fillRect(W / 2 - 199, 491, 398 * clamp(u, 0, 1), 8);
      text(ctx, `속도 ${this.vx.toFixed(1)}`, W - 80, 130, 16);
      text(ctx, 'A/D 비키기 · Space 점프 · S/↓/Ctrl 엎드리기', W / 2, 520, 14, '#cfe');
      this.drawOver(ctx, W, H);
    }
  }

  G.Fps3D = { Game: Fps, Fps, Maze, Range, Runner, GAMES: { fps: Fps, maze: Maze, range: Range, runner: Runner } };
})(window.Game);
