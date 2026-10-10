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
      const rise = rand() < 0.08 + 0.3 * t ? 3 : 2;
      const maxGap = rise === 3 ? 2 : 3;
      const w = pick(4, Math.max(5, 7 - Math.floor(t * 3)));
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
    stone: { name: '정의의 어둠돌', hp: () => C.BOSS_STONE_HP, patterns: ['spawn', 'slam', 'ball'], defeat: '정의의 어둠돌을 쓰러뜨렸다!', scale: 1.05 },
    justice: { name: '정의의 어둠', hp: () => C.BOSS_JUSTICE_HP, patterns: ['ball', 'shard', 'slam', 'spawn'], defeat: '정의의 어둠을 쓰러뜨렸다!', scale: 1.15 },
    sikner: { name: '시크너', hp: () => C.BOSS_SIKNER_HP, patterns: ['ball', 'shard', 'slam', 'spawn', 'rain'], defeat: '시크너를 쓰러뜨렸다!', scale: 1.3 },
  };
  const MINIONS = { stone: ['darkstone', 'darkslime'], justice: ['shade', 'darkslime', 'darkstone'], sikner: ['shade', 'darkstone', 'darkslime', 'shade'] };
  const SHARD_LEN = 76;

  class DarkBoss extends G.KingSlime {
    constructor(left, width, groundY, ev, kind) {
      super(left, width, groundY, ev);
      const m = META[kind];
      this.dkind = kind;
      this.kind = 'dark';
      this.name = m.name;
      this.defeatText = m.defeat;
      this.patterns = m.patterns;
      this.scale = m.scale;
      this.body.maxHp = m.hp();
      this.body.hp = this.body.maxHp;
      this.hurtDmg = 3; // 암흑의 존재는 한 번에 목숨 3개
      this.shards = [];
      this.rains = [];
    }

    minionKind() { const l = MINIONS[this.dkind]; return l[Math.floor(Math.random() * l.length)]; }

    _startPattern() {
      if (!this.body.alive) return;
      const type = this.patterns[Math.floor(Math.random() * this.patterns.length)];
      this.pat = { type, t: 0, n: 0, sub: 'start' };
      if (type === 'ball') {
        const count = this.dkind === 'sikner' ? 6 : 4;
        this.pat.shots = [];
        for (let k = 0; k < count; k++) this.pat.shots.push({ at: 0.9 + k * 0.8, fired: false });
        this.pat.end = 0.9 + (count - 1) * 0.8 + 0.9;
      }
      this.phase = 'pattern';
    }

    _runPattern(dt) {
      const p = this.pat;
      if (p.type !== 'shard' && p.type !== 'rain') { super._runPattern(dt); return; }
      p.t += dt;
      const b = this.body;
      let finished = false;
      if (p.type === 'shard') { // 양쪽 벽에서 어둠의 칼날이 가로로 날아온다
        while (p.n < 8 && p.t >= 0.5 + p.n * 0.5) {
          p.n += 1;
          const low = Math.random() < 0.5;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.shards.push({ side, low, y: this.groundY - (low ? 24 : 92), h: low ? 24 : 34, st: 'warn', t: 0, x: side > 0 ? this.right : this.left });
        }
        finished = p.n >= 8 && this.shards.length === 0;
      } else { // 시크너: 위에서 어둠의 창이 떨어진다
        while (p.n < 10 && p.t >= 0.3 + p.n * 0.32) {
          p.n += 1;
          const x = clamp(this.playerX + (p.n === 1 ? 0 : rr(-190, 190)), this.left + 30, this.right - 30);
          this.rains.push({ x, y: -50, t: 0, st: 'warn', hit: false });
        }
        finished = p.n >= 10 && this.rains.length === 0;
      }
      b.glow = 0;
      if (finished) this._endPattern();
    }

    update(dt, player) {
      super.update(dt, player);
      if (this.done) { this.shards.length = 0; this.rains.length = 0; return; }
      if (!this.body.alive) return;
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
        if (hurt) this.ev.hurt(this.hurtDmg);
      }
    }

    // ---------- 그리기 ----------
    drawFront(ctx) {
      for (const r of this.rains) if (r.st === 'warn') this._drawMark(ctx, r.x, 76, r.t / 0.75, r.t > 0.45);
      super.drawFront(ctx);
      for (const k of this.shards) this._drawShard(ctx, k);
      for (const r of this.rains) if (r.st !== 'warn') this._drawSpike(ctx, r);
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

    _drawBall(ctx, f) { // 어둠 구슬 (쳐내면 하얗게 변해 되돌아간다)
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
      // 어둠의 기운
      const aura = ctx.createRadialGradient(cx, bottom - h * 0.5, 4, cx, bottom - h * 0.5, w * 0.95);
      aura.addColorStop(0, 'rgba(150,60,230,0.45)'); aura.addColorStop(1, 'rgba(60,10,120,0)');
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

    _paintSikner(ctx, b, cx, bottom, w, h, flash, stunned) { // 시크너: 뿔 달린 왕관, 붉은 눈의 어둠의 지배자
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.52, bottom); ctx.lineTo(cx - w * 0.3, bottom - h * 0.75); ctx.lineTo(cx - w * 0.16, bottom - h * 0.95); ctx.lineTo(cx + w * 0.16, bottom - h * 0.95); ctx.lineTo(cx + w * 0.3, bottom - h * 0.75); ctx.lineTo(cx + w * 0.52, bottom);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, bottom - h, 0, bottom);
      g.addColorStop(0, flash ? '#ffffff' : '#3a1060'); g.addColorStop(1, flash ? '#ffe0f0' : '#0a0314');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#b070ff'; ctx.lineWidth = 3; ctx.stroke();
      for (const sx of [-1, 1]) { // 긴 팔과 발톱
        ctx.strokeStyle = '#2a0a48'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        const hx = cx + sx * w * (b.state === 'wind' ? 0.9 : 0.62);
        const hy = bottom - h * (b.state === 'wind' ? 1.05 : 0.2);
        ctx.beginPath(); ctx.moveTo(cx + sx * w * 0.28, bottom - h * 0.7); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = '#e8c8ff'; ctx.lineWidth = 3;
        for (let c2 = -1; c2 <= 1; c2++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + sx * 12, hy + c2 * 9 + 4); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
      ctx.fillStyle = '#d4a017'; // 왕관
      const ty = bottom - h * 1.0;
      ctx.beginPath(); ctx.moveTo(cx - w * 0.16, ty + 10); ctx.lineTo(cx - w * 0.24, ty - 22); ctx.lineTo(cx - w * 0.08, ty - 6); ctx.lineTo(cx, ty - 28); ctx.lineTo(cx + w * 0.08, ty - 6); ctx.lineTo(cx + w * 0.24, ty - 22); ctx.lineTo(cx + w * 0.16, ty + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8334a'; ctx.fillRect(cx - 4, ty - 6, 8, 8);
      ctx.fillStyle = '#e6dcc4'; // 뿔
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sx * w * 0.14, ty + 4); ctx.quadraticCurveTo(cx + sx * w * 0.42, ty - 8, cx + sx * w * 0.36, ty - 50); ctx.quadraticCurveTo(cx + sx * w * 0.26, ty - 22, cx + sx * w * 0.2, ty + 8); ctx.closePath(); ctx.fill(); }
      this._eyes(ctx, cx, bottom - h * 0.78, w * 0.1, 8, stunned, '#ff2a4a');
      ctx.fillStyle = '#1a0828';
      ctx.beginPath(); ctx.ellipse(cx, bottom - h * 0.6, w * 0.1, 3 + (b.glow > 0 ? 8 : 2), 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  G.DarkTheme = DarkTheme;
  G.DarkStone = DarkStone;
  G.Shade = Shade;
  G.DarkBoss = DarkBoss;
  G.Dark = { makeFloor, BOSS_FLOORS };
})(window.Game);
