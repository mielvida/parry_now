// 마을 동굴 생성기: 들어갈 때마다 구조가 랜덤으로 새로 만들어지고, 탐험 횟수(run)가 늘수록 길어진다.
// 항상 깰 수 있도록 조각마다 규칙을 지킨다:
//   - 구덩이는 폭 2~3칸 (또는 폭 4칸 + 가운데 공중 발판), 앞뒤에 3칸 이상의 평지
//   - 계단/둔덕은 한 번에 1칸씩만 오르내림
//   - 끝에는 계단 + 보물 상자가 있는 높은 발판
// 레벨 데이터 형식은 levels.js와 같다. 'X' = 출구, 'P' = 시작점, 'S' = 슬라임, 'B' = 박쥐, 'T' = 보물 상자
(function (G) {
  const ROWS = 18;
  const BASE_TOP = 16; // 바닥 윗면 행
  const DEFAULT_MIN_TOP = 10; // 가장 높은 땅 윗면 행 (이보다 높이 올라가지 않는다)

  // run번째 탐험의 목표 길이(열). 매번 24칸씩 길어지고 400칸에서 멈춘다
  const lengthFor = (run) => Math.min(400, 80 + 24 * run);

  // opts(없으면 마을 동굴 기본값): length 목표 길이, weights 조각 비율 {flat,bump,up,down,pit,wide},
  //   slimes/bats/crabs 몬스터 수, floatChance 평지 위에 공중 발판을 얹을 확률(0~1), minTop 가장 높은 땅 행
  function generate(run, rnd = Math.random, opts = {}) {
    const target = opts.length || lengthFor(run);
    const MIN_TOP = opts.minTop || DEFAULT_MIN_TOP;
    const wt = Object.assign({ flat: 0.28, bump: 0.18, up: 0.16, down: 0.12, pit: 0.16, wide: 0.10 }, opts.weights || {});
    const total = wt.flat + wt.bump + wt.up + wt.down + wt.pit + wt.wide;
    const cum = [wt.flat, wt.flat + wt.bump, wt.flat + wt.bump + wt.up, wt.flat + wt.bump + wt.up + wt.down, wt.flat + wt.bump + wt.up + wt.down + wt.pit];
    const pick = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const top = [];      // 열마다 땅 윗면 행 (null = 구덩이)
    const floats = [];   // 공중 발판 {c, r} (2칸 폭)
    const push = (n, v) => { for (let i = 0; i < n; i++) top.push(v); };
    let cur = BASE_TOP;

    push(8, cur); // 시작 평지 (출구 + 시작점)
    while (top.length < target - 14) {
      const roll = rnd() * total;
      if (roll < cum[0]) {
        push(pick(3, 7), cur);                        // 평지
      } else if (roll < cum[1]) {
        if (cur - 1 >= MIN_TOP) push(pick(2, 4), cur - 1); // 1칸 높은 둔덕 (다음 조각에서 원래 높이로 내려온다)
        push(pick(2, 3), cur);
      } else if (roll < cum[2]) {
        const steps = pick(1, 3);                     // 계단 오르기
        for (let i = 0; i < steps && cur - 1 >= MIN_TOP; i++) { cur -= 1; push(pick(2, 3), cur); }
        push(2, cur);
      } else if (roll < cum[3]) {
        const steps = pick(1, 3);                     // 계단 내려가기
        for (let i = 0; i < steps && cur + 1 <= BASE_TOP; i++) { cur += 1; push(pick(2, 3), cur); }
        push(2, cur);
      } else if (roll < cum[4]) {
        push(3, cur); push(pick(2, 3), null); push(3, cur); // 구덩이 (폭 2~3)
      } else {
        push(3, cur);                                 // 넓은 구덩이 (폭 4) + 가운데 공중 발판
        floats.push({ c: top.length + 1, r: cur - 2 });
        push(4, null);
        push(3, cur);
      }
    }
    // 끝: 평지 -> 계단 2단 -> 보물 상자가 있는 발판
    push(3, cur);
    for (let i = 0; i < 2 && cur - 1 >= MIN_TOP; i++) { cur -= 1; push(2, cur); }
    push(7, cur);

    const W = top.length;
    // 평평한 땅 위에 공중 발판(3칸 폭)을 얹는다: 땅에서 점프로 올라갈 수 있는 높이(땅 위 3칸)라 길을 막지 않는다
    if (opts.floatChance) {
      for (let c = 14; c < W - 24; c++) {
        const flatRun = top.slice(c, c + 6).every((v) => v !== null && v === top[c]);
        if (flatRun && top[c] - 3 >= 2 && rnd() < opts.floatChance / 8) {
          floats.push({ c: c + 1, r: top[c] - 3, w: 3 });
          c += 10;
        }
      }
    }
    const g = Array.from({ length: ROWS }, () => Array(W).fill('.'));
    for (let c = 0; c < W; c++) {
      if (top[c] === null) continue;
      for (let r = top[c]; r < ROWS; r++) g[r][c] = '#';
    }
    for (const f of floats) for (let k = 0; k < (f.w || 2); k++) g[f.r][f.c + k] = '#';

    g[BASE_TOP - 1][1] = 'X';
    g[BASE_TOP - 1][4] = 'P';
    g[top[W - 3] - 1][W - 3] = 'T';

    // 몬스터: 길이에 비례. 평평한 바닥에만 슬라임, 박쥐는 빈 공중에
    const flat = [];
    for (let c = 12; c < W - 16; c++) if (top[c] !== null && top[c - 1] === top[c] && top[c + 1] === top[c]) flat.push(c);
    const slimes = opts.slimes !== undefined ? opts.slimes : Math.floor((W - 28) / 14);
    const usedS = [];
    for (let tries = 0; usedS.length < slimes && tries < 400 && flat.length; tries++) {
      const c = flat[Math.floor(rnd() * flat.length)];
      if (usedS.every((u) => Math.abs(u - c) >= 5)) usedS.push(c);
    }
    for (const c of usedS) g[top[c] - 1][c] = 'S';
    const usedC = []; // 꽃게도 평평한 바닥에 (슬라임과 4칸 이상 떨어뜨려서)
    for (let tries = 0; usedC.length < (opts.crabs || 0) && tries < 600 && flat.length; tries++) {
      const c = flat[Math.floor(rnd() * flat.length)];
      if (usedC.every((u) => Math.abs(u - c) >= 6) && usedS.every((u) => Math.abs(u - c) >= 4) && g[top[c] - 1][c] === '.') usedC.push(c);
    }
    for (const c of usedC) g[top[c] - 1][c] = 'C';
    const bats = opts.bats !== undefined ? opts.bats : Math.floor((W - 28) / 32) + 1;
    const usedB = [];
    for (let tries = 0; usedB.length < bats && tries < 400; tries++) {
      const c = pick(20, W - 17);
      const r = pick(5, 9);
      if (g[r][c] === '.' && usedB.every((u) => Math.abs(u - c) >= 8)) {
        usedB.push(c);
        g[r][c] = 'B';
      }
    }
    return g.map((row) => row.join(''));
  }

  G.MineGen = { generate, lengthFor };
})(window.Game);
