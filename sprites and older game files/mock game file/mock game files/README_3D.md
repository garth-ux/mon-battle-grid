# Space Cowboy Game - 3D Isometric Edition

## 🎮 Overview

This is a **professional 3D conversion** of the original 2D isometric Space Cowboy Game using **Three.js and React Three Fiber**. The game maintains the same isometric camera perspective while adding true 3D depth, lighting, shadows, and visual effects.

## 🆕 What's New in 3D

### Visual Enhancements
- ✨ **True 3D Graphics**: All game elements are now rendered as 3D objects with depth and volume
- 💡 **Dynamic Lighting**: Ambient, directional, and point lights create atmospheric depth
- 🌑 **Real-time Shadows**: Characters and objects cast realistic shadows
- 🎨 **Emissive Effects**: Glowing projectiles, explosions, and power-ups
- 🔄 **Interactive Camera**: Rotate view with mouse drag, zoom with scroll wheel

### 3D Game Elements
- **Characters**: 3D spheres with emoji labels and status indicators
- **Projectiles**: 3D cone-shaped bullets with color-coded types
- **Tiles**: Raised 3D platforms with proper height and perspective
- **Effects**: Volumetric explosions, beams, and special abilities
- **Blocks**: Solid 3D cubes with health-based coloring
- **Bombs**: Spherical 3D objects with countdown timers

### Preserved Mechanics
All original game mechanics are **100% intact**:
- 4 unique characters (Cowboy, Hogglin, Rat King, Malipole)
- Character-specific abilities and moves
- Mana system with card-based moves
- Charging mechanics for Rat King and Malipole
- Frenzy mode for Malipole
- All special attacks and projectiles
- Block building, traps, and environmental hazards

## 🚀 Getting Started

### Installation

1. **Install dependencies**:
   ```bash
   pnpm install
   # or
   npm install
   ```

2. **Run the development server**:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

3. **Open your browser** to `http://localhost:5173`

### New Dependencies

The 3D version adds these libraries:
- `@react-three/fiber` - React renderer for Three.js
- `@react-three/drei` - Useful helpers and abstractions
- `three` - 3D graphics library

## 🎯 Controls

### Movement
- **Arrow Keys**: Move your character up/down/left/right
- **Space Bar**: 
  - Cowboy/Hogglin: Fire/Place blocks
  - Rat King/Malipole: Hold to charge, release to fire

### Abilities
- **1 Key**: Use first card in hand
- **2 Key**: Use second card in hand

### Camera (NEW in 3D!)
- **Mouse Drag**: Rotate the camera around the battlefield
- **Scroll Wheel**: Zoom in/out
- **Camera auto-positioned** at optimal isometric angle

## 🎨 Technical Implementation

### Architecture

```
App3D.tsx (Main Component)
├── GameScene3D (3D Scene Container)
│   ├── Tile3D (Ground tiles)
│   ├── Character3D (Player & opponent)
│   ├── Projectile3D (Bullets & projectiles)
│   ├── Effect3D (Explosions & abilities)
│   ├── Block3D (Defensive blocks)
│   ├── Beam3D (Laser beams)
│   └── Various 3D effects
└── UI Components (Stats, controls, etc.)
```

### Camera Setup

The game uses a **perspective camera** positioned to simulate isometric view:
- Position: `[8, 12, 12]` - Elevated and angled
- FOV: `50°` - Balanced field of view
- OrbitControls enabled for user interaction

### Lighting System

Three-point lighting setup:
1. **Ambient Light**: Base illumination (intensity: 0.5)
2. **Directional Light**: Main light with shadows (intensity: 1.0)
3. **Point Light**: Additional accent lighting (intensity: 0.5)

### 3D Object Types

| Element | 3D Shape | Special Features |
|---------|----------|------------------|
| Characters | Sphere | Emissive glow for status |
| Projectiles | Cone | Color-coded by type |
| Tiles | Box (flat) | Color by team, highlight on hover |
| Effects | Sphere | Transparent, pulsing |
| Blocks | Cube | Health-based coloring |
| Beams | Box (long) | Emissive, semi-transparent |

## 📁 File Structure

```
/src
  ├── App.tsx          # Original 2D version (preserved)
  ├── App3D.tsx        # New 3D version ⭐
  ├── main.tsx         # Entry point (now uses App3D)
  └── index.css        # Styles
```

## 🔄 Switching Between 2D and 3D

To use the **original 2D version**, edit `main.tsx`:

```typescript
// Change this:
import App3D from "./App3D.tsx";

// To this:
import App from "./App.tsx";

// And change the component:
<App3D /> → <App />
```

## 🎓 Learning Points

### Professional Game Dev Practices Applied

1. **Separation of Concerns**: Game logic separate from rendering
2. **Component Architecture**: Reusable 3D components
3. **Performance**: Efficient React Three Fiber usage
4. **Maintainability**: All original mechanics preserved
5. **User Experience**: Interactive camera, smooth animations

### Three.js Concepts Used

- **Geometries**: Sphere, Box, Cone, Cylinder
- **Materials**: StandardMaterial with PBR lighting
- **Lights**: Ambient, Directional, Point
- **Shadows**: Real-time shadow mapping
- **Camera Controls**: OrbitControls for user interaction

## 🐛 Troubleshooting

### Performance Issues
- Reduce shadow quality in GameScene3D
- Lower the number of particle effects
- Disable anti-aliasing in Canvas props

### Camera Issues
- Reset camera by refreshing the page
- Adjust `maxPolarAngle` in OrbitControls for different viewing angles
- Modify camera position for different perspectives

## 🎮 Characters & Abilities

### Cowboy 🤠
- **Slash** (1 mana): Close range attack
- **Beam** (3 mana): Laser beam
- **Punch** (1 mana): Direct hit
- **Bomb** (4 mana): Explosive damage
- **Tractor Beam** (3 mana): Pull enemies
- **Delay Bomb** (5 mana): Timed explosive
- **Boomerang** (3 mana): Returns to hand
- **Lasso** (2 mana): Pull and stun

### Hogglin 🦔
- **Leafstorm** (5 mana): Row-wide damage
- **Flying Sword** (3 mana): Homing projectile
- **Wall** (4 mana): Defensive barrier
- **Clawing Sword** (2 mana): Swift attack

### Rat King 🐀
- **Rat Pack** (1 mana): Quick swarm
- **Trash Toss** (2 mana): Debris projectile
- **Street Swarm** (5 mana): Multiple rats
- **Special**: Hold space to charge random rat shots

### Malipole 🐸
- **Tongue Whip** (2 mana): Stun attack
- **Random Hop** (3 mana): Teleport enemy
- **Frog Chorus** (4 mana): Frenzy mode
- **Lily Pad Trap** (3 mana): Hidden traps
- **Special**: Hold space to charge power shots (builds to frenzy)

## 📚 Additional Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [Drei Helpers](https://github.com/pmndrs/drei)

## 🎉 Enjoy the Game!

Experience the Space Cowboy Game in full 3D glory with true depth, lighting, and interactive camera controls while maintaining all the tactical gameplay you love!

---

**Built with**: React + Vite + TypeScript + Three.js + React Three Fiber + Tailwind CSS
