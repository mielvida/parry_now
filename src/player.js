// 플레이어: 이동/점프/중력 입력 처리. 충돌 해결은 Body, 그리기는 Renderer 담당.
(function (G) {
  const C = G.Config;

  function approach(value, target, maxDelta) {
    if (value < target) return Math.min(value + maxDelta, target);
    return Math.max(value - maxDelta, target);
  }

  class Player extends G.Body {
    constructor(x, y) {
      super(x, y, C.PLAYER_W, C.PLAYER_H);
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
      // 점프 키를 일찍 떼면 상승 중 중력을 키워 낮은 점프
      this.applyGravity(dt, this.vy < 0 && !input.jumpHeld ? C.JUMP_CUT_GRAVITY : 1);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
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
  }

  G.Player = Player;
})(window.Game);
