// 진입점: 모듈을 조립하고 고정 스텝 게임 루프를 돌린다.
(function (G) {
  const C = G.Config;

  const canvas = document.getElementById('game');
  const input = new G.Input(window);
  const terrain = new G.Terrain(G.Levels.level1);
  const renderer = new G.Renderer(canvas, C.VIEW_W, C.VIEW_H);
  const camera = new G.Camera(C.VIEW_W, C.VIEW_H);

  const spawn = terrain.spawnFor(C.PLAYER_W, C.PLAYER_H);
  const player = new G.Player(spawn.x, spawn.y);
  camera.follow(player, terrain, C.DT, true);

  function respawn() {
    player.respawn(spawn.x, spawn.y);
    camera.follow(player, terrain, C.DT, true);
  }

  function step(dt) {
    if (input.down.has('KeyR')) respawn();
    player.update(dt, input, terrain);
    if (player.y > terrain.height + C.TILE * 2) respawn(); // 구덩이 낙사
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
    renderer.draw(terrain, player, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 테스트/디버그용 노출
  G.state = { terrain, player, camera, input, step };
})(window.Game);
