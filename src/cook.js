// 집 요리: 가구 가게에서 산 가스레인지를 집에 놓고, 잡은 물고기·해산물·곤충·약재(먹을 수 있는 건 전부)를 최대 5개 골라
// 조리법(12가지)을 정해 요리하면 요리 하나가 완성된다. (재료 종류 x 조리법 x 곁들임 x 재료 수 = 경우의 수가 수천 가지, 요리마다 그림이 다르다)
//  조작: ↑↓ 재료 고르기 · Enter 재료 넣기 · Backspace 빼기 · ←→ 조리법 · C 요리하기 · X 가스레인지 치우기 · Esc 닫기
(function (G) {
  const ITEMS = G.Shop.ITEMS;
  const METHODS = ['구이', '튀김', '찜', '탕', '회', '조림', '볶음', '스튜', '샐러드', '꼬치', '덮밥', '스파게티'];
  const GARNISH = ['', '허브 ', '매콤 ', '고소한 ', '상큼한 ', '향긋한 ', '달콤 '];
  const GCOL = ['#ffffff', '#4fae45', '#d02a2a', '#e8d8a0', '#f0e060', '#7ad0a0', '#ff9ac0'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hashStr = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  const frand = (h, i) => { const x = Math.sin(h * 0.0001 + i * 12.9898) * 43758.5453; return x - Math.floor(x); };

  // ---- 재료 원천: 먹을 수 있는 것은 모두 여기에 등록한다 ----
  // 새 먹거리를 만들 때 쓰는 법 (아래 둘 중 하나면 모든 요리에 자동으로 쓰인다):
  //  1) ITEMS에 { catch: 'fish' | 'bug' } 를 달고 inv.fish / inv.bugs 에 개수를 쌓는다 (낚시·곤충: 자동 인식)
  //  2) ITEMS에 { edible: true, shape?: 'fish'|'crab'|'shell'|'shrimp'|'squid'|..., look: [색1, 색2], price } 를 달고 G.Cook.addPantry(inv, id, 개수)로 넣는다
  //  3) 더 특별한 저장 방식이면 G.Cook.addSource({ kind, label, list(inv) -> [{id,name,count,total,shape,look,elem,base}], take(inv,id,val), spec(id) -> {name,shape,look,base} | null })
  const SOURCES = [];
  const addSource = (src) => { SOURCES.push(src); };
  const addPantry = (inv, id, n = 1) => { inv.pantry = inv.pantry || {}; inv.pantry[id] = (inv.pantry[id] || 0) + n; };
  const shapeOfFish = (it) => (it.shape === 'eel' ? 'eel' : 'fish');
  const itemList = (pred) => Object.values(ITEMS).filter(pred);
  addSource({ kind: 'sea', label: '해산물', // 바다의 해산물 (원소 물고기 포함)
    list: (inv) => G.Sea.SEAFOOD.map((sp) => ({ id: sp.id, name: sp.name, count: (inv.sea || {})[sp.id] || 0, total: (inv.seaVal || {})[sp.id] || 0, shape: sp.shape, look: [sp.c1, sp.c2], elem: sp.elem, base: sp.value })),
    take: (inv, id, val) => { inv.sea[id] -= 1; inv.seaVal = inv.seaVal || {}; inv.seaVal[id] = Math.max(0, (inv.seaVal[id] || 0) - val); },
    spec: (id) => { const sp = G.Sea.BY_ID[id]; return sp ? { name: sp.name, shape: sp.shape, look: [sp.c1, sp.c2], base: sp.value } : null; } });
  addSource({ kind: 'fish', label: '물고기', // 연못 물고기 (ITEMS에 catch:'fish'인 것은 새로 생겨도 자동)
    list: (inv) => itemList((it) => it.catch === 'fish').map((it) => ({ id: it.id, name: it.name, count: (inv.fish || {})[it.id] || 0, total: (inv.catchVal || {})[it.id] || 0, shape: shapeOfFish(it), look: it.look, base: it.price })),
    take: (inv, id, val) => { inv.fish[id] -= 1; inv.catchVal = inv.catchVal || {}; inv.catchVal[id] = Math.max(0, (inv.catchVal[id] || 0) - val); },
    spec: (id) => { const it = ITEMS[id]; return it && it.catch === 'fish' ? { name: it.name, shape: shapeOfFish(it), look: it.look, base: it.price } : null; } });
  addSource({ kind: 'herb', label: '약재', // 약재 벌레 (원소)
    list: (inv) => itemList((it) => it.catch === 'bug' && it.herb).map((it) => ({ id: it.id, name: it.name, count: (inv.bugs || {})[it.id] || 0, total: (inv.catchVal || {})[it.id] || 0, shape: 'shrimp', look: it.look, elem: it.elem, base: it.price })),
    take: (inv, id, val) => { inv.bugs[id] -= 1; inv.catchVal = inv.catchVal || {}; inv.catchVal[id] = Math.max(0, (inv.catchVal[id] || 0) - val); },
    spec: (id) => { const it = ITEMS[id]; return it && it.catch === 'bug' && it.herb ? { name: it.name, shape: 'shrimp', look: it.look, base: it.price } : null; } });
  addSource({ kind: 'bug', label: '곤충', // 곤충 (먹을 수 있다고 치자)
    list: (inv) => itemList((it) => it.catch === 'bug' && !it.herb).map((it) => ({ id: it.id, name: it.name, count: (inv.bugs || {})[it.id] || 0, total: (inv.catchVal || {})[it.id] || 0, shape: 'shrimp', look: it.look, base: it.price })),
    take: (inv, id, val) => { inv.bugs[id] -= 1; inv.catchVal = inv.catchVal || {}; inv.catchVal[id] = Math.max(0, (inv.catchVal[id] || 0) - val); },
    spec: (id) => { const it = ITEMS[id]; return it && it.catch === 'bug' && !it.herb ? { name: it.name, shape: 'shrimp', look: it.look, base: it.price } : null; } });
  addSource({ kind: 'pantry', label: '식재료', // 앞으로 생길 먹거리: ITEMS에 edible:true 를 달면 자동으로 쓰인다
    list: (inv) => itemList((it) => it.edible).map((it) => ({ id: it.id, name: it.name, count: (inv.pantry || {})[it.id] || 0, total: (it.price || 100) * ((inv.pantry || {})[it.id] || 0), shape: it.shape || 'shell', look: it.look || ['#e0c080', '#8a6a3a'], elem: it.elem, base: it.price || 100 })),
    take: (inv, id) => { inv.pantry[id] -= 1; },
    spec: (id) => { const it = ITEMS[id]; return it && it.edible ? { name: it.name, shape: it.shape || 'shell', look: it.look || ['#e0c080', '#8a6a3a'], base: it.price || 100 } : null; } });

  // 재료 id -> {name, shape, look, base}
  function specOf(id) { for (const src of SOURCES) { const sp = src.spec(id); if (sp) return sp; } return null; }
  const baseValue = (id) => { const sp = specOf(id); return sp ? sp.base : 100; };

  // 가진 재료 목록 (먹을 수 있는 건 전부)
  const KIND_ORDER = {}; // 원천 등록 순서대로
  function ingredients(inv) {
    const out = [];
    SOURCES.forEach((src, si) => {
      KIND_ORDER[src.kind] = si;
      for (const e of src.list(inv)) if (e.count > 0) out.push({ id: e.id, name: e.name, count: e.count, val: Math.round((e.total || 0) / e.count) || e.base, shape: e.shape, look: e.look, kind: src.kind, label: src.label, elem: e.elem || null, src });
    });
    return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.val - a.val);
  }

  // 요리 항목을 만든다(이미 있으면 그대로). key = {m, main, g, n}
  function dishItem(key, mainSp) {
    const id = `cook_${key.m}_${key.main}_${key.g}_${key.n}`;
    if (ITEMS[id]) return ITEMS[id];
    const base = baseValue(key.main);
    const food = clamp(Math.round((0.5 + (base * (0.55 + 0.3 * key.n)) / 1400 + key.g * 0.08) * 2) / 2, 0.5, 6);
    const st = Math.round(clamp(20 + (base * (0.5 + 0.25 * key.n)) / 30 + key.g * 3, 20, 260));
    const nm = `${key.n >= 5 ? '대형 특선 ' : key.n >= 3 ? '특선 ' : ''}${GARNISH[key.g]}${mainSp.name} ${METHODS[key.m]}`;
    ITEMS[id] = { id, name: nm, price: Math.round(base * 0.6 * (0.8 + 0.2 * key.n)), consumable: true, food, stamina: st, look: mainSp.look, cookKey: Object.assign({ id, shape: mainSp.shape, look: mainSp.look }, key), desc: `직접 만든 요리 - 피 ${food}칸, 스태미나 ${st} 회복` };
    if (G.Shop.CONSUMABLE_IDS.indexOf(id) < 0) G.Shop.CONSUMABLE_IDS.push(id);
    if (G.Shop.DARK_CONS_IDS.indexOf(id) < 0) G.Shop.DARK_CONS_IDS.push(id);
    return ITEMS[id];
  }
  // 저장에서 불러올 때: 만든 요리 항목을 다시 등록한다
  function registerAll(inv) {
    for (const id of Object.keys(inv.cookbook || {})) {
      if (ITEMS[id]) continue;
      const k = inv.cookbook[id];
      const sp = specOf(k.main);
      if (sp) dishItem({ m: k.m, main: k.main, g: k.g, n: k.n }, sp);
    }
  }
  // 요리하기: picks = 재료 id 배열(1~3개, 같은 걸 여러 번 가능), m = 조리법. 결과 {ok, msg, item, first}
  function cook(inv, picks, m) {
    if (!picks.length) return { ok: false, msg: '재료를 하나 이상 넣어 주세요.' };
    const list = ingredients(inv);
    const byId = {}; list.forEach((x) => { byId[x.id] = x; });
    const need = {}; picks.forEach((id) => { need[id] = (need[id] || 0) + 1; });
    for (const id of Object.keys(need)) if (!byId[id] || byId[id].count < need[id]) return { ok: false, msg: '재료가 모자라요.' };
    const ing = picks.map((id) => byId[id]);
    const main = ing.reduce((a, b) => (b.val > a.val ? b : a), ing[0]);
    const others = ing.filter((x) => x !== main).map((x) => x.id).sort();
    const g = others.length ? 1 + (hashStr(others.join(',') + '|' + m) % 6) : 0;
    const item = dishItem({ m, main: main.id, g, n: picks.length }, main);
    // 재료를 쓴다 (값도 같이 줄인다)
    for (const x of ing) x.src.take(inv, x.id, x.val);
    inv.consumables[item.id] = (inv.consumables[item.id] || 0) + 1;
    inv.cookbook = inv.cookbook || {};
    const first = !inv.cookbook[item.id];
    inv.cookbook[item.id] = { m, main: main.id, g, n: picks.length };
    return { ok: true, item, first, msg: `${item.name} 완성!` };
  }

  // ---- 가스레인지 ----
  ITEMS.d_gas = { id: 'd_gas', name: '가스레인지', price: 2400, decor: true, place: 'floor' };
  G.Shop.SHOPS.decor.tabs.push({ name: '주방', items: [ITEMS.d_gas] });
  if (G.Home && G.Home.DRAW) {
    G.Home.DRAW.d_gas = (ctx, x, y, time) => {
      ctx.fillStyle = '#e8e4da'; ctx.fillRect(x - 36, y - 50, 72, 50);
      ctx.fillStyle = '#c8c2b4'; ctx.fillRect(x - 36, y - 50, 72, 6);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 32, y - 44, 64, 4); ctx.fillRect(x - 28, y - 34, 56, 26);
      ctx.fillStyle = '#9fd8f0'; ctx.fillRect(x - 24, y - 30, 48, 18);
      for (const dx of [-18, 18]) { ctx.fillStyle = '#5a6272'; ctx.beginPath(); ctx.arc(x + dx, y - 52, 8, 0, Math.PI * 2); ctx.fill(); const f = 0.7 + 0.3 * Math.sin((time || 0) * 12 + dx); ctx.fillStyle = `rgba(80,160,255,${0.9 * f})`; ctx.beginPath(); ctx.ellipse(x + dx, y - 56, 5, 4 * f, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#d02a2a'; ctx.fillRect(x - 24, y - 6, 8, 5); ctx.fillRect(x + 16, y - 6, 8, 5);
    };
  }

  // ---- 요리 그림: 요리마다 모양이 다르다 (조리법 + 재료 모양 + 곁들임 + 접시/색 조합, id로 정해진 무늬) ----
  const PLATES = ['#e8e4da', '#cfd8e8', '#f0d8c0', '#3a3a46', '#d8e8d0', '#e8d0d8'];
  function drawDish(ctx, k, time = 0) {
    const h = hashStr(k.id);
    const R = (i) => frand(h, i);
    const L = k.look || ['#e0a060', '#8a5a2a'];
    const plate = PLATES[Math.floor(R(1) * PLATES.length)];
    const fish = (x, y, sz, rot = 0, dark = false) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); G.Sea.drawCritter(ctx, { sp: { shape: k.shape, c1: dark ? '#6a4a2a' : L[0], c2: dark ? '#3a2a1a' : L[1], size: sz, zone: 0, elem: null, idx: 0 }, x: 0, y: 0, vx: 1, vy: 0, t: 0, size: 1 }, time); ctx.restore(); };
    const ell = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const steam = () => { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.quadraticCurveTo(x + 5, -14, x, -22); ctx.stroke(); } };
    const broth = ['#c8601a', '#e8a040', '#a83a2a', '#d8c880', '#7a4a2a'][Math.floor(R(2) * 5)];
    switch (k.m) {
      case 0: ell(0, 16, 30, 9, plate); ell(0, 15, 24, 6, 'rgba(0,0,0,0.12)'); fish(0, 6, 40, (R(3) - 0.5) * 0.4); ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 4, -2); ctx.lineTo(i * 9 + 4, 12); ctx.stroke(); } break; // 구이
      case 1: ell(0, 16, 30, 9, plate); fish(0, 7, 34); for (let i = 0; i < 7; i++) dot(-20 + R(4 + i) * 40, 2 + R(12 + i) * 14, 2.5 + R(20 + i) * 2, ['#e8b040', '#f0c860', '#c88a20'][i % 3]); break; // 튀김
      case 2: ctx.fillStyle = '#c8a060'; ctx.fillRect(-24, -6, 48, 20); ctx.fillStyle = '#a07a3a'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 9 - 1, -6, 2, 20); ell(0, -6, 24, 7, '#d8b878'); ctx.save(); ctx.beginPath(); ctx.rect(-24, -14, 48, 10); ctx.clip(); fish(0, -4, 26); ctx.restore(); ell(0, 14, 24, 5, '#8a6a3a'); steam(); break; // 찜
      case 3: ctx.fillStyle = '#3a3a46'; ctx.fillRect(-26, -2, 52, 20); ctx.fillRect(-32, 2, 6, 5); ctx.fillRect(26, 2, 6, 5); ell(0, -2, 26, 7, broth); fish(0, -3, 24, R(5) - 0.5); steam(); break; // 탕
      case 4: ell(0, 16, 30, 9, plate); ell(0, 12, 24, 8, '#4fae45'); for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(-14 + i * 9, 8); ctx.rotate(-0.4 + i * 0.1); ctx.fillStyle = i % 2 ? L[0] : '#ffe8e8'; ctx.fillRect(-5, -9, 10, 15); ctx.fillStyle = L[1]; ctx.fillRect(-5, 3, 10, 3); ctx.restore(); } dot(20, 6, 4, '#e8f0c0'); break; // 회
      case 5: ell(0, 16, 30, 9, plate); ell(0, 12, 25, 8, '#4a2a1a'); fish(0, 8, 30, 0, true); for (let i = 0; i < 6; i++) dot(-16 + R(30 + i) * 32, 8 + R(40 + i) * 8, 1.5, '#f4e8c0'); break; // 조림
      case 6: ell(0, 12, 28, 10, '#2a2a30'); ell(0, 10, 24, 8, '#4a3a2a'); ctx.fillStyle = '#2a2a30'; ctx.fillRect(26, 10, 14, 4); for (let i = 0; i < 8; i++) dot(-18 + R(50 + i) * 36, 5 + R(60 + i) * 10, 3 + R(70 + i) * 2, ['#d02a2a', '#4fae45', '#e8c030', L[0]][i % 4]); fish(0, 8, 22); break; // 볶음
      case 7: ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.moveTo(-26, -2); ctx.lineTo(26, -2); ctx.lineTo(18, 18); ctx.lineTo(-18, 18); ctx.closePath(); ctx.fill(); ell(0, -2, 26, 7, broth); for (let i = 0; i < 4; i++) dot(-14 + R(80 + i) * 28, -3 + R(90 + i) * 3, 4, ['#e07a3a', '#4fae45', '#e8d890', '#c83a3a'][i]); fish(0, -4, 20); break; // 스튜
      case 8: ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(26, -4); ctx.lineTo(16, 18); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill(); for (let i = 0; i < 6; i++) ell(-16 + i * 6.5, -6 + (i % 2) * 3, 8, 5, ['#4fae45', '#7ad07a', '#3a8a3a'][i % 3]); fish(4, -4, 18); dot(-12, -8, 4, '#d02a2a'); dot(14, -7, 3.5, '#f0e060'); break; // 샐러드
      case 9: ell(0, 18, 30, 6, 'rgba(0,0,0,0.12)'); for (let s = 0; s < 2; s++) { ctx.save(); ctx.translate(0, 8 + s * 8 - 4); ctx.rotate(-0.25); ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.stroke(); for (let i = 0; i < 4; i++) dot(-18 + i * 12, 0, 6, i % 2 ? L[0] : ['#4fae45', '#d02a2a', '#e8c030'][s]); ctx.restore(); } break; // 꼬치
      case 10: ctx.fillStyle = '#c0504d'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(18, 18); ctx.lineTo(-18, 18); ctx.closePath(); ctx.fill(); ell(0, 0, 26, 7, '#f4f4ee'); ctx.fillStyle = '#f4f4ee'; ctx.beginPath(); ctx.arc(0, 0, 22, Math.PI, 0); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 22, Math.PI, 0); ctx.clip(); fish(0, -6, 28); ctx.restore(); break; // 덮밥
      default: ell(0, 16, 30, 9, plate); ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, 6, 22 - i * 3, 9 - i * 1.4, 0, 0.4 * i, Math.PI * 1.7 + 0.3 * i); ctx.stroke(); } fish(0, 0, 20); dot(-8, 3, 3, '#d02a2a'); dot(9, 5, 3, '#d02a2a'); break; // 스파게티
    }
    if (k.g > 0) for (let i = 0; i < 3 + k.g % 3; i++) { const a = R(100 + i) * Math.PI * 2, d = 6 + R(110 + i) * 14; dot(Math.cos(a) * d, 4 + Math.sin(a) * d * 0.4, 2 + R(120 + i) * 2, GCOL[k.g]); } // 곁들임
    if (k.n >= 2) { dot(-26, 18, 3, '#4fae45'); dot(28, 17, 3, '#d02a2a'); }
    if (k.n >= 3) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 22, -14); ctx.fillText('★', -22, -14); }
    if (k.n >= 5) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 0, -22); ctx.fillText('★', 36, -4); ctx.fillText('★', -36, -4); }
  }

  // ---- 요리 창 ----
  function open(inv, slot) { return { slot, cur: 0, picks: [], m: 0, result: null, msg: '', t: 0 }; }
  const geometry = (W, H) => ({ x: 70, y: 40, w: W - 140, h: H - 80 });
  function draw(ctx, W, H, ui, inv) {
    const g = geometry(W, H);
    const list = ingredients(inv);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a2230'; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = '#ffa84a'; ctx.lineWidth = 4; ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#ffa84a'; ctx.fillText('가스레인지 요리', g.x + 24, g.y + 32);
    const total = Object.keys(inv.cookbook || {}).length;
    ctx.textAlign = 'right'; ctx.font = '14px sans-serif'; ctx.fillStyle = '#c8b8a0'; ctx.fillText(`만든 요리 종류 ${total}가지`, g.x + g.w - 24, g.y + 32);
    if (ui.result) { // 완성!
      const r = ui.result;
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = r.first ? '#ffd54a' : '#e8e0d0'; ctx.fillText(r.first ? '새로운 요리 완성!' : '요리 완성!', g.x + g.w / 2, g.y + 90);
      ctx.save(); ctx.translate(g.x + g.w / 2, g.y + 230); ctx.scale(4.2, 4.2); drawDish(ctx, r.item.cookKey, ui.t); ctx.restore();
      ctx.font = 'bold 28px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(r.item.name, g.x + g.w / 2, g.y + 360);
      ctx.font = '17px sans-serif'; ctx.fillStyle = '#b8e8b8'; ctx.fillText(`먹으면 피 ${r.item.food}칸, 스태미나 ${r.item.stamina} 회복  (가방에 ${(inv.consumables[r.item.id] || 0)}개 · V 키로 먹어요)`, g.x + g.w / 2, g.y + 396);
      ctx.font = '14px sans-serif'; ctx.fillStyle = '#9a8a78'; ctx.fillText('Enter: 계속', g.x + g.w / 2, g.y + g.h - 28);
      ctx.restore(); return;
    }
    // 왼쪽: 재료 목록
    const lx = g.x + 24, ly = g.y + 64, rowH = 34, rows = 10;
    ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText(`가진 재료 (${list.length}종)`, lx, ly);
    if (!list.length) { ctx.font = '16px sans-serif'; ctx.fillStyle = '#b8a890'; ctx.fillText('재료가 없어요. 바다·연못·숲에서 잡아 오세요!', lx, ly + 40); }
    const start = clamp(ui.cur - 4, 0, Math.max(0, list.length - rows));
    for (let i = 0; i < rows && start + i < list.length; i++) {
      const it = list[start + i], y = ly + 18 + i * rowH, sel = start + i === ui.cur;
      const used = ui.picks.filter((id) => id === it.id).length;
      ctx.fillStyle = sel ? 'rgba(255,168,74,0.25)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(lx, y, 360, rowH - 4);
      if (sel) { ctx.strokeStyle = '#ffa84a'; ctx.lineWidth = 2; ctx.strokeRect(lx, y, 360, rowH - 4); }
      ctx.save(); ctx.translate(lx + 22, y + 14); ctx.scale(0.55, 0.55); G.Sea.drawCritter(ctx, { sp: { shape: it.shape, c1: it.look[0], c2: it.look[1], size: 34, zone: 0, elem: null, idx: 0 }, x: 0, y: 0, vx: 1, vy: 0, t: 0, size: 1 }, ui.t); ctx.restore();
      ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(it.name, lx + 48, y + 13);
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#b8a890'; ctx.fillText(`${it.label}${it.elem ? ' · 원소' : ''}`, lx + 200, y + 13);
      ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = used ? '#7dffa0' : '#e8d8b8'; ctx.fillText(`x${it.count - used}${used ? ` (넣음 ${used})` : ''}`, lx + 352, y + 13); ctx.textAlign = 'left';
    }
    // 오른쪽: 냄비(재료 3칸), 조리법, 미리보기
    const rx = g.x + 430, ry = g.y + 64;
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText('냄비에 넣은 재료 (최대 5개)', rx, ry);
    for (let i = 0; i < 5; i++) {
      const x = rx + i * 78, y = ry + 14, id = ui.picks[i];
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, 72, 70); ctx.strokeStyle = id ? '#7dffa0' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 72, 70);
      if (id) { const it = list.find((q) => q.id === id) || { name: id, shape: 'fish', look: ['#aaa', '#666'] }; ctx.save(); ctx.translate(x + 36, y + 28); ctx.scale(0.6, 0.6); G.Sea.drawCritter(ctx, { sp: { shape: it.shape, c1: it.look[0], c2: it.look[1], size: 38, zone: 0, elem: null, idx: 0 }, x: 0, y: 0, vx: 1, vy: 0, t: 0, size: 1 }, ui.t); ctx.restore(); ctx.textAlign = 'center'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(it.name.length > 6 ? it.name.slice(0, 6) + '…' : it.name, x + 36, y + 60); ctx.textAlign = 'left'; }
    }
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText(`조리법: ← ${METHODS[ui.m]} →`, rx, ry + 112);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#9a8a78'; ctx.fillText(METHODS.map((m, i) => (i === ui.m ? `[${m}]` : m)).join(' '), rx, ry + 134);
    // 미리보기
    const ing = ui.picks.map((id) => list.find((q) => q.id === id)).filter(Boolean);
    ctx.save(); ctx.translate(rx + 80, ry + 230); ctx.scale(2.6, 2.6);
    if (ing.length) { const main = ing.reduce((a, b) => (b.val > a.val ? b : a), ing[0]); const others = ing.filter((x) => x !== main).map((x) => x.id).sort(); const gi = others.length ? 1 + (hashStr(others.join(',') + '|' + ui.m) % 6) : 0; const id = `cook_${ui.m}_${main.id}_${gi}_${ui.picks.length}`; drawDish(ctx, { id, m: ui.m, shape: main.shape, look: main.look, g: gi, n: ui.picks.length }, ui.t); } else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 6); }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#c8b8a0';
    ['좋은 재료일수록', '더 맛있어요!', '곁들임은 나머지', '재료로 정해져요', '재료·조리법·곁들임', '조합은 수천 가지!'].forEach((t, i) => ctx.fillText(t, rx + 200, ry + 190 + i * 20));
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = ui.msg ? '#ffb0a0' : 'rgba(0,0,0,0)'; ctx.fillText(ui.msg || ' ', rx, g.y + g.h - 70);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#9a8a78'; ctx.textAlign = 'center';
    ctx.fillText('↑↓ 재료 고르기 · Enter 넣기 · Backspace 빼기 · ←→ 조리법 · C 요리하기 · X 가스레인지 치우기 · Esc 닫기', g.x + g.w / 2, g.y + g.h - 28);
    ctx.restore();
  }

  G.Cook = { addSource, addPantry, SOURCES, specOf, METHODS, ingredients, cook, registerAll, drawDish, open, draw, hashStr };
})(window.Game);
