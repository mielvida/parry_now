// 광물 동굴: 바닥과 발판 위에 큼직한 광석 덩어리(노드)가 놓여 있고, 곡괭이로 E를 눌러(길게 누르면 계속) 캔다.
//  - 곡괭이 단계(1~4)가 광석 단계보다 낮으면 캘 수 없다. 단계가 높을수록 한 번에 더 깊이 판다
//  - 동굴 안쪽(오른쪽)으로 갈수록, 탐험 횟수가 늘수록 높은 단계(희귀한) 광석이 나온다
//  - 희귀할수록 더 크고 더 환하게 빛난다 (3단계부터 빛줄기, 4단계는 별빛과 빛 기둥)
//  - 다 캐면 광석이 튀어나와 땅에 떨어진다. 가까이 가서 E로 줍는다
//  - 타격감: 내리칠 때마다 곡괭이 휘두르기, 파편, 불꽃, 화면 흔들림, 잠깐 멈춤, 묵직한 소리
//  - 검용 광석과 총용 광석이 섞여 있다. 캔 광석은 대장간에서 제련해 무기에 붙인다 (forge.js)
// 이 파일은 규칙(인벤토리)을 직접 만지지 않고 main이 넘겨 주는 host 로만 요청한다.
//  host = { player, fx, sound(name), say(text,color), popup(x,y,text,color,t), giveOre(id,n), pickTier(), pickLook(), hitStop(sec) }
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const F = G.Forge;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const SWING_GAP = 0.3;                       // 길게 누를 때 곡괭이를 휘두르는 간격(초)
  const SWING_TIME = 0.2;                      // 곡괭이를 휘두르는 모습이 보이는 시간
  const POWER = [0, 1, 2, 3.5, 5];             // 곡괭이 단계별 한 번에 파는 양
  const hardness = (tier) => 3 + 3 * tier;     // 광석 단계별 단단함 (1단계 6, 4단계 15)
  const sizeOf = (ore) => 1.3 + 0.25 * ore.tier; // 희귀할수록 크다 (1단계 1.55배 ~ 4단계 2.3배)
  const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');

  class OreNodes {
    constructor(host) {
      this.host = host;
      this.list = [];
      this.drops = [];
      this.terrain = null;
      this.holdT = 0;
      this.swingT = 0;       // >0 이면 곡괭이를 휘두르는 중
      this.swingDir = 1;
      this.needRelease = false; // 줍고 나면 E를 뗄 때까지 곡괭이질을 시작하지 않는다
      this.view = { x: 0, y: 0, w: 960, h: 576 };
    }

    // 동굴을 불러올 때마다 노드를 새로 깐다 (enabled=false면 비운다)
    setup(terrain, run, enabled) {
      this.list = [];
      this.drops = [];
      this.terrain = terrain;
      this.holdT = 0;
      this.swingT = 0;
      this.needRelease = false;
      if (!enabled) return;
      const cols = terrain.cols;
      const spots = terrain.standingSpots().filter((s) => s.col > 12 && s.col < cols - 10);
      const n = Math.min(24, Math.max(8, Math.floor(cols / 14)));
      const taken = [];
      for (let tries = 0; this.list.length < n && tries < n * 40 && spots.length; tries++) {
        const s = spots[Math.floor(Math.random() * spots.length)];
        if (taken.some((t) => Math.abs(t.col - s.col) < 10)) continue; // 가로로 10칸 이상 띄엄띄엄
        const p = s.col / cols; // 동굴 안쪽일수록 높은 단계
        const ore = this.rollOre(p, run);
        taken.push(s);
        this.list.push({ x: s.col * T + T / 2, y: (s.row + 1) * T, ore, hp: hardness(ore.tier), max: hardness(ore.tier), shake: 0, flash: 0, squash: 0, t: Math.random() * 6 });
      }
    }

    // 위치(0~1)와 탐험 횟수로 광석 하나를 고른다
    rollOre(p, run) {
      const w = { 1: 1.0, 2: p > 0.2 ? 0.3 + 0.7 * p : 0.06, 3: p > 0.45 ? 0.5 * p + 0.04 * run : 0.02, 4: p > 0.7 ? 0.45 * p + 0.03 * run : 0.008 };
      let total = 0;
      for (const t of [1, 2, 3, 4]) total += w[t];
      let r = Math.random() * total;
      let tier = 1;
      for (const t of [1, 2, 3, 4]) { r -= w[t]; if (r <= 0) { tier = t; break; } }
      const pool = F.ORES.filter((o) => o.tier === tier);
      let sum = 0;
      for (const o of pool) sum += o.weight;
      let q = Math.random() * sum;
      for (const o of pool) { q -= o.weight; if (q <= 0) return o; }
      return pool[0];
    }

    // 가장 가까운 노드 (플레이어 발 기준. 큰 바위일수록 조금 더 멀리서도 닿는다)
    nearest() {
      const p = this.host.player;
      const px = p.x + p.w / 2;
      const feet = p.y + p.h;
      let best = null;
      let bd = 1e9;
      for (const nd of this.list) {
        const dx = Math.abs(px - nd.x);
        const dy = Math.abs(feet - nd.y);
        if (dx < T * 1.3 + 18 * sizeOf(nd.ore) && dy < T * 2 && dx < bd) { best = nd; bd = dx; }
      }
      return best;
    }

    // 주울 수 있는 떨어진 광석들 (플레이어 가까이)
    dropsNear() {
      const p = this.host.player;
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      return this.drops.filter((d) => d.landed && Math.abs(d.x - px) < T * 2.2 && Math.abs(d.y - py) < T * 2.2);
    }

    // ---- 타격 효과 ----
    chips(nd, power, big) {
      const fx = this.host.fx;
      const o = nd.ore;
      const rgb = hexRGB(o.look[0]);
      const away = Math.sign(nd.x - (this.host.player.x + this.host.player.w / 2)) || 1;
      const n = Math.round((big ? 22 : 6) + power * (big ? 3 : 2) + o.tier * (big ? 3 : 1));
      const sc = sizeOf(o);
      for (let i = 0; i < n; i++) {
        const ore = i % 3 === 0;
        fx.particles.push({
          kind: 'blob', x: nd.x + rand(-14, 14) * sc, y: nd.y - rand(6, 26) * sc,
          vx: (big ? rand(-220, 220) : away * rand(40, 200) + rand(-60, 60)), vy: -rand(120, big ? 380 : 260),
          life: rand(0.35, 0.8), max: 0.8, size: rand(2, big ? 5.5 : 4), gravity: 900,
          color: ore ? rgb : (i % 2 ? '120,116,138' : '78,74,92'),
        });
      }
      for (let i = 0; i < (big ? 14 : 5); i++) { // 번쩍이는 불꽃
        fx.particles.push({
          kind: 'spark', x: nd.x + rand(-10, 10) * sc, y: nd.y - rand(10, 28) * sc,
          vx: rand(-320, 320) * (big ? 1.3 : 1), vy: -rand(40, 300),
          life: rand(0.12, 0.3), max: 0.3, size: rand(2, 3.6), gravity: 300,
          color: i % 2 ? '255,246,200' : rgb,
        });
      }
    }

    // 곡괭이로 한 번 내리친다. 처리했으면 true (E 키를 다른 곳에 쓰지 않는다)
    swing() {
      const nd = this.nearest();
      if (!nd) return false;
      const h = this.host;
      const tier = h.pickTier();
      if (tier <= 0) {
        h.say('곡괭이를 장착하지 않았어요! 인벤토리(I)에서 장착하거나 대장간에서 사세요', 'rgba(255,170,170,A)');
        h.sound('deny');
        return true;
      }
      const p = h.player;
      this.swingDir = nd.x >= p.x + p.w / 2 ? 1 : -1;
      p.facing = this.swingDir;
      this.swingT = SWING_TIME;
      if (tier < nd.ore.tier) { // 너무 단단해서 튕겨 나온다
        h.say(`${nd.ore.name} 광석은 ${nd.ore.tier}단계 곡괭이가 필요해요 (지금 ${tier}단계)`, 'rgba(255,170,170,A)');
        h.sound('deny');
        nd.shake = 0.5;
        h.fx.shake(1.5, 0.06);
        h.fx.sparkle(nd.x + rand(-10, 10), nd.y - 20);
        return true;
      }
      const power = POWER[tier];
      nd.hp -= power;
      nd.shake = 1;
      nd.flash = 0.1;
      nd.squash = 1;
      this.chips(nd, power, false);
      h.fx.landDust(nd.x, nd.y, 0.35);
      h.fx.shake(2 + power * 0.7, 0.09);
      h.hitStop(0.035 + power * 0.01);
      h.sound(nd.ore.tier >= 3 ? 'pickhit_hi' : 'pickhit');
      h.popup(nd.x + rand(-12, 12), nd.y - 40 * sizeOf(nd.ore), `-${Math.max(1, Math.round(power))}`, 'rgba(255,240,170,A)', 0.6);
      if (nd.hp <= 0) this.breakNode(nd);
      return true;
    }

    breakNode(nd) {
      const h = this.host;
      const o = nd.ore;
      let n = 1;
      if (Math.random() < 0.4) n += 1;
      if (o.tier >= 3 && Math.random() < 0.2) n += 1;
      // 큰 폭발: 파편, 번쩍임, 흔들림, 잠깐 멈춤
      this.chips(nd, 5, true);
      h.fx.shake(6 + o.tier * 1.5, 0.28);
      h.fx.flash = 0.12 + 0.03 * o.tier;
      h.fx.flashColor = hexRGB(o.look[0]);
      h.fx.treasure(nd.x, nd.y - 14);
      h.fx.landDust(nd.x, nd.y, 1);
      h.hitStop(0.1 + 0.02 * o.tier);
      h.sound(o.tier >= 3 ? 'orebreak_rare' : 'orebreak');
      // 광석이 튀어나와 땅에 떨어진다
      for (let i = 0; i < n; i++) {
        this.drops.push({
          id: o.id, ore: o, x: nd.x + rand(-6, 6), y: nd.y - 22 * sizeOf(o),
          vx: rand(-80, 80), vy: -rand(300, 460), landed: false, bounces: 0, t: Math.random() * 6, age: 0,
        });
      }
      this.list.splice(this.list.indexOf(nd), 1);
    }

    // 떨어지는 광석의 움직임: 중력, 땅에 닿으면 몇 번 통통 튀다 멈춘다
    updateDrops(dt) {
      const tr = this.terrain;
      for (const d of this.drops) {
        d.t += dt;
        d.age += dt;
        if (d.landed) continue;
        d.vy += 1500 * dt;
        d.x += d.vx * dt;
        const col = Math.floor(d.x / T);
        if (tr && tr.isSolid(col, Math.floor((d.y - 4) / T))) { d.x -= d.vx * dt; d.vx *= -0.3; } // 벽에 부딪힘
        d.y += d.vy * dt;
        const row = Math.floor((d.y + 1) / T);
        if (tr && d.vy > 0 && tr.isSolid(Math.floor(d.x / T), row)) {
          d.y = row * T;
          if (Math.abs(d.vy) > 160 && d.bounces < 3) {
            d.vy *= -0.38;
            d.vx *= 0.6;
            d.bounces += 1;
            this.host.sound('oredrop');
            this.host.fx.landDust(d.x, d.y, 0.2);
          } else { d.landed = true; d.vy = 0; d.vx = 0; }
        }
        if (d.y > ((tr && tr.rows) || 40) * T + 200) d.landed = true; // 혹시 구멍으로 빠져도 사라지지 않게
      }
    }

    // E를 누르고 있으면 일정 간격으로 계속 내리친다. held = E가 눌려 있는가
    update(dt, held) {
      for (const nd of this.list) { nd.shake = Math.max(0, nd.shake - dt * 5); nd.flash = Math.max(0, nd.flash - dt); nd.squash = Math.max(0, nd.squash - dt * 7); nd.t += dt; }
      this.swingT = Math.max(0, this.swingT - dt);
      this.updateDrops(dt);
      if (!held) this.needRelease = false;
      if (held && !this.needRelease && this.nearest()) {
        this.holdT += dt;
        if (this.holdT >= SWING_GAP) { this.holdT = 0; this.swing(); }
      } else this.holdT = -0.12; // 눌렀던 첫 내리침과 겹치지 않게 약간 늦춘다
    }

    // E를 처음 누른 프레임: 떨어진 광석이 가까이 있으면 줍고, 아니면 곡괭이질
    interact() {
      const near = this.dropsNear();
      if (near.length) {
        const h = this.host;
        const got = {};
        for (const d of near) {
          this.drops.splice(this.drops.indexOf(d), 1);
          h.giveOre(d.id, 1);
          got[d.id] = (got[d.id] || 0) + 1;
          h.fx.sparkle(d.x, d.y - 10);
        }
        let k = 0;
        for (const id of Object.keys(got)) {
          const o = F.ORES.find((q) => q.id === id);
          h.popup(h.player.x + h.player.w / 2, h.player.y - 20 - k * 22, `+${got[id]} ${o.name} 광석`, 'rgba(255,235,150,A)', 1.6);
          k += 1;
        }
        h.sound('pickup');
        this.needRelease = true;
        this.holdT = -0.5;
        return true;
      }
      this.holdT = -0.12;
      return this.swing();
    }

    // ---- 그리기 (월드 좌표) ----
    draw(ctx, time, view) {
      if (view) this.view = view;
      const v = this.view;
      for (const nd of this.list) {
        if (nd.x < v.x - 140 || nd.x > v.x + v.w + 140) continue;
        this.drawNode(ctx, nd, time);
      }
      for (const d of this.drops) {
        if (d.x < v.x - 80 || d.x > v.x + v.w + 80) continue;
        this.drawDrop(ctx, d, time);
      }
      if (G.TextLayer) { // 안내
        const dn = this.dropsNear();
        const near = this.nearest();
        if (dn.length) {
          const d = dn[0];
          G.TextLayer.add(`E: ${d.ore.name} 광석 줍기${dn.length > 1 ? ` 외 ${dn.length - 1}개` : ''}`, d.x, d.y - 46, 'bold 13px sans-serif', '#ffe9a0');
        } else if (near) {
          const ok = this.host.pickTier() >= near.ore.tier;
          const sz = sizeOf(near.ore);
          G.TextLayer.add(`E 길게: ${near.ore.name} 광석 (곡괭이 ${near.ore.tier}단계)`, near.x, near.y - 52 * sz - 14, 'bold 13px sans-serif', ok ? '#ffffff' : '#ff9a9a');
        }
      }
    }

    // 플레이어 앞에 그려지는 곡괭이 휘두르기
    drawFront(ctx, time) {
      if (this.swingT <= 0) return;
      const h = this.host;
      const p = h.player;
      const look = h.pickLook() || ['#c9d2dc', '#6c7686'];
      const k = 1 - this.swingT / SWING_TIME; // 0 -> 1
      const e = k * k * (3 - 2 * k);
      const ang = -1.1 + e * 3.0; // 뒤로 젖혔다가 앞으로 내리친다
      const dir = this.swingDir;
      ctx.save();
      ctx.translate(p.x + p.w / 2 + dir * 6, p.y + 14);
      ctx.scale(dir, 1);
      // 휘두른 궤적
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,240,200,${0.5 * (1 - Math.abs(k - 0.7))})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 34, -Math.PI / 2 + ang - 0.9, -Math.PI / 2 + ang, false); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(ang);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(-2, -34, 4, 36);
      ctx.fillStyle = look[1];
      ctx.beginPath(); ctx.moveTo(-14, -30); ctx.quadraticCurveTo(0, -46, 14, -30); ctx.lineTo(12, -26); ctx.quadraticCurveTo(0, -38, -12, -26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = look[0];
      ctx.beginPath(); ctx.moveTo(-12, -30); ctx.quadraticCurveTo(0, -43, 12, -30); ctx.lineTo(10, -28); ctx.quadraticCurveTo(0, -38, -10, -28); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    drawGlow(ctx, x, y, r, rgb, a) {
      const g = ctx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    drawNode(ctx, nd, time) {
      const o = nd.ore;
      const sc = sizeOf(o);
      const sx = nd.shake > 0 ? Math.sin(time * 70) * 3 * nd.shake : 0;
      const x = nd.x + sx;
      const y = nd.y;
      const rgb = hexRGB(o.look[0]);
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + nd.t);
      ctx.save();
      // --- 빛: 희귀할수록 더 넓고 환하다 ---
      ctx.globalCompositeOperation = 'lighter';
      const R = (34 + o.tier * 20) * sc;
      this.drawGlow(ctx, x, y - 18 * sc, R, rgb, 0.1 + 0.06 * o.tier + 0.04 * pulse * o.tier);
      if (o.tier >= 2) this.drawGlow(ctx, x, y - 20 * sc, R * 0.5, '255,255,255', 0.02 + 0.015 * o.tier * pulse);
      // 바닥을 비추는 빛 웅덩이
      ctx.fillStyle = `rgba(${rgb},${0.08 + 0.05 * o.tier})`;
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.8, 7 + o.tier * 2, 0, 0, Math.PI * 2); ctx.fill();
      if (o.tier >= 3) { // 천천히 도는 빛줄기
        const rays = o.tier === 3 ? 5 : 8;
        for (let i = 0; i < rays; i++) {
          const a = time * 0.35 + (i / rays) * Math.PI * 2;
          const len = R * (0.8 + 0.12 * Math.sin(time * 2 + i));
          ctx.fillStyle = `rgba(${rgb},${0.025 + 0.012 * o.tier})`;
          ctx.beginPath();
          ctx.moveTo(x, y - 20 * sc);
          ctx.lineTo(x + Math.cos(a - 0.07) * len, y - 20 * sc + Math.sin(a - 0.07) * len);
          ctx.lineTo(x + Math.cos(a + 0.07) * len, y - 20 * sc + Math.sin(a + 0.07) * len);
          ctx.closePath(); ctx.fill();
        }
      }
      if (o.tier >= 4) { // 별빛이 맴돌고, 빛 기둥이 솟는다
        for (let i = 0; i < 6; i++) {
          const a = time * 1.2 + i * 1.047;
          const rr = 34 * sc + 6 * Math.sin(time * 3 + i);
          const mx = x + Math.cos(a) * rr;
          const my = y - 24 * sc + Math.sin(a) * rr * 0.55;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
          ctx.fillRect(mx - 0.5, my - 4, 1, 8); ctx.fillRect(mx - 4, my - 0.5, 8, 1);
        }
        const g = ctx.createLinearGradient(0, y - 170, 0, y);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},${0.12 + 0.06 * pulse})`);
        ctx.fillStyle = g; ctx.fillRect(x - 14 * sc, y - 170, 28 * sc, 170);
      }
      ctx.restore();

      // --- 바위 덩어리 (크기 배율 + 맞았을 때 찌그러짐) ---
      ctx.save();
      const sq = nd.squash;
      ctx.translate(x, y);
      ctx.scale(sc * (1 + 0.1 * sq), sc * (1 - 0.14 * sq));
      ctx.fillStyle = nd.flash > 0 ? '#c9c4d8' : '#4a4656';
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-14, -12); ctx.lineTo(-4, -20); ctx.lineTo(9, -17); ctx.lineTo(18, -6); ctx.lineTo(17, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = nd.flash > 0 ? '#e6e2f2' : '#5e5a6e';
      ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-4, -20); ctx.lineTo(0, -8); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-18, -3, 35, 3);
      // 박힌 결정 (단계가 높을수록 크고 많다)
      const n = 2 + o.tier;
      for (let i = 0; i < n; i++) {
        const cx = -10 + (i * 20) / Math.max(1, n - 1);
        const hh = 8 + ((i * 7 + o.tier * 3) % 5) + o.tier * 2;
        const cy = -8 - (i % 2) * 5;
        ctx.fillStyle = nd.flash > 0 ? '#ffffff' : o.look[1];
        ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx, cy - hh); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = o.look[0];
        ctx.beginPath(); ctx.moveTo(cx - 2.5, cy + 4); ctx.lineTo(cx - 0.5, cy - hh + 3); ctx.lineTo(cx + 1, cy + 4); ctx.closePath(); ctx.fill();
      }
      if (Math.sin(time * 5 + nd.t) > 0.8 - 0.05 * o.tier) { ctx.fillStyle = '#fff'; ctx.fillRect(4, -26, 2, 2); ctx.fillRect(-12, -18, 2, 2); ctx.fillRect(-2, -12, 2, 2); } // 반짝
      ctx.restore();

      if (nd.hp < nd.max) { // 캐는 진행 막대
        const k = clamp(nd.hp / nd.max, 0, 1);
        const bw = 38 * Math.max(1, sc * 0.8);
        const by = y - 46 * sc;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 8);
        ctx.fillStyle = k > 0.35 ? '#ffd54a' : '#ff8a4a'; ctx.fillRect(x - bw / 2, by, bw * k, 6);
      }
    }

    // 떨어진 광석: 빛나는 결정 하나 (희귀할수록 더 환하고 빛 기둥이 선다)
    drawDrop(ctx, d, time) {
      const o = d.ore;
      const rgb = hexRGB(o.look[0]);
      const bob = d.landed ? Math.sin(time * 3 + d.t) * 2 : 0;
      const x = d.x;
      const y = d.y - 9 - bob;
      const s = 0.9 + 0.2 * o.tier;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow(ctx, x, y, (22 + o.tier * 10), rgb, 0.3 + 0.1 * o.tier);
      if (o.tier >= 3 && d.landed) {
        const g = ctx.createLinearGradient(0, d.y - 90, 0, d.y);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},${0.28 + 0.1 * Math.sin(time * 4 + d.t)})`);
        ctx.fillStyle = g; ctx.fillRect(x - 7, d.y - 90, 14, 90);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      if (!d.landed) ctx.rotate(d.age * 9);
      ctx.scale(s, s);
      ctx.fillStyle = o.look[1];
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, -2); ctx.lineTo(4, 8); ctx.lineTo(-4, 8); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = o.look[0];
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-7, -2); ctx.lineTo(-1, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-3, -5, 2, 3);
      ctx.restore();
    }
  }

  G.OreNodes = OreNodes;
})(window.Game);
