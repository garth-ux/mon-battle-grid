# Cards Reference — Godot Port

All cards currently implemented, organized by monster. Damage values + mana costs follow React App3D.tsx where applicable, **except where the user has redesigned the card** — those divergences are flagged below.

For trait + stat data not covered here, see `mons.xlsx` in the project root.

## Effect ID glossary

These are the dispatch cases in `MoveRegistry.execute()`. Adding a new card = author a `.tres` with one of these `effect_id` values; or add a new case + handler.

| effect_id | Mechanic |
|---|---|
| `slash_arc` | 3-cell vertical arc on column 1 forward from caster (`range_tiles` = lateral width) |
| `pierce_line` | N cells forward on caster's row, staggered visuals (`range_tiles` = depth) |
| `punch` | Single cell 1 forward |
| `beam` | Row sweep from caster forward through combined grid until enemy wall. **`caster_lock_ms`** on the MoveDef applies a self-stun at cast time (used by Scimark's beam) |
| `bomb` | Contact mine 2 cells forward — 40 DMG on contact |
| `time_bomb` | Delayed-fuse + 3×3 AoE. Center `damage` / ring `damage/4` after 1.5s fuse |
| `boomerang` | 3 forward + random ±1 row shift + return. Catch returns to hand slot 0 |
| `dash_attack` | Tween caster `caster_offset` cells forward + damage at new front cell |
| `displace` | Hit front cell + tween target by `target_displacement` |
| `lasso` | 3-cell scan forward; pull opponent to opponent grid (0,py); drag-through-tiles fires their effects |
| `wall` | Place 1 block at front column + optional self_heal |
| `wall_column` | 4-block vertical column at depth 2 forward |
| `topple` | Consume own wall → staggered beam projectile (40 DMG); 1 mana refund if no wall |
| `self_buff` | Halo with stat multipliers. `self_buff_id`: armor, battle_cry, charge, overcharge, guard_below_half |
| `self_heal` | Heal `self_heal` HP |
| `place_tile` | Drop `tile_effect_id` 1 cell forward |
| `slime_trail` | 2 random heal_font puddles on caster's grid |
| `slime_ball` | Pierce 2 + poison_trap at deeper cell |
| `dissolve` | acid_pool at OPPONENT's current cell |
| `goo_trap` | Random poison_trap on enemy grid |
| `toxic_wave` | 4-cell row sweep on enemy's row at caster's y |
| `venom_spit` | poison_trap at 4 cells forward (clamps closer at boundary) |
| `flying_sword` | Beam sweep on opponent's row at opponent's y (homing) |
| `thorn_shield` | Reactive: next enemy bullet blocked + 30 DMG retaliation straight |
| `vine_snare` | Random vine_snare tile on enemy grid (10 DMG + 3.4s stun) |
| `reap` | 3-cell ±1 row band at depth 2 + push hits toward caster |
| `call_family` | 2 turrets at caster's back corners (yellow ally sprite) |
| `call_soldier` | 1 roaming turret 1 forward (pink ally sprite) |
| `cone_attack` | 1 cell at depth 1 + 3 cells at depth 2 (±1 row) — cone shape |
| `conditional_heal` | Heal `self_heal` if opponent is stunned OR poisoned |
| `quickdraw` | 2× speed bullet at `damage` |
| `ricochet` | Bullet that reverses at far edge for 2nd pass |
| `dust_devil` | 4 cells cardinally adjacent to the CASTER (user amend — was mirrored onto enemy grid); fwd/back neighbors cross the boundary |
| `thunder_clap` | 12-cell CCW perimeter sweep on opp grid at 220ms cadence |
| `shock_therapy` | 4 cells adjacent to CASTER + clears ALL TimedEffect tiles |
| `teleport` | Snap caster to random safe cell on own grid |
| `fairy_ring` | 2 forward-walking mushroom allies; drop poison_trap on cells left |
| `silence_bomb` | Contact mine 2 forward — 10 DMG + 3s silence |
| `absorb_poison` | Cure self + 3s window: poison tiles HEAL instead of damage |
| **`rat_pack`** | 2-cell front punch, 10 DMG each + rat_dmg_bonus (Rat Flood trait) |
| **`trash_toss`** | Thrown projectile to depth 3. Hit → 10 DMG; miss → wandering rat on enemy grid that explodes on contact |
| **`street_swarm`** | Up to 4 rats spawn at caster's cardinal adjacents, random-forward walk + contact dmg + self-destruct |
| **`plague_bite`** | 2-cell front melee, 20 DMG + 5 DMG/s × 5s poison rider |
| **`scavenge`** | +2 mana to caster |
| **`medical_mouse`** | 1 roaming heal rat (20 HP) on caster grid, drops holy_tile every 3s |
| **`poison_swarm`** | 3 rats from cardinal adjacents, random_forward_walker + poison_trap trail + 5 contact DMG |
| **`tongue_whip`** | 3-cell forward scan, first wall OR combatant hit; 15 DMG + 2s stun (pink rope visual) |
| **`random_hop`** | Tongue-style scan; on hit, 5 DMG + teleport target to random safe cell on their grid |
| **`hex_tiles`** | Drop 2 random tiles on depths 1+2 forward. 1/8 each: vine_snare, contact_bomb, acid_pool, frozen_tile, burn_tile, stun_tile, broken_tile, block_tile |
| **`lily_pad_trap`** | 2 vine_snare tiles at random cells of enemy's center 2×2 |
| **`spawn_tadpole`** | 1 tadpole walker, forward + opp-y homing, 10 DMG on contact + self-destruct |
| **`frog_chorus`** | 5s buff: each damage event rolls random 1.1-2× dealt mult |
| **`croak_blast`** | Slow forward row sweep (300ms/cell) on caster row, 20 DMG/cell |
| **`sonar_jam`** | 2s mana boost (regen 2×) + if opp on caster's row, silence 2s |
| **`swoop`** | Segmented forward beam from caster row, 15 DMG/cell + push 1 cell on hit |
| **`blood_drain`** | 5-cell forward scan, first hit 10 DMG + caster heals 10 |
| **`shadow_dive`** | Both fighters dash to their front column; 10 DMG if same row |
| **`vampiric_mist`** | vamp_mist tile at opp's current cell (3 DMG/s + 2 heal/s × 3s) |
| **`divebomb`** | Rush across row. Hit (combatant or wall): 60 DMG + 30 self. Miss: nothing. Slow tween back; caster cell stays at origin, still hit-vulnerable |
| **`lob_bomb`** | Slow rolling bomb (8 u/s). Contact → plus-AoE 10 DMG/cell. Friendly fire enabled |
| **`hammer_down`** | Wind-up cone slam, 50 DMG. Cone = contact cell at depth 1 + 3-wide head at depth 2 (both variants). Default (Atomippo Gravity Slam): 2s freeze + pulls opp 1 cell toward caster at t=1s/t=2s. `hammer_faithful` (Giant): 1.5s freeze, no pull |
| **`meteor_drop`** | 1.5s delayed plus-AoE 2 cells forward. 40 center / 10 cardinals |
| **`zone_steal`** | Claim opp's front column for 3s. Push opp off + 20 DMG + 1.5s stun. DoT col (5 DMG/s) on opp's next col — `zone_no_dot` (Giant) skips the DoT col. Caster can walk on stolen tiles via extended `_player_cell.x = GRID_COLS`. Opp blocked. Cleanup: caster-remain → 10 DMG + 1s stun + push back |
| **`event_horizon`** | Place gravity_well_tile on opp grid's center 2×2 for 3s. Combatants on these cells need 2 movement commands to leave |
| **`graviton_beam`** | Beam sweep + 500ms caster lock + push opp 1 cell forward on hit. If pinned (grid edge or blocked), +15 wall-bonus DMG |
| **`sword_dive`** | 4-cell forward pierce on caster row. Walls AND combatants in path each take 35 DMG, pierce never stops |
| **`tidal_wave`** | 2-row wave (rows 1 & 2, always) from caster's back col, sweeps all 8 cols @ 250ms cadence. 15 DMG/cell. Per-row independent wall-stop |
| **`iai`** | Rush across row. Combatant hit: 40 DMG + 30 DMG horizontal slash 1 cell behind collision (3 cells ±1y). Wall hit: 40 to wall, no slash, no self. Total miss: 20 self. Slow tween back |
| **`water_breathing`** | 8s buff: heal 5 HP/s × 8 ticks + water cards ×1.5 + frozen-immune (passes through frozen_tile without slip + without consuming) |
| **`boulder_roll`** | Slow rolling boulder (0.45s/cell) down caster's row. 30 contact DMG (spent, no blast). Wall-registered while rolling (blocks movement, soaks bullets/beams). 20-DMG pool, ANYONE's bullets damage it (real damage, no friendly skip; card wall-hits = 10). Pool empty OR block impact → plus-blast 15 (center + 4 cardinals, cross-grid, hits BOTH fighters, removes blocks, chips other boulders) |
| **`earthquake`** | Shatters every block on BOTH grids (boulders survive). Each fighter takes 15 × blocks that stood on THEIR field — location decides, not owner. Self-damage deliberate. Flat per-block (no dealt mults) |
| **`brick_break`** | Smash the nearest block (any owner, not boulders) within depths 1-2 forward on caster's row + heal 15. Own block consumed silently (Topple-style, no destroyed signal); enemy block killed with destroyer credit. No block → 1 mana refund |
| **`vanish`** | 2s intangibility to basic/bullet attacks ONLY — bullets skip vanished combatants and fly on. Cards/tiles/contact damage still land. Sprite at 0.45 alpha (Combatant.vanish_until_ms) |
| **`friend_of_forest`** | 3 telegraphed line strikes on opp grid, 2s apart (land ~1s/3s/5s). Each rolls a random perimeter cell + inward direction (corners 2-way), cascading green ring telegraph 1s ahead, then 80ms/cell sweep at 10 DMG. Stop-at-wall: first non-friendly block takes the hit + halts that line |
| **`flame_breath`** | Row beam (move.damage) + 3 burn_tiles at random columns on the ENEMY grid at caster's row, 4s (dupes possible). Generic — Modizard runs it water-typed; Fudo's future version can be fire |
| **`arcane_bolt`** | Chasing bomb (scripts/arcane_bolt.gd): spawns 1 fwd, hunts opp for 5s (1 cardinal step/0.6s, re-aimed each step, detours around walls, stalls if boxed). Contact or timeout → 50 to center occupant + 5 splash on 4 cardinals (combatants only, both sides). Unshootable — kite it |
| **`exlice`** | Telegraphed X centered 3 fwd of caster (depth 3 + diagonals at depths 2/4, rows ±1). Red rings 2s → each cell takes move.damage (20). No caster freeze. Per-cell wall-eats-hit |
| **`fire_and_ice`** | Persistent toggle: caster's monster_type + every water/fire card in deck/hand/discard swap water↔fire until re-cast or battle end. `Combatant.toggle_fire_ice` privatizes (duplicates) the cards first — shared .tres never mutate |
| **`shed_skin`** | Self-stun status_duration_ms (3s) + heal self_heal (15) every second of it |
| **`explosive_skin`** | 5s buff: `card_type_mult_fire` = buff_mult (1.3×) + `burn_immune` (burn_tiles free). Combos with fire_and_ice — swapped water kit counts as fire |
| **`gravity_well`** | Grabbakat redesign: 4 gravity_well_tiles on opp's FRONT column for 8s + Gravity Slam's pull (opp dragged 1 cell toward caster every 1s × 8, wall/edge guarded). Tiles keep Event Horizon stickiness. No direct damage |
| **`shield_bash`** | Punch 1 fwd, move.damage (30) + stun rider (0.5s). While caster has Armor: ×1.5 |
| **`gain_armor`** | Caster gains move.armor_gain Armor (Barrier 15, Flex 5). Armor = bonus HP consumed before real HP; stacks, no decay, battle-scoped. Grey flash halo; pool shown on the panel HP line |
| **`cross_counter`** | Jab 1 fwd (move.damage 15) + 3s stance: FIRST damage taken auto-fires a counter at depths 1+2 — 40 DMG + 1s stun (walls eat their cell). One-shot, halo clears on trigger/timeout |
| **`bullet_punch`** | Self-stun 1.5s; sequentially punch EVERY tile ahead to the far edge (evenly spread over the 1.5s), move.damage (20) per tile. Walls eat their own cell's punch, flurry continues |
| **`guardian_stance`** | Heal self_heal (15) + wall column at DEPTH 1 (hugging, vs Wall card's depth 2). Blocks have 2 HP (+wall_bonus_hp); occupied cells are skipped, never overwritten. Kingfencer's En Garde aliases this |
| **`glare`** | Channel: self-stun 1.5s + 4 distinct random opp-grid tiles get warning rings. At 1.5s each marked tile strikes — move.damage (10) + status rider (3s stun). Ignores walls (psychic) |
| **`earth_armor`** | Instant +armor_gain (25) Armor + 5s buff with `card_type_heal_earth: 3` — every earth card played heals 3 via the execute() post-play hook (self-triggers once on cast). Hook is generic: future Dark Tithe/Time Sip reuse the `card_type_heal_<type>` key |
| **`crush_earth`** | Plus centered depth 3. Opponent anywhere in the plus is shoved onto the CENTER (only if center is on their grid + unblocked), then 0.5s later the center slams whoever stands there for move.damage (50). Telegraphed with warning rings |
| **`mind_spike`** | Single homing psychic orb (Turret walker): spawns 1 fwd, Street-Swarm drift toward enemy, move.damage (10) contact + self-destruct, 10 HP shootable, 5s life |
| **`clawingsword`** | Advancing slash: sweeps caster's row across both grids @90ms/cell. Combatants take move.damage (30), slash passes through; FIRST block (any owner, boulders too) is demolished and consumes the sweep. Kingfencer Fleche; retro-available for Hogglin |
| **`sanctified_ground`** | Gozo: bless own grid's centre 2×2 (blessed_tile ×4). Standing on your own blessed tile = taken ×0.7 (positional read in take_damage) + 3 HP/s. Soaking 45 damage inside shatters the blessing |
| **`aegis_pillar`** | Gozo: 40 HP wall at depth 3 (falls back 2→1 if occupied; whiff = 1 mana refund) + grants the SHATTER **bonus card on key 3** |
| **`aegis_shatter`** | The granted card: pillar's REMAINING HP as flat damage to combatants + turrets on its 8 same-grid neighbours; pillar dies WITH destroyer credit (Stonebreaker heals). Card auto-retires if the pillar falls |
| **`judgment_slab`** | Gozo: 3s telegraphed fall on the enemy's cast-time cell — 35 (55 if caster untouched AT IMPACT) + broken_tile rubble 4s |
| **`litany_of_stone`** | Gozo: 3s channel — self-ROOT, incoming hits −25 flat (absorbed hits refund 1 mana, full absorbs pop "ABSORBED"), row Beam pulse 20 each second ×3 |
| **`consecrate`** | Gozo, once per battle (huge cooldown_ms): heal 25 + consume ALL caster terrain (blessed tiles, rubble, standing walls — boulders exempt, silent Topple-style) → 15 flat × count to the enemy |
| **`cinder_rush`** | Kindlekit: Iai-style row rush. Enemy: 45 + the real BURN status (2/s × 5s + ×1.2 taken vuln). Wall: 10 recoil + self-stun 1.5s punish window. Miss: free out-and-back |
| **`seedbind`** | Dandeox: seed_trap on the enemy's cast-time cell. Dormant 3s (dim moss), ARMED 3–6s (bright green): first non-owner contact → ROOT 2s + planter heals 25 |
| **`nightbloom`** | Dandeox: 5s damaged-listener stance — heal back 50% of every hit taken + BLIND the attacker 3s |
| **`creeping_row`** | Dandeox: creeping_vine tiles across the enemy's CURRENT row 4s — gravity-well stickiness (2 commands to leave, `_is_gravity_tile_at` extended) + 5 dark DMG/s |
| **`mimic_shroud`** | Dandeox v1: 1 HP decoy Turret wearing the caster's sprite on a RANDOM free adjacent cell (whiff = 1 mana refund), 4s lifetime, mirrors the caster's movement deltas (0.15s poll) AND copies the caster's basic shots (Battle._mimics registry → _spawn_basic_bullet mirror at 12 dmg). KILLED (not timed out) → caster heals 35 + 2 mana. Card-mirroring still deferred |
| **`rot_harvest`** | Dandeox: enemy with ANY status takes 20; heal 15 × active statuses on BOTH fighters (stun/poison/silence/blind/root/burn census); enemy at 3+ statuses also stunned 2s |
| **`undertow`** | Klawr: row scan (lasso semantics) — first enemy takes 20 + dragged 1 cell toward caster; drag blocked by wall/grid edge = +15 crush instead |
| **`ripple_chain`** | Klawr: 4 arcs of 10 @180ms, each to the NEAREST un-hit target within 3 tiles (manhattan, global grid) — enemy, ANY turret/decoy/walker, or the caster (heals 10 instead). Dissipates when nothing's in range |
| **`glacial_step`** | Klawr: frozen_tile (4s) on caster's cell + enemy's cell, then blink to a random free cell in the caster's COLUMN (packed column = ice only, no blink) |
| **`tidal_read`** | Klawr: warning ring on the cell 4 ahead (clamps closer at the edge); detonates at exactly 7s — 85 + 1s stun to the occupant, or 3 mana refunded if empty |
| **`cascade_lock`** | Klawr: flood_tile on the enemy grid's 4 corners, 5s — non-owners entering are shunted 1 random free cell (non-consuming) |
| **`static_tick`** | Drakecho: 1-mana fast electric bolt down the row for 15; spikes to 40 if 2 OTHER cards were played in the last 3s (`Combatant.card_played_times`, appended by the post-play hook AFTER the handler — the current cast never counts itself) |
| **`rewind_fork`** | Drakecho: records tile + HP in `Battle._rewinds`; RETURN bonus card on key 3 (2 mana) for 4s — snap back to the tile (skipped if walls/turrets claimed it) + restore HP UP TO the recorded value (never self-damages). Timeout retires the card |
| **`overclock`** | Drakecho: 5s of ×3 mana regen (`Combatant.mana_boost_factor` — Sonar Jam stays ×2), then the crash: 6s self-silence |
| **`thoughtsiphon`** | Drakecho: psychic wall-ignoring hit — target with 3+ mana takes 20 + loses 3 (via `steal_mana`, Essence Drinker pays); a starved target takes 45 + 2s stun instead |
| **`chronofracture`** | Drakecho: bomb on the enemy's cast-time cell with a PUBLIC Label3D countdown (8s) — 80 centre + 40 cardinals at detonation, caster heals 50% of what actually landed |
| **`meteor_knuckle`** | Kindlekit: 2s self-stun windup, growing orange halo. ANY damage taken cancels + refunds 3 mana (one-shot damaged listener). Release: 75 ahead (walls eat it); empty → 25 shockwave on the 3-wide arc at depth 2 |
| **`ember_guard`** | Kindlekit: 5s stance — every damage event you receive drops a standard burn_tile (3s) under the enemy's current cell |
| **`immolation_point`** | Kindlekit: burn_tile on your OWN cell 8s with `harms_owner = true` (new TimedEffect flag — burns its caster; Explosive Skin's burn_immune cancels the downside). 0.25s poll: standing on it = "immolation" buff dealt ×1.5 + Sonar-Jam-style mana boost; stepping off consumes the buff |
| **`cremate`** | Kindlekit: consume every burn_tile on the field (any owner, Immolation's included) → 10 flat each to the enemy in one hit |

## Tile effect_ids (used by `place_tile` + special handlers)

| tile_effect_id | Behavior |
|---|---|
| `holy_tile` | Heals any occupant 3 HP/s |
| `heal_font` | Heals OWNER only 3 HP/s |
| `poison_trap` | React-accurate combo: 10 DMG + 3.4s stun + 5.6s poison → self-destruct (100ms tick) |
| `acid_pool` | 2 DMG/tick to non-owner (1s tick) |
| `vamp_mist` | **3 DMG/tick to non-owner + 2 heal/tick to owner** (bumped from React's 2/1 for Dragone's Vampiric Mist) |
| `contact_bomb` | First non-owner contact: 40 DMG + self-destruct |
| `vine_snare` | First non-owner contact: 10 DMG + 3.4s stun + self-destruct |
| `silence_bomb` | First non-owner contact: 10 DMG + 3s silence + self-destruct |
| **`frozen_tile`** | **PERSISTENT ice (July 2026 user rule)**: every non-owner crossing slips the victim 1 cell along their `last_move_direction`; slips never consume the tile — it expires by lifetime only (standard 4s everywhere: claw hits, hex rolls, glacial step, ice-spike misses). **Frozen-immune combatants (Water Breathing) pass through without slip.** |
| **`burn_tile`** | 2 fire-typed DMG/sec to non-owner |
| **`stun_tile`** | First non-owner contact: 1s stun (no damage) + self-destruct |
| **`broken_tile`** | No tick action. Blocks combatant movement via `Battle.combatant_blocked_at` (bullets + cards pass through). Red X visual |
| **`gravity_field`** | 5 mind-typed DMG/sec to non-owner. Used by Crushing Field's DoT col |
| **`gravity_well_tile`** | No tick action. Triggers `Combatant.gravity_pending` toggle so leaving costs 2 movement commands. Purple-blue tint |
| **`stolen_tile`** | Giant's tile-steal basic: amber claimed ground, 5s. Anyone can stand on it; non-owner ticks 2 earth DMG/s. Player-owned stolen tiles on the enemy grid open the multi-column phantom (`_player_cell.x = GRID_COLS + col`) so Giant can walk his claims; stranded past the front column on expiry = forced home + 2s stun |
| **`blessed_tile`** | Sanctified Ground: pale-gold glow, heals the OWNER 3/s while standing on it; taken ×0.7 lives in take_damage (positional), the 45-damage break in Battle's damaged listener. 60s lifetime (effectively until broken/consecrated) |
| **`seed_trap`** | Seedbind: dormant moss-green 0–3s (inert), brightens when ARMED — first non-owner contact (tick or drag) roots 2s + heals the owner 25 + consumes. Expires at 6s |
| **`creeping_vine`** | Creeping Row: bruised-violet vine tile — gravity-well stickiness (movement gate) + 5 dark DMG/s to non-owners |
| **`flood_tile`** | Cascade Lock: churning pale-blue water — non-owner standing on it is shunted 1 random free cell (fast tick, non-consuming; fully-boxed victims stay put). Shunts record last_move_direction so ice can chain-slide |

---

## Completed mons (18 of 18) — PORT COMPLETE

### Icage — 80 HP ice, 8 cards
Mind Spike (mind 2 — homing psychic orb walker, no rat), Telekinesis (mind 3 — Grabbakat's gravity_well tile+pull, identical card different name), Psybeam (mind 3 — beam 20), Regenerate (ice 2 — heal_font tile 5s @ standard 3 HP/s), Mind Jam (mind 3 — sonar_jam reskin), Wall + Absorb + Bounce (shared verbatim). Traits: Cold Focus / Sure Footing / Phoenix Heart.

### Kingfencer — 75 HP light, 8 cards
Lunge (light 2 — quickdraw 25), **Fleche** (light 2 — clawingsword, the game's final new handler), Wing Dance (wind 3 — flying_sword reskin), Riposte (light 2 — thorn_shield reskin), En Garde (light 3 — guardian_stance), Slash + Lasso + Swoop (shared verbatim). Traits: Fleche Tempo / Extended Lunge / Stunning Touche (all basic-attack traits — wire in the basic-attack pass).

### Fudo (React "Statinu") — 120 HP earth, 12 cards
Guard-dog tank. Punch + Bomb + Slash (shared dark, verbatim per user), Wall + Topple (shared earth), Dust Devil (earth, 20 DMG on 4 cells around caster's mirror — first user of the dormant `_dust_devil` handler), Flame Breath (fire .tres on the Modizard handler), Guardian Stance (NEW: heal 15 + 2-HP wall column at depth 1, gaps only), **Glare** (mind 3: channel 1.5s → 4 marked tiles, 10 + 3s stun), **Brick Break** (shared `giant_brick_break.tres`), **Earth Armour** (earth 4: +25 Armor + earth cards heal 3 for 5s), **Crush Earth** (earth 4: plus at depth 3, shove to center, 0.5s slam for 50). Combo line: Glare's 3s stun → Crush Earth guaranteed slam. Traits: Loyal Heart / Guard Dog / Warding Aura.

### Grabbakat (id `grunt`) — 100 HP fighting, 12 cards
Armor-brawler; display rename only (files stay grunt.*). Plasma Shot (shared `plasma_shot.tres`), Shield Bash (30 + 0.5s stun, ×1.5 while armored), Capacitor (shared — was "Overcharge"), Shock Therapy (shared — was "EMP Blast"), Barrier (fighting, +15 Armor), Gravity Well (user redesign — 8s front-column gravity tiles + 1 cell/s pull), Power Surge (beam 20), Topple (shared), Cross Counter (jab 15 + 3s counter stance → 40 + 1s stun at depths 1-2), Brick Break (shared `giant_brick_break.tres`), Flex (+5 Armor), Bullet Punch (1.5s self-stun row flurry, 20/tile). Traits: Iron Grip / Clinch / All In.

### Modizard — 90 HP water (all-water spellkit), 12 cards + guard basic
Arcane Bolt (5 mana chasing bomb — user redesign), Arcane Storm (beam 20 + stun reskin), Rune Trap (goo_trap reskin), Mana Siphon (scavenge reskin, 0 mana), Blink (teleport reskin), Flame Breath (beam + 3 burn tiles), Wall (shared hog_wall), Absorb (shared conditional_heal), **Exlice** (fighting, 3 mana telegraphed X), **Fire and Ice** (fire, 2 mana water↔fire toggle), **Shed Skin** (water, 2 mana self-stun 3s + 15/s regen), **Explosive Skin** (fire, 2 mana: fire cards ×1.3 + burn-immune 5s). **Basic = `guard_builder`**: 1 ammo → stationary guard turret at rear column of caster's row, max 2, 15 HP, 5 DMG shot / 2s. Traits live: Bomb Lobbers (guard shots 12), Pickpockets (guard hits siphon 2 HP via Bullet.steal_heal). Combo line: Fire and Ice → whole kit turns fire → Explosive Skin boosts everything 1.3×.

### Giant — 120 HP earth, 9 cards
Hammer Down (`hammer_faithful`: 1.5s freeze, no pull), Topple (shared `topple.tres`), Wall (shared `hog_wall.tres` column), Zone Steal (`zone_no_dot`), Boulder Roll, Earthquake (10 mana field-nuke), Brick Break, Vanish (3 mana / 8s CD), Friend of the Forest (grass-typed). User-designed second half: boulder/earthquake/vanish/FotF are original cards, not React ports.

### Cargot — 115 HP earth, 11 cards
Earth/snail tank. Broadsword, Skewer, Salt Armor, Battle Cry, Shell Bash, Holy Ground, Slime Smash* (test), Acid Spray* (test), Slime Shove* (test), Shell Block, Slime Trail.

### Slime — 60 HP mind, 8 cards
Slime Ball, Slime Trail, Dissolve, Bounce, Goo Trap, Absorb, Toxic Wave, Venom Spit.

### Hogglin — 90 HP grass, 7 cards
Block-builder basic. Leafstorm, Spore Cloud, Wall (4-block column), Topple, Flying Sword, Thorn Shield, Vine Snare. Skips clawingsword.

### Lunapra (id `cowboy`) — 100 HP dark, 9 cards
Slash, Beam, Punch, Bomb, Lasso, Boomerang (catch + Horn Catch heal), Quickdraw, Ricochet, Dynamite (time_bomb).

### Pixie — 75 HP wind, 6 cards
Absorb, Healing Font, Stunning Gleam, Call Family, Reap*, Call Soldier*.

### Toadazer — 85 HP electric, 8 cards
Stun Gun, Live Wire, Thunder Clap (12-cell CCW perimeter), Capacitor (overcharge), Shock Therapy, Absorb, Bounce, Plasma Shot.

### Mushroom — 70 HP grass, 4 cards + charged_walker basic
Absorb Poison, Bomb, Silence Bomb, Fairy Ring. Basic = 1.5s charge → spawn mushroom_soldier from caster's cell with 5 contact DMG + poison_trap trail.

### Lemmel — 80 HP time, 7 cards
Rat Pack (2-tile front punch, 10 DMG each, +Rat Flood bonus), Trash Toss (proj to depth 3; miss → wandering rat), Street Swarm (up to 4 rats from caster's cardinal adjacents, random-forward walk + 10 contact DMG + self-destruct), Plague Bite (2-cell melee + 20 DMG + 5/s × 5s poison), Scavenge (+2 mana), Medical Mouse (heal rat ally + holy_tile every 3s), Poison Swarm (3 rats + poison_trap trail + 5 contact DMG).

### Malipole — 85 HP mind, 9 cards + charged_bullet basic
Tongue Whip, Mud Slap, Absorb, Random Hop, Hex Tiles (8-roll), Spawn Tadpole, Frog Chorus, Croak Blast, Lily Pad Trap. Basic = 1.5s charge → bullet; 3 consecutive hits → 3s frenzy (random 1.1-2× dealt mult).

### Dragone (Bat) — 45 HP dark, 9 cards
Sonic Screech (beam), Wing Slash (punch), Sonar Jam, Swoop, Blood Drain, Shadow Dive, Vampiric Mist, Divebomb, Lob Bomb.

### Atomippo — 130 HP mind, 8 cards
Gravity Slam (hammer_down), Meteor Drop, Crushing Field (zone_steal), Event Horizon, Wall (shared earth), Topple (shared earth), Graviton Beam, Absorb.

### Scimark — 110 HP water, 9 cards
Sword Dive, Tidal Wave, Slash (shared dark), Beam (scimark_beam with caster lock), Lasso (shared dark), Wall (shared earth), Topple (shared earth), Iai, Water Breathing.

---

## Starter mons (5, July 2026 — `mon battle grid_starters.xlsx`)

Decks are **existing cards shared verbatim** (no reskins — the doc's bespoke designs come later). 1% wild spawn rate; in the Mon Menu like everyone else.

### Kindlekit — 85 HP fire — BESPOKE DECK LIVE (10 cards)
**Bespoke 5 (starters doc)**: Cinder Rush (fire 3), Meteor Knuckle (fighting 7, 75 dmg per user), Ember Guard (fire 2), Immolation Point (fire 6), Cremate (fire 9, 10/burn per user). **Existing 5**: Explosive Skin (immunity to his own fires!), Flame Breath (fudo), Thorn Shield, Exlice (modizard fighting), Cross Counter (grunt). Basic: bullet — every 3rd damaging hit burns the victim's tile (3s burn_tile). Traits: Tinder Nerves (LIVE) / Predator Instinct (dormant) / Warm Glow (LIVE). Combo lines: basic+Ember Guard+Immolation seed burns → Cremate cashes them; Explosive Skin before Immolation = free empowerment.

### Dandeox — 85 HP grass — BESPOKE DECK LIVE (10 cards)
**Bespoke 5 (starters doc)**: Seedbind (grass 2), Nightbloom (grass 5), Creeping Row (dark 4), Mimic Shroud (dark 5, v1), Rot Harvest (dark 8). **Existing 5**: Vampiric Mist, Plague Bite, Silence Bomb, Spore Cloud, Leafstorm. Basic: bullet — every 3rd landed hit BLINDS 2s. Traits: Lingering Rot (dormant) / Petal Float (dormant) / Mana Thief (LIVE). Combo line: Plague Bite/Silence Bomb/basic-blind seed statuses → Rot Harvest cashes them (3+ = stun).

### Gozo — 105 HP light, 2-ammo — BESPOKE DECK LIVE (10 cards)
**Bespoke 5 (starters doc)**: Sanctified Ground (light 4), Aegis Pillar (earth 3 — grants SHATTER on key 3), Judgment Slab (light 6), Litany of Stone (earth 5), Consecrate (light 7, once per battle). **Existing 5**: Brick Break (giant), Topple (eats his own pillar!), Guardian Stance (fudo), Stunning Gleam, Healing Font. Basic: `stun_volley` — 2-shot clip, the clip-emptying shot ROOTS 1s on hit, then reloads. Traits: Phasing Light (dormant) / Stonebreaker Faith (LIVE — pays on Shatter too) / Sanctuary (dormant). Combo lines: Pillar→Topple or Pillar→Shatter; terrain hoard→Consecrate.

### Klawr — 95 HP water — BESPOKE DECK LIVE (10 cards)
**Bespoke 5 (starters doc)**: Undertow (water 2), Ripple Chain (water 5), Glacial Step (ice 2), Tidal Read (ice 6), Cascade Lock (ice 8). **Existing 5**: Tidal Wave, Water Breathing (frozen-immune — walks his own ice), Croak Blast, Bounce, Absorb. Basic: `charged_claw` — tap = 2-tile claw, **every landed hit FREEZES the victim's floor** (user amend — they slide the way they were travelling); full charge = 4 tiles + frozen depths 3-4 even on empty cells. Claw ice (like ALL ice now) is persistent — 4s, slips on every crossing. Traits: Tidal Memory (dormant) / Brine Body (LIVE) / Depth Charge (LIVE — boosts the whole bespoke kit). Combo lines: Cascade/Glacial ice-litter + Water Breathing immunity; Undertow drag → Tidal Read's marked tile.

### Insidibear — 95 HP dark (zone-2 native, cards TBD)
Basic `rage_shot` "Grudge Shot", two modes: calm = weak (8) SLOW slug on a 2-ammo clip; every 3rd landed hit → **RAGE** (red halo + user's rage-mode sprite swap, cards ×1.2 via the new cards-only `all_card_mult` buff key, 15s or until swapped) and while raging the basic becomes a **stunning laser** (fast 12 + 1s stun, 3s CD, ammo-free). Traits: **Shift Change** (swap-out heals 15% max HP, banked) / **Short Fuse** (starts battle AND every swap-in raging — but rage runs 10s and he takes ×1.2 while it burns) / **Inside Job** secret (swapped out, a ghost of him paces BEHIND the enemy grid and pot-shots them — 6 dark dmg, ~2s cadence — when they share his row and stand in their rear 2 columns; rejoining the fight recalls the ghost). **Deck (7 shared verbatim, July 2026):** Punch, Slash, Cross Counter (grunt — the grudge counter), Bullet Punch (grunt — the rage flurry), Blood Drain, Vampiric Mist, Lasso (mob rope); rage's cards-×1.2 loves the fighting hits. +3 uniques later.

### Mosseer — 85 HP grass (zone-2 native, cards TBD)
mons.xlsx **row 10** — mole, "fortune telling earth guardian" (row 19 is DEARLY, a different future mon). Basic `seer_shot` "Fortune Shot": weak (6) bullet on a 5-round clip + 0.5s CD (the sheet's "always up"); every **5th landed hit** FORCE-SHUFFLES the opponent's hand back INTO THEIR DECK (literal reading — they redraw, same cards possible; both hand panels refresh via `hand_changed`) and grants Mosseer a one-shot **seer_charge** buff: next grass CARD +10 flat (`card_type_flat_grass` key read in `_final_card_damage` after the mult stack, consumed by post-play hook 3c, 15s, re-proc refreshes). Traits: **Green Thumb** (grass cards heal 2 on play — pure data on the card_type_heal hook) / **Earthen Ward** (an earth card that DAMAGES the enemy grants Guarded 3s — post-play hook 2b arms a 6s window on Battle, `_on_damaged_trait_hooks` pays it on earth-typed damage to the opponent; trait re-checked at pay time) / **Fortune Told** secret (after forcing **3** shuffles in one battle → grass cards ×1.5 for the rest of the match — permanent buff, gold halo; counter `Combatant.forced_shuffles`, reset on swap by apply_def). **Deck (7 shared verbatim, July 2026):** Vine Snare, Leafstorm, Friend of the Forest (giant) — 3 grass casts feed Green Thumb; Wall (hog), Topple, Crush Earth (fudo) — Topple + Crush Earth damage the opponent so Earthen Ward triggers; Hex Tiles (the fortune-teller's random fate). +3 uniques later.

### Jester — 75 HP light (zone-2 native, cards TBD)
mons.xlsx **row 120** — lemur "glowing eyed angel". Basic `jester_beam` **"Halo Beam"** (user-edited from the sheet's 8s CD): **3-ammo, 5s reload** light beam that sweeps **tile-by-tile down jester's row** (100ms/cell, `_spawn_beam_segment` visuals) across both grids and **ignores blocks entirely** — no stop, no chip. 12 DMG on the combatant it crosses (dodgeable by changing rows); blind rolls once per sweep. Traits: **Limelight** (beam hits MARK the victim 3s — `limelight_mark` taken-mult buff ×1.2 from ALL sources, gold halo, re-mark refreshes) / **Bright Ward** (a beam hit that LANDS damage grants the caster Guarded 1.5s — sheet's "(shielded)" mapped to the Guarded system) / **Afterglow** secret (each beam drops a 3s `heal_font` under jester's cast-time cell — owner-only 3 HP/s, so he drinks it by holding his ground). **Deck (7 shared verbatim, July 2026):** Holy Ground, Healing Font (stay-put heals double down on Afterglow), Stunning Gleam, Lunge + Riposte (kingfencer light), Blink (modizard — trickster escape), Hex Tiles (pranks). +3 uniques later.

### Krrrrin — 90 HP fire (zone-3 native)
mons.xlsx **row 26** — engine/steam horse. Basic `ram_shot` "Ram": a 30-damage straight-line charge down the row that rams the FIRST enemy or non-owner wall, then slowly recoils to the start tile over **3s** (the recoil IS the 3s cooldown via `basic_cd`). Logical cell stays home (rush pattern — `_basic_ram`/`_ram_impact` tween position only); charge homes to the pre-scanned target. **Movement-locked during the whole charge+recoil** (`Combatant.rush_until_ms`/`is_rushing()`, honoured by both player input and the enemy AI) so it can't snap around mid-return — Krrrrin stays out of position and **takes damage normally (bullets hit its world position): the recoil is the punishable window.** Damage via `_basic_attack_damage` (blind can whiff it). Traits (all fire on damaging an ENEMY): **Bracing Charge** (Guarded 3s through the recoil — halves incoming cards + basics) / **Cinder Trail** (burn tiles on every cell of the charge lane, 4s) / **Searing Brand** secret (enemy BURNED 30s: fire DoT + ×1.2 taken; cleared early only by a team swap, which apply_def wipes). Deck (5 fire): Cinder Rush, Meteor Drop, Flame Breath, Explosive Skin, Cremate.

### Wherewolf — 80 HP dark (zone-2 native, cards TBD)
mons.xlsx **row 20** — wolf "with a shadow of a man". Basic `charged_shadow` **"Shadow Strike"** (col L name): hold SPACE (standard 1.5s charge) → release: a **greyed semi-transparent wherewolf ghost** (`_make_shadow_ghost`) appears one column BEHIND the opponent (extrapolates past the back edge), and **0.5s later** lunges at the opponent's **cast-time cell** — DODGEABLE by moving during the telegraph. Full charge = **18** + 1s sourced stun; **early release = 9** (half, user rule); 3s CD (`basic_cd`). Enemy AI always gets the full-charge version (it can't hold SPACE). Feeds `on_basic_hit`. Traits: **Lingering Shadow** (on T-swap-out his shadow prowls the enemy grid — random adjacent step every 0.9s; the enemy sharing its cell → 1s stun + "SHADOW GRIP!" + shadow spent; recalled on swap-back, respawns next swap-out; Inside-Job-style bookkeeping) / **Opportunist** (Shadow Strike vs an ALREADY-stunned target crits ×2 + "CRIT!" popup — checked before the strike's own stun) / **Phantom Fang** secret (REPLACES the basic: any release launches a boomerang shadow out 4 and back along his row @130ms/cell + the wolf **vanishes 2s on release** [existing Vanish: bullets pass through, cards still land]; 8 DMG once per leg — **outbound hit shoves the victim to their REAR column, return-leg hit drags them to their FRONT column**, slides stop at walls/turrets/broken tiles and record `last_move_direction` so ice chains; same 3s CD). **Deck (7 shared verbatim, July 2026):** Shadow Dive, Slash, Blood Drain, Sonic Screech (the howl), Vanish (giant — shadow-melt), Iai (killing lunge), Glare (fudo — predator stare, 3s stun **sets up Opportunist crits**). +3 uniques later.

### Droopider — 70 HP mind (zone-2 native, cards TBD)
Basic `sleep_shot` "Sleepnosis": weak (8) bullet that PIERCES walls/structures (`Bullet.pierce_walls`); every 3rd landed hit → Sleep 3s (`on_basic_hit` hub). Traits (all LIVE except the secret's card half): **Night Terror** (basics that WAKE a sleeper — via `last_hit_woke_sleep` — stun 0.5s) / **Waking Dream** (hand refresh is instant while the opponent sleeps — HandPanel `begin_hold` early-out) / **Nightmare** secret — **LIVE (July 2026)**: ONE mind card per match carries the nightmare (user rule) — rolled at random from all his mind cards the first time he plays any mind card (`Battle.is_nightmare_card`, battle-scoped so it survives team swaps), then every play of THAT card sleeps the opponent 3s via post-play hook 3d (any damage still wakes them — his own delayed orb/tile hits trade the nap for the hit). **Deck (7 shared verbatim, July 2026):** Mind Spike + Telekinesis (icage — hypnosis + web-pull; both mind → Nightmare fuel), Goo Trap, Vine Snare, Lily Pad Trap (web nest), Silence Bomb (hypnotic hush), Event Horizon (sticky webbing; mind). +3 uniques later.

### Drakecho — 80 HP time — BESPOKE DECK LIVE (10 cards)
**Bespoke 5 (starters doc)**: Static Tick (electric 1), Rewind Fork (time 6, key-3 RETURN), Overclock (electric 4), Thoughtsiphon (mind 3), Chronofracture (time 10). **Existing 5**: Stun Gun, Live Wire, Capacitor, Thunder Clap, Mind Spike (icage). Basic: bullet — every 3rd hit steals 1 mana. Traits: Chrono Leech (dormant) / Outside Time (LIVE received-side) / Essence Drinker (LIVE — pays on the basic AND Thoughtsiphon). Combo lines: Overclock → card flurry → Static Tick spikes to 40; Rewind Fork before diving in; Thoughtsiphon starves mana → the 45+stun branch.

---

## Status systems

| Status | Field | Affects |
|---|---|---|
| Stun | `stun_until_ms` | Blocks cards + movement + basic attacks |
| Poison | `poison_until_ms` + `poison_dmg_per_tick` | DoT, 1s tick |
| Silence | `silence_until_ms` | Blocks card play ONLY |
| **Blind** | `blind_until_ms` + `roll_blind_miss()` | 20% chance an attack deals 0 — one roll per card (`_final_card_damage`) / per swing (`_basic_attack_damage`), MISS popup at the attacker. Grey eye-height halo. Bullet rider `status_id = "blind"` |
| **Burn** | `burn_until_ms` + `burn_dmg_per_tick` | Poison's fire twin (user design): fire-typed DoT/s, PLUS while burning **or standing on a burn tile that would burn you** all damage taken is ×1.2 (`BURN_VULN_MULT`, folded into the mult via `battle_ctx.burn_tile_under`). Immunity: `immune_burn` trait key or `burn_immune` buff (Explosive Skin) blocks both halves; Can't Be Burned now carries immune_burn. Ember-orange flickering halo + BURN popup. Bullet rider `status_id = "burn"` (dot = status_dot) |
| **Root** | `root_until_ms` | Blocks VOLUNTARY movement only — cards, basics, and forced displacement still work. Brown ground halo. Bullet rider `status_id = "root"` |
| **Sleep** | `sleep_until_ms` + `apply_sleep` / `is_asleep` | Droopider: blocks move/card/basic AND pauses the AI (gated alongside `is_stunned`), self-expires after its duration — but ANY damage that lands wakes it instantly (`take_damage` clears it + sets `last_hit_woke_sleep` for that one call so Night Terror can react). Indigo head halo + "Zzz" popup. `immune_sleep` trait key blocks it |
| Poison absorb | `poison_absorb_until_ms` | Inverts poison tile contact → heal |
| Thorn shield | `thorn_shield_active` bool | Next bullet absorbed + 30 DMG retaliation |
| Iframes | `iframe_until_ms` | Blocks all damage |
| Mana boost | `mana_boost_until_ms` | Mana regen interval halved (Sonar Jam) |
| Charge | `charge_active`, `charge_started_at_ms`, `consecutive_charged_hits` | Malipole charged_bullet combo |
| Gravity pending | `gravity_pending` bool | Event Horizon — 2 commands to leave gravity_well_tile |
| Last move direction | `last_move_direction` Vector2i | Frozen tile slip; updated by Battle.set_caster_cell |
| Buffs | `buffs[]` Array of Dict | dealt/taken mults + extras: `dealt_min`/`dealt_max` (frenzy), `card_type_mult_<type>` (Water Breathing, Explosive Skin, Fortune Told), `card_type_flat_<type>` (Mosseer seer_charge — flat bonus added after the mult stack in `_final_card_damage`), `all_card_mult` (Insidibear rage — cards only, basics unaffected), `frozen_immune` (Water Breathing), `burn_immune` (Explosive Skin) |
| Fire/Ice swap | `fire_ice_swapped` + `_cards_privatized` | Modizard toggle — monster_type + water/fire cards swapped on private card duplicates; battle-scoped |
| Armor | `armor` + `add_armor()` + `armor_changed` | Bonus HP consumed before real HP (absorbs FINAL damage after mults). Damage popup still shows the full hit. Panel HP line appends [+N ARMOR]. Reset each battle |
| Guarded | `guarded_until_ms` + `is_guarded()` | Take 50% less damage (folded into the mult — popups show halved numbers). Sources: timed (card-play trait triggers — type guards 3s, Shadow Step movement 2s, pale-blue halo), permanent (Event Guard once below half HP), positional (Shell Cover — block directly in front, via `battle_ctx`). Reset each battle |
| Vanish | `vanish_until_ms` | Bullets pass straight through (basic/bullet attacks only); sprite ghost-alpha 0.45. Cards/tiles/contact still hit |
| Mana steal | `Battle.steal_mana(taker, victim, amount)` | Shared event: clamps to victim's pool, `spend_mana`/`gain_mana` signals fire, Essence Drinker (heal_per_mana_stolen) pays the taker. Sources: Drakecho's 3rd-hit basic, Mana Thief post-play hook |
| Catch | `Battle._try_catch` (C key) | Lasso-line 4 fwd on player's row (walls don't block), 3 mana + 1s CD. Enemy ≤25% max HP (ceil) → 1.5s frozen attempt (`_catch_pause`) → 90%→40% roll. Success keeps the enemy's battle trait as a new instance in `SceneManager.caught_mons` (duplicates by design) + CAUGHT banner. Enemy panel blinks ◈ CATCHABLE! inside the window |
| Acid heal | `heal_on_poison` on acid_pool ticks | Brine Body/Poison Drinker holders are HEALED by acid_pool ticks (tile stays down); poison-status DoT already healed via _tick_poison |

---

## Pending mons — NONE. All 18 ported.

## Mechanics still to deferred / coming up

- ~~**Guarded buff system**~~ — **LIVE (July 2026)**: all 8 guarded traits work (Levitate, Guarded Mind, Chrono Shield, Guard Dog, Guard Current, Shadow Step, Event Guard, Shell Cover). Card-play hook in execute() + `Combatant.is_guarded()` in the damage pipeline.
- ~~**Card-type heal hook**~~ — **LIVE**: Dark Tithe + Time Sip heal via the same execute() post-play hook as Earth Armour's buff.
- ~~**Combo heal counter**~~ — **LIVE (July 2026)**: `Combatant.basic_hit_count` + `Battle.on_basic_hit` hub (fed by `Bullet.is_basic`). Also live via the same hub: **Extended Lunge** (every 2nd basic hit → 3-wide 15-DMG slash at the victim's column), **Sleep Spores / Stunning Touche** (250ms stun rider on basic shots), **Toadazer charge** (every 3rd basic hit → next electric card ×1.6 via `toadazer_charge` buff; consumed in the post-play hook, **Charge Sip** heals 7 on discharge).
- ~~**Wall-break event**~~ — **LIVE**: Tunnel Rats — `_on_wall_destroyed` now receives the wall (bound arg) and `_release_tunnel_rats` spawns a wandering rat at the broken cell for each trait holder (10 + rat_dmg_bonus contact).
- **Event traits LIVE (July 2026):** Clinch (`apply_stun` gained an optional `source` arg — stunning an enemy heals the stunner 3; all enemy-stunning call sites sourced, self-stuns exempt), Poison Drinker (poison DoT ticks heal instead of damage), Ancient Claim (zone steal 4500ms instead of 3000 when unhit 10s, via `Combatant.last_damaged_at_ms`).
- **Triple Echo LIVE:** `Combatant.cards_played_count` increments in the post-play hook; every 3rd card, 0.5s later, `_echo_strike` bursts at the enemy's current cell for 10 untyped DMG (unavoidable, React-faithful). **With this, all 54 traits in the game are wired.**
- **Clawingsword** — advancing projectile (used by Hogglin's skipped card + Kingfencer's fleche).
- **All card handlers shipped.** Clawingsword landed with Kingfencer's Fleche — Hogglin's originally-skipped Clawingsword card can now be re-added as pure data if desired.

## Architecture notes — recent additions

- **Animated FX sprites (July 2026, user pixel art in `art/battle art/`):** `MoveRegistry._make_fx_sprite` + `_spawn_anim_fx` (billboarded, nearest, unshaded). **Slash** (`_spawn_slash`, 5 frames), **explosion** (`_spawn_explosion_at`, 4 frames — every bomb detonation + meteor drop/boulder-style timed impacts, `scale_peak` sizes the sprite), **beam dart** (`_spawn_beam_segment`, 3 frames — art points RIGHT, enemy casts flip via new `flip_h` param fed by `_emit_beam_segment`/`_topple_emit`/jester), **bomb** (`_make_bomb_marker` 2-frame fuse flicker — dynamite marker, lob bomb roller, and a sprite overlay on contact_bomb/silence_bomb tiles in timed_effect.gd), **punch** (`_spawn_punch`, 4 frames — every melee impact: Punch, Slime Smash, Cross Counter, jabs, wide slices, shadow-strike landings; **flips horizontally when the attacker is the enemy side** — all ~28 call sites pass the caster's side), **teleport portal** (`_spawn_teleport_flash`, 3 frames — departure AND arrival of every teleport: Blink/teleport reskins, Random Hop, Atomippo's warp shot, Glacial Step, Rewind Return; the old punch/explosion flashes at those sites were replaced). Beam art updated to the vertical column gif (July 2026 round 2). **Round 4:** swoop arc gif on `_spawn_swoop_segment` (flips for enemy casts); Kingfencer's thrust + Fleche (clawingsword) hits now use the SLASH anim instead of punches; wherewolf's shadow visuals (Shadow Strike ghost, Phantom Fang shadow, Lingering Shadow) use the dedicated "shadow of a man" 4-frame loop (`MoveRegistry.WWSHADOW_FRAMES`, semi-transparent). **Kingfencer basic reworked:** `charged_thrust` — 1 ammo/2s reload; tap = 2-tile thrust (12), hold SPACE = RUSH SLICE (dash the lane at 20 per target passed, stop at enemy blocks, glide back to the start tile; ammo spent either way; Fleche Tempo's reload trait now bites). **Round 5:** `_spawn_lasso_rope` = tiled chain-link plane (4-frame anim — Lasso, Blood Drain, Undertow, catch throw); **all placed blocks render the user's blocks.glb** (wall.tscn instances it; wall.gd flash/tint now per-surface with emission overlay; boulders keep their sphere).

- **Charged basic attacks** — SPACE press/release flow in battle.gd; `basic_attack_kind.begins_with("charged_")` gates the path. `_fire_basic(shooter, dir, is_charged)` passes the flag to Bullet. `Bullet.is_charged` + `on_charged_hit(shooter)` on Battle increments combo counter; threshold → `MoveRegistry.apply_frenzy_buff` for Malipole.
- **Rush move pattern** — caster tweens forward to landing world position, damage callback fires at landing, then slow tween back to start. Caster's logical cell never changes (stays at origin) so opp can still target them on the return path. Used by Divebomb, Iai, Gravity Slam.
- **Zone steal cross-grid walking** — Battle._zone_steal dict + extended `_player_cell.x = GRID_COLS` phantom cell. `_player_cell_to_world` maps to enemy grid x=stolen_col. `combatant_blocked_at` blocks others but `_try_move_player` bypasses for the owner. Cleanup punishment in `clear_zone_steal`.
- **MoveDef extensions** — `caster_lock_ms` (Scimark beam, Atomippo cards), `is_movement_card` (silent, for Guarded system).
- **Combatant extensions** — `last_move_direction`, `gravity_pending`, `mana_boost_until_ms`, charged-basic combo state, `buff_damage_dealt_mult_for_card(card_type)`, `is_frozen_immune()`.
- **Turret extensions** — `random_forward_walker`, `homing_to_opponent_y`, `tile_drop_interval_s`, `contact_damage`/`contact_label`/`contact_type`/`lifetime_ms`.
- **Wall extensions** — `lifetime_ms` for auto-despawn (Hex Tiles block_tile).
- **TimedEffect extensions** — 4 new effect_ids (frozen_tile, burn_tile, stun_tile, broken_tile) + 2 new behavior tiles (gravity_field, gravity_well_tile). VAMP_TICK bumped to 3 + VAMP_HEAL = 2 (Dragone Vampiric Mist).
