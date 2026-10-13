// 하수구 테마: 해일의 방 보스 3마리를 쓰러뜨리면 그 앞(오른쪽 문 너머)에 이어지는 지역.
// 동굴 테마(cave.js)를 바탕으로 배경, 천장, 땅 타일만 벽돌 터널로 바꾼다. 무늬는 좌표 해시라 프레임마다 같은 모양이다.
(function (G) {
  const { TILE } = G.Config;
  const Cave = G.Cave;
  const rnd = Cave.rnd;
  const mix = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
  const BRICK_LIGHT = [66, 84, 74];
  const BRICK_DARK = [42, 56, 50];
  const DEEP_LIGHT = [34, 46, 42];
  const DEEP_DARK = [24, 34, 30];

  const Sewer = Object.assign(Object.create(Cave), {
    drawBackground(ctx, w, h, camera, time) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#070d0b');
      g.addColorStop(0.55, '#101c18');
      g.addColorStop(1, '#16281d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 먼 곳: 벽돌 아치 터널이 이어진다
      const off = camera.x * 0.2, cell = 230, i0 = Math.floor(off / cell) - 1, i1 = Math.ceil((off + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        const x = i * cell - off;
        ctx.fillStyle = '#0b1613';
        ctx.fillRect(x, h * 0.2, 34, h);
        ctx.beginPath(); ctx.arc(x + cell / 2 + 17, h * 0.62, cell / 2 - 10, Math.PI, 0); ctx.lineTo(x + cell - 6, h); ctx.lineTo(x + 40, h); ctx.closePath();
        ctx.fillStyle = '#0d1a16'; ctx.fill();
        ctx.strokeStyle = '#13241e'; ctx.lineWidth = 6; ctx.stroke();
      }
      // 가운데: 가로로 지나가는 굵은 배관 (이음 고리와 물방울)
      const off2 = camera.x * 0.38, py = h * 0.24;
      ctx.fillStyle = '#1b2d28'; ctx.fillRect(0, py, w, 26);
      ctx.fillStyle = '#26403a'; ctx.fillRect(0, py, w, 7);
      ctx.fillStyle = '#0d1815'; ctx.fillRect(0, py + 22, w, 4);
      const c2 = 150, j0 = Math.floor(off2 / c2) - 1, j1 = Math.ceil((off2 + w) / c2) + 1;
      for (let j = j0; j <= j1; j++) {
        const x = j * c2 - off2;
        ctx.fillStyle = '#31504a'; ctx.fillRect(x, py - 5, 12, 36);
        ctx.fillStyle = '#0d1815'; ctx.fillRect(x + 12, py - 5, 3, 36);
        if (rnd(j, 5, 1) > 0.45) { // 이음새에서 새는 물방울
          const ph = (time * 0.7 + rnd(j, 5, 2) * 3) % 1, dy = py + 28 + ph * (h * 0.5);
          ctx.fillStyle = `rgba(150,235,120,${0.75 * (1 - ph)})`;
          ctx.beginPath(); ctx.ellipse(x + 6, dy, 2.2, 4.2, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 아래쪽: 오수에서 올라오는 연둣빛 기운
      const gl = ctx.createLinearGradient(0, h * 0.6, 0, h);
      gl.addColorStop(0, 'rgba(110,220,90,0)'); gl.addColorStop(1, `rgba(110,220,90,${0.12 + 0.03 * Math.sin(time * 1.5)})`);
      ctx.fillStyle = gl; ctx.fillRect(0, h * 0.6, w, h * 0.4);
    },

    drawCeiling(ctx, camera, w) {
      if (camera.y > 80) return;
      ctx.fillStyle = '#16231f'; ctx.fillRect(camera.x, -4, w, 16);
      ctx.fillStyle = '#243832'; ctx.fillRect(camera.x, -4, w, 6);
      const cell = 32, i0 = Math.floor(camera.x / cell) - 1, i1 = Math.ceil((camera.x + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(i * cell, 4, 2, 8); // 벽돌 틈
        const r = rnd(i, 1, 11);
        if (r < 0.7) continue;
        const x = i * cell + rnd(i, 1, 12) * cell, len = 8 + rnd(i, 1, 13) * 22; // 천장에서 늘어진 오수 줄기
        ctx.fillStyle = '#5fbf4e'; ctx.fillRect(x - 2, 10, 4, len);
        ctx.beginPath(); ctx.arc(x, 10 + len, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    },

    drawTile(ctx, terrain, c, r) {
      const x = c * TILE, y = r * TILE;
      const above = r > 0 && terrain.grid[r - 1][c];
      const below = r + 1 < terrain.rows && terrain.grid[r + 1][c];
      const left = c > 0 && terrain.grid[r][c - 1];
      const right = c + 1 < terrain.cols && terrain.grid[r][c + 1];
      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix(DEEP_DARK, DEEP_LIGHT, v) : mix(BRICK_DARK, BRICK_LIGHT, v);
      ctx.fillRect(x, y, TILE, TILE);
      // 벽돌 줄눈: 가로 두 줄, 세로 줄눈은 줄마다 엇갈린다
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
      ctx.fillRect(x, y + TILE - 1, TILE, 1);
      ctx.fillRect(x + (r % 2 ? 9 : 22), y, 2, TILE / 2);
      ctx.fillRect(x + (r % 2 ? 22 : 9), y + TILE / 2, 2, TILE / 2);
      if (rnd(c, r, 2) > 0.7) { ctx.fillStyle = 'rgba(95,191,78,0.25)'; ctx.fillRect(x + Math.floor(rnd(c, r, 3) * 20), y + Math.floor(rnd(c, r, 4) * 20), 8, 5); } // 곰팡이
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      if (!right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      if (!left) ctx.fillRect(x, y, 2, TILE);
      if (!below) ctx.fillRect(x, y + TILE - 4, TILE, 4);
      if (!above) { // 위가 열린 면: 번들거리는 연둣빛 오수 찌꺼기
        ctx.fillStyle = 'rgba(190,225,180,0.4)'; ctx.fillRect(x, y, TILE, 2);
        for (let sx = 0; sx < TILE; sx += 4) {
          const hgt = 3 + Math.floor(rnd(c * 8 + sx / 4, r, 7) * 5);
          ctx.fillStyle = '#3f8a35'; ctx.fillRect(x + sx, y + 2, 4, hgt);
          ctx.fillStyle = '#7fd56a'; ctx.fillRect(x + sx, y + 2, 4, 2);
        }
      }
      if (!below && rnd(c, r, 8) > 0.5) { // 아래가 열린 면: 늘어진 오수 방울
        const sx = x + 6 + Math.floor(rnd(c, r, 9) * (TILE - 12)), len = 5 + Math.floor(rnd(c, r, 12) * 9);
        ctx.fillStyle = '#5fbf4e'; ctx.fillRect(sx - 1.5, y + TILE - 2, 3, len);
        ctx.beginPath(); ctx.arc(sx, y + TILE - 2 + len, 3, 0, Math.PI * 2); ctx.fill();
      }
    },
  });

  G.Sewer = Sewer;
})(window.Game);
