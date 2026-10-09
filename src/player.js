// 플레이어: 이동/점프/중력 + 지형과의 충돌 해결. 그리기는 하지 않는다.
(function (G) {
  const C = G.Config;

  function approach(value, target, maxDelta) {
    if (value < target) return Math.min(value + maxDelta, target);
    return Math.max(value - maxDelta, target);
  }

  class Player {
    constructor(x, y) {
      this.w = C.PLAYER_W;
      this.h = C.PLAYER_H;
      this.facing = 1;
      this.respawn(x, y);
    }

    respawn(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
    }

    update(dt, input, terrain) {
      this._applyInput(dt, input);
      this._applyGravity(dt, input);
      // 축을 분리해서 이동 -> 충돌 해결 (X 먼저, 그다음 Y). 모서리에서 끼임/뚫림을 막는다.
      this._moveX(dt, terrain);
      this._moveY(dt, terrain);
    }

    _applyInput(dt, input) {
      const dir = input.moveX;
      if (dir !== 0) this.facing = dir;
      const accel = this.onGround ? C.ACCEL_GROUND : C.ACCEL_AIR;
      this.vx = approach(this.vx, dir * C.MOVE_SPEED, accel * dt);

      // 코요테 타임 / 점프 버퍼
      this.coyote = this.onGround ? C.COYOTE_TIME : Math.max(0, this.coyote - dt);
      this.jumpBuffer = input.jumpPressed ? C.JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);

      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = -C.JUMP_SPEED;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
      }
    }

    _applyGravity(dt, input) {
      let g = C.GRAVITY;
      if (this.vy < 0 && !input.jumpHeld) g *= C.JUMP_CUT_GRAVITY; // 일찍 떼면 낮은 점프
      this.vy = Math.min(this.vy + g * dt, C.MAX_FALL_SPEED);
    }

    _moveX(dt, terrain) {
      this.x += this.vx * dt;
      for (const t of terrain.solidTilesIn(this.x, this.y, this.w, this.h)) {
        if (this.vx > 0) this.x = t.x - this.w;            // 오른쪽 벽
        else if (this.vx < 0) this.x = t.x + t.w;          // 왼쪽 벽
        this.vx = 0;
      }
    }

    _moveY(dt, terrain) {
      this.y += this.vy * dt;
      this.onGround = false;
      for (const t of terrain.solidTilesIn(this.x, this.y, this.w, this.h)) {
        if (this.vy > 0) {          // 낙하 중 바닥에 닿음 -> 밟고 서기
          this.y = t.y - this.h;
          this.onGround = true;
        } else if (this.vy < 0) {   // 상승 중 천장에 부딪힘
          this.y = t.y + t.h;
        }
        this.vy = 0;
      }
    }
  }

  G.Player = Player;
})(window.Game);
