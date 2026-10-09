// 꽃게: 해변에서 옆걸음으로 어슬렁거리다가, 플레이어가 가까이 오면 집게를 치켜들고(예비동작) 옆으로 돌진한다.
// 돌진은 패링/점프로 받아낼 수 있고, 돌진이 끝나면 한동안 쉰다. 패링에 맞은 뒤의 생애주기는 Monster 공통.
(function (G) {
  const C = G.Config;

  class Crab extends G.Monster {
    constructor(x, y) {
      super(x, y, C.CRAB_W, C.CRAB_H, 'crab');
      this.twoHit = true; // 첫 타에 밀려나 기절, 다시 맞으면 죽는다
      this.reset();
    }

    reset() {
      super.reset();
      this.state = 'walk';   // walk | windup | dash
      this.timer = 0;        // windup/dash 남은 시간
      this.cooldown = 1;     // 돌진 후 다음 돌진까지 대기
      this.pause = 0;        // 순찰 중 멈춰 서 있는 시간
      this.attackFx = false; // 예비동작을 시작한 순간 켜지는 1회성 플래그 (효과음용)
    }

    knockback(dirX) {
      super.knockback(dirX);
      this.state = 'walk';
      this.cooldown = C.CRAB_COOLDOWN;
    }

    stagger(dirX) {
      super.stagger(dirX);
      this.state = 'walk';
      this.cooldown = C.CRAB_COOLDOWN;
    }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      const dx = player.x + player.w / 2 - (this.x + this.w / 2);
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      this.chasing = Math.abs(dx) < C.CRAB_SIGHT_X && Math.abs(dy) < C.CRAB_SIGHT_Y;
      this.cooldown = Math.max(0, this.cooldown - dt);

      if (this.state === 'windup') {
        this.vx = 0;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'dash';
          this.timer = C.CRAB_DASH_TIME;
        }
      } else if (this.state === 'dash') {
        this.vx = this.dir * C.CRAB_DASH_SPEED; // 벽에 막히면 vx가 0이 되므로 매 프레임 다시 건다
        this.timer -= dt;
        if (this.timer <= 0 || this.hitWall || (this.onGround && this._ledgeAhead(terrain))) {
          this.state = 'walk';
          this.cooldown = C.CRAB_COOLDOWN;
          this.vx = 0;
        }
      } else {
        this._walk(dt, dx, terrain);
      }

      this.applyGravity(dt, 1);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      if (this.y > terrain.height + C.TILE * 2) this.reset();
    }

    _walk(dt, dx, terrain) {
      if (this.chasing) {
        if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
        if (this.onGround && this.cooldown === 0 && Math.abs(dx) <= C.CRAB_ATTACK_RANGE) { // 공격 예비동작
          this.state = 'windup';
          this.timer = C.CRAB_WINDUP;
          this.attackFx = true;
          this.vx = 0;
          return;
        }
        this.vx = this.dir * C.CRAB_CHASE_SPEED;
        if (this.onGround && this._ledgeAhead(terrain)) this.vx = 0; // 쫓다가 바다로 떨어지지 않게 멈춤
        return;
      }
      if (this.pause > 0) { // 순찰: 가끔 멈춰 서서 두리번
        this.pause -= dt;
        this.vx = 0;
        return;
      }
      if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) this.dir = -this.dir;
      this.vx = this.dir * C.CRAB_WALK_SPEED;
      if (Math.random() < 0.006) this.pause = 0.5 + Math.random() * 0.8;
    }
  }

  G.Crab = Crab;
})(window.Game);
