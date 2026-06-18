// Issue #10: Pure audio -> visual mapping.
// Kept side-effect free so it can be unit tested without a DOM/canvas/audio graph.
//
// Given the current settings and a per-frame audio feature vector
// ({ level, bass, mid, treble, beat }), returns the style overrides to apply
// for this frame. Disabled mappings fall back to the base (unmodulated) value.

export function computeAudioModulation(settings, f) {
  const m = settings.audio.mappings;

  // Level -> line width: louder => thicker strokes.
  const lineWidth = m.level.enabled
    ? settings.draw.lineWidth * (1 + f.level * m.level.sensitivity * 3)
    : settings.draw.lineWidth;

  // Bass -> pen offset: heavier bass pushes the pen further out (multiplier on d).
  const penScale = m.bass.enabled
    ? 1 + f.bass * m.bass.sensitivity * 0.8
    : 1;

  // Spectrum balance -> hue cycling speed (treble-heavy spins hue forward).
  const hueShift = m.spectrum.enabled
    ? (f.treble - f.bass) * 180 * m.spectrum.sensitivity
    : 0;

  // Beat onset -> a transient kick to the draw speed.
  const beatKick = m.beat.enabled && f.beat ? m.beat.sensitivity * 60 : 0;

  return {
    lineWidth,
    penScale,
    speed: settings.draw.speed + beatKick,
    cycleSpeed: settings.color.cycleSpeed + hueShift * 0.1,
  };
}
