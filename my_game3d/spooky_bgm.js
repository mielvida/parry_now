/* ============================================================
   으스스하지만 잔잔한 BGM 30곡  (나중에 쓸 거라 게임에는 아직 연결 안 했어요)
   쓰는 법 (index.html 에 <script src="spooky_bgm.js"></script> 를 넣은 뒤):
     SpookyBGM.play(0)      // 0~29번 곡 재생 (사용자가 클릭/키를 누른 뒤에 불러야 소리가 나요)
     SpookyBGM.playRandom() // 아무 곡이나
     SpookyBGM.stop()       // 부드럽게 끄기
     SpookyBGM.setVolume(0.6)
     SpookyBGM.list         // 곡 이름 30개
   소리 파일 없이 WebAudio 로 그 자리에서 만들어서 용량은 거의 없어요.
   ============================================================ */
const SpookyBGM = (() => {
  const SC = {
    phr: [0, 1, 3, 5, 7, 8, 10], loc: [0, 1, 3, 5, 6, 8, 10], hmin: [0, 2, 3, 5, 7, 8, 11], dor: [0, 2, 3, 5, 7, 9, 10],
    whole: [0, 2, 4, 6, 8, 10], dim: [0, 2, 3, 5, 6, 8, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], pent: [0, 3, 5, 7, 10], tri: [0, 1, 6, 7]
  };
  // [이름, 으뜸음(MIDI), 음계, 빠르기, 바탕소리, 멜로디 악기, 효과음, 멜로디 밀도(0~1), 바탕 코드 길이(마디)]
  const T = [
    ['비 오는 빈 방', 45, 'min', 52, 'strings', 'box', 'drip', 0.35, 4],
    ['문틈의 바람', 40, 'phr', 48, 'drone', 'glass', 'wind', 0.25, 4],
    ['낡은 오르골', 50, 'hmin', 60, 'sub', 'box', 'tick', 0.55, 4],
    ['잠든 인형의 방', 47, 'dor', 54, 'glass', 'box', 'whisper', 0.4, 4],
    ['안개 낀 호수', 43, 'whole', 44, 'choir', 'bell', 'wind', 0.3, 6],
    ['멀리서 들리는 종', 48, 'loc', 50, 'drone', 'bell', 'swell', 0.22, 4],
    ['지하실 계단', 38, 'phr', 56, 'sub', 'piano', 'heart', 0.3, 4],
    ['달 없는 밤', 46, 'min', 46, 'strings', 'glass', 'wind', 0.3, 6],
    ['먼지 쌓인 피아노', 52, 'hmin', 58, 'glass', 'piano', 'creak', 0.45, 4],
    ['속삭이는 복도', 44, 'dim', 50, 'choir', 'none', 'whisper', 0.0, 4],
    ['시계가 멈춘 집', 49, 'loc', 64, 'sub', 'bell', 'tick', 0.35, 4],
    ['숲속의 눈빛', 41, 'dor', 48, 'drone', 'flute', 'wind', 0.3, 4],
    ['얼어붙은 창문', 53, 'whole', 52, 'glass', 'glass', 'none', 0.35, 6],
    ['오래된 우물', 39, 'phr', 42, 'sub', 'bell', 'drip', 0.2, 6],
    ['촛불 하나', 51, 'min', 56, 'strings', 'box', 'none', 0.45, 4],
    ['두근거리는 어둠', 36, 'tri', 60, 'drone', 'none', 'heart', 0.0, 4],
    ['꿈속의 놀이터', 55, 'lyd', 62, 'glass', 'box', 'creak', 0.5, 4],
    ['버려진 병원', 42, 'dim', 46, 'choir', 'piano', 'drip', 0.28, 4],
    ['젖은 낙엽 길', 45, 'dor', 54, 'strings', 'flute', 'wind', 0.35, 4],
    ['다락방의 상자', 50, 'hmin', 50, 'drone', 'box', 'creak', 0.4, 6],
    ['검은 연못 아래', 37, 'loc', 40, 'sub', 'glass', 'swell', 0.2, 6],
    ['누군가의 발소리', 40, 'min', 58, 'sub', 'none', 'heart', 0.0, 4],
    ['별이 꺼진 하늘', 54, 'pent', 46, 'glass', 'bell', 'wind', 0.3, 6],
    ['안개 속 등대', 43, 'dor', 44, 'choir', 'bell', 'swell', 0.22, 6],
    ['거울 속의 방', 47, 'dim', 52, 'glass', 'piano', 'whisper', 0.35, 4],
    ['비밀 정원', 52, 'lyd', 56, 'strings', 'box', 'drip', 0.45, 4],
    ['긴 복도의 끝', 38, 'phr', 48, 'drone', 'glass', 'tick', 0.28, 4],
    ['낡은 라디오', 48, 'tri', 50, 'choir', 'flute', 'whisper', 0.3, 4],
    ['깊은 밤 자장가', 49, 'min', 66, 'strings', 'box', 'none', 0.6, 4],
    ['눈 내리는 폐교', 51, 'whole', 40, 'choir', 'piano', 'wind', 0.25, 6]
  ];
  const list = T.map((x) => x[0]);
  let ac = null, master, comp, verbIn, timer = null, cur = -1, nextT = 0, beat = 0, tr = null, vol = 0.55, seed = 1, nodes = [], endTimer = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = 0; master.connect(comp);
    const conv = ac.createConvolver(), n = ac.sampleRate * 4.5, ir = ac.createBuffer(2, n, ac.sampleRate);    // 커다란 빈 방 울림
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6) * (i < 400 ? i / 400 : 1); }
    conv.buffer = ir; verbIn = ac.createGain(); verbIn.gain.value = 0.7;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; verbIn.connect(lp); lp.connect(conv); conv.connect(master);
  }
  function out(g, pan, wet) {                       // 소리 → 왼/오른쪽 위치 + 울림
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = pan || 0; g.connect(p); p.connect(master); const w = ac.createGain(); w.gain.value = wet == null ? 0.5 : wet; p.connect(w); w.connect(verbIn); nodes.push(p); }
    else { g.connect(master); const w = ac.createGain(); w.gain.value = wet == null ? 0.5 : wet; g.connect(w); w.connect(verbIn); }
  }
  function env(t, a, hold, rel, v) { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); return g; }
  function osc(type, f, t, d, detune) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune; o.start(t); o.stop(t + d + 0.1); return o; }
  let nbuf = null;
  function noise() { if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true; return s; }

  // ----- 멜로디 악기 -----
  function lead(kind, f, t, d, v, pan) {
    if (kind === 'bell') { const g = ac.createGain(); g.gain.value = 1; [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([r, a]) => { const o = osc('sine', f * r, t, 5), e = env(t, 0.004, 0, 4.5 / (0.6 + r * 0.25), v * a * 0.5); o.connect(e); e.connect(g); }); out(g, pan, 0.8); }
    else if (kind === 'box') { const g = ac.createGain(); [[2, 1], [6.02, 0.25]].forEach(([r, a]) => { const o = osc('triangle', f * r, t, 2), e = env(t, 0.003, 0, 1.5 / (0.5 + r * 0.15), v * a * 0.5); o.connect(e); e.connect(g); }); out(g, pan, 0.6); }
    else if (kind === 'glass') { const o = osc('sine', f * 2, t, d + 2), lfo = osc('sine', 5.2, t, d + 2), lg = ac.createGain(); lg.gain.value = f * 0.008; lfo.connect(lg); lg.connect(o.frequency); const e = env(t, 0.9, d * 0.4, 2.2, v * 0.4); o.connect(e); out(e, pan, 0.9); }
    else if (kind === 'piano') { const g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3, 0.1, 'sine']].forEach(([r, a, ty]) => { const o = osc(ty, f * r, t, 3, (rnd() - 0.5) * 8), e = env(t, 0.008, 0, 2.6 / r, v * a * 0.6); o.connect(e); e.connect(lp); }); lp.connect(g); out(g, pan, 0.7); }
    else if (kind === 'flute') { const o = osc('sine', f * 2, t, d + 1.5), e = env(t, 0.35, d * 0.5, 1.2, v * 0.45), n = noise(), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 4; bp.Q.value = 3; const ng = env(t, 0.3, d * 0.4, 1, v * 0.07); n.connect(bp); bp.connect(ng); n.start(t); n.stop(t + d + 1.6); o.connect(e); const m = ac.createGain(); e.connect(m); ng.connect(m); out(m, pan, 0.8); }
  }
  // ----- 바탕소리 (코드가 천천히 바뀜) -----
  function pad(kind, notes, t, d, v) {
    const g = ac.createGain(); g.gain.value = 1;
    if (kind === 'drone') { notes.forEach((m, i) => { [-6, 6].forEach((dt) => { const o = osc('sawtooth', mtof(m - 12), t, d + 4, dt), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260 + i * 60; const e = env(t, 3.5, d - 2, 3.5, v * 0.22); o.connect(lp); lp.connect(e); e.connect(g); }); }); }
    else if (kind === 'strings') { notes.forEach((m) => { [-9, 0, 9].forEach((dt) => { const o = osc('sawtooth', mtof(m), t, d + 4, dt), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const e = env(t, 3, d - 1.5, 3.5, v * 0.07); o.connect(lp); lp.connect(e); e.connect(g); }); }); }
    else if (kind === 'choir') { notes.forEach((m) => { const o = osc('triangle', mtof(m), t, d + 4), o2 = osc('sine', mtof(m + 12), t, d + 4, 4), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + rnd() * 500; bp.Q.value = 1.4; const e = env(t, 3.2, d - 1.5, 3.5, v * 0.3); o.connect(bp); o2.connect(bp); bp.connect(e); e.connect(g); }); }
    else if (kind === 'sub') { notes.slice(0, 2).forEach((m, i) => { const o = osc('sine', mtof(m - 24 + (i ? 7 : 0)), t, d + 4), e = env(t, 3, d - 1.5, 3.5, v * 0.55); o.connect(e); e.connect(g); }); const o = osc('triangle', mtof(notes[0] - 12), t, d + 4), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const e = env(t, 3, d - 1.5, 3.5, v * 0.18); o.connect(lp); lp.connect(e); e.connect(g); }
    else if (kind === 'glass') { notes.forEach((m) => { const o = osc('sine', mtof(m + 12), t, d + 4), lfo = osc('sine', 4.4 + rnd(), t, d + 4), lg = ac.createGain(); lg.gain.value = 3; lfo.connect(lg); lg.connect(o.detune); const e = env(t, 3.5, d - 2, 3.5, v * 0.13); o.connect(e); e.connect(g); }); }
    out(g, 0, 0.55);
  }
  // ----- 효과음 -----
  function fx(kind, t, v) {
    if (kind === 'wind') { const n = noise(), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; const f0 = 250 + rnd() * 500; bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f0 * (0.6 + rnd() * 1.2), t + 8); const e = env(t, 3.5, 1, 4, v * 0.12); n.connect(bp); bp.connect(e); n.start(t); n.stop(t + 9); out(e, (rnd() - 0.5) * 1.4, 0.5); }
    else if (kind === 'heart') { [0, 0.28].forEach((dt, i) => { const o = osc('sine', 52, t + dt, 0.5); o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(40, t + dt + 0.2); const e = env(t + dt, 0.01, 0, 0.3, v * (i ? 0.45 : 0.6)); o.connect(e); out(e, 0, 0.1); }); }
    else if (kind === 'tick') { const n = noise(), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; const e = env(t, 0.001, 0, 0.03, v * 0.07); n.connect(hp); hp.connect(e); n.start(t); n.stop(t + 0.1); out(e, 0.3, 0.25); }
    else if (kind === 'whisper') { const n = noise(), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 + rnd() * 2400; bp.Q.value = 2.2; const e = env(t, 0.6, 0.5, 1.4, v * 0.1); n.connect(bp); bp.connect(e); n.start(t); n.stop(t + 3); out(e, (rnd() - 0.5) * 1.8, 0.7); }
    else if (kind === 'swell') { const n = noise(), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 6); const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(v * 0.16, t + 6); e.gain.linearRampToValueAtTime(0.0001, t + 6.6); n.connect(bp); bp.connect(e); n.start(t); n.stop(t + 7); out(e, 0, 0.8); }
    else if (kind === 'drip') { const f = 1100 + rnd() * 900, o = osc('sine', f, t, 0.4); o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); const e = env(t, 0.003, 0, 0.18, v * 0.2); o.connect(e); out(e, (rnd() - 0.5) * 1.4, 1.1); }
    else if (kind === 'creak') { const o = osc('sawtooth', 110 + rnd() * 40, t, 2); o.frequency.linearRampToValueAtTime(150 + rnd() * 60, t + 1.4); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 9; const e = env(t, 0.5, 0.4, 0.7, v * 0.05); o.connect(bp); bp.connect(e); out(e, (rnd() - 0.5), 0.6); }
  }

  let padNotes = null, fxNext = 0;
  function chord() {                                 // 음계에서 불안한 코드 만들기 (반음·삼전음을 섞어서 으스스하게)
    const sc = SC[tr[2]], r = tr[1], deg = [0, pick([1, 2, 3]), pick([3, 4, 5]), pick([4, 5, 6])].map((i) => sc[i % sc.length]);
    return deg.map((s, i) => r + s + (i > 1 ? 12 : 0));
  }
  function scheduleAhead() {
    const sb = 60 / tr[3] * 2;                       // 박 하나 길이 (느려요)
    while (nextT < ac.currentTime + 2.5) {
      const t = nextT;
      if (beat % (tr[8] * 4) === 0) { padNotes = chord(); pad(tr[4], padNotes, t, tr[8] * 4 * sb, 1); }
      if (tr[5] !== 'none' && rnd() < tr[7] * (beat % 4 === 0 ? 1.4 : 0.8)) {
        const sc = SC[tr[2]], n = sc[Math.floor(rnd() * sc.length)], oct = pick([12, 12, 24, 24, 36]); let m = tr[1] + n + oct;
        lead(tr[5], mtof(m), t + rnd() * 0.12, sb * (1 + Math.floor(rnd() * 3)), 0.5 + rnd() * 0.3, (rnd() - 0.5) * 1.2);
        if (rnd() < 0.18) lead(tr[5], mtof(m + pick([-7, -5, 7])), t + sb * 0.5, sb, 0.35, (rnd() - 0.5) * 1.2);   // 가끔 메아리처럼 두 번째 음
      }
      const k = tr[6];
      if (k === 'heart') { if (beat % 2 === 0) fx(k, t, 1); }
      else if (k === 'tick') { fx(k, t, 1); }
      else if (k !== 'none' && t > fxNext) { fx(k, t, 1); fxNext = t + (k === 'wind' ? 6 : k === 'swell' ? 14 : 2.5) + rnd() * (k === 'creak' ? 16 : 6); }
      nextT += sb; beat++;
    }
  }
  function play(i) {
    init(); stop(true); cur = (i % T.length + T.length) % T.length; tr = T[cur]; seed = 1000 + cur * 7919 + Math.floor(Math.random() * 99999); beat = 0; fxNext = 0; nbuf = null;
    nextT = ac.currentTime + 0.3; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(vol, ac.currentTime + 3);
    scheduleAhead(); timer = setInterval(scheduleAhead, 400); return list[cur];
  }
  function playRandom() { let i; do { i = Math.floor(Math.random() * T.length); } while (i === cur && T.length > 1); return play(i); }
  function stop(quick) {
    if (timer) { clearInterval(timer); timer = null; }
    if (ac && master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(quick ? master.gain.value : 0, ac.currentTime + (quick ? 0.01 : 2.5)); }
  }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (ac && timer) master.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.3); }
  return { list, play, playRandom, stop, setVolume, get current() { return cur; } };
})();
