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
      this.parryTimer = 0;
      this.parryCooldown = 0;
      this.invuln = 0;                  // >0 이면 무적
      this.swing = -1;                  // 검 휘두르기 프레임 번호(0~SWING_FRAMES-1), 안 휘두르면 -1
      this.swingFx = false;             // 베기 시작 프레임에 켜지는 1회성 플래그 (이펙트용)
      this.holdTime = 0;                // 패링 버튼을 계속 누른 시간
      this.chargeReadyFx = false;       // 게이지가 가득 찬 순간 켜지는 1회성 플래그 (이펙트용)
      this.throwTiles = 0;              // 이번에 던지는 검이 날아갈 거리 (타일). 게이지에 비례
      this.throwSword = false;          // 검을 던지는 순간 켜지는 1회성 플래그 (main이 처리)
      this.swordOut = false;            // 검이 손을 떠나 있는 중 (패링 불가)
      this.animTime = 0;
      this.runPhase = 0;
      this.lastGround = { x, y };       // 마지막으로 땅을 밟고 있던 위치 (구덩이에 빠졌을 때 복귀 지점)
    }

    // 속도를 없애고 해당 위치로 옮긴다 (상태는 유지)
    placeAt(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
    }

    get parrying() {
      return this.parryTimer > 0;
    }

    update(dt, input, terrain) {
      this._applyInput(dt, input);
      this._applyParry(dt, input);
      // 점프 키를 일찍 떼면 상승 중 중력을 키워 낮은 점프
      this.applyGravity(dt, this.vy < 0 && !input.jumpHeld ? C.JUMP_CUT_GRAVITY : 1);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      this.invuln = Math.max(0, this.invuln - dt);
      this.animTime += dt;
      if (this.onGround) this.runPhase += Math.abs(this.vx) * dt * 0.09;
      if (this.onGround) this.lastGround = { x: this.x, y: this.y };
    }

    get chargeReady() {
      return this.holdTime >= C.SWORD_CHARGE_TIME;
    }

    get chargeProgress() {
      // 0 = 막 던질 수 있게 된 상태(SWORD_MIN_HOLD), 1 = 가득(SWORD_CHARGE_TIME)
      const t = (this.holdTime - C.SWORD_MIN_HOLD) / (C.SWORD_CHARGE_TIME - C.SWORD_MIN_HOLD);
      return Math.max(0, Math.min(1, t));
    }

    // 게이지 비율 -> 날아갈 거리(타일): 절반 미만은 고정 짧게, 절반을 넘으면 1.3칸부터 가득 4칸까지 비례
    _throwTilesFor(p) {
      if (p < C.SWORD_HALF_GAUGE) return C.SWORD_SHORT_TILES;
      const t = (p - C.SWORD_HALF_GAUGE) / (1 - C.SWORD_HALF_GAUGE);
      return C.SWORD_MIN_TILES + (C.SWORD_THROW_TILES - C.SWORD_MIN_TILES) * t;
    }

    // 맞았을 때 충전 게이지를 비운다. 게이지가 있었다면 true
    cancelCharge() {
      const had = this.holdTime >= C.SWORD_MIN_HOLD;
      this.holdTime = 0;
      return had;
    }

    // 손 위치(검을 쥔 곳). 던질 때 출발점이자 돌아온 검을 잡는 위치
    get hand() {
      return { x: this.x + this.w / 2 + this.facing * 6, y: this.y + 16 };
    }

    // 패링 성공: 쿨다운을 없애 바로 다음 패링을 이어갈 수 있게 한다 (슬라임이 줄지어 올 때 연속 패링)
    parrySucceeded() {
      this.parryCooldown = 0;
    }

    // 패링 버튼 -> PARRY_WINDOW 동안 판정 유지, 이후 쿨다운
    _applyParry(dt, input) {
      // 길게 누르면 게이지 충전. 가득 찬 뒤 버튼에서 손을 떼면 검을 던진다
      const held = input.parryHeld;
      if (this.swordOut) {
        this.holdTime = 0; // 검이 손에 없으면 충전 불가
      } else if (held) {
        const before = this.holdTime;
        this.holdTime += dt;
        if (before < C.SWORD_CHARGE_TIME && this.holdTime >= C.SWORD_CHARGE_TIME) this.chargeReadyFx = true;
      } else {
        if (this.holdTime >= C.SWORD_MIN_HOLD) { // 게이지를 채우고 뗌 -> 던지기 (채운 만큼 멀리)
          this.throwTiles = this._throwTilesFor(this.chargeProgress);
          this.throwSword = true;
          this.swordOut = true;
          this.swing = -1;
          this.parryTimer = 0;
        }
        this.holdTime = 0; // 톡 눌렀다 뗀 경우: 처음 누를 때의 패링만 나가고 던지지 않음
      }
      if (this.swing >= 0) { // 휘두르기 애니메이션: 60Hz 고정 스텝마다 한 프레임씩
        this.swing += 1;
        if (this.swing >= C.SWING_FRAMES) this.swing = -1;
        else if (this.swing === C.SWING_SLASH_FRAME) this.swingFx = true;
      }
      this.parryTimer = Math.max(0, this.parryTimer - dt);
      this.parryCooldown = Math.max(0, this.parryCooldown - dt);
      if (input.parryPressed && this.parryCooldown === 0 && !this.swordOut) { // 검이 없으면 패링 불가
        this.parryTimer = C.PARRY_WINDOW;
        this.parryCooldown = C.PARRY_COOLDOWN;
        this.swing = 0;
      }
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
