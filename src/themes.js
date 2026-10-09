// 추가 스테이지의 테마: 숲(Forest), 설산(Snow), 화산(Volcano). Cave/Beach와 같은 인터페이스
// (drawBackground / drawCeiling / drawTile / drawDecor / drawVignette)를 가지며, 무늬는 좌표 해시로 정해져 깜빡이지 않는다.
(function (G) {
  const { TILE } = G.Config;
  const rnd = G.Cave.rnd;

  const mix = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
  const sky = (ctx, w, h, stops) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  const glow = (ctx, x, y, r, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // 옆면/아랫면 그림자 (세 테마 공통)
  const shade = (ctx, x, y, left, right, below, alpha) => {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    if (!right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
    if (!left) ctx.fillRect(x, y, 2, TILE);
    if (!below) ctx.fillRect(x, y + TILE - 4, TILE, 4);
  };
  const neighbors = (terrain, c, r) => ({
    above: r > 0 && terrain.grid[r - 1][c],
    below: r + 1 < terrain.rows && terrain.grid[r + 1][c],
    left: c > 0 && terrain.grid[r][c - 1],
    right: c + 1 < terrain.cols && terrain.grid[r][c + 1],
  });
  const exitDecor = (ctx, terrain, camera, time) => G.Cave.drawDecor(ctx, terrain, camera, time); // 마을로 나가는 출구 문
  const noCeiling = () => {};
  const vignette = (rgb, a) => (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(${rgb},${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  // ======================= 숲 =======================
  function tree(ctx, x, base, s, trunk, leaf, light) {
    ctx.fillStyle = trunk;
    ctx.fillRect(x - 7 * s, base - 78 * s, 14 * s, 78 * s);
    for (const [dx, dy, r] of [[0, -96, 34], [-26, -78, 26], [26, -80, 27], [0, -122, 24]]) {
      ctx.fillStyle = leaf;
      ctx.beginPath(); ctx.arc(x + dx * s, base + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.arc(x - 8 * s, base - 108 * s, 14 * s, 0, Math.PI * 2); ctx.fill();
  }

  const Forest = {
    rnd,
    drawBackground(ctx, w, h, camera, time) {
      sky(ctx, w, h, [[0, '#86d4ff'], [0.55, '#c9f0d2'], [1, '#eaf9c4']]);
      glow(ctx, w * 0.2, h * 0.14, 150, '255,250,200', 0.6);
      G.Cave._ridge(ctx, w, h, camera.x * 0.1, h * 0.62, 30, '#7fc08a', 0.004, 0.011);
      G.Cave._ridge(ctx, w, h, camera.x * 0.2, h * 0.72, 22, '#5ea872', 0.006, 0.017);
      for (const [par, cell, s, trunk, leaf, light, seed] of [
        [0.25, 150, 0.8, '#4a6b45', '#3f8f5a', '#58a874', 3],
        [0.5, 240, 1.2, '#6b4a2a', '#2f7d4a', '#4fa86a', 4],
      ]) {
        const off = camera.x * par;
        const i0 = Math.floor(off / cell) - 1;
        const i1 = Math.ceil((off + w) / cell) + 1;
        for (let i = i0; i <= i1; i++) {
          if (rnd(i, seed, 1) < 0.2) continue;
          tree(ctx, i * cell + rnd(i, seed, 2) * cell * 0.7 - off, h * 0.8 + rnd(i, seed, 3) * 24, s * (0.85 + rnd(i, seed, 4) * 0.35), trunk, leaf, light);
        }
      }
      ctx.fillStyle = 'rgba(255,255,230,0.09)'; // 나뭇잎 사이로 내리는 빛줄기
      for (let i = 0; i < 4; i++) {
        const x = ((i * 280 + 80 - camera.x * 0.15) % (w + 200) + w + 200) % (w + 200) - 100;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 20, h * 0.8); ctx.lineTo(x - 80, h * 0.8); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,200,0.85)'; // 반짝이는 꽃가루
      for (let i = 0; i < 26; i++) {
        const x = (((rnd(i, 7, 1) * w + time * (8 + rnd(i, 7, 2) * 14) - camera.x * 0.3) % w) + w) % w;
        const y = ((rnd(i, 7, 3) * h * 0.8 + Math.sin(time * 1.4 + i) * 12) % (h * 0.8));
        ctx.fillRect(x, y, 2, 2);
      }
    },
    drawCeiling: noCeiling,
    drawDecor: exitDecor,
    drawTile(ctx, terrain, c, r) {
      const x = c * TILE;
      const y = r * TILE;
      const { above, below, left, right } = neighbors(terrain, c, r);
      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix([88, 62, 38], [70, 48, 30], v) : mix([128, 90, 56], [104, 72, 44], v);
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + Math.floor(rnd(c, r, 20 + k) * (TILE - 8)), y + 6 + Math.floor(rnd(c, r, 30 + k) * (TILE - 12)), 6 + Math.floor(rnd(c, r, 40 + k) * 8), 3);
      if (rnd(c, r, 5) > 0.78) { // 작은 돌
        ctx.fillStyle = '#9a9488';
        ctx.fillRect(x + 6 + Math.floor(rnd(c, r, 6) * 18), y + 10 + Math.floor(rnd(c, r, 7) * 14), 5, 4);
      }
      shade(ctx, x, y, left, right, below, 0.2);
      if (!above) { // 풀 덮개
        ctx.fillStyle = '#3f9a45';
        ctx.fillRect(x, y, TILE, 8);
        ctx.fillStyle = '#6fd25a';
        ctx.fillRect(x, y, TILE, 3);
        for (let sx = 0; sx < TILE; sx += 4) {
          const hgt = 3 + Math.floor(rnd(c * 8 + sx / 4, r, 9) * 6);
          ctx.fillStyle = '#3f9a45';
          ctx.fillRect(x + sx, y + 8, 4, hgt);
          if (rnd(c * 8 + sx / 4, r, 10) > 0.75) { ctx.fillStyle = '#ffd54a'; ctx.fillRect(x + sx, y - 3, 3, 3); } // 작은 꽃
        }
      }
    },
    drawVignette: vignette('10,40,20', 0.18),
  };

  // ======================= 설산 =======================
  const Snow = {
    rnd,
    drawBackground(ctx, w, h, camera, time) {
      sky(ctx, w, h, [[0, '#a9cdee'], [0.6, '#dcecf8'], [1, '#f4fbff']]);
      glow(ctx, w * 0.78, h * 0.16, 130, '255,255,255', 0.7);
      for (const [par, cell, hh, col, cap, seed] of [[0.07, 330, 230, '#8fa9c8', '#ffffff', 1], [0.16, 240, 170, '#6f8aae', '#f0f7ff', 2]]) {
        const off = camera.x * par;
        const i0 = Math.floor(off / cell) - 1;
        const i1 = Math.ceil((off + w) / cell) + 1;
        for (let i = i0; i <= i1; i++) {
          const x = i * cell + rnd(i, seed, 1) * 60 - off;
          const top = h * 0.8 - hh * (0.7 + rnd(i, seed, 2) * 0.5);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(x - cell * 0.6, h * 0.8); ctx.lineTo(x, top); ctx.lineTo(x + cell * 0.6, h * 0.8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = cap;
          ctx.beginPath(); ctx.moveTo(x - cell * 0.17, top + (h * 0.8 - top) * 0.28); ctx.lineTo(x, top); ctx.lineTo(x + cell * 0.17, top + (h * 0.8 - top) * 0.28); ctx.lineTo(x + 8, top + (h * 0.8 - top) * 0.22); ctx.lineTo(x - 6, top + (h * 0.8 - top) * 0.3); ctx.closePath(); ctx.fill();
        }
      }
      const poff = camera.x * 0.38; // 눈 쌓인 소나무
      for (let i = Math.floor(poff / 120) - 1; i <= Math.ceil((poff + w) / 120) + 1; i++) {
        if (rnd(i, 3, 1) < 0.3) continue;
        const x = i * 120 + rnd(i, 3, 2) * 70 - poff;
        const base = h * 0.82 + rnd(i, 3, 3) * 20;
        for (let k = 0; k < 3; k++) {
          const wk = 44 - k * 11;
          const yk = base - 26 - k * 24;
          ctx.fillStyle = '#2f6b58';
          ctx.beginPath(); ctx.moveTo(x - wk, yk + 24); ctx.lineTo(x, yk - 12); ctx.lineTo(x + wk, yk + 24); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f4faff';
          ctx.beginPath(); ctx.moveTo(x - wk * 0.6, yk + 6); ctx.lineTo(x, yk - 12); ctx.lineTo(x + wk * 0.6, yk + 6); ctx.lineTo(x + wk * 0.3, yk + 12); ctx.lineTo(x - wk * 0.2, yk + 7); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(x - 4, base - 4, 8, 14);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; // 내리는 눈
      for (let i = 0; i < 70; i++) {
        const layer = 0.3 + rnd(i, 8, 4) * 0.9;
        const x = (((rnd(i, 8, 1) * w + time * (10 + rnd(i, 8, 2) * 24) - camera.x * layer * 0.5) % w) + w) % w;
        const y = (rnd(i, 8, 3) * h + time * (34 + rnd(i, 8, 5) * 50)) % h;
        const s = layer > 0.8 ? 3 : 2;
        ctx.fillRect(x, y, s, s);
      }
    },
    drawCeiling: noCeiling,
    drawDecor: exitDecor,
    drawTile(ctx, terrain, c, r) {
      const x = c * TILE;
      const y = r * TILE;
      const { above, below, left, right } = neighbors(terrain, c, r);
      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix([96, 138, 186], [82, 122, 172], v) : mix([150, 194, 226], [124, 170, 210], v);
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; // 얼음 결
      for (let k = 0; k < 3; k++) ctx.fillRect(x + Math.floor(rnd(c, r, 20 + k) * (TILE - 10)), y + 6 + Math.floor(rnd(c, r, 30 + k) * (TILE - 12)), 7 + Math.floor(rnd(c, r, 40 + k) * 8), 2);
      if (rnd(c, r, 2) > 0.7) { // 금
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        const cx = x + 6 + Math.floor(rnd(c, r, 3) * (TILE - 12));
        ctx.beginPath(); ctx.moveTo(cx, y + 3); ctx.lineTo(cx + 4, y + 12); ctx.lineTo(cx - 2, y + 20); ctx.lineTo(cx + 3, y + 29); ctx.stroke();
      }
      shade(ctx, x, y, left, right, below, 0.2);
      if (!above) { // 눈 덮개 + 반짝이는 얼음 윗면
        ctx.fillStyle = '#f7fcff';
        ctx.fillRect(x, y, TILE, 8);
        for (let sx = 0; sx < TILE; sx += 4) ctx.fillRect(x + sx, y + 8, 4, 2 + Math.floor(rnd(c * 8 + sx / 4, r, 9) * 5));
        ctx.fillStyle = 'rgba(160,210,255,0.55)';
        ctx.fillRect(x, y + 5, TILE, 2);
        if (rnd(c, r, 11) > 0.7) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 8 + Math.floor(rnd(c, r, 12) * 14), y + 1, 3, 3); }
      }
      if (!below) { // 고드름
        ctx.fillStyle = '#d6efff';
        const sx = x + 4 + Math.floor(rnd(c, r, 13) * (TILE - 14));
        const len = 6 + Math.floor(rnd(c, r, 14) * 10);
        ctx.beginPath(); ctx.moveTo(sx, y + TILE - 2); ctx.lineTo(sx + 8, y + TILE - 2); ctx.lineTo(sx + 4, y + TILE + len); ctx.closePath(); ctx.fill();
      }
    },
    drawVignette: vignette('20,40,80', 0.2),
  };

  // ======================= 화산 =======================
  const Volcano = {
    rnd,
    drawBackground(ctx, w, h, camera, time) {
      sky(ctx, w, h, [[0, '#1a0608'], [0.5, '#4a1210'], [0.85, '#b8330f'], [1, '#ff7a1f']]);
      glow(ctx, w * 0.5 - camera.x * 0.05, h * 0.42, 260, '255,110,40', 0.35 + 0.08 * Math.sin(time * 2));
      const off = camera.x * 0.1; // 큰 화산 실루엣 + 분화구의 불빛
      for (let i = Math.floor(off / 520) - 1; i <= Math.ceil((off + w) / 520) + 1; i++) {
        const x = i * 520 + 200 - off;
        ctx.fillStyle = '#240a0c';
        ctx.beginPath(); ctx.moveTo(x - 300, h); ctx.lineTo(x - 54, h * 0.3); ctx.lineTo(x + 54, h * 0.3); ctx.lineTo(x + 300, h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,140,40,${0.8 + 0.2 * Math.sin(time * 5 + i)})`;
        ctx.fillRect(x - 46, h * 0.3 - 3, 92, 6);
        ctx.strokeStyle = 'rgba(255,100,30,0.75)'; // 흘러내리는 용암줄기
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 20, h * 0.3); ctx.quadraticCurveTo(x - 80, h * 0.55, x - 120, h * 0.78); ctx.moveTo(x + 24, h * 0.3); ctx.quadraticCurveTo(x + 70, h * 0.6, x + 110, h * 0.8); ctx.stroke();
      }
      G.Cave._ridge(ctx, w, h, camera.x * 0.28, h * 0.8, 20, '#1c090b', 0.007, 0.019);
      ctx.fillStyle = 'rgba(10,2,4,0.5)'; // 재 구름
      for (let i = 0; i < 5; i++) {
        const x = (((i * 260 + time * 10 - camera.x * 0.12) % (w + 300)) + w + 300) % (w + 300) - 150;
        ctx.beginPath(); ctx.ellipse(x, 60 + (i % 3) * 36, 110, 24, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,170,60,0.9)'; // 솟아오르는 불씨
      for (let i = 0; i < 46; i++) {
        const x = (((rnd(i, 9, 1) * w + Math.sin(time * 2 + i) * 14 - camera.x * 0.35) % w) + w) % w;
        const y = h - ((rnd(i, 9, 2) * h + time * (30 + rnd(i, 9, 3) * 50)) % h);
        ctx.fillRect(x, y, 2, 2);
      }
      // 맨 아래: 끓는 용암 (구덩이 속이 이 용암으로 보인다)
      const top = h - 64;
      const lava = ctx.createLinearGradient(0, top - 30, 0, h);
      lava.addColorStop(0, 'rgba(255,120,30,0)');
      lava.addColorStop(0.35, '#ff7a1f');
      lava.addColorStop(1, '#c62a0a');
      ctx.fillStyle = lava;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, top + Math.sin((x + camera.x * 0.6) * 0.05 + time * 2.2) * 4);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,120,0.8)';
      for (let i = 0; i < 12; i++) {
        const x = (((rnd(i, 10, 1) * w - camera.x * 0.6) % w) + w) % w;
        if (Math.sin(time * 3 + i * 2) > 0.2) ctx.fillRect(x, top + 10 + rnd(i, 10, 2) * 40, 10, 2);
      }
    },
    drawCeiling: noCeiling,
    drawDecor: exitDecor,
    drawTile(ctx, terrain, c, r) {
      const x = c * TILE;
      const y = r * TILE;
      const { above, below, left, right } = neighbors(terrain, c, r);
      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix([44, 28, 34], [34, 22, 28], v) : mix([66, 44, 50], [52, 36, 42], v);
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + Math.floor(rnd(c, r, 20 + k) * (TILE - 10)), y + 5 + Math.floor(rnd(c, r, 30 + k) * (TILE - 10)), 8 + Math.floor(rnd(c, r, 40 + k) * 10), 3);
      if (rnd(c, r, 2) > 0.62) { // 갈라진 틈으로 비치는 용암빛
        ctx.strokeStyle = 'rgba(255,120,30,0.85)';
        ctx.lineWidth = 2;
        const cx = x + 6 + Math.floor(rnd(c, r, 3) * (TILE - 12));
        ctx.beginPath(); ctx.moveTo(cx, y + 2); ctx.lineTo(cx + 5, y + 11); ctx.lineTo(cx - 3, y + 19); ctx.lineTo(cx + 3, y + 29); ctx.stroke();
      }
      shade(ctx, x, y, left, right, below, 0.28);
      if (!above) { // 식은 용암 껍질 + 달아오른 가장자리
        ctx.fillStyle = '#5a3a40';
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = 'rgba(255,140,50,0.85)';
        ctx.fillRect(x, y + 4, TILE, 2);
        if (rnd(c, r, 11) > 0.7) { ctx.fillStyle = '#ffb347'; ctx.fillRect(x + 6 + Math.floor(rnd(c, r, 12) * 18), y - 2, 3, 3); }
      }
    },
    drawVignette: vignette('30,4,2', 0.3),
  };

  G.Forest = Forest;
  G.Snow = Snow;
  G.Volcano = Volcano;
})(window.Game);
