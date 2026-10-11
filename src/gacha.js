// 뽑기 (마을): 1~100번 중 한 번호를 골라 300 G에 뽑는다. 번호마다 상품이 숨어 있고, 마을 대장간의 검류와 갑옷 가게의 장비만 나온다.
// 판은 20분(실제 시간)마다 새로 바뀐다. 이미 가진 상품이 나오면 값의 절반을 돌려받는다. 꽝이면 위로금 100 G.
(function (G) {
  const PRICE = 300;
  const PERIOD = 20 * 60 * 1000;
  const CONSOLATION = 100;
  const GOLD = '$500', GOLD_PRIZE = 500;
  G.Shop.SHOPS.gacha = { title: '뽑기', tabs: [] };

  function pool() { // 마을 대장간(검, 대검, 단검, 지팡이)과 갑옷 가게(전부)에서 파는 것, 싼 것부터
    const S = G.Shop.SHOPS;
    const ids = [];
    for (const t of S.sword.tabs.slice(0, 4)) for (const it of t.items) if (!ids.includes(it.id)) ids.push(it.id);
    for (const t of S.armor.tabs) for (const it of t.items) if (!ids.includes(it.id)) ids.push(it.id);
    return ids.filter((id) => G.Shop.ITEMS[id] && G.Shop.ITEMS[id].price > 0).sort((a, b) => G.Shop.ITEMS[a].price - G.Shop.ITEMS[b].price);
  }
  function newBoard() {
    const ids = pool();
    const n = ids.length;
    const pickFrom = (a, b) => ids[Math.min(n - 1, Math.floor(n * (a + Math.random() * (b - a))))];
    const prizes = [];
    for (let i = 0; i < 100; i++) {
      const r = Math.random();
      prizes.push(r < 0.28 ? null : r < 0.4 ? '$500' : r < 0.76 ? pickFrom(0, 0.4) : r < 0.93 ? pickFrom(0.4, 0.8) : pickFrom(0.8, 1)); // 꽝 28 / 골드 500 G 12 / 싼 것 36 / 중간 17 / 비싼 것 7 쯤
    }
    return { until: Date.now() + PERIOD, prizes, picked: {} };
  }
  function board(inv) { // 시간이 지났으면 새 판으로
    if (!inv.gacha || !inv.gacha.prizes || Date.now() >= inv.gacha.until) inv.gacha = newBoard();
    return inv.gacha;
  }
  // 번호 i(0~99)를 뽑는다. 결과 { id, dup, refund } (id가 null이면 꽝). 코인 계산은 부르는 쪽이 한다
  function pick(inv, i) {
    const b = board(inv);
    if (b.picked[i]) return null;
    b.picked[i] = 1;
    const id = b.prizes[i];
    if (!id) return { id: null, dup: false, refund: CONSOLATION };
    if (id === GOLD) return { id, dup: false, gold: true, refund: GOLD_PRIZE }; // 골드: 코인 500 G
    const it = G.Shop.ITEMS[id];
    if (inv.items.includes(id)) return { id, dup: true, refund: Math.round(it.price * 0.5) };
    inv.items.push(id);
    return { id, dup: false, refund: 0 };
  }
  G.Gacha = { GOLD, PRICE, PERIOD, board, pick, pool };
})(window.Game);
