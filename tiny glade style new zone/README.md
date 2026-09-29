# Tiny Glade style zone

Cosy autumn meadow: pond, stone aqueduct bridge, little castle with a Roman arch gateway, paddling ducks.
`reference.jpg` is the target image.

## Open it in Godot (4.4+)
1. Godot Project Manager → **Import** → pick `tiny glade style new zone/project.godot`.
2. Press **F5** (or F6 with `tiny_glade/tiny_glade_zone.tscn` open).

**Controls:** WASD / arrow keys (screen-relative, same as the main overworld). Walk into the pond to wade and leave ripples; cobbled ramps at both ends of the bridge let you walk across it (an invisible `WalkCollision` slab from Blender keeps the footing smooth).

The first import takes a minute. Grass and flowers are placed when the scene runs, so the editor view looks bare until you press play.

## Drop it into the main game
Copy the `tiny_glade/` folder into the root of `godot game files/monster-battle-grid/`. All paths are `res://tiny_glade/...`.
For the same look, copy the `[rendering]` block from this `project.godot` (8k shadows, bokeh quality, MSAA).

## Regenerate / edit in Blender
```
cd blender
/Applications/Blender.app/Contents/MacOS/Blender -b -P build_tiny_glade.py            # rebuild .blend + .glb
/Applications/Blender.app/Contents/MacOS/Blender -b -P build_tiny_glade.py -- render  # + still render
```
The layout (tree list, pond, bridge, castle, camera, sun) is at the top of the script. Godot picks it up from `tiny_glade/models/tiny_glade_geo.glb`.
Bridge, castle and roofs go through `soften()` (voxel remesh + two octaves of noise displacement) for the hand-built wobbly silhouettes; tune `amp` / `scale` per call.
`blender/tiny_glade.blend` opens directly in Blender (EEVEE, 240-frame animated camera, ducks).

## What's where
| File | Role |
|---|---|
| `tiny_glade/scripts/zone.gd` | Material swap, collision, player spawn + follow camera, grass/flower scatter, duck + player water ripples, pollen + falling leaves |
| `tiny_glade/glade_player.tscn` / `scripts/glade_player.gd` | The main game's player sprite as a physics CharacterBody3D: walks the terrain, blocked by walls/trunks/rocks, wades up to `max_wade_depth` |
| `shaders/tg_common.gdshaderinc` | Wrapped soft light, back-lit translucency, drifting cloud shadows, meadow palette |
| `shaders/foliage.gdshader` | Billboard leaf cards with spherical normals + wind |
| `shaders/water.gdshader` | Depth-tinted opaque water (gets SSR reflections), ripples, duck wake rings |
| `shaders/terrain / grass / stone / roof` | Ground, lightweight 25-vertex grass clumps, watercolour-style triplanar masonry with per-stone pillow bump, shingles |
| `tiny_glade_zone.tscn` | Environment (AgX, SSR, SSAO/SSIL, volumetric fog, glow), sun, tilt-shift DOF camera |

Exports on the root node: `player_enabled` (off = the original cinematic fly-by), `player_spawn`, `camera_distance_scale`, `camera_follow_speed`, `grass_density`, `flower_density`, `grass_view_distance`, `camera_drift`, `drift_amount`. The player's walkable area is `bounds` on the player scene.

Test run without a keyboard: `Godot --path . -- --capture=shot.png --walk-test` walks into the pond and saves a screenshot.
