// 광물 동굴: 바닥과 발판 위에 광석 덩어리(노드)가 놓여 있고, 곡괭이로 E를 눌러(길게 누르면 계속) 캔다.
//  - 곡괭이 단계(1~4)가 광석 단계보다 낮으면 캘 수 없다. 단계가 높을수록 한 번에 더 깊이 판다
//  - 동굴 안쪽(오른쪽)으로 갈수록, 탐험 횟수가 늘수록 높은 단계(희귀한) 광석이 나온다
//  - 검용 광석과 총용 광석이 섞여 있다. 캔 광석은 대장간에서 제련해 무기에 붙인다 (forge.js)
// 이 파일은 규칙(인벤토리)을 직접 만지지 않고 main이 넘겨 주는 host 로만 요청한다.
//  host = { player, fx, sound(name), say(text,color), popup(x,y,text,color,t), giveOre(id,n), pickTier() }
(function (G) {
  const C = G.Config;
  const T = C.TILE;
  const F = G.Forge;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const SWING_GAP = 0.3;                       // 길게 누를 때 곡괭이를 휘두르는 간격(초)
  const POWER = [0, 1, 2, 3.5, 5];             // 곡괭이 단계별 한 번에 파는 양
  const hardness = (tier) => 3 + 3 * tier;     // 광석 단계별 단단함 (1단계 6, 4단계 15)

  class OreNodes {
    constructor(host) {
      this.host = host;
      this.list = [];
      this.holdT = 0;
      this.view = { x: 0, y: 0, w: 960, h: 576 };
    }

    // 동굴을 불러올 때마다 노드를 새로 깐다 (enabled=false면 비운다)
    setup(terrain, run, enabled) {
      this.list = [];
      this.holdT = 0;
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
        this.list.push({ x: s.col * T + T / 2, y: (s.row + 1) * T, ore, hp: hardness(ore.tier), max: hardness(ore.tier), shake: 0, flash: 0, t: Math.random() * 6 });
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

    // 가장 가까운 노드 (플레이어 발 기준 1.6칸 이내)
    nearest() {
      const p = this.host.player;
      const px = p.x + p.w / 2;
      const feet = p.y + p.h;
      let best = null;
      let bd = 1e9;
      for (const nd of this.list) {
        const dx = Math.abs(px - nd.x);
        const dy = Math.abs(feet - nd.y);
        if (dx < T * 1.6 && dy < T * 2 && dx < bd) { best = nd; bd = dx; }
      }
      return best;
    }

    // 곡괭이로 한 번 내리친다. 처리했으면 true (E 키를 다른 곳에 쓰지 않는다)
    swing() {
      const nd = this.nearest();
      if (!nd) return false;
      const h = this.host;
      const tier = h.pickTier();
      if (tier <= 0) {
        h.say('곡괭이가 없어요! 대장간에서 살 수 있어요', 'rgba(255,170,170,A)');
        h.sound('deny');
        return true;
      }
      if (tier < nd.ore.tier) {
        h.say(`${nd.ore.name} 광석은 ${nd.ore.tier}단계 곡괭이가 필요해요 (지금 ${tier}단계)`, 'rgba(255,170,170,A)');
        h.sound('deny');
        return true;
      }
      nd.hp -= POWER[tier];
      nd.shake = 1;
      nd.flash = 0.12;
      h.sound('clack');
      h.fx.sparkle(nd.x + rand(-10, 10), nd.y - 16);
      h.fx.landDust(nd.x, nd.y, 0.2);
      if (nd.hp <= 0) this.breakNode(nd);
      return true;
    }

    breakNode(nd) {
      const h = this.host;
      const o = nd.ore;
      let n = 1;
      if (Math.random() < 0.4) n += 1;
      if (o.tier >= 3 && Math.random() < 0.2) n += 1;
      h.giveOre(o.id, n);
      h.sound('pickup');
      h.fx.treasure(nd.x, nd.y - 14);
      h.popup(nd.x, nd.y - 36, `+${n} ${o.name} 광석`, 'rgba(255,235,150,A)', 1.8);
      this.list.splice(this.list.indexOf(nd), 1);
    }

    // E를 누르고 있으면 일정 간격으로 계속 내리친다. held = E가 눌려 있는가
    update(dt, held) {
      for (const nd of this.list) { nd.shake = Math.max(0, nd.shake - dt * 5); nd.flash = Math.max(0, nd.flash - dt); nd.t += dt; }
      if (held && this.nearest()) {
        this.holdT += dt;
        if (this.holdT >= SWING_GAP) { this.holdT = 0; this.swing(); }
      } else this.holdT = -0.12; // 눌렀던 첫 내리침과 겹치지 않게 약간 늦춘다
    }

    // E를 처음 누른 프레임
    interact() {
      this.holdT = -0.12;
      return this.swing();
    }

    // ---- 그리기 (월드 좌표) ----
    draw(ctx, time, view) {
      if (view) this.view = view;
      const v = this.view;
      for (const nd of this.list) {
        if (nd.x < v.x - 80 || nd.x > v.x + v.w + 80) continue;
        this.drawNode(ctx, nd, time);
      }
      const near = this.nearest();
      if (near && G.TextLayer) { // 안내
        const tier = this.host.pickTier();
        const ok = tier >= near.ore.tier;
        G.TextLayer.add(`E 길게: ${near.ore.name} 광석 (곡괭이 ${near.ore.tier}단계)`, near.x, near.y - 64, 'bold 13px sans-serif', ok ? '#ffffff' : '#ff9a9a');
      }
    }

    drawNode(ctx, nd, time) {
      const o = nd.ore;
      const sx = nd.shake > 0 ? Math.sin(time * 70) * 2.5 * nd.shake : 0;
      const x = nd.x + sx;
      const y = nd.y;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + nd.t);
      const g = ctx.createRadialGradient(x, y - 14, 1, x, y - 14, 20 + o.tier * 5);
      g.addColorStop(0, `rgba(${hexRGB(o.look[0])},${0.22 + 0.16 * pulse})`);
      g.addColorStop(1, `rgba(${hexRGB(o.look[0])},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 36, y - 52, 72, 64);
      // 바위 덩어리
      ctx.fillStyle = nd.flash > 0 ? '#8a849a' : '#4a4656';
      ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 14, y - 12); ctx.lineTo(x - 4, y - 20); ctx.lineTo(x + 9, y - 17); ctx.lineTo(x + 18, y - 6); ctx.lineTo(x + 17, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5e5a6e';
      ctx.beginPath(); ctx.moveTo(x - 14, y - 12); ctx.lineTo(x - 4, y - 20); ctx.lineTo(x, y - 8); ctx.lineTo(x - 10, y - 2); ctx.closePath(); ctx.fill();
      // 박힌 결정 (단계가 높을수록 크고 많다)
      const n = 2 + o.tier;
      for (let i = 0; i < n; i++) {
        const cx = x - 10 + (i * 20) / Math.max(1, n - 1);
        const hh = 8 + ((i * 7 + o.tier * 3) % 5) + o.tier * 2;
        const cy = y - 8 - (i % 2) * 5;
        ctx.fillStyle = o.look[1];
        ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx, cy - hh); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = o.look[0];
        ctx.beginPath(); ctx.moveTo(cx - 2.5, cy + 4); ctx.lineTo(cx - 0.5, cy - hh + 3); ctx.lineTo(cx + 1, cy + 4); ctx.closePath(); ctx.fill();
      }
      if (Math.sin(time * 5 + nd.t) > 0.85) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y - 26, 2, 2); ctx.fillRect(x - 12, y - 18, 2, 2); } // 반짝
      if (nd.hp < nd.max) { // 캐는 진행 막대
        const k = clamp(nd.hp / nd.max, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 17, y - 36, 34, 6);
        ctx.fillStyle = '#ffd54a'; ctx.fillRect(x - 16, y - 35, 32 * k, 4);
      }
    }
  }

  const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');

  G.OreNodes = OreNodes;
})(window.Game);
