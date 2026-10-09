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

    draw(terrain, player, camera) {
      const ctx = this.ctx;
      this._drawBackground(ctx);
      ctx.save();
      ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
      this._drawTerrain(ctx, terrain, camera);
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

    _drawHud(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = '16px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('←/→ 또는 A/D: 이동   Space/↑/W/Z: 점프 (길게 누르면 높이 점프)   R: 리스폰', 12, 10);
    }
  }

  G.Renderer = Renderer;
})(window.Game);
