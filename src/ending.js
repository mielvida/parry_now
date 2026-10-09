// 스테이지 클리어 연출. 게임 화면 위에 덧씌우는 오버레이이며 게임 규칙에는 관여하지 않는다.
//  - 'cave'  : 보물 상자에서 50코인 획득 -> 암전("지상으로 올라갔다") -> done (main이 다음 스테이지로 넘어간다)
//  - 'house' : 해변의 집에 도착 -> 노인이 나와 마을이 있다고 알려준다 -> 암전 -> done (main이 마을 스테이지로 넘어간다)
(function (G) {
  // 장면 시간표 (클리어한 순간부터 흐른 초)
  const COIN_START = 0.8, COIN_END = 2.6;
  const FADE_OUT = 3.4, CAVE_DONE = 5.3, HOUSE_FADE = 12.6;
  // 모드별 시간표와 자막. 'cave'/'mine' = 상자에서 코인 획득 후 다음 스테이지로, 'house' = 노인과 대화 후 마을로
  function modeConfig(mode, coins) {
    if (mode === 'house') {
      return {
        end: 13.6,
        lines: [
          { from: 0.3, to: 3.2, text: '집 문을 두드리자 한 노인이 걸어 나왔다.' },
          { from: 3.4, to: 6.6, text: '노인: "이런, 길을 잃은 모험가로군. 여긴 외딴 해변이라네."' },
          { from: 6.8, to: 10.6, text: '노인: "저쪽으로 쭉 가면 마을이 있다네. 거기서 쉬었다 가게나."' },
          { from: 10.8, to: 13.0, text: '용사는 노인에게 감사 인사를 하고 마을로 향했다.' },
        ],
      };
    }
    return {
      end: CAVE_DONE,
      lines: [
        { from: 0.3, to: 3.3, text: `상자 안에는 금화가 가득했다! 용사는 ${coins}코인을 얻었다.` },
        { from: 3.7, to: 5.1, text: mode === 'mine' ? '용사는 보물을 챙겨 마을로 돌아왔다…' : '용사는 보물을 챙겨 지상으로 올라갔다…' },
      ],
    };
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  class Ending {
    constructor(mode = 'cave', coins = 50) {
      this.mode = mode;
      this.coins = coins; // 이번 연출에서 얻는 코인 (cave/mine)
      this.cfg = modeConfig(mode, coins);
      this.t = 0;
      this.coinShown = 0;
    }

    // 노인이 문 앞에 서서히 나타나는 정도 (0~1). 'house' 연출에서만 쓴다
    get npcAlpha() {
      return this.mode === 'house' ? clamp01((this.t - 0.8) / 0.6) : 0;
    }

    // 연출이 끝났다 (다음 스테이지로 넘어갈 때)
    get done() {
      return this.t >= this.cfg.end;
    }

    update(dt) {
      this.t += dt;
      if (this.mode === 'house') return;
      const target = Math.round(this.coins * clamp01((this.t - COIN_START) / (COIN_END - COIN_START)));
      if (target > this.coinShown && target % 5 === 0) G.Audio.play('coin'); // 5코인마다 짤랑
      this.coinShown = target;
    }

    // Enter: 연출 끝으로 건너뛴다
    skip() {
      if (this.t < this.cfg.end) this.t = this.cfg.end;
      this.coinShown = this.coins;
    }

    drawOverlay(ctx, w, h) {
      const t = this.t;
      if (this.mode !== 'house') {
        if (t < FADE_OUT + 0.8) this._drawBanner(ctx, w, h, '보물을 찾았다!', true);
        const black = t < FADE_OUT ? 0 : clamp01((t - FADE_OUT) / 0.8);
        if (black > 0) {
          ctx.fillStyle = `rgba(0,0,0,${black})`;
          ctx.fillRect(0, 0, w, h);
        }
      } else if (t > HOUSE_FADE) { // 'house': 마지막에 암전
        ctx.fillStyle = `rgba(0,0,0,${clamp01((t - HOUSE_FADE) / 0.8)})`;
        ctx.fillRect(0, 0, w, h);
      }
      this._drawCaption(ctx, w, h);
    }

    // 화면을 어둡게 하고 큰 제목. 코인 모드면 아래에 +50 COIN 카운터
    _drawBanner(ctx, w, h, title, coins) {
      const t = this.t;
      const a = clamp01(t / 0.4);
      ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 58px sans-serif';
      ctx.fillStyle = `rgba(0,0,0,${0.7 * a})`;
      ctx.fillText(title, w / 2 + 3, h * 0.28 + 3);
      ctx.fillStyle = `rgba(255,213,74,${a})`;
      ctx.fillText(title, w / 2, h * 0.28);
      if (coins && t >= COIN_START) { // 코인 아이콘 + 올라가는 숫자
        const pop = 1 + 0.25 * Math.max(0, 1 - (t - COIN_END) * 4) * (t >= COIN_END ? 1 : 0);
        ctx.save();
        ctx.translate(w / 2, h * 0.42);
        ctx.scale(pop, pop);
        ctx.fillStyle = '#b8860b';
        ctx.beginPath(); ctx.arc(-70, 0, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd54a';
        ctx.beginPath(); ctx.arc(-70, 0, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff4b8';
        ctx.fillRect(-80, -14, 5, 12);
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('G', -70, 2);
        ctx.font = 'bold 54px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000';
        ctx.fillText(`+${this.coinShown} COIN`, -32 + 2, 3);
        ctx.fillStyle = '#fff';
        ctx.fillText(`+${this.coinShown} COIN`, -32, 0);
        ctx.restore();
      }
      ctx.textAlign = 'start';
    }

    _drawCaption(ctx, w, h) {
      const t = this.t;
      for (const L of this.cfg.lines) {
        if (t < L.from || t > L.to) continue;
        const a = clamp01((t - L.from) / 0.4) * clamp01((L.to - t) / 0.4);
        G.Renderer.drawCaption(ctx, w, h, L.text, a);
      }
      if (t < this.cfg.end && t > 1.5) { // 건너뛰기 안내
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Enter: 건너뛰기', w - 14, 18);
        ctx.textAlign = 'start';
      }
    }
  }

  G.Ending = Ending;
})(window.Game);
