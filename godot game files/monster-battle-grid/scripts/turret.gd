class_name Turret
extends Node3D

# Auto-firing stationary entity summoned by call_family / fairy_ring cards.
# Lives on a specific (grid_side, cell), shoots toward the opposing side on
# a fixed interval, takes damage from hostile bullets, despawns at HP 0.
# Owner side determines friendly-fire (same as walls).

signal destroyed(owner_combatant: Combatant, destroyer)

@export var owner_combatant: Combatant = null
@export var grid_side: String = ""
@export var owner_side: String = ""  # team of owner (player/enemy), independent of grid_side
@export var cell: Vector2i = Vector2i.ZERO
@export var max_hp: int = 15
@export var hp: int = 15
@export var fire_interval_s: float = 0.5
@export var bullet_damage: int = 5
@export var bullet_type: String = ""        # bullet source_type for type-wheel
# Optional status applied by turret bullets (mushroom turrets use this).
@export var bullet_status_id: String = ""
@export var bullet_status_duration_ms: int = 0
@export var bullet_status_dot: int = 0
# Set > 0 to make this turret roam — every move_interval_s it picks a random
# adjacent cell on its current grid and tweens there. Used by Pixie's
# Call Soldier card.
@export var move_interval_s: float = 0.0
# Optional sprite override for the visual. When set, render a billboarded
# Sprite3D instead of the cone mesh. sprite_tint multiplies via modulate so
# you can re-tint the same texture per turret (Call Family vs Call Soldier).
@export var sprite_texture: Texture2D = null
@export var sprite_tint: Color = Color.WHITE
# Mushroom Fairy Ring walker: forward-only motion across both grids, drops a
# poison tile on every cell it leaves. Despawns at the far edge.
@export var forward_walker: bool = false
@export var drop_tile_on_step: String = ""
@export var drop_tile_lifetime_ms: int = 4000
# Street Swarm walker: 70% advance toward enemy, 30% random dx; random dy
# every step. Clamps to combined-row bounds (8 cells wide × 4 tall) and
# relies on lifetime_ms to despawn (rats wander, never march in unison).
@export var random_forward_walker: bool = false
# Spawn Tadpole walker: forward_walker that snaps its y to the opponent's
# current row each step (homing), and damages + dies on hostile walls.
# Mushroom Fairy Ring (plain forward_walker) ignores this flag so its
# behavior is unchanged.
@export var homing_to_opponent_y: bool = false
# Medical Mouse periodic tile drop: every tile_drop_interval_s, drop a tile
# of `drop_tile_on_step` type on the rat's CURRENT cell. Independent of
# movement — fires on its own timer. Used by support turrets that paint
# heal/holy patches as they roam.
@export var tile_drop_interval_s: float = 0.0
@export var fires_bullets: bool = true
# Suicide-walker mode (Lemmel rats). When contact_damage > 0, this entity
# damages any non-owner combatant standing on its cell + self-destructs.
# Checked on a 100ms poll so step-on detection feels snappy. lifetime_ms
# bounds total existence so wandering rats expire even if they never connect.
@export var contact_damage: int = 0
@export var contact_type: String = "dark"
@export var contact_label: String = "rat"
@export var lifetime_ms: int = 0
# Modizard guard turret — counted against the max-2 guard cap, and its
# bullets can siphon HP (Pickpockets trait) via bullet_steal_heal > 0.
@export var is_guard: bool = false
@export var bullet_steal_heal: int = 0
const MOVE_TWEEN_DURATION := 0.25
const CONTACT_POLL_MS := 100

const FLASH_DURATION := 0.18
const FLASH_EMISSION_PEAK := 6.0
const FLASH_EMISSION_BASE := 1.8

var _battle: Battle = null
var _fire_timer: float = 0.0
var _move_timer: float = 0.0
var _moving: bool = false
var _mesh: MeshInstance3D = null
var _mat: StandardMaterial3D = null
var _sprite: Sprite3D = null
var _sprite_base_modulate: Color = Color.WHITE
var _flash_time: float = 0.0
var _contact_poll_ms: int = 0
var _lifetime_elapsed_ms: int = 0
var _tile_drop_timer: float = 0.0

func _ready() -> void:
	add_to_group("turrets")
	hp = max_hp
	_build_visual()

func bind_battle(battle: Battle) -> void:
	_battle = battle

func _process(delta: float) -> void:
	if hp <= 0 or _battle == null:
		return
	if fires_bullets:
		_fire_timer += delta
		if _fire_timer >= fire_interval_s:
			_fire_timer = 0.0
			_fire()
	if move_interval_s > 0.0 and not _moving:
		_move_timer += delta
		if _move_timer >= move_interval_s:
			_move_timer = 0.0
			if random_forward_walker:
				_try_step_random_forward()
			elif forward_walker:
				_try_walk_forward()
			else:
				_try_move_random_adjacent()
	if _flash_time > 0.0:
		_flash_time = maxf(0.0, _flash_time - delta)
		var ft := _flash_time / FLASH_DURATION
		if _mat != null:
			_mat.emission_energy_multiplier = FLASH_EMISSION_BASE + ft * (FLASH_EMISSION_PEAK - FLASH_EMISSION_BASE)
		elif _sprite != null:
			# Sprite flash via modulate brightness boost.
			var b := 1.0 + ft * 2.0
			_sprite.modulate = Color(_sprite_base_modulate.r * b, _sprite_base_modulate.g * b, _sprite_base_modulate.b * b, _sprite_base_modulate.a)
	# Lifetime cap (wandering rats expire even without contact).
	if lifetime_ms > 0:
		_lifetime_elapsed_ms += int(delta * 1000.0)
		if _lifetime_elapsed_ms >= lifetime_ms:
			queue_free()
			return
	# Contact-damage poll. Detect combatant stepping onto our cell OR our
	# tween finishing on their cell.
	if contact_damage > 0:
		_contact_poll_ms += int(delta * 1000.0)
		if _contact_poll_ms >= CONTACT_POLL_MS:
			_contact_poll_ms = 0
			_check_contact()
	# Periodic tile drop on current cell (Medical Mouse holy_tile painter).
	if tile_drop_interval_s > 0.0 and drop_tile_on_step != "":
		_tile_drop_timer += delta
		if _tile_drop_timer >= tile_drop_interval_s:
			_tile_drop_timer = 0.0
			_drop_trail_tile(grid_side, cell)

func take_damage(amount: int, destroyer = null) -> void:
	if hp <= 0:
		return
	hp = maxi(0, hp - amount)
	_flash_time = FLASH_DURATION
	if hp == 0:
		destroyed.emit(owner_combatant, destroyer)
		queue_free()

# Suicide-walker: detect a non-owner combatant on our cell, deal contact damage,
# spawn a tiny burst, and queue_free. Called every 100ms from _process.
func _check_contact() -> void:
	if not is_instance_valid(_battle):
		return
	var occupant: Combatant = _battle.combatant_at(grid_side, cell)
	if occupant == null or occupant == owner_combatant or not occupant.is_alive():
		return
	var owner_name := "rat"
	if is_instance_valid(owner_combatant):
		owner_name = owner_combatant.display_name.to_lower()
	occupant.take_damage(contact_damage, contact_type, "%s_%s" % [owner_name, contact_label])
	_spawn_contact_burst()
	queue_free()

func _spawn_contact_burst() -> void:
	if _battle == null:
		return
	var burst := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.55
	sphere.height = 1.1
	burst.mesh = sphere
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = Color(0.95, 0.85, 0.50, 0.85)
	bmat.emission_enabled = true
	bmat.emission = Color(1.0, 0.70, 0.25)
	bmat.emission_energy_multiplier = 3.5
	bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	burst.material_override = bmat
	_battle.spawn_world_fx(burst)
	burst.global_position = global_position + Vector3(0.0, 0.55, 0.0)
	burst.scale = Vector3.ONE * 0.35
	var tween := burst.create_tween().set_parallel(true)
	tween.tween_property(burst, "scale", Vector3.ONE * 1.25, 0.35)
	tween.tween_property(bmat, "albedo_color:a", 0.0, 0.35)
	tween.chain().tween_callback(burst.queue_free)

func _fire() -> void:
	if not is_instance_valid(_battle):
		return
	var dir := Vector3.RIGHT if grid_side == Battle.SIDE_PLAYER else Vector3.LEFT
	_battle.spawn_turret_bullet(self, dir)

# Pick a random in-bounds adjacent cell on our current grid and tween there.
# Walls block movement; if no valid neighbor is found we just wait for the
# next tick. Stays within grid_side so the soldier doesn't accidentally
# wander onto the wrong field.
func _try_move_random_adjacent() -> void:
	var dirs: Array[Vector2i] = [
		Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)
	]
	dirs.shuffle()
	for d in dirs:
		var target := cell + d
		if target.x < 0 or target.x >= Battle.GRID_COLS:
			continue
		if target.y < 0 or target.y >= Battle.GRID_ROWS:
			continue
		if _battle.combatant_blocked_at(grid_side, target):
			continue
		cell = target
		_moving = true
		var dest := _battle.cell_to_world(grid_side, target)
		var tween := create_tween()
		tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tween.tween_property(self, "global_position", dest, MOVE_TWEEN_DURATION)
		tween.finished.connect(func() -> void: _moving = false)
		return

# Forward walker used by Fairy Ring mushrooms. Walks one cell toward the
# opponent each tick, crossing the grid boundary cleanly. Drops the
# `drop_tile_on_step` tile on the cell it's LEAVING so the trail covers the
# walker's path. Despawns at the far edge.
func _try_walk_forward() -> void:
	var dir_step := 1 if owner_side == Battle.SIDE_PLAYER else -1
	var global_x := cell.x if grid_side == Battle.SIDE_PLAYER else Battle.GRID_COLS + cell.x
	var prev_side := grid_side
	var prev_cell := cell
	global_x += dir_step
	if global_x < 0 or global_x >= Battle.GRID_COLS * 2:
		# Walked off the back of opponent's grid — leave a final trail tile + despawn.
		_drop_trail_tile(prev_side, prev_cell)
		queue_free()
		return
	var new_side: String
	var new_x: int
	if global_x < Battle.GRID_COLS:
		new_side = Battle.SIDE_PLAYER
		new_x = global_x
	else:
		new_side = Battle.SIDE_ENEMY
		new_x = global_x - Battle.GRID_COLS
	# Homing tadpole: snap y to opponent's current row each step.
	var new_y := cell.y
	if homing_to_opponent_y and is_instance_valid(owner_combatant):
		var opp: Combatant = _battle.get_opponent(owner_combatant)
		if opp != null and opp.is_alive():
			var opp_cell: Vector2i = _battle.get_caster_cell(opp)
			new_y = opp_cell.y
	# Hostile wall in our path: damage it + self-destruct. Only homing
	# walkers consult walls — plain forward_walker (Mushroom Fairy Ring)
	# is unchanged so it can still drop tiles through wall cells.
	if homing_to_opponent_y:
		var blocking_wall := _battle.wall_at_cell(new_side, Vector2i(new_x, new_y))
		if blocking_wall != null and blocking_wall.owner_combatant != owner_combatant:
			blocking_wall.take_damage(contact_damage if contact_damage > 0 else 10, owner_combatant)
			_spawn_contact_burst()
			queue_free()
			return
	# Blocks stop plain forward walkers too (user amend) — the walker stalls
	# in place until the path clears. Homing walkers were handled above (they
	# damage the wall and die); this guards mushroom soldiers etc.
	if _battle.combatant_blocked_at(new_side, Vector2i(new_x, new_y)):
		return
	# Trail tile gets dropped before we move so it sits on the cell we leave.
	_drop_trail_tile(prev_side, prev_cell)
	grid_side = new_side
	cell = Vector2i(new_x, new_y)
	_moving = true
	var dest := _battle.cell_to_world(new_side, cell)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(self, "global_position", dest, MOVE_TWEEN_DURATION)
	tween.finished.connect(func() -> void: _moving = false)

func _drop_trail_tile(side: String, c: Vector2i) -> void:
	if drop_tile_on_step == "" or _battle == null:
		return
	_battle.spawn_tile(owner_combatant, side, c, drop_tile_on_step, drop_tile_lifetime_ms, false)

# Street Swarm walker. Each step: 70% bias toward opponent, 30% random dx;
# always a random dy in [-1, +1]. Crosses the grid boundary cleanly and
# clamps within the combined 8-cell row (rat lingers near the far edge
# until lifetime_ms expires). Walls block the step (skipped, retry next tick).
func _try_step_random_forward() -> void:
	var dir_step := 1 if owner_side == Battle.SIDE_PLAYER else -1
	var dx: int
	if randf() < 0.7:
		dx = dir_step
	else:
		dx = (randi() % 3) - 1  # -1, 0, +1
	var dy := (randi() % 3) - 1  # -1, 0, +1
	var global_x := cell.x if grid_side == Battle.SIDE_PLAYER else Battle.GRID_COLS + cell.x
	global_x = clampi(global_x + dx, 0, Battle.GRID_COLS * 2 - 1)
	var new_y := clampi(cell.y + dy, 0, Battle.GRID_ROWS - 1)
	var new_side: String
	var new_x: int
	if global_x < Battle.GRID_COLS:
		new_side = Battle.SIDE_PLAYER
		new_x = global_x
	else:
		new_side = Battle.SIDE_ENEMY
		new_x = global_x - Battle.GRID_COLS
	# Hostile wall, broken_tile, or friendly wall stops the step.
	# Friendly walls block too (we don't want rats stacking on owner walls).
	var target := Vector2i(new_x, new_y)
	if _battle.combatant_blocked_at(new_side, target):
		return
	# Drop trail tile on the cell we're LEAVING (Poison Swarm poison_trap trail).
	# Skip if step is in-place — avoids re-spawning a tile on the same cell.
	if target != cell or new_side != grid_side:
		_drop_trail_tile(grid_side, cell)
	grid_side = new_side
	cell = target
	_moving = true
	var dest := _battle.cell_to_world(new_side, target)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(self, "global_position", dest, MOVE_TWEEN_DURATION)
	tween.finished.connect(func() -> void: _moving = false)

func _build_visual() -> void:
	if sprite_texture != null:
		_build_sprite_visual()
	else:
		_build_cone_visual()

func _build_sprite_visual() -> void:
	_sprite = Sprite3D.new()
	_sprite.texture = sprite_texture
	_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_sprite.pixel_size = 0.025  # matches Combatant sprite sizing
	_sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_OPAQUE_PREPASS
	_sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	_sprite_base_modulate = sprite_tint
	_sprite.modulate = sprite_tint
	_sprite.position = Vector3(0.0, 0.55, 0.0)
	add_child(_sprite)

func _build_cone_visual() -> void:
	_mesh = MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.15
	cone.bottom_radius = 0.45
	cone.height = 1.1
	_mesh.mesh = cone
	_mat = StandardMaterial3D.new()
	# Color encodes ownership so player can read at a glance.
	var tint: Color
	if grid_side == Battle.SIDE_PLAYER:
		tint = Color(0.40, 0.70, 1.00)
	else:
		tint = Color(1.00, 0.45, 0.45)
	_mat.albedo_color = tint
	_mat.emission_enabled = true
	_mat.emission = Color(tint.r * 0.9, tint.g * 0.9, tint.b * 0.9)
	_mat.emission_energy_multiplier = FLASH_EMISSION_BASE
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mesh.material_override = _mat
	_mesh.position = Vector3(0.0, 0.55, 0.0)
	add_child(_mesh)
