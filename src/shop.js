// 아이템 데이터, 상점 목록, 구매 규칙, 장비 능력치 계산. 화면/입력은 모른다 (main이 호출하고 Renderer가 그린다).
//  - 무기 상점: 검(균형) / 대검(범위 넓음, 쿨다운 느림, 슬라임·꽃게도 한 방) / 단검(범위 좁고 연속 패링이 빠름) / 지팡이(패링하면 마법: 독·번개·불덩이) 탭
//  - 갑옷 가게: 갑옷(최대 피) / 투구(피격 후 무적 시간) / 장갑(패링 지속 시간) / 신발(이동 속도) 탭
//  - 물약 상점: 언제든 살 수 있고 인벤토리에 쌓인다. 피가 모자랄 때 인벤토리(E)나 Q 키로 마신다.
//  - 산 장비는 바로 장착되고, 인벤토리 창(1 키)에서 바꿔 낄 수 있다.
(function (G) {
  const SLOT_NAMES = { weapon: '무기', helmet: '투구', armor: '갑옷', gloves: '장갑', boots: '신발' };
  const TYPE_NAMES = { sword: '검', great: '대검', dagger: '단검', staff: '지팡이', bomb: '폭탄', gun: '총', bow: '활', shield: '방패' };

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

  // ---- 다크월드 무기 상점: 폭탄 던지기 / 총 / 활 / 방패 (shot = 쏘는 것, dmg = 대미지, stamina = 한 번에 드는 스태미나) ----
  weapon('bomb1', 'bomb', '흑색 폭탄', 1500, 0.2, 0, 0.2, ['#3a3a44', '#ff9a3a'], { shot: 'bomb', dmg: 3, radius: 2, stamina: 15, note: '던지면 터져 주변 2칸에 피해 3' });
  weapon('bomb2', 'bomb', '화약 폭탄', 3000, 0.2, 0, 0.2, ['#5a3a2a', '#ffcf3a'], { shot: 'bomb', dmg: 5, radius: 2.5, stamina: 20, note: '주변 2.5칸에 피해 5' });
  weapon('bomb3', 'bomb', '어둠 폭탄', 6000, 0.2, 0, 0.2, ['#2a1250', '#c07aff'], { shot: 'bomb', dmg: 8, radius: 3, stamina: 25, note: '주변 3칸에 피해 8' });
  weapon('gun1', 'gun', '낡은 권총', 1800, 0.2, 0, 0.1, ['#8a8f9a', '#4a4f5a'], { shot: 'bullet', dmg: 3, stamina: 12, note: '빠른 탄환 피해 3' });
  weapon('gun2', 'gun', '소총', 3500, 0.2, 0, 0.1, ['#6b4423', '#c9d2dc'], { shot: 'bullet', dmg: 5, stamina: 16, note: '빠른 탄환 피해 5' });
  weapon('gun3', 'gun', '어둠의 총', 7000, 0.2, 0, 0.1, ['#2a1250', '#c07aff'], { shot: 'bullet', dmg: 8, stamina: 20, pierce: true, note: '관통 탄환 피해 8' });
  weapon('bow1', 'bow', '사냥 활', 1500, 0.2, 0, 0, ['#8a5a2b', '#e8d8a8'], { shot: 'arrow', dmg: 3, stamina: 8, note: '화살 피해 3' });
  weapon('bow2', 'bow', '장궁', 3000, 0.2, 0, -0.1, ['#6b4423', '#9fd8f0'], { shot: 'arrow', dmg: 5, stamina: 10, note: '화살 피해 5, 쿨다운 짧음' });
  weapon('bow3', 'bow', '어둠의 활', 6500, 0.2, 0, 0, ['#2a1250', '#c07aff'], { shot: 'arrow', dmg: 7, stamina: 14, count: 3, note: '화살 세 발 (피해 7)' });
  weapon('shield1', 'shield', '나무 방패', 1200, 0.7, 0, 0.1, ['#a66a33', '#6b4423'], { windowAdd: 0.1, note: '방패: 패링 범위가 넓다' });
  weapon('shield2', 'shield', '철 방패', 2800, 0.8, 0, 0.1, ['#b8c0cc', '#6c7686'], { windowAdd: 0.2, note: '방패: 범위 넓고 패링이 오래 간다' });
  weapon('shield3', 'shield', '어둠 방패', 6000, 0.9, 0, 0.1, ['#6a2fb0', '#2a1250'], { windowAdd: 0.3, note: '방패: 가장 넓고 오래 막는다' });

  // ---- 다크월드 아이템 상점 (소모품): 스태미나는 인벤토리에서 쓰거나 V 키, 얼음 폭탄은 B 키로 던진다 ----
  add({ id: 'st70', name: '스태미나 +70', desc: '스태미나를 70 회복', price: 120, consumable: true, stamina: 70, look: ['#7dffd0', '#2fa88a'] });
  add({ id: 'st30', name: '스태미나 +30', desc: '스태미나를 30 회복', price: 60, consumable: true, stamina: 30, look: ['#bfffe8', '#4fc8a0'] });
  add({ id: 'icebomb', name: '얼음 폭탄', desc: '던지면 주변 3칸 몬스터가 얼어붙는다', price: 150, consumable: true, bomb: 'ice', look: ['#bfe8ff', '#5fa8d9'], note: 'B 키로 던진다' });
  const CONSUMABLE_IDS = ['st70', 'st30', 'icebomb'];

  // 물약: 사서 인벤토리에 쌓아 두었다가 나중에 마신다 (heal = 회복하는 피 칸 수)
  add({ id: 'potion1', name: '치유 물약', desc: '피 1칸 회복', price: 100, heal: 1, look: ['#e8334a'] });
  add({ id: 'potion2', name: '회복 물약', desc: '피 2칸 회복', price: 180, heal: 2, look: ['#c79cf0'] });
  const POTION_IDS = ['potion1', 'potion2'];

  const MATERIAL_IDS = ['darkcrystal'];

  // ---- 집과 장식품 (마을에 정착하기) ----
  // 집: 종류마다 방 크기(cols)와 꾸밀 수 있는 자리 수(바닥 floor / 벽 wall)가 다르다. 하나를 사서 살고, 다른 집을 사면 이사한다
  const HOUSES = [
    { id: 'house1', name: '작은 오두막', price: 500, cols: 30, floor: 3, wall: 2 },
    { id: 'house2', name: '통나무집', price: 1500, cols: 32, floor: 4, wall: 3 },
    { id: 'house3', name: '벽돌집', price: 3500, cols: 36, floor: 5, wall: 4 },
    { id: 'house4', name: '해변 별장', price: 7000, cols: 42, floor: 6, wall: 5 },
    { id: 'house5', name: '저택', price: 15000, cols: 52, floor: 8, wall: 6 },
  ];
  HOUSES.forEach((h) => add(Object.assign({ house: true }, h)));
  // 장식품: place = 'floor' 바닥 가구 / 'wall' 벽 장식. 사서 방의 빈 자리에 놓는다 (여러 개 살 수 있다)
  const DECOR = [
    { id: 'd_bed', name: '침대', price: 300, place: 'floor' },
    { id: 'd_shelf', name: '책장', price: 250, place: 'floor' },
    { id: 'd_table', name: '식탁', price: 280, place: 'floor' },
    { id: 'd_sofa', name: '소파', price: 350, place: 'floor' },
    { id: 'd_plant', name: '화분', price: 120, place: 'floor' },
    { id: 'd_stove', name: '난로', price: 400, place: 'floor' },
    { id: 'd_tank', name: '어항', price: 450, place: 'floor' },
    { id: 'd_trophy', name: '진열장', price: 600, place: 'floor' },
    { id: 'd_painting', name: '풍경 그림', price: 150, place: 'wall' },
    { id: 'd_clock', name: '벽시계', price: 180, place: 'wall' },
    { id: 'd_swords', name: '검 장식', price: 300, place: 'wall' },
    { id: 'd_map', name: '세계 지도', price: 200, place: 'wall' },
    { id: 'd_flag', name: '깃발', price: 160, place: 'wall' },
    { id: 'd_candle', name: '촛대', price: 120, place: 'wall' },
    { id: 'd_deer', name: '사슴 머리', price: 400, place: 'wall' },
    { id: 'd_mirror', name: '거울', price: 220, place: 'wall' },
  ];
  DECOR.forEach((d) => add(Object.assign({ decor: true }, d)));
  const placedCount = (inv, id) => ['floor', 'wall'].reduce((n, k) => n + inv.home.placed[k].filter((x) => x === id).length, 0);
  // 집에 놓은 장식품 수에 따른 보너스: 놓을 때마다 코인 획득량과 치명타 확률이 오른다
  const placedTotal = (inv) => inv.home.placed.floor.filter(Boolean).length + inv.home.placed.wall.filter(Boolean).length;
  const homeBonuses = (inv) => { const n = placedTotal(inv); return { n, coin: n * C.DECOR_COIN_BONUS, crit: Math.min(1, C.CRIT_BASE_CHANCE + n * C.DECOR_CRIT_BONUS) }; };
  const decorLeft = (inv, id) => (inv.home.owned[id] || 0) - placedCount(inv, id); // 아직 안 놓은 개수
  // 방의 자리(kind, index)에 장식품을 놓는다 (id가 null이면 치우기). 결과 { ok, msg }
  function placeDecor(inv, kind, index, id) {
    const cur = inv.home.placed[kind][index];
    if (id === null) {
      if (!cur) return { ok: false, msg: '치울 것이 없어요.' };
      inv.home.placed[kind][index] = null;
      return { ok: true, msg: `${ITEMS[cur].name}을(를) 치웠다.` };
    }
    if (cur === id) return { ok: false, msg: '이미 놓여 있어요.' };
    if (decorLeft(inv, id) <= 0) return { ok: false, msg: '남은 것이 없어요. 가게에서 더 살 수 있어요.' };
    inv.home.placed[kind][index] = id;
    return { ok: true, msg: `${ITEMS[id].name}을(를) 놓았다.` };
  }
  // 꾸미기 창의 물품 목록: 가진 장식품(그 자리에 놓을 수 있는 종류) + 치우기. 5개 넘으면 4개씩 쪽으로 나눈다
  function placeTabs(inv, kind) {
    const list = [{ id: 'clear', clear: true, name: '치우기' }].concat(DECOR.filter((d) => d.place === kind && (inv.home.owned[d.id] || 0) > 0).map((d) => ITEMS[d.id]));
    if (list.length <= 5) return [{ name: '놓기', items: list }];
    const tabs = [];
    for (let k = 0; k < list.length; k += 4) tabs.push({ name: `${tabs.length + 1}쪽`, items: list.slice(k, k + 4) });
    return tabs;
  }
  // 소중한 물건 (quest): 보스가 쓰러질 때마다 하나씩 떨어뜨리고 개수가 쌓인다. 장착하거나 쓸 수 없고 인벤토리에 간직한다
  add({ id: 'darkcrystal', name: '어둠의 크리스탈', desc: '보스가 떨어뜨린 보랏빛 수정. 깊은 어둠의 힘이 느껴진다', quest: true, look: ['#8a4fe0', '#2a1250'] });

  // 보상 상점의 업그레이드 두 가지 (레벨은 인벤토리에 저장되어 스테이지가 바뀌어도 유지된다)
  //  mine  동굴 보상: 마을 동굴 보물 상자의 코인 (1레벨 100 G -> 15레벨 450 G). 처음부터 1레벨
  //  speed 마을 달리기: 마을에서만 이동 속도가 빨라진다 (0레벨 1배 -> 5레벨 5배). 처음엔 0레벨
  add({ id: 'mineup', name: '동굴 보상 업그레이드', upgrade: 'mine', look: ['#ffd54a', '#b8860b'] });
  add({ id: 'speedup', name: '마을 달리기 업그레이드', upgrade: 'speed', look: ['#7dffd0', '#2fa88a'] });
  //  crit  치명타: 치명타가 터지면 이 대미지를 준다 (0레벨 10 -> 20레벨 30). 치명타 확률은 집에 장식품을 놓을수록 오른다
  add({ id: 'critup', name: '치명타 업그레이드', upgrade: 'crit', look: ['#ffd54a', '#e8334a'] });
  const C = G.Config;
  const mineReward = (level) => C.MINE_COINS + C.MINE_COINS_PER_LEVEL * (Math.min(level, C.MINE_MAX_LEVEL) - 1);
  const speedMult = (level) => 1 + ((C.VILLAGE_SPEED_MAX - 1) * Math.min(level, C.VILLAGE_SPEED_LEVELS)) / C.VILLAGE_SPEED_LEVELS;
  const critDamage = (inv) => C.CRIT_BASE_DAMAGE + Math.min(inv.critLevel, C.CRIT_MAX_LEVEL);
  const levelOf = (item, inv) => (item.upgrade === 'mine' ? inv.mineLevel : item.upgrade === 'crit' ? inv.critLevel : inv.speedLevel);
  const maxLevelOf = (item) => (item.upgrade === 'mine' ? C.MINE_MAX_LEVEL : item.upgrade === 'crit' ? C.CRIT_MAX_LEVEL : C.VILLAGE_SPEED_LEVELS);
  const upMaxed = (item, inv) => !!item.upgrade && levelOf(item, inv) >= maxLevelOf(item);
  // 다음 레벨로 올리는 가격 (최고 레벨이면 0). 업그레이드가 아닌 아이템은 원래 가격
  function priceOf(item, inv) {
    if (!item.upgrade) return item.price;
    if (upMaxed(item, inv)) return 0;
    if (item.upgrade === 'crit') return C.CRIT_UPGRADE_PRICE + C.CRIT_UPGRADE_STEP * inv.critLevel;
    return item.upgrade === 'mine' ? C.MINE_UPGRADE_PRICE + C.MINE_UPGRADE_STEP * (inv.mineLevel - 1) : C.VILLAGE_SPEED_PRICE + C.VILLAGE_SPEED_STEP * inv.speedLevel;
  }
  const fmtX = (v) => (Math.round(v * 10) / 10).toString();

  const POTION_NOTE = '인벤토리에서 E / 게임 중 Q 로 마시기';

  // 아이템 한 개의 이름/설명 (상점과 인벤토리 창이 보여준다)
  function describe(item, inv) {
    if (item.upgrade === 'mine') {
      const lv = inv ? inv.mineLevel : 1;
      const desc = lv >= C.MINE_MAX_LEVEL ? `최고 레벨! 동굴 보물 상자가 ${mineReward(lv)} G를 줍니다` : `동굴 보물 상자 ${mineReward(lv)} G -> ${mineReward(lv + 1)} G`;
      return { name: `${item.name}  Lv ${lv}/${C.MINE_MAX_LEVEL}`, desc, slotName: '업그레이드', note: '레벨마다 상자 코인 +' + C.MINE_COINS_PER_LEVEL + ' G (최대 ' + mineReward(C.MINE_MAX_LEVEL) + ' G)' };
    }
    if (item.upgrade === 'crit') {
      const lv = inv ? inv.critLevel : 0;
      const desc = lv >= C.CRIT_MAX_LEVEL ? `최고 레벨! 치명타 대미지 ${critDamage(inv)}` : `치명타 대미지 ${C.CRIT_BASE_DAMAGE + lv} -> ${C.CRIT_BASE_DAMAGE + lv + 1}`;
      const bonus = inv ? homeBonuses(inv) : { crit: C.CRIT_BASE_CHANCE };
      return { name: `${item.name}  Lv ${lv}/${C.CRIT_MAX_LEVEL}`, desc, slotName: '업그레이드', note: `치명타 확률은 장식을 놓을수록 오른다 (지금 ${Math.round(bonus.crit * 1000) / 10}%)` };
    }
    if (item.upgrade === 'speed') {
      const lv = inv ? inv.speedLevel : 0;
      const desc = lv >= C.VILLAGE_SPEED_LEVELS ? `최고 레벨! 마을에서 이동 속도 ${fmtX(speedMult(lv))}배` : `마을 이동 속도 ${fmtX(speedMult(lv))}배 -> ${fmtX(speedMult(lv + 1))}배`;
      return { name: `${item.name}  Lv ${lv}/${C.VILLAGE_SPEED_LEVELS}`, desc, slotName: '업그레이드', note: '마을에서만 빨라진다 (최대 ' + fmtX(speedMult(C.VILLAGE_SPEED_LEVELS)) + '배)' };
    }
    if (item.consumable) return { name: item.name, desc: item.desc, slotName: '소모품', note: item.note || (inv ? `보유 ${inv.consumables[item.id] || 0}개` : '') };
    if (item.clear) return { name: item.name, desc: '이 자리의 장식을 치워 둡니다', slotName: '', note: '' };
    if (item.house) {
      const here = inv && inv.home.type === item.id;
      return { name: item.name, desc: `방 크기 ${item.cols}칸 · 바닥 가구 ${item.floor}자리, 벽 장식 ${item.wall}자리`, slotName: '집', note: here ? '지금 살고 있는 집' : '사면 마을의 빈 터에 지어집니다 (이사)' };
    }
    if (item.decor) {
      const own = inv ? inv.home.owned[item.id] || 0 : 0;
      return { name: item.name, desc: item.place === 'floor' ? '바닥에 놓는 가구' : '벽에 거는 장식', slotName: '장식품', note: inv ? `보유 ${own}개 · 남은 ${decorLeft(inv, item.id)}개` : '' };
    }
    if (item.quest) return { name: item.name, desc: item.desc, slotName: '소중한 물건', note: '장착하거나 쓸 수 없는 보물' };
    if (item.heal !== undefined) return { name: item.name, desc: item.desc, slotName: '물약', note: POTION_NOTE };
    const parts = [];
    if (item.slot === 'weapon') {
      if (item.shot) { // 폭탄/총/활: 쏘는 무기
        parts.push(`대미지 ${item.dmg}`, `스태미나 -${item.stamina}`);
        if (item.radius) parts.push(`폭발 ${item.radius}칸`);
        return { name: item.name, desc: parts.join(', '), slotName: TYPE_NAMES[item.type], note: item.note || '' };
      }
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
    dweapon: {
      title: '다크월드 무기 상점',
      tabs: [
        { name: '폭탄', items: ids('bomb1', 'bomb2', 'bomb3') },
        { name: '총', items: ids('gun1', 'gun2', 'gun3') },
        { name: '활', items: ids('bow1', 'bow2', 'bow3') },
        { name: '방패', items: ids('shield1', 'shield2', 'shield3') },
      ],
    },
    ditem: {
      title: '다크월드 아이템 상점',
      tabs: [{ name: '아이템', items: ids('st70', 'st30', 'icebomb') }],
    },
    estate: {
      title: '부동산',
      tabs: [{ name: '집', items: HOUSES.map((h) => ITEMS[h.id]) }],
    },
    decor: {
      title: '인테리어 가게',
      tabs: [
        { name: '가구', items: ids('d_bed', 'd_shelf', 'd_table', 'd_sofa') },
        { name: '소품', items: ids('d_plant', 'd_stove', 'd_tank', 'd_trophy') },
        { name: '벽 장식', items: ids('d_painting', 'd_clock', 'd_swords', 'd_map') },
        { name: '벽 소품', items: ids('d_flag', 'd_candle', 'd_deer', 'd_mirror') },
      ],
    },
    mine: {
      title: '동굴 보상 상점',
      tabs: [{ name: '업그레이드', items: ids('mineup', 'speedup', 'critup') }],
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
      materials: { darkcrystal: 0 }, // 보스가 떨어뜨리는 소중한 물건의 개수 (쌓인다)
      consumables: { st70: 0, st30: 0, icebomb: 0 }, // 다크월드 소모품 개수
      home: { type: null, owned: {}, placed: { floor: [], wall: [] } }, // 우리 집: 산 집 종류, 가진 장식품 개수, 방에 놓은 장식품
      mineLevel: 1, // 동굴 보상 업그레이드 레벨 (동굴 보물 상자 코인)
      speedLevel: 0, // 마을 달리기 업그레이드 레벨 (마을에서의 이동 속도)
      critLevel: 0, // 치명타 업그레이드 레벨 (치명타 대미지 = 10 + 레벨)
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
      canThrow: ['sword', 'dagger', 'staff'].includes(w.type), // 대검/폭탄/총/활/방패는 검을 던질 수 없다
      cooldownAdd: w.cd,
      hearts: a ? a.hearts : 0,
      invulnAdd: h ? h.invuln : 0,
      windowAdd: (g ? g.window : 0) + (w.windowAdd || 0),
      speedAdd: b ? b.speed : 0,
    };
  }

  const maxLivesFor = (inv, base) => base + stats(inv).hearts;

  // 구매 시도. wallet = { coins, lives, maxLives, inv }를 직접 고치고, 결과 메시지를 돌려준다
  function buy(item, wallet) {
    if (item.consumable) { // 소모품: 개수가 쌓인다
      if (wallet.coins < item.price) return { ok: false, msg: '코인이 부족해요.' };
      wallet.coins -= item.price;
      const n = (wallet.inv.consumables[item.id] || 0) + 1;
      wallet.inv.consumables[item.id] = n;
      return { ok: true, msg: `${item.name} 구매! (보유 ${n}개)` };
    }
    if (item.house) { // 집 사기: 이미 사는 집이면 안 되고, 다른 집이면 이사 (놓았던 장식품은 새 집의 자리에 그대로 옮겨진다)
      const home = wallet.inv.home;
      if (home.type === item.id) return { ok: false, msg: '이미 살고 있는 집이에요.' };
      if (wallet.coins < item.price) return { ok: false, msg: '코인이 부족해요.' };
      wallet.coins -= item.price;
      home.type = item.id;
      home.placed.floor.length = Math.min(home.placed.floor.length, item.floor);
      home.placed.wall.length = Math.min(home.placed.wall.length, item.wall);
      return { ok: true, msg: `${item.name} 구입! 마을의 빈 터가 우리 집이 되었어요.` };
    }
    if (item.decor) {
      if (wallet.coins < item.price) return { ok: false, msg: '코인이 부족해요.' };
      wallet.coins -= item.price;
      const n = (wallet.inv.home.owned[item.id] || 0) + 1;
      wallet.inv.home.owned[item.id] = n;
      return { ok: true, msg: `${item.name} 구매! (보유 ${n}개) 집의 빈 자리에 놓을 수 있어요.` };
    }
    if (item.upgrade) { // 보상 상점 업그레이드
      if (upMaxed(item, wallet.inv)) return { ok: false, msg: '이미 최고 레벨이에요.' };
      const cost = priceOf(item, wallet.inv);
      if (wallet.coins < cost) return { ok: false, msg: '코인이 부족해요.' };
      wallet.coins -= cost;
      if (item.upgrade === 'mine') {
        wallet.inv.mineLevel += 1;
        return { ok: true, msg: `Lv ${wallet.inv.mineLevel}! 동굴 상자가 이제 ${mineReward(wallet.inv.mineLevel)} G를 줍니다.` };
      }
      if (item.upgrade === 'crit') {
        wallet.inv.critLevel += 1;
        return { ok: true, msg: `Lv ${wallet.inv.critLevel}! 치명타 대미지 ${critDamage(wallet.inv)}.` };
      }
      wallet.inv.speedLevel += 1;
      return { ok: true, msg: `Lv ${wallet.inv.speedLevel}! 마을에서 이동 속도 ${fmtX(speedMult(wallet.inv.speedLevel))}배.` };
    }
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
    return inv.items.map((id) => ({ id })).concat(
      MATERIAL_IDS.filter((id) => inv.materials[id] > 0).map((id) => ({ id, count: inv.materials[id] })),
      CONSUMABLE_IDS.filter((id) => inv.consumables[id] > 0).map((id) => ({ id, count: inv.consumables[id] })),
      POTION_IDS.filter((id) => inv.potions[id] > 0).map((id) => ({ id, count: inv.potions[id] })));
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

  G.Shop = { homeBonuses, critDamage, decorLeft, placeDecor, placeTabs, addMaterial: (inv, id) => { inv.materials[id] = (inv.materials[id] || 0) + 1; return inv.materials[id]; }, priceOf, mineReward, speedMult, upMaxed, ITEMS, SHOPS, SLOT_NAMES, TYPE_NAMES, newInventory, describe, stats, maxLivesFor, buy, gridEntries, usePotion, bestPotion };
})(window.Game);
