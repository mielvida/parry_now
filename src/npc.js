// NPC 그리기: 노인, 마을 사람, 물약 상인, 대장장이. 용사와 같은 24x32 크기의 도트풍 인물.
// 상태를 읽기만 한다. (x, y) = 발 바닥 중앙, facing = 바라보는 방향(1 오른쪽 / -1 왼쪽), t = 숨쉬기용 시간
(function (G) {
  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  const LOOKS = {
    elder: { robe: '#7a5a3a', trim: '#a8814f', hat: null, beard: '#f2f2f2', hair: '#f2f2f2', skin: '#e8b98a', staff: true },
    villager: { robe: '#4f9a6a', trim: '#7fcf98', hat: '#e0c36a', beard: null, hair: '#6b4423', skin: '#e8b98a' },
    potion: { robe: '#8a4fb8', trim: '#c79cf0', hat: '#5a2d82', beard: null, hair: '#3a2f22', skin: '#e8b98a' },
    armor: { robe: '#7a3b3b', trim: '#b86060', hat: '#c9d2dc', beard: '#8a5a2b', hair: '#3a2f22', skin: '#e0a878' },
    smith: { robe: '#5b5f6b', trim: '#8b90a0', hat: null, beard: '#6b4423', hair: '#3a2f22', skin: '#d9a070', apron: '#3a2f22' },
  };

  const Npc = {
    draw(ctx, kind, x, y, facing = 1, t = 0, alpha = 1) {
      const L = LOOKS[kind] || LOOKS.villager;
      const bob = Math.sin(t * 2.2) * 0.8; // 숨쉬는 흔들림
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(facing >= 0 ? 1 : -1, 1);
      rect(ctx, '#3a2f22', -6, -8, 5, 8); // 다리
      rect(ctx, '#4a3b2a', 1, -8, 5, 8);
      ctx.translate(0, bob);
      rect(ctx, L.robe, -8, -22, 16, 16); // 옷
      rect(ctx, L.trim, -8, -22, 16, 3);
      rect(ctx, L.trim, -8, -8, 16, 2);
      if (L.apron) rect(ctx, L.apron, -6, -17, 12, 11);
      rect(ctx, L.skin, -6, -32, 12, 10); // 얼굴
      rect(ctx, L.hair, -7, -33, 14, 4);
      if (L.hat) { // 모자
        rect(ctx, L.hat, -9, -35, 18, 4);
        rect(ctx, L.hat, -6, -40, 12, 6);
      }
      rect(ctx, '#222', 2, -28, 2, 3); // 눈
      if (L.beard) { // 수염
        rect(ctx, L.beard, -5, -25, 11, 7);
        rect(ctx, L.beard, -3, -18, 7, 3);
      }
      if (L.staff) { // 지팡이
        rect(ctx, '#6b4423', 10, -34, 3, 36);
        rect(ctx, '#e0b12f', 9, -37, 5, 4);
      }
      rect(ctx, L.skin, 6, -18, 4, 4); // 손
      ctx.restore();
    },
  };

  G.Npc = Npc;
})(window.Game);
