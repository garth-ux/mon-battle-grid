# 🚀 Quick Start Guide - 3D Space Cowboy Game

## Installation & Setup

### 1. Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

This will install:
- React & React DOM
- Three.js
- @react-three/fiber (React renderer for Three.js)
- @react-three/drei (helpful Three.js components)
- Vite (build tool)
- Tailwind CSS (styling)

### 2. Run Development Server

```bash
# Using pnpm
pnpm dev

# Or using npm
npm run dev
```

The game will be available at `http://localhost:5173`

### 3. Build for Production

```bash
# Using pnpm
pnpm build

# Or using npm
npm run build
```

## What Changed from 2D to 3D?

### File Changes:
- ✅ `App3D.tsx` - NEW 3D version using Three.js
- ✅ `App.tsx` - Original 2D version (preserved)
- ✅ `main.tsx` - Updated to use App3D
- ✅ `package.json` - Added Three.js dependencies

### Visual Changes:
- 🎨 True 3D rendering with depth
- 💡 Dynamic lighting and shadows
- 🔄 Rotatable camera (drag to rotate)
- 🔍 Zoom controls (scroll wheel)
- ✨ Glowing effects on projectiles and abilities
- 🌈 Better visual feedback for game states

### Game Mechanics:
- ✅ **100% identical** to original
- ✅ All 4 characters work the same
- ✅ All abilities function identically
- ✅ Same controls (arrow keys, space, 1, 2)
- ✅ Same mana/card system

## Camera Controls (NEW!)

- **Mouse Drag**: Rotate camera around the battlefield
- **Scroll**: Zoom in/out
- **Pan**: Disabled (fixed on game arena)

## Switching Back to 2D

Edit `main.tsx`:

```typescript
// Change:
import App3D from "./App3D.tsx";

// To:
import App from "./App.tsx";

// And in the render:
<App />  // instead of <App3D />
```

## Troubleshooting

### "Module not found" errors?
Run `pnpm install` or `npm install` first!

### Game runs slowly?
- Close other browser tabs
- Disable shadows in App3D.tsx (remove `shadows` prop from Canvas)
- Reduce the number of effects

### Camera feels weird?
Adjust these values in App3D.tsx:
```typescript
camera={{
  position: [8, 12, 12],  // Change these numbers
  fov: 50,                // Field of view
}}
```

## Project Structure

```
/
├── src/
│   ├── App.tsx         # Original 2D version
│   ├── App3D.tsx       # New 3D version ⭐
│   ├── main.tsx        # Entry point
│   └── index.css       # Styles
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## Need Help?

Check out the detailed README_3D.md for:
- Full technical documentation
- Architecture explanation
- Character abilities guide
- Three.js concepts used
- Performance optimization tips

---

**Have fun playing in 3D! 🎮🌟**
