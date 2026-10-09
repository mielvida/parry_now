// 키보드 입력 상태를 게임 로직이 읽기 쉬운 형태로 제공한다.
(function (G) {
  const LEFT = ['ArrowLeft', 'KeyA'];
  const RIGHT = ['ArrowRight', 'KeyD'];
  const JUMP = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];
  const PARRY = ['Enter', 'NumpadEnter'];
  const DASH = ['ShiftLeft', 'ShiftRight', 'KeyX']; // Shift(또는 X). Windows는 Shift를 연타하면 고정키 창이 떠서 입력이 끊길 수 있어 X도 쓸 수 있게
  const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

  class Input {
    constructor(target) {
      this.down = new Set();
      this.jumpPressedThisFrame = false;
      this.parryPressedThisFrame = false;
      this.dashPressedThisFrame = false;
      this.pressedSet = new Set(); // 이번 프레임에 새로 눌린 키 (E, 숫자 키 등)

      target.addEventListener('keydown', (e) => {
        if (PREVENT.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.pressedSet.add(e.code);
        if (JUMP.includes(e.code) && !this._anyDown(JUMP)) this.jumpPressedThisFrame = true;
        if (PARRY.includes(e.code)) this.parryPressedThisFrame = true;
        if (DASH.includes(e.code)) this.dashPressedThisFrame = true;
        this.down.add(e.code);
      });
      target.addEventListener('keyup', (e) => this.down.delete(e.code));
      target.addEventListener('blur', () => this.down.clear());
    }

    _anyDown(codes) {
      return codes.some((c) => this.down.has(c));
    }

    get moveX() {
      return (this._anyDown(RIGHT) ? 1 : 0) - (this._anyDown(LEFT) ? 1 : 0);
    }
    get jumpHeld() {
      return this._anyDown(JUMP);
    }
    get jumpPressed() {
      return this.jumpPressedThisFrame;
    }

    get parryHeld() {
      return this._anyDown(PARRY);
    }
    get dashPressed() {
      return this.dashPressedThisFrame;
    }

    get parryPressed() {
      return this.parryPressedThisFrame;
    }

    wasPressed(code) {
      return this.pressedSet.has(code);
    }

    // 로직 스텝이 끝날 때마다 호출: "이번 프레임에 눌림" 플래그 초기화
    endFrame() {
      this.jumpPressedThisFrame = false;
      this.parryPressedThisFrame = false;
      this.dashPressedThisFrame = false;
      this.pressedSet.clear();
    }
  }

  G.Input = Input;
})(window.Game);
