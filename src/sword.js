// 던진 검(부메랑): 던진 방향으로 SWORD_THROW_TILES만큼 날아갔다가 플레이어 쪽으로 되돌아온다.
// 날아가는 동안 플레이어가 방향을 바꾸거나 움직여도 나가는 방향은 그대로, 돌아올 때만 플레이어 현재 위치를 쫓는다.
(function (G) {
  const C = G.Config;
  const SIZE = 26; // 슬라임과의 충돌 판정 한 변

  class Sword {
    constructor(x, y, dir, tiles = C.SWORD_THROW_TILES) {
      this.x = x;
      this.y = y;
      this.dir = dir >= 0 ? 1 : -1;
      this.state = 'out';     // 'out' = 나가는 중, 'back' = 돌아오는 중
      this.traveled = 0;
      this.range = tiles * C.TILE;
      this.angle = 0;         // 빙글 도는 연출용
      this.trail = [];        // 잔상
      this.done = false;      // 플레이어가 다시 잡음
    }

    get box() {
      return { x: this.x - SIZE / 2, y: this.y - SIZE / 2, w: SIZE, h: SIZE };
    }

    // hand = 플레이어 손 위치 {x, y}
    update(dt, hand) {
      this.angle += dt * 30 * this.dir;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();

      if (this.state === 'out') {
        const step = Math.min(C.SWORD_OUT_SPEED * dt, this.range - this.traveled);
        this.x += this.dir * step;
        this.traveled += step;
        if (this.traveled >= this.range) this.state = 'back';
        return;
      }

      const dx = hand.x - this.x;
      const dy = hand.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= C.SWORD_CATCH_RADIUS) {
        this.done = true;
        return;
      }
      const step = Math.min(C.SWORD_BACK_SPEED * dt, dist);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  G.Sword = Sword;
})(window.Game);
