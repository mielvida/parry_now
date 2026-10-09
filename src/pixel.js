// 글자 레이어: 픽셀 화면에서는 월드를 낮은 해상도로 그려 키우기 때문에 월드 안의 글자(간판, 데미지 숫자)가 뭉개진다.
// 월드를 그리는 코드는 글자를 직접 그리는 대신 여기에 맡기고, Renderer가 월드를 키운 뒤 같은 위치에 선명하게 덧그린다.
(function (G) {
  const TextLayer = {
    items: [],
    clear() { this.items.length = 0; },
    // (x, y) = 월드 좌표
    add(text, x, y, font, color, align = 'center', baseline = 'middle') {
      this.items.push({ text, x, y, font, color, align, baseline });
    },
    // 월드 좌표계(카메라 이동이 적용된 상태)에서 호출
    draw(ctx) {
      for (const it of this.items) {
        ctx.font = it.font;
        ctx.fillStyle = it.color;
        ctx.textAlign = it.align;
        ctx.textBaseline = it.baseline;
        ctx.fillText(it.text, it.x, it.y);
      }
      ctx.textAlign = 'start';
    },
  };
  G.TextLayer = TextLayer;
})(window.Game);
