// 지팡이 마법: 패링(휘두르기)하면 지팡이 끝에서 원소가 나간다.
//   fire      불덩이  - 앞으로 날아가 처음 맞은 몬스터에 피해 2
//   poison    독      - 앞으로 날아가 맞은 몬스터에 독을 건다 (3초 동안 1초마다 1, 총 3. 중첩되지 않는다)
//   lightning 번개    - 앞으로 곧게 뻗어 줄 위의 몬스터를 모두 관통: 피해 1 + 기절(밀려남)
// 이 모듈은 투사체/번개의 움직임과 그리기만 맡는다. 맞았을 때의 효과는 호출한 쪽(main)의 hooks가 처리한다.
(function (G) {
  const C = G.Config;
  const T = C.TILE;

  const EL = {
    fire: { speed: 380, life: 1.1, r: 8 },
    poison: { speed: 300, life: 1.2, r: 8 },
    lightning: { range: 6 * T, half: 16, show: 0.22 },
    arrow: { speed: 720, life: 0.9, r: 6 },
    bullet: { speed: 1100, life: 0.7, r: 5 },
    bomb: { speed: 340, life: 1.8, r: 24, gravity: 900 }, // r이 커서 가까운 적 위를 지나가도 터진다
    icebomb: { speed: 340, life: 1.8, r: 24, gravity: 900 },
  };

  const pickElement = (el, rnd = Math.random) => (el === 'random' ? ['fire', 'poison', 'lightning'][Math.floor(rnd() * 3)] : el);
  const create = () => ({ shots: [], bolts: [] });
  const clear = (state) => { state.shots = []; state.bolts = []; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const alive = (m) => m.alive && !m.flying && m.appear <= 0;

  // 발사. (x, y) = 지팡이 끝. hooks.hit(monster, element, dir, x, y)
  // opts: 다크월드 무기용 {dmg, radius(px), pierce, count}
  function cast(state, el, x, y, dir, terrain, monsters, hooks, opts = {}) {
    if (el === 'arrow' || el === 'bullet' || el === 'bomb' || el === 'icebomb') {
      const n = opts.count || 1;
      for (let i = 0; i < n; i++) {
        const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 70;
        const bomb = el === 'bomb' || el === 'icebomb';
        state.shots.push({ el, x, y, dir, vx: dir * EL[el].speed, vy: bomb ? -240 : spread, g: EL[el].gravity || 0, life: EL[el].life, t: 0, dead: false, dmg: opts.dmg || 3, radius: opts.radius || 0, pierce: !!opts.pierce, hitSet: new Set() });
      }
      return;
    }
    if (el !== 'lightning') {
      state.shots.push({ el, x, y, dir, vx: dir * EL[el].speed, life: EL[el].life, t: 0, dead: false });
      return;
    }
    // 번개: 벽에 막힐 때까지 곧게 뻗는다
    let end = x;
    for (let d = 0; d <= EL.lightning.range; d += 8) {
      const px = x + dir * d;
      if (terrain.isSolid(Math.floor(px / T), Math.floor(y / T))) break;
      end = px;
    }
    const pts = [];
    const n = Math.max(2, Math.round(Math.abs(end - x) / 16));
    for (let i = 0; i <= n; i++) pts.push({ x: x + ((end - x) * i) / n, y: i === 0 ? y : y + (Math.random() - 0.5) * 20 });
    state.bolts.push({ pts, t: EL.lightning.show });
    const x0 = Math.min(x, end);
    const x1 = Math.max(x, end);
    for (const m of monsters) {
      if (!alive(m)) continue;
      if (m.x + m.w >= x0 && m.x <= x1 && m.y + m.h >= y - EL.lightning.half && m.y <= y + EL.lightning.half) {
        hooks.hit(m, 'lightning', dir, m.x + m.w / 2, m.y + m.h / 2);
      }
    }
  }

  function update(state, dt, terrain, monsters, hooks) {
    for (const b of state.bolts) b.t -= dt;
    state.bolts = state.bolts.filter((b) => b.t > 0);
    for (const s of state.shots) {
      s.t += dt;
      s.life -= dt;
      if (s.g) s.vy = (s.vy || 0) + s.g * dt; // 폭탄은 포물선
      if (s.el === 'bullet') { // 총알은 앞쪽의 가장 가까운 몬스터를 향해 휘어 날아간다
        let best = null;
        let bd = 640;
        for (const m of monsters) {
          if (!alive(m) || s.hitSet.has(m)) continue;
          const dx = m.x + m.w / 2 - s.x;
          if (Math.sign(dx) !== s.dir && Math.abs(dx) > 24) continue;
          const d = Math.hypot(dx, m.y + m.h / 2 - s.y);
          if (d < bd) { bd = d; best = m; }
        }
        if (best) {
          const dx = best.x + best.w / 2 - s.x;
          const dy = best.y + best.h / 2 - s.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          const k = Math.min(1, dt * 14);
          s.vx += ((dx / d) * EL.bullet.speed - s.vx) * k;
          s.vy = (s.vy || 0) + ((dy / d) * EL.bullet.speed - (s.vy || 0)) * k;
        }
      }
      const nx = s.x + s.vx * dt;
      const ny = s.y + (s.vy || 0) * dt;
      if (terrain.isSolid(Math.floor(nx / T), Math.floor(ny / T))) { // 벽/땅에 부딪힘
        if (s.radius) hooks.explode(s);
        hooks.burst(s.el, s.x, s.y);
        s.dead = true;
        continue;
      }
      s.x = nx;
      s.y = ny;
      const r = EL[s.el].r;
      for (const m of monsters) {
        if (!alive(m) || (s.hitSet && s.hitSet.has(m))) continue;
        const cx = clamp(s.x, m.x, m.x + m.w);
        const cy = clamp(s.y, m.y, m.y + m.h);
        if ((s.x - cx) * (s.x - cx) + (s.y - cy) * (s.y - cy) <= r * r) {
          hooks.hit(m, s.el, s.dir, s.x, s.y, s);
          if (s.radius) hooks.explode(s); // 폭탄: 닿으면 터진다
          if (s.pierce && !s.radius) { s.hitSet.add(m); continue; } // 관통 탄환
          s.dead = true;
          break;
        }
      }
      if (s.life <= 0 && !s.dead) {
        if (s.radius) hooks.explode(s);
        s.dead = true;
      }
    }
    state.shots = state.shots.filter((s) => !s.dead);
  }

  // 월드 좌표계에서 그린다
  function draw(ctx, state) {
    for (const s of state.shots) {
      if (s.el === 'fire') {
        for (let i = 4; i >= 1; i--) { // 꼬리
          ctx.fillStyle = `rgba(255,${120 + i * 20},40,${0.1 + 0.08 * (5 - i)})`;
          ctx.beginPath(); ctx.arc(s.x - s.dir * i * 7, s.y + Math.sin(s.t * 40 + i) * 2, 8 - i, 0, Math.PI * 2); ctx.fill();
        }
        const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 14);
        g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffb347'); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.fillRect(s.x - 14, s.y - 14, 28, 28);
        ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(s.x + s.dir * 1, s.y, 3, 0, Math.PI * 2); ctx.fill();
      } else if (s.el === 'arrow') { // 화살
        ctx.strokeStyle = '#e8d8a8'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(s.x - s.dir * 22, s.y - (s.vy || 0) * 0.03); ctx.lineTo(s.x + s.dir * 6, s.y); ctx.stroke();
        ctx.fillStyle = '#c9d2dc';
        ctx.beginPath(); ctx.moveTo(s.x + s.dir * 12, s.y); ctx.lineTo(s.x + s.dir * 4, s.y - 4); ctx.lineTo(s.x + s.dir * 4, s.y + 4); ctx.fill();
        ctx.fillStyle = '#c0504d'; ctx.fillRect(s.x - s.dir * 24 - 2, s.y - 3, 5, 6);
      } else if (s.el === 'bullet') { // 탄환: 빛나는 짧은 줄
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy || 0, s.vx)); // 휘어 날아가는 방향으로 기울인다
        ctx.fillStyle = 'rgba(255,230,140,0.45)';
        ctx.fillRect(-34, -2, 34, 4);
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(-12, -2, 12, 4);
        ctx.restore();
      } else if (s.el === 'bomb' || s.el === 'icebomb') { // 폭탄: 둥근 몸 + 타는 심지
        const ice = s.el === 'icebomb';
        ctx.fillStyle = ice ? '#5fa8d9' : '#2a2a32';
        ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ice ? '#bfe8ff' : '#5a5a66';
        ctx.beginPath(); ctx.arc(s.x - 3, s.y - 3, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a66a33'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x + 3, s.y - 8); ctx.quadraticCurveTo(s.x + 8, s.y - 14, s.x + 6, s.y - 17); ctx.stroke();
        const f = 0.6 + 0.4 * Math.sin(s.t * 40);
        ctx.fillStyle = ice ? `rgba(160,230,255,${f})` : `rgba(255,170,50,${f})`;
        ctx.beginPath(); ctx.arc(s.x + 6, s.y - 18, 3 + f * 2, 0, Math.PI * 2); ctx.fill();
      } else { // 독 방울
        const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 13);
        g.addColorStop(0, 'rgba(180,255,140,0.9)'); g.addColorStop(1, 'rgba(60,200,60,0)');
        ctx.fillStyle = g; ctx.fillRect(s.x - 13, s.y - 13, 26, 26);
        ctx.fillStyle = '#5bd35b'; ctx.beginPath(); ctx.arc(s.x, s.y, 6 + Math.sin(s.t * 30) * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2f8f2f'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(s.x - 2, s.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120,230,100,0.7)';
        ctx.beginPath(); ctx.arc(s.x - s.dir * 9, s.y - 4 + Math.sin(s.t * 20) * 3, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const b of state.bolts) { // 번개: 굵은 푸른 빛 + 가는 흰 선
      const a = Math.max(0, b.t / EL.lightning.show);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(120,200,255,${0.55 * a})`;
      ctx.lineWidth = 9;
      ctx.beginPath(); b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  G.Magic = { create, clear, cast, update, draw, pickElement };
})(window.Game);
