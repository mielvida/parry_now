// 용사 그리기: 투구·망토·갑옷 + 검. 패링 시 20프레임짜리 휘두르기 애니메이션과 검기 궤적을 그린다.
// 상태를 읽기만 한다 (player.swing = 휘두르기 프레임 번호, 없으면 -1).
(function (G) {
  const C = G.Config;
  const DEG = Math.PI / 180;

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const GUARD = -35;       // 평소 검을 든 각도 (도, 앞이 0°, 위쪽이 음수)
  const WINDUP = -125;     // 머리 위로 치켜든 각도
  const FOLLOW = 55;       // 베고 난 뒤 아래로 내려간 각도
  const WINDUP_END = C.SWING_SLASH_FRAME;   // 0~4: 치켜들기
  const SLASH_END = 12;                     // 5~11: 빠르게 베기, 12~19: 복귀

  // 휘두르기 프레임(0~19) -> 검 각도(도)
  function swordAngle(f) {
    if (f < 0) return GUARD;
    if (f < WINDUP_END) return lerp(GUARD, WINDUP, easeOut(f / WINDUP_END));
    if (f < SLASH_END) return lerp(WINDUP, FOLLOW, easeOut((f - WINDUP_END) / (SLASH_END - WINDUP_END)));
    return lerp(FOLLOW, GUARD, easeInOut((f - SLASH_END) / (C.SWING_FRAMES - SLASH_END)));
  }

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawCape(ctx, p) {
    const trail = Math.min(10, Math.abs(p.vx) / 25) + (p.onGround ? 0 : 4);
    const wave = Math.sin(p.animTime * 10) * 1.5;
    ctx.fillStyle = '#c62d3a';
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(-10 - trail, 21 + wave);
    ctx.lineTo(-8 - trail * 0.8, 30 - wave);
    ctx.lineTo(-3, 25);
    ctx.closePath();
    ctx.fill();
  }

  function drawLegs(ctx, p) {
    const moving = p.onGround && Math.abs(p.vx) > 10;
    const stride = moving ? Math.sin(p.runPhase) * 4 : 0;
    if (!p.onGround) { // 공중: 한 다리는 앞으로, 한 다리는 접음
      rect(ctx, '#4a3b2a', -5, 25, 5, 6);
      rect(ctx, '#4a3b2a', 1, 23, 6, 5);
      return;
    }
    rect(ctx, '#3a2f22', -6 - stride, 24, 5, 8);
    rect(ctx, '#4a3b2a', 1 + stride, 24, 5, 8);
  }

  function drawBody(ctx, p) {
    const bob = p.onGround && Math.abs(p.vx) > 10 ? Math.abs(Math.sin(p.runPhase)) * -1 : 0;
    ctx.save();
    ctx.translate(0, bob);
    rect(ctx, '#3b6fd4', -7, 12, 14, 13);       // 갑옷
    rect(ctx, '#5b8ff0', -7, 12, 14, 3);        // 어깨 하이라이트
    rect(ctx, '#e0b12f', -7, 21, 14, 2);        // 허리띠
    rect(ctx, '#e0b12f', 5, 12, 2, 9);          // 가슴 장식
    // 투구
    rect(ctx, '#c9d2dc', -7, 1, 14, 11);
    rect(ctx, '#e6edf5', -7, 1, 14, 3);
    rect(ctx, '#1b2433', 0, 5, 7, 3);           // 눈구멍
    rect(ctx, '#ffffff', 4, 6, 2, 1);           // 눈빛
    // 깃털
    ctx.fillStyle = '#e8334a';
    ctx.beginPath();
    ctx.moveTo(-2, 1);
    ctx.quadraticCurveTo(-4, -6, -10 - Math.min(4, Math.abs(p.vx) / 60), -2 + Math.sin(p.animTime * 9));
    ctx.quadraticCurveTo(-6, 0, 2, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSword(ctx, angle) {
    ctx.save();
    ctx.rotate(angle * DEG);
    rect(ctx, '#6b4423', -5, -1.5, 6, 3);       // 손잡이
    rect(ctx, '#e0b12f', 1, -5, 3, 10);         // 날밑
    rect(ctx, '#e8f1ff', 4, -2, 24, 4);         // 칼날
    rect(ctx, '#9db6d6', 4, 0.5, 24, 1.5);      // 칼날 그늘
    ctx.fillStyle = '#e8f1ff';
    ctx.beginPath();                            // 칼끝
    ctx.moveTo(28, -2);
    ctx.lineTo(33, 0);
    ctx.lineTo(28, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 검이 지나간 자리: 베는 순간부터 서서히 사라지는 초승달 궤적
  function drawSlashTrail(ctx, f, angle) {
    if (f < WINDUP_END) return;
    const age = f - WINDUP_END;
    const alpha = Math.max(0, 1 - age / 11);
    if (alpha <= 0) return;
    const end = (f < SLASH_END ? Math.max(WINDUP, Math.min(angle, FOLLOW)) : FOLLOW) * DEG; // 베기가 끝난 뒤엔 끝 각도 고정
    const start = WINDUP * DEG;
    // 현재 각도 뒤쪽 일부만 남겨 꼬리처럼 보이게
    const tailStart = Math.max(start, end - 150 * DEG);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(150,215,255,${alpha * 0.55})`;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 30, tailStart, Math.max(tailStart + 0.01, end));
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34, tailStart, Math.max(tailStart + 0.01, end));
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  const Hero = {
    swordAngle,

    // 던진 검: 빙글 돌며 날아가고 잔상이 따라온다
    drawThrownSword(ctx, sw) {
      ctx.lineCap = 'round';
      for (let i = 0; i < sw.trail.length; i++) {
        const t = (i + 1) / (sw.trail.length + 1);
        ctx.strokeStyle = `rgba(170,225,255,${t * 0.5})`;
        ctx.lineWidth = 3 + t * 6;
        ctx.beginPath();
        ctx.moveTo(sw.trail[i].x, sw.trail[i].y);
        ctx.lineTo(i + 1 < sw.trail.length ? sw.trail[i + 1].x : sw.x, i + 1 < sw.trail.length ? sw.trail[i + 1].y : sw.y);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.save();
      ctx.translate(sw.x, sw.y);
      ctx.rotate(sw.angle);
      ctx.translate(-14, 0); // 칼 중앙을 축으로 회전
      drawSword(ctx, 0);
      ctx.restore();
    },

    // 충전 링: 패링 판정(0.3초)이 끝난 뒤에도 계속 누르고 있으면 차오른다
    drawCharge(ctx, p) {
      if (p.holdTime < 0.3 || p.swordOut) return;
      const prog = p.chargeProgress;
      const cx = Math.round(p.x + p.w / 2);
      const cy = Math.round(p.y + p.h / 2);
      const ready = prog >= 1;
      const pulse = 1 + Math.sin(p.animTime * (ready ? 36 : 24)) * (ready ? 0.1 : 0.06 * prog);
      if (ready) { // 가득 참: 금빛 후광으로 "지금 손을 떼면 던진다"를 알림
        ctx.fillStyle = `rgba(255,225,120,${0.18 + 0.12 * Math.sin(p.animTime * 36)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 26 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 28 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgb(${Math.round(lerp(120, 255, prog))},${Math.round(lerp(200, 215, prog))},${Math.round(lerp(255, 80, prog))})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 28 * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // 절반 눈금: 여기를 넘겨서 떼야 멀리(1.3칸 이상) 나간다. 넘으면 눈금이 밝아진다
      const tickA = -Math.PI / 2 + Math.PI * 2 * C.SWORD_HALF_GAUGE;
      const passed = prog >= C.SWORD_HALF_GAUGE;
      ctx.strokeStyle = passed ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = passed ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tickA) * 22, cy + Math.sin(tickA) * 22);
      ctx.lineTo(cx + Math.cos(tickA) * 35, cy + Math.sin(tickA) * 35);
      ctx.stroke();
    },

    // (x, y) = 충돌 박스 좌상단. 앞쪽(facing)을 +x로 놓고 그린 뒤 필요하면 좌우 반전
    draw(ctx, p) {
      const cx = Math.round(p.x + p.w / 2);
      const top = Math.round(p.y);
      ctx.save();
      ctx.translate(cx, top);
      ctx.scale(p.facing >= 0 ? 1 : -1, 1);

      drawCape(ctx, p);
      drawLegs(ctx, p);
      drawBody(ctx, p);

      // 검 든 손 (어깨 앞쪽)
      ctx.save();
      ctx.translate(6, 16);
      const f = p.swing;
      const angle = swordAngle(f);
      if (!p.swordOut) { // 검을 던진 동안은 손이 빈다
        drawSlashTrail(ctx, f, angle);
        drawSword(ctx, angle);
      }
      rect(ctx, '#e8b98a', -2.5, -2.5, 5, 5);   // 손
      ctx.restore();

      ctx.restore();
    },
  };

  G.Hero = Hero;
})(window.Game);
