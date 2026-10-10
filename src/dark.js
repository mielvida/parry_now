// 다크월드: 시크너가 있는 던전 100층. 이 파일은
//   - DarkTheme   : 보랏빛 어둠의 동굴 테마 (허브와 던전 층)
//   - DarkStone   : 어둠의 돌 (단단하고 느린 몬스터)
//   - Shade       : 시크너의 그림자 (떠다니며 어둠 구슬을 쏜다)
//   - makeFloor   : 층마다 새로 만드는 던전 지형 (층이 오를수록 길고 어려워진다. 33/66/100층은 보스방)
//   - DarkBoss    : 중간보스 정의의 어둠돌(33층), 정의의 어둠(66층), 최종보스 시크너(100층)
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const rnd = G.Cave.rnd;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rr = (a, b) => a + Math.random() * (b - a);
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const BOSS_FLOORS = { 33: 'stone', 66: 'justice', 100: 'sikner' };

  // ======================= 테마 =======================
  const mix = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
  const DarkTheme = {
    rnd,
    // 탑 안쪽 벽: 어두운 벽돌, 아치 창 너머의 붉은 달밤, 타오르는 횃불. 모두 세계 좌표에 고정되어 올라갈수록 위로 흘러간다
    drawBackground(ctx, w, h, camera, time) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a0414');
      g.addColorStop(1, '#1d0a30');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const cx = camera.x;
      const cy = camera.y || 0;
      // 벽돌 (세계에 고정)
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      const bw = 64;
      const bh = 32;
      const r0 = Math.floor(cy / bh);
      const c0 = Math.floor(cx / bw);
      for (let r = r0; r <= r0 + Math.ceil(h / bh) + 1; r++) {
        const y = r * bh - cy;
        ctx.fillRect(0, y, w, 2);
        const off = (r % 2) * (bw / 2);
        for (let c = c0 - 1; c <= c0 + Math.ceil(w / bw) + 1; c++) {
          const x = c * bw + off - cx;
          ctx.fillRect(x, y, 2, bh);
        }
      }
      // 아치 창: 일정한 간격으로 (밖은 붉은 달과 별)
      const WX = 360;
      const WY = 420;
      const k0 = Math.floor((cx - 100) / WX);
      const j0 = Math.floor((cy - 300) / WY);
      for (let j = j0; j <= j0 + 2; j++) {
        for (let k = k0; k <= k0 + Math.ceil(w / WX) + 1; k++) {
          const x = k * WX + 150 + (j % 2) * 90 - cx;
          const y = j * WY + 130 - cy;
          if (x < -120 || x > w + 40 || y < -200 || y > h + 40) continue;
          ctx.fillStyle = '#05020a';
          ctx.beginPath(); ctx.moveTo(x - 4, y + 150); ctx.lineTo(x - 4, y + 40); ctx.arc(x + 36, y + 40, 40, Math.PI, 0); ctx.lineTo(x + 76, y + 150); ctx.closePath(); ctx.fill();
          const wg = ctx.createLinearGradient(0, y, 0, y + 150);
          wg.addColorStop(0, '#1a0a3a'); wg.addColorStop(1, '#4a1a5a');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.moveTo(x, y + 150); ctx.lineTo(x, y + 40); ctx.arc(x + 36, y + 40, 36, Math.PI, 0); ctx.lineTo(x + 72, y + 150); ctx.closePath(); ctx.fill();
          ctx.fillStyle = (k + j) % 3 === 0 ? '#c0304a' : 'rgba(230,200,255,0.8)'; // 달 또는 별
          ctx.beginPath(); ctx.arc(x + 44, y + 36, (k + j) % 3 === 0 ? 14 : 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#05020a'; ctx.fillRect(x + 34, y, 4, 150); ctx.fillRect(x, y + 78, 72, 4);
        }
      }
      // 횃불 (보랏빛 불꽃)
      const TX = 240;
      for (let k = Math.floor(cx / TX) - 1; k <= Math.floor((cx + w) / TX) + 1; k++) {
        for (let j = Math.floor(cy / 300) - 1; j <= Math.floor((cy + h) / 300) + 1; j++) {
          if (rnd(k, j, 11) < 0.45) continue;
          const x = k * TX + 40 + rnd(k, j, 12) * 160 - cx;
          const y = j * 300 + 90 + rnd(k, j, 13) * 140 - cy;
          const f = 0.7 + 0.3 * Math.sin(time * 9 + k * 3 + j);
          const tg = ctx.createRadialGradient(x, y, 0, x, y, 70);
          tg.addColorStop(0, `rgba(190,110,255,${0.45 * f})`); tg.addColorStop(1, 'rgba(120,40,200,0)');
          ctx.fillStyle = tg; ctx.fillRect(x - 70, y - 70, 140, 140);
          ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 3, y, 6, 22);
          ctx.fillStyle = `rgba(210,150,255,${f})`;
          ctx.beginPath(); ctx.ellipse(x, y - 4, 5, 9 * f, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
    drawCeiling() {},
    drawTile(ctx, terrain, c, r) {
      const x = c * T;
      const y = r * T;
      const above = r > 0 && terrain.grid[r - 1][c];
      const below = r + 1 < terrain.rows && terrain.grid[r + 1][c];
      const left = c > 0 && terrain.grid[r][c - 1];
      const right = c + 1 < terrain.cols && terrain.grid[r][c + 1];
      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix([36, 22, 54], [28, 16, 44], v) : mix([66, 40, 96], [52, 30, 80], v);
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; // 벽돌 줄눈
      ctx.fillRect(x, y + 15, T, 2);
      ctx.fillRect(x + (r % 2 ? 8 : 20), y, 2, 15);
      ctx.fillRect(x + (r % 2 ? 22 : 6), y + 17, 2, 15);
      if (rnd(c, r, 5) > 0.84) { // 보랏빛으로 빛나는 균열
        ctx.strokeStyle = 'rgba(200,110,255,0.7)';
        ctx.lineWidth = 1.5;
        const cx0 = x + 6 + Math.floor(rnd(c, r, 6) * (T - 12));
        ctx.beginPath(); ctx.moveTo(cx0, y + 3); ctx.lineTo(cx0 + 5, y + 12); ctx.lineTo(cx0 - 2, y + 21); ctx.lineTo(cx0 + 4, y + 30); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      if (!right) ctx.fillRect(x + T - 3, y, 3, T);
      if (!left) ctx.fillRect(x, y, 2, T);
      if (!below) ctx.fillRect(x, y + T - 4, T, 4);
      if (!above) { // 윗면: 발판 위의 어둠의 이끼
        ctx.fillStyle = '#6a3aa0';
        ctx.fillRect(x, y, T, 4);
        ctx.fillStyle = '#9a62e0';
        ctx.fillRect(x, y, T, 2);
      }
    },
    // 상점/문(허브) + 출구 문
    drawDecor(ctx, terrain, camera, time) {
      G.Beach.drawDecor(ctx, terrain, camera, time);
      G.Cave.drawDecor(ctx, terrain, camera, time);
    },
    drawVignette(ctx, w, h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, w * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(20,0,40,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };

  // ======================= 몬스터 =======================
  // 어둠의 돌: 단단하고 느린 몸통 박치기 몬스터 (흙괴물을 어둠이 삼킨 모습)
  class DarkStone extends G.Golem {
    constructor(x, y) {
      super(x, y);
      this.kind = 'darkstone';
      this.w = DarkStone.W;
      this.h = DarkStone.H;
      this.maxHp = 6;
      this.hp = 6;
    }
  }
  DarkStone.W = 40;
  DarkStone.H = 44;

  // 시크너의 그림자: 공중을 떠다니며 멀리서 어둠 구슬을 쏜다 (패링으로 쳐낼 수 있다). 박쥐처럼 한 방에 날아간다
  class Shade extends G.Bat {
    constructor(x, y) {
      super(x, y);
      this.kind = 'shade';
      this.w = Shade.W;
      this.h = Shade.H;
      this.maxHp = 3;
      this.hp = 3;
      this.cast = 0;      // >0 이면 구슬을 모으는 중 (남은 시간)
      this.shot = null;   // 방금 쏜 구슬 {x,y,vx,vy} (main이 가져간다)
      this.shotCd = 1.2;
    }

    _rollGolden() { // 황금 그림자는 없다
      this.golden = false;
      this.maxHp = 3;
      this.hp = 3;
      this.speedMul = 1;
      this.sparkleT = 0;
      this.announced = true;
      this.hurtFlash = 0;
    }

    update(dt, player, terrain) {
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      this.flap += dt * 10;
      const pcx = player.x + player.w / 2;
      const pcy = player.y + player.h / 2;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      const dx = pcx - cx;
      const dy = pcy - cy;
      const sees = Math.abs(dx) < 460 && Math.abs(dy) < 300;
      this.chasing = sees;
      if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
      if (sees) {
        // 플레이어에게서 6칸쯤 떨어진 위쪽에서 맴돈다
        const side = dx > 0 ? -1 : 1;
        const tx = pcx + side * 190 - this.w / 2 + Math.sin(this.time * 1.7) * 30;
        const ty = pcy - 80 - this.h / 2 + Math.sin(this.time * 2.3) * 16;
        this._flyToward(tx, ty, 90 * this.stageSpeed, dt);
        this.shotCd -= dt;
        if (this.cast > 0) {
          this.cast -= dt;
          if (this.cast <= 0) { // 발사: 플레이어를 향해
            const len = Math.hypot(dx, dy) || 1;
            this.shot = { x: cx + this.dir * 12, y: cy, vx: (dx / len) * 250 * this.stageSpeed, vy: (dy / len) * 250 * this.stageSpeed };
            this.shotCd = 2.4;
          }
        } else if (this.shotCd <= 0) {
          this.cast = 0.6;
        }
      } else {
        const tx = this.home.x + Math.sin(this.time * 0.6) * 80;
        const ty = this.home.y + Math.sin(this.time * 1.4) * 12;
        this._flyToward(tx, ty, 50, dt);
        this.cast = 0;
      }
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      if (this.y > terrain.height + T * 2) this.reset();
    }
  }
  Shade.W = 26;
  Shade.H = 34;

  // ======================= 층 만들기 (탑) =======================
  // 어둠의 탑: 한 층씩 올라간다. 일반 층은 세로로 긴 탑 안쪽(36줄)이고, 바닥에서 시작해 지그재그로 놓인 발판을 타고 꼭대기의 계단으로 올라간다.
  // 33/66/100층은 한 화면짜리 보스방. 층이 오를수록 발판이 좁고 간격이 벌어지며 몬스터가 늘고 강해진다.
  const TOWER_H = 36;
  const TOWER_W = 44;

  function makeTower(floor, rand) {
    const t = floor / 100;
    const pick = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const g = Array.from({ length: TOWER_H }, () => Array(TOWER_W).fill('.'));
    for (let r = 0; r < TOWER_H; r++) { g[r][0] = g[r][1] = '#'; g[r][TOWER_W - 1] = g[r][TOWER_W - 2] = '#'; } // 바깥 벽 (두께 2)
    for (let c = 0; c < TOWER_W; c++) { g[0][c] = g[1][c] = '#'; g[TOWER_H - 2][c] = g[TOWER_H - 1][c] = '#'; } // 천장, 바닥
    const platforms = []; // {row, x0, x1}: 윗면이 row인 발판
    let prev = { row: TOWER_H - 2, x0: 2, x1: TOWER_W - 3 }; // 바닥
    let guard = 0;
    while (prev.row > 9 && guard++ < 80) {
      const rise = rand() < 0.03 + 0.12 * t ? 3 : 2;
      const maxGap = rise === 3 ? 1 : 2;
      const w = pick(5, Math.max(6, 8 - Math.floor(t * 2)));
      const last = prev.row - rise <= 9;
      const row = last ? Math.max(6, prev.row - rise) : prev.row - rise;
      const ww = last ? 10 : w;
      let placed = null;
      const dirs = rand() < 0.5 ? [1, -1] : [-1, 1];
      for (const dir of dirs) {
        for (let tries = 0; tries < 6 && !placed; tries++) {
          const gap = pick(1, maxGap);
          let x0;
          let x1;
          if (prev.row === TOWER_H - 2) { // 첫 발판은 바닥 위 어디서나
            x0 = pick(3, TOWER_W - 3 - ww);
            x1 = x0 + ww - 1;
          } else if (dir > 0) { x0 = prev.x1 + 1 + gap; x1 = x0 + ww - 1; }
          else { x1 = prev.x0 - 1 - gap; x0 = x1 - ww + 1; }
          if (x0 >= 3 && x1 <= TOWER_W - 4) placed = { row, x0, x1 };
        }
        if (placed) break;
      }
      if (!placed) { // 벽 쪽이라 막히면 반대 끝으로
        const x0 = Math.max(3, prev.x0 > TOWER_W / 2 ? 3 : TOWER_W - 3 - ww);
        placed = { row, x0, x1: Math.min(TOWER_W - 4, x0 + ww - 1) };
      }
      platforms.push(placed);
      prev = placed;
      for (let c = placed.x0; c <= placed.x1; c++) g[placed.row][c] = '#';
    }
    const top = platforms[platforms.length - 1];
    // 몬스터: 발판마다. 지상 몬스터는 발판 위, 박쥐/그림자는 발판 위 공중
    const ground = (p, name) => { const c = pick(p.x0 + 1, Math.max(p.x0 + 1, p.x1 - 1)); if (g[p.row - 1][c] === '.') g[p.row - 1][c] = name; };
    const air = (p, name, up) => { const c = pick(p.x0, p.x1); const r = p.row - up; if (r > 2 && g[r][c] === '.' && g[r - 1][c] === '.') g[r][c] = name; };
    platforms.slice(0, -1).forEach((p, i) => {
      if (i === 0 && floor < 3) return;
      const w = p.x1 - p.x0 + 1;
      if (w >= 5 && rand() < 0.55 + 0.3 * t) {
        const x = rand();
        ground(p, floor >= 10 && x < 0.1 + t * 0.2 ? 'j' : floor >= 5 && x < 0.3 + t * 0.15 ? 'k' : x < 0.5 ? 'G' : 'S');
      }
      if (rand() < 0.28 + 0.4 * t) air(p, floor >= 10 && rand() < 0.4 ? 'j' : 'B', 4);
      if (floor >= 20 && w >= 6 && rand() < 0.3 * t + 0.1) ground(p, rand() < 0.5 ? 'S' : 'k');
    });
    // 바닥에도 몇 마리 (시작 지점에서 떨어진 곳)
    for (let n = 0; n < Math.min(4, 1 + Math.floor(floor / 15)); n++) {
      const c = pick(14, TOWER_W - 6);
      if (g[TOWER_H - 3][c] === '.') g[TOWER_H - 3][c] = rand() < 0.5 ? 'S' : 'G';
    }
    g[TOWER_H - 3][3] = 'X';
    g[TOWER_H - 3][6] = 'P';
    g[top.row - 1][Math.floor((top.x0 + top.x1) / 2)] = 'T'; // 꼭대기의 위층으로 오르는 계단
    return { floor, rows: g.map((r) => r.join('')), boss: null, bossKind: null, tower: true };
  }

  // 보스방: 짧은 복도 + 한 화면짜리 평평한 경기장 (보스가 시작되면 복도 쪽이 막힌다)
  function makeBossRoom(floor, bossKind) {
    const W = 34;
    const g = Array.from({ length: 18 }, () => Array(W).fill('.'));
    for (let r = 0; r < 18; r++) for (let c = 0; c < W; c++) if (r <= 1 || r >= 16) g[r][c] = '#';
    g[15][1] = 'X';
    g[15][3] = 'P';
    g[15][W - 3] = 'T';
    return { floor, rows: g.map((r) => r.join('')), boss: { col: 5, kind: 'dark_' + bossKind, drop: 'darkcrystal' }, bossKind, tower: false };
  }

  function makeFloor(floor) {
    const rand = mulberry(floor * 7919 + 17);
    const bossKind = BOSS_FLOORS[floor] || null;
    return bossKind ? makeBossRoom(floor, bossKind) : makeTower(floor, rand);
  }

  // ======================= 보스 =======================
  const META = {
    stone: { name: '정의의 어둠돌', hp: () => C.BOSS_STONE_HP, patterns: ['slam', 'quake', 'charge', 'rain', 'tumble', 'ball', 'spawn'], defeat: '정의의 어둠돌을 쓰러뜨렸다!', scale: 1.05 },
    justice: { name: '정의의 어둠', hp: () => C.BOSS_JUSTICE_HP, patterns: ['blink', 'charge', 'icicle', 'shard', 'ball', 'spawn'], defeat: '정의의 어둠을 쓰러뜨렸다!', scale: 1.15 },
    sikner: { name: '시크너', hp: () => C.BOSS_SIKNER_HP, patterns: ['nova', 'blink', 'quake', 'rain', 'shard', 'ball', 'slam', 'spawn'], defeat: '시크너를 쓰러뜨렸다!', scale: 1.3 },
  };
  const MINIONS = { stone: ['darkstone', 'darkslime'], justice: ['shade', 'darkslime', 'darkstone'], sikner: ['shade', 'darkstone', 'darkslime', 'shade'] };
  const SHARD_LEN = 76;
  const APPEAR = { stone: 2.2, justice: 2.4, sikner: 3.0 }; // 등장 연출 시간(초)
  const NEW_PATTERNS = ['shard', 'rain', 'quake', 'charge', 'nova', 'blink', 'tumble', 'icicle'];

  class DarkBoss extends G.KingSlime {
    constructor(left, width, groundY, ev, kind) {
      super(left, width, groundY, ev);
      const m = META[kind];
      this.dkind = kind;
      this.kind = 'dark';
      this.name = m.name;
      if (kind === 'sikner') this.name = '어둠의 기사 시크너';
      this.defeatText = m.defeat;
      this.patterns = m.patterns;
      this.scale = m.scale;
      this.body.maxHp = m.hp();
      this.body.hp = this.body.maxHp;
      this.hurtDmg = 3; // 암흑의 존재는 한 번에 목숨 3개
      this.weak = { stone: 'crystal', justice: 'light', sikner: 'fire' }[kind]; // 약점 속성 (어둠돌: 수정, 정의의 어둠: 빛, 시크너: 불꽃)
      this.shards = [];
      this.rains = [];
      this.spikes = [];
      this.rage = false; // 체력이 절반 아래면 분노: 더 빠르고 더 많이
      this.body.state = 'appear'; // 처음 나타날 때의 등장 연출
      this.body.st = 0;
      this.timer = APPEAR[kind] + 0.6;
      this.hoverT = 0;
      this.glideAt = 0;
      this.glideX = this.body.cx;
    }

    // ---------- 등장 연출 ----------
    // 어둠돌: 땅이 갈라지며 솟아오른다 / 정의의 어둠: 하늘에서 빛과 함께 천천히 내려온다 / 시크너: 어둠의 소용돌이에서 베어 가르며 나타난다
    _updateBody(dt) {
      const b = this.body;
      if (b.state !== 'appear') {
        const cy0 = b.cy;
        super._updateBody(dt);
        if (this.dkind === 'sikner' && (b.state === 'idle' || b.state === 'wind')) { b.cy = cy0; b._box(); } // 시크너는 떠 있다
        return;
      }
      b.flash = Math.max(0, b.flash - dt);
      b.hitGrace = Math.max(0, b.hitGrace - dt);
      const prev = b.st;
      b.st += dt;
      b.sx = 1;
      b.sy = 1;
      b.dir = this.playerX < b.cx ? -1 : 1;
      const d = APPEAR[this.dkind];
      const u = Math.min(1, b.st / d);
      const ease = 1 - Math.pow(1 - u, 3);
      const gc = this.groundCy;
      if (this.dkind === 'stone') {
        b.cy = gc + (1 - ease) * b.h * 1.4;
        if (Math.floor(b.st * 10) !== Math.floor(prev * 10)) { this.ev.shake(5, 0.12); this.ev.fx('fire', b.cx + rr(-60, 60), this.groundY - 4); }
      } else if (this.dkind === 'justice') {
        b.cy = gc - (1 - ease) * 460;
      } else {
        b.cy = gc - 48;
        if (prev < d * 0.45 && b.st >= d * 0.45) { this.ev.sound('vanish'); this.ev.shake(8, 0.3); }
        if (prev < d * 0.62 && b.st >= d * 0.62) { this.ev.sound('shatter'); this.ev.shake(12, 0.4); }
      }
      if (u >= 1) {
        b.state = 'idle';
        b.st = 0;
        if (this.dkind !== 'sikner') this.ev.slamImpact(b.cx, this.groundY);
      }
      b._box();
    }

    // 등장 중의 그림. 처리했으면 true
    _drawAppear(ctx, b) {
      const d = APPEAR[this.dkind];
      const u = Math.min(1, b.st / d);
      const gy = this.groundY;
      if (this.dkind === 'stone') {
        ctx.save(); // 땅 속에 있는 부분은 가린다
        ctx.beginPath(); ctx.rect(this.left - 200, 0, this.right - this.left + 400, gy); ctx.clip();
        this._drawKing(ctx, b);
        ctx.restore();
        ctx.strokeStyle = `rgba(210,130,255,${0.9 * (1 - u * 0.6)})`; ctx.lineWidth = 3; // 땅의 균열
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(b.cx, gy - 2);
          let x = b.cx; let y = gy - 2;
          for (let k = 1; k <= 5; k++) { x += s * (30 + k * 12) * Math.min(1, u * 2.2); y += (k % 2 ? 5 : -4); ctx.lineTo(x, y); }
          ctx.stroke();
        }
      } else if (this.dkind === 'justice') {
        const a = Math.min(1, u * 1.5);
        const g = ctx.createLinearGradient(0, 0, 0, gy); // 하늘에서 내려오는 빛줄기
        g.addColorStop(0, `rgba(255,255,255,${0.55 * (1 - u * 0.5)})`); g.addColorStop(1, 'rgba(180,120,255,0)');
        ctx.fillStyle = g; ctx.fillRect(b.cx - 70, 0, 140, gy);
        ctx.save(); ctx.globalAlpha = a; this._drawKing(ctx, b); ctx.restore();
      } else {
        const cx = b.cx;
        const cy = b.cy;
        if (u < 0.7) { // 어둠의 소용돌이
          const r = 30 + 90 * Math.min(1, u / 0.45);
          for (let k = 0; k < 4; k++) {
            const a0 = this.time * (4 + k) + k * 1.6;
            ctx.strokeStyle = `rgba(${k % 2 ? '215,190,255' : '120,70,220'},${0.8 - u * 0.6})`; ctx.lineWidth = 4 - k * 0.6;
            ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, r - k * 14), a0, a0 + Math.PI * 1.3); ctx.stroke();
          }
          const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, r + 30);
          gl.addColorStop(0, 'rgba(255,255,255,0.5)'); gl.addColorStop(1, 'rgba(100,40,200,0)');
          ctx.fillStyle = gl; ctx.fillRect(cx - r - 30, cy - r - 30, (r + 30) * 2, (r + 30) * 2);
        }
        const a = Math.max(0, Math.min(1, (u - 0.42) / 0.22));
        if (a > 0) { ctx.save(); ctx.globalAlpha = a; this._drawKing(ctx, b); ctx.restore(); }
        if (u > 0.6 && u < 0.82) { // 번뜩이는 일섬: 화면을 가로지르는 흰 베기
          const k = 1 - (u - 0.6) / 0.22;
          ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
          ctx.beginPath(); ctx.moveTo(this.left - 40, cy - 14 * k); ctx.lineTo(this.right + 40, cy - 3); ctx.lineTo(this.right + 40, cy + 3); ctx.lineTo(this.left - 40, cy + 14 * k); ctx.closePath(); ctx.fill();
        }
      }
      return true;
    }

    // 시크너는 날아다닌다: 쉴 때는 공중을 미끄러지듯 옮겨 다니고, 기절하면 땅으로 떨어진다
    _hover(dt) {
      const b = this.body;
      if (b.state === 'idle' || b.state === 'wind') {
        this.hoverT += dt;
        if (this.hoverT >= this.glideAt) {
          this.glideAt = this.hoverT + rr(0.9, 1.7);
          let x = rr(this.left + 110, this.right - 110);
          if (Math.abs(x - this.playerX) < 160) x = clamp(x + (x < this.playerX ? -260 : 260), this.left + 110, this.right - 110);
          this.glideX = x;
        }
        b.cx += clamp(this.glideX - b.cx, -(this.rage ? 330 : 240) * dt, (this.rage ? 330 : 240) * dt);
        const target = this.groundCy - (50 + Math.sin(this.time * 2.2) * 12);
        b.cy += (target - b.cy) * Math.min(1, 7 * dt);
        b._box();
      } else if (b.state === 'crouch') {
        b.cy += (this.groundCy - b.cy) * Math.min(1, 9 * dt);
        b._box();
      }
    }

    minionKind() { const l = MINIONS[this.dkind]; return l[Math.floor(Math.random() * l.length)]; }

    // 패턴 고르기: 방금 한 패턴은 연달아 하지 않고, 부하 소환은 한 판에 딱 한 번만 한다
    _startPattern() {
      if (!this.body.alive) return;
      let pool = this.patterns.filter((t) => t !== this.lastType && !(t === 'spawn' && this.spawnedOnce));
      if (!pool.length) pool = this.patterns.filter((t) => t !== 'spawn');
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.lastType = type;
      if (type === 'spawn') this.spawnedOnce = true;
      const rage = this.rage;
      this.pat = { type, t: 0, n: 0, sub: 'start' };
      if (type === 'ball') {
        const count = (this.dkind === 'sikner' ? 6 : 4) + (rage ? 2 : 0);
        this.pat.shots = [];
        for (let k = 0; k < count; k++) this.pat.shots.push({ at: 0.9 + k * (rage ? 0.65 : 0.8), fired: false });
        this.pat.end = 0.9 + (count - 1) * (rage ? 0.65 : 0.8) + 0.9;
      } else if (type === 'shard') this.pat.cnt = 8 + (rage ? 4 : 0);
      else if (type === 'rain') this.pat.cnt = (this.dkind === 'sikner' ? 10 : 6) + (rage ? 5 : 0);
      this.phase = 'pattern';
    }

    _runPattern(dt) {
      const p = this.pat;
      if (!NEW_PATTERNS.includes(p.type)) { super._runPattern(dt); return; }
      p.t += dt;
      const b = this.body;
      let finished = false;
      if (p.type === 'shard') { // 양쪽 벽에서 어둠의 칼날이 가로로 날아온다
        while (p.n < p.cnt && p.t >= 0.5 + p.n * (this.rage ? 0.4 : 0.5)) {
          p.n += 1;
          const low = Math.random() < 0.5;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.shards.push({ side, low, y: this.groundY - (low ? 24 : 92), h: low ? 24 : 34, st: 'warn', t: 0, x: side > 0 ? this.right : this.left });
        }
        finished = p.n >= p.cnt && this.shards.length === 0;
      } else if (p.type === 'rain') { // 위에서 어둠의 창(어둠돌은 바위)이 떨어진다
        while (p.n < p.cnt && p.t >= 0.3 + p.n * (this.rage ? 0.24 : 0.32)) {
          p.n += 1;
          const x = clamp(this.playerX + (p.n === 1 ? 0 : rr(-190, 190)), this.left + 30, this.right - 30);
          this.rains.push({ x, y: -50, t: 0, st: 'warn', hit: false });
        }
        finished = p.n >= p.cnt && this.rains.length === 0;
      } else if (p.type === 'quake') finished = this._runQuake(p, this.body);
      else if (p.type === 'charge') finished = this._runCharge(p, this.body);
      else if (p.type === 'nova') finished = this._runNova(p, this.body);
      else if (p.type === 'tumble') finished = this._runTumble(p, this.body, dt);
      else if (p.type === 'icicle') finished = this._runIcicle(p, this.body, dt);
      else finished = this._runBlink(p, this.body);
      if (p.type !== 'nova') b.glow = 0;
      b._box();
      if (finished) this._endPattern();
    }

    // 구르기와 탱탱볼 (어둠돌): 돌처럼 벽에서 벽으로 구르며 천장에서 돌을 떨어뜨리고, 이어서 10초 동안 벽과 땅, 천장을 탱탱볼처럼 튕겨 다닌다.
    // 그동안 때릴 수 있고, 패링하면 위로 높이 튕겨 올라가 큰 피해를 입는다. 시간이 끝나면 땅에 철퍼덕 주저앉는다.
    _runTumble(p, b, dt) {
      const L = this.left + 70;
      const R = this.right - 70;
      const dur = this.rage ? 11 : 10;
      if (p.sub === 'start') {
        b.state = 'roll';
        b.rot = b.rot || 0;
        p.sub = 'roll';
        p.k = 0;
        p.dirR = b.cx < (L + R) / 2 ? 1 : -1;
        p.nextRock = 0.4;
        this.ev.sound('vanish');
      }
      if (p.sub === 'roll') {
        const sp = this.rage ? 680 : 540;
        b.cx += p.dirR * sp * dt;
        b.cy = this.groundCy + 4;
        b.dir = p.dirR;
        b.rot += p.dirR * (sp / 50) * dt;
        b.sx = 1; b.sy = 0.96;
        if (p.t >= p.nextRock) { // 구르는 동안 천장에서 돌이 떨어진다
          p.nextRock = p.t + (this.rage ? 0.32 : 0.42);
          this.rains.push({ x: clamp(this.playerX + rr(-220, 220), this.left + 30, this.right - 30), y: -50, t: 0, st: 'warn', hit: false });
        }
        if ((p.dirR > 0 && b.cx >= R) || (p.dirR < 0 && b.cx <= L)) {
          b.cx = clamp(b.cx, L, R);
          p.k += 1;
          this.ev.slamImpact(b.cx, this.groundY);
          this.ev.shake(8, 0.25);
          if (p.k < (this.rage ? 3 : 2)) p.dirR = -p.dirR;
          else { // 벽에 부딪혀 튕겨 오른다: 탱탱볼 시작
            p.sub = 'bounce';
            p.tb = p.t;
            b.state = 'bounce';
            b.vx = -p.dirR * (this.rage ? 560 : 470);
            b.vy = -820;
            this.launchT = 0;
          }
        }
      } else if (p.sub === 'bounce') {
        this.launchT = Math.max(0, (this.launchT || 0) - dt);
        b.vy += 1650 * dt;
        b.cx += b.vx * dt;
        b.cy += b.vy * dt;
        b.rot += (b.vx / 60) * dt;
        const ceil = this.groundY - 330;
        let hitWall = 0;
        if (b.cx < L) { b.cx = L; b.vx = Math.abs(b.vx); hitWall = -1; }
        if (b.cx > R) { b.cx = R; b.vx = -Math.abs(b.vx); hitWall = 1; }
        if (b.cy < ceil) { b.cy = ceil; b.vy = Math.abs(b.vy) * 0.9; }
        if (b.cy >= this.groundCy) {
          b.cy = this.groundCy;
          b.vy = -Math.max(720, Math.abs(b.vy) * 0.93);
          b.vx += rr(-90, 90);
          b.vx = clamp(b.vx, -this.maxV(), this.maxV());
          if (Math.abs(b.vx) < 260) b.vx = (b.vx < 0 ? -1 : 1) * 260;
          this.ev.slamImpact(b.cx, this.groundY);
        }
        if (hitWall) { // 벽에 부딪힐 때마다 그 쪽 천장에서 돌이 떨어진다
          this.ev.shake(6, 0.15);
          this.rains.push({ x: clamp(b.cx - hitWall * 90, this.left + 30, this.right - 30), y: -50, t: 0, st: 'warn', hit: false });
        }
        b.sx = 1 - Math.min(0.12, Math.abs(b.vy) / 9000);
        b.sy = 1 + Math.min(0.15, Math.abs(b.vy) / 7000);
        if (p.t - p.tb >= dur) {
          p.sub = 'land';
          b.state = 'down';
          b.st = 0;
          b.hold = 1.4; // 지쳐서 주저앉는다: 때릴 기회
          b.vx = 0; b.vy = 0;
          b.rot = 0;
          this.ev.slamImpact(b.cx, this.groundY);
        }
      } else { // 'land'
        if (b.state === 'idle') { b.rot = 0; return true; }
      }
      return false;
    }

    maxV() { return this.rage ? 720 : 620; }

    // 튕기는 동안 패링하면 위로 높이 튕겨 올라가고 큰 피해를 입는다
    deflect(rect) {
      const b = this.body;
      if (this.pat && this.pat.type === 'tumble' && b.state === 'bounce') {
        if ((this.launchT || 0) > 0) return 0;
        if (b.x + b.w >= rect.x && b.x <= rect.x + rect.w && b.y + b.h >= rect.y && b.y <= rect.y + rect.h) {
          this.launchT = 0.5;
          b.vy = -1250;
          b.vx *= 0.6;
          b.flash = 0.25;
          this.damageBody(C.BOSS_PARRY_DAMAGE);
          this.ev.fx('burst', b.cx, b.cy + b.h / 2);
          this.ev.shake(8, 0.2);
          return 1;
        }
        return 0;
      }
      return super.deflect(rect);
    }

    // 고드름 (정의의 어둠): 차가운 기운을 모아 고드름을 부채꼴로 날린다 (패링하면 되돌아간다). 이어서 천장에서 고드름이 떨어진다
    _runIcicle(p, b, dt) {
      const volleys = this.rage ? 4 : 3;
      if (p.sub === 'start') { b.state = 'wind'; p.sub = 'fire'; p.k = 0; p.next = 0.9; this.ev.sound('vanish'); }
      b.dir = this.playerX < b.cx ? -1 : 1;
      if (p.sub === 'fire') {
        b.glow = Math.max(0, Math.min(1, 1 - (p.next - p.t) / 0.5));
        if (p.t >= p.next) {
          const sx = b.cx + b.dir * 30;
          const sy = b.cy - 30;
          const a0 = Math.atan2(this.playerY - sy, this.playerX - sx);
          const n = this.rage ? 7 : 5;
          const sp = this.rage ? 600 : 520;
          for (let i = 0; i < n; i++) {
            const a = a0 + (i - (n - 1) / 2) * 0.24;
            this.balls.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, reflected: false, life: 3, t: 0, kind: 'icicle' });
          }
          this.ev.sound('shatter');
          b.glow = 0;
          p.k += 1;
          p.next = p.t + (this.rage ? 0.85 : 1.1);
          if (p.k >= volleys) { p.sub = 'drop'; p.dn = 0; p.next = p.t + 0.9; b.state = 'idle'; }
        }
      } else { // 천장에서 고드름이 떨어진다
        const cnt = this.rage ? 10 : 7;
        while (p.dn < cnt && p.t >= p.next + p.dn * (this.rage ? 0.22 : 0.3)) {
          p.dn += 1;
          this.rains.push({ x: clamp(this.playerX + (p.dn === 1 ? 0 : rr(-260, 260)), this.left + 30, this.right - 30), y: -50, t: 0, st: 'warn', hit: false });
        }
        return p.dn >= cnt && this.rains.length === 0;
      }
      return false;
    }

    // 땅울림: 발을 구르면 양옆으로 퍼지며 땅에서 뾰족한 돌/수정이 차례로 솟는다 (점프로 넘는다)
    _runQuake(p, b) {
      if (p.sub === 'start') { b.state = 'crouch'; b.st = 0; p.cd = 0.7; p.sub = 'wind'; return false; }
      if (p.sub === 'wind') {
        if (p.t < 0.7) return false;
        b.state = 'idle';
        this.ev.slamImpact(b.cx, this.groundY);
        const per = (this.dkind === 'sikner' ? 8 : 7) + (this.rage ? 2 : 0);
        for (let i = 0; i < per; i++) {
          for (const side of [-1, 1]) {
            const x = b.cx + side * (70 + i * 68);
            if (x > this.left + 20 && x < this.right - 20) this.spikes.push({ x, t: -0.1 - i * (this.rage ? 0.12 : 0.16), hit: false });
          }
        }
        p.sub = 'erupt';
        p.te = p.t;
        return false;
      }
      return this.spikes.length === 0 && p.t > p.te + 0.5;
    }

    // 돌진: 웅크렸다가 반대편 벽까지 땅을 가르며 달린다 (패링하면 튕겨 나가 기절)
    _runCharge(p, b) {
      const fast = this.dkind === 'justice';
      const total = (fast ? 4 : 3) + (this.rage ? 1 : 0);
      if (p.sub === 'start') { this._crouch(p, fast ? 0.45 : 0.7); p.tx = this._chargeTarget(); return false; }
      if (p.sub === 'crouch') {
        p.tx = this._chargeTarget();
        if (p.t - p.t0 >= p.cd) { b.rush = true; this._travel({ x: p.tx, y: this.groundCy }, fast ? 0.42 : 0.62, 0); p.sub = 'air'; }
      } else if (p.sub === 'air') {
        if (b.state === 'down') { b.rush = false; p.n += 1; p.sub = 'down'; }
      } else if (p.sub === 'down') {
        if (b.state === 'idle') {
          if (p.n < total) { this._crouch(p, fast ? 0.4 : 0.55); p.tx = this._chargeTarget(); } else return true;
        }
      }
      return false;
    }

    _chargeTarget() {
      const mid = (this.left + this.right) / 2;
      return this.body.cx < mid ? this.right - 70 : this.left + 70;
    }

    // 어둠 분수: 몸을 부풀렸다가 어둠 구슬을 사방으로 쏘아 올린다 (포물선으로 떨어진다. 패링하면 되돌아간다)
    _runNova(p, b) {
      const rings = this.rage ? 3 : 2;
      if (p.sub === 'start') { b.state = 'wind'; p.sub = 'wind'; }
      if (p.sub === 'wind') {
        b.glow = Math.min(1, p.t / 0.9);
        if (p.t >= 0.9) { p.sub = 'fire'; p.ring = 0; p.nextAt = p.t; }
      } else if (p.sub === 'fire') {
        if (p.ring < rings && p.t >= p.nextAt) {
          const N = this.rage ? 16 : 12;
          for (let i = 0; i < N; i++) {
            const a = -Math.PI * 1.02 + ((i + (p.ring % 2 ? 0.5 : 0)) / (N - 1)) * Math.PI * 1.04;
            const sp = i % 2 ? 400 : 300;
            this.balls.push({ x: b.cx, y: b.cy - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 460, reflected: false, life: 6, t: 0 });
          }
          this.ev.sound('spawn');
          this.ev.shake(5, 0.2);
          p.ring += 1;
          p.nextAt = p.t + 0.8;
          b.glow = 0;
          b.state = 'idle';
        } else if (p.ring >= rings && p.t >= p.nextAt) { b.glow = 0; return true; }
      }
      return false;
    }

    // 순간이동: 사라졌다가 플레이어의 머리 위에서 내려찍는다
    _runBlink(p, b) {
      const total = (this.dkind === 'sikner' ? 4 : 3) + (this.rage ? 1 : 0);
      const lo = this.left + 60;
      const hi = this.right - 60;
      if (p.sub === 'start') { b.state = 'hide'; b.st = 0; p.sub = 'vanish'; p.t0 = p.t; this.ev.sound('vanish'); }
      else if (p.sub === 'vanish') {
        if (p.t - p.t0 >= 0.45) { p.sub = 'mark'; p.t0 = p.t; p.tx = clamp(this.playerX, lo, hi); }
      } else if (p.sub === 'mark') {
        const u = p.t - p.t0;
        const lock = this.rage ? 0.35 : 0.55;
        if (u < lock) p.tx = clamp(this.playerX, lo, hi);
        if (u >= lock + 0.35) {
          b.cx = p.tx;
          b.cy = -b.h;
          b._box();
          b.rush = true;
          this._travel({ x: p.tx, y: this.groundCy }, 0.28, 0);
          p.sub = 'air';
        }
      } else if (p.sub === 'air') {
        if (b.state === 'down') { b.rush = false; p.n += 1; p.sub = 'down'; }
      } else if (p.sub === 'down') {
        if (b.state === 'idle') {
          if (p.n < total) { b.state = 'hide'; b.st = 0; p.sub = 'vanish'; p.t0 = p.t; this.ev.sound('vanish'); } else return true;
        }
      }
      return false;
    }

    _endPattern() {
      this.body.rush = false;
      super._endPattern();
      if (this.rage && this.phase === 'rest') this.timer *= 0.55; // 분노하면 쉬는 시간이 짧다
    }

    update(dt, player) {
      if (!this.rage && this.body.alive && this.body.hp < this.body.maxHp * 0.5) { // 체력이 절반 아래로: 분노
        this.rage = true;
        this.ev.shake(14, 0.6);
        this.ev.sound('hurt');
        this.ev.fx('boom', this.body.cx, this.body.cy);
      }
      super.update(dt, player);
      if (this.dkind === 'sikner' && this.body.alive && !this.done) this._hover(dt);
      if (this.done) { this.shards.length = 0; this.rains.length = 0; this.spikes.length = 0; return; }
      if (!this.body.alive) { this.spikes.length = 0; return; }
      for (const k of this.shards) {
        k.t += dt;
        if (k.st === 'warn') { if (k.t >= 0.65) { k.st = 'fly'; k.t = 0; this.ev.sound('shatter'); } }
        else { k.x -= k.side * 780 * dt; if (k.x < this.left - 80 || k.x > this.right + 80) k.dead = true; }
      }
      this.shards = this.shards.filter((k) => !k.dead);
      for (const r of this.rains) {
        r.t += dt;
        if (r.st === 'warn') { if (r.t >= 0.75) { r.st = 'fall'; r.t = 0; } }
        else if (r.st === 'fall') { r.y += 1500 * dt; if (r.y >= this.groundY - 10) { r.y = this.groundY - 10; r.st = 'boom'; r.t = 0; this.ev.slamImpact(r.x, this.groundY); } }
        else if (r.t >= 0.4) r.dead = true;
      }
      this.rains = this.rains.filter((r) => !r.dead);
      for (const s of this.spikes) s.t += dt;
      this.spikes = this.spikes.filter((s) => s.t < 0.95);
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const k of this.shards) {
          if (k.st === 'warn') continue;
          const x0 = k.side > 0 ? k.x : k.x - SHARD_LEN;
          if (player.overlaps({ x: x0, y: k.y, w: SHARD_LEN, h: k.h })) { k.dead = true; hurt = true; }
        }
        for (const r of this.rains) {
          if (r.hit) continue;
          const near = r.st === 'fall' ? Math.abs(r.x - this.playerX) < 18 + player.w / 2 - 4 && Math.abs(r.y - this.playerY) < 22 + player.h / 2 : r.st === 'boom' && r.t < 0.2 && Math.abs(r.x - this.playerX) < 44 + player.w / 2 - 6 && player.y + player.h > this.groundY - 40;
          if (near) { r.hit = true; hurt = true; }
        }
        for (const s of this.spikes) {
          if (s.hit || s.t < 0.5 || s.t > 0.9) continue;
          if (player.overlaps({ x: s.x - 18, y: this.groundY - 64, w: 36, h: 64 })) { s.hit = true; hurt = true; }
        }
        if (hurt) this.ev.hurt(this.hurtDmg);
      }
    }

    // ---------- 그리기 ----------
    drawFront(ctx) {
      const p = this.pat;
      const b = this.body;
      for (const r of this.rains) if (r.st === 'warn') this._drawMark(ctx, r.x, 76, r.t / 0.75, r.t > 0.45);
      if (p && p.type === 'slam' && p.sub === 'crouch') this._drawMark(ctx, p.tx, 150, (p.t - p.t0) / p.cd, p.t - p.t0 > p.cd - 0.3);
      if (p && p.type === 'charge' && p.sub === 'crouch') this._drawChargeLane(ctx, p);
      if (p && p.type === 'blink' && p.sub === 'mark') {
        const u = p.t - p.t0;
        const lock = this.rage ? 0.35 : 0.55;
        this._drawMark(ctx, p.tx, 110, u / (lock + 0.35), u > lock);
      }
      for (const s of this.spikes) this._drawQuakeSpike(ctx, s);
      if (this.dkind === 'sikner' && !b.dead && b.state !== 'appear') { // 떠 있는 시크너의 그림자
        const hgt = Math.max(0, this.groundY - (b.y + b.h));
        const k = Math.max(0, 1 - hgt / 220);
        ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
        ctx.beginPath(); ctx.ellipse(b.cx, this.groundY - 2, 46 * (0.5 + 0.5 * k), 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (!b.dead) {
        if (b.state === 'appear') this._drawAppear(ctx, b);
        else if (b.state === 'hide') { // 순간이동 중: 사라지는 동안 흐려진다
          const a = p && p.sub === 'vanish' ? Math.max(0, 1 - (p.t - p.t0) / 0.45) : 0;
          if (a > 0.03) { ctx.save(); ctx.globalAlpha = a; this._drawKing(ctx, b); ctx.restore(); }
        } else this._drawKing(ctx, b);
      }
      for (const f of this.balls) this._drawBall(ctx, f);
      for (const k of this.shards) this._drawShard(ctx, k);
      for (const r of this.rains) if (r.st !== 'warn') this._drawSpike(ctx, r);
    }

    // 돌진 예고: 달려갈 길이 붉게 깜빡이며 화살표로 보인다
    _drawChargeLane(ctx, p) {
      const b = this.body;
      const u = (p.t - p.t0) / p.cd;
      const blink = u > 0.6 ? (Math.floor(this.time * 16) % 2 ? 1 : 0.4) : 0.8;
      const gy = this.groundY;
      const dir = p.tx > b.cx ? 1 : -1;
      const x0 = Math.min(b.cx, p.tx);
      const x1 = Math.max(b.cx, p.tx);
      ctx.fillStyle = `rgba(255,70,110,${0.22 * blink})`;
      ctx.fillRect(x0, gy - 70, x1 - x0, 70);
      ctx.fillStyle = `rgba(255,170,190,${0.85 * blink})`;
      for (let x = x0 + 30; x < x1 - 20; x += 70) {
        ctx.beginPath(); ctx.moveTo(x + dir * 14, gy - 35); ctx.lineTo(x - dir * 10, gy - 52); ctx.lineTo(x - dir * 10, gy - 18); ctx.closePath(); ctx.fill();
      }
    }

    // 땅울림: 솟기 전엔 땅이 갈라져 빛나고, 솟으면 뾰족한 돌/수정이 올라온다
    _drawQuakeSpike(ctx, s) {
      if (s.t < 0) return;
      const gy = this.groundY;
      const stone = this.dkind === 'stone';
      if (s.t < 0.5) {
        const blink = s.t > 0.3 ? (Math.floor(this.time * 18) % 2 ? 1 : 0.4) : 0.8;
        ctx.strokeStyle = `rgba(230,170,255,${0.9 * blink})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(s.x - 20, gy - 2); ctx.lineTo(s.x - 6, gy - 7); ctx.lineTo(s.x + 4, gy - 1); ctx.lineTo(s.x + 20, gy - 6); ctx.stroke();
        ctx.fillStyle = `rgba(170,90,255,${0.35 * blink})`; ctx.fillRect(s.x - 22, gy - 6, 44, 6);
        return;
      }
      const u = Math.min(1, (s.t - 0.5) / 0.12);
      const fade = s.t > 0.8 ? Math.max(0, 1 - (s.t - 0.8) / 0.15) : 1;
      const h = 64 * u * fade;
      ctx.fillStyle = stone ? '#4a3d66' : '#7a3fd0';
      ctx.beginPath(); ctx.moveTo(s.x - 18, gy); ctx.lineTo(s.x - 4, gy - h); ctx.lineTo(s.x + 4, gy - h * 0.82); ctx.lineTo(s.x + 18, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = stone ? '#8a78b0' : '#e0b8ff';
      ctx.beginPath(); ctx.moveTo(s.x - 6, gy); ctx.lineTo(s.x - 4, gy - h); ctx.lineTo(s.x + 2, gy - h * 0.8); ctx.lineTo(s.x + 4, gy); ctx.closePath(); ctx.fill();
    }

    _drawMark(ctx, x, w, a, locked) { // 어둠의 표시 (보랏빛)
      const gy = this.groundY;
      const blink = locked ? (Math.floor(this.time * 14) % 2 ? 1 : 0.45) : 0.85;
      const al = (0.35 + 0.5 * Math.min(1, a)) * blink;
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, 'rgba(180,90,255,0)');
      g.addColorStop(1, `rgba(180,90,255,${0.55 * al})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, 0, w, gy);
      ctx.fillStyle = `rgba(120,40,200,${al})`;
      ctx.fillRect(x - w / 2, gy - 8, w, 8);
      ctx.fillStyle = `rgba(235,200,255,${al})`;
      ctx.fillRect(x - w / 2, gy - 10, w, 2);
      ctx.strokeStyle = `rgba(235,200,255,${al})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - w / 2, 0, w, gy - 8);
      const bob = (this.time * 90) % 40;
      for (let k = 0; k < 3; k++) {
        const y = gy - 70 - k * 40 + bob;
        if (y > gy - 24) continue;
        ctx.fillStyle = `rgba(255,255,255,${al})`;
        ctx.beginPath(); ctx.moveTo(x - 14, y - 10); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x, y + 8); ctx.fill();
      }
    }

    _drawBall(ctx, f) { // 어둠 구슬 (쳐내면 하얗게 변해 되돌아간다). 정의의 어둠은 고드름
      if (f.kind === 'icicle') {
        const ang = Math.atan2(f.vy, f.vx);
        const white = f.reflected;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(ang);
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 36);
        g.addColorStop(0, white ? 'rgba(255,255,255,0.8)' : 'rgba(170,225,255,0.6)'); g.addColorStop(1, 'rgba(120,190,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-36, -36, 72, 72);
        for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(190,235,255,${0.3 - i * 0.07})`; ctx.fillRect(-i * 16 - 10, -3, 14, 6); }
        ctx.fillStyle = white ? '#ffffff' : '#bfe8ff';
        ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-14, -8); ctx.lineTo(-20, 0); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = white ? '#c8d8ff' : '#5fa8d9'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -3); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      const R = 18;
      const white = f.reflected;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, R + 14);
      g.addColorStop(0, white ? 'rgba(255,255,255,0.95)' : 'rgba(220,150,255,0.9)'); g.addColorStop(1, white ? 'rgba(200,220,255,0)' : 'rgba(120,40,200,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R - 14, f.y - R - 14, (R + 14) * 2, (R + 14) * 2);
      const ang = Math.atan2(f.vy, f.vx);
      for (let i = 1; i <= 4; i++) {
        ctx.fillStyle = white ? `rgba(230,240,255,${0.45 - i * 0.08})` : `rgba(140,60,220,${0.5 - i * 0.09})`;
        ctx.beginPath(); ctx.arc(f.x - Math.cos(ang) * i * 11, f.y - Math.sin(ang) * i * 11, R - i * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = white ? '#e8f0ff' : '#5a1fa0';
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = white ? '#ffffff' : '#a05aff';
      ctx.beginPath(); ctx.arc(f.x - 2, f.y - 3, R - 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3a5a'; // 구슬 속 눈
      ctx.fillRect(f.x - 6, f.y - 3, 4, 6); ctx.fillRect(f.x + 3, f.y - 3, 4, 6);
    }

    _drawShard(ctx, k) {
      const dir = -k.side;
      const wx = k.side > 0 ? this.right : this.left;
      if (k.st === 'warn') {
        const u = k.t / 0.65;
        const blink = u > 0.5 ? (Math.floor(this.time * 16) % 2 ? 1 : 0.4) : 0.85;
        const span = this.right - this.left;
        ctx.fillStyle = `rgba(160,80,255,${0.1 * blink})`;
        ctx.fillRect(this.left, k.y, span, k.h);
        ctx.fillStyle = `rgba(235,200,255,${0.7 * blink})`;
        ctx.fillRect(this.left, k.y - 1, span, 1);
        ctx.fillRect(this.left, k.y + k.h, span, 1);
        const ax = wx + dir * 24;
        const ay = k.y + k.h / 2;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.beginPath(); ctx.moveTo(ax + dir * 22, ay); ctx.lineTo(ax - dir * 6, ay - 16); ctx.lineTo(ax - dir * 6, ay + 16); ctx.fill();
        ctx.fillStyle = `rgba(150,60,230,${blink})`;
        ctx.beginPath(); ctx.moveTo(ax + dir * 15, ay); ctx.lineTo(ax - dir * 1, ay - 9); ctx.lineTo(ax - dir * 1, ay + 9); ctx.fill();
        return;
      }
      const cy = k.y + k.h / 2;
      const tail = k.x - dir * SHARD_LEN;
      for (let i = 1; i <= 4; i++) { ctx.fillStyle = `rgba(150,70,230,${0.35 - i * 0.07})`; ctx.fillRect(Math.min(tail, tail - dir * i * 14), cy - 3 - i, 12, 5 + i * 2); }
      ctx.fillStyle = '#6a2fb0';
      ctx.beginPath(); ctx.moveTo(k.x + dir * 6, cy); ctx.lineTo(tail + dir * 14, cy - k.h * 0.45); ctx.lineTo(tail, cy - k.h * 0.3); ctx.lineTo(tail, cy + k.h * 0.3); ctx.lineTo(tail + dir * 14, cy + k.h * 0.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8c8ff';
      ctx.beginPath(); ctx.moveTo(k.x + dir * 6, cy); ctx.lineTo(tail + dir * 20, cy - k.h * 0.15); ctx.lineTo(tail + dir * 20, cy + k.h * 0.15); ctx.fill();
    }

    _drawSpike(ctx, r) {
      if (r.st === 'boom') {
        const u = r.t / 0.4;
        const rad = 20 + 50 * u;
        const g = ctx.createRadialGradient(r.x, this.groundY - 6, 2, r.x, this.groundY - 6, rad);
        g.addColorStop(0, `rgba(255,230,255,${1 - u})`); g.addColorStop(0.5, `rgba(170,80,255,${0.8 * (1 - u)})`); g.addColorStop(1, 'rgba(90,20,160,0)');
        ctx.fillStyle = g; ctx.fillRect(r.x - rad, this.groundY - 6 - rad, rad * 2, rad * 2);
        return;
      }
      if (this.dkind === 'stone') { // 어둠돌: 떨어지는 바위
        for (let i = 4; i >= 1; i--) { ctx.fillStyle = `rgba(90,70,130,${0.4 - i * 0.07})`; ctx.fillRect(r.x - 12, r.y - i * 20 - 14, 24, 14); }
        ctx.fillStyle = '#3a2d56'; ctx.beginPath(); ctx.moveTo(r.x - 18, r.y + 6); ctx.lineTo(r.x - 12, r.y - 22); ctx.lineTo(r.x + 8, r.y - 26); ctx.lineTo(r.x + 18, r.y - 4); ctx.lineTo(r.x + 8, r.y + 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a66a8'; ctx.fillRect(r.x - 8, r.y - 18, 8, 6);
        return;
      }
      if (this.dkind === 'justice') { // 정의의 어둠: 천장에서 떨어지는 고드름
        for (let i = 4; i >= 1; i--) { ctx.fillStyle = `rgba(190,235,255,${0.35 - i * 0.07})`; ctx.fillRect(r.x - 5, r.y - i * 20 - 20, 10, 16); }
        ctx.fillStyle = '#bfe8ff';
        ctx.beginPath(); ctx.moveTo(r.x, r.y + 34); ctx.lineTo(r.x - 12, r.y - 18); ctx.lineTo(r.x + 12, r.y - 18); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5fa8d9'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(r.x - 3, r.y + 20); ctx.lineTo(r.x - 7, r.y - 14); ctx.lineTo(r.x - 2, r.y - 14); ctx.closePath(); ctx.fill();
        return;
      }
      if (this.dkind === 'sikner') { // 시크너: 하늘에서 꽂히는 검
        for (let i = 4; i >= 1; i--) { ctx.fillStyle = `rgba(127,232,255,${0.3 - i * 0.06})`; ctx.fillRect(r.x - 3, r.y - i * 22 - 20, 6, 18); }
        ctx.fillStyle = '#1c1c30'; ctx.beginPath(); ctx.moveTo(r.x, r.y + 34); ctx.lineTo(r.x - 8, r.y - 8); ctx.lineTo(r.x + 8, r.y - 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#9a8ee0'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#d4a017'; ctx.fillRect(r.x - 16, r.y - 12, 32, 6);
        ctx.fillStyle = '#4a3a22'; ctx.fillRect(r.x - 3, r.y - 34, 6, 22);
        ctx.fillStyle = '#7fe8ff'; ctx.fillRect(r.x - 1, r.y - 6, 2, 36);
        return;
      }
      for (let i = 5; i >= 1; i--) { ctx.fillStyle = `rgba(150,70,230,${0.5 - i * 0.08})`; ctx.beginPath(); ctx.arc(r.x, r.y - i * 18, 12 - i * 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#4a1a80';
      ctx.beginPath(); ctx.moveTo(r.x, r.y + 32); ctx.lineTo(r.x - 13, r.y - 14); ctx.lineTo(r.x, r.y - 22); ctx.lineTo(r.x + 13, r.y - 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c890ff';
      ctx.beginPath(); ctx.moveTo(r.x, r.y + 28); ctx.lineTo(r.x - 4, r.y - 14); ctx.lineTo(r.x, r.y - 20); ctx.lineTo(r.x + 3, r.y - 14); ctx.closePath(); ctx.fill();
    }

    // 보스 모습: 종류마다 다르다
    _drawKing(ctx, b) {
      const S = this.scale;
      const stunned = b.state === 'stun';
      const flash = b.flash > 0 || (b.state === 'dying' && Math.floor(this.time * 20) % 2 === 0);
      const bottom = b.y + b.h;
      const w = b.w * b.sx * S;
      const h = b.h * b.sy * S;
      const cx = b.cx;
      ctx.save();
      if (this.dkind === 'stone' && (b.state === 'roll' || b.state === 'bounce')) { // 돌덩이가 데굴데굴 돈다
        ctx.translate(b.cx, b.cy); ctx.rotate(b.rot || 0); ctx.translate(-b.cx, -b.cy);
      }
      // 어둠의 기운
      const aura = ctx.createRadialGradient(cx, bottom - h * 0.5, 4, cx, bottom - h * 0.5, w * 0.95);
      aura.addColorStop(0, this.rage ? 'rgba(255,60,90,0.55)' : 'rgba(150,60,230,0.45)'); aura.addColorStop(1, this.rage ? 'rgba(120,10,40,0)' : 'rgba(60,10,120,0)');
      ctx.fillStyle = aura; ctx.fillRect(cx - w, bottom - h * 1.6, w * 2, h * 1.8);
      if (this.dkind === 'stone') this._paintStone(ctx, b, cx, bottom, w, h, flash, stunned);
      else if (this.dkind === 'justice') this._paintJustice(ctx, b, cx, bottom, w, h, flash, stunned);
      else this._paintSikner(ctx, b, cx, bottom, w, h, flash, stunned);
      ctx.restore();
      if (stunned) {
        for (let k = 0; k < 3; k++) {
          const a = this.time * 4 + (k * Math.PI * 2) / 3;
          const sx = cx + Math.cos(a) * 44;
          const sy = bottom - h - 14 + Math.sin(a) * 8;
          ctx.fillStyle = '#ffe14a';
          ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.fill();
        }
      }
      if (b.state === 'down') {
        ctx.strokeStyle = Math.floor(this.time * 8) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,230,120,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
    }

    _eyes(ctx, cx, y, gap, size, stunned, color) {
      for (const sx of [-1, 1]) {
        if (stunned) {
          ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(cx + sx * gap - size, y - size); ctx.lineTo(cx + sx * gap + size, y + size); ctx.moveTo(cx + sx * gap + size, y - size); ctx.lineTo(cx + sx * gap - size, y + size); ctx.stroke();
        } else {
          const g = ctx.createRadialGradient(cx + sx * gap, y, 1, cx + sx * gap, y, size * 2.2);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, 'rgba(255,40,80,0)');
          ctx.fillStyle = g; ctx.fillRect(cx + sx * gap - size * 2.2, y - size * 2.2, size * 4.4, size * 4.4);
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.moveTo(cx + sx * gap - size, y - size * 0.4); ctx.lineTo(cx + sx * gap + size, y - size * 0.9 * (sx > 0 ? 1 : -0.0) - size * 0.1); ctx.lineTo(cx + sx * gap + size * 0.8, y + size * 0.7); ctx.lineTo(cx + sx * gap - size, y + size * 0.5); ctx.closePath(); ctx.fill();
        }
      }
    }

    _paintStone(ctx, b, cx, bottom, w, h, flash, stunned) { // 정의의 어둠돌: 거대한 어둠의 바위
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, bottom); ctx.lineTo(cx - w * 0.52, bottom - h * 0.45); ctx.lineTo(cx - w * 0.3, bottom - h * 0.85); ctx.lineTo(cx, bottom - h * 1.02); ctx.lineTo(cx + w * 0.32, bottom - h * 0.88); ctx.lineTo(cx + w * 0.52, bottom - h * 0.42); ctx.lineTo(cx + w / 2, bottom);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      g.addColorStop(0, flash ? '#ffffff' : '#5a4a78'); g.addColorStop(1, flash ? '#ffe0f0' : '#24163a');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = b.glow > 0 ? '#e0a0ff' : '#150a24'; ctx.stroke();
      ctx.strokeStyle = 'rgba(210,120,255,0.85)'; ctx.lineWidth = 2.5; // 균열
      ctx.beginPath(); ctx.moveTo(cx - w * 0.2, bottom - h * 0.95); ctx.lineTo(cx - w * 0.1, bottom - h * 0.6); ctx.lineTo(cx - w * 0.28, bottom - h * 0.35); ctx.moveTo(cx + w * 0.18, bottom - h * 0.9); ctx.lineTo(cx + w * 0.26, bottom - h * 0.55); ctx.lineTo(cx + w * 0.1, bottom - h * 0.2); ctx.stroke();
      ctx.save(); // 룬 문양
      ctx.translate(cx, bottom - h * 0.4); ctx.strokeStyle = 'rgba(230,170,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, h * 0.14, 0, Math.PI * 2); ctx.moveTo(-h * 0.14, 0); ctx.lineTo(h * 0.14, 0); ctx.moveTo(0, -h * 0.14); ctx.lineTo(0, h * 0.14); ctx.stroke();
      ctx.restore();
      this._eyes(ctx, cx, bottom - h * 0.68, w * 0.16, 8, stunned, '#ff3a5a');
      for (let i = 0; i < 4; i++) { // 둘레를 도는 돌 조각
        const a = this.time * 1.4 + i * 1.6;
        ctx.fillStyle = '#3a2a58';
        const px = cx + Math.cos(a) * w * 0.7; const py = bottom - h * 0.55 + Math.sin(a * 1.3) * h * 0.4;
        ctx.fillRect(px - 5, py - 5, 10, 10);
      }
    }

    _paintJustice(ctx, b, cx, bottom, w, h, flash, stunned) { // 정의의 어둠: 흰 후광을 쓴 검은 형상
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.5, bottom); ctx.quadraticCurveTo(cx - w * 0.62, bottom - h * 0.7, cx, bottom - h * 1.05); ctx.quadraticCurveTo(cx + w * 0.62, bottom - h * 0.7, cx + w * 0.5, bottom);
      for (let k = 0; k < 6; k++) ctx.lineTo(cx + w * 0.5 - (k + 0.5) * (w / 6), bottom + (k % 2 ? 0 : 10)); // 일렁이는 아랫단
      ctx.closePath();
      const g = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      g.addColorStop(0, flash ? '#ffffff' : '#2a0f45'); g.addColorStop(1, flash ? '#ffe0f0' : '#07020f');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#a060f0'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; // 후광
      ctx.beginPath(); ctx.ellipse(cx, bottom - h * 1.12, w * 0.3, h * 0.07, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 8; ctx.stroke();
      for (const sx of [-1, 1]) { // 날개 모양 어둠
        ctx.fillStyle = 'rgba(70,20,120,0.8)';
        ctx.beginPath(); ctx.moveTo(cx + sx * w * 0.4, bottom - h * 0.7); ctx.quadraticCurveTo(cx + sx * w * 1.0, bottom - h * 1.0, cx + sx * w * 0.95, bottom - h * 0.3); ctx.quadraticCurveTo(cx + sx * w * 0.7, bottom - h * 0.5, cx + sx * w * 0.4, bottom - h * 0.4); ctx.closePath(); ctx.fill();
      }
      this._eyes(ctx, cx, bottom - h * 0.68, w * 0.14, 7, stunned, '#ffffff');
      this._eyes(ctx, cx, bottom - h * 0.45, 0, 6, stunned, '#ff3a5a');
    }

    // 시크너: 델타룬의 어둠의 기사(로어링 나이트)를 닮은 모습. 아주 키 크고 가는 검은 실루엣에 흰 윤곽선,
    // 마름모꼴 투구와 입 같은 바이저, 양옆으로 뻗은 세 갈래 뿔, 큰 삼각형 어깨 갑옷, 극도로 가는 허리, 뾰족한 다리(발 없음), 손바닥의 흰 구멍
    _paintSikner(ctx, b, cx, bottom, w, h, flash, stunned) {
      const dir = b.dir || 1;
      const t = this.time;
      const ws = w * 0.6;
      const H = h * 1.3;
      const top = bottom - H;
      const body = flash ? '#ffffff' : '#07070c';
      const line = flash ? '#9a9ab0' : '#f4f0ff';
      const glow = this.rage ? '255,120,150' : '215,190,255'; // 연보라 빛 (분노하면 붉다)
      const poly = (pts, fill = true) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = body; ctx.fill(); }
        ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.lineJoin = 'miter'; ctx.stroke();
      };
      const limb = (pts, wid) => { // 흰 윤곽선이 있는 가는 팔/뿔
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = line; ctx.lineWidth = wid + 4; ctx.stroke();
        ctx.strokeStyle = body; ctx.lineWidth = wid; ctx.stroke();
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      };
      const sway = Math.sin(t * 2) * 2;
      const hipY = bottom - H * 0.4;
      const waistY = top + H * 0.52;
      const shY = top + H * 0.2;
      // 어둠의 잔상: 움직일 때
      if (b.state === 'air' || b.state === 'hide') {
        for (let k = 1; k <= 3; k++) { ctx.fillStyle = `rgba(${glow},${0.12 / k})`; ctx.fillRect(cx - dir * k * 28 - ws * 0.2, top + H * 0.05, ws * 0.4, H * 0.95); }
      }
      // 다리: 뾰족하게 끝나는 두 개 (발 없음)
      poly([[cx - ws * 0.13, hipY], [cx - ws * 0.02, hipY], [cx - ws * 0.1 + sway * 0.2, bottom]]);
      poly([[cx + ws * 0.02, hipY], [cx + ws * 0.13, hipY], [cx + ws * 0.1 - sway * 0.2, bottom]]);
      // 골반: 삐죽 튀어나온 뼈
      poly([[cx - ws * 0.12, hipY + 4], [cx - ws * 0.34, hipY - H * 0.02], [cx - ws * 0.12, hipY - H * 0.07]]);
      poly([[cx + ws * 0.12, hipY + 4], [cx + ws * 0.34, hipY - H * 0.02], [cx + ws * 0.12, hipY - H * 0.07]]);
      // 극도로 가는 허리
      poly([[cx - ws * 0.07, waistY], [cx + ws * 0.07, waistY], [cx + ws * 0.09, hipY], [cx - ws * 0.09, hipY]]);
      // 상체: 어깨에서 허리로 좁아지는 역삼각형
      poly([[cx - ws * 0.3, shY], [cx + ws * 0.3, shY], [cx + ws * 0.07, waistY], [cx - ws * 0.07, waistY]]);
      // 큰 삼각형 어깨 갑옷
      for (const s of [-1, 1]) poly([[cx + s * ws * 0.16, shY - H * 0.04], [cx + s * ws * 1.0, shY - H * 0.1 + sway * s * 0.3], [cx + s * ws * 0.5, shY + H * 0.16]]);
      // 팔: 칼 든 손과 구멍 뚫린 손
      const pose = this.pose || 'idle';
      const rise = b.state === 'crouch' || b.state === 'wind' || b.state === 'hide' || pose === 'raise';
      const thrust = b.state === 'air' || pose === 'throw' || pose === 'recall';
      const hx = cx + dir * ws * (thrust ? 1.1 : 0.6);
      const hy = top + H * (rise || pose === 'stab' ? 0.12 : thrust ? 0.32 : pose === 'swing' ? 0.3 : 0.5);
      limb([[cx + dir * ws * 0.45, shY + H * 0.02], [cx + dir * ws * 0.7, (shY + hy) / 2 + H * 0.06], [hx, hy]], 6);
      const pulling = pose === 'pull'; // 끌어당길 때는 손바닥이 플레이어를 향한다
      const lx = pulling ? cx + dir * ws * 1.2 : cx - dir * ws * (rise ? 0.75 : 0.62);
      const ly = pulling ? top + H * 0.42 : top + H * (rise ? 0.2 : 0.55);
      limb([[cx - dir * ws * 0.45, shY + H * 0.02], [cx - dir * ws * 0.72, (shY + ly) / 2 + H * 0.05], [lx, ly]], 6);
      ctx.fillStyle = line; ctx.beginPath(); ctx.ellipse(lx, ly, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); // 손바닥
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(lx, ly, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = line; ctx.beginPath(); ctx.ellipse(lx, ly, 2, 3.2, 0, 0, Math.PI * 2); ctx.fill(); // 손바닥의 흰 구멍
      if (b.glow > 0) { // 구멍에서 연보라 별빛이 소용돌이친다
        const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 70 * b.glow + 20);
        g.addColorStop(0, `rgba(${glow},0.85)`); g.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = g; ctx.fillRect(lx - 100, ly - 100, 200, 200);
        for (let k = 0; k < 6; k++) { const a = t * 5 + k * 1.05; const r = 50 * b.glow * (1 - ((t * 2 + k * 0.17) % 1) * 0.7); ctx.fillStyle = '#ffffff'; ctx.fillRect(lx + Math.cos(a) * r - 1.5, ly + Math.sin(a) * r - 1.5, 3, 3); }
      }
      // 머리: 마름모꼴 투구
      const hc = top + H * 0.08;
      poly([[cx, top - H * 0.04], [cx + ws * 0.2, hc + H * 0.02], [cx, hc + H * 0.2], [cx - ws * 0.2, hc + H * 0.02]]);
      // 양옆으로 뻗은 세 갈래 뿔
      for (const s of [-1, 1]) {
        limb([[cx + s * ws * 0.17, hc], [cx + s * ws * 0.55, hc - H * 0.06], [cx + s * ws * 0.9, hc - H * 0.2]], 5);
        limb([[cx + s * ws * 0.55, hc - H * 0.06], [cx + s * ws * 0.9, hc + H * 0.0]], 4);
        limb([[cx + s * ws * 0.7, hc - H * 0.12], [cx + s * ws * 0.78, hc - H * 0.34]], 4);
      }
      // 바이저: 개구리 입처럼 가로로 길게 벌어진 틈. 가끔 이빨이 드러난다
      const open = b.glow > 0 || thrust ? 1 : 0.5 + 0.5 * Math.sin(t * 3);
      const vy = hc + H * 0.04;
      ctx.fillStyle = stunned ? '#4a4a60' : `rgba(${glow},1)`;
      ctx.beginPath();
      ctx.moveTo(cx - ws * 0.17, vy); ctx.lineTo(cx - ws * 0.05, vy - 3 - open * 2); ctx.lineTo(cx + ws * 0.05, vy - 3 - open * 2); ctx.lineTo(cx + ws * 0.17, vy);
      ctx.lineTo(cx + ws * 0.05, vy + 4 + open * 5); ctx.lineTo(cx - ws * 0.05, vy + 4 + open * 5);
      ctx.closePath(); ctx.fill();
      if (!stunned && (b.glow > 0 || thrust || this.rage)) { // 날카로운 이빨
        ctx.fillStyle = body;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(cx + k * ws * 0.06 - 3, vy - 1); ctx.lineTo(cx + k * ws * 0.06 + 3, vy - 1); ctx.lineTo(cx + k * ws * 0.06, vy + 5); ctx.fill(); }
      }
      if (!stunned) { const g = ctx.createRadialGradient(cx, vy, 1, cx, vy, ws * 0.5); g.addColorStop(0, `rgba(${glow},0.5)`); g.addColorStop(1, `rgba(${glow},0)`); ctx.fillStyle = g; ctx.fillRect(cx - ws * 0.5, vy - ws * 0.5, ws, ws); }
      // 거대한 검
      const ang = pose === 'swing' ? (-2.5 + 3.9 * (this.swingU || 0)) * dir : pose === 'stab' ? 0 : rise ? -2.5 * dir : thrust ? 1.45 * dir : (Math.PI - 0.5 + 0.05 * Math.sin(t * 2)) * dir;
      if (!this.swordOff) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(ang);
      const L = H * 1.55;
      if (rise || thrust) {
        ctx.strokeStyle = `rgba(${glow},0.3)`; ctx.lineWidth = 16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, L * 0.82, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5); ctx.stroke(); ctx.lineCap = 'butt';
      }
      poly([[-ws * 0.16, 0], [0, H * 0.04], [ws * 0.16, 0], [0, -H * 0.03]]); // 날밑
      poly([[-6, H * 0.04], [-8, L * 0.84], [0, L], [8, L * 0.84], [6, H * 0.04]]); // 칼날
      ctx.strokeStyle = `rgba(${glow},0.9)`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, H * 0.08); ctx.lineTo(0, L * 0.92); ctx.stroke();
      ctx.restore();
      }
    }
  }

  // ======================= 100층 보스: 어둠의 기사 시크너 =======================
  // 기절이 없다. 패턴 여섯 가지 (플레이어가 정한 것):
  //  swing   검을 휘둘러 충격파를 날리고, 동시에 사방에 검은 차원문이 열려 검은 공이 날아온다
  //  laser   공중 한가운데에서 검은 레이저 3줄기가 사방팔방으로 뻗어 돌아간다 (여러 번)
  //  stab    검을 땅에 박아 충격파가 벽까지 번진다 (검이 박혀 있는 동안은 틈이 생긴다)
  //  gravity 플레이어를 끌어당긴다. 검은 공이 튕기며 천천히 다가온다. 반대쪽으로 도망쳐야 한다
  //  combo   플레이어에게 날아가 검을 여러 번 휘두르고, 마지막엔 검을 던진다. 돌아오는 검을 패링하면 땅에 박혀
  //          시크너가 염력으로 끌어올 때까지 공격할 수 있다
  class Sikner extends DarkBoss {
    constructor(left, width, groundY, ev) {
      super(left, width, groundY, ev, 'sikner');
      this.patterns = ['swing', 'laser', 'stab', 'gravity', 'combo'];
      this.waves = [];
      this.portals = [];
      this.orbs = [];
      this.beams = [];
      this.rays = null; // 사방팔방 레이저 {a0, a, dir, fire}
      this.sw = null;
      this.cut = null;
      this.pull = 0;
      this.pose = 'idle';
      this.swordOff = false;
      this.swingU = 0;
      this.pl = null;
    }

    _face(b) { b.dir = this.playerX < b.cx ? -1 : 1; }
    _settle(b, cy, dt, k) { b.cy += (cy - b.cy) * Math.min(1, k * dt); }

    _startPattern() {
      if (!this.body.alive) return;
      const pool = this.patterns.filter((t) => t !== this.lastType);
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.lastType = type;
      this.pat = { type, t: 0, n: 0, sub: 'start' };
      this.phase = 'pattern';
    }

    _endPattern() {
      const b = this.body;
      this.patternCount += 1;
      this.pat = null;
      b.glow = 0;
      b.attacking = false;
      b.rush = false;
      this.pose = 'idle';
      this.swordOff = false;
      this.pull = 0;
      this.cut = null;
      if (b.state !== 'dying') b.state = 'idle';
      this.phase = 'rest'; // 기절 없이 잠깐 쉰다
      this.timer = rr(1.1, 1.7) * (this.rage ? 0.6 : 1);
    }

    _runPattern(dt) {
      const p = this.pat;
      p.t += dt;
      const b = this.body;
      let done = false;
      if (p.type === 'swing') done = this._pSwing(p, b, dt);
      else if (p.type === 'laser') done = this._pLaser(p, b, dt);
      else if (p.type === 'stab') done = this._pStab(p, b, dt);
      else if (p.type === 'gravity') done = this._pGravity(p, b, dt);
      else done = this._pCombo(p, b, dt);
      b._box();
      if (done) this._endPattern();
    }

    // 1) 검 휘두르기 + 차원문
    _pSwing(p, b, dt) {
      const wind = this.rage ? 0.5 : 0.75;
      if (p.sub === 'start') { b.state = 'act'; this.pose = 'raise'; p.sub = 'wind'; this.ev.sound('vanish'); }
      this._face(b);
      this._settle(b, this.groundCy - 30, dt, 6);
      if (p.sub === 'wind') {
        if (p.t >= wind) {
          p.sub = 'slash'; p.ts = p.t; this.pose = 'swing'; this.swingU = 0;
          this.waves.push({ x: b.cx + b.dir * 70, dir: b.dir, v: this.rage ? 700 : 600, h: 46 });
          this.ev.shake(9, 0.25);
          this.ev.sound('shatter');
          const cnt = this.rage ? 4 : 3;
          const span = (this.right - this.left - 240) / cnt;
          for (let i = 0; i < cnt; i++) this.portals.push({ x: this.left + 120 + (i + 0.2 + Math.random() * 0.6) * span, y: this.groundY - rr(120, 270), t: -i * 0.15, shots: this.rage ? 3 : 2, fired: 0 });
        }
        return false;
      }
      this.swingU = Math.min(1, (p.t - p.ts) / 0.14);
      if (p.t - p.ts > 0.55) this.pose = 'idle';
      return p.t - p.ts > 0.7 && this.portals.length === 0 && this.waves.length === 0;
    }

    // 2) 사방팔방 레이저: 공중 한가운데에서 레이저 3줄기가 120도씩 벌어져 사방으로 뻗고, 천천히 돌아간다 (여러 번)
    _pLaser(p, b, dt) {
      const bursts = this.rage ? 4 : 3;
      const mid = (this.left + this.right) / 2;
      if (p.sub === 'start') { b.state = 'act'; this.pose = 'raise'; p.sub = 'rise'; this.ev.sound('vanish'); }
      this._face(b);
      if (p.sub === 'rise') {
        b.cx += clamp(mid - b.cx, -560 * dt, 560 * dt);
        this._settle(b, this.groundY - 250, dt, 5);
        if (p.t > 0.9) { p.sub = 'warn'; p.k = 0; p.ts = p.t; this._newRays(); }
      } else if (p.sub === 'warn') {
        b.glow = Math.min(1, (p.t - p.ts) / 0.5);
        this._settle(b, this.groundY - 250, dt, 5);
        this.rays.fire = false;
        if (p.t - p.ts >= (this.rage ? 0.45 : 0.6)) { p.sub = 'fire'; p.ts = p.t; this.rays.fire = true; this.ev.sound('shatter'); this.ev.shake(6, 0.3); }
      } else if (p.sub === 'fire') {
        const u = p.t - p.ts;
        this.rays.a = this.rays.a0 + this.rays.dir * (this.rage ? 1.9 : 1.5) * u;
        this._settle(b, this.groundY - 250, dt, 5);
        if (u >= 1.0) { p.k += 1; this.rays = null; b.glow = 0; p.sub = p.k < bursts ? 'gap' : 'down'; p.ts = p.t; }
      } else if (p.sub === 'gap') {
        if (p.t - p.ts >= 0.35) { p.sub = 'warn'; p.ts = p.t; this._newRays(); }
      } else {
        this._settle(b, this.groundCy - 40, dt, 5);
        return Math.abs(b.cy - (this.groundCy - 40)) < 8;
      }
      return false;
    }

    _newRays() {
      this.rays = { a0: Math.random() * Math.PI * 2, a: 0, dir: Math.random() < 0.5 ? -1 : 1, fire: false };
      this.rays.a = this.rays.a0;
      this.ev.sound('spawn');
    }

    // 3) 검을 땅에 박기
    _pStab(p, b, dt) {
      const total = this.rage ? 3 : 2;
      if (p.sub === 'start') { b.state = 'act'; this.pose = 'raise'; p.sub = 'rise'; p.k = 0; p.t0 = p.t; p.tx = clamp(this.playerX, this.left + 150, this.right - 150); this.ev.sound('vanish'); }
      if (p.sub === 'rise') {
        b.cx += clamp(p.tx - b.cx, -520 * dt, 520 * dt);
        this._settle(b, this.groundY - 300, dt, 6);
        this._face(b);
        if (p.t - p.t0 >= (this.rage ? 0.65 : 0.85)) { p.sub = 'plunge'; this.pose = 'stab'; this.ev.sound('hurt'); }
      } else if (p.sub === 'plunge') {
        b.cy += 2600 * dt;
        if (b.cy >= this.groundCy) {
          b.cy = this.groundCy;
          p.k += 1;
          this.ev.slamImpact(b.cx, this.groundY);
          this.ev.shake(12, 0.35);
          for (const d of [-1, 1]) this.waves.push({ x: b.cx + d * 60, dir: d, v: this.rage ? 360 : 300, h: this.rage ? 165 : 140 }); // 위로 크고 느린 충격파 (점프로는 못 넘는다: 대시로 뚫거나 틈을 노린다)
          if (p.k < total) { p.sub = 'hold'; p.ts = p.t; } else { p.sub = 'final'; p.ts = p.t; b.state = 'recall'; } // 마지막은 검이 박혀 틈이 생긴다
        }
      } else if (p.sub === 'hold') {
        if (p.t - p.ts >= (this.rage ? 0.9 : 1.2)) { p.sub = 'rise'; p.t0 = p.t; this.pose = 'raise'; p.tx = clamp(this.playerX, this.left + 150, this.right - 150); }
      } else if (p.sub === 'final') {
        b.cy = this.groundCy;
        if (p.t - p.ts >= (this.rage ? 1.0 : 1.4)) { this.pose = 'idle'; return this.waves.length === 0 || p.t - p.ts > 5; }
      }
      return false;
    }

    // 4) 중력: 끌어당긴다
    _pGravity(p, b, dt) {
      const dur = this.rage ? 7 : 6;
      const mid = (this.left + this.right) / 2;
      if (p.sub === 'start') {
        b.state = 'act'; this.pose = 'pull'; p.sub = 'move';
        p.bx = b.cx < mid ? this.left + 100 : this.right - 100; // 가까운 쪽 끝으로 간다
        this.ev.sound('vanish');
      }
      if (p.sub === 'move') {
        b.cx += clamp(p.bx - b.cx, -760 * dt, 760 * dt);
        this._settle(b, this.groundCy - 30, dt, 8);
        this._face(b);
        if (Math.abs(b.cx - p.bx) < 6) { p.sub = 'pull'; p.tp = p.t; p.next = p.t + 0.5; }
        return false;
      }
      this._face(b);
      this._settle(b, this.groundCy - 30, dt, 8);
      const el = p.t - p.tp;
      this.pull = Math.min(1, el / 0.8);
      b.glow = 1;
      if (this.pl) { // 끌려온다
        const dir = Math.sign(b.cx - this.playerX) || 1;
        this.pl.x = clamp(this.pl.x + dir * (this.rage ? 215 : 185) * this.pull * dt, this.left + 4, this.right - this.pl.w - 4);
      }
      if (p.t >= p.next && el < dur - 0.5) { // 반대쪽에서 검은 공이 튕기며 천천히 다가온다
        p.next = p.t + (this.rage ? 0.85 : 1.15);
        const fromX = b.cx < mid ? this.right - 50 : this.left + 50;
        const toward = Math.sign(b.cx - fromX);
        this.orbs.push({ x: fromX, y: this.groundY - 40, vx: toward * 125, vy: -420, life: 14 });
        this.ev.sound('spawn');
      }
      if (el >= dur) { this.pull = 0; b.glow = 0; this.pose = 'idle'; return true; }
      return false;
    }

    // 5) 접근 연타 + 검 던지기
    _pCombo(p, b, dt) {
      const slashes = this.rage ? 4 : 3;
      if (p.sub === 'start') { b.state = 'act'; this.pose = 'idle'; p.sub = 'dash'; p.k = 0; this.ev.sound('vanish'); }
      if (p.sub === 'dash') {
        const side = Math.sign(this.playerX - b.cx) || 1;
        const tx = clamp(this.playerX - side * 110, this.left + 40, this.right - 40);
        b.cx += clamp(tx - b.cx, -1100 * dt, 1100 * dt);
        this._settle(b, this.groundCy - 18, dt, 9);
        b.dir = side;
        if (Math.abs(b.cx - tx) < 10) { p.sub = p.k < slashes ? 'wind' : 'throw'; p.tw = p.t; }
      } else if (p.sub === 'wind') {
        this.pose = 'raise';
        this._settle(b, this.groundCy - 18, dt, 9);
        const wt = this.rage ? 0.3 : 0.45;
        const u = (p.t - p.tw) / wt;
        this.zone = { x: b.cx, dir: b.dir, u: Math.min(1, u) };
        if (u >= 1) {
          p.sub = 'cut'; p.tc = p.t; this.pose = 'swing'; this.swingU = 0; this.zone = null;
          this.cut = { x0: Math.min(b.cx, b.cx + b.dir * 190), x1: Math.max(b.cx, b.cx + b.dir * 190), dir: b.dir, t: 0 };
          this.ev.sound('shatter');
          this.ev.shake(5, 0.12);
        }
      } else if (p.sub === 'cut') {
        this.swingU = Math.min(1, (p.t - p.tc) / 0.1);
        if (p.t - p.tc > 0.12) this.cut = null;
        if (p.t - p.tc > 0.32) { p.k += 1; this.pose = 'idle'; p.sub = 'dash'; }
      } else if (p.sub === 'throw') {
        this.pose = 'throw';
        this._face(b);
        if (p.t - p.tw >= 0.35) {
          this.swordOff = true;
          this.sw = { x: b.cx + b.dir * 50, y: b.cy - 20, tx: this.playerX, ty: Math.min(this.groundY - 24, this.playerY), st: 'out', ang: 0, t: 0 };
          p.sub = 'sword';
          this.ev.sound('throw');
        }
      } else if (p.sub === 'sword') {
        this._face(b);
        if (!this.sw) return true; // 검이 돌아왔다
      } else if (p.sub === 'recall') {
        this._settle(b, this.groundCy - 18, dt, 9);
        if (!this.sw) return true; // 염력으로 검을 되찾았다
      } else if (p.sub === 'stagger') {
        this._settle(b, this.groundCy - 18, dt, 9);
        if (p.t - p.ts > 1.2) return true;
      }
      return false;
    }

    update(dt, player) {
      this.pl = player;
      super.update(dt, player);
      const b = this.body;
      if (!b.alive || this.done) { this.waves.length = 0; this.portals.length = 0; this.orbs.length = 0; this.beams.length = 0; this.rays = null; this.sw = null; this.cut = null; return; }
      const gy = this.groundY;
      for (const w of this.waves) { w.x += w.dir * w.v * dt; if (w.x < this.left - 60 || w.x > this.right + 60) w.dead = true; }
      for (const pt of this.portals) { // 차원문: 열리고, 검은 공을 쏘고, 닫힌다
        pt.t += dt;
        if (pt.t < 0) continue;
        const fireAt = 0.65 + pt.fired * 0.55;
        if (pt.fired < pt.shots && pt.t >= fireAt) {
          pt.fired += 1;
          const dx = this.playerX - pt.x;
          const dy = this.playerY - pt.y;
          const len = Math.hypot(dx, dy) || 1;
          const sp = this.rage ? 470 : 400;
          this.balls.push({ x: pt.x, y: pt.y, vx: (dx / len) * sp, vy: (dy / len) * sp, reflected: false, life: 5, t: 0 });
          this.ev.sound('spawn');
        }
        if (pt.t > 0.65 + pt.shots * 0.55 + 0.4) pt.dead = true;
      }
      for (const o of this.orbs) { // 튕기는 검은 공: 천천히 보스 쪽으로
        o.life -= dt;
        o.vy += 1000 * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.y > gy - 17) { o.y = gy - 17; o.vy = -430; }
        if (Math.abs(o.x - b.cx) < 40 || o.life <= 0) o.dead = true;
      }
      for (const k of this.beams) { k.t += dt; if (k.t > (this.rage ? 0.42 : 0.5) + 0.3) k.dead = true; }
      // 던진 검
      const s = this.sw;
      if (s) {
        s.t += dt;
        const hx = b.cx;
        const hy = b.cy - 20;
        if (s.st === 'out') {
          s.ang += 20 * dt;
          const dx = s.tx - s.x; const dy = s.ty - s.y; const len = Math.hypot(dx, dy) || 1;
          const v = (this.rage ? 1100 : 900) * dt;
          if (len <= v) { s.x = s.tx; s.y = s.ty; s.st = 'back'; s.pause = this.rage ? 0.3 : 0.5; } else { s.x += (dx / len) * v; s.y += (dy / len) * v; }
        } else if (s.st === 'back') {
          s.ang += 20 * dt;
          const dx = hx - s.x; const dy = hy - s.y; const len = Math.hypot(dx, dy) || 1;
          const v = (this.rage ? 400 : 320) * dt; // 느리게 돌아온다
          if (s.pause > 0) s.pause -= dt; // 던진 자리에 잠깐 떠 있다가 돌아온다
          else if (len <= v + 20) { this.sw = null; this.swordOff = false; this.pose = 'idle'; } else { s.x += (dx / len) * v; s.y += (dy / len) * v; }
          if (this.sw && player.parrying && Math.hypot(s.x - this.playerX, s.y - this.playerY) < 110) { // 돌아오는 검을 패링: 땅에 박힌다
            s.st = 'stuck'; s.t = 0; s.y = gy; s.ang = 0;
            b.state = 'recall';
            this.pose = 'recall';
            if (this.pat) this.pat.sub = 'recall';
            this.ev.sound('parry');
            this.ev.shake(10, 0.3);
            this.ev.fx('burst', s.x, gy - 10);
          }
        } else if (s.st === 'stuck') { // 염력으로 서서히 끌려간다: 이 동안 시크너를 공격할 수 있다
          const v = Math.min(420, 90 + 150 * s.t) * dt;
          const dx = hx - s.x;
          if (Math.abs(dx) <= v + 50 || s.t > 5) { this.sw = null; this.swordOff = false; this.pose = 'idle'; } else s.x += Math.sign(dx) * v;
        }
      }
      // 맞았나
      if (this.cut && player.parrying && player.overlaps({ x: this.cut.x0, y: gy - 130, w: this.cut.x1 - this.cut.x0, h: 130 })) { // 연타를 패링: 시크너가 비틀거린다
        this.cut = null;
        this.damageBody(C.BOSS_PARRY_DAMAGE);
        b.state = 'recall';
        this.pose = 'idle';
        if (this.pat) { this.pat.sub = 'stagger'; this.pat.ts = this.pat.t; }
        this.ev.fx('burst', b.cx, b.cy);
        this.ev.sound('parry');
        this.ev.shake(8, 0.2);
      }
      if (player.invuln === 0 && !player.dashing) {
        let hurt = false;
        for (const w of this.waves) {
          if (player.overlaps({ x: w.x - 18, y: gy - w.h, w: 36, h: w.h })) { w.dead = true; hurt = true; }
        }
        for (const k of this.beams) {
          if (k.t >= (this.rage ? 0.42 : 0.5) && !k.hit && Math.abs(k.x - this.playerX) < 15 + player.w / 2 - 4) { k.hit = true; hurt = true; }
        }
        if (this.rays && this.rays.fire) { // 사방팔방 레이저
          for (let k = 0; k < 3; k++) {
            const ang = this.rays.a + (k * Math.PI * 2) / 3;
            const rx = this.playerX - b.cx;
            const ry = this.playerY - b.cy;
            const along = rx * Math.cos(ang) + ry * Math.sin(ang);
            const off = Math.abs(-rx * Math.sin(ang) + ry * Math.cos(ang));
            if (along > 0 && along < 1900 && off < 15 + player.w / 2 - 4) hurt = true;
          }
        }
        for (const o of this.orbs) {
          if (Math.hypot(o.x - this.playerX, o.y - this.playerY) < 17 + player.w / 2 - 2) { o.dead = true; hurt = true; }
        }
        if (this.sw && this.sw.st !== 'stuck' && Math.hypot(this.sw.x - this.playerX, this.sw.y - this.playerY) < 24 + player.w / 2) hurt = true;
        if (this.cut && !player.parrying && player.overlaps({ x: this.cut.x0, y: gy - 130, w: this.cut.x1 - this.cut.x0, h: 130 })) hurt = true;
        if (this.pull > 0.3 && player.overlaps({ x: b.x + 10, y: b.y - 20, w: b.w - 20, h: b.h + 20 })) { // 끌려가 보스에게 닿았다
          hurt = true;
          player.x = clamp(player.x - Math.sign(b.cx - this.playerX) * 90, this.left + 4, this.right - player.w - 4);
        }
        if (hurt) this.ev.hurt(this.hurtDmg);
      }
      this.waves = this.waves.filter((w) => !w.dead);
      this.portals = this.portals.filter((q) => !q.dead);
      this.orbs = this.orbs.filter((o) => !o.dead);
      this.beams = this.beams.filter((k) => !k.dead);
    }

    // ---------- 그리기 ----------
    _drawKing(ctx, b) {
      if (this.pose === 'stab' || this.pose === 'recall') { // 땅에 박힌 검은 바닥 아래가 보이지 않게
        ctx.save();
        ctx.beginPath(); ctx.rect(this.left - 300, -2000, this.right - this.left + 600, 2000 + this.groundY + 2); ctx.clip();
        super._drawKing(ctx, b);
        ctx.restore();
      } else super._drawKing(ctx, b);
    }

    _drawBall(ctx, f) { // 검은 공: 검은 몸에 흰 테두리 (쳐내면 하얗게 되돌아간다)
      const white = f.reflected;
      const R = 17;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, R + 14);
      g.addColorStop(0, white ? 'rgba(255,255,255,0.9)' : 'rgba(200,170,255,0.55)'); g.addColorStop(1, 'rgba(120,80,220,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - R - 14, f.y - R - 14, (R + 14) * 2, (R + 14) * 2);
      const ang = Math.atan2(f.vy, f.vx);
      for (let i = 1; i <= 4; i++) { ctx.fillStyle = white ? `rgba(240,240,255,${0.4 - i * 0.08})` : `rgba(10,10,20,${0.5 - i * 0.1})`; ctx.beginPath(); ctx.arc(f.x - Math.cos(ang) * i * 11, f.y - Math.sin(ang) * i * 11, R - i * 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = white ? '#ffffff' : '#05050a';
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = white ? '#c8c8ff' : '#f4f0ff'; ctx.lineWidth = 2.5; ctx.stroke();
    }

    _sword(ctx, L, color) { // 얇고 긴 칼날 (손잡이 쪽이 원점, 아래(+y)가 칼끝)
      ctx.fillStyle = '#3a2c18'; ctx.fillRect(-3, -26, 6, 28);
      ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(0, 7); ctx.lineTo(18, 0); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05050a';
      ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(-6, L * 0.86); ctx.lineTo(0, L); ctx.lineTo(6, L * 0.86); ctx.lineTo(5, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f4f0ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, L * 0.92); ctx.stroke();
    }

    drawFront(ctx) {
      super.drawFront(ctx);
      const gy = this.groundY;
      const b = this.body;
      const glow = this.rage ? '255,120,150' : '215,190,255';
      // 레이저: 예고선 -> 검은 기둥
      for (const k of this.beams) {
        const warn = this.rage ? 0.42 : 0.5;
        if (k.t < warn) {
          const u = k.t / warn;
          const blink = u > 0.6 ? (Math.floor(this.time * 18) % 2 ? 1 : 0.4) : 0.85;
          ctx.fillStyle = `rgba(20,10,40,${0.25 * blink})`; ctx.fillRect(k.x - 14, 0, 28, gy);
          ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.6 * u) * blink})`; ctx.fillRect(k.x - 1, 0, 2, gy);
        } else {
          const f = 1 - (k.t - warn) / 0.3;
          ctx.fillStyle = `rgba(${glow},${0.35 * f})`; ctx.fillRect(k.x - 26, 0, 52, gy);
          ctx.fillStyle = `rgba(5,5,12,${0.95 * Math.max(0.3, f)})`; ctx.fillRect(k.x - 15, 0, 30, gy);
          ctx.fillStyle = `rgba(255,255,255,${f})`; ctx.fillRect(k.x - 16, 0, 2, gy); ctx.fillRect(k.x + 14, 0, 2, gy);
        }
      }
      // 사방팔방 레이저: 예고선 -> 굵은 검은 광선 (땅 아래로는 뻗지 않는다)
      if (this.rays) {
        const R = this.rays;
        ctx.save();
        ctx.beginPath(); ctx.rect(this.left - 300, -2000, this.right - this.left + 600, 2000 + gy); ctx.clip();
        for (let k = 0; k < 3; k++) {
          const ang = R.a + (k * Math.PI * 2) / 3;
          ctx.save();
          ctx.translate(b.cx, b.cy);
          ctx.rotate(ang);
          if (!R.fire) {
            const blink = Math.floor(this.time * 18) % 2 ? 1 : 0.5;
            ctx.fillStyle = `rgba(20,10,40,${0.22 * blink})`; ctx.fillRect(0, -12, 1900, 24);
            ctx.fillStyle = `rgba(255,255,255,${0.75 * blink})`; ctx.fillRect(0, -1, 1900, 2);
          } else {
            ctx.fillStyle = `rgba(${glow},0.3)`; ctx.fillRect(0, -30, 1900, 60);
            ctx.fillStyle = '#05050a'; ctx.fillRect(0, -15, 1900, 30);
            ctx.fillStyle = '#f4f0ff'; ctx.fillRect(0, -16, 1900, 2); ctx.fillRect(0, 14, 1900, 2);
          }
          ctx.restore();
        }
        ctx.restore();
        const g = ctx.createRadialGradient(b.cx, b.cy, 2, b.cx, b.cy, 70);
        g.addColorStop(0, R.fire ? 'rgba(255,255,255,0.8)' : `rgba(${glow},0.5)`); g.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = g; ctx.fillRect(b.cx - 70, b.cy - 70, 140, 140);
      }
      // 충격파: 땅을 달리는 검은 초승달
      for (const w of this.waves) {
        const d = w.dir;
        for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(${glow},${0.22 - i * 0.05})`; ctx.fillRect(Math.min(w.x, w.x - d * i * 24), gy - w.h * 0.7, 20, w.h * 0.7); }
        ctx.beginPath();
        ctx.moveTo(w.x - d * 12, gy); ctx.quadraticCurveTo(w.x + d * (20 + w.h * 0.28), gy - w.h * 0.18, w.x + d * 8, gy - w.h); ctx.quadraticCurveTo(w.x + d * 14, gy - w.h * 0.45, w.x - d * 12, gy);
        ctx.fillStyle = '#05050a'; ctx.fill(); ctx.strokeStyle = '#f4f0ff'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      // 차원문: 룬이 새겨진 검은 문틀, 안쪽에서 소용돌이치는 어둠, 가장자리에서 새는 연보라 빛
      for (const q of this.portals) {
        if (q.t < 0) continue;
        const life = 0.65 + q.shots * 0.55 + 0.4;
        const u = Math.min(1, q.t / 0.45) * Math.min(1, (life - q.t) / 0.3);
        const w = 64 * u;
        const h = 96 * u;
        const left = q.x - w / 2;
        const top = q.y - h / 2;
        const g = ctx.createRadialGradient(q.x, q.y, 2, q.x, q.y, 96);
        g.addColorStop(0, `rgba(${glow},${0.5 * u})`); g.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = g; ctx.fillRect(q.x - 96, q.y - 96, 192, 192);
        ctx.save();
        ctx.beginPath(); ctx.rect(left, top, w, h); ctx.clip();
        ctx.fillStyle = '#05050a'; ctx.fillRect(left, top, w, h);
        const core = ctx.createRadialGradient(q.x, q.y, 1, q.x, q.y, Math.max(8, h * 0.5));
        core.addColorStop(0, `rgba(${glow},0.55)`); core.addColorStop(0.5, 'rgba(40,10,70,0.5)'); core.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = core; ctx.fillRect(left, top, w, h);
        for (let k = 0; k < 4; k++) { // 안으로 감기는 나선
          ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.7)' : `rgba(${glow},0.8)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 18; i++) {
            const tt = i / 18;
            const ang = this.time * 2.2 + (k * Math.PI) / 2 + tt * 5.5;
            const rad = tt * h * 0.55;
            const px = q.x + Math.cos(ang) * rad * 0.55;
            const py = q.y + Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 7; k++) { const a = this.time * 1.5 + k * 1.9; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2); ctx.fillRect(q.x + Math.cos(a) * w * 0.32 - 1, q.y + Math.sin(a * 1.3 + k) * h * 0.36 - 1, 2, 2); }
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = '#f4f0ff'; ctx.lineWidth = 3.5; ctx.strokeRect(left, top, w, h);
        ctx.strokeStyle = `rgba(${glow},0.9)`; ctx.lineWidth = 1.6; ctx.strokeRect(left + 5, top + 5, w - 10, h - 10);
        ctx.fillStyle = '#f4f0ff'; // 모서리 장식
        for (const [ax, ay] of [[left, top], [left + w, top], [left, top + h], [left + w, top + h]]) { ctx.beginPath(); ctx.moveTo(ax, ay - 7); ctx.lineTo(ax + 6, ay); ctx.lineTo(ax, ay + 7); ctx.lineTo(ax - 6, ay); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = `rgba(${glow},${0.5 + 0.5 * Math.sin(this.time * 4)})`; // 위쪽 룬
        ctx.fillRect(q.x - 2, top - 9, 4, 8); ctx.fillRect(q.x - 6, top - 6, 12, 2);
      }
      // 튕기는 검은 공
      for (const o of this.orbs) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(o.x, gy - 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(o.x, o.y, 17, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f4f0ff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#f4f0ff'; ctx.fillRect(o.x - 6, o.y - 3, 4, 6); ctx.fillRect(o.x + 3, o.y - 3, 4, 6);
      }
      // 연타 범위 예고와 베기
      if (this.zone) {
        const z = this.zone;
        const blink = z.u > 0.6 ? (Math.floor(this.time * 18) % 2 ? 1 : 0.5) : 0.8;
        const x0 = Math.min(z.x, z.x + z.dir * 190);
        ctx.fillStyle = `rgba(${glow},${(0.1 + 0.25 * z.u) * blink})`; ctx.fillRect(x0, gy - 130, 190, 130);
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * blink})`; ctx.lineWidth = 2; ctx.strokeRect(x0, gy - 130, 190, 130);
      }
      if (this.cut) {
        const c = this.cut;
        c.t += 1 / 60;
        const a = Math.max(0, 1 - c.t / 0.14);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
        ctx.beginPath(); ctx.moveTo(b.cx, b.cy - 70); ctx.quadraticCurveTo(b.cx + c.dir * 230, b.cy - 40, b.cx + c.dir * 40, gy); ctx.quadraticCurveTo(b.cx + c.dir * 160, b.cy - 30, b.cx, b.cy - 70); ctx.fill();
      }
      // 던진 검과 땅에 박힌 검
      const s = this.sw;
      if (s) {
        ctx.save();
        ctx.translate(s.x, s.y);
        if (s.st === 'stuck') {
          ctx.rotate(Math.sin(s.t * 18) * 0.05 * Math.min(1, s.t));
          ctx.translate(0, -118);
          ctx.beginPath(); ctx.rect(-40, -60, 80, 60 + 112); ctx.clip();
          this._sword(ctx, 120, `rgb(${glow})`);
        } else {
          ctx.rotate(s.ang);
          this._sword(ctx, 150, `rgb(${glow})`);
        }
        ctx.restore();
        if (s.st === 'stuck') { // 염력: 빛줄기가 검을 끌어당긴다
          ctx.strokeStyle = `rgba(${glow},${0.4 + 0.3 * Math.sin(this.time * 10)})`; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
          ctx.beginPath(); ctx.moveTo(s.x, gy - 60); ctx.lineTo(b.cx, b.cy - 20); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // 중력: 끌려오는 별빛 줄기
      if (this.pull > 0) {
        const farX = b.cx < (this.left + this.right) / 2 ? this.right - 20 : this.left + 20;
        for (let k = 0; k < 10; k++) {
          const u = 1 - ((this.time * 0.9 + k / 10) % 1);
          const x = b.cx + (farX - b.cx) * u;
          const y = gy - 24 - (k % 4) * 22;
          ctx.strokeStyle = `rgba(${glow},${0.5 * this.pull * (1 - u * 0.5)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(farX - b.cx) * 26, y); ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${0.8 * this.pull})`; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }
  }


  G.DarkTheme = DarkTheme;
  G.DarkStone = DarkStone;
  G.Shade = Shade;
  G.DarkBoss = DarkBoss;
  G.Sikner = Sikner;
  G.Dark = { makeFloor, BOSS_FLOORS };
})(window.Game);
