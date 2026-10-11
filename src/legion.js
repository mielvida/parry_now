// 다른 나라 군단의 요새 (왕국 오른쪽 문): 3층으로 이루어져 있고, 층마다 보스가 있다.
// 던전처럼 위로 오르지만 가로가 훨씬 길다. 1층 마당에는 호위 병사들과 전기 대포가 있고, 대포를 조종하는 병사(포병)를 쓰러뜨리면 대포가 멈춘다.
// 층마다 한가운데에 체크포인트가 하나씩 있다. (여기서는 '지금 여기서 저장하기'와 '1분 전으로 돌아가기'를 쓸 수 없다)
(function (G) {
  const T = G.Config.TILE;
  const H = 36;          // 줄 수
  const W = 200;         // 칸 수 (던전 탑은 44칸)
  const GROUND = 34;     // 바닥 윗면 줄
  const ARENA_ROW = 20;  // 보스 경기장 바닥 줄 (여기까지 발판을 타고 올라온다)
  const ARENA_COL = W - 36;
  const FLOORS = 3;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const BOSSES = [
    { name: '군단의 철갑 거인' }, { name: '군단의 마도사 장군' }, { name: '군단장' },
  ];

  // 호위 병사의 배치 (col, row, 종류): 계단 앞에 방패·검·창이 막아서고, 높은 곳(포대)에는 궁수와 창병이 대포를 지킨다. 돌격병과 오우거는 뒤에서 기다린다.
  // row 33 = 마당 바닥, row 30 = 포대(높은 곳) 위
  const LAYOUT = [
    { // 1층: 대포 1대, 용사 1명, 마법사 1명
      guards: [[24, 33, 'shield'], [30, 33, 'sword'], [34, 33, 'spear'], [20, 33, 'mage'], [44, 30, 'archer'], [53, 30, 'hero'], [62, 33, 'rusher']],
      cannons: [46], plateauEnd: 56,
    },
    { // 2층: 대포 2대, 용사 2명, 마법사 2명
      guards: [[18, 33, 'shield'], [24, 33, 'shield'], [30, 33, 'sword'], [34, 33, 'spear'], [14, 33, 'mage'], [43, 30, 'archer'], [41, 30, 'mage'], [52, 30, 'hero'], [62, 30, 'archer'], [68, 33, 'rusher'], [71, 33, 'hero']],
      cannons: [46, 56], plateauEnd: 64,
    },
    { // 3층: 대포 3대, 용사 3명, 마법사 3명
      guards: [[14, 33, 'ogre'], [22, 33, 'shield'], [27, 33, 'shield'], [32, 33, 'spear'], [35, 33, 'rusher'], [10, 33, 'mage'], [43, 30, 'archer'], [41, 30, 'mage'], [52, 30, 'hero'], [61, 30, 'archer'], [70, 30, 'hero'], [68, 30, 'mage'], [78, 33, 'ogre'], [84, 33, 'hero'], [88, 33, 'rusher']],
      cannons: [46, 56, 66], plateauEnd: 72,
    },
  ];

  function makeFloor(floor) {
    const rand = mulberry(floor * 104729 + 9);
    const pick = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (let r = 0; r < H; r++) { g[r][0] = g[r][1] = '#'; g[r][W - 1] = g[r][W - 2] = '#'; }
    for (let c = 0; c < W; c++) { g[0][c] = g[1][c] = '#'; g[GROUND][c] = g[GROUND + 1][c] = '#'; }
    for (let r = ARENA_ROW; r < H; r++) for (let c = ARENA_COL; c < W; c++) g[r][c] = '#'; // 보스 경기장 (높은 곳에 있다)
    // 발판: 마당 오른쪽에서 시작해 경기장까지 계단식으로 오른다 (발판 사이는 2칸)
    const rows = [32, 32, 30, 30, 28, 26, 26, 24, 22];
    const w = 8 - floor; // 위층일수록 발판이 좁다 (7,6,5)
    const stride = w + 2;
    const lastX1 = ARENA_COL - 3;
    const platforms = rows.map((row, i) => { const x1 = lastX1 - (rows.length - 1 - i) * stride; return { row, x0: x1 - w + 1, x1 }; });
    for (const p of platforms) for (let c = p.x0; c <= p.x1; c++) g[p.row][c] = '#';
    const lay = LAYOUT[floor - 1];
    // 포대: 걸어서 올라올 수 있는 계단(1칸씩) 끝의 3칸 높은 곳. 대포는 이 위에 있다
    g[GROUND - 1][37] = '#';
    g[GROUND - 1][38] = g[GROUND - 2][38] = '#';
    for (let c = 39; c <= lay.plateauEnd; c++) for (let r = GROUND - 3; r < GROUND; r++) g[r][c] = '#';
    g[GROUND - 1][3] = 'X';
    g[GROUND - 1][6] = 'P';
    g[ARENA_ROW - 1][W - 4] = 'T';
    // 마당의 호위 병사들과 전기 대포 (포대 위)
    const guards = lay.guards.map(([col, row, variant]) => ({ col, row, variant }));
    // 오르는 길의 발판에도 병사만 서 있다 (몬스터는 없다). 위로 갈수록 센 병사
    const kinds = floor === 1 ? ['sword', 'spear', 'archer', 'shield', 'sword', 'mage'] : floor === 2 ? ['spear', 'shield', 'archer', 'hero', 'rusher', 'mage', 'sword'] : ['shield', 'hero', 'archer', 'ogre', 'mage', 'hero', 'rusher'];
    platforms.forEach((p, i) => {
      if (i === 0 || i === 4) return; // 첫 발판과 체크포인트 발판은 비워 둔다
      const v = kinds[(i + floor) % kinds.length];
      guards.push({ col: Math.floor((p.x0 + p.x1) / 2), row: p.row - 1, variant: v });
    });
    const cannons = lay.cannons.map((c) => ({ col: c, row: GROUND - 4, opCol: c + 4 }));
    const cp = platforms[4]; // 한가운데: 체크포인트
    const cpPoint = { col: Math.floor((cp.x0 + cp.x1) / 2), row: cp.row - 1 };
    return { floor, rows: g.map((r) => r.join('')), boss: { col: ARENA_COL + 4, kind: 'legion' }, bossInfo: BOSSES[floor - 1], extras: { guards, cannons, cp: cpPoint } };
  }

  // 전기 대포 + 체크포인트의 상태 (한 층마다 새로 만든다)
  function makeState(lv, terrain, spawnOpFn) {
    const st = { floor: lv.floor, cannons: [], cp: null, t: 0 };
    for (const c of lv.extras.cannons) {
      const op = spawnOpFn(c.opCol, c.row);
      st.cannons.push({ x: c.col * T + T, y: (c.row + 1) * T, op, t: 1.2 + Math.random(), charge: 0, dir: -1 });
    }
    st.cp = { x: lv.extras.cp.col * T + T / 2, y: (lv.extras.cp.row + 1) * T, col: lv.extras.cp.col, row: lv.extras.cp.row, reached: false };
    return st;
  }

  const CD = [2.3, 1.9, 1.5];
  // 매 프레임: 대포는 포병이 살아 있을 때만 전기를 쏜다. shoot({x,y,vx,vy})로 쏘고, fx(x,y,type)로 효과를 낸다
  function update(dt, st, player, shoot, fx) {
    st.t += dt;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (const c of st.cannons) {
      const dead = !c.op || !c.op.alive;
      if (dead) { if (!c.stopped) { c.stopped = true; fx(c.x, c.y - 30, 'stop'); } c.charge = 0; continue; }
      c.stopped = false;
      const dx = px - c.x;
      const near = Math.abs(dx) < 760 && Math.abs(py - c.y) < 420;
      c.dir = dx < 0 ? -1 : 1;
      if (!near) { c.t = Math.max(c.t, 0.8); c.charge = 0; continue; }
      c.t -= dt;
      c.charge = c.t < 0.7 ? 1 - Math.max(0, c.t) / 0.7 : 0; // 쏘기 직전에 푸른빛이 모인다
      if (c.t <= 0) {
        const mx = c.x + c.dir * 40, my = c.y - 34;
        const ang = Math.atan2(py - my, px - mx);
        shoot({ x: mx, y: my, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, elec: true, dmg: 1, life: 3.5 });
        fx(mx, my, 'fire');
        c.t = CD[st.floor - 1] + Math.random() * 0.6;
        c.charge = 0;
      }
    }
  }

  // ---- 그리기 (땅 위, 몬스터 뒤) ----
  function drawCannon(ctx, c, time) {
    const d = c.dir || -1;
    const off = !c.op || !c.op.alive;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(d, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 44, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(-14, -14, 14, 0, Math.PI * 2); ctx.fill(); ctx.arc(16, -14, 14, 0, Math.PI * 2); ctx.fill(); // 바퀴
    ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.arc(-14, -14, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(16, -14, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a6272'; ctx.fillRect(-26, -40, 62, 24); // 포신
    ctx.fillStyle = '#7a8498'; ctx.fillRect(-26, -40, 62, 8);
    ctx.fillStyle = '#3a4252'; ctx.fillRect(30, -44, 14, 32); // 포구
    ctx.fillStyle = off ? '#444' : `rgba(120,210,255,${0.55 + 0.45 * Math.sin(time * 14)})`; // 전기 코일
    ctx.fillRect(-18, -52, 4, 12); ctx.fillRect(-6, -52, 4, 12); ctx.fillRect(6, -52, 4, 12);
    if (!off && c.charge > 0) { ctx.fillStyle = `rgba(150,230,255,${0.3 + 0.6 * c.charge})`; ctx.beginPath(); ctx.arc(46, -28, 6 + 12 * c.charge, 0, Math.PI * 2); ctx.fill(); }
    if (off) { ctx.fillStyle = 'rgba(120,120,120,0.55)'; for (let i = 0; i < 3; i++) { const t = (time * 0.6 + i / 3) % 1; ctx.beginPath(); ctx.arc(-10 + i * 8, -52 - t * 36, 5 + t * 8, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
    if (!off) { // 포병 표시
      ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
      const ox = c.op.x + c.op.w / 2, oy = c.op.y - 12;
      ctx.fillStyle = '#ffd54a'; ctx.fillText('포병', ox, oy - 12 + Math.sin(time * 5) * 2);
      ctx.beginPath(); ctx.moveTo(ox - 5, oy - 6); ctx.lineTo(ox + 5, oy - 6); ctx.lineTo(ox, oy); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  function drawFlag(ctx, cp, time) {
    ctx.save(); ctx.translate(cp.x, cp.y);
    ctx.fillStyle = '#6a5a4a'; ctx.fillRect(-2, -66, 4, 66);
    ctx.fillStyle = cp.reached ? '#5aff8a' : '#aaaaaa';
    ctx.beginPath(); ctx.moveTo(2, -64); ctx.quadraticCurveTo(22, -58 + Math.sin(time * 4) * 3, 40, -52); ctx.lineTo(2, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(0, -68, 5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = cp.reached ? '#7dffa0' : '#e0e0e0'; ctx.fillText(cp.reached ? '체크포인트 ✔' : '체크포인트', 0, -78);
    ctx.restore();
  }
  function draw(ctx, st, time) {
    if (!st) return;
    for (const c of st.cannons) drawCannon(ctx, c, time);
    if (st.cp) drawFlag(ctx, st.cp, time);
  }

  // 왕궁처럼 생긴 테마: 왕궁 알현실의 돌벽, 높은 아치 창, 붉은 깃발에 더해 높이마다 횃불과 붉은 융단
  let theme = null;
  function getTheme() {
    if (theme) return theme;
    const P = G.PalaceTheme;
    theme = Object.assign({}, P, {
      drawDecor(ctx, terrain, camera, time) {
        const view = camera.viewW + 300;
        const rows = [terrain.rows - 2, 28, 22]; // 바닥, 중간, 높은 곳
        for (let c = 8; c < terrain.cols - 4; c += 9) {
          const x = c * T + T / 2;
          if (x < camera.x - 40 || x > camera.x + view) continue;
          for (const r of rows) {
            const gy = r * T;
            if (gy < camera.y - 200 || gy > camera.y + 700) continue;
            ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 3, gy - 150, 6, 22);
            const f = 6 + 2 * Math.sin(time * 9 + c + r);
            const gl = ctx.createRadialGradient(x, gy - 158, 0, x, gy - 158, 60); gl.addColorStop(0, 'rgba(255,200,100,0.45)'); gl.addColorStop(1, 'rgba(255,200,100,0)');
            ctx.fillStyle = gl; ctx.fillRect(x - 60, gy - 218, 120, 120);
            ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.ellipse(x, gy - 156, 5, f + 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.ellipse(x, gy - 154, 3, f, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        const gyF = (terrain.rows - 2) * T; // 마당의 붉은 융단
        ctx.fillStyle = '#a8202c'; ctx.fillRect(4 * T, gyF - 5, 34 * T, 5);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(4 * T, gyF - 5, 34 * T, 1); ctx.fillRect(4 * T, gyF - 1, 34 * T, 1);
      },
    });
    return theme;
  }

  G.Legion = { getTheme, FLOORS, W, H, BOSSES, makeFloor, makeState, update, draw };
})(window.Game);
