// 바다: 항구 마을 오른쪽의 거대한 바다. 스쿠버 다이버처럼 물속을 헤엄치며 해산물(56종)을 잡는다.
//  - 수면 위 부두에서 시작해 아래로 2000m까지 이어진다 (1칸 = 1m)
//  - 산소 게이지(산소통 업그레이드)와 헤엄 속도(오리발 업그레이드)가 있다. 상점에서 강화한다
//  - 아래로 내려갈수록 잡을 수 있는 해산물이 희귀해지고, 1000m부터는 심해, 1500m에는 수중 마을이 있다
//  - 물속에는 공격하는 물고기도 나온다 (칼로 쓰러뜨린다)
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const SURFACE = 12;        // 수면 줄 (이 줄 아래가 물)
  const DEPTH = 2040;        // 바닥까지의 깊이(m)
  const W = 112;             // 가로 칸 수
  const TOWN_DEPTH = 1500;   // 수중 마을의 깊이(m)
  const DEEP = 1000;         // 심해가 시작되는 깊이(m)
  const ROWS = SURFACE + DEPTH + 4;

  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ===== 해산물 56종: [이름, 구역, 모양, 값, 크기(px), 색1, 색2] =====
  // 구역 0: 0~200m / 1: 200~500m / 2: 500~1000m / 3: 1000~1500m 심해 / 4: 1500m~ 수중 마을 아래
  const ZONES = [[0, 220], [180, 520], [480, 1020], [980, 1420], [1380, 1560]]; // 수중 마을 아래는 바위로 막혀 있어서 가장 깊은 곳은 1540m쯤
  const ZONE_NAME = ['얕은 바다', '푸른 바다', '어두운 바다', '심해', '깊은 심해'];
  const RAW = [
    ['멸치', 0, 'fish', 40, 16, '#c8d4e0', '#7a8aa0'], ['정어리', 0, 'fish', 50, 20, '#aeb8c8', '#5a6a82'], ['고등어', 0, 'fish', 70, 28, '#4a7ab0', '#c8d8e8'], ['전갱이', 0, 'fish', 80, 26, '#8aa8c0', '#e8e0b0'],
    ['도미', 0, 'fish', 120, 34, '#e0808a', '#c85a64'], ['우럭', 0, 'fish', 130, 34, '#6a5a4a', '#a89070'], ['새우', 0, 'shrimp', 90, 22, '#f0a080', '#c8604a'], ['소라', 0, 'shell', 100, 24, '#e8c8a0', '#a8784a'],
    ['전복', 0, 'shell', 140, 26, '#8a7a6a', '#d8c8b8'], ['성게', 0, 'urchin', 110, 24, '#4a2a5a', '#8a5aa0'], ['불가사리', 0, 'star', 60, 26, '#f08a3a', '#c8501a'], ['해파리', 0, 'jelly', 70, 28, '#e8d8f8', '#b8a0e0'],
    ['오징어', 1, 'squid', 220, 34, '#f4d8d0', '#c87a6a'], ['문어', 1, 'octo', 260, 36, '#c8503a', '#8a2a1a'], ['갑오징어', 1, 'squid', 240, 34, '#e0c8a0', '#8a6a3a'], ['꽃게', 1, 'crab', 200, 30, '#d86a4a', '#8a3a2a'],
    ['대게', 1, 'crab', 330, 38, '#e08a5a', '#a04a2a'], ['가재', 1, 'shrimp', 280, 30, '#6a8ac8', '#2a4a88'], ['가리비', 1, 'shell', 210, 26, '#f0c8d0', '#c88a9a'], ['굴', 1, 'shell', 180, 24, '#9a9a8a', '#d8d8c8'],
    ['광어', 1, 'flat', 300, 40, '#b8a888', '#6a5a3a'], ['가자미', 1, 'flat', 260, 36, '#a89878', '#5a4a2a'], ['농어', 1, 'fish', 320, 38, '#a8b8c8', '#5a6a78'], ['참돔', 1, 'fish', 380, 40, '#f08a98', '#d0505e'],
    ['참치', 2, 'fish', 700, 54, '#3a5a8a', '#c8d8e8'], ['방어', 2, 'fish', 600, 50, '#6a8aa8', '#e8d878'], ['가오리', 2, 'ray', 650, 52, '#8a7a6a', '#d8c8a8'], ['붕장어', 2, 'eel', 520, 52, '#7a6a5a', '#c8b898'],
    ['곰치', 2, 'eel', 760, 54, '#7a8a3a', '#d8c850'], ['해마', 2, 'seahorse', 800, 28, '#f0b84a', '#c87a1a'], ['앵무조개', 2, 'shell', 850, 30, '#f0e0c8', '#c0603a'], ['바닷가재', 2, 'shrimp', 720, 40, '#c83a3a', '#7a1a1a'],
    ['바다거북', 2, 'turtle', 950, 48, '#5a8a4a', '#c8d890'], ['청새치', 2, 'fish', 990, 60, '#2a5ab8', '#a8c8f0'], ['갈치', 2, 'eel', 540, 50, '#d8e0e8', '#8a98a8'], ['돌고래', 2, 'fish', 1000, 58, '#7a98b8', '#d8e8f8'],
    ['아귀', 3, 'angler', 1500, 44, '#5a4a3a', '#a89a7a'], ['초롱아귀', 3, 'angler', 1900, 40, '#3a2a4a', '#8a6ac8'], ['대왕오징어', 3, 'squid', 2400, 66, '#a83a4a', '#e8a0a8'], ['심해 문어', 3, 'octo', 2100, 46, '#7a3a8a', '#d8a0e8'],
    ['유령오징어', 3, 'squid', 2600, 50, '#d8e8f8', '#8aa8d0'], ['흡혈오징어', 3, 'squid', 2800, 48, '#6a1a2a', '#c83a4a'], ['심해 게', 3, 'crab', 1700, 40, '#6a4a4a', '#c89a8a'], ['도깨비상어', 3, 'shark', 3000, 72, '#c8a0b8', '#6a4a62'],
    ['만타가오리', 3, 'ray', 2200, 70, '#2a2a3a', '#e8e8f0'], ['심해 해파리', 3, 'jelly', 1800, 38, '#6ac8e8', '#2a6a98'], ['빛나는 새우', 3, 'shrimp', 2000, 30, '#8affd8', '#2aa888'], ['심해 불가사리', 3, 'star', 1600, 32, '#f8e08a', '#c8a02a'],
    // 원소 물고기 8종: 그 원소의 광석을 붙인 무기(작살·그물)로만 잡힌다
    ['화염어', 1, 'fish', 520, 34, '#ff7a3a', '#8a1a0a', 'fire'], ['독복어', 1, 'fish', 480, 30, '#9aff6b', '#2a7a2a', 'poison'], ['서리어', 2, 'fish', 900, 42, '#bfeaff', '#3a8fd0', 'ice'], ['대지게', 2, 'crab', 950, 36, '#c9a070', '#6a4a2a', 'quake'],
    ['번개어', 3, 'fish', 2600, 46, '#fff27a', '#3a6af0', 'light'], ['그림자어', 3, 'angler', 2800, 44, '#9a8ab0', '#1a1428', 'shadow'], ['태양어', 4, 'fish', 6800, 58, '#ffb04a', '#c8321a', 'fire'], ['심연 독어', 4, 'eel', 6200, 64, '#7aff5a', '#1a5a1a', 'poison'],
    ['황금 해마', 4, 'seahorse', 4200, 34, '#ffe27a', '#c8941a'], ['고래', 4, 'whale', 6000, 110, '#3a5a82', '#a8c0d8'], ['용왕게', 4, 'crab', 5200, 50, '#ff6a4a', '#8a1a1a'], ['용궁 거북', 4, 'turtle', 5600, 60, '#2a98a8', '#e8d870'],
    ['유리 해파리', 4, 'jelly', 4800, 44, '#f0faff', '#8ad0f0'], ['진주조개', 4, 'shell', 7000, 34, '#f8f0f8', '#b898d8'], ['크라켄 새끼', 4, 'squid', 8000, 80, '#3a1a5a', '#a86ae0'], ['전설의 심해어', 4, 'fish', 9000, 68, '#ffd0f0', '#c83aa8'],
  ];
  const SEAFOOD = RAW.map(([name, zone, shape, value, size, c1, c2, elem], i) => ({ id: 'sea' + (i + 1), name, zone, shape, value, size, c1, c2, elem: elem || null, idx: i, w: 100 / Math.pow(value, 0.55) * (elem ? 0.7 : 1) }));
  const ELEM_COLOR = { fire: '#ff8a3a', ice: '#aef0ff', poison: '#9aff6b', quake: '#d8b070', light: '#fff27a', shadow: '#b8a0d8' };
  const BY_ID = {};
  for (const s of SEAFOOD) BY_ID[s.id] = s;

  // ===== 공격하는 물고기 =====
  const FISH = {
    piranha: { name: '피라냐', w: 30, h: 20, hp: 20, speed: 150, dmg: 1, lo: 0, hi: 320, c: ['#d05a3a', '#7a2a1a'], coin: 30, exp: 4 },
    barracuda: { name: '바라쿠다', w: 58, h: 20, hp: 30, speed: 200, dmg: 1, lo: 150, hi: 650, c: ['#a8b8c8', '#5a6a78'], coin: 50, exp: 6 },
    eel: { name: '전기뱀장어', w: 64, h: 16, hp: 40, speed: 125, dmg: 2, lo: 400, hi: 1050, c: ['#5a7a3a', '#e8e050'], coin: 90, exp: 10 },
    shark: { name: '상어', w: 92, h: 36, hp: 60, speed: 175, dmg: 2, lo: 600, hi: 1350, c: ['#7a8a9a', '#d8e0e8'], coin: 160, exp: 18 },
    angler: { name: '심해 아귀', w: 62, h: 46, hp: 80, speed: 115, dmg: 3, lo: 1000, hi: 1850, c: ['#3a2a3a', '#8aff8a'], coin: 260, exp: 28 },
    flamefish: { name: '화염 피라냐', w: 36, h: 24, hp: 45, speed: 175, dmg: 2, lo: 300, hi: 950, c: ['#ff6a2a', '#8a1a0a'], coin: 120, exp: 14 },
    icefish: { name: '서리 상어', w: 96, h: 38, hp: 85, speed: 170, dmg: 2, lo: 700, hi: 1500, c: ['#bfeaff', '#3a8fd0'], coin: 220, exp: 24 },
    voltfish: { name: '번개 곰치', w: 70, h: 18, hp: 100, speed: 150, dmg: 3, lo: 1100, hi: 2000, c: ['#fff27a', '#3a6af0'], coin: 340, exp: 36 },
    deepsquid: { name: '심해 오징어', w: 84, h: 64, hp: 110, speed: 145, dmg: 3, lo: 1300, hi: 2100, c: ['#6a1a3a', '#ff6a8a'], coin: 420, exp: 45 },
  };

  class SeaFish extends G.Monster {
    constructor(x, y, kind) {
      const V = FISH[kind] || FISH.piranha;
      super(x, y, V.w, V.h, 'seafish');
      this.variant = kind in FISH ? kind : 'piranha';
      this.V = V;
      this.maxHp = Math.max(20, V.hp);
      this.hp = this.maxHp;
      this.coinVal = V.coin;
      this.expVal = V.exp;
      this.contactDmg = V.dmg;
      this.noRespawn = true;
      this.fromSea = true;
      this.lunge = 0;
      this.wander = Math.random() * 6;
    }
    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1;
      const V = this.V;
      this.lunge = Math.max(0, this.lunge - dt);
      let tvx, tvy;
      if (d < 460 && !this.staggered) { // 발견: 쫓아와서 가끔 확 덮친다
        if (this.lunge <= 0 && d < 220 && Math.random() < dt * 0.8) this.lunge = 0.5;
        const sp = V.speed * (this.lunge > 0 ? 2.2 : 1) * this.stageSpeed;
        tvx = (dx / d) * sp; tvy = (dy / d) * sp;
        this.chasing = true;
      } else { // 맴돈다
        this.wander += dt;
        tvx = Math.cos(this.wander * 0.7 + this.x * 0.01) * V.speed * 0.4; tvy = Math.sin(this.wander * 0.9) * V.speed * 0.25;
        this.chasing = false;
      }
      const k = Math.min(1, dt * 4);
      this.vx += (tvx - this.vx) * k;
      this.vy += (tvy - this.vy) * k;
      if (Math.abs(this.vx) > 8) this.dir = Math.sign(this.vx);
      const ox = this.x, oy = this.y;
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      if (this.hitWall) this.vx = -this.vx * 0.5;
      if (inAir(curLevel, this.x + this.w / 2, this.y + this.h / 2)) { this.x = ox; this.y = oy; this.vx = -this.vx; this.vy = -this.vy; } // 수중 마을 안(공기 방울)에는 못 들어온다
    }
  }

  // ===== 지형 =====
  // 수면 위 부두(왼쪽 위)에서 시작해 바닥까지. 양옆은 울퉁불퉁한 바위벽, 가운데는 열려 있고 바위 덩어리가 드문드문 있다.
  // 1500m에는 공기가 찬 수중 마을 돔이 있다. 돔 안에서는 산소가 찬다.
  function makeLevel(L = 0) { // L = 왼쪽에 이어 붙는 항구 마을의 칸 수 (0이면 바다만)
    const rand = mulberry(20260);
    const g = Array.from({ length: ROWS }, () => Array(W).fill('.'));
    for (let r = 0; r < ROWS; r++) {
      const wob = (k) => Math.round(1.5 + 1.2 * Math.sin(r * 0.11 + k) + 1.0 * Math.sin(r * 0.037 + k * 2));
      const lt = 2 + Math.max(0, wob(0)), rt = 2 + Math.max(0, wob(3));
      if (!L || r >= SURFACE) for (let c = 0; c < lt; c++) g[r][c] = '#'; // 항구 마을과 이어질 때는 수면 위에 벽을 세우지 않는다
      for (let c = 0; c < rt; c++) g[r][W - 1 - c] = '#';
    }
    for (let r = ROWS - 4; r < ROWS; r++) for (let c = 0; c < W; c++) g[r][c] = '#';
    // 바닥 울퉁불퉁
    for (let c = 0; c < W; c++) { const h = Math.round(2 * Math.sin(c * 0.4) + 2 * Math.sin(c * 0.13)); for (let r = ROWS - 5 - Math.max(0, h); r < ROWS - 4; r++) g[r][c] = '#'; }
    // 바위 덩어리
    // 바위를 아주 많이: 5~11줄마다 2~3덩어리(크고 작은 바위, 기둥, 납작한 암초). 가운데로 지나갈 길은 항상 남는다
    for (let r = SURFACE + 8; r < ROWS - 14; r += 5 + Math.floor(rand() * 7)) {
      if (r > SURFACE + TOWN_DEPTH - 44 && r < SURFACE + TOWN_DEPTH + 30) continue; // 수중 마을 둘레는 비워 둔다
      const n = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const kind = rand();
        const cx = 9 + Math.floor(rand() * (W - 18));
        const rx = kind < 0.25 ? 1 + Math.floor(rand() * 2) : kind < 0.5 ? 3 + Math.floor(rand() * 4) : 2 + Math.floor(rand() * 4);
        const ry = kind < 0.25 ? 3 + Math.floor(rand() * 6) : kind < 0.5 ? 1 : 1 + Math.floor(rand() * 3); // 기둥 / 납작한 암초 / 둥근 바위
        for (let dr = -ry; dr <= ry; dr++) for (let dc = -rx; dc <= rx; dc++) {
          const rr = r + dr, cc = cx + dc;
          if (rr <= SURFACE + 2 || rr >= ROWS - 6 || cc < 4 || cc > W - 5) continue;
          if ((dc * dc) / (rx * rx) + (dr * dr) / (ry * ry) <= 1.05) g[rr][cc] = '#';
        }
      }
    }
    // 바닥에서 솟은 뾰족한 바위와 천장 쪽 종유석처럼 벽에서 튀어나온 바위
    for (let c = 6; c < W - 6; c += 3 + Math.floor(rand() * 5)) { const hgt = 2 + Math.floor(rand() * 7); for (let r = ROWS - 5 - hgt; r < ROWS - 4; r++) for (let dc = 0; dc < Math.max(1, 2 - Math.floor((ROWS - 5 - r) / 4)); dc++) g[r][c + dc] = '#'; }
    // 부두: 수면 위의 나무 부두
    for (let c = L ? 0 : 2; c <= 17; c++) g[SURFACE - 1][c] = '#';
    for (let c = 4; c <= 16; c += 6) for (let r = SURFACE; r < SURFACE + 5; r++) g[r][c] = '#'; // 부두 기둥
    if (!L) { g[SURFACE - 2][3] = 'X'; g[SURFACE - 2][6] = 'P'; }
    g[SURFACE - 2][9] = '6'; g[SURFACE - 2][13] = '5'; // 다이빙 상점, 해산물 가게
    // 공기 동굴: 내려가는 길 곳곳(수심 140~1320m)에 바위 속 방이 있고, 큰 공기방울이 차 있다. 바닥의 구멍으로 헤엄쳐 올라가면 숨을 쉴 수 있다
    const pockets = [];
    [[140, 0], [330, 1], [520, 0], [760, 1], [940, 0], [1130, 1], [1320, 0]].forEach(([dep, side], k) => {
      const w = 18 + (k % 3) * 3, h = 8 + (k % 2) * 2; // 방 안쪽 크기
      const c0 = side ? W - 14 - w : 10, c1 = c0 + w - 1;
      const r1 = SURFACE + dep, r0 = r1 - h + 1;
      for (let r = r0 - 3; r <= r1 + 3; r++) for (let c = c0 - 3; c <= c1 + 3; c++) g[r][c] = '#'; // 바위 덩어리
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = '.'; // 큰 공기방울이 찬 방
      const cm = Math.floor((c0 + c1) / 2);
      for (let r = r1 + 1; r <= r1 + 3; r++) for (let c = cm - 2; c <= cm + 1; c++) g[r][c] = '.'; // 아래의 입구 구멍
      pockets.push({ c0, c1, r0, r1, cm });
    });
    // 수중 마을 돔 (공기가 차 있는 방)
    const F = SURFACE + TOWN_DEPTH + 30; // 마을 바닥 줄 (더 크고 높은 돔)
    const x0 = 8, x1 = W - 8, top = F - 34;
    const sc = Math.floor((x0 + x1) / 2); // 입구 승강 통로의 가운데
    for (let r = top - 2; r <= F + 3; r++) for (let c = x0 - 2; c <= x1 + 1; c++) g[r][c] = '#'; // 돔 덩어리를 채운 뒤 안쪽을 판다
    for (let r = top + 1; r < F; r++) for (let c = x0; c <= x1 - 1; c++) g[r][c] = '.';
    for (let r = top - 2; r <= top + 1; r++) for (let c = sc - 3; c <= sc + 2; c++) g[r][c] = '.'; // 위에서 들어오는 입구
    for (let r = top - 40; r < top - 2; r++) for (let c = sc - 4; c <= sc + 3; c++) if (g[r][c] === '#') g[r][c] = '.'; // 입구 위쪽 물길
    // 수중 마을 아래와 양옆은 바위로 메운다 (돔이 바다 밑바닥의 바위 속에 박혀 있다)
    for (let r = top - 2; r <= F + 3; r++) { for (let c = 0; c < x0 - 2; c++) g[r][c] = '#'; for (let c = x1 + 2; c < W; c++) g[r][c] = '#'; }
    for (let r = F + 4; r < ROWS; r++) for (let c = 0; c < W; c++) g[r][c] = '#';
    // 수중 마을 바닥의 금 간 바위: 여러 번 치면 무너지고, 아래 숨은 방이 열린다 (부수기 전에는 그냥 바위)
    const ck = x0 + 14;
    pockets.push({ c0: ck - 6, c1: ck + 9, r0: F, r1: F + 12, cm: ck, secret: true });
    const crackInfo = { col: ck, row: F, w: 2, h: 4, hits: 0, broken: false, room: { c0: ck - 6, c1: ck + 9, r0: F + 4, r1: F + 12 } };
    // 해저 동굴 입구: 수심 약 620m의 바위 덩어리 아래쪽에 입을 벌리고 있다
    const ce = { col: 36 + L, row: SURFACE + 620 };
    for (let r = ce.row - 8; r <= ce.row; r++) for (let c = 29; c <= 43; c++) g[r][c] = '#';
    for (let r = ce.row - 4; r <= ce.row; r++) for (let c = 34; c <= 37; c++) g[r][c] = '.';
    const row = F - 1;
    for (const [c, ch] of [[10, 'H'], [13, 'V'], [16, '5'], [34, 'H'], [37, 'V'], [51, 'V'], [62, '6'], [65, 'V'], [68, 'H'], [77, 'V'], [86, '9'], [92, 'i'], [98, '7']]) g[row][c] = ch;
    // 마을에만 있는 새 가게 4곳 (겉모습은 기존 가게를 빌리고 이름표만 다르다) + 항구 마을로 가는 포털
    const extraShops = [{ col: 28 + L, row, kind: 'dexhall', sub: 'seadex', label: '해산물 도감관' }, { col: 40 + L, row, kind: 'tackle', sub: 'divegear2', label: '잠수 장비점' }, { col: 74 + L, row, kind: 'food', sub: 'searest', label: '해물 요리점' }, { col: 80 + L, row, kind: 'decor', sub: 'seadecor', label: '수족관 꾸밈' }];
    const portals = L ? [{ kind: 'toHarbor', col: 46 + L, row }, { kind: 'toTown', col: L - 4, row: SURFACE - 2 }] : [];
    // 항구 마을: 바다 부두와 같은 높이로 이어진 땅 (집, 주민, 왼쪽 끝 출구). 부두 끝에서 그냥 뛰어내리면 바다다
    const rowsOut = g.map((row, r) => (r >= SURFACE - 1 ? '#'.repeat(L) : '.'.repeat(L)) + row.join(''));
    if (L) {
      const put = (c, ch) => { const rr = SURFACE - 2; rowsOut[rr] = rowsOut[rr].slice(0, c) + ch + rowsOut[rr].slice(c + 1); };
      put(2, 'X'); put(5, 'P');
      for (const c of [16, 30, 46, 62, 80, 98]) put(c, 'V');
      for (const c of [11, 22, 52, 70, 88]) put(c, 'H');
      put(104, 'Y'); put(110, 'R'); // 항구 마을의 내 집 터와 부동산
    }
    const pk = pockets.map((p) => ({ c0: p.c0 + L, c1: p.c1 + L, r0: p.r0, r1: p.r1, cm: p.cm + L, secret: !!p.secret }));
    const crack = { col: crackInfo.col + L, row: crackInfo.row, w: crackInfo.w, h: crackInfo.h, hits: 0, broken: false, room: { c0: crackInfo.room.c0 + L, c1: crackInfo.room.c1 + L, r0: crackInfo.room.r0, r1: crackInfo.room.r1 } };
    return { rows: rowsOut, left: L, pockets: pk, crack, townTop: top, townFloor: F, townX0: x0 + L, townX1: x1 + L, shaft0: sc - 3 + L, shaft1: sc + 3 + L, extraShops, portals, caveEntrance: { col: ce.col, row: ce.row } };
  }

  const zoneAt = (m) => (m < 200 ? 0 : m < 500 ? 1 : m < 1000 ? 2 : m < 1400 ? 3 : 4);
  const depthOf = (y) => Math.max(0, Math.round(y / T - SURFACE)); // 발 높이 y(px) -> 수심(m)
  const inTown = (lv, x, y) => !!lv && y / T > lv.townTop && y / T < lv.townFloor && x / T > lv.townX0 && x / T < lv.townX1;
  // 가는 길 곳곳의 공기 동굴: 바위 속 방에 큰 공기방울이 차 있다. 안에서는 걸어 다니고 숨을 쉴 수 있다
  const inPocket = (lv, x, y) => !!lv && !!lv.pockets && lv.pockets.some((p) => y / T > p.r0 && y / T < p.r1 + 1 && x / T > p.c0 && x / T < p.c1 + 1);
  const inAir = (lv, x, y) => inTown(lv, x, y) || inPocket(lv, x, y);

  // 이 수심에서 나올 해산물 하나 고르기 (구역이 맞는 것만, 희귀할수록 드물다)
  function pickSeafood(depth, rnd = Math.random) {
    let sum = 0;
    const ws = SEAFOOD.map((s) => {
      const [lo, hi] = ZONES[s.zone];
      const w = depth >= lo && depth < hi ? s.w : depth >= lo - 120 && depth < hi + 120 ? s.w * 0.15 : 0;
      sum += w;
      return w;
    });
    let q = rnd() * sum;
    for (let i = 0; i < SEAFOOD.length; i++) { q -= ws[i]; if (q <= 0) return SEAFOOD[i]; }
    return SEAFOOD[0];
  }
  function pickHostile(depth) {
    const list = Object.keys(FISH).filter((k) => depth >= FISH[k].lo && depth < FISH[k].hi);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  // ===== 살아 움직이는 해산물 (잡을 수 있는 것) =====
  function makeState() { return { crits: [], spawnT: 0, hostileT: 2, bubbles: [] }; }
  const depthAt = (lv, y) => (lv && lv.cave ? Math.round(lv.depthBase + y / T) : depthOf(y)); // 동굴은 깊은 곳이라 기준 수심을 더한다
  function updateState(st, dt, player, terrain, lv, monsters, hooks) {
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const depth = depthAt(lv, py);
    const left = lv.left || 0, cols = lv.cave ? lv.cols : W, minRow = lv.cave ? 3 : SURFACE + 2, maxRow = (lv.cave ? lv.rows.length : ROWS) - 8;
    st.air = st.air || [];
    st.airT = (st.airT === undefined ? 4 : st.airT) - dt;
    st.spawnT -= dt;
    // 먼 것은 사라진다
    st.crits = st.crits.filter((c) => Math.abs(c.x - px) < 900 && Math.abs(c.y - py) < 700 && !c.gone);
    const want = Math.min(18, 10 + Math.floor(depth / 300));
    if ((lv.cave || py > SURFACE * T + 40) && st.spawnT <= 0 && st.crits.length < want) {
      st.spawnT = 0.25;
      for (let tries = 0; tries < 6; tries++) {
        const ang = Math.random() * Math.PI * 2, dist = 240 + Math.random() * 380;
        const x = px + Math.cos(ang) * dist, y = py + Math.sin(ang) * dist * 0.75;
        const c = Math.floor(x / T), r = Math.floor(y / T);
          if (r <= minRow || r >= maxRow || c < left + 3 || c >= left + cols - 3 || terrain.isSolid(c, r) || inAir(lv, x, y)) continue;
        const sp = pickSeafood(depthAt(lv, y));
        st.crits.push({ sp, x, y, vx: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 30), vy: 0, t: Math.random() * 10, size: 0.8 + Math.random() * 0.6, gone: false });
        break;
      }
    }
    const speedOf = (sp) => 18 + 55 * Math.min(1, sp.size / 70) + (sp.shape === 'fish' ? 20 : 0);
    for (const c of st.crits) {
      c.t += dt;
      const dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy);
      let sp = speedOf(c.sp);
      let tvx = Math.sign(c.vx || 1) * sp * (0.5 + 0.5 * Math.sin(c.t * 0.5));
      let tvy = Math.sin(c.t * 0.8 + c.sp.idx) * sp * 0.25;
      if (d < 150 && c.sp.zone >= 1) { tvx = (dx / (d || 1)) * sp * 1.6; tvy = (dy / (d || 1)) * sp * 1.2; } // 가까이 가면 달아난다
      c.vx += (tvx - c.vx) * Math.min(1, dt * 2); c.vy += (tvy - c.vy) * Math.min(1, dt * 2);
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (terrain.isSolid(Math.floor(nx / T), Math.floor(c.y / T)) || inAir(lv, nx, c.y)) c.vx = -c.vx; else c.x = nx;
      if (terrain.isSolid(Math.floor(c.x / T), Math.floor(ny / T)) || ny < minRow * T || inAir(lv, c.x, ny)) c.vy = -c.vy; else c.y = ny;
    }
    // 거품
    if (Math.random() < dt * 6 && (lv.cave || py > SURFACE * T)) st.bubbles.push({ x: px + (Math.random() - 0.5) * 600, y: py + 360, vy: 40 + Math.random() * 40, r: 1.5 + Math.random() * 3, t: 0 });
    for (const b of st.bubbles) { b.y -= b.vy * dt; b.t += dt; }
    st.bubbles = st.bubbles.filter((b) => (lv.cave || b.y > (SURFACE * T)) && b.t < 12 && Math.abs(b.y - py) < 600 && !inAir(lv, b.x, b.y));
    // 공기방울: 가끔 떠 있다. 닿으면 산소 10초가 찬다 (main이 닿는지 본다)
    st.air = st.air.filter((a) => Math.hypot(a.x - px, a.y - py) < 1100 && !a.gone);
    if (st.airT <= 0 && st.air.filter((a) => !a.fixed).length < 3 && (lv.cave || py > SURFACE * T + 120) && !inAir(lv, px, py)) {
      st.airT = 7 + Math.random() * 7;
      for (let tries = 0; tries < 8; tries++) {
        const ang = Math.random() * Math.PI * 2, dist = 260 + Math.random() * 360;
        const x = px + Math.cos(ang) * dist, y = py + Math.sin(ang) * dist * 0.7;
        const c = Math.floor(x / T), r = Math.floor(y / T);
        if (r <= minRow + 4 || r >= maxRow || c < left + 4 || c >= left + cols - 4 || terrain.isSolid(c, r) || inAir(lv, x, y)) continue;
        st.air.push({ x, y, t: Math.random() * 6, gone: false });
        break;
      }
    }
    for (const a of st.air) { a.t += dt; }
    // 공격하는 물고기: 가까이에 몇 마리 (쓰러지면 한동안 안 나온다)
    st.hostileT -= dt;
    const mine = monsters.filter((m) => m.fromSea);
    for (let k = monsters.length - 1; k >= 0; k--) {
      const m = monsters[k];
      if (m.fromSea && (Math.hypot(m.x - px, m.y - py) > 1300 || (!m.alive && !m.vanished && !m.flying))) monsters.splice(k, 1);
    }
    if (st.hostileT <= 0 && mine.filter((m) => m.alive).length < Math.min(6, 2 + Math.floor(depth / 400)) && depth > 15) {
      st.hostileT = 2.5 + Math.random() * 2;
      const kind = pickHostile(depth);
      if (kind) {
        for (let tries = 0; tries < 8; tries++) {
          const ang = Math.random() * Math.PI * 2, dist = 420 + Math.random() * 260;
          const x = px + Math.cos(ang) * dist, y = py + Math.sin(ang) * dist * 0.7;
          const c = Math.floor(x / T), r = Math.floor(y / T);
          if (r <= minRow + 1 || r >= maxRow || c < left + 4 || c >= left + cols - 4 || terrain.isSolid(c, r) || terrain.isSolid(c + 1, r) || terrain.isSolid(c, r + 1) || inAir(lv, x, y)) continue;
          const m = new SeaFish(x, y, kind);
          m.stageSpeed = 1 + Math.min(0.5, depth / 4000);
          m.extraHits = Math.min(25, Math.floor(depth / 80)); // 깊이 내려갈수록 딴딴한 물고기 (80m마다 딴딴함 1)
          monsters.push(m);
          hooks.spawned && hooks.spawned(m);
          break;
        }
      }
    }
    return depth;
  }
  // 가까운 해산물 하나 (E로 잡는다)
  function nearest(st, player, r = 70) {
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    let best = null, bd = r;
    for (const c of st.crits) { const d = Math.hypot(c.x - px, c.y - py) - c.sp.size * 0.3; if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // ===== 그리기 =====
  function drawCritter(ctx, c, time) {
    const s = c.sp, sz = s.size * c.size, dir = c.vx >= 0 ? 1 : -1;
    const sw = Math.sin(time * 6 + c.t) * 0.12;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(dir, 1);
    const body = (rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const eye = (x, y, r) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + r * 0.2, y, r * 0.55, 0, Math.PI * 2); ctx.fill(); };
    const tail = (x, w, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - w, -w * 0.7 + sw * w); ctx.lineTo(x - w, w * 0.7 + sw * w); ctx.closePath(); ctx.fill(); };
    switch (s.shape) {
      case 'fish': case 'shark': case 'angler': tail(-sz * 0.45, sz * 0.32, s.c2); body(sz * 0.5, sz * 0.25, s.c1); ctx.fillStyle = s.c2; ctx.beginPath(); ctx.moveTo(-sz * 0.05, -sz * 0.22); ctx.lineTo(sz * 0.1, -sz * 0.42 + (s.shape === 'shark' ? -sz * 0.1 : 0)); ctx.lineTo(sz * 0.2, -sz * 0.22); ctx.closePath(); ctx.fill(); eye(sz * 0.3, -sz * 0.05, Math.max(2, sz * 0.06));
        if (s.shape === 'angler') { ctx.strokeStyle = s.c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sz * 0.3, -sz * 0.2); ctx.quadraticCurveTo(sz * 0.55, -sz * 0.6, sz * 0.7, -sz * 0.4); ctx.stroke(); ctx.fillStyle = '#ffffa0'; ctx.beginPath(); ctx.arc(sz * 0.7, -sz * 0.4, 4 + 1.5 * Math.sin(time * 5), 0, Math.PI * 2); ctx.fill(); } break;
      case 'flat': body(sz * 0.5, sz * 0.2, s.c1); ctx.fillStyle = s.c2; for (let i = -2; i <= 2; i++) ctx.fillRect(i * sz * 0.14, -2, 4, 4); eye(sz * 0.32, -sz * 0.08, 3); tail(-sz * 0.5, sz * 0.15, s.c2); break;
      case 'eel': ctx.strokeStyle = s.c1; ctx.lineWidth = Math.max(4, sz * 0.1); ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const x = -sz * 0.5 + (i / 12) * sz, y = Math.sin(time * 4 + i * 0.7 + c.t) * sz * 0.07; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.strokeStyle = s.c2; ctx.lineWidth = 1.5; ctx.stroke(); eye(sz * 0.46, -1, 2.5); break;
      case 'shell': ctx.fillStyle = s.c2; ctx.beginPath(); ctx.arc(0, 0, sz * 0.4, Math.PI, 0); ctx.lineTo(sz * 0.4, 4); ctx.lineTo(-sz * 0.4, 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = s.c1; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(i * sz * 0.18, -sz * 0.36); ctx.stroke(); } break;
      case 'crab': body(sz * 0.38, sz * 0.26, s.c1); ctx.strokeStyle = s.c1; ctx.lineWidth = 3; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * sz * 0.35, -sz * 0.05); ctx.lineTo(d * sz * 0.55, -sz * 0.35); ctx.stroke(); ctx.fillStyle = s.c2; ctx.beginPath(); ctx.arc(d * sz * 0.58, -sz * 0.4, sz * 0.12, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(d * sz * 0.25, sz * (0.05 + i * 0.07)); ctx.lineTo(d * sz * 0.5, sz * (0.2 + i * 0.07)); ctx.stroke(); } } eye(-sz * 0.1, -sz * 0.2, 3); eye(sz * 0.1, -sz * 0.2, 3); break;
      case 'squid': case 'octo': ctx.fillStyle = s.c1; ctx.beginPath(); ctx.ellipse(sz * 0.1, 0, sz * 0.38, sz * (s.shape === 'octo' ? 0.3 : 0.22), 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = s.c2; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-sz * 0.2, (i - 2.5) * sz * 0.06); ctx.quadraticCurveTo(-sz * 0.4, (i - 2.5) * sz * 0.1 + Math.sin(time * 4 + i) * 5, -sz * 0.6, (i - 2.5) * sz * 0.08 + Math.sin(time * 3 + i) * 7); ctx.stroke(); } eye(sz * 0.2, -sz * 0.05, Math.max(2.5, sz * 0.05)); break;
      case 'jelly': ctx.fillStyle = s.c1; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(0, 0, sz * 0.4, Math.PI, 0); ctx.quadraticCurveTo(0, sz * 0.1, -sz * 0.4, 0); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = s.c2; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * sz * 0.14, 2); ctx.quadraticCurveTo(i * sz * 0.14 + Math.sin(time * 3 + i) * 5, sz * 0.3, i * sz * 0.14, sz * 0.55); ctx.stroke(); } break;
      case 'star': ctx.fillStyle = s.c1; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? sz * 0.18 : sz * 0.45, a = -Math.PI / 2 + (i * Math.PI) / 5 + time * 0.3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = s.c2; ctx.beginPath(); ctx.arc(0, 0, sz * 0.1, 0, Math.PI * 2); ctx.fill(); break;
      case 'urchin': ctx.strokeStyle = s.c2; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * sz * 0.2, Math.sin(a) * sz * 0.2); ctx.lineTo(Math.cos(a) * sz * 0.5, Math.sin(a) * sz * 0.5); ctx.stroke(); } body(sz * 0.25, sz * 0.25, s.c1); break;
      case 'shrimp': ctx.strokeStyle = s.c1; ctx.lineWidth = Math.max(4, sz * 0.18); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.32, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke(); ctx.strokeStyle = s.c2; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sz * 0.2, sz * 0.1 + i * 3); ctx.lineTo(sz * 0.45, sz * 0.2 + i * 4); ctx.stroke(); } eye(sz * 0.3, -sz * 0.18, 2.5); break;
      case 'ray': ctx.fillStyle = s.c1; ctx.beginPath(); ctx.moveTo(sz * 0.5, 0); ctx.quadraticCurveTo(0, -sz * (0.5 + 0.1 * Math.sin(time * 3)), -sz * 0.4, 0); ctx.quadraticCurveTo(0, sz * (0.5 + 0.1 * Math.sin(time * 3)), sz * 0.5, 0); ctx.fill(); ctx.strokeStyle = s.c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-sz * 0.4, 0); ctx.lineTo(-sz * 0.8, 4); ctx.stroke(); eye(sz * 0.3, -sz * 0.05, 3); break;
      case 'seahorse': ctx.strokeStyle = s.c1; ctx.lineWidth = Math.max(5, sz * 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sz * 0.1, -sz * 0.4); ctx.quadraticCurveTo(-sz * 0.1, 0, sz * 0.05, sz * 0.3); ctx.quadraticCurveTo(sz * 0.2, sz * 0.5, 0, sz * 0.55); ctx.stroke(); ctx.fillStyle = s.c2; ctx.beginPath(); ctx.moveTo(sz * 0.1, -sz * 0.45); ctx.lineTo(sz * 0.4, -sz * 0.4); ctx.lineTo(sz * 0.1, -sz * 0.32); ctx.fill(); eye(sz * 0.08, -sz * 0.42, 2); break;
      case 'turtle': body(sz * 0.35, sz * 0.26, s.c1); ctx.fillStyle = s.c2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * sz * 0.16, 0, sz * 0.09, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = s.c1; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sz * 0.1, sz * 0.2); ctx.lineTo(sz * 0.35, sz * (0.4 + 0.1 * Math.sin(time * 3))); ctx.moveTo(-sz * 0.15, sz * 0.2); ctx.lineTo(-sz * 0.4, sz * 0.38); ctx.stroke(); ctx.beginPath(); ctx.arc(sz * 0.45, -sz * 0.05, sz * 0.1, 0, Math.PI * 2); ctx.fill(); break;
      case 'whale': tail(-sz * 0.5, sz * 0.3, s.c1); body(sz * 0.5, sz * 0.26, s.c1); ctx.fillStyle = s.c2; ctx.beginPath(); ctx.ellipse(sz * 0.05, sz * 0.12, sz * 0.4, sz * 0.12, 0, 0, Math.PI); ctx.fill(); eye(sz * 0.32, -sz * 0.05, 4); break;
      default: body(sz * 0.4, sz * 0.2, s.c1);
    }
    if (s.elem) { const col = ELEM_COLOR[s.elem]; ctx.globalAlpha = 0.45 + 0.3 * Math.sin(time * 5 + c.t); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, sz * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = col; for (let k = 0; k < 4; k++) { const a = time * 2 + k * 1.6 + c.t; ctx.beginPath(); ctx.arc(Math.cos(a) * sz * 0.62, Math.sin(a) * sz * 0.62, 3, 0, Math.PI * 2); ctx.fill(); } }
    else if (s.zone >= 3) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(time * 4 + c.t); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, sz * 0.6, 0, Math.PI * 2); ctx.stroke(); } // 희귀한 것은 반짝인다
    ctx.restore();
  }

  function paintFish(ctx, m, time) { // 공격하는 물고기
    const V = m.V, w = m.w, h = m.h, flash = m.flying && Math.floor(m.flightTime / 0.05) % 2 === 0;
    ctx.save(); ctx.translate(m.x + w / 2, m.y + h / 2); ctx.scale(m.dir >= 0 ? 1 : -1, 1);
    if (m.flying) ctx.rotate(m.spin || 0);
    const c1 = flash ? '#fff' : V.c[0], c2 = flash ? '#fff' : V.c[1];
    const sw = Math.sin(time * 8 + m.x * 0.05) * 0.15;
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(-w * 0.4, 0); ctx.lineTo(-w * 0.62, -h * 0.6 + sw * h); ctx.lineTo(-w * 0.62, h * 0.6 + sw * h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.45); ctx.lineTo(w * 0.05, -h * 0.85); ctx.lineTo(w * 0.2, -h * 0.45); ctx.closePath(); ctx.fill();
    if (m.variant === 'eel') { ctx.strokeStyle = '#fff48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.3, -2); ctx.lineTo(-w * 0.1, 3); ctx.lineTo(w * 0.1, -3); ctx.lineTo(w * 0.3, 2); ctx.stroke(); }
    if (m.variant === 'angler') { ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.3, -h * 0.4); ctx.quadraticCurveTo(w * 0.6, -h * 0.9, w * 0.75, -h * 0.55); ctx.stroke(); ctx.fillStyle = '#c8ffa0'; ctx.beginPath(); ctx.arc(w * 0.75, -h * 0.55, 5 + Math.sin(time * 6), 0, Math.PI * 2); ctx.fill(); }
    // 이빨과 눈
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * 0.28 + i * w * 0.05, h * 0.05); ctx.lineTo(w * 0.31 + i * w * 0.05, h * 0.25); ctx.lineTo(w * 0.34 + i * w * 0.05, h * 0.05); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w * 0.3, -h * 0.12, Math.max(3, h * 0.13), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = m.chasing ? '#e02020' : '#111'; ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.12, Math.max(1.6, h * 0.07), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(ctx, st, time) {
    for (const a of st.air || []) { const bob = Math.sin(a.t * 2) * 4; const g = ctx.createRadialGradient(a.x, a.y + bob, 2, a.x, a.y + bob, 30); g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(120,220,255,0.12)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y + bob, 28, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(220,250,255,0.9)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('O₂', a.x, a.y + bob); ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#bff0ff'; ctx.fillText('+10초', a.x, a.y + bob + 14); }
    for (const b of st.bubbles) { ctx.strokeStyle = 'rgba(220,245,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x + Math.sin(b.t * 2) * 4, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); }
    for (const c of st.crits) drawCritter(ctx, c, time);
  }

  // ===== 테마: 깊어질수록 어두워지는 바다 =====
  const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  const SKY = [[150, 205, 245], [215, 238, 252]];
  const STOPS = [[0, [70, 190, 230]], [150, [30, 130, 190]], [500, [14, 70, 130]], [1000, [6, 28, 70]], [1500, [3, 12, 36]], [2100, [2, 4, 14]]];
  function waterColor(depth) {
    for (let i = 1; i < STOPS.length; i++) if (depth <= STOPS[i][0]) { const [d0, c0] = STOPS[i - 1], [d1, c1] = STOPS[i]; return [c0, c1, (depth - d0) / (d1 - d0)]; }
    return [STOPS[STOPS.length - 1][1], STOPS[STOPS.length - 1][1], 0];
  }
  let curLevel = null, darkness = 0, lampLv = 0, townVisited = false, caveBase = null; // caveBase: 동굴 안이면 기준 수심(m)
  const Theme = {
    setLevel(lv) { curLevel = lv; },
    setCave(base) { caveBase = base; },
    setLamp(n) { lampLv = n; },
    setVisited(v) { townVisited = !!v; },
    drawBackground(ctx, w, h, camera, time) {
      const cy = camera.y || 0;
      const bands = 28;
      for (let i = 0; i < bands; i++) {
        const y0 = (i / bands) * h, y1 = ((i + 1) / bands) * h;
        const wy = cy + (y0 + y1) / 2;
        if (caveBase === null && wy < SURFACE * T) ctx.fillStyle = mix(SKY[0], SKY[1], clamp(1 - wy / (SURFACE * T), 0, 1) * 0.7);
        else { const [a, b, t] = waterColor(caveBase !== null ? caveBase + wy / T : (wy - SURFACE * T) / T); ctx.fillStyle = mix(a, b, clamp(t, 0, 1)); }
        ctx.fillRect(0, y0, w, y1 - y0 + 1);
      }
      // 수면 근처의 빛줄기
      const sy = SURFACE * T - cy;
      if (caveBase === null && sy < h) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 6; i++) { const x = ((i * 190 + time * 12) % (w + 200)) - 100; ctx.beginPath(); ctx.moveTo(x, Math.max(0, sy)); ctx.lineTo(x + 70, Math.max(0, sy)); ctx.lineTo(x + 20, Math.min(h, sy + 420)); ctx.lineTo(x - 90, Math.min(h, sy + 420)); ctx.closePath(); ctx.fill(); } }
      darkness = clamp((caveBase !== null ? caveBase + cy / T : cy / T - SURFACE) / 1700, 0, 0.8) * (1 - 0.07 * lampLv);
    },
    drawCeiling() {},
    drawTile(ctx, terrain, c, r) {
      const x = c * T, y = r * T;
      const d = caveBase !== null ? caveBase + r : Math.max(0, r - SURFACE);
      const dk = clamp(d / 1900, 0, 0.85);
      const h = (Math.imul(c, 73856093) ^ Math.imul(r, 19349663)) >>> 0;
      const v = (h % 1000) / 1000;
      const town = curLevel && r > curLevel.townTop - 3 && r <= curLevel.townFloor + 3 && c >= curLevel.townX0 - 3 && c <= curLevel.townX1 + 2;
      const land = curLevel && c < curLevel.left;
      const base = caveBase !== null ? [70, 66, 84] : land ? (r < SURFACE + 3 ? [200, 172, 112] : [128, 108, 84]) : r < SURFACE ? [150, 104, 62] : town ? [88, 98, 128] : [96, 82, 76];
      ctx.fillStyle = mix([base[0] * (0.8 + v * 0.3), base[1] * (0.8 + v * 0.3), base[2] * (0.8 + v * 0.3)], [4, 8, 22], dk);
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x + (h % 18), y + 6 + ((h >> 5) % 14), 8, 4);
      if ((caveBase !== null || r >= SURFACE) && !terrain.isSolid(c, r - 1)) { // 위가 트인 바위: 산호와 해초
        const col = ['#e0607a', '#f0a050', '#7ad07a', '#a07ae0'][h % 4];
        ctx.fillStyle = mix([parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)], [4, 8, 22], dk);
        ctx.fillRect(x + 4, y - 4, 4, 6); ctx.fillRect(x + 13, y - 8 - (h % 5), 4, 10); ctx.fillRect(x + 22, y - 5, 4, 7);
      }
    },
    drawVignette(ctx, w, h) {
      ctx.fillStyle = `rgba(0,6,24,${0.12 + darkness * 0.5})`; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,10,${0.25 + darkness * 0.5})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
    drawDecor(ctx, terrain, camera, time) {
      const view = camera.viewW + 300;
      // 포털: 수중 마을 <-> 항구 마을 (항구 쪽 포털은 수중 마을에 한 번 가 본 뒤에 나타난다)
      if (curLevel && curLevel.portals) for (const pt of curLevel.portals) {
        if (pt.kind === 'toTown' && !townVisited) continue;
        const px = pt.col * T + T / 2, py = (pt.row + 1) * T;
        if (px < camera.x - 100 || px > camera.x + view) continue;
        ctx.save(); ctx.translate(px, py);
        ctx.fillStyle = '#5a6272'; ctx.fillRect(-30, -86, 12, 86); ctx.fillRect(18, -86, 12, 86); ctx.fillRect(-30, -96, 60, 12);
        const gl = ctx.createLinearGradient(0, -84, 0, 0); gl.addColorStop(0, pt.kind === 'toHarbor' ? '#ffe9a0' : '#aef0ff'); gl.addColorStop(1, pt.kind === 'toHarbor' ? '#e08a3a' : '#2a8ad0');
        ctx.fillStyle = gl; ctx.fillRect(-18, -84, 36, 84);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = -14 - i * 18 + Math.sin(time * 2 + i) * 3; ctx.beginPath(); ctx.moveTo(-16, y); ctx.quadraticCurveTo(0, y - 8, 16, y); ctx.stroke(); }
        ctx.restore();
        if (G.TextLayer) G.TextLayer.add(pt.kind === 'toHarbor' ? '포털: 항구 마을' : '포털: 수중 마을', px, py - 112, 'bold 14px sans-serif', '#ffffff');
      }
      // 수면의 물결
      const sy = SURFACE * T;
      if (caveBase === null && sy > camera.y - 40 && sy < camera.y + 800) {
        ctx.fillStyle = 'rgba(190,235,255,0.55)'; ctx.beginPath(); ctx.moveTo(camera.x - 20, sy + 40);
        for (let x = camera.x - 20; x <= camera.x + view; x += 16) ctx.lineTo(x, sy + Math.sin(x * 0.05 + time * 2) * 3);
        ctx.lineTo(camera.x + view, sy + 40); ctx.closePath(); ctx.fill();
      }
      // 공기 동굴: 큰 공기방울이 차 있는 바위 속 방
      if (caveBase === null && curLevel && curLevel.crack) { // 금 간 바위와 비밀의 방
        const ck = curLevel.crack;
        const cx0 = ck.col * T, cy0 = ck.row * T;
        if (cx0 > camera.x - 400 && cx0 < camera.x + view && cy0 > camera.y - 800 && cy0 < camera.y + 1100) {
          if (!ck.broken) {
            const dmg = ck.hits / 6;
            ctx.strokeStyle = `rgba(15,8,8,${0.75 + 0.2 * dmg})`; ctx.lineWidth = 2.5 + dmg * 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx0 + T * 0.9, cy0 + 2); ctx.lineTo(cx0 + T * 0.5, cy0 + T * 0.9); ctx.lineTo(cx0 + T * 1.2, cy0 + T * 1.6); ctx.lineTo(cx0 + T * 0.7, cy0 + T * 2.5); ctx.lineTo(cx0 + T * 1.3, cy0 + T * 3.4); ctx.lineTo(cx0 + T * 1.0, cy0 + T * 4 - 2); ctx.stroke();
            if (ck.hits > 0) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx0 + T * 1.2, cy0 + T * 1.6); ctx.lineTo(cx0 + T * 1.8, cy0 + T * 2.0); ctx.moveTo(cx0 + T * 0.7, cy0 + T * 2.5); ctx.lineTo(cx0 + T * 0.1, cy0 + T * 2.9); ctx.stroke(); }
            if (ck.hits > 2) { ctx.beginPath(); ctx.moveTo(cx0 + T * 0.5, cy0 + T * 0.9); ctx.lineTo(cx0 + T * 0.05, cy0 + T * 0.6); ctx.moveTo(cx0 + T * 1.3, cy0 + T * 3.4); ctx.lineTo(cx0 + T * 1.9, cy0 + T * 3.7); ctx.stroke(); }
            ctx.lineCap = 'butt';
          } else {
            const r = ck.room, rx0 = r.c0 * T, ry0 = r.r0 * T, rx1 = (r.c1 + 1) * T, ry1 = (r.r1 + 1) * T;
            const gr = ctx.createLinearGradient(0, ry0, 0, ry1); gr.addColorStop(0, 'rgba(14,18,34,0.96)'); gr.addColorStop(1, 'rgba(8,10,22,0.98)');
            ctx.fillStyle = gr; ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
            const lg = ctx.createRadialGradient((rx0 + rx1) / 2, ry0 + T * 3, 10, (rx0 + rx1) / 2, ry0 + T * 3, T * 9); lg.addColorStop(0, 'rgba(255,230,160,0.35)'); lg.addColorStop(1, 'rgba(255,230,160,0)');
            ctx.fillStyle = lg; ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
            if (G.TextLayer) G.TextLayer.add('시험', (rx0 + rx1) / 2, ry0 + T * 4.2, 'bold 72px sans-serif', '#ffe9a0');
          }
        }
      }
      if (caveBase === null && curLevel && curLevel.pockets) for (const p of curLevel.pockets) {
        if (p.secret) continue;
        const x0 = p.c0 * T, x1 = (p.c1 + 1) * T, y0 = p.r0 * T, y1 = (p.r1 + 1) * T;
        if (x1 < camera.x - 50 || x0 > camera.x + view || y1 < camera.y - 50 || y0 > camera.y + 800) continue;
        const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(120,180,230,0.78)'); g.addColorStop(1, 'rgba(190,230,250,0.62)');
        ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 6, ry - 6, 0, 0, Math.PI * 2); ctx.stroke(); // 방울 막
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx - rx * 0.45, cy - ry * 0.45, rx * 0.16, ry * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 7; i++) { const bx = x0 + 20 + ((i * 97 + time * 14) % (x1 - x0 - 40)), by = y1 - 10 - ((time * 20 + i * 41) % (y1 - y0 - 20)); ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(40,110,170,0.9)'; ctx.fillRect(p.cm * T - T * 2 + T * 0, y1, T * 4, T * 0.4); // 입구 구멍
        if (G.TextLayer) G.TextLayer.add('공기 동굴 (큰 공기방울: 숨을 쉴 수 있어요)', cx, y0 + 18, 'bold 13px sans-serif', '#ffffff');
        if (G.TextLayer) G.TextLayer.add('▲ 아래 구멍으로 올라와요', p.cm * T + T / 2 - T, y1 + 26, 'bold 11px sans-serif', '#cfeeff');
      }
      // 수중 마을 돔: 유리 천장, 가로등 빛
      if (caveBase === null && curLevel && curLevel.townTop !== undefined) {
        const L = curLevel, x0 = L.townX0 * T, x1 = L.townX1 * T, top = L.townTop * T, fl = L.townFloor * T;
        if (camera.y + 800 > top && camera.y - 200 < fl + 100) {
          const g = ctx.createLinearGradient(0, top, 0, fl); g.addColorStop(0, 'rgba(40,70,110,0.9)'); g.addColorStop(1, 'rgba(110,160,200,0.9)');
          ctx.fillStyle = g; ctx.fillRect(x0, top + T, x1 - x0, fl - top - T);
          ctx.strokeStyle = 'rgba(255,230,160,0.35)'; ctx.lineWidth = 2;
          for (let c = L.townX0 + 3; c < L.townX1; c += 6) { ctx.beginPath(); ctx.moveTo(c * T, top + T); ctx.lineTo(c * T, fl); ctx.stroke(); }
          for (let c = L.townX0 + 2; c < L.townX1; c += 6) { const lx = c * T + T / 2, ly = fl - T * 5; const gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, 70); gl.addColorStop(0, 'rgba(255,220,140,0.6)'); gl.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = gl; ctx.fillRect(lx - 70, ly - 70, 140, 140); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(lx - 3, ly - 3, 6, 6); }
          // 입구 승강 통로: 이 안에서 W(↑)를 누르면 위로 올라간다
          const sx0 = L.shaft0 * T, sx1 = L.shaft1 * T;
          ctx.fillStyle = 'rgba(160,220,255,0.18)'; ctx.fillRect(sx0, top - 40 * T, sx1 - sx0, fl - top + 40 * T);
          ctx.strokeStyle = 'rgba(200,240,255,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(sx0, top - 40 * T, sx1 - sx0, fl - top + 40 * T);
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 6; k++) { const yy = fl - ((time * 60 + k * 70) % 420); ctx.fillText('▲', sx0 + (sx1 - sx0) / 2 - 5, yy); }
          if (G.TextLayer) G.TextLayer.add('W(↑): 위로 올라가는 통로', (sx0 + sx1) / 2, fl - T * 2, 'bold 12px sans-serif', '#cfeeff');
          if (G.TextLayer) G.TextLayer.add('수중 마을', (x0 + x1) / 2, top + T * 3, 'bold 18px sans-serif', '#ffe9a0');
        }
      }
      if (G.Beach && G.Beach.drawDecor) G.Beach.drawDecor(ctx, terrain, camera, time); // 가게, 집, 주민
    },
  };

  // ===== 화면 위 표시: 수심, 산소 게이지 =====
  function drawHud(ctx, W, H, d) {
    ctx.save();
    const w = 400, x = W / 2 - w / 2, y = 124;
    ctx.fillStyle = 'rgba(4,16,40,0.72)'; ctx.fillRect(x, y, w, 78);
    ctx.strokeStyle = d.o2 / d.max < 0.25 ? '#ff6a6a' : '#6ad0ff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, 78);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(`수심 ${d.depth} m`, x + 12, y + 17);
    ctx.textAlign = 'right'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = d.depth >= DEEP ? '#c8a0ff' : '#9ad8ff'; ctx.fillText(d.inTown ? '수중 마을 (공기가 찬다)' : d.inPocket ? '공기 동굴 (공기가 찬다)' : d.depth >= DEEP ? `심해 · ${ZONE_NAME[d.zone]}` : ZONE_NAME[d.zone], x + w - 12, y + 17);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 12, y + 30, w - 24, 12);
    const k = clamp(d.o2 / d.max, 0, 1);
    ctx.fillStyle = k > 0.5 ? '#6ad0ff' : k > 0.25 ? '#ffd54a' : '#ff5a5a'; ctx.fillRect(x + 13, y + 31, (w - 26) * k, 10);
    ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#cfe8ff'; ctx.fillText(`산소 ${Math.ceil(d.o2)} / ${d.max}초`, x + 12, y + 53);
    ctx.textAlign = 'right'; ctx.fillText(`헤엄 속도 ${d.speed}`, x + w - 12, y + 53);
    ctx.textAlign = 'center'; ctx.fillStyle = '#9ac0e0'; ctx.fillText('E: 맨손 잡기  ·  공격: 작살/그물', x + w / 2, y + 68);
    ctx.restore();
  }

  // ===== 해산물을 잡는 무기: 작살 4종(1마리, 창처럼 쓸 수도 있다) · 수중 그물 3종(한꺼번에 여러 마리) =====
  // 등급 g 무기는 g+1 구역(수심)까지의 해산물을 잡을 수 있다. 맨손(E)은 구역 1(500m 위)까지만. 값도 등급마다 20%씩 더 받는다
  const HARPOONS = [['나무 작살', 1200, 0.9, ['#c9a86a', '#8a5a2b']], ['철 작살', 4000, 1.1, ['#b8c0cc', '#6c7686']], ['강철 작살', 12000, 1.3, ['#e6edf5', '#9db6d6']], ['심해 작살', 36000, 1.6, ['#c8a0ff', '#4a2a8a']]];
  const SEANETS = [['수중 그물', 2000, ['#9fe8ff', '#4fb5e0']], ['튼튼한 수중 그물', 9000, ['#ffe27a', '#d4a017']], ['심해 그물', 28000, ['#ffd0f0', '#c83aa8']]];
  const GEAR_IDS = [];
  (function registerGear() {
    const ITEMS = G.Shop.ITEMS;
    HARPOONS.forEach(([name, price, reach, look], i) => {
      const g = i + 1, id = 'seah' + g;
      ITEMS[id] = { id, slot: 'weapon', type: 'spear', name, price, reach, throwTiles: 4, cd: 0.1, look, sea: g, note: `작살: 휘두르면 앞의 해산물 1마리를 잡는다 (${g + 1}구역·${ZONES[Math.min(4, g + 1)][0]}m 근처까지). 창처럼 물고기와도 싸운다` };
      GEAR_IDS.push(id);
    });
    SEANETS.forEach(([name, price, look], i) => {
      const g = i + 1, id = 'seanet' + g;
      ITEMS[id] = { id, slot: 'weapon', type: 'net', name, price, reach: 0.3, throwTiles: 0, cd: -0.1, look, baseDmg: 1, grade: g, sea: g, note: `그물: 휘두르면 앞의 해산물을 한꺼번에 최대 ${g + 1}마리 잡는다 (${g + 1}구역까지)` };
      GEAR_IDS.push(id);
    });
    G.Shop.SHOPS.divegear.tabs.push({ name: '작살·그물', items: GEAR_IDS.map((id) => ITEMS[id]) });
  })();

  const shaftOf = (lv, x) => !!lv && x / T > lv.shaft0 && x / T < lv.shaft1; // 수중 마을 입구 승강 통로
  // ===== 해물 요리점의 요리 8종 (피와 스태미나가 찬다, V로 먹거나 인벤토리에서) =====
  const DISHES = [
    ['sd_soup', '해물탕', 300, 1, 40, ['#e8603a', '#8a2a1a'], 'soup'], ['sd_shrimp', '새우튀김', 220, 0.5, 50, ['#f0b060', '#b87a2a'], 'shrimp'], ['sd_squid', '오징어 구이', 380, 1, 60, ['#f0d8c0', '#c87a4a'], 'squid'],
    ['sd_octo', '문어 숙회', 520, 1.5, 60, ['#d86a5a', '#8a2a2a'], 'octo'], ['sd_stew', '생선 스튜', 700, 2, 70, ['#e8a040', '#7a4a1a'], 'stew'], ['sd_clam', '조개 찜', 900, 2, 90, ['#f4ece0', '#b09878'], 'clam'],
    ['sd_tuna', '참치 스테이크', 1400, 3, 100, ['#c8403a', '#6a1a1a'], 'tuna'], ['sd_feast', '용궁 만찬', 3000, 5, 150, ['#ffd54a', '#a87a1a'], 'feast'],
  ];
  const DISH_IDS = [];
  for (const [id, name, price, food, st, look, art] of DISHES) {
    G.Shop.ITEMS[id] = { id, name, price, consumable: true, food, stamina: st, look, seaDish: art, desc: `${name} - 피 ${food}칸, 스태미나 ${st} 회복` };
    DISH_IDS.push(id);
    G.Shop.CONSUMABLE_IDS.push(id);
    G.Shop.DARK_CONS_IDS.push(id);
  }
  G.Shop.SHOPS.searest = { title: '해물 요리점', tabs: [{ name: '요리', items: DISH_IDS.map((id) => G.Shop.ITEMS[id]) }] };
  // ===== 수족관 꾸밈 가게: 집에 놓는 바다 장식 (놓을수록 코인·치명타 보너스) =====
  const SEADECOR = [
    { id: 'd_coral', name: '산호 화분', price: 1400, place: 'floor' }, { id: 'd_aqua', name: '대형 수족관', price: 2400, place: 'floor' }, { id: 'd_anchor', name: '낡은 닻', price: 1800, place: 'floor' },
    { id: 'd_shell', name: '조개 장식', price: 1000, place: 'wall' }, { id: 'd_buoy', name: '구명 튜브', price: 1200, place: 'wall' }, { id: 'd_pearl', name: '진주 샹들리에', price: 2800, place: 'wall' },
  ];
  for (const d of SEADECOR) G.Shop.ITEMS[d.id] = Object.assign({ decor: true }, d);
  G.Shop.SHOPS.seadecor = { title: '수족관 꾸밈', tabs: [{ name: '바다 가구', items: SEADECOR.filter((d) => d.place === 'floor').map((d) => G.Shop.ITEMS[d.id]) }, { name: '바다 벽 장식', items: SEADECOR.filter((d) => d.place === 'wall').map((d) => G.Shop.ITEMS[d.id]) }] };
  if (G.Home && G.Home.DRAW) {
    const D = G.Home.DRAW;
    const rect = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const circ = (ctx, c, x, y, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    D.d_coral = (ctx, x, y, time) => { rect(ctx, '#6b4423', x - 26, y - 22, 52, 22); rect(ctx, '#d6b87a', x - 22, y - 26, 44, 5); for (const [dx, h, c] of [[-14, 46, '#e0607a'], [0, 62, '#f0a050'], [14, 40, '#a07ae0']]) { rect(ctx, c, x + dx - 3, y - 26 - h, 6, h); rect(ctx, c, x + dx - 10, y - 26 - h * 0.7, 7, 4); rect(ctx, c, x + dx + 3, y - 26 - h * 0.5, 8, 4); circ(ctx, c, x + dx, y - 28 - h, 5); } };
    D.d_aqua = (ctx, x, y, time) => { rect(ctx, '#3a2a1a', x - 46, y - 24, 92, 24); rect(ctx, '#9fd8f0', x - 42, y - 96, 84, 74); rect(ctx, '#4aa0d8', x - 42, y - 70, 84, 48); rect(ctx, '#e8d8a0', x - 42, y - 30, 84, 8); const t = time || 0; for (let k = 0; k < 4; k++) { const fx = x - 30 + ((t * 20 + k * 22) % 60); ctx.fillStyle = ['#ff9a3a', '#ffe14a', '#e05a7a', '#7ae0c8'][k]; ctx.beginPath(); ctx.ellipse(fx, y - 80 + k * 12, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); } rect(ctx, '#2a8a3a', x + 30, y - 60, 4, 30); rect(ctx, '#5a3d17', x - 46, y - 100, 92, 5); };
    D.d_anchor = (ctx, x, y) => { ctx.strokeStyle = '#5a6272'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 90); ctx.lineTo(x, y - 4); ctx.moveTo(x - 20, y - 70); ctx.lineTo(x + 20, y - 70); ctx.moveTo(x - 30, y - 24); ctx.quadraticCurveTo(x - 30, y - 2, x, y - 4); ctx.quadraticCurveTo(x + 30, y - 2, x + 30, y - 24); ctx.stroke(); circ(ctx, '#5a6272', x, y - 96, 8); ctx.lineCap = 'butt'; };
    D.d_shell = (ctx, x, y) => { ctx.fillStyle = '#f0c8d0'; ctx.beginPath(); ctx.arc(x, y + 12, 34, Math.PI, 0); ctx.lineTo(x + 34, y + 20); ctx.lineTo(x - 34, y + 20); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c88a9a'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x + i * 10, y - 18); ctx.stroke(); } circ(ctx, '#fff', x, y + 4, 6); };
    D.d_buoy = (ctx, x, y) => { ctx.strokeStyle = '#e8334a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; for (const a of [0.8, 2.4, 3.9, 5.5]) { ctx.beginPath(); ctx.arc(x, y, 26, a - 0.4, a + 0.4); ctx.stroke(); } };
    D.d_pearl = (ctx, x, y, time) => { rect(ctx, '#d4a017', x - 3, y - 40, 6, 22); ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.quadraticCurveTo(x - 38, y - 10, x - 40, y + 6); ctx.moveTo(x, y - 18); ctx.quadraticCurveTo(x + 38, y - 10, x + 40, y + 6); ctx.stroke(); for (const [dx, dy] of [[-40, 8], [0, -6], [40, 8], [-20, 0], [20, 0]]) { const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, 18); g.addColorStop(0, 'rgba(255,240,255,0.7)'); g.addColorStop(1, 'rgba(255,240,255,0)'); ctx.fillStyle = g; ctx.fillRect(x + dx - 18, y + dy - 18, 36, 36); circ(ctx, '#f8f0f8', x + dx, y + dy + 6, 9); circ(ctx, '#ffffff', x + dx - 3, y + dy + 3, 3); } };
  }

  // ===== 다이빙 장비에 붙이는 해저 광석 6종 (장비 하나에 최대 3개) =====
  // 구하는 법: 잠수 장비점에서 사거나, 조개·게·새우·성게·불가사리를 잡을 때 가끔 나온다
  const DIVE_ORES = [
    { id: 'pearlore', name: '진주광', tier: 1, price: 1500, look: ['#f8f0f8', '#b898d8'], b: { o2: 10 }, zone: 0 },
    { id: 'coralsteel', name: '산호강', tier: 1, price: 1500, look: ['#ff9a8a', '#c8503a'], b: { spd: 12 }, zone: 1 },
    { id: 'deepiron', name: '심해철', tier: 2, price: 4000, look: ['#8aa8c8', '#2a4a6a'], b: { use: 0.04, o2: 8 }, zone: 2 },
    { id: 'starlight', name: '별빛석', tier: 3, price: 9000, look: ['#fff0a0', '#c8941a'], b: { lamp: 1, spd: 8 }, zone: 3 },
    { id: 'seadrake', name: '해룡석', tier: 4, price: 20000, look: ['#7affd8', '#1a8a6a'], b: { o2: 25, spd: 15 }, zone: 4 },
    { id: 'krakenore', name: '크라켄석', tier: 4, price: 28000, look: ['#c88aff', '#3a1a5a'], b: { use: 0.08, lamp: 1, o2: 15 }, zone: 4 },
  ];
  const DORE = {};
  for (const o of DIVE_ORES) DORE[o.id] = o;
  const GEARS = [['tank', '산소통'], ['fins', '오리발'], ['suit', '잠수복'], ['lamp', '랜턴']];
  const SLOTS = 3;
  const bonusText = (b) => [b.o2 ? `산소 +${b.o2}초` : '', b.spd ? `헤엄 속도 +${b.spd}` : '', b.use ? `산소 소모 -${Math.round(b.use * 100)}%` : '', b.lamp ? `랜턴 +${b.lamp}단계` : ''].filter(Boolean).join(', ');
  const attached = (inv, g) => ((inv.diveAttach && inv.diveAttach[g]) || []);
  function diveBonus(inv) { // 붙인 광석의 보너스 합계
    const out = { o2: 0, spd: 0, use: 0, lamp: 0 };
    for (const [g] of GEARS) for (const id of attached(inv, g)) { const o = DORE[id]; if (!o) continue; for (const k of Object.keys(out)) out[k] += o.b[k] || 0; }
    return out;
  }
  const oreCount = (inv, id) => (inv.dore && inv.dore[id]) || 0;
  const gearItems = {};
  const buyItems = [];
  for (const o of DIVE_ORES) {
    const id = 'dore_' + o.id;
    G.Shop.ITEMS[id] = {
      id, name: `${o.name} (${o.tier}단계)`, price: o.price, quest: true, look: o.look, ore: o.id,
      onDescribe(item, inv) { return { name: `${o.name} 구입 (${o.tier}단계)`, desc: `다이빙 장비에 붙이는 광석: ${bonusText(o.b)}`, slotName: '해저 광석', note: `보유 ${oreCount(inv, o.id)}개 · 조개·게·새우를 잡을 때도 가끔 나와요` }; },
      priceLabel() { return `${o.price} G`; },
      canBuy(inv, coins) { return coins >= o.price; },
      onBuy(item, wallet) { if (wallet.coins < o.price) return { ok: false, msg: '코인이 부족해요.' }; wallet.coins -= o.price; wallet.inv.dore = wallet.inv.dore || {}; wallet.inv.dore[o.id] = oreCount(wallet.inv, o.id) + 1; return { ok: true, msg: `${o.name} 구입! (보유 ${wallet.inv.dore[o.id]}개)` }; },
    };
    buyItems.push(G.Shop.ITEMS[id]);
  }
  const tabs = [{ name: '광석 구입', items: buyItems }];
  for (const [g, gname] of GEARS) {
    const list = [];
    for (const o of DIVE_ORES) {
      const id = `dfit_${g}_${o.id}`;
      G.Shop.ITEMS[id] = {
        id, name: `${gname}에 ${o.name} 붙이기`, price: 0, quest: true, look: o.look, ore: o.id,
        onDescribe(item, inv) { const a = attached(inv, g); return { name: `${gname}에 ${o.name} 붙이기  (${a.length}/${SLOTS})`, desc: `${bonusText(o.b)}`, slotName: '광석 부착', note: `보유 ${oreCount(inv, o.id)}개 · 붙인 광석: ${a.length ? a.map((x) => DORE[x].name).join(', ') : '없음'}` }; },
        priceLabel(inv) { return attached(inv, g).length >= SLOTS ? '자리 없음' : oreCount(inv, o.id) < 1 ? '광석 없음' : '붙이기'; },
        canBuy(inv) { return attached(inv, g).length < SLOTS && oreCount(inv, o.id) >= 1; },
        onBuy(item, wallet) {
          const inv = wallet.inv;
          if (attached(inv, g).length >= SLOTS) return { ok: false, msg: `${gname}에는 더 붙일 자리가 없어요. (최대 ${SLOTS}개)` };
          if (oreCount(inv, o.id) < 1) return { ok: false, msg: `${o.name}이 없어요. '광석 구입' 탭에서 사거나 해산물을 잡다 보면 나와요.` };
          inv.dore[o.id] -= 1; inv.diveAttach = inv.diveAttach || {}; (inv.diveAttach[g] = inv.diveAttach[g] || []).push(o.id);
          return { ok: true, msg: `${gname}에 ${o.name}을 붙였다! ${bonusText(o.b)}` };
        },
      };
      list.push(G.Shop.ITEMS[id]);
    }
    const cid = `dclr_${g}`;
    G.Shop.ITEMS[cid] = { id: cid, name: `${gname}의 광석 모두 떼기`, price: 0, quest: true, look: ['#8a93a8', '#4a5262'], onDescribe(item, inv) { return { name: `${gname}의 광석 모두 떼기`, desc: '붙인 광석을 모두 뗀다 (떼어 낸 광석은 사라져요)', slotName: '광석 부착', note: `지금 붙은 것: ${attached(inv, g).length ? attached(inv, g).map((x) => DORE[x].name).join(', ') : '없음'}` }; }, priceLabel(inv) { return `${attached(inv, g).length}개 떼기`; }, canBuy(inv) { return attached(inv, g).length > 0; }, onBuy(item, wallet) { const n = attached(wallet.inv, g).length; if (!n) return { ok: false, msg: '붙은 광석이 없어요.' }; wallet.inv.diveAttach[g] = []; return { ok: true, msg: `${gname}의 광석 ${n}개를 뗐다.` }; } };
    list.push(G.Shop.ITEMS[cid]);
    tabs.push({ name: `${gname} 광석`, items: list });
  }
  G.Shop.SHOPS.divegear2.tabs.push(...tabs);

  // ===== 해저 동굴: 구불구불한 물속 동굴. 끝의 보물 상자가 돈을 많이 준다 (들어갈 때마다 새 동굴) =====
  function makeCave(run) {
    const rand = mulberry(777 + run * 31);
    const CW = 150, CH = 46;
    const g = Array.from({ length: CH }, () => Array(CW).fill('#'));
    const carve = (cx, cy, rr) => { for (let r = Math.floor(cy - rr); r <= Math.ceil(cy + rr); r++) for (let c = Math.floor(cx - rr); c <= Math.ceil(cx + rr); c++) if (Math.hypot(c - cx, r - cy) <= rr && r > 1 && r < CH - 2 && c > 1 && c < CW - 2) g[r][c] = '.'; };
    let y = 23;
    const path = [];
    for (let x = 6; x <= CW - 8; x++) { y = clamp(y + (rand() - 0.5) * 1.7, 9, CH - 10); carve(x, y, Math.max(2.7, 3.2 + 1.2 * Math.sin(x * 0.15) + rand() * 0.5)); path.push({ x, y }); }
    for (let k = 0; k < 8; k++) { const p = path[16 + Math.floor(rand() * (path.length - 32))]; carve(p.x, p.y + (rand() - 0.5) * 7, 5 + rand() * 3.5); } // 방
    carve(6, path[0].y, 5);
    const sy = Math.round(path[0].y);
    g[sy][5] = 'X'; g[sy][9] = 'P';
    const end = path[path.length - 1];
    carve(end.x, end.y, 5.5);
    let cy = Math.round(end.y); while (cy < CH - 3 && g[cy + 1][Math.round(end.x)] === '.') cy++; // 바닥까지 내려가 상자를 놓는다
    g[cy][Math.round(end.x)] = 'T';
    const fishSpots = [], airSpots = [];
    for (let i = 18; i < path.length - 12; i += 12) fishSpots.push({ x: path[i].x * T, y: path[i].y * T });
    for (const f of [0.22, 0.42, 0.62, 0.82]) { const p = path[Math.floor(path.length * f)]; airSpots.push({ x: p.x * T, y: p.y * T }); }
    return { rows: g.map((r) => r.join('')), cave: true, depthBase: 700, cols: CW, left: 0, fishSpots, airSpots };
  }

  G.Sea = { inPocket, inAir, drawCritter, makeCave, depthAt, DIVE_ORES, DORE, diveBonus, ELEM_COLOR, BASE_COUNT: 56, DISH_IDS, shaftOf, GEAR_IDS, SURFACE, DEPTH, W, ROWS, DEEP, TOWN_DEPTH, SEAFOOD, BY_ID, FISH, ZONES, ZONE_NAME, SeaFish, makeLevel, zoneAt, depthOf, inTown, pickSeafood, pickHostile, makeState, updateState, nearest, draw, paintFish, Theme, drawHud };
})(window.Game);
