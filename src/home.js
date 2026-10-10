// 우리 집: 마을에서 산 집의 겉모습(터), 집 안 스테이지(방 만들기, 꾸밀 자리), 방 테마, 장식품 그림.
// 데이터(집/장식품 목록, 가격, 놓은 것)는 shop.js가 갖고 있고, 여기서는 그림과 방 구조만 맡는다.
//  - 집 종류마다 방 크기와 꾸밀 수 있는 자리 수가 다르다 (바닥 자리 / 벽 자리)
//  - 방 안에서 빈 자리 앞에서 E 키로 장식품을 놓거나 치운다
(function (G) {
  const T = G.Config.TILE;
  const GROUND_Y = 16 * T; // 방 바닥 윗면 y
  const WALL_Y = GROUND_Y - 112; // 벽 장식을 거는 높이 (중심 y): 서서 손이 닿는 높이
  const SLOT_GAP = 124;    // 자리 사이 간격(px). 가구가 서로 붙어 보이도록 촘촘하게

  const houseDef = (typeId) => G.Shop.ITEMS[typeId] || G.Shop.ITEMS.house1;

  // 방: 천장 3줄, 바닥 2줄, 양옆 벽. 왼쪽 문(X) 옆에서 시작
  function levelFor(typeId) {
    const W = houseDef(typeId).cols;
    const rows = [];
    for (let r = 0; r < 18; r++) {
      let s = '';
      for (let c = 0; c < W; c++) {
        let ch = '.';
        if (r <= 2 || r >= 16 || c === 0 || c === W - 1) ch = '#';
        if (r === 15 && c === 2) ch = 'X';
        if (r === 15 && c === 4) ch = 'P';
        s += ch;
      }
      rows.push(s);
    }
    return rows;
  }

  // 꾸밀 수 있는 자리들: [{kind:'floor'|'wall', index, x, y}]
  // 방 한가운데에 촘촘히 모아 놓는다 (바닥 가구 줄과, 그 사이사이 높이의 벽 장식 줄)
  function slots(typeId, terrain) {
    const d = houseDef(typeId);
    const cx = terrain.width / 2 + T; // 문 쪽이 왼쪽이라 살짝 오른쪽으로
    const out = [];
    for (let i = 0; i < d.floor; i++) out.push({ kind: 'floor', index: i, x: cx + (i - (d.floor - 1) / 2) * SLOT_GAP, y: GROUND_Y });
    const shift = (d.floor - d.wall) % 2 === 0 ? SLOT_GAP / 2 : 0; // 벽 장식이 항상 가구와 가구 사이에 오도록 (개수 홀짝에 맞춤)
    for (let i = 0; i < d.wall; i++) out.push({ kind: 'wall', index: i, x: cx + (i - (d.wall - 1) / 2) * SLOT_GAP + shift, y: WALL_Y });
    return out;
  }

  // ---------------- 장식품 그림 ----------------
  // 바닥 가구: (x, y) = 가운데 아래(바닥). 벽 장식: (x, y) = 중심
  const rect = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const circle = (ctx, c, x, y, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

  const DRAW = {
    d_bed(ctx, x, y) {
      rect(ctx, '#6b4423', x - 48, y - 30, 96, 30);
      rect(ctx, '#6b4423', x - 48, y - 52, 10, 52);
      rect(ctx, '#f4f4f4', x - 38, y - 40, 82, 12);
      rect(ctx, '#e8e8f4', x - 36, y - 48, 26, 10);
      rect(ctx, '#4f7fd4', x - 8, y - 38, 52, 10);
      rect(ctx, '#3a62b0', x - 8, y - 38, 52, 3);
    },
    d_shelf(ctx, x, y) {
      rect(ctx, '#6b4423', x - 30, y - 100, 60, 100);
      rect(ctx, '#8a5a2b', x - 27, y - 97, 54, 94);
      const cols = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22'];
      for (let r = 0; r < 3; r++) {
        rect(ctx, '#6b4423', x - 27, y - 66 + r * 32 - 3, 54, 4);
        for (let k = 0; k < 6; k++) rect(ctx, cols[(k + r * 2) % 6], x - 24 + k * 8, y - 94 + r * 32, 6, 28);
      }
    },
    d_table(ctx, x, y) {
      rect(ctx, '#7a5530', x - 44, y - 40, 88, 8);
      rect(ctx, '#6b4423', x - 38, y - 32, 6, 32);
      rect(ctx, '#6b4423', x + 32, y - 32, 6, 32);
      rect(ctx, '#f4f0e8', x - 28, y - 44, 20, 4);
      circle(ctx, '#c0504d', x + 18, y - 50, 8);
      rect(ctx, '#e8d8a8', x + 14, y - 44, 8, 4);
    },
    d_sofa(ctx, x, y) {
      rect(ctx, '#a0302a', x - 48, y - 46, 96, 30);
      rect(ctx, '#c0453d', x - 40, y - 58, 80, 20);
      rect(ctx, '#8a2a24', x - 54, y - 40, 14, 36);
      rect(ctx, '#8a2a24', x + 40, y - 40, 14, 36);
      rect(ctx, '#e0a090', x - 34, y - 36, 68, 10);
      rect(ctx, '#4a2a1a', x - 48, y - 6, 8, 6);
      rect(ctx, '#4a2a1a', x + 40, y - 6, 8, 6);
    },
    d_plant(ctx, x, y) {
      rect(ctx, '#b5651d', x - 14, y - 22, 28, 22);
      rect(ctx, '#8a4a12', x - 16, y - 24, 32, 5);
      ctx.fillStyle = '#3f9a45';
      for (const [dx, dy, r] of [[0, -50, 14], [-14, -42, 11], [14, -42, 11], [0, -64, 10]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
      circle(ctx, '#6fd25a', x - 4, y - 56, 6);
    },
    d_stove(ctx, x, y, time) {
      rect(ctx, '#7a7f8a', x - 34, y - 70, 68, 70);
      rect(ctx, '#5a5f6a', x - 38, y - 76, 76, 8);
      rect(ctx, '#2a2a30', x - 22, y - 50, 44, 34);
      const f = 0.7 + 0.3 * Math.sin((time || 0) * 9);
      ctx.fillStyle = `rgba(255,150,40,${0.8 * f})`;
      ctx.beginPath(); ctx.moveTo(x - 14, y - 18); ctx.lineTo(x - 6, y - 40 - 6 * f); ctx.lineTo(x, y - 24); ctx.lineTo(x + 8, y - 44 - 5 * f); ctx.lineTo(x + 14, y - 18); ctx.closePath(); ctx.fill();
      rect(ctx, '#5a5f6a', x - 8, y - 96, 16, 22);
    },
    d_tank(ctx, x, y, time) {
      rect(ctx, '#6b4423', x - 40, y - 30, 80, 30);
      rect(ctx, '#9fd8f0', x - 36, y - 74, 72, 44);
      rect(ctx, '#6bb8e0', x - 36, y - 56, 72, 26);
      rect(ctx, '#d6b87a', x - 36, y - 34, 72, 4);
      const t = time || 0;
      ctx.fillStyle = '#ff9a3a';
      for (let k = 0; k < 2; k++) { const fx = x - 20 + ((t * 18 + k * 34) % 44); ctx.beginPath(); ctx.ellipse(fx, y - 50 + k * 8, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
      rect(ctx, '#2a8a3a', x + 24, y - 44, 4, 14);
      rect(ctx, '#5a3d17', x - 40, y - 78, 80, 4);
    },
    d_trophy(ctx, x, y) {
      rect(ctx, '#6b4423', x - 34, y - 90, 68, 90);
      rect(ctx, '#bfe8ff', x - 28, y - 84, 56, 62);
      rect(ctx, 'rgba(255,255,255,0.4)', x - 24, y - 80, 8, 52);
      rect(ctx, '#ffd54a', x - 10, y - 58, 20, 8);
      rect(ctx, '#ffd54a', x - 14, y - 74, 28, 18);
      rect(ctx, '#d4a017', x - 3, y - 50, 6, 12);
      rect(ctx, '#ffd54a', x - 12, y - 40, 24, 6);
      circle(ctx, '#8a4fe0', x - 18, y - 30, 4);
      rect(ctx, '#8a5a2b', x - 28, y - 18, 56, 14);
    },
    d_painting(ctx, x, y) {
      rect(ctx, '#7a5530', x - 36, y - 28, 72, 56);
      rect(ctx, '#9fd8f0', x - 31, y - 23, 62, 46);
      rect(ctx, '#6fd25a', x - 31, y + 4, 62, 19);
      ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.moveTo(x - 31, y + 4); ctx.lineTo(x - 8, y - 16); ctx.lineTo(x + 14, y + 4); ctx.fill();
      circle(ctx, '#ffd54a', x + 20, y - 12, 6);
    },
    d_clock(ctx, x, y, time) {
      circle(ctx, '#6b4423', x, y, 28);
      circle(ctx, '#f8f4e8', x, y, 24);
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const t = (time || 0) * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t) * 14, y + Math.sin(t) * 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t * 12) * 20, y + Math.sin(t * 12) * 20); ctx.lineWidth = 2; ctx.stroke();
      ctx.lineCap = 'butt';
      for (let k = 0; k < 4; k++) rect(ctx, '#2a2a30', x + Math.cos(k * Math.PI / 2) * 20 - 1, y + Math.sin(k * Math.PI / 2) * 20 - 1, 3, 3);
    },
    d_swords(ctx, x, y) {
      rect(ctx, '#6b4423', x - 38, y - 26, 76, 52);
      rect(ctx, '#8a5a2b', x - 34, y - 22, 68, 44);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(s * 0.7);
        rect(ctx, '#dfe6f0', -3, -34, 6, 50); rect(ctx, '#ffd54a', -9, 14, 18, 4); rect(ctx, '#5a3d17', -2, 18, 4, 10);
        ctx.restore();
      }
    },
    d_map(ctx, x, y) {
      rect(ctx, '#e8d8a8', x - 34, y - 26, 68, 52);
      rect(ctx, '#b89a5a', x - 36, y - 28, 72, 4); rect(ctx, '#b89a5a', x - 36, y + 24, 72, 4);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 24, y + 12); ctx.quadraticCurveTo(x - 4, y - 14, x + 16, y + 6); ctx.stroke();
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 14, y - 4); ctx.lineTo(x + 24, y + 6); ctx.moveTo(x + 24, y - 4); ctx.lineTo(x + 14, y + 6); ctx.stroke();
    },
    d_flag(ctx, x, y) {
      rect(ctx, '#5a3d17', x - 36, y - 40, 72, 5);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.moveTo(x - 30, y - 36); ctx.lineTo(x + 30, y - 36); ctx.lineTo(x + 30, y + 30); ctx.lineTo(x, y + 18); ctx.lineTo(x - 30, y + 30); ctx.closePath(); ctx.fill();
      circle(ctx, '#ffd54a', x, y - 8, 11);
      rect(ctx, '#c0392b', x - 3, y - 14, 6, 12);
    },
    d_candle(ctx, x, y, time) {
      rect(ctx, '#7a5530', x - 12, y + 6, 24, 8);
      rect(ctx, '#7a5530', x - 3, y - 6, 6, 14);
      rect(ctx, '#f4f0e8', x - 4, y - 24, 8, 20);
      const f = 0.7 + 0.3 * Math.sin((time || 0) * 11);
      const g = ctx.createRadialGradient(x, y - 32, 0, x, y - 32, 40);
      g.addColorStop(0, `rgba(255,220,120,${0.55 * f})`); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 40, y - 72, 80, 80);
      ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.ellipse(x, y - 32, 4, 7 * f, 0, 0, Math.PI * 2); ctx.fill();
    },
    d_deer(ctx, x, y) {
      rect(ctx, '#6b4423', x - 22, y + 4, 44, 30);
      circle(ctx, '#a0724a', x, y + 12, 17);
      rect(ctx, '#2a2a30', x - 8, y + 10, 4, 4); rect(ctx, '#2a2a30', x + 4, y + 10, 4, 4);
      rect(ctx, '#2a2a30', x - 3, y + 22, 6, 4);
      ctx.strokeStyle = '#e6dcc4'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 8 + x, y - 2); ctx.lineTo(s * 24 + x, y - 24); ctx.lineTo(s * 22 + x, y - 40); ctx.moveTo(s * 20 + x, y - 18); ctx.lineTo(s * 36 + x, y - 24); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    },
    d_mirror(ctx, x, y) {
      ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.ellipse(x, y, 26, 36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.ellipse(x, y, 21, 31, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(x - 8, y - 10, 4, 12, -0.4, 0, Math.PI * 2); ctx.fill();
    },
  };
  const drawDecor = (ctx, id, x, y, time) => { if (DRAW[id]) DRAW[id](ctx, x, y, time); };

  // 아이콘(상점/인벤토리): 중심 (0,0) 기준으로 그린다
  function drawDecorIcon(ctx, item, time) {
    const floor = item.place === 'floor';
    ctx.save();
    ctx.scale(0.55, 0.55);
    drawDecor(ctx, item.id, 0, floor ? 44 : 0, time);
    ctx.restore();
  }

  // 집 아이콘 (작은 집)
  function drawHouseIcon(ctx, item) {
    ctx.save();
    ctx.scale(0.28, 0.28);
    drawExterior(ctx, item.id, 0, 90, 0);
    ctx.restore();
  }

  // ---------------- 집 겉모습 (마을의 터) ----------------
  const LOOK = {
    house1: { w: 104, h: 60, wall: '#e8c896', roof: '#a0522d', roofDark: '#6b3410', pat: 'plank', win: 1, h2: 0 },
    house2: { w: 136, h: 74, wall: '#9a6b3c', roof: '#4f8a3a', roofDark: '#2f5a22', pat: 'log', win: 2, h2: 0 },
    house3: { w: 168, h: 112, wall: '#b5523b', roof: '#3a3f4a', roofDark: '#22262e', pat: 'brick', win: 3, h2: 1 },
    house4: { w: 200, h: 88, wall: '#f4f1e8', roof: '#3a8fd4', roofDark: '#1f5f9a', pat: 'plain', win: 4, h2: 0, balcony: true },
    house5: { w: 252, h: 132, wall: '#bfb7a8', roof: '#5a3a8a', roofDark: '#3a2460', pat: 'stone', win: 5, h2: 1, towers: true },
  };

  // typeId = 집 종류. 아직 안 샀으면 빈 터 (팻말)
  function drawExterior(ctx, typeId, baseX, baseY, time) {
    const L = LOOK[typeId];
    if (!L) return;
    const w = L.w;
    const x = baseX - w / 2;
    const top = baseY - L.h;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath(); ctx.ellipse(baseX, baseY, w * 0.6, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (L.towers) { // 저택의 양옆 탑
      for (const tx of [x - 22, x + w - 14]) {
        rect(ctx, L.wall, tx, top - 30, 36, L.h + 30);
        ctx.fillStyle = L.roof; ctx.beginPath(); ctx.moveTo(tx - 6, top - 28); ctx.lineTo(tx + 18, top - 78); ctx.lineTo(tx + 42, top - 28); ctx.closePath(); ctx.fill();
        rect(ctx, '#bfe8ff', tx + 11, top - 6, 14, 20);
      }
    }
    rect(ctx, L.wall, x, top, w, L.h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    if (L.pat === 'plank' || L.pat === 'log') for (let k = 1; k < (L.pat === 'log' ? 9 : 6); k++) ctx.fillRect(x, top + k * (L.h / (L.pat === 'log' ? 9 : 6)) - 1, w, L.pat === 'log' ? 3 : 2);
    if (L.pat === 'brick') for (let r = 0; r < Math.floor(L.h / 10); r++) for (let c = 0; c < Math.floor(w / 20) + 1; c++) ctx.fillRect(x + c * 20 + (r % 2 ? 10 : 0), top + r * 10, 1, 10), ctx.fillRect(x, top + r * 10, w, 1);
    if (L.pat === 'stone') for (let r = 0; r < Math.floor(L.h / 14); r++) ctx.fillRect(x, top + r * 14, w, 1);
    rect(ctx, 'rgba(0,0,0,0.18)', x, top, 5, L.h); rect(ctx, 'rgba(0,0,0,0.18)', x + w - 5, top, 5, L.h);
    // 지붕
    const peak = top - (L.h2 ? 62 : 48);
    ctx.fillStyle = L.roof; ctx.beginPath(); ctx.moveTo(x - 12, top + 4); ctx.lineTo(baseX, peak); ctx.lineTo(x + w + 12, top + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.roofDark; ctx.beginPath(); ctx.moveTo(baseX, peak); ctx.lineTo(x + w + 12, top + 4); ctx.lineTo(x + w - 10, top + 4); ctx.closePath(); ctx.fill();
    rect(ctx, '#9a8a7a', x + w * 0.72, top - 40, 12, 26);
    // 문
    rect(ctx, '#5a3d17', baseX - 14, baseY - 48, 28, 48);
    rect(ctx, '#8a5a2b', baseX - 14, baseY - 48, 28, 5);
    rect(ctx, '#ffd54a', baseX + 7, baseY - 24, 4, 4);
    // 창문
    const n = L.win;
    const rows = L.h2 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const wy = top + 14 + r * 46;
      const cols = Math.max(1, Math.round(n / rows));
      for (let k = 0; k < cols + (r === 0 ? 0 : 0); k++) {
        const wx = x + 14 + ((w - 28 - 24) * (cols === 1 ? 0.15 : k / (cols - 1 || 1)));
        if (r === 0 && Math.abs(wx + 12 - baseX) < 30 && L.h2 === 0) continue;
        rect(ctx, '#5a3d17', wx - 3, wy - 3, 30, 30);
        rect(ctx, '#bfe8ff', wx, wy, 24, 24);
        rect(ctx, 'rgba(255,255,255,0.55)', wx + 3, wy + 3, 6, 10);
        rect(ctx, '#5a3d17', wx + 11, wy, 2, 24);
      }
    }
    if (L.balcony) { rect(ctx, '#7a5530', x + 12, baseY - 44, w - 24, 4); for (let k = 0; k < 9; k++) rect(ctx, '#7a5530', x + 14 + k * ((w - 28) / 8), baseY - 64, 3, 20); }
    // 현관 등불
    const gl = 0.5 + 0.2 * Math.sin((time || 0) * 3);
    ctx.fillStyle = `rgba(255,220,120,${0.3 * gl})`; ctx.beginPath(); ctx.arc(baseX + 24, baseY - 54, 14, 0, Math.PI * 2); ctx.fill();
    rect(ctx, '#ffd54a', baseX + 22, baseY - 58, 5, 7);
  }

  // 마을의 터: 아직 집이 없으면 빈 터(울타리 + 팻말), 있으면 산 집
  function drawLot(ctx, typeId, baseX, baseY, time) {
    if (typeId && LOOK[typeId]) {
      drawExterior(ctx, typeId, baseX, baseY, time);
      rect(ctx, '#5a3d17', baseX - 30, baseY - 8, 60, 6);
      G.TextLayer.add('우리 집', baseX, baseY - 18, 'bold 13px sans-serif', '#fff4c8');
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(baseX, baseY, 110, 6, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = -4; k <= 4; k++) { // 울타리
      rect(ctx, '#8a5a2b', baseX + k * 22 - 3, baseY - 30, 6, 30);
      rect(ctx, '#a66a33', baseX + k * 22 - 4, baseY - 33, 8, 4);
    }
    rect(ctx, '#8a5a2b', baseX - 94, baseY - 22, 188, 5);
    rect(ctx, '#8a5a2b', baseX - 94, baseY - 10, 188, 5);
    rect(ctx, '#5a3d17', baseX - 3, baseY - 90, 6, 62); // 팻말
    rect(ctx, '#e9d8a6', baseX - 40, baseY - 100, 80, 34);
    rect(ctx, '#c0504d', baseX - 40, baseY - 100, 80, 5);
    G.TextLayer.add('빈 터', baseX, baseY - 86, 'bold 15px sans-serif', '#5a3d17');
    G.TextLayer.add('집 구하는 중', baseX, baseY - 72, 'bold 11px sans-serif', '#7a5a2a');
  }

  // ---------------- 방 테마 ----------------
  const STYLE = {
    house1: { wall: '#d9c3a0', stripe: '#cdb28a', wains: '#a9855a', plank: '#9a7a4a', beam: '#6b4423' },
    house2: { wall: '#a67c52', stripe: '#9a7048', wains: '#7a5230', plank: '#8a6238', beam: '#5a3d17' },
    house3: { wall: '#c9a49a', stripe: '#bd988e', wains: '#8a5a50', plank: '#8a7050', beam: '#4a3030' },
    house4: { wall: '#cfe6ee', stripe: '#c2dde8', wains: '#8ab4c4', plank: '#c8b88a', beam: '#6a8a9a' },
    house5: { wall: '#8c7aa0', stripe: '#806e96', wains: '#5a4670', plank: '#6a5a4a', beam: '#3a2a4a' },
  };
  let cur = STYLE.house1;
  const rnd = G.Cave.rnd;

  const HomeTheme = {
    rnd,
    setHouse(typeId) { cur = STYLE[typeId] || STYLE.house1; },
    drawBackground(ctx, w, h, camera) {
      ctx.fillStyle = cur.wall;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = cur.stripe; // 벽지 줄무늬 (방이 넓어도 화면과 같이 흘러간다)
      const off = -(camera.x % 64);
      for (let x = off; x < w; x += 64) ctx.fillRect(x, 0, 28, h);
      for (let wx = 120 - (camera.x % 340); wx < w; wx += 340) { // 창문
        ctx.fillStyle = cur.beam; ctx.fillRect(wx - 5, 110, 110, 130);
        const g = ctx.createLinearGradient(0, 115, 0, 235);
        g.addColorStop(0, '#9fd8f0'); g.addColorStop(1, '#e8f6c8');
        ctx.fillStyle = g; ctx.fillRect(wx, 115, 100, 120);
        ctx.fillStyle = cur.beam; ctx.fillRect(wx + 48, 115, 4, 120); ctx.fillRect(wx, 172, 100, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(wx + 8, 122, 10, 30);
      }
      ctx.fillStyle = cur.wains; // 아랫벽 판자
      ctx.fillRect(0, GROUND_Y - 64 - camera.y, w, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, GROUND_Y - 64 - camera.y, w, 3);
    },
    drawCeiling() {},
    drawTile(ctx, terrain, c, r) {
      const x = c * T;
      const y = r * T;
      const v = rnd(c, r, 1);
      if (r >= 16) { // 마룻바닥
        ctx.fillStyle = r === 16 ? cur.plank : '#5a3d17';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        if (r === 16) { ctx.fillRect(x, y + 11, T, 2); ctx.fillRect(x, y + 22, T, 2); ctx.fillRect(x + Math.floor(v * 24) + 4, y, 2, 11); }
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        if (r === 16) ctx.fillRect(x, y, T, 3);
      } else if (r <= 2) { // 천장
        ctx.fillStyle = r === 2 ? cur.beam : '#c9b08a';
        ctx.fillRect(x, y, T, T);
        if (r < 2) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y + 10, T, 2); }
        if (r === 2) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + T - 4, T, 4); }
      } else { // 옆벽 (통나무 기둥)
        ctx.fillStyle = cur.beam;
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x + 4, y, 4, T);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + T - 6, y, 6, T);
      }
    },
    // 문(마을로 나가는 곳), 꾸밀 자리 표시, 놓은 장식품
    drawDecor(ctx, terrain, camera, time) {
      G.Cave.drawDecor(ctx, terrain, camera, time);
      const home = terrain.home;
      for (const s of terrain.homeSlots || []) {
        const id = home && home.placed[s.kind][s.index];
        if (id) { drawDecor(ctx, id, s.x, s.y, time); continue; }
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; // 빈 자리: 점선 칸 + 더하기
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        if (s.kind === 'floor') ctx.strokeRect(s.x - 38, s.y - 70, 76, 68); else ctx.strokeRect(s.x - 32, s.y - 28, 64, 56);
        ctx.setLineDash([]);
        const cy = s.kind === 'floor' ? s.y - 36 : s.y;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(s.x - 8, cy - 1.5, 16, 3); ctx.fillRect(s.x - 1.5, cy - 8, 3, 16);
      }
    },
    drawVignette(ctx, w, h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.5, w / 2, h / 2, w * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(60,30,10,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };

  G.HomeTheme = HomeTheme;
  G.Home = { levelFor, slots, drawDecor, drawDecorIcon, drawHouseIcon, drawLot, houseDef };
})(window.Game);
