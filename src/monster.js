// 몬스터 공통 기반: 플레이어와 같은 Body 충돌 판정 + 패링에 맞는 생애주기.
//   살아 있음 -> 패링/검에 맞아 날아감(flying) -> 벽/땅/천장에 닿으면 폭발(죽음) -> 일정 시간 뒤 제자리에서 부활
// 슬라임·박쥐처럼 종류별 AI는 서브클래스가 update()에서 tickLifecycle()을 먼저 호출한 뒤 구현한다.
(function (G) {
  const C = G.Config;

  class Monster extends G.Body {
    constructor(x, y, w, h, kind) {
      super(x, y, w, h);
      this.kind = kind;
      this.home = { x, y };
      this.dir = -1;
      this.chasing = false;
      this.flying = false;     // 패링에 맞아 날아가는 중 (조종 불가, 해롭지 않음)
      this.flightTime = 0;
      this.spin = 0;           // 날아갈 때 회전 연출용
      this.alive = true;
      this.respawnTimer = 0;   // 죽은 뒤 부활까지 남은 시간
      this.appear = 0;         // >0 이면 부활 직후 나타나는 중 (해롭지 않음)
      this.vanished = false;   // 방금 터졌음을 main에 알리는 1회성 플래그 (이펙트용)
      this.respawned = false;  // 방금 부활했음을 main에 알리는 1회성 플래그
      this.time = Math.random() * 10; // 개체마다 움직임 박자를 다르게
    }

    // 처음 상태로 되돌린다 (플레이어 리스폰·부활 시에도 사용). 서브클래스가 확장한다.
    reset() {
      this.x = this.home.x;
      this.y = this.home.y;
      this.vx = 0;
      this.vy = 0;
      this.flying = false;
      this.alive = true;
      this.respawnTimer = 0;
      this.appear = 0;
    }

    // 패링으로 튕겨냄: dirX 방향으로 날아간다
    knockback(dirX) {
      this.vx = dirX * C.PARRY_KNOCK_VX;
      this.vy = -C.PARRY_KNOCK_VY;
      this.onGround = false;
      this.flying = true;
      this.flightTime = 0;
      this.dir = -dirX; // 맞은 방향을 바라봄
    }

    // 죽음/부활/날아가는 중 처리. true를 반환하면 이번 프레임의 평소 AI는 건너뛴다.
    tickLifecycle(dt, terrain) {
      if (!this.alive) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.reset();
          this.appear = C.SLIME_APPEAR_TIME;
          this.respawned = true;
        }
        return true;
      }
      this.appear = Math.max(0, this.appear - dt);

      if (this.flying) {
        this.flightTime += dt; // 조종 불가: 포물선으로 날아감
        this.applyGravity(dt, 1);
        this.moveX(dt, terrain);
        this.moveY(dt, terrain);
        this.spin += dt * 18 * Math.sign(this.vx || 1);
        // 벽/땅/천장에 닿으면 폭발. 구덩이로 떨어지거나 너무 오래 날아도 폭발
        const hit = this.hitWall || this.hitCeiling || this.onGround;
        if (hit || this.flightTime > C.PARRY_MAX_FLIGHT || this.y > terrain.height) this._die();
        return true;
      }
      return false;
    }

    _die() {
      this.alive = false;
      this.flying = false;
      this.spin = 0;
      this.vanished = true;
      this.respawnTimer = C.SLIME_RESPAWN_TIME;
    }
  }

  G.Monster = Monster;
})(window.Game);
