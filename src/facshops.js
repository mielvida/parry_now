// 방사능 공장 휴게 구역의 가게 9곳. 여태까지 없던 가게들: 영구 업그레이드, 경험치 시술, 충전, 폐기물 분류, 급식 자판기, 개조 대장간, 룰렛, 야전 보급소.
//   1 방호복 상점 (피 칸, 피격 후 무적, 패링 여유)       2 병기 연구소 (대미지, 딴딴함 깎기, 공격 속도)
//   3 돌연변이 클리닉 (경험치로 피 칸, 이동 속도, 치명타)  4 충전소 (스태미나 최대/회복, 전지)
//   5 폐기물 분류소 (주괴 상자, 크리스탈, 어둠 조각)       6 급식 자판기 (한동안 능력이 오르는 음식)
//   7 개조 대장간 (무기/갑옷 정밀 강화, 전신 훈련)         8 방사능 룰렛 (운에 맡긴다)       9 야전 보급소 (회복 키트)
// 영구 능력은 inv.facUp에 쌓이고 (shop.js의 stats가 읽는다), 레벨은 inv.facLv에 남는다. 둘 다 저장 데이터에 같이 들어간다.
(function (G) {
  const C = G.Config;
  const ITEMS = G.Shop.ITEMS;
  const FU = (inv) => (inv.facUp = inv.facUp || {});
  const FL = (inv) => (inv.facLv = inv.facLv || {});
  const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // 레벨이 있는 영구 업그레이드 항목 (레벨마다 값이 오르고 점점 비싸진다)
  function upgrade(d) {
    const lvOf = (inv) => FL(inv)[d.id] || 0;
    const costOf = (inv) => Math.max(10, Math.round(d.base * Math.pow(d.grow, lvOf(inv)) / 10) * 10);
    const unit = d.exp ? 'EXP' : 'G';
    const item = {
      id: d.id, name: d.name, price: 0, quest: true, look: d.look, icon: d.icon,
      onDescribe(it, inv) {
        const lv = lvOf(inv);
        return { name: `${d.name}  Lv ${lv}/${d.max}`, desc: lv >= d.max ? `최고 레벨! ${d.fmt(lv)}` : `${d.fmt(lv)} -> ${d.fmt(lv + 1)}`, slotName: d.slot || '영구 업그레이드', note: d.note || `영구 효과 · 레벨이 오를수록 비싸진다${d.exp ? ' (경험치로 낸다)' : ''}` };
      },
      priceLabel(inv) { return lvOf(inv) >= d.max ? '최고 레벨' : `${costOf(inv)} ${unit}`; },
      canBuy(inv, coins, exp) { return lvOf(inv) < d.max && (d.exp ? exp : coins) >= costOf(inv); },
      onBuy(it, w) {
        const inv = w.inv;
        if (lvOf(inv) >= d.max) return { ok: false, msg: '이미 최고 레벨이에요.' };
        const cost = costOf(inv);
        if (d.exp) { if ((w.exp || 0) < cost) return { ok: false, msg: '경험치가 부족해요.' }; w.exp -= cost; }
        else { if (w.coins < cost) return { ok: false, msg: '코인이 부족해요.' }; w.coins -= cost; }
        FU(inv)[d.key] = (FU(inv)[d.key] || 0) + d.per;
        FL(inv)[d.id] = lvOf(inv) + 1;
        if (d.key === 'hearts') { w.maxLives = G.Shop.maxLivesFor(inv, C.PLAYER_LIVES); w.lives = Math.min(w.maxLives, w.lives + d.per); }
        return { ok: true, msg: `${d.name} Lv ${lvOf(inv)}! ${d.fmt(lvOf(inv))}` };
      },
    };
    ITEMS[d.id] = item;
    return item;
  }

  // 코인으로 사서 가방에 쌓아 두는 소모품 (피, 스태미나, 파란 피, 한동안 오르는 능력)
  function consumable(d) {
    ITEMS[d.id] = { id: d.id, icon: d.icon, name: d.name, price: d.price, consumable: true, food: d.food, stamina: d.stamina, blue: d.blue, buffs: d.buffs, look: d.look, desc: d.desc };
    G.Shop.CONSUMABLE_IDS.push(d.id);
    return ITEMS[d.id];
  }

  // 한 번 눌러서 바로 실행되는 서비스/상자 항목 (가격 고정이거나 계산식)
  function service(d) {
    ITEMS[d.id] = {
      id: d.id, name: d.name, price: 0, quest: true, look: d.look, icon: d.icon,
      onDescribe(it, inv) { return { name: d.name, desc: d.desc, slotName: d.slot || '서비스', note: d.note ? d.note(inv) : '' }; },
      priceLabel(inv) { return `${d.cost(inv)} ${d.exp ? 'EXP' : 'G'}`; },
      canBuy(inv, coins, exp) { return (d.exp ? exp : coins) >= d.cost(inv) && (!d.can || d.can(inv)); },
      onBuy(it, w) {
        const inv = w.inv, cost = d.cost(inv);
        if (d.can && !d.can(inv)) return { ok: false, msg: d.cant || '지금은 할 수 없어요.' };
        if (d.exp) { if ((w.exp || 0) < cost) return { ok: false, msg: '경험치가 부족해요.' }; w.exp -= cost; }
        else { if (w.coins < cost) return { ok: false, msg: '코인이 부족해요.' }; w.coins -= cost; }
        return d.run(w, inv);
      },
    };
    return ITEMS[d.id];
  }

  const ingotPool = (min, max) => G.Forge.ORES.filter((o) => o.tier >= min && o.tier <= max && !o.kingdom);
  function giveIngots(inv, n, min, max) {
    const pool = ingotPool(min, max), got = {};
    for (let i = 0; i < n; i++) { const o = pool[Math.floor(Math.random() * pool.length)]; inv.ingots[o.id] = (inv.ingots[o.id] || 0) + 1; got[o.name] = (got[o.name] || 0) + 1; }
    G.Forge.markDirty();
    return Object.keys(got).map((k) => `${k} ${got[k]}`).join(', ');
  }

  // ---- 1. 방호복 상점 ----
  const hazmat = [
    upgrade({ id: 'hz_heart', icon: 'suit', name: '방호복 증설', key: 'hearts', per: 1, max: 5, base: 6000, grow: 1.7, fmt: (lv) => `최대 피 +${lv}칸`, look: ['#ffd54a', '#a8761a'] }),
    upgrade({ id: 'hz_inv', icon: 'lead', name: '납 안감', key: 'invuln', per: 0.08, max: 8, base: 3000, grow: 1.45, fmt: (lv) => `피격 후 무적 +${(lv * 0.08).toFixed(2)}초`, look: ['#c8cdd6', '#5a6070'] }),
    upgrade({ id: 'hz_filter', icon: 'filter', name: '정화 필터', key: 'window', per: 0.01, max: 6, base: 4000, grow: 1.5, fmt: (lv) => `패링 여유 +${lv * 0.01}초`, look: ['#9cff7a', '#2a8a2a'] }),
  ];
  // ---- 2. 병기 연구소 ----
  const weaponlab = [
    upgrade({ id: 'hz_dmg', icon: 'core', name: '폭주 코어', key: 'dmg', per: 0.7, max: 10, base: 5000, grow: 1.5, fmt: (lv) => `대미지 +${(lv * 0.7).toFixed(1)}`, look: ['#ff7a5a', '#7a1a0a'] }),
    upgrade({ id: 'hz_hit', icon: 'vial', name: '균열 촉매', key: 'hit', per: 1, max: 5, base: 8000, grow: 1.8, fmt: (lv) => `딴딴함을 한 번에 +${lv} 더 깎는다`, look: ['#d8a0ff', '#4a1a7a'] }),
    upgrade({ id: 'hz_pspd', icon: 'speedshot', name: '탄속 가속기', key: 'pspeed', per: 0.12, max: 8, base: 6000, grow: 1.55, fmt: (lv) => `발사체(총·활·마법·발사기) 속도 +${lv * 12}%`, look: ['#9ae8ff', '#1a6a8a'], note: '발사체가 빨라지는 건 병기 연구소에서만! 영구 효과' }),
    upgrade({ id: 'hz_cd', icon: 'gear', name: '가속 기관', key: 'cd', per: -0.012, max: 6, base: 7000, grow: 1.55, fmt: (lv) => `공격 간격 -${(lv * 0.012).toFixed(3)}초`, look: ['#ffee70', '#a88a10'] }),
  ];
  // ---- 3. 돌연변이 클리닉 (경험치) ----
  const clinic = [
    upgrade({ id: 'mu_heart', icon: 'syringe', name: '돌연변이 주사', key: 'hearts', per: 1, max: 3, base: 1500, grow: 2.2, exp: true, fmt: (lv) => `최대 피 +${lv}칸`, look: ['#ff8aa0', '#8a1a3a'] }),
    upgrade({ id: 'mu_speed', icon: 'neuro', name: '신경 강화', key: 'speed', per: 0.03, max: 6, base: 600, grow: 1.6, exp: true, fmt: (lv) => `이동 속도 +${Math.round(lv * 3)}%`, look: ['#9ae8ff', '#1a6a8a'] }),
    upgrade({ id: 'mu_crit', icon: 'fang', name: '치명 각성', key: 'critDmg', per: 1, max: 5, base: 900, grow: 1.7, exp: true, fmt: (lv) => `치명타 대미지 +${lv}`, look: ['#ffd070', '#8a4a10'] }),
  ];
  consumable({ id: 'mu_regen', icon: 'ampoule', name: '재생 앰풀', price: 800, buffs: [{ kind: 'regen', val: 1, dur: 180, n: 0 }], look: ['#ff8aa0', '#a8305a'], desc: '3분 동안 5초마다 피 ½칸이 차오른다' });
  // ---- 4. 충전소 ----
  const charge = [
    upgrade({ id: 'ch_bat', icon: 'battery', name: '고용량 배터리', key: 'st', per: 12, max: 10, base: 3500, grow: 1.4, fmt: (lv) => `스태미나 최대 +${lv * 12}`, look: ['#7dffd0', '#1a8a6a'] }),
    upgrade({ id: 'ch_rec', icon: 'plug', name: '고속 충전기', key: 'regen', per: 0.5, max: 8, base: 3500, grow: 1.45, fmt: (lv) => `스태미나 회복 +${(lv * 0.5).toFixed(1)}/초`, look: ['#a0ff90', '#2a8a1a'] }),
  ];
  consumable({ id: 'ch_cell', icon: 'cell', name: '비상 전지', price: 400, stamina: 150, look: ['#7dffd0', '#2fa88a'], desc: '스태미나 150 회복' });
  consumable({ id: 'ch_full', icon: 'fullcell', name: '완충 전지', price: 1000, stamina: 400, look: ['#d0ffa0', '#4aa82a'], desc: '스태미나 400 회복' });
  // ---- 5. 폐기물 분류소 ----
  const recycle = [
    service({ id: 'rc_box', icon: 'crate', name: '폐광석 상자', desc: '버려진 광석을 녹인 주괴 3개 (3~4단계, 무작위)', cost: () => 3000, look: ['#8a93a8', '#3a4252'], note: () => '어떤 주괴가 나올지는 열어 봐야 안다', run: (w, inv) => ({ ok: true, msg: `주괴를 얻었다: ${giveIngots(inv, 3, 3, 4)}` }) }),
    service({ id: 'rc_crystal', icon: 'cbottle', name: '정화 크리스탈', desc: '방사능을 씻어 낸 맑은 크리스탈 1개', cost: () => 12000, look: ['#c8f0ff', '#5aa0d0'], note: (inv) => `보유 ${inv.materials.cleancrystal || 0}개`, run: (w, inv) => { G.Shop.addMaterial(inv, 'cleancrystal'); return { ok: true, msg: `정화 크리스탈 1개 획득! (보유 ${inv.materials.cleancrystal}개)` }; } }),
    service({ id: 'rc_shard', icon: 'pouch', name: '어둠 조각 꾸러미', desc: '어둠의 크리스탈 조각 3개', cost: () => 2500, look: ['#c070ff', '#3a1a5a'], note: (inv) => `보유 ${inv.materials.darkshard || 0}개`, run: (w, inv) => { for (let i = 0; i < 3; i++) G.Shop.addMaterial(inv, 'darkshard'); return { ok: true, msg: `어둠 조각 3개 획득! (보유 ${inv.materials.darkshard}개)` }; } }),
    service({ id: 'rc_rare', icon: 'bars', name: '희귀 주괴 상자', desc: '4단계 주괴 2개 (가장 좋은 광석)', cost: () => 15000, look: ['#ffe9a0', '#b8861a'], note: () => '비싸지만 4단계만 나온다', run: (w, inv) => ({ ok: true, msg: `주괴를 얻었다: ${giveIngots(inv, 2, 4, 4)}` }) }),
  ];
  // ---- 6. 급식 자판기 (한동안 능력이 오른다) ----
  const vending = [
    consumable({ id: 'vd_power', icon: 'bar', name: '활력 바', price: 700, buffs: [{ kind: 'power', val: 8, dur: 180, n: 0 }], look: ['#ff7a5a', '#8a2a1a'], desc: '3분 동안 공격력 +8' }),
    consumable({ id: 'vd_speed', icon: 'drink', name: '쾌속 드링크', price: 600, buffs: [{ kind: 'speed', val: 0.25, dur: 180, n: 0 }], look: ['#9ae8ff', '#1a6a8a'], desc: '3분 동안 달리기 속도 +25%' }),
    consumable({ id: 'vd_shield', icon: 'jelly', name: '철벽 젤리', price: 900, buffs: [{ kind: 'shield', val: 1, dur: 240, n: 4 }], look: ['#b0c0ff', '#3a4a9a'], desc: '4분 안에 4번 막아 주는 보호막' }),
    consumable({ id: 'vd_coin', icon: 'candy', name: '황금 캔디', price: 1200, buffs: [{ kind: 'coin', val: 0.5, dur: 240, n: 0 }], look: ['#ffd54a', '#a8761a'], desc: '4분 동안 코인 획득 +50%' }),
    consumable({ id: 'vd_crit', icon: 'capsule', name: '집중 캡슐', price: 1000, buffs: [{ kind: 'crit', val: 0.2, dur: 180, n: 0 }], look: ['#ff9ac8', '#8a2a5a'], desc: '3분 동안 치명타 확률 +20%' }),
  ];
  // ---- 7. 개조 대장간 ----
  const smith = [
    service({ id: 'sm_wup', icon: 'hammer', name: '무기 정밀 강화', desc: '지금 든 무기를 +1 강화한다 (범위·대미지)', cost: (inv) => 5000 + 1500 * ((inv.wlevel && inv.wlevel[inv.equipped.weapon]) || 0), look: ['#ffb070', '#8a4a1a'], note: (inv) => `지금 +${(inv.wlevel && inv.wlevel[inv.equipped.weapon]) || 0}`, run: (w, inv) => { inv.wlevel = inv.wlevel || {}; inv.wlevel[inv.equipped.weapon] = (inv.wlevel[inv.equipped.weapon] || 0) + 1; return { ok: true, msg: `무기 강화 +${inv.wlevel[inv.equipped.weapon]}!`, refresh: true }; } }),
    service({ id: 'sm_aup', icon: 'plate', name: '갑옷 정밀 강화', desc: '입은 갑옷을 +1 강화한다 (최대 피 +1칸)', cost: (inv) => 9000 + 4000 * (inv.armorLevel || 0), look: ['#c0c8d8', '#4a5468'], note: (inv) => `지금 +${inv.armorLevel || 0}`, run: (w, inv) => { inv.armorLevel = (inv.armorLevel || 0) + 1; w.maxLives = G.Shop.maxLivesFor(inv, C.PLAYER_LIVES); w.lives = Math.min(w.maxLives, w.lives + 1); return { ok: true, msg: `갑옷 강화 +${inv.armorLevel}! 최대 피 +1칸`, refresh: true }; } }),
    service({ id: 'sm_trn', icon: 'dumbbell', name: '전신 훈련', desc: '근력·집중·민첩·인내 훈련을 모두 +1', cost: (inv) => 10000 * (1 + Math.floor(['str', 'foc', 'agi', 'end'].reduce((a, k) => a + ((inv.train || {})[k] || 0), 0) / 4)), look: ['#ff8a5a', '#a8301a'], note: (inv) => `지금 합계 ${['str', 'foc', 'agi', 'end'].reduce((a, k) => a + ((inv.train || {})[k] || 0), 0)}`, run: (w, inv) => { inv.train = inv.train || {}; for (const k of ['str', 'foc', 'agi', 'end']) inv.train[k] = (inv.train[k] || 0) + 1; return { ok: true, msg: '네 가지 훈련이 모두 +1!', refresh: true }; } }),
  ];
  // ---- 8. 방사능 룰렛 ----
  function roulette(id, name, price, table, look) {
    return service({
      id, icon: ({ gb_small: 'wheel1', gb_mid: 'wheel2', gb_big: 'wheel3' })[id], name, desc: table.map((t) => `${t.p}% ${t.label}`).join(' / '), cost: () => price, look, slot: '도박', note: () => '결과는 운에 달렸다. 잃을 수도 있다!',
      run(w, inv) {
        let r = Math.random() * 100, hit = table[table.length - 1];
        for (const t of table) { if (r < t.p) { hit = t; break; } r -= t.p; }
        const msg = hit.run(w, inv);
        return { ok: true, msg: `룰렛: ${msg}` };
      },
    });
  }
  const gambling = [
    roulette('gb_small', '소형 룰렛 (500 G)', 500, [
      { p: 45, label: '꽝', run: () => '꽝! 아무것도 없다.' },
      { p: 30, label: '750 G', run: (w) => { w.coins += 750; return '+750 G'; } },
      { p: 15, label: '2000 G', run: (w) => { w.coins += 2000; return '+2000 G!'; } },
      { p: 7, label: '주괴 2개', run: (w, inv) => `주괴: ${giveIngots(inv, 2, 2, 3)}` },
      { p: 3, label: '1000 EXP', run: (w) => { w.exp = (w.exp || 0) + 1000; return '+1000 EXP!!'; } },
    ], ['#7aff7a', '#1a6a1a']),
    roulette('gb_mid', '중형 룰렛 (5000 G)', 5000, [
      { p: 40, label: '꽝', run: () => '꽝! 아무것도 없다.' },
      { p: 30, label: '7500 G', run: (w) => { w.coins += 7500; return '+7500 G'; } },
      { p: 15, label: '20000 G', run: (w) => { w.coins += 20000; return '+20000 G!'; } },
      { p: 10, label: '주괴 3개', run: (w, inv) => `주괴: ${giveIngots(inv, 3, 3, 4)}` },
      { p: 5, label: '8000 EXP', run: (w) => { w.exp = (w.exp || 0) + 8000; return '+8000 EXP!!'; } },
    ], ['#ffe34a', '#8a6a10']),
    roulette('gb_big', '대형 룰렛 (50000 G)', 50000, [
      { p: 35, label: '꽝', run: () => '꽝! 아무것도 없다.' },
      { p: 30, label: '75000 G', run: (w) => { w.coins += 75000; return '+75000 G'; } },
      { p: 20, label: '200000 G', run: (w) => { w.coins += 200000; return '+200000 G!!'; } },
      { p: 10, label: '4단계 주괴 5개', run: (w, inv) => `주괴: ${giveIngots(inv, 5, 4, 4)}` },
      { p: 5, label: '잭팟 150000 G + 20000 EXP', run: (w) => { w.coins += 150000; w.exp = (w.exp || 0) + 20000; return '잭팟!!! +150000 G, +20000 EXP'; } },
    ], ['#ff5a5a', '#7a1a1a']),
  ];
  // ---- 9. 야전 보급소 ----
  const supply = [
    consumable({ id: 'sp_kit', icon: 'kit', name: '응급 키트', price: 500, food: 3, look: ['#ff6a7a', '#8a1a2a'], desc: '피 3칸 회복' }),
    consumable({ id: 'sp_ration', icon: 'ration', name: '전투 식량', price: 1200, food: 5, stamina: 80, look: ['#e8c070', '#8a5a1a'], desc: '피 5칸, 스태미나 80 회복' }),
    consumable({ id: 'sp_ampoule', icon: 'bigamp', name: '완전 회복 앰풀', price: 3500, food: 99, stamina: 300, look: ['#ffffff', '#c04a6a'], desc: '피를 가득 채우고 스태미나 300 회복' }),
    consumable({ id: 'sp_pad', icon: 'pad', name: '방호 패드', price: 2500, blue: 3, look: ['#8ac0ff', '#2a4a9a'], desc: '파란 피 3칸 (피가 가득이어도 쓸 수 있다)' }),
  ];

  const SHOP_DEFS = [
    { sub: 'fac_hazmat', label: '방호복 상점', title: '방호복 상점', tab: '방호복', items: hazmat, npc: 'hz_suit', color: '#e8c020', icon: 'suit' },
    { sub: 'fac_weaponlab', label: '병기 연구소', title: '병기 연구소', tab: '개조', items: weaponlab, npc: 'hz_lab', color: '#e0503a', icon: 'bolt' },
    { sub: 'fac_clinic', label: '돌연변이 클리닉', title: '돌연변이 클리닉 (EXP)', tab: '시술', items: clinic.concat([ITEMS.mu_regen]), npc: 'hz_doc', color: '#e05a8a', icon: 'syringe' },
    { sub: 'fac_charge', label: '충전소', title: '충전소', tab: '충전', items: charge.concat([ITEMS.ch_cell, ITEMS.ch_full]), npc: 'hz_eng', color: '#3acfa0', icon: 'battery' },
    { sub: 'fac_recycle', label: '폐기물 분류소', title: '폐기물 분류소', tab: '분류', items: recycle, npc: 'hz_junk', color: '#8a93a8', icon: 'crate' },
    { sub: 'fac_vending', label: '급식 자판기', title: '방사능 급식 자판기', tab: '음식', items: vending, npc: 'hz_cook', color: '#e0803a', icon: 'can' },
    { sub: 'fac_smith', label: '개조 대장간', title: '개조 대장간', tab: '정밀 강화', items: smith, npc: 'hz_smith', color: '#c07a3a', icon: 'anvil' },
    { sub: 'fac_roulette', label: '방사능 룰렛', title: '방사능 룰렛', tab: '룰렛', items: gambling, npc: 'hz_gamb', color: '#7a4ad0', icon: 'dice' },
    { sub: 'fac_supply', label: '야전 보급소', title: '야전 보급소', tab: '회복', items: supply, npc: 'hz_medic', color: '#d0d8e0', icon: 'kit' },
  ];
  for (const d of SHOP_DEFS) G.Shop.SHOPS[d.sub] = { title: d.title, tabs: [{ name: d.tab, items: d.items }] };

  G.FacShops = { SHOP_DEFS };
})(window.Game);
