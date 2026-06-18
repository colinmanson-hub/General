import { bindControls } from '../renderer/controls.js';

// --- Minimal DOM mock -------------------------------------------------------
// controls.js only needs getElementById, addEventListener (per-element and on
// document), classList.toggle, and the value/checked/type/files properties.

function makeEl(type = 'text', value = '') {
  const listeners = {};
  return {
    type,
    value,
    checked: false,
    files: [],
    tagName: type === 'text' ? 'INPUT' : 'INPUT',
    classList: {
      _set: new Set(),
      toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
      contains(c) { return this._set.has(c); },
    },
    addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
    _fire(ev, payload = {}) {
      (listeners[ev] || []).forEach((fn) => fn({ target: this, ...payload }));
    },
    click() { this._fire('click'); },
  };
}

function installDom(ids) {
  const registry = {};
  for (const [id, el] of Object.entries(ids)) registry[id] = el;
  const docListeners = {};
  global.document = {
    getElementById: (id) => registry[id] || null,
    addEventListener: (ev, fn) => { (docListeners[ev] ||= []).push(fn); },
    _fireDoc: (ev, payload) => (docListeners[ev] || []).forEach((fn) => fn(payload)),
  };
  return { registry, fireDoc: (ev, p) => global.document._fireDoc(ev, p) };
}

function defaultSettings() {
  return {
    shape: { type: 'circle', sides: 6, points: 5, aspect: 1.5, size: 0.8 },
    wheel: { r: 0.3, d: 0.4, side: 'inside' },
    draw: { speed: 30, loops: 10, lineWidth: 1.5 },
    color: { mode: 'cycle', fixed: '#00ffcc', cycleSpeed: 1 },
    background: '#000000',
    audio: {
      enabled: false,
      source: 'file',
      mappings: {
        level: { enabled: true, sensitivity: 1 },
        bass: { enabled: true, sensitivity: 1 },
        spectrum: { enabled: true, sensitivity: 1 },
        beat: { enabled: true, sensitivity: 1 },
      },
    },
  };
}

function noopCallbacks(overrides = {}) {
  return {
    onChange: () => {},
    onRandomize: () => {},
    onRestart: () => {},
    onSavePng: () => {},
    onToggleAudio: () => {},
    onLoadAudioFile: () => {},
    ...overrides,
  };
}

afterEach(() => { delete global.document; });

describe('bindControls — value binding', () => {
  test('changing a select updates settings and fires structural onChange', () => {
    const settings = defaultSettings();
    const shapeType = makeEl('select', 'circle');
    installDom({ 'shape-type': shapeType });
    const calls = [];
    bindControls(makeEl(), settings, noopCallbacks({
      onChange: (s, structural) => calls.push(structural),
    }));

    shapeType.value = 'star';
    shapeType._fire('change');

    expect(settings.shape.type).toBe('star');
    expect(calls).toContain(true); // shape changes are structural
  });

  test('range input event fires non-structural onChange and coerces Number', () => {
    const settings = defaultSettings();
    const speed = makeEl('range', '30');
    installDom({ 'draw-speed': speed });
    const calls = [];
    bindControls(makeEl(), settings, noopCallbacks({
      onChange: (s, structural) => calls.push(structural),
    }));

    speed.value = '120';
    speed._fire('input');

    expect(settings.draw.speed).toBe(120);
    expect(typeof settings.draw.speed).toBe('number');
    expect(calls).toContain(false); // style change, not structural
  });

  test('checkbox change coerces Boolean', () => {
    const settings = defaultSettings();
    const mapLevel = makeEl('checkbox');
    installDom({ 'map-level': mapLevel });
    bindControls(makeEl(), settings, noopCallbacks());

    mapLevel.checked = false;
    mapLevel._fire('change');

    expect(settings.audio.mappings.level.enabled).toBe(false);
  });

  test('deep-path binding writes nested sensitivity values', () => {
    const settings = defaultSettings();
    const sens = makeEl('range', '1');
    installDom({ 'map-bass-sens': sens });
    bindControls(makeEl(), settings, noopCallbacks());

    sens.value = '3.5';
    sens._fire('input');

    expect(settings.audio.mappings.bass.sensitivity).toBe(3.5);
  });
});

describe('bindControls — buttons', () => {
  test('randomize / restart / save buttons invoke their callbacks', () => {
    const settings = defaultSettings();
    const btnR = makeEl('button');
    const btnRe = makeEl('button');
    const btnS = makeEl('button');
    installDom({ 'btn-randomize': btnR, 'btn-restart': btnRe, 'btn-save': btnS });

    let randomized = 0, restarted = 0, saved = 0;
    bindControls(makeEl(), settings, noopCallbacks({
      onRandomize: () => randomized++,
      onRestart: () => restarted++,
      onSavePng: () => saved++,
    }));

    btnR.click();
    btnRe.click();
    btnS.click();

    expect(randomized).toBe(1);
    expect(restarted).toBe(1);
    expect(saved).toBe(1);
  });

  test('toggling audio checkbox invokes onToggleAudio with the new value', () => {
    const settings = defaultSettings();
    const audioEnabled = makeEl('checkbox');
    installDom({ 'audio-enabled': audioEnabled });
    const toggled = [];
    bindControls(makeEl(), settings, noopCallbacks({
      onToggleAudio: (v) => toggled.push(v),
    }));

    audioEnabled.checked = true;
    audioEnabled._fire('change');

    expect(settings.audio.enabled).toBe(true);
    expect(toggled).toContain(true);
  });

  test('load button forwards a chosen file to onLoadAudioFile', () => {
    const settings = defaultSettings();
    const loadBtn = makeEl('button');
    const fileInput = makeEl('file');
    installDom({ 'audio-load-btn': loadBtn, 'audio-file-input': fileInput });

    // Clicking the visible button should trigger the hidden file input.
    let inputClicked = false;
    fileInput.click = () => { inputClicked = true; };

    const loaded = [];
    bindControls(makeEl(), settings, noopCallbacks({
      onLoadAudioFile: (f) => loaded.push(f),
    }));

    loadBtn._fire('click');
    expect(inputClicked).toBe(true);

    const fakeFile = { name: 'song.mp3' };
    fileInput.files = [fakeFile];
    fileInput._fire('change');
    expect(loaded).toEqual([fakeFile]);
  });
});

describe('bindControls — keyboard shortcuts', () => {
  test('"h" toggles the panel hidden class', () => {
    const settings = defaultSettings();
    const { fireDoc } = installDom({});
    const panel = makeEl();
    bindControls(panel, settings, noopCallbacks());

    expect(panel.classList.contains('hidden')).toBe(false);
    fireDoc('keydown', { key: 'h', target: { tagName: 'BODY' } });
    expect(panel.classList.contains('hidden')).toBe(true);
    fireDoc('keydown', { key: 'H', target: { tagName: 'BODY' } });
    expect(panel.classList.contains('hidden')).toBe(false);
  });

  test('shortcuts are ignored while typing in an input', () => {
    const settings = defaultSettings();
    const { fireDoc } = installDom({});
    const panel = makeEl();
    bindControls(panel, settings, noopCallbacks());

    fireDoc('keydown', { key: 'h', target: { tagName: 'INPUT' } });
    expect(panel.classList.contains('hidden')).toBe(false);
  });
});

describe('bindControls — initial sync', () => {
  test('syncUI writes settings back onto the inputs', () => {
    const settings = defaultSettings();
    settings.draw.speed = 77;
    settings.audio.enabled = true;
    const speed = makeEl('range', '0');
    const audioEnabled = makeEl('checkbox');
    installDom({ 'draw-speed': speed, 'audio-enabled': audioEnabled });

    bindControls(makeEl(), settings, noopCallbacks());

    expect(Number(speed.value)).toBe(77);
    expect(audioEnabled.checked).toBe(true);
  });

  test('missing elements are tolerated (no throw)', () => {
    const settings = defaultSettings();
    installDom({}); // nothing registered
    expect(() => bindControls(makeEl(), settings, noopCallbacks())).not.toThrow();
  });
});

describe('bindControls — structural vs style classification', () => {
  function bindOne(id, el) {
    const settings = defaultSettings();
    installDom({ [id]: el });
    const calls = [];
    bindControls(makeEl(), settings, noopCallbacks({
      onChange: (_s, structural) => calls.push(structural),
    }));
    return { settings, calls };
  }

  test.each([
    ['wheel-r', 'range', '0.5', 'wheel', 'r', 0.5],
    ['wheel-d', 'range', '0.7', 'wheel', 'd', 0.7],
    ['draw-loops', 'number', '12', 'draw', 'loops', 12],
    ['shape-aspect', 'number', '2.5', 'shape', 'aspect', 2.5],
  ])('%s is structural and updates settings', (id, type, value, group, key, expected) => {
    const el = makeEl(type, '0');
    const { settings, calls } = bindOne(id, el);
    el.value = value;
    el._fire(type === 'range' ? 'input' : 'change');
    expect(settings[group][key]).toBe(expected);
    expect(calls).toContain(true);
  });

  test.each([
    ['color-mode', 'select', 'fixed', 'color', 'mode', 'fixed'],
    ['background', 'color', '#123456', null, 'background', '#123456'],
    ['color-cycle-speed', 'range', '4', 'color', 'cycleSpeed', 4],
    ['draw-linewidth', 'range', '3.5', 'draw', 'lineWidth', 3.5],
  ])('%s is a non-structural style change', (id, type, value, group, key, expected) => {
    const el = makeEl(type, '');
    const { settings, calls } = bindOne(id, el);
    el.value = value;
    el._fire(type === 'range' ? 'input' : 'change');
    const actual = group ? settings[group][key] : settings[key];
    expect(actual).toBe(expected);
    expect(calls).toContain(false);
    expect(calls).not.toContain(true);
  });
});

describe('bindControls — fullscreen shortcut', () => {
  test('"f" and "F11" call window.api.toggleFullscreen', () => {
    const settings = defaultSettings();
    const { fireDoc } = installDom({});
    let count = 0;
    const prevApi = global.window.api;
    global.window.api = { toggleFullscreen: () => count++ };

    bindControls(makeEl(), settings, noopCallbacks());
    fireDoc('keydown', { key: 'f', target: { tagName: 'BODY' } });
    fireDoc('keydown', { key: 'F11', target: { tagName: 'BODY' } });
    expect(count).toBe(2);

    global.window.api = prevApi;
  });

  test('shortcut without window.api does not throw', () => {
    const settings = defaultSettings();
    const { fireDoc } = installDom({});
    const prevApi = global.window.api;
    delete global.window.api;
    bindControls(makeEl(), settings, noopCallbacks());
    expect(() => fireDoc('keydown', { key: 'f', target: { tagName: 'BODY' } })).not.toThrow();
    global.window.api = prevApi;
  });
});
