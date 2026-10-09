// 오프닝 컷신: 동굴에서 유리병을 발견 -> 줍기 -> 병 속 두루마리 -> 보물 지도 -> 보물을 찾으러 출발.
// 게임 규칙에는 관여하지 않는다. main이 컷신 동안 플레이어를 inputFor()의 가상 입력으로 움직이고,
// Renderer가 drawWorld()/drawOverlay()로 병·자막·지도 등을 그린다.
(function (G) {
  const C = G.Config;
  const T = C.TILE;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // 장면 순서. dur는 최대 시간(walk는 병에 도착하면 먼저 끝남)
  const PHASES = [
    { id: 'find', dur: 2.2, caption: '몬스터를 잡으러 깊은 동굴에 들어간 용사는 바닥에서 반짝이는 무언가를 발견했다.' },
    { id: 'walk', dur: 5, caption: '' },
    { id: 'pickup', dur: 1.8, caption: '유리병이다! 안에 무언가 들어 있어…' },
    { id: 'bottle', dur: 3.6, caption: '병 속에는 낡은 두루마리가 들어 있었다.' },
    { id: 'map', dur: 5.4, caption: '보물 지도다! 동굴 맨 끝에 보물이 숨겨져 있다고 한다.' },
    { id: 'ready', dur: 2.4, caption: '좋아, 보물을 찾으러 가자!' },
  ];

  // 유리병 그리기. (x, y)는 병 바닥 중앙, s는 배율
  function drawBottle(ctx, x, y, s, opts = {}) {
    const { cork = true, scroll = 1 } = opts;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // 병 속 두루마리
    if (scroll > 0) {
      ctx.save();
      ctx.translate(0, -12);
      ctx.rotate(-0.12);
      ctx.fillStyle = '#e9d8a6';
      ctx.fillRect(-4, -9, 8, 18);
      ctx.fillStyle = '#c9b27a';
      ctx.fillRect(-4, -9, 8, 3);
      ctx.fillRect(-4, 6, 8, 3);
      ctx.fillStyle = '#b8322f';
      ctx.fillRect(-4, -2, 8, 2.5);
      ctx.restore();
    }
    // 유리 몸통
    ctx.beginPath();
    ctx.moveTo(-9, -3);
    ctx.quadraticCurveTo(-9, 0, -6, 0);
    ctx.lineTo(6, 0);
    ctx.quadraticCurveTo(9, 0, 9, -3);
    ctx.lineTo(9, -19);
    ctx.quadraticCurveTo(9, -23, 4, -25);
    ctx.lineTo(3.5, -33);
    ctx.lineTo(-3.5, -33);
    ctx.lineTo(-4, -25);
    ctx.quadraticCurveTo(-9, -23, -9, -19);
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,225,235,0.38)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(210,248,255,0.95)';
    ctx.stroke();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(-6.5, -19, 1.8, 13);
    ctx.fillRect(-2.2, -31, 1.2, 5);
    // 주둥이 + 코르크
    ctx.fillStyle = 'rgba(210,248,255,0.9)';
    ctx.fillRect(-4.5, -34.5, 9, 2);
    if (cork) {
      ctx.fillStyle = '#9a6b3c';
      ctx.fillRect(-3.2, -39, 6.4, 5);
      ctx.fillStyle = '#b98650';
      ctx.fillRect(-3.2, -39, 6.4, 1.6);
    }
    ctx.restore();
  }

  // 네 갈래 별빛(반짝임)
  function drawGlint(ctx, x, y, r, a) {
    ctx.fillStyle = `rgba(255,255,230,${a})`;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }

  class Cutscene {
    constructor(terrain, player) {
      this.terrain = terrain;
      this.player = player;
      this.phase = 0;
      this.pt = 0;            // 현재 장면에서 흐른 시간
      this.t = 0;             // 전체 시간
      this.done = false;
      this.fade = 1;          // 검은 화면 (처음엔 완전히 어둡다)
      this.bars = 0;          // 영화 같은 위아래 검은 띠 (0~1)
      this.a = { bottle: 0, map: 0 }; // 확대 화면들의 투명도
      this.lift = 0;          // 병이 들어 올려진 정도 (0~1)
      this.arrived = false;
      this.swung = false;
      this.corkPopped = false;
      this.sparkleT = 0;

      const sp = terrain.spawn;
      const col = (sp.col === undefined ? 1 : sp.col) + 4;
      const row = sp.row === undefined ? 15 : sp.row;
      this.bottle = { x: col * T + T / 2, y: (row + 1) * T };
      player.facing = 1;
      this.path = this._buildPath();
    }

    get phaseId() {
      return PHASES[this.phase].id;
    }

    // 컷신 동안 플레이어에게 줄 가상 입력 (병까지 걸어감)
    inputFor() {
      return {
        moveX: this.phaseId === 'walk' && !this.arrived ? 1 : 0,
        jumpHeld: false, jumpPressed: false, parryHeld: false, parryPressed: false,
      };
    }

    update(dt, input, effects) {
      if (this.done) return;
      if (input.parryPressed || input.jumpPressed) { // Enter / Space로 건너뛰기
        this.done = true;
        return;
      }
      this.t += dt;
      this.pt += dt;
      const id = this.phaseId;
      const p = this.player;

      this.fade = Math.max(0, 1 - this.t / 1.1);
      const last = this.phase === PHASES.length - 1;
      this.bars = last ? 1 - clamp01((this.pt - (PHASES[this.phase].dur - 0.7)) / 0.7) : clamp01(this.t / 0.8);
      this.a.bottle = clamp01(this.a.bottle + (id === 'bottle' ? 1 : -1) * dt * 4);
      this.a.map = clamp01(this.a.map + (id === 'map' ? 1 : -1) * dt * 4);

      // 병 위에서 반짝이는 빛 (줍기 전까지)
      if (this.phase <= 2) {
        this.sparkleT -= dt;
        if (this.sparkleT <= 0) {
          this.sparkleT = 0.22;
          const b = this._bottlePos();
          effects.sparkle(b.x, b.y - 18);
        }
      }

      if (id === 'walk') {
        if (p.x + p.w / 2 >= this.bottle.x - 22) this.arrived = true;
      } else if (id === 'pickup') {
        this.lift = easeOut(clamp01(this.pt / 1.0));
      } else if (id === 'bottle') {
        if (!this.corkPopped && this.pt >= 1.2) { // 코르크가 뽑히는 순간
          this.corkPopped = true;
          G.Audio.play('pop');
          effects.shake(2, 0.08);
        }
      } else if (id === 'ready') {
        p.facing = 1;
        if (!this.swung && this.pt >= 0.5) { // 검을 휘둘러 결의를 보인다
          this.swung = true;
          p.swing = 0;
        }
      }

      if ((id === 'walk' && this.arrived) || this.pt >= PHASES[this.phase].dur) this._next();
    }

    _next() {
      if (this.phase >= PHASES.length - 1) {
        this.done = true;
        return;
      }
      this.phase += 1;
      this.pt = 0;
      if (this.phaseId === 'pickup') G.Audio.play('pickup');
      else if (this.phaseId === 'map') G.Audio.play('scroll');
    }

    // 병의 현재 월드 위치 (땅 위 -> 용사 머리 위로 들어 올림)
    _bottlePos() {
      if (this.lift <= 0) return { x: this.bottle.x, y: this.bottle.y };
      const p = this.player;
      const tx = p.x + p.w / 2 + 6;
      const ty = p.y - 4;
      const e = this.lift;
      return {
        x: this.bottle.x + (tx - this.bottle.x) * e,
        y: this.bottle.y + (ty - this.bottle.y) * e - Math.sin(e * Math.PI) * 14,
      };
    }

    // 지도에 그릴 경로: 시작점에서 보물까지 각 열의 지표면 위를 따라가며, 구덩이는 점프 곡선으로 잇는다 (타일 좌표)
    _buildPath() {
      const tr = this.terrain;
      const startCol = tr.spawn.col === undefined ? 1 : tr.spawn.col;
      const endCol = tr.treasure ? tr.treasure.col : tr.cols - 3;
      const pts = [];
      let lastRow = tr.spawn.row === undefined ? 15 : tr.spawn.row;
      for (let c = startCol; c <= endCol; c++) {
        let surface = -1;
        for (let r = 0; r < tr.rows; r++) if (tr.grid[r][c]) { surface = r; break; }
        const y = surface < 0 ? lastRow - 2 : surface - 0.8; // 구덩이: 직전 높이에서 떠오른 호
        if (surface >= 0) lastRow = surface;
        pts.push({ x: c + 0.5, y });
      }
      const end = tr.treasure ? { x: tr.treasure.col + 0.5, y: tr.treasure.row + 0.4 } : pts[pts.length - 1];
      pts.push(end);
      return pts;
    }

    // ---- 그리기 ----

    // 월드 좌표계: 땅 위(또는 들어 올린) 병과 은은한 빛
    drawWorld(ctx) {
      if (this.phase > 2) return; // 클로즈업 이후엔 월드에 병이 없다
      const b = this._bottlePos();
      const glowA = 0.25 + 0.1 * Math.sin(this.t * 4);
      const g = ctx.createRadialGradient(b.x, b.y - 16, 0, b.x, b.y - 16, 46);
      g.addColorStop(0, `rgba(255,240,180,${glowA})`);
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x - 46, b.y - 62, 92, 92);
      drawBottle(ctx, b.x, b.y, 0.8, {});
      const tw = 0.5 + 0.5 * Math.sin(this.t * 6);
      drawGlint(ctx, b.x + 7, b.y - 28, 4 + 4 * tw, 0.5 + 0.5 * tw);
    }

    // 화면 좌표계: 확대 화면, 영화 띠, 자막, 암전
    drawOverlay(ctx, w, h) {
      const barH = 54 * this.bars;

      // 확대 화면 공통: 화면을 어둡게
      const dim = Math.max(this.a.bottle, this.a.map);
      if (dim > 0) {
        ctx.fillStyle = `rgba(4,5,12,${0.82 * dim})`;
        ctx.fillRect(0, 0, w, h);
      }
      if (this.a.bottle > 0) this._drawBottleCloseup(ctx, w, h, this.a.bottle);
      if (this.a.map > 0) this._drawMap(ctx, w, h, this.a.map);

      // 영화 띠
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);

      // 자막
      const cap = PHASES[this.phase].caption;
      if (cap && this.bars > 0.6) {
        const a = clamp01(this.pt / 0.4) * (this.phase === PHASES.length - 1 ? clamp01((PHASES[this.phase].dur - this.pt) / 0.4) : 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 21px sans-serif';
        ctx.fillStyle = `rgba(0,0,0,${0.8 * a})`;
        ctx.fillText(cap, w / 2 + 1, h - barH / 2 + 1);
        ctx.fillStyle = `rgba(255,248,225,${a})`;
        ctx.fillText(cap, w / 2, h - barH / 2);
        ctx.textAlign = 'start';
      }
      // 건너뛰기 안내
      if (this.bars > 0.6) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText('Enter / Space: 건너뛰기', w - 14, barH / 2);
        ctx.textAlign = 'start';
      }

      // 처음 암전
      if (this.fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 병 클로즈업: 후광 속의 병 -> 코르크가 뽑히고 -> 두루마리가 빠져나온다
    _drawBottleCloseup(ctx, w, h, alpha) {
      const cx = w / 2;
      const cy = h / 2 + 90;
      const t = this.pt;
      const rayA = 0.35 * alpha;
      const g = ctx.createRadialGradient(cx, cy - 70, 10, cx, cy - 70, 230);
      g.addColorStop(0, `rgba(255,235,160,${rayA})`);
      g.addColorStop(1, 'rgba(255,235,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 240, cy - 310, 480, 480);

      ctx.save();
      ctx.globalAlpha = alpha;
      const pop = clamp01((t - 1.2) / 0.5);                 // 코르크가 위로 튕겨 나감
      const scrollOut = easeInOut(clamp01((t - 1.9) / 1.2)); // 두루마리가 빠져나옴
      const wobble = t > 1.0 && t < 1.2 ? Math.sin(t * 90) * 1.5 : 0; // 뽑기 직전 떨림
      drawBottle(ctx, cx + wobble, cy, 5, { cork: pop <= 0, scroll: scrollOut > 0 ? 0 : 1 }); // 두루마리가 빠져나오기 시작하면 병 속은 비운다
      if (pop > 0 && pop < 1.5) { // 날아가는 코르크
        const k = Math.min(1.5, pop);
        const px = cx + 40 * k;
        const py = cy - 39 * 5 - 150 * Math.sin(Math.min(1, k) * Math.PI * 0.9) + 60 * Math.max(0, k - 0.9);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(k * 6);
        ctx.fillStyle = '#9a6b3c';
        ctx.fillRect(-16, -12, 32, 24);
        ctx.fillStyle = '#b98650';
        ctx.fillRect(-16, -12, 32, 8);
        ctx.restore();
      }
      if (scrollOut > 0) { // 병 밖으로 올라오는 두루마리
        ctx.save();
        ctx.translate(cx, cy - 60 - 130 * scrollOut);
        ctx.rotate(-0.12 + scrollOut * 0.12);
        ctx.fillStyle = '#e9d8a6';
        ctx.fillRect(-20, -45, 40, 90);
        ctx.fillStyle = '#c9b27a';
        ctx.fillRect(-20, -45, 40, 14);
        ctx.fillRect(-20, 31, 40, 14);
        ctx.fillStyle = '#b8322f';
        ctx.fillRect(-20, -8, 40, 12);
        ctx.restore();
      }
      ctx.restore();
    }

    // 보물 지도: 양피지 위에 실제 맵 축소판 + 경로(점선이 그려짐) + 빨간 X
    _drawMap(ctx, w, h, alpha) {
      const tr = this.terrain;
      const pw = 800;
      const ph = 300;
      const px = (w - pw) / 2;
      const py = (h - ph) / 2 - 8;
      const open = easeOut(clamp01(this.pt / 0.6));       // 두루마리가 가로로 펼쳐짐
      const curW = pw * (0.15 + 0.85 * open);
      const x0 = w / 2 - curW / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      // 양피지 (가장자리가 찢어진 모양)
      ctx.fillStyle = '#d9bf88';
      ctx.beginPath();
      ctx.moveTo(x0, py);
      for (let i = 0; i <= 40; i++) ctx.lineTo(x0 + (curW * i) / 40, py + (i % 2 ? 5 : 0) + G.Cave.rnd(i, 1, 2) * 4);
      for (let i = 0; i <= 14; i++) ctx.lineTo(x0 + curW - (i % 2 ? 6 : 0), py + (ph * i) / 14);
      for (let i = 40; i >= 0; i--) ctx.lineTo(x0 + (curW * i) / 40, py + ph - (i % 2 ? 5 : 0) - G.Cave.rnd(i, 3, 4) * 4);
      for (let i = 14; i >= 0; i--) ctx.lineTo(x0 + (i % 2 ? 6 : 0), py + (ph * i) / 14);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#8a6a3a';
      ctx.stroke();
      // 얼룩
      ctx.fillStyle = 'rgba(120,80,30,0.12)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(x0 + 60 + G.Cave.rnd(i, 5, 6) * (curW - 120), py + 40 + G.Cave.rnd(i, 6, 7) * (ph - 80), 18 + G.Cave.rnd(i, 7, 8) * 28, 0, Math.PI * 2);
        ctx.fill();
      }

      if (open > 0.85) {
        const k = (pw - 80) / tr.cols;                        // 한 타일의 지도상 크기
        const mx = px + 40;
        const my = py + 110;
        // 제목
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px serif';
        ctx.fillStyle = '#5a3d17';
        ctx.fillText('~ 보물 지도 ~', w / 2, py + 40);
        // 맵 축소판: 땅은 갈색
        for (let r = 0; r < tr.rows; r++) {
          for (let c = 0; c < tr.cols; c++) {
            if (!tr.grid[r][c]) continue;
            ctx.fillStyle = r > 0 && tr.grid[r - 1][c] ? 'rgba(110,78,40,0.55)' : 'rgba(86,58,28,0.85)';
            ctx.fillRect(mx + c * k, my + r * k, k + 0.4, k + 0.4);
          }
        }
        // 경로: 시간이 지나며 점선이 그려진다
        const prog = clamp01((this.pt - 0.9) / 3.0);
        const total = this.path.length - 1;
        const upto = prog * total;
        ctx.setLineDash([7, 6]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#b8322f';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= Math.floor(upto) && i <= total; i++) {
          const q = this.path[i];
          if (i === 0) ctx.moveTo(mx + q.x * k, my + q.y * k);
          else ctx.lineTo(mx + q.x * k, my + q.y * k);
        }
        if (upto < total) {
          const i0 = Math.floor(upto);
          const a = this.path[i0];
          const b = this.path[i0 + 1];
          const f = upto - i0;
          ctx.lineTo(mx + (a.x + (b.x - a.x) * f) * k, my + (a.y + (b.y - a.y) * f) * k);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // 출발 표시(용사)
        const s0 = this.path[0];
        ctx.fillStyle = '#2d56b8';
        ctx.beginPath();
        ctx.arc(mx + s0.x * k, my + (s0.y - 0.2) * k, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(mx + s0.x * k - 3, my + (s0.y - 0.2) * k - 3, 6, 4);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#5a3d17';
        ctx.fillText('출발', mx + s0.x * k, my + (s0.y - 0.2) * k - 17);
        // 보물 X (경로가 도착하면 맥동)
        if (prog >= 1) {
          const e = this.path[this.path.length - 1];
          const ex = mx + e.x * k;
          const ey = my + e.y * k;
          const pulse = 1 + 0.18 * Math.sin(this.pt * 7);
          ctx.strokeStyle = '#c4161c';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 11 * pulse, ey - 11 * pulse);
          ctx.lineTo(ex + 11 * pulse, ey + 11 * pulse);
          ctx.moveTo(ex + 11 * pulse, ey - 11 * pulse);
          ctx.lineTo(ex - 11 * pulse, ey + 11 * pulse);
          ctx.stroke();
          ctx.lineCap = 'butt';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillStyle = '#7a1013';
          ctx.fillText('보물!', ex, ey - 26);
        }
        ctx.textAlign = 'start';
      }
      ctx.restore();
    }
  }

  G.Cutscene = Cutscene;
  G.drawBottle = drawBottle;
})(window.Game);
