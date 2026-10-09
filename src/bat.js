// 박쥐: 날아다니는 몬스터. 중력을 받지 않고 공중을 떠다니다가,
// 플레이어를 발견하면 머리 위로 따라와 맴돈 뒤 예비동작(빨간 눈)을 거쳐 급강하로 덮친다.
// 충돌 판정은 Player와 같은 Body. 패링/검에 맞으면 슬라임처럼 날아가 터지고 부활한다 (Monster 공통).
(function (G) {
  const C = G.Config;

  // 상태: 'patrol' 제자리 주변 순찰 -> 'chase' 플레이어 위로 접근 -> 'windup' 예비동작 -> 'dive' 급강하 -> 다시 'chase'
  class Bat extends G.Monster {
    constructor(x, y) {
      super(x, y, C.BAT_W, C.BAT_H, 'bat');
      this.state = 'patrol';
      this.timer = 0;        // 현재 상태에서 남은 시간
      this.cooldown = 0;     // 다음 급강하까지 대기
      this.flap = 0;         // 날갯짓 위상 (그림용)
    }

    reset() {
      super.reset();
      this.state = 'patrol';
      this.timer = 0;
      this.cooldown = 0;
    }

    knockback(dirX) {
      super.knockback(dirX);
      this.state = 'patrol';
    }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;

      this.time += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.flap += dt * (this.state === 'dive' ? 6 : 22);

      const pcx = player.x + player.w / 2;
      const pcy = player.y + player.h / 2;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      const dx = pcx - cx;
      const dy = pcy - cy;
      const sees = Math.abs(dx) < C.BAT_SIGHT_X && Math.abs(dy) < C.BAT_SIGHT_Y;
      this.chasing = this.state !== 'patrol';

      switch (this.state) {
        case 'patrol': {
          // 둥지 주변을 느리게 8자로 맴돈다
          const tx = this.home.x + Math.sin(this.time * 0.6) * 96;
          const ty = this.home.y + Math.sin(this.time * 1.7) * 14;
          this._flyToward(tx, ty, C.BAT_PATROL_SPEED, dt);
          if (Math.abs(this.vx) > 4) this.dir = Math.sign(this.vx);
          if (sees) this.state = 'chase';
          break;
        }
        case 'chase': {
          // 플레이어 머리 위 BAT_HOVER 높이로 접근해 맴돈다
          const tx = pcx - this.w / 2 + Math.sin(this.time * 3) * 24;
          const ty = pcy - C.BAT_HOVER - this.h / 2;
          this._flyToward(tx, ty, C.BAT_CHASE_SPEED, dt);
          if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
          if (!sees) this.state = 'patrol';
          else if (this.cooldown === 0 && Math.abs(dx) < 56 && cy < pcy - 24) {
            this.state = 'windup';
            this.timer = C.BAT_WINDUP;
          }
          break;
        }
        case 'windup': {
          // 살짝 위로 움츠리며 노려본다 (이때 패링 타이밍을 읽을 수 있다)
          this.vx = 0;
          this.vy = -30;
          if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
          this.timer -= dt;
          if (this.timer <= 0) {
            const len = Math.hypot(dx, dy) || 1;
            this.vx = (dx / len) * C.BAT_DIVE_SPEED;
            this.vy = (dy / len) * C.BAT_DIVE_SPEED;
            this.state = 'dive';
            this.timer = C.BAT_DIVE_TIME;
          }
          break;
        }
        case 'dive': {
          this.timer -= dt;
          if (this.timer <= 0 || this.hitWall || this.hitCeiling || this.onGround) {
            this.state = 'chase';
            this.cooldown = C.BAT_COOLDOWN;
            this.vx = 0;
            this.vy = 0;
          }
          break;
        }
      }

      this.moveX(dt, terrain);
      this.moveY(dt, terrain);

      if (this.y > terrain.height + C.TILE * 2) this.reset();
    }

    // 목표 지점을 향해 부드럽게 가속하며 날아간다
    _flyToward(tx, ty, speed, dt) {
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      const want = Math.min(speed, dist * 3);
      const gx = dist > 0.5 ? (dx / dist) * want : 0;
      const gy = dist > 0.5 ? (dy / dist) * want : 0;
      const k = Math.min(1, 6 * dt);
      this.vx += (gx - this.vx) * k;
      this.vy += (gy - this.vy) * k;
    }
  }

  G.Bat = Bat;
})(window.Game);
