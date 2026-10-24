import { PITCH_DEFAULT } from './physics.js';

export function createCooldownController(onStateChange) {
  let lockedUntil = 0;
  let timer = null;

  function isLocked() {
    return performance.now() < lockedUntil;
  }

  function setCooldown(ms) {
    lockedUntil = performance.now() + ms;
    if (onStateChange) onStateChange();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (onStateChange) onStateChange();
    }, ms);
  }

  return { isLocked, setCooldown };
}

export function toCanvasCoords(canvas, clientX, clientY, pitch = PITCH_DEFAULT) {
  const rect = canvas.getBoundingClientRect();
  const targetAspect = pitch.WIDTH / pitch.HEIGHT;
  const rectAspect = rect.width / rect.height;

  let drawWidth = rect.width;
  let drawHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (rectAspect > targetAspect) {
    drawWidth = rect.height * targetAspect;
    offsetX = (rect.width - drawWidth) * 0.5;
  } else if (rectAspect < targetAspect) {
    drawHeight = rect.width / targetAspect;
    offsetY = (rect.height - drawHeight) * 0.5;
  }

  return {
    x: ((clientX - rect.left - offsetX) / drawWidth) * pitch.WIDTH,
    y: ((clientY - rect.top - offsetY) / drawHeight) * pitch.HEIGHT,
  };
}

export function renderRepChips(containerEl, totalReps, history, activeIndex, isActiveRep, formatItem) {
  containerEl.innerHTML = '';
  for (let i = 0; i < totalReps; i++) {
    const item = history[i];
    const chip = document.createElement('div');

    if (item) {
      const { cls, tag, title } = formatItem(item, i);
      chip.className = `rep-chip ${cls}`;
      chip.title = title || `Rep ${i + 1}`;
      chip.innerHTML = `<span class="rep-num">#${i + 1}</span><span class="rep-tag">${tag}</span>`;
    } else {
      const isCurrent = i === activeIndex && isActiveRep;
      chip.className = `rep-chip ${isCurrent ? 'active' : ''}`;
      chip.innerHTML = `<span class="rep-num">#${i + 1}</span><span class="rep-tag">&mdash;</span>`;
    }

    containerEl.appendChild(chip);
  }
}

export function renderBreakdownList(listEl, items) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!items || items.length === 0) {
    listEl.className = 'result-breakdown hidden';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = `breakdown-item ${item.tier}`;
    li.innerHTML = `<span class="breakdown-dot"></span><span>${item.text}</span>`;
    listEl.appendChild(li);
  });
  listEl.className = 'result-breakdown';
}

export function renderSummaryBoxes(listEl, boxes) {
  if (!listEl) return;
  listEl.innerHTML = boxes
    .map(
      (b) => `
    <div class="summary-box ${b.cls}">
      <span class="summary-count">${b.count}</span>
      <span class="summary-label">${b.label}</span>
    </div>
  `
    )
    .join('');
}
