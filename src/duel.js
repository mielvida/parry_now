// 결투장의 상대: 보스와 같은 인터페이스를 가진 AI 용사. 평소 게임 조작 그대로(이동/점프/패링/대시/검 던지기/쏘기) 싸운다.
//   mode 'cowboy' : 총싸움. 상대가 거리를 두고 겨냥한 뒤 총알을 쏜다. 총알은 패링으로 쳐내면 되돌아간다
//   mode 'fight'  : 칼싸움. 상대가 달려들어 칼을 치켜들었다가 벤다. 막거나 패링하면 틈이 생긴다
// 체력은 4~10 (맞는 횟수), 등급(lv)은 1~5로 높을수록 빠르고 자주 공격한다.
(function (G) {
  const C = G.Config;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 칼싸움 상대가 바꿔 드는 무기: 사거리(px) / 치켜드는 시간 / 한 번 벤 뒤 쉬는 시간 / 피해
  const WEAPONS = {
    katana1: { reach: 104, wind: 0.26, cd: 0.9, dmg: 1 },
    sword6: { reach: 124, wind: 0.42, cd: 1.1, dmg: 1 },
    rapier2: { reach: 150, wind: 0.34, cd: 1.0, dmg: 1 },
    spear2: { reach: 176, wind: 0.5, cd: 1.2, dmg: 1 },
    great4: { reach: 150, wind: 0.62, cd: 1.3, dmg: 2 },
    hammer2: { reach: 134, wind: 0.95, cd: 1.5, dmg: 2 },
  };
  const W = 24;
  const H = 32;

  class RivalBody {
    constructor(rival, hp) {
      this.rival = rival;
      this.w = W; this.h = H;
      this.maxHp = hp; this.hp = hp;
      this.alive = true; this.flying = false; this.appear = 0; this.twoHit = false; // 마법 판정이 읽는 몬스터 모양 필드
      this.state = 'idle';
      this.dmgFx = 0;
      this.x = 0; this.y = 0; this.cx = 0; this.cy = 0;
      this.vx = 0; this.vy = 0;
      this.inv = 0; this.flash = 0;
    }
    damage(n) { this.rival.damageBody(n); }
    applyPoison() { this.rival.damageBody(1); }
  }

  class DuelRival {
    constructor(left, width, groundY, ev, cfg) {
      this.kind = 'rival';
      this.name = `${cfg.name} (등급 ${cfg.lv})`;
      this.defeatText = '결투에서 이겼다!';
      this.weak = null;
      this.hurtDmg = cfg.lv >= 5 ? 2 : 1;
      this.left = left;
      this.right = left + width;
      this.camLeft = left;
      this.groundY = groundY;
      this.ev = ev;
      this.cfg = cfg;
      this.lv = cfg.lv;
      this.mode = cfg.mode;
      this.body = new RivalBody(this, cfg.hp);
      this.heads = [this.body];
      this.body.x = this.right - 140;
      this.body.y = groundY - H;
      this.body.cx = this.body.x + W / 2;
      this.body.cy = this.body.y + H / 2;
      this.facing = -1;
      this.phase = 'intro';
      this.timer = 1.8;
      this.time = 0;
      this.done = false;
      this.state = 'move';
      this.st = 0;
      this.cd = 1.0;
      this.shots = [];
      this.guard = 0;
      this.stagger = 0;
      this.swingT = 0;
      this.muzzle = 0;
      this.burst = 0;
      this.burstT = 0;
      this.hitDone = false;
      this.stop = false;
      this.playerX = (left + width) / 2;
      this.playerY = groundY;
      this.runPhase = 0;
    }

    get alive() { return this.body.alive ? [this.body] : []; }
    targets() { return this.body.alive && this.phase !== 'intro' ? [this.body] : []; }

    damageBody(n) {
      const b = this.body;
      if (!b.alive || b.inv > 0 || this.phase === 'intro') return;
      if (this.guard > 0) { // 막는 중: 이번 공격은 막힌다
        this.guard = 0;
        this.cd = Math.min(this.cd, 0.1); // 막은 뒤 바로 반격
        this.ev.fx('burst', b.cx, b.cy);
        this.ev.sound('catch');
        return;
      }
      b.hp = Math.max(0, b.hp - n);
      b.dmgFx += n;
      b.flash = 0.25;
      b.inv = 1.0; // 플레이어처럼 맞은 뒤 잠깐 무적
      b.vx = -this.facing * 190;
      this.stagger = Math.max(this.stagger, 0.22);
      if (b.hp <= 0) {
        b.alive = false;
        this.phase = 'dead';
        this.timer = 1.4;
        this.shots.length = 0;
        this.ev.fx('boom', b.cx, b.cy);
      }
    }

    hitHeads(rect, dmg) {
      const b = this.body;
      if (!b.alive || b.inv > 0 || this.phase === 'intro') return [];
      if (rect.x < b.x + b.w + 6 && rect.x + rect.w > b.x - 6 && rect.y < b.y + b.h && rect.y + rect.h > b.y) {
        const before = b.hp;
        this.damageBody(dmg);
        if (b.hp < before) return [b];
      }
      return [];
    }

    // 패링: 날아오는 총알을 쳐낸다. 되돌아간 총알에 맞으면 크게 아프다
    deflect(rect) {
      let n = 0;
      for (const s of this.shots) {
        if (s.reflected) continue;
        if (s.x + 8 < rect.x || s.x - 8 > rect.x + rect.w || s.y + 8 < rect.y || s.y - 8 > rect.y + rect.h) continue;
        s.reflected = true;
        s.vx = -s.vx * 1.4;
        s.vy = -s.vy * 1.4;
        s.life = 3;
        n += 1;
      }
      return n;
    }

    _physics(dt) {
      const b = this.body;
      b.vy += 1900 * dt;
      b.x = clamp(b.x + b.vx * dt, this.left + 8, this.right - 8 - W);
      b.y += b.vy * dt;
      if (b.y >= this.groundY - H) { b.y = this.groundY - H; b.vy = 0; b.onGround = true; } else b.onGround = false;
      b.cx = b.x + W / 2;
      b.cy = b.y + H / 2;
    }

    update(dt, player) {
      this.time += dt;
      this.playerX = player.x + player.w / 2;
      this.playerY = player.y + player.h / 2;
      const b = this.body;
      b.inv = Math.max(0, b.inv - dt);
      b.flash = Math.max(0, b.flash - dt);
      this.stagger = Math.max(0, this.stagger - dt);
      this.guard = Math.max(0, this.guard - dt);
      this.cd = Math.max(0, this.cd - dt);
      this.swingT = Math.max(0, this.swingT - dt);
      this.muzzle = Math.max(0, this.muzzle - dt);
      if (this.phase === 'dead') {
        b.vx *= Math.max(0, 1 - 5 * dt);
        this._physics(dt);
        this.timer -= dt;
        if (this.timer <= 0 && !this.done) { this.done = true; this.ev.defeated(); }
        return;
      }
      const dx = this.playerX - b.cx;
      const dist = Math.abs(dx);
      this.runPhase += Math.abs(b.vx) * dt * 0.09;
      if (this.phase === 'intro') {
        this.facing = Math.sign(dx) || this.facing;
        this.timer -= dt;
        if (this.timer <= 0) { this.phase = 'fight'; this.ev.sound('spawn'); }
        this._physics(dt);
        return;
      }
      this._updateShots(dt, player);
      if (this.stop) { b.vx *= Math.max(0, 1 - 6 * dt); this._physics(dt); return; }
      if (this.stagger > 0) b.vx *= Math.max(0, 1 - 6 * dt);
      else if (this.mode === 'cowboy') this._aiGun(dt, player, dx, dist);
      else this._aiSword(dt, player, dx, dist);
      this._physics(dt);
    }

    // ---- 칼싸움: 플레이어와 같은 조건. 무기를 바꿔 들고, 막고(패링), 대시로 피하고, 이어서 벤다 ----
    _pickWeapon() {
      const pool = ['katana1', 'sword6', 'spear2', 'rapier2', 'great4', 'hammer2'];
      const w = pool[Math.floor(Math.random() * pool.length)];
      this.weaponId = w;
      this.wp = WEAPONS[w];
      this.ev.fx('burst', this.body.cx, this.body.cy - 10);
    }

    _aiSword(dt, player, dx, dist) {
      const b = this.body;
      const lv = this.lv;
      if (!this.wp) this._pickWeapon();
      const wp = this.wp;
      this.guardCd = Math.max(0, (this.guardCd || 0) - dt);
      this.dashCd = Math.max(0, (this.dashCd || 0) - dt);
      this.dashT = Math.max(0, (this.dashT || 0) - dt);
      if (this.state !== 'strike') this.facing = Math.sign(dx) || this.facing;
      const swinging = player.swing >= 0 && player.swing < 12;
      // 막기: 내가 휘두르는 순간 가끔 막는다 (막는 동안 맞아도 피해가 없고, 막은 뒤엔 바로 반격한다)
      if (swinging && !this._sawSwing && dist < 190 && this.guardCd === 0 && this.state !== 'strike') {
        if (Math.random() < 0.35 + 0.1 * lv) { this.guard = 0.5; this.guardCd = Math.max(0.5, 1.5 - 0.15 * lv); this.state = 'move'; b.vx = 0; this.cd = Math.min(this.cd, 0.15); }
        else if (this.dashCd === 0 && Math.random() < 0.3) { this.dashT = 0.2; this.dashCd = 1.6; b.vx = -Math.sign(dx || 1) * 560; this.state = 'move'; }
      }
      this._sawSwing = swinging;
      if (this.dashT > 0) { b.inv = Math.max(b.inv, 0.05); return; }
      if (this.state === 'move') {
        const gap = wp.reach * 0.8;
        const want = dist > gap + 20 ? this.facing : dist < gap - 40 ? -this.facing : 0;
        b.vx += (want * (150 + 26 * lv) - b.vx) * Math.min(1, 9 * dt);
        if (this.cd === 0 && dist < wp.reach && Math.abs(this.playerY - b.cy) < 64) { this.state = 'wind'; this.st = 0; b.vx = 0; this.ev.sound('vanish'); }
        if (b.onGround && dist < 190 && Math.random() < dt * 0.22 * lv) b.vy = -560; // 가끔 뛴다
        if (this.dashCd === 0 && dist > 260 && Math.random() < dt * 0.5) { this.dashT = 0.18; this.dashCd = 1.8; b.vx = this.facing * 520; } // 멀면 대시로 파고든다
      } else if (this.state === 'wind') { // 칼을 치켜든다: 막거나 피할 기회
        this.st += dt;
        b.vx *= Math.max(0, 1 - 8 * dt);
        if (this.st >= Math.max(0.12, wp.wind - 0.05 * lv)) { this.state = 'strike'; this.st = 0; this.swingT = 0.3; this.hitDone = false; this.ev.sound('shatter'); }
      } else if (this.state === 'strike') {
        this.st += dt;
        if (!this.hitDone && this.st >= 0.08) {
          this.hitDone = true;
          const zone = { x: Math.min(b.cx, b.cx + this.facing * wp.reach), y: b.y - 6, w: wp.reach, h: H + 12 };
          if (player.overlaps(zone)) {
            if (player.parrying) { // 패링: 되받아쳐 틈이 생긴다
              this.stagger = 0.9;
              b.inv = 0;
              this.damageBody(2);
              this.ev.fx('burst', b.cx, b.cy);
              this.ev.sound('parry');
            } else if (player.invuln === 0 && !player.dashing) this.ev.hurt(wp.dmg + (lv >= 5 ? 1 : 0));
          }
        }
        if (this.st >= 0.3) {
          this.state = 'move';
          this.cd = Math.max(0.15, wp.cd - 0.12 * lv) + rnd(0, 0.3);
          if (Math.random() < 0.35 + 0.08 * lv) this.cd = 0.1; // 이어서 한 번 더
          if (Math.random() < 0.3) this._pickWeapon(); // 무기를 바꿔 든다
        }
      }
    }

    // ---- 총싸움: 거리를 두고 겨냥한 뒤 쏜다 ----
    _aiGun(dt, player, dx, dist) {
      const b = this.body;
      const lv = this.lv;
      this.facing = Math.sign(dx) || this.facing;
      if (this.state === 'move') {
        const want = dist > 360 ? this.facing : dist < 240 ? -this.facing : (Math.sin(this.time * 1.3) > 0.6 ? this.facing : 0);
        b.vx += (want * (120 + 22 * lv) - b.vx) * Math.min(1, 8 * dt);
        if (b.onGround && Math.random() < dt * 0.3 * lv) b.vy = -560;
        if (this.cd === 0 && dist > 140) { this.state = 'aim'; this.st = 0; b.vx = 0; this.ev.sound('vanish'); }
      } else if (this.state === 'aim') { // 총을 들어 겨눈다 (붉은 조준선이 보인다)
        this.st += dt;
        b.vx *= Math.max(0, 1 - 8 * dt);
        this.aimX = this.playerX; this.aimY = this.playerY;
        if (this.st >= Math.max(0.28, 0.7 - 0.08 * lv)) {
          this.burst = lv >= 4 ? 3 : lv >= 2 ? 2 : 1;
          this.burstT = 0;
          this.state = 'fire';
          this.st = 0;
        }
      } else if (this.state === 'fire') {
        this.burstT -= dt;
        if (this.burst > 0 && this.burstT <= 0) {
          this.burst -= 1;
          this.burstT = 0.16;
          const sx = b.cx + this.facing * 16;
          const sy = b.cy - 4;
          const ang = Math.atan2(this.playerY - sy, this.playerX - sx);
          const sp = 520 + 45 * lv;
          this.shots.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 2.6, reflected: false });
          this.muzzle = 0.1;
          this.ev.sound('gun');
        }
        if (this.burst <= 0 && this.burstT <= -0.1) { this.state = 'move'; this.cd = Math.max(0.5, 1.6 - 0.2 * lv) + rnd(0, 0.5); }
      }
    }

    _updateShots(dt, player) {
      const b = this.body;
      if (player.parrying && this.deflect({ x: player.x - 30, y: player.y - 24, w: player.w + 60, h: player.h + 48 })) this.ev.sound('parry'); // 패링으로 총알을 쳐낸다
      for (const s of this.shots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0 || s.x < this.left || s.x > this.right || s.y > this.groundY || s.y < this.groundY - 520) { s.dead = true; continue; }
        if (s.reflected) { // 되돌아간 총알은 상대에게 맞는다
          if (s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h) { s.dead = true; b.inv = 0; this.damageBody(3); this.ev.fx('burst', s.x, s.y); }
        } else if (player.invuln === 0 && !player.dashing && player.overlaps({ x: s.x - 6, y: s.y - 6, w: 12, h: 12 })) {
          s.dead = true;
          this.ev.hurt(this.hurtDmg);
        }
      }
      this.shots = this.shots.filter((s) => !s.dead);
    }

    // ---------- 그리기 ----------
    drawBack(ctx) { // 구경하는 마을 주민들 (모두 똑같은 모습)
      const gy = this.groundY;
      const n = 13;
      const cheer = this.phase === 'dead' ? 4 : 1.2;
      for (let i = 0; i < n; i++) {
        const x = this.left + 60 + i * ((this.right - this.left - 120) / (n - 1));
        const jump = Math.max(0, Math.sin(this.time * 5 + i * 1.7)) * cheer;
        G.Npc.draw(ctx, 'villager', x, gy - 4 - jump, i % 2 ? -1 : 1, this.time + i);
      }
    }

    drawFront(ctx) {
      const gy = this.groundY;
      const b = this.body;
      // 링의 로프와 모서리 기둥 (용사 뒤에 그려지지만 몸은 가리지 않게 가늘게)
      for (const [x, col] of [[this.left + 6, '#c0392b'], [this.right - 6, '#3a6fb0']]) {
        ctx.fillStyle = col; ctx.fillRect(x - 7, gy - 190, 14, 190);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 9, gy - 196, 18, 10);
      }
      if (this.state === 'aim' && this.phase === 'fight' && b.alive) { // 총 겨누기: 붉은 조준선
        const u = Math.min(1, this.st / Math.max(0.28, 0.7 - 0.08 * this.lv));
        ctx.strokeStyle = `rgba(255,70,70,${0.25 + 0.6 * u})`; ctx.lineWidth = 2 + 2 * u;
        ctx.beginPath(); ctx.moveTo(b.cx + this.facing * 16, b.cy - 4); ctx.lineTo(this.aimX, this.aimY); ctx.stroke();
      }
      if (this.state === 'wind' && b.alive) { // 칼을 치켜든 동안 머리 위에 느낌표
        ctx.fillStyle = `rgba(255,${Math.floor(this.time * 20) % 2 ? 90 : 200},70,0.95)`;
        ctx.fillRect(b.cx - 3, b.y - 30, 6, 16); ctx.fillRect(b.cx - 3, b.y - 10, 6, 6);
      }
      // 용사 모습
      const swing = this.swingT > 0 ? Math.min(19, 5 + Math.floor((1 - this.swingT / 0.3) * 14)) : this.state === 'wind' ? 3 : -1;
      ctx.save();
      if ((b.flash > 0 || b.inv > 0) && b.alive && Math.floor(this.time * 20) % 2) ctx.globalAlpha = 0.45;
      if (!b.alive) ctx.globalAlpha = Math.max(0.2, this.timer / 1.4);
      const c = this.cfg;
      G.Hero.draw(ctx, { x: b.x, y: b.y, w: W, h: H, facing: this.facing, vx: Math.abs(b.vx) > 30 ? b.vx : 0, onGround: !!b.onGround, animTime: this.time, runPhase: this.runPhase, swing, swordOut: false, guardTimer: this.guard > 0 ? 0.2 : 0, weaponId: this.mode === 'cowboy' ? 'gun2' : (this.weaponId || c.weapon), armorId: c.armor, helmetId: c.helmet, glovesId: null, bootsId: null });
      ctx.restore();
      if (this.muzzle > 0) { // 총구 불꽃
        ctx.fillStyle = 'rgba(255,230,140,0.9)';
        ctx.beginPath(); ctx.arc(b.cx + this.facing * 26, b.cy - 4, 9, 0, Math.PI * 2); ctx.fill();
      }
      for (const s of this.shots) { // 총알
        const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 14);
        g.addColorStop(0, s.reflected ? 'rgba(255,255,255,0.95)' : 'rgba(255,220,120,0.95)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.fillRect(s.x - 14, s.y - 14, 28, 28);
        ctx.fillStyle = s.reflected ? '#ffffff' : '#ffe08a';
        ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  G.DuelRival = DuelRival;
})(window.Game);
