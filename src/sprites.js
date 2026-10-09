// 내 스프라이트: 캐릭터의 움직임과 공격 모션을 프레임마다 직접 그려서 쓰는 시스템.
// 그림 데이터는 브라우저(localStorage)에 저장되고, editor.html(스프라이트 편집기)에서 그린다.
// 게임은 켜져 있고 그림이 있을 때만 이 스프라이트로 용사를 그린다 (K 키로 켜고 끈다).
//
// 한 프레임 = 가로 40 x 세로 28 칸. 한 칸 = 게임 좌표 2 (픽셀 화면의 한 도트).
// 기준점은 프레임 아래쪽 가운데(발바닥 가운데)이고, 오른쪽을 바라보는 모습을 그린다 (왼쪽은 자동으로 뒤집는다).
// 몸 크기(24 x 32)는 12 x 16 칸이다.
(function (G) {
  const C = G.Config;
  const W = 40;
  const H = 28;
  const CELL = 2;
  const MAX_FRAMES = 8;
  const MAX_PALETTE = 36;
  const IMPORT_PALETTE_LIMIT = 28; // 기본 모습을 불러올 때 쓰는 색은 28가지까지 (직접 추가할 색 자리를 남겨 둔다)
  const KEY = 'parry_sprites_v1';
  const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

  const ANIM_KEYS = ['idle', 'run', 'jump', 'fall', 'attack', 'guard'];
  const ANIM_NAMES = {
    idle: '대기', run: '달리기', jump: '점프 (오르는 중)', fall: '낙하 (떨어지는 중)', attack: '공격 (베기)', guard: '가드 (패링 성공)',
  };
  // 애니메이션을 고르는 규칙 설명 (편집기에 보여준다)
  const ANIM_HELP = {
    idle: '가만히 서 있을 때. 프레임이 여러 장이면 아래 속도(초당 장수)대로 반복합니다.',
    run: '땅에서 달릴 때. 걸은 거리에 맞춰 프레임이 넘어가서 발이 미끄러지지 않습니다 (한 바퀴 = 프레임 전부).',
    jump: '위로 올라가는 중. 프레임이 여러 장이면 올라가는 속도가 줄어들수록 뒤 프레임으로 넘어갑니다.',
    fall: '아래로 떨어지는 중. 프레임이 여러 장이면 빨리 떨어질수록 뒤 프레임으로 넘어갑니다.',
    attack: '패링/베기 모션(1/3초). 프레임이 4장이면 준비 → 베기 시작 → 베기 끝 → 마무리 순서로 정해진 타이밍에 넘어가고, 판정은 베기 시작 프레임(2번째)에 나갑니다.',
    guard: '패링에 성공한 직후(약 0.35초). 없으면 공격의 첫 프레임을 씁니다.',
  };
  const DEFAULT_PALETTE = [
    '#000000', '#ffffff', '#c9d2dc', '#6b7380', '#3b6fd4', '#5b8ff0', '#c62d3a', '#e8334a',
    '#e8b98a', '#a8744a', '#6b4423', '#e0b12f', '#ffd54a', '#4fd37f', '#2d56b8', '#e8f1ff',
  ];

  const blankRows = () => Array.from({ length: H }, () => '.'.repeat(W));
  const emptyData = () => {
    const anims = {};
    for (const k of ANIM_KEYS) anims[k] = { frames: [], fps: 4, weapon: false };
    return { version: 1, enabled: false, trail: true, palette: DEFAULT_PALETTE.slice(), anims };
  };
  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  // 기본 용사 모습을 칸으로 옮겨올 때의 자세들
  const BASE_POSE = {
    x: -12, y: -32, w: 24, h: 32, facing: 1, vx: 0, vy: 0, onGround: true, animTime: 0, runPhase: 0, swing: -1,
    swordOut: false, guardTimer: 0, invuln: 0, weaponId: 'sword0', armorId: 'armor0', helmetId: null, glovesId: null, bootsId: null,
  };
  const POSES = {
    idle: [{ animTime: 0 }, { animTime: 0.35 }],
    run: [0, 1, 2, 3].map((i) => ({ vx: 220, runPhase: 0.3 + (i * Math.PI * 2) / 4 })),
    jump: [{ onGround: false, vy: -300 }],
    fall: [{ onGround: false, vy: 300 }],
    attack: [2, 6, 10, 16].map((f) => ({ swing: f })),
    guard: [{ guardTimer: C.GUARD_TIME * 0.7 }],
  };

  const cache = new Map(); // 프레임 -> 그려 둔 작은 캔버스

  const Sprites = {
    W, H, CELL, MAX_FRAMES, MAX_PALETTE, ANIM_KEYS, ANIM_NAMES, ANIM_HELP, DIGITS,
    data: emptyData(),
    _suspend: false, // true인 동안은 꺼진 것처럼 동작 (기본 모습을 칸으로 옮길 때 쓴다)

    blankRows,

    // ---- 저장/불러오기 ----
    load() {
      let d = null;
      try {
        d = JSON.parse(window.localStorage.getItem(KEY));
      } catch (e) {
        d = null;
      }
      this.data = this._sanitize(d);
      cache.clear();
    },

    save() {
      cache.clear();
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.data));
        return true;
      } catch (e) {
        return false;
      }
    },

    // 저장된 데이터가 깨졌거나 예전 형식이어도 안전하게 쓸 수 있는 모양으로 정리한다
    _sanitize(d) {
      const out = emptyData();
      if (!d || typeof d !== 'object') return out;
      out.enabled = !!d.enabled;
      out.trail = d.trail !== false;
      if (Array.isArray(d.palette) && d.palette.length) {
        out.palette = d.palette.filter((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, MAX_PALETTE);
        if (!out.palette.length) out.palette = DEFAULT_PALETTE.slice();
      }
      for (const k of ANIM_KEYS) {
        const a = d.anims && d.anims[k];
        if (!a) continue;
        out.anims[k].fps = Math.max(1, Math.min(30, Number(a.fps) || 4));
        out.anims[k].weapon = !!a.weapon;
        if (Array.isArray(a.frames)) {
          out.anims[k].frames = a.frames.slice(0, MAX_FRAMES).map((rows) => {
            const fixed = [];
            for (let y = 0; y < H; y++) {
              const r = Array.isArray(rows) && typeof rows[y] === 'string' ? rows[y] : '';
              fixed.push((r + '.'.repeat(W)).slice(0, W));
            }
            return fixed;
          });
        }
      }
      return out;
    },

    exportJSON() {
      return JSON.stringify(this.data);
    },

    importJSON(text) {
      let d;
      try {
        d = JSON.parse(text);
      } catch (e) {
        return false;
      }
      if (!d || typeof d !== 'object' || !d.anims) return false;
      this.data = this._sanitize(d);
      return this.save();
    },

    // ---- 상태 ----
    hasFrames() {
      return ANIM_KEYS.some((k) => this.data.anims[k].frames.length > 0);
    },

    // 게임이 이 스프라이트로 용사를 그려야 하는가
    active() {
      return !this._suspend && this.data.enabled && this.hasFrames();
    },

    setEnabled(v) {
      this.data.enabled = !!v;
      return this.save();
    },

    // ---- 색 ----
    // hex에 가장 가까운 팔레트 번호. tol(색 거리) 안에 없으면 새 색으로 추가하고, 팔레트가 가득이면 가장 가까운 색을 쓴다
    // limit: 팔레트가 이 개수에 이르면 새 색을 더 늘리지 않고 가장 가까운 색을 쓴다
    colorIndex(hex, tol = 0, limit = MAX_PALETTE) {
      const pal = this.data.palette;
      const want = hexToRgb(hex);
      let best = -1;
      let bd = Infinity;
      pal.forEach((c, i) => {
        const d = dist2(hexToRgb(c), want);
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0 && bd <= tol * tol) return best;
      if (pal.length < limit) {
        pal.push(hex.toLowerCase());
        return pal.length - 1;
      }
      return best;
    },

    // ---- 그림 ----
    // 프레임 하나를 W x H 픽셀짜리 캔버스로 (그리기용 캐시)
    canvas(key, i) {
      const k = key + ':' + i;
      let c = cache.get(k);
      if (c) return c;
      c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      const img = g.createImageData(W, H);
      const rows = this.data.anims[key].frames[i];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const ch = rows[y][x];
          if (ch === '.') continue;
          const hex = this.data.palette[DIGITS.indexOf(ch)];
          if (!hex) continue;
          const rgb = hexToRgb(hex);
          const o = (y * W + x) * 4;
          img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      cache.set(k, c);
      return c;
    },

    // ---- 어떤 애니메이션의 몇 번째 프레임을 보여줄까 ----
    // 공격: 휘두르기 프레임(0~19)을 장수에 맞춰 나눈다. 4장이면 준비(0~4) / 베기 시작(5~7) / 베기 끝(8~11) / 마무리(12~19)
    attackFrame(swing, n) {
      if (n <= 1) return 0;
      if (n === 4) {
        const b = [0, C.SWING_SLASH_FRAME, 8, 12, C.SWING_FRAMES];
        for (let i = 0; i < 4; i++) if (swing < b[i + 1]) return i;
        return 3;
      }
      return Math.max(0, Math.min(n - 1, Math.floor((swing / C.SWING_FRAMES) * n)));
    },

    // key 애니메이션의 프레임 번호 (p = 플레이어 상태). 프레임이 없으면 -1
    frameIndex(key, p) {
      const a = this.data.anims[key];
      const n = a.frames.length;
      if (!n) return -1;
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      if (key === 'attack') return this.attackFrame(p.swing, n);
      if (key === 'run') return ((Math.floor((p.runPhase * n) / (Math.PI * 2)) % n) + n) % n;
      if (key === 'idle') return Math.floor(p.animTime * (a.fps || 4)) % n;
      if (key === 'guard') return clamp(Math.floor(((C.GUARD_TIME - p.guardTimer) / C.GUARD_TIME) * n), 0, n - 1);
      if (key === 'jump') return clamp(Math.floor((1 - clamp(-p.vy / C.JUMP_SPEED, 0, 1)) * n), 0, n - 1);
      return clamp(Math.floor(clamp(p.vy / C.MAX_FALL_SPEED, 0, 1) * n), 0, n - 1); // fall
    },

    // 지금 플레이어 상태에서 보여줄 { key, i }. 그릴 그림이 하나도 없으면 null
    pick(p) {
      const has = (k) => this.data.anims[k].frames.length > 0;
      let key = 'idle';
      if (p.guardTimer > 0) key = 'guard';
      else if (p.swing >= 0) key = 'attack';
      else if (!p.onGround) key = p.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(p.vx) > 10) key = 'run';
      // 그 동작의 그림이 없으면 비슷한 동작으로 대신한다
      const fallback = {
        guard: ['guard', 'attack', 'idle'], attack: ['attack', 'idle'], jump: ['jump', 'fall', 'idle'],
        fall: ['fall', 'jump', 'idle'], run: ['run', 'idle'], idle: ['idle'],
      }[key];
      key = fallback.find(has) || ANIM_KEYS.find(has);
      if (!key) return null;
      return { key, i: this.frameIndex(key, p) };
    },

    // ---- 기본 용사 모습을 칸으로 옮겨오기 (그림을 처음부터 그리지 않고 고쳐 그릴 수 있게) ----
    importDefault(key) {
      const poses = POSES[key];
      this.data.anims[key].frames = poses.map((pose) => this._rasterize(Object.assign({}, BASE_POSE, pose)));
      this.data.anims[key].weapon = false;
      cache.clear();
      return poses.length;
    },

    importAllDefaults() {
      for (const k of ANIM_KEYS) this.importDefault(k);
    },

    // 기본 용사 그림(코드로 그리는 모습)을 W x H 칸에 그려서 칸 데이터로 바꾼다
    _rasterize(p) {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.setTransform(1 / CELL, 0, 0, 1 / CELL, W / 2, H); // 게임 좌표 -> 칸 (발바닥 가운데가 아래쪽 가운데)
      this._suspend = true;
      G.Hero.suppressTrail = true;
      try {
        G.Hero.draw(g, p);
      } finally {
        this._suspend = false;
        G.Hero.suppressTrail = false;
      }
      const img = g.getImageData(0, 0, W, H).data;
      const rows = [];
      for (let y = 0; y < H; y++) {
        let row = '';
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          if (img[o + 3] < 140) { row += '.'; continue; } // 반투명한 가장자리 번짐은 버린다
          row += DIGITS[this.colorIndex(rgbToHex(img[o], img[o + 1], img[o + 2]), 40, IMPORT_PALETTE_LIMIT)];
        }
        rows.push(row);
      }
      return rows;
    },
  };

  Sprites.load();
  // 편집기(다른 탭)에서 저장하면 게임을 새로고침하지 않아도 바로 반영한다
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) Sprites.load();
  });

  G.Sprites = Sprites;
})(window.Game);
