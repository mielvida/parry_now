// 낚시와 곤충 채집 (왕국 밖 "성 밖 숲"):
//  - 잠자리채(등급 1~8): 들고 휘두르면 앞의 곤충이 잡힌다. 곤충 등급이 채의 등급보다 높으면 너무 빨라서 못 잡는다 (미니게임 없음)
//  - 낚싯대(등급 1~8): 연못 가까이에서 휘두르면 낚시가 시작된다. 기다리다가(찌) -> 입질할 때 누르고 -> 줄다리기 미니게임 (꼭 해야 한다)
//  - 물고기 48종, 곤충 48종 (등급 1~8). 잡은 것은 인벤토리 "채집" 칸에 쌓이고, 생선 가게 / 곤충 채집가에게 팔면 돈이 된다
(function (G) {
  const ITEMS = G.Shop.ITEMS;
  const TILE = G.Config.TILE;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickIdx = (n) => Math.floor(Math.random() * n);

  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // ---------- 물고기 48종 (등급 1~8, 등급마다 6종) ----------
  const FISH_NAMES = [
    ['송사리', '피라미', '붕어', '미꾸라지', '갈겨니', '버들치'],
    ['잉어', '메기', '쏘가리', '꺽지', '동사리', '모래무지'],
    ['가물치', '뱀장어', '향어', '쉬리', '은어', '빙어'],
    ['연어', '송어', '황쏘가리', '열목어', '무지개송어', '대구'],
    ['비단잉어', '철갑상어', '흰수염 메기', '줄무늬 가물치', '얼음 송어', '불꽃 붕어'],
    ['황금 잉어', '수정 메기', '달빛 뱀장어', '유리 송사리', '심해 아귀', '번개 가물치'],
    ['용왕 잉어', '오로라 연어', '별빛 철갑상어', '흑진주 메기', '유령 뱀장어', '보석 쏘가리'],
    ['전설의 황금 용어', '심연의 대왕 메기', '태고의 리바이어던', '무지개 신어', '달의 은빛 잉어', '세계수의 샘물고기'],
  ];
  // ---------- 곤충 48종 ----------
  const BUG_NAMES = [
    ['개미', '파리', '메뚜기', '귀뚜라미', '무당벌레', '배추흰나비'],
    ['꿀벌', '잠자리', '방아깨비', '노랑나비', '풍뎅이', '여치'],
    ['사마귀', '호랑나비', '반딧불이', '하늘소', '매미', '말벌'],
    ['왕잠자리', '물방개', '길앞잡이', '산호랑나비', '사슴풍뎅이', '왕사마귀'],
    ['장수풍뎅이', '사슴벌레', '제왕나비', '공작나비', '옥색 잠자리', '불꽃 반딧불이'],
    ['왕오색나비', '코끼리 장수풍뎅이', '황금 사슴벌레', '보석 비단벌레', '달빛 나방', '수정 매미'],
    ['오로라 나비', '용 잠자리', '불꽃 사마귀', '번개 장수풍뎅이', '유령 나방', '별빛 반딧불이'],
    ['전설의 황금 나비', '심연의 왕 사슴벌레', '태양 잠자리', '월광 비단벌레', '무지개 장수풍뎅이', '신목의 요정 나비'],
  ];
  const FISH_VALUE = [60, 140, 300, 650, 1400, 3000, 6500, 15000];
  const BUG_VALUE = [40, 100, 220, 480, 1000, 2200, 4800, 11000];
  const FISH_SIZE = [[6, 14], [18, 45], [25, 70], [40, 90], [60, 130], [80, 180], [120, 260], [200, 520]]; // cm
  const BUG_SIZE = [[0.4, 1.5], [1, 4], [2, 6], [3, 9], [4, 12], [6, 16], [8, 20], [10, 28]];

  const bugShape = (n) => (/나비|나방/.test(n) ? 'butterfly' : /잠자리/.test(n) ? 'dragonfly' : /장수풍뎅이|사슴|풍뎅이|하늘소|비단벌레|물방개|길앞잡이/.test(n) ? 'beetle' : /벌/.test(n) && !/사슴벌레/.test(n) ? 'bee' : /무당벌레/.test(n) ? 'ladybug' : /반딧불이/.test(n) ? 'firefly' : /매미/.test(n) ? 'cicada' : /메뚜기|귀뚜라미|방아깨비|여치|사마귀/.test(n) ? 'cricket' : 'ant');
  const fishShape = (n) => (/뱀장어|미꾸라지/.test(n) ? 'eel' : /메기|리바이어던/.test(n) ? 'cat' : 'fish');

  const FISH = [], BUGS = [];
  FISH_NAMES.forEach((list, t) => list.forEach((name, i) => {
    const idx = FISH.length;
    const h = (idx * 47 + 190) % 360;
    const tier = t + 1;
    const sp = { id: 'fish_' + idx, name, tier, kind: 'fish', shape: fishShape(name), value: FISH_VALUE[t], size: FISH_SIZE[t], look: [hsl(h, 55 + t * 4, 62), hsl((h + 30) % 360, 60, 36)] };
    FISH.push(sp);
    ITEMS[sp.id] = { id: sp.id, name, catch: 'fish', tier, shape: sp.shape, price: sp.value, look: sp.look, desc: `${tier}등급 물고기. 생선 가게에 팔면 약 ${sp.value} G` };
  }));
  BUG_NAMES.forEach((list, t) => list.forEach((name, i) => {
    const idx = BUGS.length;
    const h = (idx * 61 + 20) % 360;
    const tier = t + 1;
    const sp = { id: 'bug_' + idx, name, tier, kind: 'bug', shape: bugShape(name), value: BUG_VALUE[t], size: BUG_SIZE[t], look: [hsl(h, 60 + t * 3, 58), hsl((h + 20) % 360, 55, 32)] };
    BUGS.push(sp);
    ITEMS[sp.id] = { id: sp.id, name, catch: 'bug', tier, shape: sp.shape, price: sp.value, look: sp.look, desc: `${tier}등급 곤충. 곤충 채집가에게 가져가면 약 ${sp.value} G` };
  }));

  // ---------- 낚싯대 / 잠자리채 (등급 8단계, 아주 비싸다) ----------
  const ROD_NAMES = ['대나무 낚싯대', '철 낚싯대', '강철 낚싯대', '은빛 낚싯대', '황금 낚싯대', '수정 낚싯대', '용뼈 낚싯대', '전설의 낚싯대'];
  const NET_NAMES = ['나무 잠자리채', '대나무 잠자리채', '철 잠자리채', '은실 잠자리채', '황금 잠자리채', '수정 잠자리채', '미스릴 잠자리채', '전설의 잠자리채'];
  const ROD_PRICE = [1500, 5000, 14000, 38000, 90000, 210000, 480000, 1100000];
  const NET_PRICE = [1200, 4000, 11000, 30000, 72000, 170000, 400000, 900000];
  const GEAR_LOOK = [['#c9a86a', '#8a5a2b'], ['#b8c0cc', '#6c7686'], ['#9aa4b2', '#4a5666'], ['#e6edf5', '#9db6d6'], ['#ffe27a', '#d4a017'], ['#9fe8ff', '#4fb5e0'], ['#d9b0ff', '#7a3ad9'], ['#ffd0f0', '#ff5ab8']];
  const RODS = [], NETS = [];
  for (let g = 1; g <= 8; g++) {
    const rod = { id: 'rod' + g, slot: 'weapon', type: 'rod', name: ROD_NAMES[g - 1], price: ROD_PRICE[g - 1], reach: 0.3, throwTiles: 0, cd: 0, look: GEAR_LOOK[g - 1], baseDmg: 1, grade: g, note: `낚시: 연못 앞에서 휘두르면 시작. ${g}등급 물고기까지 낚는다 (줄다리기 칸이 ${g}에 맞게 넓다)`, noMult: true };
    const net = { id: 'net' + g, slot: 'weapon', type: 'net', name: NET_NAMES[g - 1], price: NET_PRICE[g - 1], reach: 0.3, throwTiles: 0, cd: -0.1, look: GEAR_LOOK[g - 1], baseDmg: 1, grade: g, note: `채집: 휘두르면 앞의 곤충을 잡는다. ${g}등급 곤충까지 잡는다 (채의 범위도 넓다)`, noMult: true };
    ITEMS[rod.id] = rod; ITEMS[net.id] = net;
    RODS.push(rod.id); NETS.push(net.id);
  }
  G.Shop.TYPE_NAMES.rod = '낚싯대';
  G.Shop.TYPE_NAMES.net = '잠자리채';
  G.Shop.SHOPS.tackle = { title: '낚시·채집 용품점', tabs: [{ name: '낚싯대', items: RODS.map((id) => ITEMS[id]) }, { name: '잠자리채', items: NETS.map((id) => ITEMS[id]) }] };
  G.Shop.SHOPS.fishmonger = { title: '생선 가게', tabs: [] };
  G.Shop.SHOPS.collector = { title: '곤충 채집가', tabs: [] };

  // 등급 g의 도구로 만나는 종 (낮은 등급이 흔하다. 도구 등급 + 1까지 나온다)
  const WEIGHT = [40, 26, 16, 10, 5, 2.2, 0.9, 0.3];
  function roll(list, maxTier) {
    const pool = list.filter((s) => s.tier <= maxTier);
    let sum = 0;
    for (const s of pool) sum += WEIGHT[s.tier - 1];
    let r = Math.random() * sum;
    for (const s of pool) { r -= WEIGHT[s.tier - 1]; if (r <= 0) return s; }
    return pool[0];
  }
  const sizeOf = (sp) => { const u = Math.pow(Math.random(), 1.4); return { u, cm: Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * u) * 10) / 10, value: Math.round(sp.value * (0.75 + 0.75 * u)) }; };

  // ---------- 곤충 (성 밖 숲에 날아다닌다) ----------
  function newBug(terrain, avoidX) {
    const sp = roll(BUGS, 8);
    const groundY = 16 * TILE;
    let x = rnd(8 * TILE, terrain.width - 8 * TILE);
    if (avoidX !== undefined && Math.abs(x - avoidX) < 400) x = (x + 900) % (terrain.width - 16 * TILE) + 8 * TILE;
    return { sp, hx: x, hy: groundY - rnd(24, 150), x, y: groundY - 60, t: rnd(0, 20), a: rnd(0.5, 1.4), b: rnd(0.6, 1.5), rx: rnd(50, 140), ry: rnd(10, 40), dodge: 0, vis: 1 };
  }
  function setupBugs(terrain, n = 44) { const list = []; for (let i = 0; i < n; i++) list.push(newBug(terrain)); return list; }
  function updateBugs(bugs, dt, terrain) {
    const groundY = 16 * TILE;
    for (const b of bugs) {
      b.t += dt;
      b.dodge = Math.max(0, b.dodge - dt);
      const sp = 1 + (b.sp.tier - 1) * 0.12; // 높은 등급일수록 날쌔다
      if (b.dodge > 0) { b.hx += (b.fleeDir || 1) * 260 * dt; b.hy = Math.max(groundY - 190, b.hy - 80 * dt); }
      b.x = b.hx + Math.sin(b.t * b.a * sp) * b.rx + Math.sin(b.t * 2.3 * sp) * 10;
      b.y = Math.min(groundY - 14, b.hy + Math.cos(b.t * b.b * sp) * b.ry);
      b.hx = Math.max(6 * TILE, Math.min(terrain.width - 6 * TILE, b.hx + Math.sin(b.t * 0.13 + b.a) * 14 * dt));
    }
  }
  // 잠자리채를 휘두른다: 앞쪽 상자 안의 곤충. 반환 { caught: [bug], missed: [bug] }
  function swingNet(bugs, player, grade) {
    const reach = 54 + 16 * grade;
    const px = player.x + player.w / 2;
    const x0 = player.facing > 0 ? px - 10 : px - reach - 4;
    const box = { x: x0, y: player.y - 46, w: reach + 14, h: player.h + 78 };
    const out = { caught: [], missed: [] };
    for (const b of bugs) {
      if (b.x < box.x || b.x > box.x + box.w || b.y < box.y || b.y > box.y + box.h) continue;
      if (b.sp.tier <= grade) out.caught.push(b); else { b.dodge = 1.2; b.fleeDir = player.facing; out.missed.push(b); }
    }
    return out;
  }
  function respawnBug(bugs, bug, terrain, avoidX) { const nb = newBug(terrain, avoidX); const i = bugs.indexOf(bug); if (i >= 0) bugs[i] = nb; }

  function drawBug(ctx, b, time) {
    const sp = b.sp;
    const [c1, c2] = sp.look;
    const flap = Math.sin(time * 28 + b.t * 3);
    const dir = Math.cos(b.t * b.a) >= 0 ? 1 : -1;
    const s = 0.8 + sp.tier * 0.09;
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.scale(dir * s, s);
    if (sp.tier >= 5) { const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16 + sp.tier); g.addColorStop(0, 'rgba(255,255,200,0.35)'); g.addColorStop(1, 'rgba(255,255,200,0)'); ctx.fillStyle = g; ctx.fillRect(-26, -26, 52, 52); }
    switch (sp.shape) {
      case 'butterfly': {
        ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(-5, -3, 7, 5 + 3 * flap, -0.5, 0, Math.PI * 2); ctx.ellipse(5, -3, 7, 5 + 3 * flap, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(-4, 3, 4, 3.5, 0.4, 0, Math.PI * 2); ctx.ellipse(4, 3, 4, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(-1, -5, 2, 11); break;
      }
      case 'dragonfly': {
        ctx.fillStyle = 'rgba(220,240,255,0.7)'; ctx.fillRect(-9, -5 - 2 * flap, 8, 2); ctx.fillRect(1, -5 + 2 * flap, 8, 2); ctx.fillRect(-8, -2 + 2 * flap, 7, 2); ctx.fillRect(1, -2 - 2 * flap, 7, 2);
        ctx.fillStyle = c1; ctx.fillRect(-10, -1, 22, 3); ctx.fillStyle = c2; ctx.fillRect(10, -2, 5, 5); ctx.fillStyle = '#222'; ctx.fillRect(13, -1, 1.5, 1.5); break;
      }
      case 'beetle': {
        ctx.fillStyle = 'rgba(230,230,255,0.55)'; ctx.fillRect(-9, -8 - 2 * flap, 8, 3); ctx.fillRect(1, -8 + 2 * flap, 8, 3);
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0, 1, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(-1, 0, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(6, -2, 5, 3); if (sp.tier >= 4) { ctx.fillRect(10, -5, 2, 4); ctx.fillRect(10, 1, 2, 4); } break;
      }
      case 'bee': {
        ctx.fillStyle = 'rgba(230,240,255,0.7)'; ctx.fillRect(-4, -7 - 2 * flap, 6, 4); ctx.fillRect(0, -7 + 2 * flap, 6, 4);
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-3, -5, 2, 10); ctx.fillRect(2, -5, 2, 10); ctx.fillRect(7, -1, 3, 3); break;
      }
      case 'ladybug': {
        ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-1, -6, 2, 12); ctx.beginPath(); ctx.arc(-3, -1, 1.3, 0, Math.PI * 2); ctx.arc(3, 2, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(5, -2, 3, 3); break;
      }
      case 'firefly': {
        const glow = 0.5 + 0.5 * Math.sin(time * 4 + b.t);
        const g = ctx.createRadialGradient(-2, 2, 1, -2, 2, 14); g.addColorStop(0, `rgba(230,255,120,${0.8 * glow})`); g.addColorStop(1, 'rgba(230,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(-16, -12, 32, 32);
        ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(-4, 1, 2.5, 0, Math.PI * 2); ctx.fill(); break;
      }
      case 'cicada': {
        ctx.fillStyle = 'rgba(220,240,255,0.65)'; ctx.fillRect(-9, -6 - 2 * flap, 11, 4); ctx.fillRect(0, -6 + 2 * flap, 11, 4);
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c1; ctx.fillRect(5, -3, 4, 5); break;
      }
      case 'cricket': {
        ctx.fillStyle = c2; ctx.fillRect(-7, -3, 14, 6); ctx.fillStyle = c1; ctx.fillRect(-6, -4, 9, 3); ctx.fillStyle = '#2a1a10'; ctx.fillRect(6, -3, 4, 5); ctx.fillRect(-6, 3, 2, 5); ctx.fillRect(2, 3, 2, 5); break;
      }
      default: { // 개미/파리
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(-4, 0, 3, 0, Math.PI * 2); ctx.arc(1, 0, 2.6, 0, Math.PI * 2); ctx.arc(6, 0, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(230,240,255,0.7)'; ctx.fillRect(-2, -6 - flap, 5, 3);
      }
    }
    ctx.restore();
  }
  function drawBugs(ctx, bugs, camera, time) {
    for (const b of bugs) if (b.x > camera.x - 40 && b.x < camera.x + camera.viewW + 40) drawBug(ctx, b, time);
  }

  // ---------- 낚시 미니게임 ----------
  // 단계: wait(찌를 던지고 기다린다) -> bite(입질! 이때 눌러야 한다) -> reel(줄다리기: 물고기가 칸 안에 머물게) -> done
  function startFishing(rod, pondIdx) {
    const grade = rod.grade;
    const maxTier = Math.min(8, grade + (pondIdx % 2)); // 깊은 연못(두 번째)은 한 단계 위까지 나온다
    return { phase: 'wait', t: 0, waitT: rnd(1.4, 4.2), grade, maxTier, species: null, fish: 0.5, fv: 0, bar: 0.5, bv: 0, prog: 0.3, size: null, msg: '', done: false, caught: false, time: 0, shake: 0 };
  }
  function updateFishing(f, dt, input) {
    f.time += dt;
    f.t += dt;
    const hookPressed = input.parryPressed || input.wasPressed('Space') || input.wasPressed('Enter');
    const held = input.parryHeld || input.down.has('Space') || input.down.has('ArrowUp') || input.down.has('KeyW');
    if (input.wasPressed('Escape')) { f.done = true; f.msg = '낚시를 그만뒀다'; return; }
    if (f.phase === 'wait') {
      if (hookPressed) { f.done = true; f.caught = false; f.msg = '너무 일찍 당겼다! 물고기가 놀라 도망갔다'; return; }
      if (f.t >= f.waitT) { f.phase = 'bite'; f.t = 0; f.species = roll(FISH, f.maxTier); f.shake = 1; }
    } else if (f.phase === 'bite') {
      f.shake = Math.max(0, f.shake - dt);
      if (hookPressed) { f.phase = 'reel'; f.t = 0; f.fish = 0.5; f.bar = 0.5; f.prog = 0.3; f.fvt = 0; f.msg = '걸렸다! 누르고 있으면 칸이 올라간다. 물고기를 칸 안에 두자!'; return; }
      if (f.t > 1.1) { f.done = true; f.caught = false; f.msg = '입질을 놓쳤다…'; }
    } else if (f.phase === 'reel') {
      const tier = f.species.tier;
      // 물고기: 불규칙하게 위아래로 달린다 (등급이 높을수록 빠르고 거세다)
      f.fvt -= dt;
      if (f.fvt <= 0) { f.fvt = rnd(0.5, 1.3) / (1 + tier * 0.12); f.ftarget = Math.random(); }
      f.fish += (f.ftarget - f.fish) * Math.min(1, dt * (1.8 + tier * 0.55));
      // 내 칸: 누르면 올라가고 놓으면 내려간다
      f.bv += ((held ? -1.35 : 1.25) - f.bv * 2.2) * dt * 1.5;
      f.bar = Math.max(0, Math.min(1, f.bar + f.bv * dt * 0.85));
      const size = Math.min(0.5, 0.2 + 0.03 * f.grade) - (tier > f.grade ? 0.05 * (tier - f.grade) : 0); // 칸 크기: 낚싯대 등급이 높으면 넓다
      const inside = Math.abs(f.fish - f.bar) < Math.max(0.08, size) / 2 + 0.03;
      f.size = Math.max(0.08, size);
      f.prog += (inside ? 0.26 : -(0.13 + 0.03 * tier)) * dt;
      f.prog = Math.min(1, f.prog);
      if (f.prog >= 1) { f.done = true; f.caught = true; f.result = sizeOf(f.species); f.msg = ''; }
      else if (f.prog <= 0) { f.done = true; f.caught = false; f.msg = '줄이 끊어졌다… 물고기가 도망갔다'; }
      else if (f.t > 40) { f.done = true; f.caught = false; f.msg = '시간이 너무 걸려 놓쳤다'; }
    }
  }
  function drawFishing(ctx, W, H, f) {
    const px = Math.round(W / 2 - 300), py = 90, pw = 600, ph = 340;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#9fd8f0'); g.addColorStop(0.28, '#5aa8d8'); g.addColorStop(1, '#1a4a78');
    ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#e0b12f'; ctx.lineWidth = 4; ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#4a9a3a'; ctx.fillRect(px, py, pw, 38); // 연못가
    ctx.textBaseline = 'middle';
    // 낚싯줄과 찌
    const bx = px + 150, by = py + 100 + (f.phase === 'bite' ? 30 + Math.sin(f.time * 40) * 4 : Math.sin(f.time * 2) * 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + 60, py + 20); ctx.lineTo(bx, by - 10); ctx.stroke();
    ctx.fillStyle = '#e8334a'; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(bx - 7, by - 1, 14, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, by + 6, 16 + 4 * Math.sin(f.time * 3), 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    if (f.phase === 'wait') { ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('찌를 던졌다… 입질을 기다리자', px + pw / 2, py + 250); ctx.font = '14px sans-serif'; ctx.fillStyle = '#d8ecff'; ctx.fillText('(너무 일찍 당기면 도망가요)', px + pw / 2, py + 280); }
    if (f.phase === 'bite') { ctx.font = 'bold 64px sans-serif'; ctx.fillStyle = '#ffdd44'; ctx.fillText('!', bx, by - 56); ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('입질이다! 지금 당겨!  (Enter / 클릭)', px + pw / 2, py + 250); }
    if (f.phase === 'reel') {
      // 줄다리기 칸: 세로 막대
      const mx = px + pw - 120, my = py + 50, mh = 260, mw = 36;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(mx, my, mw, mh);
      ctx.fillStyle = 'rgba(125,255,160,0.55)'; ctx.fillRect(mx, my + (f.bar - f.size / 2) * mh, mw, f.size * mh); // 내 칸
      ctx.save(); ctx.translate(mx + mw / 2, my + f.fish * mh); // 물고기
      drawFishShape(ctx, f.species, 0.9); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
      // 진행 막대
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(mx + mw + 12, my, 14, mh); ctx.fillStyle = f.prog > 0.6 ? '#7dffa0' : f.prog > 0.3 ? '#ffd54a' : '#ff8a5a'; ctx.fillRect(mx + mw + 12, my + mh * (1 - f.prog), 14, mh * f.prog);
      ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText(f.msg, px + 24, py + 250);
      ctx.font = '14px sans-serif'; ctx.fillStyle = '#d8ecff'; ctx.fillText('누르고 있으면 칸이 올라가고, 놓으면 내려가요', px + 24, py + 282);
    }
    if (f.done) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px, py + 120, pw, 150);
      ctx.textAlign = 'center';
      if (f.caught) {
        const sp = f.species;
        ctx.save(); ctx.translate(px + 120, py + 195); drawFishShape(ctx, sp, 3); ctx.restore();
        ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#ffd54a'; ctx.textAlign = 'left'; ctx.fillText(`${sp.name}  (${sp.tier}등급)`, px + 200, py + 160);
        ctx.font = '18px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(`크기 ${f.result.cm} cm · 값 약 ${f.result.value} G`, px + 200, py + 196);
        ctx.font = '14px sans-serif'; ctx.fillStyle = '#c8d8e8'; ctx.fillText('인벤토리 "채집"에 들어갔어요. 생선 가게에서 팔 수 있어요.  (Enter: 닫기)', px + 200, py + 236);
      } else { ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ff9a9a'; ctx.fillText(f.msg, px + pw / 2, py + 180); ctx.font = '14px sans-serif'; ctx.fillStyle = '#c8d8e8'; ctx.fillText('(Enter: 닫기)', px + pw / 2, py + 230); }
    }
    ctx.restore();
  }
  // 물고기 그림 (종마다 색과 모양이 다르다). 원점이 몸 중심
  function drawFishShape(ctx, sp, k) {
    ctx.save();
    ctx.scale(k, k);
    const [c1, c2] = sp.look;
    if (sp.shape === 'eel') {
      ctx.strokeStyle = c2; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, 3); ctx.quadraticCurveTo(-6, -6, 0, 0); ctx.quadraticCurveTo(6, 6, 14, -3); ctx.stroke();
      ctx.strokeStyle = c1; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-13, 2, 1.1, 0, Math.PI * 2); ctx.fill();
    } else {
      const big = sp.shape === 'cat' ? 1.1 : 1;
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(10 * big, 0); ctx.lineTo(18 * big, -7); ctx.lineTo(18 * big, 7); ctx.closePath(); ctx.fill(); // 꼬리
      ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(3, -12); ctx.lineTo(7, -7); ctx.closePath(); ctx.fill(); // 등지느러미
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, 0, 13 * big, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(-2, -2.5, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-8, -1.5, 1.3, 0, Math.PI * 2); ctx.fill();
      if (sp.shape === 'cat') { ctx.strokeStyle = c2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-12, 1); ctx.lineTo(-17, 5); ctx.moveTo(-12, 3); ctx.lineTo(-16, 8); ctx.stroke(); }
      if (sp.tier >= 5) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-1, 0, 11, -0.6, 0.6); ctx.stroke(); }
    }
    ctx.restore();
  }
  // 인벤토리/상점 아이콘: 물고기와 곤충 (정지한 모습)
  function drawCatchIcon(ctx, item, k = 1.6) {
    const sp = { look: item.look, shape: item.shape, tier: item.tier };
    if (item.catch === 'fish') { drawFishShape(ctx, sp, k * 1.1); return; }
    ctx.save();
    ctx.scale(k * 1.7, k * 1.7);
    drawBug(ctx, { sp, x: 0, y: 0, t: 0, a: 1, b: 1 }, 0);
    ctx.restore();
  }

  // ---------- 성 밖 숲 테마: 숲 배경 + 연못, 나무, 꽃 ----------
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const Meadow = Object.assign({}, G.Forest, {
    drawDecor(ctx, terrain, camera, time) {
      if (G.Forest.drawDecor) G.Forest.drawDecor(ctx, terrain, camera, time); // 출구 문
      const view = camera.viewW + 300;
      const gy = 16 * TILE; // 풀밭 윗면
      // 나무와 꽃
      for (let c = 6; c < terrain.cols - 4; c += 3) {
        const x = c * TILE + TILE / 2;
        if (x < camera.x - 120 || x > camera.x + view) continue;
        const r = hash(c, 7);
        if (terrain.ponds.some((p) => Math.abs(c - p.col) < 7)) continue; // 연못가는 비워 둔다
        if (r < 0.28) { // 나무
          const h = 80 + r * 220;
          ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 6, gy - h * 0.6, 12, h * 0.6);
          ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.arc(x, gy - h * 0.72, 34 + r * 40, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#58a84a'; ctx.beginPath(); ctx.arc(x - 12, gy - h * 0.82, 24 + r * 30, 0, Math.PI * 2); ctx.fill();
        } else if (r < 0.62) { // 꽃과 풀
          ctx.fillStyle = ['#ff9ec0', '#ffe27a', '#fff', '#b08aff'][Math.floor(hash(c, 3) * 4)];
          ctx.fillRect(x - 10 + hash(c, 9) * 20, gy - 6, 4, 4);
          ctx.fillStyle = '#4a9a3a'; ctx.fillRect(x - 3, gy - 9, 2, 9); ctx.fillRect(x + 1, gy - 7, 2, 7);
        }
      }
      // 연못: 한 칸 깊이로 판 자리에 물을 채운다
      for (const p of terrain.ponds) {
        const x0 = (p.col - 4) * TILE, x1 = (p.col + 5) * TILE;
        if (x1 < camera.x - 80 || x0 > camera.x + view) continue;
        const wg = ctx.createLinearGradient(0, gy, 0, gy + TILE + 8);
        wg.addColorStop(0, 'rgba(110,200,235,0.88)'); wg.addColorStop(1, 'rgba(30,90,150,0.95)');
        ctx.fillStyle = wg; ctx.fillRect(x0, gy + 4, x1 - x0, TILE + 4);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 9; i++) { const sx = x0 + 20 + ((i * 41 + time * 18) % (x1 - x0 - 40)); ctx.fillRect(sx, gy + 8 + (i % 3) * 8, 10, 2); }
        ctx.fillStyle = '#3f9a3a'; // 연잎
        for (const dx of [-2.3, 0.4, 2.2]) { ctx.beginPath(); ctx.ellipse((p.col + dx) * TILE + 16, gy + 6, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ff9ec0'; ctx.beginPath(); ctx.arc((p.col + 0.4) * TILE + 16, gy + 3, 3, 0, Math.PI * 2); ctx.fill();
        for (const x of [x0 - 6, x1 + 4]) { ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 5, gy); ctx.quadraticCurveTo(x + i * 5 + 6, gy - 24 - i * 3, x + i * 5 + 2, gy - 38 - i * 4); ctx.stroke(); } }
        if (G.TextLayer && !terrain.fishingActive) G.TextLayer.add(p.col === terrain.ponds[0].col ? '얕은 연못' : '깊은 연못', (p.col + 0.5) * TILE, gy - 70, 'bold 13px sans-serif', '#ffffff');
      }
    },
  });
  G.MeadowTheme = Meadow;

  G.Fishing = { FISH, BUGS, RODS, NETS, roll, sizeOf, setupBugs, updateBugs, swingNet, respawnBug, drawBugs, drawBug, startFishing, updateFishing, drawFishing, drawFishShape, drawCatchIcon, FISH_VALUE, BUG_VALUE };
})(window.Game);
