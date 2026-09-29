class_name TimedEffect
extends Node3D

# A persistent ground tile that applies a per-tick effect to combatants
# standing on its cell. Lifetime + tick cadence in milliseconds.
#
# Owner-relative effects (heal_font, poison_trap, vamp_mist) check the
# occupant against owner_combatant: heal_font heals only the owner;
# poison_trap / vamp_mist damage anyone OTHER than the owner.

signal expired(effect_id: String, owner_combatant: Combatant)

@export var effect_id: String = ""
@export var lifetime_ms: int = 3000
# Immolation Point: the tile hurts its own caster too (burn_tile only).
@export var harms_owner: bool = false
@export var tick_period_ms: int = 1000
@export var owner_combatant: Combatant = null
@export var grid_side: String = ""
@export var cell: Vector2i = Vector2i.ZERO
# Custom damage hook for contact_bomb (set externally by MoveRegistry).
# Other effect types use their per-tick constants instead.
@export var tick_damage: int = 0

# Damage values applied per tick. Static defaults match React's tile mechanics
# (App3D.tsx: holy/heal ≈ 3 HP, poison ≈ 1 DMG, vamp ≈ 2 DMG).
const HEAL_TICK := 3
const VAMP_TICK := 3
const VAMP_HEAL := 2
const ACID_TICK := 2
# Poison-trap combo values (React poisontrap, App3D.tsx:7352-7355): on first
# contact deal 10 DMG, stun for ~3.4s, apply poison for ~5.6s.
const POISON_TRAP_DAMAGE := 10
const POISON_TRAP_STUN_MS := 0560
const POISON_TRAP_POISON_MS := 5600
const POISON_TRAP_POISON_DOT := 1
# Hogglin vine_snare — 10 DMG + ~3.4s stun on contact (no poison).
const VINE_SNARE_DAMAGE := 10
const VINE_SNARE_STUN_MS := 3360
# Mushroom silence_bomb — 10 DMG + ~3s silence on contact.
const SILENCE_BOMB_DAMAGE := 10
const SILENCE_BOMB_SILENCE_MS := 3000
const POISON_ABSORB_HEAL_PER_TILE := 10
# Contact bomb polls 10×/sec so step-on detonation feels snappy.
const CONTACT_BOMB_TICK_MS := 100
# poison_trap ALSO polls fast since it's contact-trigger like a mine.
const POISON_TRAP_TICK_MS := 100
# Hex Tiles family — contact-trigger tiles share the snappy 100ms poll.
# burn_tile is per-tick DoT (acid_pool sibling) so uses its own tick period.
const BURN_TICK := 2
const BURN_TICK_PERIOD_MS := 1000
const STUN_TILE_STUN_MS := 1000
# Atomippo Crushing Field — pressure DoT applied to non-owner combatants
# standing on the column directly in front of the stolen tiles. 5 DMG per
# second for the field's duration.
const GRAVITY_FIELD_TICK := 5
# Dandeox starter cards.
const SEED_ARM_MS := 3000       # dormant before this; armed until expiry (6s)
const SEED_ROOT_MS := 2000
const SEED_HEAL := 25
const CREEP_TICK := 5           # creeping_vine dark DoT per second
# Giant's tile-steal basic — enemy standing on a stolen tile ticks this.
const STOLEN_TILE_TICK := 2

var _battle: Battle = null
var _elapsed_ms: int = 0
var _next_tick_ms: int = 0
var _visual_mat: StandardMaterial3D = null
var _seed_armed: bool = false

func _ready() -> void:
	add_to_group("tiles")
	# Contact-triggered tiles (bomb, poison combo trap) poll fast for snappy
	# step-on detection. Hex Tiles family adds frozen + stun tiles, also fast.
	if effect_id in ["contact_bomb", "poison_trap", "vine_snare", "silence_bomb", "frozen_tile", "stun_tile", "seed_trap", "flood_tile"]:
		tick_period_ms = CONTACT_BOMB_TICK_MS
	elif effect_id == "burn_tile":
		tick_period_ms = BURN_TICK_PERIOD_MS
	_next_tick_ms = tick_period_ms  # first tick at +1 period, not on spawn frame
	_build_visual()

func bind_battle(battle: Battle) -> void:
	_battle = battle

func _process(delta: float) -> void:
	_elapsed_ms += int(delta * 1000.0)
	# Seedbind arming flash — the dormant seed lights up when it goes live.
	if effect_id == "seed_trap" and not _seed_armed and _elapsed_ms >= SEED_ARM_MS and _visual_mat != null:
		_seed_armed = true
		_visual_mat.albedo_color = Color(0.55, 0.95, 0.35, 0.65)
		_visual_mat.emission = Color(0.50, 0.90, 0.30)
		_visual_mat.emission_energy_multiplier = 3.2
	if _elapsed_ms >= _next_tick_ms:
		_on_tick()
		_next_tick_ms = _elapsed_ms + tick_period_ms
	if _elapsed_ms >= lifetime_ms:
		expired.emit(effect_id, owner_combatant)
		queue_free()

func _on_tick() -> void:
	if _battle == null:
		return
	var occupant := _battle.combatant_at(grid_side, cell)
	if occupant == null or not occupant.is_alive():
		return
	match effect_id:
		"holy_tile":
			occupant.heal(HEAL_TICK)
		"heal_font":
			if occupant == owner_combatant:
				occupant.heal(HEAL_TICK)
		"blessed_tile":
			# Sanctified Ground (Gozo): heals the OWNER standing inside; the
			# 30% damage reduction lives in Combatant.take_damage (positional
			# read) and the 45-damage clear in Battle's damaged listener.
			if occupant == owner_combatant:
				occupant.heal(HEAL_TICK)
		"seed_trap":
			# Seedbind (Dandeox): dormant for SEED_ARM_MS, then the first
			# non-owner standing on it is ROOTED and the owner drinks deep.
			if occupant != owner_combatant and _elapsed_ms >= SEED_ARM_MS:
				occupant.apply_root(SEED_ROOT_MS)
				if is_instance_valid(owner_combatant) and owner_combatant.is_alive():
					owner_combatant.heal(SEED_HEAL)
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()
		"creeping_vine":
			# Creeping Row (Dandeox): gravity-well stickiness (movement gate
			# lives in Battle._is_gravity_tile_at) + a dark DoT.
			if occupant != owner_combatant:
				occupant.take_damage(CREEP_TICK, "dark", "%s_creep" % _owner_name())
		"flood_tile":
			# Cascade Lock (Klawr): flooded ground — a non-owner standing here
			# is shunted 1 random free cell. Non-consuming; if every exit is
			# blocked they simply stay put until one opens.
			if occupant != owner_combatant:
				_apply_flood_shunt(occupant)
		"poison_trap":
			# React-accurate combo: 10 DMG + ~3.4s stun + ~5.6s poison DoT,
			# then trap consumes itself. Mushroom poison-absorb mode INVERTS:
			# tile heals POISON_ABSORB_HEAL_PER_TILE instead of damaging.
			if occupant != owner_combatant:
				if occupant.is_poison_absorbing():
					occupant.heal(POISON_ABSORB_HEAL_PER_TILE)
				else:
					occupant.take_damage(POISON_TRAP_DAMAGE, "earth", "%s_poison_trap" % _owner_name())
					if occupant.is_alive():
						occupant.apply_stun(POISON_TRAP_STUN_MS, owner_combatant)
						occupant.apply_poison(POISON_TRAP_POISON_MS, POISON_TRAP_POISON_DOT, "%s_poison_trap" % _owner_name())
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()
		"vamp_mist":
			if occupant != owner_combatant:
				var dealt := occupant.take_damage(VAMP_TICK, "dark", "%s_vamp_mist" % _owner_name())
				if dealt > 0 and is_instance_valid(owner_combatant):
					owner_combatant.heal(VAMP_HEAL)
		"acid_pool":
			if occupant != owner_combatant:
				if occupant.is_poison_absorbing():
					# Absorb-mode: heal + consume the tile so it's cleared from
					# the field. Matches Mushroom absorb_poison intent.
					occupant.heal(POISON_ABSORB_HEAL_PER_TILE)
					_spawn_self_explosion()
					expired.emit(effect_id, owner_combatant)
					queue_free()
				elif TraitRegistry.heal_on_poison(occupant.traits):
					# Brine Body / Poison Drinker — poisoned ground heals the
					# holder instead of damaging (tile stays down).
					occupant.heal(ACID_TICK)
				else:
					occupant.take_damage(ACID_TICK, "earth", "%s_dissolve" % _owner_name())
		"silence_bomb":
			if occupant != owner_combatant:
				occupant.take_damage(SILENCE_BOMB_DAMAGE, "dark", "%s_silence_bomb" % _owner_name())
				if occupant.is_alive():
					occupant.apply_silence(SILENCE_BOMB_SILENCE_MS)
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()
		"contact_bomb":
			if occupant != owner_combatant:
				var bomb_dmg := tick_damage if tick_damage > 0 else 40
				occupant.take_damage(bomb_dmg, "dark", "%s_bomb" % _owner_name())
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()
		"vine_snare":
			if occupant != owner_combatant:
				occupant.take_damage(VINE_SNARE_DAMAGE, "grass", "%s_vine_snare" % _owner_name())
				if occupant.is_alive():
					occupant.apply_stun(VINE_SNARE_STUN_MS, owner_combatant)
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()
		"burn_tile":
			# Fire-typed DoT (acid_pool sibling). Owner immune so caster can
			# walk through their own hex without burning — unless harms_owner
			# (Kindlekit's Immolation Point burns its caster deliberately).
			# Explosive Skin's burn_immune buff stands here for free.
			if (occupant != owner_combatant or harms_owner) and not occupant.is_burn_immune():
				occupant.take_damage(BURN_TICK, "fire", "%s_burn" % _owner_name())
		"gravity_field":
			# Atomippo Crushing Field pressure column. Mind-typed DoT, owner
			# immune so caster can stand under it without taking damage (the
			# field expresses on opp's territory).
			if occupant != owner_combatant:
				occupant.take_damage(GRAVITY_FIELD_TICK, "mind", "%s_gravity_field" % _owner_name())
		"stolen_tile":
			# Giant's basic (mons.xlsx yammie): claimed ground — anyone can
			# stand here, but the enemy ticks a small DoT while they do.
			if occupant != owner_combatant:
				occupant.take_damage(STOLEN_TILE_TICK, "earth", "%s_stolen_tile" % _owner_name())
		"frozen_tile":
			# Slip the victim 1 cell along their last_move_direction. The ice
			# PERSISTS (user rule, July 2026): every frozen tile lives out its
			# full ~4s lifetime and can slip the same victim again — slips
			# never consume it. Frozen-immune combatants (Scimark Water
			# Breathing) pass through without slip.
			if occupant != owner_combatant and not occupant.is_frozen_immune():
				_apply_frozen_slip(occupant)
		"stun_tile":
			# Brief stun, no damage, single-trigger. Lightest of the stun tiles.
			if occupant != owner_combatant:
				occupant.apply_stun(STUN_TILE_STUN_MS, owner_combatant)
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()

# Apply this tile's effect to a combatant who passes through it (without
# standing for a full tick). Used by lasso pull-back path. Returns true if
# the tile should despawn after triggering (e.g. contact_bomb detonates and
# consumes itself).
func trigger_for(victim: Combatant) -> bool:
	if not is_instance_valid(victim) or victim == owner_combatant:
		return false
	if not victim.is_alive():
		return false
	match effect_id:
		"poison_trap":
			if victim.is_poison_absorbing():
				victim.heal(POISON_ABSORB_HEAL_PER_TILE)
			else:
				victim.take_damage(POISON_TRAP_DAMAGE, "earth", "%s_drag_trap" % _owner_name())
				if victim.is_alive():
					victim.apply_stun(POISON_TRAP_STUN_MS, owner_combatant)
					victim.apply_poison(POISON_TRAP_POISON_MS, POISON_TRAP_POISON_DOT, "%s_drag_trap" % _owner_name())
			_spawn_self_explosion()
			expired.emit(effect_id, owner_combatant)
			queue_free()
			return true
		"vine_snare":
			victim.take_damage(VINE_SNARE_DAMAGE, "grass", "%s_drag_vine" % _owner_name())
			if victim.is_alive():
				victim.apply_stun(VINE_SNARE_STUN_MS, owner_combatant)
			_spawn_self_explosion()
			expired.emit(effect_id, owner_combatant)
			queue_free()
			return true
		"acid_pool":
			if TraitRegistry.heal_on_poison(victim.traits):
				victim.heal(ACID_TICK)
			else:
				victim.take_damage(ACID_TICK, "earth", "%s_drag" % _owner_name())
		"seed_trap":
			if _elapsed_ms >= SEED_ARM_MS:
				victim.apply_root(SEED_ROOT_MS)
				if is_instance_valid(owner_combatant) and owner_combatant.is_alive():
					owner_combatant.heal(SEED_HEAL)
				_spawn_self_explosion()
				expired.emit(effect_id, owner_combatant)
				queue_free()
				return true
		"creeping_vine":
			victim.take_damage(CREEP_TICK, "dark", "%s_drag_creep" % _owner_name())
		"flood_tile":
			_apply_flood_shunt(victim)
		"vamp_mist":
			var dealt := victim.take_damage(VAMP_TICK, "dark", "%s_drag" % _owner_name())
			if dealt > 0 and is_instance_valid(owner_combatant):
				owner_combatant.heal(VAMP_HEAL)
		"contact_bomb":
			var bomb_dmg := tick_damage if tick_damage > 0 else 40
			victim.take_damage(bomb_dmg, "dark", "%s_bomb" % _owner_name())
			_spawn_self_explosion()
			expired.emit(effect_id, owner_combatant)
			queue_free()
			return true
		"burn_tile":
			victim.take_damage(BURN_TICK, "fire", "%s_drag_burn" % _owner_name())
		"frozen_tile":
			if victim.is_frozen_immune():
				return false  # passes through
			_apply_frozen_slip(victim)
			return false  # persistent ice — slips but stays down
		"stun_tile":
			victim.apply_stun(STUN_TILE_STUN_MS, owner_combatant)
			_spawn_self_explosion()
			expired.emit(effect_id, owner_combatant)
			queue_free()
			return true
	return false

# Slip a combatant 1 cell along their last move direction. Skips if no
# direction recorded yet or if the slip target is out of bounds / blocked by
# a wall. Used by frozen_tile contact + drag triggers.
# Shunt a combatant 1 cell in a random free direction (Cascade Lock flood).
# Non-consuming: the tile stays, and set_caster_cell records the shunt as
# their last_move_direction so ice chains can slide them further.
func _apply_flood_shunt(victim: Combatant) -> void:
	if _battle == null:
		return
	var side := _battle.get_side(victim)
	if side.is_empty():
		return
	var current := _battle.get_caster_cell(victim)
	var dirs: Array = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	dirs.shuffle()
	for i in range(dirs.size()):
		var dir: Vector2i = dirs[i]
		var target := current + dir
		if target.x < 0 or target.x >= Battle.GRID_COLS:
			continue
		if target.y < 0 or target.y >= Battle.GRID_ROWS:
			continue
		if _battle.combatant_blocked_at(side, target):
			continue
		if _battle.combatant_at(side, target) != null:
			continue
		_battle.set_caster_cell(victim, target)
		var tw := _battle.create_tween()
		tw.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
		tw.tween_property(victim, "global_position", _battle.cell_to_world(side, target), 0.18)
		return

func _apply_frozen_slip(victim: Combatant) -> void:
	if _battle == null:
		return
	var dir: Vector2i = victim.last_move_direction
	if dir == Vector2i.ZERO:
		return
	# Slip is on the same grid the victim currently occupies.
	var slip_side := _battle.get_side(victim)
	if slip_side.is_empty():
		return
	var current := _battle.get_caster_cell(victim)
	var target := current + dir
	if target.x < 0 or target.x >= Battle.GRID_COLS:
		return
	if target.y < 0 or target.y >= Battle.GRID_ROWS:
		return
	# Walls and broken tiles halt the slide. Friendly walls block too —
	# they're physical regardless of owner.
	if _battle.combatant_blocked_at(slip_side, target):
		return
	var dest := _battle.cell_to_world(slip_side, target)
	_battle.set_caster_cell(victim, target)
	var tween := victim.create_tween()
	tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tween.tween_property(victim, "global_position", dest, 0.18)

func _owner_name() -> String:
	if is_instance_valid(owner_combatant):
		return owner_combatant.display_name.to_lower()
	return "tile"

# Contact-bomb detonation burst. Parented to tile so it inherits the cell pos;
# despawns itself after a short fade.
func _spawn_self_explosion() -> void:
	if _battle == null:
		return
	var burst := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.7
	sphere.height = 1.4
	burst.mesh = sphere
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = Color(1.0, 0.55, 0.20, 0.85)
	bmat.emission_enabled = true
	bmat.emission = Color(1.0, 0.45, 0.10)
	bmat.emission_energy_multiplier = 4.0
	bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	burst.material_override = bmat
	_battle.spawn_world_fx(burst)
	burst.global_position = global_position + Vector3(0.0, 0.6, 0.0)
	burst.scale = Vector3.ONE * 0.4
	var tween := burst.create_tween().set_parallel(true)
	tween.tween_property(burst, "scale", Vector3.ONE * 1.4, 0.4)
	tween.tween_property(bmat, "albedo_color:a", 0.0, 0.4)
	tween.chain().tween_callback(burst.queue_free)

# Colored disc on the ground. Color encodes the effect family so players read
# threat vs. boon at a glance: gold/green = healing, sickly green/violet = harm.
func _build_visual() -> void:
	var mesh := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(2.1, 2.1)
	mesh.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.emission_enabled = true
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	match effect_id:
		"holy_tile":
			mat.albedo_color = Color(1.0, 0.92, 0.45, 0.55)
			mat.emission = Color(1.0, 0.85, 0.30)
		"blessed_tile":
			mat.albedo_color = Color(1.0, 0.98, 0.75, 0.50)
			mat.emission = Color(1.0, 0.95, 0.55)
		"heal_font":
			mat.albedo_color = Color(0.45, 0.95, 0.55, 0.55)
			mat.emission = Color(0.30, 0.85, 0.40)
		"poison_trap":
			mat.albedo_color = Color(0.70, 0.85, 0.25, 0.55)
			mat.emission = Color(0.55, 0.75, 0.20)
		"vamp_mist":
			mat.albedo_color = Color(0.70, 0.30, 0.55, 0.55)
			mat.emission = Color(0.60, 0.20, 0.45)
		"contact_bomb":
			mat.albedo_color = Color(0.18, 0.08, 0.08, 0.75)
			mat.emission = Color(1.0, 0.20, 0.10)
		"acid_pool":
			mat.albedo_color = Color(0.45, 0.95, 0.20, 0.65)
			mat.emission = Color(0.35, 0.80, 0.15)
		"vine_snare":
			mat.albedo_color = Color(0.25, 0.65, 0.30, 0.65)
			mat.emission = Color(0.15, 0.55, 0.20)
		"silence_bomb":
			mat.albedo_color = Color(0.55, 0.30, 0.85, 0.75)
			mat.emission = Color(0.65, 0.35, 0.95)
		"frozen_tile":
			mat.albedo_color = Color(0.60, 0.85, 1.00, 0.70)  # icy cyan
			mat.emission = Color(0.50, 0.80, 1.00)
		"burn_tile":
			mat.albedo_color = Color(1.00, 0.45, 0.20, 0.70)  # ember orange
			mat.emission = Color(1.00, 0.40, 0.15)
		"stun_tile":
			mat.albedo_color = Color(1.00, 0.85, 0.30, 0.70)  # electric yellow
			mat.emission = Color(1.00, 0.80, 0.20)
		"broken_tile":
			# Dim grey base; the red X overlay (added below) carries the read.
			mat.albedo_color = Color(0.25, 0.20, 0.22, 0.55)
			mat.emission = Color(0.30, 0.20, 0.22)
		"gravity_field":
			# Purple-blue pressure haze, reads as gravity well.
			mat.albedo_color = Color(0.45, 0.30, 0.85, 0.65)
			mat.emission = Color(0.55, 0.40, 1.00)
		"gravity_well_tile":
			# Deep violet — gravity tile that doubles movement cost on the cell.
			# No tick action; the combatant gravity_pending toggle in Battle's
			# movement code reads the tile presence.
			mat.albedo_color = Color(0.30, 0.20, 0.55, 0.75)
			mat.emission = Color(0.65, 0.40, 1.00)
		"stolen_tile":
			# Giant's claimed ground — amber banner tint, walkable by anyone,
			# ticks the enemy while they stand on it.
			mat.albedo_color = Color(0.95, 0.70, 0.25, 0.60)
			mat.emission = Color(1.00, 0.65, 0.20)
		"seed_trap":
			# Seedbind — dormant moss green; brightens sharply when armed
			# (see _process arming check).
			mat.albedo_color = Color(0.32, 0.48, 0.22, 0.40)
			mat.emission = Color(0.28, 0.45, 0.18)
		"creeping_vine":
			# Creeping Row — bruised violet vines, sticky + draining.
			mat.albedo_color = Color(0.36, 0.20, 0.46, 0.60)
			mat.emission = Color(0.48, 0.26, 0.62)
		"flood_tile":
			# Cascade Lock — churning pale water, shunts whoever enters.
			mat.albedo_color = Color(0.35, 0.62, 0.95, 0.55)
			mat.emission = Color(0.30, 0.55, 0.95)
		_:
			mat.albedo_color = Color(0.70, 0.70, 0.75, 0.50)
			mat.emission = Color(0.50, 0.50, 0.55)
	mat.emission_energy_multiplier = 2.2
	mesh.material_override = mat
	_visual_mat = mat
	# Tilt the plane flat on the ground, just above terrain to avoid z-fighting.
	mesh.position = Vector3(0.0, -0.10, 0.0)
	add_child(mesh)
	# Gentle pulse on opacity as a "this is active" cue.
	var pulse := create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.30, 0.9).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.55, 0.9).set_trans(Tween.TRANS_SINE)
	# broken_tile gets a red X overlay so it reads as "do not cross" rather
	# than a colored zone. The base plane stays so the cell tinge is visible.
	if effect_id == "broken_tile":
		_build_broken_cross()
	# Bomb-family mines carry the user's pixel-art bomb (2-frame fuse
	# flicker) sitting on the tile, on top of the colored zone.
	if effect_id == "contact_bomb" or effect_id == "silence_bomb":
		var bomb_spr := MoveRegistry._make_fx_sprite(MoveRegistry.BOMB_FRAMES, 0.014)
		bomb_spr.position = Vector3(0.0, 0.32, 0.0)
		add_child(bomb_spr)
		var f0: Texture2D = MoveRegistry.BOMB_FRAMES[0]
		var f1: Texture2D = MoveRegistry.BOMB_FRAMES[1]
		var flick := bomb_spr.create_tween().set_loops()
		flick.tween_interval(MoveRegistry.BOMB_FLICKER_S)
		flick.tween_callback(func() -> void: bomb_spr.texture = f1)
		flick.tween_interval(MoveRegistry.BOMB_FLICKER_S)
		flick.tween_callback(func() -> void: bomb_spr.texture = f0)

func _build_broken_cross() -> void:
	for angle_deg in [45.0, -45.0]:
		var bar := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(1.7, 0.08, 0.22)
		bar.mesh = box
		var bmat := StandardMaterial3D.new()
		bmat.albedo_color = Color(0.95, 0.10, 0.15, 1.0)
		bmat.emission_enabled = true
		bmat.emission = Color(1.0, 0.20, 0.20)
		bmat.emission_energy_multiplier = 3.2
		bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bar.material_override = bmat
		bar.rotation = Vector3(0.0, deg_to_rad(angle_deg), 0.0)
		bar.position = Vector3(0.0, -0.04, 0.0)  # slightly above the base plane
		add_child(bar)
