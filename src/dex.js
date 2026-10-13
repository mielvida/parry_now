// 도감 (왕국의 도감관): 만난 몬스터와 보스, 잡은 물고기와 곤충을 모은다. 아직 못 만난 것은 까만 실루엣과 "???"만 보인다.
// 처음 만나면 도감에 기록(inv.seen)되고, 도감관에서 등록(inv.dex)할 때마다 200 G를 받는다.
(function (G) {
  const REWARD = 200;
  const MOBS = [
    { id: 'slime_green', name: '슬라임', desc: '통통 튀는 초록 슬라임. 패링하면 날아가 터진다.' },
    { id: 'slime_ice', name: '얼음 슬라임', desc: '설산의 슬라임. 얼지 않는다.' },
    { id: 'slime_lava', name: '용암 슬라임', desc: '화산의 슬라임. 불에 타지 않는다.' },
    { id: 'slime_dark', name: '어둠 슬라임', desc: '어둠의 탑에 사는 단단한 슬라임. 닿으면 아프다.' },
    { id: 'bat', name: '박쥐', desc: '동굴 천장을 날아다닌다. 한 방이면 떨어진다.' },
    { id: 'goldbat', name: '황금박쥐', desc: '반짝이는 가루를 흘리는 희귀한 박쥐. 다섯 대를 맞아야 쓰러진다.' },
    { id: 'crab', name: '꽃게', desc: '해변의 꽃게. 집게를 치켜들면 조심!' },
    { id: 'golem', name: '흙괴물', desc: '설산의 진흙과 바위 덩어리. 몸을 던진다.' },
    { id: 'subject_brute', name: '우람한 실험체', desc: '방사능 공장에서 만들어진 돌연변이. 일반 몬스터보다 20배 세다. 쫓아와서 뛰어올라 덮친다. 닿으면 목숨 4개.' },
    { id: 'subject_spitter', name: '마른 실험체', desc: '부푼 배에 방사능을 가득 채운 실험체. 거리를 두고 초록 덩어리를 뱉는다 (패링하면 되돌아간다). 20배 세다.' },
    { id: 'employee_sprayer', name: '분사기 직원', desc: '방호복을 입은 공장 직원. 방사능 액을 두 줄기로 뿜고, 가까이 가면 물러선다.' },
    { id: 'employee_guard', name: '경비 직원', desc: '곤봉을 든 공장 경비. 곧장 달려들어 덮친다. 아주 단단하다.' },
    { id: 'mimic', name: '방긋이', desc: '하수구에 사는 분홍빛 동글이. 처음엔 귀엽게 웃고 있지만, 가까이 다가가거나 때리면 갑자기 무섭고 징그러운 괴물로 변해 달려든다. 변하기 전에는 닿아도 안전하다.' },
    { id: 'worm', name: '하수구 지렁이', desc: '하수구 천장에서 가끔 떨어지는 징그러운 지렁이. 때리면 둘로 갈라지고, 또 때리면 한 번 더 갈라진다 (딱 2번까지). 아주 단단하다.' },
    { id: 'darkstone', name: '어둠돌', desc: '다크월드의 돌 몬스터. 단단하다.' },
    { id: 'shade', name: '그림자', desc: '어둠 속을 떠다니며 구슬을 쏜다.' },
    { id: 'raider_sword', name: '검병', desc: '왕국에 쳐들어오는 적군. 검을 치켜들었다 크게 벤다.' },
    { id: 'raider_spear', name: '창병', desc: '적군의 창병. 창을 길게 찌른다.' },
    { id: 'raider_shield', name: '방패병', desc: '적군의 방패병. 단단하고 방패로 부딪쳐 온다.' },
    { id: 'raider_archer', name: '궁수', desc: '적군의 궁수. 멀리서 화살을 쏜다 (패링하면 되돌아간다).' },
    { id: 'raider_rusher', name: '돌격병', desc: '적군의 돌격병. 한 방에 쓰러지지만 매우 빠르다.' },
    { id: 'raider_ogre', name: '오우거', desc: '적군의 거인. 크고 느리고 단단하다.' },
    { id: 'boss_king', name: '왕슬라임', desc: '[보스] 숲의 왕슬라임. 약점은 빛.' },
    { id: 'boss_dragon', name: '용머리', desc: '[보스] 화산의 용. 머리가 셋이다.' },
    { id: 'boss_ape', name: '털복숭이 침팬지', desc: '[보스] 설산의 침팬지. 약점은 불.' },
    { id: 'boss_stone', name: '정의의 어둠돌', desc: '[보스] 어둠의 탑 33층의 거대한 돌.' },
    { id: 'boss_justice', name: '정의의 어둠', desc: '[보스] 어둠의 탑 66층의 어둠의 기사.' },
    { id: 'boss_sikner', name: '시크너', desc: '[보스] 어둠의 탑 100층에서 기다리는 어둠의 기사.' },
    { id: 'boss_sealord', name: '해일의 군주', desc: '[보스] 바다 위 맨 오른쪽 끝 문 안의 방에 사는 거대한 심해 괴물. 약점은 얼음.' },
  ];
  const mobKey = (s) => (s.kind === 'subject' ? 'subject_' + s.variant : s.kind === 'employee' ? 'employee_' + s.variant : s.kind === 'slime' ? 'slime_' + (s.variant || 'green') : s.kind === 'bat' ? (s.golden ? 'goldbat' : 'bat') : s.kind === 'raider' ? 'raider_' + s.variant : s.kind);

  // 몬스터 그림 (원점이 가운데, 크기 약 ±22). sil = 까만 실루엣
  function drawMob(ctx, id, k, sil) {
    const c = (a) => (sil ? '#0a0a12' : a);
    ctx.save();
    ctx.scale(k, k);
    const eye = (x, y, r = 2.2) => { ctx.fillStyle = sil ? '#0a0a12' : '#1a1a2a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    const slime = (body, hi, crown) => {
      ctx.fillStyle = c(body); ctx.beginPath(); ctx.moveTo(-18, 14); ctx.quadraticCurveTo(-20, -16, 0, -16); ctx.quadraticCurveTo(20, -16, 18, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c(hi); ctx.beginPath(); ctx.ellipse(-7, -7, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      eye(-6, 0); eye(6, 0);
      if (crown) { ctx.fillStyle = c('#ffd54a'); ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(-6, -26); ctx.lineTo(0, -18); ctx.lineTo(6, -26); ctx.lineTo(10, -16); ctx.closePath(); ctx.fill(); }
    };
    const soldier = (body, acc, weapon) => {
      ctx.fillStyle = c('#2a2230'); ctx.fillRect(-7, 8, 6, 12); ctx.fillRect(1, 8, 6, 12);
      ctx.fillStyle = c(body); ctx.fillRect(-9, -8, 18, 18); ctx.fillStyle = c(acc); ctx.fillRect(-9, 4, 18, 3);
      ctx.fillStyle = c('#e8b98a'); ctx.fillRect(-6, -18, 12, 11); ctx.fillStyle = c(body); ctx.fillRect(-8, -21, 16, 6);
      ctx.fillStyle = c('#c9d2dc'); weapon(ctx);
    };
    switch (id) {
      case 'slime_green': slime('#5fcf5f', '#bfffbf'); break;
      case 'slime_ice': slime('#8fd8ff', '#ffffff'); break;
      case 'slime_lava': slime('#ff7a3a', '#ffd08a'); break;
      case 'slime_dark': slime('#6a3ab0', '#b08aff'); break;
      case 'boss_king': ctx.scale(1.1, 1.1); slime('#5fcf5f', '#bfffbf', true); break;
      case 'bat': case 'goldbat': {
        const col = id === 'bat' ? '#6a4a9a' : '#e8c030';
        ctx.fillStyle = c(col); ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-22, -12); ctx.lineTo(-16, 2); ctx.lineTo(-8, 0); ctx.lineTo(0, 8); ctx.lineTo(8, 0); ctx.lineTo(16, 2); ctx.lineTo(22, -12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c(id === 'bat' ? '#3a2a5a' : '#a08020'); ctx.beginPath(); ctx.ellipse(0, 2, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); eye(-2.5, 0, 1.5); eye(2.5, 0, 1.5); break;
      }
      case 'crab': {
        ctx.fillStyle = c('#e0503a'); ctx.beginPath(); ctx.ellipse(0, 4, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-18, -8, 6, 0, Math.PI * 2); ctx.arc(18, -8, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-16, -6, 4, 10); ctx.fillRect(12, -6, 4, 10);
        ctx.strokeStyle = c('#b0301a'); ctx.lineWidth = 2; for (const x of [-10, -4, 4, 10]) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x * 1.3, 20); ctx.stroke(); } eye(-5, -4); eye(5, -4); break;
      }
      case 'subject_brute': case 'subject_spitter': {
        ctx.fillStyle = c('#8aa56a'); ctx.beginPath(); ctx.ellipse(0, 4, id === 'subject_brute' ? 16 : 11, id === 'subject_brute' ? 13 : 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = c('#7dff5a'); ctx.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 5, -6); ctx.lineTo(k * 5 + 2, 12); ctx.stroke(); }
        ctx.fillStyle = c('#e8ffd0'); ctx.beginPath(); ctx.arc(-4, -2, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c('#20c020'); ctx.beginPath(); ctx.arc(-4, -2, 2, 0, Math.PI * 2); ctx.fill(); break;
      }
      case 'employee_sprayer': case 'employee_guard': {
        const sc = id === 'employee_guard' ? '#e0a21c' : '#e8d020';
        ctx.fillStyle = c(sc); ctx.fillRect(-9, -4, 18, 20); ctx.beginPath(); ctx.ellipse(0, -9, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c('#1c2024'); ctx.beginPath(); ctx.ellipse(2, -9, 6, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c('#7dff6a'); ctx.beginPath(); ctx.arc(0, -10, 2, 0, Math.PI * 2); ctx.arc(5, -10, 2, 0, Math.PI * 2); ctx.fill(); break;
      }
      case 'mimic': {
        ctx.fillStyle = c('#ffc4dd'); ctx.beginPath(); ctx.ellipse(0, 2, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c('#fff'); ctx.beginPath(); ctx.ellipse(-6, 0, 4.5, 6, 0, 0, Math.PI * 2); ctx.ellipse(6, 0, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill(); eye(-6, 1, 2.2); eye(6, 1, 2.2);
        ctx.strokeStyle = c('#6a2a3a'); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 7, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); break;
      }
      case 'worm': {
        for (let i = 0; i < 6; i++) { ctx.fillStyle = c(i % 2 ? '#d98a86' : '#c4706c'); ctx.beginPath(); ctx.ellipse(-15 + i * 6, 6 - Math.sin(i * 0.9) * 3, 6, 6 - i * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = c('#3a0a14'); ctx.fillRect(16, 3, 5, 4); eye(14, 0, 1.6); break;
      }
      case 'golem': {
        ctx.fillStyle = c('#8a6a4a'); ctx.fillRect(-14, -16, 28, 30); ctx.fillRect(-22, -8, 9, 20); ctx.fillRect(13, -8, 9, 20);
        ctx.fillStyle = c('#a8845a'); ctx.fillRect(-12, -14, 24, 8); eye(-5, -4, 2.5); eye(5, -4, 2.5); break;
      }
      case 'darkstone': {
        ctx.fillStyle = c('#4a4a5a'); ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(-18, -4); ctx.lineTo(-6, -18); ctx.lineTo(10, -16); ctx.lineTo(18, 0); ctx.lineTo(14, 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#c070ff'); ctx.fillRect(-9, -4, 5, 4); ctx.fillRect(3, -4, 5, 4); break;
      }
      case 'shade': {
        ctx.fillStyle = c('#4a3a6a'); ctx.beginPath(); ctx.moveTo(-14, 16); ctx.quadraticCurveTo(-18, -16, 0, -18); ctx.quadraticCurveTo(18, -16, 14, 16); ctx.lineTo(8, 10); ctx.lineTo(2, 16); ctx.lineTo(-4, 10); ctx.lineTo(-9, 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#ff6a8a'); ctx.fillRect(-8, -6, 5, 5); ctx.fillRect(3, -6, 5, 5); break;
      }
      case 'raider_sword': soldier('#7a3a3a', '#d4a017', (g) => { ctx.strokeStyle = sil ? '#0a0a12' : '#e8f1ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(24, -12); ctx.stroke(); }); break;
      case 'raider_spear': soldier('#4a5a82', '#c0273a', (g) => { ctx.strokeStyle = sil ? '#0a0a12' : '#7a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 18); ctx.lineTo(14, -24); ctx.stroke(); ctx.fillStyle = c('#dfe6ee'); ctx.beginPath(); ctx.moveTo(11, -22); ctx.lineTo(14, -30); ctx.lineTo(17, -22); ctx.fill(); }); break;
      case 'raider_shield': soldier('#6a707e', '#2a56b8', () => { ctx.fillStyle = c('#2a56b8'); ctx.fillRect(10, -6, 10, 22); ctx.fillStyle = c('#ffd54a'); ctx.fillRect(13, 2, 4, 6); }); break;
      case 'raider_archer': soldier('#3a6a3a', '#7a5a2a', () => { ctx.strokeStyle = sil ? '#0a0a12' : '#a07a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(16, 0, 13, -1.3, 1.3); ctx.stroke(); }); break;
      case 'raider_rusher': soldier('#8a3a3a', '#f2f2f2', () => { ctx.fillStyle = c('#dfe6ee'); ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(22, 0); ctx.lineTo(10, -2); ctx.fill(); }); break;
      case 'raider_ogre': ctx.scale(1.15, 1.15); soldier('#6a5a3a', '#4a3a22', () => { ctx.strokeStyle = sil ? '#0a0a12' : '#6a4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(18, -18); ctx.stroke(); ctx.fillStyle = c('#7a5a3a'); ctx.beginPath(); ctx.arc(18, -20, 6, 0, Math.PI * 2); ctx.fill(); }); break;
      case 'boss_dragon': {
        ctx.fillStyle = c('#c0391f'); ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(-16, -8); ctx.lineTo(0, -16); ctx.lineTo(18, -8); ctx.lineTo(24, 8); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#f4f1e8'); ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-10, -22); ctx.lineTo(-5, -10); ctx.fill(); ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(12, -24); ctx.lineTo(14, -8); ctx.fill();
        ctx.fillStyle = c('#ffd54a'); ctx.fillRect(-8, -4, 6, 4); ctx.fillRect(4, -4, 6, 4); break;
      }
      case 'boss_ape': {
        ctx.fillStyle = c('#c8d8e8'); ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(-18, -2, 6, 0, Math.PI * 2); ctx.arc(18, -2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c('#e8c8a8'); ctx.beginPath(); ctx.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2); ctx.fill(); eye(-6, -4, 2.5); eye(6, -4, 2.5); ctx.fillRect(-4, 8, 8, 2); break;
      }
      case 'boss_stone': {
        ctx.fillStyle = c('#3a3a4a'); ctx.beginPath(); ctx.moveTo(-20, 18); ctx.lineTo(-24, -4); ctx.lineTo(-8, -22); ctx.lineTo(12, -20); ctx.lineTo(24, -2); ctx.lineTo(20, 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#ff4a6a'); ctx.fillRect(-12, -6, 7, 5); ctx.fillRect(4, -6, 7, 5); break;
      }
      case 'boss_sealord': { // 해일의 군주: 심해 아귀
        ctx.fillStyle = c('#1a5a72'); ctx.beginPath(); ctx.ellipse(0, 4, 22, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c('#17606e'); ctx.beginPath(); ctx.moveTo(-18, 4); ctx.lineTo(-30, -6); ctx.lineTo(-30, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#2a0a10'); ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(22, -2); ctx.lineTo(22, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#f4f4ea'); for (let k = 0; k < 4; k++) { ctx.fillRect(7 + k * 4, 3 + k * 0.6, 2, 4); }
        ctx.fillStyle = c('#f4f0d0'); ctx.beginPath(); ctx.arc(2, -3, 4, 0, Math.PI * 2); ctx.fill(); eye(3, -3, 1.6);
        ctx.strokeStyle = c('#0e4150'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(4, -24, 14, -20); ctx.stroke();
        ctx.fillStyle = c('#fffbb0'); ctx.beginPath(); ctx.arc(14, -20, 3.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'boss_justice': case 'boss_sikner': {
        const col = id === 'boss_sikner' ? '#2a2038' : '#3a3a58';
        ctx.fillStyle = c(col); ctx.fillRect(-12, -2, 24, 22); ctx.fillRect(-9, -20, 18, 18); ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(-6, -30); ctx.lineTo(-2, -20); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -20); ctx.lineTo(6, -30); ctx.lineTo(2, -20); ctx.fill();
        ctx.fillStyle = c(id === 'boss_sikner' ? '#ff3a3a' : '#9fd8ff'); ctx.fillRect(-6, -12, 4, 3); ctx.fillRect(2, -12, 4, 3);
        ctx.strokeStyle = c('#c9d2dc'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, 18); ctx.lineTo(24, -16); ctx.stroke(); break;
      }
      default: ctx.fillStyle = c('#888'); ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 탭: 몬스터 / 물고기 / 곤충 (곤충에는 약재 벌레도 들어간다)
  function entries(tab) {
    if (tab === 0) return MOBS.map((m) => ({ id: m.id, name: m.name, desc: m.desc, kind: 'mob' }));
    const F = G.Fishing;
    const list = tab === 1 ? F.FISH : F.BUGS.concat(F.HERBS);
    return list.map((sp) => { const it = G.Shop.ITEMS[sp.id]; return { id: sp.id, name: sp.name, desc: it.desc, kind: sp.kind, sp, item: it }; });
  }
  const TABS = ['몬스터 · 보스', '물고기', '곤충 · 약재 벌레'];
  const isRegistered = (inv, id) => !!(inv.dex && inv.dex[id]);
  const isKnown = (inv, id) => isRegistered(inv, id) || !!(inv.seen && inv.seen[id]); // 만난 적이 있다 (실루엣이 아닌 모습)
  function discover(inv, id) { // 처음 만났으면 true (도감에 기록)
    inv.seen = inv.seen || {};
    if (isKnown(inv, id)) return false;
    inv.seen[id] = 1;
    return true;
  }
  const allIds = () => entries(0).concat(entries(1), entries(2)).map((e) => e.id);
  const pendingIds = (inv) => allIds().filter((id) => isKnown(inv, id) && !isRegistered(inv, id)); // 만났지만 아직 등록 안 한 것
  function registerAll(inv) { // 도감관에서 한꺼번에 등록: 등록한 개수
    inv.dex = inv.dex || {};
    const ids = pendingIds(inv);
    for (const id of ids) inv.dex[id] = 1;
    return ids.length;
  }
  const nameOf = (id) => { const e = entries(0).concat(entries(1), entries(2)).find((x) => x.id === id); return e ? e.name : id; };
  const total = () => MOBS.length + G.Fishing.FISH.length + G.Fishing.BUGS.length + G.Fishing.HERBS.length;

  const COLS = 10, CELL = 78;
  function geometry(W, H) {
    const px = 30, py = 14, pw = W - 60, ph = H - 28;
    const tabs = [0, 1, 2].map((i) => ({ x: px + 24 + i * 200, y: py + 56, w: 192, h: 32 }));
    const gx = px + (pw - COLS * CELL) / 2, gy = py + 100;
    return { px, py, pw, ph, tabs, fightBtn: { x: px + pw - 214, y: py + ph - 70, w: 178, h: 40 }, gx, gy, rows: 4, cell: (i) => ({ x: gx + (i % COLS) * CELL, y: gy + Math.floor(i / COLS) * CELL, w: CELL - 6, h: CELL - 6 }) };
  }
  G.Shop.SHOPS.dexhall = { title: '도감관', tabs: [] };
  const Dex = {
    MOBS, mobKey, entries, isKnown, isRegistered, discover, pendingIds, registerAll, nameOf, total, REWARD,
    open() { return { tab: 0, cur: 0, scroll: 0, closed: false, fresh: true }; },
    update(ui, input, dt, inv) {
      const fresh = ui.fresh; ui.fresh = false;
      const pressed = (...c) => c.some((k) => input.wasPressed(k));
      const list = entries(ui.tab);
      if (!fresh && pressed('Escape')) { ui.closed = true; return; }
      const sel = list[ui.cur];
      const canFight = !!(sel && sel.kind === 'mob' && isRegistered(ui.inv || inv, sel.id));
      if (canFight && !fresh && pressed('KeyF')) { ui.fight = sel.id; ui.closed = true; return; } // 등록한 몬스터·보스와 싸워 보기
      if (pressed('Tab', 'KeyE')) { ui.tab = (ui.tab + 1) % 3; ui.cur = 0; ui.scroll = 0; }
      if (pressed('KeyQ')) { ui.tab = (ui.tab + 2) % 3; ui.cur = 0; ui.scroll = 0; }
      if (pressed('ArrowRight', 'KeyD')) ui.cur = Math.min(list.length - 1, ui.cur + 1);
      if (pressed('ArrowLeft', 'KeyA')) ui.cur = Math.max(0, ui.cur - 1);
      if (pressed('ArrowDown', 'KeyS')) ui.cur = Math.min(list.length - 1, ui.cur + COLS);
      if (pressed('ArrowUp', 'KeyW')) ui.cur = Math.max(0, ui.cur - COLS);
      const row = Math.floor(ui.cur / COLS);
      if (row < ui.scroll) ui.scroll = row;
      if (row >= ui.scroll + 4) ui.scroll = row - 3;
      if (ui.wheel) { const maxS = Math.max(0, Math.ceil(list.length / COLS) - 4); ui.scroll = Math.max(0, Math.min(maxS, ui.scroll + (ui.wheel > 0 ? 1 : -1))); ui.wheel = 0; }
      if (ui.click) {
        const g = geometry(G.Config.VIEW_W, G.Config.VIEW_H);
        const fb = g.fightBtn;
        if (canFight && ui.click.x >= fb.x && ui.click.x < fb.x + fb.w && ui.click.y >= fb.y && ui.click.y < fb.y + fb.h) { ui.fight = sel.id; ui.closed = true; return; }
        const t = g.tabs.findIndex((r) => ui.click.x >= r.x && ui.click.x < r.x + r.w && ui.click.y >= r.y && ui.click.y < r.y + r.h);
        if (t >= 0) { ui.tab = t; ui.cur = 0; ui.scroll = 0; }
        for (let i = ui.scroll * COLS; i < Math.min(list.length, (ui.scroll + 4) * COLS); i++) {
          const c = g.cell(i - ui.scroll * COLS);
          if (ui.click.x >= c.x && ui.click.x < c.x + c.w && ui.click.y >= c.y && ui.click.y < c.y + c.h) ui.cur = i;
        }
        ui.click = null;
      }
    },
    mouse(ui, kind, p, extra) {
      if (kind === 'click') ui.click = p;
      else if (kind === 'wheel') ui.wheel = extra;
    },
    draw(ctx, W, H, ui) {
      const g = geometry(W, H);
      const inv = ui.inv;
      const list = entries(ui.tab);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#171b2b'; ctx.fillRect(g.px, g.py, g.pw, g.ph);
      ctx.lineWidth = 4; ctx.strokeStyle = '#6fd0ff'; ctx.strokeRect(g.px, g.py, g.pw, g.ph);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#9fe0ff'; ctx.fillText('도감', g.px + 24, g.py + 28);
      const got = Object.keys(inv.dex || {}).length;
      ctx.font = '14px sans-serif'; ctx.fillStyle = '#c8d0e8'; ctx.textAlign = 'right';
      ctx.fillText(`등록 ${got} / ${total()}   ·   하나 등록할 때마다 ${REWARD} G   ·   Tab/Q·E 분류   Esc 닫기`, g.px + g.pw - 24, g.py + 30);
      ctx.textAlign = 'center';
      g.tabs.forEach((r, i) => {
        const l = entries(i);
        const n = l.filter((e) => isKnown(inv, e.id)).length;
        const on = i === ui.tab;
        ctx.fillStyle = on ? 'rgba(111,208,255,0.28)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = on ? '#6fd0ff' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = on ? 2.5 : 1; ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = on ? '#e8f8ff' : '#9aa4c0'; ctx.fillText(`${TABS[i]} ${n}/${l.length}`, r.x + r.w / 2, r.y + r.h / 2);
      });
      for (let i = ui.scroll * COLS; i < Math.min(list.length, (ui.scroll + 4) * COLS); i++) {
        const e = list[i];
        const c = g.cell(i - ui.scroll * COLS);
        const known = isKnown(inv, e.id);
        const on = i === ui.cur;
        ctx.fillStyle = on ? 'rgba(111,208,255,0.2)' : known ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.35)'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = on ? '#6fd0ff' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = on ? 3 : 1; ctx.strokeRect(c.x, c.y, c.w, c.h);
        ctx.save(); ctx.translate(c.x + c.w / 2, c.y + c.h / 2 - 4);
        if (e.kind === 'mob') drawMob(ctx, e.id, 1.1, !known);
        else G.Fishing.drawCatchIcon(ctx, known ? e.item : Object.assign({}, e.item, { look: ['#0a0a12', '#0a0a12'] }), 1.5);
        ctx.restore();
        ctx.font = '11px sans-serif'; ctx.fillStyle = known ? '#e8ecff' : '#5a6078'; ctx.textAlign = 'center';
        ctx.fillText(known ? e.name : '???', c.x + c.w / 2, c.y + c.h - 7);
      }
      // 아래: 고른 항목의 설명
      const e = list[ui.cur];
      const dy = g.gy + 4 * CELL + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(g.px + 24, dy, g.pw - 48, g.py + g.ph - dy - 12);
      if (e) {
        const known = isKnown(inv, e.id);
        ctx.textAlign = 'left';
        ctx.save(); ctx.translate(g.px + 72, dy + 44); if (e.kind === 'mob') drawMob(ctx, e.id, 1.5, !known); else G.Fishing.drawCatchIcon(ctx, known ? e.item : Object.assign({}, e.item, { look: ['#0a0a12', '#0a0a12'] }), 2.2); ctx.restore();
        ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = known ? '#ffd54a' : '#7a8398'; ctx.fillText(known ? e.name : '???', g.px + 130, dy + 24);
        ctx.font = '15px sans-serif'; ctx.fillStyle = known ? '#d8e4ff' : '#7a8398';
        ctx.fillText(known ? e.desc : (e.kind === 'mob' ? '아직 만나지 못했어요. 쓰러뜨리면 등록돼요.' : e.kind === 'fish' ? '아직 낚지 못했어요. 낚시로 잡으면 등록돼요.' : '아직 잡지 못했어요. 잠자리채로 잡으면 등록돼요.'), g.px + 130, dy + 52);
        ctx.fillStyle = known ? '#7dffa0' : '#9aa4c0'; ctx.font = 'bold 14px sans-serif';
        ctx.fillText(known ? (isRegistered(inv, e.id) ? `등록 완료 (보상 ${REWARD} G 받음)` : '발견! 도감관에서 등록하면 보상을 받아요') : `등록하면 ${REWARD} G`, g.px + 130, dy + 78);
        if (e.kind === 'mob' && isRegistered(inv, e.id)) { // 등록한 몬스터·보스는 결투장에서 싸워 볼 수 있다
          const fb = g.fightBtn;
          ctx.fillStyle = 'rgba(255,120,80,0.28)'; ctx.fillRect(fb.x, fb.y, fb.w, fb.h);
          ctx.strokeStyle = '#ff9a6a'; ctx.lineWidth = 2; ctx.strokeRect(fb.x, fb.y, fb.w, fb.h);
          ctx.textAlign = 'center'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('결투장에서 싸우기 (F)', fb.x + fb.w / 2, fb.y + fb.h / 2);
        }
        if (ui.msg) { ctx.textAlign = 'right'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#ffd54a'; ctx.fillText(ui.msg, g.px + g.pw - 40, dy + 30); }
      }
      ctx.restore();
    },
  };
  G.Dex = Dex;
})(window.Game);
