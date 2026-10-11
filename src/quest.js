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

  // need: 목표 수치, prog: 지금 수치, lines: 달성하면 나오는 이야기, coins/exp: 보상
  const GOALS = [
    { title: '첫 번째 소문', desc: '물고기나 곤충을 5마리 잡아 보자', need: 5, prog: (c) => c.inv.caughtTotal || 0, coins: 500, exp: 20,
      lines: ['왕: "허허, 벌써 솜씨가 좋구나. 성 밖 연못의 소문이 여기까지 들리더군."', '왕: "왕국이 되살아나려면 먼저 백성이 먹고 살아야 하네. 이건 작은 사례일세."'] },
    { title: '기록하는 자', desc: '도감에 5개를 등록하자 (도감관)', need: 5, prog: (c) => count(c.inv.dex), coins: 700, exp: 30,
      lines: ['도감관: "당신이 기록한 것들 덕분에 왕국의 책이 두꺼워지고 있어요!"', '왕: "아는 것이 힘이라 했네. 적을 알아야 이길 수 있지."'] },
    { title: '몸을 단련하라', desc: '훈련소에서 훈련을 합쳐 4번 올리자', need: 4, prog: trainTotal, coins: 1000, exp: 40,
      lines: ['훈련관: "좋은 근육이다! 다만 시크너의 그림자는 아직 끝나지 않았지."', '왕: "전쟁은 칼로만 하는 것이 아닐세. 몸과 마음이 함께여야 하지."'] },
    { title: '내 집 마련', desc: '집을 사서 정착하자 (부동산)', need: 1, prog: (c) => (homeBuilt(c) ? 1 : 0), coins: 1500, exp: 50,
      lines: ['왕: "돌아갈 집이 있다는 것은 큰 힘이 되지."', '왕: "그 집이 왕국을 지키는 이유가 되기를 바라네."'] },
    { title: '왕의 신하', desc: '왕의 의뢰를 2건 완수하자', need: 2, prog: (c) => c.missions.done || 0, coins: 2000, exp: 60,
      lines: ['왕: "의뢰를 훌륭히 해냈구나. 병사들도 자네를 믿기 시작했네."', '왕: "이제 더 먼 곳까지 부탁할 수 있겠군."'] },
    { title: '운을 시험하다', desc: '마을의 뽑기를 3번 해 보자', need: 3, prog: (c) => c.inv.gachaCount || 0, coins: 1200, exp: 40,
      lines: ['뽑기 아저씨: "하하, 운도 실력이라니까! 또 와요!"', '왕: "…운에 기대는 것도 때로는 필요하지. 너무 빠지지는 말게."'] },
    { title: '통행료의 다리', desc: '성 밖 숲으로 가는 다리의 통행료를 내자 (2500 G)', need: 1, prog: (c) => (c.story.tolls && c.story.tolls.meadow ? 1 : 0), coins: 3000, exp: 80,
      lines: ['다리지기: "한 번 냈으면 평생 건너도 좋소. 숲의 짐승들이 점점 거칠어지고 있다오."', '왕: "숲의 짐승들이 이상하다는 보고가 있네. 무슨 일이 있는지 살펴 주게."'] },
    { title: '어둠의 탑 20층', desc: '어둠의 탑을 20층까지 오르자', need: 20, prog: (c) => c.darkBest, coins: 4000, exp: 150,
      lines: ['왕: "탑의 20층이라니! 그곳은 시크너가 쓰러진 뒤에도 어둠이 남아 있는 곳이지."', '왕: "…탑이 스스로 자라고 있다는 소문이 있네. 끝을 알 수 없어."'] },
    { title: '더 넓은 도감', desc: '도감에 20개를 등록하자', need: 20, prog: (c) => count(c.inv.dex), coins: 4500, exp: 150,
      lines: ['도감관: "벌써 이만큼이나! 책 한 권으로는 모자라겠어요."', '왕: "이 모든 것이 왕국의 새로운 역사가 될 걸세."'] },
    { title: '단단한 갑옷', desc: '갑옷 강화를 3레벨까지 올리자 (강화소)', need: 3, prog: (c) => c.inv.armorLevel || 0, coins: 5000, exp: 200,
      lines: ['대장장이: "그 갑옷, 이제 웬만한 칼은 튕겨 내겠소!"', '왕: "자네가 쓰러지면 왕국도 쓰러지네. 부디 몸을 아끼게."'] },
    { title: '협곡의 다리', desc: '심연 동굴로 가는 다리의 통행료를 내자 (6000 G)', need: 1, prog: (c) => (c.story.tolls && c.story.tolls.abyss ? 1 : 0), coins: 6000, exp: 250,
      lines: ['다리지기: "이 다리 너머에는 돌아오지 못한 사람도 많소. 조심하시오."', '왕: "심연 동굴 깊은 곳에서 시크너와 같은 기운이 느껴진다고 하네."'] },
    { title: '심연의 보상', desc: '심연 동굴 보상을 3레벨까지 올리자', need: 3, prog: (c) => c.inv.abyssLevel || 1, coins: 7000, exp: 300,
      lines: ['왕: "심연의 보물까지 손에 넣다니…"', '왕: "그것들로 왕국의 성벽을 고칠 수 있겠어. 고맙네."'] },
    { title: '어둠의 탑 50층', desc: '어둠의 탑을 50층까지 오르자', need: 50, prog: (c) => c.darkBest, coins: 9000, exp: 400,
      lines: ['왕: "50층… 정의의 어둠돌조차 쓰러뜨렸다는 소문이 사실이었군."', '왕: "저 위, 66층에 더 큰 어둠이 기다리고 있다고 하네. 아직 끝이 아니야."'] },
    { title: '검을 벼리다', desc: '낀 무기를 10레벨까지 강화하자', need: 10, prog: wlv, coins: 10000, exp: 500,
      lines: ['대장장이: "이 정도로 벼린 무기는 처음이오. 그 칼이 울고 있소!"', '왕: "이제 최후의 부탁을 할 때가 왔군."'] },
    { title: '정의의 어둠을 넘어', desc: '어둠의 탑을 66층까지 오르자', need: 66, prog: (c) => c.darkBest, coins: 20000, exp: 1000, last: true,
      lines: ['왕: "…해냈구나. 66층의 정의의 어둠마저…"', '왕: "시크너에서 시작된 어둠이 이제 정말로 물러가고 있네. 왕국의 하늘이 맑아졌어."', '왕: "용사여, 자네는 왕국의 영웅일세. 챕터 3 — 왕국의 번영 — 이 끝났네!"', '왕: "하지만 탑은 아직 100층까지 이어져 있지. 자네의 모험은 계속되네."'] },
  ];

  G.Quest = { TOLLS, GOALS, current: (c) => GOALS[c.story.q || 0] || null };
})(window.Game);
