const { app, BrowserWindow, ipcMain, dialog, session, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  // Allow loopback/system audio capture via desktopCapturer
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Save PNG via native save dialog
ipcMain.handle('save-png', async (e, dataUrl) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: 'spirograph.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { saved: false };
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return { saved: true, path: filePath };
});

// Toggle fullscreen via IPC
ipcMain.handle('toggle-fullscreen', () => {
  win.setFullScreen(!win.isFullScreen());
});
