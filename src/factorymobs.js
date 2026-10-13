// 방사능 공장의 몬스터 둘.
//   실험체(Subject)  : 공장에서 만들어진 괴물. 일반 몬스터보다 20배 세다 (체력 400 = 20x20, 딴딴함 60). 닿으면 목숨 4개.
//       brute   : 우람한 돌연변이. 쫓아와서 뛰어올라 덮친다
//       spitter : 부풀어 오른 배의 마른 괴물. 거리를 두고 방사능 덩어리를 뱉는다 (패링하면 되돌아간다)
//   직원(Employee)   : 방호복을 입은 공장 직원. 강하다 (체력 160~220, 딴딴함 20~24). 닿으면 목숨 3개.
//       sprayer : 분사기로 방사능 액을 쏜다. 가까이 가면 물러선다
//       guard   : 경비. 곤봉을 들고 곧장 달려든다
// 쏘는 것은 this.shot에 남겨 두면 main이 enemyShots에 넣어 준다 (시크너의 그림자와 같은 방식).
(function (G) {
  const C = G.Config;

  const SUBJECT = {
    brute: { w: 46, h: 50, hp: 400, tough: 60, speed: 150, coin: 260, exp: 50 },
    spitter: { w: 34, h: 58, hp: 400, tough: 60, speed: 95, coin: 260, exp: 50 },
  };
  const EMPLOYEE = {
    sprayer: { w: 28, h: 42, hp: 160, tough: 20, speed: 90, coin: 90, exp: 18 },
    guard: { w: 32, h: 44, hp: 220, tough: 24, speed: 175, coin: 110, exp: 22 },
  };

  class FactoryMob extends G.Monster {
    constructor(x, y, kind, variant, d, contact) {
      super(x, y, d.w, d.h, kind);
      this.variant = variant;
      this.d = d;
      this.twoHit = false;
      this.noRespawn = true;
      this.maxHp = this.hp = d.hp;
      this.extraHits = d.tough;
      this.coinVal = d.coin;
      this.expVal = d.exp;
      this.contactDmg = contact;
      this.shot = null;          // 방금 쏜 것 {x,y,vx,vy,...} (main이 가져간다)
      this.shotCd = 1.0 + Math.random();
      this.cooldown = 0;
      this.pause = 0;
      this.windup = 0;           // >0 이면 공격 준비 중 (읽을 수 있는 예비동작)
      this.dir = Math.random() < 0.5 ? -1 : 1;
    }

    _patrol(dt, terrain, k = 0.5) {
      if (this.pause > 0) { this.pause -= dt; this.vx = 0; return; }
      if (this.onGround && (this.hitWall || this._ledgeAhead(terrain))) this.dir = -this.dir;
      this.vx = this.dir * this.d.speed * k * 0.5;
      if (Math.random() < 0.008) this.pause = 0.6 + Math.random() * 1.2;
    }

    _finish(dt, terrain) {
      this.applyGravity(dt, 1);
      this.moveX(dt, terrain);
      this.moveY(dt, terrain);
      if (this.y > terrain.height + C.TILE * 2) { this.alive = false; this.gone = true; }
    }

    // 방사능 덩어리 하나를 플레이어 쪽으로 쏜다
    _spit(px, py, spd, dmg) {
      const cx = this.x + this.w / 2 + this.dir * 10, cy = this.y + this.h * 0.38;
      const dx = px - cx, dy = py - cy, len = Math.hypot(dx, dy) || 1;
      this.shot = { x: cx, y: cy, vx: (dx / len) * spd * this.stageSpeed, vy: (dy / len) * spd * this.stageSpeed, dmg, rad: true, life: 4 };
    }
  }

  class Subject extends FactoryMob {
    constructor(x, y, variant = 'brute') {
      super(x, y, 'subject', variant, SUBJECT[variant], 4);
    }
    static get SIZE() { return SUBJECT; }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      const dx = px - (this.x + this.w / 2), dy = py - (this.y + this.h / 2);
      const near = Math.abs(dx) < 520 && Math.abs(dy) < 240;
      if (this.variant === 'brute') {
        if (this.windup > 0) { // 덮치기 전에 웅크린다
          this.vx = 0; this.windup -= dt;
          if (this.windup <= 0) { this.vy = -430; this.vx = this.dir * 380; this.onGround = false; this.cooldown = 1.3; }
        } else if (near) {
          this.dir = dx < 0 ? -1 : 1;
          this.vx = this.dir * this.d.speed * this.stageSpeed;
          if (this.onGround && this._ledgeAhead(terrain)) this.vx = 0; // 구덩이 앞에서 멈춘다 (스스로 떨어지지 않는다)
          if (this.onGround && this.cooldown === 0 && Math.abs(dx) < 240) this.windup = 0.28;
        } else this._patrol(dt, terrain);
      } else { // spitter: 거리를 두고 뱉는다
        if (near) {
          this.dir = dx < 0 ? -1 : 1;
          const d = Math.abs(dx);
          this.vx = d < 190 ? -this.dir * this.d.speed * this.stageSpeed : d > 300 ? this.dir * this.d.speed * 0.7 * this.stageSpeed : 0; // 190~300 거리를 지킨다
          if (this.onGround && this._ledgeAhead(terrain) && this.vx * this.dir < 0) this.vx = 0;
          this.shotCd -= dt;
          if (this.shotCd <= 0 && d < 460) { this._spit(px, py, 300, 3); this.shotCd = 1.5; }
        } else this._patrol(dt, terrain);
      }
      this._finish(dt, terrain);
    }
  }

  class Employee extends FactoryMob {
    constructor(x, y, variant = 'sprayer') {
      super(x, y, 'employee', variant, EMPLOYEE[variant], 3);
    }
    static get SIZE() { return EMPLOYEE; }

    update(dt, player, terrain) {
      if (this.tickLifecycle(dt, terrain)) return;
      this.time += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      const dx = px - (this.x + this.w / 2), dy = py - (this.y + this.h / 2);
      const near = Math.abs(dx) < 480 && Math.abs(dy) < 220;
      if (this.variant === 'sprayer') {
        if (near) {
          this.dir = dx < 0 ? -1 : 1;
          const d = Math.abs(dx);
          this.vx = d < 140 ? -this.dir * this.d.speed * 1.2 * this.stageSpeed : d > 320 ? this.dir * this.d.speed * 0.6 * this.stageSpeed : 0;
          if (this.onGround && this._ledgeAhead(terrain) && this.vx * this.dir < 0) this.vx = 0;
          if (this.windup > 0) { this.windup -= dt; if (this.windup <= 0) { this._spit(px, py, 330, 2); this._spit(px, py - 40, 330, 2); this.shotCd = 1.5; } } // 한 번에 두 줄기
          else { this.shotCd -= dt; if (this.shotCd <= 0 && d < 420) this.windup = 0.4; }
        } else this._patrol(dt, terrain);
      } else { // guard: 곧장 달려든다
        if (near) {
          this.dir = dx < 0 ? -1 : 1;
          this.vx = this.dir * this.d.speed * this.stageSpeed;
          if (this.onGround && this._ledgeAhead(terrain)) this.vx = 0; // 구덩이 앞에서 멈춘다
          if (this.onGround && this.cooldown === 0 && Math.abs(dx) < 110 && Math.abs(dy) < 70) { this.vy = -300; this.vx = this.dir * 300; this.onGround = false; this.cooldown = 1.0; }
        } else this._patrol(dt, terrain);
      }
      this._finish(dt, terrain);
    }
  }

  G.Subject = Subject;
  G.Employee = Employee;
})(window.Game);
