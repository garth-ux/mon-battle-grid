# mon-battle-grid — Godot Port Handoff

Working copy: `godot game files/monster-battle-grid/` (Godot 4.4, Forward+).
Reference implementation: `src/App3D.tsx` (React, ~12k lines, single file). Many cards are now **user-redesigned variants** of their React originals — CARDS.md captures the divergences.

This doc captures the port's current state and the plan ahead.

## Architecture

### Damage pipeline (load-bearing)

`combatant.gd` follows the pure-updater + post-commit-side-effect pattern from React:

- `Combatant.take_damage(amount, source_type, source) -> int` is **pure**: reads `traits` + `monster_type`, computes `final = amount × type_mult × trait_taken_mult`, writes `hp`, emits `damaged(final, mult, source_type, source)`.
- Side-effect listeners subscribe to the signal: combatant's own sprite stretch/flash, battle.gd for popup + shake + hitstop, combatant_panel.gd for HP bar.
- Same shape applies to `blocked`, `healed`, `ammo_changed`, `mana_changed`, `hand_changed`, `trait_changed`, `died`, `stunned`, `unstunned`, `poisoned`, `unpoisoned`, `silenced`, `unsilenced`.

**Do not** put visual side effects inside `take_damage`. Always emit + listen.

### Type wheel — `scripts/type_wheel.gd`

12-type wheel (fire → grass → earth → electric → wind → fighting → mind → dark → light → time → ice → water → fire). Each type does `1.1×` vs the next. Pure static class. `TypeWheel.multiplier(atk, def) -> float`.

### Trait system — `scripts/trait_def.gd` + `scripts/trait_registry.gd`

- `TraitDef` is a Resource with `id, display_name, description, rarity, effects: Dictionary`.
- 54 trait `.tres` in `data/traits/`. All 18 monsters have their 3-trait pool wired (40/40/20 rolled on `apply_def`).
- `TraitRegistry` static aggregators: `damage_taken_mult`, `damage_dealt_mult`, `bullet_bonus`, `bullet_mult`, `card_mult(card_type)`, `ammo_bonus`, `wall_bonus_hp`, `is_immune(status)`, `heal_on_block_break`, `heal_on_stun`, `boomerang_catch_heal`, `combo_heal`, `reload_mult`, `revive_hp_pct`, `charge_heal`, `card_type_heal`, `rat_dmg_bonus`, `has_rat_on_block_break`.
- **Live (consumed by current code):** dmg_taken_mult, dmg_dealt_mult, bullet_bonus, bullet_mult, ammo_bonus, reload_mult, wall_bonus_hp, revive_hp_pct, immune_poison/stun, all_card_mult, card_type_mult_<type>, heal_on_block_break, boomerang_catch_heal, rat_dmg_bonus.
- **Dormant** (data present, no consumer yet): guarded_on_type_<type>, guarded_on_reposition, guarded_behind_block, guard_below_half, card_type_heal_<type>, charge_heal, combo_heal_every/_amount, heal_on_stun, heal_on_poison, rat_on_block_break, wide_slash_every, echo_card, steal_duration, guard_bombs, guard_steal.

### Cards system — `scripts/move_def.gd` + `scripts/move_registry.gd`

`MoveDef` Resource fields (most recent additions in **bold**):
- Identity: `id, display_name, move_type`
- Cost: `mana_cost, cooldown_ms`
- Display: `description`
- Effect: `effect_id, damage, range_tiles, area_radius, hit_count`
- Tile Placed: `tile_effect_id, tile_lifetime_ms, tile_owner_only`
- Buff / Self: `self_buff_id, buff_mult, buff_duration_ms, self_heal`, **`caster_lock_ms`** (Scimark's beam-with-lock)
- Status Applied: `status_id, status_duration_ms, status_dot`
- Movement / Displacement: `caster_offset, target_displacement, random_destination`, **`is_movement_card: bool`** (silent flag for the future Guarded system)

`MoveRegistry.execute(move, caster, battle)` dispatches on `effect_id`. ~60 effect_ids now — see `CARDS.md` for the full glossary.

### Monster data — `data/monsters/*.tres` + `scripts/monster_roster.gd`

18 monsters as `MonsterDef` resources. `MonsterRoster.load_by_id("id")` / `random_def()` exposed. Each has type, max_hp, sprite, trait_pool, basic_attack_id, **basic_attack_kind**, deck. Sprite renames done: Statinu→Fudo, Bat→Dragone, Rat King→Lemmel.

**`basic_attack_kind`** values:
- `"bullet"` (default) — normal bullet attack.
- `"block_builder"` (Hogglin) — places 1-HP wall in front instead of firing.
- `"charged_bullet"` (Malipole) — 1.5s SPACE-hold → release fires; 3 consecutive hits trigger Frog Chorus frenzy (random 1.1-2× dealt mult for 3s).
- `"charged_walker"` (Mushroom) — 1.5s SPACE-hold → release spawns a mushroom_soldier at caster's cell that walks forward dropping poison_trap tiles + 5 contact DMG.
- `"guard_builder"` (Modizard) — 1 ammo → stationary guard turret at the REAR column of caster's row, max 2 alive, 15 HP, 5 DMG shot every 2s (12 with Bomb Lobbers; Pickpockets adds a 2 HP siphon via Bullet.steal_heal).

SPACE input handler in battle.gd routes any `basic_attack_kind.begins_with("charged_")` through press/release flow + cyan halo charge indicator.

### Combatant — `combatant.gd`

In addition to the core damage pipeline, Combatant tracks:
- Stun/poison/silence/poison_absorb status timers + halo emit signals.
- Thorn_shield_active (Hogglin reactive defense).
- Buff list with **type-aware dealt mult** and **frozen_immune** flag support: `buff_damage_dealt_mult_for_card(card_type)` reads per-buff `card_type_mult_<type>` keys (Water Breathing); `is_frozen_immune()` scans buffs for `frozen_immune: true`.
- **`last_move_direction: Vector2i`** — captured by `Battle.set_caster_cell` (signed delta of cell move) for frozen_tile slip mechanic.
- **`charge_active`, `charge_started_at_ms`, `consecutive_charged_hits`** — Malipole charged_bullet state.
- **`gravity_pending: bool`** — Event Horizon toggle for "2 commands to leave gravity tile".
- **`mana_boost_until_ms`** — Sonar Jam buff that halves mana regen interval.

### Bullets — `scripts/bullet.gd`

- Speed 13.0 default. Friendly-fire via `owner_side`. `is_ricochet` reverses at far edge. Status payload (`status_id/duration/dot`) for mushroom-turret-style bullets. Wall hit uses mesh-center offset + 0.95 radius.
- **`is_charged: bool`** — set by `_basic_fire_bullet` when fired from a charged basic attack. On combatant hit, calls `battle.on_charged_hit(shooter)` which increments the combo counter and triggers `MoveRegistry.apply_frenzy_buff` at threshold.

### Walls + Turrets + Tiles

**Wall** (`scripts/wall.gd`): standard placed block. Now has `lifetime_ms` (used by Hex Tiles `block_tile` roll for auto-despawn).

**Turret** (`scripts/turret.gd`): modes via field combos:
- Stationary (default).
- `move_interval_s` > 0 → random adjacent walk (Call Soldier).
- `forward_walker = true` → walks forward across both grids dropping `drop_tile_on_step` tile (Mushroom Fairy Ring).
- `random_forward_walker = true` → 70% forward bias, random ±1 dy each step (Street Swarm, Poison Swarm rats).
- `homing_to_opponent_y = true` → forward walker that snaps y to opponent's y each step + dies on hostile wall (Tadpole).
- `tile_drop_interval_s` > 0 → drops `drop_tile_on_step` on current cell every N seconds (Medical Mouse).
- `contact_damage` > 0 → polls 100ms for non-owner combatant at its cell → strike + self-destruct (suicide walkers).
- `lifetime_ms` > 0 → auto-despawn after N ms (rats with bounded lifetimes).
- `sprite_texture` + `sprite_tint` → renders as billboarded Sprite3D (ally art).
- `fires_bullets` → disable for non-shooter walkers.

**TimedEffect** (`scripts/timed_effect.gd`): persistent tile with per-tick `_on_tick`. 14 effect_ids — see CARDS.md for full table.

### Zone Steal (Crushing Field)

Battle holds `_zone_steal: Dictionary` (`owner, side, col, expires_at_ms, visuals`). API:
- `set_zone_steal(owner, side, col, duration_ms, visuals)` — last-cast wins.
- `clear_zone_steal()` — frees visuals, applies caster-remain punishment (10 DMG + 1s stun + tween back if player still on extended cell).
- `zone_steal_active_at(side, cell)` — true if cell is on the stolen column.
- `combatant_blocked_at(side, cell)` — extended to include stolen column.

Player can step onto stolen tiles via the extended `_player_cell.x = GRID_COLS` (phantom cell). `_player_cell_to_world` maps to enemy grid x=stolen_col. The player remains logically on `SIDE_PLAYER`, so opp's cell-targeted cards whiff (intentional — defensive value). Bullets still hit visually.

### Overworld

- `overworld.tscn` instances the BlockTile `.glb` as the test map. `grid_builder.gd` per-triangle parses every mesh, builds a `TileGrid` with `kind`, `top_y`, `ground_y`, `absolute_top_y`, plus `has_tree/has_wall/has_water/has_encounter_grass` flags.
- Walkability: no water/tree/wall, ground_y set, height delta ≤ 1.5m.
- Player is grid-snapped (Node3D, tweened position). On step-end, encounter-grass cells roll 20% → fade → battle.tscn.
- **M-key cycles partner monster** via `SceneManager.current_player_id`.

### Battle

- `battle.tscn`: 2 GLB grid instances (player blue, enemy red, 4×4 each, 2.5m spacing), background scene, camera (50° tilt, 20° yaw, ortho size 15), `WorldEnvironment`, HP panels, hand bottom-left, hint label bottom-center.
- `battle.gd` wires combatants + signals + hand panel, enemy AI (random bullet every 2.2s + random adjacent-cell move every 1.4s), hit polish (shake / hitstop), basic-attack bullets.
- **`_zone_steal` state** + zone-steal-aware `combatant_blocked_at`.
- **`_charge_indicator: Node3D`** — cyan halo while a charged basic is winding up.
- **`_basic_fire_bullet(shooter, dir, is_charged: bool = false)`** — passes `is_charged` through to the Bullet so combo tracking works.
- **`_basic_spawn_walker(shooter)`** — Mushroom's charged walker basic.
- **`on_charged_hit(shooter)`** — called by Bullet; increments shooter's combo, fires frenzy at threshold.

## Repository layout

```
godot game files/monster-battle-grid/
├── project.godot                # main scene = overworld.tscn, pixel-art rendering defaults
├── overworld.tscn / .gd         # overworld + camera follow + encounter roll
├── battle.tscn / .gd            # battle scene + AI + hit polish + card input + zone_steal + charge indicator
├── player.tscn / .gd            # overworld player
├── combatant.tscn / .gd         # in-battle monster (damage pipeline, buffs, statuses, charge state, gravity_pending, last_move_direction)
├── combatant_panel.tscn / .gd   # HP/name/type/trait panel
├── card_view.tscn / .gd         # single card display
├── hand_panel.tscn / .gd        # 2-card hand + R-hold refresh
├── bullet.tscn / .gd            # bullets + ricochet + status payload + is_charged combo hook
├── wall.tscn / .gd              # wall (with lifetime_ms)
├── turret.tscn / .gd            # turret (forward/random_forward/homing_to_opp_y/contact_damage/tile_drop_interval)
├── timed_effect.tscn / .gd      # ground tiles (14 effect_ids)
├── damage_popup.tscn / .gd
├── scripts/
│   ├── scene_manager.gd         # autoload, fade transitions + next_battle_enemy_id handoff
│   ├── tile_type.gd, tile_grid.gd, grid_builder.gd
│   ├── monster_def.gd, monster_roster.gd
│   ├── type_wheel.gd
│   ├── trait_def.gd, trait_registry.gd
│   ├── move_def.gd              # + caster_lock_ms + is_movement_card
│   ├── move_registry.gd         # ~3000 lines, 60+ effect handlers
│   └── damage_popup.gd
├── data/
│   ├── monsters/   # 18 .tres
│   ├── traits/     # 54 .tres
│   └── moves/      # ~95 .tres (~15 orphans from early test decks)
├── art/
│   ├── battle/                  # battleground GLBs
│   ├── monsters/                # 18 PNGs
│   ├── allies/                  # call_family, call_soldier, mushroom_soldier, generated_rat, heal/poison_generated_rat, tadpole
│   └── player/                  # idle frames
└── BlockTile_1781894212.glb     # overworld test map + 12 loose tile PNGs
```

## Project-wide invariants (don't break)

1. **Don't `npm install`** in mon-battle-grid root. React runs on CodeSandbox.
2. **Don't write side effects inside `Combatant.take_damage()`.** Emit signals; listeners handle effects.
3. **One autoload: `SceneManager`.** Don't add more without good reason.
4. **Pixel-art import**: `compress/mode=0`, `mipmaps/generate=false`, `detect_3d/compress_to=0`. `_force_pixel_filter()` sets nearest at runtime.
5. **Battle camera** is configured in `battle.gd._setup_camera()`. Tune via constants.
6. **Background GLB position** is user-tunable via @export vars on the Battle root.
7. **GDScript Variant traps** — when calling a method on the untyped `caster` param in `MoveRegistry` handlers, ALWAYS use explicit type annotations: `var x: Vector3 = caster.global_position`. The `:=` infer fails through untyped Variant.

## Done so far (porting log)

### Mons fully ported (18/18) — PORT COMPLETE

| Mon | Cards | Notes |
|---|---|---|
| **Cargot** | 11 | All 8 React + 3 test cards. Earth/snail tank. |
| **Slime** | 8 | Full React deck. Mind type. |
| **Hogglin** | 7 | 7/8 React (clawingsword skipped). Block-builder basic. |
| **Lunapra** (id "cowboy") | 9 | 8 React + boomerang. Display rename only. |
| **Pixie** | 6 | 4 React + 2 user designs (Reap, Call Soldier). |
| **Toadazer** | 8 | Full React deck. Electric. |
| **Mushroom** | 4 | Full React + charged_walker basic. |
| **Lemmel** | 7 | Rat Pack, Trash Toss (proj→rat on miss), Street Swarm (adjacent-spawn random walkers), Plague Bite, Scavenge, Medical Mouse (heal rat ally + holy tile), Poison Swarm (3 forward-rats with poison trail + contact dmg). |
| **Malipole** | 9 | Tongue Whip, Mud Slap, Absorb, Random Hop (tongue-style teleport), Hex Tiles (1/8 from 8 effects), Spawn Tadpole (homing forward walker), Frog Chorus (1.1-2× random dealt buff), Croak Blast (slow row beam), Lily Pad Trap (2 vine_snare at center). charged_bullet basic with 3-hit→frenzy combo. |
| **Dragone** | 9 | Sonic Screech, Wing Slash, Sonar Jam (mana boost + silence on same row), Swoop (segmented beam + push), Blood Drain (5-cell scan + heal 10), Shadow Dive (bilateral reposition), Vampiric Mist (tile at opp), Divebomb (rush 60+30 self, hit slow-reverse), Lob Bomb (rolling plus-AoE). |
| **Atomippo** | 8 | Gravity Slam (cone + pull-per-second + 2s caster stun), Meteor Drop (1.5s delayed plus-AoE), Crushing Field (3s column claim + caster-walk + DoT col), Event Horizon (gravity_well_tile center 2×2, slow movement), Wall (shared earth), Topple (shared earth), Graviton Beam (locked beam + push + wall-bonus), Absorb. |
| **Scimark** | 9 | Sword Dive (4-cell pierce ignoring blocks), Tidal Wave (2-row sweep, per-row wall-stop), Slash (shared dark), Beam (scimark_beam with 500ms caster lock), Lasso (shared dark), Wall (shared earth), Topple (shared earth), Iai (rush 40+30 slash on hit, 20 self on miss), Water Breathing (heal 5/s × 8s + water cards ×1.5 + frozen-immune). |
| **Giant** | 9 | Hammer Down (hammer_faithful — 1.5s freeze, no pull), Topple + Wall (shared), Zone Steal (zone_no_dot), Boulder Roll (rolling 20-HP wall-entity, plus-blast), Earthquake (shatter all blocks, 15×count per field side), Brick Break (smash nearest block ≤2 fwd + heal 15), Vanish (2s bullet-phase), Friend of the Forest (3 telegraphed perimeter lines, stop-at-wall). Second half user-designed. |
| **Modizard** | 12 | All-water spellkit: Arcane Bolt (5s chasing bomb, 50+5 splash — user redesign), Arcane Storm (beam+stun), Rune Trap (goo_trap), Mana Siphon (scavenge), Blink (teleport), Flame Breath (beam + 3 burn tiles), Wall + Absorb (shared), Exlice (telegraphed X, fighting), Fire and Ice (water↔fire kit toggle on privatized card duplicates), Shed Skin (3s self-stun + 15/s regen), Explosive Skin (fire ×1.3 + burn-immune 5s). Basic = guard_builder (max 2 rear-column guard turrets); Bomb Lobbers + Pickpockets traits live. |
| **Grabbakat** (id `grunt`) | 12 | Armor-brawler (display rename). Plasma Shot + Capacitor + Shock Therapy + Topple + Brick Break (shared .tres), Shield Bash (30 + stun, ×1.5 armored), Barrier (+15 Armor) + Flex (+5), Gravity Well (8s front-column tiles + 1 cell/s pull — user redesign), Power Surge (beam 20), Cross Counter (jab + 3s counter stance → 40 + stun), Bullet Punch (1.5s self-stun row flurry 20/tile). New Armor system on Combatant (absorbs before HP, panel [+N ARMOR]). |
| **Fudo** (Statinu) | 12 | Guard-dog tank. Punch/Bomb/Slash (shared dark), Wall/Topple (shared earth), Dust Devil (earth 20, first user of _dust_devil — now caster-centered per user amend), Flame Breath (fire, Modizard handler), Guardian Stance (heal 15 + 2-HP column at depth 1, gaps only — En Garde alias-ready), Glare (channel 1.5s → 4 marked tiles 10 + 3s stun), Brick Break (shared), Earth Armour (+25 Armor + earth-card heal-3 window via execute() post-play hook), Crush Earth (depth-3 plus shove-to-center + 0.5s slam 50). |
| **Icage** | 8 | Mind Spike (homing psychic orb walker), Telekinesis (gravity_well reskin), Psybeam (beam 20), Regenerate (heal_font 5s), Mind Jam (sonar_jam reskin), Wall + Absorb + Bounce (shared). |
| **Kingfencer** | 8 | Lunge (quickdraw 25, light), Fleche (clawingsword — advancing slash, 30 pass-through, first block consumes it — the final new handler), Wing Dance (flying_sword), Riposte (thorn_shield), En Garde (guardian_stance, light), Slash + Lasso + Swoop (shared). Traits are all basic-attack hooks — wire in the basic-attack pass. |

### New mechanics added (highlights)

- **Charged basic attacks** with SPACE press/release + cyan halo, kind dispatch on prefix `charged_*`.
- **Rush moves** (Divebomb, Iai, Gravity Slam) — fast forward tween + damage callback + slow reverse, caster cell-tracked at origin so opp cards still target them on the return path.
- **Lob Bomb-style rolling projectiles** with custom speed + cell-by-cell tween + plus-AoE on contact.
- **Sword Dive pierce-through-everything** — walls and combatants both take damage, pierce continues.
- **Hex Tiles 8-effect roll** (random 1/8 includes `broken_tile` traversal-block + `block_tile` real wall placement).
- **Zone Steal column claim** with full caster cross-grid walking support (`_player_cell.x = GRID_COLS` phantom).
- **Event Horizon gravity_well_tile** — Combatant.gravity_pending toggle gates movement (2 commands to leave).
- **Tidal Wave per-row independent wall-stop** via shared row_state dict.
- **Graviton Beam wall-bonus damage** — push opp on hit, +15 if pinned to grid edge / blocked.
- **Water Breathing multi-effect buff** — combines healing-over-time tween + card_type_mult_water buff key + frozen_immune buff key.
- **Type-aware buff dealt mult** — `buff_damage_dealt_mult_for_card(card_type)` reads per-type keys (Water Breathing) and falls back to dealt_min/max (Frog Chorus) or fixed dealt_mult.
- **Caster-lock-on-beam** — MoveDef.caster_lock_ms applies stun at cast time; scimark_beam.tres opts in (500ms), other beam cards unaffected.
- **Movement-card flag** — MoveDef.is_movement_card (silent, ready for Guarded system).
- **Last-move-direction tracking** on Combatant for frozen_tile slip.
- **3 new ally sprites** in art/allies/ (generated_rat, heal_generated_rat, poison_generated_rat, tadpole).

### Trait coverage updates

Added aggregators: `rat_dmg_bonus`, `has_rat_on_block_break`. Card_type_mult_<type> series now in heavy rotation (Piercing Tide etc.).

## Next steps (priority order)

### 1. ~~Port the remaining mons~~ — DONE. All 18 ported.
### ~~2. Basic-attack pass~~ — DONE (July 2026, from mons.xlsx column F + user amendments)
Every mon has its signature basic. `basic_attack_kind` values and behaviors:

| Mon | Kind | Behavior |
|---|---|---|
| Lunapra | boomerang | 1 ammo/3s reload crescent, 3-out-and-back, breaks enemy blocks, catch = instant refund |
| Hogglin | block_builder | build block; press again with block in front → LAUNCH it 2 tiles (15, hits turrets too) |
| Lemmel | bullet | every 8th hit heals 10 (on_basic_hit hub) |
| Malipole | charged_bullet | hold SPACE; 3 charged hits → frenzy |
| Grabbakat | stun_jab | 2-tile jab 8 + 1s stun + pull-to-front → 2s stun |
| Slime | charged_spike | tap = 2-tile spike + acid on hit; full charge = 4 tiles |
| Dragone | drain_shot | heals what it deals; 10th hit → LATCH 3s (200% drain) |
| Pixie | triple_shot | 3 staggered ×2 bolts, 15% crit ×2 each (rebalanced from 5) |
| Giant | tile_steal | ammo punch (3, 3s reload): 12 + claim tile 5s (enemy ticks 2/s, ANY column walkable via multi-col phantom; stranded deep on expiry = forced home + 2s stun) |
| Mushroom | charged_walker | hold SPACE → poison-trail soldier (user design, kept) |
| Fudo | statue_builder | build/launch like Hogglin but 3-tile topple |
| Scimark | bullet | every 3rd hit → 3-wide slice at victim's column |
| Toadazer | bullet | every 4th hit → charge buff (next electric ×1.6; Charge Sip heals on discharge) |
| Icage | ice_spike | 2 ammo homing spike; 50% frozen tile at far edge on miss |
| Cargot | scrap_shot | 2 ammo; a landed hit builds a block in front |
| Kingfencer | charged_thrust | 1-ammo/2s-reload rapier thrust on both tiles ahead; hold SPACE = RUSH SLICE — dash the row at 20/target, glide home (Stunning Touche stuns on both) |
| Atomippo | warp_shot | regular bullet @10 that teleports the victim to a random tile on hit |
| Modizard | guard_builder | 1 ammo guard at rear of own row, max 2, 2s fire (original version, reverted per user) |
| Kindlekit | bullet | every 3rd damaging hit burns the victim's tile 3s (on_basic_hit hub) |
| Dandeox | bullet | every 3rd landed hit BLINDS 2s (20% whiff chance on the victim's attacks) |
| Gozo | stun_volley | 2-shot clip; the clip-emptying shot ROOTS 1s on hit (movement lock only), then reloads |
| Klawr | charged_claw | tap = 2-tile claw + 1.5s acid on hit; full 1.5s charge = 4 tiles + frozen_tile at depths 3-4 |
| Drakecho | bullet | every 3rd hit steals 1 mana via `Battle.steal_mana` (Essence Drinker heals 10/point) |
| Droopider | sleep_shot | weak (8) wall-piercing bolt; every 3rd landed hit → SLEEP 3s |
| Insidibear | rage_shot | calm: slow 2-ammo slug (8); every 3rd hit → RAGE (cards ×1.2 + ammo-free stunning laser on 3s CD) |
| Mosseer | seer_shot | weak (6) 5-clip bolt, 0.5s CD; every 5th landed hit force-shuffles the enemy's hand into their deck + next grass CARD +10 (one-shot) |
| Wherewolf | charged_shadow | hold SPACE: ghost appears behind the enemy, 0.5s later strikes their cast-time cell (dodgeable) — 18 full / 9 early + 1s stun, 3s CD |
| Jester | jester_beam | 3-ammo light beam (5s reload) sweeping the row tile-by-tile through blocks — 12 DMG, dodge by changing rows |

### mons.xlsx sheet↔game mapping (authoritative for the traits phase, cols I/J/K)
Row 3 metail=Hogglin · 4 fairy folk=Pixie · 6 slime=Slime · 7 lunapra=Lunapra/cowboy · 8 grabakat=Grabbakat/grunt · 9 funine=Fudo · 12 scimark=Scimark · 16 malipole=Malipole · 17 lemmel=Lemmel · 23 yammie=Giant · 33 (unnamed grass)=Mushroom · 38 (unnamed electric)=Toadazer · 39 (unnamed ice)=Icage (NOT yemmie/24 — not in game) · 40 (unnamed earth)=Cargot · 41 (unnamed water)=Modizard · 42 (unnamed dark)=Dragone · 44 (unnamed light)=Kingfencer · 45 (unnamed mind)=Atomippo. Other rows (droopider, tendra, galafin, duraceel, insidibear, dearly, wherewolf, rootle, corie, yemmie, krrrrin, astragio, …) are unported concepts.

### ~~3. Connect all dormant traits~~ — DONE. ALL 54 traits live.
Guarded system (8 traits), card-play heals (Dark Tithe/Time Sip + Earth Armour hook), event traits (Clinch, Poison Drinker, Tunnel Rats, Ancient Claim), basic-hit traits (combo heals, Extended Lunge, Sleep Spores/Stunning Touche, Charge Sip + Toadazer charge), Triple Echo. Also shipped: **Armor system** (bonus HP pool before real HP, Grabbakat/Fudo cards), the **execute() post-play hook** (card-type heals, guarded triggers, charge discharge, Triple Echo counting), **overworld free movement** (screen-relative, footprint collision, per-cell encounter rolls preserved) + new player idle/run animations, **Mon Menu** (M on overworld — all-18 browser + partner picker, `ui_blocker` group freezes the player).

### STARTER MONS — Pass 1 SHIPPED (July 2026, from `mon battle grid_starters.xlsx`)

5 starters live: **Kindlekit** (fire 85), **Dandeox** (grass 85), **Gozo** (light 105, 2-ammo), **Klawr** (water 95), **Drakecho** (time 80). Sprites in `art/monsters/<id>.png` (originals kept in `art/monsters/starters/`). `MonsterRoster.STARTER_IDS` — excluded from `random_def()`; the overworld rolls them at **1% of encounters** (`STARTER_WILD_RATE`, then `random_starter_def()`). They appear in the Mon Menu via `load_all()`.

**Decks = 5 existing cards each, shared VERBATIM** (user decision — the starters doc's bespoke card designs come later; doc MB values apply then):
- Kindlekit: Iai, Hammer Down (giant), Thorn Shield, Explosive Skin (modizard), Flame Breath (fudo fire)
- Dandeox: Vine Snare, Vampiric Mist, Gravity Well (grunt), Call Soldier, Plague Bite
- Gozo: Holy Ground (holy_tile), Wall (hog_wall), Meteor Drop, Bullet Punch (grunt), Brick Break (giant)
- Klawr: Lasso, Spawn Tadpole, Blink (modizard), Dynamite, Event Horizon
- Drakecho: Beam, Sonar Jam, Scavenge, Blink (modizard), Dynamite

**Trait pools (15 new .tres, 40/40/20).** LIVE: Warm Glow (card_type_heal_fire 5), Mana Thief (every 5th card steals 5 mana — post-play hook), Stonebreaker Faith (heal_on_block_break 10), Brine Body (heal_on_poison + NEW acid_pool tile support in timed_effect.gd), Depth Charge (card_type_mult water+ice 1.2), Essence Drinker (heal_per_mana_stolen 10), Outside Time (type_neutral — RECEIVED side only; dealt side needs attacker context), **Tinder Nerves** (Blind+Root pass: water damage → self-blind 1s; fire/fighting damage → `tinder_charge` one-shot buff ×1.2 on next fire/fighting card, consumed by post-play hook — wired via `Battle._on_damaged_trait_hooks` damaged-signal listener). DORMANT (keys authored, no consumer): Predator Instinct (dmg_mult_vs_<type> — needs attacker-context pass), Lingering Rot (status_prolong_ms), Petal Float (levitate_on_type_dark), Phasing Light (ignore_blocks), Sanctuary (design pending), Tidal Memory (heal_trail), Chrono Leech (card_type_lifesteal_time).

**Blind + Root statuses (July 2026 pass):** Combatant gains `blind_until_ms`/`root_until_ms` + apply/is/tick + `blinded/unblinded/rooted/unrooted` signals; halos + BLIND/ROOT popups in battle.gd. **Blind** = 20% chance an attack deals 0 — rolled ONCE per card in `MoveRegistry._final_card_damage` and once per swing in `Battle._basic_attack_damage` (`Combatant.roll_blind_miss()` prints + MISS popup via battle_ctx). Handlers that bypass the shared damage math (earthquake flat math, etc.) don't miss. **Root** = voluntary-movement lock only (cards/basics/forced displacement unaffected) — gated at the player input branch + `_try_move_enemy_random`. Bullet riders now support `status_id` "root" and "blind". `immune_blind`/`immune_root` trait keys work via the generic is_immune reader.

**New shared event:** `Battle.steal_mana(taker, victim, amount)` — clamps to victim's mana, pays Essence Drinker. Used by Drakecho's basic + Mana Thief.

### STARTER BESPOKE DECKS (user priority, July 2026 — one mon per pass)

The starters doc's sheet-2 card designs replace the verbatim stand-ins; each starter = 5 bespoke + 5 existing cards (10-card decks). Settled with user: bonus-card system on key 3 ✓, Meteor Knuckle 75, Cremate 10/burn, Mimic Shroud v1 without card-mirroring. **ALL FIVE DONE: Gozo ✓ Kindlekit ✓ Dandeox ✓ Klawr ✓ Drakecho ✓.**

**Klawr claw amend (user):** every landed claw hit now FREEZES the victim's floor (frozen_tile, was acid); charged still ices depths 3-4 on empty cells. **Root-cause fix that benefits ALL ice:** `_try_move_player` and `_try_move_enemy_random` now record `Combatant.last_move_direction` — previously only card-driven `set_caster_cell` did, so frozen-tile slips fired on stale/zero directions for free movement. Slides now genuinely follow the direction of travel.

**Drakecho pass (DONE):** static_tick (fast electric row bolt 15→40 when 2 other cards cast within 3s — NEW `Combatant.card_played_times` appended by the post-play hook), rewind_fork (records tile+HP in `Battle._rewinds`; RETURN on key 3 for 4s — second consumer of the bonus-card system; snap back if the cell is free + heal up to recorded HP), overclock (NEW `Combatant.mana_boost_factor` — ×3 regen 5s then 6s self-silence; Sonar Jam unchanged at ×2), thoughtsiphon (wall-ignoring 20 + steal 3 via steal_mana, or 45 + 2s stun on a mana-starved target), chronofracture (public Label3D 8s countdown on the enemy's cell → 80 centre + 40 cardinals, caster heals 50% of dealt).

**Mimic Shroud amends (user):** decoy now spawns on a RANDOM free adjacent cell (shuffled cardinals) and **copies the owner's basic shots** — `Battle._mimics` registry (owner id → Turret), `_spawn_basic_bullet` fires a mirrored `spawn_turret_bullet` from the decoy (12 dmg, owner's type). Stale entries skipped via is_instance_valid.

**Klawr pass (DONE):** undertow (row scan + 1-cell drag toward caster via the hammer-pull pattern; blocked drag = +15 crush), ripple_chain (4 arcs @180ms to nearest un-hit target within 3 manhattan on the GLOBAL grid — fighters + all turrets/decoys/walkers; arc into the caster heals 10), glacial_step (frozen_tile on both fighters' cells + column-constrained random blink), tidal_read (7s hammer-warning fuse on the cell 4 ahead → 85 + 1s stun, empty = 3 mana refund), cascade_lock (NEW `flood_tile` on the enemy grid's 4 corners — fast-tick non-consuming random 1-cell shunt via `_apply_flood_shunt`, records last_move_direction so ice chains).

**Kindlekit pass (DONE):** cinder_rush (Iai-pattern rush), meteor_knuckle (interruptible 2s channel, one-shot damaged cancel + 3-mana refund), ember_guard (5s damaged-listener stance), immolation_point (NEW `TimedEffect.harms_owner` flag + 0.25s positional poll driving an "immolation" ×1.5 dealt buff + mana boost), cremate (any-owner burn census, 10 flat each). **Aegis Pillar now tinted PURPLE** via new `Wall.set_tint(color)` (user amend — per-wall duplicated material, safe with the flash).

**BURN STATUS (user design, July 2026):** poison's fire twin on Combatant — `apply_burn(duration, dot, source)` / `is_burned()` / `_tick_burn` (fire-typed ticks), **plus ×1.2 damage taken while burning OR standing on a burn tile that would burn you** (`BURN_VULN_MULT` in take_damage via `battle_ctx.burn_tile_under`). Immunity = `immune_burn` trait key (Can't Be Burned now carries it, honoring its description) or the `burn_immune` buff — blocks status AND vulnerability. Ember flickering halo + BURN popup; bullet rider `status_id = "burn"`. Cinder Rush now applies real burn (no more poison-machinery stand-in).

**Dandeox pass (DONE):** seedbind (NEW `seed_trap` tile — dormant 3s/armed to 6s, contact = ROOT 2s + heal 25, fast-tick + drag support, visual brightens on arm), nightbloom (5s stance: heal 50% of hits taken + blind attacker 3s), creeping_row (NEW `creeping_vine` tile on enemy's row — gravity stickiness via extended `_is_gravity_tile_at` + 5 dark/s), mimic_shroud v1 (1 HP decoy Turret with caster sprite at first free adjacent cell, 4s, mirrors movement deltas via 0.15s poll; KILL pays 35 HP + 2 mana — lifetime expiry pays nothing since Turret expiry doesn't emit destroyed), rot_harvest (status census stun/poison/silence/blind/root/burn on both fighters: 20 if enemy statused, heal 15×total, 3+ = 2s stun).

**Gozo pass (DONE) shipped the BONUS CARD system**: `Combatant.bonus_card` + `grant/clear_bonus_card` + `play_bonus_card` (outside the deck/discard cycle), HandPanel 3rd CardView (visible only while granted), battle KEY_3. Reused next by Rewind Fork (Drakecho). Also new: `blessed_tile`, positional taken-mult via `battle_ctx.blessed_tile_under`, `Combatant.flat_reduction` (+`blocked("absorbed")` refund path), `Battle.register_aegis`/`aegis_pillar_of`, Consecrate once-per-battle via huge `cooldown_ms`.

### CURRENT PRIORITIES (user-set, July 2026)
1. ~~**Blind + Root statuses**~~ — **DONE (July 2026).** Dandeox 3rd-hit blind rider, Gozo root volley, Tinder Nerves all live.
2. ~~**Port the CATCH mechanic**~~ — **DONE (July 2026).** C key throws a lasso-style line 4 tiles forward on the player's row (walls don't block — lasso semantics; first combatant connects). 3 mana per throw + 1s CD; whiffs and TOO STRONG connects spend the mana (the blinking `◈ CATCHABLE! (C)` tag on the enemy panel — `CombatantPanel.show_catchable`, enemy panel only — tells you when to throw). Window = HP ≤ ceil(25% max); 1.5s frozen attempt (`_catch_pause` gates `_process` + player input incl. charged SPACE) with struggle wobble → chance `clamp(0.9 − 0.5·hp/threshold, 0.4, 0.9)` → success = capture shrink + purple "CAUGHT <NAME>!" banner (battle over, ESC out); fail = "BROKE FREE!" and combat resumes. **The caught copy keeps the trait it fought with** (visible on its panel → informed hunting; deliberate deviation from React's fresh roll — flag if unwanted). Instances stored in `SceneManager.caught_mons` (`{"id", "trait_index"}`, duplicates encouraged, no "already caught" block, session-scoped until save/load). Mon Menu detail pane shows `CAUGHT ×N — trait, trait` per species; per-copy rows + partner-instance selection land with the menu-gating pass. Poison-killing-the-target mid-attempt aborts safely; catching from phantom cells works via `_project_forward`.
3. ~~**Mon Menu instance selection + gating + debug mode**~~ — **DONE (July 2026).** Menu shows ONE ROW PER CAUGHT COPY (`Slime · Amorphous`), each copy fields its LOCKED trait via `SceneManager.current_partner_instance` → `partner_trait_index(id)` → `Combatant.apply_def(def, forced_trait_index)`. Uncaught species = single dim row (selectable while `SceneManager.debug_unlock_all` = true — DEFAULT ON until the quiz ships; refused + grey when off). **T (debug-only, user decision)** cycles traits deterministically: copy rows rewrite the instance; species rows cycle `debug_trait_overrides` absent→0→1→2→absent (battle respects overrides). TEAM count in roster title; detail pane shows THIS COPY'S TRAIT / CAUGHT ×N / DEBUG TRAIT → name. Enemies still roll fresh.
4. ~~**Opening scene (starter select)**~~ — **DONE (July 2026, user simplified: no quiz, direct pick).** `intro.tscn` + `scripts/intro.gd` is now the MAIN SCENE: Factions map backdrop (`art/UI/factions_map.png`, copied from repo-root Factions.png) dimmed under a dark overlay, animated uncle (5 frames extracted from `art/npc/test idle - uncle.gif` via Swift/ImageIO → `uncle_idle_0..4.png`, 0.22s cadence, 4×) lit by an additive radial spotlight, welcome dialog, 5-starter card row (←/→ or A/D + ENTER). Confirm = `record_catch` with a 40/40/20 roll + partner set to that instance → overworld with gating live (`debug_unlock_all` now defaults **OFF**). **ESC on the intro = dev skip**: flips `debug_unlock_all` ON and enters the overworld with the old all-mons workflow.
5. ~~**A new area**~~ — **ZONE 2 SHIPPED (July 2026).** The main map is now "zone 1"; zone 2 = `BlockTile_1783783028.glb` (desert: sandy floor, red-rock walls, cacti-as-trees, brown encounter grass, sandy-gradient return pad). **Zone system:** `SceneManager.current_zone` + `spawn_at_portal`; overworld swaps the map instance in `_load_zone_map()` (zone 1 stays the .tscn-baked instance); `TileType` gained `PORTAL_ZONE2` (zone 1 texture `_9`, the green gradient — was FLOOR) + `PORTAL_ZONE1` (zone 2 texture `_3`) — both walkable ground. **Texture classification:** zone 2's GLB embeds its textures, so they're extracted as loose reference PNGs `BlockTile_1783783028_0..4.png` (indices 12–16 in `TEXTURE_INDEX_TO_KIND`) — GridBuilder's content-fingerprint matching resolves embedded textures against them (pixel-art .import files generated to match). **Transitions:** arriving on a portal pad fades to the other zone and spawns you on the matching return pad; `_portal_armed` prevents bounce-back until you step off. **Encounters:** same 20% grass trigger both zones; battle roll zone 1 = 1% starter else zone-1 pool; zone 2 = 1% starter / 15% zone-1 crossover / 84% zone-2 native (user spec). HUD label shows the zone. **5 zone-2 natives added** (catchable, in the Mon Menu, `MonsterRoster.ZONE2_IDS`, uniform roll — rarity weighting later): Droopider (mind 70, mons.xlsx row 5), Insidibear (dark 95, row 18), Mosseer (grass 85, **row 10** mole "fortune telling earth guardian" — row 19 is DEARLY, an unported future elk), Wherewolf (dark 80, row 20), Jester (light 75, row 120 "glowing eyed angel").

**ZONE 3 SHIPPED (August 2026 — garden town, `BlockTile_1786792549.glb`):** 21 embedded textures extracted to loose refs `BlockTile_1786792549_0..20.png` (project root, pixel imports, md5-rule ctex paths) = **indices 17-37** in `TileType.TEXTURE_INDEX_TO_KIND` + `GridBuilder.TILE_REF_PNGS`. Classification (geometry census + eyeball): lawns 22/33 + cobbles 25 + unused flower 36 = FLOOR; grey stone walls 23/24, **flat glass floor panels 17 (_0) = FLOOR** (Aug 2026 fix — census showed 62 horizontal top faces, no vertical; was wrongly WALL and blocked the walkable glass grid in front of the steps + far right), greenhouse roof/slopes 34 (_17, angled+vertical only) stay non-floor, planks 29, doorway 30, raised grey structures 35, **flag assembly 26/27/28 (poles, finial, royal standard) and plant pots 19 = WALL** (user spec: flags + pots block); hedges 20, potted foliage 31→corrected, pines 32, unused fern 21 = TREE; **grass tuft 31 (_14) = ENCOUNTER_GRASS**, mossy **glass floor 34 (_17) = FLOOR** (Aug 2026 fix — 34 was wrongly ENCOUNTER so glass floors triggered battles); green gradient pads 37 = PORTAL_ZONE1 (all three exit pads return to zone 1). **Walkability fix (same pass):** `TileGrid.is_walkable` now blocks on the cell's TOP-surface KIND (WALL/TREE/CLIFF) so SHORT props (plant pots, planters, low hedges) block — the old height-only rule (`absolute_top_y − ground > 1.5`) missed them; genuine ground tops (floor/lawn/cobblestone steps) stay walkable regardless of tall glass/wall geometry bleeding in from neighbours (that bleed was wrongly blocking the cobblestone STEPS). UNKNOWN cells keep the legacy height heuristic so zones 1-2 are unchanged. **Step-aware amend (Aug 2026):** grey stone (img 6 / global 23) is reused for BOTH tall walls AND the garden staircase (horizontal step tops at 0.5/1.0/2.0/3.0/4.0m + 178 vertical faces), so it can't be one flat kind. `is_walkable` uses a shared `_surface_y(cell)` (the cell's own top face when its kind is set, else inferred ground) for both walkability AND `cell_to_world`, so the player rides step tops instead of sinking. Rules: `has_tree`/`has_water` block (foliage billboards block even on a floor tile); WALL/CLIFF are a walkable STEP only when their surface is within a small riser (`STEP_RISER` 0.7m) of a neighbour's surface (`_is_step`) — real walls/roofs jump 1m+ and stay solid; ground kinds always walkable; UNKNOWN keeps the legacy `absolute_top_y` height veto. Player MAX_STEP 1.5 still gates the actual climb. BFS-verified: doorway landing reachable, building roof not, trees block, no spurious blocks in the plaza. Also flat glass floor panels (img 0 / global 17) corrected WALL→FLOOR — census showed 62 flat tops, no verticals (greenhouse ROOF/slopes are the separate img 17 / global 34). **Routing:** zone 1 has THREE green pads (all kind PORTAL_ZONE2) — the SOUTH pad (world z≈12, others z≤4.5; `ZONE1_SOUTH_WORLD_Z` 8.0 split via `_grid.cell_to_world`) now leads to **zone 3**, the rest still to zone 2. `SceneManager.portal_from_zone` (set in `_travel_to`) lets `_find_portal_spawn` land returns on the matching pad: zone3→zone1 lands on the south pad, zone2→zone1 on the others, zone1→zone3 lands on the exit cluster with the smallest x+z (the zone-1-facing pad). **Encounters:** `ZONE3_POOL` (uniform after the 1% starter roll). **5 zone-3 natives added (Aug 2026, `MonsterRoster.ZONE3_IDS`, in `load_all` → Bestiary):** Krrrrin (fire 90, horse, mons.xlsx row 26 "engine horse/steam"), Gilga (light 75, living sword), Astragio (time 75, starry owl, row 28 "night and stars"), Baarister (time 105, sheep judge), Trikits (mind 70, zen fox). **Normal bullet basics + empty traits (bespoke basics/traits per-mon later, user).** Decks = 5 type-matched existing cards each: Krrrrin = Cinder Rush/Meteor Drop/Flame Breath/Explosive Skin/Cremate (all fire); Gilga = Lunge/Fleche/Riposte/En Garde/Holy Ground (kingfencer sword kit, light); Astragio = Chronofracture/Rewind Fork/Sonar Jam/Swoop/Psybeam; Baarister = Chronofracture/Rewind Fork/Judgment Slab/Glare/Meteor Drop; Trikits = Mind Spike/Psybeam/Telekinesis/Mind Jam/Refract (all mind). NOTE: TIME type has only 2 non-placeholder cards in the whole game (both Drakecho's), so both time mons share Chronofracture+Rewind Fork and fill the rest thematically — flagged for the per-mon refinement pass. ZONE3_POOL now = the 5 natives + pixie/mosseer/slime/malipole (9, uniform). HUD label reads ZONE 3 automatically. **Empty decks + trait pools and plain bullet basics by design** — their sheet basics (droopider sleep-on-3rd ✓, insidibear rage/laser ✓, mosseer 5-hit force-shuffle ✓, wherewolf charged shadow-strike ✓, jester 3-ammo piercing beam ✓ — ALL FIVE DONE) — only their card decks remain.
6. ~~**Team system + tabbed Mon Menu + in-battle swap**~~ — **DONE (July 2026).** `SceneManager.team` = up to `TEAM_SIZE` (3) indices into `caught_mons`; `team[0]` = lead = overworld partner + battle starter (`_sync_partner_to_team`). New catches auto-join while there's room; `team_toggle(instance)` adds/removes (won't drop below 1). **Mon Menu rewritten with two tabs (TAB switches):** PARTY (your caught copies only — or all species in debug; ENTER toggles team membership, ★=lead / numbered slots) and BESTIARY (all 28 species; caught show normally with ×N, uncaught = greyed silhouette via `_sprite_rect.modulate` + "???", read-only dex). **Decks render as cards 3-per-row** (`_make_mini_card` GridContainer, reuses `CardView.type_color`). **Battle T-swap:** cycles `SceneManager.team` mid-fight (`_try_team_swap`, 3s CD `TEAM_SWAP_CD_MS`) — each member banks its own HP/mana in `_team_member_state`, statuses/buffs wiped by `apply_def` (the tactical cost). Player cards scooted right in battle.tscn (offsets 56/456) so CRT curvature doesn't clip their readability. NOTE: lead = first team member added; change lead by removing+re-adding (v1). KO of the active member is still defeat (no faint-swap yet).
7. **Zone-2 mons — basics + traits (one mon at a time).** **Insidibear ✓ DONE (July 2026):** basic `rage_shot` two-mode (calm slow 2-ammo slug 8 / raging = ammo-free stunning laser 12 + 1s stun 3s CD via basic_cd); every 3rd landed hit → RAGE (`_apply_rage`: cards ×1.2 via NEW cards-only `all_card_mult` buff key, 15s, red halo + **rage-sprite swap** — `insidibear_rage.png`, restored on buff expiry via new `buff_expired` hook or by apply_def on swap). Traits: Shift Change (swap-out heal 15%, applied before banking), Short Fuse (rage at battle start AND swap-in, 10s + takes ×1.2 — folded into `_apply_rage`), Inside Job secret (benched → ghost paces behind enemy grid, pot-shots 6 dmg/2s when enemy in his row + rear 2 cols; recalled when he swaps back in). **Droopider ✓ DONE (July 2026):** NEW Sleep status (blocks actions + pauses AI like stun, but ANY damage wakes it; indigo halo + Zzz popup; `immune_sleep` key). NEW `Bullet.pierce_walls`. Basic `sleep_shot` (weak 8, pierces walls, every 3rd landed hit → sleep 3s). Traits: Night Terror (basic that wakes a sleeper stuns 0.5s, via `last_hit_woke_sleep`), Waking Dream (instant hand-refresh while opp asleep), Nightmare secret (LIVE since the deck pass — one random mind card per match sleeps 3s on every play). Deck still empty. **Mosseer ✓ DONE (July 2026, row 10 — earlier notes wrongly said row 19/card-swap; that's DEARLY, a future mon):** basic `seer_shot` "Fortune Shot" (weak 6, 5-ammo clip + 0.5s `basic_cd`, "always up"); every 5th landed hit → `_mosseer_fortune_proc`: victim's hand FORCE-SHUFFLED into their deck (new `Combatant.force_shuffle_hand()` — literal hand→deck→shuffle→redraw, both panels refresh via hand_changed) + one-shot `seer_charge` buff (next grass CARD +10 via new `card_type_flat_<type>` buff key + `Combatant.buff_card_flat_bonus`, added after the mult stack in `_final_card_damage`, consumed by post-play hook 3c, 15s). Traits: **Green Thumb** (card_type_heal_grass 2 — pure data), **Earthen Ward** (earth card that DAMAGES the enemy → Guarded 3s; post-play hook 2b arms 6s window `Battle._earthen_ward`, damaged hook pays), **Fortune Told** secret (3 forced shuffles → permanent grass ×1.5, `Combatant.forced_shuffles`). **Wherewolf ✓ DONE (July 2026, row 20):** basic `charged_shadow` "Shadow Strike" — hold SPACE, release: greyed semi-transparent ghost (`_make_shadow_ghost`) one column behind the opponent, 0.5s telegraph, then strikes the CAST-TIME cell (dodgeable) for 18 full / 9 early + 1s sourced stun, 3s CD; AI always full-charge. Traits: **Lingering Shadow** (swap-out leaves a prowling shadow on the enemy grid — contact = 1s stun, spent; Inside-Job-pattern spawn/tick/free + swap bookkeeping), **Opportunist** (strike vs already-stunned crits ×2), **Phantom Fang** secret (replaces the basic: vanish 2s on release + boomerang shadow out-4-back at 8/leg — outbound shoves victim to their REAR column, return drags to FRONT; `_fang_displace` slides stop at walls/turrets, record last_move_direction). **Jester ✓ DONE (July 2026, row 120) — ALL FIVE ZONE-2 BASICS + TRAITS SHIPPED:** basic `jester_beam` "Halo Beam" (jester.tres reload_ms 5000): 3-ammo sequential row sweep (`_basic_jester_beam` — _project_forward path, 0.1s/cell tween, `_spawn_beam_segment` visuals), 12 DMG, ignores blocks entirely, blind rolled once per sweep. Traits: **Limelight** (beam hits apply `limelight_mark` — victim buff taken ×1.2 all sources 3s, gold halo), **Bright Ward** (beam hit that lands damage → `grant_guarded` 1.5s), **Afterglow** secret (heal_font under caster's cast-time cell 3s per beam). **ICE RULE CHANGE (same pass):** ALL frozen tiles are persistent — slips never consume them (timed_effect tick + drag branches), lifetime-only expiry, standardized 4s (Icage ice-spike miss 6000→4000; claw/hex/glacial were already 4000). **ZONE-2 DECKS WIRED (July 2026, 7 shared-verbatim cards each — user rules: no renames/retypes, starter bespoke cards off-limits, hex_tiles may repeat):** Droopider = icage Mind Spike/Telekinesis + Goo Trap + Vine Snare + Lily Pad Trap + Silence Bomb + Event Horizon · Insidibear = Punch/Slash/Cross Counter/Bullet Punch/Blood Drain/Vampiric Mist/Lasso · Mosseer = Vine Snare/Leafstorm/Friend of the Forest/Wall/Topple/Crush Earth/Hex Tiles (3 grass for Green Thumb; Topple+Crush Earth trigger Earthen Ward) · Wherewolf = Shadow Dive/Slash/Blood Drain/Sonic Screech/Vanish/Iai/Glare (Glare stun → Opportunist crit) · Jester = Holy Ground/Healing Font/Stunning Gleam/Lunge/Riposte/Blink/Hex Tiles. **Nightmare is now LIVE** (user rule: ONE mind card per match — `Battle.is_nightmare_card` rolls it at random from the holder's mind cards on their first mind-card play, fixed for the battle; post-play hook 3d sleeps the opponent 3s on every play of that card). **Remaining: 3 unique cards per zone-2 mon.**
8. **Revisit traits (18 originals)** — replace trait pools from mons.xlsx columns I/J/K using the sheet↔game row mapping above. Survey per mon and LIST BEFORE IMPLEMENTING. Several starter-trait systems (Blind, attacker-context mults, status prolong) will be reused here.
9. ~~**Zone 4 + Hallie rival + 3v3 battle**~~ — **DONE (August 2026, built in 3 chunks).** **Chunk 1 (zone 4 map):** `BlockTile_1787352578.glb` grey room (floor y≈1.0), untextured default material classified by face orientation in GridBuilder (up→FLOOR, vertical→WALL, only when `_albedo_texture_of(mat)==null`); it reuses zone 3's texture palette so only its 3 UNIQUE brick-floor PNGs are referenced (global 38/39/40 → FLOOR), the 16 dupes fingerprint back to zone-3 kinds. Camera override `overworld.ZONE_CAMERA_YAW` (zone4 65°, sitting in the open SE quadrant — walls run N+W per the GLB vertical-face census); player input yaw shifted by the zone delta so screen-relative controls still match. Entry/return are POSITION-based (no portal tiles): zone3→zone4 at the doorway landing (world x∈[3,5], z≤1.2), zone4→zone3 by walking back onto `_zone4_entry_cell`. **Chunk 2 (Hallie NPC + dialog):** animated rival billboard (`art/npc/rival_idle_0..4.png`) at `_find_room_center()`; SPACE while adjacent → dialog → confirm calls `SceneManager.build_rival_team()`, sets `rival_battle=true` + `next_battle_enemy_id=rival_team[0].id`, changes to battle. `SceneManager.rival_team` = up to 3 `{id, trait_index:-1}`; slot 0 is a mon whose type counters a random player-team type (`_TYPE_WHEEL`). **Chunk 3 (the 3v3, battle.gd):** `_ready()` detects `SceneManager.rival_battle` → captures `_enemy_team`/`_enemy_team_dead`, applies slot-0 trait, consumes the flag. **Enemy swap-on-faint** — `_on_enemy_died()` marks the slot dead and, if any of Hallie's mons remain, calls `_enemy_swap_to(next, false)` (reloads the SAME `_enemy` node via `apply_def`, restores banked HP/mana if that mon was benched earlier, resets position + swap-punch; enemy panel & enemy hand refresh via `apply_def`'s trait/hand/mana signals) — victory ONLY when her last mon dies. **Enemy AI-switch** — `_enemy_try_switch()` rolls `ENEMY_SWAP_CHANCE` (15%) per card-AI beat, `ENEMY_SWAP_CD_MS` 6s cooldown, banks the outgoing mon, not while stunned/asleep. **Player symmetric faint-swap** — `_on_player_died()` → `_player_faint_swap()` fields the next living `SceneManager.team` member (benched mons never take damage, so the only dead one is the KO'd active mon; tracked in `_player_team_dead`); defeat ONLY when the whole team is down. **Ready/Set/Go countdown** — `_start_countdown()` (rival battles only) sets `_countdown_active`: `_process` early-returns (enemy AI + status ticks frozen) but the movement input branch is untouched, so the player may reposition; all ability inputs (SPACE/1/2/3/C/T + charged-SPACE) gated by `not _countdown_active`. Losing is unchanged (defeat banner → ESC returns to zone 4, Hallie still there to re-fight). New battle.gd state: `_rival_battle`, `_enemy_team`, `_enemy_team_index`, `_enemy_team_dead`, `_enemy_team_state`, `_enemy_swap_cd_until_ms`, `_player_team_dead`, `_countdown_active`.

### Later backlog
- ~~Enemy AI plays cards~~ — **DONE (July 2026).** Enemy card AI in battle.gd: jittered cadence (`enemy_card_interval_min/max` 3.5–5.5s @exports, first cast at `enemy_first_card_delay` 4s), random playable card from its 2-card hand via the same `can_play`/`play_card`/`MoveRegistry.execute` path as the player — all handlers are side-aware so effects mirror automatically. Granted bonus cards (enemy Shatter/Return) get a 50% look-in per beat. Stun pauses the card timer; silence spends the beat. **Enemy hand is VISIBLE top-right** (second HandPanel instance, 0.6 scale, refresh hint hidden) and **both hands play a 0.5s slide-up-and-vanish ghost flourish** on every card played (`HandPanel.play_flourish`). Enemy plays announce via a type-colored "⚡ CARD" popup + fading top-center label. Known cosmetic gaps: enemy zone-steal can't phantom-walk its stolen column; smarter card heuristics = later.
- NPCs + trainer dialog · Monster Dex · Starter selection · XP + upgrade · Save/load
- Hogglin's original Clawingsword card could be re-added as pure data (handler exists via Kingfencer's Fleche)
- Mushroom's Sleep Spores trait is inert (his basic fires no shots) — revisit in the traits phase

## Known issues / quirks

- **`battle_stub.tscn/.gd`** is vestigial — safe to delete.
- **Enemy card AI is random** — no heuristics yet (doesn't save mana for big turns or react to your HP). Cadence tunable via @exports on the Battle root.
- **`clawingsword` (Hogglin)** intentionally skipped — advancing-projectile mechanic not yet ported. Affects Kingfencer's `fleche`.
- **3 sprite placeholders** for Lemmel/Dragone/Fudo (sub for canonical Rat King/Bat/Statinu — user prefers these).
- **Background GLB position** heavily user-tuned. Don't auto-overwrite.
- **Orphan card .tres files** in `data/moves/` from early test decks. See godot-port-state memory for the list. Safe to delete for cleanup.
- **Pre-existing integer-division + `basis` shadow warnings** in battle.gd — harmless noise.

## How to verify the build

1. Open `godot game files/monster-battle-grid/project.godot` in Godot 4.4.
2. Press F5 → intro (starter select; ESC = dev skip with all mons unlocked) → overworld. **M** opens the Mon Menu.
3. Step on grass tuft → 20% encounter chance.
4. Battle controls: **SPACE** basic (or hold for charged mons), **1/2** play card, **3** bonus card, **C** catch, **T** team-swap, **R-hold 2s** refresh hand (5s cooldown), **B/H** debug damage, **ESC** return.
5. **Rival 3v3:** catch a 2–3 mon team, go to zone 4 (via the zone-3 doorway landing), SPACE to talk to Hallie → confirm → Ready/Set/Go (move but no abilities during it) → beat her mon 1, she sends mon 2, etc.; win = down all 3, and your own KO'd mons auto-swap to the next living team member (lose only when your whole team is down). The `build_rival_team` console log prints her slot-0 counter type.

**End-of-battle banners are animated (July 2026):** `battle._show_result_animation(kind, subtitle)` cycles hand-drawn GIF frames (art/UI/victory_0-4, defeat_0-7, catch_0-7 .png, extracted from the .gifs via Swift/ImageIO) on a looping tween — victory (enemy died), defeat (player died), catch (catch success, mon name as subtitle). `_show_result_banner` text version kept as a load-failure fallback.

**Bullet visual (July 2026):** bullet.tscn's placeholder sphere replaced with the user's tracer sprite (`art/battle art/bullet-sprite.png` — Sprite3D, billboard, nearest, pixel_size 0.045). The tracer points RIGHT; bullet.gd flips `Sprite.flip_h` per-frame from `direction.x`, so ricochet reversals and ice-spike homing turns stay correct. All bullets share it (basics, cards, turret/guard shots, Inside Job pot-shots).

**CRT filter (July 2026):** `shaders/crt_filter.gdshader` on a full-screen ColorRect in SceneManager (CanvasLayer 127, just under the layer-128 fade) — screen-space post-process over EVERY scene: barrel curvature 0.045, soft scanlines (18%, every 3px, curved with the glass), slight bloom (low-mip squared, 0.22), chromatic fringe, vignette + brightness compensation. All knobs are shader uniforms. **V toggles it at runtime** (SceneManager._input so blanket-consuming scenes can't eat it; `SceneManager.crt_enabled`).
5. Console prints `[CARD]` lines for every effect; status popups (STUN/POISON/SILENCE/ABSORB) confirm wiring.
