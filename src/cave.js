// 동굴 테마 그리기: 시차(parallax) 배경, 돌 질감의 땅, 천장 종유석, 어두운 가장자리.
// 모든 무늬는 좌표 해시로 정해지므로 프레임마다 같은 모양이다 (깜빡이지 않음).
(function (G) {
  const { TILE } = G.Config;

  // 정수 좌표 -> 0~1 의사난수 (k로 용도를 구분)
  function rnd(a, b, k = 0) {
    let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(k | 0, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function mix(c1, c2, t) {
    return `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
  }

  const ROCK_LIGHT = [74, 80, 104];
  const ROCK_DARK = [48, 53, 74];
  const DEEP_LIGHT = [44, 48, 68];  // 위가 막힌(깊은 곳) 돌
  const DEEP_DARK = [32, 36, 54];

  const Cave = {
    rnd,

    // 화면 전체 배경 (카메라 위치에 따라 층마다 다른 속도로 움직여 깊이감을 준다)
    drawBackground(ctx, w, h, camera, time) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#080a15');
      g.addColorStop(0.55, '#141932');
      g.addColorStop(1, '#241b3b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 먼 곳: 천장에서 늘어진 거대한 종유석 실루엣
      this._stalactites(ctx, w, camera.x * 0.15, 150, 40, 120, '#0f1226', 1);
      // 먼 능선
      this._ridge(ctx, w, h, camera.x * 0.15, h * 0.66, 34, '#10142a', 0.004, 0.011);
      // 가운데: 빛나는 수정
      this._crystals(ctx, w, h, camera.x * 0.45, time);
      // 가까운 능선 + 석순
      this._ridge(ctx, w, h, camera.x * 0.32, h * 0.78, 24, '#171c36', 0.006, 0.017);
      this._stalagmites(ctx, w, h, camera.x * 0.32, 110, '#171c36');
    },

    // 천장에서 아래로 뾰족하게 늘어진 바위. offset은 시차가 적용된 가로 이동량
    _stalactites(ctx, w, offset, cell, minLen, maxLen, color, seed) {
      ctx.fillStyle = color;
      const i0 = Math.floor(offset / cell) - 1;
      const i1 = Math.ceil((offset + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        const x = i * cell + rnd(i, seed, 1) * cell * 0.6 - offset;
        const len = minLen + rnd(i, seed, 2) * (maxLen - minLen);
        const half = 14 + rnd(i, seed, 3) * 18;
        ctx.beginPath();
        ctx.moveTo(x - half, -2);
        ctx.lineTo(x + half, -2);
        ctx.lineTo(x + (rnd(i, seed, 4) - 0.5) * 10, len);
        ctx.closePath();
        ctx.fill();
      }
    },

    // 물결치는 능선을 아래쪽까지 채움
    _ridge(ctx, w, h, offset, base, amp, color, f1, f2) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let sx = 0; sx <= w + 16; sx += 16) {
        const wx = sx + offset;
        const y = base + Math.sin(wx * f1) * amp + Math.sin(wx * f2 + 1.7) * amp * 0.45;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(w + 16, h);
      ctx.closePath();
      ctx.fill();
    },

    // 바닥에서 솟은 석순
    _stalagmites(ctx, w, h, offset, cell, color) {
      ctx.fillStyle = color;
      const i0 = Math.floor(offset / cell) - 1;
      const i1 = Math.ceil((offset + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        if (rnd(i, 9, 5) < 0.35) continue;
        const x = i * cell + rnd(i, 9, 1) * cell * 0.7 - offset;
        const top = h * 0.8 - 20 - rnd(i, 9, 2) * 50;
        const half = 10 + rnd(i, 9, 3) * 12;
        ctx.beginPath();
        ctx.moveTo(x - half, h);
        ctx.lineTo(x, top);
        ctx.lineTo(x + half, h);
        ctx.closePath();
        ctx.fill();
      }
    },

    // 은은하게 맥동하는 푸른/보라/청록 수정 무리
    _crystals(ctx, w, h, offset, time) {
      const cell = 300;
      const i0 = Math.floor(offset / cell) - 1;
      const i1 = Math.ceil((offset + w) / cell) + 1;
      const colors = [[110, 210, 255], [185, 140, 255], [120, 255, 200]];
      for (let i = i0; i <= i1; i++) {
        if (rnd(i, 3, 7) < 0.3) continue;
        const col = colors[Math.floor(rnd(i, 3, 8) * colors.length)];
        const x = i * cell + rnd(i, 3, 1) * cell - offset;
        const y = h * (0.22 + rnd(i, 3, 2) * 0.5);
        const pulse = 0.75 + 0.25 * Math.sin(time * 1.6 + i * 1.3);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 70);
        glow.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.22 * pulse})`);
        glow.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - 70, y - 70, 140, 140);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.85 * pulse})`;
        for (let k = -1; k <= 1; k++) { // 뾰족한 마름모 3개
          const hh = 12 + rnd(i, k + 5, 4) * 12;
          const cx = x + k * 7;
          ctx.beginPath();
          ctx.moveTo(cx, y - hh);
          ctx.lineTo(cx + 4, y);
          ctx.lineTo(cx, y + hh * 0.45);
          ctx.lineTo(cx - 4, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    },

    // 맵 천장(y=0)에 매달린 종유석 띠. 월드 좌표계에서 그린다 (카메라가 맨 위일 때만 보인다)
    drawCeiling(ctx, camera, w) {
      if (camera.y > 80) return;
      ctx.fillStyle = '#20243a';
      ctx.fillRect(camera.x, -4, w, 14);
      ctx.fillStyle = '#2c3150';
      ctx.fillRect(camera.x, -4, w, 6);
      const cell = 28;
      const i0 = Math.floor(camera.x / cell) - 1;
      const i1 = Math.ceil((camera.x + w) / cell) + 1;
      for (let i = i0; i <= i1; i++) {
        const r = rnd(i, 1, 11);
        if (r < 0.35) continue;
        const x = i * cell + rnd(i, 1, 12) * cell;
        const len = 8 + rnd(i, 1, 13) * 24;
        const half = 5 + rnd(i, 1, 14) * 6;
        ctx.fillStyle = r > 0.8 ? '#30365a' : '#262b47';
        ctx.beginPath();
        ctx.moveTo(x - half, 8);
        ctx.lineTo(x + half, 8);
        ctx.lineTo(x, 8 + len);
        ctx.closePath();
        ctx.fill();
      }
    },

    // 땅 타일 한 칸: 돌 질감 + 위가 열려 있으면 이끼, 아래가 열려 있으면 종유석
    drawTile(ctx, terrain, c, r) {
      const x = c * TILE;
      const y = r * TILE;
      const above = r > 0 && terrain.grid[r - 1][c];
      const below = r + 1 < terrain.rows && terrain.grid[r + 1][c];
      const left = c > 0 && terrain.grid[r][c - 1];
      const right = c + 1 < terrain.cols && terrain.grid[r][c + 1];
      const deep = above; // 위도 돌이면 안쪽(더 어둡게)

      // 바탕: 타일마다 살짝 다른 명도
      const v = rnd(c, r, 1);
      ctx.fillStyle = deep ? mix(DEEP_DARK, DEEP_LIGHT, v) : mix(ROCK_DARK, ROCK_LIGHT, v);
      ctx.fillRect(x, y, TILE, TILE);

      // 암석 결: 가로로 흐르는 얇은 줄 몇 개
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      for (let k = 0; k < 3; k++) {
        const ly = y + 5 + Math.floor(rnd(c, r, 20 + k) * (TILE - 10));
        const lx = x + Math.floor(rnd(c, r, 30 + k) * 10);
        ctx.fillRect(lx, ly, 8 + Math.floor(rnd(c, r, 40 + k) * 14), 2);
      }
      // 균열
      if (rnd(c, r, 2) > 0.72) {
        const cx = x + 6 + Math.floor(rnd(c, r, 3) * (TILE - 12));
        ctx.strokeStyle = 'rgba(8,10,20,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, y + 3);
        ctx.lineTo(cx + 4, y + 11);
        ctx.lineTo(cx - 2, y + 18);
        ctx.lineTo(cx + 3, y + 27);
        ctx.stroke();
      }
      // 작은 광물 알갱이
      if (rnd(c, r, 4) > 0.8) {
        ctx.fillStyle = 'rgba(140,200,255,0.55)';
        ctx.fillRect(x + 4 + Math.floor(rnd(c, r, 5) * 22), y + 8 + Math.floor(rnd(c, r, 6) * 16), 2, 2);
      }

      // 옆면/아랫면 그림자로 입체감
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      if (!right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      if (!left) ctx.fillRect(x, y, 2, TILE);
      if (!below) ctx.fillRect(x, y + TILE - 4, TILE, 4);

      // 위가 열려 있는 면: 젖은 돌 하이라이트 + 이끼
      if (!above) {
        ctx.fillStyle = 'rgba(160,175,215,0.5)';
        ctx.fillRect(x, y, TILE, 2);
        for (let sx = 0; sx < TILE; sx += 4) { // 들쭉날쭉한 이끼 띠
          const hgt = 4 + Math.floor(rnd(c * 8 + sx / 4, r, 7) * 5);
          ctx.fillStyle = '#2d6b5b';
          ctx.fillRect(x + sx, y + 2, 4, hgt);
          ctx.fillStyle = '#3f9a80';
          ctx.fillRect(x + sx, y + 2, 4, 2);
        }
      }

      // 아래가 열려 있는 면: 뾰족한 종유석
      if (!below) {
        const n = rnd(c, r, 8) > 0.45 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const sx = x + 4 + Math.floor(rnd(c, r, 9 + k) * (TILE - 14));
          const len = 6 + Math.floor(rnd(c, r, 12 + k) * 10);
          ctx.fillStyle = '#2a2f4a';
          ctx.beginPath();
          ctx.moveTo(sx, y + TILE - 2);
          ctx.lineTo(sx + 10, y + TILE - 2);
          ctx.lineTo(sx + 5, y + TILE + len);
          ctx.closePath();
          ctx.fill();
        }
      }
    },

    // 화면 가장자리를 어둡게 + 아래쪽(구덩이)을 더 깊게 보이게 하는 오버레이
    drawVignette(ctx, w, h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.68);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(2,3,10,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const b = ctx.createLinearGradient(0, h - 90, 0, h);
      b.addColorStop(0, 'rgba(0,0,0,0)');
      b.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = b;
      ctx.fillRect(0, h - 90, w, 90);
    },
  };

  G.Cave = Cave;
})(window.Game);
