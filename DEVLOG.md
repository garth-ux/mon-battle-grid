# mon-battle-grid — Dev Log

Working copy: `src/App3D.tsx` (single-file React prototype, runs on CodeSandbox — no local installs).
Design source of truth: `mons.xlsx` (project root). Long-term goal: Godot HD-2D port (overworld first, battle system + monsters intact).

---

## 2026-06-11 — Overworld professionalization + starter rework

- **Protagonist character**: pixel-art trainer sprite system (`pixelSprite()` builds crisp SVGs from letter-grids). Directional facing (down/up/side + flip), 2-frame walk keyed off step count. Player no longer represented by their monster on the overworld.
- **Camera**: `OW_TILE` 40→56, `ISO_SCALE` 0.82→0.95, `ISO_ANGLE` 55°→50°. Map now larger than the 960×720 camera window, so the camera genuinely scrolls and follows the player.
- **Starter selection**: title screen shows the full roster; you start with ONLY your chosen monster (`caughtMonsters` is the roster — base characters are no longer free). Catch flow fixed for multi-word names ("Rat king" ≠ "Rat King" bug).
- **Polish**: pixel-sprite Sage + Rival NPCs (replacing emoji), tall-grass sway (replaced blinking `!`), screen-space glass zone badge, drifting cloud shadows, walking protagonist drop shadow.

## 2026-06-12 — Balance pass, liquid glass, biome, +6 monsters

- **Move review**: principle = same name, same effect, same cost. Fixed undercosted moves (punch/mud slap/shield bash 1→2 mana, Scimark slash 0→1), standardized wall/barrier to 3 mana, nerfed scavenge +3→+2, fixed Mushroom/Statinu "bomb" descriptions that lied about the shared implementation, renamed "novice casts" → "hex tiles", frog chorus description no longer claims stacking.
- **Liquid glass**: loadout cards, mana chips, upgrade panels/buttons/pips, XP banner, trainer dialog cards and buttons — all moved from hard borders + offset shadows to translucent blur + rounded + soft shadows.
- **3D map elements**: billboarded pixel-art houses (grassland), houses placed across all maps, walkability blocked.
- **New monsters** (sprites from `new mons.zip`, embedded as base64 PNGs):
  Toadazer (electric), Icage (ice), Cargot (earth), Kingfencer (light), Atomippo (mind), Modizard (water — sheet row 41 salamander punk). Each: 5 signature moves + 3 existing.
  - `MOVE_ALIASES` maps signature move names → shared effect implementations, applied in BOTH `useMove` and `enemyUseCard`, so themed cards work for player and AI without duplicating ~60 effect handlers.
- **Azure Shores water biome**: `WATER_MAP` archipelago east of grassland (right-edge transition; west-edge land rows align with grassland's walkable east edge). Water-only wild/trainer pools = the 6 new monsters. Zone-specific tint/fog/badge. Desert wilds also now pull desert-only species.

## 2026-06-13 — Types, traits, ammo, dex (from mons.xlsx) + bug fixes

- **Type wheel** (12 types, each deals 1.1× to the NEXT, 1× otherwise):
  `fire → grass → earth → electric → wind → fighting → mind → dark → light → time → ice → water → fire`
  - `MONSTER_TYPES` from the sheet; `CARD_TYPES` for every move (colored pills on loadout/hand/dex).
  - Damage scaling implemented by wrapping the HP state setters (`setPlayerHP`/`setOpponentHP`/`setOpponent2HP`) — every bullet, card, and DoT flows through them, so type/trait/Guarded multipliers apply globally with no per-call-site edits.
- **Passive traits**: 3 per monster (sheet columns I/J/K = trait1/trait2/secret), rolled **40/40/20** when a monster joins the team (`rollTrait()` in `handleCatchMonster`), permanent per monster, shown in overworld header + battle panel + dex.
  - All 54 traits have real effects via `TraitEffect` hooks: dmg dealt/taken mults, Guarded-on-card-type, card-type damage mults/heals, combo heals, block-break hooks (heal / spawn rat), boomerang-catch heal, stun-heal, poison immunity/absorb, stun immunity, revive-once, wall durability, zone-steal duration, guard-turret modifiers, wide-slash follow-ups, echo cards.
  - Sheet traits referencing unbuilt systems (money, holy tiles, slippery) mapped to nearest real effect with honest descriptions — upgrade candidates for the Godot port.
- **Signature basics**: Toadazer — every 3 basic hits = CHARGED, next electric card 1.6× (panel indicator); Modizard — basic calls guard turrets (max 2) at the rear of his field; Scimark — every 3rd hit wide slice; Pixie — basic crits 15%/2×; Hogglin — wall-builder basic (pre-existing, now respects wall traits).
- **Ammo system**: basic attacks draw from a 3-shot pool (traits modify size/reload); 3s reload after exhaustion; `●●○` pips + RELOADING in battle panel. All special basics consume ammo.
- **Monster Dex**: press `M` (or sidebar 📖 DEX) — all monsters with sprite, type, all 3 traits + odds (rolled trait ✓ on caught), and full card lists with types/costs/descriptions.
- **Bug fixes**:
  1. Flying sword / clawingsword (and enemy sweeps) stop at blocks AND demolish them; bullets now chip block health instead of instantly deleting (makes wall durability real).
  2. Mushroom turrets only lay poison trail on the opposing side — no more self-poisoning.
  3. Heal fonts/puddles carry an `owner` tag; only the placing side can drink from them (enemy heal tiles can no longer heal the player).

## 2026-06-14 — Battlefield engagement pass (MMBN-style polish)

### Hit registration + game feel
- **Floating damage popups** at the hit tile, rising and fading over ~1.5s. Coloured by matchup: yellow `+N` for super-effective, blue `−N` for resisted, white neutral, gold for heal, grey "BLOCK" for i-frame-suppressed hits.
- **Hitstop** (`hitstopRef`): the main game tick yields for 1 tick on hits ≥10 dmg, 2 ticks on ≥25 dmg. Damage popups still tick down during freeze.
- **Hit flash + stretch animation** (`hitStretch` + `hitFlash` keyframes): 320ms squash-stretch with white-out flash on damaged sprite. Keyed off `iframeAt` state so it restarts on each hit.
- **Visual i-frame flicker** (~6 ticks of alternating opacity) on top of the damage suppression.
- **Screen shake** on heavy hits (`battleShake` keyframe, 220ms 4-jitter pattern).
- **Distinct fast-attack glyphs**: slash renders as a wide diagonal sword-arc plane (white core + blue glow + pointLight); punch renders as an expanding gold impact ring + hot core. Both linger 5 ticks (~550ms) for readability — damage is one-shot via `hasDamaged` flag, only the visual lingers.

### Damage i-frames + BLOCK popup
- **3-tick i-frame window (~336ms)** on both player AND enemies. Damage attempted inside the window is dropped and replaced with a grey "BLOCK" popup at the target tile.
- Implemented as a **pure read of `playerIFramesRef` / `enemyIFramesRef`** inside the wrapped HP setters. The ref is *only written* from the post-commit `useEffect` that watches the HP state — keeps the updater pure so StrictMode's double-invoke produces identical results.
- I-frame trackers are also exposed as state (`playerIFramesAt`, `enemy1IFramesAt`, `enemy2IFramesAt`) so the stretch/flicker animation fires on the same render as the damage, not one tick late.
- Trade-off: enemy DoTs (sporecloud, vampmist) now land roughly once every 3 ticks instead of every tick — visible BLOCK popups make this explicit.

### StrictMode-safe damage pipeline (the big refactor)
- **Wrapped HP setters are now pure** — `setPlayerHP` / `setOpponentHP` / `setOpponent2HP` only compute `scaleDecrease(updater, prev, mult)` and either return early with a BLOCK popup or queue a pure updater. No ref mutations, no `spawnPopup`, no `hitstopRef` writes inside the updater.
- **Side effects fired from `useEffect`** keyed off each HP value with a `lastHPRef` mirror. On a real decrease: spawn popup, fire hitstop + shake based on damage, mark i-frames, handle revive trait, bump `lastDamagedTick`, set `guardBelowHalf` permanent guard if applicable.
- Why this matters: StrictMode double-invokes setState updaters in dev. The previous code mutated refs inside the updater, so the second invocation saw the just-mutated ref and incorrectly suppressed legitimate damage — **player damage was being silently dropped**.

### Player HP visual
- Player OPERATIVE panel now uses the same **10-segment gradient bar** as the enemy panel (green gradient instead of red). Mana bar stays as the pip-text style to keep the resources visually distinct.

### Monster move bug fixes
- **Kingfencer**:
  - *Lunge* — teleports 2 columns toward enemy (clamped), then strikes the 1-and-2-tiles-ahead slash arc.
  - *En Garde* — heal 15 + single block in front (not a full wall column).
  - *Fleche* — originates at the player and sweeps toward enemy. **Direction-aware `clawingsword` tick** (`dx = direction === "left" ? -1 : 1`); bounds check honours direction too.
- **Toadazer**:
  - *Thunder Clap* — electric orb walks the **CCW perimeter** of the enemy grid (12 tiles, one per 220ms). 8 DMG per tile visit. Can clip a stationary enemy twice as it passes.
  - *Live Wire* — trap **3 tiles ahead of player** (rear ⇒ trap sits on your front line and can self-hit; front ⇒ trap slips into enemy territory as zoning).
- **Cargot**:
  - *Skewer* — hits 3 tiles ahead with a staggered slash arc (4/5/6-tick TTL for sweeping read).
  - **NEW: basic attack builds a 1-HP block in your front column on hit** + spawns a **holy tile** behind it (heals 3 HP/s for 3s).
- **Atomippo**: most cards now also displace the enemy 1 tile ~200ms after impact (gravity slam / event horizon / graviton beam pull *toward* center; meteor drop / crushing field push *outward*).
- **Scimark wide slice now damages all 3 tiles** (previously skipped center because the bullet damage was already there; user couldn't tell adjacent enemies weren't getting hit because typically only one was on-screen).
- **Overcharge / Battle Cry / Capacitor** — fixed silent no-op: was setting `malipoleFrenzyActive` which only Malipole's bullet code reads. Now sets `cardBoostRef = { mult: 1.5, ticks: 30 }` which the wrapped HP setters' `outgoingMult` applies to every damage event — so all 3 cards now buff bullets *and* cards for ~3 seconds across all monsters.

### Holy tile mechanic
- New `holytile` `effectType` in `TimedEffect`. Lifetime 27 ticks (~3s); heals **3 HP every 9 ticks (~1s)** = 9 HP total. Heals whoever stands on it (player or enemy, no owner gating). Gold tint (`#ffd47a` glow, `#e8c060` tile).
- Currently spawned by Cargot's basic attack. The sheet references holy tiles in 5+ traits (Cargot secret, ferret, ocelot, crab, monkey) — the mechanic is now available for future moves/traits to hook into.

### Wild encounter coverage
- Replaced hand-maintained `ENEMY_TYPES` / `WATER_ENEMY_TYPES` arrays with `wildPoolFor(zone)` derived from `ALL_TRAINER_TYPES` filtered by `DESERT_TYPES` / `WATER_TYPES`. **All 18 monsters now appear as wild encounters** in their appropriate biome (9 grassland, 3 desert, 6 water). Original 4 starters (Cowboy/Hogglin/Rat King/Malipole) were previously only catchable via trainer battles.

### Monster Dex shows basic attacks
- Added `BASIC_ATTACK_DESCS` map — every monster entry in the dex now has a `BASIC · ◆ SPACE` line above the trait list, sourced from the sheet's column F + actual implementations.

### Key architecture notes (for the Godot port)
- Damage pipeline choke point = wrapped HP setters; Godot equivalent = a `take_damage(amount, source)` method on a shared Combatant class.
- `MOVE_ALIASES` = data-driven move reskinning; port the ~60 base effects once, keep themed names as Resources.
- `ZONE_MAPS` + per-zone encounter pools = data-driven overworld; maps to GridMap scenes + spawn-table Resources.
- Trait hooks are a flat `TraitEffect` struct consulted at fixed engine points — same shape works as a Godot Resource.
- **Pure-updater + post-commit-side-effect pattern** translates to: in Godot, the damage method on Combatant is a pure function returning the new HP; signals (`damaged`, `iframe_started`) are emitted from the receiver and listened to by the popup spawner, hitstop manager, and screen shake — same separation that fixed StrictMode here.
