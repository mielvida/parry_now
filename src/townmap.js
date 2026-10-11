// 마을 지도 (N): 마을 전체를 한눈에 보여 준다. 땅의 윤곽, 가게/문/집/동굴 같은 곳의 이름, 내 위치가 한 화면에 나온다.
// 가게의 "마을 지도" / "왕국 지도"를 사면 그 도시에서 쓸 수 있다.
(function (G) {
  const T = G.Config.TILE;
  const ITEMS = G.Shop.ITEMS;
  const add = (it) => { ITEMS[it.id] = it; };
  add({ id: 'map_village', name: '마을 지도', price: 600, tool: true, townmap: 'village', desc: '마을 전체가 한눈에 보이는 지도. N 키로 펼친다', look: ['#e8d8a8', '#8a6a3a'] });
  add({ id: 'map_kingdom', name: '왕국 지도', price: 1000, tool: true, townmap: 'kingdom', desc: '왕국 전체가 한눈에 보이는 지도. N 키로 펼친다', look: ['#f0e0b0', '#7a5a2a'] });

  G.Shop.SHOPS.potion.tabs[0].items.push(ITEMS.map_village, ITEMS.map_kingdom); // 물약 가게에서 판다

  const KIND_COLOR = { gate: '#9fd8ff', shop: '#ffd54a', house: '#c8a070', home: '#7dffa0', cave: '#c070ff', castle: '#ff8a8a', exit: '#ffffff', misc: '#b8e0b8' };

  // 땅의 위쪽 윤곽: 열마다 처음 나오는 단단한 칸의 행
  function profile(terrain) {
    const out = [];
    for (let c = 0; c < terrain.cols; c++) {
      let top = terrain.rows;
      for (let r = 0; r < terrain.rows; r++) if (terrain.grid[r][c]) { top = r; break; }
      out.push(top);
    }
    return out;
  }

  const TownMap = {
    // 도시의 이름표 목록 [{col, label, kind}]
    markers(terrain, stageLabel) {
      const list = [];
      const shopTitle = (k) => (G.Shop.SHOPS[k] && G.Shop.SHOPS[k].title) || k;
      for (const s of terrain.shops) list.push({ col: s.col, label: shopTitle(s.kind).replace(/ \(.*\)/, ''), kind: 'shop' });
      for (const g of terrain.gates) list.push({ col: g.col, label: stageLabel(g.stage), kind: 'gate' });
      for (const h of terrain.houses) list.push({ col: h.col, label: '집', kind: 'house' });
      for (const y of terrain.homeLots) list.push({ col: y.col, label: '내 집 터', kind: 'home' });
      for (const d of terrain.caveEntrances) list.push({ col: d.col, label: '동굴', kind: 'cave' });
      for (const c of terrain.castles) list.push({ col: c.col, label: '왕궁', kind: 'castle' });
      for (const x of terrain.exits) list.push({ col: x.col, label: '출구', kind: 'exit' });
      for (const w of terrain.waters) list.push({ col: w.col, label: '샘물', kind: 'misc' });
      for (const a of terrain.altars) list.push({ col: a.col, label: '제단', kind: 'misc' });
      return list.sort((a, b) => a.col - b.col);
    },
    draw(ctx, W, H, terrain, markers, player, title, time) {
      const px = 28, py = 40, pw = W - 56, ph = H - 80;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8d8a8'; ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 6; ctx.strokeRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(122,90,42,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 10, py + 10, pw - 20, ph - 20);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#5a3d17'; ctx.fillText(title, W / 2, py + 34);
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#7a5a2a'; ctx.fillText('N 또는 Esc: 지도 접기', W / 2, py + ph - 20);
      // 땅의 윤곽 (가로로 전체를 한 화면에)
      const mx = px + 40, mw = pw - 80;
      const sx = mw / terrain.cols;
      const sy = Math.min(7, sx * 3.2);
      const baseY = py + ph * 0.62;
      const top = profile(terrain);
      const groundTop = Math.min(...top.filter((t) => t < terrain.rows - 1)) || 10;
      ctx.fillStyle = '#9a7a4a';
      for (let c = 0; c < terrain.cols; c++) {
        if (top[c] >= terrain.rows) continue;
        const y = baseY - (terrain.rows - 2 - top[c]) * sy;
        ctx.fillRect(mx + c * sx, y, Math.max(1, sx + 0.6), baseY + 16 - y);
      }
      ctx.fillStyle = '#6a8a3a'; // 풀
      for (let c = 0; c < terrain.cols; c++) { if (top[c] >= terrain.rows) continue; const y = baseY - (terrain.rows - 2 - top[c]) * sy; ctx.fillRect(mx + c * sx, y, Math.max(1, sx + 0.6), 3); }
      // 이름표: 겹치지 않게 높이를 번갈아 놓는다
      markers.forEach((m, i) => {
        const x = mx + m.col * sx + sx / 2;
        const colTop = top[Math.min(terrain.cols - 1, m.col)];
        const y0 = baseY - (terrain.rows - 2 - Math.min(colTop, terrain.rows - 2)) * sy;
        const lvl = i % 4;
        const ty = py + 80 + lvl * 34;
        ctx.strokeStyle = 'rgba(90,61,23,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, ty + 10); ctx.lineTo(x, y0); ctx.stroke();
        ctx.fillStyle = KIND_COLOR[m.kind] || '#fff';
        ctx.beginPath(); ctx.arc(x, y0 - 2, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#5a3d17'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = 'bold 12px sans-serif';
        const tw = ctx.measureText(m.label).width + 10;
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x - tw / 2, ty - 9, tw, 18);
        ctx.strokeStyle = KIND_COLOR[m.kind] === '#ffffff' ? '#5a3d17' : KIND_COLOR[m.kind]; ctx.lineWidth = 1.5; ctx.strokeRect(x - tw / 2, ty - 9, tw, 18);
        ctx.fillStyle = '#3a2a10'; ctx.fillText(m.label, x, ty);
      });
      // 내 위치
      const pcol = (player.x + player.w / 2) / T;
      const pxm = mx + pcol * sx;
      const pyy = baseY - (terrain.rows - 2 - Math.min(top[Math.min(terrain.cols - 1, Math.max(0, Math.floor(pcol)))], terrain.rows - 2)) * sy;
      const blink = 0.55 + 0.45 * Math.sin(time * 6);
      ctx.fillStyle = `rgba(232,51,74,${blink})`; ctx.beginPath(); ctx.moveTo(pxm, pyy - 4); ctx.lineTo(pxm - 7, pyy - 20); ctx.lineTo(pxm + 7, pyy - 20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7a1424'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#7a1424'; ctx.fillText('나', pxm, pyy - 30);
      // 범례
      const leg = [['gate', '문·포탈'], ['shop', '가게'], ['house', '집'], ['home', '내 집 터'], ['cave', '동굴'], ['castle', '왕궁']];
      ctx.textAlign = 'left'; ctx.font = '12px sans-serif';
      let lx = px + 30;
      for (const [k, name] of leg) { ctx.fillStyle = KIND_COLOR[k]; ctx.beginPath(); ctx.arc(lx, py + ph - 52, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#5a3d17'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#5a3d17'; ctx.fillText(name, lx + 10, py + ph - 52); lx += 90; }
      ctx.restore();
    },
  };
  G.TownMap = TownMap;
})(window.Game);
