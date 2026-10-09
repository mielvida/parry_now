// 아이템 데이터, 상점 목록, 구매 규칙, 장비 능력치 계산. 화면/입력은 모른다 (main이 호출하고 Renderer가 그린다).
//  - 무기 상점: 검(균형) / 대검(범위 넓음, 쿨다운 느림, 슬라임·꽃게도 한 방) / 단검(범위 좁고 연속 패링이 빠름) / 지팡이(패링하면 마법: 독·번개·불덩이) 탭
//  - 갑옷 가게: 갑옷(최대 피) / 투구(피격 후 무적 시간) / 장갑(패링 지속 시간) / 신발(이동 속도) 탭
//  - 물약 상점: 언제든 살 수 있고 인벤토리에 쌓인다. 피가 모자랄 때 인벤토리(E)나 Q 키로 마신다.
//  - 산 장비는 바로 장착되고, 인벤토리 창(1 키)에서 바꿔 낄 수 있다.
(function (G) {
  const SLOT_NAMES = { weapon: '무기', helmet: '투구', armor: '갑옷', gloves: '장갑', boots: '신발' };
  const TYPE_NAMES = { sword: '검', great: '대검', dagger: '단검', staff: '지팡이' };

  const ITEMS = {};
  const add = (it) => { ITEMS[it.id] = it; };

  // 무기: reach = 패링 범위(몸 둘레, 타일), throwTiles = 던지기 추가 거리(타일), cd = 패링 쿨다운 증감(초), look = [밝은 색, 어두운 색]
  // extra: element = 지팡이가 패링할 때 내보내는 원소(fire/poison/lightning/random), note = 특수 능력 설명
  const weapon = (id, type, name, price, reach, throwTiles, cd, look, extra = {}) => add(Object.assign({ id, slot: 'weapon', type, name, price, reach, throwTiles, cd, look }, extra));
  // 근접 무기의 원소(elem)는 맞힐 때 일어나는 특수 효과다. note = 그 설명, oneHit = 슬라임·꽃게도 첫 타에 처치
  //   gold 황금(처치 코인 +50%) / crystal 수정(주변에 파편 피해) / light 빛(주변 기절) / quake 대지(주변 기절)
  //   fire 화염(불타며 죽음) / ice 얼음(얼면서 부서짐) / thief 도둑(맞힐 때 코인) / cleave 관통(앞의 몬스터도) / shadow 그림자(잠시 무적)
  weapon('sword0', 'sword', '기본 검', 0, 0.3, 0, 0, ['#e8f1ff', '#9db6d6']);
  weapon('sword1', 'sword', '황금 검', 300, 0.4, 1, 0, ['#ffe08a', '#d9a93a'], { elem: 'gold', note: '황금: 처치하면 코인 +50%' });
  weapon('sword2', 'sword', '수정 검', 600, 0.4, 2, 0, ['#9fe8ff', '#4fb5e0'], { elem: 'crystal', note: '수정: 맞은 주변에 파편 피해 1' });
  weapon('sword3', 'sword', '전설의 검', 1000, 0.6, 2, 0, ['#e0a8ff', '#a45ad9'], { elem: 'light', lightRadius: 3, oneHit: true, note: '빛: 주변 3칸 몬스터를 기절시킨다' });
  weapon('great1', 'great', '철 대검', 500, 0.7, 0, 0.3, ['#b8c0cc', '#6c7686'], { elem: 'quake', oneHit: true, note: '대지: 내리치면 주변 몬스터가 기절' });
  weapon('great2', 'great', '화염 대검', 900, 0.9, 0, 0.3, ['#ff9a5a', '#c0391f'], { elem: 'fire', oneHit: true, note: '화염: 불타며 죽고 주변에 불이 옮겨붙는다' });
  weapon('great3', 'great', '서리 대검', 1300, 1.0, 0, 0.25, ['#bfe8ff', '#5fa8d9'], { elem: 'ice', oneHit: true, note: '얼음: 얼면서 부서지고 주변도 얼어붙는다' });
  weapon('great4', 'great', '용사의 대검', 1800, 1.2, 0, 0.2, ['#ffe27a', '#d4a017'], { elem: 'light', lightRadius: 4, oneHit: true, note: '빛: 주변 4칸 몬스터를 기절시킨다' });
  weapon('dagger1', 'dagger', '도적의 단검', 250, 0.25, 2, -0.2, ['#d8e0ea', '#8a93a3'], { elem: 'thief', note: '도둑: 맞힐 때마다 코인 +1' });
  weapon('dagger2', 'dagger', '강철 단검', 500, 0.3, 3, -0.3, ['#b8c0cc', '#6c7686'], { elem: 'cleave', note: '관통: 앞에 있는 몬스터까지 함께 벤다' });
  weapon('dagger3', 'dagger', '그림자 단검', 900, 0.35, 4, -0.35, ['#9a7bff', '#4b2fb8'], { elem: 'shadow', note: '그림자: 맞히면 잠시 공격을 받지 않는다' });
  weapon('staff1', 'staff', '독 지팡이', 350, 0.3, 3, -0.1, ['#8cff6b', '#3fa83a'], { element: 'poison', note: '독: 3초간 지속 피해 (최대 3)' });
  weapon('staff2', 'staff', '번개 지팡이', 700, 0.4, 4, -0.1, ['#fff27a', '#d9b800'], { element: 'lightning', note: '번개: 관통 피해 1 + 기절' });
  weapon('staff3', 'staff', '불꽃 지팡이', 700, 0.3, 3, 0, ['#ff8a4a', '#c0391f'], { element: 'fire', note: '불덩이: 피해 2' });
  weapon('staff4', 'staff', '원소 지팡이', 1200, 0.5, 5, -0.1, ['#e0a8ff', '#a45ad9'], { element: 'random', note: '불덩이·번개·독 중 무작위' });

  // 갑옷: hearts = 늘어나는 최대 피(칸), look = [몸통, 어깨]
  const armor = (id, name, price, hearts, look) => add({ id, slot: 'armor', name, price, hearts, look });
  armor('armor0', '기본 갑옷', 0, 0, ['#3b6fd4', '#5b8ff0']);
  armor('armor1', '가죽 갑옷', 200, 1, ['#8a5a2b', '#b8803f']);
  armor('armor2', '강철 갑옷', 450, 2, ['#9aa4b2', '#d0d8e4']);
  armor('armor3', '용사의 갑옷', 800, 3, ['#d4a017', '#ffe27a']);

  // 투구: invuln = 피격 후 무적 시간 증가(초), look = [투구, 하이라이트]
  const helmet = (id, name, price, invuln, look) => add({ id, slot: 'helmet', name, price, invuln, look });
  helmet('helmet1', '가죽 투구', 150, 0.3, ['#8a5a2b', '#b8803f']);
  helmet('helmet2', '강철 투구', 350, 0.6, ['#7c8594', '#c0c8d4']);
  helmet('helmet3', '용사의 투구', 600, 1.0, ['#d4a017', '#ffe27a']);

  // 장갑: window = 패링 지속 시간 증가(초), look = [본체, 소매]
  const gloves = (id, name, price, win, look) => add({ id, slot: 'gloves', name, price, window: win, look });
  gloves('gloves1', '가죽 장갑', 150, 0.05, ['#8a5a2b', '#5a3d17']);
  gloves('gloves2', '강철 장갑', 300, 0.1, ['#b8c0cc', '#6c7686']);
  gloves('gloves3', '용사의 장갑', 500, 0.15, ['#ffd54a', '#b8860b']);

  // 신발: speed = 이동 속도 증가율, look = [본체, 밑창]
  const boots = (id, name, price, speed, look) => add({ id, slot: 'boots', name, price, speed, look });
  boots('boots1', '가죽 신발', 150, 0.1, ['#8a5a2b', '#5a3d17']);
  boots('boots2', '강철 신발', 300, 0.2, ['#b8c0cc', '#6c7686']);
  boots('boots3', '바람의 신발', 500, 0.3, ['#7dffd0', '#2fa88a']);

  // 물약: 사서 인벤토리에 쌓아 두었다가 나중에 마신다 (heal = 회복하는 피 칸 수)
  add({ id: 'potion1', name: '치유 물약', desc: '피 1칸 회복', price: 100, heal: 1, look: ['#e8334a'] });
  add({ id: 'potion2', name: '회복 물약', desc: '피 2칸 회복', price: 180, heal: 2, look: ['#c79cf0'] });
  const POTION_IDS = ['potion1', 'potion2'];
  const POTION_NOTE = '인벤토리에서 E / 게임 중 Q 로 마시기';

  // 아이템 한 개의 이름/설명 (상점과 인벤토리 창이 보여준다)
  function describe(item) {
    if (item.heal !== undefined) return { name: item.name, desc: item.desc, slotName: '물약', note: POTION_NOTE };
    const parts = [];
    if (item.slot === 'weapon') {
      parts.push(`범위 ${item.reach}칸`);
      if (item.type === 'great') parts.push('던지기 불가');
      else if (item.throwTiles) parts.push(`던지기 +${item.throwTiles}칸`);
      if (item.cd) parts.push(`쿨다운 ${item.cd > 0 ? '+' : ''}${item.cd}초`);
      if (item.oneHit) parts.push('슬라임·꽃게 한 방');
      return { name: item.name, desc: parts.join(', '), slotName: TYPE_NAMES[item.type], note: item.note || '' };
    }
    if (item.slot === 'armor') parts.push(`최대 피 +${item.hearts}칸`);
    if (item.slot === 'helmet') parts.push(`피격 후 무적 +${item.invuln}초`);
    if (item.slot === 'gloves') parts.push(`패링 지속 +${item.window}초`);
    if (item.slot === 'boots') parts.push(`이동 속도 +${Math.round(item.speed * 100)}%`);
    return { name: item.name, desc: parts.join(', '), slotName: SLOT_NAMES[item.slot], note: '' };
  }

  const ids = (...list) => list.map((id) => ITEMS[id]);
  const SHOPS = {
    potion: {
      title: '물약 상점',
      tabs: [{ name: '물약', items: ids('potion1', 'potion2') }],
    },
    sword: {
      title: '무기 상점',
      tabs: [
        { name: '검', items: ids('sword1', 'sword2', 'sword3') },
        { name: '대검', items: ids('great1', 'great2', 'great3', 'great4') },
        { name: '단검', items: ids('dagger1', 'dagger2', 'dagger3') },
        { name: '지팡이', items: ids('staff1', 'staff2', 'staff3', 'staff4') },
      ],
    },
    armor: {
      title: '갑옷 가게',
      tabs: [
        { name: '갑옷', items: ids('armor1', 'armor2', 'armor3') },
        { name: '투구', items: ids('helmet1', 'helmet2', 'helmet3') },
        { name: '장갑', items: ids('gloves1', 'gloves2', 'gloves3') },
        { name: '신발', items: ids('boots1', 'boots2', 'boots3') },
      ],
    },
  };

  // 인벤토리: items = 가진 아이템 id (얻은 순서), equipped = 칸별로 낀 아이템 id (장갑/신발은 비어 있을 수 있다)
  function newInventory() {
    return {
      items: ['sword0', 'armor0'],
      potions: { potion1: 0, potion2: 0 }, // 물약 개수
      equipped: { weapon: 'sword0', helmet: null, armor: 'armor0', gloves: null, boots: null },
    };
  }

  // 낀 장비의 능력치 합계
  function stats(inv) {
    const w = ITEMS[inv.equipped.weapon];
    const a = ITEMS[inv.equipped.armor];
    const h = inv.equipped.helmet ? ITEMS[inv.equipped.helmet] : null;
    const g = inv.equipped.gloves ? ITEMS[inv.equipped.gloves] : null;
    const b = inv.equipped.boots ? ITEMS[inv.equipped.boots] : null;
    return {
      reachTiles: w.reach,
      throwTiles: w.throwTiles,
      canThrow: w.type !== 'great', // 대검은 던질 수 없다
      cooldownAdd: w.cd,
      hearts: a ? a.hearts : 0,
      invulnAdd: h ? h.invuln : 0,
      windowAdd: g ? g.window : 0,
      speedAdd: b ? b.speed : 0,
    };
  }

  const maxLivesFor = (inv, base) => base + stats(inv).hearts;

  // 구매 시도. wallet = { coins, lives, maxLives, inv }를 직접 고치고, 결과 메시지를 돌려준다
  function buy(item, wallet) {
    if (item.slot && wallet.inv.items.includes(item.id)) return { ok: false, msg: '이미 가지고 있어요.' };
    if (wallet.coins < item.price) return { ok: false, msg: '코인이 부족해요.' };
    wallet.coins -= item.price;
    if (item.heal !== undefined) { // 물약은 바로 마시지 않고 가방에 넣는다 (피가 가득이어도 살 수 있다)
      const n = (wallet.inv.potions[item.id] || 0) + 1;
      wallet.inv.potions[item.id] = n;
      return { ok: true, msg: `${item.name} 구매! (보유 ${n}개)` };
    }
    if (item.slot) { // 산 장비는 바로 장착한다
      wallet.inv.items.push(item.id);
      wallet.inv.equipped[item.slot] = item.id;
      return { ok: true, msg: `${item.name} 구매! 장착했다.` };
    }
    return { ok: true, msg: `${item.name} 구매!` };
  }

  // 인벤토리 격자에 들어갈 칸 목록: 장비(얻은 순서) 다음에 가진 물약(개수 포함)
  function gridEntries(inv) {
    return inv.items.map((id) => ({ id })).concat(POTION_IDS.filter((id) => inv.potions[id] > 0).map((id) => ({ id, count: inv.potions[id] })));
  }

  // 물약을 마신다. 피가 가득이면 마시지 않는다. 결과 { ok, lives, msg }
  function usePotion(inv, id, lives, maxLives) {
    const it = ITEMS[id];
    if (!inv.potions[id]) return { ok: false, lives, msg: '물약이 없어요.' };
    if (lives >= maxLives) return { ok: false, lives, msg: '피가 가득 차 있어요.' };
    inv.potions[id] -= 1;
    const healed = Math.min(maxLives, lives + it.heal) - lives;
    return { ok: true, lives: lives + healed, healed, msg: `${it.name}을 마셨다! 피 +${healed}` };
  }

  // Q 키로 마실 물약 고르기: 2칸 넘게 모자라면 회복 물약, 아니면 치유 물약을 우선 (없으면 있는 것). 마실 수 있는 게 없으면 null
  function bestPotion(inv, lives, maxLives) {
    const missing = maxLives - lives;
    if (missing <= 0) return null;
    const has = (id) => inv.potions[id] > 0;
    if (missing >= 2 && has('potion2')) return 'potion2';
    if (has('potion1')) return 'potion1';
    if (has('potion2')) return 'potion2';
    return null;
  }

  G.Shop = { ITEMS, SHOPS, SLOT_NAMES, TYPE_NAMES, newInventory, describe, stats, maxLivesFor, buy, gridEntries, usePotion, bestPotion };
})(window.Game);
