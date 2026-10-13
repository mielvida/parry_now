// 하수구 지렁이: 가끔 천장에서 툭 떨어지는 징그러운 지렁이. 때리면 두 마리로 갈라지고, 갈라진 것을 때리면 또 둘로 갈라진다 (딱 2번까지만).
//   gen 0 (큰 지렁이) -> 때리면 gen 1 둘 -> 각각 때리면 gen 2 둘 (모두 4마리) -> 마지막 조각은 평범하게 쓰러진다.
// 강하다: 단단함(체력)과 딴딴함(금이 가기까지 더 때려야 하는 횟수)이 모두 있고, 닿으면 목숨 2개. 작은 조각일수록 빠르다.
// 갈라지는 일(새 조각을 만드는 것)은 main이 한다. 여기서는 split()으로 '갈라져야 한다'는 표시만 남긴다.
(function (G) {
  const C = G.Config;

  const GEN = [
    { w: 48, h: 22, hp: 40, tough: 6, speed: 52, segs: 7, coin: 0, exp: 0 },
    { w: 34, h: 16, hp: 30, tough: 5, speed: 82, segs: 5, coin: 0, exp: 0 },
    { w: 24, h: 12, hp: 24, tough: 4, speed: 124, segs: 4, coin: 15, exp: 4 },
  ];

  class Worm extends G.Monster {
    constructor(x, y, gen = 0) {
      const d = GEN[gen];
      super(x, y, d.w, d.h, 'worm');
      this.gen = gen;
      this.twoHit = false;       // 한 대마다 (딴딴함을 다 깎은 뒤에는) 갈라지거나 쓰러진다
      this.noRespawn = true;     // 쓰러지거나 갈라지면 다시 살아나지 않는다
      this.maxHp = this.hp = d.hp;
      this.extraHits = d.tough;  // 딴딴함
      this.speed = d.speed;
      this.coinVal = d.coin;
      this.expVal = d.exp;
      this.contactDmg = 2;
      this.splitReq = false;     // 갈라져야 한다 (main이 새 조각 둘을 만든다)
      this.gone = false;         // 갈라져서 사라졌다 (main이 목록에서 치운다)
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.pause = 0;
      this.lane = (Math.random() - 0.5) * 40; // 쫓아갈 때 노리는 자리 (플레이어 기준 좌우). 갈라질 때 조각마다 다르게 정해 한 점으로 몰려 겹치지 않는다
    }

    static get GEN() { return GEN; }

    // 갈라진다: 죽는 것이 아니라 둘로 나뉜다 (보상 없음). 마지막 세대(gen 2)는 갈라지지 않는다
    split() {
      this.alive = false;
      this.flying = false;
      this.gone = true;
      this.splitReq = true;
    }

    _die() {
      if (this.gen < 2 && !this.gone) { this.split(); return; } // 마법·독·불로 체력이 다해도 갈라진다
      super._die();
    }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      const dx = player.x + player.w / 2 + this.lane - (this.x + this.w / 2);
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      this.chasing = Math.abs(dx) < 380 && Math.abs(dy) < 200;
      if (this.chasing) {
        if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
        this.vx = Math.abs(dx) < 3 ? 0 : this.dir * this.speed; // 자기 자리에 서면 멈춘다
        if (this.onGround && this._ledgeAhead(terrain) && Math.abs(dx) < 40) this.vx = 0; // 낭떠러지 앞에서 멈춘다
      } else if (this.pause > 0) {
        this.pause -= dt;
        this.vx = 0;
      } else {
        if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) this.dir = -this.dir;
        this.vx = this.dir * this.speed * 0.6;
        if (Math.random() < 0.01) this.pause = 0.5 + Math.random();
      }
      this.applyGravity(dt, 1);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      if (this.y > terrain.height + C.TILE * 2) { this.alive = false; this.gone = true; } // 구덩이에 빠지면 사라진다 (보상 없음)
    }
  }

  G.Worm = Worm;
})(window.Game);
