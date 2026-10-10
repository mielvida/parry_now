// 진입점: 모듈을 조립하고 고정 스텝 게임 루프를 돌린다.
(function (G) {
  const C = G.Config;

  const canvas = document.getElementById('game');
  const input = new G.Input(window);
  const renderer = new G.Renderer(canvas, C.VIEW_W, C.VIEW_H);
  const camera = new G.Camera(C.VIEW_W, C.VIEW_H);
  const effects = new G.Effects();

  // 마을 동굴은 들어갈 때마다 새로 생성된다 (mineRun번째 탐험일수록 길다. 상자 코인은 업그레이드 레벨로 정해진다)
  let mineRun = 0;
  let mineLevel = null;
  let oreRun = 0;       // 광물 동굴을 들어간 횟수 (많을수록 길고 희귀한 광석이 많다)
  let oreLevel = null;
  const mineCoins = () => G.Shop.mineReward(inv.mineLevel); // 동굴 상자 코인은 '동굴 보상 상점'에서 업그레이드한 레벨로 정해진다
  const oreCoins = () => Math.round(mineCoins() * 0.6); // 광물 동굴 상자는 마을 동굴의 60%
  // 광물 동굴 지형: 마을 동굴 생성기를 쓰되 몬스터는 적게
  function makeOreCave(run) {
    const length = Math.min(300, 140 + 24 * run);
    return G.MineGen.generate(run, Math.random, { length, slimes: Math.max(3, Math.floor(length / 34)), bats: Math.floor(length / 55) });
  }
  function enterMine() {
    mineRun += 1;
    mineLevel = G.MineGen.generate(mineRun);
    loadStage('mine', true);
  }

  // 스테이지 목록: 동굴(보물 상자) -> 해변(끝의 집, 노인) -> 마을(상점, 동굴 입구) <-> 마을 동굴. 주소 뒤에 ?stage=beach / village / mine 으로 바로 시작
  const STAGES = {
    cave: {
      music: 'cave', level: G.Levels.level1, theme: G.Cave, summon: true, goal: '목표: 지도의 X, 동굴 맨 끝의 보물 상자를 찾아라',
      chest: { mode: 'cave', coins: C.TREASURE_COINS, next: 'beach' },
    },
    beach: {
      music: 'cave', level: G.Levels.beach, theme: G.Beach, goalHouse: true, goal: '목표: 낯선 해변 오른쪽 끝의 집까지 가라 (꽃게 조심!)',
      banner: { title: 'STAGE 2', sub: '지상 - 낯선 해변', dur: 5, caption: '…여기는 어디지? 처음 보는 해변이다. 아무래도 엉뚱한 곳으로 올라온 모양이다.' },
    },
    village: {
      music: 'village', level: G.Levels.village, theme: G.Beach, monsterless: true, goal: '마을을 둘러보자: 가게 앞에서 E 키, 오른쪽 끝에는 동굴 입구가 있다 (장비: I 키)',
      banner: { title: 'STAGE 3', sub: '해변 마을', dur: 5, caption: '…마을이다! 몬스터는 보이지 않고, 가게들이 늘어서 있다.' },
    },
    darkhub: { // 다크월드 입구: 무기 상점, 아이템 상점, 던전으로 오르는 문
      music: 'cave', label: '다크월드', level: G.Levels.darkhub, theme: G.DarkTheme, monsterless: true, returnNear: 'darkhub', exitTo: 'village',
      goal: '다크월드: 무기/아이템 상점이 있다. 오른쪽 문으로 던전(100층)에 올라 시크너를 쓰러뜨려라!',
      banner: { title: '다크월드', sub: '시크너의 영역', dur: 4, caption: '…공기가 무겁다. 이 던전 맨 꼭대기, 100층에 시크너가 있다.' },
    },
    dungeon: { // 어둠의 던전: 층마다 새로 생기고 올라갈수록 어렵다
      music: 'cave', theme: G.DarkTheme, dark: true, summon: true, returnNear: 'dungeon', exitTo: 'darkhub',
      get level() { return dungeon.rows; },
      get boss() { return dungeon.boss; },
      get label() { return `어둠의 탑 ${darkFloor}층`; },
      get goal() { return `어둠의 탑 ${darkFloor}층 / ${C.DUNGEON_FLOORS}층: ${dungeon.boss ? '보스를 쓰러뜨려라!' : '발판을 타고 꼭대기 계단으로! (암흑은 맞으면 -3)'}  [B 얼음폭탄 · V 먹기]`; },
      get banner() { return { title: `${darkFloor}층`, sub: dungeon.bossKind ? '보스가 기다린다…' : '어둠의 탑', dur: 2.5, caption: dungeon.bossKind ? '…강한 기운이 느껴진다. 이 층의 끝에 보스가 있다.' : '…위로, 위로. 시크너가 기다린다.' }; },
    },
    duelarena: { // 결투장: 보스전처럼 AI 용사와 싸운다
      music: 'cave', label: '결투장', level: G.Levels.duelarena, theme: G.Beach, monsterless: true, returnNear: 'village', exitTo: 'village',
      boss: { col: 2, kind: 'duel' },
      get goal() { return duelRun ? `결투! ${duelRun.mode === 'cowboy' ? '총싸움' : '공격! (칼싸움)'} — 상대 체력을 0으로! 던지는 무기는 던지고, 쏘는 무기는 쏴요. 건 돈 ${duelRun.cost} G` : '결투장'; },
      banner: { title: '결투!', sub: '링 위의 승부', dur: 2.5, caption: '…관중이 환호한다. 상대의 체력을 먼저 0으로 만들어라!' },
    },
    home: { // 우리 집 안 (마을의 내 집 터에서 E). 장식품을 놓고 치우는 곳
      music: 'village', label: '우리 집', monsterless: true, returnNear: 'Y', theme: G.HomeTheme,
      get level() { return G.Home.levelFor(inv.home.type); },
      goal: '우리 집: 점선 칸 앞에서 E 키로 장식을 놓거나 치울 수 있다. 왼쪽 문에서 E: 마을로',
      banner: { title: '우리 집', sub: '마을에 정착!', dur: 3, caption: '…이제 여기가 내 집이다. 가게에서 산 장식으로 꾸며 보자.' },
    },
    mine: {
      music: 'cave', returnNear: 'D',
      get level() { return mineLevel; },
      theme: G.Cave, summon: true, repeatChest: true, // 상자는 들어갈 때마다 다시 나온다
      get goal() { return `목표: 동굴 맨 끝의 보물 상자 (+${mineCoins()} G). 돌아가려면 입구의 출구에서 E`; },
      chest: { mode: 'mine', get coins() { return mineCoins(); }, next: 'village', near: 'D' },
      get banner() {
        return { title: '마을 동굴', sub: `${mineRun}번째 탐험 · 길이 ${mineLevel[0].length}칸`, dur: 3.5, caption: '…동굴 안은 어둡고, 슬라임과 박쥐의 기척이 느껴진다.' };
      },
    },
    // ---- 광물 동굴: 곡괭이로 광석을 캔다 (마을 39열의 문). 들어갈 때마다 새로 생성되고, 끝의 상자는 코인을 준다 ----
    orecave: {
      music: 'cave', label: '광물 동굴', returnNear: 'orecave',
      get level() { return oreLevel; },
      theme: G.Cave, summon: true, repeatChest: true,
      get goal() { return `목표: 곡괭이로 광석을 캐자 (E 길게). 동굴 끝의 상자 (+${oreCoins()} G). 돌아가려면 입구의 출구에서 E`; },
      chest: { mode: 'mine', get coins() { return oreCoins(); }, next: 'village', near: 'orecave' },
      get banner() {
        return { title: '광물 동굴', sub: `${oreRun}번째 채굴 · 길이 ${oreLevel[0].length}칸`, dur: 3.5, caption: '…벽 곳곳에서 광석이 반짝인다. 곡괭이로 E를 길게 눌러 캐 보자.' };
      },
    },
    // ---- 마을의 문으로 들어가는 스테이지들 (모두 끝에 보물 상자가 있고, 먹으면 코인을 받고 문 앞으로 돌아온다. 상자는 들어갈 때마다 다시 나온다) ----
    forest: {
      music: 'village', label: '속삭이는 숲', level: G.Levels.forest, theme: G.Forest, summon: true, repeatChest: true, returnNear: 'forest', slimeVariant: 'green',
      boss: { col: 121, kind: 'king', drop: 'darkcrystal' }, // 맨 끝 경기장(121칸~)에서 왕슬라임과 대결 (쓰러뜨리면 어둠의 크리스탈 1개)
      goal: '목표: 숲 끝의 왕슬라임을 쓰러뜨리고 보물 상자 (+1000 G, 경험치 40). 돌아가려면 처음의 출구에서 E',
      chest: { mode: 'mine', coins: 1000, exp: 40, next: 'village', near: 'forest' },
      banner: { title: '속삭이는 숲', sub: '슬라임 왕이 사는 초록 숲', dur: 3.5, caption: '…숲은 고요하다. 저 끝에 슬라임들의 왕이 있다고 한다.' },
    },
    snow: {
      music: 'cave', label: '얼음 산', level: G.Levels.snow, theme: G.Snow, summon: true, repeatChest: true, returnNear: 'snow', slimeVariant: 'ice', slippery: true, iceZone: true,
      monsterSpeed: C.SNOW_MOB_SPEED, monsterDamage: C.SNOW_MOB_DAMAGE, boss: { col: 164, kind: 'ape' }, // 몬스터는 느리지만 한 방에 목숨 2개. 맨 끝 경기장(164칸~)에서 털복숭이 침팬지와 대결
      goal: '목표: 설산 끝의 털복숭이 침팬지를 쓰러뜨리고 보물 상자 (+1500 G, 경험치 50). 몬스터에게 맞으면 -2! 바닥이 미끄럽다',
      chest: { mode: 'mine', coins: 1500, exp: 50, next: 'village', near: 'snow' },
      banner: { title: '얼음 산', sub: '바닥이 미끄러운 설산', dur: 3.5, caption: '…발밑이 꽁꽁 얼어 있다. 몬스터는 굼뜨지만, 한 번 맞으면 크게 다친다!' },
    },
    volcano: {
      music: 'cave', label: '불꽃 화산', level: G.Levels.volcano, theme: G.Volcano, summon: true, repeatChest: true, returnNear: 'volcano', slimeVariant: 'lava', fireZone: true,
      monsterSpeed: C.VOLCANO_MOB_SPEED, boss: { col: 145, drop: 'darkcrystal' }, // 쓰러뜨리면 어둠의 크리스탈을 떨어뜨린다. 용암 때문에 모든 몬스터가 빠르다. 맨 끝 경기장(145칸~)에서 용머리 3개와 대결
      goal: '목표: 화산 끝의 용머리 3개를 쓰러뜨리고 보물 상자 (+1000 G, 경험치 50). 돌아가려면 처음의 출구에서 E',
      chest: { mode: 'mine', coins: 1000, exp: 50, next: 'village', near: 'volcano' },
      banner: { title: '불꽃 화산', sub: '용암이 끓는 화산', dur: 3.5, caption: '…발밑에서 용암이 끓는다. 몬스터들이 뜨겁게, 그리고 빠르게 달려든다!' },
    },
  };

  // 마을 사람의 대사 (E 키로 말을 걸 때마다 마을 사람 순서대로 하나씩)
  const VILLAGER_LINES = [
    '마을 사람: "이 마을엔 몬스터가 없어서 평화롭지."',
    '마을 사람: "물약 가게에서 체력을 회복할 수 있다네."',
    '마을 사람: "같은 검 3개를 합쳐 더 강하게 만드는 건 옆의 용광로라네. 광물 동굴에서 캔 광석도 거기서 녹여 칼에 붙이게."',
    '마을 사람: "해변의 꽃게를 잡으면 코인을 떨어뜨린다더군."',
    '마을 사람: "마을 오른쪽 끝 동굴엔 보물이 있지만, 슬라임과 박쥐가 득시글하다네."',
    '마을 사람: "마을 곳곳의 문으로 숲, 설산, 화산에 갈 수 있다네. 갈수록 위험하지만 상자 보상도 크지."',
    '마을 사람: "갑옷 가게엔 투구와 장갑, 신발도 있지. I 키로 장비를, 1~5 키로 무기를 바꿀 수 있다네."',
    '마을 사람: "가끔 하늘이 어둡게 일렁이는 건, 기분 탓이겠지…"',
    '마을 사람: "왼쪽 끝 부동산에서 집을 사고, 인테리어 가게에서 가구를 사 방을 꾸며 보게나."',
    '마을 사람: "동굴 옆 상점에서 동굴 보물 상자의 코인을 업그레이드할 수 있다네. 최대 15레벨이지."',
  ];
  // 마을 동굴을 15번 클리어한 뒤 마을로 돌아오면 나오는 이야기
  const REVEAL_LINES = [
    '마을 사람: "…용사님, 동굴의 보물을 벌써 열다섯 번이나 가져오셨군요. 이제 말씀드려야겠어요."',
    '마을 사람: "사실 이 마을은… 어둠의 지배자 \'시크너\'에게 오랫동안 통제받던 마을이었답니다."',
    '마을 사람: "동굴의 보물도, 이 마을의 평화도… 전부 시크너가 거둬들이던 공물이었지요."',
    '용사: "(…그랬던 거였군. 그렇다면 내가 해야 할 일은 하나다.)"',
    '용사: "다크월드로 가서, 던전 100층에 있는 시크너를 반드시 쓰러뜨리겠다!"',
    '마을 왼쪽에 보랏빛 문이 나타났다. 다크월드로 갈 수 있다!  (마을에는 어두운 기운이 드리웠다…)',
  ];
  const DARK_VILLAGER_LINES = [
    '마을 사람: "용사님… 시크너를 쓰러뜨려 주세요. 이 마을을 어둠에서 구해 주세요."',
    '마을 사람: "다크월드의 던전은 올라갈수록 훨씬 강한 것들이 나온다고 해요. 부디 조심하세요."',
    '마을 사람: "스태미나가 바닥나면 대시도 못 해요. 아이템 상점의 스태미나 물약을 챙기세요."',
    '마을 사람: "중간에 정의의 어둠돌, 정의의 어둠이라는 무시무시한 것들이 길을 막고 있답니다."',
  ];
  const FINALE_LINES = [
    '시크너가 쓰러지자, 마을을 짓누르던 어둠이 서서히 걷혔다.',
    '마을 사람: "해냈어요! 용사님이 우리 마을을 구하셨어요!"',
    '용사는 오늘도 가게에서 장식을 고르며, 이 마을에 정착하기로 했다.  — THE END —',
  ];
  let stageName = '';
  let terrain = null;
  let spawn = null;
  let chest = null;     // 동굴의 보물 상자 (닿으면 클리어)
  let goalBox = null;   // 해변의 집 문 앞 (닿으면 클리어)
  let spots = [];
  let baseMonsterCount = 0;
  let stageTime = 0;    // 스테이지를 시작하고 흐른 시간 (스테이지 소개 배너용)

  let lives = C.PLAYER_LIVES;
  let gameOver = false;
  let gameOverTime = 0;
  let sword = null; // 던진 검 (없으면 null)
  let coins = 0;        // 보유 코인 (스테이지가 바뀌어도 유지)
  let exp = 0;          // 경험치 (보스 상자에서 얻는다. 아직 표시만 한다)
  const inv = G.Shop.newInventory(); // 가진 아이템과 낀 장비 (스테이지가 바뀌어도 유지)
  G.Forge.bind(inv); // 대장간(곡괭이)과 용광로(합치기·제련·부착)가 이 인벤토리를 본다
  let equipStats = G.Shop.stats(inv); // 낀 장비의 능력치 합계 (applyEquipment가 갱신)
  const bossKills = {};             // 보스를 쓰러뜨린 횟수 (스테이지/층별). 다시 도전할 때마다 보상이 3분의 2로 줄어든다
  let bossMul = 1;                  // 이번 보스전의 보상 배율 (처음 1, 그다음 2/3, 4/9 …)
  const chestTaken = {};            // 이미 연 보물 상자 (같은 상자로 코인을 또 벌 수 없다)
  let nextStage = null;             // 클리어 연출이 끝나면 갈 곳 {name, near}
  let skipBanner = false; // 마을에 처음 왔을 때의 소개/말은 한 번만
  const seenStages = {};
  let equipUI = null;   // 인벤토리 창 {cur(선택한 칸 번호), msg, msgT, ok}
  const maxLives = () => G.Shop.maxLivesFor(inv, C.PLAYER_LIVES); // 갑옷에 따라 늘어나는 최대 피
  let shop = null;      // 열려 있는 상점 {kind, def, msg, msgT, ok}
  let dialog = null;    // 마을 사람 대화 {text, t}
  const popups = [];    // 떠오르는 글자 {x, y, text, t, color?}
  const magic = G.Magic.create(); // 날아가는 지팡이 마법 (불덩이/독 방울/번개)
  let won = false;       // 스테이지 클리어 연출 중
  let wonTime = 0;
  let ending = null;     // 클리어 연출 ('cave': 코인 -> 해변, 'house': 노인과 대화 -> 마을)
  let footT = 0;                 // 달리기 먼지 간격
  let reapKills = 0;             // 낫으로 잡은 몬스터 수: 20마리마다 피 반 칸
  const dashCost = () => Math.max(5, C.DASH_STAMINA + equipStats.dashCostAdd); // 신발에 따라 대시 스태미나가 줄어든다
  const stMax = () => G.Shop.staminaMax(inv); // 최대 스태미나 (보상 상점 업그레이드)
  let stamina = C.STAMINA_MAX;   // 스태미나: 대시와 폭탄/총/활 공격에 쓴다
  let staminaWait = 0;           // 스태미나를 쓴 직후 회복이 잠깐 멈추는 시간
  const story = { caves: 0, pending: false, revealed: false, cleared: false }; // 이야기: 동굴 15번 클리어 -> 시크너 이야기 -> 다크월드 문
  let darkFloor = 1;             // 던전에서 지금 도전할 층
  const floorSeeds = {};         // 층마다 한번 정해진 지형/이벤트 씨앗: 죽어도 클리어 전까지는 똑같은 방에서 다시 시작한다
  // fn 안의 Math.random을 씨앗으로 고정해 같은 결과를 만든다
  function seeded(seed, fn) {
    const orig = Math.random;
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return fn(); } finally { Math.random = orig; }
  }
  const floorSeed = (f) => (floorSeeds[f] === undefined ? (floorSeeds[f] = Math.floor(Math.random() * 4294967296)) : floorSeeds[f]);
  let darkBest = 0;              // 지금까지 클리어한 가장 높은 층
  let dungeon = null;            // 지금 층의 지형 {floor, rows, boss}
  const pickups = [];            // 던전에서 주울 수 있는 아이템 {x,y,id,t}
  const enemyShots = [];         // 몬스터가 쏜 어둠 구슬 {x,y,vx,vy} (패링으로 쳐낼 수 있다)
  let boss = null;       // 보스전 (화산의 용머리 3개). 경기장에 들어서면 started
  let hitStop = 0; // >0 이면 게임 로직을 잠시 멈춤 (패링 타격감)

  const player = new G.Player(0, 0);
  // 몬스터 전체(슬라임 + 박쥐). 패링·검·접촉 판정은 종류와 무관하게 똑같이 적용된다
  const monsters = [];
  const slimeCount = () => monsters.filter((m) => m.kind === 'slime').length;

  // 스테이지를 처음 상태로 불러온다 (지형, 몬스터, 목숨, 플레이어, 카메라)
  // keepLives=false(기본)면 목숨을 가득 채우고 시작한다. 코인과 산 검은 항상 유지된다
  // near='D'면 마을의 동굴 입구 앞에서 시작한다 (동굴에서 돌아올 때)
  const makeChest = () => { // 던전(어둠의 탑)에서는 위층으로 오르는 문, 그 밖에는 보물 상자
    const door = stageName === 'dungeon';
    const w = door ? C.DOOR_W : C.CHEST_W;
    const h = door ? C.DOOR_H : C.CHEST_H;
    return Object.assign(terrain.placeOnTile(terrain.treasure.col, terrain.treasure.row, w, h), { w, h, open: 0, door });
  };

  // 보스 이벤트: 보스 모듈은 판정만 하고, 피해/이펙트/소리는 여기서 처리한다
  const bossEv = {
    hurt(d) { loseLife(player.x + player.w / 2, player.y + player.h / 2, d || 1); },
    sound(n) { G.Audio.play(n); },
    shake(m, d) { effects.shake(m, d); },
    fx(type, x, y) {
      if (type === 'fire') effects.sparkle(x, y);
      else if (type === 'burst') effects.fireBurst(x, y);
      else { effects.fireBurst(x, y); effects.shake(type === 'boom' ? 14 : 8, 0.5); G.Audio.play(type === 'boom' ? 'shatter' : 'vanish'); }
    },
    // 왕슬라임이 몸에서 슬라임을 튀어나가게 한다 (코인/경험치는 주지 않는다)
    spawnSlimes(list) {
      for (const s of list) {
        const k = s.kind || 'slime';
        let mo;
        if (k === 'darkstone') mo = new G.DarkStone(s.x - G.DarkStone.W / 2, s.y);
        else if (k === 'shade') mo = new G.Shade(s.x - G.Shade.W / 2, s.y - 20);
        else { mo = new G.Slime(s.x - C.SLIME_W / 2, s.y); mo.variant = k === 'darkslime' ? 'dark' : 'green'; }
        mo.noCoin = true;
        mo.noExp = true;
        mo.fromBoss = true;
        mo.stageSpeed = 1;
        mo.contactDmg = STAGES[stageName].dark ? 3 : 1;
        if (STAGES[stageName].dark) mo.dark = true;
        if (k !== 'shade') { mo.dir = s.dir; mo.vy = s.vy; }
        monsters.push(mo);
        effects.spawn(s.x, s.y + C.SLIME_H);
      }
      if (list.length) G.Audio.play('spawn');
    },
    countSpawns() { return monsters.filter((mo) => mo.fromBoss && mo.alive).length; },
    clearSpawns() { // 왕슬라임이 쓰러지면 낳은 슬라임도 사라진다
      for (let k = monsters.length - 1; k >= 0; k--) {
        if (monsters[k].fromBoss) { effects.vanish(monsters[k].x + monsters[k].w / 2, monsters[k].y + monsters[k].h / 2); monsters.splice(k, 1); }
      }
    },
    slamImpact(x, y) { effects.quakeDust(x, y, 96); effects.shake(10, 0.3); G.Audio.play('vanish'); },
    stunned() { popups.push({ x: player.x + player.w / 2, y: player.y - 40, text: `${boss.name} 기절! 지금이다!`, t: 2, color: 'rgba(255,230,120,A)' }); G.Audio.play('pickup'); },
    defeated() { // 용머리를 모두 쓰러뜨림: 보물 상자가 나타난다
      if (duelRun) { duelWin(); return; }
      chest = makeChest();
      const drop = STAGES[stageName].boss && STAGES[stageName].boss.drop; // 보스가 떨어뜨리는 소중한 물건 (이미 있으면 다시 주지 않는다)
      const key = stageName === 'dungeon' ? 'dungeon' + darkFloor : stageName;
      const kills = bossKills[key] || 0;
      bossKills[key] = kills + 1;
      bossMul = Math.pow(2 / 3, kills); // 처음엔 그대로, 다시 도전할 때마다 3분의 2
      if (kills > 0) popups.push({ x: player.x + player.w / 2, y: player.y - 100, text: `다시 도전: 보상 ${Math.round(bossMul * 100)}%`, t: 3, color: 'rgba(255,200,140,A)' });
      if (drop && Math.random() < bossMul) { // 처음엔 꼭, 다시 도전하면 3분의 2 확률로 소중한 물건 1개 (개수가 쌓인다)
        const n = G.Shop.addMaterial(inv, drop);
        popups.push({ x: player.x + player.w / 2, y: player.y - 70, text: `${G.Shop.ITEMS[drop].name} 1개 획득! (보유 ${n}개)`, t: 3, color: 'rgba(200,150,255,A)' });
      }
      effects.treasure(chest.x + chest.w / 2, chest.y);
      G.Audio.play('treasure');
      popups.push({ x: player.x + player.w / 2, y: player.y - 40, text: boss.defeatText, t: 2.5, color: 'rgba(255,213,74,A)' });
    },
  };
  function setupBoss() {
    resetAnalysis();
    bossMul = 1;
    for (let k = monsters.length - 1; k >= 0; k--) if (monsters[k].fromBoss) monsters.splice(k, 1); // 이전 보스전에서 낳은 슬라임 정리
    const st = STAGES[stageName];
    camera.minX = 0;
    const bk = st.boss && st.boss.kind;
    if (bk && bk.startsWith('dark_')) { // 다크월드 보스 (정의의 어둠돌 / 정의의 어둠 / 시크너)
      const DB = bk === 'dark_sikner' ? G.Sikner : G.DarkBoss; // 100층 시크너는 전용 패턴
      boss = new DB(st.boss.col * C.TILE, terrain.width - st.boss.col * C.TILE, (terrain.treasure.row + 1) * C.TILE, bossEv, bk.slice(5));
      return;
    }
    if (bk === 'duel' && duelRun) { // 결투장의 AI 용사
      boss = new G.DuelRival(st.boss.col * C.TILE, terrain.width - st.boss.col * C.TILE * 2, (terrain.treasure.row + 1) * C.TILE, bossEv, duelRun.cfg);
      return;
    }
    const Cls = st.boss && ({ ape: G.ApeBoss, king: G.KingSlime }[bk] || G.Boss);
    boss = st.boss ? new Cls(st.boss.col * C.TILE, terrain.width - st.boss.col * C.TILE, (terrain.treasure.row + 1) * C.TILE, bossEv) : null;
  }
  const bossOn = () => !!(boss && boss.started);
  const magicTargets = () => (bossOn() ? monsters.concat(boss.targets()) : monsters);
  // 속성 갑옷의 능력 (equipStats.perk): thorn 가시, fire 화염, ice 얼음, volt 번개, toxic 독가시, regen 재생 (gold 탐욕은 코인 계산, 그림자는 무적 시간에서)
  let perkT = 0;
  let regenT = 0;
  let usedT = 0; // 방어구를 입은 시간(초) 세기
  const perkScale = (perk) => 1 + 0.25 * Math.max(0, ((equipStats.perkLv && equipStats.perkLv[perk]) || 1) - 1); // 같은 속성이 하나 늘 때마다 범위 +25%
  function updateArmorPerks(dt) {
    const perks = equipStats.perks || [];
    if (!perks.length) return;
    if (perks.includes('regen')) {
      regenT += dt;
      const gap = Math.max(3, 10 - 2.5 * (((equipStats.perkLv && equipStats.perkLv.regen) || 1) - 1)); // 재생 속성이 많을수록 더 자주
      if (regenT >= gap) {
        regenT = 0;
        if (lives < maxLives()) {
          lives = Math.min(maxLives(), lives + 0.5);
          popups.push({ x: player.x + player.w / 2, y: player.y - 30, text: '재생 +½', t: 1.2, color: 'rgba(255,140,170,A)' });
        }
      }
    }
    const fire = perks.includes('fire');
    const toxic = perks.includes('toxic');
    if (!fire && !toxic) return;
    perkT += dt;
    if (perkT < 0.5) return;
    perkT = 0;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (const mo of monsters) {
      if (!mo.alive || mo.flying || mo.appear > 0) continue;
      const d = Math.hypot(mo.x + mo.w / 2 - px, mo.y + mo.h / 2 - py);
      if (fire && d <= 2 * C.TILE * perkScale('fire')) mo.applyBurn();
      if (toxic && d <= 2.5 * C.TILE * perkScale('toxic')) mo.applyPoison();
    }
  }
  // 몬스터에게 맞았을 때 일어나는 갑옷 능력 (s = 나를 친 몬스터)
  function armorHurtPerk(s) {
    const perks = equipStats.perks || [];
    if (!perks.length) return;
    const T = C.TILE;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const near = (rad) => monsters.filter((mo) => mo.alive && !mo.flying && mo.appear <= 0 && Math.hypot(mo.x + mo.w / 2 - px, mo.y + mo.h / 2 - py) <= rad);
    if (perks.includes('thorn') || perks.includes('toxic')) {
      s.knockback(Math.sign(s.x + s.w / 2 - px) || 1);
      effects.crystalShards(s.x + s.w / 2, s.y + s.h / 2);
    }
    if (perks.includes('ice')) {
      for (const mo of near(T * 3 * perkScale('ice'))) mo.freeze();
      effects.crystalShards(px, py);
    }
    if (perks.includes('volt')) {
      const r = T * 4 * perkScale('volt');
      for (const mo of near(r)) mo.stagger(Math.sign(mo.x + mo.w / 2 - px) || 1);
      effects.lightBurst(px, py, r);
    }
  }

  // ---------- 돈 버는 놀이: 야바위 / 공 던지기 표적 맞추기 / 다른 용사와 결투 (마을의 놀이마당) ----------
  const MINI_BETS = [100, 300, 1000];
  const miniLv = { shell: 0, duel: 0 }; // 이길수록 어려워진다 (야바위는 빨라지고, 결투 상대는 강해진다)
  const DUEL_RIVALS = [
    { name: '풋내기 용사 미르', armor: 'armor1', helmet: null, weapon: 'sword0' },
    { name: '떠돌이 검사 하늘', armor: 'armor2', helmet: 'helmet1', weapon: 'sword1' },
    { name: '결투가 라온', armor: 'armor3', helmet: 'helmet2', weapon: 'katana1' },
    { name: '검객 아린', armor: 'armor4', helmet: 'helmet3', weapon: 'rapier2' },
    { name: '기사 도윤', armor: 'darmor1', helmet: 'helmet4', weapon: 'sword6' },
    { name: '그림자 용사 세라', armor: 'darmor2', helmet: 'dhelmet2', weapon: 'katana3' },
    { name: '어둠의 검사 로건', armor: 'darmor4', helmet: 'dhelmet3', weapon: 'sword7' },
    { name: '전설의 용사 하랑', armor: 'darmor3', helmet: 'dhelmet4', weapon: 'great4' },
  ];
  let mini = null;
  const rand3 = () => Math.floor(Math.random() * 3);
  const miniGo = (m, st) => { m.st = st; m.t = 0; };
  function openMini(kind) {
    mini = { kind, st: 'bet', bi: 0, msg: '', msgT: 0, t: 0, level: miniLv[kind] || 0, cost: 0, win: 0, mode: 'cowboy' };
    mini.rname = DUEL_RIVALS[Math.min(DUEL_RIVALS.length - 1, mini.level)].name;
    G.Audio.play('pickup');
  }

  function updateMini(dt) {
    const m = mini;
    const pressed = (...c) => c.some((k) => input.wasPressed(k));
    m.t += dt;
    m.msgT = Math.max(0, m.msgT - dt);
    m.clicked = m.click || null; // 이번 프레임의 마우스 클릭 (화면 좌표)
    m.click = null;
    const hitBox = (p, x, y, w, h) => p && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
    if (pressed('Escape')) { mini = null; return; }
    if (m.st === 'bet') {
      let betClick = false;
      if (m.clicked) {
        if (m.kind === 'duel') ['cowboy', 'fight', 'ring', 'gun'].forEach((id, i) => { if (hitBox(m.clicked, 480 - 420 + i * 210, 86, 190, 40) && m.mode !== id) { m.mode = id; G.Audio.play('catch'); } });
        const n = m.kind === 'target' || m.kind === 'gun' ? 1 : 3;
        for (let i = 0; i < n; i++) if (hitBox(m.clicked, 480 - (n * 190 - 20) / 2 + i * 190, 324, 170, 80)) { if (n > 1) m.bi = i; betClick = true; }
      }
      if (m.kind === 'duel') { const MODES = ['cowboy', 'fight', 'ring', 'gun']; const i = MODES.indexOf(m.mode); const want = pressed('KeyC') ? 'cowboy' : pressed('KeyF') ? 'fight' : pressed('KeyR') ? 'ring' : pressed('KeyG') ? 'gun' : pressed('ArrowUp', 'KeyW') ? MODES[Math.max(0, i - 1)] : pressed('ArrowDown', 'KeyS') ? MODES[Math.min(3, i + 1)] : pressed('Tab') ? MODES[(i + 1) % 4] : null; if (want && want !== m.mode) { m.mode = want; G.Audio.play('catch'); } } // 결투 종류: 카우보이 / 공격!
      if (m.kind !== 'target' && m.kind !== 'gun') {
        if (pressed('ArrowLeft', 'KeyA')) m.bi = Math.max(0, m.bi - 1);
        if (pressed('ArrowRight', 'KeyD')) m.bi = Math.min(MINI_BETS.length - 1, m.bi + 1);
        for (let n = 1; n <= 3; n++) if (pressed('Digit' + n, 'Numpad' + n)) m.bi = n - 1;
      }
      if (betClick || pressed('Enter', 'NumpadEnter', 'Space', 'KeyE')) {
        const cost = m.kind === 'target' ? 100 : m.kind === 'gun' ? 100 : MINI_BETS[m.bi];
        if (m.kind === 'duel' && (m.mode === 'gun' || m.mode === 'fight')) { // 총싸움/공격!은 장착한 무기 종류가 맞아야 한다
          const problem = duelWeaponProblem(m.mode, inv.equipped.weapon);
          if (problem) { m.msg = problem; m.msgT = 3; G.Audio.play('deny'); return; }
        }
        if (coins < cost) { m.msg = '코인이 부족해요.'; m.msgT = 1.6; G.Audio.play('deny'); return; }
        coins -= cost;
        m.cost = cost;
        m.win = 0;
        G.Audio.play('coin');
        if (m.kind === 'shell') shellStart(m); else if (m.kind === 'target') targetStart(m); else if (m.kind === 'gun') gunStart(m); else if (m.mode === 'ring') fightStart(m); else if (m.mode === 'cowboy') duelStart(m); else startDuelArena(m);
      }
      return;
    }
    if (m.kind === 'shell') shellUpdate(m, dt, pressed);
    else if (m.kind === 'target') targetUpdate(m, dt, pressed);
    else if (m.kind === 'gun') gunUpdate(m, dt, pressed);
    else if (m.mode === 'ring') fightUpdate(m, dt, pressed);
    else duelUpdate(m, dt, pressed);
    if (m.st === 'result' && m.t > 0.8 && (m.clicked || pressed('Enter', 'NumpadEnter', 'Space', 'KeyE'))) { miniGo(m, 'bet'); m.msg = ''; m.rname = DUEL_RIVALS[Math.min(DUEL_RIVALS.length - 1, m.level)].name; }
  }

  // 야바위: 공이 든 컵을 보여 준 뒤 컵을 여러 번 섞는다. 공이 든 컵을 맞히면 건 돈의 2배
  function shellStart(m) {
    m.cups = [0, 1, 2].map((i) => ({ slot: i, px: i, py: 0, lift: 0 }));
    m.ball = rand3();
    m.swaps = [];
    const n = 14 + m.level * 3;
    for (let i = 0; i < n; i++) { const a = rand3(); let b = rand3(); while (b === a) b = rand3(); m.swaps.push([a, b]); }
    m.si = 0;
    m.sT = 0;
    m.sdur = Math.max(0.03, 0.075 - 0.011 * m.level); // 거의 찍는 것처럼 눈 깜짝할 새에 섞는다
    m.cur = 1;
    miniGo(m, 'show');
  }
  function shellUpdate(m, dt, pressed) {
    for (const c of m.cups) { c.px = c.slot; c.py = 0; }
    if (m.st === 'show') { // 공이 든 컵을 들어 올려 보여 준다
      m.cups.forEach((c, i) => { const want = i === m.ball && m.t < 1.1 ? 1 : 0; c.lift += (want - c.lift) * Math.min(1, 10 * dt); });
      if (m.t >= 1.5) { miniGo(m, 'shuffle'); m.sT = 0; }
    } else if (m.st === 'shuffle') {
      m.sT += dt;
      const sw = m.swaps[m.si];
      const u = Math.min(1, m.sT / m.sdur);
      const e = u * u * (3 - 2 * u);
      const ca = m.cups.find((c) => c.slot === sw[0]);
      const cb = m.cups.find((c) => c.slot === sw[1]);
      ca.px = sw[0] + (sw[1] - sw[0]) * e; ca.py = -Math.sin(u * Math.PI) * 30; // 한 컵은 앞으로 크게 돌아 나온다
      cb.px = sw[1] + (sw[0] - sw[1]) * e; cb.py = Math.sin(u * Math.PI) * 14;
      if (u >= 1) {
        ca.slot = sw[1]; cb.slot = sw[0]; ca.px = ca.slot; cb.px = cb.slot; ca.py = 0; cb.py = 0;
        m.si += 1; m.sT = 0;
        G.Audio.play('catch');
        if (m.si >= m.swaps.length) miniGo(m, 'pick');
      }
    } else if (m.st === 'pick') {
      if (pressed('ArrowLeft', 'KeyA')) { m.cur = Math.max(0, m.cur - 1); m.useMouse = false; }
      if (pressed('ArrowRight', 'KeyD')) { m.cur = Math.min(2, m.cur + 1); m.useMouse = false; }
      const cupAt = (p) => (p && p.y >= 235 && p.y < 360 ? [0, 1, 2].find((s) => Math.abs(p.x - (300 + s * 180)) < 54) : undefined);
      if (m.useMouse && cupAt(m.mouse) !== undefined) m.cur = cupAt(m.mouse); // 마우스를 올린 컵
      const cupClick = cupAt(m.clicked);
      if (cupClick !== undefined) m.cur = cupClick;
      if (cupClick !== undefined || pressed('Enter', 'NumpadEnter', 'Space', 'KeyE')) {
        const chosen = m.cups.findIndex((c) => c.slot === m.cur);
        m.pick = chosen;
        const win = chosen === m.ball;
        m.won = win;
        if (win) { m.win = m.cost * 2; coins += m.win; m.level = Math.min(5, m.level + 1); m.msg = `정답! +${m.win} G (다음엔 더 빨라진다)`; G.Audio.play('treasure'); }
        else { m.msg = '틀렸어요… 공은 다른 컵에 있었다.'; G.Audio.play('deny'); }
        miniLv.shell = m.level;
        miniGo(m, 'result');
      }
    } else if (m.st === 'result') { // 컵을 모두 열어 공이 어디 있었는지 보여 준다
      m.cups.forEach((c, i) => { const want = i === m.pick || m.t > 0.6 ? 1 : 0; c.lift += (want - c.lift) * Math.min(1, 10 * dt); });
    }
  }

  // 표적 맞추기: 방향키로 조준하고 Enter로 공을 던진다. 움직이는 표적의 한가운데일수록 점수가 높다 (참가비 100 G, 점수 x2 코인)
  function targetStart(m) {
    m.shots = 5; m.score = 0; m.cx = 480; m.cy = 330; m.ball = null; m.marks = []; m.tt = 0; m.endT = 0;
    m.tx = 480; m.ty = 235;
    miniGo(m, 'play');
  }
  function targetUpdate(m, dt, pressed) {
    m.tt += dt;
    const spd = 1.7 + 0.28 * (5 - m.shots); // 던질수록 더 빨라진다
    m.tx = 480 + Math.sin(m.tt * spd) * 240;
    m.ty = 235 + Math.sin(m.tt * spd * 0.8 + 1) * 60;
    for (const mk of m.marks) mk.t += dt;
    if (m.st !== 'play') return;
    const dn = (...c) => c.some((k) => input.down.has(k));
    const v = 420;
    m.cx = Math.max(130, Math.min(830, m.cx + ((dn('ArrowRight', 'KeyD') ? 1 : 0) - (dn('ArrowLeft', 'KeyA') ? 1 : 0)) * v * dt));
    m.cy = Math.max(100, Math.min(460, m.cy + ((dn('ArrowDown', 'KeyS') ? 1 : 0) - (dn('ArrowUp', 'KeyW') ? 1 : 0)) * v * dt));
    if (dn('ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'ArrowDown', 'KeyS', 'ArrowUp', 'KeyW')) m.useMouse = false;
    if (m.useMouse && m.mouse) { m.cx = Math.max(130, Math.min(830, m.mouse.x)); m.cy = Math.max(100, Math.min(460, m.mouse.y)); } // 마우스로 조준
    if (!m.ball && m.shots > 0 && (m.clicked || pressed('Enter', 'NumpadEnter', 'Space'))) { m.ball = { t: 0, ax: m.cx, ay: m.cy }; G.Audio.play('throw'); }
    if (m.ball) {
      m.ball.t += dt;
      if (m.ball.t >= 0.28) { // 공이 표적에 닿는 순간의 표적 위치로 판정
        const d = Math.hypot(m.ball.ax - m.tx, m.ball.ay - m.ty);
        const pts = d <= 10 ? 50 : d <= 22 ? 30 : d <= 36 ? 20 : d <= 52 ? 10 : 0; // 표적이 작아서 더 어렵다
        m.score += pts;
        m.marks.push({ x: m.ball.ax, y: m.ball.ay, pts, t: 0 });
        m.shots -= 1;
        m.ball = null;
        G.Audio.play(pts >= 30 ? 'treasure' : pts > 0 ? 'coin' : 'deny');
      }
    } else if (m.shots <= 0) {
      m.endT += dt;
      if (m.endT > 1.0) {
        m.win = m.score * 2;
        coins += m.win;
        m.msg = m.win > 0 ? `점수 ${m.score}점! +${m.win} G` : '아쉬워요… 하나도 못 맞혔다.';
        miniGo(m, 'result');
      }
    }
  }

  // 결투: 다른 용사와 마주 선다. "지금!"이 뜨면 상대보다 먼저 Enter. 너무 일찍 누르면 반칙패, 이기면 건 돈의 2배
  function duelStart(m) {
    const k = Math.min(DUEL_RIVALS.length - 1, m.level);
    m.rival = DUEL_RIVALS[k];
    m.rlv = k + 1;
    m.react = Math.max(0.19, 0.52 - 0.05 * k); // 상대의 반응 속도 (이길수록 빨라진다)
    m.rt = m.react + Math.random() * 0.06;
    m.wait = 1.3 + Math.random() * 2.3;
    m.reaction = 0;
    m.foul = false;
    m.swingT = 0;
    miniGo(m, 'ready');
  }
  function duelEnd(m, win, text) {
    m.won = win;
    if (win) { m.win = m.cost * 2; coins += m.win; m.level = Math.min(DUEL_RIVALS.length - 1, m.level + 1); G.Audio.play('treasure'); text += ` +${m.win} G`; }
    else G.Audio.play('hurt');
    miniLv.duel = m.level;
    m.msg = text;
    miniGo(m, 'result');
  }
  function duelUpdate(m, dt, pressed) {
    const hit = !!m.clicked || pressed('Enter', 'NumpadEnter', 'Space');
    if (m.st === 'ready') {
      if (hit) { m.foul = true; duelEnd(m, false, '너무 일렀다! 반칙패…'); } else if (m.t >= 0.9) miniGo(m, 'wait');
    } else if (m.st === 'wait') {
      if (hit) { m.foul = true; duelEnd(m, false, '너무 일렀다! 반칙패…'); } else if (m.t >= m.wait) { miniGo(m, 'go'); G.Audio.play('spawn'); }
    } else if (m.st === 'go') {
      if (hit) { m.reaction = m.t; if (m.reaction < m.rt) duelEnd(m, true, '내가 먼저 베었다!'); else duelEnd(m, false, '상대가 더 빨랐다…'); }
      else if (m.t >= m.rt) { m.reaction = m.t; duelEnd(m, false, '상대가 먼저 베었다…'); }
    } else if (m.st === 'result') m.swingT += dt;
  }

  // ---------- 총게임: 45초 사격 서바이벌 (참가비 100 G, 쓰러뜨린 한 명당 6 G, 끝까지 버티면 +100 G) ----------
  // ←→ 이동, Space 점프, Enter/클릭 사격(클릭은 그쪽으로), C 슬라이딩(잠깐 안 맞는다), F 막기(앞에서 오는 총알을 막는다. 막을 때마다 힘이 닳는다)
  const GUN = { x0: 110, x1: 850, gy: 430 };
  function gunStart(m) {
    m.g = { x: 220, y: 0, vy: 0, vx: 0, face: 1, hp: 5, inv: 0, slideT: 0, slideCd: 0, shotCd: 0, block: false, guardE: 100, foes: [], bullets: [], shots: [], kills: 0, spawnT: 0.8, t: 0, time: 45, fx: [] };
    miniGo(m, 'ready');
  }
  const this_mid = () => (GUN.x0 + GUN.x1) / 2;
  function gunUpdate(m, dt, pressed) {
    const g = m.g;
    for (const f of g.fx) f.t += dt;
    g.fx = g.fx.filter((f) => f.t < 0.8);
    if (m.st === 'ready') { if (m.t >= 1.3) { miniGo(m, 'play'); G.Audio.play('spawn'); } return; }
    if (m.st === 'result') return;
    const dn = (...c) => c.some((k) => input.down.has(k));
    g.t += dt;
    g.time -= dt;
    g.inv = Math.max(0, g.inv - dt);
    g.slideT = Math.max(0, g.slideT - dt);
    g.slideCd = Math.max(0, g.slideCd - dt);
    g.shotCd = Math.max(0, g.shotCd - dt);
    // ---- 내 조작 ----
    const dirX = (dn('ArrowRight', 'KeyD') ? 1 : 0) - (dn('ArrowLeft', 'KeyA') ? 1 : 0);
    g.block = dn('KeyF') && g.y === 0 && g.slideT === 0 && g.guardE > 0;
    if (pressed('KeyC') && g.y === 0 && g.slideCd === 0 && g.slideT === 0) { g.slideT = 0.4; g.slideCd = 0.9; g.slideDir = dirX || g.face; G.Audio.play('dash'); }
    if (g.slideT > 0) { g.vx = g.slideDir * 520 * (0.4 + 0.6 * g.slideT / 0.4); g.face = g.slideDir; }
    else g.vx += (dirX * (g.block ? 80 : 240) - g.vx) * Math.min(1, 14 * dt);
    if (g.slideT === 0 && dirX) g.face = dirX;
    if (pressed('Space', 'ArrowUp', 'KeyW') && g.y === 0 && g.slideT === 0) g.vy = 640;
    g.guardE = Math.min(100, g.guardE + (g.block ? 0 : 22) * dt);
    const shoot = (ax, ay) => {
      let ang = g.face > 0 ? 0 : Math.PI;
      if (ax !== undefined) { ang = Math.atan2(ay - (GUN.gy - 44 - g.y), ax - g.x); g.face = ax >= g.x ? 1 : -1; }
      g.shots.push({ x: g.x + g.face * 18, y: GUN.gy - 44 - g.y, vx: Math.cos(ang) * 1100, vy: Math.sin(ang) * 1100, life: 1.5 });
      g.shotCd = 0.11; // 연사가 빨라졌다
      g.flash = 0.08;
      G.Audio.play('gun');
    };
    if (g.shotCd === 0 && !g.block && g.slideT === 0) {
      if (m.clicked) shoot(m.clicked.x, m.clicked.y);
      else if (pressed('Enter', 'NumpadEnter')) shoot();
    }
    g.flash = Math.max(0, (g.flash || 0) - dt);
    // ---- 적 ----
    g.spawnT -= dt;
    g.volleyT = (g.volleyT === undefined ? 4 : g.volleyT) - dt;
    if (g.volleyT <= 0 && g.foes.length >= 2) { // 일제 사격: 여럿이 한꺼번에 겨눠서 같이 쏜다
      g.volleyT = Math.max(2.2, 4.2 - g.t * 0.04) + Math.random();
      for (const f of g.foes) if (f.aimT <= 0) { f.aimT = 0.42; f.volley = true; }
      g.fx.push({ x: this_mid(), y: GUN.gy - 150, t: 0, text: '일제 사격!' });
    }
    g.flyT = (g.flyT === undefined ? 3 : g.flyT) - dt;
    if (g.flyT <= 0 && g.foes.length < 9) { // 위·양옆 사방에서 날아오는 몹
      g.flyT = Math.max(1.6, 3.4 - g.t * 0.03) + Math.random();
      const side = Math.floor(Math.random() * 3); // 0 위, 1 왼쪽, 2 오른쪽
      const fx = side === 0 ? GUN.x0 + 60 + Math.random() * (GUN.x1 - GUN.x0 - 120) : side === 1 ? GUN.x0 - 40 : GUN.x1 + 40;
      const fy = side === 0 ? 400 : 120 + Math.random() * 200;
      g.foes.push({ fly: true, x: fx, y: fy, face: -1, hp: 1, tx: GUN.x0 + 80 + Math.random() * (GUN.x1 - GUN.x0 - 160), ty: 110 + Math.random() * 190, aimT: 0, cd: 0.6 + Math.random() * 0.8, hitFx: 0, ph: Math.random() * 6 });
    }
    if (g.spawnT <= 0 && g.foes.length < 8) {
      g.spawnT = Math.max(0.8, 2.2 - g.t * 0.04);
      const n = Math.min(8 - g.foes.length, 1 + Math.floor(Math.random() * 3)); // 한 번에 1~3명씩 몰려온다
      const right = Math.random() < 0.75;
      for (let k = 0; k < n; k++) {
      const look = DUEL_RIVALS[Math.floor(Math.random() * 5)];
      const tough = Math.random() < 0.2;
      g.foes.push({ x: (right ? GUN.x1 + 40 + k * 55 : GUN.x0 - 40 - k * 55), y: 0, face: right ? -1 : 1, hp: tough ? 2 : 1, tough, tx: 260 + Math.random() * 480, aimT: 0, cd: 0.8 + Math.random(), look, hitFx: 0 });
      }
    }
    for (const f of g.foes) {
      f.hitFx = Math.max(0, f.hitFx - dt);
      f.cd = Math.max(0, f.cd - dt);
      f.face = Math.sign(g.x - f.x) || f.face;
      if (f.fly) { // 날아다니며 이리저리 옮겨 다닌다
        f.ph += dt;
        f.x += Math.max(-230, Math.min(230, (f.tx - f.x) * 3)) * dt;
        f.y += Math.max(-230, Math.min(230, (f.ty - f.y) * 3)) * dt + Math.sin(f.ph * 4) * 20 * dt;
        if (Math.abs(f.tx - f.x) < 12 && Math.abs(f.ty - f.y) < 12 || Math.random() < dt * 0.2) { f.tx = GUN.x0 + 80 + Math.random() * (GUN.x1 - GUN.x0 - 160); f.ty = 110 + Math.random() * 190; }
      }
      if (f.aimT > 0) {
        f.aimT -= dt;
        if (f.aimT <= 0) {
          const sx = f.x + f.face * 18, sy = GUN.gy - 44 - f.y;
          const ang = Math.atan2(GUN.gy - 40 - g.y - sy, g.x - sx);
          const sp = 540 + Math.min(200, g.t * 4);
          g.bullets.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 4 });
          f.cd = 0.6 + Math.random() * 0.7;
          f.flash = 0.1;
          G.Audio.play('gun');
        }
      } else {
        const want = f.fly ? 0 : Math.abs(f.x - f.tx) > 8 ? Math.sign(f.tx - f.x) : 0;
        if (!f.fly) f.x += want * 210 * dt; // 엄청 빠르게 뛰어다닌다
        if (f.cd === 0) f.aimT = f.tough ? 0.3 : 0.42; // 멀리서도 걸어오면서 겨눈다
        if (!f.fly && Math.random() < dt * 0.15) f.tx = 260 + Math.random() * 480;
      }
      f.flash = Math.max(0, (f.flash || 0) - dt);
    }
    // ---- 총알 ----
    for (const b of g.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.y > GUN.gy || b.x < GUN.x0 - 60 || b.x > GUN.x1 + 60) { b.dead = true; continue; }
      const py = GUN.gy - 20 - g.y;
      if (Math.abs(b.x - g.x) < 14 && Math.abs(b.y - py) < 26) {
        if (g.slideT > 0.08 || g.inv > 0) continue; // 슬라이딩 중엔 통과
        if (g.block && g.guardE >= 20 && Math.sign(b.x - g.x || 1) === g.face) { // 앞에서 온 총알: 막았다
          b.dead = true; g.guardE -= 20; G.Audio.play('catch'); g.fx.push({ x: g.x + g.face * 24, y: GUN.gy - 70 - g.y, t: 0, text: '막았다!' }); continue;
        }
        b.dead = true; g.hp -= 1; g.inv = 1.2; G.Audio.play('hurt');
        g.fx.push({ x: g.x, y: GUN.gy - 80 - g.y, t: 0, text: '-1' });
      }
    }
    g.bullets = g.bullets.filter((b) => !b.dead);
    for (const s of g.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.y > GUN.gy || s.x < GUN.x0 - 80 || s.x > GUN.x1 + 80) { s.dead = true; continue; }
      for (const f of g.foes) {
        if (Math.abs(s.x - f.x) < (f.fly ? 22 : 16) && s.y > GUN.gy - 62 - f.y && s.y < GUN.gy - f.y + (f.fly ? 14 : 0)) {
          s.dead = true; f.hp -= 1; f.hitFx = 0.2; f.aimT = Math.max(0, f.aimT - 0.2); // 맞으면 조준이 흐트러진다
          if (f.hp <= 0) { f.dead = true; g.kills += 1; G.Audio.play('coin'); g.fx.push({ x: f.x, y: GUN.gy - 80 - f.y, t: 0, text: '+6' }); } else G.Audio.play('parry');
          break;
        }
      }
    }
    g.shots = g.shots.filter((s) => !s.dead);
    g.foes = g.foes.filter((f) => !f.dead);
    // ---- 이동과 중력 ----
    g.x = Math.max(GUN.x0, Math.min(GUN.x1, g.x + g.vx * dt));
    if (g.y > 0 || g.vy > 0) { g.y = Math.max(0, g.y + g.vy * dt); g.vy -= 1900 * dt; if (g.y === 0) g.vy = 0; }
    // ---- 끝 ----
    if (g.hp <= 0 || g.time <= 0) {
      const survived = g.hp > 0;
      m.win = g.kills * 6 + (survived ? 100 : 0);
      m.won = m.win > m.cost;
      coins += m.win;
      m.msg = `${g.kills}명 명중! ${survived ? '끝까지 버텼다! ' : ''}+${m.win} G`;
      G.Audio.play(m.win >= m.cost ? 'treasure' : 'deny');
      miniGo(m, 'result');
    }
  }

  // 링 격투 (오버레이): 경기장 안에서 무작위 AI 용사와 진짜로 싸운다. AI의 등급(1~5)은 무작위, 체력은 4~10.
  // ←→ 이동, Space/↑ 점프, ↓ 막기(막으면 상대가 휘청한다), Enter 공격. 상대 체력을 0으로 만들면 이긴다 (60초가 지나면 남은 체력 비율이 높은 쪽)
  const ARENA = { x0: 170, x1: 790, gy: 430 };
  function fightStart(m) {
    const lv = 2 + Math.floor(Math.random() * 4); // 링 격투는 더 어렵다: 등급 2~5 + 보너스
    const hp = 6 + Math.floor(Math.random() * 7);
    const look = DUEL_RIVALS[Math.min(DUEL_RIVALS.length - 1, lv + 1 + Math.floor(Math.random() * 3))];
    m.lv = lv;
    m.rival = look;
    m.rlv = lv;
    m.ai = { x: ARENA.x1 - 130, y: 0, vy: 0, vx: 0, face: -1, hp, maxHp: hp, state: 'approach', st: 0, cd: 1.0, inv: 0, guard: 0, atkT: 0, stagger: 0, hitFx: 0 };
    m.pl = { x: ARENA.x0 + 130, y: 0, vy: 0, vx: 0, face: 1, hp: 10, maxHp: 10, inv: 0, atkT: 0, cd: 0, guard: false, hitFx: 0 };
    m.time = 60;
    m.fx = [];
    m.swingT = 0;
    miniGo(m, 'ready');
  }
  function fightHit(m, who, dmg, dir) { // who = 맞는 쪽 ('pl' | 'ai')
    const t = m[who];
    t.hp = Math.max(0, t.hp - dmg);
    t.inv = 0.55;
    t.vx = dir * 340;
    t.hitFx = 0.3;
    m.fx.push({ x: t.x, y: ARENA.gy - 70 - t.y, t: 0, text: `-${dmg}` });
    G.Audio.play(who === 'ai' ? 'parry' : 'hurt');
  }
  function fightUpdate(m, dt, pressed) {
    for (const f of m.fx) f.t += dt;
    m.fx = m.fx.filter((f) => f.t < 0.8);
    if (m.st === 'ready') {
      if (m.t >= 1.5) { miniGo(m, 'fight'); G.Audio.play('spawn'); }
      return;
    }
    if (m.st === 'result') { m.swingT += dt; return; }
    const dn = (...c) => c.some((k) => input.down.has(k));
    const P = m.pl;
    const A = m.ai;
    m.time -= dt;
    // ---- 내 조작 ----
    P.inv = Math.max(0, P.inv - dt); P.hitFx = Math.max(0, P.hitFx - dt); P.atkT = Math.max(0, P.atkT - dt); P.cd = Math.max(0, P.cd - dt);
    P.guard = dn('ArrowDown', 'KeyS') && P.y === 0 && P.atkT === 0;
    const dirX = (dn('ArrowRight', 'KeyD') ? 1 : 0) - (dn('ArrowLeft', 'KeyA') ? 1 : 0);
    if (!P.guard && P.hitFx < 0.15) { P.vx += (dirX * 240 - P.vx) * Math.min(1, 12 * dt); if (dirX) P.face = dirX; } else P.vx *= Math.max(0, 1 - 6 * dt);
    if (pressed('Space', 'ArrowUp', 'KeyW') && P.y === 0 && !P.guard) P.vy = 640;
    if (pressed('Enter', 'NumpadEnter') && P.cd === 0 && !P.guard) {
      P.atkT = 0.32;
      P.cd = Math.max(0.3, 0.5 + equipStats.cooldownAdd * 0.6);
      P.struck = false;
      G.Audio.play('swing');
    }
    if (P.atkT > 0 && !P.struck && P.atkT < 0.2) { // 휘두른 지 조금 뒤에 맞는다
      P.struck = true;
      const reach = 78 + equipStats.reachTiles * 70;
      if (Math.abs(A.x - P.x) <= reach && Math.abs(A.y - P.y) < 70 && Math.sign(A.x - P.x || P.face) === P.face) {
        if (A.inv > 0) { /* 무적 중 */ } else if (A.guard > 0) { A.guard = 0; P.vx = -P.face * 200; m.fx.push({ x: A.x, y: ARENA.gy - 90 - A.y, t: 0, text: '막았다!' }); G.Audio.play('catch'); }
        else fightHit(m, 'ai', Math.max(1, Math.min(4, Math.round(Math.sqrt(equipStats.baseDmg + equipStats.bossBonus)))), P.face);
      }
    }
    // ---- AI ----
    A.inv = Math.max(0, A.inv - dt); A.hitFx = Math.max(0, A.hitFx - dt); A.atkT = Math.max(0, A.atkT - dt); A.cd = Math.max(0, A.cd - dt); A.stagger = Math.max(0, A.stagger - dt); A.guard = Math.max(0, A.guard - dt);
    const dx = P.x - A.x;
    const dist = Math.abs(dx);
    const lv = m.lv;
    if (A.stagger === 0 && A.hitFx < 0.15) {
      A.face = Math.sign(dx) || A.face;
      if (A.state === 'approach') {
        const want = dist > 92 ? A.face : dist < 58 ? -A.face : 0;
        A.vx += (want * (170 + 32 * lv) - A.vx) * Math.min(1, 10 * dt);
        if (A.cd === 0 && dist < 110 && Math.abs(P.y - A.y) < 60) { A.state = 'wind'; A.st = 0; A.vx = 0; }
        if (P.atkT > 0.1 && dist < 150 && Math.random() < dt * (2.4 * lv)) { A.guard = 0.55; A.state = 'approach'; A.cd = Math.min(A.cd, 0.1); } // 내가 휘두르면 자주 막고 바로 반격
        else if (P.atkT > 0.1 && dist < 130 && A.y === 0 && Math.random() < dt * 1.2 * lv) { A.vx = -A.face * 520; A.inv = 0.25; } // 뒤로 빠지며 피한다
        if (A.y === 0 && dist < 150 && Math.random() < dt * 0.4 * lv) A.vy = 560; // 가끔 뛴다
      } else if (A.state === 'wind') { // 칼을 치켜든다 (이때가 막을 기회)
        A.st += dt;
        if (A.st >= Math.max(0.12, 0.42 - 0.06 * lv)) { A.state = 'strike'; A.st = 0; A.atkT = 0.3; }
      } else if (A.state === 'strike') {
        A.st += dt;
        if (!A.hitDone && A.st >= 0.08) {
          A.hitDone = true;
          if (dist <= 132 && Math.abs(P.y - A.y) < 70 && Math.sign(dx) === A.face && P.inv === 0) {
            if (P.guard) { A.stagger = 0.7; A.vx = -A.face * 220; m.fx.push({ x: P.x, y: ARENA.gy - 90, t: 0, text: '막았다!' }); G.Audio.play('catch'); } // 막으면 상대가 휘청한다
            else fightHit(m, 'pl', lv >= 4 ? 2 : 1, A.face);
          }
        }
        if (A.st >= 0.3) { A.state = 'approach'; A.hitDone = false; A.cd = Math.max(0.12, 0.9 - 0.15 * lv) + Math.random() * 0.25; if (Math.random() < 0.3 + 0.08 * lv) A.cd = 0.08; }
      }
    } else A.vx *= Math.max(0, 1 - 6 * dt);
    // ---- 이동과 경기장 벽 ----
    for (const f of [P, A]) {
      f.x = Math.max(ARENA.x0, Math.min(ARENA.x1, f.x + f.vx * dt));
      if (f.y > 0 || f.vy > 0) { f.y = Math.max(0, f.y + f.vy * dt); f.vy -= 1900 * dt; if (f.y === 0) f.vy = 0; }
    }
    // ---- 결판 ----
    if (A.hp <= 0 || P.hp <= 0 || m.time <= 0) {
      const win = A.hp <= 0 ? true : P.hp <= 0 ? false : (P.hp / P.maxHp) > (A.hp / A.maxHp);
      m.won = win;
      if (win) { m.win = Math.round(m.cost * (1.6 + 0.2 * lv)); coins += m.win; G.Audio.play('treasure'); }
      else G.Audio.play('hurt');
      m.msg = A.hp <= 0 ? `이겼다! +${m.win} G` : P.hp <= 0 ? '쓰러졌다…' : win ? `시간 종료, 체력이 더 많아 승리! +${m.win} G` : '시간 종료, 체력이 더 적어 패배…';
      m.swingT = 0;
      miniGo(m, 'result');
    }
  }

  // ---------- 결투장: 보스전처럼 AI 용사와 싸운다 (카우보이 = 총싸움 / 공격! = 칼싸움) ----------
  // 평소 게임 조작 그대로: 이동, 점프, 패링(Enter), 대시, 검 던지기, 총·활·폭탄 쏘기. 상대의 체력은 4~10, 등급은 1~5 무작위.
  let duelRun = null; // {mode, cost, cfg, livesBackup, end, endT}
  // 던지는 무기 = 던지거나 쏘는 무기(폭탄·총·산탄총·활·석궁). 총싸움은 반드시 끼고, 공격!(칼싸움)은 끼면 안 된다
  const isThrownWeapon = (id) => { const w = G.Shop.ITEMS[id]; return !!(w && w.shot); };
  function duelWeaponProblem(mode, weaponId) { // mode: 'gun'(총싸움) | 'fight'(공격!)
    const thrown = isThrownWeapon(weaponId);
    if (mode === 'gun' && !thrown) return '총싸움은 던지는 무기(폭탄·총·활 …)를 장착해야 해요. 인벤토리(I)에서 바꿔 끼세요.';
    if (mode === 'fight' && thrown) return '공격!은 던지는 무기를 장착하고 있으면 안 돼요. 칼·창 같은 근접 무기로 바꾸세요.';
    return null;
  }
  // 결투 중에 규칙을 어기는 무기로 바꾸려는지 (고르는 무기 id)
  // (결투장 안에서만: 개발 메뉴 등으로 결투장을 벗어나 duelRun이 남아 있어도 평소 무기 교체는 막지 않는다)
  const duelBlocks = (weaponId) => (duelRun && stageName === 'duelarena' ? duelWeaponProblem(duelRun.mode === 'cowboy' ? 'gun' : 'fight', weaponId) : null);
  function startDuelArena(m) {
    const lv = 1 + Math.floor(Math.random() * 5);
    const hp = 4 + Math.floor(Math.random() * 7);
    const look = DUEL_RIVALS[Math.min(DUEL_RIVALS.length - 1, lv + Math.floor(Math.random() * 3))];
    const dm = m.mode === 'gun' ? 'cowboy' : 'fight'; // 결투장 AI: gun = 총싸움, fight = 칼싸움
    duelRun = { mode: dm, cost: m.cost, livesBackup: lives, end: null, endT: 0, cfg: { mode: dm, lv, hp, name: look.name, armor: look.armor, helmet: look.helmet, weapon: look.weapon } };
    mini = null;
    cutscene = null;
    loadStage('duelarena', true);
    lives = maxLives(); // 결투 동안은 체력이 가득 차 있다 (결투가 끝나면 원래대로)
  }
  function duelWin() {
    const r = duelRun;
    if (!r || r.end) return;
    r.end = 'win';
    const lv = r.cfg.lv;
    const pay = Math.round(r.cost * (1.6 + 0.2 * lv));
    coins += pay;
    popups.push({ x: player.x + player.w / 2, y: player.y - 56, text: `결투 승리! +${pay} G`, t: 3, color: 'rgba(125,255,160,A)' });
    G.Audio.play('treasure');
    effects.treasure(player.x + player.w / 2, player.y);
  }
  function duelLose() {
    const r = duelRun;
    if (!r || r.end) return;
    r.end = 'lose';
    lives = 1;
    player.invuln = 99;
    if (boss) boss.stop = true;
    popups.push({ x: player.x + player.w / 2, y: player.y - 56, text: `결투 패배… -${r.cost} G`, t: 3, color: 'rgba(255,140,140,A)' });
    G.Audio.play('gameover');
  }
  function updateDuelRun(dt) {
    const r = duelRun;
    if (!r || !r.end) return;
    r.endT += dt;
    if (r.endT >= 2.6) { // 마을의 결투장 앞으로 돌아간다
      lives = r.livesBackup;
      duelRun = null;
      goVillageShop('mgduel');
    }
  }

  // 크리스탈 만들기: 어둠의 크리스탈 -> (숲의 샘물) 정화된 크리스탈 -> (화산의 제단) 신성 크리스탈
  function say(text, color) { popups.push({ x: player.x + player.w / 2, y: player.y - 44, text, t: 2.6, color: color || 'rgba(255,240,170,A)' }); }
  function washCrystals() {
    const n = inv.materials.darkcrystal || 0;
    if (!n) { say('씻을 어둠의 크리스탈이 없어요 (탑의 보스가 떨어뜨려요)', 'rgba(255,170,170,A)'); G.Audio.play('deny'); return; }
    inv.materials.darkcrystal = 0;
    inv.materials.cleancrystal = (inv.materials.cleancrystal || 0) + n;
    say(`어둠의 크리스탈 ${n}개를 씻었다! 정화된 크리스탈 ${n}개 (다음: 화산의 제단)`, 'rgba(170,235,255,A)');
    G.Audio.play('pickup');
    effects.sparkle(player.x + player.w / 2, player.y);
  }
  function blessCrystals() {
    const n = inv.materials.cleancrystal || 0;
    if (!n) { say('정화된 크리스탈이 없어요 (어둠의 크리스탈을 숲의 샘물로 씻어 오세요)', 'rgba(255,170,170,A)'); G.Audio.play('deny'); return; }
    inv.materials.cleancrystal = 0;
    inv.materials.holycrystal = (inv.materials.holycrystal || 0) + n;
    say(`신성 크리스탈 ${n}개를 얻었다! (용광로에서 칼에 붙일 수 있어요)`, 'rgba(255,225,120,A)');
    G.Audio.play('treasure');
    effects.treasure(player.x + player.w / 2, player.y);
  }
  // 약점 속성 무기는 보스에게 더 아프다 (불의 용은 얼음, 눈의 털복숭이는 불)
  // 보스에게 입히기: 치명타가 터지면 치명타 대미지, 아니면 평소 대미지
  // 약점 돋보기: 보스를 3번 때린 뒤 5초 동안 분석하면 약점이 드러나고, 이후 "약점 노출" 시간이 자주 찾아온다 (노출 중 대미지 x2)
  const ANALYZE_HITS = 3, ANALYZE_TIME = 5, EXPOSE_TIME = 3, EXPOSE_EVERY = 5;
  let analysis = { state: 'idle', hits: 0, t: 0, cd: 0, expose: 0, expCd: 2 }; // idle -> run -> done
  const resetAnalysis = () => { analysis = { state: 'idle', hits: 0, t: 0, cd: 0, expose: 0, expCd: 2 }; };
  function updateAnalysis(dt) {
    const a = analysis;
    a.cd = Math.max(0, a.cd - dt);
    if (!boss || boss.done || !boss.weak || inv.equipped.weapon !== 'magnifier') return;
    if (a.state === 'run') {
      a.t += dt;
      if (a.t >= ANALYZE_TIME) {
        a.state = 'done';
        popups.push({ x: player.x + player.w / 2, y: player.y - 50, text: `분석 완료! 약점: ${WEAK_NAMES[boss.weak]}`, t: 2.4, color: 'rgba(120,255,160,A)' });
        G.Audio.play('treasure');
      }
    } else if (a.state === 'done') {
      a.expose = Math.max(0, a.expose - dt);
      a.expCd -= dt;
      if (a.expCd <= 0) {
        a.expose = EXPOSE_TIME;
        a.expCd = EXPOSE_EVERY;
        popups.push({ x: player.x + player.w / 2, y: player.y - 50, text: '약점 노출! 지금 공격!', t: 1.4, color: 'rgba(255,225,120,A)' });
        G.Audio.play('spawn');
      }
    }
  }
  const analysisText = () => {
    if (!boss || !boss.weak) return null;
    if (inv.equipped.weapon !== 'magnifier') return '약점: ? (약점 돋보기를 무기로 장착하면 분석할 수 있어요)';
    const a = analysis;
    if (a.state === 'idle') return `돋보기: 보스를 ${ANALYZE_HITS}번 때리면 분석 시작 (${a.hits}/${ANALYZE_HITS})`;
    if (a.state === 'run') return `분석 중… ${Math.floor((a.t / ANALYZE_TIME) * 100)}%  (맞으면 처음부터)`;
    return `약점: ${WEAK_NAMES[boss.weak]}${a.expose > 0 ? `   ★ 약점 노출! 대미지 x2 (${a.expose.toFixed(1)}s)` : ''}`;
  };
  function hitBoss(rect) {
    const crit = rollCrit();
    const holy = boss.kind === 'dark' ? G.Shop.holyMult(inv) : 1; // 신성 크리스탈을 붙인 칼은 탑의 보스에게 더 강하다
    const weakMul = boss.weak && weaponElemOf() === boss.weak ? 3 : 1; // 보스의 약점 속성 무기: 대미지 x3
    const expMul = analysis.state === 'done' && analysis.expose > 0 ? 2 : 1; // 분석한 보스의 약점 노출 시간
    const hits = boss.hitHeads(rect, (crit ? G.Shop.critDamage(inv) : bossDamage()) * holy * weakMul * expMul);
    if (hits.length && boss.weak && analysis.state === 'idle' && analysis.cd === 0 && inv.equipped.weapon === 'magnifier') { // 돋보기: 때릴 때마다 분석 준비
      analysis.cd = 0.3;
      analysis.hits += 1;
      if (analysis.hits >= ANALYZE_HITS) { analysis.state = 'run'; analysis.t = 0; popups.push({ x: player.x + player.w / 2, y: player.y - 50, text: `분석 시작! ${ANALYZE_TIME}초 동안 맞지 말고 버텨요`, t: 2, color: 'rgba(160,220,255,A)' }); G.Audio.play('pickup'); }
    }
    if (expMul > 1 && hits.length) popups.push({ x: hits[0].cx, y: hits[0].y - 80, text: '약점 노출! x2', t: 0.9, color: 'rgba(255,225,120,A)' });
    if (weakMul > 1 && hits.length) popups.push({ x: hits[0].cx, y: hits[0].y - 56, text: `약점! x3 (${WEAK_NAMES[boss.weak]})`, t: 1.1, color: 'rgba(120,255,160,A)' });
    if (holy > 1 && hits.length && !crit) popups.push({ x: hits[0].cx, y: hits[0].y - 34, text: `신성 x${holy}`, t: 1, color: 'rgba(255,230,140,A)' });
    if (crit && hits.length) {
      popups.push({ x: hits[0].cx, y: hits[0].y - 34, text: `치명타! ${G.Shop.critDamage(inv)}`, t: 1.4, color: 'rgba(255,225,80,A)' });
      critFx(hits[0].cx, hits[0].cy);
    }
    return hits;
  }
  const bossDamage = () => equipStats.baseDmg + equipStats.bossBonus; // 약점은 hitBoss에서 x3
  const WEAK_NAMES = { fire: '불꽃', ice: '얼음', light: '빛', quake: '대지', crystal: '수정', shadow: '그림자', poison: '독' };
  // 무기의 속성: 근접 무기는 elem, 지팡이는 element (번개 = 빛)
  const weaponElemOf = () => { // 보스 약점 판정용 속성: 붙인 원소 광석의 속성도 센다 (약점과 맞으면 그것을 돌려준다)
    const w = G.Shop.ITEMS[inv.equipped.weapon];
    const e = w.elem || w.element || null;
    const base = e === 'lightning' ? 'light' : e === 'random' ? null : e;
    const all = [base].concat((equipStats && equipStats.elems) || []).filter(Boolean);
    if (boss && boss.weak && all.includes(boss.weak)) return boss.weak;
    return all[0] || null;
  };

  // 던전: 층마다 0~3개의 아이템이 바닥에 떨어져 있다 (스태미나, 얼음 폭탄, 음식)
  const PICKUP_TABLE = ['st70', 'st30', 'st30', 'icebomb', 'st30'];
  function scatterPickups() {
    const n = Math.random() < 0.35 ? 0 : 1 + Math.floor(Math.random() * 3);
    const pool = terrain.standingSpots().filter((s) => s.col > 12 && s.col < terrain.cols - 12);
    for (let i = 0; i < n && pool.length; i++) {
      const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      pickups.push({ x: s.col * C.TILE + C.TILE / 2, y: (s.row + 1) * C.TILE - 18, id: PICKUP_TABLE[Math.floor(Math.random() * PICKUP_TABLE.length)], t: Math.random() * 6 });
    }
  }

  // 던전에서 이벤트가 불러내는 몬스터: 다크월드 몬스터와 똑같이 층에 맞춰 단단해지고, 죽어도 부활하지 않는다(temp)
  // 땅 몬스터의 y는 발 위치, 그림자(shade)의 y는 몸 가운데
  function spawnDungeonMonster(kind, x, y) {
    const st = STAGES[stageName];
    let mo;
    if (kind === 'darkstone') mo = new G.DarkStone(x - G.DarkStone.W / 2, y - G.DarkStone.H);
    else if (kind === 'shade') mo = new G.Shade(x - G.Shade.W / 2, y - G.Shade.H / 2);
    else { mo = new G.Slime(x - C.SLIME_W / 2, y - C.SLIME_H); mo.variant = 'dark'; }
    mo.stageSpeed = (st.monsterSpeed || 1) * (1 + Math.min(0.6, darkFloor * 0.006));
    mo.contactDmg = st.monsterDamage || 3;
    mo.immune = { ice: !!st.iceZone, fire: !!st.fireZone };
    mo.dark = true;
    mo.maxHp = Math.round(mo.maxHp * (1 + darkFloor * 0.06));
    mo.hp = mo.maxHp;
    mo.extraHits = Math.floor(darkFloor / 12);
    mo.temp = true;
    monsters.push(mo);
    effects.spawn(x, y);
    return mo;
  }

  // 던전 이벤트(src/events.js)가 게임 상태를 건드리는 통로. 이벤트는 규칙을 직접 바꾸지 않고 여기로만 요청한다
  const dungeonEvents = G.DungeonEvents.create({
    player,
    monsters,
    fx: effects,
    sound: (n) => G.Audio.play(n),
    say: (text, color) => say(text, color),
    popup: (x, y, text, color, t = 1.2) => popups.push({ x, y, text, t, color }),
    heal(n) { const before = lives; lives = Math.min(maxLives(), lives + n); return lives - before; },
    hurt(n, x, y) { if (player.invuln > 0) return false; loseLife(x, y, n); return true; },
    coins(n) { coins += n; },
    exp(n) { exp += n; },
    spendCoins(n) { if (coins < n) return false; coins -= n; return true; },
    giveItem(id, n = 1) { inv.consumables[id] = (inv.consumables[id] || 0) + n; },
    itemName: (id) => G.Shop.ITEMS[id].name,
    dialog: (lines) => startDialogs(lines),
    staminaAdd(n) { stamina = Math.min(stMax(), stamina + n); },
    staminaFull() { stamina = stMax(); },
    invuln(sec) { player.invuln = Math.max(player.invuln, sec); },
    spawnMonster: spawnDungeonMonster,
    // 폭발: 반경 안의 몬스터에게 피해를 주고, 살아남으면 날려 보낸다 (날아가다 터진다)
    blast(x, y, r, dmg) {
      for (const mo of monsters) {
        if (!mo.alive || mo.flying) continue;
        if (Math.hypot(mo.x + mo.w / 2 - x, mo.y + mo.h / 2 - y) > r) continue;
        mo.damage(dmg);
        if (mo.alive && !mo.flying) mo.knockback(Math.sign(mo.x + mo.w / 2 - x) || 1);
      }
    },
    // 지금 상대에게 피해를 주는 공격 범위들: 베는 순간의 패링 박스, 날아가는 검
    attackBoxes() {
      const out = [];
      if (player.parrying && player.swing >= player.slashFrame) out.push(parryBox(player));
      if (sword) out.push(sword.box);
      return out;
    },
    nudge(dx) { const ox = player.x; player.x += dx; if (terrain.solidTilesIn(player.x, player.y, player.w, player.h).length) player.x = ox; }, // 돌풍
    teleport(x, y) { player.placeAt(x, y); camera.follow(player, terrain, C.DT, true); },
    trapDamage: (floor) => 1 + Math.floor(floor / 30),
    cameraTop: () => camera.y,
  });

  // 광물 동굴의 광석 덩어리 (src/orecave.js): 규칙은 여기 host로만 요청한다
  const oreNodes = new G.OreNodes({
    player,
    fx: effects,
    sound: (n) => G.Audio.play(n),
    say: (text, color) => say(text, color),
    popup: (x, y, text, color, t = 1.2) => popups.push({ x, y, text, t, color }),
    giveMaterial(id, n) { inv.materials[id] = (inv.materials[id] || 0) + n; },
    giveOre(id, n) { inv.ores[id] = (inv.ores[id] || 0) + n; G.Forge.markDirty(); },
    pickTier: () => G.Forge.bestPick(inv),
    hasLens: () => inv.equipped.weapon === 'magnifier', // 약점 돋보기를 끼면 광석 단계가 보인다
    pickLook: () => { const id = inv.equipped.pick; return id && G.Shop.ITEMS[id] ? G.Shop.ITEMS[id].look : null; },
    hitStop: (sec) => { hitStop = Math.max(hitStop, sec); },
  });

  function loadStage(name, keepLives = false, near = null) {
    stageName = name;
    skipBanner = name === 'village' && !!seenStages.village;
    seenStages[name] = true;
    if (name === 'mine' && !mineLevel) { // ?stage=mine 처럼 입구를 거치지 않고 바로 온 경우
      mineRun = 1;
      mineLevel = G.MineGen.generate(1);
    }
    const st = STAGES[name];
    G.Audio.setMusic(st.music || 'cave'); // 마을은 활기찬 노래, 나머지는 동굴 곡
    if (name === 'dungeon') dungeon = seeded(floorSeed(darkFloor), () => G.Dark.makeFloor(darkFloor)); // 층마다 한 번 정해지면 클리어할 때까지 같은 방
    if (name === 'orecave') { oreRun += 1; oreLevel = makeOreCave(oreRun); } // 들어갈 때마다 새 광물 동굴
    terrain = new G.Terrain(st.level);
    renderer.theme = st.theme;
    terrain.story = story;
    terrain.home = inv.home; // 마을 터와 집 안이 산 집/놓은 장식을 그린다
    if (name === 'home') {
      G.HomeTheme.setHouse(inv.home.type);
      terrain.homeSlots = G.Home.slots(inv.home.type || 'house1', terrain);
    }
    spawn = terrain.spawnFor(C.PLAYER_W, C.PLAYER_H);
    // near: 마을로 돌아올 때 어느 입구 앞에서 시작할지 ('D' 동굴 입구, 또는 스테이지 이름 = 그 스테이지의 문)
    const arrive = near === 'D' ? terrain.caveEntrances[0] : near === 'Y' ? terrain.homeLots[0] : near ? terrain.gates.find((g) => g.stage === near) : null;
    if (arrive) spawn = terrain.placeOnTile(arrive.col - 2, arrive.row, C.PLAYER_W, C.PLAYER_H);

    chest = terrain.treasure && !chestTaken[name] && !st.boss ? makeChest() : null; // 보스가 있는 스테이지는 보스를 쓰러뜨려야 상자가 나온다
    const house = terrain.houses[0];
    goalBox = house && st.goalHouse ? { x: house.col * C.TILE - C.TILE / 2, y: (house.row - 1) * C.TILE, w: C.TILE * 2, h: C.TILE * 2 } : null;

    monsters.length = 0;
    for (const s of terrain.slimeSpawns) {
      const p = terrain.placeOnTile(s.col, s.row, C.SLIME_W, C.SLIME_H);
      const sl = new G.Slime(p.x, p.y);
      sl.variant = st.dark ? 'dark' : st.slimeVariant || 'green';
      monsters.push(sl);
    }
    for (const b of terrain.batSpawns) {
      const p = terrain.centerOnTile(b.col, b.row, C.BAT_W, C.BAT_H);
      monsters.push(new G.Bat(p.x, p.y));
    }
    for (const cr of terrain.crabSpawns) {
      const p = terrain.placeOnTile(cr.col, cr.row, C.CRAB_W, C.CRAB_H);
      monsters.push(new G.Crab(p.x, p.y));
    }
    for (const gl of terrain.golemSpawns) {
      const p = terrain.placeOnTile(gl.col, gl.row, C.GOLEM_W, C.GOLEM_H);
      monsters.push(new G.Golem(p.x, p.y));
    }
    for (const dk of terrain.darkStoneSpawns) {
      const p = terrain.placeOnTile(dk.col, dk.row, G.DarkStone.W, G.DarkStone.H);
      monsters.push(new G.DarkStone(p.x, p.y));
    }
    for (const sh of terrain.shadeSpawns) {
      const p = terrain.centerOnTile(sh.col, sh.row, G.Shade.W, G.Shade.H);
      monsters.push(new G.Shade(p.x, p.y));
    }
    pickups.length = 0;
    enemyShots.length = 0;
    for (const mo of monsters) {
      mo.stageSpeed = (st.monsterSpeed || 1) * (st.dark ? 1 + Math.min(0.6, darkFloor * 0.006) : 1); // 다크월드는 올라갈수록 빨라진다
      mo.contactDmg = st.monsterDamage || (st.dark ? 3 : 1); // 설산 몬스터는 목숨 2개, 다크월드(암흑)는 3개
      mo.immune = { ice: !!st.iceZone, fire: !!st.fireZone }; // 설산 몬스터는 얼지 않고, 화산 몬스터는 불에 타지 않는다
      if (st.dark) { // 다크월드 몬스터: 층이 오를수록 단단하다 (체력, 더 때려야 하는 횟수)
        mo.dark = true;
        mo.maxHp = Math.round(mo.maxHp * (1 + darkFloor * 0.06));
        mo.hp = mo.maxHp;
        mo.extraHits = Math.floor(darkFloor / 12);
      }
    }
    if (st.dark) scatterPickups(); // 던전에서는 가끔 아이템이 떨어져 있다
    oreNodes.setup(terrain, oreRun, name === 'orecave'); // 광물 동굴이면 광석 덩어리를 깐다
    seeded(floorSeed(darkFloor) ^ 0x9e3779b9, () => dungeonEvents.setup(terrain, darkFloor, name === 'dungeon' && !!(dungeon && dungeon.tower) && darkFloor % 3 === 0)); // 탑의 3층마다(3, 6, 9 …) 이벤트가 나온다. 보스방/허브/그 밖의 층은 비움
    baseMonsterCount = monsters.length;
    spots = terrain.standingSpots();

    if (!keepLives || lives <= 0) lives = maxLives();
    gameOver = false;
    won = false;
    ending = null;
    shop = null;
    equipUI = null;
    dialog = null;
    popups.length = 0;
    G.Magic.clear(magic);
    sword = null;
    hitStop = 0;
    stageTime = 0;
    if (name === 'village' && story.pending) dialog = null; // 이야기는 잠시 뒤에 시작한다 (step)
    player.respawn(spawn.x, spawn.y);
    player.slippery = !!st.slippery && !(equipStats.perks || []).includes('ice'); // 설산은 바닥이 미끄럽다 (얼음 갑옷은 안 미끄러진다)
    applySpeed(); // 마을에서만 달리기 업그레이드가 적용된다
    setupBoss();
    camera.follow(player, terrain, C.DT, true);
  }

  // 낀 장비를 플레이어에게 반영: 무기(던지기 거리/쿨다운, 패링 범위는 parryBox가), 갑옷(최대 피),
  // 장갑(패링 지속 시간), 신발(이동 속도), 그리고 그림용 장비 id
  // 이동 속도: 신발 + 마을 달리기 업그레이드 (마을에서만)
  function applySpeed() {
    player.speedMult = (1 + equipStats.speedAdd) * (stageName === 'village' ? G.Shop.speedMult(inv.speedLevel) : 1);
  }

  function applyEquipment() {
    equipStats = G.Shop.stats(inv);
    player.weaponId = inv.equipped.weapon;
    player.armorId = inv.equipped.armor;
    player.helmetId = inv.equipped.helmet;
    player.glovesId = inv.equipped.gloves;
    { const wd = G.Shop.ITEMS[inv.equipped.weapon]; player.swingFrames = wd.swingFrames || C.SWING_FRAMES; player.slashFrame = wd.slashFrame || C.SWING_SLASH_FRAME; } // 망치는 천천히 내려찍는다
    player.pantsId = inv.equipped.pants;
    player.bootsId = inv.equipped.boots;
    player.throwBonus = equipStats.throwTiles;
    player.canThrow = equipStats.canThrow;
    player.parryWindow = C.PARRY_WINDOW + equipStats.windowAdd;
    player.parryCooldownTime = Math.max(0.25, C.PARRY_COOLDOWN + equipStats.cooldownAdd);
    applySpeed();
    player.slippery = !!(STAGES[stageName] && STAGES[stageName].slippery) && !(equipStats.perks || []).includes('ice');
    lives = Math.min(lives, maxLives()); // 갑옷을 벗어 최대 피가 줄면 넘치는 피는 사라진다
  }

  const startParam = new URLSearchParams(window.location.search).get('stage');
  loadStage(STAGES[startParam] ? startParam : 'cave');
  applyEquipment();

  // 오프닝 컷신 (동굴에서 처음 한 번만. 끝나거나 건너뛰면 null)
  let cutscene = C.INTRO_CUTSCENE && stageName === 'cave' ? new G.Cutscene(terrain, player) : null;

  // 화면 크기: 캔버스 내부 해상도를 "화면에 실제로 보이는 장치 픽셀 수"에 정확히 맞춘다.
  // (브라우저가 캔버스를 늘이거나 줄이면서 흐려지는 것을 막는다. 글자와 도트가 또렷해진다)
  // 가능하면 월드 도트 한 칸을 정수 장치 픽셀로 만들어 도트 크기가 고르게 하고, 그러면 창이 너무 비면(90% 미만) 창에 꽉 채운다. F 키로 전체화면
  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(window.innerWidth, (window.innerHeight * C.VIEW_W) / C.VIEW_H);
    const devW = cssW * dpr;
    const bufW = C.VIEW_W / renderer.px; // 월드 버퍼의 가로 도트 수
    const k = Math.floor(devW / bufW);
    const scale = k >= 1 && k * bufW >= devW * 0.9 ? (k * bufW) / C.VIEW_W : devW / C.VIEW_W;
    renderer.setScale(scale);
    canvas.style.width = renderer.canvas.width / dpr + 'px'; // 캔버스 픽셀이 화면 장치 픽셀과 1:1로 대응한다
    canvas.style.height = renderer.canvas.height / dpr + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // 테스트 기능(순간이동, 아이템 지급 등)은 F1 개발 메뉴로 옮겼다. 여기에는 스프라이트(K)와 전체화면(F)만 남는다
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyK') { // 내 스프라이트(editor.html에서 그린 모션) 켜기/끄기
      const S = G.Sprites;
      let text;
      if (!S.hasFrames()) text = 'editor.html 에서 먼저 그려 주세요';
      else {
        S.setEnabled(!S.data.enabled);
        text = S.data.enabled ? '내 스프라이트 켜짐' : '내 스프라이트 꺼짐';
      }
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text, t: 1.6, color: 'rgba(255,248,170,A)' });
    } else if (e.code === 'KeyM') { // 전체화면 켜기/끄기
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  function respawn() {
    player.respawn(spawn.x, spawn.y);
    sword = null;
    monsters.forEach((m) => m.reset());
    if (boss && !boss.done) setupBoss(); // 보스전 중이면 보스도 처음부터 (경기장 밖으로 돌아온다)
    camera.follow(player, terrain, C.DT, true);
  }

  // 목숨 하나를 잃는다. 그 자리에 그대로 있고 잠시 무적. 목숨이 없으면 게임오버
  function loseLife(cx, cy, dmg = 1) {
    if (analysis.state === 'run' && !(player.blocking && stamina >= C.BLOCK_STAMINA)) { analysis.t = 0; popups.push({ x: player.x + player.w / 2, y: player.y - 50, text: '분석이 끊겼다!', t: 1.2, color: 'rgba(255,170,170,A)' }); } // 맞으면 분석이 처음부터
    if (player.blocking && stamina >= C.BLOCK_STAMINA && (cx === undefined || cx === null || Math.sign(cx - (player.x + player.w / 2)) === player.facing || Math.abs(cx - (player.x + player.w / 2)) < 10)) { // F로 앞에서 오는 공격을 막았다
      stamina -= C.BLOCK_STAMINA;
      staminaWait = 1.0;
      player.invuln = Math.max(player.invuln, 0.35);
      player.vx = -player.facing * 120;
      effects.shake(4, 0.15);
      G.Audio.play('catch');
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '막았다!', t: 0.8, color: 'rgba(160,220,255,A)' });
      return;
    }
    if (player.cancelCharge()) effects.chargeBreak(cx, cy); // 맞으면 충전 게이지가 풀린다
    effects.playerHit(cx, cy);
    effects.shake(9, 0.3);
    lives -= dmg;
    G.Audio.play('hurt');
    if (lives <= 0 && duelRun) { duelLose(); return; }
    if (lives <= 0) {
      G.Audio.play('gameover');
      gameOver = true;
      gameOverTime = 0;
    } else {
      player.invuln = C.PLAYER_INVULN + equipStats.invulnAdd; // 투구를 끼면 피격 후 무적이 길다
    }
  }

  // 다시 시작 (게임오버): 지금 스테이지를 목숨을 채워 처음부터
  function restart() {
    loadStage(stageName);
  }

  // 상점/대화: 플레이어 가까이에 있는 상호작용 대상 (없으면 null)
  const GROUND_Y_HOME = 16 * C.TILE; // 집 안 바닥 윗면 y
  function nearbyInteract() {
    const T = C.TILE;
    const px = player.x + player.w / 2;
    const feet = player.y + player.h;
    for (const s of terrain.shops) {
      if (Math.abs(px - (s.col * T + T / 2)) < T * 2.2 && Math.abs(feet - (s.row + 1) * T) < T * 2) return { type: 'shop', shop: s };
    }
    for (let i = 0; i < terrain.villagers.length; i++) {
      const v = terrain.villagers[i];
      if (Math.abs(px - (v.col * T + T / 2)) < T * 1.6 && Math.abs(feet - (v.row + 1) * T) < T * 2) return { type: 'talk', index: i };
    }
    for (const w of terrain.waters) {
      if (Math.abs(px - (w.col * T + T / 2)) < T * 2.2 && Math.abs(feet - (w.row + 1) * T) < T * 2) return { type: 'water' };
    }
    for (const a of terrain.altars) {
      if (Math.abs(px - (a.col * T + T / 2)) < T * 2.2 && Math.abs(feet - (a.row + 1) * T) < T * 2) return { type: 'altar' };
    }
    for (const d of terrain.caveEntrances) {
      if (Math.abs(px - (d.col * T + T / 2)) < T * 2.2 && Math.abs(feet - (d.row + 1) * T) < T * 2) return { type: 'enter' };
    }
    for (const l of terrain.homeLots) {
      if (Math.abs(px - (l.col * T + T / 2)) < T * 3 && Math.abs(feet - (l.row + 1) * T) < T * 2) return { type: 'home' };
    }
    let best = null; // 집 안: 가장 가까운 꾸밀 자리
    for (const sl of terrain.homeSlots) {
      const dx = Math.abs(px - sl.x);
      if (dx < 62 && Math.abs(feet - GROUND_Y_HOME) < T * 2 && (!best || dx < best.dx)) best = { dx, slot: sl };
    }
    if (best) return { type: 'slot', slot: best.slot };
    for (const g of terrain.gates) {
      if (g.stage === 'darkhub' && !story.revealed) continue; // 이야기를 보기 전에는 다크월드 문이 없다
      if (Math.abs(px - (g.col * T + T / 2)) < T * 1.6 && Math.abs(feet - (g.row + 1) * T) < T * 2) return { type: 'gate', stage: g.stage };
    }
    for (const x of terrain.exits) {
      if (Math.abs(px - (x.col * T + T / 2)) < T * 1.6 && Math.abs(feet - (x.row + 1) * T) < T * 2) return { type: 'exit' };
    }
    return null;
  }

  function wallet() {
    return { coins, exp, lives, maxLives: maxLives(), inv };
  }

  // ---- 합치기 작업대 (용광로 '합치기' 탭): 3칸에 같은 무기 3개를 올려 1분 뒤에 한 단계 위로. 직접(무료, 곁에서 대기) / 대장장이에게 맡기기(70G) ----
  const isMergeTab = () => !!shop && !!shop.def.tabs[shop.tab] && shop.def.tabs[shop.tab].custom === 'merge';
  const nearFurnace = () => {
    if (stageName !== 'village') return false;
    const f = terrain.shops.find((q) => q.kind === 'furnace');
    return !!f && Math.abs(player.x + player.w / 2 - (f.col * C.TILE + C.TILE / 2)) < C.TILE * 7;
  };
  function mergeView() {
    const F = G.Forge;
    const cands = F.mergeCandidates(inv);
    const sel = Math.max(0, Math.min(cands.length - 1, shop.msel || 0));
    const j = F.jobOf(inv);
    return {
      cands: cands.map((it) => ({ item: it, n: F.copiesOf(inv, it.id), nxt: F.nextOf(it) })), sel, fee: F.SMITH_FEE,
      job: j ? { fromItem: G.Shop.ITEMS[j.from], toItem: G.Shop.ITEMS[j.to], by: j.by, t: j.t, total: j.total, done: j.done } : null, near: nearFurnace(),
    };
  }
  function mergeDo(kind) {
    const F = G.Forge;
    let res;
    if (kind === 'collect') res = F.collectJob(inv);
    else {
      const cands = F.mergeCandidates(inv);
      const it = cands[Math.max(0, Math.min(cands.length - 1, shop.msel || 0))];
      if (!it) res = { ok: false, msg: '합칠 무기가 없어요.' };
      else { const w = wallet(); res = F.startMerge(inv, it.id, kind, w); coins = w.coins; }
    }
    if (res.ok) applyEquipment();
    shop.msg = res.msg;
    shop.ok = res.ok;
    shop.msgT = 2.6;
    G.Audio.play(res.ok ? (kind === 'collect' ? 'treasure' : 'coin') : 'deny');
  }

  // ---- 부착 미니게임 (용광로 '부착' 탭에서 주괴를 고르면): 2분 안에 망치로 두드려 무기와 주괴를 붙인다 ----
  //  움직이는 눈금이 초록 칸(가운데는 완벽)에 있을 때 Space/Enter/클릭. 진행 100%가 되면 붙는다.
  //  시간이 다 되거나 Esc로 나가면 실패: 주괴와 수수료는 그대로다. 성공할 때만 수수료를 낸다
  let ag = null;
  // 광석이 희귀할수록 어렵다: 4단계가 가장 어렵고(초록 칸이 가장 좁고 눈금이 가장 빠르며 빗나가면 -8), 1단계는 쉽다.
  // 너무 쉬운 첫 난이도와 너무 어려운 둘째 난이도의 중간이 최대 단계다: 진행이 조금 식고 칸이 살짝 흔들리지만 눈금은 읽을 만하다
  function attachDifficulty(tier) {
    const d = (tier - 1) / 3; // 0(쉬움) ~ 1(최대)
    const e = G.Forge.smithEase(inv); // 대장 레벨이 오를수록 쉬워진다 (최고 레벨 e=1)
    const raw = {
      goodW: 0.15 - 0.075 * d, perfW: 0.058 - 0.032 * d,
      spd0: 2.3 + 1.4 * d, spdP: 0.012 + 0.006 * d, // 눈금 속도(rad/s) = spd0 + 진행 × spdP
      decay: 0.3 + 0.5 * d, driftAmp: 0.05 + 0.12 * d, harm: tier >= 3 ? 0.3 : 0, // 진행이 식는 속도, 칸이 흔들리는 정도, 눈금 속도의 들쭉날쭉함
      gainP: Math.round(14 - 3 * d), gainG: Math.round(8 - 3 * d), lossM: Math.round(4 + 6 * d),
    };
    return Object.assign(raw, {
      goodW: raw.goodW * (1 + 0.5 * e), perfW: raw.perfW * (1 + 0.4 * e), spd0: raw.spd0 * (1 - 0.25 * e), spdP: raw.spdP * (1 - 0.25 * e),
      decay: raw.decay * (1 - e), driftAmp: raw.driftAmp * (1 - e), harm: raw.harm * (1 - e), lossM: Math.max(1, Math.round(raw.lossM * (1 - 0.4 * e))),
    });
  }
  // 대장 경험치를 더하고 결과 문구 꼬리를 돌려준다 (레벨이 오르면 알린다)
  function smithGain(xp) {
    if (!xp) return '';
    const up = G.Forge.addSmithXp(inv, xp);
    return ` · 대장 경험치 +${xp}${up ? ` — 대장 Lv ${up}! 미니게임이 더 쉬워져요` : ''}`;
  }
  const smithInfo = () => { const sm = G.Forge.smithOf(inv); return { lv: sm.lv, xp: sm.xp, need: sm.lv >= G.Forge.SMITH_MAX_LV ? 0 : G.Forge.smithNeed(sm.lv), max: G.Forge.SMITH_MAX_LV }; };

  // ---- 용광로 대상 고르기: 먼저 검 / 투척 무기 / 갑옷 중 하나를 고르고, 그 종류로 가진 것을 모두 보여 준다. 하나를 고르면 그것을 합치고 붙이는 용광로가 열린다 ----
  let fp = null;
  const FP_CATS = [
    { id: 'sword', name: '검', desc: '근접 무기\n(검 · 대검 · 단검 · 창 · 도끼 …)', icon: 'sword0' },
    { id: 'gun', name: '투척 무기', desc: '쏘고 던지는 무기\n(총 · 활 · 석궁 · 폭탄 …)', icon: 'gun1' },
    { id: 'armor', name: '갑옷', desc: '방어구\n(갑옷 · 투구 · 장갑 · 바지 · 신발)', icon: 'armor1' },
    { id: 'smelt', name: '제련', desc: '광석을 녹여 주괴로 · 모든 광석', icon: 'ore_iron' },
  ];
  const FP_COLS = 10; // 인벤토리처럼 네모 칸 격자 (10칸 x 보이는 4줄)
  const FP_ROWS = 4;
  const fpItemsOf = (cat) => inv.items.filter((id, i, arr) => { const it = G.Shop.ITEMS[id]; return it && it.slot && !it.lens && arr.indexOf(id) === i && G.Forge.classOf(it) === cat; });
  const fpKindOf = (it) => (it.slot === 'weapon' ? it.type : it.slot); // 무기는 종류(검/대검/단검 …), 방어구는 칸(갑옷/투구 …)
  const FP_ARMOR_ORDER = ['armor', 'helmet', 'gloves', 'pants', 'boots'];
  // 종류 버튼: 전체 + 가진 종류별 (인벤토리 창의 종류 버튼처럼)
  function fpChips() {
    const I = G.Shop.ITEMS;
    const order = fp.cat === 'armor' ? FP_ARMOR_ORDER : Object.keys(G.Shop.TYPE_NAMES);
    const names = fp.cat === 'armor' ? G.Shop.SLOT_NAMES : G.Shop.TYPE_NAMES;
    const out = [{ id: 'all', name: '전체', n: fp.all.length }];
    for (const k of order) { const n = fp.all.filter((id) => fpKindOf(I[id]) === k).length; if (n) out.push({ id: k, name: names[k], n }); }
    return out;
  }
  function fpApply() { // 고른 종류로 걸러 목록을 다시 만든다
    const I = G.Shop.ITEMS;
    fp.list = fp.sub === 'all' ? fp.all.slice() : fp.all.filter((id) => fpKindOf(I[id]) === fp.sub);
    fp.cur = Math.max(0, Math.min(fp.list.length - 1, fp.cur));
    fpScroll();
  }
  function fpScroll() { const row = Math.floor(fp.cur / FP_COLS); fp.scroll = Math.max(0, Math.min(row, fp.scroll || 0)); if (row >= fp.scroll + FP_ROWS) fp.scroll = row - FP_ROWS + 1; }
  function fpSetSub(id) { fp.sub = id; fp.cur = 0; fpApply(); G.Audio.play('catch'); }
  function openForgePick() { fp = { step: 'cat', cat: null, cur: 0, list: [], all: [], sub: 'all', scroll: 0, msg: '', msgT: 0 }; G.Audio.play('pickup'); }
  function fpChoose(i) {
    const c = FP_CATS[i];
    if (c.id === 'smelt') { // 제련은 대상 없이 따로: 모든 광석을 녹이는 용광로
      G.Forge.setSmeltOnly(true);
      fp = null;
      shop = { kind: 'furnace', def: G.Shop.SHOPS.furnace, tab: 0, hover: -1, msg: '', msgT: 0, ok: true, target: null, smeltOnly: true };
      G.Audio.play('pickup');
      return;
    }
    const list = fpItemsOf(c.id);
    if (!list.length) { fp.msg = `가진 ${c.name}이(가) 없어요.`; fp.msgT = 2; G.Audio.play('deny'); return; }
    fp.step = 'item'; fp.cat = c.id; fp.all = list; fp.sub = 'all'; fp.list = list.slice(); fp.cur = Math.max(0, list.indexOf(inv.equipped.weapon)); fp.scroll = 0; fpScroll(); G.Audio.play('catch');
  }
  function fpPick(id) {
    G.Forge.setTarget(id);
    fp = null;
    shop = { kind: 'furnace', def: G.Shop.SHOPS.furnace, tab: 0, hover: -1, msg: '', msgT: 0, ok: true, target: id };
    G.Audio.play('pickup');
  }
  const fpMove = (d) => { fp.cur = Math.max(0, Math.min(fp.list.length - 1, fp.cur + d)); fpScroll(); };
  function updateForgePick(dt) {
    fp.msgT = Math.max(0, fp.msgT - dt);
    const pressed = (...c) => c.some((k) => input.wasPressed(k));
    if (fp.step === 'cat') {
      if (pressed('Escape')) { fp = null; return; }
      if (pressed('ArrowLeft', 'KeyA')) fp.cur = (fp.cur + FP_CATS.length - 1) % FP_CATS.length;
      if (pressed('ArrowRight', 'KeyD')) fp.cur = (fp.cur + 1) % FP_CATS.length;
      for (let i = 0; i < FP_CATS.length; i++) if (pressed('Digit' + (i + 1), 'Numpad' + (i + 1))) { fp.cur = i; fpChoose(i); return; }
      if (pressed('Enter', 'Space')) fpChoose(fp.cur);
    } else {
      if (pressed('Escape', 'Backspace')) { fp.step = 'cat'; fp.cur = FP_CATS.findIndex((c) => c.id === fp.cat); return; }
      if (pressed('ArrowLeft', 'KeyA')) fpMove(-1);
      if (pressed('ArrowRight', 'KeyD')) fpMove(1);
      if (pressed('ArrowUp', 'KeyW')) fpMove(-FP_COLS);
      if (pressed('ArrowDown', 'KeyS')) fpMove(FP_COLS);
      if (pressed('PageUp')) fpMove(-FP_COLS * FP_ROWS);
      if (pressed('PageDown')) fpMove(FP_COLS * FP_ROWS);
      if (pressed('Tab')) { // 종류 버튼 돌리기 (Shift = 거꾸로)
        const chips = fpChips();
        const i = chips.findIndex((c) => c.id === fp.sub);
        const back = input.down.has('ShiftLeft') || input.down.has('ShiftRight');
        fpSetSub(chips[(i + (back ? chips.length - 1 : 1)) % chips.length].id);
      }
      if (pressed('Enter', 'Space') && fp.list.length) fpPick(fp.list[fp.cur]);
    }
  }
  const fpView = () => {
    const I = G.Shop.ITEMS;
    return Object.assign({}, fp, {
      cats: FP_CATS.map((c) => Object.assign({ item: I[c.icon], n: c.id === 'smelt' ? Object.values(inv.ores || {}).reduce((a, b) => a + b, 0) : fpItemsOf(c.id).length }, c)),
      chips: fp.step === 'item' ? fpChips() : [],
      entries: fp.step === 'item' ? fp.list.map((id) => ({ item: I[id], copies: G.Forge.copiesOf(inv, id), used: (inv.attach[id] || []).length, slots: G.Forge.slotsOf(I[id]), equipped: Object.values(inv.equipped).includes(id), attached: (inv.attach[id] || []).map((o) => G.Forge.ORE[o].name) })) : [],
      cols: FP_COLS, rows: FP_ROWS,
    });
  };

  // ---- 작업 선택: 제련/부착 광석을 고르면 '직접 하기(미니게임)' 또는 '대장장이에게 맡기기(확실히 성공, 비쌈)' ----
  let wc = null;
  function openWorkChoice(kind, oreId) {
    const ore = G.Forge.ORE[oreId];
    shop = null;
    const base = kind === 'smelt' ? G.Forge.smeltFee(ore) : G.Forge.attachFee(ore);
    wc = { kind, ore: oreId, oreName: ore.name, tier: ore.tier, base, smithFee: G.Forge.smithWorkFee(kind, ore.tier), mini: kind === 'smelt' ? '불 온도 맞추기 미니게임' : attachMiniName(), msg: '', msgT: 0 };
  }
  function workChoiceDo(which) {
    if (!wc) return;
    if (which === 1) { const k = wc.kind, o = wc.ore; wc = null; if (k === 'smelt') startSmeltGame(o); else startAttachGame(o); return; }
    const w = wallet();
    const res = G.Forge.entrustWork(inv, wc.kind, wc.ore, w);
    coins = w.coins;
    if (res.ok) { applyEquipment(); G.Audio.play('treasure'); say(res.msg, 'rgba(255,225,120,A)'); wc = null; }
    else { wc.msg = res.msg; wc.msgT = 2.5; G.Audio.play('deny'); }
  }
  function updateWorkChoice(dt) {
    wc.msgT = Math.max(0, wc.msgT - dt);
    if (input.wasPressed('Escape')) { wc = null; return; }
    if (input.wasPressed('Digit1') || input.wasPressed('Numpad1') || input.wasPressed('Enter')) workChoiceDo(1);
    else if (input.wasPressed('Digit2') || input.wasPressed('Numpad2')) workChoiceDo(2);
  }

  function startHammerGame(oreId) {
    const ore = G.Forge.ORES.find((o) => o.id === oreId);
    shop = null;
    ag = { mode: 'hammer', ore: oreId, oreName: ore.name, weaponId: G.Forge.targetId(inv), t: G.Forge.ATTACH_TIME, progress: 0, tier: ore.tier, ...attachDifficulty(ore.tier), drift: 0, phase: 0, zone: 0.3 + Math.random() * 0.4, perfect: 0, good: 0, miss: 0, msg: '두드려서 붙이자! 눈금이 초록 칸에 올 때 Space', msgT: 3, swing: 0, flash: 0, result: null, resultT: 0, sparks: [] };
    G.Audio.play('pickup');
  }
  // ---- 부착 미니게임은 대상 종류마다 다르다: 검 = 망치로 두드려 붙이기(타이밍 막대), 투척 무기(총·활·폭탄) = 조립 다이얼, 갑옷 = 리벳 박기(화살표 순서) ----
  // 아이템 종류 -> 미니게임: 검류(근접 무기 모두) 두드리기 / 총 다이얼 / 산탄총 탄 기억 / 활 조준 / 석궁 시위 감기 / 폭탄 화약 채우기 /
  //                        갑옷 리벳 / 투구 균형 / 장갑 반응 / 바지 실 받기 / 신발 발맞추기. 서로 하는 방식이 모두 다르다
  const ATTACH_MODE_OF = { gun: 'dial', shotgun: 'memory', bow: 'aim', crossbow: 'crank', bomb: 'fill', armor: 'seq', helmet: 'balance', gloves: 'react', pants: 'catch', boots: 'beat' };
  const ATTACH_NAME = { hammer: '두드려 붙이기', dial: '조립 다이얼', memory: '탄약 장전 기억', aim: '조준 사격', crank: '시위 감기', fill: '화약 채우기', seq: '리벳 박기', balance: '균형 잡기', react: '바느질 반응', catch: '실 받기', beat: '발맞추기' };
  const attachModeOf = (it) => ATTACH_MODE_OF[it.slot === 'weapon' ? it.type : it.slot] || 'hammer';
  function startAttachGame(oreId) {
    const mode = attachModeOf(G.Forge.targetItem(inv));
    const start = { hammer: startHammerGame, dial: startDialGame, seq: startSeqGame, fill: startFillGame, aim: startAimGame, crank: startCrankGame, memory: startMemoryGame, balance: startBalanceGame, react: startReactGame, catch: startCatchGame, beat: startBeatGame }[mode];
    start(oreId);
  }
  const attachMiniName = () => ATTACH_NAME[attachModeOf(G.Forge.targetItem(inv))] + ' 미니게임';
  const attachBase = (oreId, mode, msg) => {
    const ore = G.Forge.ORES.find((o) => o.id === oreId);
    shop = null;
    G.Audio.play('pickup');
    return { mode, ore: oreId, oreName: ore.name, weaponId: G.Forge.targetId(inv), t: G.Forge.ATTACH_TIME, progress: 0, tier: ore.tier, perfect: 0, good: 0, miss: 0, msg, msgT: 4, swing: 0, flash: 0, result: null, resultT: 0, sparks: [], click: false };
  };
  // [총] 조립 다이얼: 빙글 도는 바늘이 초록 칸(작동 홈)에 있을 때 Space. 핀을 차례로 모두 맞춘다. 틀리면 핀 하나가 풀린다
  function startDialGame(oreId) {
    const ore = G.Forge.ORES.find((o) => o.id === oreId);
    const e = G.Forge.smithEase(inv);
    ag = Object.assign(attachBase(oreId, 'dial', '다이얼을 돌려 핀을 맞추자! 바늘이 초록 칸에 올 때 Space'), {
      pins: 3 + ore.tier, arc: 0.8 * (0.17 - 0.025 * (ore.tier - 1)) * (1 + 0.5 * e), speed: 1.2 * (0.55 + 0.1 * (ore.tier - 1)) * (1 - 0.25 * e),
      ang: Math.random(), dir: 1, tgt: Math.random(), locked: 0, lockout: 0,
    });
  }
  const dialDist = (a, b) => { const d = Math.abs(a - b) % 1; return d > 0.5 ? 1 - d : d; };
  function updateDial(dt) {
    ag.ang = (ag.ang + ag.dir * ag.speed * dt + 1) % 1;
    ag.lockout = Math.max(0, ag.lockout - dt);
    ag.flash = Math.max(0, ag.flash - dt * 3);
    ag.msgT = Math.max(0, ag.msgT - dt);
    for (const p of ag.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 2.2 * dt; p.life -= dt; }
    ag.sparks = ag.sparks.filter((p) => p.life > 0);
    const press = input.wasPressed('Space') || input.wasPressed('Enter') || ag.click;
    ag.click = false;
    if (!press || ag.lockout > 0) return;
    if (dialDist(ag.ang, ag.tgt) <= ag.arc / 2) { // 딸깍: 핀이 맞았다
      ag.locked += 1;
      ag.progress = (ag.locked / ag.pins) * 100;
      ag.msg = `딸깍! 핀 ${ag.locked}/${ag.pins}`; ag.msgT = 1.2; ag.flash = 1; ag.good += 1;
      G.Audio.play('clack'); effects.shake(2, 0.08);
      for (let i = 0; i < 10; i++) ag.sparks.push({ x: 0.5 + (Math.random() - 0.5) * 0.1, y: 0.5, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.9, life: 0.4 + Math.random() * 0.3 });
      if (ag.locked >= ag.pins) { agFinish(true); return; }
      ag.dir = -ag.dir; // 다음 핀은 반대로 돈다
      do { ag.tgt = Math.random(); } while (dialDist(ag.tgt, ag.ang) < 0.18);
    } else { // 헛돌았다: 핀이 하나 풀리고 잠깐 걸린다
      ag.miss += 1;
      ag.locked = Math.max(0, ag.locked - 1);
      ag.progress = (ag.locked / ag.pins) * 100;
      ag.lockout = 0.4;
      ag.msg = '헛돌았어요! 핀이 풀렸다'; ag.msgT = 1.2;
      G.Audio.play('deny');
    }
  }
  // [갑옷] 리벳 박기: 화면에 나온 화살표를 순서대로 눌러 리벳을 박는다. 틀리거나 늦으면 그 줄을 처음부터 새로
  function startSeqGame(oreId) {
    const ore = G.Forge.ORES.find((o) => o.id === oreId);
    const e = G.Forge.smithEase(inv);
    ag = Object.assign(attachBase(oreId, 'seq', '화살표를 순서대로 눌러 리벳을 박자! (방향키 또는 WASD)'), {
      len: 4 + ore.tier, rounds: 3, keyTime: 0.85 * (2.0 - 0.25 * (ore.tier - 1)) * (1 + 0.4 * e),
      round: 0, pos: 0, done: 0, seq: [], keyT: 0,
    });
    ag.total = ag.len * ag.rounds;
    seqNew();
  }
  const SEQ_KEYS = { ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D', ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R' };
  function seqNew() { ag.seq = []; for (let i = 0; i < ag.len; i++) ag.seq.push('UDLR'[Math.floor(Math.random() * 4)]); ag.pos = 0; ag.keyT = ag.keyTime * 1.5; }
  function seqMistake(why) {
    ag.miss += 1;
    ag.done = Math.max(0, ag.done - ag.pos);
    ag.progress = (ag.done / ag.total) * 100;
    ag.msg = why; ag.msgT = 1.2; ag.flash = 0;
    G.Audio.play('deny'); effects.shake(2, 0.08);
    seqNew();
  }
  function updateSeq(dt) {
    ag.msgT = Math.max(0, ag.msgT - dt);
    ag.flash = Math.max(0, ag.flash - dt * 3);
    ag.keyT -= dt;
    if (ag.keyT <= 0) { seqMistake('늦었어요! 이 줄을 다시'); return; }
    let key = null;
    for (const c of Object.keys(SEQ_KEYS)) if (input.wasPressed(c)) { key = SEQ_KEYS[c]; break; }
    if (!key) return;
    if (key !== ag.seq[ag.pos]) { seqMistake('틀렸어요! 이 줄을 다시'); return; }
    ag.pos += 1; ag.done += 1; ag.good += 1; ag.keyT = ag.keyTime;
    ag.progress = (ag.done / ag.total) * 100;
    G.Audio.play('clack'); effects.shake(1.5, 0.06);
    if (ag.pos >= ag.len) { // 한 줄 완성
      ag.round += 1; ag.perfect += 1; ag.flash = 1;
      if (ag.round >= ag.rounds) { agFinish(true); return; }
      ag.msg = `한 줄 완성! (${ag.round}/${ag.rounds})`; ag.msgT = 1.2; G.Audio.play('crit');
      seqNew();
    }
  }

  // ---- 새 미니게임들 (모두 제한 시간 2분, 희귀한 광석일수록 어렵고 대장 레벨이 높을수록 쉽다) ----
  const adv = (oreId) => { const o = G.Forge.ORES.find((q) => q.id === oreId); return { tier: o.tier, d: (o.tier - 1) / 3, e: G.Forge.smithEase(inv) }; };
  const pressedKey = (...c) => c.some((k) => input.wasPressed(k));
  const tapPressed = () => { const r = pressedKey('Space', 'Enter') || ag.click; ag.click = false; return r; };
  const agMiss = (msg) => { ag.miss += 1; ag.msg = msg; ag.msgT = 1.2; G.Audio.play('deny'); effects.shake(2, 0.08); };
  const agGood = (msg, snd) => { ag.good += 1; ag.msg = msg; ag.msgT = 1.2; ag.flash = 1; G.Audio.play(snd || 'clack'); effects.shake(1.5, 0.06); };
  const agTick = (dt) => { ag.msgT = Math.max(0, ag.msgT - dt); ag.flash = Math.max(0, ag.flash - dt * 3); };
  const agSetProg = (v) => { ag.progress = Math.max(0, Math.min(100, v)); if (ag.progress >= 100) agFinish(true); };

  // [폭탄] 화약 채우기: 누르고 있는 동안 화약이 차오른다. 초록 칸에서 떼야 한다 (넘치면 펑!)
  function startFillGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'fill', 'Space를 누르고 있으면 화약이 차올라요. 초록 칸에서 떼세요!'), {
      rounds: 3 + tier, round: 0, level: 0, hw: (0.075 - 0.011 * (tier - 1)) * (1 + 0.5 * e), rate: (0.55 + 0.12 * tier) * (1 - 0.2 * e),
      center: 0.4 + Math.random() * 0.45, held: false, mouse: false, cool: 0, shown: 0,
    });
  }
  function updateFill(dt) {
    agTick(dt);
    ag.cool = Math.max(0, ag.cool - dt);
    if (ag.cool > 0) { ag.shown = Math.max(0, ag.shown - dt * 2.5); return; }
    const held = input.down.has('Space') || input.down.has('Enter') || ag.mouse;
    if (held) {
      ag.held = true;
      ag.level += ag.rate * dt;
      ag.shown = ag.level;
      if (ag.level >= 1) { // 넘쳤다
        agMiss('펑! 넘쳤어요'); ag.level = 0; ag.held = false; ag.cool = 0.7; ag.center = 0.4 + Math.random() * 0.45; effects.shake(5, 0.2);
      }
    } else if (ag.held) { // 뗐다: 초록 칸이면 성공
      ag.held = false;
      const ok = Math.abs(ag.level - ag.center) <= ag.hw;
      ag.shown = ag.level;
      if (ok) {
        ag.round += 1;
        agGood('딸깍! 화약 ' + ag.round + '/' + ag.rounds, 'clack');
        ag.center = 0.4 + Math.random() * 0.45;
      } else if (ag.level > 0.04) agMiss(ag.level < ag.center ? '모자라요!' : '넘쳤어요!');
      ag.level = 0; ag.cool = 0.5;
      agSetProg((ag.round / ag.rounds) * 100);
    }
  }
  // [활] 조준 사격: 움직이는 십자선이 과녁 가운데에 올 때 쏜다
  function startAimGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'aim', '십자선이 과녁 가운데에 올 때 Space!'), {
      shots: 3 + tier, hit: 0, r: (0.09 - 0.011 * (tier - 1)) * (1 + 0.5 * e), tt: 0, cx: 0.5, cy: 0.5, cool: 0, k: 1 - 0.2 * e, tierMul: tier,
    });
    aimNew();
  }
  function aimNew() { ag.fx = (1.3 + 0.4 * ag.tierMul + Math.random() * 0.6) * ag.k; ag.fy = (1.7 + 0.35 * ag.tierMul + Math.random() * 0.6) * ag.k; ag.p1 = Math.random() * 6; ag.p2 = Math.random() * 6; }
  function updateAim(dt) {
    agTick(dt);
    ag.tt += dt;
    ag.cool = Math.max(0, ag.cool - dt);
    ag.cx = 0.5 + 0.42 * Math.sin(ag.fx * ag.tt + ag.p1);
    ag.cy = 0.5 + 0.38 * Math.sin(ag.fy * ag.tt + ag.p2);
    if (!tapPressed() || ag.cool > 0) return;
    ag.cool = 0.3;
    const dist = Math.hypot(ag.cx - 0.5, ag.cy - 0.5);
    if (dist <= ag.r) {
      ag.hit += 1;
      if (dist <= ag.r * 0.4) { ag.perfect += 1; agGood('명중! 정중앙! ' + ag.hit + '/' + ag.shots, 'crit'); } else agGood('명중! ' + ag.hit + '/' + ag.shots, 'clack');
      aimNew();
    } else { ag.hit = Math.max(0, ag.hit - 1); agMiss('빗나갔다! 맞힌 것 하나가 사라졌다'); }
    agSetProg((ag.hit / ag.shots) * 100);
  }
  // [석궁] 시위 감기: ← → 를 번갈아 눌러 손잡이를 돌린다. 같은 쪽을 두 번 누르면 걸린다
  function startCrankGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'crank', '← → 를 번갈아 빠르게 눌러 시위를 감자!'), { power: 0, last: null, decay: (11 + 3.5 * tier) * (1 - 0.3 * e), spin: 0, jam: 0 });
  }
  function updateCrank(dt) {
    agTick(dt);
    ag.jam = Math.max(0, ag.jam - dt);
    ag.power = Math.max(0, ag.power - ag.decay * dt);
    for (const code of ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD']) {
      if (!input.wasPressed(code)) continue;
      const side = code === 'ArrowLeft' || code === 'KeyA' ? 'L' : 'R';
      if (side !== ag.last) { ag.power += 6; ag.spin += 1; ag.last = side; ag.flash = 0.5; if (ag.spin % 4 === 0) G.Audio.play('clack'); }
      else { ag.power = Math.max(0, ag.power - 8); ag.jam = 0.3; agMiss('걸렸어요! 번갈아 눌러요'); }
    }
    agSetProg(ag.power);
  }
  // [산탄총] 탄약 장전 기억: 보여 주는 색 탄환의 순서를 외웠다가 1~4 키로 그대로 누른다
  function startMemoryGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'memory', '탄환이 켜지는 순서를 외우세요!'), { len: 3 + tier, rounds: 2, round: 0, showT: (0.7 - 0.07 * (tier - 1)) * (1 + 0.4 * e), phase: 'show', idx: 0, tm: 0.9, pos: 0, done: 0, seq: [] });
    ag.total = ag.len * ag.rounds;
    memNew();
  }
  function memNew() { ag.seq = []; for (let i = 0; i < ag.len; i++) ag.seq.push(Math.floor(Math.random() * 4)); ag.phase = 'show'; ag.idx = -1; ag.tm = 0.9; ag.pos = 0; }
  function updateMemory(dt) {
    agTick(dt);
    if (ag.phase === 'show') {
      ag.tm -= dt;
      if (ag.tm <= 0) { ag.idx += 1; ag.tm = ag.showT; if (ag.idx >= ag.len) { ag.phase = 'input'; ag.pos = 0; ag.msg = '이제 같은 순서로 누르세요! (1 2 3 4)'; ag.msgT = 2; } else G.Audio.play('clack'); }
      return;
    }
    for (let k = 0; k < 4; k++) {
      if (!pressedKey('Digit' + (k + 1), 'Numpad' + (k + 1))) continue;
      ag.lit = k; ag.litT = 0.25;
      if (k === ag.seq[ag.pos]) {
        ag.pos += 1; ag.done += 1; ag.good += 1; G.Audio.play('clack');
        if (ag.pos >= ag.len) { ag.round += 1; ag.flash = 1; if (ag.round < ag.rounds) { ag.msg = '맞았어요! 다음 줄'; ag.msgT = 1.2; memNew(); } }
      } else { ag.done = Math.max(0, ag.done - ag.pos); agMiss('틀렸어요! 다시 보여 줄게요'); memNew(); }
      agSetProg((ag.done / ag.total) * 100);
      break;
    }
    ag.litT = Math.max(0, (ag.litT || 0) - dt);
  }
  // [투구] 균형 잡기: 바람에 밀리는 투구를 ← → 로 가운데 초록 칸에 붙들어 둔다
  function startBalanceGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'balance', '← → 로 투구를 초록 칸에 붙들어 두세요!'), { x: 0, v: 0, wind: 0, windTo: 0, windT: 0.5, zw: (0.3 - 0.045 * (tier - 1)) * (1 + 0.5 * e), need: 11 + 3 * tier, drift: (1.0 + 0.4 * tier) * (1 - 0.3 * e) });
  }
  function updateBalance(dt) {
    agTick(dt);
    ag.windT -= dt;
    if (ag.windT <= 0) { ag.windTo = (Math.random() * 2 - 1) * ag.drift; ag.windT = 0.6 + Math.random() * 0.9; }
    ag.wind += (ag.windTo - ag.wind) * Math.min(1, 2 * dt);
    const push = (input.down.has('ArrowRight') || input.down.has('KeyD') ? 1 : 0) - (input.down.has('ArrowLeft') || input.down.has('KeyA') ? 1 : 0);
    ag.v += (ag.wind + push * 2.6) * dt;
    ag.v *= Math.exp(-0.9 * dt);
    ag.x += ag.v * dt;
    if (Math.abs(ag.x) > 1) { ag.x = Math.sign(ag.x); ag.v = -ag.v * 0.3; ag.progress = Math.max(0, ag.progress - 15); agMiss('굴러 떨어질 뻔했어요! -15'); }
    if (Math.abs(ag.x) <= ag.zw) agSetProg(ag.progress + dt * (100 / ag.need));
    else ag.progress = Math.max(0, ag.progress - 3 * dt);
  }
  // [장갑] 바느질 반응: 불이 초록으로 바뀌는 순간 Space. 미리 누르거나 늦거나 노란 가짜 불에 속으면 안 된다
  function startReactGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'react', '불이 초록이 될 때 Space! 미리 누르면 안 돼요'), { rounds: 4 + tier, round: 0, win: (0.5 - 0.06 * (tier - 1)) * (1 + 0.5 * e), decoy: 0.1 * (tier - 1), state: 'wait', timer: 1 + Math.random() * 1.5 });
  }
  function updateReact(dt) {
    agTick(dt);
    const press = tapPressed();
    ag.timer -= dt;
    if (ag.state === 'wait') {
      if (press) { agMiss('너무 일렀어요!'); ag.timer = 1 + Math.random() * 1.5; return; }
      if (ag.timer <= 0) { if (Math.random() < ag.decoy) { ag.state = 'decoy'; ag.timer = 0.45; } else { ag.state = 'go'; ag.timer = ag.win; G.Audio.play('pickup'); } }
    } else if (ag.state === 'decoy') {
      if (press) { agMiss('가짜 불이에요!'); ag.state = 'wait'; ag.timer = 1 + Math.random() * 1.5; return; }
      if (ag.timer <= 0) { ag.state = 'wait'; ag.timer = 0.8 + Math.random() * 1.6; }
    } else if (ag.state === 'go') {
      if (press) {
        ag.round += 1; agGood('좋아요! ' + ag.round + '/' + ag.rounds + ' (' + Math.round((ag.win - ag.timer) * 1000) + 'ms)', 'clack');
        ag.state = 'wait'; ag.timer = 0.9 + Math.random() * 1.8;
        agSetProg((ag.round / ag.rounds) * 100);
      } else if (ag.timer <= 0) { agMiss('늦었어요!'); ag.state = 'wait'; ag.timer = 1 + Math.random() * 1.5; }
    }
  }
  // [바지] 실 받기: ← → 로 바구니를 움직여 금실은 받고 빨간 얼룩은 피한다
  function startCatchGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'catch', '← → 로 바구니를 움직여 금실만 받으세요!'), { need: 6 + 2 * tier, caught: 0, bx: 0.5, items: [], spawnT: 0.4, speed: (0.34 + 0.07 * tier) * (1 - 0.2 * e), badP: 0.2 + 0.08 * tier, bw: (0.17 - 0.013 * (tier - 1)) * (1 + 0.4 * e) });
  }
  function updateCatch(dt) {
    agTick(dt);
    const dir = (input.down.has('ArrowRight') || input.down.has('KeyD') ? 1 : 0) - (input.down.has('ArrowLeft') || input.down.has('KeyA') ? 1 : 0);
    ag.bx = Math.max(0.06, Math.min(0.94, ag.bx + dir * 1.15 * dt));
    ag.spawnT -= dt;
    if (ag.spawnT <= 0) { ag.items.push({ x: 0.08 + Math.random() * 0.84, y: -0.05, bad: Math.random() < ag.badP }); ag.spawnT = Math.max(0.35, 0.8 - 0.04 * ag.tier) * (0.7 + Math.random() * 0.6); }
    for (const it of ag.items) it.y += ag.speed * dt;
    for (const it of ag.items) {
      if (it.y < 0.9 || it.done) continue;
      if (Math.abs(it.x - ag.bx) <= ag.bw / 2) {
        it.done = true;
        if (it.bad) { ag.caught = Math.max(0, ag.caught - 2); agMiss('얼룩이에요! -2'); } else { ag.caught += 1; agGood('받았다! ' + ag.caught + '/' + ag.need, 'coin'); }
        agSetProg((ag.caught / ag.need) * 100);
      }
    }
    ag.items = ag.items.filter((it) => !it.done && it.y < 1.05);
  }
  // [신발] 발맞추기: 박자에 맞춰 왼발(←/A)과 오른발(→/D)을 번갈아 내딛는다
  function startBeatGame(oreId) {
    const { tier, e } = adv(oreId);
    ag = Object.assign(attachBase(oreId, 'beat', '박자에 맞춰 ← → 를 번갈아 눌러요!'), { iv: (0.85 - 0.05 * (tier - 1)) * (1 + 0.1 * e), tol: (0.13 - 0.014 * (tier - 1)) * (1 + 0.5 * e), need: 8 + 2 * tier, combo: 0, tt: 0, k: 0, start: 1.2, used: {} });
  }
  function updateBeat(dt) {
    agTick(dt);
    ag.tt += dt;
    const bt = (k) => ag.start + k * ag.iv;
    // 지나간 박자
    while (ag.tt > bt(ag.k) + ag.tol) {
      if (!ag.used[ag.k]) { ag.combo = Math.max(0, ag.combo - 2); agMiss('박자를 놓쳤어요!'); }
      delete ag.used[ag.k]; ag.k += 1;
    }
    for (const code of ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD']) {
      if (!input.wasPressed(code)) continue;
      const foot = code === 'ArrowLeft' || code === 'KeyA' ? 0 : 1;
      let hit = -1;
      for (const k of [ag.k, ag.k + 1]) if (Math.abs(ag.tt - bt(k)) <= ag.tol && !ag.used[k]) { hit = k; break; }
      if (hit >= 0 && hit % 2 === foot) { ag.used[hit] = true; ag.combo += 1; agGood('좋아요! 연속 ' + ag.combo, 'clack'); }
      else { if (hit >= 0) ag.used[hit] = true; ag.combo = Math.max(0, ag.combo - 3); agMiss(hit >= 0 ? '발이 반대예요!' : '박자가 아니에요!'); }
      agSetProg((ag.combo / ag.need) * 100);
    }
    agSetProg((ag.combo / ag.need) * 100);
  }
  const ATTACH_UPDATE = { dial: updateDial, seq: updateSeq, fill: updateFill, aim: updateAim, crank: updateCrank, memory: updateMemory, balance: updateBalance, react: updateReact, catch: updateCatch, beat: updateBeat };

  // 눈금 위치: 3단계 이상 광석은 속도가 들쭉날쭉해서 타이밍을 읽기 어렵다
const agPos = () => 0.5 + 0.5 * Math.sin(ag.phase + ag.harm * Math.sin(ag.phase * 1.7));
  function agHit() {
    const d = Math.abs(agPos() - ag.zone);
    ag.swing = 1;
    let gain;
    if (d < ag.perfW) { gain = ag.gainP; ag.perfect += 1; ag.msg = `완벽! +${gain}`; G.Audio.play('crit'); ag.flash = 1; effects.shake(5, 0.16); }
    else if (d < ag.goodW) { gain = ag.gainG; ag.good += 1; ag.msg = `좋아! +${gain}`; G.Audio.play('clack'); effects.shake(3, 0.1); }
    else { gain = -ag.lossM; ag.miss += 1; ag.msg = `빗나갔다! ${gain}`; G.Audio.play('deny'); }
    ag.progress = Math.max(0, Math.min(100, ag.progress + gain));
    ag.msgT = 1.2;
    for (let i = 0; i < (gain > 0 ? 14 : 4); i++) ag.sparks.push({ x: 0.5 + (Math.random() - 0.5) * 0.12, y: 0.62, vx: (Math.random() - 0.5) * 0.9, vy: -Math.random() * 0.9, life: 0.4 + Math.random() * 0.3 });
    ag.zone = 0.15 + Math.random() * 0.7; // 다음 칸은 다른 곳에
    if (ag.progress >= 100) agFinish(true);
  }
  function agFinish(win) {
    if (ag.result) return; // 이미 끝났다 (같은 갱신에서 두 번 부르지 않게)
    ag.result = win ? 'win' : 'fail';
    ag.resultT = 2;
    if (win) {
      const w = wallet();
      const res = G.Forge.attach(inv, ag.ore, w);
      coins = w.coins;
      applyEquipment();
      ag.msg = res.msg + smithGain(res.ok ? G.Forge.XP.attach(G.Forge.ORE[ag.ore]) : 0);
      ag.ok = res.ok;
      G.Audio.play(res.ok ? 'treasure' : 'deny');
    } else {
      ag.msg = '시간이 다 됐어요… 주괴와 수수료는 그대로예요';
      ag.ok = false;
      G.Audio.play('deny');
    }
    ag.msgT = 3;
  }
  function updateAttachGame(dt) {
    if (ag.result) { // 결과 화면: 잠깐 보여 준 뒤 Space/Enter/클릭으로 닫는다
      ag.resultT -= dt;
      if (ag.resultT < 0 && (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('Escape') || input.wasPressed('KeyE') || ag.click)) ag = null;
      else ag.click = false;
      return;
    }
    if (input.wasPressed('Escape')) { ag = null; return; } // 중도 포기: 아무것도 잃지 않는다
    ag.t = Math.max(0, ag.t - dt);
    if (ATTACH_UPDATE[ag.mode]) { // 두드리기 말고는 종류마다 다른 미니게임
      ATTACH_UPDATE[ag.mode](dt);
      if (ag && !ag.result && ag.t <= 0) agFinish(false);
      return;
    }
    ag.phase += (ag.spd0 + ag.progress * ag.spdP) * dt; // 눈금: 광석 단계가 높고 진행될수록 빨라진다 (대략 4~8 rad/s)
    ag.progress = Math.max(0, ag.progress - ag.decay * dt); // 식어서 조금씩 되돌아간다: 멈추면 안 붙는다
    if (ag.progress > 25 && ag.driftAmp > 0) { ag.drift += dt; ag.zone = Math.max(0.14, Math.min(0.86, ag.zone + Math.sin(ag.drift * (1.1 + 0.2 * ag.tier)) * ag.driftAmp * dt)); } // 초록 칸이 천천히 흔들린다
    ag.swing = Math.max(0, ag.swing - dt * 5);
    ag.flash = Math.max(0, ag.flash - dt * 4);
    ag.msgT = Math.max(0, ag.msgT - dt);
    for (const p of ag.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 2.2 * dt; p.life -= dt; }
    ag.sparks = ag.sparks.filter((p) => p.life > 0);
    if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('ArrowDown') || ag.click) agHit();
    ag.click = false;
    if (!ag.result && ag.t <= 0) agFinish(false);
  }

  // ---- 제련 미니게임 (용광로 '제련' 탭에서 광석을 고르면): 풀무질로 불의 온도를 알맞게 유지해 광석을 녹인다 ----
  //  Space/Enter/마우스를 누르고 있으면 온도가 오르고, 떼면 식는다. 온도 눈금이 초록 띠(알맞은 온도)에 머무는 동안 녹는다.
  //  너무 차가우면 조금씩 굳고, 너무 뜨거우면(빨강) 빠르게 굳는다. 띠는 천천히 오르내리고 광석 단계가 높을수록 좁고 뜨겁다.
  //  시간 초과나 Esc는 실패: 광석과 수수료는 그대로. 성공할 때만 광석 3개와 수수료를 쓴다
  let sg = null;
  // 광석이 희귀할수록 어렵다: 4단계가 최대(좁은 띠, 빨리 식고 불길이 거세며, 띠가 크게 움직이고, 굳는 벌이 크다), 1단계는 아주 쉽다
  function smeltDifficulty(tier) {
    const d = (tier - 1) / 3; // 0(쉬움) ~ 1(최대)
    const e = G.Forge.smithEase(inv); // 대장 레벨이 오를수록 쉬워진다
    const raw = {
      hw: 18 - 13 * d,                       // 알맞은 온도 띠의 반폭
      heat: 30 + 10 * d, cool: 12 + 16 * d,  // 풀무질로 오르는 속도 / 식는 속도 (/초)
      wob: 1.5 + 6 * d,                      // 불길이 제멋대로 흔들리는 세기
      bandAmp: 2 + 8 * d, bandSpd: 0.3 + 0.3 * d, // 띠가 오르내리는 폭과 속도
      need: 8 + 12 * d,                      // 띠 안에서 버텨야 하는 시간(초)
      coldP: 0.8 + 1.4 * d, hotP: 2 + 5 * d, burnP: 4 + 10 * d, // 차가울 때 / 뜨거울 때 / 과열(92 이상) 때 굳는 속도
    };
    return Object.assign(raw, {
      hw: raw.hw * (1 + 0.5 * e), cool: raw.cool * (1 - 0.3 * e), wob: raw.wob * (1 - 0.5 * e), bandAmp: raw.bandAmp * (1 - 0.4 * e), need: raw.need * (1 - 0.25 * e),
      coldP: raw.coldP * (1 - 0.4 * e), hotP: raw.hotP * (1 - 0.4 * e), burnP: raw.burnP * (1 - 0.4 * e),
    });
  }
  function startSmeltGame(oreId) {
    const ore = G.Forge.ORES.find((o) => o.id === oreId);
    shop = null;
    const tier = ore.tier;
    sg = { ore: oreId, oreName: ore.name, tier, ...smeltDifficulty(tier), t: G.Forge.SMELT_TIME, temp: 15, progress: 0, base: 30 + tier * 10, time: 0, ph: Math.random() * 6, mouse: false, held: false, over: 0, msg: '풀무질! Space를 누르면 온도가 오르고, 떼면 식어요', msgT: 4, flash: 0, result: null, resultT: 0, click: false, inBand: 0 };
    G.Audio.play('pickup');
  }
  const sgBand = () => sg.base + sg.bandAmp * Math.sin(sg.time * sg.bandSpd + sg.ph); // 알맞은 온도의 가운데
  function updateSmeltGame(dt) {
    if (sg.result) { // 결과 화면: 잠깐 보여 준 뒤 닫는다
      sg.resultT -= dt;
      if (sg.resultT < 0 && (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('Escape') || input.wasPressed('KeyE') || sg.click)) sg = null;
      else sg.click = false;
      return;
    }
    if (input.wasPressed('Escape')) { sg = null; return; } // 중도 포기: 아무것도 잃지 않는다
    sg.time += dt;
    sg.t = Math.max(0, sg.t - dt);
    sg.held = input.down.has('Space') || input.down.has('Enter') || sg.mouse;
    // 온도: 풀무질하면 오르고, 아니면 식는다. 불길이 제멋대로 흔들린다
    sg.temp += (sg.held ? sg.heat : -sg.cool) * dt + Math.sin(sg.time * 2.3 + sg.ph) * sg.wob * dt;
    sg.temp = Math.max(0, Math.min(100, sg.temp));
    const c = sgBand();
    const diff = sg.temp - c;
    sg.flash = Math.max(0, sg.flash - dt * 3);
    sg.msgT = Math.max(0, sg.msgT - dt);
    if (Math.abs(diff) <= sg.hw) { // 알맞음: 녹는다
      sg.progress += dt * (100 / sg.need);
      sg.inBand += dt;
      if (sg.msgT <= 0) { sg.msg = '좋아요! 그대로 유지!'; sg.msgT = 0.4; }
    } else if (diff < 0) { sg.progress -= sg.coldP * dt; if (sg.msgT <= 0) { sg.msg = '너무 차가워요! 풀무질!'; sg.msgT = 0.4; } }
    else { // 너무 뜨거움
      sg.progress -= (sg.temp > 92 ? sg.burnP : sg.hotP) * dt;
      sg.over += dt;
      if (sg.msgT <= 0) { sg.msg = sg.temp > 92 ? '과열! 광석이 타요!' : '너무 뜨거워요! 풀무질을 멈춰요'; sg.msgT = 0.4; }
    }
    sg.progress = Math.max(0, Math.min(100, sg.progress));
    if (sg.progress >= 100) smeltFinish(true);
    else if (sg.t <= 0) smeltFinish(false);
  }
  function smeltFinish(win) {
    sg.result = win ? 'win' : 'fail';
    sg.resultT = 2;
    if (win) {
      const w = wallet();
      const res = G.Forge.smelt(inv, sg.ore, w);
      coins = w.coins;
      sg.msg = res.msg + smithGain(res.ok ? G.Forge.XP.smelt(G.Forge.ORE[sg.ore]) : 0);
      sg.ok = res.ok;
      G.Audio.play(res.ok ? 'treasure' : 'deny');
      effects.shake(6, 0.2);
    } else {
      sg.msg = '시간이 다 됐어요… 광석과 수수료는 그대로예요';
      sg.ok = false;
      G.Audio.play('deny');
    }
  }

  const SHOP_PER_PAGE = 4;
  const shopPages = () => Math.max(1, Math.ceil(shop.def.tabs[shop.tab].items.length / SHOP_PER_PAGE));
  const shopItems = () => { const pg = Math.min(shop.page || 0, shopPages() - 1); return shop.def.tabs[shop.tab].items.slice(pg * SHOP_PER_PAGE, pg * SHOP_PER_PAGE + SHOP_PER_PAGE); }; // 지금 페이지의 물품
  const shopPage = (d) => { const n = shopPages(); shop.page = Math.max(0, Math.min(n - 1, (shop.page || 0) + d)); shop.hover = -1; };

  // 상점 물품 하나를 산다 (숫자 키와 마우스 클릭이 같이 쓴다)
  // 꾸미기 창에서 장식품 하나를 놓거나(치우기 포함) 한다
  function placeItem(item) {
    const sl = shop.slot;
    const before = G.Shop.homeBonuses(inv);
    const res = G.Shop.placeDecor(inv, sl.kind, sl.index, item.clear ? null : item.id);
    if (res.ok) { // 놓거나 치운 만큼 보너스가 얼마나 바뀌었는지 알려준다
      const after = G.Shop.homeBonuses(inv);
      const d = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10}%`;
      res.msg += item.clear ? ` (코인 ${d(after.coin - before.coin)}, 치명타 ${d(after.crit - before.crit)})` : ` (코인 ${d(after.coin - before.coin)}, 치명타 ${d(after.crit - before.crit)} 더!)`;
    }
    shop.def.tabs = G.Shop.placeTabs(inv, sl.kind);
    shop.tab = Math.min(shop.tab, shop.def.tabs.length - 1);
    shop.msg = res.msg;
    shop.ok = res.ok;
    shop.msgT = 2;
    G.Audio.play(res.ok ? 'pickup' : 'deny');
  }

  function buyItem(item) {
    if (!shop) return;
    if (shop.mode === 'place') { placeItem(item); return; }
    const w = wallet();
    const res = G.Shop.buy(item, w);
    if (res.ok && (res.minigame === 'attach' || res.minigame === 'smelt')) { openWorkChoice(res.minigame, res.ore); return; } // 제련/부착: 직접(미니게임) 또는 대장장이에게 맡기기
    if (res.ok && item.upgrade === 'stmax') stamina += C.STAMINA_MAX_STEP; // 늘어난 만큼 바로 채워 준다
    coins = w.coins;
    exp = w.exp;
    lives = w.lives;
    applyEquipment();
    shop.msg = res.msg;
    shop.ok = res.ok;
    shop.msgT = 2;
    G.Audio.play(res.ok ? 'coin' : 'deny');
  }

  // 상점: ←→ 탭 전환, 숫자 키 또는 마우스 클릭으로 구매, E/Esc로 닫기
  function updateShop(dt) {
    if (shop.kind === 'furnace' && input.wasPressed('Backspace')) { shop = null; openForgePick(); return; } // 대상 바꾸기
    if (input.wasPressed('KeyE') || input.wasPressed('Escape')) {
      shop = null;
      return;
    }
    const tabs = shop.def.tabs.length;
    if (isMergeTab()) { // 합치기 작업대: ↑↓ 무기 고르기, 1 직접 / 2 맡기기 / 3(또는 Enter) 찾기
      const n = G.Forge.mergeCandidates(inv).length;
      shop.msel = Math.max(0, Math.min(Math.max(0, n - 1), shop.msel || 0));
      if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) shop.msel = Math.max(0, shop.msel - 1);
      if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) shop.msel = Math.min(Math.max(0, n - 1), shop.msel + 1);
      const j = G.Forge.jobOf(inv);
      if (input.wasPressed('Digit1') || input.wasPressed('Numpad1')) mergeDo('self');
      else if (input.wasPressed('Digit2') || input.wasPressed('Numpad2')) mergeDo('smith');
      else if (input.wasPressed('Digit3') || input.wasPressed('Numpad3') || (j && j.done && input.wasPressed('Enter'))) mergeDo('collect');
    }
    if (tabs > 1) {
      const was = shop.tab;
      if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) shop.tab = (shop.tab + 1) % tabs;
      if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) shop.tab = (shop.tab + tabs - 1) % tabs;
      if (shop.tab !== was) shop.page = 0;
    }
    if (!isMergeTab()) {
      if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS') || input.wasPressed('PageDown')) shopPage(1); // 물품이 4개를 넘으면 페이지 넘김
      if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW') || input.wasPressed('PageUp')) shopPage(-1);
    }
    shopItems().forEach((item, i) => {
      if (input.wasPressed('Digit' + (i + 1)) || input.wasPressed('Numpad' + (i + 1))) buyItem(item);
    });
    if (shop) shop.msgT = Math.max(0, shop.msgT - dt); // (부착 미니게임이 열리면 상점은 닫혀 있다)
  }

  const INV_COLS = 8; // 인벤토리 격자: 8칸 x 보이는 5줄, 모두 120칸 (더 가지면 늘어난다), 스크롤
  const INV_ROWS = 5;
  const INV_CAP = 120;

  // 물약을 마시고 피를 채운다 (인벤토리 E와 Q 키가 같이 쓴다). 결과 메시지를 돌려준다
  function drinkPotion(id) {
    const r = G.Shop.usePotion(inv, id, lives, maxLives());
    lives = r.lives;
    G.Audio.play(r.ok ? 'pickup' : 'deny');
    return r;
  }

  // 최고 장착 핵심: 방어구 5칸(갑옷·투구·장갑·바지·신발)을 가진 것 중 가장 좋은 것(powerOf 점수)으로 맞춘다. 바꾼 아이템 이름 목록을 돌려준다
  function equipBestCore() {
    const changed = [];
    for (const slot of ['armor', 'helmet', 'gloves', 'pants', 'boots']) {
      const cur = inv.equipped[slot] ? G.Shop.ITEMS[inv.equipped[slot]] : null;
      let best = cur;
      let bp = cur ? G.Shop.powerOf(cur, inv) : -1;
      for (const id of inv.items) {
        const it = G.Shop.ITEMS[id];
        if (!it || it.slot !== slot) continue;
        const p = G.Shop.powerOf(it, inv);
        if (p > bp + 1e-9) { best = it; bp = p; }
      }
      if (best && best !== cur) { inv.equipped[slot] = best.id; changed.push(best.name); }
    }
    if (changed.length) applyEquipment();
    return changed;
  }

  // 인벤토리의 최고 장착 버튼 / H 키
  function equipBest() {
    const e = equipUI;
    const changed = equipBestCore();
    if (changed.length) {
      e.msg = `최고 장착! ${changed.length}곳을 바꿨다: ${changed.join(', ')}`;
      e.ok = true;
      G.Audio.play('catch');
    } else {
      e.msg = '이미 가장 좋은 옷차림이에요!';
      e.ok = true;
      G.Audio.play('pickup');
    }
    e.msgT = 2.2;
    return changed.length;
  }

  // 선택한 칸의 아이템을 쓴다: 장비는 장착(이미 낀 장갑/신발은 해제, 무기·갑옷은 벗을 수 없음), 물약은 마신다
  function equipSelected() {
    const e = equipUI;
    const entry = G.Shop.gridEntries(inv, e.cat)[e.cur];
    const item = entry && G.Shop.ITEMS[entry.id];
    e.msgT = 1.5;
    if (!item) {
      e.msg = '빈 칸이에요.';
      e.ok = false;
      G.Audio.play('deny');
    } else if (item.consumable) { // 스태미나 물약/음식/얼음 폭탄
      const r = useConsumable(item.id);
      e.msg = r.msg;
      e.ok = r.ok;
      if (!r.ok) G.Audio.play('deny');
    } else if (item.pickaxe) { // 곡괭이는 끼거나 뺀다 (낀 것만 광석을 캘 수 있다)
      const on = G.Forge.togglePick(inv, item.id);
      e.msg = on ? `${item.name} 장착` : `${item.name} 해제`;
      e.ok = true;
      G.Audio.play(on ? 'pickup' : 'catch');
    } else if (item.quest || item.tool) {
      e.msg = `${item.name}: 소중히 간직하고 있다`;
      e.ok = true;
      G.Audio.play('pickup');
    } else if (item.heal !== undefined) {
      const r = drinkPotion(item.id);
      e.msg = r.msg;
      e.ok = r.ok;
    } else if (inv.equipped[item.slot] === item.id) {
      if (item.slot === 'helmet' || item.slot === 'gloves' || item.slot === 'boots' || item.slot === 'pants') {
        inv.equipped[item.slot] = null;
        applyEquipment();
        e.msg = `${item.name} 해제`;
        e.ok = true;
        G.Audio.play('catch');
      } else {
        e.msg = '이미 장착 중이에요.';
        e.ok = false;
        G.Audio.play('deny');
      }
    } else if (item.slot === 'weapon' && duelBlocks(item.id)) {
      e.msg = duelBlocks(item.id);
      e.ok = false;
      G.Audio.play('deny');
    } else {
      inv.equipped[item.slot] = item.id;
      applyEquipment();
      e.msg = `${item.name} 장착!`;
      e.ok = true;
      G.Audio.play('catch');
    }
  }

  // 인벤토리 창(I 키): 분류 탭(Tab) + 스크롤되는 큰 격자. 방향키/마우스로 칸 선택, E/Enter/클릭으로 장착, 1~5 키로 무기 칸에 넣기, I/Esc로 닫기
  function updateEquip(dt) {
    const e = equipUI;
    const pressed = (...codes) => codes.some((c) => input.wasPressed(c));
    if (pressed('Escape', 'KeyI', 'BracketRight')) {
      equipUI = null;
      return;
    }
    const cats = G.Shop.CATEGORIES;
    if (pressed('KeyQ')) cycleSort();
    if (pressed('KeyH')) equipBest();
    if (pressed('KeyC')) cycleSub();
    if (pressed('Tab')) {
      const k = (cats.findIndex((c) => c.id === e.cat) + 1) % cats.length;
      setEquipCat(cats[k].id);
    }
    const entries = G.Shop.gridEntries(inv, e.cat);
    const total = Math.max(INV_CAP, Math.ceil(entries.length / INV_COLS) * INV_COLS);
    if (pressed('ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'Tab')) e.followCur = true;
    if (pressed('ArrowLeft', 'KeyA')) e.cur = e.cur % INV_COLS === 0 ? e.cur : e.cur - 1;
    if (pressed('ArrowRight', 'KeyD')) e.cur = e.cur % INV_COLS === INV_COLS - 1 || e.cur + 1 >= total ? e.cur : e.cur + 1;
    if (pressed('ArrowUp', 'KeyW')) e.cur = e.cur - INV_COLS >= 0 ? e.cur - INV_COLS : e.cur;
    if (pressed('ArrowDown', 'KeyS')) e.cur = e.cur + INV_COLS < total ? e.cur + INV_COLS : e.cur;
    if (pressed('KeyE', 'Enter', 'NumpadEnter', 'Space')) equipSelected();
    for (let n = 1; n <= 5; n++) if (pressed('Digit' + n, 'Numpad' + n)) assignHotbar(n - 1);
    clampEquipScroll(total);
    e.msgT = Math.max(0, (e.msgT || 0) - dt);
  }

  // 무기/방어구 탭에서 종류(검, 대검 ... / 갑옷, 투구 ...)를 고른다 (C 키 또는 종류 버튼)
  function setSub(id) {
    inv.invSub = id;
    equipUI.cur = 0;
    equipUI.scroll = 0;
    equipUI.followCur = true;
  }
  function cycleSub() {
    const subs = G.Shop.subList(inv, equipUI.cat);
    if (!subs.length) return;
    const k = (subs.findIndex((q) => q.id === (inv.invSub || 'all')) + 1) % subs.length;
    setSub(subs[k].id);
    equipUI.msg = `종류: ${subs[k].name}`;
    equipUI.msgT = 1.2;
    equipUI.ok = true;
  }

  // 정렬 방식을 바꾼다 (Q 또는 정렬 버튼). 고른 아이템은 그대로 가리킨다
  function cycleSort() {
    const e = equipUI;
    const cur = (G.Shop.gridEntries(inv, e.cat)[e.cur] || {}).id;
    const modes = G.Shop.SORTS;
    const k = (modes.findIndex((q) => q.id === (inv.invSort || 'default')) + 1) % modes.length;
    inv.invSort = modes[k].id;
    const idx = G.Shop.gridEntries(inv, e.cat).findIndex((en) => en.id === cur);
    e.cur = idx >= 0 ? idx : 0;
    e.followCur = true;
    e.msg = `정렬: ${modes[k].name}`;
    e.msgT = 1.4;
    e.ok = true;
    G.Audio.play('catch');
  }

  function setEquipCat(cat) {
    inv.invSub = 'all';
    equipUI.cat = cat;
    equipUI.cur = 0;
    equipUI.scroll = 0;
  }

  // 선택한 칸이 보이도록 스크롤을 맞춘다 (total = 전체 칸 수)
  function clampEquipScroll(total) {
    const e = equipUI;
    const rows = Math.ceil(total / INV_COLS);
    const curRow = Math.floor(e.cur / INV_COLS);
    if (e.followCur) {
      if (curRow < e.scroll) e.scroll = curRow;
      if (curRow >= e.scroll + INV_ROWS) e.scroll = curRow - INV_ROWS + 1;
    }
    e.scroll = Math.max(0, Math.min(Math.max(0, rows - INV_ROWS), e.scroll));
  }

  // 인벤토리에서 고른 무기를 1~5번 칸에 넣는다 (그 칸의 숫자 키로 바로 바꿔 든다)
  function assignHotbar(i) {
    const e = equipUI;
    const entry = G.Shop.gridEntries(inv, e.cat)[e.cur];
    const item = entry && G.Shop.ITEMS[entry.id];
    e.msgT = 1.6;
    if (!item || item.slot !== 'weapon') {
      e.msg = '무기를 고른 뒤 숫자 키를 누르세요.';
      e.ok = false;
      G.Audio.play('deny');
      return;
    }
    for (let k = 0; k < inv.hotbar.length; k++) if (inv.hotbar[k] === item.id) inv.hotbar[k] = null;
    inv.hotbar[i] = item.id;
    e.msg = `${item.name} -> ${i + 1}번 칸`;
    e.ok = true;
    G.Audio.play('catch');
  }

  // 인벤토리 창의 빠른 칸 클릭: 고른 무기가 있으면 그 칸에 넣고(이미 그 칸이면 비운다), 아니면 그 칸의 무기를 가리킨다
  function quickClick(i) {
    const e = equipUI;
    const entry = G.Shop.gridEntries(inv, e.cat)[e.cur];
    const item = entry && G.Shop.ITEMS[entry.id];
    if (item && item.slot === 'weapon') {
      if (inv.hotbar[i] === item.id) {
        inv.hotbar[i] = null;
        e.msg = `${i + 1}번 칸을 비웠다`;
        e.msgT = 1.4;
        e.ok = true;
        G.Audio.play('catch');
      } else assignHotbar(i);
    } else if (inv.hotbar[i]) {
      e.cat = 'all';
      e.cur = Math.max(0, G.Shop.gridEntries(inv, 'all').findIndex((en) => en.id === inv.hotbar[i]));
      e.followCur = true;
    } else {
      e.msg = '무기를 고른 뒤 이 칸을 누르세요.';
      e.msgT = 1.4;
      e.ok = false;
      G.Audio.play('deny');
    }
  }

  // 숫자 키 1~5: 그 칸의 무기로 바꿔 든다
  function switchWeapon(i) {
    const id = inv.hotbar[i];
    if (!id || !inv.items.includes(id)) return;
    if (inv.equipped.weapon === id) return;
    const blocked = duelBlocks(id);
    if (blocked) { say(blocked, 'rgba(255,170,170,A)'); G.Audio.play('deny'); return; }
    inv.equipped.weapon = id;
    applyEquipment();
    G.Audio.play('catch');
    popups.push({ x: player.x + player.w / 2, y: player.y - 18, text: `${G.Shop.ITEMS[id].name}`, t: 1, color: 'rgba(255,248,170,A)' });
  }

  // ---------- 개발 메뉴 (F1): 앞으로 모든 테스트 기능은 여기에 모은다 ----------
  let devUI = null; // {cur, scroll, msg, msgT, fresh}
  let settingsUI = null; // 설정 창 {cur}
  let god = false;  // 무적
  // 마을의 가게 앞으로 간다 (개발 메뉴의 순간이동)
  function goVillageShop(kind) {
    loadStage('village', true);
    const sh = terrain.shops.find((q) => q.kind === kind);
    if (sh) {
      player.placeAt(sh.col * C.TILE + C.TILE / 2 - player.w / 2 - 70, (sh.row + 1) * C.TILE - player.h);
      camera.follow(player, terrain, C.DT, true);
    }
  }
  // 마을/다크월드 입구의 가게 앞으로 간다 (stage = 'village' | 'darkhub')
  function goShop(stage, kind) {
    if (stage === 'darkhub') { story.revealed = true; story.pending = false; }
    loadStage(stage, true);
    const sh = terrain.shops.find((q) => q.kind === kind);
    if (sh) {
      player.placeAt(sh.col * C.TILE + C.TILE / 2 - player.w / 2 - 70, (sh.row + 1) * C.TILE - player.h);
      camera.follow(player, terrain, C.DT, true);
    }
  }

  // 개발 메뉴 항목. { head } 는 가로 탭 이름이다 (그 아래 항목들이 그 탭에 들어간다).
  // img = 지역 사진 파일 이름 (assets/regions/<img>.png). 사진이 있는 항목은 "이름 아래에 사진" 카드로 보인다
  function devItems() {
    const goto = (fn) => () => { cutscene = null; devUI = null; fn(); };
    const goFloor = (n) => { story.revealed = true; story.pending = false; darkFloor = Math.max(1, Math.min(C.DUNGEON_FLOORS, n)); loadStage('dungeon', true); };
    const give = (msg, fn) => () => { fn(); devUI.msg = msg; devUI.msgT = 2; G.Audio.play('pickup'); };
    const addC = (id, n) => { inv.consumables[id] = (inv.consumables[id] || 0) + n; };
    const addM = (id) => { inv.materials[id] = (inv.materials[id] || 0) + 1; };
    const giveItems = (filter) => {
      let n = 0;
      for (const it of Object.values(G.Shop.ITEMS)) {
        if (it.slot && filter(it) && !inv.items.includes(it.id)) { inv.items.push(it.id); n += 1; }
      }
      return n;
    };
    const shopGo = (stage, kind) => goto(() => goShop(stage, kind));
    return [
      { head: '지상' },
      { label: '해변', hint: '낯선 해변', img: 'beach', run: goto(() => loadStage('beach', true)) },
      { label: '마을', hint: '가게 · 문', img: 'village', run: goto(() => loadStage('village', true)) },
      { label: '마을 동굴', hint: '새로 생성', img: 'mine', run: goto(() => enterMine()) },
      { label: '광물 동굴', hint: '곡괭이로 광석 채굴', img: 'orecave', run: goto(() => loadStage('orecave', true)) },
      { label: '우리 집', hint: '꾸미기', img: 'home', run: goto(() => loadStage('home', true)) },
      { label: '숲', hint: '왕슬라임 · 샘물', img: 'forest', run: goto(() => loadStage('forest', true)) },
      { label: '설산', hint: '털복숭이 침팬지', img: 'snow', run: goto(() => loadStage('snow', true)) },
      { label: '화산', hint: '용 · 신성의 제단', img: 'volcano', run: goto(() => loadStage('volcano', true)) },
      { label: '시작 동굴', hint: '첫 동굴 (보물 지도)', img: 'cave', run: goto(() => loadStage('cave', true)) },
      { head: '다크월드' },
      { label: '다크월드 입구', hint: '상점들', img: 'darkhub', run: goto(() => { story.revealed = true; story.pending = false; loadStage('darkhub', true); }) },
      { label: '던전 1층', hint: '어둠의 탑', img: 'd1', run: goto(() => goFloor(1)) },
      { label: '던전 3층', hint: '이벤트 층 (3층마다)', img: 'd3', run: goto(() => goFloor(3)) },
      { label: '던전 10층', img: 'd10', run: goto(() => goFloor(10)) },
      { label: '33층 보스', hint: '정의의 어둠돌', img: 'd33', run: goto(() => goFloor(33)) },
      { label: '던전 50층', img: 'd50', run: goto(() => goFloor(50)) },
      { label: '66층 보스', hint: '정의의 어둠', img: 'd66', run: goto(() => goFloor(66)) },
      { label: '던전 90층', img: 'd90', run: goto(() => goFloor(90)) },
      { label: '100층 보스', hint: '시크너', img: 'd100', run: goto(() => goFloor(100)) },
      { label: '던전 위층 (+1)', hint: `지금 ${darkFloor}층`, img: 'd1', run: goto(() => goFloor(darkFloor + 1)) },
      { label: '던전 아래층 (-1)', hint: `지금 ${darkFloor}층`, img: 'd1', run: goto(() => goFloor(darkFloor - 1)) },
      { head: '마을 가게' },
      { label: '대장간', hint: '무기 · 곡괭이', img: 'shop_sword', run: shopGo('village', 'sword') },
      { label: '용광로', hint: '합치기 · 제련 · 부착 · 신성', img: 'shop_furnace', run: shopGo('village', 'furnace') },
      { label: '특수 무기 상점', hint: '창 · 도끼 · 망치 …', img: 'shop_weapon2', run: shopGo('village', 'weapon2') },
      { label: '갑옷 가게', img: 'shop_armor', run: shopGo('village', 'armor') },
      { label: '바지 가게', img: 'shop_pants', run: shopGo('village', 'pants') },
      { label: '물약 상점', img: 'shop_potion', run: shopGo('village', 'potion') },
      { label: '동굴 보상 상점', hint: '업그레이드', img: 'shop_mine', run: shopGo('village', 'mine') },
      { label: '부동산', img: 'shop_estate', run: shopGo('village', 'estate') },
      { label: '인테리어 가게', img: 'shop_decor', run: shopGo('village', 'decor') },
      { label: '다크 무기 상점', hint: '폭탄 · 총 · 활', img: 'shop_dweapon', run: shopGo('darkhub', 'dweapon') },
      { label: '다크 갑옷 가게', img: 'shop_darmor', run: shopGo('darkhub', 'darmor') },
      { label: '다크 아이템 상점', img: 'shop_ditem', run: shopGo('darkhub', 'ditem') },
      { label: '강화소 (EXP)', img: 'shop_dupgrade', run: shopGo('darkhub', 'dupgrade') },
      { head: '놀이마당' },
      { label: '야바위', hint: '마을 왼쪽', img: 'mg_shell', run: shopGo('village', 'mgshell') },
      { label: '맞추기', hint: '숲 문 옆', img: 'mg_target', run: shopGo('village', 'mgtarget') },
      { label: '다른 용사와 결투', hint: '마을 오른쪽', img: 'mg_duel', run: shopGo('village', 'mgduel') },
      { label: '총게임', hint: '마을 맨 오른쪽', img: 'mg_gun', run: shopGo('village', 'mggun') },
      { head: '자원' },
      { label: '코인 +1,000', run: give('코인 +1,000', () => { coins += 1000; }) },
      { label: '코인 +10,000', run: give('코인 +10,000', () => { coins += 10000; }) },
      { label: '코인 +100,000', run: give('코인 +100,000', () => { coins += 100000; }) },
      { label: '경험치 +1,000', run: give('경험치 +1,000', () => { exp += 1000; }) },
      { label: '경험치 +10,000', run: give('경험치 +10,000', () => { exp += 10000; }) },
      { label: '피 가득 채우기', run: give('피를 가득 채웠다', () => { lives = maxLives(); }) },
      { label: '스태미나 가득 채우기', run: give('스태미나를 가득 채웠다', () => { stamina = stMax(); }) },
      { head: '소모품·재료' },
      { label: '회복 물약 5개씩', hint: '작은 + 큰', run: give('물약 5개씩', () => { inv.potions.potion1 += 5; inv.potions.potion2 += 5; }) },
      { label: '스태미나 물약 5개씩', hint: '30% + 70%', run: give('스태미나 물약 5개씩', () => { addC('st30', 5); addC('st70', 5); }) },
      { label: '얼음 폭탄 5개', run: give('얼음 폭탄 5개', () => addC('icebomb', 5)) },
      { label: '어둠의 크리스탈 +1', run: give('어둠의 크리스탈 +1', () => addM('darkcrystal')) },
      { label: '정화된 크리스탈 +1', run: give('정화된 크리스탈 +1', () => addM('cleancrystal')) },
      { label: '신성 크리스탈 +1', run: give('신성 크리스탈 +1', () => addM('holycrystal')) },
      { head: '장비' },
      { label: '모든 무기 받기', hint: '합성 무기 제외', run: give('모든 무기를 받았다', () => { const n = giveItems((it) => it.slot === 'weapon' && !it.tier); devUI.msg = `무기 ${n}개를 받았다`; }) },
      { label: '합성 무기 모두 받기', hint: '강화된 · 최강의', run: give('합성 무기를 받았다', () => { const n = giveItems((it) => it.slot === 'weapon' && !!it.tier); devUI.msg = `합성 무기 ${n}개를 받았다`; }) },
      { label: '모든 방어구 받기', hint: '갑옷 · 투구 · 장갑 · 바지 · 신발', run: give('모든 방어구를 받았다', () => { const n = giveItems((it) => it.slot !== 'weapon' && !it.tier); devUI.msg = `방어구 ${n}개를 받았다`; }) },
      { label: '방어구 최고 장착', hint: '가진 것 중 제일 좋은 것으로', run: give('방어구를 최고로 맞췄다', () => { const c = equipBestCore(); devUI.msg = c.length ? `${c.length}곳을 바꿨다` : '이미 가장 좋은 옷차림'; }) },
      { label: '기본 검 3자루 받기', hint: '합치기 연습', run: give('기본 검 3자루', () => { G.Forge.addCopy(inv, 'sword0', 3); }) },
      { label: '시작 장비로 되돌리기', hint: '목검 + 허름한 옷', run: give('시작 장비로 되돌렸다', () => { const f = G.Shop.newInventory(); inv.items = f.items; inv.copies = f.copies; inv.attach = f.attach; inv.hotbar = f.hotbar; inv.equipped = f.equipped; inv.wlevel = {}; inv.holy = {}; G.Forge.markDirty(); applyEquipment(); }) },
      { head: '광물' },
      { label: '곡괭이 4종 받기', hint: '나무 · 철 · 강철 · 미스릴', run: give('곡괭이를 모두 받았다', () => { for (const p of G.Forge.PICKS) if (!inv.items.includes(p.id)) inv.items.push(p.id); inv.equipped.pick = G.Forge.bestOwnedPick(inv); G.Forge.markDirty(); }) },
      { label: '검용 광석 +6씩', hint: '철 구리 은 금 …', run: give('검용 광석 +6', () => { for (const o of G.Forge.ORES) if (o.cls === 'sword') inv.ores[o.id] = (inv.ores[o.id] || 0) + 6; G.Forge.markDirty(); }) },
      { label: '총용 광석 +6씩', hint: '초석 납 황철석 …', run: give('총용 광석 +6', () => { for (const o of G.Forge.ORES) if (o.cls === 'gun') inv.ores[o.id] = (inv.ores[o.id] || 0) + 6; G.Forge.markDirty(); }) },
      { label: '갑옷용 광석 +6씩', hint: '철갑석 수호석 용린석 …', run: give('갑옷용 광석 +6', () => { for (const o of G.Forge.ORES) if (o.cls === 'armor') inv.ores[o.id] = (inv.ores[o.id] || 0) + 6; G.Forge.markDirty(); }) },
      { label: '모든 주괴 +2씩', hint: '제련 없이 바로', run: give('주괴 +2', () => { for (const o of G.Forge.ORES) inv.ingots[o.id] = (inv.ingots[o.id] || 0) + 2; G.Forge.markDirty(); }) },
      { head: '설정' },
      { label: `무적 ${god ? '끄기' : '켜기'}`, hint: god ? '지금 켜짐' : '지금 꺼짐', run: () => { god = !god; devUI.msg = god ? '무적 켜짐' : '무적 꺼짐'; devUI.msgT = 2; G.Audio.play('pickup'); } },
      { label: '시크너 이야기 건너뛰기', hint: '다크월드 열기', run: give('다크월드가 열렸다', () => { story.revealed = true; story.pending = false; }) },
      { label: '오프닝 컷신 다시 보기', hint: '보물 지도', run: goto(() => { loadStage('cave', true); cutscene = new G.Cutscene(terrain, player); }) },
    ];
  }

  // 개발 메뉴를 { head } 기준으로 가로 탭들로 나눈다: [{ name, items }]
  function devTabs() {
    const tabs = [];
    for (const it of devItems()) {
      if (it.head) tabs.push({ name: it.head, items: [] });
      else tabs[tabs.length - 1].items.push(it);
    }
    return tabs;
  }
  // 지금 탭의 항목, 사진 카드 여부, 칸 배치
  function devLayout() {
    const tabs = devTabs();
    const d = devUI;
    d.tab = Math.max(0, Math.min(tabs.length - 1, d.tab || 0));
    const items = tabs[d.tab].items;
    const photo = items.some((q) => q.img);
    const geo = G.Renderer.devGeometry(C.VIEW_W, C.VIEW_H, tabs.length, items.length, photo, d.scroll);
    return { tabs, items, photo, geo };
  }
  const devSetTab = (t) => { devUI.tab = t; devUI.cur = 0; devUI.scroll = 0; G.Audio.play('catch'); };

  function updateDev(dt) {
    const d = devUI;
    const pressed = (...codes) => codes.some((c) => input.wasPressed(c));
    const fresh = d.fresh;
    d.fresh = false;
    if (pressed('Escape') || (!fresh && pressed('F1'))) {
      devUI = null;
      return;
    }
    let L = devLayout();
    const nTabs = L.tabs.length;
    // 가로 탭: Tab / Shift+Tab, PageUp / PageDown (방향키는 칸 이동에 쓴다)
    if (pressed('Tab')) devSetTab((d.tab + (input.down.has('ShiftLeft') || input.down.has('ShiftRight') ? nTabs - 1 : 1)) % nTabs);
    if (pressed('PageDown')) devSetTab((d.tab + 1) % nTabs);
    if (pressed('PageUp')) devSetTab((d.tab + nTabs - 1) % nTabs);
    L = devLayout();
    const n = L.items.length;
    const cols = L.geo.cols;
    if (pressed('ArrowRight', 'KeyD')) d.cur = Math.min(n - 1, d.cur + 1);
    if (pressed('ArrowLeft', 'KeyA')) d.cur = Math.max(0, d.cur - 1);
    if (pressed('ArrowDown', 'KeyS')) d.cur = Math.min(n - 1, d.cur + cols);
    if (pressed('ArrowUp', 'KeyW')) d.cur = Math.max(0, d.cur - cols);
    if (pressed('Enter', 'NumpadEnter', 'KeyE', 'Space')) {
      const it = L.items[d.cur];
      if (it && it.run) it.run();
      if (!devUI) return;
    }
    // 고른 칸이 보이도록 스크롤 (줄 단위)
    const row = Math.floor(d.cur / cols);
    const vis = L.geo.rowsVisible;
    if (row < d.scroll) d.scroll = row;
    if (row >= d.scroll + vis) d.scroll = row - vis + 1;
    d.scroll = Math.max(0, Math.min(Math.max(0, L.geo.totalRows - vis), d.scroll));
    d.msgT = Math.max(0, d.msgT - dt);
  }

  // 마우스 좌표를 게임 화면 좌표로 (캔버스가 화면 크기에 맞춰 늘어나 있어도 맞게)
  function canvasPoint(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (C.VIEW_W / r.width), y: (ev.clientY - r.top) * (C.VIEW_H / r.height) };
  }
  const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

  // 인벤토리: 무기를 끌어다 빠른 칸(1~5)에 놓는다. 빠른 칸끼리 끌면 자리가 바뀌고, 칸 밖으로 끌어내면 비워진다
  let suppressClick = false; // 끌기가 끝난 직후의 클릭은 무시
  canvas.addEventListener('mousedown', (ev) => {
    suppressClick = false; // 새로 누르면 남아 있던 '클릭 무시'를 푼다
    if (!equipUI || ev.button !== 0) return;
    const p = canvasPoint(ev);
    const geo = G.Renderer.equipGeometry(C.VIEW_W, C.VIEW_H);
    let d = null;
    const ci = geo.cells.findIndex((c) => inRect(p, c));
    if (ci >= 0) {
      const en = G.Shop.gridEntries(inv, equipUI.cat)[ci + equipUI.scroll * INV_COLS];
      if (en && G.Shop.ITEMS[en.id].slot === 'weapon') d = { src: 'grid', id: en.id };
    }
    const qi = geo.quick.findIndex((r) => inRect(p, r));
    if (qi >= 0 && inv.hotbar[qi]) d = { src: 'quick', idx: qi, id: inv.hotbar[qi] };
    equipUI.drag = d ? Object.assign(d, { sx: p.x, sy: p.y, x: p.x, y: p.y, active: false }) : null;
  });
  window.addEventListener('mouseup', (ev) => {
    if (!equipUI || !equipUI.drag) return;
    const d = equipUI.drag;
    equipUI.drag = null;
    if (!d.active) return; // 그냥 클릭이었다
    suppressClick = true;
    const p = canvasPoint(ev);
    const geo = G.Renderer.equipGeometry(C.VIEW_W, C.VIEW_H);
    const qi = geo.quick.findIndex((r) => inRect(p, r));
    const name = G.Shop.ITEMS[d.id].name;
    equipUI.msgT = 1.6;
    equipUI.ok = true;
    if (qi >= 0) {
      if (d.src === 'grid') {
        for (let k = 0; k < inv.hotbar.length; k++) if (inv.hotbar[k] === d.id) inv.hotbar[k] = null;
        inv.hotbar[qi] = d.id;
        equipUI.msg = `${name} -> ${qi + 1}번 칸`;
      } else {
        const other = inv.hotbar[qi];
        inv.hotbar[qi] = d.id;
        inv.hotbar[d.idx] = other;
        equipUI.msg = qi === d.idx ? `${name}: ${qi + 1}번 칸` : `${d.idx + 1}번 ↔ ${qi + 1}번 칸을 바꿨다`;
      }
      G.Audio.play('catch');
    } else if (d.src === 'quick') {
      inv.hotbar[d.idx] = null;
      equipUI.msg = `${d.idx + 1}번 칸을 비웠다`;
      G.Audio.play('catch');
    } else {
      equipUI.msgT = 0;
    }
  });
  canvas.addEventListener('mousedown', () => { if (sg && !sg.result) sg.mouse = true; if (ag && ag.mode === 'fill' && !ag.result) ag.mouse = true; }); // 제련: 누르는 동안 풀무질 / 폭탄 화약 채우기
  window.addEventListener('mouseup', () => { if (sg) sg.mouse = false; if (ag) ag.mouse = false; });
  canvas.addEventListener('mousemove', (ev) => {
    const p = canvasPoint(ev);
    if (fp) { // 대상 고르기: 올려 놓으면 선택
      const g = G.Renderer.forgePickGeometry(C.VIEW_W, C.VIEW_H);
      if (fp.step === 'cat') { const i = g.cats.findIndex((r) => inRect(p, r)); if (i >= 0) fp.cur = i; }
      else { const k = g.cells.findIndex((r) => inRect(p, r)); const idx = (fp.scroll || 0) * FP_COLS + k; if (k >= 0 && idx < fp.list.length) fp.cur = idx; }
    }
    if (mini) { mini.mouse = p; mini.useMouse = true; } // 놀이마당: 마우스로 조준/선택
    if (equipUI && equipUI.drag) {
      const d = equipUI.drag;
      d.x = p.x;
      d.y = p.y;
      if (!d.active && Math.hypot(p.x - d.sx, p.y - d.sy) > 8) d.active = true;
    }
    if (devUI) { // 칸 위에 올리면 선택
      const L = devLayout();
      const c = L.geo.cells.find((q) => inRect(p, q));
      if (c) devUI.cur = c.idx;
    } else if (equipUI) { // 칸 위에 올리면 선택
      const i = G.Renderer.equipGeometry(C.VIEW_W, C.VIEW_H).cells.findIndex((c) => inRect(p, c));
      if (i >= 0) { equipUI.cur = i + equipUI.scroll * INV_COLS; equipUI.followCur = false; }
    } else if (shop) { // 물품 줄 위에 올리면 강조
      shop.hover = G.Renderer.shopGeometry(C.VIEW_W, C.VIEW_H, shop.def, shop.tab, shop.page || 0).rows.findIndex((r) => inRect(p, r));
    }
  });
  canvas.addEventListener('wheel', (ev) => { // 휠: 인벤토리/개발 메뉴 스크롤
    if (fp && fp.step === 'item') { ev.preventDefault(); fpMove(ev.deltaY > 0 ? FP_COLS : -FP_COLS); return; }
    if (devUI) {
      ev.preventDefault();
      const L = devLayout();
      devUI.scroll = Math.max(0, Math.min(Math.max(0, L.geo.totalRows - L.geo.rowsVisible), devUI.scroll + (ev.deltaY > 0 ? 1 : -1)));
    } else if (shop && shopPages() > 1) {
      ev.preventDefault();
      shopPage(ev.deltaY > 0 ? 1 : -1);
    } else if (equipUI) {
      ev.preventDefault();
      const entries = G.Shop.gridEntries(inv, equipUI.cat);
      const total = Math.max(INV_CAP, Math.ceil(entries.length / INV_COLS) * INV_COLS);
      equipUI.followCur = false;
      equipUI.scroll += ev.deltaY > 0 ? 1 : -1;
      clampEquipScroll(total);
    }
  }, { passive: false });
  canvas.addEventListener('click', (ev) => {
    if (suppressClick) { suppressClick = false; return; }
    const p = canvasPoint(ev);
    if (fp) { // 대상 고르기: 종류 버튼 / 종류 필터 / 네모 칸 / 뒤로
      const g = G.Renderer.forgePickGeometry(C.VIEW_W, C.VIEW_H);
      if (fp.step === 'cat') {
        const i = g.cats.findIndex((r) => inRect(p, r));
        if (i >= 0) { fp.cur = i; fpChoose(i); } else if (inRect(p, g.close)) fp = null;
      } else {
        if (inRect(p, g.back)) { fp.step = 'cat'; fp.cur = FP_CATS.findIndex((c) => c.id === fp.cat); return; }
        const chips = fpChips();
        const ci = chips.findIndex((c, i) => inRect(p, g.chip(i, chips.length)));
        if (ci >= 0) { fpSetSub(chips[ci].id); return; }
        const k = g.cells.findIndex((r) => inRect(p, r));
        const idx = (fp.scroll || 0) * FP_COLS + k;
        if (k >= 0 && idx < fp.list.length) fpPick(fp.list[idx]);
      }
      return;
    }
    if (wc) { // 작업 선택: 버튼 클릭
      const g = G.Renderer.workChoiceGeometry(C.VIEW_W, C.VIEW_H);
      if (inRect(p, g.self)) workChoiceDo(1);
      else if (inRect(p, g.smith)) workChoiceDo(2);
      else if (inRect(p, g.cancel)) wc = null;
      return;
    }
    if (ag) { ag.click = true; return; } // 부착 미니게임: 클릭 = 망치질
    if (sg) { if (sg.result) sg.click = true; return; } // 제련 미니게임: 결과 닫기 (풀무질은 마우스를 누르고 있는 동안)
    if (mini) { mini.click = p; mini.mouse = p; mini.useMouse = true; return; }
    if (settingsUI) { // 설정 창: 줄 클릭 = 토글, 음량 막대 클릭 = 그 위치로
      const L = G.Renderer.settingsRows(C.VIEW_W, C.VIEW_H);
      const i = L.rows.findIndex((r) => inRect(p, r));
      if (i < 0) return;
      settingsUI.cur = i;
      if (i === 0) { if (p.x >= L.bar.x - 6 && p.x <= L.bar.x + L.bar.w + 6) { G.Audio.setMusicVolume(Math.round(((p.x - L.bar.x) / L.bar.w) * 20) / 20); G.Settings.save(); G.Audio.play('catch'); } }
      else changeSetting(i, 0);
      return;
    }
    if (devUI) { // 탭 클릭 = 분류 전환, 칸 클릭 = 실행
      const L = devLayout();
      const t = L.geo.tabs.findIndex((r) => inRect(p, r));
      if (t >= 0) { devSetTab(t); return; }
      const c = L.geo.cells.find((q) => inRect(p, q));
      if (c && L.items[c.idx].run) { devUI.cur = c.idx; L.items[c.idx].run(); }
    } else if (equipUI) { // 탭 클릭 = 분류, 칸 클릭 = 장착. 왼쪽 장착 슬롯 클릭 = 그 아이템이 있는 칸을 가리킴
      const geo = G.Renderer.equipGeometry(C.VIEW_W, C.VIEW_H);
      if (inRect(p, geo.sort)) { cycleSort(); return; }
      if (inRect(p, geo.best)) { equipBest(); return; }
      const subs = G.Shop.subList(inv, equipUI.cat);
      const si = subs.findIndex((sb, i) => inRect(p, geo.chip(i, subs.length)));
      if (si >= 0) { setSub(subs[si].id); return; }
      const q = geo.quick.findIndex((r) => inRect(p, r));
      if (q >= 0) { quickClick(q); return; }
      const t = geo.tabs.findIndex((r) => inRect(p, r));
      if (t >= 0) { setEquipCat(G.Shop.CATEGORIES[t].id); return; }
      const i = geo.cells.findIndex((c) => inRect(p, c));
      if (i >= 0) {
        equipUI.cur = i + equipUI.scroll * INV_COLS;
        equipSelected();
        return;
      }
      for (const slot of Object.keys(geo.slots)) {
        if (inRect(p, geo.slots[slot]) && inv.equipped[slot]) {
          const idx = G.Shop.gridEntries(inv, equipUI.cat).findIndex((en) => en.id === inv.equipped[slot]);
          if (idx >= 0) { equipUI.cur = idx; equipUI.followCur = true; }
        }
      }
    } else if (shop) { // 탭 클릭 = 전환, 물품 줄 클릭 = 구매
      const geo = G.Renderer.shopGeometry(C.VIEW_W, C.VIEW_H, shop.def, shop.tab, shop.page || 0);
      const t = geo.tabs.findIndex((r) => inRect(p, r));
      if (t >= 0) {
        shop.tab = t;
        shop.page = 0;
        shop.hover = -1;
        return;
      }
      if (isMergeTab()) { // 합치기 작업대: 무기 줄 선택, 버튼 누르기
        const mv = mergeView();
        const mg = G.Renderer.mergeGeometry(geo.panel, mv.sel, mv.cands.length);
        const r = mg.rows.find((q) => inRect(p, q));
        if (r) { shop.msel = r.idx; G.Audio.play('catch'); return; }
        if (!mv.job && inRect(p, mg.self)) mergeDo('self');
        else if (!mv.job && inRect(p, mg.smith)) mergeDo('smith');
        else if (mv.job && mv.job.done && inRect(p, mg.collect)) mergeDo('collect');
        return;
      }
      if (geo.pager && inRect(p, geo.pager.prev)) { shopPage(-1); return; }
      if (geo.pager && inRect(p, geo.pager.next)) { shopPage(1); return; }
      const row = geo.rows.findIndex((r) => inRect(p, r));
      if (row >= 0) buyItem(shopItems()[row]);
    }
  });

  // 패링 판정 범위: 플레이어 몸을 지금 검의 패링 범위(타일)만큼 키운 사각형
  function parryBox(p) {
    const r = equipStats.reachTiles * C.TILE;
    return { x: p.x - r, y: p.y - r, w: p.w + r * 2, h: p.h + r * 2 };
  }

  // 패링/던진 검이 몬스터를 맞힘. 슬라임·꽃게(twoHit)는 첫 타에 2칸 밀려나 기절하고,
  // 기절 중 다시 맞으면 날아가 터진다. 박쥐는 한 번에 날아간다
  const killsInOne = () => !!G.Shop.ITEMS[inv.equipped.weapon].oneHit; // 대검/전설의 검: 두 번 맞는 몬스터도 한 방에 처치한다
  // 치명타: 집에 놓은 장식품이 많을수록 확률이 오른다. 터지면 치명타 대미지(10~30)를 준다
  // 치명타가 터진 느낌: 금빛 폭발, 큰 흔들림, 잠깐 멈춤, 묵직한 소리
  function critFx(x, y) {
    effects.critBurst(x, y);
    effects.shake(11, 0.3);
    hitStop = Math.max(hitStop, 0.12);
    G.Audio.play('crit');
  }
  const critChance = () => G.Shop.homeBonuses(inv).crit;
  const rollCrit = () => Math.random() < critChance();
  // 낫: 몬스터를 맞힐 때마다 그 몬스터의 체력 ¼칸(반의 반)을 빼앗아 온다
  function reapSteal(s) {
    if (G.Shop.ITEMS[inv.equipped.weapon].elem !== 'reap' || s.noExp || lives >= maxLives()) return;
    lives = Math.min(maxLives(), lives + 0.25);
    popups.push({ x: s.x + s.w / 2, y: s.y - 8, text: '+¼', t: 0.9, color: 'rgba(255,140,170,A)' });
  }
  function hitMonster(s, fromX, fallbackDir) {
    reapSteal(s);
    const away = Math.sign(s.x + s.w / 2 - fromX) || fallbackDir;
    if (s.extraHits > 0 && !s.flying && !equipStats.ignoreCrack && !rollCrit()) { // 다크월드의 단단한 몬스터: 여러 번 때려야 쓰러진다
      s.extraHits = Math.max(0, s.extraHits - equipStats.hitPower); // 무기를 강화할수록 단단한 몬스터를 더 많이 깎는다
      s.hitGrace = C.HIT_GRACE;
      if (s.hurt) s.hurt(away);
      effects.parryHit(s.x + s.w / 2, s.y + s.h / 2);
      popups.push({ x: s.x + s.w / 2, y: s.y - 20, text: s.extraHits > 0 ? `단단하다! (${s.extraHits})` : '금이 갔다!', t: 0.9, color: 'rgba(200,170,255,A)' });
      return;
    }
    if (rollCrit()) { // 치명타: 일반 몬스터는 한 방에 쓰러진다
      const dmg = G.Shop.critDamage(inv);
      s.damage(dmg);
      popups.push({ x: s.x + s.w / 2, y: s.y - 34, text: `치명타! ${dmg}`, t: 1.4, color: 'rgba(255,225,80,A)' });
      critFx(s.x + s.w / 2, s.y + s.h / 2);
      weaponElementHit(s, away, fromX);
      return;
    }
    if (s.golden) { // 황금박쥐: 한 방에 안 죽는다. 한 대마다 체력 1이 깎이고 움찔할 뿐이라 5대를 때려야 죽는다
      s.damage(1);
      if (s.alive) s.hurt(away);
    } else if (s.twoHit && !s.staggered && !killsInOne()) s.stagger(away);
    else s.knockback(away);
    weaponElementHit(s, away, fromX);
  }

  // 근접 무기의 원소 효과: 맞힌 몬스터(s) 주변에서 일어나는 일 (이름에 담긴 특징)
  let cleaving = false; // 관통(강철 단검)이 다시 관통을 부르지 않게
  function weaponElementHit(s, away, fromX) {
    const w = G.Shop.ITEMS[inv.equipped.weapon];
    const list = [];
    if (w.elem) list.push(w.elem);
    for (const e of equipStats.elems || []) if (!list.includes(e)) list.push(e); // 붙인 원소 광석의 속성도 같이 적용된다
    for (const el of list) {
      const lv = (w.elem === el ? 1 : 0) + ((equipStats.elemLv && equipStats.elemLv[el]) || 0); // 무기 자체 속성 + 붙인 같은 속성 광석 수
      weaponElementOne(el, w, s, away, fromX, 1 + 0.35 * Math.max(0, lv - 1));
    }
  }
  function weaponElementOne(el, w, s, away, fromX, f = 1) {
    const T = C.TILE;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const near = (r) => monsters.filter((m) => m !== s && m.alive && !m.flying && m.appear <= 0 && Math.hypot(m.x + m.w / 2 - cx, m.y + m.h / 2 - cy) <= r);
    const dirFrom = (m) => Math.sign(m.x + m.w / 2 - cx) || away;
    if (s.immune && ((el === 'fire' && s.immune.fire) || (el === 'ice' && s.immune.ice))) popups.push({ x: s.x + s.w / 2, y: s.y - 20, text: el === 'fire' ? '불에 타지 않는다!' : '얼지 않는다!', t: 0.9, color: 'rgba(200,200,220,A)' });
    if (el === 'poison') { // 독: 맞은 몬스터와 주변이 중독된다
      s.applyPoison();
      for (const m of near(T * 1.3 * f)) m.applyPoison();
      effects.sparkle(cx, cy);
    } else if (el === 'fire') { // 불타며 죽는다. 불이 주변으로 옮겨붙는다
      s.applyBurn();
      for (const m of near(T * 1.5 * f)) m.applyBurn();
      effects.fireBurst(cx, cy);
    } else if (el === 'ice') { // 얼어붙은 채 날아가 부서진다. 주변도 얼어붙는다
      if (s.flying) {
        if (!(s.immune && s.immune.ice)) { s.frozen = true; s.deathStyle = 'ice'; }
      } else {
        s.freeze();
      }
      for (const m of near(T * 1.5 * f)) m.freeze();
      effects.crystalShards(cx, cy);
    } else if (el === 'crystal') { // 수정 파편이 주변 몬스터에게 피해
      for (const m of near(T * 1.5)) {
        m.damage(1);
        effects.crystalShards(m.x + m.w / 2, m.y + m.h / 2);
      }
      effects.crystalShards(cx, cy);
    } else if (el === 'light') { // 빛이 퍼져 주변을 기절시킨다 (박쥐는 기절하지 않으니 피해 1)
      const r = (w.lightRadius || 3) * T * f;
      for (const m of near(r)) {
        if (m.twoHit && !m.staggered) m.stagger(dirFrom(m));
        else m.damage(1);
      }
      effects.lightBurst(cx, cy, r);
    } else if (el === 'quake') { // 내리친 충격이 땅을 타고 퍼져 주변을 기절시킨다
      for (const m of near(T * 2.5 * f)) if (m.onGround && m.twoHit && !m.staggered) m.stagger(dirFrom(m));
      effects.quakeDust(cx, s.y + s.h, T * 2.5 * f);
    } else if (el === 'thief') { // 맞힐 때마다 코인을 훔친다
      coins += 1;
      popups.push({ x: cx, y: s.y - 14, text: '+1 G', t: 1, color: 'rgba(255,213,74,A)' });
      G.Audio.play('coin');
    } else if (el === 'cleave' && !cleaving) { // 같은 방향의 앞쪽 몬스터까지 함께 벤다
      cleaving = true;
      for (const m of near(T * 1.6)) if (dirFrom(m) === away && Math.abs(m.y + m.h / 2 - cy) < T) hitMonster(m, fromX, away);
      cleaving = false;
    } else if (el === 'shadow') { // 그림자처럼 사라져 잠시 공격을 받지 않는다
      player.invuln = Math.max(player.invuln, 0.6);
      player.shadowTime = 0.6;
    }
  }

  // 지팡이 마법이 몬스터에 닿았을 때의 효과
  const magicHooks = {
    hit(m, el, dir, x, y, shot) {
      if (el === 'bomb' || el === 'icebomb') return; // 폭탄은 터질 때 피해를 준다 (explode)
      const isBossHit = bossOn() && boss.targets().includes(m);
      const weakX = (e) => (isBossHit && boss.weak && e === boss.weak ? 3 : 1); // 보스의 약점 속성이면 x3
      if (el === 'arrow' || el === 'bullet') {
        m.damage((shot && shot.dmg ? shot.dmg : 3) * weakX(weaponElemOf()));
        if (m.alive && m.twoHit && !m.staggered && m.stagger) m.stagger(dir);
        effects.parryHit(x, y);
        effects.shake(3, 0.1);
        return;
      }
      if (el === 'fire') {
        m.damage(C.FIRE_DAMAGE * weakX('fire'));
      } else if (el === 'poison') {
        m.applyPoison();
      } else { // 번개: 피해 + 기절(두 번 맞는 몬스터는 밀려나고 멍해진다)
        m.damage(C.LIGHTNING_DAMAGE * weakX('light'));
        if (m.alive && m.twoHit && !m.staggered) m.stagger(dir);
      }
      effects.parryHit(x, y);
      effects.shake(3, 0.1);
    },
    burst(el, x, y) {
      effects.parryHit(x, y);
    },
    // 폭탄이 터진다: 반경 안의 몬스터/보스에게 피해 (얼음 폭탄은 얼린다)
    explode(s) {
      const rad = (s.radius || C.TILE * 3) * (s.radius ? 1 : 1);
      const ice = s.el === 'icebomb';
      if (ice) effects.iceShatter(s.x, s.y); else effects.fireBurst(s.x, s.y);
      effects.shake(9, 0.3);
      G.Audio.play(ice ? 'shatter' : 'boom');
      for (const mo of magicTargets()) {
        if (!mo.alive || mo.flying || mo.appear > 0) continue;
        const cx = mo.x + mo.w / 2;
        const cy = mo.y + mo.h / 2;
        if (Math.hypot(cx - s.x, cy - s.y) > rad + Math.max(mo.w, mo.h) / 2) continue;
        if (ice) { if (mo.freeze) mo.freeze(); mo.damage(2); } else mo.damage(s.dmg);
      }
    },
  };

  // 얼음 폭탄 던지기 (B 키): 앞으로 포물선으로 날아가 터지며 주변을 얼린다
  function throwIceBomb() {
    if (!(inv.consumables.icebomb > 0)) {
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '얼음 폭탄이 없어요', t: 1, color: 'rgba(255,170,170,A)' });
      G.Audio.play('deny');
      return;
    }
    inv.consumables.icebomb -= 1;
    const h = player.hand;
    G.Magic.cast(magic, 'icebomb', h.x + player.facing * 14, h.y - 4, player.facing, terrain, magicTargets(), magicHooks, { dmg: 2, radius: C.TILE * 3 });
    G.Audio.play('throw');
  }

  // 소모품 하나를 쓴다 (스태미나 회복 / 음식으로 피 회복). 결과 { ok, msg }
  function useConsumable(id) {
    const it = G.Shop.ITEMS[id];
    if (!(inv.consumables[id] > 0)) return { ok: false, msg: '없어요.' };
    if (it.bomb) return { ok: false, msg: 'B 키로 던져서 쓰는 폭탄이에요.' };
    const needLife = it.food && lives < maxLives();
    const needSt = it.stamina && stamina < stMax();
    if (!needLife && !needSt) return { ok: false, msg: it.food && it.stamina ? '피도 스태미나도 가득이에요.' : it.food ? '피가 가득 차 있어요.' : '스태미나가 가득 차 있어요.' };
    inv.consumables[id] -= 1;
    const parts = [];
    if (needLife) { const before = lives; lives = Math.min(maxLives(), lives + it.food); parts.push(`피 +${lives - before}`); }
    if (needSt) { const before = stamina; stamina = Math.min(stMax(), stamina + it.stamina); parts.push(`스태미나 +${Math.round(stamina - before)}`); }
    G.Audio.play('pickup');
    return { ok: true, msg: `${it.name}: ${parts.join(', ')}` };
  }

  // V 키: 지금 가장 필요한 것을 먹는다 (스태미나가 모자라면 스태미나 물약, 피가 모자라면 음식)
  function eatBest() {
    const has = (id) => inv.consumables[id] > 0;
    const lowSt = stamina < stMax() - 25;
    const order = lowSt ? ['st30', 'st70'] : ['st30', 'st70']; // 스태미나 물약 (작은 것부터)
    for (const id of order) {
      if (!has(id)) continue;
      const r = useConsumable(id);
      if (r.ok) { popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: r.msg, t: 1.4, color: 'rgba(125,255,160,A)' }); return; }
    }
    popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '먹을 것이 없어요', t: 1, color: 'rgba(255,170,170,A)' });
    G.Audio.play('deny');
  }

  // 몬스터가 쏜 어둠 구슬: 날아가다 플레이어에게 닿으면 피해. 패링 범위에 들어오면 되튕겨 몬스터를 맞힌다
  function updateEnemyShots(dt) {
    for (let k = enemyShots.length - 1; k >= 0; k--) {
      const f = enemyShots[k];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life = (f.life === undefined ? 5 : f.life) - dt;
      const dead = () => { enemyShots.splice(k, 1); };
      if (f.life <= 0 || terrain.isSolid(Math.floor(f.x / C.TILE), Math.floor(f.y / C.TILE))) { effects.parryHit(f.x, f.y); dead(); continue; }
      if (f.reflected) { // 되튕긴 구슬은 몬스터를 맞힌다
        const hit = monsters.find((mo) => mo.alive && !mo.flying && mo.appear <= 0 && Math.abs(f.x - (mo.x + mo.w / 2)) < mo.w / 2 + 10 && Math.abs(f.y - (mo.y + mo.h / 2)) < mo.h / 2 + 10);
        if (hit) { hit.damage(3); effects.parryHit(f.x, f.y); G.Audio.play('parry'); dead(); }
        continue;
      }
      const box = parryBox(player);
      if (player.parrying && f.x > box.x - 8 && f.x < box.x + box.w + 8 && f.y > box.y - 8 && f.y < box.y + box.h + 8) { // 쳐냈다
        f.reflected = true;
        f.vx = -f.vx * 1.5;
        f.vy = -f.vy * 1.5;
        f.life = 3;
        player.parrySucceeded();
        G.Audio.play('parry');
        effects.parryHit(f.x, f.y);
        hitStop = C.HIT_STOP;
        continue;
      }
      if (player.invuln === 0 && !player.dashing && Math.abs(f.x - (player.x + player.w / 2)) < player.w / 2 + 9 && Math.abs(f.y - (player.y + player.h / 2)) < player.h / 2 + 9) {
        effects.parryHit(f.x, f.y);
        dead();
        loseLife(player.x + player.w / 2, player.y + player.h / 2, STAGES[stageName].dark ? 3 : 1);
      }
    }
  }

  // 던전의 아이템 줍기: 닿으면 소모품 하나를 얻는다
  function updatePickups(dt) {
    for (let k = pickups.length - 1; k >= 0; k--) {
      const p = pickups[k];
      p.t += dt;
      if (Math.abs(p.x - (player.x + player.w / 2)) < 22 && Math.abs(p.y - (player.y + player.h / 2)) < 30) {
        inv.consumables[p.id] = (inv.consumables[p.id] || 0) + 1;
        popups.push({ x: p.x, y: p.y - 18, text: `${G.Shop.ITEMS[p.id].name} 획득!`, t: 1.6, color: 'rgba(125,255,160,A)' });
        G.Audio.play('pickup');
        effects.sparkle(p.x, p.y);
        pickups.splice(k, 1);
      }
    }
  }

  // 던전 한 층 클리어: 경험치를 얻고 한 층 위로. 100층을 클리어하면 엔딩
  function clearFloor() {
    const floor = darkFloor;
    const gain = Math.round((floor * 5 + (dungeon.bossKind ? 200 + floor * 5 : 0)) * (dungeon.bossKind ? bossMul : 1));
    exp += gain;
    darkBest = Math.max(darkBest, floor);
    delete floorSeeds[floor]; // 클리어한 층은 다음에 새 방으로
    G.Audio.play('treasure');
    effects.treasure(player.x + player.w / 2, player.y);
    if (floor >= C.DUNGEON_FLOORS) { // 시크너를 쓰러뜨렸다
      story.cleared = true;
      darkFloor = 1;
      loadStage('village', true, 'darkhub');
      startDialogs(FINALE_LINES);
      return;
    }
    darkFloor = floor + 1;
    loadStage('dungeon', true);
    popups.push({ x: player.x + player.w / 2, y: player.y - 50, text: `${floor}층 클리어! +${gain} EXP`, t: 2.6, color: 'rgba(150,215,255,A)' });
  }

  // 여러 줄 대사를 차례로 보여준다 (E로 다음 줄)
  function startDialogs(lines) {
    dialog = { text: lines[0], t: 9999, queue: lines.slice(1) };
  }

  // 던진 검: 날아가며 몬스터를 쳐내고, 돌아오면 플레이어가 다시 잡는다
  function updateSword(dt) {
    sword.update(dt, player.hand);
    for (const s of monsters) {
      if (!s.alive || s.flying || s.appear > 0 || s.hitGrace > 0 || !s.overlaps(sword.box)) continue;
      hitMonster(s, sword.x, sword.dir);
      G.Audio.play('parry');
      effects.parryHit((sword.x + s.x + s.w / 2) / 2, (sword.y + s.y + s.h / 2) / 2);
      effects.shake(5, 0.15);
      hitStop = C.HIT_STOP;
    }
    if (bossOn()) {
      for (const h of hitBoss(sword.box)) {
        G.Audio.play('parry');
        effects.parryHit(h.cx, h.cy);
        effects.shake(5, 0.15);
      }
    }
    if (sword.done) {
      sword = null;
      player.swordOut = false;
      const h = player.hand;
      effects.swordCatch(h.x, h.y);
      G.Audio.play('catch');
    }
  }

  // 설정 값을 바꾼다 (dir: -1/+1 = 음량 조절 또는 토글, 0 = 토글만)
  const SETTING_KEYS = ['music', 'dmgNum', 'parrySound', 'sparkle', 'shake'];
  function changeSetting(i, dir) {
    const S = G.Settings;
    if (i === 0) { if (dir) G.Audio.setMusicVolume(Math.round((S.music + dir * 0.1) * 10) / 10); }
    else S[SETTING_KEYS[i]] = !S[SETTING_KEYS[i]];
    S.save();
    G.Audio.play('catch');
  }
  function updateSettings() {
    const pressed = (...c) => c.some((k) => input.wasPressed(k));
    if (pressed('Escape', 'KeyO')) { settingsUI = null; return; }
    if (pressed('ArrowUp')) settingsUI.cur = (settingsUI.cur + 4) % 5;
    if (pressed('ArrowDown')) settingsUI.cur = (settingsUI.cur + 1) % 5;
    if (pressed('ArrowLeft')) changeSetting(settingsUI.cur, -1);
    else if (pressed('ArrowRight')) changeSetting(settingsUI.cur, 1);
    else if (pressed('Enter', 'Space')) changeSetting(settingsUI.cur, settingsUI.cur === 0 ? 1 : 0);
  }

  function step(dt) {
    if (G.Forge.tickJob(inv, dt, nearFurnace())) { // 합치기 작업 완성
      say('합치기 완료! 용광로에서 무기를 찾으세요', 'rgba(255,225,120,A)');
      G.Audio.play('treasure');
    }
    if (!devUI && input.wasPressed('F1')) { // F1: 개발 메뉴 (모든 테스트 기능)
      devUI = { tab: 0, cur: 0, scroll: 0, msg: '', msgT: 0, fresh: true };
      G.Audio.play('pickup');
    }
    if (devUI) { // 메뉴가 열려 있는 동안 게임이 멈춘다
      updateDev(dt);
      input.endFrame();
      return;
    }
    if (fp) { // 대상 고르기 창이 열려 있는 동안 멈춘다
      updateForgePick(dt);
      input.endFrame();
      return;
    }
    if (wc) { // 작업 선택 창이 열려 있는 동안 멈춘다
      updateWorkChoice(dt);
      input.endFrame();
      return;
    }
    if (ag) { // 부착 미니게임 중에는 게임이 멈춘다
      updateAttachGame(dt);
      input.endFrame();
      return;
    }
    if (sg) { // 제련 미니게임 중에도 멈춘다
      updateSmeltGame(dt);
      input.endFrame();
      return;
    }
    if (!settingsUI && input.wasPressed('KeyO') && !shop && !equipUI && !mini && !cutscene) { settingsUI = { cur: 0 }; G.Audio.play('pickup'); input.endFrame(); return; }
    if (settingsUI) { // 설정 창이 열려 있는 동안 게임이 멈춘다
      updateSettings();
      input.endFrame();
      return;
    }
    if (mini) { // 놀이(야바위/표적/결투) 중에는 게임이 멈춘다
      updateMini(dt);
      input.endFrame();
      return;
    }
    if (god) player.invuln = Math.max(player.invuln, 1);
    effects.update(dt);
    stageTime += dt;
    if (hitStop > 0) {
      hitStop -= dt;
      return; // 입력 플래그를 지우지 않는다: 히트스톱 중에 누른 키(다음 패링 등)가 멈춤이 끝난 뒤 반영되도록
    }
    if (cutscene) { // 컷신: 플레이어는 가상 입력으로 움직이고 몬스터는 멈춰 있다
      cutscene.update(dt, input, effects);
      player.update(dt, cutscene.inputFor(), terrain);
      player.swingFx = false;
      if (cutscene.done) cutscene = null;
      camera.follow(player, terrain, dt);
      input.endFrame();
      return;
    }
    if (won) { // 클리어 연출: 화면은 정지. Enter로 건너뛰고, 끝나면 다음 스테이지로
      wonTime += dt;
      if (chest) chest.open = Math.min(1, chest.open + dt * 3);
      ending.update(dt);
      if (input.parryPressed && wonTime >= 0.5 && !ending.done) ending.skip();
      if (ending.done) loadStage(nextStage.name, true, nextStage.near);
      input.endFrame();
      return;
    }
    if (gameOver) { // 게임오버: 화면은 정지, 잠시 뒤 Enter로 새로 시작
      gameOverTime += dt;
      if (gameOverTime >= C.GAME_OVER_DELAY && input.parryPressed) restart();
      input.endFrame();
      return;
    }
    if (shop) { // 상점이 열려 있는 동안은 게임이 멈춘다
      updateShop(dt);
      input.endFrame();
      return;
    }
    if (equipUI) { // 장비창이 열려 있는 동안도 게임이 멈춘다
      updateEquip(dt);
      input.endFrame();
      return;
    }
    if (input.wasPressed('KeyI') || input.wasPressed('BracketRight')) { // 인벤토리 (I 또는 ])
      const idx = G.Shop.gridEntries(inv, 'all').findIndex((en) => en.id === inv.equipped.weapon);
      equipUI = { cur: Math.max(0, idx), cat: 'all', scroll: 0, cap: INV_CAP, followCur: true, msg: '', msgT: 0, ok: true };
      G.Audio.play('pickup');
      input.endFrame();
      return;
    }
    for (let n = 1; n <= 5; n++) if (input.wasPressed('Digit' + n) || input.wasPressed('Numpad' + n)) switchWeapon(n - 1); // 숫자 키 = 그 칸의 무기
    if (story.pending && stageName === 'village' && stageTime > 3.4 && !dialog && !story.started) { // 동굴 15번 클리어 후 마을: 이야기가 시작된다
      story.started = true;
      startDialogs(REVEAL_LINES);
    }
    if (dialog) {
      if (dialog.queue) { // 여러 줄 대사: E / Enter로 넘긴다
        if (input.wasPressed('KeyE') || input.parryPressed) {
          if (dialog.queue.length) dialog.text = dialog.queue.shift();
          else {
            if (story.pending && !story.revealed) { story.revealed = true; story.pending = false; effects.shake(8, 0.6); G.Audio.play('spawn'); }
            dialog = null;
          }
        }
        input.endFrame();
        return;
      }
      dialog.t -= dt;
      if (dialog.t <= 0) dialog = null;
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].t -= dt;
      popups[i].y -= 24 * dt;
      if (popups[i].t <= 0) popups.splice(i, 1);
    }
    if (input.wasPressed('KeyE') && !(stageName === 'dungeon' && dungeonEvents.interact()) && !(stageName === 'orecave' && oreNodes.interact())) { // 상점 열기 / 마을 사람과 대화 (던전에서는 가까운 이벤트가 먼저)
      const near = nearbyInteract();
      if (near && near.type === 'shop' && near.shop.kind.startsWith('mg')) { // 놀이마당
        openMini(near.shop.kind.slice(2));
        input.endFrame();
        return;
      } else if (near && near.type === 'shop') {
        if (near.shop.kind === 'furnace') openForgePick(); // 용광로: 검 / 투척 무기 / 갑옷 중 무엇을 강화할지 먼저 고른다
        else {
          shop = { kind: near.shop.kind, def: G.Shop.SHOPS[near.shop.kind], tab: 0, hover: -1, msg: '', msgT: 0, ok: true };
          G.Audio.play('pickup');
        }
      } else if (near && near.type === 'water') {
        washCrystals();
      } else if (near && near.type === 'altar') {
        blessCrystals();
      } else if (near && near.type === 'slot') { // 집 안 꾸미기: 가진 장식품을 고른다
        const sl = near.slot;
        shop = { kind: 'place', mode: 'place', slot: sl, def: { title: sl.kind === 'floor' ? '바닥 가구 놓기' : '벽 장식 걸기', tabs: G.Shop.placeTabs(inv, sl.kind) }, tab: 0, hover: -1, msg: '', msgT: 0, ok: true };
        G.Audio.play('pickup');
      } else if (near && near.type === 'home') { // 마을의 내 집 터
        if (inv.home.type) { loadStage('home', true); input.endFrame(); return; }
        dialog = { text: '아직 집이 없다. 왼쪽 끝 부동산에서 집을 살 수 있다.', t: 3 };
      } else if (near && near.type === 'enter') { // 마을 동굴로
        enterMine();
        input.endFrame();
        return;
      } else if (near && near.type === 'gate') { // 마을의 문으로 숲/설산/화산에, 다크월드 허브의 문으로 던전에
        if (near.stage === 'dungeon') darkFloor = Math.min(C.DUNGEON_FLOORS, Math.max(darkBest + 1, darkFloor)); // 지금까지 오른 곳 바로 위층부터. 죽거나 나갔어도 마지막으로 있던 층(보스 층 포함)에서 다시 시작
        loadStage(near.stage, true);
        input.endFrame();
        return;
      } else if (near && near.type === 'exit') { // 마을로 (들어왔던 입구 앞에서 시작)
        loadStage(STAGES[stageName].exitTo || 'village', true, STAGES[stageName].returnNear || 'D');
        input.endFrame();
        return;
      } else if (near) {
        const lines = story.revealed && !story.cleared ? DARK_VILLAGER_LINES : VILLAGER_LINES; // 시크너 이야기 뒤에는 마을 사람들 말이 달라진다
        dialog = { text: lines[near.index % lines.length], t: 4 };
      }
    }
    if (input.wasPressed('KeyQ')) { // 게임 중 바로 물약 마시기
      const id = G.Shop.bestPotion(inv, lives, maxLives());
      let text = lives >= maxLives() ? '피가 가득 차 있어요' : '마실 물약이 없어요';
      if (id) text = `피 +${drinkPotion(id).healed}`;
      else G.Audio.play('deny');
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text, t: 1.2, color: id ? 'rgba(125,255,160,A)' : 'rgba(255,170,170,A)' });
    }
    if (input.down.has('KeyR')) respawn(); // 막혔을 때 쓰는 무료 리스폰 (목숨 소모 없음)
    // 스태미나: 대시에 25, 폭탄/총/활에 무기별로 든다. 쓰고 잠깐 뒤부터 천천히 회복
    staminaWait = Math.max(0, staminaWait - dt);
    if (staminaWait === 0) stamina = Math.min(stMax(), stamina + G.Shop.staminaRegen(inv) * dt);
    if (input.dashPressedThisFrame && stamina < dashCost()) { // 스태미나가 모자라면 대시가 안 나간다
      input.dashPressedThisFrame = false;
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '스태미나 부족!', t: 0.8, color: 'rgba(255,170,170,A)' });
      G.Audio.play('deny');
    }
    if (input.wasPressed('KeyC') && !equipUI && player.onGround && player.slideT <= 0 && !player.swordOut) { // C: 슬라이딩
      if (stamina < C.SLIDE_STAMINA) { popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '스태미나 부족!', t: 0.8, color: 'rgba(255,170,170,A)' }); G.Audio.play('deny'); }
      else { player.startSlide(input.moveX || player.facing); stamina -= C.SLIDE_STAMINA; staminaWait = 0.8; G.Audio.play('dash'); effects.dashDust(player.x + player.w / 2, player.y + player.h, -player.slideDir); }
    }
    if (input.wasPressed('KeyB')) throwIceBomb();
    if (input.wasPressed('KeyV')) eatBest();
    const wasAir = !player.onGround;
    const fallV = player.vy;
    player.update(dt, input, terrain);
    if (wasAir && player.onGround && fallV > 380) effects.landDust(player.x + player.w / 2, player.y + player.h, Math.min(1, (fallV - 380) / 700)); // 착지 먼지
    if (player.onGround && Math.abs(player.vx) > 160 && (footT -= dt) <= 0) { // 달리는 발 먼지
      footT = 0.12;
      effects.footDust(player.x + player.w / 2, player.y + player.h, Math.sign(player.vx));
    }
    if (player.dashFx) { // 대시 시작: 먼지 + 바람 소리
      player.dashFx = false;
      stamina -= dashCost();
      staminaWait = 0.8;
      G.Audio.play('dash');
      effects.dashDust(player.x + player.w / 2, player.y + player.h, -player.dashDir);
    }
    if (player.swing === 0) G.Audio.play('swing'); // 휘두르기 시작 순간 (누르자마자 휙)
    if (player.jumpFx) {
      player.jumpFx = false;
      G.Audio.play('jump');
    }
    if (player.chargeReadyFx) { // 게이지가 가득 참
      player.chargeReadyFx = false;
      G.Audio.play('charge');
      effects.chargeReady(player.x + player.w / 2, player.y + player.h / 2);
    }
    if (player.throwSword) { // 게이지를 채운 뒤 손을 떼어 검을 던지는 순간
      player.throwSword = false;
      const h = player.hand;
      sword = new G.Sword(h.x, h.y, player.facing, player.throwTiles);
      effects.swordThrow(h.x, h.y, player.facing);
      G.Audio.play('throw');
      effects.shake(3, 0.1);
    }
    if (sword) updateSword(dt);
    G.Magic.update(magic, dt, terrain, magicTargets(), magicHooks);
    if (player.swingFx) { // 검을 휘두르기 시작하는 순간 바람 이펙트
      player.swingFx = false;
      inv.used[inv.equipped.weapon] = (inv.used[inv.equipped.weapon] || 0) + 1; // 휘두른(쏜) 횟수
      const swingType = G.Shop.ITEMS[inv.equipped.weapon].type;
      if (swingType === 'spear' || swingType === 'rapier') effects.thrust(player.x + player.w / 2, player.y + player.h / 2, player.facing); // 찌르기: 베는 바람 대신 앞으로 뻗는 불꽃
      else if (swingType !== 'hammer') effects.swing(player.x + player.w / 2, player.y + player.h / 2, player.facing);
      if (G.Shop.ITEMS[inv.equipped.weapon].type === 'hammer') { // 망치가 땅에 쾅!
        effects.quakeDust(player.x + player.w / 2 + player.facing * 36, player.y + player.h, 130);
        effects.shake(14, 0.35);
        G.Audio.play('vanish');
      }
      const weaponDef = G.Shop.ITEMS[inv.equipped.weapon];
      if (weaponDef.shot) { // 폭탄/총/활: 패링 버튼을 누를 때마다 쏜다 (스태미나가 든다)
        const shotCost = Math.max(4, weaponDef.stamina + equipStats.staminaAdd); // 티타늄 같은 주괴를 붙이면 덜 든다
        if (stamina < shotCost) {
          popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '스태미나 부족!', t: 0.8, color: 'rgba(255,170,170,A)' });
          G.Audio.play('deny');
        } else {
          stamina -= shotCost;
          staminaWait = 0.8;
          const h = player.hand;
          G.Magic.cast(magic, weaponDef.shot, h.x + player.facing * 26, h.y - 2, player.facing, terrain, magicTargets(), magicHooks, { dmg: weaponDef.dmg + equipStats.dmgBonus, radius: weaponDef.radius ? (weaponDef.radius + equipStats.radiusAdd) * C.TILE : 0, pierce: weaponDef.pierce || equipStats.pierceAdd, count: weaponDef.count });
          G.Audio.play(weaponDef.shot === 'bullet' ? 'gun' : weaponDef.shot === 'arrow' ? 'bow' : 'throw');
        }
      } else if (weaponDef.element) { // 지팡이: 패링할 때마다 지팡이 끝에서 원소가 나간다
        const el = G.Magic.pickElement(weaponDef.element);
        const h = player.hand;
        G.Magic.cast(magic, el, h.x + player.facing * 34, h.y, player.facing, terrain, magicTargets(), magicHooks);
        G.Audio.play(el === 'lightning' ? 'zap' : el);
      }
    }
    for (const s of monsters) {
      s.update(dt, player, terrain);
      if (s.shot) { enemyShots.push(s.shot); s.shot = null; G.Audio.play('spawn'); } // 시크너의 그림자가 쏜 어둠 구슬
      if (s.golden && s.alive) { // 황금박쥐: 반짝이는 가루를 흘리고, 가까이 오면 한 번 알려준다
        s.sparkleT -= dt;
        if (s.sparkleT <= 0) {
          s.sparkleT = 0.07;
          effects.sparkle(s.x + s.w / 2, s.y + s.h / 2);
        }
        if (!s.announced && Math.abs(s.x - player.x) < 420 && Math.abs(s.y - player.y) < 300) {
          s.announced = true;
          popups.push({ x: s.x + s.w / 2, y: s.y - 24, text: '황금박쥐 출현!', t: 2.2, color: 'rgba(255,213,74,A)' });
          G.Audio.play('pickup');
        }
      }
      if (s.dmgFx) { // 마법/독으로 입은 피해를 숫자로
        popups.push({ x: s.x + s.w / 2, y: s.y - 8, text: `-${s.dmgFx}`, t: 0.8, color: 'rgba(255,107,107,A)' });
        s.dmgFx = 0;
      }
      if (s.vanished) { // 날아가던 몬스터가 벽/땅에 닿아 터지는 순간
        s.vanished = false;
        if (s.deathStyle === 'ice') { // 얼면서 죽는다
          effects.iceShatter(s.x + s.w / 2, s.y + s.h / 2);
          G.Audio.play('shatter');
        } else if (s.deathStyle === 'fire') { // 불타며 죽는다
          effects.fireBurst(s.x + s.w / 2, s.y + s.h / 2);
          G.Audio.play('fire');
        } else {
          effects.vanish(s.x + s.w / 2, s.y + s.h / 2);
          G.Audio.play('vanish');
        }
        if (s.golden) effects.treasure(s.x + s.w / 2, s.y + s.h / 2); // 황금박쥐는 금화가 쏟아진다
        const base = s.kind === 'darkstone' ? C.DARKSTONE_COIN : s.kind === 'shade' ? C.SHADE_COIN : s.kind === 'crab' ? C.CRAB_COIN : s.kind === 'bat' ? (s.golden ? C.GOLDEN_BAT_COIN : C.BAT_COIN) : s.kind === 'golem' ? C.GOLEM_COIN : s.kind === 'slime' && !s.noCoin ? C.SLIME_COIN : 0; // 슬라임 5, 박쥐 6(황금 200), 꽃게 8
        const floorMul = STAGES[stageName].dark ? 1 + darkFloor * 0.05 : 1; // 던전은 올라갈수록 코인과 경험치가 늘어난다
        const drop = Math.round(base * floorMul * (G.Shop.ITEMS[inv.equipped.weapon].elem === 'gold' ? 1.5 : 1) * (1 + G.Shop.homeBonuses(inv).coin) * dungeonEvents.rewardMul()); // 황금 검은 코인 +50%, 집 장식 보너스, 던전 층 이벤트(혈월 등)
        if (drop) {
          coins += drop;
          popups.push({ x: s.x + s.w / 2, y: s.y - 6, text: `+${drop} G`, t: 1.2 });
          G.Audio.play('coin');
        }
        const gain = Math.round(({ slime: C.SLIME_EXP, bat: C.BAT_EXP, crab: C.CRAB_EXP, golem: C.GOLEM_EXP, darkstone: C.DARKSTONE_EXP, shade: C.SHADE_EXP }[s.kind] || 0) * (STAGES[stageName].dark ? 1 + darkFloor * 0.1 : 1) * dungeonEvents.rewardMul()); // 경험치: 슬라임 1, 박쥐 2, 꽃게 3, 흙골렘 3 (던전은 층마다 늘어난다)
        if (STAGES[stageName].dark && !s.noExp && Math.random() < 0.07) pickups.push({ x: s.x + s.w / 2, y: s.y + s.h - 16, id: PICKUP_TABLE[Math.floor(Math.random() * PICKUP_TABLE.length)], t: 0 }); // 가끔 아이템을 떨어뜨린다
        const wd = G.Shop.ITEMS[inv.equipped.weapon];
        if (wd.elem === 'reap' && !s.noExp) { // 낫: 처치하면 스태미나를 거둔다
          stamina = Math.min(stMax(), stamina + wd.reapSt);
          popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: `수확! 스태미나 +${wd.reapSt}`, t: 0.8, color: 'rgba(200,170,255,A)' });
          reapKills += 1;
          if (reapKills >= 20) { // 20마리를 거두면 피가 반 칸 찬다
            reapKills = 0;
            if (lives < maxLives()) {
              lives = Math.min(maxLives(), lives + 0.5);
              popups.push({ x: player.x + player.w / 2, y: player.y - 34, text: '피 +½', t: 1.2, color: 'rgba(255,140,160,A)' });
              G.Audio.play('pickup');
            }
          }
        }
        if (gain && !s.noExp) { // (왕슬라임이 낳은 슬라임은 경험치를 주지 않는다)
          exp += gain;
          popups.push({ x: s.x + s.w / 2, y: s.y - 22, text: `+${gain} EXP`, t: 1.2, color: 'rgba(150,215,255,A)' });
        }
        continue;
      }
      if (s.respawned) { // 부활하는 순간
        s.respawned = false;
        effects.spawn(s.x + s.w / 2, s.y + s.h);
      }
      if (s.attackFx) { // 꽃게가 집게를 치켜드는 순간
        s.attackFx = false;
        G.Audio.play('clack');
      }
      if (!s.alive || s.flying || s.appear > 0) continue; // 죽었거나, 날아가는 중이거나, 나타나는 중엔 해롭지 않다
      // 처치하는 타(기절한 슬라임/꽃게의 두 번째 타, 박쥐, 대검·전설의 검의 첫 타)는 가드가 아니라 칼 베기: 검이 실제로 내리쳐지는 프레임부터 맞는다
      // 가드 자세는 슬라임/꽃게를 처음 쳐서 밀어낼 때만 취한다
      const finisher = !s.twoHit || s.staggered > 0 || killsInOne();
      if (player.parrying && s.hitGrace <= 0 && (!finisher || player.swing >= player.slashFrame) && s.overlaps(parryBox(player))) {
        hitMonster(s, player.x + player.w / 2, player.facing);
        if (!finisher) player.parrySucceeded(); // 밀어내는 첫 타(패링)만 가드 자세를 취한다
        G.Audio.play('parry');
        effects.parryHit((player.x + player.w / 2 + s.x + s.w / 2) / 2, (player.y + player.h / 2 + s.y + s.h / 2) / 2);
        effects.shake(finisher ? 8 : 6, 0.18);
        hitStop = C.HIT_STOP;
      } else if (player.invuln === 0 && !player.dashing && !s.staggered && s.overlaps(player)) { // 기절한 몬스터는 해롭지 않다
        loseLife(player.x + player.w / 2, player.y + player.h / 2, s.contactDmg || 1); // 패링하지 못하고 닿으면 목숨 -1 (설산은 -2)
        armorHurtPerk(s);
        break;
      }
    }
    if (boss && !boss.started && !boss.done && player.x > boss.left + 100) { // 경기장에 들어섰다: 용머리 등장, 화면과 길이 막힌다
      boss.started = true;
      if (boss.onStart) boss.onStart(terrain); // (침팬지 경기장: 입구가 벽으로 막힌다)
      camera.minX = camera.x;
      popups.push({ x: player.x + player.w / 2, y: player.y - 40, text: `${boss.name} 출현!`, t: 2.4, color: 'rgba(255,120,80,A)' });
      effects.shake(8, 0.8);
      G.Audio.play('spawn');
    }
    if (bossOn() && !won) {
      camera.minX = Math.min(boss.camLeft || boss.left, camera.minX + 520 * dt);
      if (player.x < boss.left) { player.x = boss.left; player.vx = Math.max(0, player.vx); }
      const box = parryBox(player);
      if (player.parrying && boss.deflect(box) > 0) { // 화염구를 쳐냈다: 쏜 머리에게 되돌아간다
        player.parrySucceeded();
        G.Audio.play('parry');
        effects.parryHit(player.x + player.w / 2 + player.facing * 20, player.y + player.h / 2);
        effects.shake(6, 0.15);
        hitStop = C.HIT_STOP;
      }
      if (player.parrying && player.swing >= player.slashFrame) { // 기절했거나 땅에 박힌 머리를 벤다
        for (const h of hitBoss(box)) {
          G.Audio.play('parry');
          effects.parryHit(h.cx, h.cy);
          effects.shake(6, 0.15);
          hitStop = C.HIT_STOP;
        }
      }
      updateAnalysis(dt);
      boss.update(dt, player);
      for (const h of boss.heads) {
        if (h.dmgFx) {
          popups.push({ x: h.cx, y: h.y - 10, text: `-${h.dmgFx}`, t: 0.9, color: 'rgba(255,107,107,A)' });
          h.dmgFx = 0;
        }
      }
    }
    updateDuelRun(dt);
    updateEnemyShots(dt);
    updateArmorPerks(dt);
    usedT += dt; // '많이 쓴 순' 정렬을 위해 입은 방어구의 사용 시간을 센다
    if (usedT >= 1) {
      usedT -= 1;
      for (const sl of ['armor', 'helmet', 'gloves', 'boots']) { const id = inv.equipped[sl]; if (id) inv.used[id] = (inv.used[id] || 0) + 1; }
    }
    updatePickups(dt);
    if (stageName === 'dungeon') dungeonEvents.update(dt);
    if (stageName === 'orecave') oreNodes.update(dt, input.down.has('KeyE')); // E 길게: 곡괭이질
    if (chest && !won && stageName === 'dungeon' && player.overlaps(chest)) { // 던전: 위층으로 오르는 계단
      clearFloor();
      input.endFrame();
      return;
    }
    if (chest && !won && player.overlaps(chest)) { // 보물 발견!
      won = true;
      wonTime = 0;
      const cd = STAGES[stageName].chest;
      const reward = Math.round(cd.coins * bossMul * (1 + G.Shop.homeBonuses(inv).coin)); // 집 장식 보너스, 보스 다시 도전 배율
      const expGain = Math.round((cd.exp || 0) * bossMul);
      ending = new G.Ending(cd.mode, reward, expGain);
      nextStage = { name: cd.next, near: cd.near };
      if (!STAGES[stageName].repeatChest) chestTaken[stageName] = true;
      if (stageName === 'mine') { // 동굴을 15번 클리어하면 시크너의 이야기가 시작된다
        story.caves += 1;
        if (story.caves >= C.CAVE_CLEARS_FOR_STORY && !story.revealed && !story.pending) story.pending = true;
      }
      coins += reward;
      exp += expGain;
      effects.treasure(chest.x + chest.w / 2, chest.y);
      G.Audio.play('treasure');
      effects.shake(8, 0.35);
    } else if (goalBox && !won && player.overlaps(goalBox)) { // 집에 도착!
      won = true;
      wonTime = 0;
      ending = new G.Ending('house');
      nextStage = { name: 'village' };
      player.facing = 1;
      G.Audio.play('pickup');
    }
    if (!gameOver && player.y > terrain.height + C.TILE * 2) { // 구덩이 낙사: 마지막으로 서 있던 바닥에서 이어감
      const g = player.lastGround;
      loseLife(g.x + player.w / 2, g.y + player.h / 2);
      if (!gameOver) {
        player.placeAt(g.x, g.y);
        camera.follow(player, terrain, C.DT, true);
      }
    }
    camera.follow(player, terrain, dt);
    input.endFrame();
  }

  // 고정 시간 스텝: 모니터 주사율과 무관하게 물리가 동일하게 동작한다
  let last = performance.now();
  let acc = 0;
  // 이번 스텝을 돌리기 전의 위치를 기억해 둔다. 그릴 때 이전 위치와 현재 위치를 프레임 시각 비율로 이어 붙여서
  // 모니터가 60Hz보다 빨라도(120/144Hz) 같은 위치가 여러 프레임 반복되며 끊겨 보이지 않게 한다
  function snapshotPrev() {
    player.px = player.x;
    player.py = player.y;
    for (const mo of monsters) { mo.px = mo.x; mo.py = mo.y; }
    camera.px = camera.x;
    camera.py = camera.y;
    if (sword) { sword.px = sword.x; sword.py = sword.y; }
    for (const s of magic.shots) { s.px = s.x; s.py = s.y; }
  }

  function frame(now) {
    acc += Math.min((now - last) / 1000, 0.1); // 탭 전환 후 폭주 방지
    last = now;
    while (acc >= C.DT) {
      snapshotPrev();
      step(C.DT);
      acc -= C.DT;
    }
    render(acc / C.DT); // 남은 시간 비율만큼 이전 -> 현재 위치 사이에서 그린다
    requestAnimationFrame(frame);
  }

  // alpha(0~1)만큼 이전 위치에서 현재 위치로 옮겨 그리고, 그린 뒤 원래 위치로 되돌린다.
  // 이전 위치가 없거나(새로 생김/순간이동) 80px 넘게 튄 것은 보간하지 않는다
  function render(alpha = 1) {
    const saved = [];
    if (alpha < 1) {
      const lerpObj = (o) => {
        if (o.px === undefined || Math.abs(o.x - o.px) > 80 || Math.abs(o.y - o.py) > 80) return;
        saved.push([o, o.x, o.y]);
        o.x = o.px + (o.x - o.px) * alpha;
        o.y = o.py + (o.y - o.py) * alpha;
      };
      lerpObj(player);
      lerpObj(camera);
      for (const mo of monsters) if (mo.alive) lerpObj(mo);
      if (sword) lerpObj(sword);
      for (const s of magic.shots) lerpObj(s);
    }
    try {
      drawFrame();
    } finally {
      for (const [o, x, y] of saved) { o.x = x; o.y = y; }
    }
  }

  function drawFrame() {
    const st = STAGES[stageName];
    const banner = st.banner && stageTime < st.banner.dur && !shop && !equipUI && !devUI && !mini && !skipBanner ? Object.assign({ t: stageTime }, st.banner) : null;
    const near = !shop && !equipUI && !devUI && !mini && !ag && !sg && !wc && !fp && !dialog && !won && !cutscene ? nearbyInteract() : null;
    const PROMPTS = { talk: 'E: 대화', enter: 'E: 동굴로 들어가기', exit: stageName === 'home' ? 'E: 밖으로 나가기 (마을)' : 'E: 마을로 나가기', home: inv.home.type ? 'E: 우리 집으로 들어가기' : 'E: 빈 터 (부동산에서 집을 살 수 있어요)', water: 'E: 샘물로 어둠의 크리스탈 씻기', altar: 'E: 신성의 제단: 정화된 크리스탈을 신성 크리스탈로' };
    const prompt = near ? (near.type === 'shop' ? (near.shop.kind.startsWith('mg') ? `E: ${G.Shop.SHOPS[near.shop.kind].title} 하기 (돈 벌기)` : `E: ${G.Shop.SHOPS[near.shop.kind].title} 열기`) : near.type === 'gate' ? `E: ${STAGES[near.stage].label}(으)로 들어가기` : near.type === 'slot' ? (near.slot.kind === 'floor' ? 'E: 바닥 가구 놓기 / 치우기' : 'E: 벽 장식 걸기 / 치우기') : PROMPTS[near.type]) : null;
    const slotItem = shop && shop.mode === 'place' ? inv.home.placed[shop.slot.kind][shop.slot.index] || null : null;
    const shopView = shop ? Object.assign({}, shop, { coins, exp, lives, maxLives: maxLives(), inv, slotItem }, isMergeTab() ? { merge: mergeView() } : {}) : null;
    const jobNow = G.Forge.jobOf(inv);
    const jobHud = jobNow ? { done: jobNow.done, by: jobNow.by, left: Math.ceil(jobNow.total - jobNow.t), name: G.Shop.ITEMS[jobNow.to].name, near: nearFurnace() } : null;
    const equipView = equipUI ? Object.assign({}, equipUI, { inv, lives, maxLives: maxLives(), coins, bonus: Object.assign({ critDamage: G.Shop.critDamage(inv) }, G.Shop.homeBonuses(inv)) }) : null;
    const house = terrain.houses[0];
    const npcs = ending && ending.mode === 'house' && house ? [{ kind: 'elder', x: house.col * C.TILE + C.TILE / 2 + 44, y: (house.row + 1) * C.TILE, facing: -1, alpha: ending.npcAlpha }] : [];
    renderer.draw(terrain, player, camera, monsters, effects, {
      lives, maxLives: maxLives(), coins, exp, potions: inv.potions, gameOver,
      stamina, staminaMax: stMax(), consumables: inv.consumables,
      mini: mini ? Object.assign({}, mini, { coins, me: { weaponId: inv.equipped.weapon, armorId: inv.equipped.armor, helmetId: inv.equipped.helmet, glovesId: inv.equipped.gloves, pantsId: inv.equipped.pants, bootsId: inv.equipped.boots } }) : null,
      caveInfo: stageName === 'mine' ? { level: mineRun, coins: Math.round(STAGES.mine.chest.coins * (1 + G.Shop.homeBonuses(inv).coin)) } : null,
      weakText: analysisText(),
      hotbar: inv.hotbar, weaponId: inv.equipped.weapon,
      settings: settingsUI,
      dev: devUI ? (() => { const L = devLayout(); return Object.assign({}, devUI, { tabs: L.tabs.map((t) => t.name), photo: L.photo, items: L.items.map((q) => ({ label: q.label, hint: q.hint, img: q.img })) }); })() : null,
      home: stageName === 'home' ? Object.assign({ total: G.Home.houseDef(inv.home.type).floor + G.Home.houseDef(inv.home.type).wall }, G.Shop.homeBonuses(inv)) : null,
      slimeCount: monsters.filter((m) => m.kind === 'slime' && m.alive).length,
      batCount: monsters.filter((m) => m.kind === 'bat' && m.alive).length,
      crabCount: monsters.filter((m) => m.kind === 'crab' && m.alive).length,
      summon: !!st.summon, monsterless: !!st.monsterless,
      canRestart: gameOver && gameOverTime >= C.GAME_OVER_DELAY,
      won, cutscene: !!cutscene, goal: st.goal, banner, prompt, dialog, shop: shopView, forgePick: fp ? fpView() : null, job: jobHud, attach: ag ? Object.assign({}, ag, { agPos: ATTACH_UPDATE[ag.mode] ? 0 : agPos(), smith: smithInfo() }) : null, smelt: sg ? Object.assign({}, sg, { band: sgBand(), smith: smithInfo() }) : null, work: wc ? Object.assign({}, wc, { coins, smith: smithInfo() }) : null, equip: equipView, boss: bossOn() ? boss : null,
    }, sword, { cutscene, chest, ending, npcs, popups, magic, boss: bossOn() ? boss : null, pickups, enemyShots, events: stageName === 'dungeon' ? dungeonEvents : null, ores: stageName === 'orecave' ? oreNodes : null, darken: stageName === 'village' && story.revealed && !story.cleared ? 0.42 : 0 });
  }
  requestAnimationFrame(frame);

  // 테스트/디버그용 노출
  G.state = {
    player, monsters, camera, input, step, effects, render, loadStage, renderer, snapshotPrev,
    get terrain() { return terrain; },
    get baseMonsterCount() { return baseMonsterCount; },
    get stage() { return stageName; },
    get ending() { return ending; },
    get slimes() { return monsters.filter((m) => m.kind === 'slime'); },
    get bats() { return monsters.filter((m) => m.kind === 'bat'); },
    get lives() { return lives; },
    set lives(v) { lives = v; },
    get gameOver() { return gameOver; },
    get sword() { return sword; },
    get won() { return won; },
    get cutscene() { return cutscene; },
    get stamina() { return stamina; },
    set stamina(v) { stamina = v; },
    story, pickups, enemyShots, dungeonEvents, oreNodes, popups, spawnDungeonMonster,
    get darkFloor() { return darkFloor; },
    set darkFloor(v) { darkFloor = v; },
    get darkBest() { return darkBest; },
    get dialog_() { return dialog; },
    get coins() { return coins; },
    get exp() { return exp; },
    set exp(v) { exp = v; },
    set coins(v) { coins = v; },
    get shop() { return shop; },
    get equip() { return equipUI; },
    get dev() { return devUI; },
    get settings() { return settingsUI; },
    get attachGame() { return ag; },
    get workChoice() { return wc; },
    get forgePick() { return fp; },
    get smeltGame() { return sg; },
    get mini() { return mini; },
    get duelRun() { return duelRun; },
    get analysis() { return analysis; },
    analysisText,
    hitBoss, weaponElemOf, hitMonster, applyEquipment,
    devItems,
    get inv() { return inv; },
    get maxLives() { return maxLives(); },
    applyEquipment, enterMine, magic,
    get mineRun() { return mineRun; },
    get dialog() { return dialog; },
    get chest() { return chest; },
    get boss() { return boss; },
  };
})(window.Game);
