// 용사 그리기: 투구·망토·갑옷 + 검. 패링 시 20프레임짜리 휘두르기 애니메이션과 검기 궤적을 그린다.
// 상태를 읽기만 한다 (player.swing = 휘두르기 프레임 번호, 없으면 -1).
(function (G) {
  const C = G.Config;
  const DEG = Math.PI / 180;

  const lerp = (a, b, t) => a + (b - a) * t;
  const sp = (v) => (C.SMOOTH_SPRITES ? v : Math.round(v)); // 움직이는 것의 좌표: 부드럽게(그대로) 또는 정수로
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const GUARD_UP = -80;    // 가드 자세에서 검을 세운 각도
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

  // 신발(없으면 기본 가죽색): [본체, 밑창]
  let bootCol = ['#4a3b2a', '#3a2f22'];

  function drawLegs(ctx, p) {
    const moving = p.onGround && Math.abs(p.vx) > 10;
    const stride = moving ? Math.sin(p.runPhase) * 4 : 0;
    if (!p.onGround) { // 공중: 한 다리는 앞으로, 한 다리는 접음
      rect(ctx, bootCol[0], -5, 25, 5, 6);
      rect(ctx, bootCol[0], 1, 23, 6, 5);
      return;
    }
    rect(ctx, bootCol[1], -6 - stride, 24, 5, 8);
    rect(ctx, bootCol[0], 1 + stride, 24, 5, 8);
    if (bootCol[2]) { // 산 신발은 앞코를 조금 길게
      rect(ctx, bootCol[0], -6 - stride, 29, 7, 3);
      rect(ctx, bootCol[0], 1 + stride, 29, 7, 3);
    }
  }

  // 낀 갑옷의 몸통 색: [본체, 어깨 하이라이트]
  let armorCol = ['#3b6fd4', '#5b8ff0'];
  // 머리: 투구를 끼면 투구 색, 안 끼면 기본 투구 [본체, 하이라이트]
  let headCol = ['#c9d2dc', '#e6edf5'];

  function drawBody(ctx, p) {
    const bob = p.onGround && Math.abs(p.vx) > 10 ? Math.abs(Math.sin(p.runPhase)) * -1 : 0;
    ctx.save();
    ctx.translate(0, bob);
    rect(ctx, armorCol[0], -7, 12, 14, 13);     // 갑옷
    rect(ctx, armorCol[1], -7, 12, 14, 3);      // 어깨 하이라이트
    rect(ctx, '#e0b12f', -7, 21, 14, 2);        // 허리띠
    rect(ctx, '#e0b12f', 5, 12, 2, 9);          // 가슴 장식
    // 투구
    rect(ctx, headCol[0], -7, 1, 14, 11);
    rect(ctx, headCol[1], -7, 1, 14, 3);
    if (p.helmetId) { // 산 투구: 이마 테두리와 가운데 능선을 더해 기본 투구와 구분한다
      rect(ctx, 'rgba(0,0,0,0.25)', -7, 11, 14, 1);
      rect(ctx, headCol[1], -1, -1, 3, 3);
    }
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

  // 낀 무기의 모양: type = sword/great/staff, blade = [밝은 면, 그늘]
  let weaponType = 'sword';
  let blade = ['#e8f1ff', '#9db6d6'];
  let gloveCol = '#e8b98a'; // 손 (장갑을 끼면 장갑 색)

  // 가드 순간 앞쪽에 번지는 푸른 방어막 (손 기준 좌표). k = 1에서 0으로 사라진다
  function drawGuardShield(ctx, k) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(150,215,255,${0.6 * k})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(2, -2, 24, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(2, -2, 27, -1.0, 1.0);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function circle(ctx, color, x, y, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSword(ctx, angle) {
    ctx.save();
    ctx.rotate(angle * DEG);
    if (weaponType === 'staff') { // 지팡이: 나무 막대 + 끝의 빛나는 구슬
      rect(ctx, '#6b4423', -8, -1.5, 36, 3);
      rect(ctx, '#e0b12f', 22, -3, 3, 6);
      const orb = ctx.createRadialGradient(33, 0, 1, 33, 0, 9);
      orb.addColorStop(0, '#ffffff');
      orb.addColorStop(0.4, blade[0]);
      orb.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = orb;
      ctx.fillRect(22, -11, 22, 22);
      ctx.fillStyle = blade[0];
      ctx.beginPath(); ctx.arc(33, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = blade[1]; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (weaponType === 'bomb') { // 폭탄: 둥근 몸 + 타는 심지
      circle(ctx, blade[0], 8, 0, 6);
      circle(ctx, 'rgba(255,255,255,0.35)', 6, -2, 2);
      rect(ctx, '#a66a33', 8, -9, 2, 4);
      circle(ctx, blade[1], 9, -11, 2.5);
    } else if (weaponType === 'gun') { // 총: 손잡이 + 총신
      rect(ctx, '#4a2f1a', -2, 1, 6, 8);
      rect(ctx, blade[0], 0, -3, 22, 5);
      rect(ctx, blade[1], 0, 0, 22, 2);
      rect(ctx, '#2a2f3a', 20, -4, 5, 7);
    } else if (weaponType === 'bow') { // 활: 휘어진 몸 + 시위
      ctx.strokeStyle = blade[0]; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(8, 0, 13, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      ctx.strokeStyle = blade[1]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(8, 13); ctx.stroke();
      rect(ctx, '#c9d2dc', 0, -1, 14, 2);
    } else if (weaponType === 'shield') { // 방패: 둥근 방패를 앞에 든다
      circle(ctx, blade[1], 14, 0, 12);
      circle(ctx, blade[0], 14, 0, 9.5);
      circle(ctx, 'rgba(255,255,255,0.35)', 11, -3, 3);
      rect(ctx, '#e0b12f', 12.5, -1.5, 3, 3);
    } else if (weaponType === 'dagger') { // 단검: 짧고 가는 칼날
      rect(ctx, '#6b4423', -4, -1.5, 5, 3);
      rect(ctx, '#e0b12f', 1, -3.5, 2.5, 7);
      rect(ctx, blade[0], 3.5, -1.8, 13, 3.6);
      rect(ctx, blade[1], 3.5, 0.4, 13, 1.4);
      ctx.fillStyle = blade[0];
      ctx.beginPath();
      ctx.moveTo(16.5, -1.8);
      ctx.lineTo(21, 0);
      ctx.lineTo(16.5, 1.8);
      ctx.closePath();
      ctx.fill();
    } else if (weaponType === 'great') { // 대검: 길고 넓은 칼날
      rect(ctx, '#6b4423', -7, -1.5, 8, 3);
      rect(ctx, '#e0b12f', 1, -7, 3, 14);
      rect(ctx, blade[0], 4, -3.5, 34, 7);
      rect(ctx, blade[1], 4, 1, 34, 2.5);
      ctx.fillStyle = blade[0];
      ctx.beginPath();
      ctx.moveTo(38, -3.5);
      ctx.lineTo(45, 0);
      ctx.lineTo(38, 3.5);
      ctx.closePath();
      ctx.fill();
    } else {
      rect(ctx, '#6b4423', -5, -1.5, 6, 3);       // 손잡이
      rect(ctx, '#e0b12f', 1, -5, 3, 10);         // 날밑
      rect(ctx, blade[0], 4, -2, 24, 4);          // 칼날
      rect(ctx, blade[1], 4, 0.5, 24, 1.5);       // 칼날 그늘
      ctx.fillStyle = blade[0];
      ctx.beginPath();                            // 칼끝
      ctx.moveTo(28, -2);
      ctx.lineTo(33, 0);
      ctx.lineTo(28, 2);
      ctx.closePath();
      ctx.fill();
    }
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

  // 내 스프라이트(sprites.js)로 용사를 그린다. 기준점 = 발바닥 가운데. 그림이 없으면 false (기본 모습으로 그린다)
  function drawCustom(ctx, p) {
    const S = G.Sprites;
    const pk = S.pick(p);
    if (!pk) return false;
    const cx = sp(p.x + p.w / 2);
    const bottom = sp(p.y + p.h);
    ctx.save();
    ctx.translate(cx, bottom);
    ctx.scale(p.facing >= 0 ? 1 : -1, 1);
    ctx.imageSmoothingEnabled = false; // 그린 도트가 번지지 않게
    ctx.drawImage(S.canvas(pk.key, pk.i), -(S.W * S.CELL) / 2, -S.H * S.CELL, S.W * S.CELL, S.H * S.CELL);
    const f = p.swing;
    const guard = p.guardTimer > 0;
    const showWeapon = S.data.anims[pk.key].weapon && !p.swordOut; // '무기 겹쳐 그리기'를 켠 동작은 장착한 무기를 손에 얹는다
    const showTrail = S.data.trail && f >= 0 && !p.swordOut && !Hero.suppressTrail;
    if (showWeapon || showTrail || guard) {
      ctx.save();
      ctx.translate(6, -(p.h - 16)); // 손 위치 (기본 모습과 같다)
      const angle = guard ? GUARD_UP : swordAngle(f);
      if (showTrail && !guard) drawSlashTrail(ctx, f, angle);
      if (showWeapon) drawSword(ctx, angle);
      if (guard) drawGuardShield(ctx, p.guardTimer / C.GUARD_TIME);
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  const Hero = {
    swordAngle,
    suppressTrail: false, // true인 동안은 검기 궤적을 그리지 않는다 (기본 모습을 칸으로 옮길 때)

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
      const cx = sp(p.x + p.w / 2);
      const cy = sp(p.y + p.h / 2);
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
      const items = G.Shop.ITEMS;
      const wp = items[p.weaponId || 'sword0'];
      weaponType = wp.type;
      blade = wp.look;
      armorCol = items[p.armorId || 'armor0'].look;
      headCol = p.helmetId ? items[p.helmetId].look : ['#c9d2dc', '#e6edf5'];
      gloveCol = p.glovesId ? items[p.glovesId].look[0] : '#e8b98a';
      bootCol = p.bootsId ? [items[p.bootsId].look[0], items[p.bootsId].look[1], true] : ['#4a3b2a', '#3a2f22'];
      if (G.Sprites && G.Sprites.active() && drawCustom(ctx, p)) return; // 내 스프라이트를 켰으면 그걸로 그린다
      const cx = sp(p.x + p.w / 2);
      const top = sp(p.y);
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
      const guard = p.guardTimer > 0; // 패링 성공 직후: 검을 앞으로 세우고 막는 자세
      const angle = guard ? GUARD_UP : swordAngle(f);
      if (!p.swordOut) { // 검을 던진 동안은 손이 빈다
        if (!guard && !Hero.suppressTrail) drawSlashTrail(ctx, f, angle);
        drawSword(ctx, angle);
      }
      if (guard) drawGuardShield(ctx, p.guardTimer / C.GUARD_TIME);
      rect(ctx, gloveCol, -2.5, -2.5, 5, 5);    // 손 (장갑)
      ctx.restore();

      ctx.restore();
    },
  };

  G.Hero = Hero;
})(window.Game);
