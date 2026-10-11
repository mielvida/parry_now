// 업적 모음집 (T 키): 해냈을 때 저절로 채워지는 기록들. 안 해도 되고, 달성하면 경험치를 조금 받는다.
(function (G) {
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const count = (o) => Object.keys(o || {}).length;
  const homeBuilt = (c) => !!((c.inv.homes && ((c.inv.homes.village && c.inv.homes.village.type) || (c.inv.homes.kingdom && c.inv.homes.kingdom.type))) || (c.inv.home && c.inv.home.type));
  const wlv = (c) => Math.max(0, ...Object.values(c.inv.wlevel || {}));
  const tolls = (c) => count(c.story.tolls);
  const caught = (c) => c.inv.caughtTotal || 0;

  // [id, 이름, 설명, 목표 수치, 지금 수치(c), 보상 경험치]
  const LIST = [
    ['clear', '어둠을 넘어', '시크너를 쓰러뜨리자', 1, (c) => (c.story.cleared ? 1 : 0), 100],
    ['fish1', '낚시 입문', '물고기나 곤충을 처음 잡자', 1, caught, 20],
    ['fish2', '낚시꾼', '물고기와 곤충을 50마리 잡자', 50, caught, 100],
    ['fish3', '채집왕', '물고기와 곤충을 200마리 잡자', 200, caught, 300],
    ['dex1', '기록가', '도감에 10개를 등록하자', 10, (c) => count(c.inv.dex), 80],
    ['dex2', '박물학자', '도감에 70개를 등록하자', 70, (c) => count(c.inv.dex), 400],
    ['dex3', '도감 완성', '도감을 모두 등록하자', 1000, (c) => Math.min(1000, count(c.inv.dex) >= G.Dex.total() ? 1000 : 0), 1500],
    ['gold1', '두둑한 주머니', '코인을 1만 G 가지자', 10000, (c) => c.coins, 100],
    ['gold2', '부자', '코인을 10만 G 가지자', 100000, (c) => c.coins, 500],
    ['gold3', '큰손', '코인을 100만 G 가지자', 1000000, (c) => c.coins, 10000],
    ['home', '내 집 마련', '집을 사서 정착하자', 1, (c) => (homeBuilt(c) ? 1 : 0), 100],
    ['train1', '훈련생', '훈련을 5번 올리자', 5, (c) => sum(c.inv.train), 100],
    ['train2', '단련된 몸', '훈련을 20번 올리자', 20, (c) => sum(c.inv.train), 500],
    ['tower1', '탑의 손님', '어둠의 탑을 20층까지 오르자', 20, (c) => c.darkBest, 150],
    ['tower2', '탑의 정복자', '어둠의 탑을 50층까지 오르자', 50, (c) => c.darkBest, 400],
    ['tower3', '꼭대기', '어둠의 탑 100층에 오르자', 100, (c) => c.darkBest, 1500],
    ['gacha1', '도전!', '뽑기를 10번 하자', 10, (c) => c.inv.gachaCount || 0, 100],
    ['gacha2', '뽑기의 노예', '뽑기를 50번 하자', 50, (c) => c.inv.gachaCount || 0, 400],
    ['armor', '갑옷 장인', '갑옷 강화를 5레벨까지 올리자', 5, (c) => c.inv.armorLevel || 0, 300],
    ['weapon', '무기 장인', '무기를 10레벨까지 강화하자', 10, wlv, 400],
    ['abyss', '심연의 탐험가', '심연 동굴 보상을 3레벨까지 올리자', 3, (c) => c.inv.abyssLevel || 1, 300],
    ['toll', '통행료 두 번', '숲과 심연의 다리 통행료를 모두 내자', 2, tolls, 200],
    ['king', '왕의 신하', '왕의 의뢰를 5건 완수하자', 5, (c) => c.missions.done || 0, 300],
    ['time', '모험가', '1시간 플레이하자', 3600, (c) => c.playSec, 300],
    ['items', '수집가', '장비와 도구를 30개 모으자', 30, (c) => (c.inv.items || []).length, 200],
  ].map(([id, name, desc, need, prog, exp]) => ({ id, name, desc, need, prog, exp }));

  const done = (c, a) => !!(c.story.ach && c.story.ach[a.id]);
  // 새로 이룬 업적을 기록하고 목록을 돌려준다
  function check(c) {
    const out = [];
    c.story.ach = c.story.ach || {};
    for (const a of LIST) if (!c.story.ach[a.id] && a.prog(c) >= a.need) { c.story.ach[a.id] = 1; out.push(a); }
    return out;
  }

  const PER_PAGE = 8;
  const geometry = (W, H) => {
    const x = 90, y = 60, w = W - 180, h = H - 120;
    const rows = [];
    for (let i = 0; i < PER_PAGE; i++) rows.push({ x: x + 20 + (i % 2) * ((w - 50) / 2 + 10), y: y + 78 + Math.floor(i / 2) * 84, w: (w - 50) / 2, h: 76 });
    return { x, y, w, h, rows, prev: { x: x + 24, y: y + h - 48, w: 100, h: 32 }, next: { x: x + w - 124, y: y + h - 48, w: 100, h: 32 } };
  };
  const pages = () => Math.ceil(LIST.length / PER_PAGE);

  function draw(ctx, W, H, ui) {
    const g = geometry(W, H);
    const c = ui.ctx;
    const nDone = LIST.filter((a) => done(c, a)).length;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b2236'; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 4; ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#ffd54a'; ctx.fillText('업적 모음집', g.x + 24, g.y + 34);
    ctx.textAlign = 'right'; ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#dfe8ff'; ctx.fillText(`${nDone} / ${LIST.length}`, g.x + g.w - 24, g.y + 34);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(g.x + 24, g.y + 54, g.w - 48, 6);
    ctx.fillStyle = '#ffd54a'; ctx.fillRect(g.x + 24, g.y + 54, (g.w - 48) * (nDone / LIST.length), 6);
    const list = LIST.slice(ui.page * PER_PAGE, ui.page * PER_PAGE + PER_PAGE);
    list.forEach((a, i) => {
      const r = g.rows[i];
      const ok = done(c, a);
      const v = Math.min(a.need, Math.floor(a.prog(c)));
      ctx.fillStyle = ok ? 'rgba(255,213,74,0.16)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = ok ? '#ffd54a' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = ok ? 2 : 1; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = ok ? '#ffd54a' : '#3a4560'; ctx.beginPath(); ctx.arc(r.x + 30, r.y + r.h / 2, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ok ? '#5a3d00' : '#7a86a8'; ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(ok ? '★' : '?', r.x + 30, r.y + r.h / 2 + 1);
      ctx.textAlign = 'left'; ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = ok ? '#fff' : '#9aa6c4'; ctx.fillText(a.name, r.x + 58, r.y + 18);
      ctx.font = '13px sans-serif'; ctx.fillStyle = ok ? '#c8d4f0' : '#7a86a8'; ctx.fillText(a.desc, r.x + 58, r.y + 38);
      if (ok) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#7dffa0'; ctx.fillText(`달성! (경험치 +${a.exp})`, r.x + 58, r.y + 60); }
      else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(r.x + 58, r.y + 54, r.w - 150, 8);
        ctx.fillStyle = '#6fd0ff'; ctx.fillRect(r.x + 58, r.y + 54, (r.w - 150) * (v / a.need), 8);
        ctx.textAlign = 'right'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#b8c2dc'; ctx.fillText(a.need >= 1000 && a.id !== 'dex3' ? `${v.toLocaleString()}/${a.need.toLocaleString()}` : a.id === 'dex3' ? `${count(c.inv.dex)}/${G.Dex.total()}` : `${v}/${a.need}`, r.x + r.w - 10, r.y + 58);
      }
    });
    for (const [b, label, on] of [[g.prev, '◀ 이전', ui.page > 0], [g.next, '다음 ▶', ui.page < pages() - 1]]) {
      ctx.fillStyle = on ? 'rgba(111,208,255,0.2)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = on ? '#6fd0ff' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.textAlign = 'center'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = on ? '#fff' : '#6c7490'; ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
    }
    ctx.textAlign = 'center'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#9aa6c4'; ctx.fillText(`${ui.page + 1} / ${pages()} 쪽  ·  ←→ 쪽 넘기기  ·  T 또는 Esc 닫기`, W / 2, g.y + g.h - 32);
    ctx.restore();
  }

  G.Achv = { LIST, check, done, geometry, pages, draw };
})(window.Game);
