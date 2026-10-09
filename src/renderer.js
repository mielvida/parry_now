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

    draw(terrain, player, camera, slimes = []) {
      const ctx = this.ctx;
      this._drawBackground(ctx);
      ctx.save();
      ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
      this._drawTerrain(ctx, terrain, camera);
      for (const s of slimes) this._drawSlime(ctx, s);
      this._drawPlayer(ctx, player);
      ctx.restore();
      this._drawHud(ctx);
    }

    _drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
      g.addColorStop(0, '#6aa9e9');
      g.addColorStop(1, '#cfe8ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    _drawTerrain(ctx, terrain, camera) {
      // 화면에 보이는 타일만 그린다
      const c0 = Math.max(0, Math.floor(camera.x / TILE));
      const c1 = Math.min(terrain.cols - 1, Math.floor((camera.x + this.viewW) / TILE));
      const r0 = Math.max(0, Math.floor(camera.y / TILE));
      const r1 = Math.min(terrain.rows - 1, Math.floor((camera.y + this.viewH) / TILE));

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!terrain.grid[r][c]) continue;
          const x = c * TILE;
          const y = r * TILE;
          const exposed = r === 0 || !terrain.grid[r - 1][c]; // 위가 비어 있으면 잔디
          ctx.fillStyle = '#7a5634';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(x, y + TILE - 2, TILE, 2);
          ctx.fillRect(x + TILE - 2, y, 2, TILE);
          if (exposed) {
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(x, y, TILE, 8);
            ctx.fillStyle = '#7ed957';
            ctx.fillRect(x, y, TILE, 3);
          }
        }
      }
    }

    _drawPlayer(ctx, p) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      ctx.fillStyle = '#d6372f';
      ctx.fillRect(x, y, p.w, p.h);
      // 눈: 바라보는 방향 쪽에 배치
      const eyeX = p.facing > 0 ? x + p.w - 10 : x + 4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(eyeX, y + 8, 6, 6);
      ctx.fillStyle = '#222';
      ctx.fillRect(eyeX + (p.facing > 0 ? 3 : 0), y + 10, 3, 3);
    }

    _drawSlime(ctx, s) {
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
      ctx.fillStyle = s.chasing ? '#f0558c' : '#4fd37f';
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

    _drawHud(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = '16px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('←/→ 또는 A/D: 이동   Space/↑/W/Z: 점프 (길게 누르면 높이 점프)   R: 리스폰', 12, 10);
    }
  }

  G.Renderer = Renderer;
})(window.Game);
