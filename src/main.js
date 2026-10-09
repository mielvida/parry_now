// 진입점: 모듈을 조립하고 고정 스텝 게임 루프를 돌린다.
(function (G) {
  const C = G.Config;

  const canvas = document.getElementById('game');
  const input = new G.Input(window);
  const terrain = new G.Terrain(G.Levels.level1);
  const renderer = new G.Renderer(canvas, C.VIEW_W, C.VIEW_H);
  const camera = new G.Camera(C.VIEW_W, C.VIEW_H);
  const effects = new G.Effects();
  let lives = C.PLAYER_LIVES;
  let gameOver = false;
  let gameOverTime = 0;
  let sword = null; // 던진 검 (없으면 null)
  let won = false;       // 보물을 찾았다 (엔딩)
  let wonTime = 0;
  let hitStop = 0; // >0 이면 게임 로직을 잠시 멈춤 (패링 타격감)

  const spawn = terrain.spawnFor(C.PLAYER_W, C.PLAYER_H);
  const player = new G.Player(spawn.x, spawn.y);
  camera.follow(player, terrain, C.DT, true);

  // 보물 상자: 지도의 X. 닿으면 엔딩
  const chest = terrain.treasure ? Object.assign(terrain.placeOnTile(terrain.treasure.col, terrain.treasure.row, C.CHEST_W, C.CHEST_H), { w: C.CHEST_W, h: C.CHEST_H, open: 0 }) : null;

  // 오프닝 컷신 (처음 한 번만. 끝나거나 건너뛰면 null)
  let cutscene = C.INTRO_CUTSCENE ? new G.Cutscene(terrain, player) : null;

  // 몬스터 전체(슬라임 + 박쥐). 패링·검·접촉 판정은 종류와 무관하게 똑같이 적용된다
  const monsters = [];
  for (const s of terrain.slimeSpawns) {
    const p = terrain.placeOnTile(s.col, s.row, C.SLIME_W, C.SLIME_H);
    monsters.push(new G.Slime(p.x, p.y));
  }
  for (const b of terrain.batSpawns) {
    const p = terrain.centerOnTile(b.col, b.row, C.BAT_W, C.BAT_H);
    monsters.push(new G.Bat(p.x, p.y));
  }
  const baseMonsterCount = monsters.length;
  const slimeCount = () => monsters.filter((m) => m.kind === 'slime').length;
  const spots = terrain.standingSpots();

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
      slime.dir = Math.random() < 0.5 ? -1 : 1;
      monsters.push(slime);
      effects.spawn(p.x + C.SLIME_W / 2, p.y + C.SLIME_H);
    }
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
    if (lives <= 0) {
      gameOver = true;
      gameOverTime = 0;
    } else {
      player.invuln = C.PLAYER_INVULN;
    }
  }

  function restart() {
    lives = C.PLAYER_LIVES;
    gameOver = false;
    won = false;
    if (chest) chest.open = 0;
    monsters.length = baseMonsterCount; // 새 게임이면 소환한 슬라임은 정리
    respawn();
  }

  // 패링 판정 범위: 플레이어 몸을 PARRY_REACH만큼 키운 사각형
  function parryBox(p) {
    const r = C.PARRY_REACH;
    return { x: p.x - r, y: p.y - r, w: p.w + r * 2, h: p.h + r * 2 };
  }

  // 던진 검: 날아가며 몬스터를 쳐내고, 돌아오면 플레이어가 다시 잡는다
  function updateSword(dt) {
    sword.update(dt, player.hand);
    for (const s of monsters) {
      if (!s.alive || s.flying || s.appear > 0 || !s.overlaps(sword.box)) continue;
      const away = Math.sign(s.x + s.w / 2 - sword.x) || sword.dir;
      s.knockback(away);
      effects.parryHit((sword.x + s.x + s.w / 2) / 2, (sword.y + s.y + s.h / 2) / 2);
      effects.shake(5, 0.15);
      hitStop = C.HIT_STOP;
    }
    if (sword.done) {
      sword = null;
      player.swordOut = false;
      const h = player.hand;
      effects.swordCatch(h.x, h.y);
    }
  }

  function step(dt) {
    effects.update(dt);
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
    if (won) { // 엔딩: 상자가 열리고 화면은 정지, 잠시 뒤 Enter로 다시 시작
      wonTime += dt;
      if (chest) chest.open = Math.min(1, chest.open + dt * 3);
      if (wonTime >= C.GAME_OVER_DELAY + 0.5 && input.parryPressed) restart();
      input.endFrame();
      return;
    }
    if (gameOver) { // 게임오버: 화면은 정지, 잠시 뒤 Enter로 새로 시작
      gameOverTime += dt;
      if (gameOverTime >= C.GAME_OVER_DELAY && input.parryPressed) restart();
      input.endFrame();
      return;
    }
    if (input.spawnPressed) spawnSlimes(C.SLIME_SPAWN_BATCH);
    if (input.down.has('KeyR')) respawn(); // 막혔을 때 쓰는 무료 리스폰 (목숨 소모 없음)
    player.update(dt, input, terrain);
    if (player.chargeReadyFx) { // 게이지가 가득 참
      player.chargeReadyFx = false;
      effects.chargeReady(player.x + player.w / 2, player.y + player.h / 2);
    }
    if (player.throwSword) { // 게이지를 채운 뒤 손을 떼어 검을 던지는 순간
      player.throwSword = false;
      const h = player.hand;
      sword = new G.Sword(h.x, h.y, player.facing, player.throwTiles);
      effects.swordThrow(h.x, h.y, player.facing);
      effects.shake(3, 0.1);
    }
    if (sword) updateSword(dt);
    if (player.swingFx) { // 검을 휘두르기 시작하는 순간 바람 이펙트
      player.swingFx = false;
      effects.swing(player.x + player.w / 2, player.y + player.h / 2, player.facing);
    }
    for (const s of monsters) {
      s.update(dt, player, terrain);
      if (s.vanished) { // 날아가던 몬스터가 벽/땅에 닿아 터지는 순간
        s.vanished = false;
        effects.vanish(s.x + s.w / 2, s.y + s.h / 2);
        continue;
      }
      if (s.respawned) { // 부활하는 순간
        s.respawned = false;
        effects.spawn(s.x + s.w / 2, s.y + s.h);
      }
      if (!s.alive || s.flying || s.appear > 0) continue; // 죽었거나, 날아가는 중이거나, 나타나는 중엔 해롭지 않다
      if (player.parrying && s.overlaps(parryBox(player))) {
        const away = Math.sign(s.x + s.w / 2 - (player.x + player.w / 2)) || player.facing;
        s.knockback(away); // 패링 성공
        player.parrySucceeded();
        effects.parryHit((player.x + player.w / 2 + s.x + s.w / 2) / 2, (player.y + player.h / 2 + s.y + s.h / 2) / 2);
        effects.shake(6, 0.18);
        hitStop = C.HIT_STOP;
      } else if (player.invuln === 0 && s.overlaps(player)) {
        loseLife(player.x + player.w / 2, player.y + player.h / 2); // 패링하지 못하고 닿으면 목숨 -1
        break;
      }
    }
    if (chest && !won && player.overlaps(chest)) { // 보물 발견!
      won = true;
      wonTime = 0;
      effects.treasure(chest.x + chest.w / 2, chest.y);
      effects.shake(8, 0.35);
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
    renderer.draw(terrain, player, camera, monsters, effects, { lives, maxLives: C.PLAYER_LIVES, gameOver, slimeCount: monsters.filter((m) => m.kind === 'slime' && m.alive).length, batCount: monsters.filter((m) => m.kind === 'bat' && m.alive).length, canRestart: (gameOver && gameOverTime >= C.GAME_OVER_DELAY) || (won && wonTime >= C.GAME_OVER_DELAY + 0.5), won, cutscene: !!cutscene }, sword, { cutscene, chest });
  }
  requestAnimationFrame(frame);

  // 테스트/디버그용 노출
  G.state = {
    terrain, player, monsters, baseMonsterCount, camera, input, step, effects, render,
    get slimes() { return monsters.filter((m) => m.kind === 'slime'); },
    get bats() { return monsters.filter((m) => m.kind === 'bat'); },
    get lives() { return lives; },
    get gameOver() { return gameOver; },
    get sword() { return sword; },
    get won() { return won; },
    get cutscene() { return cutscene; },
    chest,
  };
})(window.Game);
