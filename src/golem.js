// 흙괴물: 설산에 사는 느리고 단단한 몬스터. 천천히 걸어 다니다가 가까워지면 팔을 치켜들고(예비동작) 몸을 던진다.
// 슬라임·꽃게처럼 첫 타에 밀려나 기절하고, 기절 중 다시 맞으면 죽는다. 패링에 맞은 뒤의 생애주기는 Monster 공통.
(function (G) {
  const C = G.Config;

  class Golem extends G.Monster {
    constructor(x, y) {
      super(x, y, C.GOLEM_W, C.GOLEM_H, 'golem');
      this.twoHit = true;
      this.reset();
    }

    reset() {
      super.reset();
      this.state = 'walk';   // walk | windup | lunge
      this.timer = 0;
      this.cooldown = 1.5;
      this.pause = 0;
      this.attackFx = false;
    }

    knockback(dirX) {
      super.knockback(dirX);
      this.state = 'walk';
      this.cooldown = C.GOLEM_COOLDOWN;
    }

    stagger(dirX) {
      super.stagger(dirX);
      this.state = 'walk';
      this.cooldown = C.GOLEM_COOLDOWN;
    }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      const dx = player.x + player.w / 2 - (this.x + this.w / 2);
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      this.chasing = Math.abs(dx) < C.GOLEM_SIGHT_X && Math.abs(dy) < C.GOLEM_SIGHT_Y;
      this.cooldown = Math.max(0, this.cooldown - dt);

      if (this.state === 'windup') {
        this.vx = 0;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'lunge';
          this.timer = C.GOLEM_LUNGE_TIME;
        }
      } else if (this.state === 'lunge') {
        this.vx = this.dir * C.GOLEM_LUNGE_SPEED * this.stageSpeed;
        this.timer -= dt;
        if (this.timer <= 0 || this.hitWall || (this.onGround && this._ledgeAhead(terrain))) {
          this.state = 'walk';
          this.cooldown = C.GOLEM_COOLDOWN;
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
        if (this.onGround && this.cooldown === 0 && Math.abs(dx) <= C.GOLEM_ATTACK_RANGE) {
          this.state = 'windup';
          this.timer = C.GOLEM_WINDUP;
          this.attackFx = true;
          this.vx = 0;
          return;
        }
        this.vx = this.dir * C.GOLEM_CHASE_SPEED * this.stageSpeed;
        if (this.onGround && this._ledgeAhead(terrain)) this.vx = 0;
        return;
      }
      if (this.pause > 0) {
        this.pause -= dt;
        this.vx = 0;
        return;
      }
      if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) this.dir = -this.dir;
      this.vx = this.dir * C.GOLEM_WALK_SPEED * this.stageSpeed;
      if (Math.random() < 0.006) this.pause = 0.6 + Math.random() * 1.0;
    }
  }

  G.Golem = Golem;
})(window.Game);
