// 의문의 사람: 군단 요새를 깬 뒤 왕국의 요새 문 앞에 망토를 둘러쓰고 서 있다. 말을 걸면 아무 말 없이 갑자기 방향키 게임이 시작되고
// (끝이 없고 점점 빨라져서 보통 사람은 할 수 없다), 실패하면 그가 칼을 뽑아 베고, 쓰러진 용사를 차원문으로 집어넣어 항구 마을로 보낸다.
// 컷신(cutscene)과 같은 모양: update / inputFor / drawWorld / drawOverlay / done
(function (G) {
  const T = G.Config.TILE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const LANES = [{ keys: ['ArrowLeft', 'KeyA'], dir: 'left' }, { keys: ['ArrowDown', 'KeyS'], dir: 'down' }, { keys: ['ArrowUp', 'KeyW'], dir: 'up' }, { keys: ['ArrowRight', 'KeyD'], dir: 'right' }];
  const LANE_COLOR = ['#ff6a8a', '#6adfff', '#9aff7a', '#ffd54a'];
  const MAX_MISS = 3;

  // 의문의 사람: 망토와 두건으로 온몸을 가려서 얼굴이 보이지 않는다. (x, y) = 발 바닥 중앙
  function drawCloak(ctx, x, y, facing, t, o = {}) {
    const bob = Math.sin(t * 1.6) * 1.2;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(facing >= 0 ? 1 : -1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 망토 (바닥까지 끌린다)
    ctx.fillStyle = '#17121f';
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-11, -46 + bob); ctx.lineTo(11, -46 + bob); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#241c33';
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-6, -44 + bob); ctx.lineTo(4, -44 + bob); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(-14, -28 + bob, 28, 2);
    // 두건: 안쪽은 새까맣다
    ctx.fillStyle = '#17121f';
    ctx.beginPath(); ctx.arc(0, -52 + bob, 13, Math.PI, 0); ctx.lineTo(10, -42 + bob); ctx.lineTo(-10, -42 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(3, -50 + bob, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (o.eyes) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(2, -52 + bob, 3, 2); ctx.fillRect(8, -52 + bob, 3, 2); }
    // 칼: 뽑았을 때
    if (o.sword) {
      ctx.save(); ctx.translate(14, -26 + bob); ctx.rotate(o.swordAng || -0.3);
      ctx.fillStyle = '#2a2230'; ctx.fillRect(-3, -4, 6, 12); ctx.fillStyle = '#d4a017'; ctx.fillRect(-9, 6, 18, 4);
      ctx.fillStyle = '#e8f1ff'; ctx.fillRect(-4, 10, 8, 64); ctx.fillStyle = '#9fb0c8'; ctx.fillRect(0, 10, 2, 64);
      ctx.restore();
    }
    ctx.restore();
  }

  function arrow(ctx, x, y, dir, s, color, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir]); ctx.globalAlpha = alpha;
    ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.2, -s); ctx.lineTo(-s * 0.2, -s * 0.45); ctx.lineTo(-s, -s * 0.45); ctx.lineTo(-s, s * 0.45); ctx.lineTo(-s * 0.2, s * 0.45); ctx.lineTo(-s * 0.2, s); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  class StrangerScene {
    // spot = {x, y}: 의문의 사람이 서 있는 곳(발 바닥). ev = {shake(m,d), flash(), sound(n)}
    constructor(terrain, player, spot, ev) {
      this.terrain = terrain; this.player = player; this.spot = spot; this.ev = ev;
      this.phase = 'rhythm';
      this.t = 0; // 이 장면 안에서 흐른 시간
      this.pt = 0; // 지금 단계에서 흐른 시간
      this.done = false;
      this.onDone = null;
      this.rh = { t: 0, notes: [], spawnT: 0, misses: 0, hits: 0, combo: 0, best: 0, seed: 7, flash: [0, 0, 0, 0], shake: 0 };
      player.facing = spot.x > player.x ? 1 : -1;
      this.away = -player.facing; // 쓰러지는 방향 (칼에서 멀어지는 쪽)
      this.hurtBlink = 0;
    }

    inputFor() { return { moveX: 0, jumpHeld: false, jumpPressed: false, parryHeld: false, parryPressed: false }; }

    _rand() { const r = this.rh; r.seed = (r.seed * 1664525 + 1013904223) >>> 0; return r.seed / 4294967296; }

    _next(phase) { this.phase = phase; this.pt = 0; }

    update(dt, input, effects) {
      this.t += dt; this.pt += dt;
      const p = this.player;
      p.invuln = 0; p.shadowTime = 0; // 쓰러지는 동안 용사가 투명해지거나 깜빡이지 않는다
      if (this.phase === 'rhythm') { this._updateRhythm(dt, input); return; }
      if (this.phase === 'slash') { // 칼을 뽑아 벤다
        if (!this._cut && this.pt >= 0.45) {
          this._cut = true; this.ev.shake(14, 0.5); this.ev.flash(); this.ev.sound('hurt');
          p.vx = this.away * 260; p.vy = -180;
          effects.playerHit(p.x + p.w / 2, p.y + p.h / 2);
        }
        if (this._cut) p.lying = easeOut(clamp((this.pt - 0.45) / 0.5, 0, 1));
        if (this.pt >= 1.2) this._next('lie');
      } else if (this.phase === 'lie') { // 쓰러진 채로 가만히
        p.lying = 1; p.vx = 0;
        if (this.pt >= 1.5) { this._next('portal'); this.ev.sound('spawn'); }
      } else if (this.phase === 'portal') { // 차원문이 열린다
        p.lying = 1; p.vx = 0;
        if (Math.floor(this.pt * 6) !== Math.floor((this.pt - dt) * 6)) this.ev.shake(3, 0.1);
        if (this.pt >= 1.8) { this._next('suck'); this.ev.sound('charge'); }
      } else if (this.phase === 'suck') { // 용사가 차원문으로 빨려 들어간다
        p.lying = 1; p.vx = 0; p.suck = clamp(this.pt / 1.3, 0, 1);
        if (this.pt >= 1.3) { this._next('fade'); this.ev.flash(); }
      } else if (this.phase === 'fade') {
        p.suck = 1;
        if (this.pt >= 0.9) { this.done = true; if (this.onDone) this.onDone(); }
      }
    }

    // ---- 방향키 게임: 끝이 없고 점점 빨라진다 ----
    _updateRhythm(dt, input) {
      const r = this.rh;
      r.t += dt;
      for (let i = 0; i < 4; i++) r.flash[i] = Math.max(0, r.flash[i] - dt);
      r.shake = Math.max(0, r.shake - dt);
      if (r.t < 1.4) return; // 아무 설명도 없이 잠깐 정적
      const el = r.t - 1.4;
      const speed = 820 + 22 * el; // px/s (점점 빨라진다)
      const gap = Math.max(0.07, 0.19 - 0.0018 * el);
      r.spawnT -= dt;
      while (r.spawnT <= 0) { r.notes.push({ lane: Math.floor(this._rand() * 4), y: -40, hit: false }); r.spawnT += gap; }
      const HIT_Y = 440;
      for (const n of r.notes) n.y += speed * dt;
      for (let i = 0; i < 4; i++) {
        if (!LANES[i].keys.some((k) => input.wasPressed(k))) continue;
        r.flash[i] = 0.12;
        let best = null;
        for (const n of r.notes) if (!n.hit && n.lane === i && Math.abs(n.y - HIT_Y) < 62 && (!best || Math.abs(n.y - HIT_Y) < Math.abs(best.y - HIT_Y))) best = n;
        if (best) { best.hit = true; r.hits++; r.combo++; r.best = Math.max(r.best, r.combo); }
        else this._miss();
      }
      for (const n of r.notes) if (!n.hit && !n.miss && n.y > HIT_Y + 70) { n.miss = true; this._miss(); }
      r.notes = r.notes.filter((n) => n.y < 640 && !n.hit);
      if (r.misses >= MAX_MISS) { this._next('slash'); this.rh.notes = []; }
    }
    _miss() { const r = this.rh; r.misses++; r.combo = 0; r.shake = 0.25; this.ev.sound('deny'); }

    // ---- 그리기 ----
    drawWorld(ctx) {
      const s = this.spot, t = this.t;
      const inSlash = this.phase === 'slash' && this._cut;
      const drawn = this.phase !== 'rhythm';
      const ang = this.phase === 'slash' ? (this.pt < 0.45 ? -2.6 : -0.9) : -0.4;
      drawCloak(ctx, s.x, s.y, this.away, t, { eyes: this.rh.t > 1.4, sword: drawn, swordAng: ang });
      if (inSlash && this.pt < 0.8) { // 베는 순간의 하얀 호
        const p = this.player;
        const a = clamp((this.pt - 0.45) / 0.35, 0, 1);
        ctx.save(); ctx.globalAlpha = 1 - a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(p.x + p.w / 2 - this.away * 20, p.y + p.h / 2, 46, -1.2 + (this.away > 0 ? 0 : Math.PI), 1.2 + (this.away > 0 ? 0 : Math.PI)); ctx.stroke(); ctx.restore();
      }
      if (this.phase === 'portal' || this.phase === 'suck' || this.phase === 'fade') { // 차원문: 소용돌이치는 보랏빛 문
        const p = this.player, cx = p.x + p.w / 2, cy = p.y + p.h - 6;
        const k = this.phase === 'portal' ? easeOut(clamp(this.pt / 1.5, 0, 1)) : 1;
        ctx.save(); ctx.translate(cx, cy);
        for (let i = 0; i < 4; i++) {
          const rx = (86 - i * 14) * k, ry = (30 - i * 5) * k;
          ctx.strokeStyle = `rgba(${150 + i * 25},${90 + i * 20},255,${0.85 - i * 0.15})`; ctx.lineWidth = 5 - i;
          ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, t * (2 + i) % (Math.PI * 2), t * (2 + i) % (Math.PI * 2) + Math.PI * 1.6); ctx.stroke();
        }
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 80 * k);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(120,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 80 * k, 28 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    drawOverlay(ctx, w, h) {
      if (this.phase === 'rhythm') { this._drawRhythm(ctx, w, h); return; }
      ctx.save();
      if (this.phase === 'slash' && this._cut && this.pt < 0.9) { ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - (this.pt - 0.45) / 0.45)})`; ctx.fillRect(0, 0, w, h); }
      if (this.phase === 'lie' || this.phase === 'portal') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, w, h); }
      if (this.phase === 'suck') { ctx.fillStyle = `rgba(30,10,60,${0.35 + 0.4 * this.player.suck})`; ctx.fillRect(0, 0, w, h); }
      if (this.phase === 'fade') { ctx.fillStyle = `rgba(255,255,255,${clamp(this.pt / 0.8, 0, 1)})`; ctx.fillRect(0, 0, w, h); }
      ctx.restore();
    }

    _drawRhythm(ctx, w, h) {
      const r = this.rh;
      ctx.save();
      ctx.fillStyle = 'rgba(6,4,12,0.94)'; ctx.fillRect(0, 0, w, h);
      const sh = r.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
      ctx.translate(sh, 0);
      const cx = w / 2, HIT_Y = 440;
      for (let i = 0; i < 4; i++) {
        const x = cx + (i - 1.5) * 110;
        ctx.fillStyle = `rgba(255,255,255,${0.04 + (r.flash[i] > 0 ? 0.18 : 0)})`; ctx.fillRect(x - 48, 0, 96, h);
        arrow(ctx, x, HIT_Y, LANES[i].dir, 34, 'rgba(255,255,255,0.12)', 1);
        if (r.flash[i] > 0) arrow(ctx, x, HIT_Y, LANES[i].dir, 40, LANE_COLOR[i], 0.7);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 240, HIT_Y + 48); ctx.lineTo(cx + 240, HIT_Y + 48); ctx.stroke();
      for (const n of r.notes) arrow(ctx, cx + (n.lane - 1.5) * 110, n.y, LANES[n.lane].dir, 30, LANE_COLOR[n.lane], 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (r.t < 1.4) { ctx.font = 'bold 64px sans-serif'; ctx.fillStyle = `rgba(255,60,60,${0.4 + 0.6 * Math.abs(Math.sin(r.t * 7))})`; ctx.fillText('…', cx, h / 2); }
      else {
        ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(`${r.combo} 연속`, cx, 40);
        ctx.font = '15px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(`맞춘 수 ${r.hits}  ·  최고 ${r.best}  ·  끝: ∞`, cx, 66);
        for (let i = 0; i < MAX_MISS; i++) { ctx.font = 'bold 30px sans-serif'; ctx.fillStyle = i < MAX_MISS - r.misses ? '#ff4a6a' : 'rgba(255,255,255,0.15)'; ctx.fillText('♥', cx - 40 + i * 40, 104); }
      }
      ctx.restore();
    }
  }

  // 의문의 사람이 서 있는 곳: 왕궁 성문 바로 앞 (양옆의 호위무사들이 문을 막고 서 있다)
  function spotOf(terrain) {
    const c = terrain.castles[0];
    if (!c) return null;
    return { x: c.col * T + T / 2, y: (c.row + 1) * T, facing: -1 };
  }

  G.Stranger = { Scene: StrangerScene, drawCloak, spotOf };
})(window.Game);
