/* Coefficient reflection: fixed y=2x^2 and y=(1/2)x^2. No SDK or network calls. */
(function () {
  'use strict';
  const MIN_TICK = -24, MAX_TICK = 24;
  const DEFAULT_TICKS = Object.freeze([12, 3]);
  const TARGET_TICKS = Object.freeze([-12, -3]);
  const PLOT = Object.freeze({ left: 150, top: 26, width: 220, height: 396, right: 370, bottom: 422, unit: 22, minX: -5, maxX: 5, minY: -9, maxY: 9 });
  const isTick = tick => Number.isInteger(tick) && tick >= MIN_TICK && tick <= MAX_TICK;
  function requireTick(tick) {
    if (!isTick(tick)) throw new RangeError('계수 눈금은 −24부터 24 사이의 정수여야 합니다.');
    return tick;
  }
  function gcd(a, b) { while (b) { const remainder = a % b; a = b; b = remainder; } return a; }
  function tickToFraction(tick) {
    requireTick(tick);
    const divisor = gcd(Math.abs(tick), 6), numerator = tick / divisor, denominator = 6 / divisor;
    return { numerator, denominator, text: denominator === 1 ? String(numerator) : numerator + '/' + denominator };
  }
  function coefficient(tick) { return requireTick(tick) / 6; }
  function coordinates(x, y) { return { x: PLOT.left + (x - PLOT.minX) * PLOT.unit, y: PLOT.top + (PLOT.maxY - y) * PLOT.unit }; }
  function pathForCoefficient(a) {
    if (!Number.isFinite(a) || a < MIN_TICK / 6 || a > MAX_TICK / 6) throw new RangeError('계수는 −4부터 4 사이여야 합니다.');
    // This quadratic Bézier is exactly y=a*x^2. The SVG clips it to the plotting rectangle.
    const extent = PLOT.maxX, y = a * extent * extent;
    const start = coordinates(-extent, y), control = coordinates(0, -y), end = coordinates(extent, y);
    return `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  function pathForTick(tick) { return pathForCoefficient(coefficient(tick)); }
  function initialState() { return { active: 0, ticks: DEFAULT_TICKS.slice(), touched: [false, false], locked: false, results: null }; }
  function gradeState(state) { return TARGET_TICKS.map((target, index) => state.touched[index] && state.ticks[index] === target); }
  function transition(state, action) {
    if (action.type === 'reset') return initialState();
    if (state.locked) return state;
    if (action.type === 'select') return action.index === 0 || action.index === 1 ? { ...state, active: action.index } : state;
    if (action.type === 'grade') return { ...state, locked: true, results: gradeState(state) };
    let nextTick;
    if (action.type === 'setTick') nextTick = action.tick;
    else if (action.type === 'step' && (action.delta === -1 || action.delta === 1)) nextTick = state.ticks[state.active] + action.delta;
    else return state;
    if (!isTick(nextTick)) return state;
    const ticks = state.ticks.slice(), touched = state.touched.slice();
    ticks[state.active] = nextTick; touched[state.active] = true;
    return { ...state, ticks, touched };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIN_TICK, MAX_TICK, DEFAULT_TICKS, TARGET_TICKS, PLOT, tickToFraction, coefficient, coordinates, pathForCoefficient, pathForTick, initialState, gradeState, transition };
  }
  if (typeof document === 'undefined') return;
  const root = document.getElementById('amt-viewer-wraper');
  if (!root) return;
  const get = id => document.getElementById(id);
  const graph = get('width-graph'), grid = get('width-grid'), axes = get('width-axes');
  const baseCurves = [get('base-curve-1'), get('base-curve-2')], curves = [get('curve-1'), get('curve-2')];
  const description = get('width-desc'), selectButtons = [get('select-1'), get('select-2')];
  const slider = get('coefficient-slider'), decrease = get('decrease-a'), increase = get('increase-a');
  const output = get('coefficient-value'), sliderStatus = get('slider-status');
  const results = [get('result-1'), get('result-2')];
  const gradeButton = root.querySelector('.btn-mark'), resetButton = root.querySelector('.btn-restart'), answerButton = root.querySelector('.btn-answer');
  const overall = get('overall-result'), solution = get('answer-popup-01');
  let state = initialState();

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
      if (x !== 0 && x > PLOT.minX && x < PLOT.maxX && x % 2 === 0) axes.appendChild(svgNode('text', { x: X(x), y: Y(0) + 22, 'text-anchor': 'middle', class: 'tick-label' }, fmt(x)));
    }
    for (let y = PLOT.minY; y <= PLOT.maxY; y++) {
      if (y !== 0) grid.appendChild(svgNode('line', { x1: PLOT.left, x2: PLOT.right, y1: Y(y), y2: Y(y), class: 'grid-line' }));
      if (y !== 0 && y > PLOT.minY && y < PLOT.maxY && y % 2 === 0) axes.appendChild(svgNode('text', { x: X(0) - 10, y: Y(y) + 6, 'text-anchor': 'end', class: 'tick-label' }, fmt(y)));
    }
    if (!graph.querySelector('.grid-frame')) grid.appendChild(svgNode('rect', { x: PLOT.left, y: PLOT.top, width: PLOT.width, height: PLOT.height, class: 'grid-frame', fill: 'none' }));
    axes.appendChild(svgNode('line', { x1: PLOT.left, x2: PLOT.right - 2, y1: Y(0), y2: Y(0), class: 'axis', 'marker-end': 'url(#width-axis-arrow)' }));
    axes.appendChild(svgNode('line', { x1: X(0), x2: X(0), y1: PLOT.bottom, y2: PLOT.top + 2, class: 'axis', 'marker-end': 'url(#width-axis-arrow)' }));
    axes.appendChild(svgNode('text', { x: PLOT.right - 5, y: Y(0) + 23, class: 'axis-label' }, 'x'));
    axes.appendChild(svgNode('text', { x: X(0) + 12, y: PLOT.top + 15, class: 'axis-label' }, 'y'));
    axes.appendChild(svgNode('text', { x: X(0) - 19, y: Y(0) + 21, class: 'axis-label' }, 'O'));
    [...baseCurves, ...curves].forEach((curve, index) => {
      curve.setAttribute('clip-path', 'url(#width-plot-clip)'); curve.setAttribute('fill', 'none');
      curve.setAttribute('stroke', ['#55565a', '#55565a', '#00ace6', '#8c6fca'][index]);
      curve.setAttribute('stroke-width', index < 2 ? '3.5' : '3');
      curve.setAttribute('stroke-linecap', 'round'); curve.setAttribute('stroke-linejoin', 'round');
    });
    baseCurves.forEach((curve, index) => {
      curve.setAttribute('d', pathForTick(DEFAULT_TICKS[index]));
      curve.setAttribute('data-coefficient-tick', String(DEFAULT_TICKS[index]));
    });
  }
  function render() {
    root.dataset.activeQuestion = String(state.active + 1);
    root.dataset.locked = String(state.locked);
    const tick = state.ticks[state.active], fraction = tickToFraction(tick);
    slider.value = String(tick); slider.disabled = state.locked;
    slider.setAttribute('aria-label', `${state.active + 1}번 그래프의 계수 a`);
    const sign = fraction.numerator < 0 ? '−' : '', spokenSign = fraction.numerator < 0 ? '마이너스 ' : '';
    const magnitude = Math.abs(fraction.numerator);
    slider.setAttribute('aria-valuetext', fraction.denominator === 1 ? `a는 ${spokenSign}${magnitude}` : `a는 ${spokenSign}${fraction.denominator}분의 ${magnitude}`);
    // Numerators and denominators come only from the 49 validated integer ticks.
    output.innerHTML = sign + (fraction.denominator === 1 ? String(magnitude) : `<span class="fraction"><span>${magnitude}</span><span>${fraction.denominator}</span></span>`);
    output.setAttribute('aria-label', 'a = ' + fraction.text);
    decrease.disabled = state.locked || tick === MIN_TICK; increase.disabled = state.locked || tick === MAX_TICK;
    selectButtons.forEach((button, index) => {
      button.disabled = state.locked; button.setAttribute('aria-pressed', String(index === state.active));
      button.classList.toggle('active', index === state.active);
    });
    curves.forEach((curve, index) => {
      curve.setAttribute('d', pathForTick(state.ticks[index]));
      curve.setAttribute('data-coefficient-tick', String(state.ticks[index]));
      if (state.touched[index]) curve.removeAttribute('hidden');
      else curve.setAttribute('hidden', '');
      curve.style.display = state.touched[index] ? '' : 'none';
      curve.setAttribute('aria-hidden', String(!state.touched[index]));
    });
    description.textContent = '회색 기준 그래프는 y=2x²와 y=(1/2)x²입니다. ' + state.ticks.map((value, index) => state.touched[index]
      ? `${index + 1}번 ${index === 0 ? '파란색' : '보라색'} 그래프는 y=(${tickToFraction(value).text})x²입니다.`
      : `${index + 1}번 그래프는 아직 조작하지 않았습니다.`).join(' ');
    results.forEach((element, index) => {
      element.classList.remove('correct', 'incorrect');
      if (state.results === null) { element.textContent = ''; delete element.dataset.result; }
      else {
        const correct = state.results[index];
        element.textContent = correct ? '정답입니다.' : '오답입니다.';
        element.classList.add(correct ? 'correct' : 'incorrect'); element.dataset.result = correct ? 'correct' : 'incorrect';
      }
    });
    gradeButton.hidden = state.locked; resetButton.hidden = false; answerButton.hidden = !state.locked;
    if (state.results === null) overall.textContent = '';
    else {
      const count = state.results.filter(Boolean).length;
      overall.textContent = count === 2 ? '두 문제 모두 정답입니다.' : `정답 ${count} / 2 · 각 문항의 결과를 확인하세요.`;
    }
  }
  function setSolutionOpen(open, restoreFocus = false) {
    solution.hidden = !open; answerButton.setAttribute('aria-expanded', String(open));
    const label = answerButton.querySelector('.text'); if (label) label.textContent = open ? '풀이 닫기' : '풀이 보기';
    if (restoreFocus) answerButton.focus();
  }
  function applyTick(action) {
    if (state.locked) return;
    const next = transition(state, action);
    if (next === state) { render(); return; }
    state = next; render(); sliderStatus.textContent = `${state.active + 1}번 그래프의 계수를 바꾸었습니다.` + (state.ticks[state.active] === 0 ? ' a=0이면 x축과 겹칩니다.' : '');
  }
  selectButtons.forEach((button, index) => button.addEventListener('click', () => {
    if (state.locked) return;
    state = transition(state, { type: 'select', index }); render();
    sliderStatus.textContent = `${index + 1}번 그래프를 조절하세요.` + (state.ticks[index] === 0 ? ' a=0이면 x축과 겹칩니다.' : '');
  }));
  slider.addEventListener('input', () => applyTick({ type: 'setTick', tick: Number(slider.value) }));
  decrease.addEventListener('click', () => applyTick({ type: 'step', delta: -1 }));
  increase.addEventListener('click', () => applyTick({ type: 'step', delta: 1 }));
  gradeButton.addEventListener('click', () => {
    if (state.locked) return;
    state = transition(state, { type: 'grade' }); render();
    sliderStatus.textContent = '채점한 그래프를 그대로 유지합니다.'; resetButton.focus();
  });
  resetButton.addEventListener('click', () => {
    state = transition(state, { type: 'reset' }); render(); setSolutionOpen(false);
    sliderStatus.textContent = '문항을 선택하고 슬라이더로 그래프를 그리세요.'; selectButtons[0].focus();
  });
  answerButton.addEventListener('click', () => { if (state.locked) setSolutionOpen(solution.hidden); });
  root.querySelectorAll('.btn-answer-close').forEach(button => button.addEventListener('click', () => setSolutionOpen(false, true)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !solution.hidden) { event.preventDefault(); setSolutionOpen(false, true); }
  });
  slider.min = String(MIN_TICK); slider.max = String(MAX_TICK); slider.step = '1';
  prepareGraph(); render(); setSolutionOpen(false);
  sliderStatus.textContent = '문항을 선택하고 슬라이더로 그래프를 그리세요.';
  function fit() {
    const frame = get('activity-frame'); if (!frame) return;
    if (window.innerWidth < 600) { root.style.transform = 'none'; frame.style.width = '100%'; frame.style.height = 'auto'; return; }
    const scale = Math.min(1, window.innerWidth / 1280, window.innerHeight / 720);
    root.style.transform = `scale(${scale})`; frame.style.width = `${1280 * scale}px`; frame.style.height = `${720 * scale}px`;
  }
  window.addEventListener('resize', fit); fit(); root.classList.add('ready');
  const loading = get('loading-message'); if (loading) loading.hidden = true;
})();
