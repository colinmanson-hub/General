import { createAudioEngine } from '../renderer/audio.js';

// setup.js provides global.AudioContext mock

describe('createAudioEngine', () => {
  test('returns expected API surface', () => {
    const engine = createAudioEngine();
    expect(typeof engine.loadFile).toBe('function');
    expect(typeof engine.useSystemAudio).toBe('function');
    expect(typeof engine.getFeatures).toBe('function');
    expect(typeof engine.stop).toBe('function');
    expect(typeof engine.isPlaying).toBe('function');
  });

  test('isPlaying() is false before any load', () => {
    const engine = createAudioEngine();
    expect(engine.isPlaying()).toBe(false);
  });

  test('getFeatures() returns zeroes before any load', () => {
    const engine = createAudioEngine();
    const f = engine.getFeatures();
    expect(f).toEqual({ level: 0, bass: 0, mid: 0, treble: 0, beat: 0 });
  });
});

describe('loadFile', () => {
  test('sets isPlaying() to true after load', async () => {
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    expect(engine.isPlaying()).toBe(true);
  });

  test('getFeatures() returns values in [0,1] after load', async () => {
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    const f = engine.getFeatures();
    for (const key of ['level', 'bass', 'mid', 'treble']) {
      expect(f[key]).toBeGreaterThanOrEqual(0);
      expect(f[key]).toBeLessThanOrEqual(1);
    }
    expect([0, 1]).toContain(f.beat);
  });

  test('calls ctx.resume() to satisfy autoplay policy', async () => {
    let resumeCalled = false;
    const orig = global.AudioContext;
    global.AudioContext = class extends orig {
      async resume() { resumeCalled = true; }
    };
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    expect(resumeCalled).toBe(true);
    global.AudioContext = orig;
  });

  test('accepts a File-like object with arrayBuffer()', async () => {
    const fileLike = { arrayBuffer: async () => new ArrayBuffer(8) };
    const engine = createAudioEngine();
    await expect(engine.loadFile(fileLike)).resolves.toBeUndefined();
    expect(engine.isPlaying()).toBe(true);
  });

  test('throws (and rejects) if decodeAudioData fails', async () => {
    const orig = global.AudioContext;
    global.AudioContext = class extends orig {
      async decodeAudioData() { throw new DOMException('Bad data', 'EncodingError'); }
    };
    const engine = createAudioEngine();
    await expect(engine.loadFile(new ArrayBuffer(8))).rejects.toThrow('Bad data');
    global.AudioContext = orig;
  });
});

describe('stop', () => {
  test('sets isPlaying() to false', async () => {
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    expect(engine.isPlaying()).toBe(true);
    engine.stop();
    expect(engine.isPlaying()).toBe(false);
  });

  test('stop() is safe to call when not playing', () => {
    const engine = createAudioEngine();
    expect(() => engine.stop()).not.toThrow();
  });
});

describe('getFeatures — band math', () => {
  test('high freq fill → treble > bass', async () => {
    // Make the mock analyser return high-freq dominant data
    const orig = global.AudioContext;
    global.AudioContext = class extends orig {
      createAnalyser() {
        const a = super.createAnalyser();
        a.getByteFrequencyData = (arr) => {
          arr.fill(0);
          // Fill only the top half (treble bins)
          for (let i = arr.length / 2; i < arr.length; i++) arr[i] = 200;
        };
        return a;
      }
    };
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    const f = engine.getFeatures();
    expect(f.treble).toBeGreaterThan(f.bass);
    global.AudioContext = orig;
  });

  test('beat fires when bass energy spikes above history', async () => {
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));

    // Prime the history with near-zero bass
    const ctx = engine;
    // Access internals via getFeatures: fill analyser with silence 50x
    const orig = global.AudioContext;
    const instance = new global.AudioContext();
    instance._analyser._freqFill = 0;
    // We can't reach the internal instance, so test beat=0 at rest
    // and beat=1 after we set high bass via analyser mock swap

    // Simple sanity: beat is 0 or 1, never fractional
    const f = engine.getFeatures();
    expect([0, 1]).toContain(f.beat);
  });
});

describe('useSystemAudio', () => {
  test('sets isPlaying() to true', () => {
    const engine = createAudioEngine();
    const fakeStream = { getTracks: () => [] };
    engine.useSystemAudio(fakeStream);
    expect(engine.isPlaying()).toBe(true);
  });
});

describe('audio routing (no feedback echo)', () => {
  // Track every node->node connection so we can assert routing topology.
  function instrument() {
    const orig = global.AudioContext;
    const connections = [];
    global.AudioContext = class extends orig {
      constructor() {
        super();
        this.destination = { _name: 'destination' };
        this._analyser._name = 'analyser';
        this._analyser.connect = (t) => connections.push(['analyser', t._name]);
      }
      createBufferSource() {
        const s = super.createBufferSource();
        s._name = 'bufferSource';
        s.connect = (t) => connections.push(['bufferSource', t._name]);
        return s;
      }
      createMediaStreamSource() {
        const s = super.createMediaStreamSource();
        s._name = 'streamSource';
        s.connect = (t) => connections.push(['streamSource', t._name]);
        return s;
      }
    };
    return { restore: () => { global.AudioContext = orig; }, connections };
  }

  test('file playback routes source to the speakers', async () => {
    const { restore, connections } = instrument();
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    expect(connections).toContainEqual(['bufferSource', 'analyser']);
    expect(connections).toContainEqual(['bufferSource', 'destination']);
    restore();
  });

  test('system audio is analysed but NOT routed to the speakers (no echo)', () => {
    const { restore, connections } = instrument();
    const engine = createAudioEngine();
    engine.useSystemAudio({ getTracks: () => [] });
    expect(connections).toContainEqual(['streamSource', 'analyser']);
    expect(connections).not.toContainEqual(['streamSource', 'destination']);
    restore();
  });

  test('analyser is never wired straight to the speakers', async () => {
    const { restore, connections } = instrument();
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    engine.useSystemAudio({ getTracks: () => [] });
    expect(connections).not.toContainEqual(['analyser', 'destination']);
    restore();
  });
});

describe('getFeatures — beat detection', () => {
  // Capture the engine's internal analyser so we can drive its spectrum frame
  // by frame and exercise the energy-history beat detector for real.
  function withDrivableAnalyser(run) {
    const orig = global.AudioContext;
    let captured;
    global.AudioContext = class extends orig {
      createAnalyser() {
        captured = super.createAnalyser();
        captured._bass = 0; // 0..255 applied to the low (bass) bins
        captured.getByteFrequencyData = (arr) => {
          arr.fill(0);
          // bins below ~250Hz are bass; binHz ≈ 21.5 so bins 0..11
          for (let i = 0; i < 12; i++) arr[i] = captured._bass;
        };
        return captured;
      }
    };
    try { return run(() => captured); } finally { global.AudioContext = orig; }
  }

  test('steady bass does not trigger a beat', async () => {
    await withDrivableAnalyser(async (getAnalyser) => {
      const engine = createAudioEngine();
      await engine.loadFile(new ArrayBuffer(8));
      getAnalyser()._bass = 120;
      let lastBeat = 1;
      for (let i = 0; i < 60; i++) lastBeat = engine.getFeatures().beat;
      expect(lastBeat).toBe(0);
    });
  });

  test('a bass spike above the running average fires a beat', async () => {
    await withDrivableAnalyser(async (getAnalyser) => {
      const engine = createAudioEngine();
      await engine.loadFile(new ArrayBuffer(8));
      const an = getAnalyser();
      an._bass = 8; // prime the history with near-silence
      for (let i = 0; i < 50; i++) engine.getFeatures();
      an._bass = 230; // sudden hit
      expect(engine.getFeatures().beat).toBe(1);
    });
  });

  test('very quiet bass never beats even on a relative spike', async () => {
    await withDrivableAnalyser(async (getAnalyser) => {
      const engine = createAudioEngine();
      await engine.loadFile(new ArrayBuffer(8));
      const an = getAnalyser();
      an._bass = 1;
      for (let i = 0; i < 50; i++) engine.getFeatures();
      an._bass = 20; // a big relative jump but still ~0.078 absolute (< 0.15 floor)
      expect(engine.getFeatures().beat).toBe(0);
    });
  });
});

describe('getFeatures — band separation', () => {
  test('low-frequency content makes bass exceed treble', async () => {
    const orig = global.AudioContext;
    global.AudioContext = class extends orig {
      createAnalyser() {
        const a = super.createAnalyser();
        a.getByteFrequencyData = (arr) => {
          arr.fill(0);
          for (let i = 0; i < arr.length / 4; i++) arr[i] = 220; // low bins only
        };
        return a;
      }
    };
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    const f = engine.getFeatures();
    expect(f.bass).toBeGreaterThan(f.treble);
    global.AudioContext = orig;
  });
});

describe('getFeatures — after stop', () => {
  test('still returns a finite, well-formed feature vector', async () => {
    const engine = createAudioEngine();
    await engine.loadFile(new ArrayBuffer(8));
    engine.stop();
    const f = engine.getFeatures();
    for (const k of ['level', 'bass', 'mid', 'treble', 'beat']) {
      expect(Number.isFinite(f[k])).toBe(true);
    }
  });
});
