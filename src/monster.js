// 몬스터 공통 기반: 플레이어와 같은 Body 충돌 판정 + 패링에 맞는 생애주기.
//   살아 있음 -> 패링/검에 맞아 날아감(flying) -> 벽/땅/천장에 닿으면 폭발(죽음) -> 일정 시간 뒤 제자리에서 부활
// 슬라임·박쥐·꽃게처럼 종류별 AI는 서브클래스가 update()에서 tickLifecycle()을 먼저 호출한 뒤 구현한다.
(function (G) {
  const C = G.Config;

  class Monster extends G.Body {
    constructor(x, y, w, h, kind) {
      super(x, y, w, h);
      this.kind = kind;
      this.stageSpeed = 1;     // 스테이지가 정하는 이동 속도 배수 (화산은 더 빠르다)
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
      this.twoHit = false;     // true면 첫 타에 기절(밀려남), 기절 중 두 번째 타에 죽는다
      this.staggered = 0;      // >0 이면 기절 중 (해롭지 않고 가만히 있다)
      this.pushLeft = 0;       // 첫 타로 더 밀려나야 하는 거리 (px)
      this.pushDir = 0;
      this.hitGrace = 0;       // >0 이면 아직 맞아도 무시 (같은 휘두르기에 연속으로 맞는 것 방지)
      this.maxHp = 3;          // 체력 (마법 피해/독용. 슬라임·꽃게 3, 박쥐 2)
      this.hp = 3;
      this.poison = null;      // 독 상태 {elapsed, ticks}. 걸려 있는 동안 매초 피해
      this.dmgFx = 0;          // 이번에 입은 피해 합 (main이 떠오르는 숫자로 보여주고 0으로 되돌린다)
      this.burn = null;        // 화상 상태 {elapsed, ticks} (화염 무기)
      this.frozen = false;     // 얼음 무기에 얼어붙음 (기절 상태 + 얼음 모습). 날아갈 때도 유지되어 얼면서 죽는다
      this.deathStyle = null;  // 죽을 때의 연출: 'ice' 얼음 조각 / 'fire' 불꽃 / null 기본
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
      this.staggered = 0;
      this.pushLeft = 0;
      this.hitGrace = 0;
      this.hp = this.maxHp;
      this.poison = null;
      this.burn = null;
      this.frozen = false;
      this.deathStyle = null;
    }

    // 마법 피해: 체력이 0이 되면 그 자리에서 터진다 (날아가는 중이거나 죽은 몬스터는 무시)
    damage(n) {
      if (!this.alive || this.flying) return;
      this.hp -= n;
      this.dmgFx += n;
      if (this.hp <= 0) this._die();
    }

    // 독: 걸려 있지 않을 때만 걸린다 (중첩/연장 없음 -> 한 번에 최대 POISON_TICKS 피해)
    applyPoison() {
      if (this.alive && !this.poison) this.poison = { elapsed: 0, ticks: 0 };
    }

    // 화상: 걸려 있지 않을 때만 걸린다. BURN_TICKS번 BURN_TICK_DAMAGE씩 피해 (죽으면 불꽃으로 터진다)
    applyBurn() {
      if (!this.alive || this.burn) return;
      this.burn = { elapsed: 0, ticks: 0 };
      this.deathStyle = 'fire';
    }

    _tickBurn(dt) {
      const b = this.burn;
      b.elapsed += dt;
      while (b.ticks < C.BURN_TICKS && b.elapsed >= b.ticks + 1 - 1e-9) {
        b.ticks += 1;
        this.damage(C.BURN_TICK_DAMAGE);
        if (!this.alive) return;
      }
      if (b.ticks >= C.BURN_TICKS) {
        this.burn = null;
        if (this.deathStyle === 'fire') this.deathStyle = null;
      }
    }

    // 동결: 제자리에 얼어붙어 FREEZE_TIME 동안 기절한다 (해롭지 않고, 맞으면 얼음 조각으로 부서진다)
    freeze(time = C.FREEZE_TIME) {
      if (!this.alive || this.flying) return;
      this.frozen = true;
      this.deathStyle = 'ice';
      this.staggered = Math.max(this.staggered, time);
      this.chasing = false;
    }

    _tickPoison(dt) {
      const p = this.poison;
      p.elapsed += dt;
      while (p.ticks < C.POISON_TICKS && p.elapsed >= p.ticks + 1 - 1e-9) { // 1초마다 한 번
        p.ticks += 1;
        this.damage(C.POISON_TICK_DAMAGE);
        if (!this.alive) return;
      }
      if (p.ticks >= C.POISON_TICKS) this.poison = null;
    }

    // 첫 타: dirX 방향으로 PUSH_DIST만큼 밀려나 기절한다 (죽지 않는다)
    stagger(dirX) {
      this.staggered = C.STAGGER_TIME;
      this.hitGrace = C.HIT_GRACE;
      this.pushLeft = C.PUSH_DIST;
      this.pushDir = dirX;
      this.vx = 0;
      this.chasing = false;
      this.dir = -dirX; // 맞은 방향을 바라봄
    }

    // 패링으로 튕겨냄: dirX 방향으로 날아간다
    knockback(dirX) {
      this.staggered = 0;
      this.pushLeft = 0;
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
      this.hitGrace = Math.max(0, this.hitGrace - dt);
      if (this.poison) {
        this._tickPoison(dt);
        if (!this.alive) return true;
      }
      if (this.burn) {
        this._tickBurn(dt);
        if (!this.alive) return true;
      }
      if (this.pushLeft > 0 || this.staggered > 0) {
        this._tickStagger(dt, terrain);
        return true;
      }

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

    // 진행 방향 발밑 depth타일 안에 땅이 하나도 없는가 (순찰은 1: 어떤 낙차에서도 되돌아감)
    _ledgeAhead(terrain, depth = 1) {
      const T = C.TILE;
      const frontX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const col = Math.floor(frontX / T);
      const row = Math.floor((this.y + this.h + 1) / T);
      for (let i = 0; i < depth; i++) if (terrain.isSolid(col, row + i)) return false;
      return true;
    }

    // 기절 중: 첫 타의 힘으로 PUSH_DIST만큼 미끄러진 뒤 제자리에서 멍하니 서 있는다
    _tickStagger(dt, terrain) {
      if (this.pushLeft > 0) {
        const before = this.x;
        this.vx = this.pushDir * C.PUSH_DIST / C.PUSH_TIME;
        this.moveX(dt, terrain);
        this.pushLeft -= Math.abs(this.x - before);
        if (this.hitWall) this.pushLeft = 0; // 벽에 막히면 거기서 멈춘다
      } else {
        this.vx = 0;
      }
      this.staggered = Math.max(0, this.staggered - dt);
      this.applyGravity(dt, 1);
      this.moveY(dt, terrain);
      if (this.y > terrain.height + C.TILE * 2) this.reset(); // 밀려서 낭떠러지로 떨어지면 제자리로
      if (this.staggered === 0) {
        this.pushLeft = 0;
        this.vx = 0;
        if (this.frozen) { // 얼음이 녹는다
          this.frozen = false;
          if (this.deathStyle === 'ice') this.deathStyle = null;
        }
      }
    }

    _die() {
      this.poison = null;
      this.burn = null;
      this.alive = false;
      this.flying = false;
      this.spin = 0;
      this.vanished = true;
      this.respawnTimer = C.SLIME_RESPAWN_TIME;
    }
  }

  G.Monster = Monster;
})(window.Game);
