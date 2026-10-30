// 튜토리얼: 새 게임을 시작할 때 한 번 떠서 게임의 모든 기능을 차례대로 알려 준다.
// 처음 화면이나 게임 중에 H 키를 누르면 언제든 다시 볼 수 있다. 보는 동안 게임은 멈춰 있다.
// 고치려면 아래 PAGES 의 글만 바꾸면 된다 (k: 키 이름, 나머지는 설명).
(function (G) {
  const k = (s) => `<kbd>${s}</kbd>`;
  const PAGES = [
    { icon: '⚔️', title: '환영해요, 용사!', body: [
      '몬스터를 물리쳐 <b>코인</b>과 <b>경험치</b>를 모으고, 마을에서 장비를 사서 점점 강해지는 모험이에요.',
      '처음에는 보물 지도 이야기가 나오고, 동굴에서 슬라임과 박쥐를 만나요.',
      '마을에서는 가게, 집 꾸미기, 낚시, 요리 같은 것도 할 수 있어요.',
      `이 설명은 ${k('H')} 키로 <b>언제든 다시</b> 볼 수 있어요 (처음 화면에서도 돼요).`,
      `${k('←')} ${k('→')} 또는 ${k('Enter')} 로 넘기고, ${k('Esc')} 로 닫아요.`] },
    { icon: '🏃', title: '걷고 뛰기', body: [
      `${k('←')} ${k('→')} 또는 ${k('A')} ${k('D')} : 걷기`,
      `${k('Space')} ${k('↑')} ${k('W')} ${k('Z')} : 점프 (오래 누르면 더 높이 올라가요)`,
      `${k('Shift')} 또는 ${k('X')} : 3칸 <b>대시</b> (빠르게 피하거나 건널 때)`,
      `${k('C')} : <b>슬라이딩</b> (납작하게 미끄러져 좁은 곳을 지나요)`,
      `${k('R')} : 막혔을 때 <b>처음 위치로</b> 돌아가기`,
      '물속에서는 위(W·↑·Space), 아래(S·↓)로 헤엄쳐요.'] },
    { icon: '🗡️', title: '싸우기 ① 패링', body: [
      `${k('Enter')} 또는 <b>마우스 왼쪽</b> : 검을 휘둘러 <b>패링</b>! 다가오는 몬스터를 받아쳐서 멀리 튕겨내요.`,
      '짧은 시간 동안만 판정이 있어서 <b>몬스터가 닿기 직전에 알맞게</b> 누르는 게 중요해요.',
      '한 번 휘두른 뒤 곧바로 한 번 더 누르면 <b>2단 공격</b>이 나가요.',
      '튕겨난 슬라임은 어딘가에 부딪히면 터져서 코인을 남겨요.',
      '쿨다운(대기 시간)이 있으니 마구 누르기만 하면 안 돼요.'] },
    { icon: '🌀', title: '싸우기 ② 검 던지기 · 막기', body: [
      `${k('Enter')} 나 마우스 왼쪽을 <b>길게 눌러</b> 게이지를 채우고 떼면 <b>검을 던져요</b> (부메랑처럼 날아갔다 돌아와요). 많이 채울수록 멀리 가요.`,
      '검이 나가 있는 동안에는 패링을 못 해요. 돌아오면 다시 잡아요.',
      `${k('F')} : <b>막기</b> (누르고 있는 동안 공격을 막아요)`,
      '<b>목숨(하트)</b>은 화면 오른쪽 위에 있어요. 다 없어지면 게임 오버가 되니 조심하세요.'] },
    { icon: '🎒', title: '무기와 인벤토리', body: [
      `왼쪽 위의 칸 ${k('1')}~${k('5')} : 숫자 키로 <b>무기를 바로 바꿔</b> 들어요.`,
      `${k('I')} 또는 ${k(']')} : <b>인벤토리</b>. 가진 무기·방어구를 장착하고 칸에 넣어요.`,
      '<b>지팡이</b>류는 마법 구슬(불덩이·독 방울·번개)을 쏘고, 무기마다 공격 모양과 속도가 달라요.',
      '무기를 강화하면 더 세져요. 강화는 마을의 대장간·강화소에서 해요.'] },
    { icon: '🧪', title: '아이템 바로 쓰기', body: [
      `${k('Q')} : 게임 중에 바로 <b>물약</b> 마시기 (체력 회복)`,
      `${k('B')} : <b>얼음 폭탄</b> 던지기 (가게에서 사야 해요)`,
      `${k('V')} : 가진 <b>음식</b> 중 가장 좋은 걸 먹기`,
      '코인은 가게에서 물건을 살 때, 경험치(EXP)는 강화소에서 능력을 키울 때 써요.',
      '몬스터와 보물 상자에서 코인과 재료를 얻어요.'] },
    { icon: '🏘️', title: '마을 ① 가게와 사람들', body: [
      `${k('E')} : 문, 가게, 마을 사람과 <b>이야기하기·들어가기</b>. 반짝이는 곳에 서서 눌러 보세요.`,
      '<b>물약 상점</b> 회복·도구 / <b>대장간</b> 무기 강화·제작 / <b>특수 무기 상점</b> / <b>갑옷·바지 가게</b>',
      '<b>여관</b> 쉬기 / <b>음식점</b> 요리 / <b>강화소(EXP)</b>와 <b>훈련소</b> 능력 키우기',
      '<b>부동산</b>은 집을 팔고, <b>인테리어 가게</b>는 집 꾸미는 물건을 팔아요.',
      '가게에서는 방향키로 고르고 Enter(또는 마우스 클릭)로 사요. Esc 나 E 로 나와요.'] },
    { icon: '🏠', title: '마을 ② 내 집 · 지도 · 업적', body: [
      '부동산에서 집을 사면 마을의 <b>내 집 터</b>에서 들어갈 수 있어요 (마을과 왕국은 집이 따로 있어요).',
      '집에 <b>장식</b>을 놓을수록 코인을 더 얻고 치명타 확률도 올라가요.',
      `${k('N')} : <b>마을 지도</b> (가게에서 지도를 사면 쓸 수 있어요)`,
      `${k('T')} : <b>업적</b> 보기`,
      '왕국의 도감관에게서 <b>도감</b>을 볼 수 있고, 왕은 큰 목표를 내려줘요.'] },
    { icon: '🗺️', title: '모험 떠나기', body: [
      '마을의 <b>문</b>으로 숲·설산·화산 같은 다른 지역에 갈 수 있어요. 지역마다 몬스터와 보상이 달라요.',
      '<b>광물 동굴</b>에서는 광석을 캐서 재료를 모아요. 해변과 바다에서는 낚시와 잠수를 해요.',
      '더 깊이 들어가면 <b>던전·다크월드·왕국</b>이 나오고, 곳곳에 강한 <b>보스</b>가 있어요.',
      '길이 막혀 있거나 통행료가 있는 곳도 있어요. 코인을 모아 다시 도전해 보세요.'] },
    { icon: '🎣', title: '생활과 놀이', body: [
      '<b>낚시</b>: 물가에서 E 로 시작해서 타이밍에 맞춰 잡아요. 잡은 물고기는 팔거나 요리해요.',
      '<b>요리</b>: 재료로 음식을 만들어 V 키로 먹으면 힘이 나요. 요리사를 고용해 요리를 맡길 수도 있어요.',
      '<b>길드</b>와 <b>미니게임</b>(야바위·맞추기·결투·총게임)으로 코인과 상품을 얻어요.',
      '모든 걸 다 하지 않아도 돼요. 마음에 드는 방법으로 즐기세요!'] },
    { icon: '💾', title: '저장과 설정, 마지막 팁', body: [
      '게임은 <b>자동으로 저장</b>돼요. 처음 화면에는 저장 칸이 3개 있어요 (C 복사 · X 삭제).',
      `${k('O')} : <b>설정</b> (소리 크기 같은 것)`,
      '막히거나 헷갈릴 때는 천천히 구경하고, 마을 사람들 말을 들어 보세요. 힌트가 많아요.',
      `${k('H')} : 이 <b>튜토리얼을 다시</b> 보기`,
      '준비됐나요? 행운을 빌어요, 용사!'] }
  ];

  let root = null, cur = 0, open = false, onClose = null;
  function css() {
    if (document.getElementById('tutCss')) return;
    const s = document.createElement('style'); s.id = 'tutCss';
    s.textContent = `
#tut{position:fixed;inset:0;z-index:2000;background:rgba(6,8,18,.86);display:none;align-items:center;justify-content:center;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#dfe5ff;user-select:none}
#tut.on{display:flex}
#tut .card{width:min(860px,94vw);max-height:92vh;overflow:auto;background:#171b2b;border:3px solid #ffd54a;border-radius:12px;box-shadow:0 10px 50px #000c,inset 0 0 0 3px #0e1120;padding:22px 30px 18px;box-sizing:border-box}
#tut .top{display:flex;align-items:center;gap:18px;margin-bottom:12px}
#tut .ic{font-size:60px;line-height:1;filter:drop-shadow(0 3px 0 #0008)}
#tut h2{margin:0;font:900 30px 'Malgun Gothic',sans-serif;color:#ffd54a;text-shadow:2px 2px 0 #000}
#tut .pg{margin-left:auto;font:700 14px sans-serif;color:#8a93a8}
#tut ul{margin:6px 0 4px;padding:0;list-style:none}
#tut li{margin:9px 0;padding:8px 12px;background:#20263c;border-left:4px solid #5a7cff;border-radius:6px;font:600 17px/1.65 'Malgun Gothic',sans-serif}
#tut b{color:#ffe58a}
#tut kbd{display:inline-block;min-width:22px;text-align:center;padding:1px 8px;margin:0 2px;background:#2d3556;border:2px solid #8a93a8;border-bottom-width:4px;border-radius:6px;color:#fff;font:800 14px/1.5 monospace}
#tut .dots{display:flex;gap:7px;justify-content:center;margin:14px 0 10px}
#tut .dots i{width:11px;height:11px;border-radius:50%;background:#3a4262;cursor:pointer}
#tut .dots i.on{background:#ffd54a;box-shadow:0 0 0 3px #ffd54a44}
#tut .btns{display:flex;gap:10px;justify-content:space-between;align-items:center}
#tut button{font:800 17px 'Malgun Gothic',sans-serif;color:#171b2b;background:#ffd54a;border:3px solid #0e1120;border-radius:10px;padding:8px 22px;cursor:pointer}
#tut button:hover{background:#fff0a8}
#tut button.sub{background:#2d3556;color:#dfe5ff;border-color:#0e1120}
#tut button[disabled]{opacity:.35;cursor:default}
#tut .hint{font:600 13px sans-serif;color:#8a93a8;text-align:center;margin-top:8px}`;
    document.head.appendChild(s);
  }
  function render() {
    const p = PAGES[cur], last = cur === PAGES.length - 1;
    root.innerHTML = `<div class="card"><div class="top"><div class="ic">${p.icon}</div><h2>${p.title}</h2><div class="pg">${cur + 1} / ${PAGES.length}</div></div><ul>${p.body.map((l) => `<li>${l}</li>`).join('')}</ul><div class="dots">${PAGES.map((_, i) => `<i class="${i === cur ? 'on' : ''}" data-i="${i}"></i>`).join('')}</div><div class="btns"><button class="sub" data-a="prev" ${cur === 0 ? 'disabled' : ''}>◀ 이전</button><button class="sub" data-a="skip">${last ? '' : '건너뛰기 (Esc)'}</button><button data-a="next">${last ? '시작하기!' : '다음 ▶'}</button></div><div class="hint">← → 로 넘기기 · Enter 다음 · Esc 닫기 · 나중에 H 키로 다시 볼 수 있어요</div></div>`;
    root.querySelectorAll('[data-a]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const a = b.dataset.a; if (a === 'prev') go(-1); else if (a === 'next') go(1); else close(); }; });
    root.querySelectorAll('[data-i]').forEach((d) => { d.onclick = () => { cur = +d.dataset.i; render(); }; });
  }
  function go(d) { if (d > 0 && cur === PAGES.length - 1) { close(); return; } cur = Math.max(0, Math.min(PAGES.length - 1, cur + d)); render(); try { G.Audio.play('catch'); } catch (e) {} }
  function close() {
    if (!open) return; open = false; root.classList.remove('on'); window.dispatchEvent(new Event('blur')); // 눌려 있던 키를 모두 놓은 것으로
    const cb = onClose; onClose = null; try { G.Audio.play('pickup'); } catch (e) {} if (cb) cb();
  }
  function keyHandler(e) {
    if (!open) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') close();
    else if (['ArrowRight', 'Enter', 'NumpadEnter', 'Space', 'KeyD'].includes(e.code)) go(1);
    else if (['ArrowLeft', 'KeyA', 'Backspace'].includes(e.code)) go(-1);
    else if (/^Digit[1-9]$/.test(e.code)) { const n = +e.code.slice(5) - 1; if (n < PAGES.length) { cur = n; render(); } }
  }
  function show(cb) {
    css(); if (!root) { root = document.createElement('div'); root.id = 'tut'; document.body.appendChild(root); root.addEventListener('mousedown', (e) => e.stopPropagation()); window.addEventListener('keydown', keyHandler, true); window.addEventListener('keyup', (e) => { if (open) { e.stopImmediatePropagation(); } }, true); }
    cur = 0; open = true; onClose = cb || null; render(); root.classList.add('on');
  }

  // ---- 직접 해 보며 배우는 안내 (게임은 멈추지 않는다) ----
  // do: 'move' 걷기 3번 / 'jump' / 'dash' / 'slide' / 'parry' 3번 / 'charge' 길게 눌렀다 떼기 / 'block' / 'weapon' / 'inv' / 'potion' / 'next' 정보 (버튼으로 넘김)
  const STEPS = [
    { icon: '🏃', do: 'move', t: '먼저 걸어 볼까요?', d: `${k('←')} ${k('→')} 또는 ${k('A')} ${k('D')} 를 눌러 <b>좌우로 걸어 보세요</b>.` },
    { icon: '🦘', do: 'jump', t: '점프!', d: `${k('Space')} ${k('↑')} ${k('W')} ${k('Z')} 중 아무거나 누르세요. <b>오래 누르면 더 높이</b> 올라가요.` },
    { icon: '💨', do: 'dash', t: '대시', d: `${k('Shift')} 또는 ${k('X')} 를 누르면 3칸을 <b>빠르게 휙</b> 가요. 피하거나 건널 때 써요.` },
    { icon: '🛷', do: 'slide', t: '슬라이딩', d: `땅에서 ${k('C')} 를 눌러 보세요. 납작하게 미끄러져 <b>좁은 곳</b>을 지나가요.` },
    { icon: '🗡️', do: 'parry', t: '패링 (가장 중요해요!)', d: `${k('Enter')} 또는 <b>마우스 왼쪽</b>을 <b>3번</b> 눌러 검을 휘둘러 보세요. 몬스터가 닿기 <b>직전에</b> 누르면 멀리 튕겨내요. 연달아 누르면 2단 공격!` },
    { icon: '🌀', do: 'charge', t: '검 던지기', d: `${k('Enter')} 나 마우스 왼쪽을 <b>길게(1초쯤) 눌렀다가 떼 보세요</b>. 검이 부메랑처럼 날아갔다 돌아와요.` },
    { icon: '🛡️', do: 'block', t: '막기', d: `${k('F')} 를 <b>누르고 있으면</b> 공격을 막아요.` },
    { icon: '🎒', do: 'weapon', t: '무기 바꾸기', d: `숫자 ${k('1')}~${k('5')} 를 눌러 <b>무기를 바꿔</b> 보세요. 칸이 비어 있으면 아직 없는 거예요.` },
    { icon: '📦', do: 'inv', t: '인벤토리', d: `${k('I')} 또는 ${k(']')} 를 눌러 <b>가방</b>을 열어 보세요. 무기·방어구를 장착해요. 닫기는 ${k('Esc')}.` },
    { icon: '🧪', do: 'potion', t: '물약 · 음식', d: `${k('Q')} : <b>물약</b>으로 체력 회복 · ${k('V')} : <b>음식</b> 먹기 · ${k('B')} : 얼음 폭탄. 지금 ${k('Q')} 를 눌러 보세요. (없으면 아무 일도 안 일어나요)` },
    { icon: '🏘️', do: 'next', t: '마을에서는', d: `${k('E')} : 가게·문·마을 사람과 <b>이야기하기</b>. 반짝이는 곳에서 눌러요. 가게에서는 방향키+Enter(또는 마우스)로 사요.<br>${k('N')} 지도 · ${k('T')} 업적 · ${k('O')} 설정<br>집을 사서 꾸미고, 낚시와 요리도 할 수 있어요.` },
    { icon: '🗺️', do: 'next', t: '모험을 떠나요!', d: `마을의 <b>문</b>으로 숲·설산·화산 같은 곳에 가서 몬스터를 물리치고 <b>코인</b>과 <b>경험치</b>를 모아 강해지세요. 목숨(하트)이 다 없어지면 게임 오버예요.<br>${k('H')} : 이 안내 다시 보기 · 게임은 <b>자동 저장</b>돼요.` }
  ];
  let gRoot = null, gi = -1, gCnt = 0, gHold = null, gTimer = 0, gDoneBlink = false;
  function gcss() {
    if (document.getElementById('tutGCss')) return;
    const s = document.createElement('style'); s.id = 'tutGCss';
    s.textContent = `
#tutG{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:1500;width:min(720px,94vw);box-sizing:border-box;display:none;align-items:center;gap:14px;padding:10px 16px;background:rgba(18,22,38,.94);border:3px solid #ffd54a;border-radius:12px;box-shadow:0 6px 24px #000a;font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#dfe5ff;user-select:none;transition:border-color .2s,background .2s}
#tutG.on{display:flex}
#tutG.ok{border-color:#6bff8a;background:rgba(20,50,30,.95)}
#tutG .ic{font-size:42px;line-height:1}
#tutG .tx{flex:1;min-width:0}
#tutG .tt{font:900 18px 'Malgun Gothic',sans-serif;color:#ffd54a;margin-bottom:2px}
#tutG .tt small{font:700 12px sans-serif;color:#8a93a8;margin-left:8px}
#tutG .dd{font:600 15px/1.55 'Malgun Gothic',sans-serif}
#tutG b{color:#ffe58a}
#tutG kbd{display:inline-block;min-width:20px;text-align:center;padding:0 7px;margin:0 2px;background:#2d3556;border:2px solid #8a93a8;border-bottom-width:3px;border-radius:5px;color:#fff;font:800 13px/1.5 monospace}
#tutG .bt{display:flex;flex-direction:column;gap:6px}
#tutG button{font:800 14px 'Malgun Gothic',sans-serif;color:#171b2b;background:#ffd54a;border:2px solid #0e1120;border-radius:8px;padding:5px 12px;cursor:pointer;white-space:nowrap}
#tutG button.sub{background:#2d3556;color:#dfe5ff}`;
    document.head.appendChild(s);
  }
  function gRender() {
    const s = STEPS[gi]; if (!s) return;
    const last = gi === STEPS.length - 1;
    gRoot.classList.toggle('ok', gDoneBlink);
    gRoot.innerHTML = `<div class="ic">${gDoneBlink ? '✅' : s.icon}</div><div class="tx"><div class="tt">${gDoneBlink ? '잘했어요!' : s.t}<small>${gi + 1} / ${STEPS.length}</small></div><div class="dd">${s.d}</div></div><div class="bt">${s.do === 'next' ? `<button data-a="next">${last ? '시작하기!' : '다음 ▶'}</button>` : ''}<button class="sub" data-a="skip">건너뛰기</button></div>`;
    gRoot.querySelectorAll('[data-a]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); if (b.dataset.a === 'next') gAdvance(); else gStop(); }; });
  }
  function gAdvance() {
    if (gTimer) { clearTimeout(gTimer); gTimer = 0; }
    gDoneBlink = false; gCnt = 0; gHold = null; gi++;
    try { G.Audio.play('catch'); } catch (e) {}
    if (gi >= STEPS.length) { gStop(true); return; }
    gRender();
  }
  function gOk() { // 해냈다: 잠깐 ✅ 를 보여 주고 다음으로
    if (gDoneBlink) return; gDoneBlink = true; try { G.Audio.play('treasure'); } catch (e) {} gRender();
    gTimer = setTimeout(gAdvance, 900);
  }
  function gStop(done) {
    if (gTimer) { clearTimeout(gTimer); gTimer = 0; }
    gi = -1; if (gRoot) gRoot.classList.remove('on');
    if (done) try { G.Audio.play('pickup'); } catch (e) {}
  }
  const MOVE = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'], JUMPK = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'], DASHK = ['ShiftLeft', 'ShiftRight', 'KeyX'];
  function gInput(kind, code) { // kind: 'down' | 'up', code: 키 이름 ('Mouse' = 마우스 왼쪽)
    if (gi < 0 || gDoneBlink || open || G.Tutorial.blocked) return;
    const s = STEPS[gi], atk = code === 'Enter' || code === 'NumpadEnter' || code === 'Mouse';
    if (kind === 'down') {
      if (atk) gHold = performance.now();
      if (s.do === 'move' && MOVE.includes(code) && ++gCnt >= 3) gOk();
      else if (s.do === 'jump' && JUMPK.includes(code)) gOk();
      else if (s.do === 'dash' && DASHK.includes(code)) gOk();
      else if (s.do === 'slide' && code === 'KeyC') gOk();
      else if (s.do === 'block' && code === 'KeyF') gOk();
      else if (s.do === 'weapon' && /^Digit[1-5]$/.test(code)) gOk();
      else if (s.do === 'inv' && (code === 'KeyI' || code === 'BracketRight')) gOk();
      else if (s.do === 'potion' && code === 'KeyQ') gOk();
    } else if (atk && gHold !== null) {
      const held = performance.now() - gHold; gHold = null;
      if (s.do === 'parry' && ++gCnt >= 3) gOk();
      else if (s.do === 'charge' && held >= 700) gOk();
    }
  }
  function start() {
    gcss(); if (!gRoot) {
      gRoot = document.createElement('div'); gRoot.id = 'tutG'; document.body.appendChild(gRoot);
      gRoot.addEventListener('mousedown', (e) => e.stopPropagation());
      window.addEventListener('keydown', (e) => { if (!e.repeat) gInput('down', e.code); }, true);
      window.addEventListener('keyup', (e) => gInput('up', e.code), true);
      window.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target && e.target.tagName === 'CANVAS') gInput('down', 'Mouse'); }, true);
      window.addEventListener('mouseup', (e) => { if (e.button === 0) gInput('up', 'Mouse'); }, true);
    }
    gi = -1; gDoneBlink = false; gAdvance(); gRoot.classList.add('on');
  }
  G.Tutorial = { show, start, stop: gStop, isOpen: () => open, close, pages: PAGES, blocked: false, setBlocked(b) { this.blocked = b; if (gRoot) gRoot.style.visibility = b ? 'hidden' : ''; } };
})(window.Game);
