// 군단병(Raider): 왕국에 쳐들어오는 몬스터 군단. 한 클래스에 종류(variant) 다섯 가지.
//  spear  창병   : 다가와 창을 뒤로 뺐다가 길게 "찌르기". 찌르는 창끝도 패링으로 쳐낼 수 있다
//  shield 방패병 : 단단하고(두 번 쳐야 쓰러진다) 방패를 앞세워 부딪쳐 온다
//  archer 궁수   : 멀찍이 서서 화살을 쏜다 (패링으로 쳐내면 되돌아간다)
//  rusher 돌격병 : 한 방에 쓰러지지만 매우 빠르게 달려든다
//  ogre   오우거 : 크고 느리고 단단하다. 두 팔을 들었다가 몸을 던진다
// 평소엔 성(marchX)을 향해 행진하고, 플레이어가 가까이 오면 쫓아온다. 턱(1타일)은 뛰어 넘는다.
(function (G) {
  const C = G.Config;

  const VARIANTS = {
    spear: { name: '창병', w: 26, h: 40, hp: 3, speed: 72, chase: 105, twoHit: false, coin: 14, exp: 3, castle: 1, reach: 70 },
    shield: { name: '방패병', w: 30, h: 42, hp: 5, speed: 52, chase: 80, twoHit: true, coin: 20, exp: 4, castle: 2 },
    archer: { name: '궁수', w: 24, h: 38, hp: 2, speed: 62, chase: 62, twoHit: false, coin: 16, exp: 3, castle: 1, keep: 250 },
    rusher: { name: '돌격병', w: 24, h: 34, hp: 1, speed: 150, chase: 190, twoHit: false, coin: 10, exp: 2, castle: 1 },
    ogre: { name: '오우거', w: 46, h: 56, hp: 9, speed: 42, chase: 62, twoHit: true, coin: 44, exp: 9, castle: 4 },
  };

  class Raider extends G.Monster {
    constructor(x, y, variant) {
      const V = VARIANTS[variant] || VARIANTS.spear;
      super(x, y, V.w, V.h, 'raider');
      this.variant = variant in VARIANTS ? variant : 'spear';
      this.V = V;
      this.maxHp = V.hp;
      this.hp = V.hp;
      this.twoHit = V.twoHit;
      this.coinVal = V.coin;
      this.expVal = V.exp;
      this.marchX = x;        // 행진 목표 (성의 x). main이 정해 준다
      this.shot = null;       // 궁수가 방금 쏜 화살 {x,y,vx,vy} (main이 가져간다)
      this.reset();
    }

    reset() {
      super.reset();
      this.state = 'walk';    // walk | windup | strike
      this.timer = 0;
      this.cooldown = 1 + Math.random();
      this.attackFx = false;
    }

    knockback(dirX) { super.knockback(dirX); this.state = 'walk'; this.cooldown = 1.2; }
    stagger(dirX) { super.stagger(dirX); this.state = 'walk'; this.cooldown = 1.2; }

    // 찌르는 창끝 (창병이 찌르는 동안)
    thrustBox() {
      if (this.variant !== 'spear' || this.state !== 'strike') return null;
      const len = this.V.reach;
      return { x: this.dir > 0 ? this.x + this.w : this.x - len, y: this.y + this.h * 0.38, w: len, h: 10 };
    }

    overlaps(o) {
      if (super.overlaps(o)) return true;
      const t = this.thrustBox();
      return !!t && t.x < o.x + o.w && t.x + t.w > o.x && t.y < o.y + o.h && t.y + t.h > o.y;
    }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      const pcx = player.x + player.w / 2;
      const cx = this.x + this.w / 2;
      const dx = pcx - cx;
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      const near = Math.abs(dx) < 340 && Math.abs(dy) < 120;
      this.chasing = near;
      this.cooldown = Math.max(0, this.cooldown - dt);
      const V = this.V;
      const speed = this.stageSpeed;

      if (this.state === 'windup') {
        this.vx = 0;
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.variant === 'archer') { // 발사
            const len = Math.hypot(dx, dy) || 1;
            this.shot = { x: cx + this.dir * 14, y: this.y + this.h * 0.45, vx: (dx / len) * 340 * speed, vy: (dy / len) * 340 * speed, arrow: true };
            this.state = 'walk';
            this.cooldown = 2.4;
          } else {
            this.state = 'strike';
            this.timer = this.variant === 'spear' ? 0.22 : this.variant === 'ogre' ? 0.34 : 0.26;
          }
        }
      } else if (this.state === 'strike') {
        if (this.variant === 'spear') this.vx = 0;
        else this.vx = this.dir * (this.variant === 'ogre' ? 210 : 270) * speed; // 방패 돌진 / 오우거 몸던지기
        this.timer -= dt;
        if (this.timer <= 0 || this.hitWall) { this.state = 'walk'; this.cooldown = this.variant === 'spear' ? 1.3 : 1.8; this.vx = 0; }
      } else {
        this._move(dt, dx, near, terrain, V, speed);
      }

      this.applyGravity(dt, 1);
      this.moveX(dt, terrain);
      if (this.hitWall && this.onGround && this.state === 'walk' && this.vx === 0 && this.dir !== 0) this.vy = -420; // 1타일 턱 넘기
      this.moveY(dt, terrain);
      if (this.y > terrain.height + C.TILE * 2) this.reset();
    }

    _move(dt, dx, near, terrain, V, speed) {
      const target = near ? Math.sign(dx) : Math.sign(this.marchX - (this.x + this.w / 2));
      const absDx = Math.abs(dx);
      if (target !== 0) this.dir = target;
      let v = near ? V.chase : V.speed;
      if (this.variant === 'archer' && near) { // 사정거리를 지킨다
        if (absDx < V.keep - 40) { this.dir = -Math.sign(dx) || this.dir; v = V.chase; }
        else if (absDx < V.keep + 40) v = 0;
        if (this.cooldown === 0 && absDx < 420) { this.state = 'windup'; this.timer = 0.55; this.attackFx = true; this.dir = Math.sign(dx) || this.dir; this.vx = 0; return; }
      } else if (near && this.cooldown === 0 && this.onGround) {
        const range = this.variant === 'spear' ? V.reach - 6 : this.variant === 'ogre' ? 120 : this.variant === 'shield' ? 100 : 0;
        if (range && absDx < range) { this.state = 'windup'; this.timer = this.variant === 'spear' ? 0.5 : this.variant === 'ogre' ? 0.7 : 0.4; this.attackFx = true; this.vx = 0; return; }
      }
      this.vx = this.dir * v * speed;
      if (this.onGround && v && this._ledgeAhead(terrain)) this.vx = 0;
    }
  }

  Raider.VARIANTS = VARIANTS;
  G.Raider = Raider;
})(window.Game);
