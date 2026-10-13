// 방사능 공장 테마: 하수구 끝에서 이어지는, 방사능을 만들어 내는 낡은 공장.
// 동굴 테마(cave.js)를 바탕으로 배경, 천장, 땅 타일을 강철판 공장으로 바꾼다. 무늬는 좌표 해시라 프레임마다 같은 모양이다.
(function (G) {
  const { TILE } = G.Config;
  const Cave = G.Cave;
  const rnd = Cave.rnd;
  const mix = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
  const STEEL_LIGHT = [78, 84, 92];
  const STEEL_DARK = [48, 53, 60];
  const DEEP_LIGHT = [36, 40, 46];
  const DEEP_DARK = [26, 29, 34];

  // 방사능 표시 (삼엽 마크)
  function trefoil(ctx, x, y, r, a) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = `rgba(240,220,40,${a})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(20,20,20,${a})`;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.82, k * 2.094 - 0.52 - 1.57, k * 2.094 + 0.52 - 1.57); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const Factory = Object.assign(Object.create(Cave), {
    trefoil,

    drawBackground(ctx, w, h, camera, time) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#08100a');
      g.addColorStop(0.55, '#101a12');
      g.addColorStop(1, '#16281a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 먼 곳: 거대한 탱크와 굴뚝 실루엣
      const off = camera.x * 0.18, cell = 260, i0 = Math.floor(off / cell) - 1, i1 = Math.ceil((off + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        const x = i * cell - off, tall = rnd(i, 3, 1) > 0.5;
        ctx.fillStyle = '#0b130d';
        if (tall) { ctx.fillRect(x + 40, h * 0.12, 46, h); ctx.fillRect(x + 32, h * 0.12, 62, 10); } // 굴뚝
        else { ctx.fillRect(x + 20, h * 0.38, 150, h); ctx.beginPath(); ctx.ellipse(x + 95, h * 0.38, 75, 18, 0, Math.PI, 0); ctx.fill(); } // 탱크
        ctx.fillStyle = 'rgba(120,255,90,0.1)'; // 굴뚝/탱크 위로 떠오르는 초록 연기
        const ph = (time * 0.12 + rnd(i, 3, 2)) % 1;
        ctx.beginPath(); ctx.ellipse(x + 63 + Math.sin(time + i) * 10, h * 0.12 - ph * 80, 26 + ph * 40, 14 + ph * 20, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 가운데: 방사능 용액이 담긴 유리 통 (빛나는 초록, 방울이 올라온다)
      const off2 = camera.x * 0.4, c2 = 220, j0 = Math.floor(off2 / c2) - 1, j1 = Math.ceil((off2 + w) / c2) + 1;
      for (let j = j0; j <= j1; j++) {
        const x = j * c2 - off2 + 40, top = h * 0.3, bot = h * 0.86;
        const pulse = 0.55 + 0.15 * Math.sin(time * 2 + j);
        const lg = ctx.createLinearGradient(0, top, 0, bot); lg.addColorStop(0, `rgba(90,255,80,${0.2 * pulse})`); lg.addColorStop(1, `rgba(60,220,60,${0.5 * pulse})`);
        ctx.fillStyle = lg; ctx.fillRect(x, top, 70, bot - top);
        ctx.strokeStyle = '#2c3a30'; ctx.lineWidth = 5; ctx.strokeRect(x, top, 70, bot - top);
        for (let k = 0; k < 4; k++) { const ph = (time * 0.35 + k * 0.27 + j * 0.13) % 1; ctx.fillStyle = `rgba(200,255,150,${0.6 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x + 12 + k * 15, bot - ph * (bot - top), 2.5 + (k % 2), 0, Math.PI * 2); ctx.fill(); }
        if (rnd(j, 4, 1) > 0.4) trefoil(ctx, x + 35, top - 26, 14, 0.7); // 통 위의 방사능 표지
        const gl = ctx.createRadialGradient(x + 35, (top + bot) / 2, 4, x + 35, (top + bot) / 2, 150); gl.addColorStop(0, `rgba(110,255,90,${0.16 * pulse})`); gl.addColorStop(1, 'rgba(110,255,90,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - 120, top - 60, 310, bot - top + 140);
      }
      // 앞쪽: 가로 배관과 경고 줄무늬 띠
      const py = h * 0.18, off3 = camera.x * 0.3;
      ctx.fillStyle = '#1e2822'; ctx.fillRect(0, py, w, 22);
      ctx.fillStyle = '#2f3d34'; ctx.fillRect(0, py, w, 6);
      for (let x = -((off3) % 40) - 40; x < w + 40; x += 40) { ctx.fillStyle = 'rgba(230,200,30,0.55)'; ctx.beginPath(); ctx.moveTo(x, py + 22); ctx.lineTo(x + 14, py + 22); ctx.lineTo(x + 24, py + 30); ctx.lineTo(x + 10, py + 30); ctx.closePath(); ctx.fill(); }
    },

    drawCeiling(ctx, camera, w) {
      if (camera.y > 80) return;
      ctx.fillStyle = '#1a2024'; ctx.fillRect(camera.x, -4, w, 16);
      ctx.fillStyle = '#2c353a'; ctx.fillRect(camera.x, -4, w, 6);
      const cell = 64, i0 = Math.floor(camera.x / cell) - 1, i1 = Math.ceil((camera.x + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        ctx.fillStyle = '#12171a'; ctx.fillRect(i * cell, 6, 6, 8); // 대들보 이음
        if (rnd(i, 1, 21) > 0.55) { // 매달린 형광등 (가끔 깜빡인다)
          const x = i * cell + 20, on = Math.floor(performance.now() / 120 + rnd(i, 1, 22) * 40) % 11 !== 0;
          ctx.fillStyle = '#3a4448'; ctx.fillRect(x + 14, 10, 2, 10);
          ctx.fillStyle = on ? '#d8ffd0' : '#4a5a4a'; ctx.fillRect(x, 20, 30, 5);
          if (on) { const gl = ctx.createRadialGradient(x + 15, 24, 2, x + 15, 24, 60); gl.addColorStop(0, 'rgba(180,255,150,0.25)'); gl.addColorStop(1, 'rgba(180,255,150,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 45, 10, 120, 100); }
        }
      }
    },

    drawTile(ctx, terrain, c, r) {
      const x = c * TILE, y = r * TILE;
      const above = r > 0 && terrain.grid[r - 1][c];
      const below = r + 1 < terrain.rows && terrain.grid[r + 1][c];
      const left = c > 0 && terrain.grid[r][c - 1];
      const right = c + 1 < terrain.cols && terrain.grid[r][c + 1];
      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix(DEEP_DARK, DEEP_LIGHT, v) : mix(STEEL_DARK, STEEL_LIGHT, v);
      ctx.fillRect(x, y, TILE, TILE);
      // 강철판 이음과 리벳
      ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(x, y + TILE - 1, TILE, 1); ctx.fillRect(x + TILE - 1, y, 1, TILE);
      ctx.fillStyle = 'rgba(210,220,225,0.35)';
      for (const [rx, ry] of [[4, 4], [TILE - 6, 4], [4, TILE - 6], [TILE - 6, TILE - 6]]) ctx.fillRect(x + rx, y + ry, 2, 2);
      if (rnd(c, r, 2) > 0.8) { ctx.fillStyle = 'rgba(120,255,90,0.2)'; ctx.fillRect(x + Math.floor(rnd(c, r, 3) * 18), y + 6 + Math.floor(rnd(c, r, 4) * 14), 10, 4); } // 방사능 얼룩
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      if (!right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      if (!left) ctx.fillRect(x, y, 2, TILE);
      if (!below) ctx.fillRect(x, y + TILE - 4, TILE, 4);
      if (!above) { // 위가 열린 면: 노랑·검정 경고 줄무늬 + 초록 방사능 번들거림
        ctx.fillStyle = '#16181a'; ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = '#e6c81e';
        for (let k = -1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x + k * 10, y + 6); ctx.lineTo(x + k * 10 + 6, y); ctx.lineTo(x + k * 10 + 11, y); ctx.lineTo(x + k * 10 + 5, y + 6); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = 'rgba(150,255,110,0.35)'; ctx.fillRect(x, y + 6, TILE, 2);
      }
      if (!below && rnd(c, r, 8) > 0.55) { // 아래가 열린 면: 새는 방사능 용액
        const sx = x + 6 + Math.floor(rnd(c, r, 9) * (TILE - 12)), len = 5 + Math.floor(rnd(c, r, 12) * 9);
        ctx.fillStyle = '#7dff5a'; ctx.fillRect(sx - 1.5, y + TILE - 2, 3, len); ctx.beginPath(); ctx.arc(sx, y + TILE - 2 + len, 3, 0, Math.PI * 2); ctx.fill();
      }
    },

    // 공장 안은 초록빛 어둠: 가장자리가 어둡다 (동굴 기본 비네트에 초록 기운을 더한다)
    drawVignette(ctx, w, h) {
      Cave.drawVignette.call(this, ctx, w, h);
      const b = ctx.createLinearGradient(0, h - 120, 0, h);
      b.addColorStop(0, 'rgba(110,255,90,0)'); b.addColorStop(1, 'rgba(110,255,90,0.07)');
      ctx.fillStyle = b; ctx.fillRect(0, h - 120, w, 120);
    },
  });

  G.Factory = Factory;
})(window.Game);
