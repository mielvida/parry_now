// 대장간: 같은 무기 3개 합치기(최대 2단계), 광석 제련, 주괴 붙이기, 곡괭이.
// 데이터와 규칙만 다룬다 (화면은 Renderer가, 입력은 main이). shop.js 뒤에 불러와 G.Shop.ITEMS 에 새 아이템을 더하고
// 대장간(SHOPS.sword)에 곡괭이 탭을, 용광로(SHOPS.furnace)에 합치기/제련/부착(+신성 강화) 탭을 이어 붙인다.
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
    { id: 'iron', name: '철', cls: 'sword', tier: 1, weight: 10, look: ['#c9d2dc', '#6c7686'], bonus: { dmg: 2 } },
    { id: 'copper', name: '구리', cls: 'sword', tier: 1, weight: 9, look: ['#e0925a', '#9a5a2a'], bonus: { dmg: 2, reach: 0.04, crit: 0.01 } },
    { id: 'silver', name: '은', cls: 'sword', tier: 2, weight: 6, look: ['#e8eef8', '#9aa6bc'], bonus: { dmg: 4, crit: 0.04 } },
    { id: 'gold', name: '금', cls: 'sword', tier: 2, weight: 5, look: ['#ffe27a', '#d4a017'], bonus: { dmg: 3, coin: 0.12 } },
    { id: 'mythril', name: '미스릴', cls: 'sword', tier: 3, weight: 3, look: ['#9fe8ff', '#3a8fa8'], bonus: { dmg: 12, reach: 0.1, cd: -0.05 } },
    { id: 'obsidian', name: '흑요석', cls: 'sword', tier: 3, weight: 3, look: ['#6a4fb0', '#1a1030'], bonus: { dmg: 16, boss: 16 } },
    { id: 'starsteel', name: '별철', cls: 'sword', tier: 4, weight: 1.6, look: ['#fff2a8', '#7a8ae8'], bonus: { dmg: 40, hit: 1, crit: 0.03 } },
    { id: 'abyss', name: '심연석', cls: 'sword', tier: 4, weight: 1.4, look: ['#c07aff', '#2a1250'], bonus: { dmg: 30, boss: 60, hit: 1 } },
    // 원소 광석: 붙이면 그 속성이 무기에 같이 적용된다 (무기 자체 속성에 더해진다). elem = 맞힐 때 일어나는 원소 효과
    { id: 'flame', name: '화염석', cls: 'sword', tier: 3, weight: 2.2, look: ['#ff9a4a', '#b02a10'], bonus: { dmg: 12, elem: 'fire' } },
    { id: 'frost', name: '서리석', cls: 'sword', tier: 3, weight: 2.2, look: ['#bfeaff', '#3a8fd0'], bonus: { dmg: 12, elem: 'ice' } },
    { id: 'venom', name: '독석', cls: 'sword', tier: 3, weight: 2.2, look: ['#9aff6a', '#2a7a2a'], bonus: { dmg: 12, elem: 'poison' } },
    { id: 'terra', name: '대지석', cls: 'sword', tier: 3, weight: 2.2, look: ['#c9a070', '#6a4a2a'], bonus: { dmg: 12, elem: 'quake' } },
    { id: 'volt', name: '번개석', cls: 'sword', tier: 4, weight: 1.2, look: ['#fff27a', '#3a6af0'], bonus: { dmg: 32, elem: 'light' } },
    { id: 'umbra', name: '그림자석', cls: 'sword', tier: 4, weight: 1.2, look: ['#9a8ab0', '#1a1428'], bonus: { dmg: 32, elem: 'shadow' } },
    // 균열 무시 광석: 단단한 몬스터(금이 가는 몬스터)를 금이 가는 단계 없이 한 번에 쓰러뜨린다
    { id: 'cleaver', name: '균열석', cls: 'sword', tier: 3, weight: 2.2, look: ['#ff6a8a', '#7a1030'], bonus: { dmg: 14, crack: true } },
    // 갑옷 광석(방어구 어디에든 붙인다): hp 최대 피(칸), inv 피격 후 무적(초), spd 이동 속도, coin 코인, perk 속성 능력 (같은 속성이 많을수록 강해진다)
    { id: 'ironplate', name: '철갑석', cls: 'armor', tier: 1, weight: 9, look: ['#b8c0cc', '#5a6272'], bonus: { hp: 1 } },
    { id: 'swiftstone', name: '날쌘석', cls: 'armor', tier: 1, weight: 8, look: ['#9ae8c0', '#2a8a60'], bonus: { hp: 1, spd: 0.03 } },
    { id: 'guardstone', name: '수호석', cls: 'armor', tier: 2, weight: 5, look: ['#ffd9a0', '#b0782a'], bonus: { hp: 2, inv: 0.15 } },
    { id: 'thornstone', name: '가시석', cls: 'armor', tier: 2, weight: 5, look: ['#c9a86a', '#6a4a3a'], bonus: { hp: 1, perk: 'thorn' } },
    { id: 'dragonscale', name: '용린석', cls: 'armor', tier: 3, weight: 2.4, look: ['#7ad0a0', '#1a5a3a'], bonus: { hp: 3, inv: 0.3 } },
    { id: 'emberscale', name: '화린석', cls: 'armor', tier: 3, weight: 2.4, look: ['#ff8a4a', '#a02a10'], bonus: { hp: 2, perk: 'fire' } },
    { id: 'frostscale', name: '냉린석', cls: 'armor', tier: 3, weight: 2.4, look: ['#bfe8ff', '#3a7ab8'], bonus: { hp: 2, perk: 'ice' } },
    { id: 'toxscale', name: '독린석', cls: 'armor', tier: 3, weight: 2.4, look: ['#8cff6b', '#2a7a2a'], bonus: { hp: 2, perk: 'toxic' } },
    { id: 'greedstone', name: '탐욕석', cls: 'armor', tier: 3, weight: 2.4, look: ['#fff0a0', '#c9961a'], bonus: { hp: 1, coin: 0.1, perk: 'gold' } },
    { id: 'voltscale', name: '뇌린석', cls: 'armor', tier: 4, weight: 1.2, look: ['#fff27a', '#3a6af0'], bonus: { hp: 3, perk: 'volt' } },
    { id: 'lifestone', name: '생명석', cls: 'armor', tier: 4, weight: 1.2, look: ['#ffa0c0', '#d94a7a'], bonus: { hp: 5, perk: 'regen' } },
    { id: 'titanscale', name: '거인석', cls: 'armor', tier: 4, weight: 1.2, look: ['#e0c8ff', '#6a4fb0'], bonus: { hp: 6, inv: 0.5, spd: 0.04 } },
    { id: 'saltpeter', name: '초석', cls: 'gun', tier: 1, weight: 9, look: ['#f0eadc', '#b8a98a'], bonus: { gdmg: 2 } },
    { id: 'lead', name: '납', cls: 'gun', tier: 1, weight: 9, look: ['#8a93a3', '#4a5262'], bonus: { gdmg: 2, st: -1 } },
    { id: 'pyrite', name: '황철석', cls: 'gun', tier: 2, weight: 6, look: ['#f0d83a', '#a89010'], bonus: { gdmg: 3, crit: 0.03 } },
    { id: 'sulfur', name: '유황', cls: 'gun', tier: 2, weight: 5, look: ['#fff27a', '#c9a810'], bonus: { gdmg: 2, radius: 0.3 } },
    { id: 'titanium', name: '티타늄', cls: 'gun', tier: 3, weight: 3, look: ['#bfc9d8', '#5a6a82'], bonus: { gdmg: 8, st: -3 } },
    { id: 'blastite', name: '폭렬석', cls: 'gun', tier: 3, weight: 3, look: ['#ff8a4a', '#8a2a10'], bonus: { gdmg: 10, radius: 0.4 } },
    { id: 'platinum', name: '백금', cls: 'gun', tier: 4, weight: 1.6, look: ['#f4f4ff', '#a0a8c8'], bonus: { gdmg: 25, crit: 0.04 } },
    { id: 'darksteel', name: '암흑강', cls: 'gun', tier: 4, weight: 1.4, look: ['#8a60d0', '#1a0a30'], bonus: { gdmg: 30, pierce: true } },
  ];
  const ORE = {};
  for (const o of ORES) ORE[o.id] = o;

  const ELEM_NAME = { fire: '불', ice: '얼음', poison: '독', quake: '대지', light: '번개(빛)', shadow: '그림자' };
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
    if (b.crack) t.push('균열 무시 (단단한 몬스터도 한 방)');
    if (b.hp) t.push(`최대 피 +${b.hp}칸`);
    if (b.inv) t.push(`피격 후 무적 +${fmt(b.inv)}초`);
    if (b.spd) t.push(`이동 속도 +${Math.round(b.spd * 100)}%`);
    if (b.perk) t.push(`${PERK_NAME[b.perk]} 능력 (같은 속성이 많을수록 강해져요)`);
    if (b.elem) t.push(`${ELEM_NAME[b.elem]} 속성`);
    return t.join(', ');
  }
  const CLS_NAME = { sword: '검', gun: '총', armor: '갑옷' };
  const PERK_NAME = { thorn: '가시', fire: '화염', ice: '얼음', volt: '번개', toxic: '독가시', regen: '재생', gold: '탐욕' };
  for (const o of ORES) {
    ITEMS['ore_' + o.id] = { id: 'ore_' + o.id, name: `${o.name} 광석`, ore: o.id, quest: true, look: o.look, desc: `${o.tier}단계 광석 · ${CLS_NAME[o.cls]}용. 3개를 용광로에서 제련하면 주괴 1개` };
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
  const classOf = (w) => (w && w.slot && w.slot !== 'weapon' ? 'armor' : w && w.shot ? 'gun' : 'sword');
  // 붙일 수 있는 주괴 칸: 무기는 기본 1칸 → 합쳐서 2레벨 3칸 → 3레벨(최대) 5칸. 방어구는 값어치에 따라 1/3/5칸
  const slotsOf = (w) => {
    if (!w) return 1;
    if (w.slot && w.slot !== 'weapon') return w.price < 600 ? 1 : w.price < 2500 ? 3 : 5;
    return [1, 3, 5][Math.min(2, w.tier || 0)];
  };
  // 용광로에서 고른 강화 대상 (null이면 지금 든 무기). 합치기·부착·제련 탭이 이 아이템을 기준으로 한다
  let target = null;
  const targetItem = (inv) => ITEMS[target && inv.items.includes(target) ? target : inv.equipped.weapon];
  const targetId = (inv) => targetItem(inv).id;
  const setTarget = (id) => { target = id; dirty = true; };
  const hasTarget = () => !!target;
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
  const ZERO = () => ({ dmg: 0, boss: 0, reach: 0, cd: 0, crit: 0, coin: 0, hit: 0, gdmg: 0, st: 0, radius: 0, pierce: false, crack: false, elems: [], elemLv: {}, hp: 0, inv: 0, spd: 0, perkList: [] });
  function attachBonus(inv, w) {
    const out = ZERO();
    const list = inv.attach && w ? inv.attach[w.id] : null;
    if (!list || !list.length) return out;
    for (const oid of list) {
      const b = ORE[oid] && ORE[oid].bonus;
      if (!b) continue;
      for (const k of Object.keys(b)) {
        if (k === 'pierce' || k === 'crack') out[k] = out[k] || !!b[k];
        else if (k === 'elem') { if (!out.elems.includes(b[k])) out.elems.push(b[k]); out.elemLv[b[k]] = (out.elemLv[b[k]] || 0) + 1; } // 같은 속성이 많을수록 강해진다
        else if (k === 'perk') out.perkList.push(b[k]);
        else out[k] += b[k];
      }
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

  // ---- 대장 숙련도: 제련·부착·합치기·크리스탈 합치기를 할 때마다 경험치가 쌓여 레벨이 오르고, 레벨이 오를수록 미니게임이 쉬워진다 ----
  const SMITH_MAX_LV = 10;
  const smithNeed = (lv) => 20 + 15 * (lv - 1); // 다음 레벨까지 필요한 경험치
  const smithOf = (inv) => { if (!inv.smith) inv.smith = { lv: 1, xp: 0 }; return inv.smith; };
  const smithEase = (inv) => (Math.min(SMITH_MAX_LV, smithOf(inv).lv) - 1) / (SMITH_MAX_LV - 1); // 0(처음) ~ 1(최고 레벨)
  // 경험치를 더한다. 레벨이 올랐으면 새 레벨을 돌려준다 (아니면 0)
  function addSmithXp(inv, n) {
    const sm = smithOf(inv);
    if (sm.lv >= SMITH_MAX_LV) return 0;
    sm.xp += n;
    let up = 0;
    while (sm.lv < SMITH_MAX_LV && sm.xp >= smithNeed(sm.lv)) { sm.xp -= smithNeed(sm.lv); sm.lv += 1; up = sm.lv; }
    if (sm.lv >= SMITH_MAX_LV) sm.xp = 0;
    dirty = true;
    return up;
  }
  const XP = { smelt: (o) => 5 * o.tier, attach: (o) => 8 * o.tier, crystal: 15, merge: (tier) => 12 * (tier + 1) };

  // 대장장이에게 맡기기: 미니게임 없이 확실히 성공하지만, 광석 단계가 높을수록 비싸다 (재료 수수료와 별도)
  const SMITH_WORK_FEE = { smelt: [60, 200, 700, 2500], attach: [100, 350, 1200, 4000] };
  const smithWorkFee = (kind, tier) => SMITH_WORK_FEE[kind][tier - 1];
  function entrustWork(inv, kind, oreId, wallet) {
    const o = ORE[oreId];
    const chk = kind === 'smelt' ? smeltCheck(inv, oreId, wallet) : attachCheck(inv, oreId, wallet);
    if (!chk.ok) return chk;
    const base = kind === 'smelt' ? smeltFee(o) : attachFee(o);
    const fee = smithWorkFee(kind, o.tier);
    if (wallet.coins < base + fee) return { ok: false, msg: `대장장이에게 맡기려면 ${base + fee} G가 필요해요.` };
    wallet.coins -= fee;
    const res = kind === 'smelt' ? smelt(inv, oreId, wallet) : attach(inv, oreId, wallet);
    if (res.ok) res.msg = '대장장이가 뚝딱! ' + res.msg;
    return res;
  }

  // 크리스탈 합치기: 같은 크리스탈 3개 -> 한 단계 위 1개 (어둠 -> 정화 -> 신성). 샘물과 제단을 돌지 않고도 만들 수 있지만 비싸다
  const CRYSTAL_RECIPES = [
    { from: 'darkcrystal', to: 'cleancrystal', fee: 300 },
    { from: 'cleancrystal', to: 'holycrystal', fee: 800 },
  ];
  function crystalMerge(inv, from, wallet) {
    ensure(inv);
    const r = CRYSTAL_RECIPES.find((q) => q.from === from);
    inv.materials = inv.materials || {};
    const have = inv.materials[from] || 0;
    if (have < 3) return { ok: false, msg: `${ITEMS[from].name}가 ${3 - have}개 더 필요해요.` };
    if (wallet.coins < r.fee) return { ok: false, msg: '코인이 부족해요.' };
    wallet.coins -= r.fee;
    inv.materials[from] = have - 3;
    inv.materials[r.to] = (inv.materials[r.to] || 0) + 1;
    const up = addSmithXp(inv, XP.crystal);
    dirty = true;
    return { ok: true, msg: `${ITEMS[from].name} 3개가 합쳐져 ${ITEMS[r.to].name}이(가) 되었다!${up ? ` 대장 Lv ${up}!` : ''}` };
  }

  // 합치기 작업: 같은 무기 3개를 작업대에 올리면 1분 뒤에 한 단계 위 무기가 된다.
  //  - 직접(무료): 용광로 곁에 있는 동안만 시간이 간다 (자리를 뜨면 멈춘다)
  //  - 대장장이에게 맡기기(70G): 어디에 있든 1분 뒤 완성. 그동안 다른 일을 할 수 있다
  // 작업이 끝나면 용광로에서 찾는다. 재료 3개는 맡기는 순간 작업대로 넘어간다.
  const JOB_TIME = 60;
  const ATTACH_TIME = 120; // 부착 미니게임 제한 시간 (2분)
  const SMELT_TIME = 100;  // 제련(온도 맞추기) 미니게임 제한 시간
  const SMITH_FEE = 70;
  const jobOf = (inv) => inv.forgeJob || null;

  // 합칠 수 있는 무기 목록 (1개 이상 가진 것, 3개 이상이면 합칠 수 있다)
  function mergeCandidates(inv) {
    if (target && inv.items.includes(target)) { const t = ITEMS[target]; return nextOf(t) ? [t] : []; } // 용광로에서 고른 아이템만
    const list = inv.items.map((id) => ITEMS[id]).filter((it) => it && nextOf(it));
    list.sort((a, b) => (copiesOf(inv, b.id) >= 3) - (copiesOf(inv, a.id) >= 3) || copiesOf(inv, b.id) - copiesOf(inv, a.id) || (b.tier || 0) - (a.tier || 0));
    return list;
  }

  function startMerge(inv, id, by, wallet) {
    ensure(inv);
    if (inv.forgeJob) return { ok: false, msg: inv.forgeJob.done ? '완성된 무기를 먼저 찾아가세요.' : '작업대가 이미 쓰이고 있어요.' };
    const item = ITEMS[id];
    const nxt = nextOf(item);
    if (!nxt) return { ok: false, msg: '이미 최대 단계예요.' };
    const n = copiesOf(inv, id);
    if (n < 3) return { ok: false, msg: `${item.name}이(가) ${3 - n}개 더 필요해요.` };
    if (by === 'smith') {
      if (wallet.coins < SMITH_FEE) return { ok: false, msg: `대장장이에게 줄 ${SMITH_FEE} G가 모자라요.` };
      wallet.coins -= SMITH_FEE;
    }
    const job = { from: id, to: nxt.id, by, t: 0, total: JOB_TIME, done: false, carry: null, hot: [], equip: false };
    const left = n - 3;
    if (left > 0) inv.copies[id] = left;
    else { // 이 무기가 다 떨어졌다: 강화 레벨·신성·붙인 주괴를 작업대에 맡겨 두었다가 완성품에 이어준다
      inv.items.splice(inv.items.indexOf(id), 1);
      delete inv.copies[id];
      job.carry = { wlevel: inv.wlevel && inv.wlevel[id], holy: inv.holy && inv.holy[id], attach: inv.attach[id] ? inv.attach[id].slice(0, slotsOf(nxt)) : null };
      if (inv.wlevel) delete inv.wlevel[id];
      if (inv.holy) delete inv.holy[id];
      delete inv.attach[id];
      for (let k = 0; k < inv.hotbar.length; k++) if (inv.hotbar[k] === id) { inv.hotbar[k] = null; job.hot.push(k); }
      if (inv.equipped.weapon === id) {
        job.equip = true;
        if (!inv.items.includes('wood0')) inv.items.push('wood0');
        inv.equipped.weapon = 'wood0';
      }
    }
    inv.forgeJob = job;
    dirty = true;
    return { ok: true, msg: by === 'smith' ? `대장장이가 맡았다! 1분 뒤에 ${nxt.name}이(가) 완성돼요. 그동안 다른 일을 해도 돼요.` : `합치기 시작! 용광로 곁에서 1분을 기다리세요 (자리를 뜨면 멈춰요).` };
  }

  // 시간을 흘린다. near = 지금 용광로 곁인가 (직접 하는 작업은 곁에 있을 때만 간다). 방금 완성되면 true
  function tickJob(inv, dt, near) {
    const j = inv.forgeJob;
    if (!j || j.done) return false;
    if (j.by === 'smith' || near) j.t += dt;
    if (j.t >= j.total) { j.t = j.total; j.done = true; dirty = true; return true; }
    return false;
  }

  // 완성된 무기를 찾는다
  function collectJob(inv) {
    const j = inv.forgeJob;
    if (!j) return { ok: false, msg: '맡긴 작업이 없어요.' };
    if (!j.done) return { ok: false, msg: `아직 만드는 중이에요 (${Math.ceil(j.total - j.t)}초 남음)` };
    ensure(inv);
    const nxt = ITEMS[j.to];
    addCopy(inv, nxt.id);
    if (j.carry) {
      if (j.carry.wlevel) { inv.wlevel = inv.wlevel || {}; inv.wlevel[nxt.id] = Math.max(inv.wlevel[nxt.id] || 0, j.carry.wlevel); }
      if (j.carry.holy) { inv.holy = inv.holy || {}; inv.holy[nxt.id] = Math.max(inv.holy[nxt.id] || 0, j.carry.holy); }
      if (j.carry.attach && !(inv.attach[nxt.id] && inv.attach[nxt.id].length)) inv.attach[nxt.id] = j.carry.attach;
    }
    for (const k of j.hot) if (inv.hotbar[k] === null) inv.hotbar[k] = nxt.id;
    if (j.equip) inv.equipped.weapon = nxt.id;
    inv.forgeJob = null;
    const up = addSmithXp(inv, XP.merge(nxt.tier || 1));
    dirty = true;
    return { ok: true, msg: `${nxt.name} 완성! 찾았다${nxt.tier >= MAX_TIER ? ' (최대 단계!)' : ''}${up ? ` 대장 Lv ${up}!` : ''}`, item: nxt };
  }

  // 제련: 광석 3개 -> 주괴 1개
  // 녹일 수 있는지만 점검한다 (아무것도 바꾸지 않는다)
  function smeltCheck(inv, oreId, wallet) {
    ensure(inv);
    const o = ORE[oreId];
    const have = inv.ores[oreId] || 0;
    if (have < SMELT_NEED) return { ok: false, msg: `${o.name} 광석이 ${SMELT_NEED - have}개 더 필요해요.` };
    if (wallet.coins < smeltFee(o)) return { ok: false, msg: '코인이 부족해요.' };
    return { ok: true };
  }

  function smelt(inv, oreId, wallet) {
    const chk = smeltCheck(inv, oreId, wallet);
    if (!chk.ok) return chk;
    const o = ORE[oreId];
    const have = inv.ores[oreId] || 0;
    const fee = smeltFee(o);
    wallet.coins -= fee;
    inv.ores[oreId] = have - SMELT_NEED;
    inv.ingots[oreId] = (inv.ingots[oreId] || 0) + 1;
    dirty = true;
    return { ok: true, msg: `${o.name} 광석 ${SMELT_NEED}개를 녹여 ${o.name} 주괴를 만들었다! (보유 ${inv.ingots[oreId]}개)` };
  }

  // 붙이기: 지금 든 무기에 주괴 하나. 무기 종류(검/총)에 맞는 주괴만, 칸이 남아 있을 때만
  // 붙일 수 있는지만 점검한다 (아무것도 바꾸지 않는다)
  function attachCheck(inv, oreId, wallet) {
    ensure(inv);
    const w = targetItem(inv);
    const o = ORE[oreId];
    if (classOf(w) !== o.cls) return { ok: false, msg: `${o.name} 주괴는 ${CLS_NAME[o.cls]}에만 붙일 수 있어요.` };
    const list = inv.attach[w.id] || [];
    if (list.length >= slotsOf(w)) return { ok: false, msg: `${w.name}은(는) 더 붙일 칸이 없어요 (${list.length}/${slotsOf(w)}).${w.slot === 'weapon' ? ' 무기를 합치면 칸이 늘어요.' : ''}` };
    if ((inv.ingots[oreId] || 0) < 1) return { ok: false, msg: `${o.name} 주괴가 없어요.` };
    if (wallet.coins < attachFee(o)) return { ok: false, msg: '코인이 부족해요.' };
    return { ok: true };
  }

  function attach(inv, oreId, wallet) {
    const chk = attachCheck(inv, oreId, wallet);
    if (!chk.ok) return chk;
    const w = targetItem(inv);
    const o = ORE[oreId];
    const list = (inv.attach[w.id] = inv.attach[w.id] || []);
    const fee = attachFee(o);
    wallet.coins -= fee;
    inv.ingots[oreId] -= 1;
    list.push(oreId);
    dirty = true;
    return { ok: true, msg: `${w.name}에 ${o.name} 주괴를 붙였다! (${list.length}/${slotsOf(w)}) ${bonusText(o.bonus)}` };
  }

  // 떼어내기: 가장 나중에 붙인 주괴를 뗀다 (주괴는 부서져 사라진다)
  function detach(inv) {
    ensure(inv);
    const w = targetItem(inv);
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
  const sigOf = (inv) => `${sum(inv.materials)}|${target}|${inv.equipped.weapon}|${(inv.attach[targetId(inv)] || []).join(',')}|${inv.items.length}|${sum(inv.copies)}|${sum(inv.ores)}|${sum(inv.ingots)}|${(inv.attach[inv.equipped.weapon] || []).join(',')}|${inv.items.filter((i) => ITEMS[i] && ITEMS[i].pickaxe).length}`;

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
    const cls = hasTarget() ? classOf(targetItem(inv)) : null;
    const list = ORES.filter((o) => (inv.ores[o.id] || 0) > 0 && (!cls || o.cls === cls)).sort((a, b) => ((inv.ores[b.id] >= SMELT_NEED) - (inv.ores[a.id] >= SMELT_NEED)) || a.tier - b.tier);
    if (!list.length) return [infoCard('제련할 광석이 없어요', ['광물 동굴에서 곡괭이로 광석을 캐 오세요 (마을의 동굴 문).', `광석 ${SMELT_NEED}개를 녹이면 주괴 1개가 돼요`], ITEMS.ore_iron)];
    return list.map((o) => card({
      id: `smelt:${o.id}`, kind: 'smelt', icon: ITEMS['ore_' + o.id],
      view: (i) => { const n = i.ores[o.id] || 0; return { name: `${o.name} 광석 ${n}개  →  ${o.name} 주괴`, desc: n >= SMELT_NEED ? `${SMELT_NEED}개를 녹여 주괴 1개 (온도 맞추기 · 수수료 ${smeltFee(o)} G)` : `${SMELT_NEED - n}개 더 필요해요`, note: `${CLS_NAME[o.cls]}용 · ${bonusText(o.bonus)}` }; },
      label: (i) => ((i.ores[o.id] || 0) >= SMELT_NEED ? `${smeltFee(o)} G` : '재료 부족'),
      afford: (i, coins) => (i.ores[o.id] || 0) >= SMELT_NEED && coins >= smeltFee(o),
      run: (wallet) => { const c = smeltCheck(wallet.inv, o.id, wallet); return c.ok ? { ok: true, minigame: 'smelt', ore: o.id, msg: '' } : c; }, // 점검을 통과하면 온도 맞추기 미니게임을 연다
    }));
  }

  function crystalCards(inv) {
    return CRYSTAL_RECIPES.map((r) => card({
      id: `crystal:${r.from}`, kind: 'crystal', icon: ITEMS[r.to],
      view: (i) => { const n = (i.materials && i.materials[r.from]) || 0; return { name: `${ITEMS[r.from].name} ${Math.min(n, 99)}/3  →  ${ITEMS[r.to].name}`, desc: n >= 3 ? `3개를 합쳐 ${ITEMS[r.to].name} 1개 (수수료 ${r.fee} G)` : `${3 - n}개 더 있으면 합칠 수 있어요`, note: r.from === 'darkcrystal' ? '보스가 떨어뜨린 크리스탈 3개로 숲의 샘물 없이 정화' : '정화된 크리스탈 3개로 화산의 제단 없이 신성화' }; },
      label: (i) => (((i.materials && i.materials[r.from]) || 0) >= 3 ? `${r.fee} G` : '재료 부족'),
      afford: (i, coins) => ((i.materials && i.materials[r.from]) || 0) >= 3 && coins >= r.fee,
      run: (wallet) => crystalMerge(wallet.inv, r.from, wallet),
    }));
  }

  function attachCards(inv) {
    const w = targetItem(inv);
    const cls = classOf(w);
    const list = inv.attach[w.id] || [];
    const head = card({
      id: 'attach:info', kind: 'info', icon: w,
      view: (i) => { const l = i.attach[w.id] || []; return { name: `${hasTarget() ? '강화 대상' : '지금 든 무기'}: ${w.name}  (${CLS_NAME[cls]}용 주괴 · 붙인 칸 ${l.length}/${slotsOf(w)})`, desc: l.length ? `붙인 것: ${l.map((x) => ORE[x].name).join(', ')}` : '아직 붙인 주괴가 없어요', note: '다른 무기에 붙이려면 인벤토리(I)에서 그 무기를 들고 오세요' }; },
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
        run: (wallet) => { const c = attachCheck(wallet.inv, o.id, wallet); return c.ok ? { ok: true, minigame: 'attach', ore: o.id, msg: '' } : c; }, // 점검을 통과하면 부착 미니게임을 연다
      }));
    }
    if (!ingots.length) out.push(infoCard(`${CLS_NAME[cls]}에 붙일 주괴가 없어요`, [`${CLS_NAME[cls]}용 광석을 캐서 용광로에서 제련하세요.`, cls === 'sword' ? '검용: 철·구리·은·금·미스릴·흑요석·별철·심연석' : '총용: 초석·납·황철석·유황·티타늄·폭렬석·백금·암흑강'], ITEMS[cls === 'sword' ? 'ore_iron' : 'ore_saltpeter']));
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
      ...(hasTarget() && classOf(targetItem(inv)) === 'armor' ? [] : [{ name: '합치기', custom: 'merge', items: [] }]),
      { name: '제련', items: smeltCards(inv) },
      { name: '부착', items: attachCards(inv) },
      { name: '곡괭이', items: pickCards() },
      { name: '크리스탈', items: crystalCards(inv) },
    ];
    cacheSig = sig;
    dirty = false;
    return cache;
  }

  const allBase = Shop.SHOPS.sword.tabs; // 검/대검/단검/지팡이/신성 강화
  const baseTabs = allBase.filter((t) => t.name !== '신성 강화'); // 대장간(무기 상점)에는 무기와 곡괭이만 남긴다
  const holyTab = allBase.filter((t) => t.name === '신성 강화');
  // 대장간(무기 상점): 무기 + 곡괭이. 합치기·제련·부착·신성 강화는 용광로에서 한다
  Object.defineProperty(Shop.SHOPS.sword, 'tabs', { get: () => (bound ? baseTabs.concat(forgeTabs(bound).filter((t) => t.name === '곡괭이')) : baseTabs), configurable: true, enumerable: true });
  Shop.SHOPS.furnace = { title: '용광로' };
  Object.defineProperty(Shop.SHOPS.furnace, 'tabs', { get: () => (bound ? forgeTabs(bound).filter((t) => t.name !== '곡괭이' && t.name !== '크리스탈').concat(!hasTarget() || classOf(targetItem(bound)) === 'sword' ? holyTab : [], forgeTabs(bound).filter((t) => t.name === '크리스탈')) : holyTab), configurable: true, enumerable: true });

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
    gridExtra, describeExtra, forgeTabs, JOB_TIME, setTarget, targetItem, targetId, hasTarget, classOf, slotsOf, PERK_NAME, SMITH_MAX_LV, smithNeed, smithOf, smithEase, addSmithXp, XP, smithWorkFee, entrustWork, crystalMerge, ATTACH_TIME, SMELT_TIME, smeltCheck, smeltFee, SMITH_FEE, attachCheck, attachFee, jobOf, mergeCandidates, startMerge, tickJob, collectJob, bestPick, bestOwnedPick, autoEquipPick, togglePick, markDirty: () => { dirty = true; },
  };
})(window.Game);
