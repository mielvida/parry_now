// 관리자 무기: 대미지·범위·속도·속성·발사체·색까지 모든 것을 직접 정하는 무기와 그 편집 창 (F2 또는 개발 메뉴).
// 편집 창 아래쪽에 지금 설정한 무기를 든 용사가 휘두르는/쏘는 모습이 계속 나온다.
//  조작: ↑ 값 올리기, ↓ 값 내리기 (←→도 같다, Shift = 10배 큰 걸음), Tab/W/S 줄 고르기, 숫자 키 = 값 직접 입력 후 Enter, 마우스: 줄 위에서 왼쪽 클릭 = 줄이기, 오른쪽 클릭 = 늘리기, 휠 = 바꾸기
//  R: 처음 값으로, Esc 또는 F2: 닫기 (바꾼 값은 바로 적용되어 저장된다)
(function (G) {
  const C = G.Config;
  const KEY = 'parry_admin_weapon';
  const TYPES = ['sword', 'great', 'dagger', 'katana', 'rapier', 'spear', 'axe', 'hammer', 'scythe', 'whip', 'shield', 'staff', 'gun', 'shotgun', 'bow', 'crossbow', 'bomb', 'launcher'];
  const ELEMS = [null, 'gold', 'crystal', 'light', 'quake', 'fire', 'ice', 'poison', 'thief', 'cleave', 'shadow', 'reap'];
  const ELEM_NAMES = { gold: '황금(코인+50%)', crystal: '수정(파편)', light: '빛(기절)', quake: '대지(기절)', fire: '화염', ice: '얼음', poison: '독', thief: '도둑(코인)', cleave: '관통', shadow: '그림자(무적)', reap: '수확(흡수)' };
  const STAFF = [null, 'poison', 'lightning', 'fire', 'random'];
  const STAFF_NAMES = { poison: '독', lightning: '번개', fire: '불덩이', random: '무작위' };
  // 발사체: 탄환·화살·폭탄에 더해 발사기 종류 (전기·독·화염·얼음·플라즈마·로켓)
  const SHOTS = [null, 'bullet', 'arrow', 'bomb', 'lightning', 'poison', 'fire', 'icebomb', 'plasma', 'rocket'];
  const SHOT_NAMES = { bullet: '탄환', arrow: '화살', bomb: '폭탄', lightning: '전기 발사기', poison: '독 발사기', fire: '화염 발사기', icebomb: '얼음 폭탄 발사기', plasma: '플라즈마 발사기 (관통)', rocket: '로켓 발사기 (폭발)' };
  const BLAST = ['bomb', 'icebomb', 'rocket']; // 폭발 반경이 있는 발사체

  const DEFAULT = { type: 'sword', baseDmg: 100, reach: 1.5, throwTiles: 3, cd: 0, swingFrames: 0, slashFrame: 0, elem: null, oneHit: true, lightRadius: 4, staff: null, shot: null, dmg: 100, count: 1, pierce: false, radius: 3, stamina: 0, windowAdd: 0, hue: 300 };
  const cfg = Object.assign({}, DEFAULT);

  // 색조(0~360) -> [밝은 색, 어두운 색] (#rrggbb)
  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // 편집할 줄: kind 'list' = 목록에서 고른다, 'num' = 숫자, 'bool' = 켜기/끄기
  const ROWS = [
    { key: 'type', label: '무기 종류', kind: 'list', values: TYPES, fmt: (v) => G.Shop.TYPE_NAMES[v] || v },
    { key: 'baseDmg', label: '대미지 (근접)', kind: 'num', min: 1, max: 999999, step: 1, big: 100, fmt: (v) => `${v}` },
    { key: 'reach', label: '범위 (칸)', kind: 'num', min: 0.1, max: 12, step: 0.1, big: 1, fmt: (v) => v.toFixed(1) },
    { key: 'throwTiles', label: '검 던지기 거리 (칸)', kind: 'num', min: 0, max: 20, step: 0.5, big: 5, fmt: (v) => v.toFixed(1) },
    { key: 'cd', label: '쿨다운 증감 (초)', kind: 'num', min: -0.5, max: 3, step: 0.05, big: 0.5, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2) },
    { key: 'swingFrames', label: '휘두르는 길이 (프레임, 0=기본)', kind: 'num', min: 0, max: 240, step: 2, big: 20, fmt: (v) => (v ? `${v}` : '기본') },
    { key: 'slashFrame', label: '타격 순간 (프레임, 0=기본)', kind: 'num', min: 0, max: 240, step: 1, big: 10, fmt: (v) => (v ? `${v}` : '기본') },
    { key: 'elem', label: '속성 (근접)', kind: 'list', values: ELEMS, fmt: (v) => (v ? ELEM_NAMES[v] : '없음') },
    { key: 'oneHit', label: '한 방에 처치 (슬라임·꽃게)', kind: 'bool' },
    { key: 'lightRadius', label: '빛·대지 기절 범위 (칸)', kind: 'num', min: 1, max: 20, step: 1, big: 5, fmt: (v) => `${v}` },
    { key: 'staff', label: '지팡이 원소', kind: 'list', values: STAFF, fmt: (v) => (v ? STAFF_NAMES[v] : '없음') },
    { key: 'shot', label: '발사체', kind: 'list', values: SHOTS, fmt: (v) => (v ? SHOT_NAMES[v] : '없음 (근접)') },
    { key: 'dmg', label: '발사 대미지', kind: 'num', min: 1, max: 999999, step: 1, big: 100, fmt: (v) => `${v}` },
    { key: 'count', label: '한 번에 나가는 수', kind: 'num', min: 1, max: 30, step: 1, big: 5, fmt: (v) => `${v}발` },
    { key: 'pierce', label: '관통 (화살·탄환)', kind: 'bool' },
    { key: 'radius', label: '폭발 반경 (칸, 폭탄·로켓·얼음)', kind: 'num', min: 1, max: 12, step: 1, big: 3, fmt: (v) => `${v}` },
    { key: 'stamina', label: '스태미나 소모', kind: 'num', min: 0, max: 100, step: 1, big: 10, fmt: (v) => `${v}` },
    { key: 'windowAdd', label: '패링 지속 증가 (초)', kind: 'num', min: 0, max: 3, step: 0.05, big: 0.5, fmt: (v) => v.toFixed(2) },
    { key: 'hue', label: '색', kind: 'num', min: 0, max: 360, step: 10, big: 60, wrap: true, fmt: (v) => `${v}°`, swatch: true },
  ];
  const ROWS_LEFT = 10; // 왼쪽 열 줄 수 (나머지는 오른쪽 열)

  // 지금 설정을 무기 아이템(ITEMS.admin)에 반영한다
  function apply() {
    const it = G.Shop.ITEMS.admin;
    if (!it) return;
    const c = cfg;
    const set = (k, v, on) => { if (on) it[k] = v; else delete it[k]; };
    it.type = c.type;
    it.name = '관리자 무기';
    it.reach = c.reach;
    it.throwTiles = c.throwTiles;
    it.cd = c.cd;
    it.look = [hsl(c.hue, 85, 82), hsl(c.hue, 70, 48)];
    set('swingFrames', c.swingFrames, c.swingFrames > 0);
    set('slashFrame', c.slashFrame, c.slashFrame > 0);
    set('elem', c.elem, !!c.elem);
    set('lightRadius', c.lightRadius, c.elem === 'light' || c.elem === 'quake');
    set('oneHit', true, c.oneHit);
    set('element', c.staff, c.type === 'staff' && !!c.staff);
    set('windowAdd', c.windowAdd, c.windowAdd > 0);
    if (c.shot) {
      it.shot = c.shot; it.dmg = c.dmg; it.stamina = c.stamina;
      set('count', c.count, c.count > 1);
      set('pierce', true, c.pierce);
      set('radius', c.radius, BLAST.includes(c.shot));
      delete it.baseDmg;
    } else {
      delete it.shot; delete it.dmg; delete it.count; delete it.pierce; delete it.radius;
      it.baseDmg = c.baseDmg;
      set('stamina', c.stamina, c.stamina > 0);
    }
    it.note = c.shot ? `관리자: ${SHOT_NAMES[c.shot]} 대미지 ${c.dmg}${c.count > 1 ? ` x${c.count}` : ''}` : `관리자: 대미지 ${c.baseDmg}, 범위 ${c.reach.toFixed(1)}칸${c.elem ? ', ' + ELEM_NAMES[c.elem] : ''}`;
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* 저장 못 해도 괜찮다 */ } }
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) Object.assign(cfg, JSON.parse(s)); } catch (e) { /* 없으면 기본값 */ }
    apply();
  }

  // 항목 값 바꾸기: dir = -1/+1, mult = 걸음 배수
  function nudge(row, dir, mult) {
    const v = cfg[row.key];
    if (row.kind === 'bool') cfg[row.key] = !v;
    else if (row.kind === 'list') { const i = row.values.indexOf(v); cfg[row.key] = row.values[(i + dir + row.values.length) % row.values.length]; }
    else {
      const st = mult > 1 ? row.big : row.step;
      let n = Math.round((v + dir * st) / row.step) * row.step;
      n = row.wrap ? ((n % 360) + 360) % 360 : Math.max(row.min, Math.min(row.max, n));
      cfg[row.key] = Math.round(n * 1000) / 1000;
    }
  }

  const Admin = {
    cfg,
    DEFAULT,
    load,
    apply,
    reset() { Object.assign(cfg, DEFAULT); apply(); save(); }, // 처음 값으로
    // 발사기 한 번에 받기: 전기·독·화염·얼음·플라즈마·로켓 (색과 대미지가 알맞게 정해진다). 이후 F2에서 마음대로 고칠 수 있다
    LAUNCHERS: [
      { shot: 'lightning', label: '전기 발사기', hue: 55, dmg: 120, stamina: 6 },
      { shot: 'poison', label: '독 발사기', hue: 110, dmg: 80, stamina: 5 },
      { shot: 'fire', label: '화염 발사기', hue: 18, dmg: 150, stamina: 6 },
      { shot: 'icebomb', label: '얼음 폭탄 발사기', hue: 195, dmg: 100, stamina: 10 },
      { shot: 'plasma', label: '플라즈마 발사기', hue: 285, dmg: 200, stamina: 8 },
      { shot: 'rocket', label: '로켓 발사기', hue: 0, dmg: 300, stamina: 14 },
    ],
    preset(shot) {
      const p = Admin.LAUNCHERS.find((l) => l.shot === shot);
      if (!p) return;
      Object.assign(cfg, DEFAULT, { type: 'launcher', shot: p.shot, dmg: p.dmg, count: 1, pierce: false, radius: 3, stamina: p.stamina, hue: p.hue, oneHit: true });
      apply(); save();
    },
    open() { return { fresh: true, cur: 0, buf: '', t: 0, msg: '', msgT: 0, closed: false, hover: -1 }; },

    geometry(W, H) {
      const px = 30, py = 14, pw = W - 60, ph = H - 28;
      const rowH = 27;
      const colW = (pw - 60) / 2;
      const rows = ROWS.map((r, i) => {
        const col = i < ROWS_LEFT ? 0 : 1;
        const idx = col === 0 ? i : i - ROWS_LEFT;
        return { x: px + 24 + col * (colW + 12), y: py + 58 + idx * rowH, w: colW, h: rowH - 2 };
      });
      return { px, py, pw, ph, rows, previewY: py + 58 + ROWS_LEFT * rowH + 8 };
    },

    update(a, input, dt, cb) {
      const fresh = a.fresh; // 여는 순간의 키(F2)가 바로 닫기로 읽히지 않게
      a.fresh = false;
      a.t += dt;
      a.msgT = Math.max(0, a.msgT - dt);
      const pressed = (...c) => c.some((k) => input.wasPressed(k));
      const row = ROWS[a.cur];
      const big = input.down.has('ShiftLeft') || input.down.has('ShiftRight') ? 10 : 1;
      const changed = () => { apply(); save(); if (cb && cb.onChange) cb.onChange(); };
      // 숫자 직접 입력
      if (row.kind === 'num') {
        for (let n = 0; n <= 9; n++) if (pressed('Digit' + n, 'Numpad' + n)) a.buf += n;
        if (pressed('Period', 'NumpadDecimal') && a.buf.indexOf('.') < 0) a.buf += a.buf ? '.' : '0.';
        if (pressed('Minus', 'NumpadSubtract') && !a.buf) a.buf = '-';
        if (pressed('Backspace')) a.buf = a.buf.slice(0, -1);
        if (a.buf && pressed('Enter', 'NumpadEnter')) {
          const v = parseFloat(a.buf);
          if (!isNaN(v)) { cfg[row.key] = row.wrap ? ((v % 360) + 360) % 360 : Math.max(row.min, Math.min(row.max, v)); changed(); a.msg = `${row.label}: ${row.fmt(cfg[row.key])}`; a.msgT = 1.4; }
          a.buf = '';
        }
      } else a.buf = '';
      if (pressed('Escape') && a.buf) { a.buf = ''; return; }
      if (!fresh && pressed('Escape', 'F2')) { a.closed = true; return; }
      if (fresh) return;
      if (pressed('KeyW', 'PageUp') || (pressed('Tab') && big === 10)) { a.cur = (a.cur + ROWS.length - 1) % ROWS.length; a.buf = ''; G.Audio.play('catch'); }
      else if (pressed('KeyS', 'PageDown', 'Tab')) { a.cur = (a.cur + 1) % ROWS.length; a.buf = ''; G.Audio.play('catch'); }
      // ↑ = 값 올리기, ↓ = 값 내리기 (←→도 같다)
      if (pressed('ArrowDown', 'ArrowLeft', 'KeyA')) { nudge(row, -1, big); a.buf = ''; changed(); }
      if (pressed('ArrowUp', 'ArrowRight', 'KeyD')) { nudge(row, 1, big); a.buf = ''; changed(); }
      if (pressed('Space') && (row.kind === 'bool' || row.kind === 'list')) { nudge(row, 1, 1); changed(); }
      if (pressed('KeyR') && !a.buf) { Object.assign(cfg, DEFAULT); changed(); a.msg = '처음 값으로 되돌렸다'; a.msgT = 1.6; G.Audio.play('pickup'); }
      if (a.click) { // 마우스: 줄 위 왼쪽 = 줄이기, 오른쪽 = 늘리기
        const g = Admin.geometry(G.Config.VIEW_W, G.Config.VIEW_H);
        const i = g.rows.findIndex((r) => a.click.x >= r.x && a.click.x < r.x + r.w && a.click.y >= r.y && a.click.y < r.y + r.h);
        if (i >= 0) {
          a.cur = i;
          const r = g.rows[i];
          nudge(ROWS[i], a.click.x < r.x + r.w * 0.5 ? -1 : 1, a.shift ? 10 : 1);
          a.buf = '';
          changed();
          G.Audio.play('catch');
        }
        a.click = null;
      }
      if (a.wheel) { nudge(ROWS[a.cur], a.wheel > 0 ? -1 : 1, 1); changed(); a.wheel = 0; }
    },

    mouse(a, kind, p, extra) {
      if (kind === 'move') {
        const g = Admin.geometry(G.Config.VIEW_W, G.Config.VIEW_H);
        a.hover = g.rows.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
        if (a.hover >= 0) a.cur = a.hover;
      } else if (kind === 'click') { a.click = p; a.shift = !!extra; }
      else if (kind === 'wheel') a.wheel = extra;
    },

    // 화면 그리기. me = 용사가 입은 옷 (preview용)
    draw(ctx, W, H, a, me) {
      const g = Admin.geometry(W, H);
      const it = G.Shop.ITEMS.admin;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#171b2b'; ctx.fillRect(g.px, g.py, g.pw, g.ph);
      ctx.lineWidth = 4; ctx.strokeStyle = '#ff5ad0'; ctx.strokeRect(g.px, g.py, g.pw, g.ph);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left'; ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#ff8ae0';
      ctx.fillText('관리자 무기 편집', g.px + 24, g.py + 28);
      ctx.font = '14px sans-serif'; ctx.fillStyle = '#9aa4c0';
      ctx.fillText('↑ 올리기 · ↓ 내리기 (Shift 큰 걸음) · Tab/W/S 줄 고르기 · 숫자 입력 후 Enter · 클릭(왼쪽 줄이기/오른쪽 늘리기) · R 처음 값 · Esc/F2 닫기', g.px + 260, g.py + 30);
      ROWS.forEach((r, i) => {
        const b = g.rows[i];
        const on = i === a.cur;
        ctx.fillStyle = on ? 'rgba(255,90,208,0.2)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        if (on) { ctx.strokeStyle = '#ff5ad0'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); }
        ctx.textAlign = 'left'; ctx.font = '15px sans-serif'; ctx.fillStyle = on ? '#ffffff' : '#c8d0e8';
        ctx.fillText(r.label, b.x + 10, b.y + b.h / 2);
        // 값 상자
        const vx = b.x + b.w - 190;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(vx, b.y + 2, 182, b.h - 4);
        ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
        const v = cfg[r.key];
        let txt = r.kind === 'bool' ? (v ? '켜짐' : '꺼짐') : r.fmt(v);
        if (on && a.buf) txt = a.buf + '▌';
        ctx.fillStyle = on && a.buf ? '#ffd54a' : r.kind === 'bool' ? (v ? '#7dffa0' : '#8a93a8') : '#ffffff';
        ctx.fillText(txt, vx + 91, b.y + b.h / 2);
        if (on) { ctx.fillStyle = '#ff8ae0'; ctx.fillText('◀', vx + 12, b.y + b.h / 2); ctx.fillText('▶', vx + 170, b.y + b.h / 2); }
        if (r.swatch) { ctx.fillStyle = it.look[0]; ctx.fillRect(vx - 44, b.y + 4, 18, b.h - 8); ctx.fillStyle = it.look[1]; ctx.fillRect(vx - 24, b.y + 4, 18, b.h - 8); }
      });
      // ---- 아래: 지금 설정한 무기 미리보기 ----
      const y0 = g.previewY;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(g.px + 24, y0, g.pw - 48, g.py + g.ph - y0 - 12);
      ctx.strokeStyle = 'rgba(255,90,208,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(g.px + 24, y0, g.pw - 48, g.py + g.ph - y0 - 12);
      const gyp = g.py + g.ph - 26;
      ctx.fillStyle = '#5a4a32'; ctx.fillRect(g.px + 26, gyp, g.pw - 52, 10);
      const frames = it.swingFrames || C.SWING_FRAMES;
      const period = frames + 50;
      const fr = Math.floor(a.t * 60) % period;
      const swing = fr < frames ? fr : -1;
      const hx = g.px + 160;
      ctx.save();
      ctx.translate(hx, gyp);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(3.1, 3.1);
      const m = me || {};
      G.Hero.draw(ctx, { x: -12, y: -32, w: 24, h: 32, facing: 1, vx: 0, onGround: true, animTime: a.t, runPhase: 0, swing, swordOut: false, guardTimer: 0, weaponId: 'admin', armorId: m.armorId, helmetId: m.helmetId, glovesId: m.glovesId, pantsId: m.pantsId, bootsId: m.bootsId });
      ctx.restore();
      // 발사체 / 범위 표시
      const slash = it.slashFrame || C.SWING_SLASH_FRAME;
      if (it.shot) {
        const u = (fr - slash) / 40;
        if (u >= 0 && u < 1) {
          const bx = hx + 40 + u * (g.pw - 320);
          const by = gyp - 52;
          for (let k = 0; k < (it.count || 1); k++) {
            const oy = ((k - ((it.count || 1) - 1) / 2) * 9);
            ctx.fillStyle = it.look[0];
            if (it.shot === 'bomb') { ctx.beginPath(); ctx.arc(bx, by - Math.sin(u * Math.PI) * 50, 9, 0, Math.PI * 2); ctx.fill(); }
            else { ctx.fillRect(bx, by + oy, it.shot === 'arrow' ? 26 : 12, 3); }
          }
          if (it.shot === 'bomb' && u > 0.9) { ctx.strokeStyle = it.look[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, gyp - 20, (it.radius || 2) * 14, 0, Math.PI * 2); ctx.stroke(); }
        }
      } else if (swing >= slash && swing < slash + 8) { // 베는 순간 범위 표시
        const reach = (it.reach || 1) * C.TILE * 0.9 + 30;
        ctx.strokeStyle = it.look[0]; ctx.lineWidth = 4; ctx.globalAlpha = 0.7 - (swing - slash) * 0.08;
        ctx.beginPath(); ctx.arc(hx, gyp - 50, reach, -0.9, 0.9); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // 능력치 요약
      const tx = g.px + 330;
      ctx.textAlign = 'left';
      ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = it.look[0];
      ctx.fillText(`관리자 무기 · ${G.Shop.TYPE_NAMES[cfg.type] || cfg.type}`, tx, y0 + 24);
      ctx.font = '16px sans-serif'; ctx.fillStyle = '#e8ecff';
      const lines = [];
      if (cfg.shot) {
        lines.push(`발사: ${SHOT_NAMES[cfg.shot]}  대미지 ${cfg.dmg}${cfg.count > 1 ? ` × ${cfg.count}발 = ${cfg.dmg * cfg.count}` : ''}${cfg.pierce ? '  관통' : ''}${cfg.shot === 'bomb' ? `  폭발 ${cfg.radius}칸` : ''}`);
        lines.push(`스태미나 -${cfg.stamina}   쿨다운 ${cfg.cd >= 0 ? '+' : ''}${cfg.cd.toFixed(2)}s`);
      } else {
        const sec = ((it.swingFrames || C.SWING_FRAMES) / 60).toFixed(2);
        lines.push(`근접 대미지 ${cfg.baseDmg}   범위 ${cfg.reach.toFixed(1)}칸   휘두르기 ${sec}s${cfg.oneHit ? '   한 방 처치' : ''}`);
        lines.push(`속성 ${cfg.elem ? ELEM_NAMES[cfg.elem] : '없음'}   던지기 ${cfg.throwTiles.toFixed(1)}칸   쿨다운 ${cfg.cd >= 0 ? '+' : ''}${cfg.cd.toFixed(2)}s`);
      }
      lines.forEach((t, i) => ctx.fillText(t, tx, y0 + 52 + i * 24));
      if (a.msgT > 0) { ctx.fillStyle = '#7dffa0'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(a.msg, tx, y0 + 52 + lines.length * 24 + 4); }
      ctx.restore();
    },
  };

  G.Admin = Admin;
  load(); // 저장해 둔 설정을 무기에 반영
})(window.Game);
