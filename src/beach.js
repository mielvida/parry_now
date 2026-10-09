// 해변 테마 그리기: 하늘/바다 시차 배경, 모래 타일, 해변 집, 짐더미. Cave와 같은 인터페이스를 가진다.
// 모든 무늬는 좌표 해시로 정해지므로 프레임마다 같은 모양이다.
(function (G) {
  const { TILE } = G.Config;
  const rnd = G.Cave.rnd;

  function mix(c1, c2, t) {
    return `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
  }

  const SAND_LIGHT = [244, 224, 160];
  const SAND_DARK = [226, 198, 130];
  const WET_LIGHT = [200, 170, 110]; // 위가 막힌(깊은 곳) 젖은 모래
  const WET_DARK = [180, 150, 96];

  // ---- 짐더미 부품 (x = 가운데, y = 바닥) ----
  function crate(ctx, x, y, s) {
    ctx.fillStyle = '#a8743a';
    ctx.fillRect(x - s / 2, y - s, s, s);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - s / 2 + 1, y - s + 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(x - s / 2 + 2, y - s + 2); ctx.lineTo(x + s / 2 - 2, y - 2);
    ctx.moveTo(x + s / 2 - 2, y - s + 2); ctx.lineTo(x - s / 2 + 2, y - 2);
    ctx.stroke();
  }

  function barrel(ctx, x, y, w, h) {
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.ellipse(x, y - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9c6a35';
    ctx.fillRect(x - w / 2 + 3, y - h + 2, 4, h - 4);
    ctx.strokeStyle = '#4a4a52';
    ctx.lineWidth = 2.5;
    for (const k of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.ellipse(x, y - h * k, w / 2 - 0.5, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function sack(ctx, x, y, w, h) {
    ctx.fillStyle = '#c9a56a';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.7, y - h * 0.5, x - w * 0.18, y - h * 0.82);
    ctx.lineTo(x + w * 0.18, y - h * 0.82);
    ctx.quadraticCurveTo(x + w * 0.7, y - h * 0.5, x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a6a36';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#c0504d'; // 묶은 끈
    ctx.fillRect(x - w * 0.2, y - h * 0.86, w * 0.4, 3);
    ctx.fillStyle = '#c9a56a';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.18, y - h * 0.86); ctx.lineTo(x - w * 0.3, y - h); ctx.lineTo(x, y - h * 0.9);
    ctx.lineTo(x + w * 0.3, y - h); ctx.lineTo(x + w * 0.18, y - h * 0.86);
    ctx.fill();
  }

  function suitcase(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w / 2 + 1, y - h + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; // 가운데 띠
    ctx.fillRect(x - w / 2, y - h * 0.55, w, 3);
    ctx.fillStyle = '#e0b12f'; // 걸쇠
    ctx.fillRect(x - w * 0.3, y - h * 0.62, 4, 6);
    ctx.fillRect(x + w * 0.3 - 4, y - h * 0.62, 4, 6);
    ctx.strokeStyle = '#3a2f22'; // 손잡이
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - h); ctx.lineTo(x - 6, y - h - 5); ctx.lineTo(x + 6, y - h - 5); ctx.lineTo(x + 6, y - h);
    ctx.stroke();
  }

  // 짐더미 한 무더기: 열 번호로 구성을 고른다
  function drawLuggage(ctx, c, baseX, baseY) {
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; // 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(baseX, baseY, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const v = Math.floor(rnd(c, 7, 31) * 4);
    if (v === 0) {
      crate(ctx, baseX - 12, baseY, 26);
      crate(ctx, baseX + 14, baseY, 22);
      crate(ctx, baseX, baseY - 26, 22);
    } else if (v === 1) {
      barrel(ctx, baseX - 14, baseY, 24, 30);
      sack(ctx, baseX + 14, baseY, 24, 26);
    } else if (v === 2) {
      suitcase(ctx, baseX - 10, baseY, 38, 24, '#3b6fd4');
      suitcase(ctx, baseX - 6, baseY - 24, 28, 18, '#c62d3a');
      sack(ctx, baseX + 20, baseY, 20, 22);
    } else {
      crate(ctx, baseX - 14, baseY, 26);
      suitcase(ctx, baseX + 14, baseY, 30, 20, '#6b8f3a');
      barrel(ctx, baseX + 2, baseY - 20, 16, 14);
    }
  }

  // 해변 집: baseX = 가운데, baseY = 땅 윗면
  function drawHouse(ctx, baseX, baseY, time) {
    const w = 132, wallH = 72;
    const x = baseX - w / 2;
    const top = baseY - wallH;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.ellipse(baseX, baseY, w * 0.62, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // 기둥(말뚝) + 벽
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(x + 6, baseY - 8, 8, 8);
    ctx.fillRect(x + w - 14, baseY - 8, 8, 8);
    ctx.fillStyle = '#e8b878';
    ctx.fillRect(x, top, w, wallH);
    ctx.fillStyle = 'rgba(120,70,20,0.28)'; // 널빤지 줄
    for (let k = 1; k < 6; k++) ctx.fillRect(x, top + k * (wallH / 6) - 1, w, 2);
    ctx.fillStyle = '#b8864a';
    ctx.fillRect(x, top, 5, wallH);
    ctx.fillRect(x + w - 5, top, 5, wallH);
    // 지붕
    ctx.fillStyle = '#c0504d';
    ctx.beginPath();
    ctx.moveTo(x - 12, top + 4);
    ctx.lineTo(baseX, top - 50);
    ctx.lineTo(x + w + 12, top + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e06a63';
    ctx.beginPath();
    ctx.moveTo(x - 12, top + 4);
    ctx.lineTo(baseX, top - 50);
    ctx.lineTo(baseX, top - 38);
    ctx.lineTo(x + 6, top + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a2c2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 12, top + 4); ctx.lineTo(baseX, top - 50); ctx.lineTo(x + w + 12, top + 4);
    ctx.stroke();
    // 굴뚝
    ctx.fillStyle = '#9a8a7a';
    ctx.fillRect(x + w * 0.74, top - 44, 12, 28);
    // 문
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(baseX - 13, baseY - 46, 26, 46);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(baseX - 13, baseY - 46, 26, 4);
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(baseX + 6, baseY - 22, 4, 4);
    // 창문 (양쪽)
    for (const wx of [x + 18, x + w - 18 - 26]) {
      ctx.fillStyle = '#5a3d17';
      ctx.fillRect(wx - 3, top + 15, 32, 28);
      ctx.fillStyle = '#bfe8ff';
      ctx.fillRect(wx, top + 18, 26, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(wx + 3, top + 21, 6, 10);
      ctx.fillStyle = '#5a3d17';
      ctx.fillRect(wx + 12, top + 18, 2, 22);
      ctx.fillRect(wx, top + 28, 26, 2);
    }
    // 현관 등불 + 간판
    const glow = 0.5 + 0.2 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(255,220,120,${0.3 * glow})`;
    ctx.beginPath(); ctx.arc(baseX + 22, baseY - 52, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(baseX + 20, baseY - 56, 5, 7);
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(x - 26, baseY - 30, 4, 30);
    ctx.fillStyle = '#c9a56a';
    ctx.fillRect(x - 40, baseY - 44, 32, 16);
    ctx.fillStyle = '#5a3d17';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('민박', x - 24, baseY - 36);
    ctx.textAlign = 'start';
  }

  // 상점 가판대: baseX = 가운데, baseY = 땅 윗면. 뒤에 주인이 서 있고 앞에 계산대가 있다
  function drawShop(ctx, shop, baseX, baseY, time) {
    const potion = shop.kind === 'potion';
    const armor = shop.kind === 'armor';
    const w = 140;
    const x = baseX - w / 2;
    const stripeA = potion ? '#8a4fb8' : armor ? '#c0504d' : '#4f7fd4';
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath(); ctx.ellipse(baseX, baseY, w * 0.6, 6, 0, 0, Math.PI * 2); ctx.fill();
    // 뒤쪽 벽 + 기둥
    ctx.fillStyle = potion ? '#d9c3a0' : '#a89a8a';
    ctx.fillRect(x + 4, baseY - 86, w - 8, 86);
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(x, baseY - 96, 6, 96);
    ctx.fillRect(x + w - 6, baseY - 96, 6, 96);
    // 선반 위 물건
    if (potion) {
      ctx.fillStyle = '#7a5530';
      ctx.fillRect(x + 10, baseY - 62, w - 20, 4);
      const cols = ['#e8334a', '#3b6fd4', '#4fd37f', '#ffd54a', '#c79cf0', '#e8334a'];
      cols.forEach((c, i) => {
        const bx = x + 20 + i * 20;
        ctx.fillStyle = c; ctx.fillRect(bx, baseY - 76, 9, 12);
        ctx.fillStyle = '#e8f1ff'; ctx.fillRect(bx + 2, baseY - 82, 5, 6);
        ctx.fillStyle = '#9a6b3c'; ctx.fillRect(bx + 2, baseY - 84, 5, 3);
      });
    } else if (armor) {
      const sets = [['#8a5a2b', '#b8803f'], ['#9aa4b2', '#d0d8e4'], ['#d4a017', '#ffe27a']];
      sets.forEach((c, i) => { // 걸이에 걸린 갑옷 세 벌
        const ax = x + 28 + i * 38;
        ctx.fillStyle = '#7a5530'; ctx.fillRect(ax + 8, baseY - 78, 3, 10);
        ctx.fillStyle = c[0]; ctx.fillRect(ax, baseY - 70, 19, 22);
        ctx.fillStyle = c[1]; ctx.fillRect(ax, baseY - 70, 19, 5);
        ctx.fillRect(ax - 5, baseY - 70, 6, 8); ctx.fillRect(ax + 18, baseY - 70, 6, 8);
      });
    } else {
      for (let i = 0; i < 4; i++) { // 벽에 걸린 검
        const sx = x + 24 + i * 30;
        ctx.save();
        ctx.translate(sx, baseY - 40);
        ctx.rotate(-0.15 + i * 0.1);
        ctx.fillStyle = ['#e8f1ff', '#ffe08a', '#9fe8ff', '#e0a8ff'][i];
        ctx.fillRect(-2, -34, 4, 40);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-7, 6, 14, 3);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-2, 9, 4, 10);
        ctx.restore();
      }
    }
    // 주인
    G.Npc.draw(ctx, { potion: 'potion', armor: 'armor', sword: 'smith' }[shop.kind], baseX, baseY - 16, 1, time);
    // 계산대
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x + 2, baseY - 28, w - 4, 28);
    ctx.fillStyle = '#a66a33';
    ctx.fillRect(x, baseY - 32, w, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 2, baseY - 4, w - 4, 4);
    if (potion) { // 계산대 위 물약 병
      ctx.fillStyle = '#e8334a'; ctx.fillRect(x + 14, baseY - 44, 9, 12);
      ctx.fillStyle = '#4fd37f'; ctx.fillRect(x + w - 28, baseY - 44, 9, 12);
    } else if (armor) { // 투구
      ctx.fillStyle = '#c9d2dc'; ctx.fillRect(x + w - 40, baseY - 46, 22, 14);
      ctx.fillStyle = '#e6edf5'; ctx.fillRect(x + w - 40, baseY - 46, 22, 4);
      ctx.fillStyle = '#1b2433'; ctx.fillRect(x + w - 34, baseY - 40, 10, 3);
    } else { // 모루
      ctx.fillStyle = '#4a4a52'; ctx.fillRect(x + w - 40, baseY - 42, 28, 8);
      ctx.fillRect(x + w - 34, baseY - 34, 16, 4);
    }
    // 줄무늬 차양
    const topY = baseY - 100;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#f4f0e8' : stripeA;
      ctx.beginPath();
      ctx.moveTo(x - 6 + i * ((w + 12) / 7), topY);
      ctx.lineTo(x - 6 + (i + 1) * ((w + 12) / 7), topY);
      ctx.lineTo(x - 6 + (i + 1) * ((w + 12) / 7), topY + 16);
      ctx.arc(x - 6 + (i + 0.5) * ((w + 12) / 7), topY + 16, (w + 12) / 14, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    // 간판
    ctx.fillStyle = '#5a3d17';
    ctx.fillRect(baseX - 34, topY - 26, 68, 22);
    ctx.fillStyle = '#e9d8a6';
    ctx.fillRect(baseX - 31, topY - 23, 62, 16);
    ctx.fillStyle = '#5a3d17';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(potion ? '물약' : armor ? '갑옷' : '무기', baseX, topY - 15);
    ctx.textAlign = 'start';
  }

  // 동굴 입구: 바위 더미 한가운데 뚫린 어두운 아치와 나무 팻말. baseX = 가운데, baseY = 땅 윗면
  function drawCaveMouth(ctx, baseX, baseY, time) {
    const w = 150, h = 110;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(baseX, baseY, w * 0.62, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 바위 더미
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.moveTo(baseX - w / 2 - 12, baseY);
    ctx.quadraticCurveTo(baseX - w / 2, baseY - h * 0.8, baseX - 30, baseY - h);
    ctx.quadraticCurveTo(baseX, baseY - h - 10, baseX + 30, baseY - h);
    ctx.quadraticCurveTo(baseX + w / 2, baseY - h * 0.8, baseX + w / 2 + 12, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7d8696';
    for (let i = 0; i < 7; i++) {
      const rx = baseX - w / 2 + 10 + rnd(i, 1, 41) * (w - 20);
      const ry = baseY - 16 - rnd(i, 2, 42) * (h - 40);
      ctx.beginPath(); ctx.ellipse(rx, ry, 14 + rnd(i, 3, 43) * 10, 8 + rnd(i, 4, 44) * 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#4b5260';
    ctx.fillRect(baseX - w / 2 - 12, baseY - 6, w + 24, 6);
    // 어두운 아치 (안쪽으로 갈수록 검다)
    const aw = 46, ah = 72;
    const g = ctx.createLinearGradient(0, baseY - ah, 0, baseY);
    g.addColorStop(0, '#070912');
    g.addColorStop(1, '#161a2e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(baseX - aw / 2, baseY);
    ctx.lineTo(baseX - aw / 2, baseY - ah * 0.55);
    ctx.quadraticCurveTo(baseX - aw / 2, baseY - ah, baseX, baseY - ah);
    ctx.quadraticCurveTo(baseX + aw / 2, baseY - ah, baseX + aw / 2, baseY - ah * 0.55);
    ctx.lineTo(baseX + aw / 2, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a3f4c';
    ctx.lineWidth = 4;
    ctx.stroke();
    // 안쪽에서 번쩍이는 수정 빛
    const a = 0.35 + 0.2 * Math.sin(time * 2.5);
    ctx.fillStyle = `rgba(120,210,255,${a})`;
    ctx.fillRect(baseX - 5, baseY - 26, 3, 6);
    ctx.fillRect(baseX + 8, baseY - 40, 3, 5);
    // 팻말
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(baseX + w / 2 + 18, baseY - 34, 4, 34);
    ctx.fillStyle = '#c9a56a';
    ctx.fillRect(baseX + w / 2 + 2, baseY - 52, 44, 20);
    ctx.fillStyle = '#5a3d17';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('동굴', baseX + w / 2 + 24, baseY - 42);
    ctx.textAlign = 'start';
  }

  const Beach = {
    rnd,

    // 하늘 + 해 + 구름 + 먼 섬 + 바다(구덩이는 바다로 보인다) + 먼 야자수
    drawBackground(ctx, w, h, camera, time) {
      const horizon = h * 0.56;
      let g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, '#4fb4f2');
      g.addColorStop(1, '#d8f2ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, horizon);

      const sx = w * 0.8, sy = h * 0.17; // 해는 화면에 고정
      g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 160);
      g.addColorStop(0, 'rgba(255,250,200,0.95)');
      g.addColorStop(0.25, 'rgba(255,240,150,0.45)');
      g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 160, sy - 160, 320, 320);
      ctx.fillStyle = '#fff6b0';
      ctx.beginPath(); ctx.arc(sx, sy, 32, 0, Math.PI * 2); ctx.fill();

      // 구름: 천천히 흐르고 카메라에 아주 조금만 따라 움직인다
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 0; i < 6; i++) {
        const span = w + 280;
        const cx = (((i * 220 + time * (6 + i * 2) - camera.x * 0.06) % span) + span) % span - 140;
        const cy = 40 + (i % 3) * 46 + rnd(i, 2, 1) * 20;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 58, 17, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 32, cy - 10, 34, 15, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 28, cy - 6, 28, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 수평선 위 먼 섬
      ctx.fillStyle = '#7fb6a8';
      for (const [ix, iw, ih] of [[0.18, 180, 36], [0.62, 240, 48]]) {
        const cx = ((ix * w * 3 - camera.x * 0.08) % (w * 1.6) + w * 1.6) % (w * 1.6) - w * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx - iw / 2, horizon);
        ctx.quadraticCurveTo(cx, horizon - ih * 2, cx + iw / 2, horizon);
        ctx.fill();
      }

      // 바다
      g = ctx.createLinearGradient(0, horizon, 0, h);
      g.addColorStop(0, '#2a9ad6');
      g.addColorStop(0.5, '#4fc0e0');
      g.addColorStop(1, '#2b86c0');
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      const off = camera.x * 0.2;
      for (let r = 0; r < 9; r++) { // 일렁이는 물결선 (아래쪽일수록 크고 빠르게)
        const yy = horizon + 10 + r * r * 3.2 + r * 12;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const y = yy + Math.sin((x + off) * (0.02 + r * 0.002) + time * (1 + r * 0.25) + r * 2) * (2 + r * 0.5);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 반짝이는 햇살 조각
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 14; i++) {
        const gx = ((i * 97 - camera.x * 0.2) % w + w) % w;
        const gy = horizon + 8 + rnd(i, 4, 5) * (h - horizon) * 0.7;
        if (Math.sin(time * 2 + i * 1.7) > 0.3) ctx.fillRect(gx, gy, 10, 2);
      }

      // 먼 곳의 야자수 실루엣 (바다 위 섬의 야자수 느낌)
      ctx.strokeStyle = 'rgba(60,110,90,0.55)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const poff = camera.x * 0.3;
      for (let i = Math.floor(poff / 360) - 1; i <= Math.ceil((poff + w) / 360) + 1; i++) {
        if (rnd(i, 6, 3) < 0.4) continue;
        const px = i * 360 + rnd(i, 6, 1) * 200 - poff;
        const py = horizon + 4;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 8, py - 30, px + 4, py - 56); ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const a = -Math.PI + (k / 3) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(px + 4, py - 56);
          ctx.lineTo(px + 4 + Math.cos(a) * 26, py - 56 + Math.sin(a) * 14 + 8);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    },

    drawCeiling() {}, // 해변엔 천장이 없다

    // 모래 타일 한 칸: 위가 열려 있으면 밝은 모래 + 조개/풀, 안쪽은 젖은 모래
    drawTile(ctx, terrain, c, r) {
      const x = c * TILE;
      const y = r * TILE;
      const above = r > 0 && terrain.grid[r - 1][c];
      const below = r + 1 < terrain.rows && terrain.grid[r + 1][c];
      const left = c > 0 && terrain.grid[r][c - 1];
      const right = c + 1 < terrain.cols && terrain.grid[r][c + 1];

      const v = rnd(c, r, 1);
      ctx.fillStyle = above ? mix(WET_DARK, WET_LIGHT, v) : mix(SAND_DARK, SAND_LIGHT, v);
      ctx.fillRect(x, y, TILE, TILE);

      // 모래 알갱이
      ctx.fillStyle = above ? 'rgba(90,60,20,0.18)' : 'rgba(170,130,60,0.28)';
      for (let k = 0; k < 6; k++) {
        ctx.fillRect(x + Math.floor(rnd(c, r, 20 + k) * (TILE - 3)), y + Math.floor(rnd(c, r, 30 + k) * (TILE - 3)), 2, 2);
      }
      // 물결무늬 결
      if (rnd(c, r, 2) > 0.6) {
        ctx.strokeStyle = 'rgba(150,110,50,0.25)';
        ctx.lineWidth = 2;
        const ly = y + 8 + rnd(c, r, 3) * 16;
        ctx.beginPath();
        ctx.moveTo(x + 3, ly); ctx.quadraticCurveTo(x + 11, ly - 4, x + 18, ly); ctx.quadraticCurveTo(x + 24, ly + 4, x + TILE - 3, ly);
        ctx.stroke();
      }
      // 옆면/아랫면 그림자
      ctx.fillStyle = 'rgba(80,50,10,0.2)';
      if (!right) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      if (!left) ctx.fillRect(x, y, 2, TILE);
      if (!below) ctx.fillRect(x, y + TILE - 4, TILE, 4);

      if (!above) {
        ctx.fillStyle = 'rgba(255,250,225,0.9)'; // 햇빛 받는 윗면
        ctx.fillRect(x, y, TILE, 3);
        ctx.fillStyle = 'rgba(190,150,80,0.55)';
        ctx.fillRect(x, y + 3, TILE, 2);
        const t = rnd(c, r, 8);
        if (t > 0.86) { // 조개껍데기
          ctx.fillStyle = '#fbe6e0';
          ctx.beginPath(); ctx.arc(x + 8 + rnd(c, r, 9) * 16, y + 2, 4, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = '#d9a8a0'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + 8 + rnd(c, r, 9) * 16, y + 2); ctx.lineTo(x + 8 + rnd(c, r, 9) * 16, y - 2); ctx.stroke();
        } else if (t < 0.18) { // 해안 풀
          ctx.strokeStyle = '#3f9a55';
          ctx.lineWidth = 2;
          const gx = x + 6 + rnd(c, r, 10) * 20;
          ctx.beginPath();
          ctx.moveTo(gx, y + 1); ctx.lineTo(gx - 4, y - 8);
          ctx.moveTo(gx, y + 1); ctx.lineTo(gx, y - 11);
          ctx.moveTo(gx, y + 1); ctx.lineTo(gx + 4, y - 7);
          ctx.stroke();
        }
      }
    },

    // 장식(집, 짐더미): 땅 타일 위, 플레이어 뒤에 그린다
    drawDecor(ctx, terrain, camera, time) {
      const view = camera.viewW + 200;
      for (const L of terrain.luggage) {
        const bx = L.col * TILE + TILE / 2;
        if (bx < camera.x - 100 || bx > camera.x + view) continue;
        drawLuggage(ctx, L.col, bx, (L.row + 1) * TILE);
      }
      for (const H of terrain.houses) {
        const bx = H.col * TILE + TILE / 2;
        if (bx < camera.x - 150 || bx > camera.x + view) continue;
        drawHouse(ctx, bx, (H.row + 1) * TILE, time);
      }
      for (const D of terrain.caveEntrances) {
        const bx = D.col * TILE + TILE / 2;
        if (bx < camera.x - 150 || bx > camera.x + view) continue;
        drawCaveMouth(ctx, bx, (D.row + 1) * TILE, time);
      }
      for (const S of terrain.shops) {
        const bx = S.col * TILE + TILE / 2;
        if (bx < camera.x - 150 || bx > camera.x + view) continue;
        drawShop(ctx, S, bx, (S.row + 1) * TILE, time);
      }
      terrain.villagers.forEach((V, i) => {
        const bx = V.col * TILE + TILE / 2;
        if (bx < camera.x - 60 || bx > camera.x + view) return;
        G.Npc.draw(ctx, 'villager', bx, (V.row + 1) * TILE, i % 2 ? -1 : 1, time + i);
      });
    },

    // 해변은 밝게: 가장자리만 아주 살짝 어둡게
    drawVignette(ctx, w, h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(10,30,60,0.18)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  };

  G.Beach = Beach;
})(window.Game);
