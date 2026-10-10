// 아이템 데이터, 상점 목록, 구매 규칙, 장비 능력치 계산. 화면/입력은 모른다 (main이 호출하고 Renderer가 그린다).
//  - 무기 상점: 검(균형) / 대검(범위 넓음, 쿨다운 느림, 슬라임·꽃게도 한 방) / 단검(범위 좁고 연속 패링이 빠름) / 지팡이(패링하면 마법: 독·번개·불덩이) 탭
//  - 갑옷 가게: 갑옷(최대 피) / 투구(피격 후 무적 시간) / 장갑(패링 지속 시간) / 신발(이동 속도) 탭
//  - 물약 상점: 언제든 살 수 있고 인벤토리에 쌓인다. 피가 모자랄 때 인벤토리(E)나 Q 키로 마신다.
//  - 산 장비는 바로 장착되고, 인벤토리 창(I 키)에서 바꿔 낄 수 있다.
(function (G) {
  const SLOT_NAMES = { weapon: '무기', helmet: '투구', armor: '갑옷', gloves: '장갑', pants: '바지', boots: '신발' };
  const TYPE_NAMES = { sword: '검', great: '대검', dagger: '단검', staff: '지팡이', bomb: '폭탄', gun: '총', bow: '활', shield: '방패', scythe: '낫', spear: '창', axe: '도끼', hammer: '망치', katana: '도', rapier: '레이피어', whip: '채찍', crossbow: '석궁', shotgun: '산탄총' };

  const ITEMS = {};
  const add = (it) => { ITEMS[it.id] = it; };

  // 무기: reach = 패링 범위(몸 둘레, 타일), throwTiles = 던지기 추가 거리(타일), cd = 패링 쿨다운 증감(초), look = [밝은 색, 어두운 색]
  // extra: element = 지팡이가 패링할 때 내보내는 원소(fire/poison/lightning/random), note = 특수 능력 설명
  const weapon = (id, type, name, price, reach, throwTiles, cd, look, extra = {}) => add(Object.assign({ id, slot: 'weapon', type, name, price, reach, throwTiles, cd, look }, extra));
  // 근접 무기의 원소(elem)는 맞힐 때 일어나는 특수 효과다. note = 그 설명, oneHit = 슬라임·꽃게도 첫 타에 처치
  //   gold 황금(처치 코인 +50%) / crystal 수정(주변에 파편 피해) / light 빛(주변 기절) / quake 대지(주변 기절)
  //   fire 화염(불타며 죽음) / ice 얼음(얼면서 부서짐) / thief 도둑(맞힐 때 코인) / cleave 관통(앞의 몬스터도) / shadow 그림자(잠시 무적)
  weapon('wood0', 'sword', '부서진 목검', 0, 0.25, 0, 0, ['#c9a86a', '#8a5a2b'], { wood: true, broken: true, note: '낡은 나무 칼. 끝이 부서졌다 — 대장간에서 제대로 된 검을 사 보자' });
  weapon('sword0', 'sword', '기본 검', 80, 0.3, 0, 0, ['#e8f1ff', '#9db6d6']);
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
  armor('rags', '허름한 옷', 0, 0, ['#8c7c5e', '#6e5f45']);
  ITEMS.rags.ragged = true; // 기운 천 조각 옷 (그릴 때 해진 모습)
  armor('armor0', '기본 갑옷', 120, 0, ['#3b6fd4', '#5b8ff0']);
  armor('armor1', '가죽 갑옷', 200, 1, ['#8a5a2b', '#b8803f']);
  armor('armor2', '강철 갑옷', 450, 2, ['#9aa4b2', '#d0d8e4']);
  armor('armor3', '용사의 갑옷', 800, 3, ['#d4a017', '#ffe27a']);
  armor('armor4', '미스릴 갑옷', 1300, 4, ['#7fd8e8', '#c8f4ff']);
  // 속성 갑옷: perk = 입고 있으면 일어나는 일 (main이 처리)
  const perkArmor = (id, name, price, hearts, look, extra) => add(Object.assign({ id, slot: 'armor', name, price, hearts, look }, extra));
  perkArmor('parmor1', '가시 갑옷', 700, 2, ['#6a4a3a', '#c9a86a'], { perk: 'thorn', note: '가시: 닿은 몬스터가 튕겨 날아가 터진다' });
  perkArmor('parmor2', '화염 갑옷', 900, 2, ['#c0391f', '#ff9a5a'], { perk: 'fire', note: '화염: 주변 2칸의 몬스터가 불탄다' });
  perkArmor('parmor3', '얼음 갑옷', 900, 2, ['#5fa8d9', '#bfe8ff'], { perk: 'ice', note: '얼음: 맞으면 주변 3칸이 얼어붙는다 (설산에서도 안 미끄러진다)' });
  perkArmor('parmor4', '번개 갑옷', 1100, 2, ['#d9b800', '#fff27a'], { perk: 'volt', note: '번개: 맞으면 주변 4칸의 몬스터가 기절한다' });

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
  // 특수 능력이 있는 장비: stat = 기본 수치, extra = 추가 능력 (critAdd 치명타 확률, cdAdd 패링 쿨다운, reachAdd 패링 범위, dashCostAdd 대시 스태미나)
  const gear = (slot, id, name, price, look, stat, extra) => add(Object.assign({ id, slot, name, price, look }, stat, extra));
  gear('helmet', 'helmet4', '미스릴 투구', 900, ['#7fd8e8', '#c8f4ff'], { invuln: 1.4 }, {});
  gear('gloves', 'gloves4', '미스릴 장갑', 800, ['#7fd8e8', '#3a8fa8'], { window: 0.2 }, {});
  gear('boots', 'boots4', '미스릴 신발', 800, ['#7fd8e8', '#3a8fa8'], { speed: 0.4 }, {});
  gear('helmet', 'vhelm', '매의 투구', 800, ['#8a5a2b', '#e8d8a8'], { invuln: 0.5 }, { critAdd: 0.04, note: '매의 눈: 치명타 확률 +4%' });
  gear('gloves', 'vglove1', '민첩의 장갑', 700, ['#4fae45', '#2a6a2a'], { window: 0.1 }, { cdAdd: -0.08, note: '민첩: 패링 쿨다운 -0.08초' });
  gear('gloves', 'vglove2', '거인의 장갑', 800, ['#c0504d', '#6a2a28'], { window: 0.1 }, { reachAdd: 0.1, note: '거인: 패링 범위 +0.1칸' });
  gear('boots', 'vboot', '질주의 신발', 700, ['#ffb347', '#a8641f'], { speed: 0.2 }, { dashCostAdd: -6, note: '질주: 대시 스태미나 -6' });

  // ---- 다크월드 갑옷 가게: 일반 가게보다 훨씬 강한 장비 ----
  armor('darmor1', '흑철 갑옷', 3000, 5, ['#3a3f4d', '#6a7388']);
  armor('darmor2', '어둠의 갑옷', 6000, 7, ['#2a1250', '#8a60d0']);
  armor('darmor3', '시크너의 갑옷', 12000, 10, ['#1a0a30', '#c07aff']);
  armor('darmor4', '오닉스 갑옷', 9000, 8, ['#15151f', '#7a7a9a']);
  perkArmor('dparmor1', '독가시 갑옷', 4000, 5, ['#3fa83a', '#8cff6b'], { perk: 'toxic', note: '독가시: 주변 2.5칸이 중독되고, 닿은 몬스터는 튕겨 터진다' });
  perkArmor('dparmor2', '재생 갑옷', 5000, 6, ['#d94a7a', '#ffa0c0'], { perk: 'regen', note: '재생: 10초마다 피 반 칸이 찬다' });
  perkArmor('dparmor3', '그림자 갑옷', 4500, 5, ['#2a1f45', '#6a4fb0'], { invuln: 1.0, note: '그림자: 피격 후 무적 +1.0초' });
  perkArmor('dparmor4', '탐욕 갑옷', 4000, 4, ['#d4a017', '#fff0a0'], { perk: 'gold', note: '탐욕: 코인 획득 +30%' });
  helmet('dhelmet1', '흑철 투구', 2000, 1.4, ['#3a3f4d', '#6a7388']);
  helmet('dhelmet2', '어둠의 투구', 4500, 1.8, ['#2a1250', '#c07aff']);
  gloves('dgloves1', '흑철 장갑', 2000, 0.2, ['#3a3f4d', '#6a7388']);
  gloves('dgloves2', '어둠의 장갑', 4500, 0.3, ['#6a2fb0', '#2a1250']);
  boots('dboots1', '흑철 신발', 2000, 0.4, ['#3a3f4d', '#6a7388']);
  boots('dboots2', '어둠의 신발', 4500, 0.5, ['#8a60d0', '#2a1250']);
  gear('helmet', 'dhelmet3', '매의 눈 투구', 5000, ['#3a3f4d', '#ffd54a'], { invuln: 1.2 }, { critAdd: 0.06, note: '매의 눈: 치명타 확률 +6%' });
  gear('helmet', 'dhelmet4', '시크너의 투구', 9000, ['#1a0a30', '#c07aff'], { invuln: 2.2 }, { note: '피격 후 무적 +2.2초' });
  gear('gloves', 'dgloves3', '날쌘 장갑', 5000, ['#2a1250', '#7fe8ff'], { window: 0.25 }, { cdAdd: -0.12, note: '날쌤: 패링 쿨다운 -0.12초' });
  gear('gloves', 'dgloves4', '거신의 장갑', 6500, ['#3a3f4d', '#ff8a8a'], { window: 0.3 }, { reachAdd: 0.15, note: '거신: 패링 범위 +0.15칸' });
  gear('boots', 'dboots3', '질풍의 신발', 5000, ['#3a3f4d', '#7dffd0'], { speed: 0.45 }, { dashCostAdd: -8, note: '질풍: 대시 스태미나 -8' });
  gear('boots', 'dboots4', '그림자 신발', 7000, ['#1a0a30', '#8a60d0'], { speed: 0.6 }, { dashCostAdd: -10, note: '그림자: 대시 스태미나 -10' });
  // ---- 바지 (바지 가게 / 다크월드 갑옷 가게) ----
  gear('pants', 'pants1', '천 바지', 100, ['#9a8a6a', '#6a5a3a'], { hearts: 1 }, {});
  gear('pants', 'pants2', '가죽 바지', 250, ['#8a5a2b', '#5a3d17'], { hearts: 1, speed: 0.05 }, {});
  gear('pants', 'pants3', '강철 바지', 500, ['#9aa4b2', '#5a6676'], { hearts: 2 }, {});
  gear('pants', 'pants4', '사슬 바지', 700, ['#b8c0cc', '#6c7686'], { hearts: 2, invuln: 0.3 }, {});
  gear('pants', 'pants5', '마법사 바지', 800, ['#6a4fb0', '#3a2a70'], { hearts: 1 }, { stamRegen: 8, note: '마법: 스태미나 회복 +8/초' });
  gear('pants', 'pants6', '부자 바지', 900, ['#d4a017', '#8a6a10'], { hearts: 1 }, { coinAdd: 0.15, note: '큰 주머니: 코인 획득 +15%' });
  gear('pants', 'pants7', '질주 바지', 800, ['#4fae45', '#2a6a2a'], { speed: 0.25 }, { note: '질주: 이동 속도 +25%' });
  gear('pants', 'pants8', '거인 바지', 1100, ['#c0504d', '#6a2a28'], { hearts: 3, invuln: 0.2 }, {});
  gear('pants', 'pants9', '화염 바지', 1000, ['#e8602a', '#8a2a10'], { hearts: 2, speed: 0.1 }, { note: '화염: 뜨거운 다리, 이동 속도 +10%' });
  gear('pants', 'pants10', '얼음 바지', 1000, ['#7fc8f0', '#3a78a8'], { hearts: 2, invuln: 0.4 }, { note: '얼음: 피격 후 무적 +0.4초' });
  gear('pants', 'pants11', '번개 바지', 1100, ['#f0d83a', '#a89010'], { speed: 0.2 }, { stamRegen: 5, note: '번개: 스태미나 회복 +5/초' });
  gear('pants', 'pants12', '독 바지', 1100, ['#6fcf4a', '#2f7a2a'], { hearts: 1 }, { coinAdd: 0.1, stamRegen: 4, note: '독버섯: 코인 +10%, 스태미나 회복 +4/초' });
  gear('pants', 'dpants1', '흑철 바지', 3000, ['#3a3f4d', '#6a7388'], { hearts: 3, invuln: 0.5 }, {});
  gear('pants', 'dpants2', '어둠의 바지', 5000, ['#2a1250', '#8a60d0'], { hearts: 4, speed: 0.2 }, { stamRegen: 10, note: '어둠: 스태미나 회복 +10/초' });
  gear('pants', 'dpants3', '그림자 바지', 5500, ['#1a0a30', '#6a4fb0'], { speed: 0.45, invuln: 1.0 }, { note: '그림자: 이동 +45%, 무적 +1.0초' });
  gear('pants', 'dpants4', '시크너의 바지', 9000, ['#1a0a30', '#c07aff'], { hearts: 6, invuln: 1.2, speed: 0.3 }, { stamRegen: 15, note: '시크너: 스태미나 회복 +15/초' });

  // ---- 다크월드 무기 상점: 폭탄 던지기 / 총 / 활 / 방패 (shot = 쏘는 것, dmg = 대미지, stamina = 한 번에 드는 스태미나) ----
  weapon('bomb1', 'bomb', '흑색 폭탄', 1500, 0.2, 0, 0.2, ['#3a3a44', '#ff9a3a'], { shot: 'bomb', dmg: 3, radius: 2, stamina: 15, note: '던지면 터져 주변 2칸에 피해 3' });
  weapon('bomb2', 'bomb', '화약 폭탄', 3000, 0.2, 0, 0.2, ['#5a3a2a', '#ffcf3a'], { shot: 'bomb', dmg: 5, radius: 2.5, stamina: 20, note: '주변 2.5칸에 피해 5' });
  weapon('bomb3', 'bomb', '어둠 폭탄', 6000, 0.2, 0, 0.2, ['#2a1250', '#c07aff'], { shot: 'bomb', dmg: 8, radius: 3, stamina: 25, note: '주변 3칸에 피해 8' });
  weapon('gun1', 'gun', '낡은 권총', 1800, 0.2, 0, 0.1, ['#8a8f9a', '#4a4f5a'], { shot: 'bullet', dmg: 3, stamina: 12, note: '빠른 탄환 피해 3' });
  weapon('gun2', 'gun', '소총', 3500, 0.2, 0, 0.1, ['#6b4423', '#c9d2dc'], { shot: 'bullet', dmg: 5, stamina: 16, note: '빠른 탄환 피해 5' });
  weapon('gun3', 'gun', '어둠의 총', 7000, 0.2, 0, 0.1, ['#2a1250', '#c07aff'], { shot: 'bullet', dmg: 8, stamina: 20, pierce: true, note: '관통 탄환 피해 8' });
  weapon('bomb4', 'bomb', '섬광 폭탄', 3500, 0.2, 0, 0.2, ['#fff6b0', '#ffffff'], { shot: 'bomb', dmg: 4, radius: 3, stamina: 18, note: '주변 3칸에 피해 4' });
  weapon('gun4', 'gun', '연발 권총', 5000, 0.2, 0, 0.1, ['#c9d2dc', '#3a3f4d'], { shot: 'bullet', dmg: 4, count: 2, stamina: 18, note: '두 발씩 발사' });
  weapon('sg1', 'shotgun', '산탄총', 3000, 0.2, 0, 0.15, ['#6b4423', '#8a8f9a'], { shot: 'bullet', dmg: 2, count: 5, stamina: 20, note: '다섯 발이 퍼져 나간다' });
  weapon('sg2', 'shotgun', '쌍대 산탄총', 5500, 0.2, 0, 0.15, ['#4a3a2a', '#c9d2dc'], { shot: 'bullet', dmg: 3, count: 5, stamina: 24, note: '다섯 발 (피해 3)' });
  weapon('sg3', 'shotgun', '어둠의 산탄총', 9500, 0.2, 0, 0.15, ['#2a1250', '#c07aff'], { shot: 'bullet', dmg: 5, count: 7, stamina: 28, note: '일곱 발 (피해 5)' });
  weapon('bow4', 'bow', '화염 활', 8000, 0.2, 0, 0, ['#c0391f', '#ffcf3a'], { elem: 'fire', shot: 'arrow', dmg: 6, count: 2, stamina: 14, note: '화살 두 발 (피해 6)' });
  weapon('xbow1', 'crossbow', '석궁', 2200, 0.2, 0, 0.15, ['#8a5a2b', '#c9d2dc'], { shot: 'arrow', dmg: 6, stamina: 12, note: '강한 화살 피해 6' });
  weapon('xbow2', 'crossbow', '연발 석궁', 4200, 0.2, 0, 0.1, ['#6b4423', '#9fd8f0'], { shot: 'arrow', dmg: 6, count: 2, stamina: 16, note: '화살 두 발 (피해 6)' });
  weapon('xbow3', 'crossbow', '어둠의 석궁', 8500, 0.2, 0, 0.1, ['#2a1250', '#c07aff'], { shot: 'arrow', dmg: 12, stamina: 20, pierce: true, note: '관통 화살 피해 12' });
  weapon('shield4', 'shield', '가시 방패', 9000, 0.95, 0, 0.1, ['#c0504d', '#6a2a28'], { windowAdd: 0.35, note: '방패: 패링이 아주 오래 가고 범위도 넓다' });
  weapon('bow1', 'bow', '사냥 활', 1500, 0.2, 0, 0, ['#8a5a2b', '#e8d8a8'], { shot: 'arrow', dmg: 3, stamina: 8, note: '화살 피해 3' });
  weapon('bow2', 'bow', '장궁', 3000, 0.2, 0, -0.1, ['#6b4423', '#9fd8f0'], { shot: 'arrow', dmg: 5, stamina: 10, note: '화살 피해 5, 쿨다운 짧음' });
  weapon('bow3', 'bow', '어둠의 활', 6500, 0.2, 0, 0, ['#2a1250', '#c07aff'], { shot: 'arrow', dmg: 7, stamina: 14, count: 3, note: '화살 세 발 (피해 7)' });
  weapon('scythe1', 'scythe', '수확의 낫', 2200, 0.8, 0, 0.15, ['#c9d2dc', '#6c7686'], { elem: 'reap', oneHit: true, reapSt: 10, note: '수확: 맞힐 때 피 ¼칸 흡수, 처치하면 스태미나 +10, 20마리마다 피 ½칸' });
  weapon('scythe2', 'scythe', '사신의 낫', 4200, 1.0, 0, 0.15, ['#b8a0e8', '#4b2fb8'], { elem: 'reap', oneHit: true, reapSt: 18, note: '수확: 맞힐 때 피 ¼칸 흡수, 처치하면 스태미나 +18, 20마리마다 피 ½칸' });
  weapon('scythe4', 'scythe', '해골 낫', 12000, 1.4, 0, 0.1, ['#e8e0c8', '#5a5a6a'], { elem: 'reap', oneHit: true, reapSt: 45, note: '수확: 맞힐 때 피 ¼칸 흡수, 처치하면 스태미나 +45, 20마리마다 피 ½칸' });
  weapon('scythe3', 'scythe', '어둠의 낫', 7500, 1.2, 0, 0.1, ['#e0a8ff', '#2a1250'], { elem: 'reap', oneHit: true, reapSt: 30, note: '수확: 맞힐 때 피 ¼칸 흡수, 처치하면 스태미나 +30, 20마리마다 피 ½칸' });
  // ---- 더 많은 무기: 새 종류(창, 도끼, 망치, 도, 레이피어, 채찍, 석궁, 산탄총)와 새 속성 무기 ----
  weapon('sword4', 'sword', '불꽃 검', 900, 0.4, 1, 0, ['#ffb27a', '#d9501f'], { elem: 'fire', note: '화염: 불타며 죽고 주변에 불이 옮겨붙는다' });
  weapon('sword5', 'sword', '서리 검', 1100, 0.4, 1, 0, ['#bfe8ff', '#5fa8d9'], { elem: 'ice', note: '얼음: 얼면서 부서지고 주변도 얼어붙는다' });
  weapon('sword6', 'sword', '그림자 검', 1500, 0.5, 2, 0, ['#9a7bff', '#2a1a60'], { elem: 'shadow', note: '그림자: 맞히면 잠시 공격을 받지 않는다' });
  weapon('sword7', 'sword', '용의 검', 2400, 0.7, 2, 0, ['#ff7a5a', '#a01f10'], { elem: 'fire', oneHit: true, note: '화염: 슬라임·꽃게도 한 방, 불이 옮겨붙는다' });
  weapon('great5', 'great', '번개 대검', 1500, 0.9, 0, 0.25, ['#fff27a', '#d9b800'], { elem: 'light', lightRadius: 3, oneHit: true, note: '빛: 주변 3칸 몬스터를 기절시킨다' });
  weapon('great6', 'great', '황금 대검', 2000, 1.1, 0, 0.25, ['#ffe08a', '#d9a93a'], { elem: 'gold', oneHit: true, note: '황금: 처치하면 코인 +50%' });
  weapon('dagger4', 'dagger', '얼음 단검', 800, 0.3, 3, -0.3, ['#bfe8ff', '#5fa8d9'], { elem: 'ice', note: '얼음: 얼면서 부서진다' });
  weapon('dagger5', 'dagger', '번개 단검', 1100, 0.3, 3, -0.35, ['#fff27a', '#d9b800'], { elem: 'light', lightRadius: 2, note: '빛: 주변 2칸 몬스터를 기절시킨다' });
  weapon('staff5', 'staff', '대마법사의 지팡이', 1800, 0.6, 5, -0.15, ['#fff0ff', '#c07aff'], { element: 'random', note: '불덩이·번개·독 중 무작위 (빠름)' });
  weapon('staff6', 'staff', '독안개 지팡이', 1000, 0.4, 4, -0.2, ['#5fd04a', '#2a7a2a'], { element: 'poison', note: '독: 3초간 지속 피해 (빠름)' });
  weapon('spear1', 'spear', '나무 창', 300, 0.8, 4, 0.1, ['#c9a86a', '#8a5a2b'], { note: '긴 사거리' });
  weapon('spear2', 'spear', '철 창', 700, 1.0, 5, 0.1, ['#c9d2dc', '#6c7686'], { elem: 'cleave', note: '관통: 앞에 있는 몬스터까지 함께 찌른다' });
  weapon('spear3', 'spear', '불꽃 창', 1300, 1.1, 5, 0.1, ['#ff9a5a', '#c0391f'], { elem: 'fire', note: '화염: 불타며 죽고 주변에 불이 옮겨붙는다' });
  weapon('spear4', 'spear', '용사의 창', 2200, 1.4, 6, 0.1, ['#ffe27a', '#d4a017'], { elem: 'light', lightRadius: 3, note: '빛: 주변 3칸 몬스터를 기절시킨다' });
  weapon('axe1', 'axe', '손도끼', 400, 0.5, 0, 0.2, ['#c9d2dc', '#8a5a2b'], { oneHit: true, note: '묵직: 슬라임·꽃게도 한 방' });
  weapon('axe2', 'axe', '전투 도끼', 900, 0.7, 0, 0.3, ['#b8c0cc', '#6c7686'], { elem: 'quake', oneHit: true, note: '대지: 내리치면 주변 몬스터가 기절' });
  weapon('axe3', 'axe', '화염 도끼', 1500, 0.8, 0, 0.3, ['#ff9a5a', '#c0391f'], { elem: 'fire', oneHit: true, note: '화염: 불타며 죽고 주변에 불이 옮겨붙는다' });
  weapon('axe4', 'axe', '거인의 도끼', 2500, 1.0, 0, 0.3, ['#9fe8ff', '#4fb5e0'], { elem: 'crystal', oneHit: true, note: '수정: 맞은 주변에 파편 피해 1' });
  weapon('hammer1', 'hammer', '나무 망치', 500, 0.6, 0, 1.4, ['#c9a86a', '#8a5a2b'], { swingFrames: 84, slashFrame: 50, elem: 'quake', oneHit: true, baseDmg: 8, note: '엄청 느리지만 엄청 강하다. 대지: 주변 몬스터가 기절' });
  weapon('hammer2', 'hammer', '철퇴', 1000, 0.8, 0, 1.6, ['#b8c0cc', '#6c7686'], { swingFrames: 84, slashFrame: 50, elem: 'quake', oneHit: true, baseDmg: 14, note: '엄청 느리지만 엄청 강하다. 대지: 넓은 범위가 기절' });
  weapon('hammer3', 'hammer', '얼음 망치', 1600, 0.8, 0, 1.8, ['#bfe8ff', '#5fa8d9'], { swingFrames: 84, slashFrame: 50, elem: 'ice', oneHit: true, baseDmg: 22, note: '엄청 느리지만 엄청 강하다. 얼음: 얼면서 부서진다' });
  weapon('hammer4', 'hammer', '천둥 망치', 2600, 1.0, 0, 2.2, ['#fff27a', '#d9b800'], { swingFrames: 84, slashFrame: 50, elem: 'light', lightRadius: 4, oneHit: true, baseDmg: 40, note: '엄청 느리지만 엄청 강하다. 빛: 주변 4칸 기절' });
  weapon('katana1', 'katana', '도', 700, 0.45, 2, -0.2, ['#e8f1ff', '#9db6d6'], { elem: 'thief', note: '도둑: 맞힐 때마다 코인 +1 (빠름)' });
  weapon('katana2', 'katana', '사무라이 도', 1400, 0.5, 3, -0.25, ['#d8e0ea', '#6c7686'], { elem: 'cleave', note: '관통: 앞의 몬스터까지 함께 벤다 (빠름)' });
  weapon('katana3', 'katana', '달빛 도', 2400, 0.55, 3, -0.3, ['#c8d8ff', '#6a7bd0'], { elem: 'shadow', note: '그림자: 맞히면 잠시 공격을 받지 않는다 (아주 빠름)' });
  weapon('rapier1', 'rapier', '레이피어', 600, 0.6, 3, -0.25, ['#e8f1ff', '#9db6d6'], { note: '찌르기: 가늘고 빠르다' });
  weapon('rapier2', 'rapier', '기사 레이피어', 1200, 0.7, 4, -0.3, ['#ffe27a', '#d4a017'], { elem: 'thief', note: '도둑: 맞힐 때마다 코인 +1 (빠름)' });
  weapon('rapier3', 'rapier', '별빛 레이피어', 2000, 0.8, 4, -0.35, ['#e0a8ff', '#a45ad9'], { elem: 'light', lightRadius: 2, note: '빛: 주변 2칸 몬스터를 기절시킨다 (아주 빠름)' });
  weapon('whip1', 'whip', '가죽 채찍', 400, 1.2, 0, 0, ['#8a5a2b', '#5a3d17'], { note: '아주 긴 사거리' });
  weapon('whip2', 'whip', '사슬 채찍', 1000, 1.5, 0, 0.1, ['#b8c0cc', '#6c7686'], { elem: 'cleave', note: '관통: 줄 위의 몬스터를 모두 후려친다' });
  weapon('whip3', 'whip', '불꽃 채찍', 1800, 1.6, 0, 0.1, ['#ff9a5a', '#c0391f'], { elem: 'fire', note: '화염: 불타며 죽고 주변에 불이 옮겨붙는다' });
  weapon('sword8', 'sword', '독니 검', 1000, 0.4, 1, 0, ['#8cff6b', '#2a7a2a'], { elem: 'poison', note: '독: 맞은 몬스터가 중독된다 (3초간 지속 피해)' });
  weapon('dagger6', 'dagger', '독 단검', 700, 0.3, 3, -0.3, ['#8cff6b', '#3fa83a'], { elem: 'poison', note: '독: 맞은 몬스터가 중독된다 (빠름)' });
  weapon('spear5', 'spear', '독 창', 1100, 1.0, 5, 0.1, ['#9be86a', '#3a7a2a'], { elem: 'poison', note: '독: 찔린 몬스터가 중독된다' });
  weapon('axe5', 'axe', '독 도끼', 1300, 0.7, 0, 0.3, ['#8cff6b', '#2a7a2a'], { elem: 'poison', oneHit: true, note: '독: 맞은 주변까지 중독된다' });
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

  const MATERIAL_IDS = ['darkcrystal', 'cleancrystal', 'holycrystal'];

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
  DECOR.forEach((d) => add(Object.assign({ decor: true }, d, { price: d.price * 4 }))); // 가구 하나가 코인 +8%라서 값이 비싸다 (원래의 4배)
  const placedCount = (inv, id) => ['floor', 'wall'].reduce((n, k) => n + inv.home.placed[k].filter((x) => x === id).length, 0);
  // 집에 놓은 장식품 수에 따른 보너스: 놓을 때마다 코인 획득량과 치명타 확률이 오른다
  const placedTotal = (inv) => inv.home.placed.floor.filter(Boolean).length + inv.home.placed.wall.filter(Boolean).length;
  // 지금 든 무기에 붙인 주괴가 주는 보너스 (대장간 forge.js). 없으면 모두 0
  const NO_ATTACH = { dmg: 0, boss: 0, reach: 0, cd: 0, crit: 0, coin: 0, hit: 0, gdmg: 0, st: 0, radius: 0, pierce: false };
  const attachOf = (inv, w) => (G.Forge && w ? G.Forge.attachBonus(inv, w) : NO_ATTACH);
  const homeBonuses = (inv) => { const n = placedTotal(inv); const ab = attachOf(inv, ITEMS[inv.equipped.weapon]); return { n, coin: n * C.DECOR_COIN_BONUS + (ITEMS[inv.equipped.armor] && ITEMS[inv.equipped.armor].perk === 'gold' ? 0.3 : 0) + (inv.equipped.pants && ITEMS[inv.equipped.pants].coinAdd ? ITEMS[inv.equipped.pants].coinAdd : 0) + ab.coin, crit: Math.min(1, C.CRIT_BASE_CHANCE + n * C.DECOR_CRIT_BONUS + (ITEMS[inv.equipped.helmet] && ITEMS[inv.equipped.helmet].critAdd ? ITEMS[inv.equipped.helmet].critAdd : 0) + ab.crit) }; };
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

  // 도구: 한 번 사면 계속 쓴다 (인벤토리 '재료' 칸에 들어간다)
  weapon('magnifier', 'sword', '약점 돋보기', 500, 0.25, 0, 0, ['#cfe8ff', '#6a8fb0'], { lens: true, note: '끼고 보스를 3번 때린 뒤 5초 버티면 약점이 드러난다. 대미지 1' });

  // 크리스탈 만들기: 어둠의 크리스탈(보스) -> 숲의 샘물로 씻기 -> 정화된 크리스탈 -> 화산의 제단 -> 신성 크리스탈 -> 대장간에서 칼에 붙이기
  add({ id: 'cleancrystal', name: '정화된 크리스탈', desc: '숲의 샘물로 씻어 어둠이 빠진 크리스탈. 화산의 제단에서 신성한 힘을 얻는다', quest: true, look: ['#a8ecff', '#3a8fc0'] });
  add({ id: 'holycrystal', name: '신성 크리스탈', desc: '화산의 제단에서 신성해진 크리스탈. 용광로에서 칼에 붙이면 탑의 보스에게 더 강해진다', quest: true, look: ['#fff2a8', '#e0a82a'] });

  // 보상 상점의 업그레이드 두 가지 (레벨은 인벤토리에 저장되어 스테이지가 바뀌어도 유지된다)
  //  mine  동굴 보상: 마을 동굴 보물 상자의 코인 (1레벨 100 G -> 15레벨 450 G). 처음부터 1레벨
  //  speed 마을 달리기: 마을에서만 이동 속도가 빨라진다 (0레벨 1배 -> 5레벨 5배). 처음엔 0레벨
  add({ id: 'mineup', name: '동굴 보상 업그레이드', upgrade: 'mine', look: ['#ffd54a', '#b8860b'] });
  add({ id: 'speedup', name: '마을 달리기 업그레이드', upgrade: 'speed', look: ['#7dffd0', '#2fa88a'] });
  //  crit  치명타: 치명타가 터지면 이 대미지를 준다 (0레벨 10 -> 20레벨 30). 치명타 확률은 집에 장식품을 놓을수록 오른다
  add({ id: 'critup', name: '치명타 업그레이드', upgrade: 'crit', look: ['#ffd54a', '#e8334a'] });
  //  weapon / armor: 다크월드 강화소. 경험치(EXP)로 지금 낀 무기(Lv은 무기마다)와 갑옷(피 +1칸/레벨)을 강화한다
  add({ id: 'wup', name: '무기 강화', upgrade: 'weapon', expCost: true, look: ['#7dd0ff', '#2a6fb0'] });
  add({ id: 'aup', name: '갑옷 강화', upgrade: 'armor', expCost: true, look: ['#ff9a7a', '#b0402a'] });
  //  holy: 대장간에서 신성 크리스탈을 지금 낀 칼에 붙인다. 붙인 개수 n개 = 탑의 보스에게 주는 대미지 x(n+1)
  add({ id: 'holyup', name: '신성 강화', upgrade: 'holy', look: ['#fff2a8', '#e0a82a'] });
  //  stmax / stregen: 보상 상점. 최대 스태미나(최대 500)와 스태미나가 차오르는 속도를 올린다
  add({ id: 'stmaxup', name: '스태미나 최대 업그레이드', upgrade: 'stmax', look: ['#7dffd0', '#2fa88a'] });
  add({ id: 'stregenup', name: '스태미나 회복 업그레이드', upgrade: 'stregen', look: ['#b8ff7d', '#5fa82f'] });
  const C = G.Config;
  const WUP_MAX = 30;                                // 무기 강화 최고 레벨 (무기마다)
  const AUP_MAX = 10;                                // 갑옷 강화 최고 레벨
  const wupPrice = (lv) => 40 + 30 * lv + 8 * lv * lv;      // 무기 강화 EXP: 40, 78, 132 ... 레벨이 오를수록 가파르게 (30레벨째 약 5,800)
  const aupPrice = (lv) => 100 + 200 * lv + 250 * lv * lv;  // 갑옷 강화 EXP: 100, 550, 1,500 ... (10레벨째 약 22,000)
  const weaponLevel = (inv) => (inv.wlevel && inv.wlevel[inv.equipped.weapon]) || 0;
  // 무기 강화의 대미지 보너스: 레벨이 오를수록 한 레벨당 늘어나는 양이 점점 커진다 (1레벨 +1, 5레벨 +7, 10레벨 +20, 20레벨 +60, 30레벨 +120)
  const wBonus = (lv) => Math.floor(lv * (1 + lv / 10));
  const meleeBase = (w) => w.baseDmg || (w.oneHit ? 2 : 1); // 근접 무기의 기본 대미지 (망치는 훨씬 세다)
  const HOLY_MAX = 9; // 신성 크리스탈은 칼마다 최대 9개 (대미지 x10)
  const HOLY_TYPES = ['sword', 'great', 'dagger', 'scythe']; // 칼 종류
  const holyLevel = (inv) => (inv.holy && inv.holy[inv.equipped.weapon]) || 0;
  const holyMult = (inv) => 1 + holyLevel(inv); // 탑의 보스에게 주는 대미지 배율
  const staminaMax = (inv) => C.STAMINA_MAX + C.STAMINA_MAX_STEP * Math.min(inv.stMaxLevel || 0, C.STAMINA_MAX_LEVELS);
  const staminaRegen = (inv) => C.STAMINA_REGEN + C.STAMINA_REGEN_STEP * Math.min(inv.stRegenLevel || 0, C.STAMINA_REGEN_LEVELS) + (inv.equipped.pants && ITEMS[inv.equipped.pants].stamRegen ? ITEMS[inv.equipped.pants].stamRegen : 0);
  const mineReward = (level) => C.MINE_COINS + C.MINE_COINS_PER_LEVEL * (Math.min(level, C.MINE_MAX_LEVEL) - 1);
  const speedMult = (level) => 1 + ((C.VILLAGE_SPEED_MAX - 1) * Math.min(level, C.VILLAGE_SPEED_LEVELS)) / C.VILLAGE_SPEED_LEVELS;
  const critDamage = (inv) => C.CRIT_BASE_DAMAGE + Math.min(inv.critLevel, C.CRIT_MAX_LEVEL);
  const levelOf = (item, inv) => (item.upgrade === 'stmax' ? inv.stMaxLevel || 0 : item.upgrade === 'stregen' ? inv.stRegenLevel || 0 : item.upgrade === 'holy' ? holyLevel(inv) : item.upgrade === 'weapon' ? weaponLevel(inv) : item.upgrade === 'armor' ? inv.armorLevel || 0 : item.upgrade === 'mine' ? inv.mineLevel : item.upgrade === 'crit' ? inv.critLevel : inv.speedLevel);
  const maxLevelOf = (item) => (item.upgrade === 'stmax' ? C.STAMINA_MAX_LEVELS : item.upgrade === 'stregen' ? C.STAMINA_REGEN_LEVELS : item.upgrade === 'holy' ? HOLY_MAX : item.upgrade === 'weapon' ? WUP_MAX : item.upgrade === 'armor' ? AUP_MAX : item.upgrade === 'mine' ? C.MINE_MAX_LEVEL : item.upgrade === 'crit' ? C.CRIT_MAX_LEVEL : C.VILLAGE_SPEED_LEVELS);
  const upMaxed = (item, inv) => !!item.upgrade && levelOf(item, inv) >= maxLevelOf(item);
  // 다음 레벨로 올리는 가격 (최고 레벨이면 0). 업그레이드가 아닌 아이템은 원래 가격
  function priceOf(item, inv) {
    if (!item.upgrade) return item.price;
    if (upMaxed(item, inv)) return 0;
    if (item.upgrade === 'stmax') return C.STAMINA_MAX_PRICE + C.STAMINA_MAX_PRICE_STEP * (inv.stMaxLevel || 0);
    if (item.upgrade === 'stregen') return C.STAMINA_REGEN_PRICE + C.STAMINA_REGEN_PRICE_STEP * (inv.stRegenLevel || 0);
    if (item.upgrade === 'holy') return 1;
    if (item.upgrade === 'weapon') return wupPrice(weaponLevel(inv));
    if (item.upgrade === 'armor') return aupPrice(inv.armorLevel || 0);
    if (item.upgrade === 'crit') return C.CRIT_UPGRADE_PRICE + C.CRIT_UPGRADE_STEP * inv.critLevel;
    return item.upgrade === 'mine' ? C.MINE_UPGRADE_PRICE + C.MINE_UPGRADE_STEP * (inv.mineLevel - 1) : C.VILLAGE_SPEED_PRICE + C.VILLAGE_SPEED_STEP * inv.speedLevel;
  }
  const fmtX = (v) => (Math.round(v * 10) / 10).toString();

  const POTION_NOTE = '인벤토리에서 E / 게임 중 Q 로 마시기';

  // 아이템 한 개의 이름/설명 (상점과 인벤토리 창이 보여준다)
  function describe(item, inv) {
    if (item.forge) return item.view(inv); // 대장간의 합치기/제련/부착 카드
    if (item.upgrade === 'stmax') {
      const lv = inv ? inv.stMaxLevel || 0 : 0;
      const desc = lv >= C.STAMINA_MAX_LEVELS ? `최고 레벨! 최대 스태미나 ${staminaMax(inv)}` : `최대 스태미나 ${staminaMax(inv)} -> ${staminaMax(inv) + C.STAMINA_MAX_STEP}`;
      return { name: `${item.name}  Lv ${lv}/${C.STAMINA_MAX_LEVELS}`, desc, slotName: '업그레이드', note: `레벨마다 +${C.STAMINA_MAX_STEP} (최대 ${C.STAMINA_MAX + C.STAMINA_MAX_STEP * C.STAMINA_MAX_LEVELS})` };
    }
    if (item.upgrade === 'stregen') {
      const lv = inv ? inv.stRegenLevel || 0 : 0;
      const desc = lv >= C.STAMINA_REGEN_LEVELS ? `최고 레벨! 초당 ${staminaRegen(inv)} 회복` : `회복 속도 초당 ${staminaRegen(inv)} -> ${staminaRegen(inv) + C.STAMINA_REGEN_STEP}`;
      return { name: `${item.name}  Lv ${lv}/${C.STAMINA_REGEN_LEVELS}`, desc, slotName: '업그레이드', note: `레벨마다 초당 +${C.STAMINA_REGEN_STEP} (최대 ${C.STAMINA_REGEN + C.STAMINA_REGEN_STEP * C.STAMINA_REGEN_LEVELS})` };
    }
    if (item.upgrade === 'holy') {
      const w = ITEMS[inv.equipped.weapon];
      const lv = holyLevel(inv);
      const have = inv.materials.holycrystal || 0;
      const ok = HOLY_TYPES.includes(w.type);
      const desc = !ok ? `${w.name}은(는) 칼이 아니라서 붙일 수 없어요` : lv >= HOLY_MAX ? `최고 레벨! ${w.name}: 탑의 보스에게 대미지 x${lv + 1}` : `${w.name}: 탑의 보스에게 대미지 x${lv + 1} -> x${lv + 2}`;
      return { name: `${item.name}  ${lv}/${HOLY_MAX}`, desc, slotName: '신성', note: `신성 크리스탈 ${have}개 보유 (어둠의 크리스탈: 숲의 샘물 -> 화산의 제단)` };
    }
    if (item.upgrade === 'weapon') {
      const w = ITEMS[inv.equipped.weapon];
      const lv = weaponLevel(inv);
      const f = (v) => (Math.round(v * 10) / 10).toString();
      const base = w.shot ? w.dmg : meleeBase(w);
      const now = `대미지 ${base + wBonus(lv)}` + (w.shot ? '' : `, 범위 ${f(w.reach + 0.05 * lv)}칸`);
      const next = `대미지 ${base + wBonus(lv + 1)}` + (w.shot ? '' : `, 범위 ${f(w.reach + 0.05 * (lv + 1))}칸`);
      const desc = lv >= WUP_MAX ? `최고 레벨! ${w.name} ${now}` : `${w.name} ${now} -> ${next}`;
      return { name: `${item.name}  Lv ${lv}/${WUP_MAX}`, desc, slotName: '강화', note: `레벨이 오를수록 대미지가 더 크게 늘어난다 (이번 +${wBonus(lv + 1) - wBonus(lv)})${w.shot ? '' : ', 범위 +0.05칸'}` };
    }
    if (item.upgrade === 'armor') {
      const lv = inv.armorLevel || 0;
      const desc = lv >= AUP_MAX ? `최고 레벨! 최대 피 +${lv}칸` : `최대 피 +${lv}칸 -> +${lv + 1}칸`;
      return { name: `${item.name}  Lv ${lv}/${AUP_MAX}`, desc, slotName: '강화', note: '레벨마다 최대 피 +1칸 (어떤 갑옷이든)' };
    }
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
    if (item.pickaxe) return { name: item.name, desc: item.desc, slotName: '곡괭이', note: inv && inv.items.includes(item.id) ? (inv.equipped.pick === item.id ? '장착 중 (누르면 뺀다)' : '누르면 장착한다') : '사서 장착하면 광석을 캘 수 있다' };
    if (item.tool) return { name: item.name, desc: item.desc, slotName: '도구', note: inv && inv.items.includes(item.id) ? '가지고 있어요 (계속 쓰인다)' : '한 번 사면 계속 쓴다' };
    if (item.quest) return { name: item.name, desc: item.desc, slotName: '소중한 물건', note: '장착하거나 쓸 수 없는 보물' };
    if (item.heal !== undefined) return { name: item.name, desc: item.desc, slotName: '물약', note: POTION_NOTE };
    const parts = [];
    if (item.slot === 'weapon') {
      const wl = inv && inv.wlevel ? inv.wlevel[item.id] || 0 : 0;   // 강화 레벨
      const holy = inv && inv.holy ? inv.holy[item.id] || 0 : 0;     // 붙인 신성 크리스탈
      const wname = wl > 0 ? `${item.name} +${wl}` : item.name;
      const r2 = (v) => Math.round(v * 100) / 100;
      if (item.shot) { // 폭탄/총/활: 쏘는 무기
        parts.push(`대미지 ${item.dmg + wBonus(wl)}`, `스태미나 -${item.stamina}`);
        if (item.radius) parts.push(`폭발 ${item.radius}칸`);
        if (item.count > 1) parts.push(`${item.count}발`);
        return { name: wname, desc: parts.join(', '), slotName: TYPE_NAMES[item.type], note: [item.note, G.Forge && G.Forge.describeExtra(item, inv)].filter(Boolean).join(' · ') };
      }
      parts.push(`대미지 ${meleeBase(item) + wBonus(wl)}`);
      if (item.element) parts.push(`마법 ${{ fire: '2', poison: '3(지속)', lightning: '1+기절', random: '1~3' }[item.element] || '1'}`);
      parts.push(`범위 ${r2(item.reach + 0.05 * wl)}칸`);
      if (['great', 'scythe', 'axe', 'hammer', 'whip'].includes(item.type)) parts.push('던지기 불가');
      else if (item.throwTiles) parts.push(`던지기 +${item.throwTiles}칸`);
      if (item.cd) parts.push(`쿨다운 ${item.cd > 0 ? '+' : ''}${item.cd}초`);
      if (item.oneHit) parts.push('슬라임·꽃게 한 방');
      if (holy) parts.push(`탑 보스 x${1 + holy}`);
      return { name: wname, desc: parts.join(', '), slotName: TYPE_NAMES[item.type], note: [item.note, G.Forge && G.Forge.describeExtra(item, inv)].filter(Boolean).join(' · ') };
    }
    if (item.slot === 'pants') {
      if (item.hearts) parts.push(`최대 피 +${item.hearts}칸`);
      if (item.speed) parts.push(`이동 속도 +${Math.round(item.speed * 100)}%`);
      if (item.invuln) parts.push(`피격 후 무적 +${item.invuln}초`);
      if (item.stamRegen) parts.push(`스태미나 회복 +${item.stamRegen}/초`);
      if (item.coinAdd) parts.push(`코인 +${Math.round(item.coinAdd * 100)}%`);
    }
    if (item.slot === 'armor') parts.push(`최대 피 +${item.hearts}칸`);
    if (item.slot === 'helmet') parts.push(`피격 후 무적 +${item.invuln}초`);
    if (item.slot === 'gloves') parts.push(`패링 지속 +${item.window}초`);
    if (item.slot === 'boots') parts.push(`이동 속도 +${Math.round(item.speed * 100)}%`);
    return { name: item.name, desc: parts.join(', '), slotName: SLOT_NAMES[item.slot], note: item.note || '' };
  }

  const ids = (...list) => list.map((id) => ITEMS[id]);
  const SHOPS = {
    potion: {
      title: '물약 상점',
      tabs: [{ name: '물약·도구', items: ids('potion1', 'potion2', 'magnifier') }],
    },
    sword: {
      title: '대장간',
      tabs: [
        { name: '검', items: ids('sword0', 'sword1', 'sword2', 'sword3', 'sword4') },
        { name: '대검', items: ids('great1', 'great2', 'great3', 'great4') },
        { name: '단검', items: ids('dagger1', 'dagger2', 'dagger3', 'dagger4') },
        { name: '지팡이', items: ids('staff1', 'staff2', 'staff3', 'staff4') },
        { name: '신성 강화', items: ids('holyup') },
      ],
    },
    weapon2: {
      title: '특수 무기 상점',
      tabs: [
        { name: '창', items: ids('spear1', 'spear2', 'spear3', 'spear4') },
        { name: '도끼', items: ids('axe1', 'axe2', 'axe3', 'axe4') },
        { name: '망치', items: ids('hammer1', 'hammer2', 'hammer3', 'hammer4') },
        { name: '도', items: ids('katana1', 'katana2', 'katana3') },
        { name: '레피어', items: ids('rapier1', 'rapier2', 'rapier3') },
        { name: '채찍', items: ids('whip1', 'whip2', 'whip3') },
        { name: '특수 검', items: ids('sword5', 'sword6', 'sword7', 'great5') },
        { name: '대·단검', items: ids('great6', 'dagger5', 'staff5', 'staff6') },
        { name: '독', items: ids('sword8', 'dagger6', 'spear5', 'axe5') },
      ],
    },
    dweapon: {
      title: '다크월드 무기 상점',
      tabs: [
        { name: '폭탄', items: ids('bomb1', 'bomb2', 'bomb3', 'bomb4') },
        { name: '총', items: ids('gun1', 'gun2', 'gun3', 'gun4') },
        { name: '산탄총', items: ids('sg1', 'sg2', 'sg3') },
        { name: '활', items: ids('bow1', 'bow2', 'bow3', 'bow4') },
        { name: '석궁', items: ids('xbow1', 'xbow2', 'xbow3') },
        { name: '낫', items: ids('scythe1', 'scythe2', 'scythe3', 'scythe4') },
        { name: '방패', items: ids('shield1', 'shield2', 'shield3', 'shield4') },
      ],
    },
    mgshell: { title: '야바위', tabs: [] },
    mgtarget: { title: '맞추기', tabs: [] },
    mgduel: { title: '다른 용사와 결투', tabs: [] },
    mggun: { title: '총게임', tabs: [] },
    pants: {
      title: '바지 가게',
      tabs: [
        { name: '바지', items: ids('pants1', 'pants2', 'pants3', 'pants4') },
        { name: '특수 바지', items: ids('pants5', 'pants6', 'pants7', 'pants8') },
        { name: '속성 바지', items: ids('pants9', 'pants10', 'pants11', 'pants12') },
      ],
    },
    darmor: {
      title: '다크월드 갑옷 가게',
      tabs: [
        { name: '갑옷', items: ids('darmor1', 'darmor2', 'darmor4', 'darmor3') },
        { name: '속성 갑옷', items: ids('dparmor1', 'dparmor2', 'dparmor3', 'dparmor4') },
        { name: '투구', items: ids('dhelmet1', 'dhelmet2', 'dhelmet3', 'dhelmet4') },
        { name: '장갑', items: ids('dgloves1', 'dgloves2', 'dgloves3', 'dgloves4') },
        { name: '신발', items: ids('dboots1', 'dboots2', 'dboots3', 'dboots4') },
        { name: '바지', items: ids('dpants1', 'dpants2', 'dpants3', 'dpants4') },
      ],
    },
    dupgrade: {
      title: '강화소 (EXP)',
      exp: true,
      tabs: [{ name: '강화', items: ids('wup', 'aup') }],
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
      tabs: [{ name: '업그레이드', items: ids('mineup', 'speedup', 'critup', 'stmaxup', 'stregenup') }],
    },
    armor: {
      title: '갑옷 가게',
      tabs: [
        { name: '갑옷', items: ids('armor1', 'armor2', 'armor3', 'armor4') },
        { name: '속성 갑옷', items: ids('parmor1', 'parmor2', 'parmor3', 'parmor4') },
        { name: '투구', items: ids('helmet1', 'helmet2', 'helmet3', 'helmet4') },
        { name: '장갑', items: ids('gloves1', 'gloves2', 'gloves3', 'gloves4') },
        { name: '신발', items: ids('boots1', 'boots2', 'boots3', 'boots4') },
        { name: '특수 장비', items: ids('vhelm', 'vglove1', 'vglove2', 'vboot') },
      ],
    },
  };

  // 인벤토리: items = 가진 아이템 id (얻은 순서), equipped = 칸별로 낀 아이템 id (장갑/신발은 비어 있을 수 있다)
  function newInventory() {
    return {
      items: ['wood0', 'rags'],
      potions: { potion1: 0, potion2: 0 }, // 물약 개수
      used: {}, // 장비마다 쓴 양 (무기는 휘두른 횟수, 방어구는 입은 초)
      invSort: 'default', // 인벤토리 정렬
      invSub: 'all', // 무기/방어구 탭의 종류 필터
      hotbar: ['wood0', null, null, null, null], // 왼쪽 위 무기 칸 1~5 (숫자 키로 바꿔 든다)
      forgeJob: null, // 합치기 작업대에 올려 둔 작업 (forge.js)
      copies: {}, // 같은 무기를 여러 자루 가졌을 때의 개수 (3개를 대장간에서 합친다). 없으면 1자루
      ores: {}, // 캔 광석 개수 (광물 동굴)
      ingots: {}, // 제련한 주괴 개수
      attach: {}, // 무기마다 붙인 주괴 목록
      holy: {}, // 칼마다 붙인 신성 크리스탈 개수
      materials: { darkcrystal: 0, cleancrystal: 0, holycrystal: 0 }, // 보스가 떨어뜨리는 소중한 물건의 개수 (쌓인다)
      consumables: { st70: 0, st30: 0, icebomb: 0 }, // 다크월드 소모품 개수
      home: { type: null, owned: {}, placed: { floor: [], wall: [] } }, // 우리 집: 산 집 종류, 가진 장식품 개수, 방에 놓은 장식품
      mineLevel: 1, // 동굴 보상 업그레이드 레벨 (동굴 보물 상자 코인)
      speedLevel: 0, // 마을 달리기 업그레이드 레벨 (마을에서의 이동 속도)
      critLevel: 0, // 치명타 업그레이드 레벨 (치명타 대미지 = 10 + 레벨)
      stMaxLevel: 0, // 스태미나 최대 업그레이드 레벨 (보상 상점)
      stRegenLevel: 0, // 스태미나 회복 속도 업그레이드 레벨 (보상 상점)
      wlevel: {}, // 무기 강화 레벨 (무기 id마다)
      armorLevel: 0, // 갑옷 강화 레벨 (최대 피 +1칸 / 레벨)
      equipped: { weapon: 'wood0', helmet: null, armor: 'rags', gloves: null, pants: null, boots: null, pick: null },
    };
  }

  // 낀 장비의 능력치 합계
  function stats(inv) {
    const w = ITEMS[inv.equipped.weapon];
    const a = ITEMS[inv.equipped.armor];
    const h = inv.equipped.helmet ? ITEMS[inv.equipped.helmet] : null;
    const g = inv.equipped.gloves ? ITEMS[inv.equipped.gloves] : null;
    const b = inv.equipped.boots ? ITEMS[inv.equipped.boots] : null;
    const pn = inv.equipped.pants ? ITEMS[inv.equipped.pants] : null;
    const wl = (inv.wlevel && inv.wlevel[inv.equipped.weapon]) || 0;
    const ab = attachOf(inv, w); // 붙인 주괴 보너스
    return {
      reachTiles: w.reach + (w.shot ? 0 : 0.05 * wl + ab.reach) + (g && g.reachAdd ? g.reachAdd : 0), // 강화: 근접 무기는 범위가 넓어진다
      dmgBonus: w.shot ? wBonus(wl) + ab.gdmg : 0,             // 강화: 쏘는 무기는 대미지가 늘어난다 (레벨이 오를수록 더 크게)
      bossBonus: w.shot ? 0 : wBonus(wl) + ab.boss,  // 강화: 근접 무기는 보스에게 더 아프다 (레벨이 오를수록 더 크게)
      baseDmg: w.shot ? 1 : meleeBase(w) + ab.dmg,
      hitPower: w.shot ? 1 : 1 + Math.floor(wBonus(wl) / 5) + Math.floor(meleeBase(w) / 4) + ab.hit + Math.floor(ab.dmg / 3), // 단단한 몬스터를 한 번에 깎는 횟수
      staminaAdd: ab.st,                              // 쏘는 무기: 한 번에 드는 스태미나 증감 (티타늄 등은 줄여 준다)
      radiusAdd: ab.radius,                           // 폭탄 폭발 범위 증가(칸)
      pierceAdd: !!ab.pierce,                         // 탄환 관통
      throwTiles: w.throwTiles,
      canThrow: ['sword', 'dagger', 'staff', 'spear', 'katana', 'rapier'].includes(w.type), // 대검/도끼/망치/채찍/폭탄/총/활/방패는 던질 수 없다
      cooldownAdd: w.cd + (g && g.cdAdd ? g.cdAdd : 0) + ab.cd,
      dashCostAdd: b && b.dashCostAdd ? b.dashCostAdd : 0,
      hearts: (a ? a.hearts : 0) + (pn ? pn.hearts || 0 : 0) + (inv.armorLevel || 0),
      invulnAdd: (h ? h.invuln : 0) + (a && a.invuln ? a.invuln : 0) + (pn && pn.invuln ? pn.invuln : 0), // 투구 + 그림자 갑옷
      perk: a && a.perk ? a.perk : null,               // 속성 갑옷의 능력 (thorn/fire/ice/volt/toxic/regen/gold)
      windowAdd: (g ? g.window : 0) + (w.windowAdd || 0),
      speedAdd: (b ? b.speed : 0) + (pn && pn.speed ? pn.speed : 0),
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
    if (item.upgrade === 'holy') { // 대장간: 신성 크리스탈을 칼에 붙인다
      const wd = ITEMS[wallet.inv.equipped.weapon];
      if (!HOLY_TYPES.includes(wd.type)) return { ok: false, msg: '칼에만 붙일 수 있어요. (검, 대검, 단검, 낫)' };
      if (holyLevel(wallet.inv) >= HOLY_MAX) return { ok: false, msg: '이 칼은 더 붙일 수 없어요.' };
      if ((wallet.inv.materials.holycrystal || 0) < 1) return { ok: false, msg: '신성 크리스탈이 없어요. 보스의 어둠의 크리스탈을 숲의 샘물로 씻고, 화산의 제단에서 바꿔 오세요.' };
      wallet.inv.materials.holycrystal -= 1;
      wallet.inv.holy[wd.id] = (wallet.inv.holy[wd.id] || 0) + 1;
      return { ok: true, msg: `${wd.name}에 신성 크리스탈을 붙였다! 탑의 보스에게 대미지 x${wallet.inv.holy[wd.id] + 1}` };
    }
    if (item.upgrade === 'weapon' || item.upgrade === 'armor') { // 강화소: 경험치로 강화
      if (upMaxed(item, wallet.inv)) return { ok: false, msg: '이미 최고 레벨이에요.' };
      const cost = priceOf(item, wallet.inv);
      if ((wallet.exp || 0) < cost) return { ok: false, msg: '경험치가 부족해요.' };
      wallet.exp -= cost;
      if (item.upgrade === 'armor') {
        wallet.inv.armorLevel = (wallet.inv.armorLevel || 0) + 1;
        wallet.maxLives = maxLivesFor(wallet.inv, C.PLAYER_LIVES);
        wallet.lives = Math.min(wallet.maxLives, wallet.lives + 1); // 늘어난 칸만큼 피도 채워 준다
        return { ok: true, msg: `갑옷 Lv ${wallet.inv.armorLevel}! 최대 피 +${wallet.inv.armorLevel}칸.` };
      }
      const id = wallet.inv.equipped.weapon;
      wallet.inv.wlevel[id] = (wallet.inv.wlevel[id] || 0) + 1;
      return { ok: true, msg: `${ITEMS[id].name} Lv ${wallet.inv.wlevel[id]}! 강화 완료.` };
    }
    if (item.upgrade === 'stmax' || item.upgrade === 'stregen') { // 보상 상점: 스태미나
      if (upMaxed(item, wallet.inv)) return { ok: false, msg: '이미 최고 레벨이에요.' };
      const cost = priceOf(item, wallet.inv);
      if (wallet.coins < cost) return { ok: false, msg: '코인이 부족해요.' };
      wallet.coins -= cost;
      if (item.upgrade === 'stmax') {
        wallet.inv.stMaxLevel = (wallet.inv.stMaxLevel || 0) + 1;
        return { ok: true, msg: `Lv ${wallet.inv.stMaxLevel}! 최대 스태미나 ${staminaMax(wallet.inv)}` };
      }
      wallet.inv.stRegenLevel = (wallet.inv.stRegenLevel || 0) + 1;
      return { ok: true, msg: `Lv ${wallet.inv.stRegenLevel}! 스태미나 초당 ${staminaRegen(wallet.inv)} 회복` };
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
    if (item.forge) return G.Forge.act(item, wallet); // 대장간: 합치기/제련/부착
    const dupWeapon = item.slot === 'weapon' && G.Forge && G.Forge.canMerge(item); // 같은 무기를 더 사서 3개를 합칠 수 있다
    if ((item.slot || item.tool) && wallet.inv.items.includes(item.id) && !dupWeapon) return { ok: false, msg: '이미 가지고 있어요.' };
    if (wallet.coins < item.price) return { ok: false, msg: '코인이 부족해요.' };
    wallet.coins -= item.price;
    if (item.heal !== undefined) { // 물약은 바로 마시지 않고 가방에 넣는다 (피가 가득이어도 살 수 있다)
      const n = (wallet.inv.potions[item.id] || 0) + 1;
      wallet.inv.potions[item.id] = n;
      return { ok: true, msg: `${item.name} 구매! (보유 ${n}개)` };
    }
    if (item.pickaxe) { // 곡괭이: 가장 좋은 것이 자동으로 쓰인다
      wallet.inv.items.push(item.id);
      G.Forge.autoEquipPick(wallet.inv);
      return { ok: true, msg: `${item.name} 구매! 인벤토리에서 장착하면 광물 동굴에서 ${item.pickaxe}단계 광석까지 캘 수 있다.` };
    }
    if (item.tool) { // 도구는 인벤토리에 들어간다
      wallet.inv.items.push(item.id);
      return { ok: true, msg: `${item.name} 구매! 이제 보스의 약점이 보인다.` };
    }
    if (dupWeapon && wallet.inv.items.includes(item.id)) { // 이미 있는 무기: 한 자루 더
      const n = G.Forge.addCopy(wallet.inv, item.id);
      return { ok: true, msg: `${item.name} 한 자루 더! (보유 ${n}개) 같은 무기 3개는 용광로에서 합칠 수 있어요.` };
    }
    if (item.lens) { // 돋보기는 사도 장착하지 않는다 (인벤토리에서 직접 끼운다)
      wallet.inv.items.push(item.id);
      return { ok: true, msg: `${item.name} 구매! 인벤토리에서 무기로 장착하면 약점을 분석할 수 있다.` };
    }
    if (item.slot) { // 산 장비는 바로 장착한다
      wallet.inv.items.push(item.id);
      wallet.inv.equipped[item.slot] = item.id;
      return { ok: true, msg: `${item.name} 구매! 장착했다.` };
    }
    return { ok: true, msg: `${item.name} 구매!` };
  }

  // 인벤토리 격자에 들어갈 칸 목록: 장비(얻은 순서) 다음에 가진 물약(개수 포함)
  // 인벤토리 분류: 전체 / 무기 / 방어구 / 소모품 / 재료
  const CATEGORIES = [{ id: 'all', name: '전체' }, { id: 'weapon', name: '무기' }, { id: 'armor', name: '방어구' }, { id: 'consume', name: '소모품' }, { id: 'material', name: '재료' }];
  const catOf = (it) => (it.quest || it.tool ? 'material' : it.consumable || it.heal !== undefined ? 'consume' : it.slot === 'weapon' ? 'weapon' : 'armor');
  // 종류: 무기는 검 -> 대검 -> 단검 -> 낫 -> 지팡이 -> 폭탄 -> 총 -> 활 -> 방패, 방어구는 갑옷 -> 투구 -> 장갑 -> 신발 순으로 묶어서 보여준다
  const WEAPON_TYPE_ORDER = ['sword', 'great', 'dagger', 'katana', 'rapier', 'spear', 'axe', 'hammer', 'whip', 'scythe', 'staff', 'bomb', 'gun', 'shotgun', 'bow', 'crossbow', 'shield'];
  const ARMOR_SLOT_ORDER = ['armor', 'helmet', 'gloves', 'pants', 'boots'];
  const kindOf = (it) => (it.slot === 'weapon' ? it.type : it.slot && it.slot !== 'weapon' ? it.slot : null); // 세부 종류
  const rankOf = (it) => (it.slot === 'weapon' ? WEAPON_TYPE_ORDER.indexOf(it.type) : it.slot ? 20 + ARMOR_SLOT_ORDER.indexOf(it.slot) : it.consumable || it.heal !== undefined ? 40 : 50);
  // 무기 탭/방어구 탭의 종류 버튼 목록 [{id, name, n}] (가진 종류만)
  function subList(inv, cat) {
    if (cat !== 'weapon' && cat !== 'armor') return [];
    const order = cat === 'weapon' ? WEAPON_TYPE_ORDER : ARMOR_SLOT_ORDER;
    const names = cat === 'weapon' ? TYPE_NAMES : SLOT_NAMES;
    const all = gridEntriesAll(inv).filter((en) => catOf(ITEMS[en.id]) === cat);
    const out = [{ id: 'all', name: '전체', n: all.length }];
    for (const k of order) {
      const n = all.filter((en) => kindOf(ITEMS[en.id]) === k).length;
      if (n > 0) out.push({ id: k, name: names[k], n });
    }
    return out;
  }
  // 정렬: 종류별(기본) / 많이 쓴 순 / 레벨순 / 좋은 순 / 이름순 (무기와 방어구 모두)
  const SORTS = [{ id: 'default', name: '종류별' }, { id: 'used', name: '많이 쓴 순' }, { id: 'level', name: '레벨순' }, { id: 'best', name: '좋은 순' }, { id: 'name', name: '이름순' }];
  // 얼마나 좋은가 (좋은 순): 무기는 대미지(강화·신성 포함)와 범위, 방어구는 최대 피·무적·패링·속도·특수 능력
  function powerOf(item, inv) {
    if (!item) return 0;
    if (item.slot === 'weapon') {
      const wl = (inv.wlevel && inv.wlevel[item.id]) || 0;
      const holy = (inv.holy && inv.holy[item.id]) || 0;
      const ab = attachOf(inv, item);
      const dmg = item.shot ? item.dmg + wBonus(wl) + ab.gdmg : meleeBase(item) + wBonus(wl) + ab.dmg;
      return dmg * (1 + holy) * 3 + (item.shot ? 0 : (item.reach + 0.05 * wl) * 2) + (item.shot && item.radius ? item.radius : 0) + (item.price || 0) / 10000;
    }
    if (item.slot) return (item.hearts || 0) * 3 + (item.invuln || 0) * 2 + (item.window || 0) * 10 + (item.speed || 0) * 5 + (item.critAdd || 0) * 20 + (item.perk ? 2 : 0) + (item.stamRegen || 0) * 0.4 + (item.coinAdd || 0) * 8 + (item.reachAdd || 0) * 6 + (-(item.cdAdd || 0)) * 10 + (-(item.dashCostAdd || 0)) * 0.2 + (item.price || 0) / 10000;
    return 0;
  }
  // 레벨순: 무기는 강화 레벨(+신성), 방어구는 등급(성능 점수)
  const levelScore = (item, inv) => (item && item.slot === 'weapon' ? ((inv.wlevel && inv.wlevel[item.id]) || 0) + ((inv.holy && inv.holy[item.id]) || 0) * 0.5 : powerOf(item, inv));
  // 정렬 기준 값 (인벤토리 설명 옆에 보여준다)
  function sortValue(inv, id) {
    const it = ITEMS[id];
    const mode = inv.invSort || 'default';
    if (mode === 'used') return `사용 ${(inv.used && inv.used[id]) || 0}`;
    if (mode === 'level') return it && it.slot === 'weapon' ? `강화 +${(inv.wlevel && inv.wlevel[id]) || 0}` : `등급 ${Math.round(powerOf(it, inv) * 10) / 10}`;
    if (mode === 'best') return `점수 ${Math.round(powerOf(it, inv) * 10) / 10}`;
    return '';
  }
  function gridEntries(inv, cat) {
    const all = gridEntriesAll(inv);
    let list = !cat || cat === 'all' ? all : all.filter((en) => catOf(ITEMS[en.id]) === cat);
    if ((cat === 'weapon' || cat === 'armor') && inv.invSub && inv.invSub !== 'all') list = list.filter((en) => kindOf(ITEMS[en.id]) === inv.invSub);
    const mode = inv.invSort || 'default';
    if (mode === 'default') { // 종류별로 묶고, 같은 종류 안에서는 싼(약한) 것부터
      return list
        .map((en, i) => ({ en, i, r: rankOf(ITEMS[en.id]), p: ITEMS[en.id].price || 0 }))
        .sort((a, b) => a.r - b.r || a.p - b.p || a.i - b.i)
        .map((x) => x.en);
    }
    const key = (en) => (mode === 'used' ? (inv.used && inv.used[en.id]) || 0 : mode === 'level' ? levelScore(ITEMS[en.id], inv) : powerOf(ITEMS[en.id], inv));
    return list
      .map((en, i) => ({ en, i, k: mode === 'name' ? 0 : key(en), p: powerOf(ITEMS[en.id], inv) }))
      .sort((a, b) => (mode === 'name' ? ITEMS[a.en.id].name.localeCompare(ITEMS[b.en.id].name, 'ko') : b.k - a.k || b.p - a.p) || a.i - b.i)
      .map((x) => x.en);
  }
  function gridEntriesAll(inv) {
    return inv.items.map((id) => { const n = inv.copies && inv.copies[id]; return n > 1 ? { id, count: n } : { id }; }).concat(
      G.Forge ? G.Forge.gridExtra(inv) : [],
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

  G.Shop = { subList, SORTS, powerOf, sortValue, CATEGORIES, staminaMax, staminaRegen, holyMult, homeBonuses, critDamage, decorLeft, placeDecor, placeTabs, addMaterial: (inv, id) => { inv.materials[id] = (inv.materials[id] || 0) + 1; return inv.materials[id]; }, priceOf, mineReward, speedMult, upMaxed, ITEMS, SHOPS, SLOT_NAMES, TYPE_NAMES, newInventory, describe, stats, maxLivesFor, buy, gridEntries, usePotion, bestPotion };
})(window.Game);
