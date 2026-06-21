# Spirograph Studio

Electron desktop app for animated spirograph-style geometric designs.

## Requirements

- [Node.js](https://nodejs.org/) v18+
- Windows (for packaging)

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
- **Closure**: Each design draws until the pen returns exactly to its starting point
- **Color**: Fixed color or hue-cycling along the drawn path
- **Manual / Auto modes**: Manual draws one design; Auto continuously generates pleasing random designs (10–30s each), cross-fading between them
- **Save PNG**: Exports the current design via a native save dialog
- **Randomize**: Picks pleasing random parameters with wheel ratios that close cleanly

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| H | Toggle control panel |
| F / F11 | Toggle fullscreen |
