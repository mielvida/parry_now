// 스프라이트 편집기: 프레임마다 도트를 찍어 캐릭터의 움직임/공격 모션을 만든다 (editor.html).
// 그림은 Sprites.data에 들어 있고, 바꿀 때마다 localStorage에 저장된다. 게임이 같은 데이터를 읽어 쓴다.
(function () {
  const G = window.Game;
  const S = G.Sprites;
  const W = S.W;
  const H = S.H;
  const CZ = 14; // 편집 화면에서 한 칸의 크기(px)
  const $ = (id) => document.getElementById(id);

  let animKey = 'idle';
  let idx = 0; // 지금 고른 프레임
  let tool = 'pencil';
  let colorIdx = 0;
  let drawing = false;
  let lastCell = null;
  let playing = true;
  const hist = [];
  const redoStack = [];

  const frames = () => S.data.anims[animKey].frames;
  const rows = () => frames()[idx];
  const charOf = (i) => S.DIGITS[i];

  // ---------------- 저장 ----------------
  let savedTimer = 0;
  function save(note) {
    const ok = S.save();
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
    $('saved').textContent = ok ? '저장됨 ' + hh + (note ? ' · ' + note : '') : '저장 실패 (브라우저 저장 공간을 확인하세요)';
    $('saved').style.color = ok ? '' : 'var(--bad)';
    clearTimeout(savedTimer);
  }
  function say(text, bad) {
    $('msg').textContent = text;
    $('msg').className = bad ? 'bad' : '';
  }

  // ---------------- 되돌리기 ----------------
  function pushHist() {
    if (!frames().length) return;
    hist.push({ key: animKey, idx, rows: rows().slice() });
    if (hist.length > 100) hist.shift();
    redoStack.length = 0;
  }
  function restore(from, to) {
    const e = from.pop();
    if (!e) return;
    const fr = S.data.anims[e.key].frames[e.idx];
    if (!fr) return;
    to.push({ key: e.key, idx: e.idx, rows: fr.slice() });
    S.data.anims[e.key].frames[e.idx] = e.rows.slice();
    animKey = e.key;
    idx = e.idx;
    full();
    save();
  }

  // ---------------- 그리기 ----------------
  const grid = $('grid');
  grid.width = W * CZ;
  grid.height = H * CZ;
  const gctx = grid.getContext('2d');

  function drawGrid() {
    gctx.clearRect(0, 0, grid.width, grid.height);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        gctx.fillStyle = (x + y) % 2 ? '#2a2f3d' : '#232836';
        gctx.fillRect(x * CZ, y * CZ, CZ, CZ);
      }
    }
    const fr = frames();
    if ($('optOnion').checked && idx > 0 && fr[idx - 1]) { // 이전 프레임을 흐리게 비춘다
      gctx.globalAlpha = 0.3;
      paintRows(fr[idx - 1], true);
      gctx.globalAlpha = 1;
    }
    if (fr[idx]) paintRows(fr[idx], false);
    if ($('optGuide').checked) { // 몸 크기 가이드: 12 x 16칸, 발바닥 가운데가 기준점
      gctx.setLineDash([5, 4]);
      gctx.strokeStyle = 'rgba(120,190,255,0.9)';
      gctx.lineWidth = 1.5;
      gctx.strokeRect((W / 2 - 6) * CZ + 0.5, (H - 16) * CZ + 0.5, 12 * CZ, 16 * CZ - 1);
      gctx.setLineDash([]);
      gctx.strokeStyle = 'rgba(255,255,255,0.5)';
      gctx.beginPath(); gctx.moveTo((W / 2) * CZ + 0.5, (H - 1) * CZ); gctx.lineTo((W / 2) * CZ + 0.5, H * CZ); gctx.stroke();
      gctx.fillStyle = '#ffd54a'; // 손 위치 (오른쪽으로 3칸, 위로 8칸)
      gctx.beginPath(); gctx.arc((W / 2 + 3) * CZ + CZ / 2, (H - 8) * CZ + CZ / 2, 4, 0, Math.PI * 2); gctx.fill();
    }
    if ($('optGrid').checked) {
      gctx.lineWidth = 1;
      for (let x = 0; x <= W; x++) {
        gctx.strokeStyle = x % 8 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
        gctx.beginPath(); gctx.moveTo(x * CZ + 0.5, 0); gctx.lineTo(x * CZ + 0.5, H * CZ); gctx.stroke();
      }
      for (let y = 0; y <= H; y++) {
        gctx.strokeStyle = y % 8 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
        gctx.beginPath(); gctx.moveTo(0, y * CZ + 0.5); gctx.lineTo(W * CZ, y * CZ + 0.5); gctx.stroke();
      }
    }
    if (!fr.length) {
      gctx.fillStyle = 'rgba(255,255,255,0.7)';
      gctx.font = 'bold 18px sans-serif';
      gctx.textAlign = 'center';
      gctx.fillText('프레임이 없어요. 왼쪽의 "+ 새 칸" 또는 오른쪽의 "기본 모습으로 채우기"를 눌러 시작하세요', grid.width / 2, grid.height / 2);
      gctx.textAlign = 'start';
    }
  }
  function paintRows(r, gray) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = r[y][x];
        if (ch === '.') continue;
        gctx.fillStyle = gray ? '#cfd6ea' : S.data.palette[S.DIGITS.indexOf(ch)] || '#f0f';
        gctx.fillRect(x * CZ, y * CZ, CZ, CZ);
      }
    }
  }

  function cellAt(e) {
    const r = grid.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * (grid.width / r.width)) / CZ);
    const y = Math.floor(((e.clientY - r.top) * (grid.height / r.height)) / CZ);
    return x >= 0 && x < W && y >= 0 && y < H ? { x, y } : null;
  }
  function setCell(x, y, ch) {
    const r = rows();
    if (r[y][x] === ch) return;
    r[y] = r[y].slice(0, x) + ch + r[y].slice(x + 1);
  }
  function line(a, b, ch) { // 두 칸 사이를 빠짐없이 (빠르게 끌어도 끊기지 않게)
    let { x: x0, y: y0 } = a;
    const dx = Math.abs(b.x - x0);
    const dy = -Math.abs(b.y - y0);
    const sx = x0 < b.x ? 1 : -1;
    const sy = y0 < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      setCell(x0, y0, ch);
      if (x0 === b.x && y0 === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function floodFill(x, y, ch) {
    const r = rows();
    const from = r[y][x];
    if (from === ch) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= W || cy < 0 || cy >= H || r[cy][cx] !== from) continue;
      setCell(cx, cy, ch);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function applyAt(e, first) {
    const c = cellAt(e);
    if (!c) return;
    const erase = tool === 'eraser' || e.buttons === 2 || e.button === 2;
    const ch = erase ? '.' : charOf(colorIdx);
    if (tool === 'pick' && !erase) {
      const v = rows()[c.y][c.x];
      if (v !== '.') { colorIdx = S.DIGITS.indexOf(v); setTool('pencil'); drawPalette(); }
      return;
    }
    if (tool === 'fill' && !erase) {
      if (first) floodFill(c.x, c.y, ch);
    } else {
      line(lastCell || c, c, ch);
    }
    lastCell = c;
    drawGrid();
  }

  grid.addEventListener('contextmenu', (e) => e.preventDefault());
  grid.addEventListener('pointerdown', (e) => {
    if (!frames().length) { addFrame(); }
    try { grid.setPointerCapture(e.pointerId); } catch (err) { /* 일부 입력 장치는 캡처를 지원하지 않는다 */ }
    drawing = true;
    lastCell = null;
    pushHist();
    applyAt(e, true);
  });
  grid.addEventListener('pointermove', (e) => { if (drawing) applyAt(e, false); });
  const endStroke = () => {
    if (!drawing) return;
    drawing = false;
    lastCell = null;
    save();
    drawStrip();
  };
  grid.addEventListener('pointerup', endStroke);
  grid.addEventListener('pointercancel', endStroke);

  // ---------------- 도구/색 ----------------
  function setTool(t) {
    tool = t;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  }
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

  function drawPalette() {
    const el = $('palette');
    el.innerHTML = '';
    S.data.palette.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw' + (i === colorIdx ? ' on' : '');
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', () => { colorIdx = i; if (tool === 'eraser') setTool('pencil'); drawPalette(); });
      el.appendChild(b);
    });
    $('palInfo').textContent = S.data.palette.length + ' / ' + S.MAX_PALETTE + '색';
  }
  $('colorAdd').addEventListener('click', () => {
    const before = S.data.palette.length;
    colorIdx = S.colorIndex($('colorPick').value, 0);
    if (S.data.palette.length === before && S.data.palette.length >= S.MAX_PALETTE) say('팔레트가 가득 차서 가장 가까운 색을 골랐어요.', true);
    drawPalette();
    save();
  });

  // ---------------- 프레임 ----------------
  function drawStrip() {
    const el = $('strip');
    el.innerHTML = '';
    frames().forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'thumb' + (i === idx ? ' on' : '');
      const c = document.createElement('canvas');
      c.width = W * 2;
      c.height = H * 2;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#12141d';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(S.canvas(animKey, i), 0, 0, c.width, c.height);
      b.appendChild(c);
      const n = document.createElement('span');
      n.textContent = i + 1;
      b.appendChild(n);
      b.addEventListener('click', () => { idx = i; hist.length = 0; redoStack.length = 0; full(); });
      el.appendChild(b);
    });
    $('frameCount').textContent = '(' + frames().length + ' / ' + S.MAX_FRAMES + ')';
  }
  function addFrame(copy) {
    if (frames().length >= S.MAX_FRAMES) { say('프레임은 한 동작에 최대 ' + S.MAX_FRAMES + '장까지예요.', true); return; }
    const fr = frames();
    const n = copy && fr[idx] ? fr[idx].slice() : S.blankRows();
    fr.splice(idx + (fr.length ? 1 : 0), 0, n);
    idx = fr.length === 1 ? 0 : idx + 1;
    hist.length = 0; redoStack.length = 0;
    save();
    full();
  }
  $('fAdd').addEventListener('click', () => addFrame(false));
  $('fDup').addEventListener('click', () => addFrame(true));
  $('fDel').addEventListener('click', () => {
    if (!frames().length) return;
    frames().splice(idx, 1);
    idx = Math.max(0, Math.min(idx, frames().length - 1));
    hist.length = 0; redoStack.length = 0;
    save();
    full();
  });
  const moveFrame = (d) => {
    const fr = frames();
    const j = idx + d;
    if (j < 0 || j >= fr.length) return;
    [fr[idx], fr[j]] = [fr[j], fr[idx]];
    idx = j;
    hist.length = 0; redoStack.length = 0;
    save();
    full();
  };
  $('fLeft').addEventListener('click', () => moveFrame(-1));
  $('fRight').addEventListener('click', () => moveFrame(1));

  // ---------------- 편집 버튼들 ----------------
  $('mirror').addEventListener('click', () => {
    if (!frames().length) return;
    pushHist();
    frames()[idx] = rows().map((r) => r.split('').reverse().join(''));
    save();
    full();
  });
  $('clear').addEventListener('click', () => {
    if (!frames().length) return;
    pushHist();
    frames()[idx] = S.blankRows();
    save();
    full();
  });
  $('undo').addEventListener('click', () => restore(hist, redoStack));
  $('redo').addEventListener('click', () => restore(redoStack, hist));
  ['optGrid', 'optOnion', 'optGuide'].forEach((id) => $(id).addEventListener('change', drawGrid));

  // ---------------- 동작 탭/설정 ----------------
  function drawTabs() {
    const el = $('tabs');
    el.innerHTML = '';
    for (const k of S.ANIM_KEYS) {
      const b = document.createElement('button');
      b.className = 'tab' + (k === animKey ? ' on' : '');
      const n = S.data.anims[k].frames.length;
      b.innerHTML = S.ANIM_NAMES[k] + '<small>' + (n ? n + '장' : '없음') + '</small>';
      b.addEventListener('click', () => { animKey = k; idx = 0; hist.length = 0; redoStack.length = 0; full(); });
      el.appendChild(b);
    }
  }
  function syncSettings() {
    $('animHelp').textContent = S.ANIM_HELP[animKey];
    $('fpsRow').style.display = animKey === 'idle' ? '' : 'none';
    $('fps').value = S.data.anims[animKey].fps;
    $('weapon').checked = S.data.anims[animKey].weapon;
    $('enabled').checked = S.data.enabled;
    $('trail').checked = S.data.trail;
    $('where').textContent = '— ' + S.ANIM_NAMES[animKey] + (frames().length ? ' · ' + (idx + 1) + '번째 프레임' : '');
  }
  $('fps').addEventListener('change', () => { S.data.anims[animKey].fps = Math.max(1, Math.min(30, Number($('fps').value) || 4)); save(); syncSettings(); });
  $('weapon').addEventListener('change', () => { S.data.anims[animKey].weapon = $('weapon').checked; save(); });
  $('enabled').addEventListener('change', () => {
    S.data.enabled = $('enabled').checked;
    save(S.data.enabled ? '게임에 적용됨' : '게임에서 끔');
    if (S.data.enabled && !S.hasFrames()) say('아직 그린 프레임이 없어서 게임에서는 기본 모습으로 보여요.', true);
  });
  $('trail').addEventListener('change', () => { S.data.trail = $('trail').checked; save(); });

  // ---------------- 기본 모습 / 백업 ----------------
  $('impOne').addEventListener('click', () => {
    if (frames().length && !confirm('"' + S.ANIM_NAMES[animKey] + '" 동작의 지금 그림을 지우고 기본 용사 모습으로 채울까요?')) return;
    const n = S.importDefault(animKey);
    idx = 0; hist.length = 0; redoStack.length = 0;
    save(); full();
    say('기본 모습 ' + n + '장으로 채웠어요. 이제 마음대로 고쳐 그리세요!');
  });
  $('impAll').addEventListener('click', () => {
    if (S.hasFrames() && !confirm('모든 동작의 지금 그림을 지우고 기본 용사 모습으로 채울까요?')) return;
    S.importAllDefaults();
    idx = 0; hist.length = 0; redoStack.length = 0;
    save(); full();
    say('모든 동작을 기본 모습으로 채웠어요.');
  });
  $('exp').addEventListener('click', () => {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'parry_sprites.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('parry_sprites.json 으로 내보냈어요.');
  });
  $('imp').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', () => {
    const f = $('impFile').files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      if (S.importJSON(String(rd.result))) {
        idx = 0; hist.length = 0; redoStack.length = 0;
        full();
        save('가져옴');
        say('가져왔어요.');
      } else {
        say('올바른 스프라이트 파일이 아니에요.', true);
      }
      $('impFile').value = '';
    };
    rd.readAsText(f);
  });
  $('wipe').addEventListener('click', () => {
    if (!confirm('그린 프레임을 전부 지울까요? (되돌릴 수 없어요. 먼저 내보내기로 백업할 수 있어요)')) return;
    const keepEnabled = false;
    S.data = S._sanitize(null);
    S.data.enabled = keepEnabled;
    idx = 0; hist.length = 0; redoStack.length = 0;
    save(); full();
    say('전부 초기화했어요.');
  });

  // ---------------- 미리보기 (게임과 같은 규칙으로 프레임을 고른다) ----------------
  const pv = $('preview');
  const pctx = pv.getContext('2d');
  let pvT = 0;
  let last = performance.now();
  function previewState(t) {
    const p = { vx: 0, vy: 0, onGround: true, animTime: t, runPhase: 0, swing: -1, guardTimer: 0 };
    if (animKey === 'run') p.runPhase = t * 11; // 달리는 속도로
    if (animKey === 'jump') p.vy = -640 * (1 - ((t * 1.4) % 1));
    if (animKey === 'fall') p.vy = 900 * ((t * 1.2) % 1);
    if (animKey === 'attack') { const f = Math.floor((t * 60) % 44); p.swing = f < 20 ? f : 19; } // 1/3초 베고 잠깐 쉰다
    if (animKey === 'guard') p.guardTimer = Math.max(0.001, 0.35 - ((t * 1.6) % 0.35));
    return p;
  }
  function drawPreview(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) pvT += dt;
    pctx.fillStyle = '#12141d';
    pctx.fillRect(0, 0, pv.width, pv.height);
    const fr = frames();
    if (fr.length) {
      const i = playing ? S.frameIndex(animKey, previewState(pvT)) : idx;
      const sc = 3;
      pctx.imageSmoothingEnabled = false;
      pctx.drawImage(S.canvas(animKey, Math.max(0, Math.min(fr.length - 1, i))), (pv.width - W * sc) / 2, pv.height - H * sc - 4, W * sc, H * sc);
      pctx.fillStyle = 'rgba(255,255,255,0.15)';
      pctx.fillRect(0, pv.height - 4, pv.width, 1);
      pctx.fillStyle = '#ffd54a';
      pctx.font = '12px sans-serif';
      pctx.fillText((i + 1) + '번째 프레임', 6, 14);
    } else {
      pctx.fillStyle = 'rgba(255,255,255,0.5)';
      pctx.font = '13px sans-serif';
      pctx.fillText('그린 프레임이 없어요', 40, pv.height / 2);
    }
    requestAnimationFrame(drawPreview);
  }
  $('play').addEventListener('click', () => {
    playing = !playing;
    $('play').innerHTML = (playing ? '⏸ 멈춤' : '▶ 재생') + ' <kbd>Space</kbd>';
  });

  // ---------------- 단축키 ----------------
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); restore(hist, redoStack); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); restore(redoStack, hist); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'p') setTool('pencil');
    else if (k === 'e') setTool('eraser');
    else if (k === 'f') setTool('fill');
    else if (k === 'i') setTool('pick');
    else if (k === ' ') { e.preventDefault(); $('play').click(); }
    else if (k === 'arrowleft' && idx > 0) { idx--; hist.length = 0; redoStack.length = 0; full(); }
    else if (k === 'arrowright' && idx < frames().length - 1) { idx++; hist.length = 0; redoStack.length = 0; full(); }
  });

  // ---------------- 전체 다시 그리기 ----------------
  function full() {
    drawTabs();
    syncSettings();
    drawStrip();
    drawGrid();
    drawPalette();
  }

  // 다른 탭(게임)에서 K 키로 켜고 끄면 체크박스도 맞춘다
  window.addEventListener('storage', () => { $('enabled').checked = S.data.enabled; $('trail').checked = S.data.trail; });

  // 처음 열었는데 그림이 하나도 없으면 기본 용사 모습으로 채워 준다 (빈 칸에서 시작하지 않아도 되게)
  if (!S.hasFrames()) {
    S.importAllDefaults();
    S.save();
    say('처음이라 기본 용사 모습을 불러왔어요. 고쳐 그리고, 오른쪽의 "게임에서 내 스프라이트 쓰기"를 켜세요!');
  }
  full();
  requestAnimationFrame(drawPreview);
})();
