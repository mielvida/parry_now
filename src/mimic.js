// 방긋이: 하수구에서 만나는 몬스터. 처음에는 분홍빛 동글동글한 얼굴로 하트를 흘리며 귀엽게 돌아다닌다 (닿아도 해롭지 않다).
// 가까이 다가가거나 때리면 부르르 떨다가 갑자기 정체를 드러낸다: 몸이 쩍 벌어지고 이빨, 눈알, 촉수가 튀어나오는 무섭고 징그러운 괴물로 변해서 달려든다.
//   cute    귀여운 모습 (순찰). 닿아도 안전하다
//   shudder 변신 직전 (0.8초): 몸을 떨고, 웃음이 일그러진다 (도망칠 마지막 기회)
//   scary   괴물 모습: 엄청나게 빠르고 세다. 뛰어올라 덮친다. 단단함(체력 400)과 딴딴함(30)이 있고 닿으면 목숨 4개. 한 번 변하면 되돌아가지 않는다
(function (G) {
  const C = G.Config;

  const CUTE = { w: 28, h: 26 };
  const SCARY = { w: 52, h: 44 };

  class Mimic extends G.Monster {
    constructor(x, y) {
      super(x, y, CUTE.w, CUTE.h, 'mimic');
      this.twoHit = false;
      this.noRespawn = true;
      this.state = 'cute';
      this.timer = 0;
      this.pause = 0;
      this.cooldown = 0;
      this.maxHp = this.hp = 20;
      this.extraHits = 0;
      this.coinVal = 0;
      this.expVal = 0;
      this.contactDmg = 0;
      this.harmless = true;      // 귀여운 동안은 닿아도 안전하다 (main이 확인한다)
      this.revealed = false;     // 방금 변신했음을 main에 알리는 1회성 표시 (비명, 화면 흔들림)
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.bornY = y + CUTE.h;
    }

    static get CUTE() { return CUTE; }
    static get SCARY() { return SCARY; }

    // 정체를 드러낸다 (가까이 갔거나, 맞았거나, 마법/독을 받았을 때). fast=true면 떠는 시간 없이 바로
    reveal(fast) {
      if (this.state !== 'cute') return;
      this.state = 'shudder';
      this.timer = fast ? 0.12 : 0.8;
      this.vx = 0;
    }

    damage(n) { // 귀여운 동안은 피해 대신 정체를 드러낸다
      if (this.state !== 'scary') { this.reveal(true); return; }
      super.damage(n);
    }

    _transform() {
      const cx = this.x + this.w / 2, bottom = this.y + this.h;
      this.state = 'scary';
      this.w = SCARY.w; this.h = SCARY.h;
      this.x = cx - this.w / 2; this.y = bottom - this.h - 1;
      this.maxHp = this.hp = 400;   // 단단함(체력): 엄청나게 세다
      this.extraHits = 30;          // 딴딴함: 금이 가기까지 서른 번을 때려야 한다
      this.coinVal = 220;
      this.expVal = 40;
      this.contactDmg = 4;          // 닿으면 목숨 4개
      this.harmless = false;
      this.revealed = true;
      this.cooldown = 0.7;
      this.hitGrace = 0;
    }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      const dx = player.x + player.w / 2 - (this.x + this.w / 2);
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.state === 'cute') {
        this.harmless = true; this.contactDmg = 0;
        if (Math.abs(dx) < 96 && Math.abs(dy) < 70) this.reveal(false); // 가까이 다가가면
        if (this.pause > 0) { this.pause -= dt; this.vx = 0; }
        else {
          if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) this.dir = -this.dir;
          this.vx = this.dir * 22;
          if (Math.random() < 0.012) this.pause = 0.8 + Math.random() * 1.2;
        }
      } else if (this.state === 'shudder') {
        this.vx = 0;
        this.dir = dx < 0 ? -1 : 1;
        this.timer -= dt;
        if (this.timer <= 0) this._transform();
      } else { // scary
        this.dir = dx < 0 ? -1 : 1;
        if (Math.abs(dx) < 520 && Math.abs(dy) < 260) {
          this.vx = this.dir * 175 * this.stageSpeed;
          if (this.onGround && this.cooldown === 0 && Math.abs(dx) < 230) { // 덮친다 (빠르고 자주)
            this.vy = -420; this.vx = this.dir * 360; this.onGround = false; this.cooldown = 1.1;
          }
        } else if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) { this.dir = -this.dir; this.vx = this.dir * 40; }
      }
      this.applyGravity(dt, 1);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      if (this.y > terrain.height + C.TILE * 2) { this.alive = false; this.gone = true; }
    }
  }

  G.Mimic = Mimic;
})(window.Game);
