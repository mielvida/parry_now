// 진입점: 모듈을 조립하고 고정 스텝 게임 루프를 돌린다.
(function (G) {
  const C = G.Config;

  const canvas = document.getElementById('game');
  const input = new G.Input(window);
  const renderer = new G.Renderer(canvas, C.VIEW_W, C.VIEW_H);
  const camera = new G.Camera(C.VIEW_W, C.VIEW_H);
  const effects = new G.Effects();

  // 마을 동굴은 들어갈 때마다 새로 생성된다 (mineRun번째 탐험일수록 길고, 상자 코인도 늘어난다)
  let mineRun = 0;
  let mineLevel = null;
  const mineCoins = () => C.MINE_COINS + C.MINE_COINS_PER_RUN * Math.max(0, mineRun - 1);
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
    mine: {
      music: 'cave',
      get level() { return mineLevel; },
      theme: G.Cave, summon: true, repeatChest: true, // 상자는 들어갈 때마다 다시 나온다
      get goal() { return `목표: 동굴 맨 끝의 보물 상자 (+${mineCoins()} G). 돌아가려면 입구의 출구에서 E`; },
      chest: { mode: 'mine', get coins() { return mineCoins(); }, next: 'village', near: 'D' },
      get banner() {
        return { title: '마을 동굴', sub: `${mineRun}번째 탐험 · 길이 ${mineLevel[0].length}칸`, dur: 3.5, caption: '…동굴 안은 어둡고, 슬라임과 박쥐의 기척이 느껴진다.' };
      },
    },
  };

  // 마을 사람의 대사 (E 키로 말을 걸 때마다 마을 사람 순서대로 하나씩)
  const VILLAGER_LINES = [
    '마을 사람: "이 마을엔 몬스터가 없어서 평화롭지."',
    '마을 사람: "물약 가게에서 체력을 회복할 수 있다네."',
    '마을 사람: "무기 상점엔 검 말고도 대검과 지팡이가 있다네."',
    '마을 사람: "해변의 꽃게를 잡으면 코인을 떨어뜨린다더군."',
    '마을 사람: "마을 오른쪽 끝 동굴엔 보물이 있지만, 슬라임과 박쥐가 득시글하다네."',
    '마을 사람: "갑옷 가게엔 투구와 장갑, 신발도 있지. 1 키로 장비를 바꿀 수 있다네."',
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
  let hitStop = 0; // >0 이면 게임 로직을 잠시 멈춤 (패링 타격감)

  const player = new G.Player(0, 0);
  // 몬스터 전체(슬라임 + 박쥐). 패링·검·접촉 판정은 종류와 무관하게 똑같이 적용된다
  const monsters = [];
  const slimeCount = () => monsters.filter((m) => m.kind === 'slime').length;

  // 스테이지를 처음 상태로 불러온다 (지형, 몬스터, 목숨, 플레이어, 카메라)
  // keepLives=false(기본)면 목숨을 가득 채우고 시작한다. 코인과 산 검은 항상 유지된다
  // near='D'면 마을의 동굴 입구 앞에서 시작한다 (동굴에서 돌아올 때)
  function loadStage(name, keepLives = false, near = null) {
    stageName = name;
    if (name === 'mine' && !mineLevel) { // ?stage=mine 처럼 입구를 거치지 않고 바로 온 경우
      mineRun = 1;
      mineLevel = G.MineGen.generate(1);
    }
    const st = STAGES[name];
    G.Audio.setMusic(st.music || 'cave'); // 마을은 활기찬 노래, 나머지는 동굴 곡
    terrain = new G.Terrain(st.level);
    renderer.theme = st.theme;
    spawn = terrain.spawnFor(C.PLAYER_W, C.PLAYER_H);
    if (near === 'D' && terrain.caveEntrances[0]) {
      const d = terrain.caveEntrances[0];
      spawn = terrain.placeOnTile(d.col - 2, d.row, C.PLAYER_W, C.PLAYER_H);
    }

    chest = terrain.treasure && !chestTaken[name] ? Object.assign(terrain.placeOnTile(terrain.treasure.col, terrain.treasure.row, C.CHEST_W, C.CHEST_H), { w: C.CHEST_W, h: C.CHEST_H, open: 0 }) : null;
    const house = terrain.houses[0];
    goalBox = house && st.goalHouse ? { x: house.col * C.TILE - C.TILE / 2, y: (house.row - 1) * C.TILE, w: C.TILE * 2, h: C.TILE * 2 } : null;

    monsters.length = 0;
    for (const s of terrain.slimeSpawns) {
      const p = terrain.placeOnTile(s.col, s.row, C.SLIME_W, C.SLIME_H);
      monsters.push(new G.Slime(p.x, p.y));
    }
    for (const b of terrain.batSpawns) {
      const p = terrain.centerOnTile(b.col, b.row, C.BAT_W, C.BAT_H);
      monsters.push(new G.Bat(p.x, p.y));
    }
    for (const cr of terrain.crabSpawns) {
      const p = terrain.placeOnTile(cr.col, cr.row, C.CRAB_W, C.CRAB_H);
      monsters.push(new G.Crab(p.x, p.y));
    }
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
    player.respawn(spawn.x, spawn.y);
    camera.follow(player, terrain, C.DT, true);
  }

  // 낀 장비를 플레이어에게 반영: 무기(던지기 거리/쿨다운, 패링 범위는 parryBox가), 갑옷(최대 피),
  // 장갑(패링 지속 시간), 신발(이동 속도), 그리고 그림용 장비 id
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
    player.speedMult = 1 + equipStats.speedAdd;
    lives = Math.min(lives, maxLives()); // 갑옷을 벗어 최대 피가 줄면 넘치는 피는 사라진다
  }

  const startParam = new URLSearchParams(window.location.search).get('stage');
  loadStage(STAGES[startParam] ? startParam : 'cave');
  applyEquipment();

  // 오프닝 컷신 (동굴에서 처음 한 번만. 끝나거나 건너뛰면 null)
  let cutscene = C.INTRO_CUTSCENE && stageName === 'cave' ? new G.Cutscene(terrain, player) : null;

  // 화면 크기: 창에 맞춰 늘어난 만큼 내부 해상도도 올린다 (최대 4배). F 키로 전체화면
  function fitCanvas() {
    const cssW = Math.min(window.innerWidth, (window.innerHeight * C.VIEW_W) / C.VIEW_H);
    const s = Math.max(1, Math.min(4, Math.ceil((cssW * (window.devicePixelRatio || 1)) / C.VIEW_W)));
    if (s !== renderer.scale) renderer.setScale(s);
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
    } else if (e.code === 'KeyF') { // 전체화면 켜기/끄기
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } else if (e.code === 'Digit8' || e.code === 'Numpad8') {
      coins += 1000;
    }
  });

  // 슬라임 대량 소환: 서 있을 수 있는 바닥 중 플레이어 시야 밖인 곳에 무작위로 배치
  function spawnSlimes(n) {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const pool = spots.filter((s) => {
      const p = terrain.placeOnTile(s.col, s.row, C.SLIME_W, C.SLIME_H);
      return Math.abs(p.x - px) > C.SLIME_SIGHT_X + C.TILE * 2 || Math.abs(p.y - py) > C.SLIME_SIGHT_Y + C.TILE * 2;
    });
    if (pool.length === 0) return 0;
    const count = Math.min(n, C.SLIME_MAX - slimeCount());
    for (let i = 0; i < count; i++) {
      const s = pool[Math.floor(Math.random() * pool.length)];
      const p = terrain.placeOnTile(s.col, s.row, C.SLIME_W, C.SLIME_H);
      const slime = new G.Slime(p.x, p.y);
      slime.appear = C.SLIME_APPEAR_TIME;
      slime.noCoin = true; // 소환한 슬라임은 코인을 주지 않는다 (코인 노가다 방지)
      slime.dir = Math.random() < 0.5 ? -1 : 1;
      monsters.push(slime);
      effects.spawn(p.x + C.SLIME_W / 2, p.y + C.SLIME_H);
    }
    if (count > 0) G.Audio.play('spawn');
    return count;
  }

  function respawn() {
    player.respawn(spawn.x, spawn.y);
    sword = null;
    monsters.forEach((m) => m.reset());
    camera.follow(player, terrain, C.DT, true);
  }

  // 목숨 하나를 잃는다. 그 자리에 그대로 있고 잠시 무적. 목숨이 없으면 게임오버
  function loseLife(cx, cy) {
    if (player.cancelCharge()) effects.chargeBreak(cx, cy); // 맞으면 충전 게이지가 풀린다
    effects.playerHit(cx, cy);
    effects.shake(9, 0.3);
    lives -= 1;
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
  function buyItem(item) {
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
  function hitMonster(s, fromX, fallbackDir) {
    const away = Math.sign(s.x + s.w / 2 - fromX) || fallbackDir;
    if (s.twoHit && !s.staggered && !killsInOne()) s.stagger(away);
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
    hit(m, el, dir, x, y) {
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
  };

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
    if (dialog) {
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
      } else if (near && near.type === 'enter') { // 마을 동굴로
        enterMine();
        input.endFrame();
        return;
      } else if (near && near.type === 'exit') { // 마을로 (동굴 입구 앞에서 시작)
        loadStage('village', true, 'D');
        input.endFrame();
        return;
      } else if (near) {
        dialog = { text: VILLAGER_LINES[near.index % VILLAGER_LINES.length], t: 4 };
      }
    }
    if (input.wasPressed('KeyQ')) { // 게임 중 바로 물약 마시기
      const id = G.Shop.bestPotion(inv, lives, maxLives());
      let text = lives >= maxLives() ? '피가 가득 차 있어요' : '마실 물약이 없어요';
      if (id) text = `피 +${drinkPotion(id).healed}`;
      else G.Audio.play('deny');
      popups.push({ x: player.x + player.w / 2, y: player.y - 14, text, t: 1.2, color: id ? 'rgba(125,255,160,A)' : 'rgba(255,170,170,A)' });
    }
    if (input.spawnPressed && STAGES[stageName].summon) spawnSlimes(C.SLIME_SPAWN_BATCH);
    if (input.down.has('KeyR')) respawn(); // 막혔을 때 쓰는 무료 리스폰 (목숨 소모 없음)
    player.update(dt, input, terrain);
    if (player.dashFx) { // 대시 시작: 먼지 + 바람 소리
      player.dashFx = false;
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
    G.Magic.update(magic, dt, terrain, monsters, magicHooks);
    if (player.swingFx) { // 검을 휘두르기 시작하는 순간 바람 이펙트
      player.swingFx = false;
      effects.swing(player.x + player.w / 2, player.y + player.h / 2, player.facing);
      const weaponDef = G.Shop.ITEMS[inv.equipped.weapon];
      if (weaponDef.element) { // 지팡이: 패링할 때마다 지팡이 끝에서 원소가 나간다
        const el = G.Magic.pickElement(weaponDef.element);
        const h = player.hand;
        G.Magic.cast(magic, el, h.x + player.facing * 34, h.y, player.facing, terrain, monsters, magicHooks);
        G.Audio.play(el === 'lightning' ? 'zap' : el);
      }
    }
    for (const s of monsters) {
      s.update(dt, player, terrain);
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
        const base = s.kind === 'crab' ? C.CRAB_COIN : s.kind === 'slime' && !s.noCoin ? C.SLIME_COIN : 0; // 슬라임 5, 꽃게 8
        const drop = Math.round(base * (G.Shop.ITEMS[inv.equipped.weapon].elem === 'gold' ? 1.5 : 1)); // 황금 검은 코인 +50%
        if (drop) {
          coins += drop;
          popups.push({ x: s.x + s.w / 2, y: s.y - 6, text: `+${drop} G`, t: 1.2 });
          G.Audio.play('coin');
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
        loseLife(player.x + player.w / 2, player.y + player.h / 2); // 패링하지 못하고 닿으면 목숨 -1
        break;
      }
    }
    if (chest && !won && player.overlaps(chest)) { // 보물 발견!
      won = true;
      wonTime = 0;
      const cd = STAGES[stageName].chest;
      ending = new G.Ending(cd.mode, cd.coins);
      nextStage = { name: cd.next, near: cd.near };
      if (!STAGES[stageName].repeatChest) chestTaken[stageName] = true;
      coins += cd.coins;
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
  function frame(now) {
    acc += Math.min((now - last) / 1000, 0.1); // 탭 전환 후 폭주 방지
    last = now;
    while (acc >= C.DT) {
      step(C.DT);
      acc -= C.DT;
    }
    render();
    requestAnimationFrame(frame);
  }

  function render() {
    const st = STAGES[stageName];
    const banner = st.banner && stageTime < st.banner.dur && !shop && !equipUI ? Object.assign({ t: stageTime }, st.banner) : null;
    const near = !shop && !equipUI && !dialog && !won && !cutscene ? nearbyInteract() : null;
    const PROMPTS = { talk: 'E: 대화', enter: 'E: 동굴로 들어가기', exit: 'E: 마을로 나가기' };
    const prompt = near ? (near.type === 'shop' ? `E: ${G.Shop.SHOPS[near.shop.kind].title} 열기` : PROMPTS[near.type]) : null;
    const shopView = shop ? Object.assign({}, shop, { coins, lives, maxLives: maxLives(), inv }) : null;
    const equipView = equipUI ? Object.assign({}, equipUI, { inv, lives, maxLives: maxLives(), coins }) : null;
    const house = terrain.houses[0];
    const npcs = ending && ending.mode === 'house' && house ? [{ kind: 'elder', x: house.col * C.TILE + C.TILE / 2 + 44, y: (house.row + 1) * C.TILE, facing: -1, alpha: ending.npcAlpha }] : [];
    renderer.draw(terrain, player, camera, monsters, effects, {
      lives, maxLives: maxLives(), coins, potions: inv.potions, gameOver,
      slimeCount: monsters.filter((m) => m.kind === 'slime' && m.alive).length,
      batCount: monsters.filter((m) => m.kind === 'bat' && m.alive).length,
      crabCount: monsters.filter((m) => m.kind === 'crab' && m.alive).length,
      summon: !!st.summon, monsterless: !!st.monsterless,
      canRestart: gameOver && gameOverTime >= C.GAME_OVER_DELAY,
      won, cutscene: !!cutscene, goal: st.goal, banner, prompt, dialog, shop: shopView, equip: equipView,
    }, sword, { cutscene, chest, ending, npcs, popups, magic });
  }
  requestAnimationFrame(frame);

  // 테스트/디버그용 노출
  G.state = {
    player, monsters, camera, input, step, effects, render, loadStage,
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
    get coins() { return coins; },
    set coins(v) { coins = v; },
    get shop() { return shop; },
    get equip() { return equipUI; },
    get inv() { return inv; },
    get maxLives() { return maxLives(); },
    applyEquipment, enterMine, magic,
    get mineRun() { return mineRun; },
    get dialog() { return dialog; },
    get chest() { return chest; },
  };
})(window.Game);
