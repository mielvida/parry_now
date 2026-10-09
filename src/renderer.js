// 렌더러: 상태를 읽어 캔버스에 그리기만 한다. 게임 상태를 바꾸지 않는다.
(function (G) {
  const { TILE } = G.Config;

  class Renderer {
    // theme: 배경/타일/장식을 그리는 테마 (G.Cave 또는 G.Beach)
    constructor(canvas, viewW, viewH, theme = G.Cave) {
      this.theme = theme;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.viewW = viewW;
      this.viewH = viewH;
      this.scale = 1;
      this.setScale(1);
    }

    // 캔버스 내부 해상도를 게임 화면의 s배로 한다 (화면을 크게 늘려도 글자와 그림이 또렷하도록)
    setScale(s) {
      this.scale = s;
      this.canvas.width = this.viewW * s;
      this.canvas.height = this.viewH * s;
    }

    draw(terrain, player, camera, monsters = [], effects = null, hud = null, sword = null, extras = {}) {
      const ctx = this.ctx;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0); // 이후는 모두 게임 좌표(960x576)로 그린다
      const time = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      this.theme.drawBackground(ctx, this.viewW, this.viewH, camera, time);
      ctx.save();
      const sh = effects ? effects.shakeOffset() : { x: 0, y: 0 };
      ctx.translate(-Math.round(camera.x - sh.x), -Math.round(camera.y - sh.y));
      this.theme.drawCeiling(ctx, camera, this.viewW);
      if (this.theme.drawDecor) this.theme.drawDecor(ctx, terrain, camera, time); // 집/짐더미 (테마에 있을 때만): 땅과 캐릭터 뒤에 깔리는 장식
      this._drawTerrain(ctx, terrain, camera);
      if (extras.chest) this._drawChest(ctx, extras.chest);
      for (const m of monsters) if (m.alive && this._inView(m, camera)) this._drawMonster(ctx, m); // 화면 밖은 그리지 않음 (대량 소환 대비)
      this._drawPlayer(ctx, player);
      if (extras.npcs) for (const n of extras.npcs) G.Npc.draw(ctx, n.kind, n.x, n.y, n.facing, time, n.alpha);
      if (extras.cutscene) extras.cutscene.drawWorld(ctx); // 땅 위/들어 올린 병
      G.Hero.drawCharge(ctx, player);
      if (sword) G.Hero.drawThrownSword(ctx, sword);
      if (effects) effects.draw(ctx);
      if (extras.magic) G.Magic.draw(ctx, extras.magic);
      if (extras.popups) this._drawPopups(ctx, extras.popups);
      ctx.restore();
      this.theme.drawVignette(ctx, this.viewW, this.viewH);
      if (effects) effects.drawOverlay(ctx, this.viewW, this.viewH);
      if (extras.cutscene) { // 컷신: 자막·확대 화면·암전. 게임 HUD는 숨긴다
        extras.cutscene.drawOverlay(ctx, this.viewW, this.viewH);
        return;
      }
      if (extras.ending) { // 엔딩: 코인 획득 -> 해변. 게임 HUD는 숨긴다
        extras.ending.drawOverlay(ctx, this.viewW, this.viewH);
        return;
      }
      this._drawHud(ctx, hud);
      if (hud && hud.banner) this._drawStageBanner(ctx, hud.banner);
    }

    // 스테이지 시작 소개: 검은 화면에서 서서히 밝아지며 "STAGE 2 / 지상 - 해변"
    _drawStageBanner(ctx, b) {
      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const fade = clamp01(1 - b.t / 0.9);
      if (fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${fade})`;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
      }
      const a = clamp01(b.t / 0.5) * clamp01((b.dur - b.t) / 0.6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`;
      ctx.fillText(b.title, this.viewW / 2 + 3, this.viewH * 0.3 + 3);
      ctx.fillStyle = `rgba(255,213,74,${a})`;
      ctx.fillText(b.title, this.viewW / 2, this.viewH * 0.3);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`;
      ctx.fillText(b.sub, this.viewW / 2 + 2, this.viewH * 0.3 + 52);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillText(b.sub, this.viewW / 2, this.viewH * 0.3 + 50);
      if (b.caption) { // 하단 자막 (작은 대화칸)
        const ca = clamp01((b.t - 0.9) / 0.5) * clamp01((b.dur - b.t) / 0.6);
        Renderer.drawCaption(ctx, this.viewW, this.viewH, b.caption, ca);
      }
      ctx.textAlign = 'start';
    }

    // 코인 획득 등 떠오르는 글자 (월드 좌표)
    _drawPopups(ctx, popups) {
      ctx.save();
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const p of popups) {
        const a = Math.min(1, p.t / 0.4);
        ctx.fillStyle = `rgba(0,0,0,${0.7 * a})`;
        ctx.fillText(p.text, p.x + 1, p.y + 1);
        ctx.fillStyle = p.color ? p.color.replace('A', a) : `rgba(255,213,74,${a})`;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    }

    // 우측 상단 코인 표시
    _drawCoinHud(ctx, coins, potions) {
      ctx.save();
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = `${coins} G`;
      const w = ctx.measureText(label).width;
      const x = this.viewW - 14;
      const y = 58;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(label, x + 1, y + 1);
      ctx.fillStyle = '#ffd54a';
      ctx.fillText(label, x, y);
      ctx.fillStyle = '#b8860b';
      ctx.beginPath(); ctx.arc(x - w - 16, y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.arc(x - w - 16, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff4b8';
      ctx.fillRect(x - w - 19, y - 5, 3, 6);
      if (potions && potions.potion1 + potions.potion2 > 0) { // 가진 물약 (Q로 마신다)
        ctx.font = 'bold 14px sans-serif';
        const t = `물약  치유 ${potions.potion1} · 회복 ${potions.potion2}   (Q)`;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(t, x + 1, y + 25);
        ctx.fillStyle = '#ffb3c0';
        ctx.fillText(t, x, y + 24);
      }
      ctx.restore();
    }

    // 대화/자막 칸: 글자 길이에 맞춘 작은 둥근 상자를 화면 아래 가운데에 (대화, 상호작용 안내, 연출 자막 공용)
    static drawCaption(ctx, viewW, viewH, text, alpha = 1) {
      ctx.save();
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bw = Math.min(viewW - 40, ctx.measureText(text).width + 36);
      const bh = 32;
      const x = (viewW - bw) / 2;
      const y = viewH - 20 - bh;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 8); else ctx.rect(x, y, bw, bh);
      ctx.fillStyle = `rgba(10,14,28,${0.8 * alpha})`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255,230,160,${0.55 * alpha})`;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,248,225,${alpha})`;
      ctx.fillText(text, viewW / 2, y + bh / 2 + 1);
      ctx.restore();
    }

    _drawBottomText(ctx, text, alpha = 1) {
      Renderer.drawCaption(ctx, this.viewW, this.viewH, text, alpha);
    }

    // 상점 창의 칸 배치 (그리기와 마우스 판정이 같이 쓴다). 탭이 2개 이상이면 위에 탭 줄이 생긴다
    static shopGeometry(vw, vh, def, tab) {
      const items = def.tabs[tab].items;
      const hasTabs = def.tabs.length > 1;
      const w = 640;
      const rowH = 82;
      const top = 70 + (hasTabs ? 50 : 0);
      const h = top + items.length * rowH + 84;
      const x = (vw - w) / 2;
      const y = (vh - h) / 2;
      return {
        panel: { x, y, w, h },
        tabs: hasTabs ? def.tabs.map((t, i) => ({ x: x + 28 + i * 132, y: y + 66, w: 120, h: 36 })) : [],
        rows: items.map((it, i) => ({ x: x + 20, y: y + top + i * rowH, w: w - 40, h: 72 })),
      };
    }

    // 아이템 아이콘 (cx, cy = 중심, s = 크기 배율). 무기 종류/단계, 갑옷, 장갑, 신발, 물약마다 모양과 색이 다르다
    _drawItemIcon(ctx, item, cx, cy, s) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      const L = item.look || [];
      if (item.heal !== undefined) { // 물약 병
        ctx.fillStyle = L[0]; ctx.fillRect(-11, -8, 22, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-7, -4, 4, 18);
        ctx.fillStyle = '#e8f1ff'; ctx.fillRect(-5, -20, 10, 13);
        ctx.fillStyle = '#9a6b3c'; ctx.fillRect(-6, -27, 12, 7);
      } else if (item.slot === 'weapon' && item.type === 'staff') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-3, -26, 6, 64);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-6, -28, 12, 5);
        const g = ctx.createRadialGradient(0, -38, 1, 0, -38, 16);
        g.addColorStop(0, '#fff'); g.addColorStop(0.45, L[0]); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-16, -54, 32, 32);
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.arc(0, -38, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = L[1]; ctx.lineWidth = 2; ctx.stroke();
      } else if (item.slot === 'weapon' && item.type === 'dagger') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-3, 8, 6, 14);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-9, 5, 18, 4);
        ctx.fillStyle = L[0]; ctx.fillRect(-4, -24, 8, 30);
        ctx.fillStyle = L[1]; ctx.fillRect(1, -24, 3, 30);
        ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(0, -34); ctx.lineTo(4, -24); ctx.closePath(); ctx.fillStyle = L[0]; ctx.fill();
      } else if (item.slot === 'weapon' && item.type === 'great') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-4, 18, 8, 16);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-14, 14, 28, 5);
        ctx.fillStyle = L[0]; ctx.fillRect(-6, -40, 12, 56);
        ctx.fillStyle = L[1]; ctx.fillRect(1, -40, 5, 56);
        ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(0, -54); ctx.lineTo(6, -40); ctx.closePath(); ctx.fillStyle = L[0]; ctx.fill();
      } else if (item.slot === 'weapon') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-4, 14, 8, 14);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-12, 10, 24, 5);
        ctx.fillStyle = L[0]; ctx.fillRect(-4, -34, 8, 46);
        ctx.fillStyle = L[1]; ctx.fillRect(1, -34, 3, 46);
        ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(0, -44); ctx.lineTo(4, -34); ctx.closePath(); ctx.fillStyle = L[0]; ctx.fill();
      } else if (item.slot === 'armor') {
        ctx.fillStyle = L[0]; ctx.fillRect(-18, -18, 36, 40);
        ctx.fillStyle = L[1]; ctx.fillRect(-18, -18, 36, 9);
        ctx.fillRect(-26, -18, 9, 16); ctx.fillRect(17, -18, 9, 16);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-18, 10, 36, 4);
        ctx.fillStyle = '#c9d2dc'; ctx.fillRect(-9, -30, 18, 11);
      } else if (item.slot === 'helmet') { // 투구: 반원 지붕 + 이마 띠 + 눈 가리개
        ctx.fillStyle = L[0];
        ctx.beginPath(); ctx.arc(0, 4, 20, Math.PI, 0); ctx.lineTo(20, 18); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1]; ctx.beginPath(); ctx.arc(0, 4, 20, Math.PI * 1.1, Math.PI * 1.55); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-20, 14, 40, 4);
        ctx.fillStyle = '#1b2433'; ctx.fillRect(-4, 4, 18, 6);
        ctx.fillStyle = L[1]; ctx.fillRect(-2, -20, 4, 8);
      } else if (item.slot === 'gloves') {
        ctx.fillStyle = L[0]; ctx.fillRect(-14, -18, 28, 22); ctx.fillRect(-20, -6, 8, 14);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-6, -18, 2, 12); ctx.fillRect(2, -18, 2, 12);
        ctx.fillStyle = L[1]; ctx.fillRect(-15, 4, 30, 10);
      } else if (item.slot === 'boots') {
        for (const dx of [-17, 4]) {
          ctx.fillStyle = L[0]; ctx.fillRect(dx, -20, 13, 28); ctx.fillRect(dx, 2, 24, 10);
          ctx.fillStyle = L[1]; ctx.fillRect(dx, 12, 24, 5);
        }
      }
      ctx.restore();
    }

    // 상점 창: 탭 + 물품 줄(아이콘, 이름, 설명, 가격). 줄을 클릭하거나 숫자 키로 구매, ←→ 탭 전환, E/Esc 닫기
    _drawShop(ctx, s) {
      ctx.save();
      const geo = Renderer.shopGeometry(this.viewW, this.viewH, s.def, s.tab);
      const { x, y, w, h } = geo.panel;
      const items = s.def.tabs[s.tab].items;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.fillStyle = '#1d2233';
      ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e0b12f';
      ctx.strokeRect(x, y, w, h);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText(s.def.title, x + 28, y + 36);
      ctx.textAlign = 'right';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`보유 ${s.coins} G   피 ${s.lives}/${s.maxLives}`, x + w - 28, y + 36);
      geo.tabs.forEach((t, i) => { // 탭 (클릭해서 전환)
        const on = i === s.tab;
        ctx.fillStyle = on ? '#e0b12f' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = on ? '#1d2233' : '#b8c2dc';
        ctx.fillText(s.def.tabs[i].name, t.x + t.w / 2, t.y + t.h / 2 + 1);
      });
      items.forEach((it, i) => {
        const row = geo.rows[i];
        const d = G.Shop.describe(it);
        const owned = !!it.slot && s.inv.items.includes(it.id);
        const afford = s.coins >= it.price;
        const hover = s.hover === i;
        ctx.fillStyle = hover ? 'rgba(255,213,74,0.16)' : 'rgba(255,255,255,0.07)';
        ctx.fillRect(row.x, row.y, row.w, row.h);
        ctx.lineWidth = hover ? 3 : 1;
        ctx.strokeStyle = hover ? '#ffd54a' : 'rgba(255,255,255,0.14)';
        ctx.strokeRect(row.x, row.y, row.w, row.h);
        this._drawItemIcon(ctx, it, row.x + 36, row.y + row.h / 2 + 2, 0.62);
        ctx.textAlign = 'left';
        const y1 = d.note ? 20 : 25;
        ctx.font = 'bold 21px sans-serif';
        ctx.fillStyle = owned ? '#8a93a8' : '#fff';
        ctx.fillText(`${i + 1}. ${d.name}`, row.x + 76, row.y + y1);
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#b8c2dc';
        ctx.fillText(d.desc, row.x + 76, row.y + y1 + 24);
        if (d.note) { // 원소/특수 능력은 초록색으로 한 줄 더
          ctx.font = 'bold 14px sans-serif';
          ctx.fillStyle = owned ? '#6c7490' : '#9fe8a8';
          ctx.fillText(d.note, row.x + 76, row.y + y1 + 43);
        }
        ctx.textAlign = 'right';
        ctx.font = 'bold 23px sans-serif';
        ctx.fillStyle = owned ? '#8a93a8' : afford ? '#ffd54a' : '#ff6b7a';
        ctx.fillText(owned ? '보유 중' : `${it.price} G`, row.x + row.w - 16, row.y + row.h / 2 - (it.heal !== undefined ? 8 : 0));
        if (it.heal !== undefined) { // 물약은 가진 개수를 보여준다
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#b8c2dc';
          ctx.fillText(`보유 ${s.inv.potions[it.id]}개`, row.x + row.w - 16, row.y + row.h / 2 + 16);
        }
      });
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = s.msgT > 0 ? (s.ok ? '#7dffa0' : '#ff8a8a') : 'rgba(0,0,0,0)';
      ctx.fillText(s.msg, x + w / 2, y + h - 54);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#9aa4c0';
      ctx.fillText(`클릭 또는 숫자 키: 구매     ${geo.tabs.length ? '←→: 탭 전환     ' : ''}E / Esc: 닫기`, x + w / 2, y + h - 26);
      ctx.restore();
    }

    // 인벤토리 창의 칸 배치 (그리기와 마우스 판정이 같이 쓴다). 격자 6x4 + 왼쪽 장착 슬롯 4개
    static equipGeometry(vw, vh) {
      const w = 780;
      const h = 490;
      const x = (vw - w) / 2;
      const y = (vh - h) / 2;
      const cell = 64;
      const gap = 8;
      const cols = 6;
      const rows = 4;
      const gx = x + w - 28 - (cols * cell + (cols - 1) * gap);
      const gy = y + 84;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) cells.push({ x: gx + c * (cell + gap), y: gy + r * (cell + gap), w: cell, h: cell });
      }
      const slot = (i) => ({ x: x + 24, y: y + 84 + i * 80, w: 64, h: 64 });
      return {
        panel: { x, y, w, h }, cols, rows, cells,
        slots: { weapon: slot(0), helmet: slot(1), armor: slot(2), gloves: slot(3), boots: slot(4) },
        hero: { x: x + 206, y: y + 232 },
        info: { x: gx, y: gy + rows * (cell + gap) + 4, w: cols * cell + (cols - 1) * gap, h: 62 },
      };
    }

    // 인벤토리 창: 네모 칸 격자에 가진 장비가 들어 있고, 왼쪽 슬롯 4개(무기/갑옷/장갑/신발)에 낀 장비와 용사 모습이 보인다.
    // 방향키/마우스로 고르고 E/Enter/클릭으로 장착, 1/Esc로 닫는다
    _drawEquip(ctx, e) {
      ctx.save();
      const geo = Renderer.equipGeometry(this.viewW, this.viewH);
      const { x, y, w, h } = geo.panel;
      const eq = e.inv.equipped;
      const defs = G.Shop.ITEMS;
      const isEquipped = (id) => !!id && eq[defs[id].slot] === id;
      const entries = G.Shop.gridEntries(e.inv); // 장비 + 물약(개수)
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.fillStyle = '#1d2233';
      ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e0b12f';
      ctx.strokeRect(x, y, w, h);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText('인벤토리', x + 28, y + 36);
      ctx.textAlign = 'right';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${e.coins} G`, x + w - 28, y + 36);

      // 왼쪽: 장착 슬롯 4개 + 용사
      for (const slot of Object.keys(geo.slots)) {
        const sl = geo.slots[slot];
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#9aa4c0';
        ctx.fillText(G.Shop.SLOT_NAMES[slot], sl.x, sl.y - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(sl.x, sl.y, sl.w, sl.h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = eq[slot] ? '#7dffa0' : 'rgba(255,255,255,0.2)';
        ctx.strokeRect(sl.x, sl.y, sl.w, sl.h);
        if (eq[slot]) this._drawItemIcon(ctx, defs[eq[slot]], sl.x + sl.w / 2, sl.y + sl.h / 2, 0.8);
        else {
          ctx.textAlign = 'center';
          ctx.font = '13px sans-serif';
          ctx.fillStyle = '#555d75';
          ctx.fillText('비어 있음', sl.x + sl.w / 2, sl.y + sl.h / 2);
        }
      }
      ctx.save(); // 용사 미리보기 (낀 장비가 그대로 보인다)
      ctx.translate(geo.hero.x, geo.hero.y);
      ctx.scale(3, 3);
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      G.Hero.draw(ctx, { x: -12, y: -32, w: 24, h: 32, facing: 1, vx: 0, onGround: true, animTime: t, runPhase: 0, swing: -1, swordOut: false, guardTimer: 0, weaponId: eq.weapon, armorId: eq.armor, helmetId: eq.helmet, glovesId: eq.gloves, bootsId: eq.boots });
      ctx.restore();
      const st = G.Shop.stats(e.inv);
      const C = G.Config;
      const lines = [
        `피 ${e.lives} / ${e.maxLives}`,
        `패링 범위 ${st.reachTiles}칸`,
        `피격 후 무적 ${(C.PLAYER_INVULN + st.invulnAdd).toFixed(1)}초`,
        `패링 지속 ${(C.PARRY_WINDOW + st.windowAdd).toFixed(2)}초`,
        `패링 쿨다운 ${Math.max(0.25, C.PARRY_COOLDOWN + st.cooldownAdd).toFixed(1)}초`,
        st.canThrow ? `던지기 +${st.throwTiles}칸` : '던지기 불가 (대검)',
        `이동 속도 ${Math.round((1 + st.speedAdd) * 100)}%`,
      ];
      ctx.textAlign = 'left';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#d8e0f5';
      lines.forEach((l, i) => ctx.fillText(l, x + 112, y + 268 + i * 21));

      // 오른쪽: 아이템 칸 격자
      geo.cells.forEach((c, i) => {
        const entry = entries[i];
        const id = entry && entry.id;
        ctx.fillStyle = id ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isEquipped(id) ? '#7dffa0' : 'rgba(255,255,255,0.16)';
        ctx.strokeRect(c.x, c.y, c.w, c.h);
        if (id) {
          this._drawItemIcon(ctx, defs[id], c.x + c.w / 2, c.y + c.h / 2 + 2, 0.62);
          if (entry.count) { // 물약 개수
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(c.x + c.w - 24, c.y + c.h - 18, 22, 15);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`x${entry.count}`, c.x + c.w - 13, c.y + c.h - 10);
          }
          if (isEquipped(id)) { // 장착 표시 E
            ctx.fillStyle = '#7dffa0';
            ctx.fillRect(c.x + c.w - 17, c.y + 3, 14, 14);
            ctx.fillStyle = '#10261a';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('E', c.x + c.w - 10, c.y + 10.5);
          }
        }
      });
      const cur = geo.cells[e.cur];
      if (cur) { // 선택 칸
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffd54a';
        ctx.strokeRect(cur.x - 1, cur.y - 1, cur.w + 2, cur.h + 2);
      }

      // 선택한 아이템 설명 + 메시지
      const info = geo.info;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(info.x, info.y, info.w, info.h);
      const selId = entries[e.cur] && entries[e.cur].id;
      ctx.textAlign = 'left';
      if (e.msgT > 0) {
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = e.ok ? '#7dffa0' : '#ff8a8a';
        ctx.fillText(e.msg, info.x + 14, info.y + info.h / 2);
      } else if (selId) {
        const d = G.Shop.describe(defs[selId]);
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${d.name}  (${d.slotName}${isEquipped(selId) ? ', 장착중' : ''})`, info.x + 14, info.y + 14);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#b8c2dc';
        ctx.fillText(d.desc, info.x + 14, info.y + 33);
        if (d.note) {
          ctx.fillStyle = '#9fe8a8';
          ctx.fillText(d.note, info.x + 14, info.y + 51);
        }
      } else {
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#6c7490';
        ctx.fillText('빈 칸', info.x + 14, info.y + info.h / 2);
      }
      ctx.textAlign = 'center';
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#9aa4c0';
      ctx.fillText('방향키/마우스: 선택     E / Enter / 클릭: 장착·물약 마시기     1 또는 Esc: 닫기', x + w / 2, y + h - 18);
      ctx.restore();
    }

    _drawTerrain(ctx, terrain, camera) {
      // 화면에 보이는 타일만 그린다
      const c0 = Math.max(0, Math.floor(camera.x / TILE));
      const c1 = Math.min(terrain.cols - 1, Math.floor((camera.x + this.viewW) / TILE));
      const r0 = Math.max(0, Math.floor(camera.y / TILE));
      const r1 = Math.min(terrain.rows - 1, Math.floor((camera.y + this.viewH) / TILE));

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (terrain.grid[r][c]) this.theme.drawTile(ctx, terrain, c, r);
        }
      }
    }

    // 보물 상자: 열리면 뚜껑이 젖혀지고 금빛이 새어 나온다 (open 0~1)
    _drawChest(ctx, ch) {
      const x = Math.round(ch.x);
      const y = Math.round(ch.y);
      const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      if (ch.open > 0) { // 금빛 후광
        const g = ctx.createRadialGradient(x + ch.w / 2, y + 4, 0, x + ch.w / 2, y + 4, 90);
        g.addColorStop(0, `rgba(255,225,110,${0.55 * ch.open})`);
        g.addColorStop(1, 'rgba(255,225,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 70, y - 90, ch.w + 140, 180);
      } else { // 닫혀 있을 땐 은은하게 깜빡이는 빛으로 위치를 알린다
        const a = 0.18 + 0.1 * Math.sin(t * 3);
        const g = ctx.createRadialGradient(x + ch.w / 2, y + 8, 0, x + ch.w / 2, y + 8, 60);
        g.addColorStop(0, `rgba(255,215,90,${a})`);
        g.addColorStop(1, 'rgba(255,215,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, y - 50, ch.w + 80, 110);
      }
      // 몸통
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(x, y + 8, ch.w, ch.h - 8);
      ctx.fillStyle = '#935d2b';
      ctx.fillRect(x, y + 8, ch.w, 4);
      ctx.fillStyle = '#e0b12f'; // 금속 띠
      ctx.fillRect(x + 4, y + 8, 3, ch.h - 8);
      ctx.fillRect(x + ch.w - 7, y + 8, 3, ch.h - 8);
      if (ch.open > 0.2) { // 안의 금화
        ctx.fillStyle = '#ffd54a';
        ctx.fillRect(x + 3, y + 7, ch.w - 6, 4);
        ctx.fillStyle = '#fff4b8';
        ctx.fillRect(x + 7, y + 5, 5, 3);
        ctx.fillRect(x + 16, y + 6, 4, 3);
      }
      // 뚜껑: 힌지(뒤쪽 위)를 축으로 열림
      ctx.save();
      ctx.translate(x + ch.w, y + 8);
      ctx.rotate(ch.open * 1.9);
      ctx.translate(-ch.w, -8);
      ctx.fillStyle = '#8a5428';
      ctx.fillRect(0, 0, ch.w, 8);
      ctx.fillStyle = '#a66a33';
      ctx.fillRect(0, 0, ch.w, 3);
      ctx.fillStyle = '#e0b12f';
      ctx.fillRect(4, 0, 3, 8);
      ctx.fillRect(ch.w - 7, 0, 3, 8);
      ctx.restore();
      if (ch.open === 0) { // 자물쇠
        ctx.fillStyle = '#ffd54a';
        ctx.fillRect(x + ch.w / 2 - 3, y + 8, 6, 6);
      }
    }

    _drawPlayer(ctx, p) {
      if (p.dashTrail && p.dashTrail.length) { // 대시 잔상: 지나온 자리에 흐릿한 용사
        const life = G.Config.DASH_TRAIL;
        for (const g of p.dashTrail) {
          ctx.globalAlpha = 0.55 * (g.t / life);
          G.Hero.draw(ctx, Object.assign({}, p, { x: g.x, y: g.y, facing: g.facing }));
        }
        ctx.globalAlpha = 1;
      }
      // 무적 중엔 깜빡인다
      const shadow = p.shadowTime > 0; // 그림자 단검: 흐릿하게 (피격 깜빡임과 구분)
      const blink = !shadow && p.invuln > 0 && Math.floor(p.invuln / 0.08) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.3;
      if (shadow) ctx.globalAlpha = 0.4;
      this._paintPlayer(ctx, p);
      ctx.globalAlpha = 1;
    }

    _paintPlayer(ctx, p) {
      G.Hero.draw(ctx, p);
    }

    _drawMonster(ctx, s) {
      if (s.flying) {
        // 튕겨난 몬스터: 몸 중심 기준으로 빙글 회전
        ctx.save();
        ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
        ctx.rotate(s.spin);
        ctx.translate(-(s.x + s.w / 2), -(s.y + s.h / 2));
        this._drawMonsterBody(ctx, s);
        ctx.restore();
        return;
      }
      this._drawMonsterBody(ctx, s);
    }

    _paintMonster(ctx, m) {
      if (m.kind === 'bat') this._paintBat(ctx, m);
      else if (m.kind === 'crab') this._paintCrab(ctx, m);
      else this._paintSlime(ctx, m);
      if (m.staggered > 0) this._drawDazed(ctx, m);
      if (m.poison) this._drawPoisoned(ctx, m);
      if (m.burn) this._drawBurning(ctx, m);
      if (m.frozen) this._drawFrozen(ctx, m);
    }

    // 화상: 몸에 불꽃이 일렁인다
    _drawBurning(ctx, m) {
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      ctx.fillStyle = 'rgba(255,90,30,0.22)';
      ctx.fillRect(m.x, m.y, m.w, m.h);
      for (let i = 0; i < 3; i++) {
        const fx = m.x + m.w * (0.2 + 0.3 * i);
        const h = 10 + Math.sin(t * 14 + i * 2) * 4;
        ctx.fillStyle = i === 1 ? '#ffd24a' : '#ff7a2a';
        ctx.beginPath();
        ctx.moveTo(fx - 4, m.y + 4);
        ctx.quadraticCurveTo(fx - 3, m.y - h * 0.5, fx, m.y - h);
        ctx.quadraticCurveTo(fx + 3, m.y - h * 0.5, fx + 4, m.y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 동결: 몸이 얼음 덩어리에 갇힌다
    _drawFrozen(ctx, m) {
      ctx.fillStyle = 'rgba(170,225,255,0.55)';
      ctx.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
      ctx.strokeStyle = 'rgba(235,250,255,0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m.x + 2, m.y + m.h - 2); ctx.lineTo(m.x + m.w * 0.45, m.y + 3);
      ctx.moveTo(m.x + m.w * 0.55, m.y + m.h - 2); ctx.lineTo(m.x + m.w - 3, m.y + m.h * 0.35);
      ctx.stroke();
    }

    // 독에 걸림: 몸이 초록빛으로 물들고 거품이 올라온다
    _drawPoisoned(ctx, m) {
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      ctx.fillStyle = 'rgba(80,220,100,0.3)';
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle = 'rgba(150,255,140,0.85)';
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.6 + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(m.x + m.w * (0.2 + 0.3 * i) + Math.sin(t * 6 + i) * 2, m.y + m.h - k * (m.h + 14), 2.4 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 기절 표시: 머리 위를 도는 노란 별 세 개 (사라지기 직전엔 깜빡인다)
    _drawDazed(ctx, m) {
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      if (m.staggered < 0.6 && Math.floor(m.staggered / 0.08) % 2 === 0) return;
      const cx = m.x + m.w / 2;
      const top = m.y - (m.kind === 'crab' ? 10 : 8);
      ctx.fillStyle = '#ffe36b';
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        const sx = cx + Math.cos(a) * 12;
        const sy = top + Math.sin(a) * 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 1.5, sy - 1); ctx.lineTo(sx + 4, sy);
        ctx.lineTo(sx + 1.5, sy + 1.5); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 1.5, sy + 1.5);
        ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 1.5, sy - 1);
        ctx.closePath();
        ctx.fill();
      }
    }

    _drawMonsterBody(ctx, s) {
      // 부활 직후: 바닥(박쥐는 중심)에서 통통 튀며 커지는 연출
      if (s.appear > 0) {
        const t = 1 - s.appear / G.Config.SLIME_APPEAR_TIME;
        const k = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2); // easeOutBack
        const cx = s.x + s.w / 2;
        const by = s.kind === 'bat' ? s.y + s.h / 2 : s.y + s.h;
        ctx.save();
        ctx.translate(cx, by);
        ctx.scale(k, k);
        ctx.translate(-cx, -by);
        this._paintMonster(ctx, s);
        ctx.restore();
        return;
      }
      this._paintMonster(ctx, s);
    }

    _paintSlime(ctx, s) {
      // 바닥 중앙을 기준으로 가로/세로 배율을 적용한 젤리 몸체 (충돌 박스는 그대로)
      const cx = Math.round(s.x + s.w / 2);
      const bottom = Math.round(s.y + s.h);
      const bw = s.w * s.sx * 1.1;
      const bh = s.h * s.sy * 1.15;
      const left = cx - bw / 2;
      const right = cx + bw / 2;
      const shoulder = bottom - bh * 0.45;

      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(left, shoulder);
      ctx.quadraticCurveTo(cx, bottom - bh * 1.35, right, shoulder);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = s.flying && Math.floor(s.flightTime / 0.05) % 2 === 0 ? '#ffffff' : s.chasing ? '#f0558c' : '#4fd37f'; // 사라지기 직전엔 하얗게 번쩍
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.chasing ? '#b02a5c' : '#2c9b55';
      ctx.stroke();

      // 젤리 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx - bw * 0.2, bottom - bh * 0.78, bw * 0.12, bh * 0.1, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // 눈: 바라보는 쪽으로 쏠림
      const ex = cx + s.dir * bw * 0.12;
      const ey = bottom - bh * 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex - 7, ey - 4, 6, 7);
      ctx.fillRect(ex + 1, ey - 4, 6, 7);
      ctx.fillStyle = '#222';
      const px = s.dir > 0 ? 2 : 0;
      ctx.fillRect(ex - 7 + px, ey - 1, 3, 4);
      ctx.fillRect(ex + 1 + px, ey - 1, 3, 4);
    }

    // 박쥐: 날개를 퍼덕이며 날고, 예비동작/급강하 때는 눈이 붉게 변한다
    _paintBat(ctx, b) {
      const cx = Math.round(b.x + b.w / 2);
      const cy = Math.round(b.y + b.h / 2);
      const angry = b.state === 'windup' || b.state === 'dive';
      const flash = b.flying && Math.floor(b.flightTime / 0.05) % 2 === 0;
      const dive = b.state === 'dive';
      const wing = dive ? 1.0 : Math.sin(b.flap) * 0.9; // 급강하 땐 날개를 접음
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.dir >= 0 ? 1 : -1, 1);
      const body = flash ? '#ffffff' : angry ? '#8a3f96' : '#6a52a0';
      const membrane = flash ? '#ffffff' : angry ? '#a8416f' : '#7f64bd';
      // 날개 (몸 뒤/앞 양쪽)
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 5, -2);
        ctx.rotate(side * (-0.35 - wing * 0.6));
        ctx.fillStyle = membrane;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(side * 20, -9 - wing * 4);
        ctx.lineTo(side * 15, 0);
        ctx.lineTo(side * 19, 6);
        ctx.lineTo(side * 8, 4);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(20,12,40,0.8)';
        ctx.stroke();
        ctx.restore();
      }
      // 몸통 + 귀
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, -5); ctx.lineTo(-5, -12); ctx.lineTo(-1, -6);
      ctx.moveTo(6, -5); ctx.lineTo(5, -12); ctx.lineTo(1, -6);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(20,12,40,0.8)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 눈 + 송곳니
      ctx.fillStyle = angry ? '#ff4d4d' : '#ffe36b';
      ctx.fillRect(-5, -3, 3, 3);
      ctx.fillRect(2, -3, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, 3, 2, 3);
      ctx.fillRect(1, 3, 2, 3);
      ctx.restore();
    }

    // 꽃게: 옆걸음 다리, 눈자루, 두 집게. 예비동작엔 집게를 번쩍 들고 눈이 붉어지며, 돌진 땐 집게를 앞으로 내민다
    _paintCrab(ctx, c) {
      const windup = c.state === 'windup';
      const dash = c.state === 'dash';
      const flash = c.flying && Math.floor(c.flightTime / 0.05) % 2 === 0;
      const shell = flash ? '#ffffff' : windup || dash ? '#ea4a2e' : '#e2693a';
      const dark = flash ? '#ffffff' : '#a8321c';
      const walking = Math.abs(c.vx) > 5;
      ctx.save();
      ctx.translate(Math.round(c.x + c.w / 2), Math.round(c.y + c.h));
      ctx.scale(c.dir >= 0 ? 1 : -1, 1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { // 다리 3쌍 (걸을 때 번갈아 움직임)
        for (const side of [-1, 1]) {
          const ph = walking ? Math.sin(c.time * (dash ? 40 : 18) + i * 2 + (side > 0 ? Math.PI : 0)) * 2.5 : 0;
          ctx.beginPath();
          ctx.moveTo(side * (5 + i * 3), -8);
          ctx.lineTo(side * (10 + i * 4), -3 + ph);
          ctx.lineTo(side * (11 + i * 4), 0);
          ctx.stroke();
        }
      }
      // 집게 팔 + 집게
      const snap = windup ? 0.15 : 0.35 + 0.3 * Math.sin(c.time * 5);
      for (const side of [-1, 1]) {
        const fwd = dash ? 1 : side; // 돌진 땐 두 집게 모두 진행 방향으로
        const ax = windup ? side * 14 : fwd * (dash ? 15 : 17);
        const ay = windup ? -23 : dash ? -12 : -13;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(side * 9, -11);
        ctx.lineTo((side * 9 + ax) / 2, (-11 + ay) / 2 - 3);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.fillStyle = shell;
        ctx.beginPath();
        ctx.arc(ax, ay, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark; // 집게의 벌어진 틈
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + fwd * 7, ay - 6 * snap - 1);
        ctx.lineTo(ax + fwd * 7, ay + 6 * snap + 1);
        ctx.closePath();
        ctx.fill();
      }
      // 몸통 + 등딱지 하이라이트
      ctx.fillStyle = shell;
      ctx.beginPath();
      ctx.ellipse(0, -10, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = dark;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-4, -13, 5, 2.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // 눈자루 + 눈
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 4, -16);
        ctx.lineTo(side * 5, -21);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(side * 5, -22, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = windup || dash ? '#e01818' : '#222';
        ctx.fillRect(side * 5 - 1, -23, 2.5, 3);
      }
      ctx.lineCap = 'butt';
      ctx.restore();
    }

    _inView(o, camera) {
      const m = 64;
      return o.x + o.w > camera.x - m && o.x < camera.x + this.viewW + m && o.y + o.h > camera.y - m && o.y < camera.y + this.viewH + m;
    }

    _drawHeart(ctx, x, y, size, filled) {
      const s = size;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.55, y - s * 0.1, x - s * 0.55, y + s * 0.25);
      ctx.bezierCurveTo(x - s * 0.55, y + s * 0.6, x, y + s * 0.8, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.55, y + s * 0.6, x + s * 0.55, y + s * 0.25);
      ctx.bezierCurveTo(x + s * 0.55, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.35);
      ctx.closePath();
      ctx.fillStyle = filled ? '#e8334a' : 'rgba(0,0,0,0.25)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = filled ? '#8f1427' : 'rgba(0,0,0,0.4)';
      ctx.stroke();
    }

    // 어두운 동굴 배경에서도 읽히도록 그림자를 깐 밝은 글씨
    _text(ctx, str, x, y) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(str, x + 1, y + 1);
      ctx.fillStyle = 'rgba(225,232,255,0.92)';
      ctx.fillText(str, x, y);
    }

    _drawHud(ctx, hud) {
      ctx.font = '16px sans-serif';
      ctx.textBaseline = 'top';
      ctx.font = '14px sans-serif';
      this._text(ctx, '←/→ 또는 A/D: 이동   Space/↑/W/Z: 점프   Shift(또는 X): 3칸 대시   Enter: 패링 (길게 눌러 게이지 채우고 떼기: 검 던지기)   R: 처음 위치로', 12, 10);
      ctx.font = '16px sans-serif';
      if (!hud) return;
      const test = '   [테스트] 0: 해변  9: 마을  7: 마을 동굴  8: 코인+1000   1: 장비';
      if (hud.summon) this._text(ctx, `슬라임 ${hud.slimeCount}마리  박쥐 ${hud.batCount || 0}마리   - 키: 슬라임 소환${test}`, 12, 32);
      else if (hud.monsterless) this._text(ctx, `몬스터가 없는 평화로운 마을${test}`, 12, 32);
      else if (hud.crabCount !== undefined) this._text(ctx, `꽃게 ${hud.crabCount}마리${test}`, 12, 32);

      // 목숨: 우측 상단 하트
      for (let i = 0; i < hud.maxLives; i++) {
        this._drawHeart(ctx, this.viewW - 28 - (hud.maxLives - 1 - i) * 34, 10, 26, i < hud.lives);
      }

      if (hud.coins !== undefined) this._drawCoinHud(ctx, hud.coins, hud.potions);
      if (hud.dialog) this._drawBottomText(ctx, hud.dialog.text, Math.min(1, hud.dialog.t / 0.3));
      else if (hud.prompt) this._drawBottomText(ctx, hud.prompt);
      if (hud.shop) this._drawShop(ctx, hud.shop);
      if (hud.equip) this._drawEquip(ctx, hud.equip);

      if (!hud.won && !hud.gameOver && !hud.shop && !hud.equip) this._text(ctx, hud.goal || '목표: 지도의 X, 동굴 맨 끝의 보물 상자를 찾아라', 12, 54);

      if (hud.won) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText('보물을 찾았다!', this.viewW / 2 + 3, this.viewH / 2 - 17);
        ctx.fillStyle = '#ffd54a';
        ctx.fillText('보물을 찾았다!', this.viewW / 2, this.viewH / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '22px sans-serif';
        ctx.fillText('동굴의 모험을 마친 용사는 큰 부자가 되었답니다.', this.viewW / 2, this.viewH / 2 + 34);
        if (hud.canRestart) ctx.fillText('Enter 키로 다시 시작', this.viewW / 2, this.viewH / 2 + 72);
        ctx.textAlign = 'start';
      }

      if (hud.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff4d63';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText('GAME OVER', this.viewW / 2, this.viewH / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '22px sans-serif';
        if (hud.canRestart) ctx.fillText('Enter 키로 다시 시작', this.viewW / 2, this.viewH / 2 + 38);
        ctx.textAlign = 'start';
      }
    }
  }

  G.Renderer = Renderer;
})(window.Game);
