// 챕터 3 "왕국의 번영": 왕이 내리는 큰 목표들. 하나씩 이루면 이야기가 이어지고 보상을 받는다.
// 숲(meadow)과 심연 동굴(abyss)으로 가는 길에는 통행료가 있어 한 번 내면 계속 지나갈 수 있다.
(function (G) {
  const TOLLS = {
    meadow: { cost: 2500, name: '성 밖 숲으로 가는 다리' },
    abyss: { cost: 6000, name: '심연 동굴로 가는 협곡 다리' },
  };
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const count = (o) => Object.keys(o || {}).length;
  const homeBuilt = (c) => !!((c.inv.homes && ((c.inv.homes.village && c.inv.homes.village.type) || (c.inv.homes.kingdom && c.inv.homes.kingdom.type))) || (c.inv.home && c.inv.home.type));
  const trainTotal = (c) => sum(c.inv.train);
  const wlv = (c) => (c.inv.wlevel && c.inv.wlevel[c.inv.equipped.weapon]) || 0;

  // 업적 하나 (안 해도 되는 것): 코인을 100만 G까지 모은다. 돌아다니다 보면 언젠가 이루어진다
  const GOALS = [
    { title: '큰손', desc: '코인을 100만 G 모으자 (안 해도 돼요)', need: 1000000, prog: (c) => Math.min(1000000, Math.floor(c.coins)), coins: 0, exp: 10000, last: true,
      lines: ['왕: "…백만 G라니! 이 왕국의 금고보다 두둑하군."', '왕: "이제 자네를 이 왕국 제일의 큰손이라 부르겠네. 허허."', '왕: "챕터 3 — 왕국의 번영 — 의 업적을 이루었군. 그저 즐기시게나."'] },
  ];

  G.Quest = { TOLLS, GOALS, current: (c) => (c.story.bigDone ? null : GOALS[0]) };
})(window.Game);
