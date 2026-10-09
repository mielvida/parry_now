// 키보드 입력 상태를 게임 로직이 읽기 쉬운 형태로 제공한다.
(function (G) {
  const LEFT = ['ArrowLeft', 'KeyA'];
  const RIGHT = ['ArrowRight', 'KeyD'];
  const JUMP = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];
  const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

  class Input {
    constructor(target) {
      this.down = new Set();
      this.jumpPressedThisFrame = false;

      target.addEventListener('keydown', (e) => {
        if (PREVENT.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        if (JUMP.includes(e.code) && !this._anyDown(JUMP)) this.jumpPressedThisFrame = true;
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

    // 로직 스텝이 끝날 때마다 호출: "이번 프레임에 눌림" 플래그 초기화
    endFrame() {
      this.jumpPressedThisFrame = false;
    }
  }

  G.Input = Input;
})(window.Game);
