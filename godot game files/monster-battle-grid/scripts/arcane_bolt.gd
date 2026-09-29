class_name ArcaneBolt
extends Node3D

# Modizard's Arcane Bolt (user redesign) — a chasing arcane bomb.
#
# Spawns 1 cell forward of the caster and re-aims EVERY step toward the
# opponent's current cell: one cardinal step per 0.6s, preferring the axis
# with the larger distance. Walls/boulders block a step — it detours along
# the other axis, or stalls the step when both are blocked. It is NOT
# shootable and NOT wall-registered: kiting is the only counterplay.
#
# Detonates when:
#   - it shares a cell with the opponent (100ms contact poll), or
#   - its 5s lifespan expires (wherever it is).
# Blast: center_damage to the combatant on its cell + SPLASH_DAMAGE to the
# 4 cardinal neighbors (combatants only, both sides — walls are unaffected,
# consistent with it being blocked by them). Fizzles quietly if the target
# dies first.

const STEP_S := 0.6
const STEP_TWEEN_S := 0.25
const LIFESPAN_MS := 5000
const CONTACT_POLL_MS := 100
const SPLASH_DAMAGE := 5
const HOVER_Y := 0.8

var battle_ref: Battle = null
var owner_combatant: Combatant = null
var center_damage: int = 50
var damage_type: String = "water"
var grid_side: String = ""
var cell: Vector2i = Vector2i.ZERO

var _spent := false
var _elapsed_ms := 0
var _poll_ms := 0
var _step_timer := 0.0
var _stepping := false
var _orb: MeshInstance3D = null

static func build(owner_c: Combatant, center_dmg: int, dmg_type: String) -> ArcaneBolt:
	var bolt := ArcaneBolt.new()
	bolt.name = "ArcaneBolt"
	bolt.owner_combatant = owner_c
	bolt.center_damage = center_dmg
	bolt.damage_type = dmg_type
	return bolt

func _ready() -> void:
	_orb = MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.35
	sphere.height = 0.7
	_orb.mesh = sphere
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.45, 0.55, 1.0, 0.9)
	mat.emission_enabled = true
	mat.emission = Color(0.55, 0.45, 1.0)
	mat.emission_energy_multiplier = 3.5
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_orb.material_override = mat
	_orb.position = Vector3(0.0, HOVER_Y, 0.0)
	add_child(_orb)
	# Menacing pulse.
	var pulse := _orb.create_tween().set_loops()
	pulse.tween_property(_orb, "scale", Vector3.ONE * 1.25, 0.3).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(_orb, "scale", Vector3.ONE * 0.9, 0.3).set_trans(Tween.TRANS_SINE)

func _target() -> Combatant:
	if not is_instance_valid(battle_ref) or not is_instance_valid(owner_combatant):
		return null
	return battle_ref.get_opponent(owner_combatant)

func _process(delta: float) -> void:
	if _spent or not is_instance_valid(battle_ref):
		return
	_elapsed_ms += int(delta * 1000.0)
	if _elapsed_ms >= LIFESPAN_MS:
		detonate()
		return
	# Contact poll — catches both "bolt stepped onto them" and "they walked
	# onto the bolt".
	_poll_ms += int(delta * 1000.0)
	if _poll_ms >= CONTACT_POLL_MS:
		_poll_ms = 0
		var victim := _target()
		if victim != null and victim.is_alive():
			if battle_ref.get_side(victim) == grid_side and battle_ref.get_caster_cell(victim) == cell:
				detonate()
				return
	if not _stepping:
		_step_timer += delta
		if _step_timer >= STEP_S:
			_step_timer = 0.0
			_try_step()

func _try_step() -> void:
	var victim := _target()
	if victim == null or not victim.is_alive():
		_fizzle()
		return
	var my_gx := MoveRegistry._to_global_x(grid_side, cell.x)
	var t_side: String = battle_ref.get_side(victim)
	var t_cell: Vector2i = battle_ref.get_caster_cell(victim)
	# Clamp handles the zone-steal phantom cell (x = GRID_COLS).
	var t_gx := MoveRegistry._to_global_x(t_side, clampi(t_cell.x, 0, Battle.GRID_COLS - 1))
	var dgx := t_gx - my_gx
	var dgy := t_cell.y - cell.y
	if dgx == 0 and dgy == 0:
		detonate()
		return
	# Candidate steps: primary axis (larger delta) first, then the other.
	var candidates: Array = []
	if absi(dgx) >= absi(dgy):
		if dgx != 0:
			candidates.append(Vector2i(signi(dgx), 0))
		if dgy != 0:
			candidates.append(Vector2i(0, signi(dgy)))
	else:
		if dgy != 0:
			candidates.append(Vector2i(0, signi(dgy)))
		if dgx != 0:
			candidates.append(Vector2i(signi(dgx), 0))
	for i in range(candidates.size()):
		var step: Vector2i = candidates[i]
		var next_gx := my_gx + step.x
		var next_y := cell.y + step.y
		if next_gx < 0 or next_gx >= Battle.GRID_COLS * 2:
			continue
		if next_y < 0 or next_y >= Battle.GRID_ROWS:
			continue
		var info: Dictionary = MoveRegistry._split_global_x(next_gx)
		var n_side: String = info["side"]
		var n_cell := Vector2i(int(info["x"]), next_y)
		if battle_ref.wall_at_cell(n_side, n_cell) != null:
			continue  # blocked — detour to the other axis
		_step_to(n_side, n_cell)
		return
	# Both axes blocked — stall this step and re-aim next tick.

func _step_to(n_side: String, n_cell: Vector2i) -> void:
	grid_side = n_side
	cell = n_cell
	_stepping = true
	var dest: Vector3 = battle_ref.cell_to_world(n_side, n_cell)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(self, "global_position", dest, STEP_TWEEN_S)
	tween.tween_callback(func() -> void: _stepping = false)

func detonate() -> void:
	if _spent:
		return
	_spent = true
	var b: Battle = battle_ref
	if not is_instance_valid(b):
		queue_free()
		return
	MoveRegistry._spawn_explosion_at(b, global_position, 1.7)
	# Center — full damage to whoever stands on the bolt's cell.
	var center_victim := b.combatant_at(grid_side, cell)
	if center_victim != null and center_victim.is_alive():
		center_victim.take_damage(center_damage, damage_type, "arcane_bolt")
	# Splash — 4 cardinals, combatants only, both sides.
	var gx := MoveRegistry._to_global_x(grid_side, cell.x)
	for dy in range(-1, 2, 2):
		var ny: int = cell.y + dy
		if ny < 0 or ny >= Battle.GRID_ROWS:
			continue
		_splash_cell(b, grid_side, Vector2i(cell.x, ny))
	for dgx in range(-1, 2, 2):
		var info: Dictionary = MoveRegistry._split_global_x(gx + dgx)
		if info.is_empty():
			continue
		var i_side: String = info["side"]
		_splash_cell(b, i_side, Vector2i(int(info["x"]), cell.y))
	queue_free()

func _splash_cell(b: Battle, side: String, c: Vector2i) -> void:
	MoveRegistry._spawn_explosion_at(b, b.cell_to_world(side, c), 0.8)
	var victim := b.combatant_at(side, c)
	if victim != null and victim.is_alive():
		victim.take_damage(SPLASH_DAMAGE, damage_type, "arcane_bolt_splash")

func _fizzle() -> void:
	_spent = true
	queue_free()
