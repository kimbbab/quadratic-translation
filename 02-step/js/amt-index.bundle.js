/* Shared standalone quadratic activity. No SDK, storage, or network requests. */
(function () {
  'use strict';

  const QUESTIONS = [
    { a: 2, yMin: -4, yMax: 8, h: 0, k: -3,
      formula: '<i>y</i> = 2<i>x</i><sup>2</sup> − 3',
      baseFormula: '<i>y</i> = 2<i>x</i><sup>2</sup>', baseDescription: 'y는 2x제곱' },
    { a: -0.5, yMin: -8, yMax: 4, h: 0, k: 1,
      formula: '<i>y</i> = −<span class="fraction"><span>1</span><span>2</span></span><i>x</i><sup>2</sup> + 1',
      baseFormula: '<i>y</i> = −<span class="fraction"><span>1</span><span>2</span></span><i>x</i><sup>2</sup>',
      baseDescription: 'y는 마이너스 2분의 1 x제곱' }
  ];
  const PLOT = Object.freeze({ left: 20, top: 16, size: 384, unit: 32, minX: -6, maxX: 6, right: 404, bottom: 400 });
  const DIRECTIONS = Object.freeze({
    left: { h: -1, k: 0, label: '왼쪽', phrase: '왼쪽으로', arrow: '←' },
    right: { h: 1, k: 0, label: '오른쪽', phrase: '오른쪽으로', arrow: '→' },
    up: { h: 0, k: 1, label: '위', phrase: '위로', arrow: '↑' },
    down: { h: 0, k: -1, label: '아래', phrase: '아래로', arrow: '↓' }
  });
  const fmt = value => value < 0 ? '−' + Math.abs(value) : String(value);
  const isStateValid = (question, state) => Number.isInteger(state.h) && Number.isInteger(state.k) &&
    state.h >= PLOT.minX && state.h <= PLOT.maxX && state.k >= question.yMin && state.k <= question.yMax;

  function executeStep(question, state, direction) {
    const unchanged = { h: state.h, k: state.k, ok: false };
    if (!isStateValid(question, state)) return { ...unchanged, reason: 'state' };
    if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, direction)) return { ...unchanged, reason: 'direction' };
    const next = { h: state.h + DIRECTIONS[direction].h, k: state.k + DIRECTIONS[direction].k };
    if (!isStateValid(question, next)) return { ...unchanged, reason: 'bounds' };
    return { ...next, ok: true, direction };
  }

  // Keep exact decimal ratios: rounding a nearby decimal to an integer must not earn credit.
  function decimalRatio(text) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) return null;
    const negative = text[0] === '-';
    const unsigned = /^[+-]/.test(text) ? text.slice(1) : text;
    const pieces = unsigned.split('.');
    const digits = (pieces[0] || '0') + (pieces[1] || '');
    return { numerator: BigInt(digits) * (negative ? -1n : 1n), denominator: 10n ** BigInt((pieces[1] || '').length) };
  }
  function parseExactAnswer(raw, axis = false) {
    let text = String(raw == null ? '' : raw).normalize('NFKC').trim().replace(/[−–—]/g, '-').replace(/\s+/g, '');
    if (axis) text = text.replace(/^x=/i, '');
    if (!text || text.length > 256) return null;
    const terms = text.split('/');
    if (terms.length > 2) return null;
    const numerator = decimalRatio(terms[0]);
    const denominator = terms.length === 2 ? decimalRatio(terms[1]) : { numerator: 1n, denominator: 1n };
    if (!numerator || !denominator || denominator.numerator === 0n) return null;
    // Require finite operands and quotient, including a usable nonzero Number denominator.
    const numericDenominator = terms.length === 2 ? Number(terms[1]) : 1;
    const value = Number(terms[0]) / numericDenominator;
    if (numericDenominator === 0 || !Number.isFinite(value)) return null;
    let top = numerator.numerator * denominator.denominator;
    let bottom = numerator.denominator * denominator.numerator;
    if (bottom < 0n) { top = -top; bottom = -bottom; }
    return { numerator: top, denominator: bottom, value };
  }
  function parseAnswer(raw, axis = false) {
    const ratio = parseExactAnswer(raw, axis);
    return ratio === null ? null : ratio.value;
  }
  function exactAnswer(raw, expected, axis = false) {
    if (!Number.isSafeInteger(expected)) return false;
    const ratio = parseExactAnswer(raw, axis);
    return ratio !== null && ratio.numerator === BigInt(expected) * ratio.denominator;
  }
  function grade(question, h, k, answers) {
    const expected = [question.h, question.h, question.k];
    const fields = expected.map((value, index) => exactAnswer(answers[index], value, index === 0));
    const graph = h === question.h && k === question.k;
    return { graph, axis: fields[0], vertex: fields[1] && fields[2], fields, correct: graph && fields.every(Boolean) };
  }
  function coordinates(question, h, k) {
    return { x: PLOT.left + (h - PLOT.minX) * PLOT.unit, y: PLOT.top + (question.yMax - k) * PLOT.unit };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QUESTIONS, PLOT, DIRECTIONS, executeStep, parseAnswer, parseExactAnswer, exactAnswer, grade, coordinates };
  }
  if (typeof document === 'undefined') return;

  const root = document.getElementById('amt-viewer-wraper');
  const host = document.getElementById('problems');
  if (!root || !host) return;
  const mode = root.dataset.mode === 'slider' ? 'slider' : 'step';
  const gradeButton = root.querySelector('.btn-mark');
  const resetButton = root.querySelector('.btn-restart');
  const answerButton = root.querySelector('.btn-answer');
  const solution = document.getElementById('answer-popup-01');
  const overall = document.getElementById('overall-result');
  let locked = false;

  function svgNode(tag, attributes, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  const activities = QUESTIONS.map((question, index) => {
    const n = index + 1;
    const answerIds = [0, 1, 2].map(offset => 'input-' + String(index * 3 + offset + 1).padStart(2, '0'));
    const section = document.createElement('section');
    section.className = 'problem quiz-math type-box-1';
    section.id = 'quiz-' + String(n).padStart(2, '0');
    section.setAttribute('aria-labelledby', 'question-' + n);
    // Every interpolated HTML value is a fixed question or locally generated ID, never an answer.
    section.innerHTML = `
      <h2 id="question-${n}" class="bracket-num-text"><span class="num">(<span class="count">${n}</span>)</span><span class="text math">${question.formula}</span></h2>
      <p class="base-formula math">${question.baseFormula}</p>
      <div class="graph-system">
        <div class="graph-quad-cont w-400 type-1">
          <p class="graph-source sr-only" id="graph-source-${n}">기본 그래프 ${question.baseDescription}은 고정되어 있습니다. 파란 그래프만 옮기세요.</p>
          <div class="inner">
            <svg class="graph" role="img" viewBox="0 0 424 416" aria-labelledby="graph-title-${n} graph-desc-${n}">
              <title id="graph-title-${n}">${n}번 이차함수 그래프</title><desc id="graph-desc-${n}"></desc>
              <defs><clipPath id="plot-clip-${n}"><rect x="20" y="16" width="384" height="384"/></clipPath><marker id="axis-arrow-${n}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9 L3 5 Z" fill="#303033"/></marker></defs>
              <g class="grid" aria-hidden="true"></g><rect class="grid-frame" x="20" y="16" width="384" height="384"/>
              <g class="axes" aria-hidden="true"></g>
              <g clip-path="url(#plot-clip-${n})" aria-hidden="true"><path class="curve base-curve"/><path class="curve moving-curve"/></g>
              <circle class="vertex" r="4.4" aria-hidden="true"/>
            </svg>
          </div>
        </div>
        ${mode === 'slider' ? `<div class="slider-wrap vertical"><input id="slider-y-${n}" class="slider slider-y" type="range" min="${question.yMin}" max="${question.yMax}" step="1" value="0" aria-label="${n}번 그래프 위아래 이동" aria-orientation="vertical" aria-describedby="move-status-${n}"></div><div class="slider-wrap horizontal"><input id="slider-x-${n}" class="slider slider-x" type="range" min="-6" max="6" step="1" value="0" aria-label="${n}번 그래프 좌우 이동" aria-describedby="move-status-${n}"></div>` : ''}
      </div>
      ${mode === 'step' ? `<div class="step-controls" role="group" aria-label="${n}번 그래프 한 칸씩 이동">${Object.entries(DIRECTIONS).map(([direction, movement]) => `<button type="button" class="step-button" data-direction="${direction}" aria-label="${n}번 그래프 ${movement.phrase} 한 칸" aria-describedby="move-status-${n}"><span aria-hidden="true">${movement.arrow}</span> ${movement.label}</button>`).join('')}</div>` : ''}
      <p class="move-status" id="move-status-${n}" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="answers" aria-label="${n}번 답 입력">
        <div class="answer-row"><label class="answer-label" for="${answerIds[0]}">축의 방정식</label><span class="math"><i>x</i> =</span><span class="input-box js-input-box"><input id="${answerIds[0]}" class="g-input js-input axis-answer" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="48" aria-label="${n}번 축의 방정식 x 값"></span></div>
        <div class="answer-row"><span class="answer-label">꼭짓점의 좌표</span><span class="coordinate">(<span class="input-box js-input-box"><input id="${answerIds[1]}" class="g-input js-input vertex-x-answer" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="48" aria-label="${n}번 꼭짓점 x좌표"></span>,<span class="input-box js-input-box"><input id="${answerIds[2]}" class="g-input js-input vertex-y-answer" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="48" aria-label="${n}번 꼭짓점 y좌표"></span>)</span></div>
      </div>
      <p class="problem-result" aria-live="polite" aria-atomic="true"></p>`;
    host.appendChild(section);
    const find = selector => section.querySelector(selector);
    const X = x => coordinates(question, x, 0).x;
    const Y = y => coordinates(question, 0, y).y;
    const grid = find('.grid'), axes = find('.axes');
    for (let x = PLOT.minX; x <= PLOT.maxX; x++) {
      if (x !== 0) grid.appendChild(svgNode('line', { x1: X(x), x2: X(x), y1: 16, y2: 400, class: 'grid-line' }));
      if (x !== 0 && x > PLOT.minX && x < PLOT.maxX && x % 2 === 0) axes.appendChild(svgNode('text', { x: X(x), y: Y(0) + 23, 'text-anchor': 'middle', class: 'tick-label' }, fmt(x)));
    }
    for (let y = question.yMin; y <= question.yMax; y++) {
      if (y !== 0) grid.appendChild(svgNode('line', { x1: 20, x2: 404, y1: Y(y), y2: Y(y), class: 'grid-line' }));
      if (y !== 0 && y > question.yMin && y < question.yMax && y % 2 === 0) axes.appendChild(svgNode('text', { x: X(0) - 12, y: Y(y) + 6, 'text-anchor': 'end', class: 'tick-label' }, fmt(y)));
    }
    axes.appendChild(svgNode('line', { x1: 20, x2: 401, y1: Y(0), y2: Y(0), class: 'axis', 'marker-end': `url(#axis-arrow-${n})` }));
    axes.appendChild(svgNode('line', { x1: X(0), x2: X(0), y1: 400, y2: 18, class: 'axis', 'marker-end': `url(#axis-arrow-${n})` }));
    axes.appendChild(svgNode('text', { x: 386, y: Y(0) + 22, class: 'axis-label' }, 'x'));
    axes.appendChild(svgNode('text', { x: X(0) - 21, y: 30, class: 'axis-label' }, 'y'));
    axes.appendChild(svgNode('text', { x: X(0) - 23, y: Y(0) + 23, class: 'axis-label' }, 'O'));
    const span = 18;
    const path = `M${X(-span)} ${Y(question.a * span * span)} Q${X(0)} ${Y(-question.a * span * span)} ${X(span)} ${Y(question.a * span * span)}`;
    find('.base-curve').setAttribute('d', path);
    find('.moving-curve').setAttribute('d', path);
    const state = { h: 0, k: 0 };
    const inputs = Array.from(find('.answers').querySelectorAll('input'));
    const movementControls = Array.from(section.querySelectorAll('.slider, .step-button'));
    const moveStatus = find('.move-status');

    function showMovement(text, error = false) {
      moveStatus.textContent = text;
      moveStatus.classList.toggle('move-error', error);
    }
    function draw() {
      const point = coordinates(question, state.h, state.k);
      find('.moving-curve').setAttribute('transform', `translate(${state.h * PLOT.unit} ${-state.k * PLOT.unit})`);
      find('.vertex').setAttribute('cx', String(point.x));
      find('.vertex').setAttribute('cy', String(point.y));
      find('#graph-desc-' + n).textContent = `기본 그래프 ${question.baseDescription}은 고정되어 있습니다. 파란 그래프의 현재 꼭짓점은 (${fmt(state.h)}, ${fmt(state.k)})입니다.`;
      if (mode === 'slider') {
        find('.slider-x').value = String(state.h); find('.slider-y').value = String(state.k);
        find('.slider-x').setAttribute('aria-valuetext', `꼭짓점의 x좌표 ${fmt(state.h)}`);
        find('.slider-y').setAttribute('aria-valuetext', `꼭짓점의 y좌표 ${fmt(state.k)}`);
      }
    }
    if (mode === 'slider') {
      movementControls.forEach(control => control.addEventListener('input', () => {
        if (locked) return;
        const next = { h: Number(find('.slider-x').value), k: Number(find('.slider-y').value) };
        if (!isStateValid(question, next)) { draw(); showMovement('이동할 수 있는 범위를 확인하세요.', true); return; }
        state.h = next.h; state.k = next.k; draw(); showMovement('파란 그래프를 옮겼습니다.');
      }));
    } else {
      movementControls.forEach(control => control.addEventListener('click', () => {
        if (locked) return;
        const next = executeStep(question, state, control.dataset.direction);
        if (!next.ok) { showMovement('이 방향으로는 더 옮길 수 없습니다.', true); return; }
        state.h = next.h; state.k = next.k; draw(); showMovement(`${DIRECTIONS[next.direction].phrase} 한 칸 옮겼습니다.`);
      }));
    }
    function setLocked(value) {
      [...inputs, ...movementControls].forEach(control => { control.disabled = value; });
    }
    function mark() {
      const result = grade(question, state.h, state.k, inputs.map(input => input.value));
      inputs.forEach((input, i) => {
        input.parentElement.classList.remove('correct', 'incorrect', 'empty');
        input.parentElement.classList.add(result.fields[i] ? 'correct' : 'incorrect');
        if (input.value.trim() === '') input.parentElement.classList.add('empty');
        input.setAttribute('aria-invalid', String(!result.fields[i]));
      });
      section.dataset.result = result.correct ? 'correct' : 'incorrect';
      const feedback = find('.problem-result'); feedback.replaceChildren();
      [['그래프', result.graph], ['축', result.axis], ['꼭짓점', result.vertex]].forEach(([label, correct], i) => {
        if (i) feedback.append(' · ');
        const text = document.createElement('span'); text.className = correct ? 'correct' : 'incorrect';
        text.textContent = `${label} ${correct ? '정답' : '오답'}`; feedback.appendChild(text);
      });
      setLocked(true); showMovement('채점한 그래프를 그대로 유지합니다.');
      return result;
    }
    function reset() {
      state.h = 0; state.k = 0;
      inputs.forEach(input => {
        input.value = ''; input.removeAttribute('aria-invalid');
        input.parentElement.classList.remove('correct', 'incorrect', 'empty');
      });
      find('.problem-result').textContent = ''; delete section.dataset.result;
      setLocked(false); draw();
      showMovement(mode === 'slider' ? '슬라이더로 파란 그래프를 옮기세요.' : '버튼을 누르면 한 칸씩 옮겨집니다.');
    }
    reset();
    return { mark, reset, firstControl: mode === 'slider' ? find('.slider-x') : movementControls[0] };
  });

  function setSolutionOpen(open, returnFocus = false) {
    solution.hidden = !open;
    answerButton.setAttribute('aria-expanded', String(open));
    const label = answerButton.querySelector('.text');
    if (label) label.textContent = open ? '풀이 닫기' : '풀이 보기';
    if (returnFocus) answerButton.focus();
  }
  gradeButton.addEventListener('click', () => {
    if (locked) return;
    locked = true;
    const results = activities.map(activity => activity.mark());
    gradeButton.hidden = true; resetButton.hidden = false; answerButton.hidden = false;
    const count = results.filter(result => result.correct).length;
    overall.textContent = count === 2 ? '두 문제 모두 정답입니다.' : `정답 ${count} / 2 · 각 항목의 결과를 확인하세요.`;
    resetButton.focus();
  });
  resetButton.addEventListener('click', () => {
    locked = false; activities.forEach(activity => activity.reset());
    setSolutionOpen(false); gradeButton.hidden = false; resetButton.hidden = false; answerButton.hidden = true;
    overall.textContent = ''; activities[0].firstControl.focus();
  });
  answerButton.addEventListener('click', () => { if (locked) setSolutionOpen(solution.hidden); });
  root.querySelectorAll('.btn-answer-close').forEach(button => button.addEventListener('click', () => setSolutionOpen(false, true)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !solution.hidden) { event.preventDefault(); setSolutionOpen(false, true); }
  });
  // Do not rely on cached button state when opening the HTML directly or after a browser restore.
  gradeButton.hidden = false; resetButton.hidden = false; answerButton.hidden = true; setSolutionOpen(false);
  function fit() {
    const frame = document.getElementById('activity-frame');
    if (!frame) return;
    if (window.innerWidth < 600) { root.style.transform = 'none'; frame.style.width = '100%'; frame.style.height = 'auto'; return; }
    const scale = Math.min(1, window.innerWidth / 1280, window.innerHeight / 720);
    root.style.transform = `scale(${scale})`; frame.style.width = `${1280 * scale}px`; frame.style.height = `${720 * scale}px`;
  }
  window.addEventListener('resize', fit); fit();
  root.classList.add('ready');
  const loading = document.getElementById('loading-message');
  if (loading) loading.hidden = true;
})();
