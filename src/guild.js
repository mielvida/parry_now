// 챕터 2 왕국에서 할 거리 두 가지.
//  1) 모험가 길드 (현상금 게시판): 몬스터 처치, 해산물 수집, 보스 처치 현상금. 받을 때마다 다음 현상금은 더 커지고 보상도 늘어난다 (안 해도 되는 것)
//  2) 경험돈: 코인과 경험치를 함께 내서 경험돈을 만들고, 경험돈 1개마다 영구 대미지 +0.05. 가진 것을 한 번에 다 쓰는 메뉴도 있다 (왕국 보상 상점의 '경험돈' 탭)
(function (G) {
  const ITEMS = G.Shop.ITEMS;
  const SHOPS = G.Shop.SHOPS;

  // ---------- 모험가 길드 ----------
  // key: 처치 종류(inv.kills[key]) / 'sea' = 잡은 해산물 / 'boss' = 처치한 보스
  const BOUNTIES = [
    { id: 'slime', name: '슬라임 소탕', desc: '슬라임을 처치하자', kind: 'kill', key: 'slime', need: 30, coins: 800, exp: 20 },
    { id: 'bat', name: '박쥐 사냥', desc: '박쥐를 처치하자', kind: 'kill', key: 'bat', need: 20, coins: 900, exp: 25 },
    { id: 'crab', name: '꽃게 사냥', desc: '꽃게를 처치하자', kind: 'kill', key: 'crab', need: 15, coins: 800, exp: 20 },
    { id: 'golem', name: '골렘 부수기', desc: '골렘을 처치하자', kind: 'kill', key: 'golem', need: 12, coins: 1200, exp: 35 },
    { id: 'raider', name: '군단 병사 격퇴', desc: '군단 병사를 처치하자', kind: 'kill', key: 'raider', need: 20, coins: 2500, exp: 60 },
    { id: 'seafish', name: '바다의 공포', desc: '공격하는 바다 물고기를 처치하자', kind: 'kill', key: 'seafish', need: 15, coins: 2200, exp: 55 },
    { id: 'sea', name: '해산물 수집', desc: '해산물과 물고기를 더 잡자', kind: 'sea', need: 25, coins: 1500, exp: 40 },
    { id: 'boss', name: '보스 사냥꾼', desc: '보스를 쓰러뜨리자', kind: 'boss', need: 1, coins: 4000, exp: 120 },
  ];
  const stateOf = (inv, b) => { inv.bty = inv.bty || {}; return inv.bty[b.id] || (inv.bty[b.id] = { claimed: 0, base: 0 }); };
  const counter = (inv, b) => (b.kind === 'kill' ? (inv.kills && inv.kills[b.key]) || 0 : b.kind === 'sea' ? inv.caughtTotal || 0 : inv.bossTotal || 0);
  const view = (inv, b) => {
    const st = stateOf(inv, b);
    const need = Math.round(b.need * (1 + 0.5 * st.claimed));
    return { st, need, have: Math.max(0, counter(inv, b) - st.base), reward: Math.round(b.coins * (1 + 0.3 * st.claimed)), exp: Math.round(b.exp * (1 + 0.3 * st.claimed)) };
  };
  const guildItems = [];
  for (const b of BOUNTIES) {
    const id = 'bty_' + b.id;
    ITEMS[id] = {
      id, name: b.name, price: 0, look: ['#ffd54a', '#a8801a'], icon: ITEMS.sword0,
      onDescribe(item, inv) { const v = view(inv, b); return { name: `${b.name}  (${v.st.claimed}회 완료)`, desc: `${b.desc}: ${Math.min(v.have, v.need)} / ${v.need}`, slotName: '현상금', note: `보상 ${v.reward} G + 경험치 ${v.exp} · 받을 때마다 다음 목표와 보상이 커져요` }; },
      priceLabel(inv) { const v = view(inv, b); return v.have >= v.need ? '보상 받기!' : `${v.have} / ${v.need}`; },
      canBuy(inv) { const v = view(inv, b); return v.have >= v.need; },
      onBuy(item, wallet) {
        const v = view(wallet.inv, b);
        if (v.have < v.need) return { ok: false, msg: `아직이에요. (${v.have} / ${v.need})` };
        v.st.claimed += 1; v.st.base = counter(wallet.inv, b);
        wallet.coins += v.reward; wallet.exp = (wallet.exp || 0) + v.exp;
        return { ok: true, msg: `현상금 완료! +${v.reward} G · 경험치 +${v.exp}` };
      },
    };
    guildItems.push(ITEMS[id]);
  }
  SHOPS.guild = { title: '모험가 길드 (현상금 게시판)', tabs: [{ name: '현상금', items: guildItems }] };

  // ---------- 경험돈 ----------
  const XM_COIN = 200, XM_EXP = 20; // 경험돈 1개 = 코인 200 + 경험치 20
  const DMG_PER = 0.05;
  const xmOf = (inv) => inv.xm || 0;
  const note = (inv) => `보유 경험돈 ${xmOf(inv)}개 · 지금까지 ${inv.xmUsed || 0}개 사용 → 영구 대미지 +${((inv.xmUsed || 0) * DMG_PER).toFixed(2)}`;
  const maxMake = (w) => Math.min(Math.floor(w.coins / XM_COIN), Math.floor((w.exp || 0) / XM_EXP));
  const make = (w, n) => { w.coins -= n * XM_COIN; w.exp -= n * XM_EXP; w.inv.xm = xmOf(w.inv) + n; };
  const spend = (w, n) => { w.inv.xm = xmOf(w.inv) - n; w.inv.xmUsed = (w.inv.xmUsed || 0) + n; };
  const defs = [
    { id: 'xm_make1', name: '경험돈 1개 만들기', desc: `코인 ${XM_COIN} + 경험치 ${XM_EXP}를 합쳐 경험돈 1개로`, label: () => `${XM_COIN} G + ${XM_EXP} EXP`, can: (inv, c, e) => c >= XM_COIN && e >= XM_EXP,
      run: (w) => { if (maxMake(w) < 1) return { ok: false, msg: '코인이나 경험치가 모자라요.' }; make(w, 1); return { ok: true, msg: `경험돈 1개를 만들었다! (보유 ${xmOf(w.inv)}개)` }; } },
    { id: 'xm_make10', name: '경험돈 10개 만들기', desc: '코인 2000 + 경험치 200으로 경험돈 10개', label: () => `${XM_COIN * 10} G + ${XM_EXP * 10} EXP`, can: (inv, c, e) => c >= XM_COIN * 10 && e >= XM_EXP * 10,
      run: (w) => { if (maxMake(w) < 10) return { ok: false, msg: '코인이나 경험치가 모자라요.' }; make(w, 10); return { ok: true, msg: `경험돈 10개를 만들었다! (보유 ${xmOf(w.inv)}개)` }; } },
    { id: 'xm_makeall', name: '경험돈 가진 만큼 다 만들기', desc: '가진 코인과 경험치로 만들 수 있는 만큼 한 번에', label: (inv, c, e) => `${Math.min(Math.floor(c / XM_COIN), Math.floor(e / XM_EXP))}개 만들기`, can: (inv, c, e) => c >= XM_COIN && e >= XM_EXP,
      run: (w) => { const n = maxMake(w); if (n < 1) return { ok: false, msg: '코인이나 경험치가 모자라요.' }; make(w, n); return { ok: true, msg: `경험돈 ${n}개를 한 번에 만들었다! (보유 ${xmOf(w.inv)}개)` }; } },
    { id: 'xm_spend1', name: '경험돈 1개 쓰기', desc: `경험돈 1개 = 영구 대미지 +${DMG_PER}`, label: () => '경험돈 1개', can: (inv) => xmOf(inv) >= 1,
      run: (w) => { if (xmOf(w.inv) < 1) return { ok: false, msg: '경험돈이 없어요.' }; spend(w, 1); return { ok: true, msg: `대미지 +${DMG_PER}! (영구 +${(w.inv.xmUsed * DMG_PER).toFixed(2)})` }; } },
    { id: 'xm_spendall', name: '경험돈 한 번에 다 쓰기', desc: '가진 경험돈을 모두 대미지로 바꾼다', label: (inv) => `${xmOf(inv)}개 모두`, can: (inv) => xmOf(inv) >= 1,
      run: (w) => { const n = xmOf(w.inv); if (n < 1) return { ok: false, msg: '경험돈이 없어요.' }; spend(w, n); return { ok: true, msg: `경험돈 ${n}개를 모두 썼다! 대미지 +${(n * DMG_PER).toFixed(2)} (영구 +${(w.inv.xmUsed * DMG_PER).toFixed(2)})` }; } },
    { id: 'xm_allin', name: '전부 만들고 전부 쓰기', desc: '가진 코인·경험치를 모두 경험돈으로 바꿔 한 번에 대미지로', label: (inv, c, e) => `${Math.min(Math.floor(c / XM_COIN), Math.floor(e / XM_EXP)) + xmOf(inv)}개 → 대미지`, can: (inv, c, e) => (c >= XM_COIN && e >= XM_EXP) || xmOf(inv) >= 1,
      run: (w) => { const m = maxMake(w); if (m > 0) make(w, m); const n = xmOf(w.inv); if (n < 1) return { ok: false, msg: '만들 것도 쓸 것도 없어요.' }; spend(w, n); return { ok: true, msg: `경험돈 ${n}개를 만들어 모두 썼다! 대미지 +${(n * DMG_PER).toFixed(2)} (영구 +${(w.inv.xmUsed * DMG_PER).toFixed(2)})` }; } },
  ];
  const xmItems = [];
  for (const d of defs) {
    ITEMS[d.id] = {
      id: d.id, name: d.name, price: 0, look: ['#ffd54a', '#5aa0ff'], xm: true,
      onDescribe(item, inv) { return { name: d.name, desc: d.desc, slotName: '경험돈', note: note(inv) }; },
      priceLabel(inv, coins, exp) { return d.label(inv, coins || 0, exp || 0); },
      canBuy(inv, coins, exp) { return d.can(inv, coins, exp); },
      onBuy(item, wallet) { return d.run(wallet); },
    };
    xmItems.push(ITEMS[d.id]);
  }
  SHOPS.mine.tabs.push({ name: '경험돈', items: xmItems });

  G.Guild = { BOUNTIES, DMG_PER, XM_COIN, XM_EXP };
})(window.Game);
