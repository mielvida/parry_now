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
  const mineCoins = () => G.Shop.mineReward(inv.mineLevel); // 동굴 상자 코인은 '동굴 보상 상점'에서 업그레이드한 레벨로 정해진다
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
      music: 'village', level: G.Levels.village, theme: G.Beach, monsterless: true, goal: '마을을 둘러보자: 가게 앞에서 E 키, 오른쪽 끝에는 동굴 입구가 있다 (장비: 1 키)',
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
    // ---- 마을의 문으로 들어가는 스테이지들 (모두 끝에 보물 상자가 있고, 먹으면 코인을 받고 문 앞으로 돌아온다. 상자는 들어갈 때마다 다시 나온다) ----
    forest: {
      music: 'village', label: '속삭이는 숲', level: G.Levels.forest, theme: G.Forest, summon: true, repeatChest: true, returnNear: 'forest', slimeVariant: 'green',
      boss: { col: 121, kind: 'king', drop: 'darkcrystal' }, // 맨 끝 경기장(121칸~)에서 왕슬라임과 대결 (쓰러뜨리면 어둠의 크리스탈 1개)
      goal: '목표: 숲 끝의 왕슬라임을 쓰러뜨리고 보물 상자 (+1000 G, 경험치 40). 돌아가려면 처음의 출구에서 E',
      chest: { mode: 'mine', coins: 1000, exp: 40, next: 'village', near: 'forest' },
      banner: { title: '속삭이는 숲', sub: '슬라임 왕이 사는 초록 숲', dur: 3.5, caption: '…숲은 고요하다. 저 끝에 슬라임들의 왕이 있다고 한다.' },
    },
    snow: {
      music: 'cave', label: '얼음 산', level: G.Levels.snow, theme: G.Snow, summon: true, repeatChest: true, returnNear: 'snow', slimeVariant: 'ice', slippery: true,
      monsterSpeed: C.SNOW_MOB_SPEED, monsterDamage: C.SNOW_MOB_DAMAGE, boss: { col: 164, kind: 'ape' }, // 몬스터는 느리지만 한 방에 목숨 2개. 맨 끝 경기장(164칸~)에서 털복숭이 침팬지와 대결
      goal: '목표: 설산 끝의 털복숭이 침팬지를 쓰러뜨리고 보물 상자 (+1500 G, 경험치 50). 몬스터에게 맞으면 -2! 바닥이 미끄럽다',
      chest: { mode: 'mine', coins: 1500, exp: 50, next: 'village', near: 'snow' },
      banner: { title: '얼음 산', sub: '바닥이 미끄러운 설산', dur: 3.5, caption: '…발밑이 꽁꽁 얼어 있다. 몬스터는 굼뜨지만, 한 번 맞으면 크게 다친다!' },
    },
    volcano: {
      music: 'cave', label: '불꽃 화산', level: G.Levels.volcano, theme: G.Volcano, summon: true, repeatChest: true, returnNear: 'volcano', slimeVariant: 'lava',
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
    '마을 사람: "무기 상점엔 검 말고도 대검과 지팡이가 있다네."',
    '마을 사람: "해변의 꽃게를 잡으면 코인을 떨어뜨린다더군."',
    '마을 사람: "마을 오른쪽 끝 동굴엔 보물이 있지만, 슬라임과 박쥐가 득시글하다네."',
    '마을 사람: "마을 곳곳의 문으로 숲, 설산, 화산에 갈 수 있다네. 갈수록 위험하지만 상자 보상도 크지."',
    '마을 사람: "갑옷 가게엔 투구와 장갑, 신발도 있지. 1 키로 장비를 바꿀 수 있다네."',
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
  let equipStats = G.Shop.stats(inv); // 낀 장비의 능력치 합계 (applyEquipment가 갱신)
  const chestTaken = {};            // 이미 연 보물 상자 (같은 상자로 코인을 또 벌 수 없다)
  let nextStage = null;             // 클리어 연출이 끝나면 갈 곳 {name, near}
  let equipUI = null;   // 인벤토리 창 {cur(선택한 칸 번호), msg, msgT, ok}
  const maxLives = () => G.Shop.maxLivesFor(inv, C.PLAYER_LIVES); // 갑옷에 따라 늘어나는 최대 피
  let shop = null;      // 열려 있는 상점 {kind, def, msg, msgT, ok}
  let dialog = null;    // 마을 사람 대화 {text, t}
  const popups = [];    // 떠오르는 글자 {x, y, text, t, color?}
  const magic = G.Magic.create(); // 날아가는 지팡이 마법 (불덩이/독 방울/번개)
  let won = false;       // 스테이지 클리어 연출 중
  let wonTime = 0;
  let ending = null;     // 클리어 연출 ('cave': 코인 -> 해변, 'house': 노인과 대화 -> 마을)
  let stamina = C.STAMINA_MAX;   // 스태미나: 대시와 폭탄/총/활 공격에 쓴다
  let staminaWait = 0;           // 스태미나를 쓴 직후 회복이 잠깐 멈추는 시간
  const story = { caves: 0, pending: false, revealed: false, cleared: false }; // 이야기: 동굴 15번 클리어 -> 시크너 이야기 -> 다크월드 문
  let darkFloor = 1;             // 던전에서 지금 도전할 층
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
  const makeChest = () => Object.assign(terrain.placeOnTile(terrain.treasure.col, terrain.treasure.row, C.CHEST_W, C.CHEST_H), { w: C.CHEST_W, h: C.CHEST_H, open: 0 });

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
      chest = makeChest();
      const drop = STAGES[stageName].boss && STAGES[stageName].boss.drop; // 보스가 떨어뜨리는 소중한 물건 (이미 있으면 다시 주지 않는다)
      if (drop) { // 보스가 쓰러질 때마다 소중한 물건 1개 (개수가 쌓인다)
        const n = G.Shop.addMaterial(inv, drop);
        popups.push({ x: player.x + player.w / 2, y: player.y - 70, text: `${G.Shop.ITEMS[drop].name} 1개 획득! (보유 ${n}개)`, t: 3, color: 'rgba(200,150,255,A)' });
      }
      effects.treasure(chest.x + chest.w / 2, chest.y);
      G.Audio.play('treasure');
      popups.push({ x: player.x + player.w / 2, y: player.y - 40, text: boss.defeatText, t: 2.5, color: 'rgba(255,213,74,A)' });
    },
  };
  function setupBoss() {
    for (let k = monsters.length - 1; k >= 0; k--) if (monsters[k].fromBoss) monsters.splice(k, 1); // 이전 보스전에서 낳은 슬라임 정리
    const st = STAGES[stageName];
    camera.minX = 0;
    const bk = st.boss && st.boss.kind;
    if (bk && bk.startsWith('dark_')) { // 다크월드 보스 (정의의 어둠돌 / 정의의 어둠 / 시크너)
      boss = new G.DarkBoss(st.boss.col * C.TILE, terrain.width - st.boss.col * C.TILE, (terrain.treasure.row + 1) * C.TILE, bossEv, bk.slice(5));
      return;
    }
    const Cls = st.boss && ({ ape: G.ApeBoss, king: G.KingSlime }[bk] || G.Boss);
    boss = st.boss ? new Cls(st.boss.col * C.TILE, terrain.width - st.boss.col * C.TILE, (terrain.treasure.row + 1) * C.TILE, bossEv) : null;
  }
  const bossOn = () => !!(boss && boss.started);
  const magicTargets = () => (bossOn() ? monsters.concat(boss.targets()) : monsters);
  // 약점 속성 무기는 보스에게 더 아프다 (불의 용은 얼음, 눈의 털복숭이는 불)
  // 보스에게 입히기: 치명타가 터지면 치명타 대미지, 아니면 평소 대미지
  function hitBoss(rect) {
    const crit = rollCrit();
    const hits = boss.hitHeads(rect, crit ? G.Shop.critDamage(inv) : bossDamage());
    if (crit && hits.length) {
      popups.push({ x: hits[0].cx, y: hits[0].y - 34, text: `치명타! ${G.Shop.critDamage(inv)}`, t: 1.4, color: 'rgba(255,225,80,A)' });
      critFx(hits[0].cx, hits[0].cy);
    }
    return hits;
  }
  const bossDamage = () => (killsInOne() ? 2 : 1) + (boss && G.Shop.ITEMS[inv.equipped.weapon].elem === boss.weak ? (boss.weak === 'ice' ? C.BOSS_ICE_BONUS : C.BOSS_FIRE_BONUS) : 0);

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

  function loadStage(name, keepLives = false, near = null) {
    stageName = name;
    if (name === 'mine' && !mineLevel) { // ?stage=mine 처럼 입구를 거치지 않고 바로 온 경우
      mineRun = 1;
      mineLevel = G.MineGen.generate(1);
    }
    const st = STAGES[name];
    G.Audio.setMusic(st.music || 'cave'); // 마을은 활기찬 노래, 나머지는 동굴 곡
    if (name === 'dungeon') dungeon = G.Dark.makeFloor(darkFloor); // 층마다 새로 만든다
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
      if (st.dark) { // 다크월드 몬스터: 층이 오를수록 단단하다 (체력, 더 때려야 하는 횟수)
        mo.dark = true;
        mo.maxHp = Math.round(mo.maxHp * (1 + darkFloor * 0.06));
        mo.hp = mo.maxHp;
        mo.extraHits = Math.floor(darkFloor / 12);
      }
    }
    if (st.dark) scatterPickups(); // 던전에서는 가끔 아이템이 떨어져 있다
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
    player.slippery = !!st.slippery; // 설산은 바닥이 미끄럽다
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
    player.bootsId = inv.equipped.boots;
    player.throwBonus = equipStats.throwTiles;
    player.canThrow = equipStats.canThrow;
    player.parryWindow = C.PARRY_WINDOW + equipStats.windowAdd;
    player.parryCooldownTime = Math.max(0.25, C.PARRY_COOLDOWN + equipStats.cooldownAdd);
    applySpeed();
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

  // 테스트용 키: 0 = 해변, 9 = 마을, 7 = 마을 동굴(새로 생성)로 바로 이동 (컷신/클리어 연출 중이어도 끊는다), 8 = 코인 +1000
  const STAGE_KEYS = { Digit0: 'beach', Numpad0: 'beach', Digit9: 'village', Numpad9: 'village' };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (STAGE_KEYS[e.code]) {
      cutscene = null;
      loadStage(STAGE_KEYS[e.code], true);
    } else if (e.code === 'Digit7' || e.code === 'Numpad7') {
      cutscene = null;
      enterMine();
    } else if (e.code === 'Digit4' || e.code === 'Numpad4') { // 테스트: 4 = 이야기를 건너뛰고 바로 다크월드로
      cutscene = null;
      story.revealed = true;
      story.pending = false;
      loadStage('darkhub', true);
    } else if (e.code === 'KeyK') { // 내 스프라이트(editor.html에서 그린 모션) 켜기/끄기
      const S = G.Sprites;
      let text;
      if (!S.hasFrames()) text = 'editor.html 에서 먼저 그려 주세요';
      else {
        S.setEnabled(!S.data.enabled);
        text = S.data.enabled ? '내 스프라이트 켜짐' : '내 스프라이트 꺼짐';
      }
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text, t: 1.6, color: 'rgba(255,248,170,A)' });
    } else if (e.code === 'KeyF') { // 전체화면 켜기/끄기
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } else if (e.code === 'Digit8' || e.code === 'Numpad8') {
      coins += 1000;
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
    if (player.cancelCharge()) effects.chargeBreak(cx, cy); // 맞으면 충전 게이지가 풀린다
    effects.playerHit(cx, cy);
    effects.shake(9, 0.3);
    lives -= dmg;
    G.Audio.play('hurt');
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
    return { coins, lives, maxLives: maxLives(), inv };
  }

  const shopItems = () => shop.def.tabs[shop.tab].items;

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
    if (shop.mode === 'place') { placeItem(item); return; }
    const w = wallet();
    const res = G.Shop.buy(item, w);
    coins = w.coins;
    lives = w.lives;
    applyEquipment();
    shop.msg = res.msg;
    shop.ok = res.ok;
    shop.msgT = 2;
    G.Audio.play(res.ok ? 'coin' : 'deny');
  }

  // 상점: ←→ 탭 전환, 숫자 키 또는 마우스 클릭으로 구매, E/Esc로 닫기
  function updateShop(dt) {
    if (input.wasPressed('KeyE') || input.wasPressed('Escape')) {
      shop = null;
      return;
    }
    const tabs = shop.def.tabs.length;
    if (tabs > 1) {
      if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) shop.tab = (shop.tab + 1) % tabs;
      if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) shop.tab = (shop.tab + tabs - 1) % tabs;
    }
    shopItems().forEach((item, i) => {
      if (input.wasPressed('Digit' + (i + 1)) || input.wasPressed('Numpad' + (i + 1))) buyItem(item);
    });
    shop.msgT = Math.max(0, shop.msgT - dt);
  }

  // 인벤토리 창(1 키): 방향키로 칸 선택(←→ 1칸, ↑↓ 한 줄), E/Enter/Space 또는 클릭으로 장착, 1/Esc로 닫기
  const INV_COLS = 6;
  const INV_SLOTS = 24;

  // 물약을 마시고 피를 채운다 (인벤토리 E와 Q 키가 같이 쓴다). 결과 메시지를 돌려준다
  function drinkPotion(id) {
    const r = G.Shop.usePotion(inv, id, lives, maxLives());
    lives = r.lives;
    G.Audio.play(r.ok ? 'pickup' : 'deny');
    return r;
  }

  // 선택한 칸의 아이템을 쓴다: 장비는 장착(이미 낀 장갑/신발은 해제, 무기·갑옷은 벗을 수 없음), 물약은 마신다
  function equipSelected() {
    const e = equipUI;
    const entry = G.Shop.gridEntries(inv)[e.cur];
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
    } else if (item.quest) {
      e.msg = `${item.name}: 소중히 간직하고 있다`;
      e.ok = true;
      G.Audio.play('pickup');
    } else if (item.heal !== undefined) {
      const r = drinkPotion(item.id);
      e.msg = r.msg;
      e.ok = r.ok;
    } else if (inv.equipped[item.slot] === item.id) {
      if (item.slot === 'helmet' || item.slot === 'gloves' || item.slot === 'boots') {
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
    } else {
      inv.equipped[item.slot] = item.id;
      applyEquipment();
      e.msg = `${item.name} 장착!`;
      e.ok = true;
      G.Audio.play('catch');
    }
  }

  function updateEquip(dt) {
    const e = equipUI;
    const pressed = (...codes) => codes.some((c) => input.wasPressed(c));
    if (pressed('Escape', 'Digit1', 'Numpad1')) {
      equipUI = null;
      return;
    }
    if (pressed('ArrowLeft', 'KeyA')) e.cur = e.cur % INV_COLS === 0 ? e.cur : e.cur - 1;
    if (pressed('ArrowRight', 'KeyD')) e.cur = e.cur % INV_COLS === INV_COLS - 1 ? e.cur : e.cur + 1;
    if (pressed('ArrowUp', 'KeyW')) e.cur = e.cur - INV_COLS >= 0 ? e.cur - INV_COLS : e.cur;
    if (pressed('ArrowDown', 'KeyS')) e.cur = e.cur + INV_COLS < INV_SLOTS ? e.cur + INV_COLS : e.cur;
    if (pressed('KeyE', 'Enter', 'NumpadEnter', 'Space')) equipSelected();
    e.msgT = Math.max(0, (e.msgT || 0) - dt);
  }

  // 마우스 좌표를 게임 화면 좌표로 (캔버스가 화면 크기에 맞춰 늘어나 있어도 맞게)
  function canvasPoint(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (C.VIEW_W / r.width), y: (ev.clientY - r.top) * (C.VIEW_H / r.height) };
  }
  const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

  canvas.addEventListener('mousemove', (ev) => {
    const p = canvasPoint(ev);
    if (equipUI) { // 칸 위에 올리면 선택
      const i = G.Renderer.equipGeometry(C.VIEW_W, C.VIEW_H).cells.findIndex((c) => inRect(p, c));
      if (i >= 0) equipUI.cur = i;
    } else if (shop) { // 물품 줄 위에 올리면 강조
      shop.hover = G.Renderer.shopGeometry(C.VIEW_W, C.VIEW_H, shop.def, shop.tab).rows.findIndex((r) => inRect(p, r));
    }
  });
  canvas.addEventListener('click', (ev) => {
    const p = canvasPoint(ev);
    if (equipUI) { // 칸 클릭 = 장착. 왼쪽 장착 슬롯 클릭 = 그 아이템이 있는 칸을 가리킴
      const geo = G.Renderer.equipGeometry(C.VIEW_W, C.VIEW_H);
      const i = geo.cells.findIndex((c) => inRect(p, c));
      if (i >= 0) {
        equipUI.cur = i;
        equipSelected();
        return;
      }
      for (const slot of Object.keys(geo.slots)) {
        if (inRect(p, geo.slots[slot]) && inv.equipped[slot]) equipUI.cur = Math.max(0, inv.items.indexOf(inv.equipped[slot]));
      }
    } else if (shop) { // 탭 클릭 = 전환, 물품 줄 클릭 = 구매
      const geo = G.Renderer.shopGeometry(C.VIEW_W, C.VIEW_H, shop.def, shop.tab);
      const t = geo.tabs.findIndex((r) => inRect(p, r));
      if (t >= 0) {
        shop.tab = t;
        shop.hover = -1;
        return;
      }
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
  function hitMonster(s, fromX, fallbackDir) {
    const away = Math.sign(s.x + s.w / 2 - fromX) || fallbackDir;
    if (s.extraHits > 0 && !s.flying && !rollCrit()) { // 다크월드의 단단한 몬스터: 여러 번 때려야 쓰러진다
      s.extraHits -= 1;
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
    if (!w.elem) return;
    const T = C.TILE;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const near = (r) => monsters.filter((m) => m !== s && m.alive && !m.flying && m.appear <= 0 && Math.hypot(m.x + m.w / 2 - cx, m.y + m.h / 2 - cy) <= r);
    const dirFrom = (m) => Math.sign(m.x + m.w / 2 - cx) || away;
    if (w.elem === 'fire') { // 불타며 죽는다. 불이 주변으로 옮겨붙는다
      s.applyBurn();
      for (const m of near(T * 1.5)) m.applyBurn();
      effects.fireBurst(cx, cy);
    } else if (w.elem === 'ice') { // 얼어붙은 채 날아가 부서진다. 주변도 얼어붙는다
      if (s.flying) {
        s.frozen = true;
        s.deathStyle = 'ice';
      } else {
        s.freeze();
      }
      for (const m of near(T * 1.5)) m.freeze();
      effects.crystalShards(cx, cy);
    } else if (w.elem === 'crystal') { // 수정 파편이 주변 몬스터에게 피해
      for (const m of near(T * 1.5)) {
        m.damage(1);
        effects.crystalShards(m.x + m.w / 2, m.y + m.h / 2);
      }
      effects.crystalShards(cx, cy);
    } else if (w.elem === 'light') { // 빛이 퍼져 주변을 기절시킨다 (박쥐는 기절하지 않으니 피해 1)
      const r = (w.lightRadius || 3) * T;
      for (const m of near(r)) {
        if (m.twoHit && !m.staggered) m.stagger(dirFrom(m));
        else m.damage(1);
      }
      effects.lightBurst(cx, cy, r);
    } else if (w.elem === 'quake') { // 내리친 충격이 땅을 타고 퍼져 주변을 기절시킨다
      for (const m of near(T * 2.5)) if (m.onGround && m.twoHit && !m.staggered) m.stagger(dirFrom(m));
      effects.quakeDust(cx, s.y + s.h, T * 2.5);
    } else if (w.elem === 'thief') { // 맞힐 때마다 코인을 훔친다
      coins += 1;
      popups.push({ x: cx, y: s.y - 14, text: '+1 G', t: 1, color: 'rgba(255,213,74,A)' });
      G.Audio.play('coin');
    } else if (w.elem === 'cleave' && !cleaving) { // 같은 방향의 앞쪽 몬스터까지 함께 벤다
      cleaving = true;
      for (const m of near(T * 1.6)) if (dirFrom(m) === away && Math.abs(m.y + m.h / 2 - cy) < T) hitMonster(m, fromX, away);
      cleaving = false;
    } else if (w.elem === 'shadow') { // 그림자처럼 사라져 잠시 공격을 받지 않는다
      player.invuln = Math.max(player.invuln, 0.6);
      player.shadowTime = 0.6;
    }
  }

  // 지팡이 마법이 몬스터에 닿았을 때의 효과
  const magicHooks = {
    hit(m, el, dir, x, y, shot) {
      if (el === 'bomb' || el === 'icebomb') return; // 폭탄은 터질 때 피해를 준다 (explode)
      if (el === 'arrow' || el === 'bullet') {
        m.damage(shot && shot.dmg ? shot.dmg : 3);
        if (m.alive && m.twoHit && !m.staggered && m.stagger) m.stagger(dir);
        effects.parryHit(x, y);
        effects.shake(3, 0.1);
        return;
      }
      if (el === 'fire') {
        m.damage(C.FIRE_DAMAGE);
      } else if (el === 'poison') {
        m.applyPoison();
      } else { // 번개: 피해 + 기절(두 번 맞는 몬스터는 밀려나고 멍해진다)
        m.damage(C.LIGHTNING_DAMAGE);
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
    const needSt = it.stamina && stamina < C.STAMINA_MAX;
    if (!needLife && !needSt) return { ok: false, msg: it.food && it.stamina ? '피도 스태미나도 가득이에요.' : it.food ? '피가 가득 차 있어요.' : '스태미나가 가득 차 있어요.' };
    inv.consumables[id] -= 1;
    const parts = [];
    if (needLife) { const before = lives; lives = Math.min(maxLives(), lives + it.food); parts.push(`피 +${lives - before}`); }
    if (needSt) { const before = stamina; stamina = Math.min(C.STAMINA_MAX, stamina + it.stamina); parts.push(`스태미나 +${Math.round(stamina - before)}`); }
    G.Audio.play('pickup');
    return { ok: true, msg: `${it.name}: ${parts.join(', ')}` };
  }

  // V 키: 지금 가장 필요한 것을 먹는다 (스태미나가 모자라면 스태미나 물약, 피가 모자라면 음식)
  function eatBest() {
    const has = (id) => inv.consumables[id] > 0;
    const lowSt = stamina < C.STAMINA_MAX - 25;
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
    const gain = floor * 5 + (dungeon.bossKind ? 200 + floor * 5 : 0);
    exp += gain;
    darkBest = Math.max(darkBest, floor);
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

  function step(dt) {
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
    if (input.wasPressed('Digit1') || input.wasPressed('Numpad1')) {
      equipUI = { cur: Math.max(0, inv.items.indexOf(inv.equipped.weapon)), msg: '', msgT: 0, ok: true };
      G.Audio.play('pickup');
      input.endFrame();
      return;
    }
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
    if (input.wasPressed('KeyE')) { // 상점 열기 / 마을 사람과 대화
      const near = nearbyInteract();
      if (near && near.type === 'shop') {
        shop = { kind: near.shop.kind, def: G.Shop.SHOPS[near.shop.kind], tab: 0, hover: -1, msg: '', msgT: 0, ok: true };
        G.Audio.play('pickup');
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
        if (near.stage === 'dungeon') darkFloor = Math.min(C.DUNGEON_FLOORS, darkBest + 1); // 지금까지 오른 곳 바로 위층부터
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
    if (staminaWait === 0) stamina = Math.min(C.STAMINA_MAX, stamina + C.STAMINA_REGEN * dt);
    if (input.dashPressedThisFrame && stamina < C.DASH_STAMINA) { // 스태미나가 모자라면 대시가 안 나간다
      input.dashPressedThisFrame = false;
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '스태미나 부족!', t: 0.8, color: 'rgba(255,170,170,A)' });
      G.Audio.play('deny');
    }
    if (input.wasPressed('KeyB')) throwIceBomb();
    if (input.wasPressed('KeyV')) eatBest();
    player.update(dt, input, terrain);
    if (player.dashFx) { // 대시 시작: 먼지 + 바람 소리
      player.dashFx = false;
      stamina -= C.DASH_STAMINA;
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
      effects.swing(player.x + player.w / 2, player.y + player.h / 2, player.facing);
      const weaponDef = G.Shop.ITEMS[inv.equipped.weapon];
      if (weaponDef.shot) { // 폭탄/총/활: 패링 버튼을 누를 때마다 쏜다 (스태미나가 든다)
        if (stamina < weaponDef.stamina) {
          popups.push({ x: player.x + player.w / 2, y: player.y - 14, text: '스태미나 부족!', t: 0.8, color: 'rgba(255,170,170,A)' });
          G.Audio.play('deny');
        } else {
          stamina -= weaponDef.stamina;
          staminaWait = 0.8;
          const h = player.hand;
          G.Magic.cast(magic, weaponDef.shot, h.x + player.facing * 26, h.y - 2, player.facing, terrain, magicTargets(), magicHooks, { dmg: weaponDef.dmg, radius: (weaponDef.radius || 0) * C.TILE, pierce: weaponDef.pierce, count: weaponDef.count });
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
        const drop = Math.round(base * floorMul * (G.Shop.ITEMS[inv.equipped.weapon].elem === 'gold' ? 1.5 : 1) * (1 + G.Shop.homeBonuses(inv).coin)); // 황금 검은 코인 +50%, 집 장식 보너스
        if (drop) {
          coins += drop;
          popups.push({ x: s.x + s.w / 2, y: s.y - 6, text: `+${drop} G`, t: 1.2 });
          G.Audio.play('coin');
        }
        const gain = Math.round(({ slime: C.SLIME_EXP, bat: C.BAT_EXP, crab: C.CRAB_EXP, golem: C.GOLEM_EXP, darkstone: C.DARKSTONE_EXP, shade: C.SHADE_EXP }[s.kind] || 0) * (STAGES[stageName].dark ? 1 + darkFloor * 0.1 : 1)); // 경험치: 슬라임 1, 박쥐 2, 꽃게 3, 흙골렘 3 (던전은 층마다 늘어난다)
        if (STAGES[stageName].dark && !s.noExp && Math.random() < 0.07) pickups.push({ x: s.x + s.w / 2, y: s.y + s.h - 16, id: PICKUP_TABLE[Math.floor(Math.random() * PICKUP_TABLE.length)], t: 0 }); // 가끔 아이템을 떨어뜨린다
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
      if (player.parrying && s.hitGrace <= 0 && (!finisher || player.swing >= C.SWING_SLASH_FRAME) && s.overlaps(parryBox(player))) {
        hitMonster(s, player.x + player.w / 2, player.facing);
        if (!finisher) player.parrySucceeded(); // 밀어내는 첫 타(패링)만 가드 자세를 취한다
        G.Audio.play('parry');
        effects.parryHit((player.x + player.w / 2 + s.x + s.w / 2) / 2, (player.y + player.h / 2 + s.y + s.h / 2) / 2);
        effects.shake(finisher ? 8 : 6, 0.18);
        hitStop = C.HIT_STOP;
      } else if (player.invuln === 0 && !player.dashing && !s.staggered && s.overlaps(player)) { // 기절한 몬스터는 해롭지 않다
        loseLife(player.x + player.w / 2, player.y + player.h / 2, s.contactDmg || 1); // 패링하지 못하고 닿으면 목숨 -1 (설산은 -2)
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
      if (player.parrying && player.swing >= C.SWING_SLASH_FRAME) { // 기절했거나 땅에 박힌 머리를 벤다
        for (const h of hitBoss(box)) {
          G.Audio.play('parry');
          effects.parryHit(h.cx, h.cy);
          effects.shake(6, 0.15);
          hitStop = C.HIT_STOP;
        }
      }
      boss.update(dt, player);
      for (const h of boss.heads) {
        if (h.dmgFx) {
          popups.push({ x: h.cx, y: h.y - 10, text: `-${h.dmgFx}`, t: 0.9, color: 'rgba(255,107,107,A)' });
          h.dmgFx = 0;
        }
      }
    }
    updateEnemyShots(dt);
    updatePickups(dt);
    if (chest && !won && stageName === 'dungeon' && player.overlaps(chest)) { // 던전: 위층으로 오르는 계단
      clearFloor();
      input.endFrame();
      return;
    }
    if (chest && !won && player.overlaps(chest)) { // 보물 발견!
      won = true;
      wonTime = 0;
      const cd = STAGES[stageName].chest;
      const reward = Math.round(cd.coins * (1 + G.Shop.homeBonuses(inv).coin)); // 집 장식 보너스
      ending = new G.Ending(cd.mode, reward, cd.exp || 0);
      nextStage = { name: cd.next, near: cd.near };
      if (!STAGES[stageName].repeatChest) chestTaken[stageName] = true;
      if (stageName === 'mine') { // 동굴을 15번 클리어하면 시크너의 이야기가 시작된다
        story.caves += 1;
        if (story.caves >= C.CAVE_CLEARS_FOR_STORY && !story.revealed && !story.pending) story.pending = true;
      }
      coins += reward;
      exp += cd.exp || 0;
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
    const banner = st.banner && stageTime < st.banner.dur && !shop && !equipUI ? Object.assign({ t: stageTime }, st.banner) : null;
    const near = !shop && !equipUI && !dialog && !won && !cutscene ? nearbyInteract() : null;
    const PROMPTS = { talk: 'E: 대화', enter: 'E: 동굴로 들어가기', exit: stageName === 'home' ? 'E: 밖으로 나가기 (마을)' : 'E: 마을로 나가기', home: inv.home.type ? 'E: 우리 집으로 들어가기' : 'E: 빈 터 (부동산에서 집을 살 수 있어요)' };
    const prompt = near ? (near.type === 'shop' ? `E: ${G.Shop.SHOPS[near.shop.kind].title} 열기` : near.type === 'gate' ? `E: ${STAGES[near.stage].label}(으)로 들어가기` : near.type === 'slot' ? (near.slot.kind === 'floor' ? 'E: 바닥 가구 놓기 / 치우기' : 'E: 벽 장식 걸기 / 치우기') : PROMPTS[near.type]) : null;
    const slotItem = shop && shop.mode === 'place' ? inv.home.placed[shop.slot.kind][shop.slot.index] || null : null;
    const shopView = shop ? Object.assign({}, shop, { coins, lives, maxLives: maxLives(), inv, slotItem }) : null;
    const equipView = equipUI ? Object.assign({}, equipUI, { inv, lives, maxLives: maxLives(), coins, bonus: Object.assign({ critDamage: G.Shop.critDamage(inv) }, G.Shop.homeBonuses(inv)) }) : null;
    const house = terrain.houses[0];
    const npcs = ending && ending.mode === 'house' && house ? [{ kind: 'elder', x: house.col * C.TILE + C.TILE / 2 + 44, y: (house.row + 1) * C.TILE, facing: -1, alpha: ending.npcAlpha }] : [];
    renderer.draw(terrain, player, camera, monsters, effects, {
      lives, maxLives: maxLives(), coins, exp, potions: inv.potions, gameOver,
      stamina, staminaMax: C.STAMINA_MAX, consumables: inv.consumables,
      home: stageName === 'home' ? Object.assign({ total: G.Home.houseDef(inv.home.type).floor + G.Home.houseDef(inv.home.type).wall }, G.Shop.homeBonuses(inv)) : null,
      slimeCount: monsters.filter((m) => m.kind === 'slime' && m.alive).length,
      batCount: monsters.filter((m) => m.kind === 'bat' && m.alive).length,
      crabCount: monsters.filter((m) => m.kind === 'crab' && m.alive).length,
      summon: !!st.summon, monsterless: !!st.monsterless,
      canRestart: gameOver && gameOverTime >= C.GAME_OVER_DELAY,
      won, cutscene: !!cutscene, goal: st.goal, banner, prompt, dialog, shop: shopView, equip: equipView, boss: bossOn() ? boss : null,
    }, sword, { cutscene, chest, ending, npcs, popups, magic, boss: bossOn() ? boss : null, pickups, enemyShots, darken: stageName === 'village' && story.revealed && !story.cleared ? 0.42 : 0 });
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
    story, pickups, enemyShots,
    get darkFloor() { return darkFloor; },
    set darkFloor(v) { darkFloor = v; },
    get darkBest() { return darkBest; },
    get dialog_() { return dialog; },
    get coins() { return coins; },
    get exp() { return exp; },
    set coins(v) { coins = v; },
    get shop() { return shop; },
    get equip() { return equipUI; },
    get inv() { return inv; },
    get maxLives() { return maxLives(); },
    applyEquipment, enterMine, magic,
    get mineRun() { return mineRun; },
    get dialog() { return dialog; },
    get chest() { return chest; },
    get boss() { return boss; },
  };
})(window.Game);
