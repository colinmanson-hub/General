// Global browser-API stubs for Node.js test environment

// ---- Web Audio ----
class MockAnalyserNode {
  constructor() {
    this.fftSize = 2048;
    this.smoothingTimeConstant = 0.8;
    this.frequencyBinCount = 1024;
    this._freqFill = 128;
  }
  connect() {}
  disconnect() {}
  getByteFrequencyData(arr) { arr.fill(this._freqFill); }
  getByteTimeDomainData(arr) { arr.fill(128); }
}

class MockBufferSource {
  constructor(buffer) { this.buffer = buffer; this.loop = false; }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class MockStreamSource {
  connect() {}
  disconnect() {}
}

global.AudioContext = class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.destination = {};
    this._analyser = new MockAnalyserNode();
  }
  createAnalyser() { return this._analyser; }
  createBufferSource() { return new MockBufferSource(null); }
  createMediaStreamSource() { return new MockStreamSource(); }
  async decodeAudioData() {
    return { duration: 2.0, numberOfChannels: 2, sampleRate: 44100 };
  }
  async resume() { this.state = 'running'; }
};

// ---- Canvas ----
function makeMockContext2d() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    scale: () => {},
  };
}

global.makeMockCanvas = (w = 800, h = 600) => ({
  getContext: () => makeMockContext2d(),
  toDataURL: () => 'data:image/png;base64,abc',
  clientWidth: w,
  clientHeight: h,
  width: w,
  height: h,
});

// ---- rAF / cAF ----
// Exposed as global so tests can advance frames manually
global._rafQueue = [];
global.requestAnimationFrame = (cb) => { global._rafQueue.push(cb); return global._rafQueue.length; };
global.cancelAnimationFrame = () => {};
global.tickFrame = () => {
  const q = global._rafQueue.splice(0);
  q.forEach(cb => cb(performance.now()));
};

// ---- window ----
global.window = {
  devicePixelRatio: 1,
  requestAnimationFrame: global.requestAnimationFrame,
};
