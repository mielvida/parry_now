// 슬라임: 평소엔 땅 위를 왔다갔다 하다가, 플레이어가 가까이 오면 쫓아오며 점프한다.
// 충돌 판정은 Player와 동일한 Body를 사용한다 (찌그러짐 애니메이션은 그림에만 적용).
// 점프는 1타일 높이: 웅크렸다가(예비동작) 둥실 떠올라 느리게 이동하고, 착지하면 납작해진다.
(function (G) {
  const C = G.Config;

  class Slime extends G.Body {
    constructor(x, y) {
      super(x, y, C.SLIME_W, C.SLIME_H);
      this.home = { x, y };
      this.dir = -1;
      this.chasing = false;
      this.jumpCooldown = 0;
      this.crouch = 0;      // >0 이면 점프 직전 웅크리는 중
      this.landTimer = 0;   // >0 이면 착지 직후 납작해지는 중
      this.time = Math.random() * 10; // 개체마다 출렁이는 박자를 다르게
      this.sx = 1;          // 그림용 가로/세로 배율 (충돌 박스와 무관)
      this.sy = 1;
    }

    reset() {
      this.x = this.home.x;
      this.y = this.home.y;
      this.vx = 0;
      this.vy = 0;
      this.crouch = 0;
      this.landTimer = 0;
    }

    update(dt, player, terrain) {
      const dx = player.x + player.w / 2 - (this.x + this.w / 2);
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      this.chasing = Math.abs(dx) < C.SLIME_SIGHT_X && Math.abs(dy) < C.SLIME_SIGHT_Y;
      this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
      const wasAirborne = !this.onGround;

      if (this.crouch > 0) {
        // 웅크리는 동안은 제자리. 끝나면 점프
        this.vx = 0;
        this.crouch -= dt;
        if (this.crouch <= 0) {
          this.crouch = 0;
          this.vy = -C.SLIME_JUMP_SPEED;
          this.onGround = false;
          this.jumpCooldown = C.SLIME_JUMP_COOLDOWN;
        }
      } else {
        this._steer(dx, terrain);
        if (this.chasing && this.onGround && this.jumpCooldown === 0) {
          if (this.hitWall || Math.abs(dx) <= C.SLIME_JUMP_RANGE) this.crouch = C.SLIME_CROUCH_TIME;
        }
      }

      this.applyGravity(dt, C.SLIME_GRAVITY_SCALE);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);

      if (wasAirborne && this.onGround) this.landTimer = C.SLIME_LAND_TIME;
      this.landTimer = Math.max(0, this.landTimer - dt);
      if (this.y > terrain.height + C.TILE * 2) this.reset();

      this._animate(dt);
    }

    // 방향과 가로 속도 결정. 공중에서는 느리게 움직인다.
    _steer(dx, terrain) {
      if (this.chasing) {
        if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
      } else if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) {
        this.dir = -this.dir; // 순찰: 벽이나 낭떠러지를 만나면 되돌아감
      }

      let speed = this.chasing ? C.SLIME_CHASE_SPEED : C.SLIME_WALK_SPEED;
      if (!this.onGround) speed *= C.SLIME_AIR_SPEED_MULT;
      this.vx = this.dir * speed;

      // 쫓아가다 구덩이에 빠지지 않게 멈춤 (작은 낙차는 내려감)
      if (this.chasing && this.onGround && this._ledgeAhead(terrain, C.SLIME_SAFE_DROP)) this.vx = 0;
    }

    // 목표 배율을 정하고 부드럽게 따라가 말랑한 느낌을 낸다
    _animate(dt) {
      this.time += dt;
      let tx = 1;
      let ty = 1;
      if (this.crouch > 0) {
        const p = 1 - this.crouch / C.SLIME_CROUCH_TIME;
        tx = 1 + 0.3 * p;
        ty = 1 - 0.35 * p;
      } else if (!this.onGround) {
        tx = this.vy < 0 ? 0.88 : 0.94; // 떠오를 땐 길쭉
        ty = this.vy < 0 ? 1.18 : 1.08;
      } else if (this.landTimer > 0) {
        const q = this.landTimer / C.SLIME_LAND_TIME;
        tx = 1 + 0.3 * q;
        ty = 1 - 0.35 * q;
      } else {
        const w = Math.sin(this.time * 6) * 0.05; // 가만히 있어도 출렁
        tx = 1 - w;
        ty = 1 + w;
      }
      const k = Math.min(1, dt * 18);
      this.sx += (tx - this.sx) * k;
      this.sy += (ty - this.sy) * k;
    }

    // 진행 방향 발밑 depth타일 안에 땅이 하나도 없는가 (순찰은 1: 어떤 낙차에서도 되돌아감)
    _ledgeAhead(terrain, depth = 1) {
      const T = C.TILE;
      const frontX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const col = Math.floor(frontX / T);
      const row = Math.floor((this.y + this.h + 1) / T);
      for (let i = 0; i < depth; i++) if (terrain.isSolid(col, row + i)) return false;
      return true;
    }
  }

  G.Slime = Slime;
})(window.Game);
