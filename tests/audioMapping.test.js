import { computeAudioModulation } from '../renderer/audioMapping.js';

function baseSettings(overrides = {}) {
  return {
    draw: { speed: 30, lineWidth: 1.5 },
    color: { cycleSpeed: 1 },
    audio: {
      mappings: {
        level: { enabled: true, sensitivity: 1 },
        bass: { enabled: true, sensitivity: 1 },
        spectrum: { enabled: true, sensitivity: 1 },
        beat: { enabled: true, sensitivity: 1 },
      },
    },
    ...overrides,
  };
}

const silence = { level: 0, bass: 0, mid: 0, treble: 0, beat: 0 };

describe('computeAudioModulation', () => {
  test('silence returns the base (unmodulated) values', () => {
    const s = baseSettings();
    const mod = computeAudioModulation(s, silence);
    expect(mod.lineWidth).toBeCloseTo(1.5);
    expect(mod.penScale).toBeCloseTo(1);
    expect(mod.speed).toBeCloseTo(30);
    expect(mod.cycleSpeed).toBeCloseTo(1);
  });

  test('level increases line width', () => {
    const s = baseSettings();
    const mod = computeAudioModulation(s, { ...silence, level: 1 });
    expect(mod.lineWidth).toBeGreaterThan(1.5);
    // 1.5 * (1 + 1*1*3) = 6
    expect(mod.lineWidth).toBeCloseTo(6);
  });

  test('bass increases pen scale above 1', () => {
    const s = baseSettings();
    const mod = computeAudioModulation(s, { ...silence, bass: 1 });
    // 1 + 1*1*0.8
    expect(mod.penScale).toBeCloseTo(1.8);
  });

  test('beat onset adds a speed kick', () => {
    const s = baseSettings();
    const noBeat = computeAudioModulation(s, { ...silence, beat: 0 });
    const beat = computeAudioModulation(s, { ...silence, beat: 1 });
    expect(noBeat.speed).toBeCloseTo(30);
    expect(beat.speed).toBeCloseTo(90); // 30 + 1*60
  });

  test('treble-dominant spectrum raises cycleSpeed; bass-dominant lowers it', () => {
    const s = baseSettings();
    const bright = computeAudioModulation(s, { ...silence, treble: 1, bass: 0 });
    const dark = computeAudioModulation(s, { ...silence, treble: 0, bass: 1 });
    expect(bright.cycleSpeed).toBeGreaterThan(1);
    expect(dark.cycleSpeed).toBeLessThan(1);
  });

  test('sensitivity scales the effect', () => {
    const low = computeAudioModulation(baseSettings(), { ...silence, level: 0.5 });
    const hi = baseSettings();
    hi.audio.mappings.level.sensitivity = 4;
    const high = computeAudioModulation(hi, { ...silence, level: 0.5 });
    expect(high.lineWidth).toBeGreaterThan(low.lineWidth);
  });

  describe('disabled mappings fall back to base values', () => {
    test('level disabled => base line width', () => {
      const s = baseSettings();
      s.audio.mappings.level.enabled = false;
      const mod = computeAudioModulation(s, { ...silence, level: 1 });
      expect(mod.lineWidth).toBeCloseTo(1.5);
    });

    test('bass disabled => penScale stays 1', () => {
      const s = baseSettings();
      s.audio.mappings.bass.enabled = false;
      const mod = computeAudioModulation(s, { ...silence, bass: 1 });
      expect(mod.penScale).toBe(1);
    });

    test('spectrum disabled => base cycleSpeed', () => {
      const s = baseSettings();
      s.audio.mappings.spectrum.enabled = false;
      const mod = computeAudioModulation(s, { ...silence, treble: 1 });
      expect(mod.cycleSpeed).toBeCloseTo(1);
    });

    test('beat disabled => no speed kick', () => {
      const s = baseSettings();
      s.audio.mappings.beat.enabled = false;
      const mod = computeAudioModulation(s, { ...silence, beat: 1 });
      expect(mod.speed).toBeCloseTo(30);
    });
  });

  describe('combined / simultaneous features', () => {
    test('a full-energy bass-heavy beat moves every channel at once', () => {
      const s = baseSettings();
      const mod = computeAudioModulation(s, {
        level: 0.8, bass: 1, mid: 0.5, treble: 0.1, beat: 1,
      });
      expect(mod.lineWidth).toBeGreaterThan(1.5); // level
      expect(mod.penScale).toBeGreaterThan(1);    // bass
      expect(mod.speed).toBeGreaterThan(30);      // beat kick
      expect(mod.cycleSpeed).toBeLessThan(1);     // bass-dominant spectrum
    });

    test('output is always finite for arbitrary feature values', () => {
      const s = baseSettings();
      for (const v of [0, 0.25, 0.5, 1]) {
        const mod = computeAudioModulation(s, { level: v, bass: v, mid: v, treble: 1 - v, beat: v > 0.5 ? 1 : 0 });
        for (const k of ['lineWidth', 'penScale', 'speed', 'cycleSpeed']) {
          expect(Number.isFinite(mod[k])).toBe(true);
        }
      }
    });

    test('penScale stays >= 1 (offset never collapses inward)', () => {
      const s = baseSettings();
      for (const bass of [0, 0.3, 0.7, 1]) {
        expect(computeAudioModulation(s, { ...silence, bass }).penScale).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
