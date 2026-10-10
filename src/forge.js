// 대장간: 같은 무기 3개 합치기(최대 2단계), 광석 제련, 주괴 붙이기, 곡괭이.
// 데이터와 규칙만 다룬다 (화면은 Renderer가, 입력은 main이). shop.js 뒤에 불러와 G.Shop.ITEMS 에 새 아이템을 더하고
// 대장간 상점(SHOPS.sword)에 합치기/제련/부착/곡괭이 탭을 이어 붙인다.
//
//  - 합치기: 같은 무기 3개 -> 한 단계 위 무기(1단계 "강화된 …", 2단계 "최강의 …" = 최대). 단계가 오를수록 모습과 공격이 강해진다
//  - 곡괭이로 광물 동굴(orecave.js)에서 광석을 캔다. 광석 3개를 제련하면 주괴 1개
//  - 주괴를 무기에 붙인다: 검(근접)용 광석과 총(쏘는 무기)용 광석이 따로 있다. 무기마다 붙일 수 있는 칸이 있다 (2칸 + 합성 단계)
(function (G) {
  const Shop = G.Shop;
  const ITEMS = Shop.ITEMS;
  const MAX_TIER = 2;

  // ======================= 곡괭이 =======================
  const PICKS = [
    { id: 'pick1', name: '나무 곡괭이', price: 150, pickaxe: 1, look: ['#c9a86a', '#8a5a2b'], desc: '1단계 광석(철·구리·초석·납)을 캘 수 있다' },
    { id: 'pick2', name: '철 곡괭이', price: 700, pickaxe: 2, look: ['#c9d2dc', '#6c7686'], desc: '2단계 광석(은·금·황철석·유황)까지, 더 빨리 캔다' },
    { id: 'pick3', name: '강철 곡괭이', price: 2000, pickaxe: 3, look: ['#9fb4cc', '#4a5a72'], desc: '3단계 광석(미스릴·흑요석·티타늄·폭렬석)까지 캔다' },
    { id: 'pick4', name: '미스릴 곡괭이', price: 5000, pickaxe: 4, look: ['#7fd8e8', '#3a8fa8'], desc: '4단계 광석(별철·심연석·백금·암흑강)까지, 가장 빨리 캔다' },
  ];
  for (const p of PICKS) ITEMS[p.id] = { id: p.id, name: p.name, price: p.price, tool: true, pickaxe: p.pickaxe, look: p.look, desc: p.desc };

  // ======================= 광석과 주괴 =======================
  // cls = 'sword'(근접 무기용) | 'gun'(쏘는 무기용), tier = 필요한 곡괭이 단계(1~4), weight = 나올 확률 비중
  // bonus = 주괴를 붙였을 때: dmg 대미지, boss 보스 대미지, reach 범위(칸), cd 쿨다운(초), crit 치명타, coin 코인,
  //   hit 단단한 몬스터 깎는 횟수, gdmg 탄환 대미지, st 스태미나 증감, radius 폭발 범위(칸), pierce 관통
  const ORES = [
    { id: 'iron', name: '철', cls: 'sword', tier: 1, weight: 10, look: ['#c9d2dc', '#6c7686'], bonus: { dmg: 1 } },
    { id: 'copper', name: '구리', cls: 'sword', tier: 1, weight: 9, look: ['#e0925a', '#9a5a2a'], bonus: { reach: 0.04, crit: 0.01 } },
    { id: 'silver', name: '은', cls: 'sword', tier: 2, weight: 6, look: ['#e8eef8', '#9aa6bc'], bonus: { crit: 0.04 } },
    { id: 'gold', name: '금', cls: 'sword', tier: 2, weight: 5, look: ['#ffe27a', '#d4a017'], bonus: { coin: 0.12 } },
    { id: 'mythril', name: '미스릴', cls: 'sword', tier: 3, weight: 3, look: ['#9fe8ff', '#3a8fa8'], bonus: { reach: 0.1, cd: -0.05 } },
    { id: 'obsidian', name: '흑요석', cls: 'sword', tier: 3, weight: 3, look: ['#6a4fb0', '#1a1030'], bonus: { dmg: 2, boss: 2 } },
    { id: 'starsteel', name: '별철', cls: 'sword', tier: 4, weight: 1.6, look: ['#fff2a8', '#7a8ae8'], bonus: { dmg: 3, hit: 1, crit: 0.03 } },
    { id: 'abyss', name: '심연석', cls: 'sword', tier: 4, weight: 1.4, look: ['#c07aff', '#2a1250'], bonus: { boss: 5, hit: 1 } },
    { id: 'saltpeter', name: '초석', cls: 'gun', tier: 1, weight: 9, look: ['#f0eadc', '#b8a98a'], bonus: { gdmg: 1 } },
    { id: 'lead', name: '납', cls: 'gun', tier: 1, weight: 9, look: ['#8a93a3', '#4a5262'], bonus: { gdmg: 1, st: -1 } },
    { id: 'pyrite', name: '황철석', cls: 'gun', tier: 2, weight: 6, look: ['#f0d83a', '#a89010'], bonus: { gdmg: 1, crit: 0.03 } },
    { id: 'sulfur', name: '유황', cls: 'gun', tier: 2, weight: 5, look: ['#fff27a', '#c9a810'], bonus: { gdmg: 1, radius: 0.3 } },
    { id: 'titanium', name: '티타늄', cls: 'gun', tier: 3, weight: 3, look: ['#bfc9d8', '#5a6a82'], bonus: { gdmg: 1, st: -3 } },
    { id: 'blastite', name: '폭렬석', cls: 'gun', tier: 3, weight: 3, look: ['#ff8a4a', '#8a2a10'], bonus: { gdmg: 2, radius: 0.4 } },
    { id: 'platinum', name: '백금', cls: 'gun', tier: 4, weight: 1.6, look: ['#f4f4ff', '#a0a8c8'], bonus: { gdmg: 3, crit: 0.04 } },
    { id: 'darksteel', name: '암흑강', cls: 'gun', tier: 4, weight: 1.4, look: ['#8a60d0', '#1a0a30'], bonus: { gdmg: 3, pierce: true } },
  ];
  const ORE = {};
  for (const o of ORES) ORE[o.id] = o;

  const fmt = (v) => Math.round(v * 100) / 100;
  function bonusText(b) {
    const t = [];
    if (b.dmg) t.push(`대미지 +${b.dmg}`);
    if (b.gdmg) t.push(`탄환 대미지 +${b.gdmg}`);
    if (b.boss) t.push(`보스 대미지 +${b.boss}`);
    if (b.reach) t.push(`범위 +${fmt(b.reach)}칸`);
    if (b.cd) t.push(`쿨다운 ${b.cd > 0 ? '+' : ''}${fmt(b.cd)}초`);
    if (b.crit) t.push(`치명타 +${Math.round(b.crit * 100)}%`);
    if (b.coin) t.push(`코인 +${Math.round(b.coin * 100)}%`);
    if (b.hit) t.push(`단단한 몬스터 +${b.hit}`);
    if (b.st) t.push(`스태미나 ${b.st > 0 ? '+' : ''}${b.st}`);
    if (b.radius) t.push(`폭발 범위 +${fmt(b.radius)}칸`);
    if (b.pierce) t.push('관통');
    return t.join(', ');
  }
  const CLS_NAME = { sword: '검', gun: '총' };
  for (const o of ORES) {
    ITEMS['ore_' + o.id] = { id: 'ore_' + o.id, name: `${o.name} 광석`, ore: o.id, quest: true, look: o.look, desc: `${o.tier}단계 광석 · ${CLS_NAME[o.cls]}용. 3개를 대장간에서 제련하면 주괴 1개` };
    ITEMS['ingot_' + o.id] = { id: 'ingot_' + o.id, name: `${o.name} 주괴`, ingot: o.id, quest: true, look: o.look, desc: `${CLS_NAME[o.cls]}에 붙인다: ${bonusText(o.bonus)}` };
  }
  const SMELT_NEED = 3; // 광석 3개 -> 주괴 1개
  const smeltFee = (o) => 20 * o.tier;
  const attachFee = (o) => 40 * o.tier;

  // ======================= 합성 단계 무기 =======================
  // 무기마다 1단계("강화된 …")와 2단계("최강의 …", 최대)를 미리 만들어 둔다. 상점에서 팔지 않고, 합쳐야만 얻는다.
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lighten = (h, k) => toHex(hex(h).map((v) => v + (255 - v) * k));
  const meleeBase = (w) => w.baseDmg || (w.oneHit ? 2 : 1);
  const isBase = (it) => it && it.slot === 'weapon' && !it.tier && it.id !== 'wood0' && !it.lens;

  for (const base of Object.values(ITEMS).filter(isBase)) {
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      const t = Object.assign({}, base, {
        id: `${base.id}_t${tier}`,
        baseId: base.id,
        tier,
        name: `${tier === 1 ? '강화된' : '최강의'} ${base.name}`,
        price: base.price * (tier === 1 ? 3 : 9),
        look: base.look.map((c) => lighten(c, tier === 1 ? 0.22 : 0.42)),
        glow: base.look[0],
        cd: Math.round((base.cd - 0.03 * tier) * 100) / 100,
        note: `${base.note ? base.note + ' · ' : ''}합성 ${tier === 1 ? '1단계' : '최대(2단계)'}`,
      });
      if (base.shot) { // 쏘는 무기: 대미지와 폭발 범위가 늘고, 스태미나가 덜 들며, 최대 단계에서 탄이 관통한다
        t.dmg = Math.round(base.dmg * (tier === 1 ? 2.8 : 5.5));
        t.stamina = Math.max(6, base.stamina - 2 * tier);
        if (base.radius) t.radius = Math.round((base.radius + 0.3 * tier) * 10) / 10;
        if ((base.shot === 'bullet' || base.shot === 'arrow') && tier === 2) t.pierce = true;
      } else { // 근접: 기본 대미지가 크게 늘고(보스에게 더 아프고 단단한 몬스터를 더 깎는다), 범위가 넓어지며, 1단계부터 슬라임·꽃게를 한 방에
        t.baseDmg = Math.round(meleeBase(base) * (tier === 1 ? 4 : 10));
        t.reach = Math.round(base.reach * (1 + 0.15 * tier) * 100) / 100;
        t.oneHit = true;
        if (base.throwTiles) t.throwTiles = base.throwTiles + tier;
      }
      ITEMS[t.id] = t;
    }
  }

  // ======================= 인벤토리 규칙 =======================
  const ensure = (inv) => { inv.copies = inv.copies || {}; inv.ores = inv.ores || {}; inv.ingots = inv.ingots || {}; inv.attach = inv.attach || {}; return inv; };
  const classOf = (w) => (w && w.shot ? 'gun' : 'sword');
  const slotsOf = (w) => Math.min(4, 2 + ((w && w.tier) || 0));
  const copiesOf = (inv, id) => (inv.items.includes(id) ? (inv.copies && inv.copies[id]) || 1 : 0);
  const canMerge = (item) => !!item && item.slot === 'weapon' && item.id !== 'wood0' && !item.lens;
  const nextOf = (item) => (item && item.slot === 'weapon' && item.id !== 'wood0' && !item.lens && (item.tier || 0) < MAX_TIER ? ITEMS[`${item.baseId || item.id}_t${(item.tier || 0) + 1}`] : null);
  const baseOf = (item) => (item.baseId ? ITEMS[item.baseId] : item);
  const mergeFee = (item) => ((item.tier || 0) === 0 ? Math.round(baseOf(item).price * 0.4) + 60 : Math.round(baseOf(item).price * 1.2) + 200);

  function addCopy(inv, id, n = 1) {
    ensure(inv);
    if (!inv.items.includes(id)) { inv.items.push(id); inv.copies[id] = n; } else inv.copies[id] = (inv.copies[id] || 1) + n;
    dirty = true;
    return inv.copies[id];
  }

  // 붙인 주괴가 주는 능력 합계 (shop.js stats/powerOf/homeBonuses가 부른다)
  const ZERO = () => ({ dmg: 0, boss: 0, reach: 0, cd: 0, crit: 0, coin: 0, hit: 0, gdmg: 0, st: 0, radius: 0, pierce: false });
  function attachBonus(inv, w) {
    const out = ZERO();
    const list = inv.attach && w ? inv.attach[w.id] : null;
    if (!list || !list.length) return out;
    for (const oid of list) {
      const b = ORE[oid] && ORE[oid].bonus;
      if (!b) continue;
      for (const k of Object.keys(b)) { if (k === 'pierce') out.pierce = out.pierce || !!b[k]; else out[k] += b[k]; }
    }
    return out;
  }

  // 합치기: 같은 무기 3개 -> 한 단계 위 한 자루. 쓴 무기가 손에 들려 있었다면 새 무기를 든다
  function merge(inv, id, wallet) {
    ensure(inv);
    const item = ITEMS[id];
    const nxt = nextOf(item);
    if (!nxt) return { ok: false, msg: '이미 최대 단계예요.' };
    const n = copiesOf(inv, id);
    if (n < 3) return { ok: false, msg: `${item.name}이(가) ${3 - n}개 더 필요해요.` };
    const fee = mergeFee(item);
    if (wallet.coins < fee) return { ok: false, msg: '코인이 부족해요.' };
    wallet.coins -= fee;
    const left = n - 3;
    if (left > 0) inv.copies[id] = left;
    else { // 이 무기가 다 떨어졌다: 목록/빠른 칸/장착을 새 무기로 넘긴다 (강화 레벨·신성·붙인 주괴도 이어받는다)
      inv.items.splice(inv.items.indexOf(id), 1);
      delete inv.copies[id];
      const keepMax = (obj) => { if (obj && obj[id]) obj[nxt.id] = Math.max(obj[nxt.id] || 0, obj[id]); if (obj) delete obj[id]; };
      keepMax(inv.wlevel);
      keepMax(inv.holy);
      if (inv.attach[id] && !(inv.attach[nxt.id] && inv.attach[nxt.id].length)) inv.attach[nxt.id] = inv.attach[id].slice(0, slotsOf(nxt));
      delete inv.attach[id];
      for (let k = 0; k < inv.hotbar.length; k++) if (inv.hotbar[k] === id) inv.hotbar[k] = nxt.id;
      if (inv.equipped.weapon === id) inv.equipped.weapon = nxt.id;
    }
    addCopy(inv, nxt.id);
    if (!inv.hotbar.includes(nxt.id) && inv.equipped.weapon !== nxt.id && !inv.hotbar.some((h) => h === null)) { /* 빠른 칸이 꽉 찼으면 그대로 */ }
    dirty = true;
    return { ok: true, msg: `${item.name} 3개가 합쳐졌다! ${nxt.name} 완성${nxt.tier >= MAX_TIER ? ' (최대 단계!)' : ''}` };
  }

  // 제련: 광석 3개 -> 주괴 1개
  function smelt(inv, oreId, wallet) {
    ensure(inv);
    const o = ORE[oreId];
    const have = inv.ores[oreId] || 0;
    if (have < SMELT_NEED) return { ok: false, msg: `${o.name} 광석이 ${SMELT_NEED - have}개 더 필요해요.` };
    const fee = smeltFee(o);
    if (wallet.coins < fee) return { ok: false, msg: '코인이 부족해요.' };
    wallet.coins -= fee;
    inv.ores[oreId] = have - SMELT_NEED;
    inv.ingots[oreId] = (inv.ingots[oreId] || 0) + 1;
    dirty = true;
    return { ok: true, msg: `${o.name} 광석 ${SMELT_NEED}개를 녹여 ${o.name} 주괴를 만들었다! (보유 ${inv.ingots[oreId]}개)` };
  }

  // 붙이기: 지금 든 무기에 주괴 하나. 무기 종류(검/총)에 맞는 주괴만, 칸이 남아 있을 때만
  function attach(inv, oreId, wallet) {
    ensure(inv);
    const w = ITEMS[inv.equipped.weapon];
    const o = ORE[oreId];
    if (classOf(w) !== o.cls) return { ok: false, msg: `${o.name} 주괴는 ${CLS_NAME[o.cls]}에만 붙일 수 있어요.` };
    const list = (inv.attach[w.id] = inv.attach[w.id] || []);
    if (list.length >= slotsOf(w)) return { ok: false, msg: `${w.name}은(는) 더 붙일 칸이 없어요 (${list.length}/${slotsOf(w)}). 무기를 합치면 칸이 늘어요.` };
    if ((inv.ingots[oreId] || 0) < 1) return { ok: false, msg: `${o.name} 주괴가 없어요.` };
    const fee = attachFee(o);
    if (wallet.coins < fee) return { ok: false, msg: '코인이 부족해요.' };
    wallet.coins -= fee;
    inv.ingots[oreId] -= 1;
    list.push(oreId);
    dirty = true;
    return { ok: true, msg: `${w.name}에 ${o.name} 주괴를 붙였다! (${list.length}/${slotsOf(w)}) ${bonusText(o.bonus)}` };
  }

  // 떼어내기: 가장 나중에 붙인 주괴를 뗀다 (주괴는 부서져 사라진다)
  function detach(inv) {
    ensure(inv);
    const w = ITEMS[inv.equipped.weapon];
    const list = inv.attach[w.id] || [];
    if (!list.length) return { ok: false, msg: '붙인 주괴가 없어요.' };
    const oid = list.pop();
    dirty = true;
    return { ok: true, msg: `${ORE[oid].name} 주괴를 떼어냈다 (부서져 사라진다)` };
  }

  // ======================= 대장간 상점 탭 =======================
  let dirty = true;
  let bound = null;        // main이 넘겨 준 인벤토리
  let cache = null;        // 마지막으로 만든 탭
  let cacheSig = '';
  const sum = (o) => { let s = 0; for (const k in o) s += o[k] || 0; return s; };
  const sigOf = (inv) => `${inv.equipped.weapon}|${inv.items.length}|${sum(inv.copies)}|${sum(inv.ores)}|${sum(inv.ingots)}|${(inv.attach[inv.equipped.weapon] || []).join(',')}|${inv.items.filter((i) => ITEMS[i] && ITEMS[i].pickaxe).length}`;

  const card = (p) => Object.assign({ forge: true, look: ['#c9d2dc', '#6c7686'] }, p);
  const infoCard = (title, lines, icon) => card({ id: 'info', kind: 'info', icon, name: title, view: () => ({ name: title, desc: lines[0], note: lines[1] || '' }), label: () => '안내', afford: () => false, run: () => ({ ok: false, msg: lines[0] }) });

  function mergeCards(inv) {
    const list = inv.items.map((id) => ITEMS[id]).filter((it) => it && nextOf(it) && copiesOf(inv, it.id) >= 2);
    list.sort((a, b) => copiesOf(inv, b.id) - copiesOf(inv, a.id) || (b.tier || 0) - (a.tier || 0));
    if (!list.length) return [infoCard('합칠 무기가 없어요', ['같은 무기를 3개 모으면 한 단계 위로 합칠 수 있어요.', '무기를 사면 이미 있는 무기도 한 자루 더 살 수 있어요 (1단계 → 2단계가 최대)'], ITEMS.sword0)];
    return list.map((it) => {
      const nxt = nextOf(it);
      return card({
        id: `merge:${it.id}`, kind: 'merge', icon: nxt,
        view: (i) => { const n = copiesOf(i, it.id); return { name: `${it.name} ${Math.min(n, 3)}/3  →  ${nxt.name}`, desc: n >= 3 ? `3개를 합쳐 ${nxt.name} 한 자루를 만든다 (수수료 ${mergeFee(it)} G)` : `${3 - n}개 더 있으면 합칠 수 있다`, note: nxt.tier >= MAX_TIER ? '최대 단계! 모습과 공격이 가장 강하다' : '단계가 오를수록 모습과 공격이 강해진다' }; },
        label: (i) => (copiesOf(i, it.id) >= 3 ? `${mergeFee(it)} G` : '재료 부족'),
        afford: (i, coins) => copiesOf(i, it.id) >= 3 && coins >= mergeFee(it),
        run: (wallet) => merge(wallet.inv, it.id, wallet),
      });
    });
  }

  function smeltCards(inv) {
    const list = ORES.filter((o) => (inv.ores[o.id] || 0) > 0).sort((a, b) => ((inv.ores[b.id] >= SMELT_NEED) - (inv.ores[a.id] >= SMELT_NEED)) || a.tier - b.tier);
    if (!list.length) return [infoCard('제련할 광석이 없어요', ['광물 동굴에서 곡괭이로 광석을 캐 오세요 (마을의 동굴 문).', `광석 ${SMELT_NEED}개를 녹이면 주괴 1개가 돼요`], ITEMS.ore_iron)];
    return list.map((o) => card({
      id: `smelt:${o.id}`, kind: 'smelt', icon: ITEMS['ore_' + o.id],
      view: (i) => { const n = i.ores[o.id] || 0; return { name: `${o.name} 광석 ${n}개  →  ${o.name} 주괴`, desc: n >= SMELT_NEED ? `${SMELT_NEED}개를 녹여 주괴 1개 (수수료 ${smeltFee(o)} G)` : `${SMELT_NEED - n}개 더 필요해요`, note: `${CLS_NAME[o.cls]}용 · ${bonusText(o.bonus)}` }; },
      label: (i) => ((i.ores[o.id] || 0) >= SMELT_NEED ? `${smeltFee(o)} G` : '재료 부족'),
      afford: (i, coins) => (i.ores[o.id] || 0) >= SMELT_NEED && coins >= smeltFee(o),
      run: (wallet) => smelt(wallet.inv, o.id, wallet),
    }));
  }

  function attachCards(inv) {
    const w = ITEMS[inv.equipped.weapon];
    const cls = classOf(w);
    const list = inv.attach[w.id] || [];
    const head = card({
      id: 'attach:info', kind: 'info', icon: w,
      view: (i) => { const l = i.attach[w.id] || []; return { name: `지금 든 무기: ${w.name}  (${CLS_NAME[cls]}용 주괴 · 붙인 칸 ${l.length}/${slotsOf(w)})`, desc: l.length ? `붙인 것: ${l.map((x) => ORE[x].name).join(', ')}` : '아직 붙인 주괴가 없어요', note: '다른 무기에 붙이려면 인벤토리(I)에서 그 무기를 들고 오세요' }; },
      label: () => '안내', afford: () => false, run: () => ({ ok: false, msg: '붙일 주괴를 아래에서 고르세요.' }),
    });
    const out = [head];
    const ingots = ORES.filter((o) => o.cls === cls && (inv.ingots[o.id] || 0) > 0);
    for (const o of ingots) {
      out.push(card({
        id: `attach:${o.id}`, kind: 'attach', icon: ITEMS['ingot_' + o.id],
        view: (i) => ({ name: `${o.name} 주괴 ${i.ingots[o.id] || 0}개  →  ${w.name}에 붙이기`, desc: bonusText(o.bonus), note: `수수료 ${attachFee(o)} G · 한 번 붙이면 떼도 주괴는 사라져요` }),
        label: (i) => ((i.attach[w.id] || []).length >= slotsOf(w) ? '칸 없음' : `${attachFee(o)} G`),
        afford: (i, coins) => (i.attach[w.id] || []).length < slotsOf(w) && coins >= attachFee(o),
        run: (wallet) => attach(wallet.inv, o.id, wallet),
      }));
    }
    if (!ingots.length) out.push(infoCard(`${CLS_NAME[cls]}에 붙일 주괴가 없어요`, [`${CLS_NAME[cls]}용 광석을 캐서 제련하세요.`, cls === 'sword' ? '검용: 철·구리·은·금·미스릴·흑요석·별철·심연석' : '총용: 초석·납·황철석·유황·티타늄·폭렬석·백금·암흑강'], ITEMS[cls === 'sword' ? 'ore_iron' : 'ore_saltpeter']));
    if (list.length) {
      out.push(card({
        id: 'attach:detach', kind: 'detach', icon: ITEMS['ingot_' + list[list.length - 1]],
        view: () => ({ name: '가장 나중에 붙인 주괴 떼어내기', desc: `${ORE[list[list.length - 1]].name} 주괴가 떨어져 나가요 (부서져 사라진다)`, note: '칸을 비워 다른 주괴를 붙일 때 쓰세요' }),
        label: () => '무료', afford: () => true, run: (wallet) => detach(wallet.inv),
      }));
    }
    return out;
  }

  const pickCards = () => PICKS.map((p) => ITEMS[p.id]);

  // 4개씩 페이지로 자른 탭 목록 만들기는 상점 화면(페이지 넘김)이 맡는다. 여기서는 종류별 탭 하나씩
  function forgeTabs(inv) {
    const sig = sigOf(inv);
    if (cache && sig === cacheSig && !dirty) return cache;
    ensure(inv);
    cache = [
      { name: '합치기', items: mergeCards(inv) },
      { name: '제련', items: smeltCards(inv) },
      { name: '부착', items: attachCards(inv) },
      { name: '곡괭이', items: pickCards() },
    ];
    cacheSig = sig;
    dirty = false;
    return cache;
  }

  const baseTabs = Shop.SHOPS.sword.tabs; // 검/대검/단검/지팡이/신성 강화
  Object.defineProperty(Shop.SHOPS.sword, 'tabs', { get: () => (bound ? baseTabs.concat(forgeTabs(bound)) : baseTabs), configurable: true, enumerable: true });

  function act(item, wallet) {
    const r = item.run(wallet);
    dirty = true;
    return r;
  }

  // 인벤토리 격자에 보일 광석/주괴 칸
  function gridExtra(inv) {
    const out = [];
    for (const o of ORES) if ((inv.ores && inv.ores[o.id]) > 0) out.push({ id: 'ore_' + o.id, count: inv.ores[o.id] });
    for (const o of ORES) if ((inv.ingots && inv.ingots[o.id]) > 0) out.push({ id: 'ingot_' + o.id, count: inv.ingots[o.id] });
    return out;
  }

  // 무기 설명 끝에 덧붙일 말: 보유 개수, 합성 단계, 붙인 주괴
  function describeExtra(item, inv) {
    if (!inv || item.slot !== 'weapon') return '';
    const t = [];
    const n = copiesOf(inv, item.id);
    if (item.tier) t.push(`합성 ${item.tier === MAX_TIER ? '최대' : item.tier + '단계'}`);
    else if (nextOf(item)) t.push(n >= 2 ? `보유 ${n}자루 (3자루면 합치기)` : '3자루를 모으면 합칠 수 있다');
    const l = inv.attach && inv.attach[item.id];
    if (l && l.length) t.push(`붙인 주괴 ${l.length}/${slotsOf(item)}: ${l.map((x) => ORE[x].name).join('·')}`);
    return t.join(' · ');
  }

  // 지금 가진 곡괭이 중 가장 좋은 단계 (0 = 없음)
  const bestPick = (inv) => {
    const id = inv.equipped && inv.equipped.pick;
    return id && inv.items.includes(id) && ITEMS[id] ? ITEMS[id].pickaxe : 0;
  };
  // 가진 곡괭이 중 가장 좋은 것을 낀다 (사거나 받았을 때 낀 게 없으면 자동으로)
  const bestOwnedPick = (inv) => inv.items.filter((id) => ITEMS[id] && ITEMS[id].pickaxe).sort((a, b) => ITEMS[b].pickaxe - ITEMS[a].pickaxe)[0] || null;
  const autoEquipPick = (inv) => { if (!bestPick(inv)) inv.equipped.pick = bestOwnedPick(inv); };
  const togglePick = (inv, id) => { // 인벤토리에서 누르면 끼고, 끼고 있으면 뺀다
    if (inv.equipped.pick === id) { inv.equipped.pick = null; return false; }
    inv.equipped.pick = id;
    return true;
  };

  G.Forge = {
    MAX_TIER, ORES, ORE, PICKS, SMELT_NEED, CLS_NAME,
    bind: (inv) => { bound = ensure(inv); dirty = true; },
    ensure, classOf, slotsOf, copiesOf, canMerge, nextOf, mergeFee, addCopy,
    attachBonus, bonusText, merge, smelt, attach, detach, act,
    gridExtra, describeExtra, forgeTabs, bestPick, bestOwnedPick, autoEquipPick, togglePick, markDirty: () => { dirty = true; },
  };
})(window.Game);
