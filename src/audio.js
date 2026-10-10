// 효과음 + 배경음악: 음원 파일 없이 Web Audio로 직접 합성한다. G.Audio.play('이름')으로 재생. M 키로 음소거.
// 브라우저 정책상 첫 키 입력 이후에야 소리가 난다.
(function (G) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let pitch = 1; // 재생 때마다 바뀌는 음높이 배율 (효과음마다 살짝씩 다르게)
  let bgm = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      startBgm();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // 음 하나: 주파수를 f0 -> f1로 미끄러뜨리며 지수 감쇠
  function tone(type, f0, f1, dur, vol, delay = 0, dest = master) {
    const t = ctx.currentTime + delay;
    f0 *= pitch;
    f1 *= pitch;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // 노이즈 한 번: 필터 주파수를 f0 -> f1로 훑는다
  function noise(dur, vol, f0, f1, filter = 'bandpass', delay = 0, q = 1, dest = master) {
    const t = ctx.currentTime + delay;
    f0 *= pitch;
    f1 *= pitch;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    jump: () => tone('square', 260, 520, 0.12, 0.035),
    swing: () => { // 휙! 공명이 강한 필터로 낮은 음에서 높은 음까지 빠르게 훑는다
      noise(0.28, 5, 300, 3500, 'bandpass', 0, 6);
      noise(0.2, 1.5, 1500, 6000, 'bandpass', 0.03, 3);
    },
    parry: () => { // 쨍! 하는 금속 충돌
      noise(0.1, 0.5, 6000, 2500, 'highpass');
      tone('triangle', 1760, 1320, 0.25, 0.3);
      tone('triangle', 2637, 2000, 0.18, 0.18);
    },
    hurt: () => { // 맞았을 때: 낮고 둔탁하게
      tone('sawtooth', 220, 60, 0.3, 0.3);
      noise(0.2, 0.4, 900, 150, 'lowpass');
    },
    charge: () => { // 게이지 가득
      tone('sine', 660, 660, 0.12, 0.2);
      tone('sine', 990, 990, 0.2, 0.2, 0.08);
    },
    throw: () => {
      noise(0.3, 0.35, 700, 3500, 'bandpass');
      tone('square', 300, 700, 0.18, 0.08);
    },
    catch: () => {
      tone('triangle', 900, 1400, 0.1, 0.25);
      noise(0.06, 0.25, 4000, 2000, 'highpass');
    },
    spawn: () => tone('sine', 120, 380, 0.25, 0.25), // 슬라임 뽕
    vanish: () => { // 슬라임이 터지는 소리: 퐉! 하고 터지며 질척하게 퍼진다
      tone('sine', 700, 90, 0.14, 0.3);
      tone('sine', 380, 60, 0.2, 0.22, 0.05);
      noise(0.22, 1.2, 1800, 250, 'bandpass', 0, 2);
      noise(0.1, 0.35, 5000, 1500, 'highpass');
    },
    gameover: () => {
      [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.28, i * 0.28));
    },
    treasure: () => { // 팡파레
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.22, 0.14, i * 0.12));
      tone('square', 1047, 1047, 0.7, 0.14, 0.5);
      tone('triangle', 523, 523, 0.7, 0.2, 0.5);
    },
    pickup: () => {
      tone('sine', 880, 1320, 0.12, 0.22);
      tone('sine', 1320, 1760, 0.2, 0.22, 0.1);
    },
    pop: () => { // 코르크 뽑히는 소리
      tone('sine', 200, 700, 0.12, 0.4);
      noise(0.08, 0.3, 2500, 800, 'bandpass');
    },
    coin: () => { // 짤랑
      tone('square', 1568, 1568, 0.08, 0.1);
      tone('square', 2093, 2093, 0.16, 0.1, 0.06);
    },
    clack: () => { // 꽃게가 집게를 딱딱
      noise(0.04, 2.5, 3500, 1800, 'highpass');
      noise(0.04, 2.5, 3500, 1800, 'highpass', 0.1);
      tone('triangle', 1400, 900, 0.05, 0.15);
      tone('triangle', 1400, 900, 0.05, 0.15, 0.1);
    },
    deny: () => tone('square', 180, 120, 0.15, 0.1), // 살 수 없을 때 부저
    crit: () => { // 치명타: 묵직한 쾅 + 높은 쨍 + 올라가는 반짝임
      noise(0.14, 2.4, 1800, 200, 'lowpass');
      tone('sawtooth', 220, 70, 0.2, 0.22);
      tone('triangle', 1976, 1568, 0.35, 0.3);
      tone('triangle', 2637, 3136, 0.3, 0.22, 0.06);
      tone('square', 3520, 4698, 0.18, 0.08, 0.12);
    },
    gun: () => { // 탕!
      noise(0.1, 3, 3000, 400, 'lowpass');
      noise(0.05, 1.5, 6000, 3000, 'highpass');
      tone('square', 160, 50, 0.1, 0.18);
    },
    bow: () => { // 활시위: 팅
      tone('triangle', 520, 180, 0.12, 0.25);
      noise(0.1, 0.8, 2000, 5000, 'bandpass', 0, 2);
    },
    boom: () => { // 폭탄 폭발: 쿵
      noise(0.45, 4, 900, 60, 'lowpass');
      tone('sawtooth', 110, 30, 0.4, 0.3);
    },
    fire: () => { // 불덩이 발사: 화르륵
      noise(0.3, 1.6, 500, 2200, 'bandpass', 0, 3);
      tone('sawtooth', 180, 520, 0.28, 0.12);
    },
    zap: () => { // 번개: 지직
      noise(0.16, 2.2, 4500, 1500, 'highpass');
      tone('square', 900, 260, 0.16, 0.1);
      tone('square', 1200, 300, 0.12, 0.08, 0.05);
    },
    poison: () => { // 독 방울: 보글보글
      tone('sine', 300, 620, 0.12, 0.22);
      tone('sine', 380, 760, 0.12, 0.2, 0.08);
      tone('sine', 260, 520, 0.14, 0.18, 0.16);
    },
    shatter: () => { // 얼음이 와장창
      noise(0.28, 2.2, 7000, 2500, 'highpass');
      tone('triangle', 2400, 900, 0.22, 0.14);
      tone('triangle', 3100, 1200, 0.18, 0.1, 0.04);
      tone('sine', 1500, 500, 0.25, 0.1, 0.02);
    },
    dash: () => { // 슉! 짧고 빠른 바람 소리
      noise(0.16, 1.8, 3500, 700, 'bandpass', 0, 2);
      tone('sawtooth', 700, 220, 0.12, 0.05);
    },
    scroll: () => noise(0.5, 0.2, 500, 2500, 'bandpass'),
  };

  // ---- 배경음악: 스테이지마다 곡이 다르다 ----
  //   cave    동굴 모험 분위기의 단조 루프 (베이스 + 아르페지오 + 즉흥 멜로디)
  //   village 활기찬 장조 마을 노래 (쿵-짝 베이스 + 통통 튀는 코드 + 하이햇 + 정해진 멜로디)
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const CAVE = {
    step: 0.28, // 8분음표 길이(초)
    prog: [ // [베이스 음, 화음 3음] 한 마디씩, 8마디 반복
      [45, [57, 60, 64]], // Am
      [41, [53, 57, 60]], // F
      [48, [55, 60, 64]], // C
      [43, [55, 59, 62]], // G
      [45, [57, 60, 64]], // Am
      [41, [53, 57, 60]], // F
      [40, [56, 59, 64]], // E
      [45, [57, 60, 64]], // Am
    ],
    arp: [0, 1, 2, 1, 0, 1, 2, 1],
  };

  const VILLAGE = {
    step: 0.2, // 동굴(0.28)보다 40% 빠르다
    prog: [ // C - G - Am - F - C - G - F - G
      [48, [60, 64, 67]],
      [43, [59, 62, 67]],
      [45, [57, 60, 64]],
      [41, [57, 60, 65]],
      [48, [60, 64, 67]],
      [43, [59, 62, 67]],
      [41, [57, 60, 65]],
      [43, [59, 62, 67]],
    ],
    melody: [ // 마디마다 8박 (null = 쉼표). 도(C5)=72
      [76, null, 79, 76, 72, null, 76, 79],
      [74, null, 79, 74, 71, null, 74, 79],
      [76, null, 81, 76, 72, null, 76, 81],
      [77, null, 81, 77, 72, null, 77, 81],
      [79, 81, 79, 76, 72, 76, 79, null],
      [74, 76, 74, 71, 67, 71, 74, null],
      [77, 79, 77, 72, 77, 79, 81, null],
      [79, 77, 76, 74, 71, 74, 79, null],
    ],
  };

  const TRACKS = {
    cave: {
      step: CAVE.step, bars: CAVE.prog.length, vol: 0.22,
      play(bar, i, d, dest) {
        const [bass, chord] = CAVE.prog[bar];
        const s = CAVE.step;
        if (i === 0 || i === 4) tone('triangle', midi(bass), midi(bass), s * 3.5, 0.5, d, dest);
        tone('triangle', midi(chord[CAVE.arp[i]] + 12), midi(chord[CAVE.arp[i]] + 12), s * 1.2, 0.16, d, dest);
        if ((i === 0 || i === 3 || i === 6) && Math.random() < 0.7) { // 화음 위에서 즉흥 멜로디
          const n = chord[Math.floor(Math.random() * 3)] + 12 + (Math.random() < 0.3 ? 12 : 0);
          tone('sine', midi(n), midi(n), s * 2.5, 0.3, d, dest);
        }
      },
    },
    village: {
      step: VILLAGE.step, bars: VILLAGE.prog.length, vol: 0.24,
      play(bar, i, d, dest) {
        const [root, chord] = VILLAGE.prog[bar];
        const s = VILLAGE.step;
        if (i === 0) tone('triangle', midi(root), midi(root), s * 1.7, 0.55, d, dest);          // 쿵
        if (i === 4) tone('triangle', midi(root + 7), midi(root + 7), s * 1.7, 0.5, d, dest);   // 쿵 (5도)
        if (i === 2 || i === 6) for (const n of chord) tone('square', midi(n), midi(n), s * 0.8, 0.045, d, dest); // 짝 (통통 튀는 코드)
        const m = VILLAGE.melody[bar][i];
        if (m) { // 멜로디: 부드러운 삼각파에 사각파를 살짝 겹친다
          tone('triangle', midi(m), midi(m), s * 1.5, 0.22, d, dest);
          tone('square', midi(m), midi(m), s * 1.1, 0.04, d, dest);
        }
        if (i % 2 === 1) noise(0.05, 0.35, 7000, 5000, 'highpass', d, 1, dest); // 하이햇 (탬버린 느낌)
      },
    },
  };

  let track = 'cave';      // 지금 재생 중인 곡
  let wantTrack = 'cave';  // 원하는 곡 (오디오가 깨어나기 전에 정해질 수 있다)
  let bgmStep = 0;
  let bgmTime = 0;

  function scheduleBgm() {
    if (!ctx) return;
    const tr = TRACKS[track];
    if (bgmTime < ctx.currentTime) bgmTime = ctx.currentTime + 0.05; // 탭이 멈췄다 돌아온 경우 따라잡기
    while (bgmTime < ctx.currentTime + 0.6) {
      tr.play(Math.floor(bgmStep / 8) % tr.bars, bgmStep % 8, bgmTime - ctx.currentTime, bgm);
      bgmTime += tr.step;
      bgmStep += 1;
    }
  }

  function makeBgmGain(vol, fadeIn) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(fadeIn ? 0.0001 : vol, ctx.currentTime);
    if (fadeIn) g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.5);
    g.connect(master);
    return g;
  }

  function startBgm() {
    track = wantTrack;
    bgm = makeBgmGain(TRACKS[track].vol, false);
    bgmTime = ctx.currentTime + 0.1;
    scheduleBgm();
    setInterval(scheduleBgm, 150);
  }

  // 곡 바꾸기: 지금 곡은 0.5초 동안 서서히 작아지고, 새 곡이 처음부터 서서히 커진다
  function switchTrack(name) {
    const old = bgm;
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setValueAtTime(old.gain.value, ctx.currentTime);
    old.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    track = name;
    bgm = makeBgmGain(TRACKS[name].vol, true);
    bgmStep = 0;
    bgmTime = ctx.currentTime + 0.1;
    scheduleBgm();
  }

  // 멜로디가 있는 소리는 음높이를 흔들지 않는다
  const FIXED_PITCH = new Set(['gameover', 'treasure', 'pickup', 'charge']);

  const Audio = {
    play(name) {
      if (muted || !ensure()) return;
      const fn = SOUNDS[name];
      if (!fn) return;
      pitch = FIXED_PITCH.has(name) ? 1 : 0.85 + Math.random() * 0.35; // 재생할 때마다 높낮이가 조금씩 다르게
      fn();
      pitch = 1;
    },
    // 배경음악 곡 선택: 'cave' | 'village'. 오디오가 아직 깨어나기 전이면 깨어날 때 이 곡으로 시작한다
    setMusic(name) {
      if (!TRACKS[name]) return;
      wantTrack = name;
      if (ctx && bgm && name !== track) switchTrack(name);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
  };

  // 첫 입력 때 오디오를 깨운다. M = 음소거 토글
  window.addEventListener('keydown', (e) => {
    ensure();
    if (e.code === 'KeyM' && !e.repeat) Audio.toggleMute();
  });

  G.Audio = Audio;
})(window.Game);
