// 챕터 2 왕국의 도시 테마: 높은 성, 먼 도시 풍경, 돌바닥 거리, 가로등과 깃발. 가게/문/시민은 해변 마을(Beach)의 그림을 그대로 쓴다.
(function (G) {
  const T = G.Config.TILE;
  const Beach = G.Beach;
  const rnd = Beach.rnd;

  // 나부끼는 깃발 (poleX, poleTopY)
  function flag(ctx, x, y, color, time, w = 30, h = 18) {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - 1, y, 3, 40);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 2, y);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + 2 + (w * i) / 6, y + Math.sin(time * 4 + i * 0.9 + x * 0.05) * 2.2 + (i % 2 ? 0 : 0.5));
    for (let i = 6; i >= 0; i--) ctx.lineTo(x + 2 + (w * i) / 6, y + h + Math.sin(time * 4 + i * 0.9 + x * 0.05) * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(x + 2 + w * 0.35, y + h * 0.35, w * 0.3, h * 0.3);
  }

  function lamp(ctx, x, baseY, time) {
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(x - 2, baseY - 78, 4, 78);
    ctx.fillRect(x - 6, baseY - 4, 12, 4);
    ctx.fillStyle = '#2a2e38';
    ctx.fillRect(x - 8, baseY - 90, 16, 12);
    const f = 0.8 + 0.2 * Math.sin(time * 5 + x);
    const g = ctx.createRadialGradient(x, baseY - 84, 0, x, baseY - 84, 60);
    g.addColorStop(0, `rgba(255,220,140,${0.5 * f})`);
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, baseY - 144, 120, 120);
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(x - 5, baseY - 88, 10, 8);
  }

  // 큰 성: 가운데 높은 탑, 양옆 탑, 아치 문, 붉은 카펫
  function castle(ctx, x, y, time) {
    const stone = '#d6cfbd', stoneD = '#a89f8a', roofR = '#b02a3a', roofG = '#e0b12f';
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x, y, 330, 8, 0, 0, Math.PI * 2); ctx.fill();
    const tower = (cx, w, h, roof, rh) => {
      ctx.fillStyle = stone; ctx.fillRect(cx - w / 2, y - h, w, h);
      ctx.fillStyle = stoneD; ctx.fillRect(cx + w / 2 - 8, y - h, 8, h);
      for (let r = 0; r < h; r += 18) { ctx.fillStyle = 'rgba(80,70,50,0.12)'; ctx.fillRect(cx - w / 2, y - h + r, w, 2); }
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(cx - w / 2 - 8, y - h); ctx.lineTo(cx, y - h - rh); ctx.lineTo(cx + w / 2 + 8, y - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(cx - w / 2 - 8, y - h); ctx.lineTo(cx, y - h - rh); ctx.lineTo(cx - 4, y - h); ctx.closePath(); ctx.fill();
      for (let k = 0; k < Math.floor(h / 80); k++) { // 창
        ctx.fillStyle = '#2a2a48'; ctx.fillRect(cx - 6, y - h + 30 + k * 70, 12, 22);
        ctx.fillStyle = `rgba(255,214,120,${0.7 + 0.2 * Math.sin(time * 2 + k + cx)})`; ctx.fillRect(cx - 4, y - h + 33 + k * 70, 8, 16);
      }
      flag(ctx, cx, y - h - rh - 34, '#c0273a', time);
    };
    tower(x - 250, 82, 250, roofR, 78);
    tower(x + 250, 82, 250, roofR, 78);
    tower(x - 150, 64, 190, roofG, 60);
    tower(x + 150, 64, 190, roofG, 60);
    // 본관
    ctx.fillStyle = stone; ctx.fillRect(x - 210, y - 170, 420, 170);
    ctx.fillStyle = stoneD; ctx.fillRect(x - 210, y - 8, 420, 8);
    for (let r = 0; r < 170; r += 16) { ctx.fillStyle = 'rgba(80,70,50,0.10)'; ctx.fillRect(x - 210, y - 170 + r, 420, 2); }
    for (let i = 0; i < 22; i++) { ctx.fillStyle = stone; ctx.fillRect(x - 210 + i * 19.5, y - 184, 12, 16); } // 성가퀴
    // 중앙 높은 탑
    ctx.fillStyle = '#e4ddcb'; ctx.fillRect(x - 62, y - 330, 124, 330);
    ctx.fillStyle = stoneD; ctx.fillRect(x + 54, y - 330, 8, 330);
    ctx.fillStyle = roofG; ctx.beginPath(); ctx.moveTo(x - 74, y - 330); ctx.lineTo(x, y - 410); ctx.lineTo(x + 74, y - 330); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(x, y - 418, 7, 0, Math.PI * 2); ctx.fill();
    const gl = ctx.createRadialGradient(x, y - 418, 0, x, y - 418, 50);
    gl.addColorStop(0, `rgba(255,240,160,${0.5 + 0.2 * Math.sin(time * 3)})`); gl.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 50, y - 468, 100, 100);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = '#2a2a48'; ctx.fillRect(x - 8, y - 300 + k * 66, 16, 30); ctx.fillStyle = 'rgba(255,214,120,0.85)'; ctx.fillRect(x - 6, y - 297 + k * 66, 12, 24); }
    flag(ctx, x - 40, y - 380, '#c0273a', time, 34, 20);
    flag(ctx, x + 36, y - 380, '#2a56b8', time, 34, 20);
    // 아치 문 + 금테
    ctx.fillStyle = '#e0b12f'; ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.lineTo(x - 46, y - 92); ctx.arc(x, y - 92, 46, Math.PI, 0); ctx.lineTo(x + 46, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.moveTo(x - 38, y); ctx.lineTo(x - 38, y - 92); ctx.arc(x, y - 92, 38, Math.PI, 0); ctx.lineTo(x + 38, y); ctx.closePath(); ctx.fill();
    const hall = ctx.createLinearGradient(0, y - 130, 0, y);
    hall.addColorStop(0, 'rgba(255,230,160,0.55)'); hall.addColorStop(1, 'rgba(255,200,110,0.15)');
    ctx.fillStyle = hall; ctx.beginPath(); ctx.moveTo(x - 38, y); ctx.lineTo(x - 38, y - 92); ctx.arc(x, y - 92, 38, Math.PI, 0); ctx.lineTo(x + 38, y); ctx.closePath(); ctx.fill();
    // 늘어진 붉은 장식 천
    for (const dx of [-120, -80, 80, 120]) {
      ctx.fillStyle = '#b02a3a'; ctx.fillRect(x + dx - 12, y - 160, 24, 80);
      ctx.beginPath(); ctx.moveTo(x + dx - 12, y - 80); ctx.lineTo(x + dx, y - 66); ctx.lineTo(x + dx + 12, y - 80); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd54a'; ctx.fillRect(x + dx - 4, y - 140, 8, 22);
    }
    // 붉은 카펫
    ctx.fillStyle = '#a01830'; ctx.fillRect(x - 30, y - 3, 60, 3);
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(x - 30, y - 3, 60, 1);
  }

  function king(ctx, x, y, time) {
    // 금빛 왕좌
    ctx.fillStyle = '#7a5a1a'; ctx.fillRect(x - 17, y - 64, 34, 64);
    ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 20, y - 70, 6, 70); ctx.fillRect(x + 14, y - 70, 6, 70); ctx.fillRect(x - 20, y - 8, 40, 8);
    ctx.fillStyle = '#a01830'; ctx.fillRect(x - 13, y - 56, 26, 46);
    G.Npc.draw(ctx, 'king', x, y - 8, -1, time);
    // 왕관의 반짝임
    const a = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.fillStyle = `rgba(255,255,220,${a})`;
    ctx.fillRect(x - 7, y - 54, 2, 2); ctx.fillRect(x + 5, y - 52, 2, 2);
  }

  const Kingdom = Object.assign({}, Beach, {
    drawBackground(ctx, w, h, camera, time) {
      const horizon = h * 0.64;
      let g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, '#5a8fe8'); g.addColorStop(0.55, '#aacdf6'); g.addColorStop(1, '#ffe9c4');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // 해와 빛무리
      const sx = w * 0.78, sy = h * 0.2;
      g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 230);
      g.addColorStop(0, 'rgba(255,248,200,0.95)'); g.addColorStop(0.2, 'rgba(255,236,150,0.5)'); g.addColorStop(1, 'rgba(255,236,150,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 230, sy - 230, 460, 460);
      // 구름
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 6; i++) {
        const span = w + 300;
        const cx = (((i * 230 + time * (5 + i * 2) - camera.x * 0.05) % span) + span) % span - 150;
        const cy = 36 + (i % 3) * 44 + rnd(i, 2, 1) * 20;
        ctx.beginPath(); ctx.ellipse(cx, cy, 62, 17, 0, 0, Math.PI * 2); ctx.ellipse(cx + 34, cy - 10, 36, 15, 0, 0, Math.PI * 2); ctx.ellipse(cx - 30, cy - 6, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 먼 산
      for (const [par, col, amp, base] of [[0.04, '#9ab4dc', 90, 0.62], [0.08, '#8aa4cc', 64, 0.64]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 40; x += 40) ctx.lineTo(x, h * base - amp * (0.5 + 0.5 * Math.sin((x + camera.x * par) * 0.006 + par * 90)) * (0.6 + 0.4 * Math.sin((x + camera.x * par) * 0.0023)));
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      }
      // 아득히 보이는 하얀 성 (왕국의 상징)
      const cx0 = w * 0.34 - camera.x * 0.1;
      ctx.fillStyle = 'rgba(214,214,238,0.85)';
      for (const [dx, tw, th] of [[-120, 40, 130], [-60, 56, 190], [0, 70, 250], [70, 56, 180], [130, 40, 120]]) {
        ctx.fillRect(cx0 + dx - tw / 2, horizon - th, tw, th + 40);
        ctx.beginPath(); ctx.moveTo(cx0 + dx - tw / 2 - 6, horizon - th); ctx.lineTo(cx0 + dx, horizon - th - tw * 0.9); ctx.lineTo(cx0 + dx + tw / 2 + 6, horizon - th); ctx.closePath(); ctx.fill();
      }
      // 도시 지붕들 (두 겹)
      for (const [par, col, roofCol, hs, base] of [[0.16, '#b7aec8', '#9a6a8a', 70, 0.7], [0.3, '#a9a0b8', '#b5545a', 96, 0.78]]) {
        const sp = 90;
        const off = camera.x * par;
        for (let i = Math.floor(off / sp) - 1; i <= Math.ceil((off + w) / sp) + 1; i++) {
          const bw = 60 + rnd(i, 7, 1) * 40;
          const bh = hs * (0.5 + rnd(i, 7, 2) * 0.7);
          const bx = i * sp - off;
          const by = h * base;
          ctx.fillStyle = col; ctx.fillRect(bx, by - bh, bw, bh + h);
          ctx.fillStyle = roofCol; ctx.beginPath(); ctx.moveTo(bx - 5, by - bh); ctx.lineTo(bx + bw / 2, by - bh - 26); ctx.lineTo(bx + bw + 5, by - bh); ctx.closePath(); ctx.fill();
          if (rnd(i, 7, 3) < 0.5) { ctx.fillStyle = 'rgba(255,230,150,0.8)'; ctx.fillRect(bx + bw * 0.3, by - bh * 0.6, 8, 10); ctx.fillRect(bx + bw * 0.6, by - bh * 0.6, 8, 10); }
        }
      }
      // 거리 뒤쪽 담장
      ctx.fillStyle = '#9b95a8'; ctx.fillRect(0, h * 0.86, w, h);
    },

    // 돌바닥: 위가 열린 칸은 밝은 포석, 안쪽은 어두운 벽돌
    drawTile(ctx, terrain, c, r) {
      const x = c * T, y = r * T;
      const above = r > 0 && terrain.grid[r - 1][c];
      if (!above) {
        ctx.fillStyle = '#c4bdae'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#d9d3c4'; ctx.fillRect(x, y, T, 8);
        ctx.fillStyle = 'rgba(70,60,45,0.28)'; ctx.fillRect(x, y + 8, T, 2);
        const off = (r % 2) * 12;
        for (let i = 0; i < 3; i++) { ctx.fillRect(x + ((i * 16 + off) % T), y + 10, 1, T - 10); }
        ctx.fillStyle = 'rgba(70,60,45,0.18)'; ctx.fillRect(x, y + T / 2 + 4, T, 1);
        if (rnd(c, r, 1) < 0.18) { ctx.fillStyle = '#7fb26a'; ctx.fillRect(x + 6 + rnd(c, r, 2) * 28, y + 1, 5, 3); } // 틈새 이끼
      } else {
        ctx.fillStyle = '#7d7889'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + T / 2, T, 2); ctx.fillRect(x + ((r % 2) ? 12 : 30), y, 2, T / 2); ctx.fillRect(x + ((r % 2) ? 30 : 12), y + T / 2, 2, T / 2);
      }
    },

    drawDecor(ctx, terrain, camera, time) {
      const view = camera.viewW + 300;
      const gy = (terrain.rows - 2) * T; // 거리 높이 (땅 윗면)
      // 가로등과 깃발 (거리 따라)
      for (let c = 9; c < terrain.cols - 4; c += 12) {
        const bx = c * T + T / 2;
        if (bx < camera.x - 80 || bx > camera.x + view) continue;
        if (c > 124 && c < 176) continue; // 성이 있는 단에는 없다
        lamp(ctx, bx, gy, time);
      }
      for (let c = 15; c < terrain.cols - 4; c += 24) {
        const bx = c * T + T / 2;
        if (bx < camera.x - 80 || bx > camera.x + view) continue;
        if (c > 120 && c < 180) continue;
        flag(ctx, bx, gy - 120, c % 48 === 15 ? '#c0273a' : '#2a56b8', time, 36, 22);
      }
      for (const C2 of terrain.castles) {
        const bx = C2.col * T + T / 2;
        if (bx < camera.x - 400 || bx > camera.x + view + 200) continue;
        castle(ctx, bx, (C2.row + 1) * T, time);
      }
      Beach.drawDecor(ctx, terrain, camera, time); // 가게, 문, 시민
      for (const K of terrain.kings) {
        const bx = K.col * T + T / 2;
        if (bx < camera.x - 100 || bx > camera.x + view) continue;
        const by = (K.row + 1) * T;
        G.Npc.draw(ctx, 'guard', bx - 60, by, 1, time); // 호위병
        G.Npc.draw(ctx, 'guard', bx + 60, by, -1, time + 1);
        king(ctx, bx, by, time);
        if (G.TextLayer) G.TextLayer.add('왕', bx, by - 82, 'bold 13px sans-serif', '#ffe9a0');
      }
    },

    drawVignette(ctx, w, h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.5, w / 2, h / 2, w * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,60,0.16)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
  });

  G.KingdomTheme = Kingdom;
})(window.Game);
