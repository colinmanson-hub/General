// Issue #6: Control panel — binds DOM inputs to the settings object

export function bindControls(panelEl, settings, callbacks) {
  const { onChange, onRandomize, onRestart, onSavePng } = callbacks;

  function get(id) { return document.getElementById(id); }
  function fire(structural = false) { onChange(settings, structural); }

  function bind(id, path, transform = (v) => v, structural = false) {
    const el = get(id);
    if (!el) return;
    el.addEventListener('change', () => {
      setPath(settings, path, transform(el.type === 'checkbox' ? el.checked : el.value));
      fire(structural);
    });
    if (el.type === 'range') {
      el.addEventListener('input', () => {
        setPath(settings, path, transform(el.value));
        fire(structural);
      });
    }
  }

  // Shape controls (structural)
  bind('shape-type', 'shape.type', String, true);
  bind('wheel-side', 'wheel.side', String, true);
  bind('wheel-type', 'wheel.type', String, true);
  bind('shape-sides', 'shape.sides', Number, true);
  bind('shape-aspect', 'shape.aspect', Number, true);
  bind('shape-size', 'shape.size', Number, true);
  bind('wheel-r', 'wheel.r', Number, true);
  bind('wheel-d', 'wheel.d', Number, true);

  // Style controls (non-structural)
  bind('draw-speed', 'draw.speed', Number, false);
  bind('draw-linewidth', 'draw.lineWidth', Number, false);
  bind('color-mode', 'color.mode', String, false);
  bind('color-fixed', 'color.fixed', String, false);
  bind('color-cycle-speed', 'color.cycleSpeed', Number, false);
  bind('background', 'background', String, false);

  // Buttons
  get('btn-randomize')?.addEventListener('click', onRandomize);
  get('btn-restart')?.addEventListener('click', onRestart);
  get('btn-save')?.addEventListener('click', onSavePng);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'h' || e.key === 'H') panelEl.classList.toggle('hidden');
    if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
      window.api?.toggleFullscreen();
    }
  });

  // Sync initial UI state from settings
  syncUI(settings);
}

function syncUI(settings) {
  function set(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value;
    else el.value = value;
  }
  set('shape-type', settings.shape.type);
  set('wheel-side', settings.wheel.side);
  set('wheel-type', settings.wheel.type);
  set('shape-sides', settings.shape.sides);
  set('shape-aspect', settings.shape.aspect);
  set('shape-size', settings.shape.size);
  set('wheel-r', settings.wheel.r);
  set('wheel-d', settings.wheel.d);
  set('draw-speed', settings.draw.speed);
  set('draw-linewidth', settings.draw.lineWidth);
  set('color-mode', settings.color.mode);
  set('color-fixed', settings.color.fixed);
  set('color-cycle-speed', settings.color.cycleSpeed);
  set('background', settings.background);
}

// Deep-path setter: setPath(obj, 'a.b.c', value)
function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] === undefined) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}
