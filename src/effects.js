// 시각 효과: 파티클, 충격파 링, 화면 흔들림, 번쩍임. 게임 규칙에는 관여하지 않는다.
(function (G) {
  const rand = (a, b) => a + Math.random() * (b - a);

  class Effects {
    constructor() {
      this.particles = [];
      this.rings = [];
      this.shakeTime = 0;
      this.shakeDuration = 0.001;
      this.shakeMag = 0;
      this.flash = 0;
      this.flashColor = '255,255,255';
    }

    shake(mag, duration) {
      this.shakeMag = Math.max(this.shakeMag * (this.shakeTime / this.shakeDuration), mag);
      this.shakeDuration = duration;
      this.shakeTime = duration;
    }

    // 패링이 맞은 순간: 사방으로 튀는 불꽃 + 충격파 + 번쩍
    parryHit(x, y) {
      this.flash = 0.12;
      this.flashColor = '255,255,255';
      this.rings.push({ x, y, r0: 6, r1: 56, life: 0.22, max: 0.22, color: '255,255,255', width: 5 });
      this.rings.push({ x, y, r0: 4, r1: 36, life: 0.3, max: 0.3, color: '90,180,255', width: 3 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + rand(-0.15, 0.15);
        const sp = rand(220, 520);
        this.particles.push({
          kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: rand(0.15, 0.3), max: 0.3, size: rand(2, 4), gravity: 0,
          color: i % 3 === 0 ? '255,255,255' : '120,200,255',
        });
      }
    }

    // 반짝이는 작은 빛 입자 (컷신의 병, 보물 상자 등)
    sparkle(x, y) {
      this.particles.push({
        kind: 'blob', x: x + rand(-8, 8), y: y + rand(-6, 6), vx: rand(-14, 14), vy: -rand(20, 60),
        life: rand(0.5, 0.9), max: 0.9, size: rand(1.5, 3), gravity: -20,
        color: Math.random() < 0.5 ? '255,240,170' : '255,255,255',
      });
    }

    // 보물 상자를 여는 순간: 금화가 솟구치고 금빛 충격파
    treasure(x, y) {
      this.flash = 0.14;
      this.flashColor = '255,225,120';
      this.rings.push({ x, y, r0: 8, r1: 90, life: 0.45, max: 0.45, color: '255,215,90', width: 6 });
      this.rings.push({ x, y, r0: 4, r1: 56, life: 0.32, max: 0.32, color: '255,255,255', width: 3 });
      for (let i = 0; i < 34; i++) {
        this.particles.push({
          kind: 'blob', x: x + rand(-10, 10), y, vx: rand(-170, 170), vy: -rand(200, 520),
          life: rand(0.7, 1.3), max: 1.3, size: rand(3, 6), gravity: 900,
          color: i % 4 === 0 ? '255,255,255' : '255,205,60',
        });
      }
    }

    // 검을 휘두르는 순간: 베는 방향으로 날아가는 푸른 바람 줄기
    swing(x, y, dir) {
      for (let i = 0; i < 9; i++) {
        this.particles.push({
          kind: 'spark', x: x + dir * rand(6, 22), y: y + rand(-18, 12),
          vx: dir * rand(260, 520), vy: rand(-80, 120),
          life: rand(0.1, 0.2), max: 0.2, size: rand(2, 4), gravity: 0,
          color: i % 2 ? '170,225,255' : '255,255,255',
        });
      }
    }

    // 맞아서 충전 게이지가 깨지는 순간: 회색 조각이 흩어짐
    chargeBreak(x, y) {
      this.rings.push({ x, y, r0: 28, r1: 44, life: 0.2, max: 0.2, color: '200,210,225', width: 4 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.particles.push({
          kind: 'blob', x: x + Math.cos(a) * 28, y: y + Math.sin(a) * 28,
          vx: Math.cos(a) * rand(60, 180), vy: Math.sin(a) * rand(60, 180) - 40,
          life: rand(0.25, 0.45), max: 0.45, size: rand(2, 4), gravity: 600, color: '190,205,225',
        });
      }
    }

    // 게이지가 가득 찬 순간: 빛이 모였다 반짝 (손을 떼면 던진다는 신호)
    chargeReady(x, y) {
      this.rings.push({ x, y, r0: 40, r1: 14, life: 0.22, max: 0.22, color: '255,225,120', width: 4, fadeIn: true });
      this.rings.push({ x, y, r0: 14, r1: 44, life: 0.3, max: 0.3, color: '255,255,255', width: 3 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.particles.push({
          kind: 'spark', x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30,
          vx: Math.cos(a) * 140, vy: Math.sin(a) * 140,
          life: 0.25, max: 0.25, size: 3, gravity: 0, color: '255,225,120',
        });
      }
    }

    // 검을 던지는 순간: 충전 완료 폭발 (모이던 빛이 터져 나감)
    swordThrow(x, y, dir) {
      this.flash = 0.1;
      this.flashColor = '255,230,150';
      this.rings.push({ x, y, r0: 6, r1: 50, life: 0.25, max: 0.25, color: '255,225,120', width: 5 });
      for (let i = 0; i < 12; i++) {
        this.particles.push({
          kind: 'spark', x, y, vx: dir * rand(120, 460) + rand(-120, 120), vy: rand(-220, 220),
          life: rand(0.15, 0.32), max: 0.32, size: rand(2, 4), gravity: 0,
          color: i % 2 ? '255,225,120' : '255,255,255',
        });
      }
    }

    // 돌아온 검을 잡는 순간: 손 주변에서 푸른 빛이 번쩍
    swordCatch(x, y) {
      this.rings.push({ x, y, r0: 16, r1: 4, life: 0.18, max: 0.18, color: '150,215,255', width: 3, fadeIn: true });
      this.shake(2, 0.08);
      for (let i = 0; i < 8; i++) {
        const a = rand(0, Math.PI * 2);
        this.particles.push({
          kind: 'spark', x, y, vx: Math.cos(a) * rand(80, 240), vy: Math.sin(a) * rand(80, 240),
          life: rand(0.1, 0.22), max: 0.22, size: rand(2, 3), gravity: 0, color: '170,225,255',
        });
      }
    }

    // 플레이어가 맞는 순간: 붉은 충격파 + 불꽃 + 붉은 번쩍
    playerHit(x, y) {
      this.flash = 0.12;
      this.flashColor = '255,50,70';
      this.rings.push({ x, y, r0: 8, r1: 64, life: 0.3, max: 0.3, color: '255,60,80', width: 6 });
      this.rings.push({ x, y, r0: 4, r1: 38, life: 0.22, max: 0.22, color: '255,255,255', width: 3 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + rand(-0.2, 0.2);
        const sp = rand(160, 460);
        this.particles.push({
          kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: rand(0.2, 0.4), max: 0.4, size: rand(2, 5), gravity: 500,
          color: i % 3 === 0 ? '255,255,255' : '255,70,90',
        });
      }
    }

    // 슬라임이 사라지는 순간: 젤리 방울이 터지고 링이 퍼짐
    vanish(x, y) {
      this.rings.push({ x, y, r0: 4, r1: 46, life: 0.28, max: 0.28, color: '255,150,190', width: 4 });
      const palette = ['240,85,140', '255,159,192', '255,255,255', '79,211,127'];
      for (let i = 0; i < 22; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(60, 300);
        this.particles.push({
          kind: 'blob', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
          life: rand(0.35, 0.7), max: 0.7, size: rand(3, 7), gravity: 900,
          color: palette[i % palette.length],
        });
      }
      this.shake(4, 0.12);
    }

    // 대시를 시작한 순간: 발밑에서 먼지가 뒤쪽으로 흩날리고, 몸 높이로 바람줄이 길게 뻗는다 (dir = 먼지가 날아가는 방향)
    dashDust(x, y, dir) {
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          kind: 'spark', x: x - dir * rand(-6, 10), y: y - rand(6, 30), vx: dir * rand(500, 900), vy: rand(-20, 20),
          life: rand(0.12, 0.22), max: 0.22, size: rand(2, 3.5), gravity: 0, color: i % 2 ? '255,255,255' : '170,225,255',
        });
      }
      for (let i = 0; i < 9; i++) {
        this.particles.push({
          kind: 'blob', x: x + rand(-6, 6), y: y - rand(0, 4), vx: dir * rand(40, 200), vy: -rand(10, 90),
          life: rand(0.2, 0.45), max: 0.45, size: rand(2, 5), gravity: 300, color: i % 2 ? '215,195,150' : '240,230,210',
        });
      }
    }

    // 얼면서 죽는 순간: 얼음 조각이 사방으로 흩어지고 푸른 링이 퍼진다
    iceShatter(x, y) {
      this.flash = 0.1;
      this.flashColor = '190,235,255';
      this.rings.push({ x, y, r0: 4, r1: 60, life: 0.3, max: 0.3, color: '190,235,255', width: 5 });
      this.rings.push({ x, y, r0: 2, r1: 34, life: 0.22, max: 0.22, color: '255,255,255', width: 3 });
      const palette = ['190,235,255', '255,255,255', '120,200,255', '160,215,255'];
      for (let i = 0; i < 30; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(120, 460);
        this.particles.push({
          kind: i % 2 ? 'spark' : 'blob', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100,
          life: rand(0.35, 0.7), max: 0.7, size: rand(2, 6), gravity: 700, color: palette[i % palette.length],
        });
      }
      this.shake(5, 0.14);
    }

    // 불타며 죽는 순간: 불꽃이 위로 치솟는다
    fireBurst(x, y) {
      this.flash = 0.1;
      this.flashColor = '255,170,80';
      this.rings.push({ x, y, r0: 4, r1: 62, life: 0.32, max: 0.32, color: '255,150,60', width: 6 });
      const palette = ['255,230,120', '255,170,60', '255,100,40', '90,40,30'];
      for (let i = 0; i < 28; i++) {
        this.particles.push({
          kind: 'blob', x: x + rand(-14, 14), y: y + rand(-6, 8), vx: rand(-110, 110), vy: -rand(80, 360),
          life: rand(0.4, 0.85), max: 0.85, size: rand(3, 7), gravity: -160, color: palette[i % palette.length],
        });
      }
      this.shake(5, 0.14);
    }

    // 빛 무기: 금빛 고리가 r 반경까지 퍼진다
    lightBurst(x, y, r) {
      this.flash = 0.12;
      this.flashColor = '255,240,170';
      this.rings.push({ x, y, r0: 6, r1: r, life: 0.4, max: 0.4, color: '255,235,150', width: 7 });
      this.rings.push({ x, y, r0: 4, r1: r * 0.6, life: 0.3, max: 0.3, color: '255,255,255', width: 3 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        this.particles.push({
          kind: 'spark', x, y, vx: Math.cos(a) * rand(200, 420), vy: Math.sin(a) * rand(200, 420),
          life: rand(0.2, 0.4), max: 0.4, size: rand(2, 4), gravity: 0, color: '255,240,170',
        });
      }
    }

    // 대지 무기: 먼지가 일고 갈색 충격파가 땅을 따라 퍼진다
    quakeDust(x, y, r) {
      this.rings.push({ x, y, r0: 6, r1: r, life: 0.4, max: 0.4, color: '190,150,100', width: 8 });
      for (let i = 0; i < 22; i++) {
        const dir = i % 2 ? 1 : -1;
        this.particles.push({
          kind: 'blob', x: x + dir * rand(0, 20), y: y + rand(-4, 2), vx: dir * rand(60, r * 1.6), vy: -rand(40, 200),
          life: rand(0.35, 0.7), max: 0.7, size: rand(3, 7), gravity: 500, color: i % 3 ? '170,135,95' : '210,185,140',
        });
      }
      this.shake(7, 0.25);
    }

    // 수정 무기: 분홍/하늘색 파편이 튄다
    crystalShards(x, y) {
      const palette = ['255,160,230', '160,230,255', '255,255,255'];
      for (let i = 0; i < 12; i++) {
        const a = rand(0, Math.PI * 2);
        this.particles.push({
          kind: 'spark', x, y, vx: Math.cos(a) * rand(160, 380), vy: Math.sin(a) * rand(160, 380),
          life: rand(0.2, 0.4), max: 0.4, size: rand(2, 4), gravity: 200, color: palette[i % palette.length],
        });
      }
    }

    // 부활: 바닥으로 빨려 들어오는 링 + 위로 솟는 초록 빛 입자
    spawn(x, y) {
      this.rings.push({ x, y, r0: 44, r1: 6, life: 0.4, max: 0.4, color: '79,211,127', width: 4, fadeIn: true });
      this.rings.push({ x, y, r0: 8, r1: 30, life: 0.45, max: 0.45, color: '255,255,255', width: 2 });
      for (let i = 0; i < 16; i++) {
        this.particles.push({
          kind: 'blob', x: x + rand(-18, 18), y: y - rand(0, 6),
          vx: rand(-30, 30), vy: -rand(80, 220),
          life: rand(0.35, 0.6), max: 0.6, size: rand(2, 5), gravity: -120,
          color: i % 3 === 0 ? '255,255,255' : '120,235,160',
        });
      }
    }

    update(dt) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      this.flash = Math.max(0, this.flash - dt);
      for (const p of this.particles) {
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vx *= 1 - 6 * dt; p.vy *= 1 - 6 * dt; }
      }
      for (const r of this.rings) r.life -= dt;
      this.particles = this.particles.filter((p) => p.life > 0);
      this.rings = this.rings.filter((r) => r.life > 0);
    }

    // 화면 흔들림 오프셋 (시간이 지날수록 약해짐)
    shakeOffset() {
      if (this.shakeTime <= 0) return { x: 0, y: 0 };
      const m = this.shakeMag * (this.shakeTime / this.shakeDuration);
      return { x: rand(-m, m), y: rand(-m, m) };
    }

    // 월드 좌표계에서 호출
    draw(ctx) {
      for (const r of this.rings) {
        const t = 1 - r.life / r.max;
        const ease = 1 - (1 - t) * (1 - t);
        const alpha = r.fadeIn ? t : 1 - t; // 부활 링은 안쪽으로 모이며 점점 선명해짐
        ctx.strokeStyle = `rgba(${r.color},${alpha})`;
        ctx.lineWidth = r.width * alpha + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of this.particles) {
        const a = Math.max(0, p.life / p.max);
        if (p.kind === 'spark') {
          ctx.strokeStyle = `rgba(${p.color},${a})`;
          ctx.lineWidth = p.size * a + 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${p.color},${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.lineCap = 'butt';
    }

    // 화면 좌표계(카메라 무관)에서 호출: 번쩍임
    drawOverlay(ctx, w, h) {
      if (this.flash <= 0) return;
      ctx.fillStyle = `rgba(${this.flashColor},${(this.flash / 0.12) * 0.28})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  G.Effects = Effects;
})(window.Game);
