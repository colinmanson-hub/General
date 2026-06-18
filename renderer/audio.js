// Issue #8: Audio engine — Web Audio analysis for per-frame features

export function createAudioEngine() {
  let ctx = null;
  let analyser = null;
  let source = null;
  let playing = false;
  let freqData = null;
  let timeData = null;

  // Beat detector state
  let energyHistory = [];
  const BEAT_WINDOW = 43; // ~1 second at 60fps
  const BEAT_THRESHOLD = 1.4;

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      // NOTE: the analyser is a passive tap — it does not need to be connected to
      // ctx.destination to analyse. Routing it to the speakers would echo captured
      // system/loopback audio back out, so only file playback opts into output.
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
    }
  }

  // toOutput: route the source to the speakers too (file playback). System/loopback
  // capture must NOT be routed to output or it feeds back into itself.
  function connectSource(newSource, { toOutput = false } = {}) {
    if (source) {
      try { source.disconnect(); } catch (_) {}
    }
    source = newSource;
    source.connect(analyser);
    if (toOutput) source.connect(ctx.destination);
  }

  return {
    async loadFile(file) {
      ensureContext();
      // Autoplay policy: resume suspended context (requires user gesture, which the file-picker click provides)
      await ctx.resume();
      const arrayBuffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
      // decodeAudioData detaches the buffer — use the decoded AudioBuffer, not the raw bytes
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.loop = true;
      connectSource(bufferSource, { toOutput: true });
      bufferSource.start(0);
      playing = true;
    },

    useSystemAudio(stream) {
      ensureContext();
      ctx.resume();
      const streamSource = ctx.createMediaStreamSource(stream);
      connectSource(streamSource);
      playing = true;
    },

    getFeatures() {
      if (!analyser) return { level: 0, bass: 0, mid: 0, treble: 0, beat: 0 };

      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      const binCount = freqData.length;
      const nyquist = ctx.sampleRate / 2;
      const binHz = nyquist / binCount;

      const bassEnd = Math.floor(250 / binHz);
      const midEnd = Math.floor(4000 / binHz);

      function avgBand(start, end) {
        let sum = 0;
        const count = end - start;
        for (let i = start; i < end; i++) sum += freqData[i];
        return count > 0 ? sum / count / 255 : 0;
      }

      const bass = avgBand(0, bassEnd);
      const mid = avgBand(bassEnd, midEnd);
      const treble = avgBand(midEnd, binCount);

      let rms = 0;
      for (let i = 0; i < timeData.length; i++) {
        const s = (timeData[i] - 128) / 128;
        rms += s * s;
      }
      const level = Math.min(1, Math.sqrt(rms / timeData.length) * 4);

      energyHistory.push(bass);
      if (energyHistory.length > BEAT_WINDOW) energyHistory.shift();
      const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
      const beat = bass > avgEnergy * BEAT_THRESHOLD && bass > 0.15 ? 1 : 0;

      return { level, bass, mid, treble, beat };
    },

    stop() {
      if (source) {
        try { source.stop(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
        source = null;
      }
      playing = false;
    },

    isPlaying() { return playing; },
  };
}
