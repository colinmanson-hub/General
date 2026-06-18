// Electron main-process tests. We mock the `electron` module so main.cjs can be
// required in a plain Node/jest environment, then exercise the IPC handlers it
// registers (save-png decode + file write, toggle-fullscreen).

const fs = require('fs');
const os = require('os');
const path = require('path');

// --- Shared mock state, captured by the electron mock factory ---------------
const handlers = new Map();
const appEvents = {};
let lastWindow = null;

const dialogMock = { showSaveDialog: jest.fn() };

class MockBrowserWindow {
  constructor(opts) {
    this.opts = opts;
    this._fullscreen = false;
    this.loadedFile = null;
    lastWindow = this;
  }
  loadFile(f) { this.loadedFile = f; }
  setFullScreen(v) { this._fullscreen = v; }
  isFullScreen() { return this._fullscreen; }
  static getAllWindows() { return lastWindow ? [lastWindow] : []; }
}

jest.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: (ev, cb) => { appEvents[ev] = cb; },
    quit: jest.fn(),
  },
  BrowserWindow: MockBrowserWindow,
  ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
  dialog: dialogMock,
  session: { defaultSession: { setDisplayMediaRequestHandler: jest.fn() } },
  desktopCapturer: { getSources: async () => [{ id: 'screen:0' }] },
}), { virtual: true });

// Require after the mock is registered. Wait a macrotask so the
// app.whenReady().then(createWindow) microtask chain has run.
beforeAll(async () => {
  require('../main.cjs');
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('main process — window bootstrap', () => {
  test('creates a window and loads index.html', () => {
    expect(lastWindow).not.toBeNull();
    expect(lastWindow.loadedFile).toBe('index.html');
  });

  test('registers save-png and toggle-fullscreen IPC handlers', () => {
    expect(handlers.has('save-png')).toBe(true);
    expect(handlers.has('toggle-fullscreen')).toBe(true);
  });
});

describe('main process — save-png handler', () => {
  // A 1x1 transparent PNG, base64.
  const PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
  const dataUrl = `data:image/png;base64,${PNG_B64}`;

  test('decodes the data URL and writes the PNG bytes to disk', async () => {
    const out = path.join(os.tmpdir(), `spiro-test-${Date.now()}.png`);
    dialogMock.showSaveDialog.mockResolvedValueOnce({ filePath: out, canceled: false });

    const res = await handlers.get('save-png')({}, dataUrl);

    expect(res).toEqual({ saved: true, path: out });
    expect(fs.existsSync(out)).toBe(true);
    const written = fs.readFileSync(out);
    expect(written.equals(Buffer.from(PNG_B64, 'base64'))).toBe(true);
    // PNG magic number sanity check.
    expect(written.subarray(0, 4).toString('hex')).toBe('89504e47');

    fs.unlinkSync(out);
  });

  test('returns { saved: false } and writes nothing when cancelled', async () => {
    dialogMock.showSaveDialog.mockResolvedValueOnce({ filePath: undefined, canceled: true });
    const res = await handlers.get('save-png')({}, dataUrl);
    expect(res).toEqual({ saved: false });
  });
});

describe('main process — toggle-fullscreen handler', () => {
  test('flips the window fullscreen state each call', async () => {
    const toggle = handlers.get('toggle-fullscreen');
    expect(lastWindow.isFullScreen()).toBe(false);
    await toggle();
    expect(lastWindow.isFullScreen()).toBe(true);
    await toggle();
    expect(lastWindow.isFullScreen()).toBe(false);
  });
});

describe('main process — lifecycle', () => {
  test('window-all-closed quits on non-darwin platforms', () => {
    const electron = require('electron');
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    electron.app.quit.mockClear();
    appEvents['window-all-closed']();
    expect(electron.app.quit).toHaveBeenCalled();
    Object.defineProperty(process, 'platform', { value: original, configurable: true });
  });
});
