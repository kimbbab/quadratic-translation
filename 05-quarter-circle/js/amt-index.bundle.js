/* Adapted from the supplied quarter-circle activity; no SDK or network requests. */
(() => {
      'use strict';
      const origin = { x: 72, y: 452 };
      const radius = 350;
      const top = 48;
      const halfPi = Math.PI / 2;
      const normalizeAngle = value => {
        if (!Number.isFinite(value)) return null;
        const clamped = Math.min(halfPi, Math.max(0, value));
        const degrees = Math.round(clamped * 180 / Math.PI * 10) / 10;
        return degrees === 0 ? 0 : degrees === 90 ? halfPi : degrees * Math.PI / 180;
      };
      const sinCos = angle => angle === 0 ? { sin: 0, cos: 1 } : angle === halfPi ? { sin: 1, cos: 0 } : { sin: Math.sin(angle), cos: Math.cos(angle) };
      const position = value => {
        const { sin, cos } = sinCos(value);
        return { x: origin.x + radius * cos, y: origin.y - radius * sin };
      };
      const tangentEndpoint = value => {
        if (value === halfPi) return { x: origin.x, y: top, clipped: true };
        const height = radius * Math.tan(value);
        if (height > origin.y - top) return { x: origin.x + (origin.y - top) / Math.tan(value), y: top, clipped: true };
        return { x: origin.x + radius, y: origin.y - height, clipped: false };
      };
      const metricsAtAngle = value => {
        const angle = normalizeAngle(value);
        if (angle === null) return null;
        const { sin, cos } = sinCos(angle);
        return { angle, degrees: Math.round(angle * 180 / Math.PI * 10) / 10, bc: sin, oc: cos, ad: angle === halfPi ? null : Math.tan(angle) };
      };
      const angleFromPoint = point => Number.isFinite(point.x) && Number.isFinite(point.y) ? normalizeAngle(Math.atan2(origin.y - point.y, point.x - origin.x)) : null;
      const hitRadius = width => Number.isFinite(width) && width > 0 ? Math.max(32, 24 * 500 / width) : 32;
      if (typeof module !== 'undefined' && module.exports) module.exports = { origin, radius, top, normalizeAngle, position, tangentEndpoint, metricsAtAngle, angleFromPoint, hitRadius };
      if (typeof document === 'undefined') return;
      const diagrams = [...document.querySelectorAll('.diagram')].map(svg => ({
        svg,
        angle: Math.PI / 4,
        metrics: Object.fromEntries([...svg.closest('.diagram-panel').querySelectorAll('[data-metric]')].map(node => [node.dataset.metric, node])),
        parts: Object.fromEntries([...svg.querySelectorAll('[data-part]')].map(node => [node.dataset.part, node]))
      }));
      let activeDrag = null;
      let announcementTimer;
      const set = (node, attributes) => {
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      };
      const ray = (node, endpoint) => set(node, { x1: origin.x, y1: origin.y, x2: endpoint.x, y2: endpoint.y });
      const rightAngle = (node, x, height, width) => {
        const size = Math.min(19, height * 0.65, width * 0.65);
        set(node, { d: size > 0.5 ? `M ${x - size} ${origin.y} V ${origin.y - size} H ${x}` : '' });
      };
      const render = diagram => {
        const { svg, parts, angle, metrics } = diagram;
        const b = position(angle);
        const degrees = angle * 180 / Math.PI;
          const left = svg.id === 'sine-cosine';
          const endpoint = left ? b : tangentEndpoint(angle);
          ray(parts.ray, endpoint);
          if (left) {
            set(parts.oc, { x1: origin.x, y1: origin.y, x2: b.x, y2: origin.y, visibility: angle === Math.PI / 2 ? 'hidden' : 'visible' });
            set(parts.bc, { x1: b.x, y1: b.y, x2: b.x, y2: origin.y, visibility: angle === 0 ? 'hidden' : 'visible' });
            rightAngle(parts.square, b.x, origin.y - b.y, b.x - origin.x);
            set(parts['c-label'], { x: Math.min(b.x, 386), y: 493 });
          } else {
            set(parts.ad, { x1: origin.x + radius, y1: origin.y, x2: origin.x + radius, y2: endpoint.y, visibility: angle === 0 ? 'hidden' : 'visible' });
            if (endpoint.clipped) parts.ad.setAttribute('marker-end', 'url(#blue-continuation)');
            else parts.ad.removeAttribute('marker-end');
            set(parts['d-label'], { x: origin.x + radius, y: endpoint.y - (angle < 0.2 ? 28 : 17), visibility: endpoint.clipped ? 'hidden' : 'visible' });
            rightAngle(parts.square, origin.x + radius, origin.y - endpoint.y, radius);
          }
          const angleRadius = 59;
          const arcEnd = { x: origin.x + angleRadius * Math.cos(angle), y: origin.y - angleRadius * Math.sin(angle) };
          set(parts.angle, { d: angle > 0.001 ? `M ${origin.x + angleRadius} ${origin.y} A ${angleRadius} ${angleRadius} 0 0 0 ${arcEnd.x} ${arcEnd.y}` : '' });
          set(parts.alpha, { x: origin.x + 84 * Math.cos(angle / 2), y: origin.y - 84 * Math.sin(angle / 2) + (degrees < 12 ? -12 : 7) });
          parts['angle-value'].textContent = `= ${degrees.toFixed(1)}°`;
          if (left) {
            const values = sinCos(angle);
            metrics.bc.textContent = values.sin.toFixed(4);
            metrics.oc.textContent = values.cos.toFixed(4);
          } else {
            metrics.ad.textContent = angle === halfPi ? '정의되지 않음' : Math.tan(angle).toFixed(4);
          }
          // Keep B away from the axis labels and the tangent endpoint.
          let bLabelX = angle < (left ? 0.2 : 0.55) ? b.x - 38 : b.x + 15;
          let bLabelY = b.y - 16;
          if (!left && angle >= 0.55 && angle <= 1.05) { bLabelX = b.x - 8; bLabelY = b.y - 32; }
          if (!left && angle > 1.05) bLabelY = b.y + 45;
          set(parts['b-label'], { x: bLabelX, y: bLabelY });
          set(parts.handle, { transform: `translate(${b.x} ${b.y})`, 'aria-valuenow': degrees.toFixed(1), 'aria-valuetext': `${degrees.toFixed(1)}도` });
          svg.dataset.angle = degrees.toFixed(4);
      };
      const update = (diagram, value) => {
        const angle = normalizeAngle(value);
        if (angle === null) return;
        diagram.angle = angle;
        render(diagram);
      };
      const announce = diagram => {
        clearTimeout(announcementTimer);
        announcementTimer = setTimeout(() => {
          const name = diagram.svg.id === 'sine-cosine' ? '왼쪽' : '오른쪽';
          const status = document.getElementById('angle-status');
          if (status) status.textContent = `${name} B점의 각도 ${(diagram.angle * 180 / Math.PI).toFixed(1)}도`;
        }, 150);
      };
      const pointerAngle = (diagram, event) => {
        if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
        try {
          const matrix = diagram.svg.getScreenCTM();
          if (!matrix) return null;
          const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          return Number.isFinite(point.x) && Number.isFinite(point.y) ? Math.atan2(origin.y - point.y, point.x - origin.x) : null;
        } catch (_) {
          // A detached or temporarily singular SVG must not corrupt the last valid state.
          return null;
        }
      };
      const fromPointer = (diagram, event) => {
        const angle = pointerAngle(diagram, event);
        if (angle === null) return;
        const drag = activeDrag?.diagram === diagram && activeDrag.id === event.pointerId ? activeDrag : null;
        if (drag && drag.offset === null) { drag.offset = diagram.angle - angle; return; }
        update(diagram, angle + (drag ? drag.offset : 0));
      };
      const stopDrag = (shouldAnnounce = true) => {
        if (!activeDrag) return;
        const { svg, id, diagram } = activeDrag;
        activeDrag = null;
        svg.classList.remove('dragging');
        try {
          if (typeof svg.releasePointerCapture === 'function' && (typeof svg.hasPointerCapture !== 'function' || svg.hasPointerCapture(id))) svg.releasePointerCapture(id);
        } catch (_) { /* Capture may already be gone after pointercancel or detachment. */ }
        if (shouldAnnounce) announce(diagram);
      };
      const finishDrag = event => {
        if (!activeDrag || event.pointerId !== activeDrag.id) return;
        if (event.type === 'pointerup') fromPointer(activeDrag.diagram, event);
        stopDrag();
      };
      const moveDrag = event => {
        if (activeDrag && event.pointerId === activeDrag.id) fromPointer(activeDrag.diagram, event);
      };
      for (const diagram of diagrams) {
        const { svg, parts } = diagram;
        svg.addEventListener('pointerdown', event => {
          if (activeDrag || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0) || !event.target?.closest?.('.drag-target')) return;
          event.preventDefault();
          clearTimeout(announcementTimer);
          const startsOnHandle = parts.handle.contains(event.target);
          const startAngle = pointerAngle(diagram, event);
          const offset = startsOnHandle ? startAngle === null ? null : diagram.angle - startAngle : 0;
          activeDrag = { svg, id: event.pointerId, diagram, captured: false, offset };
          svg.classList.add('dragging');
          try {
            if (typeof svg.setPointerCapture === 'function') {
              svg.setPointerCapture(event.pointerId);
              activeDrag.captured = typeof svg.hasPointerCapture === 'function' ? svg.hasPointerCapture(event.pointerId) : true;
            }
          } catch (_) { /* Window listeners below keep dragging usable if capture is unavailable. */ }
          parts.handle.focus({ preventScroll: true });
          fromPointer(diagram, event);
        });
        svg.addEventListener('pointermove', event => { if (activeDrag?.svg === svg) moveDrag(event); });
        svg.addEventListener('pointerup', finishDrag);
        svg.addEventListener('pointercancel', finishDrag);
        svg.addEventListener('lostpointercapture', finishDrag);
        parts.handle.addEventListener('keydown', event => {
          const step = (event.shiftKey ? 5 : 1) * Math.PI / 180;
          const angle = diagram.angle;
          let next;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = angle - step;
          else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = angle + step;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = Math.PI / 2;
          else return;
          event.preventDefault();
          update(diagram, next);
          announce(diagram);
        });
        render(diagram);
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('pointermove', event => {
          if (!activeDrag || activeDrag.captured) return;
          let inside = false;
          try { inside = activeDrag.svg.contains(event.target); } catch (_) { /* A synthetic event may target Window. */ }
          if (!inside) moveDrag(event);
        });
        window.addEventListener('pointerup', finishDrag);
        window.addEventListener('pointercancel', finishDrag);
        window.addEventListener('blur', () => stopDrag());
      }
      document.addEventListener('visibilitychange', () => { if (document.hidden) stopDrag(); });
      const reset = () => {
        stopDrag(false); clearTimeout(announcementTimer);
        const status = document.getElementById('angle-status');
        if (status) status.textContent = '';
        diagrams.forEach(diagram => update(diagram, Math.PI / 4));
      };
      document.querySelectorAll('.btn-restart').forEach(button => button.addEventListener('click', reset));
      const resizeHits = () => {
        diagrams.forEach(({ svg, parts }) => {
          const hit = parts.handle.querySelector('.handle-hit');
          const width = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect().width : 0;
          if (hit) hit.setAttribute('r', String(hitRadius(width)));
        });
      };
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(resizeHits);
        diagrams.forEach(({ svg }) => observer.observe(svg));
      }
      if (typeof window !== 'undefined') window.addEventListener('resize', resizeHits);
      resizeHits();
      document.getElementById('amt-viewer-wraper')?.classList.add('ready');
    })();
