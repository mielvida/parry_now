// 렌더러: 상태를 읽어 캔버스에 그리기만 한다. 게임 상태를 바꾸지 않는다.
(function (G) {
  const { TILE } = G.Config;

  class Renderer {
    constructor(canvas, viewW, viewH) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      canvas.width = viewW;
      canvas.height = viewH;
      this.viewW = viewW;
      this.viewH = viewH;
    }

    draw(terrain, player, camera, monsters = [], effects = null, hud = null, sword = null, extras = {}) {
      const ctx = this.ctx;
      const time = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      G.Cave.drawBackground(ctx, this.viewW, this.viewH, camera, time);
      ctx.save();
      const sh = effects ? effects.shakeOffset() : { x: 0, y: 0 };
      ctx.translate(-Math.round(camera.x - sh.x), -Math.round(camera.y - sh.y));
      G.Cave.drawCeiling(ctx, camera, this.viewW);
      this._drawTerrain(ctx, terrain, camera);
      if (extras.chest) this._drawChest(ctx, extras.chest);
      for (const m of monsters) if (m.alive && this._inView(m, camera)) this._drawMonster(ctx, m); // 화면 밖은 그리지 않음 (대량 소환 대비)
      this._drawPlayer(ctx, player);
      if (extras.cutscene) extras.cutscene.drawWorld(ctx); // 땅 위/들어 올린 병
      G.Hero.drawCharge(ctx, player);
      if (sword) G.Hero.drawThrownSword(ctx, sword);
      if (effects) effects.draw(ctx);
      ctx.restore();
      G.Cave.drawVignette(ctx, this.viewW, this.viewH);
      if (effects) effects.drawOverlay(ctx, this.viewW, this.viewH);
      if (extras.cutscene) { // 컷신: 자막·확대 화면·암전. 게임 HUD는 숨긴다
        extras.cutscene.drawOverlay(ctx, this.viewW, this.viewH);
        return;
      }
      this._drawHud(ctx, hud);
    }

    _drawTerrain(ctx, terrain, camera) {
      // 화면에 보이는 타일만 그린다
      const c0 = Math.max(0, Math.floor(camera.x / TILE));
      const c1 = Math.min(terrain.cols - 1, Math.floor((camera.x + this.viewW) / TILE));
      const r0 = Math.max(0, Math.floor(camera.y / TILE));
      const r1 = Math.min(terrain.rows - 1, Math.floor((camera.y + this.viewH) / TILE));

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (terrain.grid[r][c]) G.Cave.drawTile(ctx, terrain, c, r);
        }
      }
    }

    // 보물 상자: 열리면 뚜껑이 젖혀지고 금빛이 새어 나온다 (open 0~1)
    _drawChest(ctx, ch) {
      const x = Math.round(ch.x);
      const y = Math.round(ch.y);
      const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      if (ch.open > 0) { // 금빛 후광
        const g = ctx.createRadialGradient(x + ch.w / 2, y + 4, 0, x + ch.w / 2, y + 4, 90);
        g.addColorStop(0, `rgba(255,225,110,${0.55 * ch.open})`);
        g.addColorStop(1, 'rgba(255,225,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 70, y - 90, ch.w + 140, 180);
      } else { // 닫혀 있을 땐 은은하게 깜빡이는 빛으로 위치를 알린다
        const a = 0.18 + 0.1 * Math.sin(t * 3);
        const g = ctx.createRadialGradient(x + ch.w / 2, y + 8, 0, x + ch.w / 2, y + 8, 60);
        g.addColorStop(0, `rgba(255,215,90,${a})`);
        g.addColorStop(1, 'rgba(255,215,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, y - 50, ch.w + 80, 110);
      }
      // 몸통
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(x, y + 8, ch.w, ch.h - 8);
      ctx.fillStyle = '#935d2b';
      ctx.fillRect(x, y + 8, ch.w, 4);
      ctx.fillStyle = '#e0b12f'; // 금속 띠
      ctx.fillRect(x + 4, y + 8, 3, ch.h - 8);
      ctx.fillRect(x + ch.w - 7, y + 8, 3, ch.h - 8);
      if (ch.open > 0.2) { // 안의 금화
        ctx.fillStyle = '#ffd54a';
        ctx.fillRect(x + 3, y + 7, ch.w - 6, 4);
        ctx.fillStyle = '#fff4b8';
        ctx.fillRect(x + 7, y + 5, 5, 3);
        ctx.fillRect(x + 16, y + 6, 4, 3);
      }
      // 뚜껑: 힌지(뒤쪽 위)를 축으로 열림
      ctx.save();
      ctx.translate(x + ch.w, y + 8);
      ctx.rotate(ch.open * 1.9);
      ctx.translate(-ch.w, -8);
      ctx.fillStyle = '#8a5428';
      ctx.fillRect(0, 0, ch.w, 8);
      ctx.fillStyle = '#a66a33';
      ctx.fillRect(0, 0, ch.w, 3);
      ctx.fillStyle = '#e0b12f';
      ctx.fillRect(4, 0, 3, 8);
      ctx.fillRect(ch.w - 7, 0, 3, 8);
      ctx.restore();
      if (ch.open === 0) { // 자물쇠
        ctx.fillStyle = '#ffd54a';
        ctx.fillRect(x + ch.w / 2 - 3, y + 8, 6, 6);
      }
    }

    _drawPlayer(ctx, p) {
      // 무적 중엔 깜빡인다
      const blink = p.invuln > 0 && Math.floor(p.invuln / 0.08) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.3;
      this._paintPlayer(ctx, p);
      ctx.globalAlpha = 1;
    }

    _paintPlayer(ctx, p) {
      G.Hero.draw(ctx, p);
    }

    _drawMonster(ctx, s) {
      if (s.flying) {
        // 튕겨난 몬스터: 몸 중심 기준으로 빙글 회전
        ctx.save();
        ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
        ctx.rotate(s.spin);
        ctx.translate(-(s.x + s.w / 2), -(s.y + s.h / 2));
        this._drawMonsterBody(ctx, s);
        ctx.restore();
        return;
      }
      this._drawMonsterBody(ctx, s);
    }

    _paintMonster(ctx, m) {
      if (m.kind === 'bat') this._paintBat(ctx, m);
      else this._paintSlime(ctx, m);
    }

    _drawMonsterBody(ctx, s) {
      // 부활 직후: 바닥(박쥐는 중심)에서 통통 튀며 커지는 연출
      if (s.appear > 0) {
        const t = 1 - s.appear / G.Config.SLIME_APPEAR_TIME;
        const k = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2); // easeOutBack
        const cx = s.x + s.w / 2;
        const by = s.kind === 'bat' ? s.y + s.h / 2 : s.y + s.h;
        ctx.save();
        ctx.translate(cx, by);
        ctx.scale(k, k);
        ctx.translate(-cx, -by);
        this._paintMonster(ctx, s);
        ctx.restore();
        return;
      }
      this._paintMonster(ctx, s);
    }

    _paintSlime(ctx, s) {
      // 바닥 중앙을 기준으로 가로/세로 배율을 적용한 젤리 몸체 (충돌 박스는 그대로)
      const cx = Math.round(s.x + s.w / 2);
      const bottom = Math.round(s.y + s.h);
      const bw = s.w * s.sx * 1.1;
      const bh = s.h * s.sy * 1.15;
      const left = cx - bw / 2;
      const right = cx + bw / 2;
      const shoulder = bottom - bh * 0.45;

      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(left, shoulder);
      ctx.quadraticCurveTo(cx, bottom - bh * 1.35, right, shoulder);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = s.flying && Math.floor(s.flightTime / 0.05) % 2 === 0 ? '#ffffff' : s.chasing ? '#f0558c' : '#4fd37f'; // 사라지기 직전엔 하얗게 번쩍
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.chasing ? '#b02a5c' : '#2c9b55';
      ctx.stroke();

      // 젤리 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx - bw * 0.2, bottom - bh * 0.78, bw * 0.12, bh * 0.1, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // 눈: 바라보는 쪽으로 쏠림
      const ex = cx + s.dir * bw * 0.12;
      const ey = bottom - bh * 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex - 7, ey - 4, 6, 7);
      ctx.fillRect(ex + 1, ey - 4, 6, 7);
      ctx.fillStyle = '#222';
      const px = s.dir > 0 ? 2 : 0;
      ctx.fillRect(ex - 7 + px, ey - 1, 3, 4);
      ctx.fillRect(ex + 1 + px, ey - 1, 3, 4);
    }

    // 박쥐: 날개를 퍼덕이며 날고, 예비동작/급강하 때는 눈이 붉게 변한다
    _paintBat(ctx, b) {
      const cx = Math.round(b.x + b.w / 2);
      const cy = Math.round(b.y + b.h / 2);
      const angry = b.state === 'windup' || b.state === 'dive';
      const flash = b.flying && Math.floor(b.flightTime / 0.05) % 2 === 0;
      const dive = b.state === 'dive';
      const wing = dive ? 1.0 : Math.sin(b.flap) * 0.9; // 급강하 땐 날개를 접음
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.dir >= 0 ? 1 : -1, 1);
      const body = flash ? '#ffffff' : angry ? '#8a3f96' : '#6a52a0';
      const membrane = flash ? '#ffffff' : angry ? '#a8416f' : '#7f64bd';
      // 날개 (몸 뒤/앞 양쪽)
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 5, -2);
        ctx.rotate(side * (-0.35 - wing * 0.6));
        ctx.fillStyle = membrane;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(side * 20, -9 - wing * 4);
        ctx.lineTo(side * 15, 0);
        ctx.lineTo(side * 19, 6);
        ctx.lineTo(side * 8, 4);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(20,12,40,0.8)';
        ctx.stroke();
        ctx.restore();
      }
      // 몸통 + 귀
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, -5); ctx.lineTo(-5, -12); ctx.lineTo(-1, -6);
      ctx.moveTo(6, -5); ctx.lineTo(5, -12); ctx.lineTo(1, -6);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(20,12,40,0.8)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 눈 + 송곳니
      ctx.fillStyle = angry ? '#ff4d4d' : '#ffe36b';
      ctx.fillRect(-5, -3, 3, 3);
      ctx.fillRect(2, -3, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, 3, 2, 3);
      ctx.fillRect(1, 3, 2, 3);
      ctx.restore();
    }

    _inView(o, camera) {
      const m = 64;
      return o.x + o.w > camera.x - m && o.x < camera.x + this.viewW + m && o.y + o.h > camera.y - m && o.y < camera.y + this.viewH + m;
    }

    _drawHeart(ctx, x, y, size, filled) {
      const s = size;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.55, y - s * 0.1, x - s * 0.55, y + s * 0.25);
      ctx.bezierCurveTo(x - s * 0.55, y + s * 0.6, x, y + s * 0.8, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.55, y + s * 0.6, x + s * 0.55, y + s * 0.25);
      ctx.bezierCurveTo(x + s * 0.55, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.35);
      ctx.closePath();
      ctx.fillStyle = filled ? '#e8334a' : 'rgba(0,0,0,0.25)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = filled ? '#8f1427' : 'rgba(0,0,0,0.4)';
      ctx.stroke();
    }

    // 어두운 동굴 배경에서도 읽히도록 그림자를 깐 밝은 글씨
    _text(ctx, str, x, y) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(str, x + 1, y + 1);
      ctx.fillStyle = 'rgba(225,232,255,0.92)';
      ctx.fillText(str, x, y);
    }

    _drawHud(ctx, hud) {
      ctx.font = '16px sans-serif';
      ctx.textBaseline = 'top';
      this._text(ctx, '←/→ 또는 A/D: 이동   Space/↑/W/Z: 점프   Enter: 패링 (길게 눌러 게이지 채우고 떼기: 검 던지기)   R: 처음 위치로', 12, 10);
      if (!hud) return;
      if (hud.slimeCount !== undefined) this._text(ctx, `슬라임 ${hud.slimeCount}마리  박쥐 ${hud.batCount || 0}마리   - 키: 슬라임 소환`, 12, 32);

      // 목숨: 우측 상단 하트
      for (let i = 0; i < hud.maxLives; i++) {
        this._drawHeart(ctx, this.viewW - 28 - (hud.maxLives - 1 - i) * 34, 10, 26, i < hud.lives);
      }

      if (!hud.won && !hud.gameOver) this._text(ctx, '목표: 지도의 X, 동굴 맨 끝의 보물 상자를 찾아라', 12, 54);

      if (hud.won) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText('보물을 찾았다!', this.viewW / 2 + 3, this.viewH / 2 - 17);
        ctx.fillStyle = '#ffd54a';
        ctx.fillText('보물을 찾았다!', this.viewW / 2, this.viewH / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '22px sans-serif';
        ctx.fillText('동굴의 모험을 마친 용사는 큰 부자가 되었답니다.', this.viewW / 2, this.viewH / 2 + 34);
        if (hud.canRestart) ctx.fillText('Enter 키로 다시 시작', this.viewW / 2, this.viewH / 2 + 72);
        ctx.textAlign = 'start';
      }

      if (hud.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff4d63';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText('GAME OVER', this.viewW / 2, this.viewH / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '22px sans-serif';
        if (hud.canRestart) ctx.fillText('Enter 키로 다시 시작', this.viewW / 2, this.viewH / 2 + 38);
        ctx.textAlign = 'start';
      }
    }
  }

  G.Renderer = Renderer;
})(window.Game);
