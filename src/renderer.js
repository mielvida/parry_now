// 렌더러: 상태를 읽어 캔버스에 그리기만 한다. 게임 상태를 바꾸지 않는다.
(function (G) {
  const { TILE } = G.Config;
  // 움직이는 것의 좌표: SMOOTH_SPRITES면 그대로(반 도트 단위로 부드럽게), 아니면 정수로 맞춘다
  const sp = (v) => (G.Config.SMOOTH_SPRITES ? v : Math.round(v));
  // 슬라임 색: [평소, 쫓을 때, 평소 테두리, 쫓을 때 테두리]
  const SLIME_COLORS = {
    green: ['#4fd37f', '#f0558c', '#2c9b55', '#b02a5c'],
    ice: ['#7fd6ff', '#d6f1ff', '#3a8fc0', '#7fb4d6'],
    lava: ['#ff8a3a', '#ff4a2a', '#b04a10', '#8a1a10'],
    dark: ['#6a3aa0', '#c05a9a', '#2a1250', '#7a1a50'], // 다크월드의 어둠의 슬라임
  };

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
      // 픽셀 화면: 월드는 낮은 해상도 버퍼(게임 화면의 1/px)에 그린 뒤 보간 없이 정수배로 키운다
      this.px = Math.max(1, G.Config.PIXEL || 1);
      this.buffer = document.createElement('canvas');
      this.buffer.width = Math.round(viewW / this.px);
      this.buffer.height = Math.round(viewH / this.px);
      this.bctx = this.buffer.getContext('2d', { willReadFrequently: true });
      this.snapOn = true; // false인 동안 그리는 것은 도트 격자에 맞추지 않는다 (움직이는 캐릭터/몬스터용)
      this._snapRects(this.bctx);
    }

    // 버퍼에 그리는 사각형은 전부 버퍼 픽셀 경계에 딱 맞춘다 (반 픽셀로 번져 흐려지지 않게).
    // 회전된 그림(칼 등)은 그대로 둔다. 좌표를 사용자 공간으로 되돌려 넘기므로 그라데이션도 그대로 동작한다
    _snapRects(c) {
      const orig = c.fillRect.bind(c);
      c.fillRect = (x, y, w, h) => {
        const m = c.getTransform();
        if (!this.snapOn || m.b !== 0 || m.c !== 0 || m.a === 0 || m.d === 0) return orig(x, y, w, h);
        const x0 = Math.round(m.a * x + m.e);
        let x1 = Math.round(m.a * (x + w) + m.e);
        const y0 = Math.round(m.d * y + m.f);
        let y1 = Math.round(m.d * (y + h) + m.f);
        if (x1 === x0 && w !== 0) x1 = x0 + Math.sign(m.a * w); // 아주 얇은 선도 최소 1픽셀
        if (y1 === y0 && h !== 0) y1 = y0 + Math.sign(m.d * h);
        return orig((x0 - m.e) / m.a, (y0 - m.f) / m.d, (x1 - x0) / m.a, (y1 - y0) / m.d);
      };
    }

    // 색 단계를 거칠게 (옛날 게임 팔레트 느낌)
    _posterize(c) {
      const step = G.Config.POSTERIZE;
      if (!step) return;
      const img = c.getImageData(0, 0, this.buffer.width, this.buffer.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / step) * step;
        d[i + 1] = Math.round(d[i + 1] / step) * step;
        d[i + 2] = Math.round(d[i + 2] / step) * step;
      }
      c.putImageData(img, 0, 0);
    }

    // 캔버스 내부 해상도를 게임 화면의 s배로 한다 (화면을 크게 늘려도 글자와 그림이 또렷하도록)
    // s는 소수여도 된다 (화면에 실제로 차지하는 장치 픽셀에 정확히 맞추기 위해). 실제 배율은 캔버스 크기에서 다시 구한다
    setScale(s) {
      this.canvas.width = Math.max(1, Math.round(this.viewW * s));
      this.canvas.height = Math.max(1, Math.round(this.viewH * s));
      this.scale = this.canvas.width / this.viewW;
    }

    draw(terrain, player, camera, monsters = [], effects = null, hud = null, sword = null, extras = {}) {
      const main = this.ctx;
      const px = this.px;
      const time = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      const sh = effects ? effects.shakeOffset() : { x: 0, y: 0 };
      const camX = Math.round((camera.x - sh.x) / px) * px; // 카메라도 버퍼 픽셀에 맞춘다
      const camY = Math.round((camera.y - sh.y) / px) * px;
      G.TextLayer.clear();

      // ---- 1) 월드: 낮은 해상도 버퍼에 그린다 (좌표는 그대로 게임 단위) ----
      const ctx = this.bctx;
      ctx.setTransform(1 / px, 0, 0, 1 / px, 0, 0);
      this.theme.drawBackground(ctx, this.viewW, this.viewH, camera, time);
      ctx.save();
      ctx.translate(-camX, -camY);
      this.theme.drawCeiling(ctx, camera, this.viewW);
      if (this.theme.drawDecor) this.theme.drawDecor(ctx, terrain, camera, time); // 집/짐더미 (테마에 있을 때만): 땅과 캐릭터 뒤에 깔리는 장식
      if (extras.boss) extras.boss.drawBack(ctx); // 땅 뒤: 용암에서 올라오는 목
      this._drawTerrain(ctx, terrain, camera);
      this._drawGroundDecor(ctx, terrain, camera, time);
      this._drawCrystalSpots(ctx, terrain, time);
      if (extras.chest) (extras.chest.door ? this._drawDoor(ctx, extras.chest) : this._drawChest(ctx, extras.chest));
      if (extras.pickups) for (const p of extras.pickups) this._drawPickup(ctx, p, time);
      if (extras.enemyShots) for (const f of extras.enemyShots) this._drawEnemyShot(ctx, f);
      if (extras.boss) extras.boss.drawFront(ctx); // 머리, 꼬리, 화염구
      this._drawShadows(ctx, terrain, monsters, player, camera);
      const crisp = !G.Config.SMOOTH_SPRITES;
      this.snapOn = crisp; // 몬스터와 플레이어: 반 도트 단위로 부드럽게 움직인다
      for (const m of monsters) if (m.alive && this._inView(m, camera)) this._drawMonster(ctx, m); // 화면 밖은 그리지 않음 (대량 소환 대비)
      this._drawPlayer(ctx, player);
      this.snapOn = true;
      if (extras.npcs) for (const n of extras.npcs) G.Npc.draw(ctx, n.kind, n.x, n.y, n.facing, time, n.alpha);
      if (extras.cutscene) extras.cutscene.drawWorld(ctx); // 땅 위/들어 올린 병
      this.snapOn = crisp;
      G.Hero.drawCharge(ctx, player);
      if (sword) G.Hero.drawThrownSword(ctx, sword);
      if (effects) effects.draw(ctx);
      if (extras.magic) G.Magic.draw(ctx, extras.magic);
      this._drawPlayerLight(ctx, player, time);
      this._drawAmbient(ctx, camX, camY, time);
      this.snapOn = true;
      ctx.restore();
      this.theme.drawVignette(ctx, this.viewW, this.viewH);
      this._posterize(ctx);

      // ---- 2) 버퍼를 보간 없이 정수배로 키워 화면에 ----
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.imageSmoothingEnabled = this.px === 1; // 픽셀 화면이 꺼져 있으면 부드럽게
      main.drawImage(this.buffer, 0, 0, this.buffer.width, this.buffer.height, 0, 0, this.canvas.width, this.canvas.height);

      // ---- 3) 글자와 인터페이스: 선명하게 (이후는 게임 좌표 960x576) ----
      main.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      main.save();
      main.translate(-camX, -camY);
      G.TextLayer.draw(main); // 월드 안의 간판 글자
      if (extras.popups) this._drawPopups(main, extras.popups); // 데미지/코인 숫자
      main.restore();
      if (effects) effects.drawOverlay(main, this.viewW, this.viewH);
      if (extras.cutscene) { // 컷신: 자막·확대 화면·암전. 게임 HUD는 숨긴다
        extras.cutscene.drawOverlay(main, this.viewW, this.viewH);
        return;
      }
      if (extras.ending) { // 엔딩: 코인 획득 -> 해변. 게임 HUD는 숨긴다
        extras.ending.drawOverlay(main, this.viewW, this.viewH);
        return;
      }
      if (extras.darken) this._drawDarkVillage(main, extras.darken, time);
      this._drawHud(main, hud);
      const windowOpen = !!(hud && (hud.equip || hud.shop || hud.dev || hud.mini));
      if (!windowOpen && hud && hud.caveInfo) this._drawCaveInfo(main, hud.caveInfo); // 동굴의 레벨과 상자 보상 // 인벤토리/상점/개발 메뉴가 열려 있으면 보스 체력 막대와 스태미나 막대는 숨긴다 (창과 겹치지 않게)
      if (!windowOpen && hud && hud.stamina !== undefined) this._drawStamina(main, hud);
      if (!windowOpen && hud && hud.boss) this._drawBossBars(main, hud.boss, hud.weakText);
      this._bottomBusy = !!(hud && (hud.dialog || hud.prompt)); // 자막이 겹치지 않게
      if (hud && hud.banner) this._drawStageBanner(main, hud.banner);
    }

    // 보스 체력: 머리마다 막대 (맞을 수 있는 머리는 노랗게)
    _drawBossBars(ctx, boss, weakText) {
      if (boss.kind === 'rival') { // 결투 상대: 보스바 대신 나처럼 하트 체력
        const h = boss.heads[0];
        const step = 32;
        const x0 = (this.viewW - step * (h.maxHp - 1)) / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 14px sans-serif';
        this._text(ctx, boss.name, this.viewW / 2, 140);
        for (let i = 0; i < h.maxHp; i++) this._drawHeart(ctx, x0 + i * step, 162, 24, i + 1 <= h.hp);
        return;
      }
      const n = boss.heads.length;
      const bw = n === 1 ? 420 : 250;
      const gap = 24;
      const x0 = (this.viewW - (bw * n + gap * (n - 1))) / 2;
      const y = 122;
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px sans-serif';
      boss.heads.forEach((h, i) => {
        const x = x0 + i * (bw + gap);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x - 2, y - 2, bw + 4, 20);
        ctx.fillStyle = '#3a0d08';
        ctx.fillRect(x, y, bw, 16);
        if (h.hp > 0) {
          ctx.fillStyle = h.state === 'down' || h.state === 'stun' ? '#ffd54a' : '#e2431f'; // 노랑 = 땅에 박혔거나 기절 (가장 좋은 기회)
          ctx.fillRect(x, y, (bw * h.hp) / h.maxHp, 16);
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(h.hp > 0 ? `${boss.name}${n > 1 ? ' ' + (i + 1) : ''}   ${h.hp} / ${h.maxHp}` : `${boss.name}${n > 1 ? ' ' + (i + 1) : ''}   쓰러짐`, x + bw / 2, y + 13);
      });
      if (weakText) { // 약점 속성 (돋보기가 있으면 이름이 보인다)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px sans-serif';
        const known = weakText.indexOf('?') < 0;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const tw = ctx.measureText(weakText).width + 16;
        ctx.fillRect(this.viewW / 2 - tw / 2, y + 22, tw, 20);
        ctx.fillStyle = known ? '#9fffb8' : '#9aa4c0';
        ctx.fillText(weakText, this.viewW / 2, y + 32);
      }
      ctx.textAlign = 'left';
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
        Renderer.drawCaption(ctx, this.viewW, this.viewH, b.caption, ca, this._bottomBusy ? 42 : 0); // 아래 자막(E: ...)이 있으면 그 위에 쌓는다
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

    // 집 안에서만: 놓은 장식품이 주는 보너스 (코인 획득량, 치명타 확률). 장식을 놓거나 치우면 바로 바뀐다
    _drawHomeHud(ctx, h) {
      ctx.save();
      const w = 232;
      const x = this.viewW - 14 - w;
      const y = 112;
      ctx.fillStyle = 'rgba(20,24,40,0.78)';
      ctx.fillRect(x, y, w, 92);
      ctx.strokeStyle = '#e0b12f';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, 92);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText('집 장식 보너스', x + 12, y + 16);
      ctx.textAlign = 'right';
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#b8c2dc';
      ctx.fillText(`장식 ${h.n} / ${h.total}개`, x + w - 12, y + 16);
      ctx.textAlign = 'left';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText(`코인 획득 +${Math.round(h.coin * 1000) / 10}%`, x + 12, y + 44);
      ctx.fillStyle = '#ff9a8a';
      ctx.fillText(`치명타 확률 ${Math.round(h.crit * 1000) / 10}%`, x + 12, y + 68);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#9aa4c0';
      ctx.textAlign = 'right';
      ctx.fillText(`(기본 1% + 장식)`, x + w - 12, y + 68);
      ctx.restore();
    }

    // 우측 상단 코인 표시
    _drawCoinHud(ctx, coins, potions, exp) {
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
      let ly = y + 24;
      if (exp > 0) { // 경험치 (보스를 쓰러뜨리면 얻는다)
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(`EXP ${exp}`, x + 1, ly + 1);
        ctx.fillStyle = '#96d7ff';
        ctx.fillText(`EXP ${exp}`, x, ly);
        ly += 20;
      }
      if (potions && potions.potion1 + potions.potion2 > 0) { // 가진 물약 (Q로 마신다)
        ctx.font = 'bold 14px sans-serif';
        const t = `물약  치유 ${potions.potion1} · 회복 ${potions.potion2}   (Q)`;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(t, x + 1, ly + 1);
        ctx.fillStyle = '#ffb3c0';
        ctx.fillText(t, x, ly);
      }
      ctx.restore();
    }

    // 대화/자막 칸: 글자 길이에 맞춘 작은 둥근 상자를 화면 아래 가운데에 (대화, 상호작용 안내, 연출 자막 공용)
    static drawCaption(ctx, viewW, viewH, text, alpha = 1, lift = 0) { // lift: 다른 자막이 이미 있을 때 그 위로 올려 그린다
      ctx.save();
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bw = Math.min(viewW - 40, ctx.measureText(text).width + 36);
      const bh = 32;
      const x = (viewW - bw) / 2;
      const y = viewH - 20 - bh - lift;
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
        tabs: hasTabs ? def.tabs.map((t, i) => { const step = Math.min(132, (w - 56) / def.tabs.length); return { x: x + 28 + i * step, y: y + 66, w: step - 12, h: 36 }; }) : [],
        rows: items.map((it, i) => ({ x: x + 20, y: y + top + i * rowH, w: w - 40, h: 72 })),
      };
    }

    // 아이템 아이콘 (cx, cy = 중심, s = 크기 배율). 무기 종류/단계, 갑옷, 장갑, 신발, 물약마다 모양과 색이 다르다
    _drawItemIcon(ctx, item, cx, cy, s) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      const L = item.look || [];
      if (item.house) { // 집
        G.Home.drawHouseIcon(ctx, item);
      } else if (item.decor) { // 가구/장식
        G.Home.drawDecorIcon(ctx, item, 0);
      } else if (item.clear) { // 치우기: 붉은 엑스
        ctx.strokeStyle = '#ff8a8a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-16, -16); ctx.lineTo(16, 16); ctx.moveTo(16, -16); ctx.lineTo(-16, 16); ctx.stroke();
        ctx.lineCap = 'butt';
      } else if (item.upgrade === 'crit') { // 치명타: 붉은 별 폭발과 검
        ctx.fillStyle = '#e8334a';
        ctx.beginPath();
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const rr = k % 2 ? 12 : 26; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd54a';
        ctx.beginPath();
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const rr = k % 2 ? 7 : 17; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      } else if (item.upgrade === 'stmax' || item.upgrade === 'stregen') { // 스태미나: 번개 병과 위 화살표
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-15, -4, 30, 26);
        ctx.fillStyle = L[0]; ctx.fillRect(-13, 0, 26, 22);
        ctx.fillStyle = '#e8f1ff'; ctx.fillRect(-6, -12, 12, 12);
        ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(-6, 13); ctx.lineTo(0, 13); ctx.lineTo(-3, 22); ctx.lineTo(7, 10); ctx.lineTo(1, 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1]; ctx.beginPath(); ctx.moveTo(24, -26); ctx.lineTo(34, -12); ctx.lineTo(28, -12); ctx.lineTo(28, 2); ctx.lineTo(20, 2); ctx.lineTo(20, -12); ctx.lineTo(14, -12); ctx.closePath(); ctx.fill();
      } else if (item.upgrade === 'speed') { // 마을 달리기: 신발과 속도선
        for (const dx of [-14, 2]) {
          ctx.fillStyle = L[0]; ctx.fillRect(dx, -14, 12, 22); ctx.fillRect(dx, 0, 20, 9);
          ctx.fillStyle = L[1]; ctx.fillRect(dx, 9, 20, 4);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 3; i++) ctx.fillRect(-34 - i * 3, -8 + i * 9, 14 + i * 4, 3);
      } else if (item.upgrade) { // 동굴 보상 업그레이드: 금화 더미와 위로 향한 화살표
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.ellipse(-8, 14 - i * 7, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.ellipse(-8, 11 - i * 7, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#7dffa0';
        ctx.beginPath(); ctx.moveTo(14, -22); ctx.lineTo(26, -6); ctx.lineTo(19, -6); ctx.lineTo(19, 14); ctx.lineTo(9, 14); ctx.lineTo(9, -6); ctx.lineTo(2, -6); ctx.closePath(); ctx.fill();
      } else if (item.tool) { // 약점 돋보기: 둥근 렌즈와 손잡이
        ctx.strokeStyle = L[1]; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(26, 26); ctx.stroke();
        ctx.fillStyle = L[1]; ctx.beginPath(); ctx.arc(-3, -3, 19, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.arc(-3, -3, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-9, -9, 5, 3, -0.7, 0, Math.PI * 2); ctx.fill();
        ctx.lineCap = 'butt';
      } else if (item.quest) { // 어둠의 크리스탈: 보랏빛 육각 수정과 빛
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
        g.addColorStop(0, 'rgba(190,140,255,0.7)'); g.addColorStop(1, 'rgba(120,60,200,0)');
        ctx.fillStyle = g; ctx.fillRect(-32, -32, 64, 64);
        ctx.fillStyle = L[1];
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(16, -10); ctx.lineTo(12, 18); ctx.lineTo(0, 26); ctx.lineTo(-12, 18); ctx.lineTo(-16, -10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[0];
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(12, -9); ctx.lineTo(9, 15); ctx.lineTo(0, 22); ctx.lineTo(-9, 15); ctx.lineTo(-12, -9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(2, -8); ctx.lineTo(-3, 8); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
      } else if (item.heal !== undefined) { // 물약 병
        ctx.fillStyle = L[0]; ctx.fillRect(-11, -8, 22, 28);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-7, -4, 4, 18);
        ctx.fillStyle = '#e8f1ff'; ctx.fillRect(-5, -20, 10, 13);
        ctx.fillStyle = '#9a6b3c'; ctx.fillRect(-6, -27, 12, 7);
      } else if (item.consumable) { // 소모품 아이콘
        if (item.id === 'icebomb') {
          ctx.fillStyle = L[1]; ctx.beginPath(); ctx.arc(0, 4, 17, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = L[0]; ctx.beginPath(); ctx.arc(-4, 0, 6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#a66a33'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -12); ctx.quadraticCurveTo(10, -20, 7, -24); ctx.stroke();
          ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(7, -26, 5, 0, Math.PI * 2); ctx.fill();
        } else { // 스태미나: 병 안의 번개
          ctx.fillStyle = L[1]; ctx.fillRect(-11, -8, 22, 28);
          ctx.fillStyle = L[0]; ctx.fillRect(-8, -5, 16, 22);
          ctx.fillStyle = '#e8f1ff'; ctx.fillRect(-5, -20, 10, 13);
          ctx.fillStyle = '#9a6b3c'; ctx.fillRect(-6, -27, 12, 7);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(-5, 9); ctx.lineTo(0, 9); ctx.lineTo(-2, 17); ctx.lineTo(6, 4); ctx.lineTo(1, 4); ctx.closePath(); ctx.fill();
        }
      } else if (item.slot === 'weapon' && item.type === 'bomb') {
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.arc(0, 6, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(-5, 1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a66a33'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -9); ctx.quadraticCurveTo(10, -18, 7, -22); ctx.stroke();
        ctx.fillStyle = L[1]; ctx.beginPath(); ctx.arc(7, -24, 5, 0, Math.PI * 2); ctx.fill();
      } else if (item.slot === 'weapon' && item.type === 'gun') {
        ctx.fillStyle = '#4a2f1a'; ctx.fillRect(-14, 0, 10, 20);
        ctx.fillStyle = L[0]; ctx.fillRect(-18, -12, 40, 12);
        ctx.fillStyle = L[1]; ctx.fillRect(-18, -4, 40, 4);
        ctx.fillStyle = '#2a2f3a'; ctx.fillRect(18, -14, 8, 16);
      } else if (item.slot === 'weapon' && item.type === 'bow') {
        ctx.strokeStyle = L[0]; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-6, 0, 28, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
        ctx.strokeStyle = L[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -20); ctx.lineTo(12, 20); ctx.stroke();
        ctx.fillStyle = '#c9d2dc'; ctx.fillRect(-14, -1.5, 36, 3);
      } else if (item.slot === 'weapon' && item.type === 'shield') {
        ctx.fillStyle = L[1]; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-3, -13, 6, 26); ctx.fillRect(-13, -3, 26, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(-8, -8, 6, 0, Math.PI * 2); ctx.fill();
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
      } else if (item.slot === 'weapon' && item.type === 'scythe') {
        ctx.rotate(-0.5);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-2, -36, 5, 70);
        ctx.fillStyle = L[0];
        ctx.beginPath(); ctx.moveTo(1, -36); ctx.quadraticCurveTo(30, -50, 36, -20); ctx.quadraticCurveTo(24, -36, 1, -26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1];
        ctx.beginPath(); ctx.moveTo(1, -30); ctx.quadraticCurveTo(22, -38, 33, -20); ctx.quadraticCurveTo(20, -30, 1, -26); ctx.closePath(); ctx.fill();
      } else if (item.slot === 'weapon' && item.type === 'spear') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-2, -34, 4, 74);
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.moveTo(0, -54); ctx.lineTo(-7, -34); ctx.lineTo(7, -34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1]; ctx.fillRect(0, -50, 3, 16);
        ctx.fillStyle = '#c0504d'; ctx.fillRect(-4, -34, 8, 4);
      } else if (item.slot === 'weapon' && item.type === 'axe') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-2, -30, 4, 68);
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.moveTo(2, -34); ctx.quadraticCurveTo(26, -42, 26, -18); ctx.quadraticCurveTo(26, -8, 2, -14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1]; ctx.beginPath(); ctx.moveTo(12, -36); ctx.quadraticCurveTo(24, -30, 22, -20); ctx.quadraticCurveTo(18, -26, 12, -24); ctx.closePath(); ctx.fill();
      } else if (item.slot === 'weapon' && item.type === 'hammer') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-2, -22, 4, 62);
        ctx.fillStyle = L[0]; ctx.fillRect(-17, -38, 34, 18);
        ctx.fillStyle = L[1]; ctx.fillRect(-17, -26, 34, 6);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-17, -38, 34, 3);
      } else if (item.slot === 'weapon' && item.type === 'katana') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#3a2a4a'; ctx.fillRect(-3, 12, 6, 18);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-9, 8, 18, 4);
        ctx.fillStyle = L[0]; ctx.beginPath(); ctx.moveTo(-3, 8); ctx.quadraticCurveTo(-8, -20, 8, -44); ctx.lineTo(8, -38); ctx.quadraticCurveTo(2, -16, 3, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1]; ctx.fillRect(1, -20, 2, 26);
      } else if (item.slot === 'weapon' && item.type === 'rapier') {
        ctx.rotate(-0.8);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-2.5, 14, 5, 16);
        ctx.strokeStyle = '#e0b12f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 12, 11, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = L[0]; ctx.fillRect(-2, -42, 4, 54);
        ctx.fillStyle = L[1]; ctx.fillRect(0, -42, 2, 54);
        ctx.beginPath(); ctx.moveTo(-2, -42); ctx.lineTo(0, -50); ctx.lineTo(2, -42); ctx.closePath(); ctx.fillStyle = L[0]; ctx.fill();
      } else if (item.slot === 'weapon' && item.type === 'whip') {
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-20, 10, 14, 6);
        ctx.strokeStyle = L[0]; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6, 13); ctx.quadraticCurveTo(14, -34, 24, -8); ctx.quadraticCurveTo(30, 6, 14, 16); ctx.stroke();
        ctx.strokeStyle = L[1]; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, 12); ctx.quadraticCurveTo(14, -32, 24, -7); ctx.stroke();
        ctx.lineCap = 'butt';
      } else if (item.slot === 'weapon' && item.type === 'crossbow') {
        ctx.fillStyle = '#6b4423'; ctx.fillRect(-26, -4, 52, 8);
        ctx.fillStyle = L[0]; ctx.fillRect(10, -24, 6, 48);
        ctx.strokeStyle = L[1]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12, -24); ctx.lineTo(-10, 0); ctx.lineTo(12, 24); ctx.stroke();
        ctx.fillStyle = '#c9d2dc'; ctx.fillRect(-10, -1.5, 34, 3);
      } else if (item.slot === 'weapon' && item.type === 'shotgun') {
        ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-6, -4); ctx.lineTo(-6, 8); ctx.lineTo(-24, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L[1]; ctx.fillRect(-8, -7, 38, 9);
        ctx.fillStyle = L[0]; ctx.fillRect(-8, -7, 38, 3);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(2, 2, 14, 5);
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
      } else if (item.slot === 'pants') { // 바지: 허리띠와 두 가닥 다리
        ctx.fillStyle = L[0];
        ctx.fillRect(-18, -24, 36, 13);
        ctx.fillRect(-18, -12, 16, 38); ctx.fillRect(2, -12, 16, 38);
        ctx.fillStyle = L[1];
        ctx.fillRect(-18, -24, 36, 4);
        ctx.fillRect(-2, -12, 4, 18);
        ctx.fillRect(-18, 20, 16, 6); ctx.fillRect(2, 20, 16, 6);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(-3, -24, 6, 5);
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
      ctx.fillText(s.def.exp ? `보유 ${s.exp} EXP   피 ${s.lives}/${s.maxLives}` : `보유 ${s.coins} G   피 ${s.lives}/${s.maxLives}`, x + w - 28, y + 36);
      geo.tabs.forEach((t, i) => { // 탭 (클릭해서 전환)
        const on = i === s.tab;
        ctx.fillStyle = on ? '#e0b12f' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.textAlign = 'center';
        ctx.font = `bold ${s.def.tabs.length > 6 ? 15 : 18}px sans-serif`;
        ctx.fillStyle = on ? '#1d2233' : '#b8c2dc';
        ctx.fillText(s.def.tabs[i].name, t.x + t.w / 2, t.y + t.h / 2 + 1);
      });
      items.forEach((it, i) => {
        const row = geo.rows[i];
        const d = G.Shop.describe(it, s.inv);
        const price = G.Shop.priceOf(it, s.inv);
        const maxed = G.Shop.upMaxed(it, s.inv);
        const placing = s.mode === 'place'; // 꾸미기 창: 가격 대신 놓기/치우기
        const lives_here = !!it.house && s.inv.home.type === it.id;
        const owned = maxed || lives_here || (!!(it.slot || it.tool) && s.inv.items.includes(it.id));
        const afford = it.upgrade === 'holy' ? (s.inv.materials.holycrystal || 0) >= 1 : (it.expCost ? s.exp : s.coins) >= price;
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
        ctx.fillStyle = placing ? (it.id === s.slotItem ? '#8a93a8' : '#7dffa0') : owned ? '#8a93a8' : afford ? '#ffd54a' : '#ff6b7a';
        const label = placing ? (it.clear ? '치우기' : it.id === s.slotItem ? '놓여 있음' : '놓기') : maxed ? '최고 레벨' : lives_here ? '거주 중' : owned ? '보유 중' : it.upgrade === 'holy' ? '크리스탈 1개' : it.expCost ? `${price} EXP` : `${price} G`;
        const twoLine = it.heal !== undefined || it.consumable || (it.decor && !it.clear);
        ctx.fillText(label, row.x + row.w - 16, row.y + row.h / 2 - (twoLine ? 8 : 0));
        if (twoLine) { // 물약/장식품은 가진 개수를 보여준다
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#b8c2dc';
          const cnt = it.heal !== undefined ? `보유 ${s.inv.potions[it.id]}개` : it.consumable ? `보유 ${s.inv.consumables[it.id] || 0}개` : placing ? `남은 ${G.Shop.decorLeft(s.inv, it.id)}개` : `보유 ${s.inv.home.owned[it.id] || 0}개`;
          ctx.fillText(cnt, row.x + row.w - 16, row.y + row.h / 2 + 16);
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

    // 인벤토리 창의 칸 배치 (그리기와 마우스 판정이 같이 쓴다).
    // 오른쪽: 분류 탭 5개 + 8x5 칸 격자(스크롤) + 설명 / 왼쪽: 장착 슬롯 5개와 용사
    static equipGeometry(vw, vh) {
      const w = 920;
      const h = 540;
      const x = (vw - w) / 2;
      const y = (vh - h) / 2;
      const cell = 56;
      const gap = 8;
      const cols = 8;
      const rows = 5;
      const gridW = cols * cell + (cols - 1) * gap;
      const gx = x + w - 40 - gridW;
      const gy = y + 124;
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) cells.push({ x: gx + c * (cell + gap), y: gy + r * (cell + gap), w: cell, h: cell });
      }
      const tabs = [0, 1, 2, 3, 4].map((i) => ({ x: gx + i * (gridW / 5), y: y + 56, w: gridW / 5 - 6, h: 30 }));
      const chip = (i, n) => { const cw = Math.min(76, 776 / Math.max(1, n)); return { x: x + 104 + i * cw, y: y + 92, w: cw - 3, h: 24 }; }; // 종류 버튼 i번째 (모두 n개)
      const sort = { x: x + w - 300, y: y + 10, w: 150, h: 34 }; // 정렬 버튼
      const quick = [0, 1, 2, 3, 4].map((i) => ({ x: gx + i * 46, y: y + 10, w: 40, h: 40 })); // 빠른 무기 칸 1~5
      const slot = (i) => ({ x: x + 24, y: y + 82 + i * 72, w: 58, h: 58 });
      return {
        panel: { x, y, w, h }, cols, rows, cells, tabs, quick, sort, chip,
        slots: { weapon: slot(0), helmet: slot(1), armor: slot(2), gloves: slot(3), pants: slot(4), boots: slot(5) },
        hero: { x: x + 206, y: y + 232 },
        bar: { x: gx + gridW + 10, y: gy, w: 10, h: rows * (cell + gap) - gap },
        info: { x: gx, y: gy + rows * (cell + gap) + 2, w: gridW, h: 64 },
      };
    }

    // 인벤토리 창: 분류 탭(전체/무기/방어구/소모품/재료)과 스크롤되는 큰 칸 격자, 왼쪽에 장착 슬롯과 용사.
    // 방향키/마우스로 고르고 E/Enter/클릭으로 장착, 1~5 키로 무기 칸에 넣고, 휠로 스크롤, Tab으로 분류 바꾸기, I/Esc로 닫는다
    _drawEquip(ctx, e) {
      ctx.save();
      const geo = Renderer.equipGeometry(this.viewW, this.viewH);
      const { x, y, w, h } = geo.panel;
      const eq = e.inv.equipped;
      const defs = G.Shop.ITEMS;
      const isEquipped = (id) => !!id && eq[defs[id].slot] === id;
      const cats = G.Shop.CATEGORIES;
      const entries = G.Shop.gridEntries(e.inv, e.cat);
      const cols = geo.cols;
      const total = Math.max(e.cap, Math.ceil(entries.length / cols) * cols);
      const totalRows = Math.ceil(total / cols);
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
      ctx.fillText('인벤토리', x + 28, y + 34);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#9aa4c0';
      ctx.fillText(`${G.Shop.gridEntries(e.inv, 'all').length} / ${e.cap} 칸`, x + 150, y + 36);
      ctx.textAlign = 'right';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText(`${e.coins} G`, x + w - 28, y + 34);

      // 빠른 무기 칸 1~5: 고른 무기를 숫자 키(또는 이 칸 클릭)로 넣는다. 게임 중엔 숫자 키로 바로 바꿔 든다
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText('빠른 무기', geo.quick[0].x - 10, y + 30);
      geo.quick.forEach((q, i) => {
        const id = e.inv.hotbar[i];
        const on = id && id === eq.weapon;
        ctx.fillStyle = on ? 'rgba(255,213,74,0.25)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(q.x, q.y, q.w, q.h);
        ctx.lineWidth = on ? 2.5 : 1.5;
        ctx.strokeStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.28)';
        ctx.strokeRect(q.x, q.y, q.w, q.h);
        if (id && defs[id]) this._drawItemIcon(ctx, defs[id], q.x + q.w / 2, q.y + q.h / 2 + 1, 0.42);
        ctx.fillStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(String(i + 1), q.x + 3, q.y + 8);
      });
      // 정렬 버튼 (클릭 또는 Q): 기본 / 많이 쓴 순 / 레벨순 / 좋은 순 / 이름순
      {
        const sb = geo.sort;
        const sm = G.Shop.SORTS.find((q) => q.id === (e.inv.invSort || 'default')) || G.Shop.SORTS[0];
        ctx.fillStyle = 'rgba(111,208,255,0.16)';
        ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#6fd0ff';
        ctx.strokeRect(sb.x, sb.y, sb.w, sb.h);
        ctx.textAlign = 'center';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#c8ecff';
        ctx.fillText(`정렬: ${sm.name}  ▼`, sb.x + sb.w / 2, sb.y + sb.h / 2 + 1);
      }
      // 분류 탭
      geo.tabs.forEach((t, i) => {
        const on = cats[i].id === e.cat;
        ctx.fillStyle = on ? '#e0b12f' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = on ? '#1d2233' : '#b8c2dc';
        const n = G.Shop.gridEntries(e.inv, cats[i].id).length;
        ctx.fillText(`${cats[i].name} ${n}`, t.x + t.w / 2, t.y + t.h / 2 + 1);
      });

      // 종류 버튼: 무기 탭(검/대검/단검/낫/지팡이/폭탄/총/활/방패), 방어구 탭(갑옷/투구/장갑/신발)
      const subs = G.Shop.subList(e.inv, e.cat);
      if (subs.length) {
        const curSub = e.inv.invSub || 'all';
        subs.forEach((sb, i) => {
          const cr = geo.chip(i, subs.length);
          const on = sb.id === curSub;
          ctx.fillStyle = on ? '#6fd0ff' : 'rgba(255,255,255,0.08)';
          ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
          ctx.textAlign = 'center';
          ctx.font = cr.w < 60 ? 'bold 12px sans-serif' : 'bold 13px sans-serif';
          ctx.fillStyle = on ? '#0f2230' : '#b8c2dc';
          ctx.fillText(cr.w < 60 ? sb.name : `${sb.name} ${sb.n}`, cr.x + cr.w / 2, cr.y + cr.h / 2 + 1);
        });
      }
      // 왼쪽: 장착 슬롯 + 용사
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
      G.Hero.draw(ctx, { x: -12, y: -32, w: 24, h: 32, facing: 1, vx: 0, onGround: true, animTime: t, runPhase: 0, swing: -1, swordOut: false, guardTimer: 0, weaponId: eq.weapon, armorId: eq.armor, helmetId: eq.helmet, glovesId: eq.gloves, pantsId: eq.pants, bootsId: eq.boots });
      ctx.restore();
      const st = G.Shop.stats(e.inv);
      const C = G.Config;
      const lines = [
        `피 ${e.lives} / ${e.maxLives}`,
        `대미지 ${defs[eq.weapon].shot ? defs[eq.weapon].dmg + st.dmgBonus : st.baseDmg + st.bossBonus}`,
        `패링 범위 ${Math.round(st.reachTiles * 10) / 10}칸`,
        `피격 후 무적 ${(C.PLAYER_INVULN + st.invulnAdd).toFixed(1)}초`,
        `패링 지속 ${(C.PARRY_WINDOW + st.windowAdd).toFixed(2)}초`,
        `패링 쿨다운 ${Math.max(0.25, C.PARRY_COOLDOWN + st.cooldownAdd).toFixed(1)}초`,
        st.canThrow ? (st.throwTiles ? `던지기 +${st.throwTiles}칸` : '던지기 가능') : '던지기 불가',
        `이동 속도 ${Math.round((1 + st.speedAdd) * 100)}%`,
        `코인 획득 +${Math.round(e.bonus.coin * 100)}%  (집 장식 ${e.bonus.n}개)`,
        `치명타 확률 ${Math.round(e.bonus.crit * 1000) / 10}%  대미지 ${e.bonus.critDamage}`,
        `탑 보스 대미지 x${G.Shop.holyMult(e.inv)} (신성)`,
      ];
      ctx.textAlign = 'left';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#d8e0f5';
      lines.forEach((l, i) => ctx.fillText(l, x + 112, y + 262 + i * 20));

      // 오른쪽: 스크롤되는 칸 격자
      const first = e.scroll * cols;
      geo.cells.forEach((c, i) => {
        const gi = first + i;
        const entry = entries[gi];
        const id = entry && entry.id;
        ctx.fillStyle = id ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isEquipped(id) ? '#7dffa0' : 'rgba(255,255,255,0.16)';
        ctx.strokeRect(c.x, c.y, c.w, c.h);
        if (gi >= total) return;
        if (id) {
          this._drawItemIcon(ctx, defs[id], c.x + c.w / 2, c.y + c.h / 2 + 2, 0.55);
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
          if (defs[id].slot === 'weapon' && e.inv.wlevel && e.inv.wlevel[id] > 0) { // 강화한 무기: +레벨
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(c.x + 2, c.y + c.h - 17, 28, 15);
            ctx.fillStyle = '#7dd0ff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`+${e.inv.wlevel[id]}`, c.x + 5, c.y + c.h - 9.5);
          }
          const hb = e.inv.hotbar ? e.inv.hotbar.indexOf(id) : -1;
          if (hb >= 0) { // 무기 칸 번호
            ctx.fillStyle = '#ffd54a';
            ctx.fillRect(c.x + 3, c.y + 3, 15, 15);
            ctx.fillStyle = '#2a1d00';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(hb + 1), c.x + 10.5, c.y + 10.5);
          }
        }
      });
      const curLocal = e.cur - first;
      const cur = curLocal >= 0 && curLocal < geo.cells.length ? geo.cells[curLocal] : null;
      if (cur) { // 선택 칸
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffd54a';
        ctx.strokeRect(cur.x - 1, cur.y - 1, cur.w + 2, cur.h + 2);
      }
      // 스크롤바
      const bar = geo.bar;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      if (totalRows > geo.rows) {
        const th = Math.max(26, (bar.h * geo.rows) / totalRows);
        const ty = bar.y + ((bar.h - th) * e.scroll) / (totalRows - geo.rows);
        ctx.fillStyle = '#e0b12f';
        ctx.fillRect(bar.x, ty, bar.w, th);
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
        const d = G.Shop.describe(defs[selId], e.inv);
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${d.name}  (${d.slotName}${isEquipped(selId) ? ', 장착중' : ''})`, info.x + 14, info.y + 15);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#b8c2dc';
        ctx.fillText(d.desc, info.x + 14, info.y + 35);
        if (d.note) {
          ctx.fillStyle = '#9fe8a8';
          ctx.fillText(d.note, info.x + 14, info.y + 53);
        }
        const sv = G.Shop.sortValue(e.inv, selId); // 정렬 기준 값
        if (sv) {
          ctx.textAlign = 'right';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillStyle = '#6fd0ff';
          ctx.fillText(sv, info.x + info.w - 14, info.y + 15);
          ctx.textAlign = 'left';
        }
      } else {
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#6c7490';
        ctx.fillText('빈 칸', info.x + 14, info.y + info.h / 2);
      }
      if (e.drag && e.drag.active) { // 끌고 있는 무기: 놓을 수 있는 빠른 칸이 빛난다
        geo.quick.forEach((q) => {
          if (e.drag.x >= q.x && e.drag.x < q.x + q.w && e.drag.y >= q.y && e.drag.y < q.y + q.h) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#7dffa0';
            ctx.strokeRect(q.x - 2, q.y - 2, q.w + 4, q.h + 4);
          }
        });
        const g = ctx.createRadialGradient(e.drag.x, e.drag.y, 2, e.drag.x, e.drag.y, 40);
        g.addColorStop(0, 'rgba(255,230,140,0.45)'); g.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(e.drag.x - 40, e.drag.y - 40, 80, 80);
        this._drawItemIcon(ctx, defs[e.drag.id], e.drag.x, e.drag.y, 0.8);
      }
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#9aa4c0';
      ctx.fillText('방향키/마우스: 선택   휠: 스크롤   Tab: 분류   C: 종류   Q: 정렬   E·Enter·클릭: 장착/사용   무기를 끌어다 빠른 칸에 놓기 (1~5 키도 가능)   I·]·Esc: 닫기', x + w / 2, y + h - 14);
      ctx.restore();
    }

    // 개발 메뉴(F1): 스크롤되는 버튼 목록. 순간이동과 지급 버튼이 모여 있다
    static devGeometry(vw, vh, count, scroll) {
      const w = 620;
      const h = 520;
      const x = (vw - w) / 2;
      const y = (vh - h) / 2;
      const rowH = 44;
      const top = y + 74;
      const visible = Math.floor((h - 74 - 56) / rowH);
      const rows = [];
      for (let i = 0; i < visible; i++) {
        const idx = scroll + i;
        if (idx >= count) break;
        rows.push({ idx, x: x + 20, y: top + i * rowH, w: w - 56, h: rowH - 6 });
      }
      return { panel: { x, y, w, h }, rows, visible, bar: { x: x + w - 26, y: top, w: 10, h: visible * rowH - 6 } };
    }

    _drawDev(ctx, d) {
      ctx.save();
      const geo = Renderer.devGeometry(this.viewW, this.viewH, d.items.length, d.scroll);
      const { x, y, w, h } = geo.panel;
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.fillStyle = '#171c2b';
      ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#6fd0ff';
      ctx.strokeRect(x, y, w, h);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#9fe0ff';
      ctx.fillText('개발 메뉴  (F1)', x + 24, y + 34);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#7f8aa8';
      ctx.fillText('순간이동 · 아이템 지급 — 앞으로 모든 테스트 기능은 여기에 모인다', x + 24, y + 58);
      for (const r of geo.rows) {
        const it = d.items[r.idx];
        if (it.head) {
          ctx.fillStyle = 'rgba(111,208,255,0.16)';
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = '#9fe0ff';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(`▼ ${it.head}`, r.x + 12, r.y + r.h / 2);
          continue;
        }
        const on = r.idx === d.cur;
        ctx.fillStyle = on ? 'rgba(255,213,74,0.2)' : 'rgba(255,255,255,0.07)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.lineWidth = on ? 2.5 : 1;
        ctx.strokeStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.15)';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(it.label, r.x + 16, r.y + r.h / 2);
        if (it.hint) {
          ctx.textAlign = 'right';
          ctx.font = '13px sans-serif';
          ctx.fillStyle = '#8c97b8';
          ctx.fillText(it.hint, r.x + r.w - 14, r.y + r.h / 2);
          ctx.textAlign = 'left';
        }
      }
      const bar = geo.bar;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      if (d.items.length > geo.visible) {
        const th = Math.max(28, (bar.h * geo.visible) / d.items.length);
        const ty = bar.y + ((bar.h - th) * d.scroll) / (d.items.length - geo.visible);
        ctx.fillStyle = '#6fd0ff';
        ctx.fillRect(bar.x, ty, bar.w, th);
      }
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = d.msgT > 0 ? '#7dffa0' : 'rgba(0,0,0,0)';
      ctx.fillText(d.msg || '', x + w / 2, y + h - 40);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#8c97b8';
      ctx.fillText('↑↓ / 휠: 스크롤   Enter·클릭: 실행   F1·Esc: 닫기', x + w / 2, y + h - 18);
      ctx.restore();
    }

    // 왼쪽 맨 위 무기 칸 1~5: 숫자 키를 누르면 그 칸의 무기로 바꾼다
    _drawHotbar(ctx, hud) {
      const size = 44;
      const gap = 6;
      const defs = G.Shop.ITEMS;
      for (let i = 0; i < 5; i++) {
        const x = 12 + i * (size + gap);
        const y = 8;
        const id = hud.hotbar[i];
        const on = id && id === hud.weaponId;
        ctx.fillStyle = on ? 'rgba(255,213,74,0.28)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.lineWidth = on ? 3 : 1.5;
        ctx.strokeStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.3)';
        ctx.strokeRect(x, y, size, size);
        if (id && defs[id]) this._drawItemIcon(ctx, defs[id], x + size / 2, y + size / 2 + 1, 0.46);
        ctx.fillStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(i + 1), x + 4, y + 3);
      }
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

    // 땅 위의 작은 디테일: 풀, 꽃, 버섯, 눈 더미, 용암 균열, 보랏빛 룬, 종유석/고드름 (타일 좌표로 정해져 항상 같은 자리에 난다)
    _kindOfTheme() {
      const th = this.theme;
      return th === G.Snow ? 'snow' : th === G.Volcano ? 'volcano' : th === G.DarkTheme ? 'dark' : th === G.Cave ? 'cave' : th === G.Beach ? 'beach' : 'grass';
    }

    _drawGroundDecor(ctx, terrain, camera, time) {
      const kind = this._kindOfTheme();
      const c0 = Math.max(0, Math.floor(camera.x / TILE));
      const c1 = Math.min(terrain.cols - 1, Math.floor((camera.x + this.viewW) / TILE));
      const r0 = Math.max(0, Math.floor(camera.y / TILE));
      const r1 = Math.min(terrain.rows - 1, Math.floor((camera.y + this.viewH) / TILE));
      const solid = (c, r) => r >= 0 && r < terrain.rows && c >= 0 && c < terrain.cols && !!terrain.grid[r][c];
      ctx.save();
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!solid(c, r)) continue;
          const h0 = (Math.imul(c, 73856093) ^ Math.imul(r, 19349663)) >>> 0;
          const rnd = (k) => ((Math.imul(h0 ^ (k * 2246822519), 2654435761) >>> 0) % 10000) / 10000;
          const x0 = c * TILE;
          const y0 = r * TILE;
          if (!solid(c, r - 1)) { // 위가 트인 땅
            if (kind === 'grass') {
              for (let i = 0; i < 6; i++) { // 풀잎 (바람에 살랑)
                const bx = x0 + 2 + rnd(i) * (TILE - 4);
                const bh = 4 + rnd(i + 10) * 5;
                const sw = Math.sin(time * 2 + c * 0.7 + i) * 1.6;
                ctx.strokeStyle = i % 2 ? '#4fae45' : '#6ccf5a';
                ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(bx, y0 + 1); ctx.quadraticCurveTo(bx + sw * 0.5, y0 - bh * 0.6, bx + sw, y0 - bh); ctx.stroke();
              }
              if (rnd(20) < 0.16) { // 꽃
                const fx = x0 + 6 + rnd(21) * 20;
                const col = ['#ffd54a', '#ff7aa8', '#f4f1e8', '#9a8cff'][Math.floor(rnd(22) * 4)];
                ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(fx, y0 + 1); ctx.lineTo(fx, y0 - 8); ctx.stroke();
                ctx.fillStyle = col;
                for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 2.4, y0 - 9 + Math.sin(a) * 2.4, 1.8, 0, Math.PI * 2); ctx.fill(); }
                ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(fx, y0 - 9, 1.5, 0, Math.PI * 2); ctx.fill();
              } else if (rnd(23) < 0.07) { // 버섯
                const mx = x0 + 8 + rnd(24) * 16;
                ctx.fillStyle = '#f1e6d2'; ctx.fillRect(mx - 1.5, y0 - 5, 3, 6);
                ctx.fillStyle = '#d9473f'; ctx.beginPath(); ctx.arc(mx, y0 - 5, 5, Math.PI, 0); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(mx - 2, y0 - 8, 2, 2); ctx.fillRect(mx + 1, y0 - 7, 2, 2);
              }
            } else if (kind === 'beach') {
              for (let i = 0; i < 3; i++) { // 모래 위 조약돌과 마른 풀
                const bx = x0 + 3 + rnd(i) * (TILE - 8);
                if (rnd(i + 5) < 0.5) { ctx.fillStyle = i % 2 ? '#b8a27a' : '#d8c8a0'; ctx.beginPath(); ctx.ellipse(bx, y0 + 1, 3 + rnd(i + 8) * 2, 2, 0, Math.PI, 0); ctx.fill(); }
                else { ctx.strokeStyle = '#a89460'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx, y0 + 1); ctx.lineTo(bx + Math.sin(time * 2 + c + i) * 1.5, y0 - 5); ctx.stroke(); }
              }
              if (rnd(30) < 0.1) { // 불가사리
                const sx = x0 + 10 + rnd(31) * 12; ctx.fillStyle = '#f08a5a';
                for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(sx, y0 - 2); ctx.lineTo(sx + Math.cos(a) * 5, y0 - 2 + Math.sin(a) * 5); ctx.lineTo(sx + Math.cos(a + 0.5) * 2, y0 - 2 + Math.sin(a + 0.5) * 2); ctx.fill(); }
              }
            } else if (kind === 'snow') {
              ctx.fillStyle = '#ffffff';
              for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x0 + 6 + i * 10 + rnd(i) * 4, y0 + 1, 6 + rnd(i + 3) * 3, 3 + rnd(i + 6) * 2, 0, Math.PI, 0); ctx.fill(); }
              if (rnd(40) < 0.5) { // 반짝이는 눈 결정
                const a = 0.4 + 0.6 * Math.max(0, Math.sin(time * 3 + c * 1.7 + r));
                ctx.fillStyle = `rgba(190,235,255,${a})`; const sx = x0 + 6 + rnd(41) * 20; ctx.fillRect(sx, y0 - 3, 1.5, 1.5);
              }
              if (rnd(42) < 0.08) { // 눈 덮인 작은 바위
                ctx.fillStyle = '#9aa7b8'; ctx.beginPath(); ctx.arc(x0 + 14, y0 - 1, 4, Math.PI, 0); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + 14, y0 - 2, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
              }
            } else if (kind === 'volcano') {
              const pulse = 0.55 + 0.45 * Math.sin(time * 2.4 + c * 0.9 + r);
              ctx.strokeStyle = `rgba(255,${110 + pulse * 70},40,${0.5 + pulse * 0.4})`; ctx.lineWidth = 1.6;
              ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 3); ctx.lineTo(x0 + 10, y0 + 6); ctx.lineTo(x0 + 15, y0 + 3); ctx.lineTo(x0 + 24, y0 + 7); ctx.stroke(); // 빛나는 균열
              if (rnd(50) < 0.25) { ctx.fillStyle = `rgba(255,200,90,${pulse})`; ctx.fillRect(x0 + 6 + rnd(51) * 20, y0 - 2 - ((time * 12 + c * 5) % 8), 2, 2); } // 튀는 불똥
              if (rnd(52) < 0.18) { ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + 1); ctx.lineTo(x0 + 12, y0 - 6); ctx.lineTo(x0 + 18, y0 + 1); ctx.closePath(); ctx.fill(); } // 화산암
            } else if (kind === 'dark') {
              const pulse = 0.5 + 0.5 * Math.sin(time * 1.6 + c + r * 2);
              if (rnd(60) < 0.45) { // 보랏빛 룬
                ctx.strokeStyle = `rgba(190,130,255,${0.25 + pulse * 0.5})`; ctx.lineWidth = 1.4;
                const rx = x0 + 8 + rnd(61) * 12;
                ctx.beginPath(); ctx.moveTo(rx, y0 + 4); ctx.lineTo(rx + 3, y0 + 8); ctx.lineTo(rx + 6, y0 + 4); ctx.moveTo(rx + 3, y0 + 8); ctx.lineTo(rx + 3, y0 + 13); ctx.stroke();
              }
              if (rnd(62) < 0.12) { // 어둠의 수정 조각
                const kx = x0 + 6 + rnd(63) * 20; ctx.fillStyle = '#8a4fe0';
                ctx.beginPath(); ctx.moveTo(kx, y0 + 1); ctx.lineTo(kx + 2, y0 - 8); ctx.lineTo(kx + 5, y0 + 1); ctx.closePath(); ctx.fill();
                ctx.fillStyle = `rgba(230,200,255,${0.4 + pulse * 0.5})`; ctx.fillRect(kx + 2, y0 - 6, 1.5, 4);
              }
              if (rnd(64) < 0.08) { // 타오르는 작은 초
                const cx2 = x0 + 8 + rnd(65) * 16; ctx.fillStyle = '#d8d0c0'; ctx.fillRect(cx2, y0 - 7, 4, 8);
                ctx.fillStyle = `rgba(255,200,110,${0.7 + pulse * 0.3})`; ctx.beginPath(); ctx.ellipse(cx2 + 2, y0 - 10, 2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
              }
            } else { // 동굴
              if (rnd(70) < 0.5) { ctx.fillStyle = rnd(71) < 0.5 ? '#6f7686' : '#868ea0'; ctx.beginPath(); ctx.ellipse(x0 + 6 + rnd(72) * 20, y0 + 1, 3 + rnd(73) * 3, 2.5, 0, Math.PI, 0); ctx.fill(); } // 자갈
              if (rnd(74) < 0.35) { ctx.fillStyle = '#3f7a4a'; ctx.beginPath(); ctx.ellipse(x0 + 8 + rnd(75) * 16, y0 + 1, 7, 3, 0, Math.PI, 0); ctx.fill(); } // 이끼
              if (rnd(76) < 0.1) { // 푸른 수정
                const kx = x0 + 8 + rnd(77) * 16; const a = 0.7 + 0.3 * Math.sin(time * 2 + c);
                ctx.fillStyle = `rgba(120,225,255,${a})`;
                ctx.beginPath(); ctx.moveTo(kx, y0 + 1); ctx.lineTo(kx + 2, y0 - 9); ctx.lineTo(kx + 4, y0 + 1); ctx.closePath(); ctx.fill();
                ctx.beginPath(); ctx.moveTo(kx + 3, y0 + 1); ctx.lineTo(kx + 6, y0 - 5); ctx.lineTo(kx + 8, y0 + 1); ctx.closePath(); ctx.fill();
              }
            }
          }
          if (!solid(c, r + 1)) { // 아래가 트인 땅 (천장): 종유석, 고드름, 덩굴, 용암 방울
            if (kind === 'cave' || kind === 'snow' || kind === 'dark') {
              if (rnd(80) < 0.6) {
                const sx = x0 + 4 + rnd(81) * (TILE - 12);
                const len = 5 + rnd(82) * 10;
                ctx.fillStyle = kind === 'snow' ? 'rgba(200,238,255,0.92)' : kind === 'dark' ? '#3a2a5a' : '#6a7080';
                ctx.beginPath(); ctx.moveTo(sx, y0 + TILE - 1); ctx.lineTo(sx + 5, y0 + TILE - 1); ctx.lineTo(sx + 2.5, y0 + TILE - 1 + len); ctx.closePath(); ctx.fill();
                if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx + 1, y0 + TILE - 1, 1.5, len * 0.5); }
                if (kind !== 'snow' && rnd(83) < 0.4) { // 떨어지는 물방울
                  const ph = (time * 0.9 + rnd(84) * 5) % 2;
                  if (ph < 0.6) { ctx.fillStyle = kind === 'dark' ? 'rgba(190,150,255,0.85)' : 'rgba(150,200,255,0.85)'; ctx.fillRect(sx + 1.5, y0 + TILE + len + ph * 60, 2, 3); }
                }
              }
            } else if (kind === 'grass') {
              if (rnd(90) < 0.25) { // 늘어진 덩굴
                const vx = x0 + 6 + rnd(91) * 20; ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 1.5;
                const L = 8 + rnd(92) * 14; const sw = Math.sin(time * 1.5 + c) * 2;
                ctx.beginPath(); ctx.moveTo(vx, y0 + TILE - 1); ctx.quadraticCurveTo(vx + sw, y0 + TILE + L * 0.5, vx + sw * 1.5, y0 + TILE + L); ctx.stroke();
                ctx.fillStyle = '#5fcf5a'; ctx.beginPath(); ctx.ellipse(vx + sw * 1.2, y0 + TILE + L * 0.6, 3, 1.6, 0.5, 0, Math.PI * 2); ctx.fill();
              }
            } else if (kind === 'volcano') {
              if (rnd(95) < 0.25) { const lx = x0 + 6 + rnd(96) * 20; const ph = (time * 0.7 + rnd(97) * 4) % 2; ctx.fillStyle = 'rgba(255,140,40,0.9)'; ctx.fillRect(lx, y0 + TILE + ph * 40, 2.5, 4); }
            }
          }
        }
      }
      ctx.restore();
    }

    // 숲의 샘물과 화산의 신성의 제단 (크리스탈 만들기)
    _drawCrystalSpots(ctx, terrain, time) {
      for (const w of terrain.waters || []) {
        const cx = w.col * TILE + TILE / 2;
        const gy = (w.row + 1) * TILE;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, gy, 44, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7d8798'; ctx.beginPath(); ctx.ellipse(cx, gy - 5, 38, 11, 0, 0, Math.PI * 2); ctx.fill(); // 돌 테두리
        ctx.fillStyle = '#a4aebf'; ctx.beginPath(); ctx.ellipse(cx, gy - 8, 38, 9, 0, Math.PI, 0); ctx.fill();
        const g = ctx.createLinearGradient(0, gy - 14, 0, gy);
        g.addColorStop(0, '#9fe8ff'); g.addColorStop(1, '#3a9fd0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, gy - 6, 31, 7, 0, 0, Math.PI * 2); ctx.fill(); // 샘물
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        for (let k = 0; k < 2; k++) { const r = 6 + ((time * 14 + k * 11) % 22); ctx.globalAlpha = 1 - r / 28; ctx.beginPath(); ctx.ellipse(cx + (k ? 8 : -6), gy - 6, r, r * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
        for (let k = 0; k < 4; k++) { const ph = (time * 0.8 + k * 0.25) % 1; ctx.fillStyle = `rgba(200,240,255,${1 - ph})`; ctx.fillRect(cx - 14 + k * 9, gy - 12 - ph * 26, 2, 2); } // 튀는 물방울
        G.TextLayer.add('숲의 샘물', cx, gy - 54, 'bold 13px sans-serif', '#d6f4ff');
      }
      for (const a of terrain.altars || []) {
        const cx = a.col * TILE + TILE / 2;
        const gy = (a.row + 1) * TILE;
        const pulse = 0.6 + 0.4 * Math.sin(time * 3);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, gy, 40, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2e2424'; ctx.fillRect(cx - 30, gy - 14, 60, 14); // 제단 받침
        ctx.fillStyle = '#4a3838'; ctx.fillRect(cx - 22, gy - 34, 44, 20);
        ctx.fillStyle = '#6a5252'; ctx.fillRect(cx - 26, gy - 38, 52, 6);
        ctx.strokeStyle = `rgba(255,170,60,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2; // 빛나는 룬
        ctx.beginPath(); ctx.moveTo(cx - 12, gy - 28); ctx.lineTo(cx, gy - 20); ctx.lineTo(cx + 12, gy - 28); ctx.moveTo(cx, gy - 20); ctx.lineTo(cx, gy - 10); ctx.stroke();
        const gg = ctx.createRadialGradient(cx, gy - 58, 2, cx, gy - 58, 46); // 떠 있는 신성한 빛
        gg.addColorStop(0, `rgba(255,236,150,${0.55 * pulse})`); gg.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = gg; ctx.fillRect(cx - 46, gy - 104, 92, 92);
        const bob = Math.sin(time * 2) * 4;
        ctx.fillStyle = '#e0a82a'; ctx.beginPath(); ctx.moveTo(cx, gy - 74 + bob); ctx.lineTo(cx + 10, gy - 60 + bob); ctx.lineTo(cx + 6, gy - 44 + bob); ctx.lineTo(cx, gy - 40 + bob); ctx.lineTo(cx - 6, gy - 44 + bob); ctx.lineTo(cx - 10, gy - 60 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff2a8'; ctx.beginPath(); ctx.moveTo(cx, gy - 70 + bob); ctx.lineTo(cx + 6, gy - 60 + bob); ctx.lineTo(cx, gy - 46 + bob); ctx.lineTo(cx - 6, gy - 60 + bob); ctx.closePath(); ctx.fill();
        G.TextLayer.add('신성의 제단', cx, gy - 92, 'bold 13px sans-serif', '#ffe9a8');
      }
    }

    // 동굴에 들어가면 가운데 위에 동굴 레벨과 상자가 주는 돈을 보여준다
    _drawCaveInfo(ctx, info) {
      ctx.save();
      const w = 250;
      const h = 44;
      const x = (this.viewW - w) / 2;
      const y = 8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
      ctx.fillStyle = 'rgba(10,14,28,0.78)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,213,74,0.7)';
      ctx.stroke();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#9fe0ff';
      ctx.fillText(`동굴 Lv ${info.level}`, x + 14, y + h / 2 + 1);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText(`상자 +${info.coins} G`, x + w - 14, y + h / 2 + 1);
      ctx.restore();
    }

    // 놀이마당: 야바위 / 공 던지기 표적 맞추기 / 다른 용사와 결투
    _drawMini(ctx, m) {
      ctx.save();
      const W = this.viewW;
      const H = this.viewH;
      const px = 40;
      const py = 24;
      const pw = W - 80;
      const ph = H - 48;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1a1e2d';
      ctx.fillRect(px, py, pw, ph);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e0b12f';
      ctx.strokeRect(px, py, pw, ph);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#ffd54a';
      ctx.fillText({ shell: '야바위', target: '맞추기 (공 던지기)', duel: '다른 용사와 결투' }[m.kind], px + 24, py + 34);
      ctx.textAlign = 'right';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`보유 ${m.coins} G`, px + pw - 24, py + 34);
      if (m.st === 'bet') this._miniBet(ctx, m, px, py, pw, ph);
      else if (m.kind === 'shell') this._miniShell(ctx, m, px, py, pw, ph);
      else if (m.kind === 'target') this._miniTarget(ctx, m, px, py, pw, ph);
      else this._miniFight(ctx, m, px, py, pw, ph);
      ctx.textAlign = 'center';
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#9aa4c0';
      const hint = m.st === 'bet' ? (m.kind === 'target' ? 'Enter: 시작   Esc: 나가기' : `${m.kind === 'duel' ? '↑↓: 결투 종류   ' : ''}←→ 또는 1~3: 거는 돈   Enter: 시작   Esc: 나가기`)
        : m.st === 'result' ? 'Enter: 한 번 더   Esc: 나가기'
        : m.kind === 'target' ? '방향키: 조준   Enter: 공 던지기' : m.kind === 'shell' ? '←→: 컵 고르기   Enter: 열기' : '←→ 이동   Space 점프   ↓ 막기   Enter 공격';
      ctx.fillText(hint, W / 2, py + ph - 20);
      ctx.restore();
    }

    // 링 격투: 링 위에서 AI 용사와 싸운다
    _miniFight(ctx, m, px, py, pw, ph) {
      const gy = 430;
      const x0 = 170;
      const x1 = 790;
      const sky = ctx.createLinearGradient(0, py + 60, 0, gy);
      sky.addColorStop(0, '#1d2340'); sky.addColorStop(1, '#4a3a5a');
      ctx.fillStyle = sky; ctx.fillRect(px + 8, py + 60, pw - 16, gy - py - 60);
      for (let i = 0; i < 12; i++) { // 구경하는 마을 주민들 (모두 똑같은 모습)
        ctx.save(); ctx.translate(px + 60 + i * 56, gy - 14 - Math.max(0, Math.sin(m.t * 5 + i * 1.7)) * 4); ctx.scale(2.6, 2.6);
        G.Npc.draw(ctx, 'villager', 0, 0, i % 2 ? -1 : 1, m.t + i);
        ctx.restore();
      }
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(px + 8, gy, pw - 16, py + ph - gy - 8); // 링 바닥
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(px + 8, gy, pw - 16, 8);
      for (const [x, c1] of [[x0 - 24, '#c0392b'], [x1 + 24, '#3a6fb0']]) { // 모서리 기둥과 로프
        ctx.fillStyle = c1; ctx.fillRect(x - 7, gy - 170, 14, 176);
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 9, gy - 176, 18, 10);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; // 링 중앙의 표시
      ctx.fillRect((x0 + x1) / 2 - 2, gy + 2, 4, 14);
      const rv = m.rival;
      const draw = (f, facing, p, who) => {
        const hit = f.hitFx > 0;
        const swingF = f.atkT > 0 ? Math.min(19, Math.floor((1 - f.atkT / 0.32) * 19)) : (who === 'ai' && m.ai.state === 'wind' ? 3 : -1);
        ctx.save();
        ctx.translate(f.x, gy - f.y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, f.y, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.scale(facing * 3.6, 3.6);
        if (hit && Math.floor(m.t * 30) % 2) ctx.globalAlpha = 0.45;
        if (m.st === 'result' && ((who === 'pl') !== !!m.won)) ctx.globalAlpha = 0.55;
        G.Hero.draw(ctx, Object.assign({ x: -12, y: -32, w: 24, h: 32, facing: 1, vx: Math.abs(f.vx) > 40 ? 120 : 0, onGround: f.y === 0, animTime: m.t, runPhase: m.t * 12, swing: swingF, swordOut: false, guardTimer: (who === 'pl' ? f.guard : f.guard > 0) ? 0.2 : 0 }, p));
        ctx.restore();
      };
      draw(m.pl, m.pl.face, m.me || {}, 'pl');
      draw(m.ai, m.ai.face, { weaponId: rv.weapon, armorId: rv.armor, helmetId: rv.helmet, glovesId: null, bootsId: null }, 'ai');
      // 체력 막대
      const bar = (x, w, hp, max, color, label, right) => {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 3, py + 66, w + 6, 24);
        ctx.fillStyle = '#2a1018'; ctx.fillRect(x, py + 69, w, 18);
        ctx.fillStyle = color; ctx.fillRect(x, py + 69, (w * hp) / max, 18);
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = right ? 'right' : 'left'; ctx.fillStyle = '#ffffff';
        ctx.fillText(`${label}  ${hp} / ${max}`, right ? x + w - 6 : x + 6, py + 79);
      };
      bar(px + 30, 300, m.pl.hp, m.pl.maxHp, '#e8334a', '나', false);
      bar(px + pw - 330, 300, m.ai.hp, m.ai.maxHp, '#3a8fd4', `${rv.name} (등급 ${m.lv})`, true);
      ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = m.time < 10 ? '#ff8a8a' : '#ffffff';
      ctx.fillText(`${Math.max(0, Math.ceil(m.time))}`, this.viewW / 2, py + 79);
      for (const f of m.fx) { ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = `rgba(255,230,120,${1 - f.t / 0.8})`; ctx.fillText(f.text, f.x, f.y - f.t * 50); }
      let big = ''; let col = '#ffffff';
      if (m.st === 'ready') { big = m.t < 1.0 ? '준비…' : '공격!'; col = m.t < 1.0 ? '#ffffff' : '#ff4a4a'; }
      else if (m.st === 'fight' && m.t < 0.6) { big = '공격!'; col = '#ff4a4a'; }
      else if (m.st === 'result') { big = m.msg; col = m.won ? '#7dffa0' : '#ff8a8a'; }
      if (big) { ctx.font = `bold ${m.st === 'result' ? 38 : 70}px sans-serif`; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(big, this.viewW / 2 + 3, 233); ctx.fillStyle = col; ctx.fillText(big, this.viewW / 2, 230); }
    }

    _miniBet(ctx, m, px, py, pw, ph) {
      const cx = this.viewW / 2;
      const rules = {
        shell: ['공이 든 컵을 맞혀 보세요!', '컵을 보여 준 뒤 빠르게 섞어요. 맞히면 건 돈의 2배를 받아요.', `이길수록 컵이 점점 빨라져요  (지금 난이도 ${m.level + 1})`],
        target: ['공 5개를 던져 빠르게 움직이는 작은 표적을 맞히세요!', '한가운데일수록 점수가 높아요 (50 · 30 · 20 · 10점). 던질수록 더 빨라져요.', '점수 x2 만큼 코인을 받아요. 참가비 100 G'],
        duel: m.mode === 'ring'
          ? ['링 격투 — 링 위에서 한 판', '화면 속 링에서 무작위 AI 용사(등급 1~5, 체력 4~10)와 싸워요. 나는 체력 10.', '←→ 이동, Space 점프, ↓ 막기, Enter 공격. 이기면 등급에 따라 건 돈의 1.8~2.6배']
          : m.mode === 'fight'
          ? ['공격! — 보스전처럼 칼싸움', '결투장에서 무작위 AI 용사(등급 1~5, 체력 4~10)가 칼로 달려들어요. 치켜들 때 피하거나 패링!', '평소 조작 그대로예요: 던지는 무기는 던지고, 쏘는 무기는 쏴요. 이기면 건 돈의 1.8~2.6배']
          : ['카우보이 — 보스전처럼 총싸움', '결투장에서 무작위 AI 용사(등급 1~5, 체력 4~10)가 총을 쏴요. 조준선이 보이면 피하거나 패링!', '평소 조작 그대로예요: 던지는 무기는 던지고, 쏘는 무기는 쏴요. 이기면 건 돈의 1.8~2.6배'],
      }[m.kind];
      if (m.kind === 'duel') { // 결투 종류 고르기
        [['cowboy', '카우보이'], ['fight', '공격!'], ['ring', '링 격투']].forEach(([id, name], i) => {
          const x = cx - 290 + i * 200;
          const on = m.mode === id;
          ctx.fillStyle = on ? 'rgba(111,208,255,0.28)' : 'rgba(255,255,255,0.07)';
          ctx.fillRect(x, py + 62, 180, 40);
          ctx.lineWidth = on ? 3 : 1.5;
          ctx.strokeStyle = on ? '#6fd0ff' : 'rgba(255,255,255,0.2)';
          ctx.strokeRect(x, py + 62, 180, 40);
          ctx.textAlign = 'center';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillStyle = on ? '#c8ecff' : '#9aa4c0';
          ctx.fillText(name, x + 90, py + 83);
        });
      }
      ctx.textAlign = 'center';
      rules.forEach((t, i) => { ctx.font = i === 0 ? 'bold 26px sans-serif' : '18px sans-serif'; ctx.fillStyle = i === 0 ? '#ffffff' : '#c8d0e8'; ctx.fillText(t, cx, py + (m.kind === 'duel' ? 150 : 130) + i * 44); });
      const bets = m.kind === 'target' ? [100] : [100, 300, 1000];
      bets.forEach((b, i) => {
        const x = cx - (bets.length * 190 - 20) / 2 + i * 190;
        const y = py + 300;
        const on = m.kind === 'target' || i === m.bi;
        const ok = m.coins >= b;
        ctx.fillStyle = on ? 'rgba(255,213,74,0.22)' : 'rgba(255,255,255,0.07)';
        ctx.fillRect(x, y, 170, 80);
        ctx.lineWidth = on ? 3.5 : 1.5;
        ctx.strokeStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.2)';
        ctx.strokeRect(x, y, 170, 80);
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = ok ? '#ffd54a' : '#ff6b7a';
        ctx.fillText(`${b} G`, x + 85, y + 34);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#9aa4c0';
        ctx.fillText(m.kind === 'target' ? '참가비' : `이기면 +${b} G`, x + 85, y + 62);
      });
      if (m.msgT > 0) { ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#ff8a8a'; ctx.fillText(m.msg, cx, py + 430); }
    }

    _miniShell(ctx, m, px, py, pw, ph) {
      const slotX = (v) => 300 + v * 180;
      ctx.fillStyle = '#2f6b4a'; ctx.fillRect(px + 30, 340, pw - 60, 150); // 초록 천을 깐 탁자
      ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 30, 330, pw - 60, 14);
      for (const c of m.cups) { // 공: 컵이 올라갔을 때만 보인다
        if (c.lift > 0.1 && m.cups.indexOf(c) === m.ball) {
          const x = slotX(c.px);
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, 352 + c.py, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8334a'; ctx.beginPath(); ctx.arc(x, 334 + c.py, 17, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 6, 328 + c.py, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const c of [...m.cups].sort((a, b) => a.py - b.py)) { // 컵 (앞으로 나온 컵이 위에 그려진다)
        const x = slotX(c.px);
        const base = 350 + c.py - c.lift * 80;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, 352 + c.py, 54, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.moveTo(x - 32, base - 112); ctx.lineTo(x + 32, base - 112); ctx.lineTo(x + 50, base); ctx.lineTo(x - 50, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8604a'; ctx.beginPath(); ctx.moveTo(x - 32, base - 112); ctx.lineTo(x - 14, base - 112); ctx.lineTo(x - 24, base); ctx.lineTo(x - 50, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0b12f'; ctx.fillRect(x - 36, base - 118, 72, 8); ctx.fillRect(x - 52, base - 8, 104, 8); // 금빛 테두리
        ctx.fillStyle = '#7a1f16'; ctx.fillRect(x - 44, base - 62, 88, 6);
      }
      if (m.st === 'pick') { // 고른 컵 위의 화살표
        const x = slotX(m.cur);
        const bob = Math.sin(m.t * 6) * 5;
        ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(x, 205 + bob); ctx.lineTo(x - 18, 175 + bob); ctx.lineTo(x + 18, 175 + bob); ctx.closePath(); ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = m.st === 'result' ? (m.won ? '#7dffa0' : '#ff8a8a') : '#ffffff';
      ctx.fillText(m.st === 'show' ? '공이 어디 있는지 잘 봐요!' : m.st === 'shuffle' ? '섞는 중…' : m.st === 'pick' ? '공이 든 컵은 어디일까요?' : m.msg, this.viewW / 2, py + 100);
      ctx.font = '16px sans-serif'; ctx.fillStyle = '#9aa4c0';
      ctx.fillText(`건 돈 ${m.cost} G  ·  난이도 ${m.level + 1}`, this.viewW / 2, py + 140);
    }

    _miniTarget(ctx, m, px, py, pw, ph) {
      ctx.fillStyle = '#5a3d22'; ctx.fillRect(px + 80, py + 70, pw - 160, 400); // 나무 판자 뒷벽
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
      for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(px + 80 + i * ((pw - 160) / 8), py + 70); ctx.lineTo(px + 80 + i * ((pw - 160) / 8), py + 470); ctx.stroke(); }
      const rings = [[52, '#f4f1e8'], [36, '#d9473f'], [22, '#f4f1e8'], [10, '#d9473f']]; // 작은 표적
      ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 2.5;
      ctx.fillStyle = '#7a5530'; ctx.fillRect(m.tx - 4, m.ty + 52, 8, 168); // 표적을 매단 막대
      for (const [r, col] of rings) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.tx, m.ty, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      for (const mk of m.marks) { // 맞은 자리 표시와 점수
        ctx.fillStyle = mk.pts ? '#2a7a3a' : '#555'; ctx.beginPath(); ctx.arc(mk.x, mk.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(${mk.pts ? '255,230,120' : '200,200,200'},${Math.max(0, 1 - mk.t / 1.2)})`;
        ctx.fillText(mk.pts ? `+${mk.pts}` : '빗나감', mk.x, mk.y - 14 - mk.t * 30);
      }
      if (m.ball) { // 날아가는 공
        const u = m.ball.t / 0.28;
        const bx = 480 + (m.ball.ax - 480) * u;
        const by = 520 + (m.ball.ay - 520) * u - Math.sin(u * Math.PI) * 50;
        ctx.fillStyle = '#e8334a'; ctx.beginPath(); ctx.arc(bx, by, 16 - 8 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(bx - 3, by - 3, 4 - 2 * u, 0, Math.PI * 2); ctx.fill();
      }
      if (m.st === 'play') { // 조준선
        ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(m.cx, m.cy, 18, 0, Math.PI * 2); ctx.moveTo(m.cx - 30, m.cy); ctx.lineTo(m.cx - 8, m.cy); ctx.moveTo(m.cx + 8, m.cy); ctx.lineTo(m.cx + 30, m.cy); ctx.moveTo(m.cx, m.cy - 30); ctx.lineTo(m.cx, m.cy - 8); ctx.moveTo(m.cx, m.cy + 8); ctx.lineTo(m.cx, m.cy + 30); ctx.stroke();
      }
      ctx.textAlign = 'left'; ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#ffffff';
      ctx.fillText(`점수 ${m.score}`, px + 30, py + 90);
      ctx.fillText(`남은 공 ${m.shots}`, px + 30, py + 124);
      if (m.st === 'result') { ctx.textAlign = 'center'; ctx.font = 'bold 34px sans-serif'; ctx.fillStyle = m.win > 0 ? '#7dffa0' : '#ff8a8a'; ctx.fillText(m.msg, this.viewW / 2, py + 270); }
    }

    // 발밑 그림자: 아래 땅까지의 거리가 멀수록 작고 옅어진다
    _shadowAt(ctx, terrain, o) {
      const cx = o.x + o.w / 2;
      const col = Math.floor(cx / TILE);
      const startRow = Math.floor((o.y + o.h - 1) / TILE);
      for (let r = startRow; r < Math.min(terrain.rows, startRow + 9); r++) {
        if (terrain.grid[r] && terrain.grid[r][col]) {
          const gy = r * TILE;
          const d = Math.max(0, gy - (o.y + o.h));
          const k = Math.max(0, 1 - d / 260);
          if (k <= 0.02) return;
          ctx.fillStyle = `rgba(0,0,0,${0.28 * k})`;
          ctx.beginPath(); ctx.ellipse(cx, gy + 1, (o.w * 0.5) * (0.5 + 0.5 * k), 3 * (0.6 + 0.4 * k), 0, 0, Math.PI * 2); ctx.fill();
          return;
        }
      }
    }

    _drawShadows(ctx, terrain, monsters, player, camera) {
      ctx.save();
      for (const m of monsters) if (m.alive && !m.flying && this._inView(m, camera)) this._shadowAt(ctx, terrain, m);
      this._shadowAt(ctx, terrain, player);
      ctx.restore();
    }

    // 어두운 스테이지(동굴, 다크월드)에서는 용사 주변이 은은하게 밝다
    _drawPlayerLight(ctx, player, time) {
      const kind = this._kindOfTheme();
      if (kind !== 'cave' && kind !== 'dark') return;
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const rad = 190 + Math.sin(time * 3) * 6;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, kind === 'dark' ? 'rgba(190,150,255,0.20)' : 'rgba(255,220,150,0.20)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();
    }

    // 스테이지 분위기 입자: 설산의 눈송이, 화산의 불씨, 다크월드의 영혼불, 숲의 반딧불, 동굴의 먼지 (화면 안에서 계속 맴돈다)
    _drawAmbient(ctx, camX, camY, time) {
      const th = this.theme;
      const kind = th === G.Snow ? 'snow' : th === G.Volcano ? 'ember' : th === G.DarkTheme ? 'wisp' : th === G.Forest ? 'firefly' : th === G.Cave ? 'mote' : null;
      if (!kind) return;
      const W = this.viewW;
      const H = this.viewH;
      const n = kind === 'snow' ? 46 : 26;
      ctx.save();
      for (let i = 0; i < n; i++) {
        const sx = (Math.sin(i * 91.7) * 0.5 + 0.5) * W;
        const sy = (Math.sin(i * 53.3 + 2) * 0.5 + 0.5) * H;
        const sp = 0.5 + (i % 5) * 0.18;
        let x;
        let y;
        let a = 1;
        let r = 1.5;
        let col = '255,255,255';
        if (kind === 'snow') { // 천천히 흩날리며 내린다
          x = sx + Math.sin(time * 0.8 * sp + i) * 22 + time * 10 * sp;
          y = sy + time * 34 * sp;
          r = 1.5 + (i % 3) * 0.7;
          a = 0.55 + (i % 4) * 0.1;
        } else if (kind === 'ember') { // 위로 피어오르며 사그라든다
          const ph = (time * 0.22 * sp + i * 0.137) % 1;
          x = sx + Math.sin(time * 1.5 + i) * 14;
          y = H - ph * H * 0.9;
          a = 1 - ph;
          r = 1.6 + (i % 3) * 0.6;
          col = i % 2 ? '255,170,60' : '255,110,40';
        } else if (kind === 'wisp') { // 보랏빛 영혼불이 느리게 떠오른다
          const ph = (time * 0.07 * sp + i * 0.211) % 1;
          x = sx + Math.sin(time * 0.6 * sp + i * 2) * 30;
          y = H - ph * H;
          a = Math.sin(ph * Math.PI) * 0.7;
          r = 2 + (i % 3);
          col = i % 2 ? '190,130,255' : '130,160,255';
        } else if (kind === 'firefly') { // 깜빡이는 반딧불
          x = sx + Math.sin(time * 0.5 * sp + i * 3) * 40;
          y = sy * 0.8 + H * 0.15 + Math.cos(time * 0.4 * sp + i) * 26;
          a = Math.max(0, Math.sin(time * 1.6 * sp + i * 5)) * 0.9;
          r = 2;
          col = '210,255,140';
        } else { // 동굴의 먼지
          x = sx + Math.sin(time * 0.3 * sp + i) * 26;
          y = sy + Math.cos(time * 0.25 * sp + i * 2) * 20;
          a = 0.12 + 0.1 * Math.sin(time + i);
          r = 1.2;
          col = '200,210,230';
        }
        x = camX + (((x % W) + W) % W);
        y = camY + (((y % H) + H) % H);
        if (a <= 0.02) continue;
        if (kind === 'wisp' || kind === 'firefly' || kind === 'ember') { // 은은한 빛무리
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
          g.addColorStop(0, `rgba(${col},${a * 0.5})`);
          g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
        }
        ctx.fillStyle = `rgba(${col},${a})`;
        ctx.fillRect(Math.round(x), Math.round(y), r, r);
      }
      ctx.restore();
    }

    // 던전 위층으로 오르는 문: 가까이 가면 열리고 문틈으로 금빛이 새어 나온다 (open 0~1)
    _drawDoor(ctx, ch) {
      const x = Math.round(ch.x);
      const y = Math.round(ch.y);
      const w = ch.w;
      const h = ch.h;
      const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
      const a = ch.open > 0 ? 0.55 * ch.open : 0.18 + 0.1 * Math.sin(t * 3); // 닫혀 있을 땐 은은하게 깜빡여 위치를 알린다
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 70);
      g.addColorStop(0, `rgba(255,225,110,${a})`);
      g.addColorStop(1, 'rgba(255,225,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 60, y - 40, w + 120, h + 80);
      ctx.fillStyle = '#4a2c14'; // 문틀
      ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
      ctx.fillStyle = '#2b1a0c'; // 문 안쪽 (열리면 금빛)
      ctx.fillRect(x, y, w, h);
      if (ch.open > 0) {
        ctx.fillStyle = `rgba(255,222,120,${0.4 + 0.6 * ch.open})`;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 2);
      }
      for (let i = 0; i < 4; i++) { // 문틈에서 피어오르는 금빛 반짝임
        const ph = (t * 0.6 + i * 0.25) % 1;
        ctx.fillStyle = `rgba(255,235,150,${(1 - ph) * 0.8})`;
        ctx.fillRect(Math.round(x + 4 + ((i * 7) % (w - 8))), Math.round(y - ph * 26), 2, 2);
      }
      const doorW = Math.max(3, Math.round((w - 4) * (1 - ch.open * 0.85))); // 문짝이 왼쪽 경첩을 축으로 접힌다
      ctx.fillStyle = '#8a5428';
      ctx.fillRect(x + 2, y + 2, doorW, h - 2);
      ctx.fillStyle = '#a66a33';
      ctx.fillRect(x + 2, y + 2, doorW, 3);
      ctx.fillStyle = '#6e4120';
      if (doorW > 12) { // 판자 홈과 위/아래 패널
        ctx.fillRect(x + 2 + Math.floor(doorW / 2), y + 5, 1, h - 7);
        ctx.fillRect(x + 6, y + 8, doorW - 8, 2);
        ctx.fillRect(x + 6, y + h - 12, doorW - 8, 2);
      }
      if (ch.open < 0.5) { // 손잡이
        ctx.fillStyle = '#ffd54a';
        ctx.fillRect(x + doorW - 4, y + Math.round(h / 2), 3, 3);
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
      for (let i = 0; i < 3; i++) { // 상자 위로 오르는 금빛 반짝임
        const ph = (t * 0.5 + i * 0.33) % 1;
        ctx.fillStyle = `rgba(255,235,150,${(1 - ph) * 0.9})`;
        ctx.fillRect(Math.round(x + 4 + ((i * 9) % (ch.w - 8))), Math.round(y - ph * 22), 2, 2);
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
      else if (m.kind === 'golem') this._paintGolem(ctx, m);
      else if (m.kind === 'darkstone') this._paintDarkStone(ctx, m);
      else if (m.kind === 'shade') this._paintShade(ctx, m);
      else this._paintSlime(ctx, m);
      if (m.dark) this._drawDarkAura(ctx, m);
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
      const cx = sp(s.x + s.w / 2);
      const bottom = sp(s.y + s.h);
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
      const pal = SLIME_COLORS[s.variant] || SLIME_COLORS.green;
      ctx.fillStyle = s.flying && Math.floor(s.flightTime / 0.05) % 2 === 0 ? '#ffffff' : s.chasing ? pal[1] : pal[0]; // 사라지기 직전엔 하얗게 번쩍
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.chasing ? pal[3] : pal[2];
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
      const cx = sp(b.x + b.w / 2);
      const cy = sp(b.y + b.h / 2);
      const angry = b.state === 'windup' || b.state === 'dive';
      const flash = (b.flying && Math.floor(b.flightTime / 0.05) % 2 === 0) || b.hurtFlash > 0; // 맞으면 번쩍
      const dive = b.state === 'dive';
      const wing = dive ? 1.0 : Math.sin(b.flap) * 0.9; // 급강하 땐 날개를 접음
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.dir >= 0 ? 1 : -1, 1);
      const gold = !!b.golden; // 황금박쥐: 금빛 몸과 날개, 은은한 후광
      const body = flash ? '#ffffff' : gold ? (angry ? '#ffb020' : '#f5c030') : angry ? '#8a3f96' : '#6a52a0';
      const membrane = flash ? '#ffffff' : gold ? (angry ? '#ffd24a' : '#ffe27a') : angry ? '#a8416f' : '#7f64bd';
      const outline = gold ? 'rgba(110,70,0,0.85)' : 'rgba(20,12,40,0.8)';
      if (gold) {
        const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
        glow.addColorStop(0, `rgba(255,230,120,${0.5 + 0.15 * Math.sin(t * 6)})`);
        glow.addColorStop(1, 'rgba(255,210,80,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-30, -30, 60, 60);
      }
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
        ctx.strokeStyle = outline;
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
      ctx.strokeStyle = outline;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 눈 + 송곳니
      ctx.fillStyle = angry ? '#ff4d4d' : gold ? '#7a3b00' : '#ffe36b';
      ctx.fillRect(-5, -3, 3, 3);
      ctx.fillRect(2, -3, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, 3, 2, 3);
      ctx.fillRect(1, 3, 2, 3);
      if (gold) { // 남은 체력 점: 몇 대 더 때려야 하는지 보인다
        const n = b.maxHp;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i < b.hp ? '#ffd54a' : 'rgba(70,45,0,0.75)';
          ctx.fillRect((i - (n - 1) / 2) * 6 - 2, -23, 4, 4);
        }
      }
      ctx.restore();
    }

    // 꽃게: 옆걸음 다리, 눈자루, 두 집게. 예비동작엔 집게를 번쩍 들고 눈이 붉어지며, 돌진 땐 집게를 앞으로 내민다
    // 던전 바닥의 아이템: 위아래로 둥실거리며 빛난다
    _drawPickup(ctx, p, time) {
      const bob = Math.sin((p.t + time) * 3) * 4;
      const g = ctx.createRadialGradient(p.x, p.y + bob, 2, p.x, p.y + bob, 26);
      g.addColorStop(0, 'rgba(255,255,200,0.55)');
      g.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 26, p.y + bob - 26, 52, 52);
      this._drawItemIcon(ctx, G.Shop.ITEMS[p.id], p.x, p.y + bob, 0.6);
    }

    // 몬스터가 쏜 어둠 구슬 (쳐내면 하얗게 변해 되돌아간다)
    _drawEnemyShot(ctx, f) {
      const white = f.reflected;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 18);
      g.addColorStop(0, white ? 'rgba(255,255,255,0.95)' : 'rgba(230,170,255,0.9)');
      g.addColorStop(1, white ? 'rgba(200,220,255,0)' : 'rgba(120,40,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x - 18, f.y - 18, 36, 36);
      ctx.fillStyle = white ? '#e8f0ff' : '#5a1fa0';
      ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = white ? '#ffffff' : '#a05aff';
      ctx.beginPath(); ctx.arc(f.x - 1, f.y - 1, 4, 0, Math.PI * 2); ctx.fill();
    }

    // 시크너에게 통제받던 마을: 보랏빛 어둠이 드리우고 어둠의 연기가 피어오른다
    _drawDarkVillage(ctx, a, time) {
      ctx.save();
      ctx.fillStyle = `rgba(30,8,55,${a})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      const g = ctx.createRadialGradient(this.viewW / 2, this.viewH * 0.55, this.viewH * 0.25, this.viewW / 2, this.viewH * 0.55, this.viewW * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(15,0,30,${a * 1.6})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      for (let i = 0; i < 18; i++) { // 천천히 피어오르는 어둠의 연기
        const x = ((G.Cave.rnd(i, 1, 9) * this.viewW + Math.sin(time * 0.4 + i) * 30) % this.viewW);
        const y = this.viewH - (((time * (12 + (i % 4) * 5)) + G.Cave.rnd(i, 2, 9) * this.viewH) % this.viewH);
        ctx.fillStyle = `rgba(110,40,190,${0.18 * (y / this.viewH)})`;
        ctx.beginPath(); ctx.arc(x, y, 14 + (i % 3) * 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // 스태미나: 왼쪽 아래 초록 막대 (모자라면 붉게)
    _drawStamina(ctx, hud) {
      const w = 170 + Math.min(220, Math.max(0, (hud.staminaMax - 100) * 0.55)); // 최대치가 늘면 막대도 길어진다
      const x = 14;
      const y = this.viewH - 30;
      const k = Math.max(0, Math.min(1, hud.stamina / hud.staminaMax));
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 2, y - 2, w + 4, 18);
      ctx.fillStyle = '#143a2a';
      ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = k < 0.25 ? '#ff6a5a' : '#4fe0a0';
      ctx.fillRect(x, y, w * k, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, w * k, 4);
      ctx.font = 'bold 11px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(`스태미나 ${Math.round(hud.stamina)} / ${hud.staminaMax}`, x + 6, y + 7);
      const c = hud.consumables || {};
      const bits = [];
      if (c.icebomb > 0) bits.push(`얼음폭탄 ${c.icebomb} (B)`);
      const food = (c.st30 || 0) + (c.st70 || 0);
      if (food > 0) bits.push(`먹기 ${food} (V)`);
      if (bits.length) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(bits.join('   '), x + 1, y - 9);
        ctx.fillStyle = '#d8f8e8';
        ctx.fillText(bits.join('   '), x, y - 10);
      }
      ctx.restore();
    }

    // 다크월드 몬스터: 보랏빛 어둠의 기운과 붉은 눈이 덧입혀진다 (외형이 조금 달라진다)
    _drawDarkAura(ctx, m) {
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      const cx = sp(m.x + m.w / 2);
      const cy = sp(m.y + m.h / 2);
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(m.w, m.h) * 0.95);
      g.addColorStop(0, 'rgba(150,60,230,0.28)');
      g.addColorStop(1, 'rgba(60,10,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - m.w, cy - m.h, m.w * 2, m.h * 2);
      ctx.fillStyle = 'rgba(40,10,70,0.28)'; // 몸을 어둡게
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle = 'rgba(255,60,90,0.9)'; // 붉게 번득이는 눈
      const ey = m.y + m.h * 0.38;
      ctx.fillRect(cx + m.dir * 3 - 6, ey, 4, 3);
      ctx.fillRect(cx + m.dir * 3 + 2, ey, 4, 3);
      for (let k = 0; k < 3; k++) { // 위로 피어오르는 어둠 연기
        const a = (t * 0.9 + k / 3) % 1;
        ctx.fillStyle = `rgba(120,50,200,${0.4 * (1 - a)})`;
        ctx.fillRect(cx - 8 + k * 8 + Math.sin(t * 3 + k) * 3, m.y - a * 20, 3, 3);
      }
    }

    // 어둠의 돌: 보랏빛 균열이 가득한 검은 바위 몸. 팔을 들면 눈이 더 붉어진다
    _paintDarkStone(ctx, g) {
      const windup = g.state === 'windup';
      const lunge = g.state === 'lunge';
      const flash = g.flying && Math.floor(g.flightTime / 0.05) % 2 === 0;
      const rock = flash ? '#ffffff' : '#3a2a58';
      const dark = flash ? '#ffffff' : '#150a24';
      const bob = Math.abs(g.vx) > 5 ? Math.abs(Math.sin(g.time * 5)) * 1.5 : 0;
      ctx.save();
      ctx.translate(sp(g.x + g.w / 2), sp(g.y + g.h));
      ctx.scale(g.dir >= 0 ? 1 : -1, 1);
      ctx.translate(lunge ? 5 : 0, -bob);
      ctx.rotate(lunge ? 0.16 : 0);
      ctx.fillStyle = dark; ctx.fillRect(-14, -12, 11, 12); ctx.fillRect(3, -12, 11, 12);
      ctx.fillStyle = rock;
      ctx.beginPath(); ctx.moveTo(-19, -10); ctx.lineTo(-21, -30); ctx.lineTo(-12, -42); ctx.lineTo(12, -42); ctx.lineTo(21, -30); ctx.lineTo(19, -10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(210,120,255,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(-4, -28); ctx.lineTo(-12, -18); ctx.moveTo(9, -38); ctx.lineTo(12, -26); ctx.lineTo(5, -14); ctx.stroke();
      ctx.strokeStyle = dark; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * 19, -32);
        if (windup) ctx.lineTo(side * 22, -52); else if (lunge) ctx.lineTo(22, -26); else ctx.lineTo(side * 24, -18);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.fillStyle = flash ? '#ffffff' : (windup || lunge ? '#ff2a4a' : '#ff6a8a');
      ctx.fillRect(-9, -32, 6, 4); ctx.fillRect(3, -32, 6, 4);
      ctx.restore();
    }

    // 시크너의 그림자: 두건을 쓴 검은 형체가 떠다니며, 구슬을 모을 때 손이 빛난다
    _paintShade(ctx, b) {
      const cx = sp(b.x + b.w / 2);
      const cy = sp(b.y + b.h / 2);
      const flash = (b.flying && Math.floor(b.flightTime / 0.05) % 2 === 0) || b.hurtFlash > 0;
      ctx.save();
      ctx.translate(cx, cy + Math.sin(b.time * 3) * 2);
      ctx.scale(b.dir >= 0 ? 1 : -1, 1);
      ctx.fillStyle = flash ? '#ffffff' : '#1a0a2e';
      ctx.beginPath(); ctx.moveTo(-12, 16); ctx.quadraticCurveTo(-16, -6, 0, -16); ctx.quadraticCurveTo(16, -6, 12, 16);
      for (let k = 0; k < 4; k++) ctx.lineTo(12 - (k + 0.5) * 6, 16 + (k % 2 ? 0 : 5)); // 일렁이는 아랫단
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : '#7a3ad0'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#ff3a5a';
      ctx.fillRect(2, -8, 4, 3); ctx.fillRect(8, -8, 4, 3);
      if (b.cast > 0) { // 구슬을 모으는 중
        const k = 1 - b.cast / 0.6;
        const g = ctx.createRadialGradient(16, 2, 1, 16, 2, 6 + 10 * k);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(160,70,240,0)');
        ctx.fillStyle = g; ctx.fillRect(2, -14, 30, 32);
      }
      ctx.restore();
    }

    // 흙괴물: 진흙과 바위로 된 몸. 몸을 던지기 전에 팔을 번쩍 든다. 머리와 어깨에 눈이 쌓여 있다
    _paintGolem(ctx, g) {
      const windup = g.state === 'windup';
      const lunge = g.state === 'lunge';
      const flash = g.flying && Math.floor(g.flightTime / 0.05) % 2 === 0;
      const mud = flash ? '#ffffff' : windup || lunge ? '#8a5a38' : '#7a5232';
      const dark = flash ? '#ffffff' : '#4a2e1a';
      const rock = flash ? '#ffffff' : '#a58a6e';
      const walking = Math.abs(g.vx) > 5;
      const bob = walking ? Math.abs(Math.sin(g.time * 6)) * 1.5 : 0;
      ctx.save();
      ctx.translate(sp(g.x + g.w / 2), sp(g.y + g.h));
      ctx.scale(g.dir >= 0 ? 1 : -1, 1);
      ctx.translate(lunge ? 4 : 0, -bob);
      const lean = lunge ? 0.18 : 0;
      ctx.rotate(lean);
      // 다리
      ctx.fillStyle = dark;
      ctx.fillRect(-11, -10, 9, 10);
      ctx.fillRect(2, -10, 9, 10);
      // 몸통
      ctx.fillStyle = mud;
      ctx.beginPath();
      ctx.moveTo(-15, -8); ctx.lineTo(-17, -26); ctx.lineTo(-10, -34); ctx.lineTo(10, -34); ctx.lineTo(17, -26); ctx.lineTo(15, -8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
      // 바위 조각
      ctx.fillStyle = rock;
      ctx.fillRect(-9, -26, 6, 5); ctx.fillRect(4, -20, 7, 5); ctx.fillRect(-4, -14, 5, 4);
      // 팔: 예비동작에선 위로 번쩍
      ctx.strokeStyle = dark;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 15, -28);
        if (windup) ctx.lineTo(side * 19, -46); else if (lunge) ctx.lineTo(18, -22 + side * 0); else ctx.lineTo(side * 20, -16 + Math.sin(g.time * 3 + side) * 1.5);
        ctx.stroke();
        ctx.fillStyle = mud;
        ctx.beginPath();
        if (windup) ctx.arc(side * 19, -48, 5.5, 0, Math.PI * 2); else if (lunge) ctx.arc(18, -22, 5.5, 0, Math.PI * 2); else ctx.arc(side * 20, -14, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineCap = 'butt';
      // 머리 위 눈과 눈(발광)
      ctx.fillStyle = flash ? '#ffffff' : '#f2f7fc';
      ctx.beginPath(); ctx.moveTo(-14, -33); ctx.lineTo(-6, -40); ctx.lineTo(6, -40); ctx.lineTo(14, -33); ctx.closePath(); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : (windup || lunge ? '#ff6a3a' : '#ffd96a');
      ctx.fillRect(-1, -29, 5, 4);
      ctx.fillRect(7, -29, 5, 4);
      ctx.restore();
    }

    _paintCrab(ctx, c) {
      const windup = c.state === 'windup';
      const dash = c.state === 'dash';
      const flash = c.flying && Math.floor(c.flightTime / 0.05) % 2 === 0;
      const shell = flash ? '#ffffff' : windup || dash ? '#ea4a2e' : '#e2693a';
      const dark = flash ? '#ffffff' : '#a8321c';
      const walking = Math.abs(c.vx) > 5;
      ctx.save();
      ctx.translate(sp(c.x + c.w / 2), sp(c.y + c.h));
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
      this._text(ctx, '←/→ 또는 A/D: 이동   Space/↑/W/Z: 점프   Shift(또는 X): 3칸 대시   Enter: 패링 (길게 눌러 게이지 채우고 떼기: 검 던지기)   R: 처음 위치로', 12, 62);
      ctx.font = '16px sans-serif';
      if (!hud) return;
      const test = '   F1: 개발 메뉴 (순간이동·아이템)   I 또는 ]: 인벤토리   1~5: 무기 바꾸기';
      if (hud.summon) this._text(ctx, `슬라임 ${hud.slimeCount}마리  박쥐 ${hud.batCount || 0}마리${test}`, 12, 84);
      else if (hud.monsterless) this._text(ctx, `몬스터가 없는 평화로운 마을${test}`, 12, 84);
      else if (hud.crabCount !== undefined) this._text(ctx, `꽃게 ${hud.crabCount}마리${test}`, 12, 84);

      if (hud.hotbar) this._drawHotbar(ctx, hud); // 왼쪽 위: 무기 칸 1~5
      ctx.textBaseline = 'top';
      // 목숨: 우측 상단 하트
      for (let i = 0; i < hud.maxLives; i++) {
        const hx = this.viewW - 28 - (hud.maxLives - 1 - i) * 34;
        this._drawHeart(ctx, hx, 10, 26, i + 1 <= hud.lives);
        const frac = hud.lives - i;
        if (frac > 0 && frac < 1) { // 일부만 찬 칸(¼, ½, ¾): 왼쪽부터 그만큼만 채운다
          ctx.save();
          ctx.beginPath(); ctx.rect(hx - 15, 0, 30 * frac, 60); ctx.clip();
          this._drawHeart(ctx, hx, 10, 26, true);
          ctx.restore();
        }
      }

      if (hud.coins !== undefined) this._drawCoinHud(ctx, hud.coins, hud.potions, hud.exp);
      if (hud.home) this._drawHomeHud(ctx, hud.home);
      if (hud.dialog) this._drawBottomText(ctx, hud.dialog.text + (hud.dialog.queue ? '   ▶ E' : ''), Math.min(1, hud.dialog.t / 0.3));
      else if (hud.prompt) this._drawBottomText(ctx, hud.prompt);
      if (hud.shop) this._drawShop(ctx, hud.shop);
      if (hud.equip) this._drawEquip(ctx, hud.equip);
      if (hud.dev) this._drawDev(ctx, hud.dev);
      if (hud.mini) this._drawMini(ctx, hud.mini);

      if (!hud.won && !hud.gameOver && !hud.shop && !hud.equip && !hud.dev && !hud.mini) this._text(ctx, hud.goal || '목표: 지도의 X, 동굴 맨 끝의 보물 상자를 찾아라', 12, 106);

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
