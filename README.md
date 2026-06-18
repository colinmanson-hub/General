# Spirograph Studio

Electron desktop app for animated spirograph-style geometric designs with an audio-reactive visualizer.

## Requirements

- [Node.js](https://nodejs.org/) v18+
- Windows (for system audio capture and packaging)

## Install

```
npm install
```

## Run (dev)

```
npm start
```

Opens a 1280×800 window. Press **F** or **F11** to toggle fullscreen.  
Press **H** to hide/show the control panel.

## Build Windows installer

```
npm run dist
```

Produces a Windows NSIS installer under `dist/`.

## Features

- **Shapes**: Circle, Rectangle, Polygon (N sides), Star (N points)
- **Rolling**: Wheel rolls inside or outside the base shape (generalized roulette math)
- **Color**: Fixed color or hue-cycling along the drawn path
- **Audio visualizer**: Load an audio file or capture system/loopback audio (Windows) — maps level, bass, spectrum, and beat onset to line width, pen offset, hue, and draw speed
- **Save PNG**: Exports the current design via a native save dialog
- **Randomize**: Picks pleasing random parameters with coprime-ish wheel ratios for circles

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| H | Toggle control panel |
| F / F11 | Toggle fullscreen |
