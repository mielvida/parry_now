// 집 요리: 가구 가게에서 산 가스레인지를 집에 놓고, 잡은 물고기·해산물·곤충·약재(먹을 수 있는 건 전부)를 최대 5개 골라
// 조리법(12가지)을 정해 요리하면 요리 하나가 완성된다. (재료 종류 x 조리법 x 곁들임 x 재료 수 = 경우의 수가 수천 가지, 요리마다 그림이 다르다)
//  조작: ↑↓ 재료 고르기 · Enter 재료 넣기 · Backspace 빼기 · ←→ 조리법 · C 요리하기 · X 가스레인지 치우기 · Esc 닫기
(function (G) {
  const ITEMS = G.Shop.ITEMS;
  const METHODS = ['구이', '튀김', '찜', '탕', '회', '조림', '볶음', '스튜', '샐러드', '꼬치', '덮밥', '스파게티'];
  // 조리법마다 이름 꼴 3가지 (모두 다른 낱말이라 요리 이름이 겹치지 않는다)
  const METHOD_NAMES = [['구이', '숯불구이', '소금구이'], ['튀김', '바삭튀김', '황금튀김'], ['찜', '맑은찜', '매운찜'], ['탕', '매운탕', '맑은탕'], ['회', '생선회', '한입회'], ['조림', '간장조림', '매콤조림'], ['볶음', '센불볶음', '양념볶음'], ['스튜', '토마토스튜', '크림스튜'], ['샐러드', '무침', '냉채'], ['꼬치', '꼬치구이', '꼬치튀김'], ['덮밥', '솥밥', '비빔밥'], ['스파게티', '국수', '볶음국수']];

  // ---- 주방 기구: 기구마다 쓸 수 있는 조리법이 다르다 (가스레인지 12가지 + 오븐·훈제기·찜통·가마솥·그릴·화덕·초밥대) ----
  METHODS.push('오븐구이', '그라탱', '파이', '빵', '훈제', '건조', '염장', '만두', '딤섬', '어묵', '국밥', '전골', '죽', '카레', '바비큐', '철판구이', '스테이크', '피자', '칼초네', '플랫브레드', '초밥', '김밥', '주먹밥', '롤');
  METHOD_NAMES.push(['오븐구이', '허브구이', '통구이'], ['그라탱', '치즈그라탱', '크림그라탱'], ['파이', '생선파이', '한입파이'], ['빵', '샌드위치', '속빵'],
    ['훈제', '연기훈제', '통훈제'], ['건조', '말림', '바삭말림'], ['염장', '소금절임', '젓갈'],
    ['만두', '군만두', '물만두'], ['딤섬', '새우딤섬', '한입딤섬'], ['어묵', '꼬치어묵', '튀김어묵'],
    ['국밥', '뚝배기국밥', '얼큰국밥'], ['전골', '버섯전골', '얼큰전골'], ['죽', '단호박죽', '야채죽'], ['카레', '매운카레', '순한카레'],
    ['바비큐', '숯불바비큐', '통바비큐'], ['철판구이', '철판볶음', '철판요리'], ['스테이크', '버터스테이크', '통스테이크'],
    ['피자', '치즈피자', '화덕피자'], ['칼초네', '통칼초네', '치즈칼초네'], ['플랫브레드', '납작빵', '화덕빵'],
    ['초밥', '생초밥', '한입초밥'], ['김밥', '꼬마김밥', '통김밥'], ['주먹밥', '삼각주먹밥', '한입주먹밥'], ['롤', '말이롤', '크런치롤']);
  const rng = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
  const APPS = { // 기구 id -> 이름, 쓸 수 있는 조리법(번호), 값
    d_gas: { name: '가스레인지', ms: rng(0, 11).filter((m) => m !== 10), price: 2400 }, // 10번(덮밥)은 뺐다 (예전에 만든 덮밥 요리는 그대로 남는다)
    d_oven: { name: '오븐', ms: rng(12, 15), price: 3200 },
    d_smoker: { name: '훈제기', ms: rng(16, 18), price: 3000 },
    d_steamer: { name: '찜통', ms: rng(19, 21), price: 2800 },
    d_cauldron: { name: '가마솥', ms: rng(22, 25), price: 3600 },
    d_grill: { name: '그릴', ms: rng(26, 28), price: 3000 },
    d_pizza: { name: '화덕', ms: rng(29, 31), price: 4200 },
    d_sushi: { name: '초밥대', ms: rng(32, 35), price: 2600 },
  };
  // 새 조리법마다 한 가지씩 특별한 효과가 더 붙는다 (같은 재료여도 기구에 따라 능력이 달라진다)
  const METHOD_BIAS = { 12: 'power', 13: 'shield', 14: 'coin', 15: 'stamina', 16: 'oxygen', 17: 'speed', 18: 'invuln', 19: 'regen', 20: 'coin', 21: 'swim', 22: 'regen', 23: 'power', 24: 'stamina', 25: 'crit', 26: 'power', 27: 'crit', 28: 'power', 29: 'coin', 30: 'shield', 31: 'speed', 32: 'swim', 33: 'stamina', 34: 'light', 35: 'crit' };
  const placedIds = (inv) => { const out = []; for (const h of [inv.home].concat(Object.values(inv.homes || {}))) if (h && h.placed) out.push(...(h.placed.floor || []), ...(h.placed.wall || []), ...(h.placed.top || [])); return out; };
  const COUNT_NAME = ['', '모둠 ', '특선 ', '왕실 ', '대형 특선 ']; // 재료 수 1~5
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

  // ---- 요리 효과: 먹으면 한동안 능력이 오른다. 요리마다 효과가 다르다 (같거나 비슷한 것도 있다) ----
  const EFFECTS = [
    { k: 'speed', name: '달리기 속도', mag: (q) => Math.round((0.08 + 0.3 * q) * 100) / 100, fmt: (v) => `+${Math.round(v * 100)}%` },
    { k: 'power', name: '공격력', mag: (q) => Math.round(1 + 11 * q), fmt: (v) => `+${v}` },
    { k: 'crit', name: '치명타 확률', mag: (q) => Math.round((0.04 + 0.2 * q) * 100) / 100, fmt: (v) => `+${Math.round(v * 100)}%` },
    { k: 'coin', name: '코인 획득', mag: (q) => Math.round((0.1 + 0.5 * q) * 100) / 100, fmt: (v) => `+${Math.round(v * 100)}%` },
    { k: 'invuln', name: '피격 후 무적', mag: (q) => Math.round((0.15 + 0.6 * q) * 10) / 10, fmt: (v) => `+${v}초` },
    { k: 'regen', name: '재생', mag: () => 1, fmt: () => '5초마다 피 ½칸' },
    { k: 'shield', name: '보호막', mag: () => 1, n: (q) => Math.round(1 + 4 * q), fmt: (v, n) => `${n}번 막아 준다` },
    { k: 'stamina', name: '스태미나 회복', mag: (q) => Math.round((0.4 + 1.6 * q) * 100) / 100, fmt: (v) => `+${Math.round(v * 100)}%` },
    { k: 'oxygen', name: '산소 (잠수)', mag: (q) => Math.round(10 + 50 * q), fmt: (v) => `+${v}초` },
    { k: 'swim', name: '헤엄 속도', mag: (q) => Math.round(15 + 75 * q), fmt: (v) => `+${v}` },
    { k: 'light', name: '랜턴 밝기 (잠수)', mag: (q) => Math.round(1 + 2 * q), fmt: (v) => `+${v}단계` },
  ];
  const EFF = {}; EFFECTS.forEach((e) => { EFF[e.k] = e; });
  const BY_ELEM = { fire: 'power', ice: 'shield', poison: 'crit', quake: 'invuln', light: 'speed', shadow: 'oxygen' }; // 원소 재료의 효과
  const BY_SHAPE = { fish: 'speed', eel: 'swim', crab: 'invuln', shell: 'coin', squid: 'crit', octo: 'stamina', jelly: 'regen', star: 'light', urchin: 'shield', shrimp: 'stamina', ray: 'swim', seahorse: 'oxygen', turtle: 'regen', whale: 'power', shark: 'power', angler: 'light', flat: 'coin', cat: 'invuln' };
  const elemOf = (id) => { const s2 = G.Sea.BY_ID[id]; if (s2) return s2.elem || null; const it = ITEMS[id]; return it && it.elem ? it.elem : null; };
  function effectsFor(key, base, shape) {
    const h = hashStr(`${key.m}|${key.main}|${key.g}|${key.n}`);
    const bias = METHOD_BIAS[key.m];
    const count = Math.max(key.n >= 5 ? 3 : key.n >= 3 ? 2 : 1, bias ? 2 : 1);
    const order = [];
    const el = elemOf(key.main);
    const first = (el && BY_ELEM[el]) || BY_SHAPE[shape] || EFFECTS[h % EFFECTS.length].k;
    order.push(first);
    if (bias && bias !== first) order.push(bias);
    for (let i = 0; order.length < count && i < 40; i++) { const k = EFFECTS[(h >>> (3 + i)) % EFFECTS.length].k; if (!order.includes(k)) order.push(k); }
    const q = clamp(base / 2500, 0.15, 1) * clamp(0.7 + 0.1 * key.n, 0.8, 1.2);
    const dur = Math.round(clamp(60 + base / 80 + 15 * key.n, 60, 300));
    return order.map((k) => { const e = EFF[k]; return { kind: k, val: e.mag(Math.min(1, q)), n: e.n ? e.n(Math.min(1, q)) : 0, dur }; });
  }
  const effText = (list) => list.map((b) => `${EFF[b.kind].name} ${EFF[b.kind].fmt(b.val, b.n)} (${b.dur}초)`).join(' / ');

  // 요리 항목을 만든다(이미 있으면 그대로). key = {m, main, g, n}
  function dishItem(key, mainSp) {
    const id = `cook_${key.m}_${key.main}_${key.g}_${key.n}`;
    if (ITEMS[id]) return ITEMS[id];
    const base = baseValue(key.main);
    const food = clamp(Math.round((0.5 + (base * (0.55 + 0.3 * key.n)) / 1000 + key.g * 0.08) * (key.m >= 12 ? 1.15 : 1) * 2) / 2, 0.5, 10); // 희귀한 재료일수록 많이 채운다 (최대 피 10칸)
    const st = Math.round(clamp(20 + (base * (0.5 + 0.25 * key.n)) / 30 + key.g * 3, 20, 260));
    const variant = hashStr(`${key.main}|${key.g}|${key.n}`) % 3; // 같은 재료여도 조리법 이름이 가지가지
    const nm = `${COUNT_NAME[key.n - 1] || ''}${GARNISH[key.g]}${mainSp.name} ${METHOD_NAMES[key.m][variant]}`; // 재료 수 x 곁들임 x 재료 x 조리법이 모두 달라 이름이 겹치지 않는다
    const buffs = effectsFor(key, base, mainSp.shape);
    const blueShape = ['jelly', 'turtle', 'whale', 'seahorse'].includes(mainSp.shape) || elemOf(key.main) === 'ice'; // 해파리·거북·고래·해마·얼음 재료는 파란 피를 채운다
    const blue = blueShape ? Math.round(clamp(food * 0.4, 0.5, 5) * 2) / 2 : 0;
    ITEMS[id] = { id, name: nm, blue, price: Math.round(base * 0.6 * (0.8 + 0.2 * key.n)), consumable: true, food, stamina: st, buffs, look: mainSp.look, cookKey: Object.assign({ id, shape: mainSp.shape, look: mainSp.look }, key), desc: `직접 만든 요리 - 피 ${food}칸${blue ? `, 파란 피 ${blue}칸` : ''}, 스태미나 ${st} 회복 · 효과: ${effText(buffs)}` };
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
  // 재료 항목들 -> 요리 하나 (cook과 요리사가 함께 쓴다). entries = [{id, name, val, shape, look}]
  function makeDish(inv, entries, m) {
    const main = entries.reduce((a, b) => (b.val > a.val ? b : a), entries[0]);
    const others = entries.filter((x) => x !== main).map((x) => x.id).sort();
    const g = others.length ? 1 + (hashStr(others.join(',') + '|' + m) % 6) : 0;
    const item = dishItem({ m, main: main.id, g, n: entries.length }, main);
    inv.cookbook = inv.cookbook || {};
    const first = !inv.cookbook[item.id];
    inv.cookbook[item.id] = { m, main: main.id, g, n: entries.length };
    return { item, first };
  }
  // 요리하기: picks = 재료 id 배열(1~5개, 같은 걸 여러 번 가능), m = 조리법. 결과 {ok, msg, item, first}
  function cook(inv, picks, m) {
    if (!picks.length) return { ok: false, msg: '재료를 하나 이상 넣어 주세요.' };
    if (picks.length > 5) return { ok: false, msg: '재료는 최대 5개예요.' };
    const list = ingredients(inv);
    const byId = {}; list.forEach((x) => { byId[x.id] = x; });
    const need = {}; picks.forEach((id) => { need[id] = (need[id] || 0) + 1; });
    for (const id of Object.keys(need)) if (!byId[id] || byId[id].count < need[id]) return { ok: false, msg: '재료가 모자라요.' };
    const ing = picks.map((id) => byId[id]);
    const r = makeDish(inv, ing, m);
    for (const x of ing) x.src.take(inv, x.id, x.val); // 재료를 쓴다 (값도 같이 줄인다)
    inv.consumables[r.item.id] = (inv.consumables[r.item.id] || 0) + 1;
    return { ok: true, item: r.item, first: r.first, msg: `${r.item.name} 완성!` };
  }

  // ---- 요리사: 고용해서 재료를 맡겨 두면 알아서 요리해 쌓아 둔다 (집에 돌아오면 만든 만큼 받는다) ----
  //  처음엔 2분에 1개, 업그레이드할 때마다 10초씩 빨라져 최대 30초까지. 맡긴 재료가 떨어지면 멈춘다
  const CHEF_BASE = 120, CHEF_STEP = 10, CHEF_MAX = 9, CHEF_HIRE = 5000, CHEF_N_MAX = 8; // 여러 명을 고용할 수 있고, 한 명 늘 때마다 고용비가 2배
  const chefOf = (inv) => {
    const c = inv.chef || (inv.chef = { hired: false, lv: 0, last: 0, m: 0, rnd: true, k: 3, stock: {}, out: {} });
    if (c.rnd === undefined) { c.rnd = c.m >= 12; if (c.rnd) c.m = 0; } // 예전 저장: 12 = 알아서
    if (c.n === undefined) c.n = c.hired ? 1 : 0; // 예전 저장: 한 명
    return c;
  };
  function chefMethods(inv) { // 요리사가 쓸 수 있는 조리법: 가스레인지 기본 + 집에 놓은 기구들
    const ids = placedIds(inv), out = APPS.d_gas.ms.slice();
    for (const id of Object.keys(APPS)) if (id !== 'd_gas' && ids.includes(id)) out.push(...APPS[id].ms);
    return out;
  }
  function chefNextMethod(inv) { // 알아서 -> 조리법들 -> 알아서
    const c = chefOf(inv), ms = chefMethods(inv);
    if (c.rnd) { c.rnd = false; c.m = ms[0]; return; }
    const i = ms.indexOf(c.m);
    if (i < 0 || i === ms.length - 1) c.rnd = true; else c.m = ms[i + 1];
  }
  const chefHireCost = (inv) => CHEF_HIRE * Math.pow(2, chefOf(inv).n); // 첫째 5000, 둘째 10000, 셋째 20000 ...
  function chefHire(inv) { const c = chefOf(inv); c.n += 1; if (!c.hired) { c.hired = true; c.last = Date.now(); } return c.n; }
  const chefInterval = (inv) => CHEF_BASE - CHEF_STEP * chefOf(inv).lv; // 초
  const chefUpCost = (inv) => Math.round((2500 * Math.pow(1.6, chefOf(inv).lv)) / 10) * 10;
  const chefStockUnits = (inv) => Object.values(chefOf(inv).stock).reduce((a, b) => a + b, 0);
  const chefPending = (inv) => Object.values(chefOf(inv).out).reduce((a, b) => a + b, 0);
  function chefDeposit(inv, ing, n) { // 내 재료를 요리사에게 맡긴다
    const c = chefOf(inv);
    const k = Math.min(n, ing.count);
    for (let i = 0; i < k; i++) ing.src.take(inv, ing.id, ing.val);
    c.stock[ing.id] = (c.stock[ing.id] || 0) + k;
    if (c.hired && !c.last) c.last = Date.now();
    return k;
  }
  function chefProduce(inv, now = Date.now()) { // 흐른 시간만큼 요리를 만든다. 만든 개수를 돌려준다
    const c = chefOf(inv);
    if (!c.hired) return 0;
    const iv = chefInterval(inv) * 1000;
    if (!c.last) c.last = now;
    let made = 0;
    while (now - c.last >= iv && chefStockUnits(inv) > 0) {
     for (let q = 0; q < Math.max(1, c.n) && chefStockUnits(inv) > 0; q++) { // 요리사 한 명이 한 번에 하나씩
      const ids = [];
      for (const id of Object.keys(c.stock)) for (let i = 0; i < c.stock[id]; i++) ids.push(id);
      const k = Math.min(Math.max(1, c.k), ids.length);
      const picks = [];
      for (let i = 0; i < k; i++) picks.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
      const entries = [];
      for (const id of picks) { const sp = specOf(id); if (!sp) continue; entries.push({ id, name: sp.name, shape: sp.shape, look: sp.look, val: sp.base }); c.stock[id] -= 1; if (c.stock[id] <= 0) delete c.stock[id]; }
      if (!entries.length) break;
      const ms = chefMethods(inv);
      const m = c.rnd || !ms.includes(c.m) ? ms[Math.floor(Math.random() * ms.length)] : c.m;
      const r = makeDish(inv, entries, m);
      c.out[r.item.id] = (c.out[r.item.id] || 0) + 1;
      made++;
     }
      c.last += iv;
    }
    if (chefStockUnits(inv) <= 0) c.last = now; // 재료가 없는 동안은 시간이 쌓이지 않는다
    return made;
  }
  function chefCollect(inv) { // 만들어 둔 요리를 가방으로. {n, names}
    const c = chefOf(inv);
    let n = 0; const names = [];
    for (const id of Object.keys(c.out)) { const cnt = c.out[id]; if (!cnt) continue; inv.consumables[id] = (inv.consumables[id] || 0) + cnt; n += cnt; if (names.length < 3 && ITEMS[id]) names.push(`${ITEMS[id].name} x${cnt}`); }
    c.out = {};
    return { n, names };
  }
  function chefNextSec(inv) { const c = chefOf(inv); if (!c.hired || chefStockUnits(inv) <= 0) return null; return Math.max(0, Math.ceil((c.last + chefInterval(inv) * 1000 - Date.now()) / 1000)); }


  // ---- 집 안의 요리사들: 기구 옆에서 요리한다. 선반 위의 기구라면 선반 위에 올라가서 요리한다 ----
  const CHEF_SIDE = [46, -46, 74, -74, 100, -100, 126, -126]; // 바닥 기구 옆 자리
  const CHEF_TOP = [30, -30, 0, 0, 0, 0, 0, 0]; // 선반 위 자리 (선반 판자는 폭 80)
  function chefSpots(inv, slots, ground) { // 요리사 n명이 서 있을 자리 [{x, y, face, onTop}]
    const c = chefOf(inv);
    if (!c.hired || c.n <= 0) return [];
    const pl = (inv.home && inv.home.placed) || {};
    const apps = (slots || []).filter((s) => APPS[(pl[s.kind] || [])[s.index]]);
    const used = {}, out = [];
    for (let i = 0; i < c.n; i++) {
      if (!apps.length) { out.push({ x: (slots && slots[0] ? slots[0].x : 400) - 90 - i * 34, y: ground, face: 1, onTop: false }); continue; }
      const s = apps[i % apps.length], k = used[s.index + s.kind] = (used[s.index + s.kind] || 0);
      used[s.index + s.kind] += 1;
      const top = s.kind === 'top';
      const off = top ? CHEF_TOP[k] : CHEF_SIDE[k];
      out.push({ x: s.x + off, y: s.y, face: off > 0 ? -1 : off < 0 ? 1 : 1, onTop: top });
    }
    return out;
  }
  function drawChef(ctx, x, y, t, working, face, seed = 0) { // 발 위치 (x, y)
    const bob = working ? Math.sin(t * 8 + seed) * 1.5 : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(face || 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a46'; ctx.fillRect(-6, -8, 5, 8); ctx.fillRect(1, -8, 5, 8); // 다리
    ctx.fillStyle = '#f4f4f0'; ctx.fillRect(-8, -26 + bob * 0.3, 16, 19); // 흰 옷
    ctx.fillStyle = '#d8d8d0'; ctx.fillRect(-1, -26 + bob * 0.3, 2, 19);
    ctx.fillStyle = '#c8603a'; ctx.fillRect(-6, -14, 12, 8); // 앞치마
    ctx.fillStyle = '#f2c8a0'; ctx.fillRect(-6, -36 + bob * 0.3, 12, 10); // 얼굴
    ctx.fillStyle = '#222'; ctx.fillRect(1, -32 + bob * 0.3, 2, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-7, -46 + bob * 0.3, 14, 8); ctx.fillRect(-5, -50 + bob * 0.3, 10, 5); // 요리사 모자
    const a = working ? Math.sin(t * 9 + seed) * 0.6 : -0.1; // 팔: 요리할 때는 휘젓는다
    ctx.save(); ctx.translate(6, -22); ctx.rotate(-0.9 + a); ctx.fillStyle = '#f4f4f0'; ctx.fillRect(0, -2, 12, 4); ctx.fillStyle = '#f2c8a0'; ctx.fillRect(11, -2, 3, 4);
    if (working) { ctx.fillStyle = '#a07a3a'; ctx.fillRect(13, -1, 8, 2); } // 국자
    ctx.restore();
    ctx.restore();
    if (working) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; const o = Math.sin(t * 3 + seed) * 2; ctx.beginPath(); ctx.moveTo(x + 10 * (face || 1) + o, y - 38); ctx.quadraticCurveTo(x + 12 * (face || 1), y - 44, x + 10 * (face || 1) - o, y - 50); ctx.stroke(); ctx.restore(); }
  }

  // ---- 가스레인지 ----
  ITEMS.d_gas = { id: 'd_gas', name: '가스레인지', price: 2400, decor: true, place: 'floor' };
  for (const id of Object.keys(APPS)) if (id !== 'd_gas') ITEMS[id] = { id, name: APPS[id].name, price: APPS[id].price, decor: true, place: 'floor' };
  G.Shop.SHOPS.decor.tabs.push({ name: '주방', items: Object.keys(APPS).map((id) => ITEMS[id]) });
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

  // 기구 그림 (집에 놓은 모습)
  if (G.Home && G.Home.DRAW) {
    const flame = (ctx, x, y, t, k = 0) => { const f = 0.7 + 0.3 * Math.sin((t || 0) * 12 + k); ctx.fillStyle = `rgba(255,150,40,${0.9 * f})`; ctx.beginPath(); ctx.ellipse(x, y, 5, 7 * f, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255,230,120,${0.9 * f})`; ctx.beginPath(); ctx.ellipse(x, y + 2, 2.5, 4 * f, 0, 0, Math.PI * 2); ctx.fill(); };
    const smoke = (ctx, x, y, t) => { ctx.strokeStyle = 'rgba(210,210,220,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { const o = Math.sin((t || 0) * 2 + i * 3) * 3; ctx.beginPath(); ctx.moveTo(x + i * 8, y); ctx.quadraticCurveTo(x + i * 8 + o + 4, y - 8, x + i * 8 - o, y - 16); ctx.stroke(); } };
    G.Home.DRAW.d_oven = (ctx, x, y, t) => { ctx.fillStyle = '#4a4e5a'; ctx.fillRect(x - 36, y - 52, 72, 52); ctx.fillStyle = '#6a6e7a'; ctx.fillRect(x - 36, y - 52, 72, 8); ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 28, y - 40, 56, 32); const g = 0.5 + 0.2 * Math.sin((t || 0) * 3); ctx.fillStyle = `rgba(255,150,50,${g})`; ctx.fillRect(x - 24, y - 36, 48, 24); ctx.fillStyle = '#d8d8e0'; ctx.fillRect(x - 28, y - 46, 56, 3); for (const dx of [-24, -12, 0, 12, 24]) { ctx.fillStyle = '#c8c8d0'; ctx.beginPath(); ctx.arc(x + dx, y - 48, 2, 0, Math.PI * 2); ctx.fill(); } };
    G.Home.DRAW.d_smoker = (ctx, x, y, t) => { ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 24, y - 64, 48, 64); ctx.fillStyle = '#3a2414'; ctx.fillRect(x - 24, y - 64, 48, 6); ctx.fillRect(x - 20, y - 40, 40, 2); ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x - 18, y - 52, 36, 34); ctx.fillStyle = '#9a6a3a'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 12 + i * 10, y - 48, 4, 14); ctx.fillStyle = '#4a4e5a'; ctx.fillRect(x - 6, y - 74, 12, 10); smoke(ctx, x - 4, y - 76, t); };
    G.Home.DRAW.d_steamer = (ctx, x, y, t) => { for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#d8b070' : '#c8a060'; ctx.fillRect(x - 28 + i, y - 14 * (i + 1), 56 - i * 2, 14); ctx.fillStyle = '#8a6a30'; ctx.fillRect(x - 28 + i, y - 14 * (i + 1) + 6, 56 - i * 2, 2); } ctx.fillStyle = '#e8c880'; ctx.beginPath(); ctx.moveTo(x - 28, y - 42); ctx.quadraticCurveTo(x, y - 62, x + 28, y - 42); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6a4a20'; ctx.beginPath(); ctx.arc(x, y - 56, 3, 0, Math.PI * 2); ctx.fill(); smoke(ctx, x - 6, y - 60, t); };
    G.Home.DRAW.d_cauldron = (ctx, x, y, t) => { ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 30, y - 8, 60, 8); ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.ellipse(x, y - 24, 32, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c8601a'; ctx.beginPath(); ctx.ellipse(x, y - 36, 26, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a3a42'; ctx.fillRect(x - 36, y - 38, 6, 5); ctx.fillRect(x + 30, y - 38, 6, 5); for (const dx of [-16, 0, 16]) flame(ctx, x + dx, y - 6, t, dx); smoke(ctx, x - 6, y - 44, t); };
    G.Home.DRAW.d_grill = (ctx, x, y, t) => { ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.ellipse(x, y - 34, 30, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4a4e5a'; ctx.fillRect(x - 28, y - 36, 56, 14); ctx.strokeStyle = '#9aa0b0'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y - 40); ctx.lineTo(x + i * 8, y - 34); ctx.stroke(); } ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 22, y - 22, 4, 22); ctx.fillRect(x + 18, y - 22, 4, 22); for (const dx of [-14, 0, 14]) flame(ctx, x + dx, y - 30, t, dx); smoke(ctx, x - 6, y - 50, t); };
    G.Home.DRAW.d_pizza = (ctx, x, y, t) => { ctx.fillStyle = '#9a5a3a'; ctx.beginPath(); ctx.moveTo(x - 36, y); ctx.lineTo(x - 36, y - 30); ctx.quadraticCurveTo(x, y - 74, x + 36, y - 30); ctx.lineTo(x + 36, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#7a4024'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 34 + (i % 3) * 24, y - 6 - i * 4, 10, 3); ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 18, y - 22); ctx.quadraticCurveTo(x, y - 40, x + 18, y - 22); ctx.lineTo(x + 18, y); ctx.closePath(); ctx.fill(); flame(ctx, x - 6, y - 8, t, 1); flame(ctx, x + 6, y - 6, t, 2); smoke(ctx, x - 4, y - 64, t); };
    G.Home.DRAW.d_sushi = (ctx, x, y) => { ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 36, y - 28, 72, 28); ctx.fillStyle = '#a8743a'; ctx.fillRect(x - 36, y - 32, 72, 6); ctx.fillStyle = '#c8e0e8'; ctx.fillRect(x - 28, y - 22, 56, 14); ctx.fillStyle = '#e8f4f8'; for (let i = 0; i < 3; i++) { ctx.fillRect(x - 24 + i * 18, y - 20, 14, 6); } ctx.fillStyle = '#f8f8f4'; ctx.beginPath(); ctx.ellipse(x - 14, y - 38, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff9a6a'; ctx.beginPath(); ctx.ellipse(x - 14, y - 41, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f8f8f4'; ctx.beginPath(); ctx.ellipse(x + 12, y - 38, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8d070'; ctx.beginPath(); ctx.ellipse(x + 12, y - 41, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill(); };
  }

  // ---- 요리 그림: 요리마다 모양이 다르다 (조리법 + 재료 모양 + 곁들임 + 접시/색 조합, id로 정해진 무늬) ----
  const PLATES = ['#e8e4da', '#cfd8e8', '#f0d8c0', '#3a3a46', '#d8e8d0', '#e8d0d8'];
  function drawDish(ctx, k, time = 0) {
    const h = hashStr(k.id);
    const R = (i) => frand(h, i);
    const L = k.look || ['#e0a060', '#8a5a2a'];
    const plate = PLATES[Math.floor(R(1) * PLATES.length)];
    const mixc = (a, b, t) => { const q = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const v = parseInt(m ? m[1] : '888888', 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }; const A = q(a), B = q(b); return `rgb(${A.map((x, j) => Math.round(x + (B[j] - x) * t)).join(',')})`; };
    const MODE = () => ([4, 32, 8].includes(k.m) ? 'raw' : k.m === 1 ? 'fry' : [0, 9, 12, 16, 17, 26, 27, 28].includes(k.m) ? 'grill' : [2, 19, 20, 21].includes(k.m) ? 'steam' : 'stew');
    // 조리된 재료 한 덩어리: 재료 모양(물고기·게·조개·새우·오징어·문어·해파리·성게 ...)마다 먹는 모습이 다르고, 조리 방식(회·튀김·구이·찜·끓임)에 따라 색과 겉모습이 다르다
    const fish = (x, y, sz, rot = 0, dark = false) => {
      const mode = MODE(), A = L[0], B = L[1];
      const body = dark ? mixc(A, '#2a1808', 0.72) : mode === 'raw' ? mixc(A, '#ffffff', 0.3) : mode === 'fry' ? mixc(A, '#e0a030', 0.62) : mode === 'grill' ? mixc(A, '#8a4a1a', 0.5) : mode === 'steam' ? mixc(A, '#f4ecd8', 0.5) : mixc(A, '#a06030', 0.32);
      const edge = dark ? '#1a0e04' : mixc(B, '#3a2010', 0.45);
      const light = mixc(body, '#ffffff', 0.35);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sz / 40, sz / 40);
      ctx.lineWidth = 2; ctx.strokeStyle = edge;
      const fillStroke = () => { ctx.fill(); ctx.stroke(); };
      const sh = k.shape;
      if (sh === 'crab') { // 게: 둥근 등딱지, 집게, 다리
        ctx.strokeStyle = edge; ctx.lineWidth = 2.5; for (let j = -1; j <= 1; j += 2) for (let q2 = 0; q2 < 3; q2++) { ctx.beginPath(); ctx.moveTo(j * 10, 2 + q2 * 3); ctx.lineTo(j * 20, 6 + q2 * 5); ctx.stroke(); }
        ctx.fillStyle = mixc(body, '#d03a2a', mode === 'raw' ? 0.2 : 0.55); for (const j of [-1, 1]) { ctx.beginPath(); ctx.arc(j * 17, -9, 6, 0.4, Math.PI * 1.6); ctx.lineTo(j * 12, -6); fillStroke(); }
        ctx.fillStyle = mixc(body, '#d03a2a', mode === 'raw' ? 0.2 : 0.55); ctx.beginPath(); ctx.ellipse(0, 2, 15, 11, 0, 0, Math.PI * 2); fillStroke();
        ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(-4, -2, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-6, -10, 2, 4); ctx.fillRect(4, -10, 2, 4);
      } else if (sh === 'shell') { // 조개: 벌어진 두 껍데기와 속살
        ctx.fillStyle = mixc(B, '#f4e8d0', 0.2); ctx.beginPath(); ctx.moveTo(-18, 6); ctx.quadraticCurveTo(-18, -16, 0, -16); ctx.quadraticCurveTo(18, -16, 18, 6); ctx.closePath(); fillStroke();
        ctx.strokeStyle = mixc(B, '#3a2010', 0.35); ctx.lineWidth = 1.5; for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(j * 3, 6); ctx.lineTo(j * 7, -13); ctx.stroke(); }
        ctx.fillStyle = mode === 'raw' ? '#f8d8c0' : '#f4e0b8'; ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 9, 17, 7, 0, 0, Math.PI * 2); fillStroke(); ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 8, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      } else if (sh === 'shrimp') { // 새우: 마디 있는 C자 몸통과 꼬리
        ctx.fillStyle = mixc(body, '#e86a3a', mode === 'raw' ? 0.1 : 0.6);
        for (let j = 0; j < 6; j++) { const a = -2.4 + j * 0.62, r2 = 13; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r2, Math.sin(a) * r2 + 2, 7 - j * 0.4, 5.5 - j * 0.3, a + Math.PI / 2, 0, Math.PI * 2); fillStroke(); }
        ctx.beginPath(); ctx.moveTo(12, 14); ctx.lineTo(22, 8); ctx.lineTo(20, 18); ctx.closePath(); fillStroke(); ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(-14, -10); ctx.quadraticCurveTo(-24, -20, -30, -14); ctx.stroke();
      } else if (sh === 'squid') { // 오징어: 고리 썰기와 다리
        ctx.fillStyle = mixc(body, '#f4ecd8', 0.35); for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(-12 + j * 12, 0, 6, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2a2230'; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(-12 + j * 12, 0, 2.4, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = mixc(body, '#f4ecd8', 0.35); }
        ctx.strokeStyle = mixc(body, '#8a4a5a', 0.4); ctx.lineWidth = 3; for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(j * 7, 11); ctx.quadraticCurveTo(j * 10 + 4, 18, j * 5 - 4, 20); ctx.stroke(); }
      } else if (sh === 'octo') { // 문어: 말린 다리와 빨판
        ctx.strokeStyle = mixc(body, '#8a3a5a', 0.5); ctx.lineWidth = 7; ctx.lineCap = 'round';
        for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(-14 + j * 14, 2, 8 - j, Math.PI * 0.2, Math.PI * 1.9); ctx.stroke(); }
        ctx.fillStyle = '#f4d8e0'; for (let j = 0; j < 7; j++) { ctx.beginPath(); ctx.arc(-14 + j * 4.5, 6 - (j % 2) * 8, 1.5, 0, Math.PI * 2); ctx.fill(); } ctx.lineCap = 'butt';
      } else if (sh === 'jelly') { // 해파리: 투명한 얇은 채
        ctx.globalAlpha = 0.75; ctx.fillStyle = mixc(body, '#e8f4ff', 0.45); for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-20 + j * 8, -8 + (j % 2) * 3, 5, 18, 2) : ctx.rect(-20 + j * 8, -8, 5, 18); ctx.fill(); ctx.stroke(); } ctx.globalAlpha = 1;
      } else if (sh === 'star' || sh === 'urchin') { // 불가사리·성게: 가시 껍데기 반쪽과 알
        ctx.fillStyle = sh === 'urchin' ? mixc(B, '#2a1a3a', 0.4) : mixc(body, '#e88a3a', 0.4); ctx.beginPath(); for (let j = 0; j < 14; j++) { const a = (j / 14) * Math.PI * 2, r2 = j % 2 ? 11 : 19; ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * 0.8); } ctx.closePath(); fillStroke();
        ctx.fillStyle = sh === 'urchin' ? '#f0a030' : mixc(light, '#f0e0a0', 0.4); ctx.beginPath(); ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e07a10'; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(Math.cos(j * 1.26) * 4, Math.sin(j * 1.26) * 3, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
      } else if (sh === 'eel') { // 장어: 구불구불 양념 구이
        ctx.lineCap = 'round'; ctx.strokeStyle = edge; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-22, 4); ctx.bezierCurveTo(-12, -14, -2, 16, 8, -2); ctx.bezierCurveTo(14, -10, 20, 4, 24, 0); ctx.stroke();
        ctx.strokeStyle = body; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = light; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      } else if (sh === 'seahorse') { // 해마: 꼬불꼬불 말린 몸
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-6, -18); ctx.quadraticCurveTo(10, -22, 8, -8); ctx.quadraticCurveTo(14, 4, 4, 14); ctx.quadraticCurveTo(-2, 22, -10, 16); ctx.quadraticCurveTo(-4, 14, 0, 8); ctx.quadraticCurveTo(-8, -4, -6, -18); ctx.closePath(); fillStroke();
        ctx.fillRect(-14, -16, 8, 3); ctx.fillStyle = '#222'; ctx.fillRect(0, -15, 2, 2);
      } else if (sh === 'turtle') { // 거북: 육각무늬 등딱지
        ctx.fillStyle = mixc(body, '#6a8a3a', 0.5); ctx.beginPath(); ctx.ellipse(0, 2, 18, 13, 0, 0, Math.PI * 2); fillStroke(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5;
        for (const [hx, hy] of [[0, 2], [-9, -2], [9, -2], [-7, 8], [7, 8]]) { ctx.beginPath(); for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; ctx.lineTo(hx + Math.cos(a) * 5, hy + Math.sin(a) * 4); } ctx.closePath(); ctx.stroke(); }
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(21, 1, 5, 4, 0, 0, Math.PI * 2); fillStroke();
      } else if (sh === 'whale' || sh === 'shark') { // 고래·상어: 두툼한 고기 토막
        ctx.fillStyle = mixc(body, '#b04a3a', 0.35); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-20, -9, 40, 18, 5) : ctx.rect(-20, -9, 40, 18); fillStroke();
        ctx.strokeStyle = mixc(body, '#ffffff', 0.55); ctx.lineWidth = 2; for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(j * 7 - 4, -7); ctx.lineTo(j * 7 + 3, 7); ctx.stroke(); }
        ctx.fillStyle = edge; ctx.globalAlpha = 0.35; ctx.fillRect(-20, 4, 40, 5); ctx.globalAlpha = 1;
      } else if (sh === 'flat' || sh === 'ray') { // 가자미·가오리: 납작한 몸
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-8, -16, 8, -12); ctx.quadraticCurveTo(24, -6, 22, 0); ctx.quadraticCurveTo(24, 6, 8, 12); ctx.quadraticCurveTo(-8, 16, -22, 0); ctx.closePath(); fillStroke();
        ctx.fillStyle = light; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(-2, -3, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#222'; ctx.fillRect(10, -5, 2, 2); ctx.fillRect(10, -1, 2, 2);
      } else { // 물고기·아귀·고양이 물고기 …: 통째로 / 토막
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-30, -9); ctx.lineTo(-28, 0); ctx.lineTo(-30, 9); ctx.closePath(); fillStroke();
        ctx.beginPath(); ctx.ellipse(0, 0, 21, sh === 'angler' ? 13 : 9, 0, 0, Math.PI * 2); fillStroke();
        ctx.fillStyle = light; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(-2, 3, 14, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = edge; ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(0, -15); ctx.lineTo(6, -9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = edge; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(10, 0, 7, -1.2, 1.2); ctx.stroke(); ctx.fillStyle = '#f6f6f0'; ctx.beginPath(); ctx.arc(13, -2, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(13, -3, 2, 2);
        if (sh === 'angler') { ctx.strokeStyle = edge; ctx.beginPath(); ctx.moveTo(8, -12); ctx.quadraticCurveTo(14, -24, 20, -18); ctx.stroke(); ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(20, -18, 2.6, 0, Math.PI * 2); ctx.fill(); }
      }
      // 조리 방식 겉모습
      if (mode === 'grill' || dark) { ctx.strokeStyle = 'rgba(40,16,4,0.55)'; ctx.lineWidth = 2.2; for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(j * 9 - 5, -6); ctx.lineTo(j * 9 + 5, 7); ctx.stroke(); } }
      else if (mode === 'fry') { for (let j = 0; j < 9; j++) { ctx.fillStyle = j % 2 ? '#f0c050' : '#c88a20'; ctx.beginPath(); ctx.arc(-16 + R(300 + j) * 32, -7 + R(310 + j) * 14, 1.8 + R(320 + j) * 1.6, 0, Math.PI * 2); ctx.fill(); } }
      else if (mode === 'steam') { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-4, -4, 12, 3, -0.2, 0, Math.PI * 2); ctx.fill(); }
      else if (mode === 'raw') { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-3, -3, 11, 3, -0.2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, -3, 12, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    };
    const ell = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const steam = () => { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.quadraticCurveTo(x + 5, -14, x, -22); ctx.stroke(); } };
    const broth = ['#c8601a', '#e8a040', '#a83a2a', '#d8c880', '#7a4a2a'][Math.floor(R(2) * 5)];
    switch (k.m) {
      case 0: ell(0, 16, 30, 9, plate); ell(0, 15, 24, 6, 'rgba(0,0,0,0.12)'); fish(0, 6, 40, (R(3) - 0.5) * 0.4); ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 4, -2); ctx.lineTo(i * 9 + 4, 12); ctx.stroke(); } break; // 구이
      case 1: ell(0, 16, 30, 9, plate); fish(0, 7, 34); for (let i = 0; i < 7; i++) dot(-20 + R(4 + i) * 40, 2 + R(12 + i) * 14, 2.5 + R(20 + i) * 2, ['#e8b040', '#f0c860', '#c88a20'][i % 3]); break; // 튀김
      case 2: ctx.fillStyle = '#c8a060'; ctx.fillRect(-24, -6, 48, 20); ctx.fillStyle = '#a07a3a'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 9 - 1, -6, 2, 20); ell(0, -6, 24, 7, '#d8b878'); ctx.save(); ctx.beginPath(); ctx.rect(-24, -14, 48, 10); ctx.clip(); fish(0, -4, 26); ctx.restore(); ell(0, 14, 24, 5, '#8a6a3a'); steam(); break; // 찜
      case 3: ctx.fillStyle = '#3a3a46'; ctx.fillRect(-26, -2, 52, 20); ctx.fillRect(-32, 2, 6, 5); ctx.fillRect(26, 2, 6, 5); ell(0, -2, 26, 7, broth); fish(0, -3, 24, R(5) - 0.5); steam(); break; // 탕
      case 4: ell(0, 16, 30, 9, plate); ell(0, 12, 24, 8, '#4fae45'); if (!['fish', 'flat', 'ray', 'whale', 'shark', 'cat', 'angler'].includes(k.shape)) { fish(0, 6, 36); dot(-24, 8, 3, '#e8f0c0'); dot(24, 9, 3, '#e8f0c0'); break; } /* 살코기가 아닌 재료는 그 모습 그대로 얹는다 */ for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(-14 + i * 9, 8); ctx.rotate(-0.4 + i * 0.1); ctx.fillStyle = i % 2 ? L[0] : '#ffe8e8'; ctx.fillRect(-5, -9, 10, 15); ctx.fillStyle = L[1]; ctx.fillRect(-5, 3, 10, 3); ctx.restore(); } dot(20, 6, 4, '#e8f0c0'); break; // 회
      case 5: ell(0, 16, 30, 9, plate); ell(0, 12, 25, 8, '#4a2a1a'); fish(0, 8, 30, 0, true); for (let i = 0; i < 6; i++) dot(-16 + R(30 + i) * 32, 8 + R(40 + i) * 8, 1.5, '#f4e8c0'); break; // 조림
      case 6: ell(0, 12, 28, 10, '#2a2a30'); ell(0, 10, 24, 8, '#4a3a2a'); ctx.fillStyle = '#2a2a30'; ctx.fillRect(26, 10, 14, 4); for (let i = 0; i < 8; i++) dot(-18 + R(50 + i) * 36, 5 + R(60 + i) * 10, 3 + R(70 + i) * 2, ['#d02a2a', '#4fae45', '#e8c030', L[0]][i % 4]); fish(0, 8, 22); break; // 볶음
      case 7: ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.moveTo(-26, -2); ctx.lineTo(26, -2); ctx.lineTo(18, 18); ctx.lineTo(-18, 18); ctx.closePath(); ctx.fill(); ell(0, -2, 26, 7, broth); for (let i = 0; i < 4; i++) dot(-14 + R(80 + i) * 28, -3 + R(90 + i) * 3, 4, ['#e07a3a', '#4fae45', '#e8d890', '#c83a3a'][i]); fish(0, -4, 20); break; // 스튜
      case 8: ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(26, -4); ctx.lineTo(16, 18); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill(); for (let i = 0; i < 6; i++) ell(-16 + i * 6.5, -6 + (i % 2) * 3, 8, 5, ['#4fae45', '#7ad07a', '#3a8a3a'][i % 3]); fish(4, -4, 18); dot(-12, -8, 4, '#d02a2a'); dot(14, -7, 3.5, '#f0e060'); break; // 샐러드
      case 9: ell(0, 18, 30, 6, 'rgba(0,0,0,0.12)'); for (let s = 0; s < 2; s++) { ctx.save(); ctx.translate(0, 8 + s * 8 - 4); ctx.rotate(-0.25); ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.stroke(); for (let i = 0; i < 4; i++) dot(-18 + i * 12, 0, 6, i % 2 ? L[0] : ['#4fae45', '#d02a2a', '#e8c030'][s]); ctx.restore(); } break; // 꼬치
      case 10: ctx.fillStyle = '#c0504d'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(18, 18); ctx.lineTo(-18, 18); ctx.closePath(); ctx.fill(); ell(0, 0, 26, 7, '#f4f4ee'); ctx.fillStyle = '#f4f4ee'; ctx.beginPath(); ctx.arc(0, 0, 22, Math.PI, 0); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 22, Math.PI, 0); ctx.clip(); fish(0, -6, 28); ctx.restore(); break; // 덮밥
      case 12: { ctx.fillStyle = '#8a8a94'; ctx.fillRect(-30, 8, 60, 8); ctx.fillStyle = '#6a6a74'; ctx.fillRect(-34, 8, 4, 4); ctx.fillRect(30, 8, 4, 4); fish(0, 3, 38); ctx.fillStyle = 'rgba(120,60,10,0.35)'; ctx.fillRect(-14, 0, 28, 3); dot(-20, 6, 2.5, '#4fae45'); dot(22, 6, 2.5, '#4fae45'); steam(); break; }
      case 13: ell(0, 12, 30, 11, '#f4f0e8'); ell(0, 8, 25, 8, '#f0c040'); for (let i = 0; i < 6; i++) dot(-18 + R(130 + i) * 36, 5 + R(140 + i) * 6, 2.5, '#b87a20'); fish(0, 6, 20); steam(); break;
      case 14: ell(0, 12, 30, 12, '#c88a40'); ell(0, 8, 28, 10, '#e8b868'); ctx.strokeStyle = '#a8742a'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 8, 0); ctx.lineTo(i * 9 + 8, 16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 9 + 8, 0); ctx.lineTo(i * 9 - 8, 16); ctx.stroke(); } ctx.save(); ctx.beginPath(); ctx.rect(-6, -6, 12, 8); ctx.clip(); fish(0, 2, 16); ctx.restore(); break;
      case 15: ell(0, 14, 28, 5, 'rgba(0,0,0,0.12)'); ell(0, 6, 30, 14, '#d8a058'); ell(0, 3, 26, 9, '#e8b878'); ctx.strokeStyle = '#a8742a'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 4, -2); ctx.lineTo(i * 10 + 4, 8); ctx.stroke(); } fish(0, 8, 14); break;
      case 16: ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-26, 14, 52, 5); ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -8); ctx.stroke(); fish(0, 2, 36, Math.PI / 2 * 0.2, true); ctx.strokeStyle = 'rgba(190,190,200,0.7)'; ctx.lineWidth = 3; for (const x of [-16, 0, 16]) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.bezierCurveTo(x - 8, 4, x + 8, -4, x, -14 - (x ? 4 : 0)); ctx.stroke(); } break;
      case 17: ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, -14); ctx.lineTo(30, -14); ctx.stroke(); for (const x of [-18, 0, 18]) { ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x, -8); ctx.stroke(); fish(x, 2, 22, Math.PI / 2, true); } break;
      case 18: ell(0, 14, 28, 8, '#e8e4da'); ell(0, 12, 24, 6, '#f8f8f8'); fish(0, 9, 28, 0); for (let i = 0; i < 14; i++) dot(-22 + R(150 + i) * 44, 6 + R(160 + i) * 10, 1.4, '#ffffff'); ctx.fillStyle = '#a8c0d0'; ctx.fillRect(-4, -6, 8, 2); break;
      case 19: ell(0, 17, 28, 5, 'rgba(0,0,0,0.12)'); ctx.fillStyle = '#f6f0e0'; ctx.beginPath(); ctx.moveTo(-26, 12); ctx.quadraticCurveTo(0, -22, 26, 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#d8ccb0'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 6, -4 + Math.abs(i) * 2); ctx.lineTo(i * 6 + 1, 10); ctx.stroke(); } dot(0, 4, 3, L[0]); steam(); break;
      case 20: ctx.fillStyle = '#c8a060'; ctx.beginPath(); ctx.ellipse(0, 14, 30, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a07a3a'; ctx.fillRect(-30, 6, 60, 8); ell(0, 6, 30, 8, '#d8b878'); for (const x of [-14, 0, 14]) { ell(x, 3, 8, 7, '#f6f0e0'); dot(x, 3, 2.5, L[0]); } steam(); break;
      case 21: ctx.fillStyle = '#d8b878'; ctx.fillRect(-26, 12, 52, 4); ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 2); ctx.lineTo(26, 2); ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#f0d0d0' : '#f6e8e8'; ctx.fillRect(-22 + i * 12, -6, 10, 16); ctx.fillStyle = '#c88a60'; ctx.fillRect(-22 + i * 12, -6, 10, 3); } steam(); break;
      case 22: ctx.fillStyle = '#4a3a30'; ctx.beginPath(); ctx.moveTo(-26, -2); ctx.lineTo(26, -2); ctx.lineTo(20, 18); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill(); ell(0, -2, 26, 7, broth); ell(-6, -4, 10, 4, '#f6f2e8'); fish(8, -4, 16); dot(14, -2, 2.5, '#4fae45'); dot(-12, 0, 2.5, '#4fae45'); steam(); break;
      case 23: ctx.fillStyle = '#8a8a94'; ctx.fillRect(-32, 8, 64, 6); ell(0, 8, 32, 8, '#d03a2a'); for (let i = 0; i < 6; i++) ell(-20 + i * 8, 8 + (i % 2) * 2, 5, 3, ['#4fae45', '#e8c030', '#e8d8c0'][i % 3]); fish(0, 6, 22); steam(); break;
      case 24: ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(-26, -2); ctx.lineTo(26, -2); ctx.lineTo(18, 18); ctx.lineTo(-18, 18); ctx.closePath(); ctx.fill(); ell(0, -2, 26, 7, '#f6e8b0'); dot(-8, -3, 3, '#4fae45'); dot(10, -2, 2.5, '#d02a2a'); fish(0, -4, 14); steam(); break;
      case 25: ell(0, 14, 32, 10, plate); ell(-8, 12, 18, 7, '#f6f2e8'); ell(12, 12, 16, 7, '#a8741a'); ell(12, 11, 12, 4, '#d8a030'); fish(10, 9, 14); dot(-8, 9, 2, '#4fae45'); steam(); break;
      case 26: ctx.fillStyle = '#3a3a46'; ctx.fillRect(-30, 12, 60, 6); ctx.strokeStyle = '#8a8a94'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 9, 12); ctx.lineTo(i * 9, 4); ctx.stroke(); } for (let i = 0; i < 4; i++) { const f = 0.6 + 0.4 * Math.sin(time * 10 + i * 2); ell(-18 + i * 12, 14, 4, 5 * f, '#ff8a2a'); } fish(0, 2, 34); break;
      case 27: ctx.fillStyle = '#2a2a30'; ctx.fillRect(-30, 8, 60, 6); ell(0, 8, 30, 8, '#3a3a40'); fish(0, 6, 26); for (let i = 0; i < 5; i++) dot(-20 + R(170 + i) * 40, 5 + R(180 + i) * 6, 2.5, ['#e8c030', '#d02a2a', '#4fae45'][i % 3]); steam(); break;
      case 28: ell(0, 16, 32, 10, plate); ctx.fillStyle = '#8a4a2a'; ctx.beginPath(); ctx.ellipse(0, 10, 24, 11, -0.1, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#4a2a1a'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 5, 4); ctx.lineTo(i * 9 + 5, 16); ctx.stroke(); } ctx.fillStyle = '#ffe070'; ctx.fillRect(-4, 6, 8, 6); fish(14, 4, 14); steam(); break;
      case 29: ell(0, 12, 32, 14, '#d8a058'); ell(0, 10, 28, 11, '#d03a2a'); ell(0, 9, 25, 9, '#f6e090'); for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; fish(Math.cos(a) * 12, 9 + Math.sin(a) * 6, 12, a); } for (let i = 0; i < 4; i++) dot(-18 + R(190 + i) * 36, 6 + R(200 + i) * 8, 2, '#4fae45'); ctx.strokeStyle = 'rgba(120,60,10,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 22); ctx.stroke(); break;
      case 30: ctx.fillStyle = '#d8a058'; ctx.beginPath(); ctx.moveTo(-28, 14); ctx.quadraticCurveTo(0, -24, 28, 14); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8b878'; ctx.beginPath(); ctx.moveTo(-22, 12); ctx.quadraticCurveTo(0, -16, 22, 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#a8742a'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 7, 14); ctx.lineTo(i * 7, 11); ctx.stroke(); } dot(-6, 2, 2.5, '#d03a2a'); dot(8, 4, 2.5, '#4fae45'); steam(); break;
      case 31: ell(0, 14, 32, 10, plate); ell(0, 11, 28, 8, '#e8d098'); for (let i = 0; i < 6; i++) dot(-20 + R(210 + i) * 40, 8 + R(220 + i) * 6, 2, '#8a5a20'); fish(0, 9, 22); dot(-14, 7, 2.5, '#4fae45'); dot(16, 12, 2.5, '#4fae45'); break;
      case 32: ctx.fillStyle = '#a07a3a'; ctx.fillRect(-32, 14, 64, 5); for (const x of [-14, 14]) { ell(x, 10, 12, 6, '#f8f8f4'); ctx.save(); ctx.translate(x, 4); ctx.scale(0.8, 0.8); ctx.fillStyle = L[0]; ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = L[1]; ctx.fillRect(-10, -1, 20, 2); ctx.restore(); } dot(0, -8, 3, '#7ad07a'); break;
      case 33: ell(0, 17, 32, 6, 'rgba(0,0,0,0.12)'); for (let i = 0; i < 3; i++) { const x = -20 + i * 20; dot(x, 8, 10, '#1a1a22'); dot(x, 8, 8, '#f6f2e8'); dot(x - 2, 6, 2.5, '#e8c030'); dot(x + 3, 9, 2.5, '#d02a2a'); dot(x, 11, 2, '#4fae45'); } break;
      case 34: ctx.fillStyle = '#f8f8f4'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(24, 16); ctx.lineTo(-24, 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1a1a22'; ctx.fillRect(-14, 8, 28, 8); dot(0, 2, 3, L[0]); for (let i = 0; i < 6; i++) dot(-10 + R(230 + i) * 20, 0 + R(240 + i) * 8, 1, '#c8c0a8'); break;
      case 35: ctx.fillStyle = '#1a1a22'; ctx.fillRect(-26, -2, 52, 18); ctx.fillStyle = '#f8f8f4'; ctx.fillRect(-26, 0, 52, 8); for (let i = 0; i < 5; i++) { dot(-18 + i * 9, 4, 3, i % 2 ? '#e8c030' : L[0]); } ell(0, 16, 26, 4, 'rgba(0,0,0,0.15)'); for (let i = 0; i < 8; i++) dot(-22 + R(250 + i) * 44, -1 + R(260 + i) * 3, 1, '#ffffff'); break;
      default: ell(0, 16, 30, 9, plate); ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, 6, 22 - i * 3, 9 - i * 1.4, 0, 0.4 * i, Math.PI * 1.7 + 0.3 * i); ctx.stroke(); } fish(0, 0, 20); dot(-8, 3, 3, '#d02a2a'); dot(9, 5, 3, '#d02a2a'); break; // 스파게티
    }
    if (k.g > 0) { // 곁들임 재료 (g 번호마다 다른 재료가 접시 가장자리에 놓인다)
      const cnt = 3 + (k.g % 3);
      for (let i = 0; i < cnt; i++) {
        const a = R(100 + i) * Math.PI * 2, d = 12 + R(110 + i) * 16, gx = Math.cos(a) * d, gy = 6 + Math.sin(a) * d * 0.38;
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(R(120 + i) * 6.28);
        if (k.g === 1) { ctx.fillStyle = '#4fae45'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#2a7a2a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); }
        else if (k.g === 2) { ctx.fillStyle = '#d02a2a'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0d890'; ctx.fillRect(-1, -0.6, 1.2, 1.2); ctx.fillRect(2, 0, 1.2, 1.2); }
        else if (k.g === 3) { ctx.fillStyle = '#d8b878'; ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f4e4b8'; ctx.beginPath(); ctx.arc(-1, -1, 0.9, 0, Math.PI * 2); ctx.fill(); }
        else if (k.g === 4) { ctx.fillStyle = '#f0e060'; ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c8b830'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4.4); ctx.moveTo(0, 0); ctx.lineTo(3, 3); ctx.moveTo(0, 0); ctx.lineTo(-3, 3); ctx.stroke(); }
        else if (k.g === 5) { ctx.strokeStyle = '#3a9a6a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.fillStyle = '#7ad0a0'; for (const lx of [-2, 1, 4]) { ctx.beginPath(); ctx.ellipse(lx, -1.8, 1.8, 1, 0.4, 0, Math.PI * 2); ctx.ellipse(lx, 1.8, 1.8, 1, -0.4, 0, Math.PI * 2); ctx.fill(); } }
        else { ctx.fillStyle = i % 2 ? '#f08a4a' : '#ff9ac0'; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(-0.8, -0.8, 1.1, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    }
    if (k.n >= 2) { dot(-26, 18, 3, '#4fae45'); dot(28, 17, 3, '#d02a2a'); }
    if (k.n >= 3) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 22, -14); ctx.fillText('★', -22, -14); }
    if (k.n >= 5) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 0, -22); ctx.fillText('★', 36, -4); ctx.fillText('★', -36, -4); }
  }

  // ---- 요리 창 ----
  function open(inv, slot) {
    const id = slot ? inv.home.placed[slot.kind][slot.index] : 'd_gas', app = APPS[id] ? id : 'd_gas';
    return { slot, app, ms: APPS[app].ms, cur: 0, picks: [], m: APPS[app].ms[0], result: null, msg: '', t: 0, tab: 0 };
  }
  const geometry = (W, H) => ({ x: 70, y: 40, w: W - 140, h: H - 80 });
  const ROWS = 10;
  function fixStart(ui, n) { // 고른 줄이 보이도록 목록 위치를 잡는다 (마우스로 올려도 흔들리지 않는다)
    let s = ui.start || 0;
    if (ui.cur < s) s = ui.cur;
    if (ui.cur >= s + ROWS) s = ui.cur - ROWS + 1;
    ui.start = clamp(s, 0, Math.max(0, n - ROWS));
    return ui.start;
  }
  // 마우스로 누를 수 있는 곳들: row(재료 줄) / slot(냄비 칸 빼기) / m(조리법) / key(키보드 대신 누르는 단추)
  function areas(W, H, ui, inv) {
    const g = geometry(W, H), list = ingredients(inv), out = [];
    out.push({ x: g.x + g.w - 40, y: g.y + 8, w: 30, h: 30, key: 'Escape' });
    if (ui.result) { out.push({ x: g.x, y: g.y, w: g.w, h: g.h, key: 'Enter' }); return out; }
    const lx = g.x + 24, ly = g.y + 64, rowH = 34, rx = g.x + 430, ry = g.y + 64, start = fixStart(ui, list.length);
    out.push({ x: g.x + 250, y: g.y + 16, w: 230, h: 32, key: 'Tab' });
    for (let i = 0; i < ROWS && start + i < list.length; i++) out.push({ x: lx, y: ly + 18 + i * rowH, w: 360, h: rowH - 4, row: start + i });
    const btn = (i, y, label, key, w) => { out.push({ x: rx + i * (w + 6), y, w, h: 26, key, label }); };
    if (ui.tab === 1) {
      const y1 = g.y + g.h - 134, y2 = g.y + g.h - 104;
      [['1개 맡기기', 'Enter'], ['전부 맡기기', 'KeyF'], ['고용', 'KeyH'], ['속도 업', 'KeyU']].forEach((b, i) => btn(i, y1, b[0], b[1], 86));
      [['조리법', 'KeyM'], ['재료 수', 'KeyN'], ['요리 받기', 'KeyG'], ['직접 요리', 'Tab']].forEach((b, i) => btn(i, y2, b[0], b[1], 86));
    } else {
      for (let i = 0; i < 5; i++) if (ui.picks[i]) out.push({ x: rx + i * 78, y: ry + 14, w: 72, h: 70, slot: i });
      (ui.ms || APPS.d_gas.ms).forEach((mi, i) => out.push({ x: rx + (i % 6) * 61, y: ry + 116 + Math.floor(i / 6) * 24, w: 58, h: 20, m: mi }));
      const y = g.y + g.h - 94;
      [['넣기', 'Enter'], ['빼기', 'Backspace'], ['요리하기', 'KeyC'], ['요리사', 'Tab'], ['치우기', 'KeyX']].forEach((b, i) => { if (b[1] !== 'KeyX' || ui.slot) btn(i, y, b[0], b[1], 68); });
    }
    return out;
  }
  function drawButtons(ctx, ui, inv, W, H) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of areas(W, H, ui, inv)) {
      if (!a.label) continue;
      const hot = ui.mouse && ui.mouse.x >= a.x && ui.mouse.x < a.x + a.w && ui.mouse.y >= a.y && ui.mouse.y < a.y + a.h;
      ctx.fillStyle = hot ? 'rgba(255,168,74,0.45)' : 'rgba(255,168,74,0.2)'; ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = '#ffa84a'; ctx.lineWidth = 1.5; ctx.strokeRect(a.x, a.y, a.w, a.h);
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(a.label, a.x + a.w / 2, a.y + a.h / 2 + 1);
    }
    ctx.restore();
  }
  function draw(ctx, W, H, ui, inv) {
    const g = geometry(W, H);
    const list = ingredients(inv);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a2230'; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = '#ffa84a'; ctx.lineWidth = 4; ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#ffa84a'; ctx.fillText(ui.tab === 1 ? '요리사' : `${APPS[ui.app || 'd_gas'].name} 요리`, g.x + 24, g.y + 32);
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText(ui.tab === 1 ? '[Tab] 직접 요리로' : '[Tab] 요리사 탭 (맡겨 두면 알아서 요리해요)', g.x + 250, g.y + 32);
    const total = Object.keys(inv.cookbook || {}).length;
    ctx.textAlign = 'right'; ctx.font = '14px sans-serif'; ctx.fillStyle = '#c8b8a0'; ctx.fillText(`만든 요리 종류 ${total}가지`, g.x + g.w - 56, g.y + 32);
    { const hot = ui.mouse && ui.mouse.x >= g.x + g.w - 40 && ui.mouse.x < g.x + g.w - 10 && ui.mouse.y >= g.y + 8 && ui.mouse.y < g.y + 38; ctx.fillStyle = hot ? 'rgba(255,100,80,0.6)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(g.x + g.w - 40, g.y + 8, 30, 30); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('X', g.x + g.w - 25, g.y + 24); }
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
    if (ui.tab === 1) { drawChefTab(ctx, g, ui, inv, list, W, H); ctx.restore(); return; }
    // 왼쪽: 재료 목록
    const lx = g.x + 24, ly = g.y + 64, rowH = 34, rows = 10;
    ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText(`가진 재료 (${list.length}종)`, lx, ly);
    if (!list.length) { ctx.font = '16px sans-serif'; ctx.fillStyle = '#b8a890'; ctx.fillText('재료가 없어요. 바다·연못·숲에서 잡아 오세요!', lx, ly + 40); }
    const start = fixStart(ui, list.length);
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
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText(`조리법: ← ${METHODS[ui.m]} →  (눌러서 고르기)`, rx, ry + 104);
    (ui.ms || APPS.d_gas.ms).forEach((mi, i) => { const m = METHODS[mi]; const x = rx + (i % 6) * 61, y = ry + 116 + Math.floor(i / 6) * 24, on = mi === ui.m; ctx.fillStyle = on ? 'rgba(255,168,74,0.5)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, 58, 20); ctx.strokeStyle = on ? '#ffa84a' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, 58, 20); ctx.font = (m.length > 4 ? '10px' : '12px') + ' sans-serif'; ctx.fillStyle = on ? '#fff' : '#c8b8a0'; ctx.textAlign = 'center'; ctx.fillText(m, x + 29, y + 11); ctx.textAlign = 'left'; });
    // 미리보기
    const ing = ui.picks.map((id) => list.find((q) => q.id === id)).filter(Boolean);
    ctx.save(); ctx.translate(rx + 80, ry + 230); ctx.scale(2.6, 2.6);
    if (ing.length) { const main = ing.reduce((a, b) => (b.val > a.val ? b : a), ing[0]); const others = ing.filter((x) => x !== main).map((x) => x.id).sort(); const gi = others.length ? 1 + (hashStr(others.join(',') + '|' + ui.m) % 6) : 0; const id = `cook_${ui.m}_${main.id}_${gi}_${ui.picks.length}`; drawDish(ctx, { id, m: ui.m, shape: main.shape, look: main.look, g: gi, n: ui.picks.length }, ui.t); } else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 6); }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#c8b8a0';
    ['좋은 재료일수록', '더 맛있어요!', '곁들임은 나머지', '재료로 정해져요', '재료·조리법·곁들임', '조합은 수천 가지!'].forEach((t, i) => ctx.fillText(t, rx + 200, ry + 190 + i * 20));
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = ui.msg ? '#ffb0a0' : 'rgba(0,0,0,0)'; ctx.fillText(ui.msg || ' ', rx, g.y + g.h - 62);
    drawButtons(ctx, ui, inv, W, H);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#9a8a78'; ctx.textAlign = 'center';
    ctx.fillText('마우스: 줄=넣기 · 냄비 칸=빼기 · 키보드: ↑↓ 고르기 · Enter 넣기 · Backspace 빼기 · ←→ 조리법 · C 요리 · Esc 닫기', g.x + g.w / 2, g.y + g.h - 28);
    ctx.restore();
  }

  // 요리사 탭: 왼쪽 = 내 재료(맡길 것), 오른쪽 = 요리사 상태
  function drawChefTab(ctx, g, ui, inv, list, W, H) {
    const c = chefOf(inv);
    const lx = g.x + 24, ly = g.y + 64, rowH = 34, rows = 10;
    ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#e8c890'; ctx.fillText(`맡길 재료를 고르세요 (Enter 1개 · F 전부)`, lx, ly);
    const start = fixStart(ui, list.length);
    for (let i = 0; i < rows && start + i < list.length; i++) {
      const it = list[start + i], y = ly + 18 + i * rowH, sel = start + i === ui.cur;
      ctx.fillStyle = sel ? 'rgba(255,168,74,0.25)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(lx, y, 360, rowH - 4);
      if (sel) { ctx.strokeStyle = '#ffa84a'; ctx.lineWidth = 2; ctx.strokeRect(lx, y, 360, rowH - 4); }
      ctx.save(); ctx.translate(lx + 22, y + 14); ctx.scale(0.55, 0.55); G.Sea.drawCritter(ctx, { sp: { shape: it.shape, c1: it.look[0], c2: it.look[1], size: 34, zone: 0, elem: null, idx: 0 }, x: 0, y: 0, vx: 1, vy: 0, t: 0, size: 1 }, ui.t); ctx.restore();
      ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(it.name, lx + 48, y + 13);
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#b8a890'; ctx.fillText(`${it.label}${it.elem ? ' · 원소' : ''}`, lx + 200, y + 13);
      ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#e8d8b8'; ctx.fillText(`x${it.count}`, lx + 352, y + 13);
    }
    if (!list.length) { ctx.textAlign = 'left'; ctx.font = '16px sans-serif'; ctx.fillStyle = '#b8a890'; ctx.fillText('맡길 재료가 없어요.', lx, ly + 40); }
    const rx = g.x + 430, ry = g.y + 64;
    ctx.textAlign = 'left'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = c.hired ? '#7dffa0' : '#ffb0a0';
    ctx.fillText(c.hired ? `요리사 ${c.n}명 일하는 중 (속도 Lv ${c.lv}/${CHEF_MAX})` : `요리사를 고용하세요 (H · ${CHEF_HIRE} G)`, rx, ry);
    ctx.font = '15px sans-serif'; ctx.fillStyle = '#e8d8b8';
    const iv = chefInterval(inv);
    const next = chefNextSec(inv);
    const lines = [
      `요리 속도: ${iv}초에 ${Math.max(1, c.n)}개${c.lv >= CHEF_MAX ? ' (최고!)' : `   -   U: 업그레이드 (${chefUpCost(inv)} G) -> ${iv - CHEF_STEP}초`}`,
      `맡겨 둔 재료: ${chefStockUnits(inv)}개 (${Object.keys(c.stock).length}종)${next !== null ? `   다음 요리까지 ${next}초` : c.hired ? '   (재료가 없어서 쉬는 중)' : ''}`,
      `조리법: ${c.rnd ? '요리사가 알아서' : METHODS[c.m]}   (M 바꾸기 · 쓸 수 있는 조리법 ${chefMethods(inv).length}가지)`,
      `한 접시에 넣는 재료: ${c.k}개   (N 바꾸기)`,
      `만들어 둔 요리: ${chefPending(inv)}개   (G: 받기 · 집에 오면 자동으로 받아요)`,
      c.n >= CHEF_N_MAX ? `요리사는 최대 ${CHEF_N_MAX}명이에요` : `H: 요리사 한 명 더 (${chefHireCost(inv)} G, 한 명 늘 때마다 2배)`,
    ];
    lines.forEach((t, i) => ctx.fillText(t, rx, ry + 34 + i * 28));
    const outList = Object.keys(c.out).filter((id) => c.out[id] > 0).slice(0, 3);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#b8e8b8';
    outList.forEach((id, i) => ctx.fillText(`· ${ITEMS[id] ? ITEMS[id].name : id} x${c.out[id]}`, rx + 8, ry + 190 + i * 20));
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = ui.msg ? '#ffb0a0' : 'rgba(0,0,0,0)'; ctx.fillText(ui.msg || ' ', rx, g.y + g.h - 62);
    drawButtons(ctx, ui, inv, W, H);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#9a8a78'; ctx.textAlign = 'center';
    ctx.fillText('마우스로 줄·단추를 눌러도 돼요 · Enter 맡기기 · F 전부 · H 고용 · U 속도 · M 조리법 · N 재료 수 · G 받기 · Esc 닫기', g.x + g.w / 2, g.y + g.h - 28);
  }

  // 파란 피를 채워 주는 기존 음식들 (빨간 피가 넘치면 파란 피가 되는 건 모든 음식이 같다)
  [['d_phoenix', 1], ['d_holy', 2], ['d_heart', 3], ['f_feast', 1], ['sd_clam', 1], ['sd_feast', 2]].forEach(([id, v]) => { const it = ITEMS[id]; if (it) { it.blue = v; it.desc = `${it.desc} · 파란 피 ${v}칸`; } });

  G.Cook = { chefHireCost, chefHire, chefSpots, drawChef, CHEF_N_MAX, APPS, chefMethods, chefNextMethod, areas, chefOf, chefInterval, chefUpCost, chefProduce, chefCollect, chefDeposit, chefStockUnits, chefPending, CHEF_MAX, CHEF_HIRE, EFFECTS, EFF, effText, addSource, addPantry, SOURCES, specOf, METHODS, ingredients, cook, registerAll, drawDish, open, draw, hashStr };
})(window.Game);
