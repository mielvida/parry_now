// 물리 몸체: 위치/속도 + 지형 충돌 해결. 플레이어와 몬스터가 똑같은 판정을 쓰도록 공용으로 둔다.
(function (G) {
  const C = G.Config;

  class Body {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.hitWall = false; // 직전 X 이동에서 벽에 막혔는가
    }

    applyGravity(dt, scale = 1) {
      this.vy = Math.min(this.vy + C.GRAVITY * scale * dt, C.MAX_FALL_SPEED);
    }

    // 축 분리 AABB 충돌: X 먼저, 그다음 Y
    moveX(dt, terrain) {
      this.x += this.vx * dt;
      this.hitWall = false;
      for (const t of terrain.solidTilesIn(this.x, this.y, this.w, this.h)) {
        if (this.vx > 0) this.x = t.x - this.w;       // 오른쪽 벽
        else if (this.vx < 0) this.x = t.x + t.w;     // 왼쪽 벽
        this.vx = 0;
        this.hitWall = true;
      }
    }

    moveY(dt, terrain) {
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

    overlaps(o) {
      return this.x < o.x + o.w && this.x + this.w > o.x && this.y < o.y + o.h && this.y + this.h > o.y;
    }
  }

  G.Body = Body;
})(window.Game);
