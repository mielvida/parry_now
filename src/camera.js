// 카메라: 월드 좌표 -> 화면 좌표 오프셋. 대상을 부드럽게 따라가며 맵 경계 안에 머문다.
(function (G) {
  class Camera {
    constructor(viewW, viewH) {
      this.viewW = viewW;
      this.viewH = viewH;
      this.x = 0;
      this.y = 0;
    }

    // 대상(사각형) 중심을 향해 이동. snap=true면 즉시 이동(리스폰/시작 시)
    follow(target, terrain, dt, snap = false) {
      const tx = target.x + target.w / 2 - this.viewW / 2;
      const ty = target.y + target.h / 2 - this.viewH / 2;
      const k = snap ? 1 : 1 - Math.exp(-10 * dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;

      this.x = Math.max(0, Math.min(this.x, Math.max(0, terrain.width - this.viewW)));
      this.y = Math.max(0, Math.min(this.y, Math.max(0, terrain.height - this.viewH)));
    }
  }

  G.Camera = Camera;
})(window.Game);
