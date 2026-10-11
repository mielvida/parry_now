// 허수아비 대미지 측정기: 때려도 쓰러지지 않고, 맞은 대미지를 재서 머리 위 판에 보여 준다.
//  마지막 한 방 / 합계 / 타수 / 초당 대미지(DPS) / 최고 한 방. 4초 동안 안 때리면 새로 잰다.
//  근접(패링 타격), 던진 검, 마법·총·활·폭탄 모두 잰다. 닿아도 해롭지 않다.
(function (G) {
  class Dummy extends G.Monster {
    constructor(x, y) {
      super(x, y, 30, 56, 'dummy');
      this.dummy = true;
      this.hp = this.maxHp = 1e9;
      this.dir = 1;
      this.contactDmg = 0;
      this.hitFlash = 0;
      this.sway = 0;
      this.session = { total: 0, hits: 0, t0: 0, t1: 0, last: 0, best: 0, crit: false, elem: {} };
      this.idle = 99;
      this.cur = null; // 지금 들어오는 피해의 종류 (불꽃/독 지속 피해 등)
    }

    // 맞은 대미지를 잰다. crit = 치명타 여부
    // kind: null = 일반 한 방 / 'fire'·'poison' = 속성 지속 피해 / 'shot' = 마법·총·활
    record(n, crit = false, kind = null) {
      if (this.idle > 4) this.session = { total: 0, hits: 0, t0: this.time, t1: this.time, last: 0, best: 0, crit: false, elem: {} }; // 새로 잰다
      const s = this.session;
      s.total += n; s.t1 = this.time;
      if (kind === 'fire' || kind === 'poison') { s.elem[kind] = (s.elem[kind] || 0) + n; this.idle = 0; this.hitFlash = 0.12; this.dmgFx += n; return; } // 속성 대미지는 타수에 넣지 않고 따로 센다
      s.hits += 1; s.last = n; s.best = Math.max(s.best, n); s.crit = crit;
      this.idle = 0;
      this.hitFlash = 0.22;
      this.sway = 1;
      this.dmgFx += n;
    }

    get dps() { // 첫 타부터 마지막 타까지의 초당 대미지 (한 방뿐이면 1초 기준)
      const s = this.session;
      if (!s.hits) return 0;
      return s.total / Math.max(1, s.t1 - s.t0);
    }

    // 마법/총/활이 입히는 피해도 잰다 (죽지 않는다)
    damage(n) { if (n > 0) this.record(n, false, this.cur || 'shot'); }
    // 불꽃/독은 걸리면 평소처럼 3초 동안 1초마다 피해를 입는다 (죽지는 않는다)
    _tickBurn(dt) { this.cur = 'fire'; super._tickBurn(dt); this.cur = null; }
    _tickPoison(dt) { this.cur = 'poison'; super._tickPoison(dt); this.cur = null; }
    freeze() {}
    stagger() {}
    knockback() {}
    hurt() {}
    reset() { this.alive = true; this.hp = this.maxHp; }

    update(dt) {
      this.time += dt;
      this.idle += dt;
      this.hitGrace = Math.max(0, this.hitGrace - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      if (this.burn) this._tickBurn(dt);
      if (this.poison) this._tickPoison(dt);
      this.sway = Math.max(0, this.sway - dt * 2.2);
    }
  }

  G.Dummy = Dummy;
})(window.Game);
