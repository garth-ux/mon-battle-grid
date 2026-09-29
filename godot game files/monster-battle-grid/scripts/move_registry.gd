class_name MoveRegistry

# Phase B is implementing these in passes. Each effect is a small static func.
# Pure data transforms call into TraitRegistry; world side-effects (spawn fx,
# tween, damage application) go through Battle's MOVE REGISTRY API helpers.

const GUARDED_TYPE_MS := 3000        # guarded_on_type_<type> traits
const GUARDED_REPOSITION_MS := 2000  # Shadow Step (movement cards)
const ECHO_EVERY := 3                # Triple Echo — every Nth card
const ECHO_DAMAGE := 10
const ECHO_DELAY_S := 0.5
const SLASH_LIFETIME_S := 0.30
const PIERCE_LIFETIME_S := 0.22
const PIERCE_CELL_DELAY_S := 0.04  # 40ms between cells → "stab pulse" forward
const PUNCH_LIFETIME_S := 0.30
const BEAM_SEGMENT_LIFETIME_S := 0.25
const BEAM_COLUMN_DELAY_S := 0.12  # 120ms cadence (App3D.tsx:4972)
const BOMB_FUSE_S := 1.5            # delay between placement and detonation
const BOMB_EXPLOSION_LIFETIME_S := 0.4
const BOOMERANG_TRAVEL_PER_CELL_S := 0.16  # tween time per cell hop (slower = readable + dodgeable)

static func execute(move: MoveDef, caster, battle: Battle) -> void:
	if move == null:
		return
	if battle == null:
		_log(caster, "[no battle ctx] %s" % move.display_name)
		return
	match move.effect_id:
		"slash_arc":
			_slash_arc(move, caster, battle)
		"pierce_line":
			_pierce_line(move, caster, battle)
		"punch":
			_punch(move, caster, battle)
		"beam":
			_beam(move, caster, battle)
		"bomb":
			_contact_bomb(move, caster, battle)
		"time_bomb":
			_time_bomb(move, caster, battle)
		"boomerang":
			_boomerang(move, caster, battle)
		"wall":
			_wall(move, caster, battle)
		"wall_column":
			_wall_column(move, caster, battle)
		"place_tile":
			_place_tile(move, caster, battle)
		"slime_trail":
			_slime_trail(move, caster, battle)
		"slime_ball":
			_slime_ball(move, caster, battle)
		"dissolve":
			_dissolve(move, caster, battle)
		"goo_trap":
			_goo_trap(move, caster, battle)
		"toxic_wave":
			_toxic_wave(move, caster, battle)
		"venom_spit":
			_venom_spit(move, caster, battle)
		"flying_sword":
			_flying_sword(move, caster, battle)
		"thorn_shield":
			_thorn_shield(move, caster, battle)
		"vine_snare":
			_vine_snare(move, caster, battle)
		"reap":
			_reap(move, caster, battle)
		"call_soldier":
			_call_soldier(move, caster, battle)
		"quickdraw":
			_quickdraw(move, caster, battle)
		"ricochet":
			_ricochet(move, caster, battle)
		"dust_devil":
			_dust_devil(move, caster, battle)
		"thunder_clap":
			_thunder_clap(move, caster, battle)
		"shock_therapy":
			_shock_therapy(move, caster, battle)
		"fairy_ring":
			_fairy_ring(move, caster, battle)
		"silence_bomb":
			_silence_bomb(move, caster, battle)
		"absorb_poison":
			_absorb_poison(move, caster, battle)
		"self_buff":
			_self_buff(move, caster, battle)
		"dash_attack":
			_dash_attack(move, caster, battle)
		"displace":
			_displace(move, caster, battle)
		"lasso":
			_lasso(move, caster, battle)
		"topple":
			_topple(move, caster, battle)
		"self_heal":
			caster.heal(move.self_heal)
			_log(caster, "%s heals %d" % [move.display_name, move.self_heal])
		"teleport":
			_teleport(move, caster, battle)
		"call_family":
			_call_family(move, caster, battle)
		"conditional_heal":
			_conditional_heal(move, caster, battle)
		"cone_attack":
			_cone_attack(move, caster, battle)
		"rat_pack":
			_rat_pack(move, caster, battle)
		"trash_toss":
			_trash_toss(move, caster, battle)
		"street_swarm":
			_street_swarm(move, caster, battle)
		"plague_bite":
			_plague_bite(move, caster, battle)
		"scavenge":
			_scavenge(move, caster, battle)
		"medical_mouse":
			_medical_mouse(move, caster, battle)
		"poison_swarm":
			_poison_swarm(move, caster, battle)
		"tongue_whip":
			_tongue_whip(move, caster, battle)
		"random_hop":
			_random_hop(move, caster, battle)
		"hex_tiles":
			_hex_tiles(move, caster, battle)
		"spawn_tadpole":
			_spawn_tadpole(move, caster, battle)
		"frog_chorus":
			_frog_chorus(move, caster, battle)
		"croak_blast":
			_croak_blast(move, caster, battle)
		"lily_pad_trap":
			_lily_pad_trap(move, caster, battle)
		"vampiric_mist":
			_vampiric_mist(move, caster, battle)
		"sonar_jam":
			_sonar_jam(move, caster, battle)
		"swoop":
			_swoop(move, caster, battle)
		"blood_drain":
			_blood_drain(move, caster, battle)
		"shadow_dive":
			_shadow_dive(move, caster, battle)
		"divebomb":
			_divebomb(move, caster, battle)
		"lob_bomb":
			_lob_bomb(move, caster, battle)
		"hammer_down":
			_hammer_down(move, caster, battle)
		"meteor_drop":
			_meteor_drop(move, caster, battle)
		"zone_steal":
			_zone_steal(move, caster, battle)
		"event_horizon":
			_event_horizon(move, caster, battle)
		"graviton_beam":
			_graviton_beam(move, caster, battle)
		"sword_dive":
			_sword_dive(move, caster, battle)
		"tidal_wave":
			_tidal_wave(move, caster, battle)
		"iai":
			_iai(move, caster, battle)
		"water_breathing":
			_water_breathing(move, caster, battle)
		"boulder_roll":
			_boulder_roll(move, caster, battle)
		"earthquake":
			_earthquake(move, caster, battle)
		"brick_break":
			_brick_break(move, caster, battle)
		"vanish":
			_vanish(move, caster, battle)
		"friend_of_forest":
			_friend_of_forest(move, caster, battle)
		"flame_breath":
			_flame_breath(move, caster, battle)
		"arcane_bolt":
			_arcane_bolt(move, caster, battle)
		"exlice":
			_exlice(move, caster, battle)
		"fire_and_ice":
			_fire_and_ice(move, caster, battle)
		"shed_skin":
			_shed_skin(move, caster, battle)
		"explosive_skin":
			_explosive_skin(move, caster, battle)
		"gravity_well":
			_gravity_well(move, caster, battle)
		"shield_bash":
			_shield_bash(move, caster, battle)
		"gain_armor":
			_gain_armor(move, caster, battle)
		"cross_counter":
			_cross_counter(move, caster, battle)
		"bullet_punch":
			_bullet_punch(move, caster, battle)
		"guardian_stance":
			_guardian_stance(move, caster, battle)
		"glare":
			_glare(move, caster, battle)
		"earth_armor":
			_earth_armor(move, caster, battle)
		"crush_earth":
			_crush_earth(move, caster, battle)
		"mind_spike":
			_mind_spike(move, caster, battle)
		"clawingsword":
			_clawingsword(move, caster, battle)
		"sanctified_ground":
			_sanctified_ground(move, caster, battle)
		"aegis_pillar":
			_aegis_pillar(move, caster, battle)
		"aegis_shatter":
			_aegis_shatter(move, caster, battle)
		"judgment_slab":
			_judgment_slab(move, caster, battle)
		"litany_of_stone":
			_litany_of_stone(move, caster, battle)
		"consecrate":
			_consecrate(move, caster, battle)
		"cinder_rush":
			_cinder_rush(move, caster, battle)
		"meteor_knuckle":
			_meteor_knuckle(move, caster, battle)
		"ember_guard":
			_ember_guard(move, caster, battle)
		"immolation_point":
			_immolation_point(move, caster, battle)
		"cremate":
			_cremate(move, caster, battle)
		"seedbind":
			_seedbind(move, caster, battle)
		"nightbloom":
			_nightbloom(move, caster, battle)
		"creeping_row":
			_creeping_row(move, caster, battle)
		"mimic_shroud":
			_mimic_shroud(move, caster, battle)
		"rot_harvest":
			_rot_harvest(move, caster, battle)
		"undertow":
			_undertow(move, caster, battle)
		"ripple_chain":
			_ripple_chain(move, caster, battle)
		"glacial_step":
			_glacial_step(move, caster, battle)
		"tidal_read":
			_tidal_read(move, caster, battle)
		"cascade_lock":
			_cascade_lock(move, caster, battle)
		"static_tick":
			_static_tick(move, caster, battle)
		"rewind_fork":
			_rewind_fork(move, caster, battle)
		"rewind_return":
			_rewind_return(move, caster, battle)
		"overclock":
			_overclock(move, caster, battle)
		"thoughtsiphon":
			_thoughtsiphon(move, caster, battle)
		"chronofracture":
			_chronofracture(move, caster, battle)
		_:
			_log(caster, "[unimplemented effect '%s'] %s" % [move.effect_id, move.display_name])
	# Post-play hooks — run after every card resolves:
	# 1. Card-type heals: buff-driven (Earth Armour's card_type_heal_earth
	#    window) + trait-driven (Dark Tithe dark +5, Time Sip time +10).
	var type_heal: int = caster.buff_card_type_heal(move.move_type)
	type_heal += TraitRegistry.card_type_heal(caster.traits, move.move_type)
	if type_heal > 0:
		caster.heal(type_heal)
		_log(caster, "%s — card-type heal %d" % [move.display_name, type_heal])
	# 2. Guarded triggers: type-guard traits (Levitate wind, Guard Dog earth,
	#    Guard Current water, Guarded Mind mind, Chrono Shield time — 3s) and
	#    Shadow Step (movement cards — 2s).
	var guard_ms := 0
	if TraitRegistry.guarded_on_type(caster.traits, move.move_type):
		guard_ms = GUARDED_TYPE_MS
	if move.is_movement_card and TraitRegistry.guarded_on_reposition(caster.traits):
		guard_ms = maxi(guard_ms, GUARDED_REPOSITION_MS)
	if guard_ms > 0:
		caster.grant_guarded(guard_ms)
		_log(caster, "%s — GUARDED %dms (trait trigger)" % [move.display_name, guard_ms])
	# 2b. Earthen Ward (Mosseer) — an earth card ARMS a short window; the
	#     guard is only granted if the card then damages the opponent
	#     (Battle._on_damaged_trait_hooks pays it on earth-typed damage).
	if move.move_type == "earth" and TraitRegistry.guarded_on_type_damage(caster.traits, "earth"):
		var ward_battle: Battle = battle
		ward_battle.arm_earthen_ward(caster)
	# 3. Toadazer charge discharge: an electric card spends the charge buff
	#    (its ×1.6 already applied through the card-type buff mult during the
	#    handler) and Charge Sip heals on the release.
	if move.move_type == "electric" and caster.has_buff("toadazer_charge"):
		caster.consume_buff("toadazer_charge")
		var sip: int = TraitRegistry.charge_heal(caster.traits)
		if sip > 0:
			caster.heal(sip)
		_log(caster, "%s — CHARGE unleashed%s" % [move.display_name, (" (Charge Sip +%d)" % sip) if sip > 0 else ""])
	# 3b. Tinder Nerves discharge (Kindlekit starter): a fire/fighting card
	#     spends the one-shot charge gained from taking fire/fighting damage.
	if move.move_type in ["fire", "fighting"] and caster.has_buff("tinder_charge"):
		caster.consume_buff("tinder_charge")
		_log(caster, "%s — TINDER charge unleashed" % move.display_name)
	# 3c. Seer's charge (Mosseer) — a grass card spends the one-shot +10 from
	#     the Fortune Shot shuffle proc (flat bonus already applied through
	#     buff_card_flat_bonus during the handler).
	if move.move_type == "grass" and caster.has_buff("seer_charge"):
		caster.consume_buff("seer_charge")
		_log(caster, "%s — SEER charge spent (+%d landed with it)" % [move.display_name, Battle.SEER_CHARGE_BONUS])
	# 3d. Nightmare (Droopider secret) — ONE mind card per match is the
	#     nightmare card (rolled on the holder's first mind-card play, then
	#     fixed for the battle — Battle.is_nightmare_card). Every play of
	#     THAT card lulls the opponent to sleep. Any damage that lands still
	#     wakes them, including the card's own delayed hits.
	if move.move_type == "mind" and TraitRegistry.sleep_on_mind_card(caster.traits):
		var nm_battle: Battle = battle
		if nm_battle.is_nightmare_card(caster, move):
			var nm_opp: Combatant = battle.get_opponent(caster)
			if nm_opp != null and nm_opp.is_alive():
				nm_opp.apply_sleep(Battle.DROOPIDER_SLEEP_MS)
				_log(caster, "%s — NIGHTMARE: %s drifts off" % [move.display_name, nm_opp.display_name])
	# 4. Triple Echo — every 3rd card played echoes ECHO_DAMAGE at wherever
	#    the enemy stands ECHO_DELAY_S later (unavoidable, React-faithful).
	var caster_played: Combatant = caster
	caster_played.cards_played_count += 1
	# Cast-time history (Drakecho's Static Tick reads "2 others within 3s").
	caster_played.card_played_times.append(Time.get_ticks_msec())
	if caster_played.card_played_times.size() > 8:
		caster_played.card_played_times.pop_front()
	if TraitRegistry.has_echo_card(caster.traits) and caster_played.cards_played_count % ECHO_EVERY == 0:
		var echo_battle: Battle = battle
		var echo_tween := battle.create_tween()
		echo_tween.tween_interval(ECHO_DELAY_S)
		echo_tween.tween_callback(MoveRegistry._echo_strike.bind(echo_battle, caster_played))
		_log(caster, "Triple Echo primed — strikes in %.1fs" % ECHO_DELAY_S)
	# 5. Mana Thief (Dandeox starter trait) — every Nth card played steals mana
	#    from the opponent. Rides the same play counter as Triple Echo.
	var steal_cfg := TraitRegistry.mana_steal(caster.traits)
	if not steal_cfg.is_empty():
		var steal_every := int(steal_cfg.get("every", 0))
		if steal_every > 0 and caster_played.cards_played_count % steal_every == 0:
			var steal_opp: Combatant = battle.get_opponent(caster_played)
			if steal_opp != null and steal_opp.is_alive():
				var got: int = battle.steal_mana(caster_played, steal_opp, int(steal_cfg.get("amount", 0)))
				if got > 0:
					_log(caster, "Mana Thief — stole %d mana" % got)

# === DAMAGE PIPELINE ===

# Outgoing card damage = base × trait dmg_dealt × trait card_mult × buff dealt.
# Floors at 1 so a stacked enemy still chips.
static func _final_card_damage(move: MoveDef, caster) -> int:
	# Blind — one roll per card: 20% chance the whole card whiffs (deals 0).
	if caster.roll_blind_miss():
		return 0
	var base := float(move.damage)
	base *= TraitRegistry.damage_dealt_mult(caster.traits)
	base *= TraitRegistry.card_mult(caster.traits, move.move_type)
	# Card-typed buff mult lets temporary card-type buffs (Water Breathing's
	# 1.5× water) coexist with generic dealt buffs (Frog Chorus frenzy).
	base *= caster.buff_damage_dealt_mult_for_card(move.move_type)
	# Flat card-typed buff bonus (Mosseer's seer_charge: next grass card +10),
	# added after the multiplier stack.
	var flat: int = caster.buff_card_flat_bonus(move.move_type)
	return maxi(1, int(round(base)) + flat)

static func _strike(target: Combatant, dmg: int, move: MoveDef, caster) -> void:
	if target == null or not target.is_alive():
		return
	var src := "%s_%s" % [caster.display_name.to_lower(), move.id]
	target.take_damage(dmg, move.move_type, src)
	# Status rider — stun (lasso, leafstorm, etc.) or poison (slime_ball,
	# plague_bite, etc.). Other statuses (freeze, wet, shock, sleep, burn)
	# still wait on their own systems. Skipped if the hit killed the target.
	if not target.is_alive() or move.status_duration_ms <= 0:
		return
	match move.status_id:
		"stun":
			target.apply_stun(move.status_duration_ms, caster)
		"poison":
			var dot := move.status_dot if move.status_dot > 0 else 1
			target.apply_poison(move.status_duration_ms, dot, src)

# Walk forward from caster across the combined (player + enemy) row.
# depth = 0 returns the caster's own cell; depth = 1 is one cell directly in
# front, possibly crossing the grid boundary. Returns {} if out of bounds.
# Used by slash + skewer so attacks anchor at caster's position rather than
# always landing at opponent's front column.
static func _project_forward(caster_side: String, caster_cell: Vector2i, depth: int) -> Dictionary:
	var global_x: int
	if caster_side == Battle.SIDE_PLAYER:
		global_x = caster_cell.x + depth
	else:
		global_x = (Battle.GRID_COLS + caster_cell.x) - depth
	if global_x < 0 or global_x >= Battle.GRID_COLS * 2:
		return {}
	if global_x < Battle.GRID_COLS:
		return {"side": Battle.SIDE_PLAYER, "x": global_x}
	return {"side": Battle.SIDE_ENEMY, "x": global_x - Battle.GRID_COLS}

# Convert a global column coord (0..2*GRID_COLS-1) back to (side, cell_x).
# Used by bomb AoE which fans out around a center cell across grid boundaries.
static func _split_global_x(global_x: int) -> Dictionary:
	if global_x < 0 or global_x >= Battle.GRID_COLS * 2:
		return {}
	if global_x < Battle.GRID_COLS:
		return {"side": Battle.SIDE_PLAYER, "x": global_x}
	return {"side": Battle.SIDE_ENEMY, "x": global_x - Battle.GRID_COLS}

static func _to_global_x(side: String, cell_x: int) -> int:
	return cell_x if side == Battle.SIDE_PLAYER else Battle.GRID_COLS + cell_x

# Attack a (side, cell) — walls intercept first, then the combatant occupying
# the cell. Friendly walls (same owner as caster) pass through.
# Returns true if the attack passed cleanly (no enemy wall blocked it). A false
# return tells directional handlers (pierce_line, beam) to stop iterating
# deeper cells; per-cell handlers (slash_arc) ignore the return.
static func _strike_cell(side: String, cell: Vector2i, dmg: int, move: MoveDef, caster, battle: Battle) -> bool:
	var wall := battle.wall_at_cell(side, cell)
	if wall != null and wall.owner_combatant != caster:
		wall.take_damage(1, caster)
		return false
	var target := battle.combatant_at(side, cell)
	if target != null:
		_strike(target, dmg, move, caster)  # status applied inside _strike
	return true

# === SLASH ARC ===
# 3-cell vertical arc on the opponent's front column. `range_tiles` is the
# arc's lateral width (3 → ±1 around caster's row). Matches App3D.tsx:5003-5012.

static func _slash_arc(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Arc lands on the column 1 cell forward from caster — may be on caster's
	# own grid (from back row) or opponent grid (from front row).
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s slash whiffed (forward out of bounds)" % move.display_name)
		return
	var dest_side: String = info["side"]
	var col_x: int = info["x"]
	var width := maxi(1, move.range_tiles)
	var half := (width - 1) / 2
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	for dy in range(-half, half + 1):
		var cy := ccell.y + dy
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var cell := Vector2i(col_x, cy)
		var world := battle.cell_to_world(dest_side, cell)
		_spawn_slash(battle, world, dy)
		# Per-cell wall check; lateral arc, no propagation.
		if _strike_cell(dest_side, cell, dmg, move, caster, battle):
			if battle.combatant_at(dest_side, cell) != null:
				hit_count += 1
	_log(caster, "%s slashes %d cells on %s, hit %d (%d DMG each)" % [move.display_name, width, dest_side, hit_count, dmg])

# === ANIMATED FX SPRITES (user pixel art, July 2026 — art/battle art/) ===
# Slash / bomb / explosion / beam GIF frames extracted to PNGs. All 64px,
# billboarded, nearest-filtered. Bomb art points as drawn; the beam dart
# points RIGHT (same convention as the bullet tracer) so enemy casts flip.

const SLASH_FRAMES: Array = [
	preload("res://art/battle art/slash_0.png"),
	preload("res://art/battle art/slash_1.png"),
	preload("res://art/battle art/slash_2.png"),
	preload("res://art/battle art/slash_3.png"),
	preload("res://art/battle art/slash_4.png"),
]
const BOMB_FRAMES: Array = [
	preload("res://art/battle art/bomb_0.png"),
	preload("res://art/battle art/bomb_1.png"),
]
const EXPLOSION_FRAMES: Array = [
	preload("res://art/battle art/explosion_0.png"),
	preload("res://art/battle art/explosion_1.png"),
	preload("res://art/battle art/explosion_2.png"),
	preload("res://art/battle art/explosion_3.png"),
]
const BEAM_FX_FRAMES: Array = [
	preload("res://art/battle art/beam_0.png"),
	preload("res://art/battle art/beam_1.png"),
	preload("res://art/battle art/beam_2.png"),
]
const PUNCH_FRAMES: Array = [
	preload("res://art/battle art/punch_0.png"),
	preload("res://art/battle art/punch_1.png"),
	preload("res://art/battle art/punch_2.png"),
	preload("res://art/battle art/punch_3.png"),
]
const TELEPORT_FRAMES: Array = [
	preload("res://art/battle art/teleport_0.png"),
	preload("res://art/battle art/teleport_1.png"),
	preload("res://art/battle art/teleport_2.png"),
]
const TELEPORT_FX_FRAME_S := 0.09
const SWOOP_FX_FRAMES: Array = [
	preload("res://art/battle art/swoop_0.png"),
	preload("res://art/battle art/swoop_1.png"),
	preload("res://art/battle art/swoop_2.png"),
]
const SWOOP_FX_FRAME_S := 0.09
# Wherewolf "shadow of a man" (4-frame loop) — Shadow Strike ghost, Phantom
# Fang shadow, Lingering Shadow prowler.
const WWSHADOW_FRAMES: Array = [
	preload("res://art/battle art/wwshadow_0.png"),
	preload("res://art/battle art/wwshadow_1.png"),
	preload("res://art/battle art/wwshadow_2.png"),
	preload("res://art/battle art/wwshadow_3.png"),
]
const WWSHADOW_FRAME_S := 0.16
# Chain-link rope (lasso_2.gif, 3 frames) — every _spawn_lasso_rope user:
# Lasso (yellow), Blood Drain (red), Undertow, Displace, the catch throw.
const LASSO_FRAMES: Array = [
	preload("res://art/battle art/lasso_0.png"),
	preload("res://art/battle art/lasso_1.png"),
	preload("res://art/battle art/lasso_2.png"),
]
const LASSO_ROPE_WIDTH := 0.55
const LASSO_LINK_LEN := 1.1  # world units covered by one texture repeat
const BOMB_FLICKER_S := 0.25

# Billboarded pixel-art sprite for battle FX (nearest filter, unshaded).
static func _make_fx_sprite(frames: Array, px: float, flip_h: bool = false) -> Sprite3D:
	var spr := Sprite3D.new()
	spr.texture = frames[0]
	spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	spr.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	spr.shaded = false
	spr.pixel_size = px
	spr.flip_h = flip_h
	return spr

# One-shot frame animation: plays the frames at frame_s cadence, then frees.
static func _spawn_anim_fx(battle: Battle, world_pos: Vector3, frames: Array, frame_s: float, px: float, flip_h: bool = false) -> void:
	var spr := _make_fx_sprite(frames, px, flip_h)
	battle.spawn_world_fx(spr)
	spr.global_position = world_pos
	var tw := spr.create_tween()
	for i in range(1, frames.size()):
		var tex: Texture2D = frames[i]
		tw.tween_interval(frame_s)
		tw.tween_callback(func() -> void: spr.texture = tex)
	tw.tween_interval(frame_s)
	tw.tween_callback(spr.queue_free)

static func _spawn_slash(battle: Battle, world_pos: Vector3, _row_offset: int) -> void:
	# User pixel-art slash animation — replaces the old white quad flash.
	_spawn_anim_fx(battle, world_pos + Vector3(0.0, 0.75, 0.0), SLASH_FRAMES, SLASH_LIFETIME_S / SLASH_FRAMES.size(), 0.03)

# === PIERCE LINE ===
# Forward N-cell stab along caster's row. `range_tiles` = depth (3 → 3 cells
# deep on the same row). Stagger spawn cell-by-cell so the swing reads as a
# thrust pulse. Damage applies synchronously. Matches App3D.tsx:4650-4670 (Skewer).

static func _pierce_line(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var depth := maxi(1, move.range_tiles)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	# Walks 1..depth cells forward across the combined row from caster. From
	# back row, deeper cells stay on caster's own grid and may never reach an
	# enemy. Rewards close-range play.
	for d in range(depth):
		var info := _project_forward(side, ccell, d + 1)
		if info.is_empty():
			continue
		var dest_side: String = info["side"]
		var cell := Vector2i(info["x"], ccell.y)
		var world := battle.cell_to_world(dest_side, cell)
		_spawn_pierce(battle, world, d * PIERCE_CELL_DELAY_S)
		var had_target := battle.combatant_at(dest_side, cell) != null
		var passed := _strike_cell(dest_side, cell, dmg, move, caster, battle)
		if passed and had_target:
			hit_count += 1
		if not passed:
			break  # wall absorbed; spear stops here
	_log(caster, "%s pierces %d cells, hit %d (%d DMG each)" % [move.display_name, depth, hit_count, dmg])

static func _spawn_pierce(battle: Battle, world_pos: Vector3, spawn_delay: float) -> void:
	var root := Node3D.new()
	var mesh := MeshInstance3D.new()
	var quad := QuadMesh.new()
	# Narrow + tall reads as a spear/stab silhouette vs. slash's wider arc.
	quad.size = Vector2(0.55, 2.0)
	mesh.mesh = quad
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.95, 0.6, 0.0)  # invisible until spawn_delay elapses
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.65, 0.2)  # warmer than slash's cyan — "hot stab"
	mat.emission_energy_multiplier = 3.2
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh.material_override = mat
	# Tilt toward camera, kept vertical (no z-roll) — straight thrust read.
	mesh.rotation = Vector3(deg_to_rad(-65.0), 0.0, 0.0)
	root.add_child(mesh)
	battle.spawn_world_fx(root)
	root.global_position = world_pos + Vector3(0.0, 0.5, 0.0)
	var tween := battle.create_tween()
	if spawn_delay > 0.0:
		tween.tween_interval(spawn_delay)
	tween.tween_property(mat, "albedo_color:a", 1.0, 0.04)
	tween.tween_property(mat, "albedo_color:a", 0.0, PIERCE_LIFETIME_S)
	tween.tween_callback(root.queue_free)

# === PUNCH ===
# Single front cell. Expanding ring + flash. App3D.tsx:4997-5001 + 2267-2292.

static func _punch(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Single cell directly forward of caster — may cross to opponent grid.
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s punch whiffed (forward out of bounds)" % move.display_name)
		return
	var dest_side: String = info["side"]
	var cell := Vector2i(info["x"], ccell.y)
	var world := battle.cell_to_world(dest_side, cell)
	var dmg := _final_card_damage(move, caster)
	_spawn_punch(battle, world, battle.get_side(caster) == Battle.SIDE_ENEMY)
	var target := battle.combatant_at(dest_side, cell)
	var passed := _strike_cell(dest_side, cell, dmg, move, caster, battle)
	if not passed:
		_log(caster, "%s punch blocked by wall at %s/%s" % [move.display_name, dest_side, str(cell)])
	elif target != null:
		_log(caster, "%s punches %s for %d" % [move.display_name, target.display_name, dmg])
	else:
		_log(caster, "%s punches empty cell %s/%s" % [move.display_name, dest_side, str(cell)])

static func _spawn_punch(battle: Battle, world_pos: Vector3, flip_h: bool = false) -> void:
	# User pixel-art punch impact — replaces the old ring + flash placeholder.
	# Shared by every melee hit visual (Punch, Slime Smash, Cross Counter,
	# jabs, wide slices, shadow-strike landings…). Enemy-side attacks pass
	# flip_h = true so the glove swings from their direction.
	_spawn_anim_fx(battle, world_pos + Vector3(0.0, 0.7, 0.0), PUNCH_FRAMES, PUNCH_LIFETIME_S / PUNCH_FRAMES.size(), 0.028, flip_h)

# === BEAM ===
# Sweeps the opponent's row left-to-right (from caster's POV), one cell per
# 120ms. Damage is applied at the moment each segment lands. App3D.tsx:4970-4995.

static func _beam(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	# Optional self-stun for cards that "lock the caster while firing"
	# (Scimark's beam). Other beam-using cards leave caster_lock_ms = 0
	# and behave unlocked as before.
	if move.caster_lock_ms > 0:
		caster.apply_stun(move.caster_lock_ms)
	# Sweep forward from caster, walking the combined 8-cell row outward.
	# Pre-compute fire path — stop after the first enemy wall (beam absorbed).
	var fire_path: Array = []  # entries: { "side": String, "cell": Vector2i }
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var seg_side: String = info["side"]
		var seg_cell := Vector2i(info["x"], ccell.y)
		fire_path.append({"side": seg_side, "cell": seg_cell})
		var w := battle.wall_at_cell(seg_side, seg_cell)
		if w != null and w.owner_combatant != caster:
			break
		d += 1
	var tween := battle.create_tween()
	for entry in fire_path:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		var world := battle.cell_to_world(seg_side, seg_cell)
		tween.tween_callback(MoveRegistry._emit_beam_segment.bind(battle, world, seg_side, seg_cell, dmg, move, caster))
		tween.tween_interval(BEAM_COLUMN_DELAY_S)
	_log(caster, "%s fires beam from %s — %d cells, %d DMG/cell" % [move.display_name, str(ccell), fire_path.size(), dmg])

static func _emit_beam_segment(battle: Battle, world_pos: Vector3, side: String, cell: Vector2i, dmg: int, move: MoveDef, caster) -> void:
	# Guard: battle could be freed between scheduling and firing if user ESC'd.
	if not is_instance_valid(battle):
		return
	_spawn_beam_segment(battle, world_pos, battle.get_side(caster) == Battle.SIDE_ENEMY)
	# _strike_cell handles wall-vs-combatant routing.
	_strike_cell(side, cell, dmg, move, caster, battle)

static func _spawn_beam_segment(battle: Battle, world_pos: Vector3, flip_h: bool = false) -> void:
	# User pixel-art beam dart — art points RIGHT (player-side travel);
	# enemy-cast beams pass flip_h = true.
	_spawn_anim_fx(battle, world_pos + Vector3(0.0, 0.7, 0.0), BEAM_FX_FRAMES, BEAM_SEGMENT_LIFETIME_S / BEAM_FX_FRAMES.size(), 0.035, flip_h)

# === DASH ATTACK ===
# Caster tweens to (caster_cell + caster_offset) on its own grid (clamped).
# Damage applies at the opponent's front cell once the dash lands. caster_offset
# is in caster's forward frame, so it's mirrored for the enemy side.

static func _dash_attack(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var fwd := battle.forward_side(side)
	var ccell := battle.get_caster_cell(caster)
	var dx := move.caster_offset.x
	if side != Battle.SIDE_PLAYER:
		dx = -dx
	var new_cell := Vector2i(
		clampi(ccell.x + dx, 0, Battle.GRID_COLS - 1),
		clampi(ccell.y + move.caster_offset.y, 0, Battle.GRID_ROWS - 1)
	)
	var dest := battle.cell_to_world(side, new_cell)
	var front_x := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var target_cell := Vector2i(front_x, new_cell.y)
	var landed_world := battle.cell_to_world(fwd, target_cell)
	var dmg := _final_card_damage(move, caster)
	var on_landed := func() -> void:
		battle.set_caster_cell(caster, new_cell)
		_spawn_punch(battle, landed_world, battle.get_side(caster) == Battle.SIDE_ENEMY)
		_strike_cell(fwd, target_cell, dmg, move, caster, battle)
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(caster, "global_position", dest, 0.18)
	tween.tween_callback(on_landed)
	_log(caster, "%s dashes to %s, bashes for %d" % [move.display_name, str(new_cell), dmg])

# === DISPLACE ===
# Push/pull the front-cell target by target_displacement (in caster's forward
# frame). Validates new cell is in-grid; if no movement is possible the target
# still takes damage. target_displacement.x: + = away from caster, − = toward.

static func _displace(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var fwd := battle.forward_side(side)
	var ccell := battle.get_caster_cell(caster)
	var front_x := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var hit_cell := Vector2i(front_x, ccell.y)
	# Wall first — if an enemy wall is at the front cell, displace is fully blocked.
	var blocking_wall := battle.wall_at_cell(fwd, hit_cell)
	if blocking_wall != null and blocking_wall.owner_combatant != caster:
		blocking_wall.take_damage(1, caster)
		_log(caster, "%s displace blocked by wall at %s" % [move.display_name, str(hit_cell)])
		return
	var target := battle.combatant_at(fwd, hit_cell)
	if target == null:
		_log(caster, "%s displace whiffed (no target at %s)" % [move.display_name, str(hit_cell)])
		return
	# Lasso visuals fire BEFORE the strike so the rope shows even if the hit
	# kills the target. Card-id keyed so other displace cards stay clean.
	if move.id == "lasso":
		var caster_world: Vector3 = caster.global_position + Vector3(0.0, 0.8, 0.0)
		var target_world: Vector3 = target.global_position + Vector3(0.0, 0.8, 0.0)
		_spawn_lasso_rope(battle, caster_world, target_world)
		_spawn_lasso_impact(battle, target.global_position)
	var dmg := _final_card_damage(move, caster)
	if dmg > 0:
		_strike(target, dmg, move, caster)
	if not target.is_alive():
		_log(caster, "%s displaces %s — KO'd before shove" % [move.display_name, target.display_name])
		return
	# Compute displacement, mirroring X for enemy-side casters.
	var raw := move.target_displacement
	var dx := raw.x
	if side != Battle.SIDE_PLAYER:
		dx = -dx
	var tcell := battle.get_caster_cell(target)
	var new_cell := Vector2i(
		clampi(tcell.x + dx, 0, Battle.GRID_COLS - 1),
		clampi(tcell.y + raw.y, 0, Battle.GRID_ROWS - 1)
	)
	if new_cell == tcell:
		_log(caster, "%s shoves %s — pinned to edge, %d DMG only" % [move.display_name, target.display_name, dmg])
		return
	var dest := battle.cell_to_world(fwd, new_cell)
	var on_shoved := func() -> void:
		battle.set_caster_cell(target, new_cell)
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(target, "global_position", dest, 0.18)
	tween.tween_callback(on_shoved)
	_log(caster, "%s shoves %s by %s for %d DMG" % [move.display_name, target.display_name, str(raw), dmg])

# === PLACE TILE ===
# Spawns a persistent TimedEffect on the cell 1 forward from caster. Same
# project_forward semantics as slash/skewer — defensive tiles (heal_font)
# placed from back row land on caster's own grid; aggressive tiles
# (poison_trap, vamp_mist) need to be cast from close range to land in
# enemy territory.

static func _place_tile(move: MoveDef, caster, battle: Battle) -> void:
	if move.tile_effect_id.is_empty():
		_log(caster, "[place_tile missing tile_effect_id] %s" % move.display_name)
		return
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s tile placement whiffed (forward out of bounds)" % move.display_name)
		return
	var dest_side: String = info["side"]
	var cell := Vector2i(info["x"], ccell.y)
	battle.spawn_tile(caster, dest_side, cell, move.tile_effect_id, move.tile_lifetime_ms, move.tile_owner_only)
	_log(caster, "%s places %s at %s/%s for %dms" % [move.display_name, move.tile_effect_id, dest_side, str(cell), move.tile_lifetime_ms])

# === SLIME TRAIL ===
# Drops 2 healing puddles on RANDOM cells of caster's own grid (App3D.tsx:5468).
# Owner-only via heal_font effect so dropping a trail in enemy walking path
# doesn't accidentally aid them. Used by Slime and Cargot.

static func _slime_trail(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 13000
	for i in range(2):
		var cell := Vector2i(randi() % Battle.GRID_COLS, randi() % Battle.GRID_ROWS)
		battle.spawn_tile(caster, side, cell, "heal_font", lifetime, true)
	_log(caster, "%s lays 2 heal puddles on %s" % [move.display_name, side])

# === SLIME BALL ===
# 10 DMG hit at 2 forward cells + poison_trap tile drop at the deeper cell.
# Direct hit is plain damage; poison only lands if opponent later steps onto
# the trap. React App3D.tsx:5446-5467.

const SLIME_BALL_POISON_TTL_MS := 11200  # React 100 ticks × 112ms

static func _slime_ball(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	var deep_info: Dictionary = {}
	for d in range(1, 3):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		deep_info = info
		var dest_side: String = info["side"]
		var cell := Vector2i(info["x"], ccell.y)
		var world := battle.cell_to_world(dest_side, cell)
		_spawn_pierce(battle, world, (d - 1) * PIERCE_CELL_DELAY_S)
		var had_target := battle.combatant_at(dest_side, cell) != null
		if _strike_cell(dest_side, cell, dmg, move, caster, battle) and had_target:
			hit_count += 1
	# Drop poison trap on the deeper cell (or last reachable forward cell).
	if not deep_info.is_empty():
		var trap_lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else SLIME_BALL_POISON_TTL_MS
		battle.spawn_tile(caster, deep_info["side"], Vector2i(deep_info["x"], ccell.y), "poison_trap", trap_lifetime, false)
	_log(caster, "%s slimes 2 cells, hit %d, leaves poison trap" % [move.display_name, hit_count])

# === DISSOLVE ===
# Acid pool placed at the OPPONENT'S current cell (not forward). 2 DMG/tick
# while opponent stands on it. React App3D.tsx:5484-5494, 7467-7471.

static func _dissolve(move: MoveDef, caster, battle: Battle) -> void:
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		_log(caster, "%s dissolve whiffed (no opponent)" % move.display_name)
		return
	var opp_side := battle.get_side(opp)
	var opp_cell := battle.get_caster_cell(opp)
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 4500
	battle.spawn_tile(caster, opp_side, opp_cell, "acid_pool", lifetime, false)
	_log(caster, "%s drops acid pool on %s/%s (%dms)" % [move.display_name, opp_side, str(opp_cell), lifetime])

# === GOO TRAP ===
# Random cell on opponent's grid. On contact: 10 DMG + ~3.4s stun + ~5.6s
# poison via the poison_trap combo. React App3D.tsx:5511-5520.

static func _goo_trap(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var fwd_side := battle.forward_side(side)
	var cell := Vector2i(randi() % Battle.GRID_COLS, randi() % Battle.GRID_ROWS)
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 16800
	battle.spawn_tile(caster, fwd_side, cell, "poison_trap", lifetime, false)
	_log(caster, "%s drops goo trap on %s/%s" % [move.display_name, fwd_side, str(cell)])

# === TOXIC WAVE ===
# Sweeps all 4 cells of opponent's row at caster's y. Damages + stuns anyone
# in that row. React App3D.tsx:5548-5564.

static func _toxic_wave(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var fwd_side := battle.forward_side(side)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	var tween := battle.create_tween()
	for x in range(Battle.GRID_COLS):
		var cell := Vector2i(x, ccell.y)
		var world := battle.cell_to_world(fwd_side, cell)
		tween.tween_callback(MoveRegistry._emit_beam_segment.bind(battle, world, fwd_side, cell, dmg, move, caster))
		tween.tween_interval(BEAM_COLUMN_DELAY_S)
		if battle.combatant_at(fwd_side, cell) != null:
			hit_count += 1
	_log(caster, "%s waves opponent row %d — projected %d hits, %d DMG/cell" % [move.display_name, ccell.y, hit_count, dmg])

# === VENOM SPIT ===
# Poison_trap tile placed 4 cells forward (or the closest reachable forward
# cell). React intent: deep poison ambush. App3D.tsx:5566-5577.

static func _venom_spit(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info: Dictionary = {}
	for d in range(4, 0, -1):
		info = _project_forward(side, ccell, d)
		if not info.is_empty():
			break
	if info.is_empty():
		_log(caster, "%s venom spit whiffed (no forward path)" % move.display_name)
		return
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 16800
	battle.spawn_tile(caster, info["side"], Vector2i(info["x"], ccell.y), "poison_trap", lifetime, false)
	_log(caster, "%s spits venom at %s/%s" % [move.display_name, info["side"], str(Vector2i(info["x"], ccell.y))])

# === WALL ===
# Place a Wall on the caster's own front-column cell (between caster and the
# opponent). HP = 1 + trait wall_bonus_hp. Optionally combine with self_heal
# so cards like "Shell Block" can both shield and heal in one play (React
# pattern — see App3D.tsx:1048).

static func _wall(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var fwd := battle.forward_side(side)
	var ccell := battle.get_caster_cell(caster)
	# Always place wall 1 cell directly in front of caster. If that crosses
	# the grid boundary (caster already at front column), spill onto the
	# opponent's grid at the first cell beyond.
	var dx := 1 if side == Battle.SIDE_PLAYER else -1
	var wall_side := side
	var wall_x := ccell.x + dx
	if wall_x < 0 or wall_x >= Battle.GRID_COLS:
		wall_side = fwd
		wall_x = 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var wall_cell := Vector2i(wall_x, ccell.y)
	var wall_hp := 1 + TraitRegistry.wall_bonus_hp(caster.traits)
	battle.spawn_wall(caster, wall_side, wall_cell, wall_hp)
	if move.self_heal > 0:
		caster.heal(move.self_heal)
	var heal_str := " + heals %d" % move.self_heal if move.self_heal > 0 else ""
	_log(caster, "%s places wall (HP %d) at %s/%s%s" % [move.display_name, wall_hp, wall_side, str(wall_cell), heal_str])

# === CONTACT BOMB ===
# Places a contact mine 2 cells forward (1-cell fallback). Detonates when a
# non-owner combatant steps onto the cell. No fuse, no AoE — single-cell snap.
# Matches React's "bomb" card (App3D.tsx:5015-5021).

static func _contact_bomb(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 2)
	if info.is_empty():
		info = _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s contact bomb whiffed (no forward target)" % move.display_name)
		return
	var bomb_side: String = info["side"]
	var bomb_cell := Vector2i(info["x"], ccell.y)
	var dmg := _final_card_damage(move, caster)
	# Reuse TimedEffect with effect_id "contact_bomb" — short tick + damage on
	# first non-owner contact, then self-destructs with a burst.
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 10000
	var tile := battle.spawn_tile(caster, bomb_side, bomb_cell, "contact_bomb", lifetime, false)
	if tile != null:
		tile.tick_damage = dmg
	_log(caster, "%s plants contact bomb at %s/%s (%d DMG)" % [move.display_name, bomb_side, str(bomb_cell), dmg])

# === TIME BOMB (delayed fuse + AoE) ===
# Place a delayed-fuse bomb 2 cells forward from caster. After BOMB_FUSE_S,
# detonate: center cell takes `damage`, ring cells (radius cells around it)
# take `damage / 4` — matches App3D.tsx:8071-8096 (40 center / 10 ring split).
# React equivalent: "delay bomb" card (Mushroom, Statinu).

static func _time_bomb(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Try 2 cells forward, fall back to 1 if at front of combined row.
	var info := _project_forward(side, ccell, 2)
	if info.is_empty():
		info = _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s bomb whiffed (no forward target)" % move.display_name)
		return
	var bomb_side: String = info["side"]
	var bomb_cell := Vector2i(info["x"], ccell.y)
	var world := battle.cell_to_world(bomb_side, bomb_cell)
	var marker := _make_bomb_marker()
	battle.spawn_world_fx(marker)
	marker.global_position = world + Vector3(0.0, 0.5, 0.0)
	# Pulse marker scale as the fuse burns down (sprite handles its own flicker).
	var pulse := marker.create_tween().set_loops(int(BOMB_FUSE_S / 0.2))
	pulse.tween_property(marker, "scale", Vector3.ONE * 1.25, 0.1)
	pulse.tween_property(marker, "scale", Vector3.ONE * 1.0, 0.1)
	# Detonation tween
	var center_dmg := _final_card_damage(move, caster)
	var ring_dmg := maxi(1, center_dmg / 4)
	var radius := maxi(1, move.area_radius)
	var det_callback := func() -> void:
		if not is_instance_valid(battle):
			return
		if is_instance_valid(marker):
			marker.queue_free()
		_detonate_bomb(battle, bomb_side, bomb_cell, center_dmg, ring_dmg, radius, move, caster)
	var fuse_tween := battle.create_tween()
	fuse_tween.tween_interval(BOMB_FUSE_S)
	fuse_tween.tween_callback(det_callback)
	_log(caster, "%s drops bomb at %s/%s (%.1fs fuse, %d center / %d ring)" % [move.display_name, bomb_side, str(bomb_cell), BOMB_FUSE_S, center_dmg, ring_dmg])

static func _detonate_bomb(battle: Battle, center_side: String, center_cell: Vector2i, center_dmg: int, ring_dmg: int, radius: int, move: MoveDef, caster) -> void:
	# Center hit + visual
	_spawn_explosion_at(battle, battle.cell_to_world(center_side, center_cell), 1.2)
	_strike_cell(center_side, center_cell, center_dmg, move, caster, battle)
	# AoE in a (2*radius+1) x (2*radius+1) square, skipping center
	var center_global_x := _to_global_x(center_side, center_cell.x)
	for dx in range(-radius, radius + 1):
		for dy in range(-radius, radius + 1):
			if dx == 0 and dy == 0:
				continue
			var gx := center_global_x + dx
			var cy := center_cell.y + dy
			if cy < 0 or cy >= Battle.GRID_ROWS:
				continue
			var info := _split_global_x(gx)
			if info.is_empty():
				continue
			var t_side: String = info["side"]
			var t_cell := Vector2i(info["x"], cy)
			_spawn_explosion_at(battle, battle.cell_to_world(t_side, t_cell), 0.7)
			_strike_cell(t_side, t_cell, ring_dmg, move, caster, battle)

static func _make_bomb_marker(px: float = 0.018) -> Node3D:
	# User pixel-art bomb: 2-frame fuse flicker, looping from the moment the
	# marker enters the tree until it's freed.
	var root := Node3D.new()
	var spr := _make_fx_sprite(BOMB_FRAMES, px)
	root.add_child(spr)
	root.ready.connect(func() -> void:
		var f0: Texture2D = BOMB_FRAMES[0]
		var f1: Texture2D = BOMB_FRAMES[1]
		var tw := spr.create_tween().set_loops()
		tw.tween_interval(BOMB_FLICKER_S)
		tw.tween_callback(func() -> void: spr.texture = f1)
		tw.tween_interval(BOMB_FLICKER_S)
		tw.tween_callback(func() -> void: spr.texture = f0))
	return root

static func _spawn_explosion_at(battle: Battle, world_pos: Vector3, scale_peak: float) -> void:
	# User pixel-art explosion — used by every bomb detonation + timed tile
	# impacts (meteor drop, boulder blast…). scale_peak now sizes the sprite.
	_spawn_anim_fx(battle, world_pos + Vector3(0.0, 0.7, 0.0), EXPLOSION_FRAMES, BOMB_EXPLOSION_LIFETIME_S / EXPLOSION_FRAMES.size(), 0.030 * scale_peak)

# === BOOMERANG ===
# Travels 3 cells forward along caster's row, then randomly shifts ±1 row
# (clamped) and returns through the shifted row back to the caster's column.
# Strikes any non-friendly target on each cell of both legs (two-hit
# possible). On arrival at (caster_col, shifted_row), if the caster has
# moved to that cell it's a CATCH: card jumps back into hand slot 0 + Horn
# Catch trait heal fires. Otherwise card returns to the deck.
# App3D.tsx:5042-5050, 8098-8162.

const BOOMERANG_FORWARD_TILES := 3

static func _boomerang(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	# Forward path — 3 cells along caster's row.
	var forward_path: Array = []
	for d in range(1, BOOMERANG_FORWARD_TILES + 1):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		forward_path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
	if forward_path.is_empty():
		_log(caster, "%s boomerang whiffed (no forward path)" % move.display_name)
		return
	# Random ±1 row shift (clamped). If at the top edge, shift down; bottom edge → up.
	var shifted_row := ccell.y
	var coin := randi() % 2
	if coin == 0 and ccell.y + 1 < Battle.GRID_ROWS:
		shifted_row = ccell.y + 1
	elif coin == 1 and ccell.y - 1 >= 0:
		shifted_row = ccell.y - 1
	elif ccell.y + 1 < Battle.GRID_ROWS:
		shifted_row = ccell.y + 1
	elif ccell.y - 1 >= 0:
		shifted_row = ccell.y - 1
	# Return path mirrors forward path but on the shifted row.
	var return_path: Array = []
	for entry in forward_path:
		var fcell: Vector2i = entry["cell"]
		return_path.append({"side": entry["side"], "cell": Vector2i(fcell.x, shifted_row)})
	return_path.reverse()
	var catch_cell := Vector2i(ccell.x, shifted_row)
	# Visual
	var boom := _make_boomerang_visual()
	battle.spawn_world_fx(boom)
	boom.global_position = battle.cell_to_world(side, ccell) + Vector3(0.0, 0.9, 0.0)
	var spin_mesh := boom.get_child(0) as MeshInstance3D
	var spin := boom.create_tween().set_loops()
	spin.tween_property(spin_mesh, "rotation:y", TAU, 0.25)
	spin.tween_property(spin_mesh, "rotation:y", 0.0, 0.0)
	# Travel
	var tween := battle.create_tween()
	for entry in forward_path:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		var world := battle.cell_to_world(seg_side, seg_cell) + Vector3(0.0, 0.9, 0.0)
		tween.tween_property(boom, "global_position", world, BOOMERANG_TRAVEL_PER_CELL_S)
		tween.tween_callback(MoveRegistry._boomerang_strike.bind(battle, seg_side, seg_cell, dmg, move, caster))
	for entry in return_path:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		var world := battle.cell_to_world(seg_side, seg_cell) + Vector3(0.0, 0.9, 0.0)
		tween.tween_property(boom, "global_position", world, BOOMERANG_TRAVEL_PER_CELL_S)
		tween.tween_callback(MoveRegistry._boomerang_strike.bind(battle, seg_side, seg_cell, dmg, move, caster))
	# Final hop to the catch cell on caster's own grid.
	var catch_world := battle.cell_to_world(side, catch_cell) + Vector3(0.0, 0.9, 0.0)
	tween.tween_property(boom, "global_position", catch_world, BOOMERANG_TRAVEL_PER_CELL_S)
	tween.tween_callback(MoveRegistry._boomerang_resolve.bind(boom, caster, battle, catch_cell, move))
	_log(caster, "%s throws boomerang (3 fwd, shift row %d, return %s)" % [move.display_name, shifted_row, str(catch_cell)])

static func _boomerang_strike(battle: Battle, side: String, cell: Vector2i, dmg: int, move: MoveDef, caster) -> void:
	if not is_instance_valid(battle):
		return
	_strike_cell(side, cell, dmg, move, caster, battle)

static func _boomerang_resolve(boom: Node3D, caster, battle: Battle, catch_cell: Vector2i, move: MoveDef) -> void:
	if is_instance_valid(boom):
		boom.queue_free()
	if not is_instance_valid(caster) or not is_instance_valid(battle):
		return
	var caster_cell_now := battle.get_caster_cell(caster)
	if caster_cell_now == catch_cell:
		# CATCH — remove from discard if still there, drop into hand slot 0, fire Horn Catch.
		caster.remove_card_from_discard(move)
		caster.return_card_to_hand_slot(move, 0)
		var heal := TraitRegistry.boomerang_catch_heal(caster.traits)
		if heal > 0:
			caster.heal(heal)
		print("[CARD] %s catches %s → hand slot 0" % [caster.display_name, move.display_name])
	else:
		# Missed catch — discard entry already has its cooldown, but per React
		# the boomerang ALSO drops a fresh copy into the deck (App3D.tsx:8156).
		caster.return_card_to_deck(move)
		print("[CARD] %s missed boomerang catch — %s back to deck" % [caster.display_name, move.display_name])

static func _make_boomerang_visual() -> Node3D:
	var root := Node3D.new()
	var mesh := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.20
	torus.outer_radius = 0.42
	mesh.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.90, 0.65, 0.30, 0.95)
	mat.emission_enabled = true
	mat.emission = Color(0.85, 0.45, 0.15)
	mat.emission_energy_multiplier = 2.5
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh.material_override = mat
	root.add_child(mesh)
	return root

# === LASSO ===
# Scans 3 cells forward from caster looking for opponent. If found:
#   1. Spawn rope + impact visual at opponent's location
#   2. Strike + apply status (stun via move.status_*)
#   3. Pull opponent toward the closest cell on opponent's grid relative to
#      player (enemy grid x=0 for player caster, player grid x=3 for enemy).
#   4. For every cell on the pull-back path, trigger any TimedEffect tiles
#      (poison, acid, contact bomb, vamp mist) on the dragged opponent.
#   5. Tween opponent to the landing cell + update cell tracking.

const LASSO_FORWARD_TILES := 3

static func _lasso(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Forward 3-cell scan path.
	var path: Array = []
	for d in range(1, LASSO_FORWARD_TILES + 1):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
	if path.is_empty():
		_log(caster, "%s lasso whiffed (no forward path)" % move.display_name)
		return
	# Find first opponent in the path.
	var target: Combatant = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			target = occupant
			hit_entry = entry
			break
	# Always spawn rope visual regardless of hit, so the user sees the throw.
	var caster_world: Vector3 = caster.global_position + Vector3(0.0, 0.8, 0.0)
	var rope_end: Vector3
	if target != null:
		rope_end = target.global_position + Vector3(0.0, 0.8, 0.0)
	else:
		var tail_entry: Dictionary = path[path.size() - 1]
		rope_end = battle.cell_to_world(tail_entry["side"], tail_entry["cell"]) + Vector3(0.0, 0.8, 0.0)
	_spawn_lasso_rope(battle, caster_world, rope_end, Color(1.0, 0.88, 0.35))
	if target == null:
		_log(caster, "%s lasso whiffed (no enemy in 3-cell reach)" % move.display_name)
		return
	# Hit visual + strike (also applies stun via _strike status rider).
	_spawn_lasso_impact(battle, target.global_position)
	var dmg := _final_card_damage(move, caster)
	if dmg > 0:
		_strike(target, dmg, move, caster)
	if not target.is_alive():
		_log(caster, "%s lasso KO'd %s before pull" % [move.display_name, target.display_name])
		return
	# Landing cell = "closest cell to player on opponent's side". For player
	# caster: enemy grid (0, py). For enemy caster: player grid (3, py).
	var fwd_side := battle.forward_side(side)
	var landing_x := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var landing_cell := Vector2i(landing_x, ccell.y)
	# Pull path in global X coordinates, walking from target toward landing.
	var target_side: String = hit_entry["side"]
	var target_cell: Vector2i = hit_entry["cell"]
	var start_gx := _to_global_x(target_side, target_cell.x)
	var land_gx := _to_global_x(fwd_side, landing_x)
	if start_gx != land_gx:
		var step := 1 if land_gx > start_gx else -1
		var gx := start_gx + step
		while true:
			var split := _split_global_x(gx)
			if not split.is_empty():
				var t := battle.tile_at_cell(split["side"], Vector2i(split["x"], target_cell.y))
				if t != null:
					t.trigger_for(target)
					if not target.is_alive():
						_log(caster, "%s lasso — %s killed mid-drag by tile" % [move.display_name, target.display_name])
						return
			if gx == land_gx:
				break
			gx += step
	# Tween target to landing.
	var dest := battle.cell_to_world(fwd_side, landing_cell)
	var captured_target := target
	var captured_cell := landing_cell
	var on_landed := func() -> void:
		if is_instance_valid(captured_target):
			battle.set_caster_cell(captured_target, captured_cell)
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(target, "global_position", dest, 0.28)
	tween.tween_callback(on_landed)
	_log(caster, "%s lassoes %s — pulled to %s/%s" % [move.display_name, target.display_name, fwd_side, str(landing_cell)])

# === WALL COLUMN ===
# Hogglin's "wall" card: 4 blocks in a vertical column 2 cells forward
# (App3D.tsx:5110-5117). Each block uses standard wall HP + trait bonus.
# Falls back to depth 1 if depth 2 crosses out of the combined row.

static func _wall_column(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 2)
	if info.is_empty():
		info = _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s wall column whiffed (no forward column)" % move.display_name)
		return
	var wall_side: String = info["side"]
	var wall_x: int = info["x"]
	var wall_hp := 1 + TraitRegistry.wall_bonus_hp(caster.traits)
	var placed := 0
	for row in range(Battle.GRID_ROWS):
		var cell := Vector2i(wall_x, row)
		battle.spawn_wall(caster, wall_side, cell, wall_hp)
		placed += 1
	if move.self_heal > 0:
		caster.heal(move.self_heal)
	_log(caster, "%s walls %s column %d (%d blocks, HP %d each)" % [move.display_name, wall_side, wall_x, placed, wall_hp])

# === TOPPLE ===
# Consumes the caster's friendly wall directly in front, then launches a
# beam-like projectile forward along the caster's row. Damages the first
# non-friendly target hit (enemy combatant OR enemy wall). 40 base DMG.
# If no friendly wall in front, refunds 1 mana per React (App3D.tsx:5801+).

static func _topple(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		caster.gain_mana(1)
		_log(caster, "%s topple whiffed (no forward cell) — 1 mana refund" % move.display_name)
		return
	var wall_side: String = info["side"]
	var wall_cell := Vector2i(info["x"], ccell.y)
	var wall := battle.wall_at_cell(wall_side, wall_cell)
	# Boulders register as walls but aren't launchable blocks — refund like
	# any other "no wall" case.
	if wall == null or wall.owner_combatant != caster or wall is Boulder:
		caster.gain_mana(1)
		_log(caster, "%s topple — no friendly wall to launch (1 mana refund)" % move.display_name)
		return
	# Consume own wall. Bypass the destroyed signal — we don't want
	# Demolitionist self-heal for sacrificing our own block.
	battle._walls.erase(wall)
	wall.queue_free()
	# Pre-compute fire path forward — stop at first non-friendly target cell.
	# Then schedule beam segments with BEAM_COLUMN_DELAY_S between them so the
	# topple reads at the same pace as a Beam card (was instant; felt jarring).
	var dmg := _final_card_damage(move, caster)
	var fire_path: Array = []  # entries: { side, cell, kind: "wall"/"combatant"/"empty", node? }
	var d := 1
	var hit_something := false
	while true:
		var step_info := _project_forward(side, ccell, d)
		if step_info.is_empty():
			break
		var step_side: String = step_info["side"]
		var step_cell := Vector2i(step_info["x"], ccell.y)
		var entry := {"side": step_side, "cell": step_cell, "kind": "empty"}
		var enemy_wall := battle.wall_at_cell(step_side, step_cell)
		if enemy_wall != null and enemy_wall.owner_combatant != caster:
			entry["kind"] = "wall"
			entry["wall"] = enemy_wall
			fire_path.append(entry)
			hit_something = true
			break
		var target := battle.combatant_at(step_side, step_cell)
		if target != null:
			entry["kind"] = "combatant"
			entry["target"] = target
			fire_path.append(entry)
			hit_something = true
			break
		fire_path.append(entry)
		d += 1
	# Schedule with beam cadence.
	var tween := battle.create_tween()
	for entry in fire_path:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		var seg_world := battle.cell_to_world(seg_side, seg_cell)
		tween.tween_callback(_topple_emit.bind(battle, seg_world, entry, dmg, move, caster))
		tween.tween_interval(BEAM_COLUMN_DELAY_S)
	_log(caster, "%s topples wall at %s/%s — %s" % [move.display_name, wall_side, str(wall_cell), "projectile launched (%d cells)" % fire_path.size() if hit_something else "no target reached"])

static func _topple_emit(battle: Battle, world_pos: Vector3, entry: Dictionary, dmg: int, move: MoveDef, caster) -> void:
	if not is_instance_valid(battle):
		return
	_spawn_beam_segment(battle, world_pos, battle.get_side(caster) == Battle.SIDE_ENEMY)
	match entry.get("kind", "empty"):
		"wall":
			var w = entry.get("wall")
			if w != null and is_instance_valid(w):
				w.take_damage(1, caster)
		"combatant":
			var t = entry.get("target")
			if t != null and is_instance_valid(t):
				_strike(t, dmg, move, caster)

# === SELF BUFF ===
# Apply a transient stat multiplier to the caster. self_buff_id selects whether
# buff_mult goes to incoming-damage (defensive) or outgoing-damage (offensive).
# Spawns a pulsing halo parented to the caster so it tracks movement; Combatant
# queue_frees the halo on buff expiry via the visual ref stored in the buff dict.

static func _self_buff(move: MoveDef, caster, battle: Battle) -> void:
	if move.self_buff_id.is_empty():
		_log(caster, "[self_buff missing id] %s" % move.display_name)
		return
	var id := move.self_buff_id
	var taken := 1.0
	var dealt := 1.0
	var halo_color := Color.WHITE
	match id:
		"armor":
			taken = move.buff_mult
			halo_color = Color(0.45, 0.75, 1.0)        # cool blue → defense
		"battle_cry":
			dealt = move.buff_mult
			halo_color = Color(1.0, 0.55, 0.35)        # warm orange → offense
		"overcharge":
			dealt = move.buff_mult
			halo_color = Color(0.95, 0.85, 0.25)       # electric yellow → Toadazer capacitor
		"charge":
			dealt = move.buff_mult
			halo_color = Color(1.0, 0.85, 0.30)        # gold → empowered shot
		"guard_below_half":
			taken = move.buff_mult
			halo_color = Color(0.65, 0.85, 0.45)       # green → conditional guard
		_:
			# Generic routing: mult < 1 is defensive, > 1 is offensive.
			if move.buff_mult < 1.0:
				taken = move.buff_mult
				halo_color = Color(0.60, 0.70, 1.0)
			else:
				dealt = move.buff_mult
				halo_color = Color(1.0, 0.60, 0.40)
	var buff: Dictionary = caster.apply_buff(id, taken, dealt, move.buff_duration_ms)
	# Halo follows the caster around the grid since it parents to the combatant.
	var halo := _make_buff_halo(halo_color)
	caster.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	# Pulse opacity now that halo is in tree.
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.20, 0.8).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.55, 0.8).set_trans(Tween.TRANS_SINE)
	_log(caster, "%s applies %s — taken×%.2f dealt×%.2f for %dms" % [move.display_name, id, taken, dealt, move.buff_duration_ms])

static func _make_buff_halo(color: Color) -> Node3D:
	var root := Node3D.new()
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.7
	torus.outer_radius = 0.95
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(color.r, color.g, color.b, 0.55)
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 2.5
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring.material_override = mat
	root.add_child(ring)
	return root

# === FLYING SWORD ===
# Homing row-sweep across the OPPONENT's row at opponent's current y.
# 15 DMG per cell, staggered beam visuals. If no opponent, no-op.

static func _flying_sword(move: MoveDef, caster, battle: Battle) -> void:
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		_log(caster, "%s flying sword whiffed (no opponent)" % move.display_name)
		return
	var opp_cell := battle.get_caster_cell(opp)
	var fwd_side := battle.forward_side(battle.get_side(caster))
	var dmg := _final_card_damage(move, caster)
	var tween := battle.create_tween()
	for x in range(Battle.GRID_COLS):
		var cell := Vector2i(x, opp_cell.y)
		var world := battle.cell_to_world(fwd_side, cell)
		tween.tween_callback(MoveRegistry._emit_beam_segment.bind(battle, world, fwd_side, cell, dmg, move, caster))
		tween.tween_interval(BEAM_COLUMN_DELAY_S)
	_log(caster, "%s flies sword across row %d (locked on %s)" % [move.display_name, opp_cell.y, opp.display_name])

# === THORN SHIELD ===
# Sets reactive defense flag on caster. Next enemy bullet that would damage
# them is blocked + a 30 DMG thorn bullet fires back at the shooter.

static func _thorn_shield(move: MoveDef, caster, battle: Battle) -> void:
	caster.activate_thorn_shield()
	_log(caster, "%s raises thorn shield" % move.display_name)

# === VINE SNARE ===
# Drops a vine_snare tile on a random cell of opponent's grid. On contact:
# 10 DMG + 3.4s stun, then trap consumes itself. React App3D.tsx:5211-5219.

static func _vine_snare(move: MoveDef, caster, battle: Battle) -> void:
	var fwd_side := battle.forward_side(battle.get_side(caster))
	var cell := Vector2i(randi() % Battle.GRID_COLS, randi() % Battle.GRID_ROWS)
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 16800
	battle.spawn_tile(caster, fwd_side, cell, "vine_snare", lifetime, false)
	_log(caster, "%s lays vine snare at %s/%s" % [move.display_name, fwd_side, str(cell)])

# === REAP ===
# 3 horizontal cells at depth 2 forward (lateral band, ±1 row from caster).
# Each hit opponent is pushed 1 cell toward the caster (clamped to grid edge).
# 15 DMG default.

static func _reap(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 2)
	if info.is_empty():
		_log(caster, "%s reap whiffed (no depth-2 cell)" % move.display_name)
		return
	var dest_side: String = info["side"]
	var col_x: int = info["x"]
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	var push_dir := -1 if side == Battle.SIDE_PLAYER else 1
	for dy in range(-1, 2):
		var cy: int = ccell.y + dy
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var cell := Vector2i(col_x, cy)
		var world := battle.cell_to_world(dest_side, cell)
		_spawn_slash(battle, world, dy)
		var target := battle.combatant_at(dest_side, cell)
		if _strike_cell(dest_side, cell, dmg, move, caster, battle) and target != null and target.is_alive():
			hit_count += 1
			_reap_push(battle, target, dest_side, cell, push_dir)
	_log(caster, "%s reaps row at depth 2 — hit %d" % [move.display_name, hit_count])

static func _reap_push(battle: Battle, target: Combatant, target_side: String, target_cell: Vector2i, push_dir: int) -> void:
	var new_x := clampi(target_cell.x + push_dir, 0, Battle.GRID_COLS - 1)
	if new_x == target_cell.x:
		return  # pinned to edge
	var new_cell := Vector2i(new_x, target_cell.y)
	var dest := battle.cell_to_world(target_side, new_cell)
	var captured_target := target
	var captured_cell := new_cell
	var on_pushed := func() -> void:
		if is_instance_valid(captured_target):
			battle.set_caster_cell(captured_target, captured_cell)
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(target, "global_position", dest, 0.18)
	tween.tween_callback(on_pushed)

# === CALL SOLDIER ===
# Spawns a roaming turret at the caster's front cell (1 forward). Moves to a
# random adjacent cell every 1.5s, fires the same bullets as Call Family.

const SOLDIER_HP := 15
const SOLDIER_FIRE_INTERVAL_S := 1.5
const SOLDIER_MOVE_INTERVAL_S := 1.5
const SOLDIER_BULLET_DAMAGE := 5

static func _call_soldier(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s call soldier whiffed (no forward cell)" % move.display_name)
		return
	var bullet_dmg := move.damage if move.damage > 0 else SOLDIER_BULLET_DAMAGE
	var soldier := battle.spawn_turret(caster, info["side"], Vector2i(info["x"], ccell.y), SOLDIER_HP, SOLDIER_FIRE_INTERVAL_S, bullet_dmg, SOLDIER_SPRITE, Color.WHITE)
	if soldier != null:
		soldier.move_interval_s = SOLDIER_MOVE_INTERVAL_S
	_log(caster, "%s calls soldier at %s/%s (roams every %.1fs)" % [move.display_name, info["side"], str(Vector2i(info["x"], ccell.y)), SOLDIER_MOVE_INTERVAL_S])

# === FAIRY RING ===
# Spawns 2 mushroom walkers on caster's grid that march forward across both
# grids, dropping a poison_trap tile every cell they leave. Each has low HP
# (8) and doesn't shoot. Despawn when they walk off the far edge.

const MUSHROOM_HP := 8
const MUSHROOM_STEP_INTERVAL_S := 1.5
const MUSHROOM_TRAIL_LIFETIME_MS := 6000

static func _fairy_ring(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var back_x := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var y_top := maxi(0, Battle.GRID_ROWS / 2 - 1)
	var y_bot := mini(Battle.GRID_ROWS - 1, Battle.GRID_ROWS / 2)
	for y in [y_top, y_bot]:
		var m := battle.spawn_turret(caster, side, Vector2i(back_x, y), MUSHROOM_HP, 99.0, 0, MUSHROOM_SOLDIER_SPRITE, Color.WHITE)
		if m != null:
			m.fires_bullets = false
			m.move_interval_s = MUSHROOM_STEP_INTERVAL_S
			m.forward_walker = true
			m.drop_tile_on_step = "poison_trap"
			m.drop_tile_lifetime_ms = MUSHROOM_TRAIL_LIFETIME_MS
	_log(caster, "%s summons fairy ring — 2 mushrooms marching forward" % move.display_name)

# === SILENCE BOMB ===
# Mushroom card: contact mine 2 cells forward. On contact deals 10 DMG +
# silences for ~3s, then self-destructs. silence blocks card play only.

static func _silence_bomb(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 2)
	if info.is_empty():
		info = _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s silence bomb whiffed" % move.display_name)
		return
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else 10000
	battle.spawn_tile(caster, info["side"], Vector2i(info["x"], ccell.y), "silence_bomb", lifetime, false)
	_log(caster, "%s plants silence bomb at %s/%s" % [move.display_name, info["side"], str(Vector2i(info["x"], ccell.y))])

# === ABSORB POISON ===
# Mushroom defensive card: cures self of poison + activates a 3s window where
# poison tiles (poison_trap combo, acid_pool DoT) heal instead of damage.
# Caster can walk onto enemy poison tiles to nuke them as free heals.

const ABSORB_POISON_WINDOW_MS := 3000

static func _absorb_poison(move: MoveDef, caster, battle: Battle) -> void:
	caster.activate_poison_absorb(ABSORB_POISON_WINDOW_MS)
	_log(caster, "%s absorbs poison — %dms window to heal from tiles" % [move.display_name, ABSORB_POISON_WINDOW_MS])

# === DUST DEVIL ===
# 4-cell cross AoE centered on the opponent grid's mirror of caster cell.
# Whirlwind around the CASTER: strikes the 4 cells cardinally adjacent to
# the caster's own position (user amend — React 5169-5191 mirrored the shape
# onto the enemy grid instead). Forward/back neighbors resolve across the
# grid boundary, so from the front column the leading gust reaches the
# enemy's first cell. Defensive melee burst — Fudo's Dust Devil.

static func _dust_devil(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	# Lateral neighbors stay on the caster's grid.
	for dy in range(-1, 2, 2):
		var ny: int = ccell.y + dy
		if ny < 0 or ny >= Battle.GRID_ROWS:
			continue
		hit_count += _dust_devil_hit(battle, side, Vector2i(ccell.x, ny), dmg, move, caster)
	# Forward/back neighbors cross the boundary via combined-row coords.
	var gx := _to_global_x(side, ccell.x)
	for dgx in range(-1, 2, 2):
		var info: Dictionary = _split_global_x(gx + dgx)
		if info.is_empty():
			continue
		var n_side: String = info["side"]
		hit_count += _dust_devil_hit(battle, n_side, Vector2i(int(info["x"]), ccell.y), dmg, move, caster)
	_log(caster, "%s whirlwind hits %d of 4 surrounding cells (%d DMG each)" % [move.display_name, hit_count, dmg])

static func _dust_devil_hit(battle: Battle, side: String, cell: Vector2i, dmg: int, move: MoveDef, caster) -> int:
	_spawn_explosion_at(battle, battle.cell_to_world(side, cell), 0.9)
	var had_target := battle.combatant_at(side, cell) != null
	if _strike_cell(side, cell, dmg, move, caster, battle) and had_target:
		return 1
	return 0

# === THUNDER CLAP ===
# Lightning orb travels CCW around the perimeter of opponent's 4×4 grid,
# damaging any combatant on each cell it visits. 12 cells × 220ms = 2.64s
# total. Matches React App3D.tsx:4598-4632 (CCW path starting top-left, 8
# DMG per hit). React card description lies about 20 DMG / 4-cell.

const THUNDER_CLAP_STEP_S := 0.22
const THUNDER_CLAP_DAMAGE := 8

static func _thunder_clap(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var fwd_side := battle.forward_side(side)
	var dmg := _final_card_damage(move, caster)
	# CCW perimeter starting top-left: left edge down, bottom edge right,
	# right edge up, top edge left.
	var path: Array[Vector2i] = [
		Vector2i(0, 0), Vector2i(0, 1), Vector2i(0, 2), Vector2i(0, 3),
		Vector2i(1, 3), Vector2i(2, 3), Vector2i(3, 3),
		Vector2i(3, 2), Vector2i(3, 1), Vector2i(3, 0),
		Vector2i(2, 0), Vector2i(1, 0),
	]
	var tween := battle.create_tween()
	for cell in path:
		var world := battle.cell_to_world(fwd_side, cell)
		tween.tween_callback(MoveRegistry._emit_beam_segment.bind(battle, world, fwd_side, cell, dmg, move, caster))
		tween.tween_interval(THUNDER_CLAP_STEP_S)
	_log(caster, "%s thunder clap orbits opponent grid (%d cells, %d DMG/hit)" % [move.display_name, path.size(), dmg])

# === SHOCK THERAPY ===
# Hits the 4 cells adjacent to CASTER (on caster's own grid) + clears all
# TimedEffect tiles on the battlefield. The damage radius is centered on the
# caster, not on the opponent's mirror — Toadazer "shocks" the area around
# itself, then the EMP blast wipes the field clean.

static func _shock_therapy(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	var adj: Array[Vector2i] = [Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)]
	for offset in adj:
		var cell := Vector2i(ccell.x + offset.x, ccell.y + offset.y)
		if cell.x < 0 or cell.x >= Battle.GRID_COLS:
			continue
		if cell.y < 0 or cell.y >= Battle.GRID_ROWS:
			continue
		var world := battle.cell_to_world(side, cell)
		_spawn_explosion_at(battle, world, 0.9)
		var had_target := battle.combatant_at(side, cell) != null
		if _strike_cell(side, cell, dmg, move, caster, battle) and had_target:
			hit_count += 1
	battle.clear_all_tiles()
	_log(caster, "%s shock therapy — hit %d adjacent cells + cleared field tiles" % [move.display_name, hit_count])

# === QUICKDRAW ===
# Fires a 2× speed bullet straight down the row at 25 DMG. No ricochet.
# React App3D.tsx:5156-5167 (isQuickdraw flag).

const QUICKDRAW_SPEED := 26.0  # ~2× default bullet speed (13.0)
const QUICKDRAW_DAMAGE := 25

static func _quickdraw(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var dir := Vector3.RIGHT if side == Battle.SIDE_PLAYER else Vector3.LEFT
	var dmg := move.damage if move.damage > 0 else QUICKDRAW_DAMAGE
	battle.spawn_card_bullet(caster, dir, dmg, QUICKDRAW_SPEED, false, "quickdraw")
	_log(caster, "%s fires quickdraw (%d DMG, fast)" % [move.display_name, dmg])

# === RICOCHET ===
# Standard-speed bullet at 15 DMG that bounces back at the far edge if it
# misses, giving a second pass at hitting. React App3D.tsx:5193-5205.

const RICOCHET_DAMAGE := 15

static func _ricochet(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var dir := Vector3.RIGHT if side == Battle.SIDE_PLAYER else Vector3.LEFT
	var dmg := move.damage if move.damage > 0 else RICOCHET_DAMAGE
	battle.spawn_card_bullet(caster, dir, dmg, 13.0, true, "ricochet")
	_log(caster, "%s fires ricochet (%d DMG, bouncing)" % [move.display_name, dmg])

# === CALL FAMILY ===
# Summons 2 auto-firing turrets at the back-row corners of the OPPONENT'S
# grid (deepest cells from caster's POV). Player-cast turrets land at
# enemy-grid (GRID_COLS-1, 0) and (GRID_COLS-1, GRID_ROWS-1) and fire LEFT
# toward enemies. Enemy-cast mirrors. Per App3D.tsx:5738-5763.
#
# Defaults match React: HP 15, fire every 0.5s (~20 ticks at 112ms), 5 DMG.
# MoveDef overrides (damage, bullet_damage proxied via move.damage if >0).

const FAMILY_HP := 15
const FAMILY_FIRE_INTERVAL_S := 1.5  # was 0.5 — too spammy; React equivalent ~2.2s
const FAMILY_BULLET_DAMAGE := 5
# Pixie turret art — user-supplied per-ally sprites (already coloured) so we
# spawn them at white tint to keep their painted palette.
const FAMILY_SPRITE := preload("res://art/allies/call_family.png")
const SOLDIER_SPRITE := preload("res://art/allies/call_soldier.png")
const MUSHROOM_SOLDIER_SPRITE := preload("res://art/allies/mushroom_soldier.png")
const GENERATED_RAT_SPRITE := preload("res://art/allies/generated_rat.png")
const HEAL_RAT_SPRITE := preload("res://art/allies/heal_generated_rat.png")
const POISON_RAT_SPRITE := preload("res://art/allies/poison_generated_rat.png")
const TADPOLE_SPRITE := preload("res://art/allies/tadpole.png")

static func _call_family(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	# Place on caster's OWN back row corners (defensive position). Turrets
	# fire forward toward the opponent. React's literal x=7 was misleading;
	# the comment "back corners of player side" is the intent.
	var back_x := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var corner_top := Vector2i(back_x, 0)
	var corner_bot := Vector2i(back_x, Battle.GRID_ROWS - 1)
	var bullet_dmg := move.damage if move.damage > 0 else FAMILY_BULLET_DAMAGE
	battle.spawn_turret(caster, side, corner_top, FAMILY_HP, FAMILY_FIRE_INTERVAL_S, bullet_dmg, FAMILY_SPRITE, Color.WHITE)
	battle.spawn_turret(caster, side, corner_bot, FAMILY_HP, FAMILY_FIRE_INTERVAL_S, bullet_dmg, FAMILY_SPRITE, Color.WHITE)
	_log(caster, "%s calls family — 2× %d HP turret on %s at %s + %s" % [move.display_name, FAMILY_HP, side, str(corner_top), str(corner_bot)])

# === CONE ATTACK ===
# Pixie's "stunning gleam" shape (App3D.tsx:5715-5736):
#   - 1 cell at depth 1 (tip, caster's row)
#   - 3 cells at depth 2 (base — same row + ±1)
# Same damage + status_id rider per cell. Tip + base both come from
# _project_forward so the cone correctly crosses the grid boundary as
# caster advances toward the front column.

static func _cone_attack(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	# Depth 1: single cell on caster's row.
	var d1_info := _project_forward(side, ccell, 1)
	if not d1_info.is_empty():
		var d1_side: String = d1_info["side"]
		var d1_cell := Vector2i(d1_info["x"], ccell.y)
		var d1_world := battle.cell_to_world(d1_side, d1_cell)
		_spawn_slash(battle, d1_world, 0)
		var had_d1 := battle.combatant_at(d1_side, d1_cell) != null
		if _strike_cell(d1_side, d1_cell, dmg, move, caster, battle) and had_d1:
			hit_count += 1
	# Depth 2: 3-cell horizontal band (±1 row).
	var d2_info := _project_forward(side, ccell, 2)
	if not d2_info.is_empty():
		var d2_side: String = d2_info["side"]
		var d2_x: int = d2_info["x"]
		for dy in range(-1, 2):
			var cy: int = ccell.y + dy
			if cy < 0 or cy >= Battle.GRID_ROWS:
				continue
			var cell := Vector2i(d2_x, cy)
			var world := battle.cell_to_world(d2_side, cell)
			_spawn_slash(battle, world, dy)
			var had_target := battle.combatant_at(d2_side, cell) != null
			if _strike_cell(d2_side, cell, dmg, move, caster, battle) and had_target:
				hit_count += 1
	_log(caster, "%s cone — %d cells touched, hit %d (%d DMG each)" % [move.display_name, 1 + 3, hit_count, dmg])

# === CONDITIONAL HEAL ===
# Pixie's "absorb" — heals if opponent is currently stunned or poisoned.
# self_heal is the amount granted on success. Whiffs silently if no status.

static func _conditional_heal(move: MoveDef, caster, battle: Battle) -> void:
	var opp := battle.get_opponent(caster)
	if opp == null:
		_log(caster, "%s absorb whiffed (no opponent)" % move.display_name)
		return
	if not (opp.is_stunned() or opp.is_poisoned()):
		_log(caster, "%s absorb whiffed (opponent has no status)" % move.display_name)
		return
	var heal := move.self_heal if move.self_heal > 0 else 20
	caster.heal(heal)
	_log(caster, "%s absorbs — heals %d (opponent status active)" % [move.display_name, heal])

# === TELEPORT ===
# Caster blinks to a random safe cell on its own grid. "Safe" = not the
# caster's current cell, not a wall cell. Flashes at both origin and
# destination so the swap reads clearly. React equivalent: Slime "bounce"
# (App3D.tsx — teleport player to random safe tile).

static func _teleport(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var current_cell := battle.get_caster_cell(caster)
	var candidates: Array[Vector2i] = []
	for x in range(Battle.GRID_COLS):
		for y in range(Battle.GRID_ROWS):
			var c := Vector2i(x, y)
			if c == current_cell:
				continue
			if battle.combatant_blocked_at(side, c):
				continue
			candidates.append(c)
	if candidates.is_empty():
		_log(caster, "%s teleport whiffed (no safe cell)" % move.display_name)
		return
	var new_cell: Vector2i = candidates[randi() % candidates.size()]
	var origin_world := battle.cell_to_world(side, current_cell)
	var dest_world := battle.cell_to_world(side, new_cell)
	_spawn_teleport_flash(battle, origin_world)
	_spawn_teleport_flash(battle, dest_world)
	# Snap rather than tween — teleport should feel instant.
	caster.global_position = dest_world
	battle.set_caster_cell(caster, new_cell)
	_log(caster, "%s teleports %s → %s" % [move.display_name, str(current_cell), str(new_cell)])

static func _spawn_teleport_flash(battle: Battle, world_pos: Vector3) -> void:
	# User pixel-art portal — played at BOTH the departure and arrival cells
	# of every teleport (Blink, Random Hop, warp shot, Glacial Step, Rewind
	# Return…).
	_spawn_anim_fx(battle, world_pos + Vector3(0.0, 0.7, 0.0), TELEPORT_FRAMES, TELEPORT_FX_FRAME_S, 0.030)

# === LASSO VISUALS ===
# Brown rope stretched from caster to target's grab-point. Stays for the pull
# duration then fades — keeps the "hit and pull" read clear even though the
# rope doesn't dynamically track the target's tween.

const LASSO_FADE_S := 0.70

static func _spawn_lasso_rope(battle: Battle, caster_world: Vector3, target_world: Vector3, tint: Color = Color(1.0, 1.0, 1.0)) -> void:
	# User pixel-art chain (lasso_2.gif) — a flat plane stretched caster→
	# target with the chain texture tiled ALONG its length in the art's own
	# orientation, so every repeat links seamlessly into the next and the
	# 3-frame cycle reads as the chain pulling toward the caster. Tint:
	# yellow = Lasso, red = Blood Drain, plain = catch/others.
	var dist := caster_world.distance_to(target_world)
	if dist < 0.01:
		return
	var dir := (target_world - caster_world) / dist
	var rope := Node3D.new()
	var mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(dist, LASSO_ROPE_WIDTH)
	mesh.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = LASSO_FRAMES[0]
	mat.albedo_color = tint
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.uv1_scale = Vector3(dist / LASSO_LINK_LEN, 1.0, 1.0)
	mesh.material_override = mat
	rope.add_child(mesh)
	battle.spawn_world_fx(rope)
	rope.global_position = (caster_world + target_world) * 0.5
	# The chain's horizontal axis runs along the rope: X = pull direction,
	# Y = up (plane faces the tilted camera), Z completes the basis.
	var side_axis := dir.cross(Vector3.UP)
	if side_axis.length() < 0.01:
		side_axis = Vector3.FORWARD
	side_axis = side_axis.normalized()
	rope.global_transform.basis = Basis(dir, Vector3.UP, side_axis)
	# Cycle the chain frames once across the fade window.
	var frame_t := LASSO_FADE_S / float(LASSO_FRAMES.size())
	var anim := rope.create_tween()
	for i in range(1, LASSO_FRAMES.size()):
		var tex: Texture2D = LASSO_FRAMES[i]
		anim.tween_interval(frame_t)
		anim.tween_callback(func() -> void: mat.albedo_texture = tex)
	var fade := rope.create_tween()
	fade.tween_property(mat, "albedo_color:a", 0.0, LASSO_FADE_S)
	fade.tween_callback(rope.queue_free)

static func _spawn_lasso_impact(battle: Battle, world_pos: Vector3) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.40
	torus.outer_radius = 0.65
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.85, 0.35, 0.90)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.65, 0.25)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	battle.spawn_world_fx(ring)
	ring.global_position = world_pos + Vector3(0.0, 0.5, 0.0)
	ring.scale = Vector3.ONE * 0.45
	var tween := ring.create_tween().set_parallel(true)
	tween.tween_property(ring, "scale", Vector3.ONE * 1.4, LASSO_FADE_S)
	tween.tween_property(mat, "albedo_color:a", 0.0, LASSO_FADE_S)
	tween.chain().tween_callback(ring.queue_free)

# === LEMMEL: RAT PACK ===
# Two cells directly forward of caster. 10 DMG each + rat_dmg_bonus from
# Rat Flood trait. Visual = reused punch ring (per user spec: "a two cell in
# front of the player punch, you can animate with the punch animation").
# React App3D.tsx:5117-5126.

static func _rat_pack(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster) + TraitRegistry.rat_dmg_bonus(caster.traits)
	var hit_count := 0
	for d in range(1, 3):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			continue
		var dest_side: String = info["side"]
		var cell := Vector2i(info["x"], ccell.y)
		var world := battle.cell_to_world(dest_side, cell)
		_spawn_punch(battle, world, battle.get_side(caster) == Battle.SIDE_ENEMY)
		var had_target := battle.combatant_at(dest_side, cell) != null
		if _strike_cell(dest_side, cell, dmg, move, caster, battle) and had_target:
			hit_count += 1
	_log(caster, "%s rat pack — 2 cells front, hit %d (%d DMG each)" % [move.display_name, hit_count, dmg])

# === LEMMEL: TRASH TOSS ===
# Thrown projectile arcs 3 cells forward (or closest reachable). On landing:
# direct hit if combatant present → damage; otherwise spawn 1 wandering rat
# that random-walks the enemy grid and explodes on contact. Wall at landing
# cell absorbs the toss too (and the rat still drops).

const TRASH_TOSS_TRAVEL_S := 0.32
const TRASH_TOSS_RAT_LIFETIME_MS := 5000
const TRASH_TOSS_RAT_STEP_S := 0.55

static func _trash_toss(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Try depth 3 → 2 → 1 (so card still does something near the front column).
	var info: Dictionary = {}
	for d in range(3, 0, -1):
		info = _project_forward(side, ccell, d)
		if not info.is_empty():
			break
	if info.is_empty():
		_log(caster, "%s trash toss whiffed (no forward path)" % move.display_name)
		return
	var land_side: String = info["side"]
	var land_cell := Vector2i(info["x"], ccell.y)
	var dmg := _final_card_damage(move, caster) + TraitRegistry.rat_dmg_bonus(caster.traits)
	# Throw a small chunk of debris from caster to the landing cell.
	var proj := _make_trash_projectile()
	battle.spawn_world_fx(proj)
	proj.global_position = caster.global_position + Vector3(0.0, 0.6, 0.0)
	var dest := battle.cell_to_world(land_side, land_cell) + Vector3(0.0, 0.4, 0.0)
	var tween := proj.create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(proj, "global_position", dest, TRASH_TOSS_TRAVEL_S)
	tween.tween_callback(MoveRegistry._trash_land.bind(battle, land_side, land_cell, dmg, move, caster, proj))
	_log(caster, "%s tosses trash to %s/%s" % [move.display_name, land_side, str(land_cell)])

static func _trash_land(battle: Battle, land_side: String, land_cell: Vector2i, dmg: int, move: MoveDef, caster, proj: Node3D) -> void:
	if is_instance_valid(proj):
		proj.queue_free()
	if not is_instance_valid(battle):
		return
	_spawn_explosion_at(battle, battle.cell_to_world(land_side, land_cell), 0.7)
	# Wall absorbs trash (counts as a miss for rat-drop purposes too).
	var wall := battle.wall_at_cell(land_side, land_cell)
	if wall != null and wall.owner_combatant != caster:
		wall.take_damage(1, caster)
		_log(caster, "%s trash blocked by wall — wandering rat spawns anyway" % move.display_name)
		_spawn_wandering_rat(battle, caster, land_side, land_cell, dmg)
		return
	var target := battle.combatant_at(land_side, land_cell)
	if target != null and target != caster and target.is_alive():
		_strike(target, dmg, move, caster)
		_log(caster, "%s trash hits %s for %d" % [move.display_name, target.display_name, dmg])
		return
	# Miss → wandering rat.
	_spawn_wandering_rat(battle, caster, land_side, land_cell, dmg)
	_log(caster, "%s trash misses — wandering rat at %s/%s" % [move.display_name, land_side, str(land_cell)])

static func _spawn_wandering_rat(battle: Battle, caster, side: String, cell: Vector2i, dmg: int) -> void:
	var rat := battle.spawn_turret(caster, side, cell, 1, 99.0, 0, GENERATED_RAT_SPRITE, Color.WHITE)
	if rat == null:
		return
	rat.fires_bullets = false
	rat.move_interval_s = TRASH_TOSS_RAT_STEP_S
	rat.contact_damage = dmg
	rat.contact_label = "trash_toss_rat"
	rat.contact_type = caster.monster_type
	rat.lifetime_ms = TRASH_TOSS_RAT_LIFETIME_MS

static func _make_trash_projectile() -> Node3D:
	var root := Node3D.new()
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.30, 0.30, 0.30)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.40, 0.25, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.45, 0.30, 0.15)
	mat.emission_energy_multiplier = 1.8
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material_override = mat
	mesh.rotation = Vector3(deg_to_rad(22), deg_to_rad(35), deg_to_rad(18))
	root.add_child(mesh)
	return root

# === LEMMEL: STREET SWARM ===
# Spawn up to 4 rats on the cardinal-adjacent cells of caster (N/S/E/W,
# in-bounds only). Each rat uses random_forward_walker: 70% step toward
# enemy, 30% random dx, always random dy in [-1, +1]. Per-rat cadence jitter
# so they don't march in unison. Damage on contact + self-destruct, despawn
# at lifetime expiry.

const SWARM_BASE_STEP_S := 0.45
const SWARM_STEP_JITTER_S := 0.25  # ±half added to base = 0.32..0.70 range
const SWARM_RAT_LIFETIME_MS := 5500
const SWARM_RAT_HP := 1

static func _street_swarm(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster) + TraitRegistry.rat_dmg_bonus(caster.traits)
	# Cardinal adjacents only. At a corner Lemmel gets 2; at an edge, 3; mid-grid 4.
	# Strategic incentive to position centrally before casting.
	var offsets: Array[Vector2i] = [
		Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)
	]
	var spawn_count := 0
	for off in offsets:
		var spawn_cell := Vector2i(ccell.x + off.x, ccell.y + off.y)
		if spawn_cell.x < 0 or spawn_cell.x >= Battle.GRID_COLS:
			continue
		if spawn_cell.y < 0 or spawn_cell.y >= Battle.GRID_ROWS:
			continue
		var rat := battle.spawn_turret(caster, side, spawn_cell, SWARM_RAT_HP, 99.0, 0, GENERATED_RAT_SPRITE, Color.WHITE)
		if rat == null:
			continue
		rat.fires_bullets = false
		# Jittered step interval so rats don't march in lockstep.
		rat.move_interval_s = SWARM_BASE_STEP_S + randf_range(-SWARM_STEP_JITTER_S * 0.5, SWARM_STEP_JITTER_S * 0.5)
		rat.random_forward_walker = true
		rat.contact_damage = dmg
		rat.contact_label = "street_swarm"
		rat.contact_type = caster.monster_type
		rat.lifetime_ms = SWARM_RAT_LIFETIME_MS
		spawn_count += 1
	_log(caster, "%s street swarm — %d rats from adjacent tiles, advancing erratically (%d DMG each)" % [move.display_name, spawn_count, dmg])

# === LEMMEL: PLAGUE BITE ===
# Same-row 2-cell forward melee. 20 DMG + 5 DMG/s poison for 5s on hit
# (poison rider applied via _strike's move.status_id branch). Burst visual
# fires on both front cells regardless. React App3D.tsx:5230-5278.

static func _plague_bite(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	for d in range(1, 3):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			continue
		var dest_side: String = info["side"]
		var cell := Vector2i(info["x"], ccell.y)
		var world := battle.cell_to_world(dest_side, cell)
		_spawn_punch(battle, world, battle.get_side(caster) == Battle.SIDE_ENEMY)
		var had_target := battle.combatant_at(dest_side, cell) != null
		if _strike_cell(dest_side, cell, dmg, move, caster, battle) and had_target:
			hit_count += 1
	_log(caster, "%s plague bites — %d cells hit, %d DMG, 5s poison rider" % [move.display_name, hit_count, dmg])

# === LEMMEL: SCAVENGE ===
# +2 mana to caster, capped at max_mana. React App3D.tsx:5297-5299.

const SCAVENGE_MANA := 2

static func _scavenge(_move: MoveDef, caster, _battle: Battle) -> void:
	caster.gain_mana(SCAVENGE_MANA)
	_log(caster, "scavenges +%d mana" % SCAVENGE_MANA)

# === LEMMEL: MEDICAL MOUSE ===
# Summons 1 healing rat that roams caster's grid (random-adjacent walk like
# Call Soldier) and drops a holy_tile on its current cell every 3 seconds.
# holy_tile heals ANY occupant (3 HP/s) — interesting future synergy with
# zone-steal cards. No bullets, 20 HP, infinite lifetime (until killed).

const MEDICAL_MOUSE_HP := 20
const MEDICAL_MOUSE_MOVE_S := 1.6  # slower roaming so heal tiles get used
const MEDICAL_MOUSE_DROP_S := 3.0  # tile every 3s per spec
const MEDICAL_MOUSE_TILE_MS := 3000

static func _medical_mouse(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Spawn at caster's front cell on their OWN grid (clamped) so the heal
	# tiles land in useful territory immediately. Falls back to caster's cell
	# if at front column.
	var dx := 1 if side == Battle.SIDE_PLAYER else -1
	var spawn_x := clampi(ccell.x + dx, 0, Battle.GRID_COLS - 1)
	var spawn_cell := Vector2i(spawn_x, ccell.y)
	if spawn_cell == ccell:
		# Try alternate adjacent if caster occupies front column.
		var alt := Vector2i(ccell.x, clampi(ccell.y + 1, 0, Battle.GRID_ROWS - 1))
		if alt == ccell:
			alt = Vector2i(ccell.x, clampi(ccell.y - 1, 0, Battle.GRID_ROWS - 1))
		spawn_cell = alt
	var mouse := battle.spawn_turret(caster, side, spawn_cell, MEDICAL_MOUSE_HP, 99.0, 0, HEAL_RAT_SPRITE, Color.WHITE)
	if mouse == null:
		_log(caster, "%s medical mouse failed to spawn" % move.display_name)
		return
	mouse.fires_bullets = false
	mouse.move_interval_s = MEDICAL_MOUSE_MOVE_S
	mouse.tile_drop_interval_s = MEDICAL_MOUSE_DROP_S
	mouse.drop_tile_on_step = "holy_tile"
	mouse.drop_tile_lifetime_ms = MEDICAL_MOUSE_TILE_MS
	_log(caster, "%s summons medical mouse at %s/%s (holy tile every %.1fs)" % [move.display_name, side, str(spawn_cell), MEDICAL_MOUSE_DROP_S])

# === LEMMEL: POISON SWARM ===
# 3 rats at caster's cardinal adjacents (first 3 in-bounds). Each uses the
# random_forward_walker mode and drops a poison_trap tile on every cell it
# leaves. 5 DMG contact damage (+rat_dmg_bonus) + self-destruct on hit.
# Trail tiles last 3s; rats live 8s. Pure pressure card — drops a moving
# wall of poison across the field.

const POISON_SWARM_RAT_HP := 1
const POISON_SWARM_CONTACT_DMG := 5
const POISON_SWARM_BASE_STEP_S := 0.55
const POISON_SWARM_STEP_JITTER_S := 0.30
const POISON_SWARM_RAT_LIFETIME_MS := 8000
const POISON_SWARM_TILE_MS := 3000
const POISON_SWARM_COUNT := 3

static func _poison_swarm(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var contact_dmg := POISON_SWARM_CONTACT_DMG + TraitRegistry.rat_dmg_bonus(caster.traits)
	var offsets: Array[Vector2i] = [
		Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)
	]
	var spawn_count := 0
	for off in offsets:
		if spawn_count >= POISON_SWARM_COUNT:
			break
		var spawn_cell := Vector2i(ccell.x + off.x, ccell.y + off.y)
		if spawn_cell.x < 0 or spawn_cell.x >= Battle.GRID_COLS:
			continue
		if spawn_cell.y < 0 or spawn_cell.y >= Battle.GRID_ROWS:
			continue
		var rat := battle.spawn_turret(caster, side, spawn_cell, POISON_SWARM_RAT_HP, 99.0, 0, POISON_RAT_SPRITE, Color.WHITE)
		if rat == null:
			continue
		rat.fires_bullets = false
		rat.move_interval_s = POISON_SWARM_BASE_STEP_S + randf_range(-POISON_SWARM_STEP_JITTER_S * 0.5, POISON_SWARM_STEP_JITTER_S * 0.5)
		rat.random_forward_walker = true
		rat.contact_damage = contact_dmg
		rat.contact_label = "poison_swarm"
		rat.contact_type = caster.monster_type
		rat.lifetime_ms = POISON_SWARM_RAT_LIFETIME_MS
		rat.drop_tile_on_step = "poison_trap"
		rat.drop_tile_lifetime_ms = POISON_SWARM_TILE_MS
		spawn_count += 1
	_log(caster, "%s poison swarm — %d rats (%d DMG contact, %dms poison trail)" % [move.display_name, spawn_count, contact_dmg, POISON_SWARM_TILE_MS])

# === MALIPOLE: TONGUE WHIP ===
# 3-cell forward scan from caster on same row. First wall OR combatant in
# path takes the hit. Walls eat full card damage (per spec: "as if hitting
# the first enemy"); combatants get damage + stun rider. Pink tongue rope
# extends to the impact point or retracts from tail cell on whiff (mirrors
# lasso UX). React App3D.tsx:4780-4806.

const TONGUE_WHIP_FORWARD_TILES := 3
const TONGUE_FADE_S := 0.55

static func _tongue_whip(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Build the forward path cell-by-cell (1..3 cells from caster).
	var path: Array = []
	for d in range(1, TONGUE_WHIP_FORWARD_TILES + 1):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
	if path.is_empty():
		_log(caster, "%s tongue whip whiffed (no forward path)" % move.display_name)
		return
	# Scan path — first hostile wall OR combatant claims the hit.
	var hit_combatant: Combatant = null
	var hit_wall: Wall = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var wall := battle.wall_at_cell(entry["side"], entry["cell"])
		if wall != null and wall.owner_combatant != caster:
			hit_wall = wall
			hit_entry = entry
			break
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			hit_combatant = occupant
			hit_entry = entry
			break
	# Pink tongue rope always renders so the user reads the throw.
	var caster_world: Vector3 = caster.global_position + Vector3(0.0, 0.8, 0.0)
	var tongue_end: Vector3
	if hit_combatant != null:
		tongue_end = hit_combatant.global_position + Vector3(0.0, 0.8, 0.0)
	elif hit_wall != null:
		tongue_end = hit_wall.global_position + Vector3(0.0, 0.8, 0.0)
	else:
		var tail_entry: Dictionary = path[path.size() - 1]
		tongue_end = battle.cell_to_world(tail_entry["side"], tail_entry["cell"]) + Vector3(0.0, 0.8, 0.0)
	_spawn_tongue_rope(battle, caster_world, tongue_end)
	var dmg := _final_card_damage(move, caster)
	# Wall takes priority — full card damage (per user spec).
	if hit_wall != null:
		_spawn_tongue_impact(battle, hit_wall.global_position)
		hit_wall.take_damage(dmg, caster)
		_log(caster, "%s tongue whips wall at %s/%s for %d" % [move.display_name, hit_entry["side"], str(hit_entry["cell"]), dmg])
		return
	if hit_combatant == null:
		_log(caster, "%s tongue whip whiffed (no target in 3-cell reach)" % move.display_name)
		return
	_spawn_tongue_impact(battle, hit_combatant.global_position)
	if dmg > 0:
		_strike(hit_combatant, dmg, move, caster)  # _strike applies status_id rider (stun)
	_log(caster, "%s tongue whips %s for %d (+%dms stun)" % [move.display_name, hit_combatant.display_name, dmg, move.status_duration_ms])

# Pink tongue stretched from caster to target. Slightly thinner than the
# lasso rope so the two cards read as distinct. Fades over TONGUE_FADE_S.
static func _spawn_tongue_rope(battle: Battle, caster_world: Vector3, target_world: Vector3) -> void:
	var rope := Node3D.new()
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.14, 0.14, 1.0)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.95, 0.45, 0.65, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.50, 0.70)
	mat.emission_energy_multiplier = 3.2
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh.material_override = mat
	rope.add_child(mesh)
	battle.spawn_world_fx(rope)
	var mid := (caster_world + target_world) * 0.5
	rope.global_position = mid
	var dist := caster_world.distance_to(target_world)
	if dist > 0.01:
		rope.look_at(target_world, Vector3.UP)
	rope.scale = Vector3(1.0, 1.0, dist)
	var tween := rope.create_tween().set_parallel(true)
	tween.tween_property(mat, "albedo_color:a", 0.0, TONGUE_FADE_S)
	tween.chain().tween_callback(rope.queue_free)

# Pink impact ring at the hit cell (or wall position). Same expand+fade as
# lasso impact, recolored for the tongue.
static func _spawn_tongue_impact(battle: Battle, world_pos: Vector3) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.40
	torus.outer_radius = 0.65
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.60, 0.80, 0.90)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.50, 0.70)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	battle.spawn_world_fx(ring)
	ring.global_position = world_pos + Vector3(0.0, 0.5, 0.0)
	ring.scale = Vector3.ONE * 0.45
	var tween := ring.create_tween().set_parallel(true)
	tween.tween_property(ring, "scale", Vector3.ONE * 1.4, TONGUE_FADE_S)
	tween.tween_property(mat, "albedo_color:a", 0.0, TONGUE_FADE_S)
	tween.chain().tween_callback(ring.queue_free)

# === MALIPOLE: RANDOM HOP ===
# Tongue-whip geometry (3-cell forward scan, wall-first then combatant)
# but the landed effect is a teleport: target takes damage and warps to a
# random safe cell on its own grid. Cyan beam + dual teleport flashes at
# source/destination. Walls just eat the damage (nothing to teleport).
# Diverges from React (App3D.tsx:4807-4832) per user spec — React fires
# at "nearest enemy" without a scan, we add the scan to match Tongue Whip.

const RANDOM_HOP_FORWARD_TILES := 3

static func _random_hop(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var path: Array = []
	for d in range(1, RANDOM_HOP_FORWARD_TILES + 1):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
	if path.is_empty():
		_log(caster, "%s random hop whiffed (no forward path)" % move.display_name)
		return
	var hit_combatant: Combatant = null
	var hit_wall: Wall = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var wall := battle.wall_at_cell(entry["side"], entry["cell"])
		if wall != null and wall.owner_combatant != caster:
			hit_wall = wall
			hit_entry = entry
			break
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			hit_combatant = occupant
			hit_entry = entry
			break
	var caster_world: Vector3 = caster.global_position + Vector3(0.0, 0.8, 0.0)
	var beam_end: Vector3
	if hit_combatant != null:
		beam_end = hit_combatant.global_position + Vector3(0.0, 0.8, 0.0)
	elif hit_wall != null:
		beam_end = hit_wall.global_position + Vector3(0.0, 0.8, 0.0)
	else:
		var tail_entry: Dictionary = path[path.size() - 1]
		beam_end = battle.cell_to_world(tail_entry["side"], tail_entry["cell"]) + Vector3(0.0, 0.8, 0.0)
	_spawn_hop_beam(battle, caster_world, beam_end)
	var dmg := _final_card_damage(move, caster)
	# Wall blocks — full card damage, no teleport.
	if hit_wall != null:
		_spawn_teleport_flash(battle, hit_wall.global_position)
		hit_wall.take_damage(dmg, caster)
		_log(caster, "%s random hop hits wall at %s/%s for %d" % [move.display_name, hit_entry["side"], str(hit_entry["cell"]), dmg])
		return
	if hit_combatant == null:
		_log(caster, "%s random hop whiffed (no target in 3-cell reach)" % move.display_name)
		return
	# Strike first (might KO before teleport).
	var target_side: String = hit_entry["side"]
	var target_cell: Vector2i = hit_entry["cell"]
	var origin_world := hit_combatant.global_position
	if dmg > 0:
		_strike(hit_combatant, dmg, move, caster)
	if not hit_combatant.is_alive():
		_spawn_teleport_flash(battle, origin_world)
		_log(caster, "%s random hop KO'd %s before hop" % [move.display_name, hit_combatant.display_name])
		return
	# Pick a random safe cell on target's own grid (exclude current + walls).
	var candidates: Array[Vector2i] = []
	for x in range(Battle.GRID_COLS):
		for y in range(Battle.GRID_ROWS):
			var c := Vector2i(x, y)
			if c == target_cell:
				continue
			if battle.combatant_blocked_at(target_side, c):
				continue
			candidates.append(c)
	if candidates.is_empty():
		_spawn_teleport_flash(battle, origin_world)
		_log(caster, "%s random hop — no safe destination cell" % move.display_name)
		return
	var new_cell: Vector2i = candidates[randi() % candidates.size()]
	var dest_world := battle.cell_to_world(target_side, new_cell)
	_spawn_teleport_flash(battle, origin_world)
	_spawn_teleport_flash(battle, dest_world)
	hit_combatant.global_position = dest_world
	battle.set_caster_cell(hit_combatant, new_cell)
	_log(caster, "%s random hop — %s warped to %s/%s" % [move.display_name, hit_combatant.display_name, target_side, str(new_cell)])

# Cyan teleport beam — same geometry as tongue rope but recolored to signal
# "magic warp" rather than "sticky tongue".
static func _spawn_hop_beam(battle: Battle, caster_world: Vector3, target_world: Vector3) -> void:
	var rope := Node3D.new()
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.14, 0.14, 1.0)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.85, 1.0, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.45, 0.75, 1.0)
	mat.emission_energy_multiplier = 3.6
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh.material_override = mat
	rope.add_child(mesh)
	battle.spawn_world_fx(rope)
	var mid := (caster_world + target_world) * 0.5
	rope.global_position = mid
	var dist := caster_world.distance_to(target_world)
	if dist > 0.01:
		rope.look_at(target_world, Vector3.UP)
	rope.scale = Vector3(1.0, 1.0, dist)
	var tween := rope.create_tween().set_parallel(true)
	tween.tween_property(mat, "albedo_color:a", 0.0, TONGUE_FADE_S)
	tween.chain().tween_callback(rope.queue_free)

# === MALIPOLE: HEX TILES ===
# Drops 2 random hex tiles on the cells 1 and 2 forward of caster. Each tile
# rolls uniformly from 8 effects (independent rolls — can land 2 of the same):
#   vine_snare    — 10 DMG + 3.4s stun + self-consume (existing tile)
#   contact_bomb  — 40 DMG burst + self-consume (existing tile)
#   acid_pool     — 2 DMG/tick DoT for 4s (existing tile, owner-immune)
#   frozen_tile   — slip target in their last_move_direction (no damage)
#   burn_tile     — 2 fire-typed DMG/sec for 4s
#   stun_tile     — 1s stun + self-consume (no damage)
#   broken_tile   — TimedEffect, no contact action — blocks combatant
#                   movement but lets bullets/cards fly through; 5s lifetime
#                   (Battle.combatant_blocked_at picks it up). Red X visual.
#   block_tile    — spawns a destructible Wall (1 HP, 4s lifetime) — true
#                   physical block; intercepts bullets + movement until KO'd
#                   or expired.
# Tile lifetime: 4 seconds (broken_tile uses BROKEN_TILE_LIFETIME_MS = 5000).
# React equivalent (App3D.tsx:4943-4963) only rolled 3 effects.

const HEX_TILE_LIFETIME_MS := 4000
const BROKEN_TILE_LIFETIME_MS := 5000
const HEX_TILE_KINDS: Array = [
	"vine_snare", "contact_bomb", "acid_pool",
	"frozen_tile", "burn_tile", "stun_tile",
	"broken_tile", "block_tile",
]

static func _hex_tiles(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var spawned: Array[String] = []
	for d in range(1, 3):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			continue
		var tile_side: String = info["side"]
		var tile_cell := Vector2i(info["x"], ccell.y)
		var kind: String = HEX_TILE_KINDS[randi() % HEX_TILE_KINDS.size()]
		spawned.append(kind)
		if kind == "block_tile":
			var wall := battle.spawn_wall(caster, tile_side, tile_cell, 1)
			if wall != null:
				wall.lifetime_ms = HEX_TILE_LIFETIME_MS
		elif kind == "broken_tile":
			battle.spawn_tile(caster, tile_side, tile_cell, "broken_tile", BROKEN_TILE_LIFETIME_MS, false)
		else:
			battle.spawn_tile(caster, tile_side, tile_cell, kind, HEX_TILE_LIFETIME_MS, false)
	_log(caster, "%s hexes 2 cells — %s" % [move.display_name, str(spawned)])

# === MALIPOLE: SPAWN TADPOLE ===
# One homing tadpole walker spawned 1 cell forward of caster. Each step it
# snaps its y to the opponent's current row and advances forward in x only
# (no reverse — opponent can dodge by stepping behind the tadpole). Damages
# 10 + dies on first combatant contact (via Turret.contact_damage). Hostile
# walls in its path take 10 DMG + the tadpole self-destructs. Walks off the
# far edge if it never connects.
# React equivalent (App3D.tsx:4899-4910) used a fixed zigzag; user spec
# changed it to opponent-row homing.

const TADPOLE_HP := 1
const TADPOLE_STEP_S := 0.30
const TADPOLE_DAMAGE := 10

static func _spawn_tadpole(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Spawn 1 cell forward of caster — emerges from the frog's mouth.
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s tadpole whiffed (no forward cell)" % move.display_name)
		return
	var spawn_side: String = info["side"]
	var spawn_cell := Vector2i(info["x"], ccell.y)
	# Route through _final_card_damage so dmg_dealt buffs (Frog Chorus frenzy)
	# + card_type mults apply at spawn time. Locked in for the tadpole's
	# lifetime — a single frenzy roll, not per-step.
	var dmg := _final_card_damage(move, caster)
	var tadpole := battle.spawn_turret(caster, spawn_side, spawn_cell, TADPOLE_HP, 99.0, 0, TADPOLE_SPRITE, Color.WHITE)
	if tadpole == null:
		_log(caster, "%s tadpole failed to spawn" % move.display_name)
		return
	tadpole.fires_bullets = false
	tadpole.forward_walker = true
	tadpole.homing_to_opponent_y = true
	tadpole.move_interval_s = TADPOLE_STEP_S
	tadpole.contact_damage = dmg
	tadpole.contact_label = "tadpole"
	tadpole.contact_type = move.move_type if not move.move_type.is_empty() else "water"
	_log(caster, "%s spawns homing tadpole at %s/%s (%d DMG)" % [move.display_name, spawn_side, str(spawn_cell), dmg])

# === MALIPOLE: FROG CHORUS ===
# 5s frenzy buff. While active, EVERY damage Malipole deals (basic shots,
# cards, summon contact damage) is multiplied by a fresh random roll in
# [1.1, 2.0]. Each damage event rolls independently — basic shots can vary
# wildly mid-burst. Green pulsing halo. React equivalent (App3D.tsx:4833-4845)
# used 1-5× on basic shots only; user spec widens scope but tightens range.

const FROG_CHORUS_DURATION_MS := 5000
const FROG_CHORUS_MIN_MULT := 1.1
const FROG_CHORUS_MAX_MULT := 2.0

static func _frog_chorus(move: MoveDef, caster, battle: Battle) -> void:
	var duration: int = move.buff_duration_ms if move.buff_duration_ms > 0 else FROG_CHORUS_DURATION_MS
	apply_frenzy_buff(caster, duration, move.display_name)

# Public helper — applies the Frog Chorus frenzy (random 1.1-2× dealt mult)
# + green pulsing halo. Called by _frog_chorus AND by Battle when Malipole's
# charged-bullet combo lands the third hit.
static func apply_frenzy_buff(caster, duration_ms: int, source_label: String) -> void:
	var buff: Dictionary = caster.apply_buff("frenzy", 1.0, 1.0, duration_ms)
	buff["dealt_min"] = FROG_CHORUS_MIN_MULT
	buff["dealt_max"] = FROG_CHORUS_MAX_MULT
	# Froggy green halo, snappier pulse than other buffs to feel manic.
	var halo := _make_buff_halo(Color(0.45, 1.00, 0.40))
	caster.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.20, 0.35).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.60, 0.35).set_trans(Tween.TRANS_SINE)
	_log(caster, "%s — frenzy %.1f-%.1f× for %dms" % [source_label, FROG_CHORUS_MIN_MULT, FROG_CHORUS_MAX_MULT, duration_ms])

# === MALIPOLE: CROAK BLAST ===
# Slow forward beam — origin is the cell 1 forward of caster (Malipole's
# "mouth"). Sweeps along caster's row toward the enemy at ~300ms/cell,
# 20 DMG per cell. First hostile wall absorbs the beam and stops the sweep
# (same termination rule as the basic _beam handler). Reuses
# _emit_beam_segment from the existing beam pipeline.

const CROAK_BLAST_CELL_DELAY_S := 0.30

static func _croak_blast(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	# Forward path from caster.front (depth 1) outward; stop on first hostile wall.
	var fire_path: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var seg_side: String = info["side"]
		var seg_cell := Vector2i(info["x"], ccell.y)
		fire_path.append({"side": seg_side, "cell": seg_cell})
		var w := battle.wall_at_cell(seg_side, seg_cell)
		if w != null and w.owner_combatant != caster:
			break
		d += 1
	if fire_path.is_empty():
		_log(caster, "%s croak blast whiffed (no forward path)" % move.display_name)
		return
	var tween := battle.create_tween()
	for entry in fire_path:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		var world := battle.cell_to_world(seg_side, seg_cell)
		tween.tween_callback(MoveRegistry._emit_beam_segment.bind(battle, world, seg_side, seg_cell, dmg, move, caster))
		tween.tween_interval(CROAK_BLAST_CELL_DELAY_S)
	_log(caster, "%s croak blast sweeps %d cells forward from %s (%d DMG/cell, %.2fs/cell)" % [move.display_name, fire_path.size(), str(ccell), dmg, CROAK_BLAST_CELL_DELAY_S])

# === MALIPOLE: LILY PAD TRAP ===
# Drops 2 vine_snare tiles at random cells within the enemy grid's center
# 2×2 region (cells (1,1), (1,2), (2,1), (2,2)). Tiles last 2s. On contact
# each tile triggers the existing vine_snare behavior — 10 DMG + 3.4s stun
# + self-consume. Picks without replacement so the 2 tiles land on distinct
# cells. React equivalent (App3D.tsx:4847-4866) picked from 5 preset spots
# with 10s lifetime; user spec tightened both.

const LILY_PAD_LIFETIME_MS := 2000
const LILY_PAD_CENTER_CELLS: Array = [
	Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 1), Vector2i(2, 2)
]

static func _lily_pad_trap(move: MoveDef, caster, battle: Battle) -> void:
	var fwd_side := battle.forward_side(battle.get_side(caster))
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else LILY_PAD_LIFETIME_MS
	# Copy + shuffle so picks are distinct.
	var pool: Array = LILY_PAD_CENTER_CELLS.duplicate()
	pool.shuffle()
	var picks: Array[Vector2i] = []
	for i in range(mini(2, pool.size())):
		picks.append(pool[i])
	for c in picks:
		battle.spawn_tile(caster, fwd_side, c, "vine_snare", lifetime, false)
	_log(caster, "%s lays %d lily pad vines on %s center: %s" % [move.display_name, picks.size(), fwd_side, str(picks)])

# === DRAGONE: VAMPIRIC MIST ===
# Drops a vamp_mist tile at the OPPONENT'S current cell (dissolve-style
# placement, not depth-1 forward). Tile ticks 3 fire/dark DMG/sec on the
# occupant + heals caster 2/sec for 3 seconds. Owner-immune (caster can walk
# through their own cloud). React equivalent: App3D.tsx:5683-5690.

const VAMPIRIC_MIST_LIFETIME_MS := 3000

static func _vampiric_mist(move: MoveDef, caster, battle: Battle) -> void:
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		_log(caster, "%s vampiric mist whiffed (no opponent)" % move.display_name)
		return
	var opp_side := battle.get_side(opp)
	var opp_cell := battle.get_caster_cell(opp)
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else VAMPIRIC_MIST_LIFETIME_MS
	battle.spawn_tile(caster, opp_side, opp_cell, "vamp_mist", lifetime, false)
	_log(caster, "%s drops vampiric mist on %s/%s (%dms)" % [move.display_name, opp_side, str(opp_cell), lifetime])

# === DRAGONE: SONAR JAM ===
# Apply 2× mana regen to caster for 2s. If the opponent is on the same row
# as the caster, silence them for 2s. Visual: purple expanding ring on
# caster + secondary ring on opponent when silenced. React equivalent:
# App3D.tsx:5591-5610 (description-aligned per user spec — silence opponent,
# not self).

const SONAR_JAM_DURATION_MS := 2000

static func _sonar_jam(move: MoveDef, caster, battle: Battle) -> void:
	caster.apply_mana_boost(SONAR_JAM_DURATION_MS)
	_spawn_sonar_pulse(battle, caster.global_position, Color(0.70, 0.45, 1.00))
	var opp := battle.get_opponent(caster)
	var ccell := battle.get_caster_cell(caster)
	if opp != null and opp.is_alive():
		var opp_cell := battle.get_caster_cell(opp)
		if opp_cell.y == ccell.y:
			opp.apply_silence(SONAR_JAM_DURATION_MS)
			_spawn_sonar_pulse(battle, opp.global_position, Color(0.95, 0.45, 1.00))
			_log(caster, "%s — mana boost + silence %s (same-row hit)" % [move.display_name, opp.display_name])
			return
	_log(caster, "%s — mana boost only (opponent not on row)" % move.display_name)

# Pulsing torus ring used by sonar_jam for the caster boost FX + the silence
# FX on opponent. Expands and fades over a short duration.
static func _spawn_sonar_pulse(battle: Battle, world_pos: Vector3, tint: Color) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.45
	torus.outer_radius = 0.70
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(tint.r, tint.g, tint.b, 0.85)
	mat.emission_enabled = true
	mat.emission = tint
	mat.emission_energy_multiplier = 3.4
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring.material_override = mat
	battle.spawn_world_fx(ring)
	ring.global_position = world_pos + Vector3(0.0, 0.55, 0.0)
	ring.scale = Vector3.ONE * 0.30
	var tween := ring.create_tween().set_parallel(true)
	tween.tween_property(ring, "scale", Vector3.ONE * 1.7, 0.55).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(mat, "albedo_color:a", 0.0, 0.55)
	tween.chain().tween_callback(ring.queue_free)

# === DRAGONE: SWOOP ===
# Segment-by-segment forward beam from caster's row. Each segment fires after
# a small delay. On hostile wall: damage wall + stop further segments. On
# combatant: damage + push 1 cell forward (further from caster) + stop. The
# stop is achieved via a shared dict captured by all callbacks. Cyan wing
# segment FX. React equivalent: App3D.tsx:5611-5621 (single "flyingsword"
# entity moving forward each tick).

const SWOOP_CELL_DELAY_S := 0.13

static func _swoop(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	var push_dir := 1 if side == Battle.SIDE_PLAYER else -1
	var state := {"stopped": false}
	var tween := battle.create_tween()
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var seg_side: String = info["side"]
		var seg_cell := Vector2i(info["x"], ccell.y)
		tween.tween_callback(MoveRegistry._swoop_segment.bind(battle, seg_side, seg_cell, dmg, move, caster, push_dir, state))
		tween.tween_interval(SWOOP_CELL_DELAY_S)
		d += 1
	_log(caster, "%s swoops forward (%d DMG)" % [move.display_name, dmg])

static func _swoop_segment(battle: Battle, seg_side: String, seg_cell: Vector2i, dmg: int, move: MoveDef, caster, push_dir: int, state: Dictionary) -> void:
	if state.get("stopped", false):
		return
	if not is_instance_valid(battle):
		return
	var world := battle.cell_to_world(seg_side, seg_cell)
	_spawn_swoop_segment(battle, world, battle.get_side(caster) == Battle.SIDE_ENEMY)
	var wall := battle.wall_at_cell(seg_side, seg_cell)
	if wall != null and wall.owner_combatant != caster:
		wall.take_damage(dmg, caster)
		state["stopped"] = true
		return
	var occupant := battle.combatant_at(seg_side, seg_cell)
	if occupant != null and occupant != caster and occupant.is_alive():
		_strike(occupant, dmg, move, caster)
		if occupant.is_alive():
			_swoop_push(battle, occupant, seg_side, seg_cell, push_dir)
		state["stopped"] = true

# Push the swoop's victim 1 cell further along the swoop's travel direction,
# clamped to grid + blocked-cell aware. Stays on the victim's own grid (no
# cross-side teleport via push).
static func _swoop_push(battle: Battle, target: Combatant, target_side: String, target_cell: Vector2i, push_dir: int) -> void:
	var new_x := clampi(target_cell.x + push_dir, 0, Battle.GRID_COLS - 1)
	if new_x == target_cell.x:
		return  # pinned to grid edge
	var new_cell := Vector2i(new_x, target_cell.y)
	if battle.combatant_blocked_at(target_side, new_cell):
		return
	var dest := battle.cell_to_world(target_side, new_cell)
	battle.set_caster_cell(target, new_cell)
	var captured := target
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(captured, "global_position", dest, 0.15)

# Wing-shaped quad with a cyan tint — distinguishes swoop from beam/screech.
static func _spawn_swoop_segment(battle: Battle, world_pos: Vector3, flip_h: bool = false) -> void:
	# User pixel-art swoop arc — replaces the tilted wing quad. Enemy-side
	# swoops flip so the arc sweeps from their direction.
	_spawn_anim_fx(battle, world_pos + Vector3(0.0, 0.7, 0.0), SWOOP_FX_FRAMES, SWOOP_FX_FRAME_S, 0.032, flip_h)

# === DRAGONE: BLOOD DRAIN ===
# 5-cell forward scan from caster's row (tongue-whip geometry, longer reach).
# First hit gets struck for damage + caster heals BLOOD_DRAIN_HEAL on a
# successful combatant hit. Walls take full damage but don't grant heal.
# React equivalent: App3D.tsx:5622-5643 (caster-row only, nearest enemy).

const BLOOD_DRAIN_FORWARD_TILES := 5
const BLOOD_DRAIN_HEAL := 10

static func _blood_drain(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var path: Array = []
	for d in range(1, BLOOD_DRAIN_FORWARD_TILES + 1):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
	if path.is_empty():
		_log(caster, "%s blood drain whiffed (no forward path)" % move.display_name)
		return
	var hit_combatant: Combatant = null
	var hit_wall: Wall = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var wall := battle.wall_at_cell(entry["side"], entry["cell"])
		if wall != null and wall.owner_combatant != caster:
			hit_wall = wall
			hit_entry = entry
			break
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			hit_combatant = occupant
			hit_entry = entry
			break
	var caster_world: Vector3 = caster.global_position + Vector3(0.0, 0.8, 0.0)
	var beam_end: Vector3
	if hit_combatant != null:
		beam_end = hit_combatant.global_position + Vector3(0.0, 0.8, 0.0)
	elif hit_wall != null:
		beam_end = hit_wall.global_position + Vector3(0.0, 0.8, 0.0)
	else:
		var tail_entry: Dictionary = path[path.size() - 1]
		beam_end = battle.cell_to_world(tail_entry["side"], tail_entry["cell"]) + Vector3(0.0, 0.8, 0.0)
	_spawn_lasso_rope(battle, caster_world, beam_end, Color(1.0, 0.30, 0.30))
	var dmg := _final_card_damage(move, caster)
	if hit_wall != null:
		hit_wall.take_damage(dmg, caster)
		_log(caster, "%s blood drain hits wall at %s/%s for %d" % [move.display_name, hit_entry["side"], str(hit_entry["cell"]), dmg])
		return
	if hit_combatant == null:
		_log(caster, "%s blood drain whiffed (no target in %d-cell reach)" % [move.display_name, BLOOD_DRAIN_FORWARD_TILES])
		return
	_spawn_blood_impact(battle, hit_combatant.global_position)
	if dmg > 0:
		_strike(hit_combatant, dmg, move, caster)
	caster.heal(BLOOD_DRAIN_HEAL)
	_log(caster, "%s drains %s for %d (+heals %d)" % [move.display_name, hit_combatant.display_name, dmg, BLOOD_DRAIN_HEAL])

# Red drain ribbon stretched from caster to victim/tail. Similar shape to
# tongue rope, recolored deep red so the lifesteal read is obvious.
static func _spawn_blood_impact(battle: Battle, world_pos: Vector3) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.40
	torus.outer_radius = 0.65
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.20, 0.30, 0.90)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.20, 0.30)
	mat.emission_energy_multiplier = 3.2
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	battle.spawn_world_fx(ring)
	ring.global_position = world_pos + Vector3(0.0, 0.5, 0.0)
	ring.scale = Vector3.ONE * 0.45
	var tween := ring.create_tween().set_parallel(true)
	tween.tween_property(ring, "scale", Vector3.ONE * 1.4, 0.55)
	tween.tween_property(mat, "albedo_color:a", 0.0, 0.55)
	tween.chain().tween_callback(ring.queue_free)

# === DRAGONE: SHADOW DIVE ===
# Both fighters dash to their respective "front" columns (the cells nearest
# their opponent). If they end up on the same row (same y, which the dash
# preserves), the opponent takes SHADOW_DIVE_DAMAGE. If a destination cell
# is blocked, that fighter stays put — strike still resolves based on the
# original same-row check. React equivalent: App3D.tsx:5645-5681.

const SHADOW_DIVE_DURATION_S := 0.20

static func _shadow_dive(move: MoveDef, caster, battle: Battle) -> void:
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		_log(caster, "%s shadow dive whiffed (no opponent)" % move.display_name)
		return
	var side := battle.get_side(caster)
	var fwd_side := battle.forward_side(side)
	var ccell := battle.get_caster_cell(caster)
	var ocell := battle.get_caster_cell(opp)
	# Front column = the side's column closest to the opposing grid boundary.
	var caster_front_x := Battle.GRID_COLS - 1 if side == Battle.SIDE_PLAYER else 0
	var opp_front_x := 0 if fwd_side == Battle.SIDE_ENEMY else Battle.GRID_COLS - 1
	var caster_target := Vector2i(caster_front_x, ccell.y)
	var opp_target := Vector2i(opp_front_x, ocell.y)
	# Visual flashes BEFORE the moves so they read as a teleport.
	_spawn_teleport_flash(battle, battle.cell_to_world(side, ccell))
	_spawn_teleport_flash(battle, battle.cell_to_world(fwd_side, ocell))
	# Reposition caster if destination is free.
	if caster_target != ccell and not battle.combatant_blocked_at(side, caster_target):
		var c_dest := battle.cell_to_world(side, caster_target)
		battle.set_caster_cell(caster, caster_target)
		_spawn_teleport_flash(battle, c_dest)
		var c_tween := battle.create_tween()
		c_tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
		c_tween.tween_property(caster, "global_position", c_dest, SHADOW_DIVE_DURATION_S)
	# Reposition opponent if destination is free.
	if opp_target != ocell and not battle.combatant_blocked_at(fwd_side, opp_target):
		var o_dest := battle.cell_to_world(fwd_side, opp_target)
		battle.set_caster_cell(opp, opp_target)
		_spawn_teleport_flash(battle, o_dest)
		var o_tween := battle.create_tween()
		o_tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
		o_tween.tween_property(opp, "global_position", o_dest, SHADOW_DIVE_DURATION_S)
	# Same-row check (y unchanged by the dash, so before == after).
	if ccell.y == ocell.y:
		var dmg := _final_card_damage(move, caster)
		_strike(opp, dmg, move, caster)
		_log(caster, "%s shadow dives — both forward + %d DMG (same row)" % [move.display_name, dmg])
	else:
		_log(caster, "%s shadow dives — both forward (different rows, no strike)" % move.display_name)

# === DRAGONE: DIVEBOMB ===
# High-risk rush. Caster tweens visually across their row to the first wall
# or combatant hit, or all the way to the end of the combined row on a miss.
# On hit: 60 DMG to target + 30 self-damage. On miss: no damage. Either way
# the caster slow-tweens back to their start cell — cell tracking stays at
# the start so the caster remains hit-vulnerable on the return path. Dark
# type per user spec.

const DIVEBOMB_HIT_DAMAGE := 60
const DIVEBOMB_SELF_DAMAGE := 30
const DIVEBOMB_FORWARD_TIME_S := 0.28
const DIVEBOMB_REVERSE_TIME_S := 0.75

static func _divebomb(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Build the full forward path across the combined row at caster's y.
	var path: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
		d += 1
	if path.is_empty():
		_log(caster, "%s divebomb whiffed (no forward path)" % move.display_name)
		return
	# Find first wall or combatant in path (stop on first contact).
	var hit_combatant: Combatant = null
	var hit_wall: Wall = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var wall := battle.wall_at_cell(entry["side"], entry["cell"])
		if wall != null and wall.owner_combatant != caster:
			hit_wall = wall
			hit_entry = entry
			break
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			hit_combatant = occupant
			hit_entry = entry
			break
	# Pick landing world position — hit cell if anything was found, otherwise
	# the very last cell of the combined row at caster.y.
	var landing_entry: Dictionary
	if hit_combatant != null or hit_wall != null:
		landing_entry = hit_entry
	else:
		landing_entry = path[path.size() - 1]
	var start_world: Vector3 = caster.global_position
	var landing_side: String = landing_entry["side"]
	var landing_cell: Vector2i = landing_entry["cell"]
	var landing_world: Vector3 = battle.cell_to_world(landing_side, landing_cell)
	# Resolve damage at the moment of landing — captured into the callback so
	# the tween can fire it after the forward leg lands. Explicit types are
	# required because GDScript can't infer through the untyped `caster` var.
	var captured_caster: Combatant = caster
	var captured_move: MoveDef = move
	var captured_combatant: Combatant = hit_combatant
	var captured_wall: Wall = hit_wall
	var on_landed := func() -> void:
		if not is_instance_valid(captured_caster):
			return
		if captured_combatant != null and is_instance_valid(captured_combatant):
			_strike(captured_combatant, DIVEBOMB_HIT_DAMAGE, captured_move, captured_caster)
			captured_caster.take_damage(DIVEBOMB_SELF_DAMAGE, "", "divebomb_recoil")
		elif captured_wall != null and is_instance_valid(captured_wall):
			captured_wall.take_damage(DIVEBOMB_HIT_DAMAGE, captured_caster)
			captured_caster.take_damage(DIVEBOMB_SELF_DAMAGE, "", "divebomb_recoil")
	# Movement-locked out + back (no snapping around mid-return); still targetable.
	battle.lock_rush(caster, DIVEBOMB_FORWARD_TIME_S + DIVEBOMB_REVERSE_TIME_S)
	# Forward leg (fast lunge), damage callback, then slow reverse to start.
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_IN)
	tween.tween_property(caster, "global_position", landing_world, DIVEBOMB_FORWARD_TIME_S)
	tween.tween_callback(on_landed)
	tween.tween_property(caster, "global_position", start_world, DIVEBOMB_REVERSE_TIME_S).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	var target_name: String = "wall" if hit_wall != null else (hit_combatant.display_name if hit_combatant != null else "nothing")
	_log(caster, "%s divebombs forward — landed on %s" % [move.display_name, target_name])

# === DRAGONE: LOB BOMB ===
# Slow rolling bomb. Spawns 1 cell in front of caster, rolls forward at
# LOB_BOMB_SPEED_UNITS_S along caster's row, cell by cell. First combatant
# OR hostile wall on path detonates the bomb — plus-shape AoE (center + 4
# cardinals) dealing LOB_BOMB_DMG per cell. Walls in the plus also take
# damage. Friendly fire enabled — caster's own cell can be caught in the
# blast. Miss at far edge = fizzle.

const LOB_BOMB_DMG := 10
const LOB_BOMB_SPEED_UNITS_S := 8.0
const LOB_BOMB_CELL_SPACING := 2.5  # world-units per grid cell

static func _lob_bomb(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Full path starting at depth 1 forward.
	var path: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
		d += 1
	if path.is_empty():
		_log(caster, "%s lob bomb whiffed (no forward path)" % move.display_name)
		return
	# Spawn the bomb visual at the first path cell.
	var bomb := _make_lob_bomb_visual()
	battle.spawn_world_fx(bomb)
	var start_world: Vector3 = battle.cell_to_world(path[0]["side"], path[0]["cell"])
	bomb.global_position = start_world + Vector3(0.0, 0.25, 0.0)
	var cell_delay := LOB_BOMB_CELL_SPACING / LOB_BOMB_SPEED_UNITS_S
	var state := {"stopped": false}
	var tween := battle.create_tween()
	for i in range(path.size()):
		var entry: Dictionary = path[i]
		# Tween in to this cell except the first (we spawn there).
		if i > 0:
			var dest: Vector3 = battle.cell_to_world(entry["side"], entry["cell"]) + Vector3(0.0, 0.25, 0.0)
			tween.tween_property(bomb, "global_position", dest, cell_delay).set_trans(Tween.TRANS_LINEAR)
		# Collision check at the cell.
		tween.tween_callback(MoveRegistry._lob_bomb_step.bind(battle, entry["side"], entry["cell"], move, caster, state, bomb))
	tween.tween_callback(MoveRegistry._lob_bomb_fizzle.bind(state, bomb))
	_log(caster, "%s rolls lob bomb (%d cells of path)" % [move.display_name, path.size()])

static func _lob_bomb_step(battle: Battle, seg_side: String, seg_cell: Vector2i, move: MoveDef, caster, state: Dictionary, bomb: Node3D) -> void:
	if state.get("stopped", false):
		return
	if not is_instance_valid(battle):
		return
	var wall := battle.wall_at_cell(seg_side, seg_cell)
	if wall != null and wall.owner_combatant != caster:
		_lob_bomb_explode(battle, seg_side, seg_cell, move, caster)
		state["stopped"] = true
		if is_instance_valid(bomb):
			bomb.queue_free()
		return
	var occupant := battle.combatant_at(seg_side, seg_cell)
	if occupant != null and occupant != caster and occupant.is_alive():
		_lob_bomb_explode(battle, seg_side, seg_cell, move, caster)
		state["stopped"] = true
		if is_instance_valid(bomb):
			bomb.queue_free()

static func _lob_bomb_fizzle(state: Dictionary, bomb: Node3D) -> void:
	if state.get("stopped", false):
		return
	if is_instance_valid(bomb):
		bomb.queue_free()

static func _lob_bomb_explode(battle: Battle, center_side: String, center_cell: Vector2i, move: MoveDef, caster) -> void:
	var dmg := _final_card_damage(move, caster)
	if dmg <= 0:
		dmg = LOB_BOMB_DMG
	# Center cell + 4 cardinals (plus shape).
	_spawn_explosion_at(battle, battle.cell_to_world(center_side, center_cell), 1.1)
	_lob_bomb_hit_cell(battle, center_side, center_cell, dmg, move, caster)
	var center_global_x := _to_global_x(center_side, center_cell.x)
	var cardinals: Array[Vector2i] = [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]
	for c in cardinals:
		var gx := center_global_x + c.x
		var cy := center_cell.y + c.y
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var info := _split_global_x(gx)
		if info.is_empty():
			continue
		var t_side: String = info["side"]
		var t_cell := Vector2i(info["x"], cy)
		_spawn_explosion_at(battle, battle.cell_to_world(t_side, t_cell), 0.7)
		_lob_bomb_hit_cell(battle, t_side, t_cell, dmg, move, caster)

# Plus AoE damages everything on the cell — walls AND combatants. Friendly
# fire is intentional (lob bomb can self-damage per user spec).
static func _lob_bomb_hit_cell(battle: Battle, side: String, cell: Vector2i, dmg: int, move: MoveDef, caster) -> void:
	var wall := battle.wall_at_cell(side, cell)
	if wall != null:
		wall.take_damage(dmg, caster)
	var occ := battle.combatant_at(side, cell)
	if occ != null and occ.is_alive():
		_strike(occ, dmg, move, caster)

# Dark sphere with magenta emission — reads as a thrown explosive.
static func _make_lob_bomb_visual() -> Node3D:
	# Same user bomb sprite, slightly smaller for the rolling variant.
	return _make_bomb_marker(0.015)

# === ATOMIPPO: GRAVITY SLAM (hammer_down) ===
# 2s wind-up gravity slam. Caster is self-stunned for the full 2s. Warning
# rings pulse red on the 4 cone cells (Stunning Gleam shape: 1 tip at depth
# 1 + 3 base at depth 2 ±1 row). During the wind-up, opp is pulled 1 cell
# toward caster at t=1s and again at t=2s (the second pull lands them in
# the cone right before the strike). Strike fires at t=2s regardless of
# whether the caster took damage mid-wind-up — 50 DMG per cone cell.
# Aliases React's "hammer down" handler — shared with Giant's deck once
# ported. is_movement_card flagged (drags opp).

const HAMMER_DOWN_CONE_DAMAGE := 50
const HAMMER_DOWN_FREEZE_MS := 2000
const HAMMER_DOWN_PULL_INTERVAL_S := 1.0
const HAMMER_DOWN_WIND_UP_S := 2.0
# React-faithful timings (Giant's Hammer Down, move.hammer_faithful).
const HAMMER_DOWN_FAITHFUL_FREEZE_MS := 1500
const HAMMER_DOWN_FAITHFUL_WIND_UP_S := 1.5

static func _hammer_down(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Hammer-head cone (both variants): lone contact cell at depth 1, then the
	# 3-wide head behind it at depth 2 (±1 row). hammer_faithful (Giant) only
	# changes the timing — 1.5s freeze, no pull. Default (Atomippo Gravity
	# Slam): 2s freeze + drag-opp-closer pulls at t=1s and t=2s.
	var faithful: bool = move.hammer_faithful
	var wind_up_s: float = HAMMER_DOWN_FAITHFUL_WIND_UP_S if faithful else HAMMER_DOWN_WIND_UP_S
	var freeze_ms: int = HAMMER_DOWN_FAITHFUL_FREEZE_MS if faithful else HAMMER_DOWN_FREEZE_MS
	var cone_cells: Array = []
	var d1_info := _project_forward(side, ccell, 1)
	if not d1_info.is_empty():
		var d1_side: String = d1_info["side"]
		cone_cells.append({"side": d1_side, "cell": Vector2i(d1_info["x"], ccell.y)})
	var d2_info := _project_forward(side, ccell, 2)
	if not d2_info.is_empty():
		var d2_side: String = d2_info["side"]
		var d2_x: int = d2_info["x"]
		for dy in range(-1, 2):
			var cy: int = ccell.y + dy
			if cy < 0 or cy >= Battle.GRID_ROWS:
				continue
			cone_cells.append({"side": d2_side, "cell": Vector2i(d2_x, cy)})
	if cone_cells.is_empty():
		_log(caster, "%s hammer down whiffed (no forward cells)" % move.display_name)
		return
	# Lock caster for the full wind-up.
	caster.apply_stun(freeze_ms)
	# Warning ring per cone cell — red pulsing for the wind-up duration.
	for entry in cone_cells:
		var e_side: String = entry["side"]
		var e_cell: Vector2i = entry["cell"]
		_spawn_hammer_warning(battle, battle.cell_to_world(e_side, e_cell), wind_up_s)
	var captured_caster: Combatant = caster
	var captured_move: MoveDef = move
	var captured_battle: Battle = battle
	var captured_cells: Array = cone_cells
	var tween := battle.create_tween()
	if faithful:
		# No pull — hold the wind-up, then slam.
		tween.tween_interval(wind_up_s)
		tween.tween_callback(MoveRegistry._hammer_down_strike.bind(captured_battle, captured_caster, captured_move, captured_cells))
	else:
		# Drag opp closer at t=1s and t=2s, slam on the second pull.
		tween.tween_interval(HAMMER_DOWN_PULL_INTERVAL_S)
		tween.tween_callback(MoveRegistry._hammer_down_pull.bind(captured_battle, captured_caster))
		tween.tween_interval(HAMMER_DOWN_PULL_INTERVAL_S)
		tween.tween_callback(MoveRegistry._hammer_down_pull.bind(captured_battle, captured_caster))
		tween.tween_callback(MoveRegistry._hammer_down_strike.bind(captured_battle, captured_caster, captured_move, captured_cells))
	_log(caster, "%s — hammer down wind-up (%.1fs, %d cone cells%s)" % [move.display_name, wind_up_s, cone_cells.size(), "" if faithful else ", pull"])

# Pull opp 1 cell toward caster. Clamps to opp grid bounds; walls/broken_tiles
# halt the pull. Tween is parallel-safe — multiple pulls within the wind-up
# chain naturally because each spawns its own short tween.
static func _hammer_down_pull(battle: Battle, caster: Combatant) -> void:
	if not is_instance_valid(battle) or not is_instance_valid(caster):
		return
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		return
	var caster_side := battle.get_side(caster)
	var opp_side := battle.get_side(opp)
	var opp_cell := battle.get_caster_cell(opp)
	# Direction toward caster (gravity well attraction). For player caster
	# (left side), opp lives on the right side; opp.x -= 1 moves them closer.
	var pull_dx := -1 if caster_side == Battle.SIDE_PLAYER else 1
	var new_x: int = clampi(opp_cell.x + pull_dx, 0, Battle.GRID_COLS - 1)
	if new_x == opp_cell.x:
		return  # pinned to grid edge
	var new_cell := Vector2i(new_x, opp_cell.y)
	if battle.combatant_blocked_at(opp_side, new_cell):
		return  # wall/broken tile blocks the pull
	var dest := battle.cell_to_world(opp_side, new_cell)
	battle.set_caster_cell(opp, new_cell)
	var captured_opp: Combatant = opp
	var pull_tween := battle.create_tween()
	pull_tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	pull_tween.tween_property(captured_opp, "global_position", dest, 0.18)

static func _hammer_down_strike(battle: Battle, caster: Combatant, move: MoveDef, cone_cells: Array) -> void:
	if not is_instance_valid(battle):
		return
	var dmg := _final_card_damage(move, caster)
	if dmg <= 0:
		dmg = HAMMER_DOWN_CONE_DAMAGE
	var hit_count := 0
	for entry in cone_cells:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		_spawn_hammer_hit(battle, battle.cell_to_world(seg_side, seg_cell))
		var had_target := battle.combatant_at(seg_side, seg_cell) != null
		if _strike_cell(seg_side, seg_cell, dmg, move, caster, battle) and had_target:
			hit_count += 1
	_log(caster, "%s gravity slam crashes down — %d/%d cells hit (%d DMG each)" % [move.display_name, hit_count, cone_cells.size(), dmg])

# Pulsing red ring overlay on a cone cell. Lives for HAMMER_DOWN_WIND_UP_S
# then queue_frees itself.
static func _spawn_hammer_warning(battle: Battle, world_pos: Vector3, duration_s: float) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.50
	torus.outer_radius = 0.85
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.95, 0.20, 0.25, 0.65)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.15, 0.20)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring.material_override = mat
	battle.spawn_world_fx(ring)
	ring.global_position = world_pos + Vector3(0.0, 0.05, 0.0)
	# Quick alpha pulse to convey escalating danger.
	var pulse := ring.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.25, 0.25).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.80, 0.25).set_trans(Tween.TRANS_SINE)
	# Lifetime cap — fade out + free after wind-up duration.
	var lifetime := ring.create_tween()
	lifetime.tween_interval(duration_s)
	lifetime.tween_callback(ring.queue_free)

# Large explosion at a struck cone cell. Reuses the bomb explosion FX with a
# bigger scale peak so the slam reads as a heavy impact.
static func _spawn_hammer_hit(battle: Battle, world_pos: Vector3) -> void:
	_spawn_explosion_at(battle, world_pos, 1.5)

# === ATOMIPPO: METEOR DROP ===
# Delayed plus-AoE mine at depth 2 forward of caster (fallback to depth 1).
# 1.5s wind-up with red ring warning at landing cell, then detonates:
# center cell takes full damage (40), each of the 4 cardinals takes ring
# damage (10). Walls in the plus take cell damage too. Fire-typed so the
# type wheel applies; no friendly-fire so caster's own cell could be caught
# if the cardinals reach back to them — matches Lob Bomb's flavor.

const METEOR_DROP_CENTER_DAMAGE := 40
const METEOR_DROP_RING_DAMAGE := 10
const METEOR_DROP_DELAY_S := 1.5

static func _meteor_drop(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	# Try depth 2 → 1 fallback.
	var info := _project_forward(side, ccell, 2)
	if info.is_empty():
		info = _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s meteor drop whiffed (no forward path)" % move.display_name)
		return
	var land_side: String = info["side"]
	var land_cell := Vector2i(info["x"], ccell.y)
	var land_world: Vector3 = battle.cell_to_world(land_side, land_cell)
	# Warning ring during wind-up.
	_spawn_hammer_warning(battle, land_world, METEOR_DROP_DELAY_S)
	# Schedule detonation after wind-up.
	var captured_caster: Combatant = caster
	var captured_move: MoveDef = move
	var captured_battle: Battle = battle
	var tween := battle.create_tween()
	tween.tween_interval(METEOR_DROP_DELAY_S)
	tween.tween_callback(MoveRegistry._meteor_drop_detonate.bind(captured_battle, land_side, land_cell, captured_move, captured_caster))
	_log(caster, "%s drops meteor — %.1fs delay at %s/%s" % [move.display_name, METEOR_DROP_DELAY_S, land_side, str(land_cell)])

static func _meteor_drop_detonate(battle: Battle, center_side: String, center_cell: Vector2i, move: MoveDef, caster) -> void:
	if not is_instance_valid(battle):
		return
	# Damage values flow through _final_card_damage so dmg_dealt buffs apply.
	var base := _final_card_damage(move, caster)
	var center_dmg := base if base > 0 else METEOR_DROP_CENTER_DAMAGE
	var ring_dmg := maxi(1, center_dmg / 4) if base > 0 else METEOR_DROP_RING_DAMAGE
	# Center hit + big burst.
	_spawn_explosion_at(battle, battle.cell_to_world(center_side, center_cell), 1.4)
	_meteor_hit_cell(battle, center_side, center_cell, center_dmg, move, caster)
	# Four cardinals (no diagonals — plus shape, not 3x3).
	var center_global_x := _to_global_x(center_side, center_cell.x)
	var cardinals: Array[Vector2i] = [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]
	for c in cardinals:
		var gx := center_global_x + c.x
		var cy := center_cell.y + c.y
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var info := _split_global_x(gx)
		if info.is_empty():
			continue
		var t_side: String = info["side"]
		var t_cell := Vector2i(info["x"], cy)
		_spawn_explosion_at(battle, battle.cell_to_world(t_side, t_cell), 0.85)
		_meteor_hit_cell(battle, t_side, t_cell, ring_dmg, move, caster)

# Plus-AoE damages walls AND combatants on each cell. Owner is not skipped
# so the caster can be caught if the cardinals reach back to them — matches
# Lob Bomb's chaotic flavor.
static func _meteor_hit_cell(battle: Battle, side: String, cell: Vector2i, dmg: int, move: MoveDef, caster) -> void:
	var wall := battle.wall_at_cell(side, cell)
	if wall != null:
		wall.take_damage(dmg, caster)
	var occ := battle.combatant_at(side, cell)
	if occ != null and occ.is_alive():
		_strike(occ, dmg, move, caster)

# === ATOMIPPO: CRUSHING FIELD (zone_steal) — MVP ===
# Claims the column on opp's grid nearest the caster (opp grid x=0 for
# player-cast, x=GRID_COLS-1 for enemy-cast) for 3 seconds. On cast:
#   - If opp is on the stolen column, deal 20 DMG + 1.5s stun + tween them
#     to the column directly behind (deeper into opp's grid).
#   - Spawn 4 purple-red pulsing outline tiles on the stolen column for the
#     visual claim.
#   - Spawn 4 gravity_field DoT tiles on the column one cell deeper into
#     opp's grid (the "column in front" of the steal from caster's POV).
#     5 DMG/sec for the full 3s to non-owner combatants standing there —
#     opp gets pushed into this DoT zone by the initial steal.
# Opp is blocked from re-entering the stolen column via combatant_blocked_at.
# DEFERRED for a follow-up pass: caster walking onto the stolen tiles AND
# the "if caster remains 3s → 10 DMG + push back" punishment. In MVP the
# caster also can't step on the stolen column (cell-tracking limitation).

const ZONE_STEAL_DURATION_MS := 3000
const ANCIENT_CLAIM_UNHIT_MS := 10000
const ZONE_STEAL_PUSH_DAMAGE := 20
const ZONE_STEAL_PUSH_STUN_MS := 1500
const GRAVITY_FIELD_DURATION_MS := 3000

static func _zone_steal(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var opp_side := battle.forward_side(side)
	# Ancient Claim — the steal lasts 50% longer if the caster hasn't been
	# hit for 10s (clock starts at battle start via last_damaged_at_ms init).
	var steal_ms := ZONE_STEAL_DURATION_MS
	var caster_c: Combatant = caster
	if TraitRegistry.steal_duration(caster.traits) and Time.get_ticks_msec() - caster_c.last_damaged_at_ms >= ANCIENT_CLAIM_UNHIT_MS:
		steal_ms = steal_ms * 3 / 2
		_log(caster, "Ancient Claim — unscathed, steal extended to %dms" % steal_ms)
	# Stolen column = opp grid column nearest the caster.
	var stolen_col := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	# "Column in front" = column one step deeper into opp grid from the
	# stolen one (where opp gets pushed to).
	var dot_col := 1 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 2
	# Push opp off the stolen column if they're sitting on it.
	var opp := battle.get_opponent(caster)
	if opp != null and opp.is_alive():
		var opp_cell := battle.get_caster_cell(opp)
		if opp_cell.x == stolen_col:
			# Push toward the "in-front" column. Clamp + skip if blocked.
			var push_to := Vector2i(dot_col, opp_cell.y)
			var dmg := _final_card_damage(move, caster)
			if dmg <= 0:
				dmg = ZONE_STEAL_PUSH_DAMAGE
			_strike(opp, dmg, move, caster)
			if opp.is_alive():
				opp.apply_stun(ZONE_STEAL_PUSH_STUN_MS, caster)
				if not battle.combatant_blocked_at(opp_side, push_to):
					var dest := battle.cell_to_world(opp_side, push_to)
					battle.set_caster_cell(opp, push_to)
					var captured_opp: Combatant = opp
					var tween := battle.create_tween()
					tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
					tween.tween_property(captured_opp, "global_position", dest, 0.18)
	# Spawn 4 visual outlines on the stolen column.
	var visuals: Array = []
	for y in range(Battle.GRID_ROWS):
		var v := _spawn_zone_steal_outline(battle, battle.cell_to_world(opp_side, Vector2i(stolen_col, y)))
		visuals.append(v)
	# Set zone-steal state (combatant_blocked_at consults this).
	battle.set_zone_steal(caster, opp_side, stolen_col, steal_ms, visuals)
	# Spawn gravity_field DoT tiles on the column directly behind the steal.
	# React-vanilla zone steal (Giant, move.zone_no_dot) skips this; Atomippo's
	# Crushing Field keeps it.
	if not move.zone_no_dot:
		for y in range(Battle.GRID_ROWS):
			battle.spawn_tile(caster, opp_side, Vector2i(dot_col, y), "gravity_field", GRAVITY_FIELD_DURATION_MS, false)
	# Schedule cleanup at expiry.
	var captured_battle: Battle = battle
	var clear_tween := battle.create_tween()
	clear_tween.tween_interval(float(steal_ms) / 1000.0)
	clear_tween.tween_callback(MoveRegistry._zone_steal_cleanup.bind(captured_battle))
	_log(caster, "%s claims opp column %d for %dms (DoT on col %d)" % [move.display_name, stolen_col, steal_ms, dot_col])

static func _zone_steal_cleanup(battle: Battle) -> void:
	if not is_instance_valid(battle):
		return
	battle.clear_zone_steal()

# Pulsing purple-red column outline tile. Lives until clear_zone_steal frees
# it. Renders as a tall ring above the grid cell so it reads as "claimed
# territory" rather than "ground effect".
static func _spawn_zone_steal_outline(battle: Battle, world_pos: Vector3) -> Node3D:
	var root := Node3D.new()
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.65
	torus.outer_radius = 0.95
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.85, 0.25, 0.65, 0.65)
	mat.emission_enabled = true
	mat.emission = Color(0.95, 0.30, 0.70)
	mat.emission_energy_multiplier = 3.2
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring.material_override = mat
	root.add_child(ring)
	battle.spawn_world_fx(root)
	root.global_position = world_pos + Vector3(0.0, 0.10, 0.0)
	# Continuous alpha pulse during the 3s claim.
	var pulse := root.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.30, 0.45).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.80, 0.45).set_trans(Tween.TRANS_SINE)
	return root

# === ATOMIPPO: EVENT HORIZON ===
# Turn the 4 center cells of opp's grid into gravity tiles for 3 seconds.
# Each tile is a no-tick TimedEffect; the movement gating lives in Battle's
# player + enemy AI walk loops, which toggle `gravity_pending` on the
# combatant. First step attempt from a gravity tile is consumed; the second
# resolves. Effectively halves movement speed across the field. Tiles are
# read for everyone (no owner-immunity) — gravity is gravity. React equivalent
# was a different "drag toward center" effect; user redesigned to a movement
# slow zone for this version of the card.

const EVENT_HORIZON_DURATION_MS := 3000
const EVENT_HORIZON_CENTER_CELLS: Array[Vector2i] = [
	Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 1), Vector2i(2, 2)
]

static func _event_horizon(move: MoveDef, caster, battle: Battle) -> void:
	var fwd_side := battle.forward_side(battle.get_side(caster))
	var lifetime: int = move.tile_lifetime_ms if move.tile_lifetime_ms > 0 else EVENT_HORIZON_DURATION_MS
	for c in EVENT_HORIZON_CENTER_CELLS:
		battle.spawn_tile(caster, fwd_side, c, "gravity_well_tile", lifetime, false)
	_log(caster, "%s — center 4 cells of %s become gravity tiles for %dms" % [move.display_name, fwd_side, lifetime])

# === ATOMIPPO: GRAVITON BEAM ===
# Slow row sweep from caster's row, like _beam but with a self-stun while
# firing and a post-sweep push: if the opponent is on the caster's row at
# the end of the sweep, tween them 1 cell forward in the beam's direction.
# If the push would take them off the grid (already at the deepest cell on
# their grid) OR if a wall/broken_tile is in the push cell, deal a wall-hit
# bonus damage instead. Caster lock duration matches the full sweep length.

const GRAVITON_BEAM_LOCK_MS := 500
const GRAVITON_BEAM_WALL_BONUS := 15

static func _graviton_beam(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	# Caster lock — covers the full sweep cadence.
	caster.apply_stun(GRAVITON_BEAM_LOCK_MS)
	# Same fire-path build as _beam: walk forward from caster, stop on first
	# hostile wall (which absorbs the segment).
	var fire_path: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var seg_side: String = info["side"]
		var seg_cell := Vector2i(info["x"], ccell.y)
		fire_path.append({"side": seg_side, "cell": seg_cell})
		var w := battle.wall_at_cell(seg_side, seg_cell)
		if w != null and w.owner_combatant != caster:
			break
		d += 1
	var tween := battle.create_tween()
	for entry in fire_path:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		var world: Vector3 = battle.cell_to_world(seg_side, seg_cell)
		tween.tween_callback(MoveRegistry._emit_beam_segment.bind(battle, world, seg_side, seg_cell, dmg, move, caster))
		tween.tween_interval(BEAM_COLUMN_DELAY_S)
	# Final callback: push opp if on caster's row, with wall-hit fallback.
	tween.tween_callback(MoveRegistry._graviton_beam_push.bind(battle, caster, move, ccell.y))
	_log(caster, "%s graviton beam — %d cells, caster locked %dms" % [move.display_name, fire_path.size(), GRAVITON_BEAM_LOCK_MS])

# Push the opponent 1 cell along the beam's forward direction. If clamped by
# the grid edge or blocked by walls/broken_tiles, the opp "hits the wall" and
# takes GRAVITON_BEAM_WALL_BONUS extra damage instead of being moved.
static func _graviton_beam_push(battle: Battle, caster: Combatant, move: MoveDef, caster_y: int) -> void:
	if not is_instance_valid(battle) or not is_instance_valid(caster):
		return
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		return
	var opp_cell := battle.get_caster_cell(opp)
	# Only push if opp ended the sweep on caster's row (was in beam path).
	if opp_cell.y != caster_y:
		return
	var caster_side := battle.get_side(caster)
	var opp_side := battle.get_side(opp)
	# Push forward in caster's beam direction. For player caster, beam moves
	# right (+x in opp grid space); for enemy caster, beam moves left.
	var push_dir := 1 if caster_side == Battle.SIDE_PLAYER else -1
	var new_x := opp_cell.x + push_dir
	# Off the back of opp's grid → wall hit.
	if new_x < 0 or new_x >= Battle.GRID_COLS:
		_strike(opp, GRAVITON_BEAM_WALL_BONUS, move, caster)
		_spawn_explosion_at(battle, opp.global_position, 1.0)
		return
	var new_cell := Vector2i(new_x, opp_cell.y)
	# Wall / broken_tile / stolen-column blocks the push → wall hit.
	if battle.combatant_blocked_at(opp_side, new_cell):
		_strike(opp, GRAVITON_BEAM_WALL_BONUS, move, caster)
		_spawn_explosion_at(battle, opp.global_position, 1.0)
		return
	# Tween opp to the new cell.
	var dest: Vector3 = battle.cell_to_world(opp_side, new_cell)
	battle.set_caster_cell(opp, new_cell)
	var captured: Combatant = opp
	var push_tween := battle.create_tween()
	push_tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	push_tween.tween_property(captured, "global_position", dest, 0.18)

# === SCIMARK: SWORD DIVE ===
# 4-cell forward pierce on caster's row, "ignoring blocks" — walls AND
# combatants in the path each take SWORD_DIVE_DAMAGE, and the pierce keeps
# going. Reuses the existing _spawn_pierce visual with the staggered cell
# delay so the strike reads as a fast thrust pulse. React equivalent:
# App3D.tsx:5953-5973 (caster-row range check; our port adds wall damage
# in passing per user spec).

const SWORD_DIVE_DAMAGE := 35
const SWORD_DIVE_FORWARD_TILES := 4

static func _sword_dive(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var dmg := _final_card_damage(move, caster)
	if dmg <= 0:
		dmg = SWORD_DIVE_DAMAGE
	var combatant_hits := 0
	var wall_hits := 0
	for d in range(1, SWORD_DIVE_FORWARD_TILES + 1):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var seg_side: String = info["side"]
		var seg_cell := Vector2i(info["x"], ccell.y)
		var world: Vector3 = battle.cell_to_world(seg_side, seg_cell)
		_spawn_pierce(battle, world, (d - 1) * PIERCE_CELL_DELAY_S)
		# Walls take damage but do NOT stop the pierce.
		var wall := battle.wall_at_cell(seg_side, seg_cell)
		if wall != null and wall.owner_combatant != caster:
			wall.take_damage(dmg, caster)
			wall_hits += 1
		# Combatants on the cell also take damage. _strike applies any
		# status_id rider on the move (none for vanilla sword_dive).
		var occ := battle.combatant_at(seg_side, seg_cell)
		if occ != null and occ != caster and occ.is_alive():
			_strike(occ, dmg, move, caster)
			combatant_hits += 1
	_log(caster, "%s sword dives 4 cells — hits: %d combatant, %d wall (%d DMG each)" % [move.display_name, combatant_hits, wall_hits, dmg])

# === SCIMARK: TIDAL WAVE ===
# Slow 2-row wave starting at caster's back column, sweeping forward across
# all 8 combined-grid columns at 250ms cadence. Always hits middle rows
# 1 & 2 (independent of caster.y). 15 DMG per cell. Each row is tracked
# independently — a hostile wall takes the cell's damage AND stops that
# row's wave on later columns, while the other row continues.

const TIDAL_WAVE_DAMAGE := 15
const TIDAL_WAVE_COL_DELAY_S := 0.25
const TIDAL_WAVE_ROWS: Array[int] = [1, 2]

static func _tidal_wave(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var dmg := _final_card_damage(move, caster)
	if dmg <= 0:
		dmg = TIDAL_WAVE_DAMAGE
	# Build the column sequence from caster's back column outward across the
	# combined 8-cell row. _project_forward with depth 0..7 from the back
	# cell gives us each column in order.
	var back_x := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	# Per-row stop flag: once a wall ends a row, no more cells fire on it.
	var row_state := {1: false, 2: false}
	var tween := battle.create_tween()
	for col_idx in range(Battle.GRID_COLS * 2):
		for row in TIDAL_WAVE_ROWS:
			var back_cell := Vector2i(back_x, row)
			var info := _project_forward(side, back_cell, col_idx)
			if info.is_empty():
				continue
			var seg_side: String = info["side"]
			var seg_cell := Vector2i(info["x"], row)
			tween.tween_callback(MoveRegistry._tidal_wave_segment.bind(battle, seg_side, seg_cell, dmg, move, caster, row_state, row))
		tween.tween_interval(TIDAL_WAVE_COL_DELAY_S)
	_log(caster, "%s tidal wave — rows %s, %d DMG/cell, %.2fs cadence" % [move.display_name, str(TIDAL_WAVE_ROWS), dmg, TIDAL_WAVE_COL_DELAY_S])

static func _tidal_wave_segment(battle: Battle, seg_side: String, seg_cell: Vector2i, dmg: int, move: MoveDef, caster, row_state: Dictionary, row: int) -> void:
	if row_state.get(row, false):
		return  # row already stopped by a wall earlier
	if not is_instance_valid(battle):
		return
	# Frosty-tinted explosion at cell — reuse the standard FX with smaller scale.
	_spawn_explosion_at(battle, battle.cell_to_world(seg_side, seg_cell), 0.85)
	# Wall on this cell: take damage + stop this row's wave.
	var wall := battle.wall_at_cell(seg_side, seg_cell)
	if wall != null and wall.owner_combatant != caster:
		wall.take_damage(dmg, caster)
		row_state[row] = true
		return
	# Combatant on this cell: damage them. Wave continues either way.
	var occ := battle.combatant_at(seg_side, seg_cell)
	if occ != null and occ != caster and occ.is_alive():
		_strike(occ, dmg, move, caster)

# === SCIMARK: IAI ===
# Rush across caster's row (Divebomb pattern). On combatant contact: 40 DMG
# to that combatant + a horizontal slash that hits 3 cells in a vertical
# strip anchored 1 cell beyond the collision (center + ±1 y), 30 DMG each.
# Wall in path: wall takes 40 DMG, no slash, no self damage. Total miss
# (no wall, no combatant): 20 DMG self. Return tween after every outcome.

const IAI_HIT_DAMAGE := 40
const IAI_SLASH_DAMAGE := 30
const IAI_SELF_MISS_DAMAGE := 20
const IAI_FORWARD_TIME_S := 0.28
const IAI_REVERSE_TIME_S := 0.6

static func _iai(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var path: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
		d += 1
	if path.is_empty():
		_log(caster, "%s iai whiffed (no forward path)" % move.display_name)
		return
	# First wall or combatant claims the collision.
	var hit_combatant: Combatant = null
	var hit_wall: Wall = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var wall := battle.wall_at_cell(entry["side"], entry["cell"])
		if wall != null and wall.owner_combatant != caster:
			hit_wall = wall
			hit_entry = entry
			break
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			hit_combatant = occupant
			hit_entry = entry
			break
	# Visual landing target — collision cell or end of row on a full miss.
	var landing_entry: Dictionary
	if hit_combatant != null or hit_wall != null:
		landing_entry = hit_entry
	else:
		landing_entry = path[path.size() - 1]
	var start_world: Vector3 = caster.global_position
	var landing_side: String = landing_entry["side"]
	var landing_cell: Vector2i = landing_entry["cell"]
	var landing_world: Vector3 = battle.cell_to_world(landing_side, landing_cell)
	var push_dir := 1 if side == Battle.SIDE_PLAYER else -1
	# Capture for the on-landed lambda.
	var captured_caster: Combatant = caster
	var captured_move: MoveDef = move
	var captured_combatant: Combatant = hit_combatant
	var captured_wall: Wall = hit_wall
	var captured_landing_side: String = landing_side
	var captured_landing_cell: Vector2i = landing_cell
	var captured_push_dir: int = push_dir
	var captured_battle: Battle = battle
	var on_landed := func() -> void:
		if not is_instance_valid(captured_caster):
			return
		if captured_combatant != null and is_instance_valid(captured_combatant):
			_strike(captured_combatant, IAI_HIT_DAMAGE, captured_move, captured_caster)
			# Horizontal slash 1 cell beyond collision (3 cells in y direction).
			_iai_slash(captured_battle, captured_landing_side, captured_landing_cell, captured_push_dir, captured_move, captured_caster)
		elif captured_wall != null and is_instance_valid(captured_wall):
			captured_wall.take_damage(IAI_HIT_DAMAGE, captured_caster)
			# Wall absorbs the blow — no slash, no self damage.
		else:
			captured_caster.take_damage(IAI_SELF_MISS_DAMAGE, "", "iai_miss")
	battle.lock_rush(caster, IAI_FORWARD_TIME_S + IAI_REVERSE_TIME_S)
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_IN)
	tween.tween_property(caster, "global_position", landing_world, IAI_FORWARD_TIME_S)
	tween.tween_callback(on_landed)
	tween.tween_property(caster, "global_position", start_world, IAI_REVERSE_TIME_S).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	var target_name: String = "wall" if hit_wall != null else (hit_combatant.display_name if hit_combatant != null else "nothing")
	_log(caster, "%s iai — landed on %s" % [move.display_name, target_name])

# Horizontal slash after Iai hits. Anchors 1 cell beyond the collision (in
# caster's forward direction); 3 cells in a vertical strip (anchor + ±1 y).
# Each cell damages walls AND combatants. Cells out of grid are skipped
# (slash truncates at the back edge).
static func _iai_slash(battle: Battle, hit_side: String, hit_cell: Vector2i, push_dir: int, move: MoveDef, caster) -> void:
	var slash_global_x: int = _to_global_x(hit_side, hit_cell.x) + push_dir
	for dy in range(-1, 2):
		var cy: int = hit_cell.y + dy
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var info := _split_global_x(slash_global_x)
		if info.is_empty():
			continue
		var seg_side: String = info["side"]
		var seg_cell := Vector2i(info["x"], cy)
		var world: Vector3 = battle.cell_to_world(seg_side, seg_cell)
		_spawn_slash(battle, world, dy)
		var wall := battle.wall_at_cell(seg_side, seg_cell)
		if wall != null and wall.owner_combatant != caster:
			wall.take_damage(IAI_SLASH_DAMAGE, caster)
		var occ := battle.combatant_at(seg_side, seg_cell)
		if occ != null and occ != caster and occ.is_alive():
			_strike(occ, IAI_SLASH_DAMAGE, move, caster)

# === SCIMARK: WATER BREATHING ===
# 8-second buff that combines three effects:
#   1. Heal 5 HP every second (8 ticks total = 40 HP).
#   2. Water-typed cards deal 1.5× damage (via buff card_type_mult_water).
#   3. Caster is immune to frozen_tile slip while active (buff frozen_immune).
# All three live on a single buff dict so they share a duration + halo.

const WATER_BREATHING_DURATION_MS := 8000
const WATER_BREATHING_HEAL_PER_TICK := 5
const WATER_BREATHING_TICKS := 8
const WATER_BREATHING_TICK_INTERVAL_S := 1.0
const WATER_BREATHING_WATER_MULT := 1.5

static func _water_breathing(move: MoveDef, caster, battle: Battle) -> void:
	# Apply the buff with neutral defaults; the card-type and immunity hooks
	# live on the dict as extra keys that buff_damage_dealt_mult_for_card +
	# is_frozen_immune read directly.
	var buff: Dictionary = caster.apply_buff("water_breathing", 1.0, 1.0, WATER_BREATHING_DURATION_MS)
	buff["card_type_mult_water"] = WATER_BREATHING_WATER_MULT
	buff["frozen_immune"] = true
	# Cyan halo, water flavor.
	var halo := _make_buff_halo(Color(0.30, 0.75, 1.0))
	caster.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.25, 0.6).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.60, 0.6).set_trans(Tween.TRANS_SINE)
	# Heal-over-time: 8 separate ticks via a tween chain. Each callback
	# checks instance validity so the heal stops cleanly if the caster KOs.
	var captured_caster: Combatant = caster
	var heal_tween := battle.create_tween()
	for i in range(WATER_BREATHING_TICKS):
		heal_tween.tween_interval(WATER_BREATHING_TICK_INTERVAL_S)
		heal_tween.tween_callback(MoveRegistry._water_breathing_tick.bind(captured_caster))
	_log(caster, "%s — water breathing %dms (heal %d/sec × %d, water cards ×%.1f, frozen-immune)" % [move.display_name, WATER_BREATHING_DURATION_MS, WATER_BREATHING_HEAL_PER_TICK, WATER_BREATHING_TICKS, WATER_BREATHING_WATER_MULT])

static func _water_breathing_tick(caster: Combatant) -> void:
	if not is_instance_valid(caster) or not caster.is_alive():
		return
	caster.heal(WATER_BREATHING_HEAL_PER_TICK)

# === GIANT: BOULDER ROLL ===
# Spawns a slow rolling boulder (scripts/boulder.gd) at the cell 1 forward of
# the caster; it rolls in a straight line down the caster's row across both
# grids. 30 contact DMG (spent on hit, no explosion). While rolling it sits in
# battle._walls — blocks movement, stops beams — but bullets from EITHER side
# damage it via the "boulders" group (real damage, 20-point pool, no friendly
# skip). Emptying the pool, or impact with a block, detonates it: plus-blast
# (center + 4 cardinals) for 15 that hits BOTH fighters and removes blocks.
# Spawn-cell contents resolve immediately: a block → instant detonation; a
# combatant → point-blank squash.

const BOULDER_HP := 20
const BOULDER_EXPLOSION_DAMAGE := 15

static func _boulder_roll(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s whiffed (no forward cell)" % move.display_name)
		return
	var b_side: String = info["side"]
	var b_cell := Vector2i(int(info["x"]), ccell.y)
	var contact_dmg := _final_card_damage(move, caster)
	var caster_c: Combatant = caster
	var boulder := Boulder.build(caster_c, side, contact_dmg, BOULDER_HP, BOULDER_EXPLOSION_DAMAGE)
	boulder.battle_ref = battle
	boulder.setup_at(b_side, b_cell, 1 if side == Battle.SIDE_PLAYER else -1)
	battle.spawn_world_fx(boulder)
	boulder.global_position = battle.cell_to_world(b_side, b_cell)
	# Spawn-cell contents — resolved BEFORE joining battle._walls so
	# wall_at_cell can't return the boulder itself.
	var blocking_wall := battle.wall_at_cell(b_side, b_cell)
	if blocking_wall != null:
		boulder.explode_at_current_cell()
		_log(caster, "%s slams straight into a block — instant detonation" % move.display_name)
		return
	var victim := battle.combatant_at(b_side, b_cell)
	if victim != null:
		boulder.squash(victim)
		_log(caster, "%s crushes point-blank (%d DMG)" % [move.display_name, contact_dmg])
		return
	battle._walls.append(boulder)
	boulder.begin_rolling()
	_log(caster, "%s — boulder rolling from %s/%s (%d contact DMG, %d HP pool)" % [move.display_name, b_side, str(b_cell), contact_dmg, BOULDER_HP])

# === GIANT: EARTHQUAKE ===
# Shatters every block on BOTH grids (boulders are rocks, not blocks — they
# survive). Each fighter then takes move.damage (15) × the number of blocks
# that stood on THEIR field — field location decides, not who placed them.
# Friendly fire deliberate: your own wall column becomes self-damage. Flat
# per-block damage (no dealt mults) so the arithmetic reads exactly like the
# card text: 3 blocks on your side = 45 to you. Destroyed blocks emit their
# normal destroyed signal, so block-break traits still fire with the caster
# credited as destroyer.

static func _earthquake(move: MoveDef, caster, battle: Battle) -> void:
	var per_block := maxi(1, move.damage)
	var caster_c: Combatant = caster
	var player_blocks := 0
	var enemy_blocks := 0
	# Snapshot — destroying walls mutates battle._walls via the destroyed
	# signal's lazy cleanup.
	var snapshot: Array = battle._walls.duplicate()
	for w in snapshot:
		if not is_instance_valid(w):
			continue
		var wall := w as Wall
		if wall == null or wall is Boulder or wall.hp <= 0:
			continue
		if wall.grid_side == Battle.SIDE_PLAYER:
			player_blocks += 1
		else:
			enemy_blocks += 1
		_spawn_explosion_at(battle, battle.cell_to_world(wall.grid_side, wall.cell), 1.2)
		wall.take_damage(wall.hp, caster_c)
	if player_blocks + enemy_blocks == 0:
		_log(caster, "%s rumbles — no blocks on the field, nothing shatters" % move.display_name)
		return
	_earthquake_hit_side(battle, Battle.SIDE_PLAYER, player_blocks, per_block, move)
	_earthquake_hit_side(battle, Battle.SIDE_ENEMY, enemy_blocks, per_block, move)
	_log(caster, "%s — %d blocks on PLAYER field (%d DMG to player) + %d blocks on ENEMY field (%d DMG to enemy)" % [move.display_name, player_blocks, player_blocks * per_block, enemy_blocks, enemy_blocks * per_block])

static func _earthquake_hit_side(battle: Battle, side: String, block_count: int, per_block: int, move: MoveDef) -> void:
	if block_count <= 0:
		return
	var fighter: Combatant = battle._player if side == Battle.SIDE_PLAYER else battle._enemy
	if fighter == null or not is_instance_valid(fighter) or not fighter.is_alive():
		return
	fighter.take_damage(per_block * block_count, move.move_type, "earthquake")

# === GIANT: BRICK BREAK ===
# React-faithful: smash the block directly ahead and heal 15. Godot twist:
# Giant's Wall column lands at depth 2, so we scan depths 1→2 on the caster's
# row and smash the NEAREST block — friend or foe (React never checked
# ownership, so enemy blocks are fair game). Own block: consumed silently like
# Topple (no destroyed signal → no Demolitionist credit for eating your own
# wall). Enemy block: proper kill with destroyer credit. Boulders are rocks,
# not bricks — excluded. No block found → 1 mana refund.

static func _brick_break(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var caster_c: Combatant = caster
	for d in range(1, 3):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			continue
		var w_side: String = info["side"]
		var w_cell := Vector2i(int(info["x"]), ccell.y)
		var wall := battle.wall_at_cell(w_side, w_cell)
		if wall == null or wall is Boulder:
			continue
		if wall.owner_combatant == caster_c:
			battle._walls.erase(wall)
			wall.queue_free()
		else:
			wall.take_damage(wall.hp, caster_c)
		_spawn_explosion_at(battle, battle.cell_to_world(w_side, w_cell), 1.25)
		if move.self_heal > 0:
			caster_c.heal(move.self_heal)
		_log(caster, "%s smashes block at %s/%s — heal %d" % [move.display_name, w_side, str(w_cell), move.self_heal])
		return
	caster_c.gain_mana(1)
	_log(caster, "%s — no block within 2 tiles ahead (1 mana refund)" % move.display_name)

# === GIANT: VANISH ===
# 2s of intangibility to basic/bullet attacks ONLY — bullets check
# is_vanished() and pass straight through (no hit, no thorn, no block).
# Cards, tiles, boulder contact, and walker contact still land. The sprite
# renders ghost-transparent for the duration (Combatant's modulate pass).

static func _vanish(move: MoveDef, caster, _battle: Battle) -> void:
	var caster_c: Combatant = caster
	var duration: int = move.buff_duration_ms if move.buff_duration_ms > 0 else 2000
	caster_c.apply_vanish(duration)
	_log(caster, "%s — intangible to bullets for %dms" % [move.display_name, duration])

# === GIANT: FRIEND OF THE FOREST ===
# 3 telegraphed line strikes on the OPPONENT's grid. Each strike rolls a
# random outer (perimeter) tile + an inward direction (corners pick one of
# their two options), highlights the full line for 1s with a cascading pulse
# that reads as travel direction, then sweeps the line fast (80ms/cell).
# 10 DMG per cell. Beam semantics at blocks: the first non-friendly wall
# takes the hit and stops that strike's remaining cells (stop-at-wall).
# Strikes land ~1s / 3s / 5s after cast (2s apart).

const FOTF_STRIKES := 3
const FOTF_TELEGRAPH_S := 1.0
const FOTF_STRIKE_GAP_S := 2.0
const FOTF_SWEEP_STEP_S := 0.08
const FOTF_CASCADE_STEP_S := 0.1

static func _friend_of_forest(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var opp_side := battle.forward_side(side)
	var dmg := _final_card_damage(move, caster)
	var captured_battle: Battle = battle
	var captured_move: MoveDef = move
	var captured_caster = caster
	var tween := battle.create_tween()
	for i in range(FOTF_STRIKES):
		var line: Array = _fotf_roll_line()
		tween.tween_callback(MoveRegistry._fotf_telegraph.bind(captured_battle, opp_side, line))
		tween.tween_interval(FOTF_TELEGRAPH_S)
		tween.tween_callback(MoveRegistry._fotf_sweep.bind(captured_battle, opp_side, line, dmg, captured_move, captured_caster))
		if i < FOTF_STRIKES - 1:
			tween.tween_interval(FOTF_STRIKE_GAP_S - FOTF_TELEGRAPH_S)
	_log(caster, "%s — 3 forest strikes inbound on %s grid (%d DMG each)" % [move.display_name, opp_side, dmg])

# Roll a random perimeter cell + inward direction; return the ordered line of
# cells from that origin to the far edge. Corners appear twice in the pool
# (once per inward direction) — every possible line is rollable.
static func _fotf_roll_line() -> Array:
	var candidates: Array = []
	for x in range(Battle.GRID_COLS):
		for y in range(Battle.GRID_ROWS):
			if x == 0:
				candidates.append({"origin": Vector2i(x, y), "dir": Vector2i(1, 0)})
			if x == Battle.GRID_COLS - 1:
				candidates.append({"origin": Vector2i(x, y), "dir": Vector2i(-1, 0)})
			if y == 0:
				candidates.append({"origin": Vector2i(x, y), "dir": Vector2i(0, 1)})
			if y == Battle.GRID_ROWS - 1:
				candidates.append({"origin": Vector2i(x, y), "dir": Vector2i(0, -1)})
	var pick: Dictionary = candidates[randi() % candidates.size()]
	var origin: Vector2i = pick["origin"]
	var dirv: Vector2i = pick["dir"]
	var cells: Array = []
	var c := origin
	while c.x >= 0 and c.x < Battle.GRID_COLS and c.y >= 0 and c.y < Battle.GRID_ROWS:
		cells.append(c)
		c += dirv
	return cells

static func _fotf_telegraph(battle: Battle, side: String, cells: Array) -> void:
	if not is_instance_valid(battle):
		return
	for i in range(cells.size()):
		var cell: Vector2i = cells[i]
		var delay := float(i) * FOTF_CASCADE_STEP_S
		_spawn_fotf_warning(battle, battle.cell_to_world(side, cell), delay, maxf(0.2, FOTF_TELEGRAPH_S - delay), i == 0)

static func _fotf_sweep(battle: Battle, side: String, cells: Array, dmg: int, move: MoveDef, caster) -> void:
	if not is_instance_valid(battle):
		return
	# Shared stop-state — the first blocking wall halts every later cell of
	# THIS strike (same pattern as Tidal Wave's per-row wall-stop).
	var state := {"stopped": false}
	var tween := battle.create_tween()
	for i in range(cells.size()):
		var cell: Vector2i = cells[i]
		tween.tween_callback(MoveRegistry._fotf_hit_cell.bind(battle, side, cell, dmg, move, caster, state))
		tween.tween_interval(FOTF_SWEEP_STEP_S)

static func _fotf_hit_cell(battle: Battle, side: String, cell: Vector2i, dmg: int, move: MoveDef, caster, state: Dictionary) -> void:
	if state.get("stopped", false) or not is_instance_valid(battle):
		return
	_spawn_explosion_at(battle, battle.cell_to_world(side, cell), 0.85)
	if not _strike_cell(side, cell, dmg, move, caster, battle):
		state["stopped"] = true

# Green telegraph ring. Invisible for delay_s (the cascade conveys travel
# direction), then pulses for duration_s and frees itself. Origin cell gets a
# slightly bigger ring so the line's start reads at a glance.
static func _spawn_fotf_warning(battle: Battle, world_pos: Vector3, delay_s: float, duration_s: float, is_origin: bool) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.50
	torus.outer_radius = 0.95 if is_origin else 0.85
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.25, 0.85, 0.30, 0.0)
	mat.emission_enabled = true
	mat.emission = Color(0.25, 0.90, 0.30)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring.material_override = mat
	battle.spawn_world_fx(ring)
	ring.global_position = world_pos + Vector3(0.0, 0.05, 0.0)
	var pulse := ring.create_tween()
	pulse.tween_interval(delay_s)
	pulse.tween_property(mat, "albedo_color:a", 0.75, 0.12)
	var half_pulses := maxi(1, int(duration_s / 0.25))
	for i in range(half_pulses):
		var target_a := 0.25 if i % 2 == 0 else 0.75
		pulse.tween_property(mat, "albedo_color:a", target_a, 0.25).set_trans(Tween.TRANS_SINE)
	pulse.tween_callback(ring.queue_free)

# === FLAME BREATH (Modizard now, Fudo later) ===
# React (App3D.tsx:5913): standard row beam (move.damage) + 3 burn tiles at
# random columns on the ENEMY grid, all on the caster's row, ~4s. Duplicate
# columns can land on the same cell — matches React's raw Math.random().
# Type comes from the MoveDef (Modizard runs it water-typed per user call);
# the burn_tile DoT itself stays fire-flavored (2 fire DMG/s).

const FLAME_BREATH_TILES := 3
const FLAME_BREATH_TILE_LIFETIME_MS := 4000

static func _flame_breath(move: MoveDef, caster, battle: Battle) -> void:
	_beam(move, caster, battle)
	var side := battle.get_side(caster)
	var opp_side := battle.forward_side(side)
	var ccell := battle.get_caster_cell(caster)
	var caster_c: Combatant = caster
	var row_y: int = clampi(ccell.y, 0, Battle.GRID_ROWS - 1)
	for i in range(FLAME_BREATH_TILES):
		var bx := randi() % Battle.GRID_COLS
		battle.spawn_tile(caster_c, opp_side, Vector2i(bx, row_y), "burn_tile", FLAME_BREATH_TILE_LIFETIME_MS, false)
	_log(caster, "%s — row beam + %d burn tiles on %s row %d" % [move.display_name, FLAME_BREATH_TILES, opp_side, row_y])

# === MODIZARD: ARCANE BOLT ===
# User redesign — a chasing arcane bomb (scripts/arcane_bolt.gd). Spawns 1
# cell forward and hunts the opponent for 5s (one cardinal step / 0.6s,
# re-aimed every step, detours around walls, stalls if fully boxed). Contact
# OR timer expiry detonates it: move.damage (50) to the center cell's
# occupant + 5 splash to the 4 cardinals (combatants only, both sides).
# Unshootable — kiting is the counterplay.

static func _arcane_bolt(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s whiffed (no forward cell)" % move.display_name)
		return
	var b_side: String = info["side"]
	var b_cell := Vector2i(int(info["x"]), ccell.y)
	var caster_c: Combatant = caster
	var bolt := ArcaneBolt.build(caster_c, _final_card_damage(move, caster), move.move_type)
	bolt.battle_ref = battle
	bolt.grid_side = b_side
	bolt.cell = b_cell
	battle.spawn_world_fx(bolt)
	bolt.global_position = battle.cell_to_world(b_side, b_cell)
	_log(caster, "%s — chasing bolt at %s/%s (%d center / %d splash, 5s fuse)" % [move.display_name, b_side, str(b_cell), bolt.center_damage, ArcaneBolt.SPLASH_DAMAGE])

# === MODIZARD: EXLICE ===
# Telegraphed X strike centered 3 tiles ahead of the caster on their row:
# center (depth 3) + the 4 diagonal neighbors (depths 2/4 at rows ±1). Red
# warning rings for 2s, then every X cell takes move.damage (20). The caster
# stays free during the wind-up (no self-freeze — unlike Hammer Down).
# Per-cell strike semantics: an enemy wall on a cell eats that cell's hit.

const EXLICE_DELAY_S := 2.0

static func _exlice(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var offsets: Array = [
		Vector2i(3, 0),
		Vector2i(2, -1), Vector2i(2, 1),
		Vector2i(4, -1), Vector2i(4, 1),
	]
	var cells: Array = []
	for i in range(offsets.size()):
		var off: Vector2i = offsets[i]
		var info := _project_forward(side, ccell, off.x)
		if info.is_empty():
			continue
		var cy: int = ccell.y + off.y
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var e_side: String = info["side"]
		cells.append({"side": e_side, "cell": Vector2i(int(info["x"]), cy)})
	if cells.is_empty():
		_log(caster, "%s whiffed (X fully out of bounds)" % move.display_name)
		return
	for entry in cells:
		var w_side: String = entry["side"]
		var w_cell: Vector2i = entry["cell"]
		_spawn_hammer_warning(battle, battle.cell_to_world(w_side, w_cell), EXLICE_DELAY_S)
	var captured_battle: Battle = battle
	var captured_move: MoveDef = move
	var captured_caster = caster
	var captured_cells: Array = cells
	var tween := battle.create_tween()
	tween.tween_interval(EXLICE_DELAY_S)
	tween.tween_callback(MoveRegistry._exlice_strike.bind(captured_battle, captured_caster, captured_move, captured_cells))
	_log(caster, "%s — X telegraphed (%d cells, strikes in %.1fs)" % [move.display_name, cells.size(), EXLICE_DELAY_S])

static func _exlice_strike(battle: Battle, caster, move: MoveDef, cells: Array) -> void:
	if not is_instance_valid(battle):
		return
	var dmg := _final_card_damage(move, caster)
	var hit_count := 0
	for entry in cells:
		var seg_side: String = entry["side"]
		var seg_cell: Vector2i = entry["cell"]
		_spawn_hammer_hit(battle, battle.cell_to_world(seg_side, seg_cell))
		var had_target := battle.combatant_at(seg_side, seg_cell) != null
		if _strike_cell(seg_side, seg_cell, dmg, move, caster, battle) and had_target:
			hit_count += 1
	_log(caster, "%s slashes the X — %d hit (%d DMG each)" % [move.display_name, hit_count, dmg])

# === MODIZARD: FIRE AND ICE ===
# Persistent toggle: swaps the caster's monster_type AND every water/fire
# card in their deck/hand/discard (water<->fire) until re-cast or battle end.
# Combatant.toggle_fire_ice duplicates the cards per-combatant on first use,
# so shared .tres resources are never mutated. Combos with Explosive Skin:
# after swapping, the whole (now-fire) water kit gets the 1.3× fire boost.

static func _fire_and_ice(move: MoveDef, caster, _battle: Battle) -> void:
	var caster_c: Combatant = caster
	var swapped: bool = caster_c.toggle_fire_ice()
	_log(caster, "%s — typing %s (body is now %s)" % [move.display_name, "SWAPPED water<->fire" if swapped else "REVERTED", caster_c.monster_type])

# === MODIZARD: SHED SKIN ===
# Self-stun (3s) traded for a strong regen: heal self_heal (15) every second
# of the stun. Ticks guard on validity + alive so a KO mid-molt stops cleanly.

static func _shed_skin(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var stun_ms: int = move.status_duration_ms if move.status_duration_ms > 0 else 3000
	var ticks: int = maxi(1, int(ceil(float(stun_ms) / 1000.0)))
	caster_c.apply_stun(stun_ms)
	var tween := battle.create_tween()
	for i in range(ticks):
		tween.tween_interval(1.0)
		tween.tween_callback(MoveRegistry._shed_skin_tick.bind(caster_c, move.self_heal))
	_log(caster, "%s — molting: self-stun %dms, heal %d/s × %d" % [move.display_name, stun_ms, move.self_heal, ticks])

static func _shed_skin_tick(caster: Combatant, amount: int) -> void:
	if is_instance_valid(caster) and caster.is_alive():
		caster.heal(amount)

# === MODIZARD: EXPLOSIVE SKIN ===
# 5s buff: fire cards deal buff_mult (1.3×) via the card_type_mult_fire buff
# key (same machinery as Water Breathing's water boost) + burn_immune so
# burn_tiles tick past the caster for free. Pairs with Fire and Ice — swap
# the water kit to fire, then everything gets boosted.

const EXPLOSIVE_SKIN_FIRE_MULT := 1.3

static func _explosive_skin(move: MoveDef, caster, _battle: Battle) -> void:
	var duration: int = move.buff_duration_ms if move.buff_duration_ms > 0 else 5000
	var mult: float = move.buff_mult if move.buff_mult > 1.0 else EXPLOSIVE_SKIN_FIRE_MULT
	var buff: Dictionary = caster.apply_buff("explosive_skin", 1.0, 1.0, duration)
	buff["card_type_mult_fire"] = mult
	buff["burn_immune"] = true
	# Ember-orange halo.
	var halo := _make_buff_halo(Color(1.0, 0.45, 0.15))
	caster.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.25, 0.5).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.60, 0.5).set_trans(Tween.TRANS_SINE)
	_log(caster, "%s — fire cards ×%.1f + burn-immune for %dms" % [move.display_name, mult, duration])

# === GRABBAKAT: GRAVITY WELL (user redesign) ===
# Lays 4 gravity_well_tiles on the opponent's FRONT column (nearest the
# caster) for 8s and runs Gravity Slam's pull for the same window: every
# second the opponent is dragged 1 cell toward the caster (same wall/edge
# guards as _hammer_down_pull). The tiles inherit Event Horizon stickiness
# (2 movement commands to leave) — pulled in AND stuck. No direct damage.

const GRAVITY_WELL_DURATION_MS := 8000
const GRAVITY_WELL_PULLS := 8

static func _gravity_well(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var opp_side := battle.forward_side(side)
	var front_col := 0 if side == Battle.SIDE_PLAYER else Battle.GRID_COLS - 1
	var caster_c: Combatant = caster
	for y in range(Battle.GRID_ROWS):
		battle.spawn_tile(caster_c, opp_side, Vector2i(front_col, y), "gravity_well_tile", GRAVITY_WELL_DURATION_MS, false)
	var captured_battle: Battle = battle
	var tween := battle.create_tween()
	for i in range(GRAVITY_WELL_PULLS):
		tween.tween_interval(1.0)
		tween.tween_callback(MoveRegistry._hammer_down_pull.bind(captured_battle, caster_c))
	_log(caster, "%s — 4 gravity tiles on %s col %d, pulling 1 cell/s for %ds" % [move.display_name, opp_side, front_col, GRAVITY_WELL_PULLS])

# === GRABBAKAT: SHIELD BASH ===
# Punch 1 forward (React: 30 DMG + 0.5s stun rider). While the caster has
# Armor, the bash lands 1.5× — armored elbows hit heavier.

static func _shield_bash(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s whiffed (forward out of bounds)" % move.display_name)
		return
	var dest_side: String = info["side"]
	var cell := Vector2i(int(info["x"]), ccell.y)
	var dmg := _final_card_damage(move, caster)
	var caster_c: Combatant = caster
	var armored := caster_c.armor > 0
	if armored:
		dmg = int(round(dmg * 1.5))
	_spawn_punch(battle, battle.cell_to_world(dest_side, cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
	_strike_cell(dest_side, cell, dmg, move, caster, battle)
	_log(caster, "%s — %d DMG%s" % [move.display_name, dmg, " (armored ×1.5)" if armored else ""])

# === GRABBAKAT: GAIN ARMOR (Barrier / Flex) ===
# Armor is bonus HP consumed before real HP (Combatant.armor). Stacks, no
# decay, battle-scoped. Barrier grants 15, Flex 5 — armor_gain on the MoveDef.

static func _gain_armor(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	caster_c.add_armor(move.armor_gain)
	# Slate-grey flash so the gain reads on the field; the panel shows the pool.
	var halo := _make_buff_halo(Color(0.75, 0.78, 0.85))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var flash := halo.create_tween()
	flash.tween_property(mat, "albedo_color:a", 0.0, 0.8).set_trans(Tween.TRANS_SINE)
	flash.tween_callback(halo.queue_free)
	_log(caster, "%s — +%d armor (pool now %d)" % [move.display_name, move.armor_gain, caster_c.armor])

# === GRABBAKAT: CROSS COUNTER ===
# Opening jab 1 forward (move.damage), then a 3s counter stance: the FIRST
# damage the caster takes triggers an automatic counter punch covering depths
# 1 AND 2 for 40 + 1s stun (walls eat their own cell's counter). One-shot —
# the stance halo clears on trigger or timeout.

const CROSS_COUNTER_WINDOW_MS := 3000
const CROSS_COUNTER_DMG := 40
const CROSS_COUNTER_STUN_MS := 1000

static func _cross_counter(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var caster_c: Combatant = caster
	# Opening jab.
	var jab := _project_forward(side, ccell, 1)
	if not jab.is_empty():
		var jab_side: String = jab["side"]
		var jab_cell := Vector2i(int(jab["x"]), ccell.y)
		_spawn_punch(battle, battle.cell_to_world(jab_side, jab_cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
		_strike_cell(jab_side, jab_cell, _final_card_damage(move, caster), move, caster, battle)
	# Counter stance — pulsing red-orange halo.
	var halo := _make_buff_halo(Color(1.0, 0.35, 0.25))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.25, 0.3).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.60, 0.3).set_trans(Tween.TRANS_SINE)
	var captured_battle: Battle = battle
	var captured_move: MoveDef = move
	var counter_cb := func(_amount: int, _mult: float, _stype: String, _src: String) -> void:
		if is_instance_valid(halo):
			halo.queue_free()
		MoveRegistry._cross_counter_fire.call_deferred(captured_battle, caster_c, captured_move)
	caster_c.damaged.connect(counter_cb, Object.CONNECT_ONE_SHOT)
	# Timeout: drop the stance quietly if it never triggered.
	var timeout := battle.create_tween()
	timeout.tween_interval(float(CROSS_COUNTER_WINDOW_MS) / 1000.0)
	timeout.tween_callback(func() -> void:
		if is_instance_valid(caster_c) and caster_c.damaged.is_connected(counter_cb):
			caster_c.damaged.disconnect(counter_cb)
		if is_instance_valid(halo):
			halo.queue_free())
	_log(caster, "%s — jab + counter stance for %dms" % [move.display_name, CROSS_COUNTER_WINDOW_MS])

static func _cross_counter_fire(battle: Battle, caster: Combatant, move: MoveDef) -> void:
	if not is_instance_valid(battle) or not is_instance_valid(caster) or not caster.is_alive():
		return
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var hit_any := false
	for d in range(1, 3):
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			continue
		var c_side: String = info["side"]
		var c_cell := Vector2i(int(info["x"]), ccell.y)
		_spawn_punch(battle, battle.cell_to_world(c_side, c_cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
		var wall := battle.wall_at_cell(c_side, c_cell)
		if wall != null and wall.owner_combatant != caster:
			wall.take_damage(1, caster)
			continue
		var target := battle.combatant_at(c_side, c_cell)
		if target != null:
			target.take_damage(CROSS_COUNTER_DMG, move.move_type, "cross_counter")
			if target.is_alive():
				target.apply_stun(CROSS_COUNTER_STUN_MS, caster)
			hit_any = true
	_log(caster, "CROSS COUNTER fires — %s" % (("%d DMG + stun!" % CROSS_COUNTER_DMG) if hit_any else "swung at air"))

# === GRABBAKAT: BULLET PUNCH ===
# Commit to a 1.5s flurry: self-stun for the duration while every tile ahead
# of the caster (to the far edge) is punched in sequence, move.damage (20)
# each. Per-cell semantics — an enemy wall eats its own cell's punch and the
# flurry rolls on to the next tile.

const BULLET_PUNCH_SELF_STUN_MS := 1500

static func _bullet_punch(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var caster_c: Combatant = caster
	var cells: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var p_side: String = info["side"]
		cells.append({"side": p_side, "cell": Vector2i(int(info["x"]), ccell.y)})
		d += 1
	if cells.is_empty():
		_log(caster, "%s whiffed (no forward cells)" % move.display_name)
		return
	caster_c.apply_stun(BULLET_PUNCH_SELF_STUN_MS)
	var dmg := _final_card_damage(move, caster)
	var interval := float(BULLET_PUNCH_SELF_STUN_MS) / 1000.0 / float(cells.size())
	var tween := battle.create_tween()
	for i in range(cells.size()):
		var entry: Dictionary = cells[i]
		tween.tween_interval(interval)
		tween.tween_callback(MoveRegistry._bullet_punch_hit.bind(battle, entry, dmg, move, caster))
	_log(caster, "%s — %d punches over %.1fs (%d DMG each), self-stunned" % [move.display_name, cells.size(), float(BULLET_PUNCH_SELF_STUN_MS) / 1000.0, dmg])

static func _bullet_punch_hit(battle: Battle, entry: Dictionary, dmg: int, move: MoveDef, caster) -> void:
	if not is_instance_valid(battle):
		return
	var p_side: String = entry["side"]
	var p_cell: Vector2i = entry["cell"]
	_spawn_punch(battle, battle.cell_to_world(p_side, p_cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
	_strike_cell(p_side, p_cell, dmg, move, caster, battle)

# === FUDO: GUARDIAN STANCE ===
# React (App3D.tsx:5928): heal self_heal (15) + place a wall column DIRECTLY
# in front (depth 1 — hugging, unlike the Wall card's depth 2). Each block
# has 2 HP (+wall_bonus_hp) — double a normal wall — and cells that already
# hold a block are SKIPPED, never overwritten. Kingfencer's En Garde aliases
# this handler later.

const GUARDIAN_STANCE_BLOCK_HP := 2

static func _guardian_stance(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	if move.self_heal > 0:
		caster_c.heal(move.self_heal)
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s — heal only (no forward column)" % move.display_name)
		return
	var wall_side: String = info["side"]
	var wall_x: int = int(info["x"])
	var wall_hp := GUARDIAN_STANCE_BLOCK_HP + TraitRegistry.wall_bonus_hp(caster_c.traits)
	var placed := 0
	for row in range(Battle.GRID_ROWS):
		var cell := Vector2i(wall_x, row)
		if battle.wall_at_cell(wall_side, cell) != null:
			continue  # never overwrite an existing block (or boulder)
		battle.spawn_wall(caster_c, wall_side, cell, wall_hp)
		placed += 1
	_log(caster, "%s — heal %d + %d guard blocks (HP %d) at %s col %d" % [move.display_name, move.self_heal, placed, wall_hp, wall_side, wall_x])

# === FUDO: GLARE ===
# Channelled stare: the caster self-stuns for 1.5s while 4 distinct random
# tiles on the OPPONENT's grid get red warning rings. When the channel ends
# (1.5s), each marked tile strikes: move.damage (10) + the status rider
# (3s stun). Ignores walls — it's a psychic stare, _strike hits directly.

const GLARE_SELF_STUN_MS := 1500
const GLARE_DELAY_S := 1.5
const GLARE_TILES := 4

static func _glare(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var opp_side := battle.forward_side(side)
	var caster_c: Combatant = caster
	caster_c.apply_stun(GLARE_SELF_STUN_MS)
	# 4 distinct random cells on the opponent grid.
	var all_cells: Array = []
	for x in range(Battle.GRID_COLS):
		for y in range(Battle.GRID_ROWS):
			all_cells.append(Vector2i(x, y))
	all_cells.shuffle()
	var cells: Array = all_cells.slice(0, GLARE_TILES)
	for i in range(cells.size()):
		var cell: Vector2i = cells[i]
		_spawn_hammer_warning(battle, battle.cell_to_world(opp_side, cell), GLARE_DELAY_S)
	var captured_battle: Battle = battle
	var captured_move: MoveDef = move
	var captured_caster = caster
	var captured_cells: Array = cells
	var tween := battle.create_tween()
	tween.tween_interval(GLARE_DELAY_S)
	tween.tween_callback(MoveRegistry._glare_strike.bind(captured_battle, captured_caster, captured_move, opp_side, captured_cells))
	_log(caster, "%s — channelling (self-stun %dms), %d tiles marked on %s grid" % [move.display_name, GLARE_SELF_STUN_MS, cells.size(), opp_side])

static func _glare_strike(battle: Battle, caster, move: MoveDef, opp_side: String, cells: Array) -> void:
	if not is_instance_valid(battle):
		return
	var dmg := _final_card_damage(move, caster)
	var hit := 0
	for i in range(cells.size()):
		var cell: Vector2i = cells[i]
		_spawn_explosion_at(battle, battle.cell_to_world(opp_side, cell), 0.9)
		var target := battle.combatant_at(opp_side, cell)
		if target != null:
			_strike(target, dmg, move, caster)  # status rider = 3s stun
			hit += 1
	_log(caster, "%s snaps — %d/%d marked tiles hit (%d DMG + stun)" % [move.display_name, hit, cells.size(), dmg])

# === FUDO: EARTH ARMOUR ===
# Instant +25 Armor (persistent pool, same system as Grabbakat's) plus a 5s
# window where every EARTH card played heals 3 — via the card_type_heal_earth
# buff key read by the execute() post-play hook. Note: Earth Armour is itself
# earth-typed, so casting it banks the first 3 HP immediately.

static func _earth_armor(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	caster_c.add_armor(move.armor_gain)
	var duration: int = move.buff_duration_ms if move.buff_duration_ms > 0 else 5000
	var buff: Dictionary = caster.apply_buff("earth_armor", 1.0, 1.0, duration)
	buff["card_type_heal_earth"] = 3
	# Amber-brown halo for the heal window.
	var halo := _make_buff_halo(Color(0.80, 0.60, 0.30))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	var ring := halo.get_child(0) as MeshInstance3D
	var mat := ring.material_override as StandardMaterial3D
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.25, 0.5).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.60, 0.5).set_trans(Tween.TRANS_SINE)
	_log(caster, "%s — +%d armor + earth cards heal 3 for %dms" % [move.display_name, move.armor_gain, duration])

# === FUDO: CRUSH EARTH ===
# Plus shape centered 3 tiles ahead of the caster. If the opponent stands
# anywhere in the plus, they're shoved onto the CENTER tile (only possible
# when the center is on their own grid and unblocked). 0.5s later the center
# slams: whoever is still standing there takes move.damage (50). Escapable —
# barely — unless stunned/stuck.

const CRUSH_EARTH_CENTER_DEPTH := 3
const CRUSH_EARTH_DELAY_S := 0.5

static func _crush_earth(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var center_info := _project_forward(side, ccell, CRUSH_EARTH_CENTER_DEPTH)
	if center_info.is_empty():
		_log(caster, "%s whiffed (center out of bounds)" % move.display_name)
		return
	var center_side: String = center_info["side"]
	var center := Vector2i(int(center_info["x"]), ccell.y)
	# Build the plus: center + depth 2/4 arms on the row + row ±1 at depth 3.
	var plus: Array = [{"side": center_side, "cell": center}]
	for dgx in range(-1, 2, 2):
		var info := _project_forward(side, ccell, CRUSH_EARTH_CENTER_DEPTH + dgx)
		if not info.is_empty():
			var i_side: String = info["side"]
			plus.append({"side": i_side, "cell": Vector2i(int(info["x"]), ccell.y)})
	for dy in range(-1, 2, 2):
		var ny: int = ccell.y + dy
		if ny >= 0 and ny < Battle.GRID_ROWS:
			plus.append({"side": center_side, "cell": Vector2i(center.x, ny)})
	# Telegraph the plus for the slam window; center ring reads bigger via
	# the doubled warning.
	for entry in plus:
		var w_side: String = entry["side"]
		var w_cell: Vector2i = entry["cell"]
		_spawn_hammer_warning(battle, battle.cell_to_world(w_side, w_cell), CRUSH_EARTH_DELAY_S)
	_spawn_hammer_warning(battle, battle.cell_to_world(center_side, center) + Vector3(0.0, 0.15, 0.0), CRUSH_EARTH_DELAY_S)
	# Shove the opponent onto the center if they're in the plus.
	var opp := battle.get_opponent(caster)
	if opp != null and opp.is_alive():
		var o_side := battle.get_side(opp)
		var o_cell := battle.get_caster_cell(opp)
		var in_plus := false
		for entry in plus:
			var p_side: String = entry["side"]
			var p_cell: Vector2i = entry["cell"]
			if p_side == o_side and p_cell == o_cell:
				in_plus = true
				break
		var on_center := o_side == center_side and o_cell == center
		if in_plus and not on_center and o_side == center_side and not battle.combatant_blocked_at(center_side, center):
			battle.set_caster_cell(opp, center)
			var captured_opp: Combatant = opp
			var dest := battle.cell_to_world(center_side, center)
			var shove := battle.create_tween()
			shove.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
			shove.tween_property(captured_opp, "global_position", dest, 0.15)
	# Delayed center slam.
	var captured_battle: Battle = battle
	var captured_move: MoveDef = move
	var captured_caster = caster
	var slam := battle.create_tween()
	slam.tween_interval(CRUSH_EARTH_DELAY_S)
	slam.tween_callback(MoveRegistry._crush_earth_slam.bind(captured_battle, captured_caster, captured_move, center_side, center))
	_log(caster, "%s — plus at depth %d, center slam in %.1fs" % [move.display_name, CRUSH_EARTH_CENTER_DEPTH, CRUSH_EARTH_DELAY_S])

static func _crush_earth_slam(battle: Battle, caster, move: MoveDef, center_side: String, center: Vector2i) -> void:
	if not is_instance_valid(battle):
		return
	_spawn_explosion_at(battle, battle.cell_to_world(center_side, center), 1.7)
	var victim := battle.combatant_at(center_side, center)
	if victim != null and victim.is_alive():
		var dmg := _final_card_damage(move, caster)
		victim.take_damage(dmg, move.move_type, "crush_earth")
		_log(caster, "%s SLAMS — %d DMG" % [move.display_name, dmg])
	else:
		_log(caster, "%s slams empty ground" % move.display_name)

# === ICAGE: MIND SPIKE ===
# Single homing psychic orb: spawns 1 cell forward and drifts enemy-ward
# with the Street-Swarm walker gait (70% forward bias, random ±1 row per
# step). move.damage (10) contact DMG, self-destructs on hit; shootable
# (10 HP) like any walker. React's trash-toss alias minus the rat — same
# user call as Modizard's Arcane Bolt.

const MIND_SPIKE_HP := 10
const MIND_SPIKE_STEP_S := 0.5
const MIND_SPIKE_LIFETIME_MS := 5000

static func _mind_spike(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		_log(caster, "%s whiffed (no forward cell)" % move.display_name)
		return
	var s_side: String = info["side"]
	var s_cell := Vector2i(int(info["x"]), ccell.y)
	var dmg := _final_card_damage(move, caster)
	var caster_c: Combatant = caster
	var orb := battle.spawn_turret(caster_c, s_side, s_cell, MIND_SPIKE_HP, 99.0, 0)
	if orb == null:
		_log(caster, "%s fizzled (spawn blocked)" % move.display_name)
		return
	orb.fires_bullets = false
	orb.move_interval_s = MIND_SPIKE_STEP_S
	orb.random_forward_walker = true
	orb.contact_damage = dmg
	orb.contact_type = move.move_type
	orb.contact_label = "mind_spike"
	orb.lifetime_ms = MIND_SPIKE_LIFETIME_MS
	_log(caster, "%s — psychic orb drifting (%d contact DMG, %dms life)" % [move.display_name, dmg, MIND_SPIKE_LIFETIME_MS])

# === KINGFENCER: FLECHE (clawingsword) ===
# Advancing slash: sweeps the caster's row cell-by-cell across both grids at
# CLAWINGSWORD_STEP_S. Combatants in the path take move.damage (30) and the
# slash KEEPS GOING; the first block it meets (any owner — boulders too) is
# demolished and consumes the sweep. Ported from React's working enemy-side
# implementation (the player-side React version spawned out of bounds and
# was a no-op — that's why Hogglin's copy was originally skipped). Also
# retro-available for Hogglin's Clawingsword card if it's ever re-added.

const CLAWINGSWORD_STEP_S := 0.09

static func _clawingsword(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var cells: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		var p_side: String = info["side"]
		cells.append({"side": p_side, "cell": Vector2i(int(info["x"]), ccell.y)})
		d += 1
	if cells.is_empty():
		_log(caster, "%s whiffed (no forward cells)" % move.display_name)
		return
	var dmg := _final_card_damage(move, caster)
	var caster_c: Combatant = caster
	var state := {"stopped": false}
	var tween := battle.create_tween()
	for i in range(cells.size()):
		var entry: Dictionary = cells[i]
		tween.tween_callback(MoveRegistry._clawingsword_hit.bind(battle, entry, dmg, move, caster_c, state))
		tween.tween_interval(CLAWINGSWORD_STEP_S)
	_log(caster, "%s — advancing slash, %d cells (%d DMG, blocks consume it)" % [move.display_name, cells.size(), dmg])

static func _clawingsword_hit(battle: Battle, entry: Dictionary, dmg: int, move: MoveDef, caster: Combatant, state: Dictionary) -> void:
	if state.get("stopped", false) or not is_instance_valid(battle):
		return
	var p_side: String = entry["side"]
	var p_cell: Vector2i = entry["cell"]
	_spawn_slash(battle, battle.cell_to_world(p_side, p_cell), 0)
	# First block (any owner, boulders included) eats the sweep.
	var wall := battle.wall_at_cell(p_side, p_cell)
	if wall != null:
		wall.take_damage(wall.hp, caster)
		state["stopped"] = true
		return
	var target := battle.combatant_at(p_side, p_cell)
	if target != null:
		_strike(target, dmg, move, caster)  # pass-through — the slash keeps going

# === TRIPLE ECHO (Pixie trait) ===
# Fired 0.5s after every 3rd card: bursts at the enemy's CURRENT cell and
# deals 10 untyped DMG (React reads their position at echo time, so it's
# unavoidable — App3D.tsx:4506-4519).

static func _echo_strike(battle: Battle, caster: Combatant) -> void:
	if not is_instance_valid(battle) or not is_instance_valid(caster):
		return
	var opp := battle.get_opponent(caster)
	if opp == null or not opp.is_alive():
		return
	var o_side := battle.get_side(opp)
	var o_cell := battle.get_caster_cell(opp)
	_spawn_explosion_at(battle, battle.cell_to_world(o_side, o_cell), 0.9)
	opp.take_damage(ECHO_DAMAGE, "", "triple_echo")
	_log(caster, "Triple Echo strikes — %d DMG" % ECHO_DAMAGE)

# === LOGGING ===

static func _log(caster, msg: String) -> void:
	var nm := "?"
	if caster and caster.has_method("get") and caster.get("display_name"):
		nm = caster.display_name
	print("[CARD] %s: %s" % [nm, msg])

# === GOZO STARTER CARDS (mon battle grid_starters.xlsx sheet 2, monster C) ===

const BLESSED_LIFETIME_MS := 60000  # "until broken" — cleared at 45 dmg soaked or by Consecrate
const AEGIS_PILLAR_HP := 40
const SLAB_DELAY_S := 3.0
const SLAB_RUBBLE_MS := 4000
const SLAB_FULL_HP_DAMAGE := 55
const LITANY_CHANNEL_MS := 3000
const LITANY_REDUCTION := 25
const LITANY_PULSES := 3
const CONSECRATE_DMG_PER_TILE := 15

# Sanctified Ground — bless your grid's centre 2x2. Standing on your own
# blessed tile: 30% less damage taken (Combatant.take_damage positional read)
# + 3 HP/s (tile tick). Soaking 45 damage inside shatters the blessing
# (Battle._on_damaged_trait_hooks).
static func _sanctified_ground(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	for x in range(1, 3):
		for y in range(1, 3):
			battle.spawn_tile(caster, side, Vector2i(x, y), "blessed_tile", BLESSED_LIFETIME_MS, true)
	_log(caster, "%s — centre 2x2 blessed (30%% DR + heal inside; breaks after 45 dmg)" % move.display_name)

# Aegis Pillar — 40 HP wall 3 ahead (falls back closer if occupied) + the
# SHATTER bonus card lands on key 3: 0 mana, detonates the pillar for its
# REMAINING HP to all 8 adjacent cells on its grid.
static func _aegis_pillar(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var placed := false
	for i in range(3):
		var depth := 3 - i
		var info := _project_forward(side, ccell, depth)
		if info.is_empty():
			continue
		var w_side: String = info["side"]
		var w_cell := Vector2i(int(info["x"]), ccell.y)
		if battle.wall_at_cell(w_side, w_cell) != null:
			continue
		if battle.combatant_at(w_side, w_cell) != null:
			continue
		var hp := AEGIS_PILLAR_HP + TraitRegistry.wall_bonus_hp(caster.traits)
		var wall := battle.spawn_wall(caster, w_side, w_cell, hp)
		# Purple so both sides can read which block is the pillar (user amend).
		wall.set_tint(Color(0.62, 0.35, 0.85))
		battle.register_aegis(caster, wall)
		placed = true
		break
	if not placed:
		caster.gain_mana(1)
		_log(caster, "%s — no room for the pillar (1 mana refund)" % move.display_name)
		return
	var shatter := MoveDef.new()
	shatter.id = "aegis_shatter"
	shatter.display_name = "Shatter"
	shatter.move_type = "light"
	shatter.mana_cost = 0
	shatter.description = "Detonate the Aegis Pillar — its remaining HP hits every adjacent tile."
	shatter.effect_id = "aegis_shatter"
	var caster_c: Combatant = caster
	caster_c.grant_bonus_card(shatter)
	_log(caster, "%s — pillar raised (%d HP). SHATTER ready on [3]." % [move.display_name, AEGIS_PILLAR_HP])

# Shatter — flat pillar-HP damage (earthquake-style, no dealt mults) to
# combatants and turrets on the pillar's 8 neighbours, same grid. The pillar
# dies WITH destroyer credit, so Stonebreaker Faith pays its 10 heal.
static func _aegis_shatter(move: MoveDef, caster, battle: Battle) -> void:
	var wall: Wall = battle.aegis_pillar_of(caster)
	if wall == null:
		_log(caster, "%s — no pillar standing" % move.display_name)
		return
	var dmg := wall.hp
	var w_side := wall.grid_side
	var w_cell := wall.cell
	for dx in range(-1, 2):
		for dy in range(-1, 2):
			if dx == 0 and dy == 0:
				continue
			var cell := w_cell + Vector2i(dx, dy)
			if cell.x < 0 or cell.x >= Battle.GRID_COLS or cell.y < 0 or cell.y >= Battle.GRID_ROWS:
				continue
			_spawn_punch(battle, battle.cell_to_world(w_side, cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
			var target := battle.combatant_at(w_side, cell)
			if target != null and target.is_alive():
				target.take_damage(dmg, move.move_type, "aegis_shatter")
			var turret := battle.turret_at_cell(w_side, cell)
			if turret != null:
				turret.take_damage(dmg, caster as Combatant)
	var caster_c: Combatant = caster
	wall.take_damage(99999, caster_c)
	_log(caster, "%s — pillar detonates for %d around it" % [move.display_name, dmg])

# Judgment Slab — 3s telegraphed fall onto the enemy's CURRENT cell: 35
# (55 if the caster is untouched at impact), then the cell is rubble
# (broken_tile) for 4s. Full-HP check happens at IMPACT — getting tagged
# during the fall costs the bonus.
static func _judgment_slab(move: MoveDef, caster, battle: Battle) -> void:
	var opp: Combatant = battle.get_opponent(caster)
	if opp == null:
		return
	var t_side := battle.get_side(opp)
	var t_cell := battle.get_caster_cell(opp)
	_spawn_hammer_warning(battle, battle.cell_to_world(t_side, t_cell), SLAB_DELAY_S)
	var tween := battle.create_tween()
	tween.tween_interval(SLAB_DELAY_S)
	tween.tween_callback(MoveRegistry._slab_impact.bind(move, caster, battle, t_side, t_cell))
	_log(caster, "%s — the slab falls in %.0fs" % [move.display_name, SLAB_DELAY_S])

static func _slab_impact(move: MoveDef, caster, battle: Battle, side: String, cell: Vector2i) -> void:
	if not is_instance_valid(battle):
		return
	var caster_c: Combatant = caster
	if caster_c == null or not is_instance_valid(caster_c):
		return
	var base := move.damage
	if caster_c.hp >= caster_c.max_hp:
		base = SLAB_FULL_HP_DAMAGE
	var dmg := 0
	if not caster_c.roll_blind_miss():
		dmg = maxi(1, int(round(float(base) \
			* TraitRegistry.damage_dealt_mult(caster_c.traits) \
			* TraitRegistry.card_mult(caster_c.traits, move.move_type) \
			* caster_c.buff_damage_dealt_mult_for_card(move.move_type))))
	_spawn_punch(battle, battle.cell_to_world(side, cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
	var victim := battle.combatant_at(side, cell)
	if victim != null and victim.is_alive() and dmg > 0:
		victim.take_damage(dmg, move.move_type, "judgment_slab")
	battle.spawn_tile(caster_c, side, cell, "broken_tile", SLAB_RUBBLE_MS, false)

# Litany of Stone — 3s channel: rooted, flat -25 on incoming hits (absorbs
# refund 1 mana via Battle listeners), and a 20-dmg row pulse each second.
# The pulse reuses the Beam handler wholesale via a temp MoveDef.
static func _litany_of_stone(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	caster_c.apply_root(LITANY_CHANNEL_MS)
	caster_c.flat_reduction = LITANY_REDUCTION
	caster_c.flat_reduction_until_ms = Time.get_ticks_msec() + LITANY_CHANNEL_MS
	var pulse := MoveDef.new()
	pulse.id = "litany_pulse"
	pulse.display_name = move.display_name
	pulse.move_type = move.move_type
	pulse.damage = move.damage
	pulse.effect_id = "beam"
	var tween := battle.create_tween()
	for i in range(LITANY_PULSES):
		tween.tween_interval(1.0)
		tween.tween_callback(MoveRegistry._litany_pulse.bind(pulse, caster, battle))
	tween.tween_callback(func() -> void:
		if is_instance_valid(caster_c):
			caster_c.flat_reduction = 0
	)
	_log(caster, "%s — channeling: rooted 3s, hits absorbed -%d, row pulses each second" % [move.display_name, LITANY_REDUCTION])

static func _litany_pulse(pulse: MoveDef, caster, battle: Battle) -> void:
	if not is_instance_valid(battle):
		return
	var caster_c: Combatant = caster
	if caster_c == null or not is_instance_valid(caster_c) or not caster_c.is_alive():
		return
	_beam(pulse, caster, battle)

# Consecrate — heal, then consume ALL of the caster's terrain: blessed tiles,
# slab rubble, and every standing wall he owns (pillar, Wall card, Guardian
# Stance — boulders exempt). 15 flat damage per work consumed (earthquake
# rules: location-derived, no dealt mults). Once per battle via cooldown_ms.
static func _consecrate(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	if move.self_heal > 0:
		caster_c.heal(move.self_heal)
	var count := 0
	for i in range(battle._tiles.size() - 1, -1, -1):
		var t: TimedEffect = battle._tiles[i]
		if not is_instance_valid(t):
			continue
		if t.owner_combatant != caster_c:
			continue
		if t.effect_id == "blessed_tile" or t.effect_id == "broken_tile":
			battle._tiles.remove_at(i)
			t.queue_free()
			count += 1
	for i in range(battle._walls.size() - 1, -1, -1):
		var w = battle._walls[i]
		if not is_instance_valid(w):
			continue
		var wall := w as Wall
		if wall == null or wall.owner_combatant != caster_c:
			continue
		if wall.is_in_group("boulders"):
			continue
		# The Aegis pillar goes with the rest — retire its Shatter card too
		# (checked BEFORE the free: queue_free defers, is_instance_valid would
		# still say true this frame).
		if battle.aegis_pillar_of(caster_c) == wall and caster_c.bonus_card != null \
				and caster_c.bonus_card.effect_id == "aegis_shatter":
			caster_c.clear_bonus_card()
		# Consumed silently (Topple-style) — Consecrate IS the payoff, no
		# Stonebreaker double-dip on your own sacrifice.
		battle._walls.remove_at(i)
		wall.queue_free()
		count += 1
	if count == 0:
		_log(caster, "%s — nothing to consecrate" % move.display_name)
		return
	var opp: Combatant = battle.get_opponent(caster)
	var dmg := CONSECRATE_DMG_PER_TILE * count
	if opp != null and opp.is_alive():
		_spawn_punch(battle, opp.global_position, battle.get_side(caster) == Battle.SIDE_ENEMY)
		opp.take_damage(dmg, move.move_type, "consecrate")
	_log(caster, "%s — %d works consumed → %d holy damage" % [move.display_name, count, dmg])

# === KINDLEKIT STARTER CARDS (mon battle grid_starters.xlsx sheet 2, monster A) ===

const CINDER_BURN_DPS := 2          # burn rider rides the poison DoT machinery for now
const CINDER_BURN_MS := 5000
const CINDER_RECOIL := 10
const CINDER_STUCK_MS := 1500       # doc's wall-stun "punish window"
const CINDER_FORWARD_TIME_S := 0.22
const CINDER_REVERSE_TIME_S := 0.55
const KNUCKLE_WINDUP_MS := 2000
const KNUCKLE_REFUND := 3
const KNUCKLE_SHOCKWAVE_DMG := 25
const EMBER_GUARD_MS := 5000
const EMBER_BURN_TILE_MS := 3000
const IMMOLATION_LIFETIME_MS := 8000
const IMMOLATION_POLL_S := 0.25
const IMMOLATION_DEALT_MULT := 1.5
const CREMATE_PER_BURN := 10

# Cinder Rush — rush along the row until the first enemy or wall. Enemy:
# 45 + a 2/s burn for 5s (poison machinery). Wall: 10 recoil + stuck 1.5s —
# that self-stun is the enemy's punish window. Full miss: free reposition out
# and back, nothing lands.
static func _cinder_rush(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var path: Array = []
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(info["x"], ccell.y)})
		d += 1
	if path.is_empty():
		_log(caster, "%s whiffed (no forward path)" % move.display_name)
		return
	var hit_combatant: Combatant = null
	var hit_wall: Wall = null
	var hit_entry: Dictionary = {}
	for entry in path:
		var wall := battle.wall_at_cell(entry["side"], entry["cell"])
		if wall != null and wall.owner_combatant != caster:
			hit_wall = wall
			hit_entry = entry
			break
		var occupant := battle.combatant_at(entry["side"], entry["cell"])
		if occupant != null and occupant != caster:
			hit_combatant = occupant
			hit_entry = entry
			break
	var landing_entry: Dictionary = hit_entry if (hit_combatant != null or hit_wall != null) else path[path.size() - 1]
	var start_world: Vector3 = caster.global_position
	var landing_world: Vector3 = battle.cell_to_world(landing_entry["side"], landing_entry["cell"])
	var captured_caster: Combatant = caster
	var captured_move: MoveDef = move
	var captured_combatant: Combatant = hit_combatant
	var captured_wall: Wall = hit_wall
	var on_landed := func() -> void:
		if not is_instance_valid(captured_caster):
			return
		if captured_combatant != null and is_instance_valid(captured_combatant):
			_strike(captured_combatant, _final_card_damage(captured_move, captured_caster), captured_move, captured_caster)
			if captured_combatant.is_alive():
				captured_combatant.apply_burn(CINDER_BURN_MS, CINDER_BURN_DPS, "cinder_burn")
		elif captured_wall != null and is_instance_valid(captured_wall):
			captured_caster.take_damage(CINDER_RECOIL, "", "cinder_recoil")
			captured_caster.apply_stun(CINDER_STUCK_MS)
	battle.lock_rush(caster, CINDER_FORWARD_TIME_S + CINDER_REVERSE_TIME_S)
	var tween := battle.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_IN)
	tween.tween_property(caster, "global_position", landing_world, CINDER_FORWARD_TIME_S)
	tween.tween_callback(on_landed)
	tween.tween_property(caster, "global_position", start_world, CINDER_REVERSE_TIME_S).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	var target_name: String = "wall" if hit_wall != null else (hit_combatant.display_name if hit_combatant != null else "nothing")
	_log(caster, "%s — rushed into %s" % [move.display_name, target_name])

# Meteor Knuckle — 2s glowing windup (self-stun). Taking ANY damage during it
# cancels the punch and refunds 3 mana. On release: 75 to the tile ahead;
# empty tile → 25 shockwave across the 3-wide arc at depth 2.
static func _meteor_knuckle(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	caster_c.apply_stun(KNUCKLE_WINDUP_MS)
	var halo := _make_buff_halo(Color(1.0, 0.45, 0.10))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	var ring := halo.get_child(0) as MeshInstance3D
	var grow := halo.create_tween()
	grow.tween_property(ring, "scale", Vector3(1.6, 1.6, 1.6), float(KNUCKLE_WINDUP_MS) / 1000.0)
	var state := {"resolved": false}
	var cancel_cb := func(_a: int, _m: float, _st: String, _sr: String) -> void:
		if state["resolved"]:
			return
		state["resolved"] = true
		if is_instance_valid(halo):
			halo.queue_free()
		if is_instance_valid(caster_c):
			caster_c.stun_until_ms = Time.get_ticks_msec()  # release the channel
			caster_c.gain_mana(KNUCKLE_REFUND)
			_log(caster_c, "Meteor Knuckle interrupted — %d mana refunded" % KNUCKLE_REFUND)
	caster_c.damaged.connect(cancel_cb, Object.CONNECT_ONE_SHOT)
	var captured_battle: Battle = battle
	var captured_move: MoveDef = move
	var t := battle.create_tween()
	t.tween_interval(float(KNUCKLE_WINDUP_MS) / 1000.0)
	t.tween_callback(func() -> void:
		if state["resolved"]:
			return
		state["resolved"] = true
		if is_instance_valid(caster_c) and caster_c.damaged.is_connected(cancel_cb):
			caster_c.damaged.disconnect(cancel_cb)
		if is_instance_valid(halo):
			halo.queue_free()
		MoveRegistry._knuckle_release(captured_move, caster_c, captured_battle)
	)
	_log(caster, "%s — winding up… (interrupt refunds %d)" % [move.display_name, KNUCKLE_REFUND])

static func _knuckle_release(move: MoveDef, caster: Combatant, battle: Battle) -> void:
	if not is_instance_valid(battle) or not is_instance_valid(caster) or not caster.is_alive():
		return
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var info := _project_forward(side, ccell, 1)
	if info.is_empty():
		return
	var h_side: String = info["side"]
	var h_cell := Vector2i(int(info["x"]), ccell.y)
	_spawn_punch(battle, battle.cell_to_world(h_side, h_cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
	var wall := battle.wall_at_cell(h_side, h_cell)
	if wall != null:
		wall.take_damage(_final_card_damage(move, caster), caster)
		_log(caster, "%s — slammed a block" % move.display_name)
		return
	var target := battle.combatant_at(h_side, h_cell)
	if target != null and target.is_alive():
		_strike(target, _final_card_damage(move, caster), move, caster)
		_log(caster, "%s — CONNECTS" % move.display_name)
		return
	# Empty — shockwave across the 3-wide arc at depth 2.
	var info2 := _project_forward(side, ccell, 2)
	if info2.is_empty():
		return
	var s_side: String = info2["side"]
	for dy in range(-1, 2):
		var cy: int = ccell.y + dy
		if cy < 0 or cy >= Battle.GRID_ROWS:
			continue
		var cell := Vector2i(int(info2["x"]), cy)
		_spawn_punch(battle, battle.cell_to_world(s_side, cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
		_strike_cell(s_side, cell, KNUCKLE_SHOCKWAVE_DMG, move, caster, battle)
	_log(caster, "%s — whiffed into a shockwave" % move.display_name)

# Ember Guard — 5s stance: every hit you take sets the ground under the
# enemy on fire (standard burn tile, 3s). Feeds Cremate.
static func _ember_guard(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var halo := _make_buff_halo(Color(1.0, 0.55, 0.15))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	var captured_battle: Battle = battle
	var proc_cb := func(_a: int, _m: float, _st: String, _sr: String) -> void:
		if not is_instance_valid(captured_battle) or not is_instance_valid(caster_c):
			return
		var opp: Combatant = captured_battle.get_opponent(caster_c)
		if opp == null or not opp.is_alive():
			return
		captured_battle.spawn_tile(caster_c, captured_battle.get_side(opp), captured_battle.get_caster_cell(opp), "burn_tile", EMBER_BURN_TILE_MS, false)
	caster_c.damaged.connect(proc_cb)
	var timeout := battle.create_tween()
	timeout.tween_interval(float(EMBER_GUARD_MS) / 1000.0)
	timeout.tween_callback(func() -> void:
		if is_instance_valid(caster_c) and caster_c.damaged.is_connected(proc_cb):
			caster_c.damaged.disconnect(proc_cb)
		if is_instance_valid(halo):
			halo.queue_free()
	)
	_log(caster, "%s — 5s: hits taken ignite the enemy's footing" % move.display_name)

# Immolation Point — burn your OWN tile (it hurts you too: harms_owner).
# While standing on it: damage dealt ×1.5 + mana regen boosted. Stepping off
# drops the empowerment; the tile burning away (or Cremate eating it) ends it.
static func _immolation_point(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var side := battle.get_side(caster_c)
	var cell := battle.get_caster_cell(caster_c)
	var tile := battle.spawn_tile(caster_c, side, cell, "burn_tile", IMMOLATION_LIFETIME_MS, false)
	tile.harms_owner = true
	var captured_battle: Battle = battle
	var poll := battle.create_tween().set_loops(int(float(IMMOLATION_LIFETIME_MS) / (IMMOLATION_POLL_S * 1000.0)) + 2)
	poll.tween_interval(IMMOLATION_POLL_S)
	poll.tween_callback(func() -> void:
		if not is_instance_valid(caster_c) or not caster_c.is_alive():
			return
		var standing := is_instance_valid(tile) \
			and captured_battle.get_side(caster_c) == tile.grid_side \
			and captured_battle.get_caster_cell(caster_c) == tile.cell
		if standing:
			caster_c.mana_boost_until_ms = maxi(caster_c.mana_boost_until_ms, Time.get_ticks_msec() + 400)
			if not caster_c.has_buff("immolation"):
				var b: Dictionary = caster_c.apply_buff("immolation", 1.0, IMMOLATION_DEALT_MULT, IMMOLATION_LIFETIME_MS)
				var h := _make_buff_halo(Color(1.0, 0.30, 0.10))
				caster_c.add_child(h)
				h.position = Vector3(0.0, 0.1, 0.0)
				b["visual"] = h
		elif caster_c.has_buff("immolation"):
			caster_c.consume_buff("immolation")
	)
	_log(caster, "%s — own tile ablaze: stand in the fire for ×%.1f power" % [move.display_name, IMMOLATION_DEALT_MULT])

# Cremate — consume EVERY burn tile on the field (any owner, Immolation's
# included) for 10 flat damage each to the enemy (earthquake rules, no mults).
static func _cremate(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var count := 0
	for i in range(battle._tiles.size() - 1, -1, -1):
		var t: TimedEffect = battle._tiles[i]
		if not is_instance_valid(t):
			continue
		if t.effect_id != "burn_tile":
			continue
		battle._tiles.remove_at(i)
		t.queue_free()
		count += 1
	if count == 0:
		_log(caster, "%s — nothing burning to consume" % move.display_name)
		return
	var opp: Combatant = battle.get_opponent(caster_c)
	var dmg := CREMATE_PER_BURN * count
	if opp != null and opp.is_alive():
		_spawn_punch(battle, opp.global_position, battle.get_side(caster) == Battle.SIDE_ENEMY)
		opp.take_damage(dmg, move.move_type, "cremate")
	_log(caster, "%s — %d burns consumed → %d fire damage" % [move.display_name, count, dmg])

# === DANDEOX STARTER CARDS (mon battle grid_starters.xlsx sheet 2, monster B) ===

const SEED_LIFETIME_MS := 6000       # arms at 3s (TimedEffect.SEED_ARM_MS), gone at 6s
const NIGHTBLOOM_MS := 5000
const NIGHTBLOOM_BLIND_MS := 3000
const CREEP_ROW_MS := 4000
const MIMIC_LIFETIME_MS := 4000
const MIMIC_HEAL := 35
const MIMIC_MANA := 2
const MIMIC_POLL_S := 0.15
const ROT_HEAL_PER_STATUS := 15
const ROT_STUN_THRESHOLD := 3
const ROT_STUN_MS := 2000

# Seedbind — plant a dormant seed on the enemy's CURRENT cell. Inert for 3s,
# then armed until 6s: stepping on it roots 2s and heals the planter 25.
static func _seedbind(move: MoveDef, caster, battle: Battle) -> void:
	var opp: Combatant = battle.get_opponent(caster)
	if opp == null:
		return
	var t_side := battle.get_side(opp)
	var t_cell := battle.get_caster_cell(opp)
	battle.spawn_tile(caster, t_side, t_cell, "seed_trap", SEED_LIFETIME_MS, false)
	_log(caster, "%s — seed planted under %s (arms in 3s)" % [move.display_name, opp.display_name])

# Nightbloom — 5s stance: every hit you take heals back 50% of it and BLINDS
# the attacker 3s. A stance you fight inside of.
static func _nightbloom(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var halo := _make_buff_halo(Color(0.55, 0.30, 0.70))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	var captured_battle: Battle = battle
	var proc_cb := func(amount: int, _m: float, _st: String, _sr: String) -> void:
		if not is_instance_valid(captured_battle) or not is_instance_valid(caster_c) or not caster_c.is_alive():
			return
		if amount <= 0:
			return
		caster_c.heal(int(ceil(float(amount) * 0.5)))
		var opp: Combatant = captured_battle.get_opponent(caster_c)
		if opp != null and opp.is_alive():
			opp.apply_blind(NIGHTBLOOM_BLIND_MS)
	caster_c.damaged.connect(proc_cb)
	var timeout := battle.create_tween()
	timeout.tween_interval(float(NIGHTBLOOM_MS) / 1000.0)
	timeout.tween_callback(func() -> void:
		if is_instance_valid(caster_c) and caster_c.damaged.is_connected(proc_cb):
			caster_c.damaged.disconnect(proc_cb)
		if is_instance_valid(halo):
			halo.queue_free()
	)
	_log(caster, "%s — 5s: hits taken half-heal you and BLIND the attacker" % move.display_name)

# Creeping Row — the enemy's CURRENT row chokes with vines for 4s: gravity
# stickiness (2 commands to leave a cell) + 5 dark DMG/s.
static func _creeping_row(move: MoveDef, caster, battle: Battle) -> void:
	var opp: Combatant = battle.get_opponent(caster)
	if opp == null:
		return
	var t_side := battle.get_side(opp)
	var row: int = battle.get_caster_cell(opp).y
	for x in range(Battle.GRID_COLS):
		battle.spawn_tile(caster, t_side, Vector2i(x, row), "creeping_vine", CREEP_ROW_MS, false)
	_log(caster, "%s — %s's row chokes with vines (4s)" % [move.display_name, opp.display_name])

# Mimic Shroud (v1 — no card mirroring per user) — a 1 HP decoy wearing your
# sprite appears on a RANDOM adjacent tile for 4s, copies your movement
# deltas AND your basic shots (Battle._spawn_basic_bullet mirrors through
# the _mimics registry). If it's KILLED (not timed out), you heal 35 and
# gain 2 mana.
static func _mimic_shroud(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var side := battle.get_side(caster_c)
	var ccell := battle.get_caster_cell(caster_c)
	var offsets: Array = [Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)]
	offsets.shuffle()
	var spawn_cell := Vector2i(-1, -1)
	for i in range(offsets.size()):
		var off: Vector2i = offsets[i]
		var cell: Vector2i = ccell + off
		if cell.x < 0 or cell.x >= Battle.GRID_COLS or cell.y < 0 or cell.y >= Battle.GRID_ROWS:
			continue
		if battle.combatant_at(side, cell) != null:
			continue
		if battle.wall_at_cell(side, cell) != null:
			continue
		if battle.turret_at_cell(side, cell) != null:
			continue
		spawn_cell = cell
		break
	if spawn_cell.x < 0:
		caster_c.gain_mana(1)
		_log(caster, "%s — no room for the decoy (1 mana refund)" % move.display_name)
		return
	var sprite_tex: Texture2D = caster_c.monster_def.sprite if caster_c.monster_def != null else null
	var decoy := battle.spawn_turret(caster_c, side, spawn_cell, 1, 0.0, Battle.BASIC_DAMAGE, sprite_tex, Color(0.85, 0.80, 1.0))
	decoy.fires_bullets = false
	decoy.lifetime_ms = MIMIC_LIFETIME_MS
	decoy.bullet_type = caster_c.monster_type
	battle._mimics[caster_c.get_instance_id()] = decoy
	decoy.destroyed.connect(func(_o, _d) -> void:
		if is_instance_valid(caster_c) and caster_c.is_alive():
			caster_c.heal(MIMIC_HEAL)
			caster_c.gain_mana(MIMIC_MANA)
			_log(caster_c, "Mimic Shroud pops — +%d HP, +%d mana" % [MIMIC_HEAL, MIMIC_MANA])
	)
	# Movement mirroring — poll the caster's cell and replay the deltas.
	var state := {"last": ccell}
	var captured_battle: Battle = battle
	var poll := battle.create_tween().set_loops(int(float(MIMIC_LIFETIME_MS) / (MIMIC_POLL_S * 1000.0)))
	poll.tween_interval(MIMIC_POLL_S)
	poll.tween_callback(func() -> void:
		if not is_instance_valid(decoy) or not is_instance_valid(caster_c):
			return
		var cur: Vector2i = captured_battle.get_caster_cell(caster_c)
		var delta: Vector2i = cur - state["last"]
		state["last"] = cur
		if delta == Vector2i.ZERO:
			return
		var target: Vector2i = decoy.cell + delta
		if target.x < 0 or target.x >= Battle.GRID_COLS or target.y < 0 or target.y >= Battle.GRID_ROWS:
			return
		if captured_battle.combatant_at(decoy.grid_side, target) != null:
			return
		if captured_battle.wall_at_cell(decoy.grid_side, target) != null:
			return
		decoy.cell = target
		var tw := captured_battle.create_tween()
		tw.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tw.tween_property(decoy, "global_position", captured_battle.cell_to_world(decoy.grid_side, target), 0.18)
	)
	_log(caster, "%s — decoy conjured (4s; its death feeds you)" % move.display_name)

# Rot Harvest — the payoff for a seeded field. Enemy carrying ANY status
# takes the hit; heal 15 per active status on BOTH fighters; an enemy at 3+
# statuses is also stunned 2s.
static func _rot_harvest(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var opp: Combatant = battle.get_opponent(caster_c)
	if opp == null:
		return
	var opp_statuses := _status_count(opp)
	var total := opp_statuses + _status_count(caster_c)
	if opp_statuses > 0 and opp.is_alive():
		_spawn_punch(battle, opp.global_position, battle.get_side(caster) == Battle.SIDE_ENEMY)
		var dmg := _final_card_damage(move, caster)
		if dmg > 0:
			_strike(opp, dmg, move, caster)
	if total > 0:
		caster_c.heal(ROT_HEAL_PER_STATUS * total)
	if opp_statuses >= ROT_STUN_THRESHOLD and opp.is_alive():
		opp.apply_stun(ROT_STUN_MS, caster_c)
		_log(caster, "%s — %d statuses: rot overwhelms, 2s stun" % [move.display_name, opp_statuses])
	_log(caster, "%s — %d active statuses harvested (+%d HP)" % [move.display_name, total, ROT_HEAL_PER_STATUS * total])

# Active-status census for Rot Harvest (stun/poison/silence/blind/root/burn).
static func _status_count(c: Combatant) -> int:
	var n := 0
	if c.is_stunned():
		n += 1
	if c.is_poisoned():
		n += 1
	if c.is_silenced():
		n += 1
	if c.is_blinded():
		n += 1
	if c.is_rooted():
		n += 1
	if c.is_burned():
		n += 1
	return n

# === KLAWR STARTER CARDS (mon battle grid_starters.xlsx sheet 2, monster D) ===

const UNDERTOW_CRUSH_BONUS := 15
const UNDERTOW_PULL_S := 0.35
const RIPPLE_HOPS := 4
const RIPPLE_RANGE := 3          # manhattan distance per arc
const RIPPLE_HEAL := 10          # arcing into the caster heals instead
const RIPPLE_HOP_S := 0.18
const GLACIAL_ICE_MS := 4000     # doc: 240 ticks
const TIDAL_READ_FUSE_S := 7.0
const TIDAL_READ_STUN_MS := 1000
const TIDAL_READ_REFUND := 3
const CASCADE_MS := 5000

# Undertow — row scan (lasso semantics, walls don't block the line): first
# enemy takes 20 and is dragged 1 cell toward you. If the drag is blocked by
# a wall or their grid edge, they crunch into it for +15 instead.
static func _undertow(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var target: Combatant = null
	var last_entry: Dictionary = {}
	var d := 1
	while true:
		var info := _project_forward(side, ccell, d)
		if info.is_empty():
			break
		last_entry = info
		var occupant := battle.combatant_at(info["side"], Vector2i(int(info["x"]), ccell.y))
		if occupant != null and occupant != caster:
			target = occupant
			break
		d += 1
	var from: Vector3 = caster.global_position + Vector3(0.0, 0.8, 0.0)
	if target != null:
		_spawn_lasso_rope(battle, from, target.global_position + Vector3(0.0, 0.8, 0.0))
	elif not last_entry.is_empty():
		_spawn_lasso_rope(battle, from, battle.cell_to_world(last_entry["side"], Vector2i(int(last_entry["x"]), ccell.y)) + Vector3(0.0, 0.8, 0.0))
	if target == null:
		_log(caster, "%s — nothing inline to drag" % move.display_name)
		return
	var dmg := _final_card_damage(move, caster)
	if dmg > 0:
		_strike(target, dmg, move, caster)
	if not target.is_alive():
		return
	var t_side := battle.get_side(target)
	var t_cell := battle.get_caster_cell(target)
	var pull_dx := -1 if side == Battle.SIDE_PLAYER else 1
	var new_x: int = t_cell.x + pull_dx
	var new_cell := Vector2i(new_x, t_cell.y)
	var blocked := new_x < 0 or new_x >= Battle.GRID_COLS
	if not blocked and battle.combatant_blocked_at(t_side, new_cell):
		blocked = true
	if blocked:
		target.take_damage(UNDERTOW_CRUSH_BONUS, move.move_type, "undertow_crush")
		_log(caster, "%s — %s crunches into the barrier (+%d)" % [move.display_name, target.display_name, UNDERTOW_CRUSH_BONUS])
		return
	battle.set_caster_cell(target, new_cell)
	var tw := battle.create_tween()
	tw.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_property(target, "global_position", battle.cell_to_world(t_side, new_cell), UNDERTOW_PULL_S)
	_log(caster, "%s — %s dragged a tile closer" % [move.display_name, target.display_name])

# Ripple Chain — 4 arcs of 10, each jumping to the NEAREST un-hit target
# within 3 tiles (enemy, ANY turret/decoy/walker, or you). Arcing into the
# caster heals 10 instead of damaging. The chain dissipates when nothing is
# in range.
static func _ripple_chain(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var dmg := _final_card_damage(move, caster)
	var start := battle.get_caster_cell(caster_c)
	var state := {
		"gx": _to_global_x(battle.get_side(caster_c), start.x),
		"y": start.y,
		"hit": [],
		"first": true,
	}
	var captured_battle: Battle = battle
	var tween := battle.create_tween()
	for i in range(RIPPLE_HOPS):
		tween.tween_interval(RIPPLE_HOP_S)
		tween.tween_callback(MoveRegistry._ripple_hop.bind(captured_battle, caster_c, dmg, state))
	_log(caster, "%s — the current seeks %d marks" % [move.display_name, RIPPLE_HOPS])

static func _ripple_hop(battle: Battle, caster: Combatant, dmg: int, state: Dictionary) -> void:
	if not is_instance_valid(battle) or not is_instance_valid(caster):
		return
	# Candidates: both fighters + every turret. The caster is fair game after
	# the first arc (heals instead); nothing repeats.
	var best = null
	var best_dist := RIPPLE_RANGE + 1
	var candidates: Array = []
	for c in [battle._player, battle._enemy]:
		if c != null and is_instance_valid(c) and c.is_alive():
			candidates.append(c)
	for t in battle._turrets:
		if t != null and is_instance_valid(t):
			candidates.append(t)
	for node in candidates:
		if state["hit"].has(node.get_instance_id()):
			continue
		if node == caster and state["first"]:
			continue
		var n_gx: int
		var n_y: int
		if node is Combatant:
			var n_cell: Vector2i = battle.get_caster_cell(node)
			n_gx = _to_global_x(battle.get_side(node), n_cell.x)
			n_y = n_cell.y
		else:
			n_gx = _to_global_x(node.grid_side, node.cell.x)
			n_y = node.cell.y
		var dist: int = absi(n_gx - int(state["gx"])) + absi(n_y - int(state["y"]))
		if dist <= RIPPLE_RANGE and dist < best_dist and dist > 0:
			best = node
			best_dist = dist
	state["first"] = false
	if best == null:
		return  # dissipates
	state["hit"].append(best.get_instance_id())
	var world: Vector3 = best.global_position
	_spawn_punch(battle, world, battle.get_side(caster) == Battle.SIDE_ENEMY)
	if best is Combatant:
		var bc: Combatant = best
		var b_cell: Vector2i = battle.get_caster_cell(bc)
		state["gx"] = _to_global_x(battle.get_side(bc), b_cell.x)
		state["y"] = b_cell.y
		if bc == caster:
			bc.heal(RIPPLE_HEAL)
		else:
			bc.take_damage(dmg, "water", "ripple_chain")
	else:
		state["gx"] = _to_global_x(best.grid_side, best.cell.x)
		state["y"] = best.cell.y
		best.take_damage(dmg, caster)

# Glacial Step — freeze your cell AND the enemy's current cell (4s frozen
# tiles, slip on entry), then blink to a random free cell in your COLUMN.
static func _glacial_step(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var side := battle.get_side(caster_c)
	var ccell := battle.get_caster_cell(caster_c)
	battle.spawn_tile(caster_c, side, ccell, "frozen_tile", GLACIAL_ICE_MS, false)
	var opp: Combatant = battle.get_opponent(caster_c)
	if opp != null and opp.is_alive():
		battle.spawn_tile(caster_c, battle.get_side(opp), battle.get_caster_cell(opp), "frozen_tile", GLACIAL_ICE_MS, false)
	var options: Array = []
	for y in range(Battle.GRID_ROWS):
		if y == ccell.y:
			continue
		var cell := Vector2i(ccell.x, y)
		if battle.combatant_blocked_at(side, cell):
			continue
		if battle.combatant_at(side, cell) != null:
			continue
		options.append(cell)
	if options.is_empty():
		_log(caster, "%s — ice laid, but the column is packed (no blink)" % move.display_name)
		return
	var dest_cell: Vector2i = options.pick_random()
	_spawn_teleport_flash(battle, caster_c.global_position)
	battle.set_caster_cell(caster_c, dest_cell)
	caster_c.global_position = battle.cell_to_world(side, dest_cell)
	_spawn_teleport_flash(battle, caster_c.global_position)
	_log(caster, "%s — ice laid, blinked along the column" % move.display_name)

# Tidal Read — mark the cell 4 ahead (clamps closer at the world edge).
# Exactly 7s later it detonates: 85 + 1s stun to whoever stands there.
# Nobody home = 3 mana back.
static func _tidal_read(move: MoveDef, caster, battle: Battle) -> void:
	var side := battle.get_side(caster)
	var ccell := battle.get_caster_cell(caster)
	var depth := 4
	var info := _project_forward(side, ccell, depth)
	while info.is_empty() and depth > 1:
		depth -= 1
		info = _project_forward(side, ccell, depth)
	if info.is_empty():
		caster.gain_mana(1)
		_log(caster, "%s — no water ahead (1 mana refund)" % move.display_name)
		return
	var m_side: String = info["side"]
	var m_cell := Vector2i(int(info["x"]), ccell.y)
	_spawn_hammer_warning(battle, battle.cell_to_world(m_side, m_cell), TIDAL_READ_FUSE_S)
	var captured_caster: Combatant = caster
	var captured_move: MoveDef = move
	var captured_battle: Battle = battle
	var t := battle.create_tween()
	t.tween_interval(TIDAL_READ_FUSE_S)
	t.tween_callback(func() -> void:
		if not is_instance_valid(captured_battle) or not is_instance_valid(captured_caster):
			return
		_spawn_punch(captured_battle, captured_battle.cell_to_world(m_side, m_cell), captured_battle.get_side(captured_caster) == Battle.SIDE_ENEMY)
		var victim := captured_battle.combatant_at(m_side, m_cell)
		if victim != null and victim.is_alive():
			var dmg := _final_card_damage(captured_move, captured_caster)
			if dmg > 0:
				victim.take_damage(dmg, captured_move.move_type, "tidal_read")
			if victim.is_alive():
				victim.apply_stun(TIDAL_READ_STUN_MS, captured_caster)
		else:
			captured_caster.gain_mana(TIDAL_READ_REFUND)
			_log(captured_caster, "Tidal Read missed — %d mana returned" % TIDAL_READ_REFUND)
	)
	_log(caster, "%s — the tide is read: detonation in %.0fs" % [move.display_name, TIDAL_READ_FUSE_S])

# Cascade Lock — flood the enemy grid's 4 corners for 5s. Any non-owner
# entering a flooded corner is shunted 1 random cell. Steals movement, not
# health.
static func _cascade_lock(move: MoveDef, caster, battle: Battle) -> void:
	var opp: Combatant = battle.get_opponent(caster)
	if opp == null:
		return
	var t_side := battle.get_side(opp)
	var corners: Array = [
		Vector2i(0, 0),
		Vector2i(0, Battle.GRID_ROWS - 1),
		Vector2i(Battle.GRID_COLS - 1, 0),
		Vector2i(Battle.GRID_COLS - 1, Battle.GRID_ROWS - 1),
	]
	for i in range(corners.size()):
		var corner: Vector2i = corners[i]
		battle.spawn_tile(caster, t_side, corner, "flood_tile", CASCADE_MS, false)
	_log(caster, "%s — the corners flood (5s)" % move.display_name)

# === DRAKECHO STARTER CARDS (mon battle grid_starters.xlsx sheet 2, monster E) ===

const STATIC_TICK_WINDOW_MS := 3000
const STATIC_TICK_COMBO_DAMAGE := 40
const REWIND_WINDOW_MS := 4000
const OVERCLOCK_MS := 5000
const OVERCLOCK_LOCKOUT_MS := 6000
const OVERCLOCK_FACTOR := 3.0
const THOUGHTSIPHON_DRAIN := 3
const THOUGHTSIPHON_STARVED_DAMAGE := 45
const THOUGHTSIPHON_STUN_MS := 2000
const CHRONO_FUSE_S := 8.0

# Static Tick — 1-mana row zap: a fast electric bolt down your row for 15.
# If you played 2 OTHER cards within the last 3s, it spikes to 40 (the
# current cast isn't in the history yet — the post-play hook appends after).
static func _static_tick(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var now := Time.get_ticks_msec()
	var recent := 0
	for i in range(caster_c.card_played_times.size()):
		if now - int(caster_c.card_played_times[i]) <= STATIC_TICK_WINDOW_MS:
			recent += 1
	var base := move.damage
	if recent >= 2:
		base = STATIC_TICK_COMBO_DAMAGE
	var dmg := 0
	if not caster_c.roll_blind_miss():
		dmg = maxi(1, int(round(float(base) \
			* TraitRegistry.damage_dealt_mult(caster_c.traits) \
			* TraitRegistry.card_mult(caster_c.traits, move.move_type) \
			* caster_c.buff_damage_dealt_mult_for_card(move.move_type))))
	var dir := Vector3.RIGHT if battle.get_side(caster_c) == Battle.SIDE_PLAYER else Vector3.LEFT
	battle.spawn_card_bullet(caster_c, dir, dmg, 20.0, false, "static_tick")
	_log(caster, "%s — %s" % [move.display_name, "COMBO 40!" if recent >= 2 else "15 zap"])

# Rewind Fork — record your tile + HP; RETURN lands on key 3 for 4s: snap
# back to the tile (if it's still free) and restore HP UP TO the recorded
# value (never self-damages).
static func _rewind_fork(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	battle._rewinds[caster_c.get_instance_id()] = {
		"side": battle.get_side(caster_c),
		"cell": battle.get_caster_cell(caster_c),
		"hp": caster_c.hp,
	}
	var ret := MoveDef.new()
	ret.id = "rewind_return"
	ret.display_name = "Return"
	ret.move_type = "time"
	ret.mana_cost = 2
	ret.description = "Snap back to the recorded tile and restore HP to the recorded value."
	ret.effect_id = "rewind_return"
	caster_c.grant_bonus_card(ret)
	var captured_battle: Battle = battle
	var t := battle.create_tween()
	t.tween_interval(float(REWIND_WINDOW_MS) / 1000.0)
	t.tween_callback(func() -> void:
		if not is_instance_valid(caster_c):
			return
		if caster_c.bonus_card != null and caster_c.bonus_card.effect_id == "rewind_return":
			caster_c.clear_bonus_card()
			captured_battle._rewinds.erase(caster_c.get_instance_id())
			_log(caster_c, "Rewind Fork — the moment passes")
	)
	_log(caster, "%s — moment recorded (RETURN on [3], 4s)" % move.display_name)

static func _rewind_return(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var state = battle._rewinds.get(caster_c.get_instance_id())
	battle._rewinds.erase(caster_c.get_instance_id())
	if state == null:
		_log(caster, "%s — nothing recorded" % move.display_name)
		return
	var r_side: String = state["side"]
	var r_cell: Vector2i = state["cell"]
	# Snap back only if the cell is still free (walls/turrets may have claimed
	# it; if the caster never moved, combatant_at finds themselves — no snap
	# needed, the heal still lands).
	if not battle.combatant_blocked_at(r_side, r_cell) \
			and battle.combatant_at(r_side, r_cell) == null \
			and battle.turret_at_cell(r_side, r_cell) == null:
		_spawn_teleport_flash(battle, caster_c.global_position)
		battle.set_caster_cell(caster_c, r_cell)
		caster_c.global_position = battle.cell_to_world(r_side, r_cell)
		_spawn_teleport_flash(battle, caster_c.global_position)
	var target_hp: int = int(state["hp"])
	if target_hp > caster_c.hp:
		caster_c.heal(target_hp - caster_c.hp)
	_log(caster, "%s — snapped back" % move.display_name)

# Overclock — 5s of 3x mana regen, then the crash: 6s self-silence.
static func _overclock(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	caster_c.mana_boost_factor = OVERCLOCK_FACTOR
	caster_c.mana_boost_until_ms = maxi(caster_c.mana_boost_until_ms, Time.get_ticks_msec() + OVERCLOCK_MS)
	var halo := _make_buff_halo(Color(0.95, 0.85, 0.20))
	caster_c.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	var t := battle.create_tween()
	t.tween_interval(float(OVERCLOCK_MS) / 1000.0)
	t.tween_callback(func() -> void:
		if is_instance_valid(halo):
			halo.queue_free()
		if not is_instance_valid(caster_c) or not caster_c.is_alive():
			return
		caster_c.mana_boost_factor = 2.0
		caster_c.apply_silence(OVERCLOCK_LOCKOUT_MS)
		_log(caster_c, "Overclock burnout — cards locked 6s")
	)
	_log(caster, "%s — mana x3 for 5s… then the crash" % move.display_name)

# Thoughtsiphon — psychic reach (wall-ignoring, hits wherever they stand):
# target with 3+ mana → 20 + drain 3 (Essence Drinker pays out); a
# mana-starved target instead takes 45 + a 2s stun.
static func _thoughtsiphon(move: MoveDef, caster, battle: Battle) -> void:
	var caster_c: Combatant = caster
	var opp: Combatant = battle.get_opponent(caster_c)
	if opp == null or not opp.is_alive():
		return
	_spawn_punch(battle, opp.global_position, battle.get_side(caster) == Battle.SIDE_ENEMY)
	var starved := opp.mana < THOUGHTSIPHON_DRAIN
	var base := THOUGHTSIPHON_STARVED_DAMAGE if starved else move.damage
	var dmg := 0
	if not caster_c.roll_blind_miss():
		dmg = maxi(1, int(round(float(base) \
			* TraitRegistry.damage_dealt_mult(caster_c.traits) \
			* TraitRegistry.card_mult(caster_c.traits, move.move_type) \
			* caster_c.buff_damage_dealt_mult_for_card(move.move_type))))
	if dmg > 0:
		opp.take_damage(dmg, move.move_type, "thoughtsiphon")
	if starved:
		if opp.is_alive():
			opp.apply_stun(THOUGHTSIPHON_STUN_MS, caster_c)
		_log(caster, "%s — mind runs dry: %d + 2s stun" % [move.display_name, dmg])
	else:
		battle.steal_mana(caster_c, opp, THOUGHTSIPHON_DRAIN)
		_log(caster, "%s — %d + %d mana drained" % [move.display_name, dmg, THOUGHTSIPHON_DRAIN])

# Chronofracture — a bomb with a VISIBLE 8s countdown on the enemy's
# cast-time cell: 80 centre + 40 on the cardinals, and you heal 50% of
# everything it actually deals.
static func _chronofracture(move: MoveDef, caster, battle: Battle) -> void:
	var opp: Combatant = battle.get_opponent(caster)
	if opp == null:
		return
	var b_side := battle.get_side(opp)
	var b_cell := battle.get_caster_cell(opp)
	var world := battle.cell_to_world(b_side, b_cell)
	_spawn_hammer_warning(battle, world, CHRONO_FUSE_S)
	var label := Label3D.new()
	label.text = str(int(CHRONO_FUSE_S))
	label.font_size = 96
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = Color(0.80, 0.60, 1.00)
	label.outline_size = 12
	battle.spawn_world_fx(label)
	label.global_position = world + Vector3(0.0, 1.6, 0.0)
	var t := battle.create_tween()
	for i in range(int(CHRONO_FUSE_S)):
		var remaining := int(CHRONO_FUSE_S) - i - 1
		t.tween_interval(1.0)
		t.tween_callback(func() -> void:
			if is_instance_valid(label):
				label.text = str(maxi(remaining, 0))
		)
	t.tween_callback(MoveRegistry._chrono_detonate.bind(move, caster, battle, b_side, b_cell, label))
	_log(caster, "%s — the countdown is public: %.0fs" % [move.display_name, CHRONO_FUSE_S])

static func _chrono_detonate(move: MoveDef, caster, battle: Battle, side: String, cell: Vector2i, label: Label3D) -> void:
	if is_instance_valid(label):
		label.queue_free()
	if not is_instance_valid(battle):
		return
	var caster_c: Combatant = caster
	if caster_c == null or not is_instance_valid(caster_c):
		return
	var center_dmg := _final_card_damage(move, caster)
	var ring_dmg := int(round(float(center_dmg) / 2.0))
	var total := 0
	_spawn_punch(battle, battle.cell_to_world(side, cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
	var victim := battle.combatant_at(side, cell)
	if victim != null and victim.is_alive() and center_dmg > 0:
		total += victim.take_damage(center_dmg, move.move_type, "chronofracture")
	var cardinals: Array = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	for i in range(cardinals.size()):
		var off: Vector2i = cardinals[i]
		var ring_cell := cell + off
		if ring_cell.x < 0 or ring_cell.x >= Battle.GRID_COLS or ring_cell.y < 0 or ring_cell.y >= Battle.GRID_ROWS:
			continue
		_spawn_punch(battle, battle.cell_to_world(side, ring_cell), battle.get_side(caster) == Battle.SIDE_ENEMY)
		var ring_victim := battle.combatant_at(side, ring_cell)
		if ring_victim != null and ring_victim.is_alive() and ring_dmg > 0:
			total += ring_victim.take_damage(ring_dmg, move.move_type, "chronofracture")
	if total > 0 and caster_c.is_alive():
		caster_c.heal(int(round(float(total) * 0.5)))
		_log(caster_c, "Chronofracture — %d dealt, %d drunk back" % [total, int(round(float(total) * 0.5))])
