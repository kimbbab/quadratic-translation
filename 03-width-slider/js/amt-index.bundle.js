/* Coefficient activity: fixed y=x^2, one question per page. No SDK or network calls. */
(function () {
  'use strict';
  const MIN_TICK = 1, MAX_TICK = 24, DEFAULT_TICK = 6;
  const TARGET_TICKS = Object.freeze([18, 2]);
  const STOP_TICKS = Object.freeze([1, 2, 3, 6, 12, 18, 24]);
  const PLOT = Object.freeze({ left: 36, top: 26, width: 448, height: 392, right: 484, bottom: 418, unit: 28, minX: -8, maxX: 8, minY: -1, maxY: 13 });
  const isTick = tick => Number.isInteger(tick) && tick >= MIN_TICK && tick <= MAX_TICK;
  function requireTick(tick) {
    if (!isTick(tick)) throw new RangeError('계수 눈금은 1부터 24 사이의 정수여야 합니다.');
    return tick;
  }
  function gcd(a, b) { while (b) { const remainder = a % b; a = b; b = remainder; } return a; }
  function tickToFraction(tick) {
    requireTick(tick);
    const divisor = gcd(tick, 6), numerator = tick / divisor, denominator = 6 / divisor;
    return { numerator, denominator, text: denominator === 1 ? String(numerator) : numerator + '/' + denominator };
  }
  function coefficient(tick) { return requireTick(tick) / 6; }
  // The smaller stop wins an exact midpoint tie, including negative midpoints.
  function nearestSnap(raw) {
    if (!Number.isFinite(raw) || raw < MIN_TICK || raw > MAX_TICK) throw new RangeError('슬라이더 이동 범위를 확인해 주세요.');
    return STOP_TICKS.reduce((best, stop) => Math.abs(raw - stop) < Math.abs(raw - best) ? stop : best, STOP_TICKS[0]);
  }
  function coordinates(x, y) { return { x: PLOT.left + (x - PLOT.minX) * PLOT.unit, y: PLOT.top + (PLOT.maxY - y) * PLOT.unit }; }
  function pathForCoefficient(a) {
    if (!Number.isFinite(a) || a < MIN_TICK / 6 || a > MAX_TICK / 6) throw new RangeError('계수는 1/6부터 4 사이여야 합니다.');
    // This quadratic Bézier is exactly y=a*x^2. The SVG clips it to the plotting rectangle.
    const extent = PLOT.maxX, y = a * extent * extent;
    const start = coordinates(-extent, y), control = coordinates(0, -y), end = coordinates(extent, y);
    return `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  function pathForTick(tick) { return pathForCoefficient(coefficient(tick)); }
  function initialState(index = 0) { return { active: index === 1 ? 1 : 0, ticks: [DEFAULT_TICK, DEFAULT_TICK], touched: [false, false], locked: false, result: null }; }
  function gradeState(state) { return Boolean(state.touched[state.active] && state.ticks[state.active] === TARGET_TICKS[state.active]); }
  function transition(state, action) {
    if (action.type === 'reset') return initialState(state.active);
    if (state.locked) return state;
    if (action.type === 'grade') return { ...state, locked: true, result: gradeState(state) };
    let nextTick;
    if (action.type === 'setTick') nextTick = action.tick;
    else if (action.type === 'step' && (action.delta === -1 || action.delta === 1)) nextTick = STOP_TICKS[STOP_TICKS.indexOf(state.ticks[state.active]) + action.delta];
    else return state;
    if (!STOP_TICKS.includes(nextTick)) return state;
    const ticks = state.ticks.slice(), touched = state.touched.slice();
    ticks[state.active] = nextTick; touched[state.active] = true;
    return { ...state, ticks, touched };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIN_TICK, MAX_TICK, DEFAULT_TICK, TARGET_TICKS, STOP_TICKS, nearestSnap, PLOT, tickToFraction, coefficient, coordinates, pathForCoefficient, pathForTick, initialState, gradeState, transition };
  }
  if (typeof document === 'undefined') return;
  const root = document.getElementById('amt-viewer-wraper');
  if (!root) return;
  const get = id => document.getElementById(id);
  const graph = get('width-graph'), grid = get('width-grid'), axes = get('width-axes');
  const baseCurve = get('base-curve'), curves = [get('curve-1'), get('curve-2')];
  const pageIndex = root.dataset.question === '2' ? 1 : 0;
  const description = get('width-desc');
  const slider = get('coefficient-slider'), decrease = get('decrease-a'), increase = get('increase-a');
  const sliderStatus = get('slider-status');
  const resultElement = get('result-' + (pageIndex + 1));
  const gradeButton = root.querySelector('.btn-mark'), resetButton = root.querySelector('.btn-restart'), answerButton = root.querySelector('.btn-answer');
  const overall = get('overall-result'), solution = get('answer-popup-01');
  let state = initialState(pageIndex);
  let pending = null;

  function svgNode(tag, attributes, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function prepareGraph() {
    let defs = graph.querySelector('defs');
    if (!defs) { defs = svgNode('defs', {}); graph.appendChild(defs); }
    if (!get('width-plot-clip')) {
      const clip = svgNode('clipPath', { id: 'width-plot-clip' });
      clip.appendChild(svgNode('rect', { x: PLOT.left, y: PLOT.top, width: PLOT.width, height: PLOT.height }));
      defs.appendChild(clip);
    }
    if (!get('width-axis-arrow')) {
      const marker = svgNode('marker', { id: 'width-axis-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' });
      marker.appendChild(svgNode('path', { d: 'M1 1 L9 5 L1 9 L3 5 Z', fill: '#303033' }));
      defs.appendChild(marker);
    }
    const X = x => coordinates(x, 0).x, Y = y => coordinates(0, y).y;
    const fmt = value => value < 0 ? '−' + Math.abs(value) : String(value);
    grid.replaceChildren(); axes.replaceChildren();
    for (let x = PLOT.minX; x <= PLOT.maxX; x++) {
      if (x !== 0) grid.appendChild(svgNode('line', { x1: X(x), x2: X(x), y1: PLOT.top, y2: PLOT.bottom, class: 'grid-line' }));
      if (x !== 0 && x > -8 && x < 8 && x % 2 === 0) axes.appendChild(svgNode('text', { x: X(x), y: Y(0) + 22, 'text-anchor': 'middle', class: 'tick-label' }, fmt(x)));
    }
    for (let y = PLOT.minY; y <= PLOT.maxY; y++) {
      if (y !== 0) grid.appendChild(svgNode('line', { x1: PLOT.left, x2: PLOT.right, y1: Y(y), y2: Y(y), class: 'grid-line' }));
      if (y > 0 && y < 13 && y % 2 === 0) axes.appendChild(svgNode('text', { x: X(0) - 10, y: Y(y) + 6, 'text-anchor': 'end', class: 'tick-label' }, String(y)));
    }
    if (!graph.querySelector('.grid-frame')) grid.appendChild(svgNode('rect', { x: PLOT.left, y: PLOT.top, width: PLOT.width, height: PLOT.height, class: 'grid-frame', fill: 'none' }));
    axes.appendChild(svgNode('line', { x1: PLOT.left, x2: PLOT.right - 2, y1: Y(0), y2: Y(0), class: 'axis', 'marker-end': 'url(#width-axis-arrow)' }));
    axes.appendChild(svgNode('line', { x1: X(0), x2: X(0), y1: PLOT.bottom, y2: PLOT.top + 2, class: 'axis', 'marker-end': 'url(#width-axis-arrow)' }));
    axes.appendChild(svgNode('text', { x: PLOT.right - 5, y: Y(0) + 23, class: 'axis-label' }, 'x'));
    axes.appendChild(svgNode('text', { x: X(0) - 20, y: PLOT.top + 15, class: 'axis-label' }, 'y'));
    axes.appendChild(svgNode('text', { x: X(0) - 19, y: Y(0) + 21, class: 'axis-label' }, 'O'));
    [baseCurve, ...curves].forEach((curve, index) => {
      if (!curve) return;
      curve.setAttribute('clip-path', 'url(#width-plot-clip)'); curve.setAttribute('fill', 'none');
      curve.setAttribute('stroke', ['#55565a', '#00ace6', '#8c6fca'][index]);
      curve.setAttribute('stroke-width', index === 0 ? '3.5' : '3');
      curve.setAttribute('stroke-linecap', 'round'); curve.setAttribute('stroke-linejoin', 'round');
    });
    baseCurve.setAttribute('d', pathForTick(DEFAULT_TICK));
    baseCurve.setAttribute('data-coefficient-tick', String(DEFAULT_TICK));
  }
  function render() {
    root.dataset.activeQuestion = String(state.active + 1);
    root.dataset.locked = String(state.locked);
    const tick = pending ? pending.raw : state.ticks[state.active];
    slider.value = String(tick); slider.disabled = state.locked;
    slider.setAttribute('aria-label', `${state.active + 1}번 그래프의 모양 조절`);
    slider.setAttribute('aria-valuetext', '그래프 조절 위치');
    decrease.disabled = state.locked || tick === MIN_TICK; increase.disabled = state.locked || tick === MAX_TICK;
    const visible = state.touched.map((touched, index) => index === pageIndex && (touched || Boolean(pending)));
    curves.forEach((curve, index) => {
      if (!curve) return;
      const preview = pending && pending.index === index;
      const displayTick = preview ? pending.raw : state.ticks[index];
      curve.setAttribute('d', pathForCoefficient(displayTick / 6));
      curve.setAttribute('data-coefficient-tick', String(displayTick));
      curve.setAttribute('data-committed-tick', String(state.ticks[index]));
      curve.setAttribute('data-preview', String(Boolean(preview)));
      if (visible[index]) curve.removeAttribute('hidden');
      else curve.setAttribute('hidden', '');
      curve.style.display = visible[index] ? '' : 'none';
      curve.setAttribute('aria-hidden', String(!visible[index]));
    });
    description.textContent = '회색 기준 그래프는 고정되어 있습니다. ' + (visible[pageIndex]
      ? `${pageIndex + 1}번 ${pageIndex === 0 ? '파란색' : '보라색'} 그래프가 표시되어 있습니다.`
      : `${pageIndex + 1}번 그래프는 아직 조작하지 않았습니다.`);
    if (resultElement) {
      resultElement.classList.remove('correct', 'incorrect');
      if (state.result === null) { resultElement.textContent = ''; delete resultElement.dataset.result; }
      else {
        resultElement.textContent = state.result ? '정답입니다.' : '오답입니다.';
        resultElement.classList.add(state.result ? 'correct' : 'incorrect');
        resultElement.dataset.result = state.result ? 'correct' : 'incorrect';
      }
    }
    gradeButton.hidden = state.locked; resetButton.hidden = false; answerButton.hidden = !state.locked;
    overall.textContent = state.result === null ? '' : state.result ? '정답입니다.' : '오답입니다. 다시 하기를 눌러 도전해 보세요.';
  }
  function setSolutionOpen(open, restoreFocus = false) {
    solution.hidden = !open; answerButton.setAttribute('aria-expanded', String(open));
    const label = answerButton.querySelector('.text'); if (label) label.textContent = open ? '풀이 닫기' : '풀이 보기';
    if (restoreFocus) answerButton.focus();
  }
  function readRawSlider() {
    const raw = String(slider.value).trim();
    return raw === '' ? NaN : Number(raw);
  }
  function validRaw(raw) { return Number.isFinite(raw) && raw >= MIN_TICK && raw <= MAX_TICK; }
  function commitPending() {
    if (!pending) return;
    const preview = pending; pending = null;
    if (!state.locked && preview.index === state.active) state = transition(state, { type: 'setTick', tick: nearestSnap(preview.raw) });
  }
  function applyStopAction(action) {
    if (state.locked) { pending = null; render(); return; }
    commitPending(); state = transition(state, action); render();
    sliderStatus.textContent = '그래프를 조절했습니다.';
  }
  slider.addEventListener('input', () => {
    if (state.locked) { pending = null; render(); return; }
    const raw = readRawSlider();
    if (!validRaw(raw)) { pending = null; render(); return; }
    pending = { index: state.active, raw }; render();
    sliderStatus.textContent = '손잡이를 놓으면 가까운 위치에 멈춥니다.';
  });
  slider.addEventListener('change', () => {
    if (state.locked) { pending = null; render(); return; }
    const raw = readRawSlider(), hadPending = pending !== null; pending = null;
    if (!validRaw(raw)) { render(); return; }
    if (!hadPending && raw === state.ticks[state.active]) { render(); return; }
    state = transition(state, { type: 'setTick', tick: nearestSnap(raw) }); render();
    sliderStatus.textContent = '그래프를 조절했습니다.';
  });
  const keyActions = {
    ArrowLeft: { type: 'step', delta: -1 }, ArrowDown: { type: 'step', delta: -1 }, PageDown: { type: 'step', delta: -1 },
    ArrowRight: { type: 'step', delta: 1 }, ArrowUp: { type: 'step', delta: 1 }, PageUp: { type: 'step', delta: 1 },
    Home: { type: 'setTick', tick: MIN_TICK }, End: { type: 'setTick', tick: MAX_TICK }
  };
  slider.addEventListener('keydown', event => {
    if (!Object.prototype.hasOwnProperty.call(keyActions, event.key)) return;
    event.preventDefault(); applyStopAction(keyActions[event.key]);
  });
  decrease.addEventListener('click', () => applyStopAction({ type: 'step', delta: -1 }));
  increase.addEventListener('click', () => applyStopAction({ type: 'step', delta: 1 }));
  gradeButton.addEventListener('click', () => {
    if (state.locked) return;
    commitPending(); state = transition(state, { type: 'grade' }); render();
    sliderStatus.textContent = '채점한 그래프를 그대로 유지합니다.'; resetButton.focus();
  });
  resetButton.addEventListener('click', () => {
    pending = null; state = transition(state, { type: 'reset' }); render(); setSolutionOpen(false);
    sliderStatus.textContent = '슬라이더로 그래프를 그리세요.'; slider.focus();
  });
  answerButton.addEventListener('click', () => { if (state.locked) setSolutionOpen(solution.hidden); });
  root.querySelectorAll('.btn-answer-close').forEach(button => button.addEventListener('click', () => setSolutionOpen(false, true)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !solution.hidden) { event.preventDefault(); setSolutionOpen(false, true); }
  });
  slider.min = String(MIN_TICK); slider.max = String(MAX_TICK); slider.step = 'any';
  prepareGraph(); render(); setSolutionOpen(false);
  sliderStatus.textContent = '슬라이더로 그래프를 그리세요.';
  function fit() {
    const frame = get('activity-frame'); if (!frame) return;
    if (window.innerWidth < 600) { root.style.transform = 'none'; frame.style.width = '100%'; frame.style.height = 'auto'; return; }
    const scale = Math.min(1, window.innerWidth / 1280, window.innerHeight / 720);
    root.style.transform = `scale(${scale})`; frame.style.width = `${1280 * scale}px`; frame.style.height = `${720 * scale}px`;
  }
  window.addEventListener('resize', fit); fit(); root.classList.add('ready');
  const loading = get('loading-message'); if (loading) loading.hidden = true;
})();
