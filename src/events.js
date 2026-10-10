// 던전 이벤트: 어둠의 탑 층마다 무작위로 깔리는 이벤트들과, 층 전체에 걸리는 변수(혈월, 황금 비 …).
// 이 파일은 게임 규칙(목숨·코인·몬스터)을 직접 만지지 않고, main이 넘겨 주는 host 인터페이스로만 요청한다.
//
//  host = {
//    player,                                  플레이어 (x, y, w, h, invuln)
//    terrain,                                 (setup에서 따로 받는다)
//    monsters,                                몬스터 배열 (혈월이 속도를 올리고, 임시 몬스터를 정리한다)
//    sound(name), fx(effects), say(text,color), popup(x,y,text,color,t),
//    heal(n) -> 실제 회복량, hurt(n,x,y) -> 맞았는가, coins(n), exp(n), spendCoins(n) -> 샀는가,
//    giveItem(id,n), itemName(id), dialog(lines), staminaAdd(n), staminaFull(), invuln(sec),
//    spawnMonster(kind,x,y) -> 몬스터(임시), blast(x,y,r,dmg), attackBoxes() -> [사각형],
//    nudge(dx), teleport(x,y), trapDamage(floor), lives(), maxLives(), cameraTop()
//  }
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const label = (text, x, y, color = '#fff', size = 13) => { if (G.TextLayer) G.TextLayer.add(text, x, y, `bold ${size}px sans-serif`, color); };
  const glow = (ctx, x, y, r, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  const GOOD = 'rgba(125,255,160,A)';
  const BAD = 'rgba(255,140,140,A)';
  const GOLD = 'rgba(255,225,120,A)';
  const BLUE = 'rgba(150,215,255,A)';
  const PURPLE = 'rgba(200,150,255,A)';
  const ITEM_POOL = ['st30', 'st30', 'st70', 'icebomb'];

  // ======================= 기본 이벤트 =======================
  class Evt {
    constructor(kind, x, y) {
      this.kind = kind;
      this.x = x;          // 가운데 x
      this.y = y;          // 바닥(발판 윗면) y
      this.t = Math.random() * 6;
      this.age = 0;
      this.dead = false;   // 사라졌다 (매니저가 치운다)
      this.interactable = false;
      this.promptText = '';
    }
    get prompt() { return this.promptText; }
    get box() { return { x: this.x - 16, y: this.y - 32, w: 32, h: 32 }; }
    update(dt, m) { this.age += dt; this.t += dt; this.tick(dt, m); }
    tick() {}
    interact() { return false; }
    draw() {}
  }

  // ---- 회복의 샘: 피를 채운다 (한 번) ----
  class Fountain extends Evt {
    constructor(x, y) { super('fountain', x, y); this.interactable = true; this.promptText = '마시기'; this.used = false; }
    interact(m) {
      const h = m.host;
      if (this.used) { m.say('샘물이 말라 있다…', BAD); h.sound('deny'); return true; }
      const got = h.heal(1 + Math.floor(m.floor / 40));
      if (got <= 0) { m.say('피가 가득 차 있다', BLUE); return true; } // 마시지 않았으니 샘은 그대로
      this.used = true;
      h.sound('pickup');
      h.fx.sparkle(this.x, this.y - 30);
      h.fx.lightBurst(this.x, this.y - 28, 60);
      m.say(`샘물이 상처를 씻어 준다! 피 +${got}`, GOOD);
      return true;
    }
    draw(ctx, time) {
      const { x, y } = this;
      if (!this.used) glow(ctx, x, y - 24, 52, '90,230,255', 0.35);
      ctx.fillStyle = '#2f2943'; ctx.fillRect(x - 24, y - 12, 48, 12);
      ctx.fillStyle = '#4a4068'; ctx.fillRect(x - 24, y - 12, 48, 3);
      ctx.fillStyle = '#3a3253'; ctx.fillRect(x - 6, y - 26, 12, 14);
      ctx.fillStyle = '#4a4068'; ctx.fillRect(x - 20, y - 31, 40, 6);
      ctx.fillStyle = this.used ? '#34304a' : '#58e0f0'; ctx.fillRect(x - 17, y - 33, 34, 4);
      if (!this.used) {
        for (let i = 0; i < 4; i++) { // 솟는 물방울
          const ph = (time * 0.9 + i / 4) % 1;
          ctx.fillStyle = `rgba(190,245,255,${1 - ph})`;
          ctx.fillRect(x - 12 + i * 8 + Math.sin(ph * 6 + i) * 3, y - 34 - ph * 24, 3, 3);
        }
      }
    }
  }

  // ---- 떠돌이 상인: E로 값을 묻고, 한 번 더 E로 산다 ----
  class Merchant extends Evt {
    constructor(x, y, floor) {
      super('merchant', x, y);
      this.interactable = true;
      this.floor = floor;
      this.stock = 2;
      this.quote = 0;
      this.newOffer();
    }
    newOffer() {
      const f = this.floor;
      this.offer = pick([{ id: 'st70', cost: 70 + f }, { id: 'st30', cost: 40 + Math.floor(f / 2) }, { id: 'icebomb', cost: 100 + f }]);
    }
    get prompt() { return this.stock <= 0 ? '' : this.quote > 0 ? `사기 (${this.offer.cost}G)` : '말 걸기'; }
    tick(dt) { this.quote = Math.max(0, this.quote - dt); }
    interact(m) {
      const h = m.host;
      if (this.stock <= 0) { m.say('상인: "오늘은 다 팔았어."', BAD); h.sound('deny'); return true; }
      const name = h.itemName(this.offer.id);
      if (this.quote <= 0) {
        this.quote = 8;
        m.say(`상인: "${name} ${this.offer.cost}G, 살래?" (E: 구매)`, GOLD);
        h.sound('pickup');
        return true;
      }
      if (!h.spendCoins(this.offer.cost)) { m.say('코인이 부족하다', BAD); h.sound('deny'); return true; }
      h.giveItem(this.offer.id, 1);
      h.sound('coin');
      h.fx.sparkle(this.x, this.y - 30);
      m.say(`${name} 구매! (-${this.offer.cost}G)`, GOOD);
      this.stock -= 1;
      this.quote = 0;
      if (this.stock > 0) this.newOffer();
      return true;
    }
    draw(ctx, time) {
      const { x, y } = this;
      const bob = Math.sin(time * 2 + this.t) * 1;
      glow(ctx, x + 18, y - 22 + bob, 34, '255,210,120', 0.3); // 등불
      ctx.fillStyle = '#3a2a55'; ctx.fillRect(x - 12, y - 8, 24, 8);         // 망토 자락
      ctx.beginPath(); ctx.moveTo(x - 13, y - 6); ctx.lineTo(x - 8, y - 34 + bob); ctx.lineTo(x + 8, y - 34 + bob); ctx.lineTo(x + 13, y - 6); ctx.closePath();
      ctx.fillStyle = '#54398a'; ctx.fill();
      ctx.fillStyle = '#1a1030'; ctx.fillRect(x - 6, y - 30 + bob, 12, 10);   // 두건 속
      ctx.fillStyle = '#ffe36b'; ctx.fillRect(x - 4, y - 27 + bob, 3, 2); ctx.fillRect(x + 1, y - 27 + bob, 3, 2);
      ctx.fillStyle = '#7a5a2a'; ctx.fillRect(x - 17, y - 26, 6, 16);         // 배낭
      ctx.fillStyle = '#9a7a3a'; ctx.fillRect(x - 17, y - 26, 6, 3);
      ctx.fillStyle = '#6b4a22'; ctx.fillRect(x + 14, y - 30 + bob, 2, 10);   // 등불 막대
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(x + 12, y - 22 + bob, 6, 6);
      if (this.stock > 0 && this.quote > 0) label(`${this.offer.cost}G`, x, y - 50, '#ffe36b');
    }
  }

  // ---- 저주받은 제단: 도박. 축복(보상)이거나 저주(매복) ----
  class Altar extends Evt {
    constructor(x, y) { super('altar', x, y); this.interactable = true; this.promptText = '기도하기'; this.used = false; }
    interact(m) {
      const h = m.host;
      if (this.used) { m.say('제단은 침묵하고 있다', BAD); h.sound('deny'); return true; }
      this.used = true;
      const cx = this.x;
      const cy = this.y - 30;
      if (Math.random() < 0.55) { // 축복
        h.exp(15 + m.floor * 3);
        h.coins(20 + m.floor * 3);
        h.heal(0.5);
        h.sound('treasure');
        h.fx.lightBurst(cx, cy, 90);
        h.fx.treasure(cx, cy);
        m.say(`제단의 축복! +${15 + m.floor * 3} EXP  +${20 + m.floor * 3} G`, GOLD);
      } else { // 저주: 어둠의 하수인들이 몰려든다
        h.sound('spawn');
        h.fx.shake(10, 0.5);
        h.fx.fireBurst(cx, cy);
        m.say('저주가 내렸다! 어둠이 몰려온다…', PURPLE);
        m.spawnWave(cx, this.y, 2 + Math.floor(m.floor / 30));
      }
      return true;
    }
    draw(ctx, time) {
      const { x, y } = this;
      const a = this.used ? 0.1 : 0.35 + 0.15 * Math.sin(time * 3 + this.t);
      glow(ctx, x, y - 30, 50, '190,90,255', a);
      ctx.fillStyle = '#241838'; ctx.fillRect(x - 16, y - 8, 32, 8);
      ctx.beginPath(); ctx.moveTo(x - 12, y - 8); ctx.lineTo(x - 7, y - 52); ctx.lineTo(x + 7, y - 52); ctx.lineTo(x + 12, y - 8); ctx.closePath();
      ctx.fillStyle = '#3a2a58'; ctx.fill();
      ctx.fillStyle = this.used ? '#4a3a68' : `rgba(220,140,255,${0.7 + 0.3 * Math.sin(time * 4)})`; // 룬
      ctx.fillRect(x - 2, y - 44, 4, 16); ctx.fillRect(x - 7, y - 38, 14, 3); ctx.fillRect(x - 5, y - 28, 10, 3);
    }
  }

  // ---- 수상한 상자: 보상이거나 미믹 ----
  class MimicChest extends Evt {
    constructor(x, y) { super('mimic', x, y); this.interactable = true; this.promptText = '열기'; this.used = false; this.open = 0; }
    interact(m) {
      const h = m.host;
      if (this.used) return false;
      this.used = true;
      if (Math.random() < 0.6) {
        const gold = 30 + m.floor * 4;
        h.coins(gold);
        h.sound('treasure');
        h.fx.treasure(this.x, this.y - 20);
        let text = `상자 속에 금화가! +${gold} G`;
        if (Math.random() < 0.5) { const id = pick(ITEM_POOL); h.giveItem(id, 1); text += `  ${h.itemName(id)}`; }
        m.say(text, GOLD);
      } else { // 미믹!
        this.dead = true;
        h.sound('spawn');
        h.fx.shake(9, 0.4);
        h.fx.fireBurst(this.x, this.y - 18);
        m.say('미믹이다!', BAD);
        h.spawnMonster(m.floor >= 15 ? 'darkstone' : 'darkslime', this.x, this.y);
      }
      return true;
    }
    tick(dt) { if (this.used) this.open = Math.min(1, this.open + dt * 3); }
    draw(ctx, time, m) {
      const { x, y } = this;
      const near = m && Math.abs(m.px() - x) < 150 && !this.used;
      glow(ctx, x, y - 14, 36, '255,200,90', 0.2);
      ctx.fillStyle = '#6e4220'; ctx.fillRect(x - 15, y - 16, 30, 16);
      ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 15, y - 16, 30, 3); ctx.fillRect(x - 3, y - 16, 6, 16);
      const lift = this.open * 12;
      ctx.fillStyle = '#85502a'; ctx.fillRect(x - 15, y - 24 - lift, 30, 8);
      ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 15, y - 24 - lift, 30, 2);
      if (near && Math.sin(time * 7) > 0.2) { // 가까이 가면 이빨이 슬쩍 보인다 (눈치 빠른 사람을 위한 힌트)
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) ctx.fillRect(x - 11 + i * 7, y - 18, 3, 3);
      }
    }
  }

  // ---- 소원의 우물: 25G를 던져 소원을 빈다 (최대 3번) ----
  class Well extends Evt {
    constructor(x, y) { super('well', x, y); this.interactable = true; this.promptText = '소원 빌기 (25G)'; this.left = 3; }
    interact(m) {
      const h = m.host;
      if (this.left <= 0) { m.say('우물이 조용하다…', BAD); h.sound('deny'); return true; }
      if (!h.spendCoins(25)) { m.say('코인이 부족하다 (25G)', BAD); h.sound('deny'); return true; }
      this.left -= 1;
      h.sound('coin');
      h.fx.sparkle(this.x, this.y - 22);
      const r = Math.random();
      if (r < 0.3) { const got = h.heal(1); m.say(got > 0 ? `소원이 이루어졌다! 피 +${got}` : '소원이 이루어졌다! (피가 가득 차 있다)', GOOD); }
      else if (r < 0.55) { h.exp(10 + m.floor * 2); m.say(`지혜가 스며든다! +${10 + m.floor * 2} EXP`, BLUE); }
      else if (r < 0.75) { h.coins(75 + m.floor); h.sound('treasure'); h.fx.treasure(this.x, this.y - 20); m.say(`금화가 솟아올랐다! +${75 + m.floor} G`, GOLD); }
      else m.say('…아무 일도 일어나지 않았다.', 'rgba(210,210,230,A)');
      return true;
    }
    draw(ctx, time) {
      const { x, y } = this;
      glow(ctx, x, y - 14, 38, '120,200,255', 0.22 + 0.08 * Math.sin(time * 2));
      ctx.fillStyle = '#3b3550'; ctx.fillRect(x - 20, y - 18, 40, 18);
      ctx.fillStyle = '#524a70'; ctx.fillRect(x - 20, y - 18, 40, 4);
      ctx.fillStyle = '#3aa8d8'; ctx.fillRect(x - 15, y - 20, 30, 4);
      ctx.fillStyle = '#6b4a22'; ctx.fillRect(x - 18, y - 42, 3, 24); ctx.fillRect(x + 15, y - 42, 3, 24); ctx.fillRect(x - 18, y - 44, 36, 3);
      if (this.left > 0) { ctx.fillStyle = `rgba(200,240,255,${0.5 + 0.5 * Math.sin(time * 5)})`; ctx.fillRect(x - 1, y - 20, 2, 2); }
    }
  }

  // ---- 수호의 룬: 잠깐 무적 + 스태미나 가득 ----
  class Rune extends Evt {
    constructor(x, y) { super('rune', x, y); this.interactable = true; this.promptText = '룬 만지기'; this.used = false; }
    interact(m) {
      const h = m.host;
      if (this.used) { m.say('룬의 빛이 사그라들었다', BAD); h.sound('deny'); return true; }
      this.used = true;
      h.invuln(10);
      h.staminaFull();
      h.sound('pickup');
      h.fx.lightBurst(this.x, this.y - 20, 80);
      m.say('수호의 룬! 10초간 무적, 스태미나 가득', BLUE);
      return true;
    }
    draw(ctx, time) {
      const { x, y } = this;
      const a = this.used ? 0.08 : 0.4 + 0.15 * Math.sin(time * 3);
      glow(ctx, x, y - 12, 46, '110,190,255', a);
      ctx.save();
      ctx.translate(x, y - 3);
      ctx.scale(1, 0.32);
      ctx.strokeStyle = this.used ? 'rgba(110,130,170,0.4)' : `rgba(170,225,255,${0.7 + 0.3 * Math.sin(time * 4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(time * (this.used ? 0.2 : 1.2));
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a2 = (i / 3) * Math.PI * 2; ctx.lineTo(Math.cos(a2) * 22, Math.sin(a2) * 22); } ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 보급 상자: 소모품과 약간의 코인 ----
  class Crate extends Evt {
    constructor(x, y) { super('crate', x, y); this.interactable = true; this.promptText = '열기'; this.used = false; this.open = 0; }
    interact(m) {
      const h = m.host;
      if (this.used) return false;
      this.used = true;
      const n = Math.random() < 0.35 ? 2 : 1;
      const names = [];
      for (let i = 0; i < n; i++) { const id = pick(ITEM_POOL); h.giveItem(id, 1); names.push(h.itemName(id)); }
      const gold = 10 + m.floor * 2;
      h.coins(gold);
      h.sound('pickup');
      h.fx.sparkle(this.x, this.y - 16);
      m.say(`${names.join(', ')} + ${gold}G`, GOOD);
      return true;
    }
    tick(dt) { if (this.used) this.open = Math.min(1, this.open + dt * 4); }
    draw(ctx) {
      const { x, y } = this;
      ctx.fillStyle = '#7a5428'; ctx.fillRect(x - 14, y - 22, 28, 22);
      ctx.fillStyle = '#946a34'; ctx.fillRect(x - 14, y - 22, 28, 3); ctx.fillRect(x - 14, y - 11, 28, 2);
      ctx.fillStyle = '#5a3d1c'; ctx.fillRect(x - 14, y - 22, 3, 22); ctx.fillRect(x + 11, y - 22, 3, 22);
      if (this.used) { ctx.fillStyle = '#1b1224'; ctx.fillRect(x - 11, y - 22, 22, 6); ctx.fillStyle = '#946a34'; ctx.save(); ctx.translate(x + 14, y - 22); ctx.rotate(this.open * 0.9); ctx.fillRect(-28, -4, 28, 4); ctx.restore(); }
      else { ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 2, y - 17, 4, 5); }
    }
  }

  // ---- 방랑 기사: 힌트와 이야기 (처음 말을 걸면 경험치) ----
  const KNIGHT_LINES = [
    ['방랑 기사: "자네도 시크너를 쓰러뜨리러 왔나?"', '방랑 기사: "33층, 66층, 100층에는 보스가 있다네. 미리 장비를 정비해 두게."'],
    ['방랑 기사: "함정 바닥의 가시는 올라오기 전에 반짝인다네. 잘 봐 두게."'],
    ['방랑 기사: "붉은 룬을 밟으면 매복이야. 일부러 밟아 경험치를 노리는 이도 있지."'],
    ['방랑 기사: "폭발 통은 베면 터지지. 몬스터 곁에서 터뜨리면 한 방이야."'],
    ['방랑 기사: "상자가 눈을 치켜뜨고 이빨을 드러내면… 미믹이라네."'],
    ['방랑 기사: "황금 도둑 요정을 놓치지 말게. 몰래 도망치지만 잡으면 큰돈이야."'],
    ['방랑 기사: "차원문은 위층 발판으로 이어져 있어. 지름길이지."'],
    ['방랑 기사: "이 모닥불 곁에서 쉬었다 가게나. 탑은 올라갈수록 가혹해진다네."'],
  ];
  class Knight extends Evt {
    constructor(x, y) { super('knight', x, y); this.interactable = true; this.promptText = '말 걸기'; this.talked = false; }
    interact(m) {
      const h = m.host;
      h.dialog(pick(KNIGHT_LINES));
      if (!this.talked) {
        this.talked = true;
        h.exp(20 + m.floor);
        h.sound('pickup');
        m.say(`기사의 가르침! +${20 + m.floor} EXP`, BLUE);
      }
      return true;
    }
    draw(ctx, time) {
      const { x, y } = this;
      // 모닥불
      glow(ctx, x + 22, y - 12, 50, '255,150,60', 0.3 + 0.1 * Math.sin(time * 9));
      ctx.fillStyle = '#4a3320'; ctx.fillRect(x + 14, y - 4, 16, 4);
      for (let i = 0; i < 3; i++) {
        const fh = 10 + Math.sin(time * 11 + i * 2) * 4 + i;
        ctx.fillStyle = i === 1 ? '#ffd36a' : '#ff8a3a';
        ctx.beginPath(); ctx.moveTo(x + 16 + i * 5, y - 4); ctx.lineTo(x + 19 + i * 5, y - 4 - fh); ctx.lineTo(x + 22 + i * 5, y - 4); ctx.closePath(); ctx.fill();
      }
      // 앉아 있는 기사
      ctx.fillStyle = '#3a4a6a'; ctx.fillRect(x - 10, y - 20, 20, 20);                 // 갑옷
      ctx.fillStyle = '#5a6f9a'; ctx.fillRect(x - 10, y - 20, 20, 4);
      ctx.fillStyle = '#9aa8c4'; ctx.fillRect(x - 8, y - 34, 16, 14);                  // 투구
      ctx.fillStyle = '#1b2433'; ctx.fillRect(x - 1, y - 29, 8, 3);
      ctx.fillStyle = '#c63a4a'; ctx.fillRect(x - 3, y - 38, 6, 5);                    // 깃털
      ctx.fillStyle = '#d8dce8'; ctx.fillRect(x - 15, y - 28, 3, 28);                  // 땅에 세운 검
    }
  }

  // ======================= 함정과 구역 =======================
  // ---- 가시 함정: 숨었다가 경고하고 솟아오른다 ----
  class Spikes extends Evt {
    constructor(x, y, tiles) {
      super('spikes', x, y);
      this.tiles = tiles;
      this.cycle = rand(0, 3.2);
      this.armed = 0; // 마지막으로 맞힌 뒤 대기
    }
    get w() { return this.tiles * T - 4; }
    // 주기: 숨음 1.5초 -> 경고 0.55초 -> 솟음 0.8초
    get phase() { const c = this.cycle % 2.85; return c < 1.5 ? 'hidden' : c < 2.05 ? 'warn' : 'up'; }
    tick(dt, m) {
      this.cycle += dt;
      if (this.armed > 0) { this.armed -= dt; return; }
      if (this.phase !== 'up') return;
      const p = m.host.player;
      const hit = { x: this.x - this.w / 2, y: this.y - 24, w: this.w, h: 24 };
      if (p.invuln <= 0 && overlap(hit, { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 4 })) {
        if (m.host.hurt(m.host.trapDamage(m.floor), p.x + p.w / 2, p.y + p.h)) { this.armed = 1; m.host.fx.fireBurst(p.x + p.w / 2, p.y + p.h - 8); }
      }
    }
    draw(ctx) {
      const ph = this.phase;
      const x0 = this.x - this.w / 2;
      const rise = ph === 'up' ? 1 : ph === 'warn' ? 0.25 + 0.15 * Math.sin(this.cycle * 40) : 0;
      ctx.fillStyle = '#1b1224'; ctx.fillRect(x0, this.y - 3, this.w, 3);
      for (let i = 0; i < this.tiles * 2; i++) {
        const sx = x0 + 3 + i * (this.w - 6) / (this.tiles * 2 - 1) - 4;
        ctx.fillStyle = '#2a1c38'; ctx.fillRect(sx + 1, this.y - 3, 6, 3); // 구멍
        if (rise > 0) {
          const h = 22 * rise;
          ctx.beginPath(); ctx.moveTo(sx, this.y - 3); ctx.lineTo(sx + 4, this.y - 3 - h); ctx.lineTo(sx + 8, this.y - 3); ctx.closePath();
          ctx.fillStyle = ph === 'warn' ? '#a07890' : '#d8dce8'; ctx.fill();
        }
      }
      if (ph === 'warn') { ctx.fillStyle = 'rgba(255,90,90,0.35)'; ctx.fillRect(x0, this.y - 4, this.w, 4); }
    }
  }

  // ---- 낙석 함정: 발판을 밟으면 위에서 바위가 떨어진다 ----
  class RockPlate extends Evt {
    constructor(x, y) { super('rocks', x, y); this.cool = 0; this.pressed = 0; }
    tick(dt, m) {
      this.cool = Math.max(0, this.cool - dt);
      this.pressed = Math.max(0, this.pressed - dt);
      if (this.cool > 0) return;
      const p = m.host.player;
      if (Math.abs(p.x + p.w / 2 - this.x) < 18 && Math.abs(p.y + p.h - this.y) < 8) {
        this.cool = 8;
        this.pressed = 0.5;
        m.host.sound('clack');
        m.say('바닥이 꺼졌다! 위를 봐!', BAD);
        const px = p.x + p.w / 2;
        for (const off of [-52, 0, 52, rand(-110, 110)]) m.dropRock(px + off + rand(-8, 8), p.y + p.h - 4);
      }
    }
    draw(ctx) {
      const { x, y } = this;
      const down = this.pressed > 0 ? 3 : 0;
      ctx.fillStyle = '#241838'; ctx.fillRect(x - 20, y - 2, 40, 2);
      ctx.fillStyle = this.cool > 0 ? '#4a3a58' : '#6a4a78'; ctx.fillRect(x - 17, y - 6 + down, 34, 4);
      ctx.fillStyle = this.cool > 0 ? '#5a4a68' : '#ffd36a'; // 경고 표식
      ctx.beginPath(); ctx.moveTo(x, y - 14 + down); ctx.lineTo(x + 5, y - 7 + down); ctx.lineTo(x - 5, y - 7 + down); ctx.closePath(); ctx.fill();
    }
  }

  // ---- 화염 분출구: 땅 속에서 불기둥이 솟는다 ----
  class FireVent extends Evt {
    constructor(x, y) { super('vent', x, y); this.cycle = rand(0, 4); this.armed = 0; }
    // 주기: 잠잠 2.2초 -> 진동 0.7초 -> 불기둥 1.0초
    get phase() { const c = this.cycle % 3.9; return c < 2.2 ? 'idle' : c < 2.9 ? 'rumble' : 'blast'; }
    tick(dt, m) {
      this.cycle += dt;
      if (this.armed > 0) { this.armed -= dt; return; }
      if (this.phase === 'rumble' && Math.random() < dt * 14) m.host.fx.sparkle(this.x + rand(-8, 8), this.y - 4);
      if (this.phase !== 'blast') return;
      const p = m.host.player;
      const hit = { x: this.x - 15, y: this.y - 110, w: 30, h: 110 };
      if (p.invuln <= 0 && overlap(hit, { x: p.x + 4, y: p.y + 2, w: p.w - 8, h: p.h - 2 })) {
        if (m.host.hurt(m.host.trapDamage(m.floor), p.x + p.w / 2, p.y + p.h / 2)) { this.armed = 0.9; m.host.fx.fireBurst(p.x + p.w / 2, p.y + p.h / 2); }
      }
    }
    draw(ctx, time) {
      const { x, y } = this;
      const ph = this.phase;
      ctx.fillStyle = '#1b1224'; ctx.fillRect(x - 17, y - 4, 34, 4);
      ctx.fillStyle = '#3a2a48';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + i * 8, y - 3, 4, 3);
      if (ph === 'rumble') { glow(ctx, x, y - 6, 26, '255,120,60', 0.35 + 0.2 * Math.sin(time * 40)); }
      if (ph === 'blast') {
        const k = clamp((this.cycle % 3.9 - 2.9) / 0.25, 0, 1);
        const h = 104 * k;
        glow(ctx, x, y - h / 2, 70, '255,140,50', 0.35);
        for (let i = 0; i < 3; i++) {
          const w = 26 - i * 8;
          ctx.fillStyle = ['#ff6a2a', '#ffb03a', '#fff2b0'][i];
          ctx.beginPath(); ctx.moveTo(x - w / 2, y - 3);
          for (let s = 0; s <= 6; s++) ctx.lineTo(x - w / 2 + (s % 2 ? 2 : -2) + w * (s / 6) * 0 + Math.sin(time * 18 + s + i) * 2, y - 3 - h * (s / 6) * (1 - i * 0.12));
          ctx.lineTo(x + w / 2, y - 3); ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  // ---- 매복 표식: 밟으면 몬스터가 몰려든다. 모두 물리치면 보상 ----
  class AmbushRune extends Evt {
    constructor(x, y) { super('ambush', x, y); this.triggered = false; this.wave = null; this.paid = false; }
    tick(dt, m) {
      if (!this.triggered) {
        const p = m.host.player;
        if (Math.abs(p.x + p.w / 2 - this.x) < 20 && Math.abs(p.y + p.h - this.y) < 8) {
          this.triggered = true;
          m.host.sound('spawn');
          m.host.fx.shake(8, 0.4);
          m.host.fx.fireBurst(this.x, this.y - 8);
          m.say('매복이다!', BAD);
          this.wave = m.spawnWave(this.x, this.y, 2 + Math.floor(m.floor / 25));
        }
      } else if (!this.paid && this.wave && this.wave.every((w) => !w.alive)) {
        this.paid = true;
        m.host.exp(10 + m.floor * 2);
        m.host.coins(20 + m.floor * 2);
        m.host.sound('treasure');
        m.host.fx.treasure(this.x, this.y - 20);
        m.say(`매복을 물리쳤다! +${10 + m.floor * 2} EXP  +${20 + m.floor * 2} G`, GOLD);
      }
    }
    draw(ctx, time) {
      if (this.triggered) return;
      const { x, y } = this;
      const a = 0.2 + 0.12 * Math.sin(time * 3 + this.t);
      ctx.save();
      ctx.translate(x, y - 2);
      ctx.scale(1, 0.3);
      ctx.strokeStyle = `rgba(255,70,90,${a + 0.15})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 5; i++) { const q = -Math.PI / 2 + (i * 2 / 5) * Math.PI * 2; ctx.lineTo(Math.cos(q) * 15, Math.sin(q) * 15); } ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 폭발 통: 베거나 쳐내면 터져서 주변 몬스터를 날린다 (플레이어도 조심) ----
  class Barrel extends Evt {
    constructor(x, y) { super('barrel', x, y); this.fuse = 0; }
    get box() { return { x: this.x - 13, y: this.y - 28, w: 26, h: 28 }; }
    detonate(m) {
      if (this.dead) return;
      this.dead = true;
      const h = m.host;
      const r = 92;
      h.sound('boom');
      h.fx.fireBurst(this.x, this.y - 14);
      h.fx.quakeDust(this.x, this.y, 60);
      h.fx.shake(12, 0.4);
      h.blast(this.x, this.y - 14, r, 3 + Math.floor(m.floor / 10));
      const p = h.player;
      if (p.invuln <= 0 && Math.hypot(p.x + p.w / 2 - this.x, p.y + p.h / 2 - (this.y - 14)) < r * 0.75) h.hurt(h.trapDamage(m.floor), p.x + p.w / 2, p.y + p.h / 2);
      for (const o of m.list) if (o !== this && o.kind === 'barrel' && !o.dead && Math.hypot(o.x - this.x, o.y - this.y) < r * 1.1) o.fuse = 0.18; // 연쇄 폭발
    }
    tick(dt, m) {
      if (this.fuse > 0) { this.fuse -= dt; if (this.fuse <= 0) this.detonate(m); return; }
      const b = this.box;
      for (const a of m.host.attackBoxes()) if (overlap(a, b)) { this.detonate(m); return; }
    }
    draw(ctx, time) {
      const { x, y } = this;
      ctx.fillStyle = '#7a3a24'; ctx.fillRect(x - 12, y - 26, 24, 26);
      ctx.fillStyle = '#9a5030'; ctx.fillRect(x - 12, y - 26, 24, 3);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(x - 13, y - 22, 26, 3); ctx.fillRect(x - 13, y - 8, 26, 3);
      ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x - 3, y - 18, 6, 6); // 위험 표시
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 17, 1, 1); ctx.fillRect(x + 1, y - 17, 1, 1);
      if (this.fuse > 0 || Math.sin(time * 6 + this.t) > 0.7) { ctx.fillStyle = '#ffd36a'; ctx.fillRect(x - 1, y - 30, 3, 3); }
    }
  }

  // ---- 돌풍 통로: 한쪽으로 몸이 밀린다 (방향이 바뀐다) ----
  class WindZone extends Evt {
    constructor(x, y, tiles) { super('wind', x, y); this.tiles = tiles; this.dir = Math.random() < 0.5 ? 1 : -1; this.flip = rand(2, 4); }
    get zone() { return { x: this.x - this.tiles * T / 2, y: this.y - 150, w: this.tiles * T, h: 150 }; }
    tick(dt, m) {
      this.flip -= dt;
      if (this.flip <= 0) { this.dir = -this.dir; this.flip = rand(2.8, 4.2); }
      const p = m.host.player;
      if (overlap(this.zone, p)) m.host.nudge(this.dir * 150 * dt);
    }
    draw(ctx, time) {
      const z = this.zone;
      ctx.fillStyle = 'rgba(150,200,255,0.06)'; ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(190,225,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const ph = ((time * 0.9 * this.dir + i * 0.37) % 1 + 1) % 1;
        const sx = z.x + ph * z.w;
        const sy = z.y + 12 + ((i * 53) % (z.h - 24));
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - this.dir * 18, sy); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(210,235,255,0.55)'; // 방향 화살표
      const ax = this.x; const ay = this.y - 12;
      ctx.beginPath(); ctx.moveTo(ax + this.dir * 12, ay); ctx.lineTo(ax - this.dir * 6, ay - 7); ctx.lineTo(ax - this.dir * 6, ay + 7); ctx.closePath(); ctx.fill();
    }
  }

  // ======================= 보너스와 이동 =======================
  // ---- 황금 도둑 요정: 도망친다. 잡거나 베면 큰돈 ----
  class Thief extends Evt {
    constructor(x, y, x0, x1) {
      super('thief', x, y);
      this.x0 = x0; this.x1 = x1; this.life = 20; this.blinkCd = 0; this.dir = 1; this.hop = 0;
    }
    get box() { return { x: this.x - 11, y: this.y - 22, w: 22, h: 22 }; }
    catchIt(m) {
      this.dead = true;
      const gold = 80 + m.floor * 8;
      m.host.coins(gold);
      m.host.exp(10 + m.floor);
      m.host.sound('treasure');
      m.host.fx.treasure(this.x, this.y - 12);
      m.say(`도둑 요정을 잡았다! +${gold} G`, GOLD);
    }
    tick(dt, m) {
      this.life -= dt;
      this.blinkCd = Math.max(0, this.blinkCd - dt);
      if (this.life <= 0) { this.dead = true; m.host.fx.vanish(this.x, this.y - 12); m.say('도둑 요정이 달아났다…', BAD); return; }
      const p = m.host.player;
      const px = p.x + p.w / 2;
      const near = Math.abs(px - this.x) < 230 && Math.abs(p.y + p.h - this.y) < 90;
      if (near) {
        this.dir = this.x >= px ? 1 : -1; // 플레이어 반대쪽으로
        this.x = clamp(this.x + this.dir * 175 * dt, this.x0, this.x1);
        const cornered = (this.x <= this.x0 + 1 && this.dir < 0) || (this.x >= this.x1 - 1 && this.dir > 0);
        if (cornered && Math.abs(px - this.x) < 90 && this.blinkCd <= 0) { // 막다른 곳에서 반대편으로 순간이동
          m.host.fx.vanish(this.x, this.y - 12);
          this.x = this.dir < 0 ? this.x1 : this.x0;
          this.blinkCd = 2.4;
          m.host.fx.sparkle(this.x, this.y - 12);
        }
      } else this.x = clamp(this.x + Math.sin(this.age * 1.3) * 30 * dt, this.x0, this.x1);
      this.hop = Math.abs(Math.sin(this.age * (near ? 14 : 5))) * (near ? 9 : 4);
      const b = this.box;
      if (overlap(b, p) || m.host.attackBoxes().some((a) => overlap(a, b))) this.catchIt(m);
    }
    draw(ctx, time) {
      const { x } = this;
      const y = this.y - this.hop;
      glow(ctx, x, y - 12, 34, '255,215,90', 0.4);
      ctx.fillStyle = '#e0a82a'; ctx.beginPath(); ctx.ellipse(x, y - 10, 11, 10, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 11, y - 10, 22, 8);
      ctx.fillStyle = '#ffe36b'; ctx.fillRect(x - 8, y - 17, 5, 3);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(x - 5, y - 11, 3, 4); ctx.fillRect(x + 2, y - 11, 3, 4);
      ctx.fillStyle = '#6a4a1a'; ctx.fillRect(x + 8, y - 20, 8, 9); // 돈주머니
      ctx.fillStyle = '#ffd54a'; ctx.fillRect(x + 10, y - 17, 4, 4);
      if (Math.sin(time * 9 + this.t) > 0.5) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 12, y - 24, 2, 2); ctx.fillRect(x + 12, y - 6, 2, 2); }
    }
  }

  // ---- 코인 아치: 공중에 호를 그린 코인 줄. 모두 모으면 보너스 ----
  class CoinArc extends Evt {
    constructor(x, y, tiles) {
      super('arc', x, y);
      this.coinList = [];
      const n = 7;
      const span = Math.min(tiles, 8) * T - 24;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        this.coinList.push({ x: x - span / 2 + span * u, y: y - 26 - Math.sin(u * Math.PI) * 74, got: false });
      }
      this.bonus = false;
    }
    tick(dt, m) {
      const p = m.host.player;
      const pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
      let any = false;
      for (const c of this.coinList) {
        if (c.got) continue;
        if (Math.hypot(c.x - pc.x, c.y - pc.y) < 22) {
          c.got = true;
          const v = 4 + Math.floor(m.floor / 6);
          m.host.coins(v);
          m.host.sound('coin');
          m.host.popup(c.x, c.y - 8, `+${v} G`, GOLD, 0.8);
          m.host.fx.sparkle(c.x, c.y);
        }
        any = true;
      }
      if (this.coinList.every((c) => c.got) && !this.bonus) { // 마지막 코인을 주운 바로 그 프레임에 보너스
        this.bonus = true;
        m.host.coins(25);
        m.host.sound('treasure');
        m.say('코인 아치 완주! +25 G', GOLD);
        this.dead = true;
      }
    }
    draw(ctx, time) {
      for (let i = 0; i < this.coinList.length; i++) {
        const c = this.coinList[i];
        if (c.got) continue;
        const w = 4 + Math.abs(Math.cos(time * 4 + i * 0.7)) * 5;
        glow(ctx, c.x, c.y, 16, '255,215,80', 0.25);
        ctx.fillStyle = '#d99a1a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, w, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.max(1, w - 2), 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---- 도약 버섯: 위에서 밟으면 높이 튀어 오른다 ----
  class BouncePad extends Evt {
    constructor(x, y) { super('pad', x, y); this.squash = 0; this.cool = 0; }
    tick(dt, m) {
      this.squash = Math.max(0, this.squash - dt * 4);
      this.cool = Math.max(0, this.cool - dt);
      if (this.cool > 0) return;
      const p = m.host.player;
      const feet = p.y + p.h;
      if (p.vy >= 0 && Math.abs(p.x + p.w / 2 - this.x) < 22 && feet >= this.y - 18 && feet <= this.y - 6) {
        p.vy = -860;
        p.onGround = false;
        this.squash = 1;
        this.cool = 0.3;
        m.host.sound('jump');
        m.host.fx.landDust(this.x, this.y, 0.6);
        m.host.fx.sparkle(this.x, this.y - 18);
      }
    }
    draw(ctx) {
      const { x, y } = this;
      const s = 1 - this.squash * 0.35;
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 5, y - 16 * s, 10, 16 * s);          // 기둥
      ctx.fillStyle = '#d93a5a';
      ctx.beginPath(); ctx.ellipse(x, y - 17 * s, 21 + this.squash * 4, 12 * s, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 21 - this.squash * 4, y - 17 * s, 42 + this.squash * 8, 4);
      ctx.fillStyle = '#ffe9ee';
      ctx.fillRect(x - 10, y - 24 * s, 5, 4); ctx.fillRect(x + 3, y - 27 * s, 6, 4); ctx.fillRect(x + 11, y - 21 * s, 4, 3);
    }
  }

  // ---- 차원문: 한 쌍. 낮은 발판과 높은 발판을 잇는 지름길 ----
  class Portal extends Evt {
    constructor(x, y) { super('portal', x, y); this.pair = null; this.cool = 0; }
    tick(dt, m) {
      this.cool = Math.max(0, this.cool - dt);
      if (this.cool > 0 || !this.pair || this.pair.dead) return;
      const p = m.host.player;
      if (Math.abs(p.x + p.w / 2 - this.x) < 14 && Math.abs(p.y + p.h - this.y) < 14) {
        this.cool = this.pair.cool = 1.4;
        m.host.teleport(this.pair.x - p.w / 2, this.pair.y - p.h);
        m.host.sound('zap');
        m.host.fx.lightBurst(this.x, this.y - 24, 50);
        m.host.fx.lightBurst(this.pair.x, this.pair.y - 24, 50);
      }
    }
    draw(ctx, time) {
      const { x, y } = this;
      const hue = this.pair && this.pair.y < this.y ? '190,110,255' : '90,220,255';
      glow(ctx, x, y - 24, 46, hue, 0.35 + 0.1 * Math.sin(time * 4));
      ctx.save();
      ctx.translate(x, y - 24);
      ctx.strokeStyle = `rgba(${hue},0.9)`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 17, 0, time * 3, time * 3 + Math.PI * 1.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, -time * 4, -time * 4 + Math.PI); ctx.stroke();
      ctx.restore();
    }
  }

  // ======================= 층 전체 변수 =======================
  const MODS = {
    bloodmoon: {
      name: '혈월', desc: '몬스터가 빨라진다 — 보상 2배', color: '255,70,80', min: 8, weight: 3, reward: 2,
      start(m) { for (const mo of m.host.monsters) mo.stageSpeed = (mo.stageSpeed || 1) * 1.35; },
      overlay(ctx, w, h, m, time) {
        const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
        g.addColorStop(0, 'rgba(120,0,20,0)');
        g.addColorStop(1, `rgba(150,10,30,${0.38 + 0.08 * Math.sin(time * 2)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,70,80,0.9)'; ctx.beginPath(); ctx.arc(w - 70, 150, 17, 0, Math.PI * 2); ctx.fill(); // 붉은 달
        ctx.fillStyle = 'rgba(120,10,30,0.9)'; ctx.beginPath(); ctx.arc(w - 64, 146, 17, 0, Math.PI * 2); ctx.fill();
      },
    },
    goldrain: {
      name: '황금 비', desc: '하늘에서 금화가 쏟아진다!', color: '255,215,90', min: 1, weight: 3, reward: 1,
      update(dt, m) {
        if (m.modT < 1.5 || m.modT > 22) return;
        m.dropT -= dt;
        if (m.dropT > 0) return;
        m.dropT = 0.28;
        const p = m.host.player;
        m.drops.push({ x: p.x + p.w / 2 + rand(-320, 320), y: m.host.cameraTop() - 20, vy: 0, life: 9 });
      },
    },
    fog: {
      name: '짙은 안개', desc: '시야가 좁아진다 — 보상 1.5배', color: '190,180,220', min: 5, weight: 2, reward: 1.5,
      overlay(ctx, w, h, m, time) {
        const p = m.host.player;
        const sx = m.screen.x(p.x + p.w / 2);
        const sy = m.screen.y(p.y + p.h / 2);
        const g = ctx.createRadialGradient(sx, sy, 60, sx, sy, 230);
        g.addColorStop(0, 'rgba(20,14,40,0)');
        g.addColorStop(1, `rgba(20,14,40,${0.88 + 0.04 * Math.sin(time)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      },
    },
    quake: {
      name: '지진', desc: '땅이 흔들리고 바위가 떨어진다 — 보상 1.5배', color: '210,170,120', min: 4, weight: 2, reward: 1.5,
      update(dt, m) {
        m.quakeT -= dt;
        if (m.quakeT > 0) return;
        m.quakeT = rand(6, 9);
        const p = m.host.player;
        m.host.fx.shake(8, 0.7);
        m.host.sound('boom');
        for (let i = 0; i < 3; i++) m.dropRock(p.x + p.w / 2 + rand(-160, 160), p.y + p.h - 4);
      },
    },
    starlight: {
      name: '별빛의 축복', desc: '피가 천천히 차오른다', color: '170,200,255', min: 1, weight: 2, reward: 1,
      update(dt, m) {
        m.host.staminaAdd(dt * 6);
        m.healT -= dt;
        if (m.healT > 0) return;
        m.healT = 14;
        const got = m.host.heal(0.5);
        if (got > 0) m.say('별빛이 상처를 보듬는다 피 +½', BLUE);
      },
      overlay(ctx, w, h, m, time) {
        for (let i = 0; i < 26; i++) {
          const sx = (i * 137.5) % w;
          const sy = (i * 71.3 + time * 8) % h;
          ctx.fillStyle = `rgba(200,220,255,${0.25 + 0.5 * Math.abs(Math.sin(time * 1.5 + i))})`;
          ctx.fillRect(sx, sy, 2, 2);
        }
      },
    },
  };

  // ======================= 정의표와 배치 =======================
  // width = 필요한 발판 너비(타일), max = 한 층에 최대 개수, weight(floor) = 뽑힐 비중, min = 나오기 시작하는 층
  const DEFS = [
    { id: 'fountain', width: 3, max: 1, min: 1, weight: () => 5, make: (x, y) => new Fountain(x, y) },
    { id: 'merchant', width: 3, max: 1, min: 1, weight: () => 4, make: (x, y, f) => new Merchant(x, y, f) },
    { id: 'altar', width: 3, max: 1, min: 3, weight: () => 4, make: (x, y) => new Altar(x, y) },
    { id: 'mimic', width: 2, max: 1, min: 2, weight: () => 4, make: (x, y) => new MimicChest(x, y) },
    { id: 'well', width: 3, max: 1, min: 1, weight: () => 3, make: (x, y) => new Well(x, y) },
    { id: 'rune', width: 2, max: 1, min: 1, weight: () => 3, make: (x, y) => new Rune(x, y) },
    { id: 'crate', width: 2, max: 3, min: 1, weight: () => 6, make: (x, y) => new Crate(x, y) },
    { id: 'knight', width: 4, max: 1, min: 1, weight: () => 2, make: (x, y) => new Knight(x, y) },
    { id: 'spikes', width: 4, max: 3, min: 1, weight: () => 8, make: (x, y) => new Spikes(x, y, 3) },
    { id: 'rocks', width: 3, max: 2, min: 4, weight: () => 5, make: (x, y) => new RockPlate(x, y) },
    { id: 'vent', width: 3, max: 2, min: 6, weight: () => 5, make: (x, y) => new FireVent(x, y) },
    { id: 'ambush', width: 3, max: 2, min: 2, weight: () => 5, make: (x, y) => new AmbushRune(x, y) },
    { id: 'barrel', width: 3, max: 3, min: 2, weight: () => 6, make: (x, y) => new Barrel(x, y) },
    { id: 'wind', width: 6, max: 1, min: 5, weight: () => 3, make: (x, y) => new WindZone(x, y, 6) },
    { id: 'thief', width: 6, max: 1, min: 2, weight: () => 3, make: (x, y, f, seg) => new Thief(x, y, seg.x0 + 18, seg.x1 - 18) },
    { id: 'arc', width: 7, max: 2, min: 1, weight: () => 6, make: (x, y, f, seg) => new CoinArc(x, y, seg.tiles) },
    { id: 'pad', width: 3, max: 2, min: 1, weight: () => 5, make: (x, y) => new BouncePad(x, y) },
    { id: 'portal', width: 3, max: 1, min: 3, weight: () => 3, pair: true, make: (x, y) => new Portal(x, y) },
  ];

  class EventManager {
    constructor(host) {
      this.host = host;
      this.terrain = null;
      this.floor = 1;
      this.list = [];
      this.rocks = [];
      this.drops = [];
      this.mod = null;
      this.modT = 0;
      this.dropT = 0;
      this.quakeT = 5;
      this.healT = 14;
      this.announceT = 0;
      this.view = { x: 0, y: 0, w: 960, h: 576 };
      this.screen = { x: (wx) => wx - this.view.x, y: (wy) => wy - this.view.y };
    }

    px() { const p = this.host.player; return p.x + p.w / 2; }
    say(text, color) { this.host.say(text, color); }

    // 층 보상(경험치/코인) 배율: 혈월 2배, 안개/지진 1.5배
    rewardMul() { return this.mod ? MODS[this.mod].reward : 1; }

    // 탑 층마다 새로 깐다. enabled=false(허브, 보스방 …)이면 모두 비운다
    setup(terrain, floor, enabled) {
      this.terrain = terrain;
      this.floor = floor;
      this.list = [];
      this.rocks = [];
      this.drops = [];
      this.mod = null;
      this.modT = 0;
      this.dropT = 0;
      this.quakeT = rand(4, 6);
      this.healT = 10;
      this.announceT = 0;
      if (!enabled) return;

      const segs = this.segments(terrain);
      const taken = [];
      const counts = {};
      const target = Math.min(11, 5 + Math.floor(floor / 14)) + (Math.random() < 0.4 ? 1 : 0);
      let guard = 0;
      while (this.list.length < target && guard++ < 80) {
        const pool = DEFS.filter((d) => floor >= d.min && (counts[d.id] || 0) < d.max);
        if (!pool.length) break;
        const total = pool.reduce((s, d) => s + d.weight(floor), 0);
        let r = Math.random() * total;
        let def = pool[0];
        for (const d of pool) { r -= d.weight(floor); if (r <= 0) { def = d; break; } }
        if (this.placeDef(def, segs, taken, floor)) counts[def.id] = (counts[def.id] || 0) + 1;
        else counts[def.id] = def.max; // 자리가 없으니 더 시도하지 않는다
      }

      // 층 전체 변수 (약 40%)
      if (floor >= 2 && Math.random() < 0.4) {
        const ids = Object.keys(MODS).filter((id) => floor >= MODS[id].min);
        const total = ids.reduce((s, id) => s + MODS[id].weight, 0);
        let r = Math.random() * total;
        let chosen = ids[0];
        for (const id of ids) { r -= MODS[id].weight; if (r <= 0) { chosen = id; break; } }
        this.mod = chosen;
        if (MODS[chosen].start) MODS[chosen].start(this);
      }
    }

    // 서 있을 수 있는 발판 구간 {row, x0, x1, tiles} (px). 시작점/문 근처는 제외
    segments(terrain) {
      const spots = terrain.standingSpots();
      const byRow = {};
      for (const s of spots) (byRow[s.row] = byRow[s.row] || []).push(s.col);
      const keep = [];
      if (terrain.spawn && terrain.spawn.col !== undefined) keep.push({ col: terrain.spawn.col, r: 5 });
      if (terrain.treasure) keep.push({ col: terrain.treasure.col, r: 3 });
      for (const e of terrain.exits || []) keep.push({ col: e.col, r: 4 });
      const segs = [];
      for (const row of Object.keys(byRow)) {
        const cols = byRow[row].sort((a, b) => a - b);
        let start = cols[0];
        for (let i = 1; i <= cols.length; i++) {
          if (i === cols.length || cols[i] !== cols[i - 1] + 1) {
            const end = cols[i - 1];
            const c0 = Math.max(start, 4);
            const c1 = Math.min(end, terrain.cols - 5);
            if (c1 - c0 + 1 >= 2) segs.push({ row: Number(row), c0, c1 });
            start = cols[i];
          }
        }
      }
      // 시작점/문 근처 잘라내기
      const out = [];
      for (const s of segs) {
        let a = s.c0;
        let b = s.c1;
        for (const k of keep) {
          if (k.col - k.r <= b && k.col + k.r >= a) {
            if (k.col - k.r - a >= b - (k.col + k.r)) b = Math.min(b, k.col - k.r - 1);
            else a = Math.max(a, k.col + k.r + 1);
          }
        }
        if (b - a + 1 >= 2) out.push({ row: s.row, c0: a, c1: b });
      }
      return out;
    }

    placeDef(def, segs, taken, floor) {
      const need = def.width;
      const cands = segs.filter((s) => s.c1 - s.c0 + 1 >= need);
      for (let tries = 0; tries < 12 && cands.length; tries++) {
        const s = pick(cands);
        const span = s.c1 - s.c0 + 1;
        const c = s.c0 + Math.floor((need - 1) / 2) + irand(0, Math.max(0, span - need));
        const lo = c - Math.floor((need - 1) / 2) - 1;
        const hi = lo + need + 1;
        if (taken.some((t) => t.row === s.row && !(hi < t.lo || lo > t.hi))) continue; // 이미 쓰는 자리 (한 칸 띄운다)
        const x = c * T + T / 2 + ((need % 2 === 0) ? T / 2 : 0) * 0;
        const y = (s.row + 1) * T;
        const seg = { x0: s.c0 * T, x1: (s.c1 + 1) * T, tiles: span };
        const e = def.make(x, y, floor, seg);
        if (e.coinList && e.coinList.some((c) => this.terrain.isSolid(Math.floor(c.x / T), Math.floor(c.y / T)))) continue; // 코인이 위층 발판 속에 박히면 닿을 수 없다 -> 다른 자리로
        if (def.pair) { // 차원문: 다른 높은 발판에 짝을 만든다
          const higher = segs.filter((q) => q.row <= s.row - 4 && q.c1 - q.c0 + 1 >= 3 && !taken.some((t) => t.row === q.row && !(q.c1 + 1 < t.lo || q.c0 - 1 > t.hi)));
          if (!higher.length) return false;
          const q = pick(higher);
          const qc = q.c0 + 1 + irand(0, Math.max(0, q.c1 - q.c0 - 2));
          const other = def.make(qc * T + T / 2, (q.row + 1) * T, floor, seg);
          e.pair = other; other.pair = e;
          taken.push({ row: q.row, lo: qc - 2, hi: qc + 2 });
          this.list.push(other);
        }
        taken.push({ row: s.row, lo, hi });
        this.list.push(e);
        return true;
      }
      return false;
    }

    // 어둠의 하수인 몇 마리를 위에서 떨어뜨린다
    spawnWave(cx, cy, count) {
      const f = this.floor;
      const kinds = f < 8 ? ['darkslime', 'darkslime', 'shade'] : f < 25 ? ['darkslime', 'darkstone', 'shade', 'darkslime'] : ['darkstone', 'shade', 'shade', 'darkslime', 'darkstone'];
      const maxX = this.terrain ? (this.terrain.cols - 4) * T : 1e9;
      const list = [];
      for (let i = 0; i < count; i++) {
        const side = i % 2 ? 1 : -1;
        const kind = pick(kinds);
        const x = clamp(cx + side * rand(110, 220), 4 * T, maxX);
        const y = kind === 'shade' ? cy - rand(60, 130) : cy - 130;
        const mo = this.host.spawnMonster(kind, x, y);
        if (mo) list.push(mo);
      }
      return list;
    }

    // 바위 하나를 떨어뜨린다: 땅에 닿을 곳을 먼저 경고한 뒤 낙하
    dropRock(x, fromY) {
      const t = this.terrain;
      const col = Math.floor(x / T);
      let r = Math.floor((fromY - 8) / T);
      while (r < t.rows && !t.isSolid(col, r)) r++;
      const landY = r * T;
      this.rocks.push({ x, y: landY - 340, vy: 0, landY, warn: 0.85, state: 'warn', hit: false });
    }

    update(dt) {
      if (!this.terrain) return;
      this.modT += dt;
      this.announceT += dt;
      const m = this;
      for (const e of this.list) e.update(dt, m);
      this.list = this.list.filter((e) => !e.dead);
      this.updateRocks(dt);
      this.updateDrops(dt);
      if (this.mod && MODS[this.mod].update) MODS[this.mod].update(dt, this);
      // 죽은 임시 몬스터(매복/저주/미믹 등)를 치운다: 부활하지 않는다
      const mons = this.host.monsters;
      for (let k = mons.length - 1; k >= 0; k--) if (mons[k].temp && !mons[k].alive && !mons[k].vanished) mons.splice(k, 1);
    }

    updateRocks(dt) {
      const p = this.host.player;
      for (const r of this.rocks) {
        if (r.state === 'warn') { r.warn -= dt; if (r.warn <= 0) r.state = 'fall'; continue; }
        if (r.state !== 'fall') continue;
        r.vy = Math.min(r.vy + 1700 * dt, 900);
        r.y += r.vy * dt;
        const box = { x: r.x - 13, y: r.y - 13, w: 26, h: 26 };
        if (!r.hit && p.invuln <= 0 && overlap(box, { x: p.x + 3, y: p.y + 2, w: p.w - 6, h: p.h - 2 })) {
          r.hit = true;
          this.host.hurt(this.host.trapDamage(this.floor), p.x + p.w / 2, p.y + p.h / 2);
        }
        if (r.y + 13 >= r.landY) {
          r.state = 'dead';
          this.host.fx.quakeDust(r.x, r.landY, 40);
          this.host.fx.shake(4, 0.15);
          this.host.sound('clack');
        }
      }
      this.rocks = this.rocks.filter((r) => r.state !== 'dead');
    }

    // 황금 비로 떨어진 코인: 닿으면 줍는다
    updateDrops(dt) {
      const p = this.host.player;
      const t = this.terrain;
      for (let k = this.drops.length - 1; k >= 0; k--) {
        const d = this.drops[k];
        d.life -= dt;
        if (!d.landed) {
          d.vy = Math.min(d.vy + 700 * dt, 260);
          d.y += d.vy * dt;
          if (t.isSolid(Math.floor(d.x / T), Math.floor((d.y + 9) / T))) { d.landed = true; d.vy = 0; }
        }
        if (Math.hypot(d.x - (p.x + p.w / 2), d.y - (p.y + p.h / 2)) < 24) {
          const v = 3 + Math.floor(this.floor / 4);
          this.host.coins(v);
          this.host.sound('coin');
          this.host.popup(d.x, d.y - 10, `+${v} G`, GOLD, 0.7);
          this.drops.splice(k, 1);
          continue;
        }
        if (d.life <= 0 || d.y > t.height + 40) this.drops.splice(k, 1);
      }
    }

    nearest() {
      const p = this.host.player;
      const px = p.x + p.w / 2;
      const feet = p.y + p.h;
      let best = null;
      let bd = 1e9;
      for (const e of this.list) {
        if (!e.interactable || e.dead) continue;
        const dx = Math.abs(px - e.x);
        const dy = Math.abs(feet - e.y);
        if (dx < T * 1.6 && dy < T * 2.2 && dx < bd) { best = e; bd = dx; }
      }
      return best;
    }

    // E키: 가까운 이벤트와 상호작용. 처리했으면 true (main은 다른 E 동작을 하지 않는다)
    interact() {
      const e = this.nearest();
      if (!e) return false;
      return e.interact(this) !== false;
    }

    // ---- 그리기 ----
    draw(ctx, time, view) {
      if (!this.terrain) return;
      if (view) this.view = view;
      const v = this.view;
      const inView = (x, y, pad = 130) => x > v.x - pad && x < v.x + v.w + pad && y > v.y - pad && y < v.y + v.h + pad;
      for (const e of this.list) if (inView(e.x, e.y, 200)) e.draw(ctx, time, this);
      // 낙석 경고(바닥 그림자)와 바위
      for (const r of this.rocks) {
        if (r.state === 'warn') {
          const k = 1 - r.warn / 0.85;
          ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.3 * k})`;
          ctx.beginPath(); ctx.ellipse(r.x, r.landY - 2, 8 + 12 * k, 3 + 3 * k, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(255,90,90,${0.4 + 0.4 * Math.sin(time * 30)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(r.x, r.landY - 2, 8 + 12 * k, 3 + 3 * k, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (r.state === 'fall') {
          ctx.fillStyle = '#4a4258'; ctx.beginPath(); ctx.arc(r.x, r.y, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6a6080'; ctx.beginPath(); ctx.arc(r.x - 4, r.y - 4, 7, 0, Math.PI * 2); ctx.fill();
          { const gr = ctx.createLinearGradient(0, r.y - 80, 0, r.y - 12); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.28)'); ctx.fillStyle = gr; ctx.fillRect(r.x - 5, r.y - 80, 10, 68); } // 낙하 궤적(추처럼 보이지 않게 위로 갈수록 투명)
        }
      }
      // 황금 비 코인
      for (const d of this.drops) {
        const w = 3 + Math.abs(Math.cos(time * 5 + d.x)) * 5;
        glow(ctx, d.x, d.y, 14, '255,215,80', 0.3);
        ctx.fillStyle = '#d99a1a'; ctx.beginPath(); ctx.ellipse(d.x, d.y, w, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.ellipse(d.x, d.y, Math.max(1, w - 2), 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 상호작용 안내: 가장 가까운 한 곳
      const near = this.nearest();
      if (near && near.prompt) label(`E  ${near.prompt}`, near.x, near.y - 62, '#ffffff');
    }

    // 화면 좌표: 층 변수 효과와 안내 문구
    drawOverlay(ctx, w, h, cam, time) {
      if (!this.terrain || !this.mod) return;
      if (cam) { this.view.x = cam.x; this.view.y = cam.y; }
      const def = MODS[this.mod];
      if (def.overlay) def.overlay(ctx, w, h, this, time);
      // 층이 시작되고 잠시 뒤 크게 알리고, 이후엔 작게 표시한다
      const big = this.announceT > 1.6 && this.announceT < 5.6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (big) {
        const a = clamp(Math.min((this.announceT - 1.6) / 0.4, (5.6 - this.announceT) / 0.6), 0, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
        ctx.fillRect(0, 120, w, 74);
        ctx.font = 'bold 34px sans-serif';
        ctx.fillStyle = `rgba(${def.color},${a})`;
        ctx.fillText(`층 이벤트: ${def.name}`, w / 2, 144);
        ctx.font = '18px sans-serif';
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillText(def.desc, w / 2, 175);
      } else if (this.announceT >= 5.6) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(`${def.name} — ${def.desc}`, w / 2 + 1, 23);
        ctx.fillStyle = `rgba(${def.color},0.95)`;
        ctx.fillText(`${def.name} — ${def.desc}`, w / 2, 22);
      }
      ctx.textAlign = 'start';
    }
  }

  G.DungeonEvents = { create: (host) => new EventManager(host), DEFS, MODS, EventManager };
})(window.Game);
