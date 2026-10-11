// 군단병(Raider): 왕국에 쳐들어오는 적군(검병·창병·방패병·궁수·돌격병·오우거).
//  spear  창병   : 다가와 창을 뒤로 뺐다가 길게 "찌르기". 찌르는 창끝도 패링으로 쳐낼 수 있다
//  shield 방패병 : 단단하고(두 번 쳐야 쓰러진다) 방패를 앞세워 부딪쳐 온다
//  archer 궁수   : 멀찍이 서서 화살을 쏜다 (패링으로 쳐내면 되돌아간다)
//  rusher 돌격병 : 한 방에 쓰러지지만 매우 빠르게 달려든다
//  ogre   오우거 : 크고 느리고 단단하다. 두 팔을 들었다가 몸을 던진다
// 평소엔 성(marchX)을 향해 행진하고, 플레이어가 가까이 오면 쫓아온다. 턱(1타일)은 뛰어 넘는다.
(function (G) {
  const C = G.Config;

  const VARIANTS = {
    sword: { name: '검병', w: 26, h: 40, hp: 3, speed: 84, chase: 120, twoHit: false, coin: 14, exp: 3, castle: 1, reach: 54 },
    spear: { name: '창병', w: 26, h: 40, hp: 3, speed: 72, chase: 105, twoHit: false, coin: 14, exp: 3, castle: 1, reach: 70 },
    shield: { name: '방패병', w: 30, h: 42, hp: 5, speed: 52, chase: 80, twoHit: true, coin: 20, exp: 4, castle: 2 },
    archer: { name: '궁수', w: 24, h: 38, hp: 2, speed: 62, chase: 62, twoHit: false, coin: 16, exp: 3, castle: 1, keep: 250 },
    rusher: { name: '돌격병', w: 24, h: 34, hp: 1, speed: 150, chase: 190, twoHit: false, coin: 10, exp: 2, castle: 1 },
    hero: { name: '적국 용사', w: 26, h: 44, hp: 6, speed: 96, chase: 150, twoHit: false, coin: 60, exp: 15, castle: 2, reach: 60 },
    mage: { name: '마법사', w: 24, h: 40, hp: 3, speed: 60, chase: 70, twoHit: false, coin: 30, exp: 6, castle: 1, keep: 300 },
    ogre: { name: '오우거', w: 46, h: 56, hp: 9, speed: 42, chase: 62, twoHit: true, coin: 44, exp: 9, castle: 4 },
  };

  class Raider extends G.Monster {
    constructor(x, y, variant) {
      const V = VARIANTS[variant] || VARIANTS.spear;
      super(x, y, V.w, V.h, 'raider');
      this.variant = variant in VARIANTS ? variant : 'spear';
      this.V = V;
      this.maxHp = Math.max(20, V.hp); // 잡몹의 기본 체력은 20
      this.hp = this.maxHp;
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
      this.cooldown = this.variant === 'hero' ? 0.3 + Math.random() * 0.5 : 1 + Math.random();
      this.attackFx = false;
    }

    get swordLike() { return this.variant === 'sword' || this.variant === 'hero'; }
    get rangedUnit() { return this.variant === 'archer' || this.variant === 'mage'; }

    // 마법사: 가까운 아군에게 방어마법(막)이나 가속 마법을 걸어 준다
    _spells(dt) {
      this.spellT = (this.spellT === undefined ? 2.0 : this.spellT) - dt;
      if (this.castFx) { this.castFx.t -= dt; if (this.castFx.t <= 0) this.castFx = null; }
      if (this.spellT > 0 || this.state !== 'walk') return;
      const pool = G.Raider.pool || [];
      let best = null, bd = 560;
      for (const m of pool) {
        if (m === this || !m.alive || m.flying || m.appear > 0 || m.dummy || m.variant === 'mage' || m.fromBoss) continue;
        const d = Math.abs(m.x + m.w / 2 - (this.x + this.w / 2));
        if (d < bd && !(m.barrier > 0)) { bd = d; best = m; }
      }
      if (!best) { this.spellT = 1; return; }
      this.spellT = 3.4;
      if (best.kind === 'raider' && Math.random() < 0.3) { best.hasteT = 6; this.castFx = { tgt: best, t: 0.6, kind: 'haste' }; }
      else { best.barrier = 2; this.castFx = { tgt: best, t: 0.6, kind: 'barrier' }; }
    }

    knockback(dirX) { super.knockback(dirX); this.state = 'walk'; this.cooldown = 1.2; this.siege = false; }
    stagger(dirX) { super.stagger(dirX); this.state = 'walk'; this.cooldown = 1.2; this.siege = false; }

    // 찌르는 창끝 (창병이 찌르는 동안)
    thrustBox() {
      if (!(this.variant === 'spear' || this.swordLike) || this.state !== 'strike') return null;
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
      if (this.variant === 'mage') this._spells(dt);
      if (this.hasteT > 0) this.hasteT -= dt;
      if (this.siege) { // 성문에 붙어서 성을 때린다 (플레이어가 가까이 오면 맞서 싸운다)
        const near2 = Math.abs(player.x + player.w / 2 - (this.x + this.w / 2)) < 110 && Math.abs(player.y - this.y) < 90;
        if (!near2) {
          this.vx = 0;
          this.dir = Math.sign(this.marchX - (this.x + this.w / 2)) || this.dir;
          this.siegeSwing = Math.max(0, (this.siegeSwing || 0) - dt);
          this.state = this.siegeSwing > 0.3 ? 'windup' : this.siegeSwing > 0 ? 'strike' : 'walk';
          return;
        }
        this.siege = false;
      }
      const pcx = player.x + player.w / 2;
      const cx = this.x + this.w / 2;
      const dx = pcx - cx;
      const dy = player.y + player.h / 2 - (this.y + this.h / 2);
      const near = Math.abs(dx) < (this.variant === 'hero' ? 660 : 340) && Math.abs(dy) < 120; // 용사는 멀리서도 노린다
      this.chasing = near;
      this.cooldown = Math.max(0, this.cooldown - dt);
      const V = this.V;
      const speed = this.stageSpeed * (this.hasteT > 0 ? 1.5 : 1);

      if (this.state === 'windup') {
        this.vx = 0;
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.variant === 'archer' || this.variant === 'mage' || this.ranged) { // 발사
            const len = Math.hypot(dx, dy) || 1;
            if (this.variant === 'archer') this.shot = { x: cx + this.dir * 14, y: this.y + this.h * 0.45, vx: (dx / len) * 340 * speed, vy: (dy / len) * 340 * speed, arrow: true, dmg: 0.5 };
            else if (this.variant === 'mage') this.shot = { x: cx + this.dir * 14, y: this.y + this.h * 0.4, vx: (dx / len) * 300 * speed, vy: (dy / len) * 300 * speed, bolt: true, dmg: 1 };
            else this.shot = { x: cx + this.dir * 16, y: this.y + this.h * 0.45, vx: this.dir * 200, vy: -60, missile: true, homing: true, spd: 270, dmg: 2, life: 6 }; // 용사의 유도탄
            this.ranged = false;
            this.state = 'walk';
            this.cooldown = this.variant === 'hero' ? 2.6 : 1.5;
          } else {
            this.state = 'strike';
            this.timer = this.variant === 'spear' || this.swordLike ? 0.22 : this.variant === 'ogre' ? 0.34 : 0.26;
          }
        }
      } else if (this.state === 'strike') {
        if (this.variant === 'spear' || this.swordLike) this.vx = 0;
        else this.vx = this.dir * (this.variant === 'ogre' ? 210 : 270) * speed; // 방패 돌진 / 오우거 몸던지기
        this.timer -= dt;
        if (this.timer <= 0 || this.hitWall) { this.state = 'walk'; this.cooldown = this.variant === 'spear' ? 1.3 : this.swordLike ? 0.9 : 1.8; this.vx = 0; }
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
      if (this.variant === 'hero' && near && this.cooldown === 0 && this.onGround && absDx > 240 && absDx < 640) { this.state = 'windup'; this.timer = 0.6; this.ranged = true; this.attackFx = true; this.dir = Math.sign(dx) || this.dir; this.vx = 0; return; }
      if (this.rangedUnit && near) { // 사정거리를 지킨다
        if (absDx < V.keep - 40) { this.dir = -Math.sign(dx) || this.dir; v = V.chase; }
        else if (absDx < V.keep + 40) v = 0;
        if (this.cooldown === 0 && absDx < 420) { this.state = 'windup'; this.timer = 0.55; this.attackFx = true; this.dir = Math.sign(dx) || this.dir; this.vx = 0; return; }
      } else if (near && this.cooldown === 0 && this.onGround) {
        const range = this.variant === 'spear' || this.swordLike ? V.reach - 6 : this.variant === 'ogre' ? 120 : this.variant === 'shield' ? 100 : 0;
        if (range && absDx < range) { this.state = 'windup'; this.timer = this.swordLike ? 0.32 : this.variant === 'spear' ? 0.5 : this.variant === 'ogre' ? 0.7 : 0.4; this.attackFx = true; this.vx = 0; return; }
      }
      this.vx = this.dir * v * speed;
      if (this.onGround && v && this._ledgeAhead(terrain)) this.vx = 0;
    }
  }

  Raider.VARIANTS = VARIANTS;
  Raider.pool = null; // 마법사가 아군을 찾는 몬스터 목록 (main이 정해 준다)
  G.Raider = Raider;
})(window.Game);
