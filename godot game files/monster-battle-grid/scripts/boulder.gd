class_name Boulder
extends Wall

# Giant's Boulder Roll — a slow rolling boulder that travels in a straight
# line down the caster's row across both grids.
#
# It extends Wall and registers in battle._walls so it blocks combatant
# movement and stops beams like a block, BUT it deliberately skips the
# "walls" group: bullets handle boulders through a dedicated "boulders"
# path with NO friendly-fire skip (shooting your own boulder to detonate it
# next to the enemy is intended tech) and REAL bullet damage.
#
# hp is a 20-point damage pool, not a wall hit-count. Damage sources that
# pass hit-counts (card wall-strikes call take_damage(1)) count as 10 per
# hit, so "two of anything" pops it — matching the design rule of
# "2 basic shots, or 20 damage".
#
# Deaths:
#   contact with a combatant → contact_damage strike, spent, NO explosion
#   damage pool emptied OR impact with a block → plus-blast explosion
#     (center + 4 cardinals, cross-grid aware): explosion_damage to ANY
#     fighter, removes blocks outright, chips other boulders (chain pops)
#   rolls off the far edge → fizzles quietly

const STEP_S := 0.45            # seconds per cell — slow menace
const IMPACT_NUDGE_S := 0.16    # short roll into a block's face before the boom
const HIT_NORMALIZE := 10       # one "hit-count" hit = this much pool damage

var battle_ref: Battle = null
var contact_damage: int = 30
var explosion_damage: int = 15
var dir: int = 1                # +1 rolls toward the enemy grid, -1 toward player
var _spent: bool = false

static func build(owner_c: Combatant, caster_side: String, contact_dmg: int, pool_hp: int, explosion_dmg: int) -> Boulder:
	var b := Boulder.new()
	b.name = "Boulder"
	b.owner_combatant = owner_c
	b.owner_side = caster_side
	b.max_hp = pool_hp
	b.hp = pool_hp
	b.contact_damage = contact_dmg
	b.explosion_damage = explosion_dmg
	# Child MUST be named "Mesh" so Wall's @onready $Mesh + flash logic bind.
	var mesh := MeshInstance3D.new()
	mesh.name = "Mesh"
	var sphere := SphereMesh.new()
	sphere.radius = 0.55
	sphere.height = 1.1
	mesh.mesh = sphere
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.46, 0.39, 0.31)
	mat.roughness = 0.95
	mat.emission_enabled = true
	mat.emission = Color(0.46, 0.39, 0.31)
	# Resting glow — Wall._ready captures this as the flash floor
	# (_flash_rest_energy), so hits still spike from here and settle back.
	mat.emission_energy_multiplier = 1.5
	mesh.material_override = mat
	mesh.position = Vector3(0.0, 0.55, 0.0)
	b.add_child(mesh)
	return b

func _ready() -> void:
	# Deliberately NOT calling super._ready(): boulders skip the "walls" group
	# (bullets use the dedicated boulders path), and build() already set hp +
	# a unique material instance.
	add_to_group("boulders")

func setup_at(side_v: String, cell_v: Vector2i, dir_v: int) -> void:
	grid_side = side_v
	cell = cell_v
	dir = dir_v

func begin_rolling() -> void:
	_plan_next_step()

func _plan_next_step() -> void:
	if _spent or not is_instance_valid(battle_ref):
		return
	var next_gx := MoveRegistry._to_global_x(grid_side, cell.x) + dir
	var next_info := MoveRegistry._split_global_x(next_gx)
	if next_info.is_empty():
		_fizzle()  # rolled off the far edge of the combined row
		return
	var n_side: String = next_info["side"]
	var n_cell := Vector2i(int(next_info["x"]), cell.y)
	# Block ahead → impact: nudge into its face, then detonate at our own
	# cell. The plus-blast reaches the block's cell and removes it.
	var ahead_wall := battle_ref.wall_at_cell(n_side, n_cell)
	if ahead_wall != null and ahead_wall != self:
		var face: Vector3 = global_position.lerp(battle_ref.cell_to_world(n_side, n_cell), 0.35)
		var nudge := create_tween()
		nudge.tween_property(self, "global_position", face, IMPACT_NUDGE_S)
		nudge.tween_callback(explode_at_current_cell)
		return
	# Free cell — reserve it now so movement blocking + beam stops track the
	# destination while we tween in.
	grid_side = n_side
	cell = n_cell
	var dest: Vector3 = battle_ref.cell_to_world(n_side, n_cell)
	var roll := create_tween()
	roll.tween_property(self, "global_position", dest, STEP_S)
	roll.parallel().tween_property(_mesh, "rotation:z", _mesh.rotation.z - TAU * 0.7 * float(dir), STEP_S)
	roll.tween_callback(_on_step_arrived)

func _on_step_arrived() -> void:
	if _spent or not is_instance_valid(battle_ref):
		return
	var victim := battle_ref.combatant_at(grid_side, cell)
	if victim != null:
		squash(victim)
		return
	_plan_next_step()

# Contact kill — full contact damage, boulder is spent, no explosion.
func squash(victim: Combatant) -> void:
	if _spent:
		return
	_spent = true
	victim.take_damage(contact_damage, "earth", "boulder_roll")
	if is_instance_valid(battle_ref):
		MoveRegistry._spawn_explosion_at(battle_ref, global_position, 1.1)
	_cleanup()

func take_damage(amount: int = 1, destroyer: Combatant = null) -> void:
	if _spent or hp <= 0:
		return
	# Bullets pass their real damage; card wall-strikes pass hit-counts (1).
	var dealt: int = HIT_NORMALIZE if amount <= 1 else amount
	hp = maxi(0, hp - dealt)
	_flash_time = FLASH_DURATION
	if hp == 0:
		explode_at_current_cell()

# Plus-blast: center + 4 cardinals (cross-grid aware). Hits BOTH fighters
# (friendly fire intended), removes blocks outright, chips other boulders.
func explode_at_current_cell() -> void:
	if _spent:
		return
	_spent = true
	if not is_instance_valid(battle_ref):
		_cleanup()
		return
	var b: Battle = battle_ref
	MoveRegistry._spawn_explosion_at(b, global_position, 1.6)
	var cells: Array = [{"side": grid_side, "cell": cell}]
	for dy in range(-1, 2, 2):  # -1, +1 — lateral neighbors stay on our grid
		var ny: int = cell.y + dy
		if ny >= 0 and ny < Battle.GRID_ROWS:
			cells.append({"side": grid_side, "cell": Vector2i(cell.x, ny)})
	var gx := MoveRegistry._to_global_x(grid_side, cell.x)
	for dgx in range(-1, 2, 2):  # -1, +1 — forward/back resolve across grids
		var info: Dictionary = MoveRegistry._split_global_x(gx + dgx)
		if not info.is_empty():
			var i_side: String = info["side"]
			cells.append({"side": i_side, "cell": Vector2i(int(info["x"]), cell.y)})
	for entry in cells:
		var e_side: String = entry["side"]
		var e_cell: Vector2i = entry["cell"]
		if not (e_side == grid_side and e_cell == cell):
			MoveRegistry._spawn_explosion_at(b, b.cell_to_world(e_side, e_cell), 1.1)
		# Blocks in the blast are removed outright; boulders chip (chain pop).
		var w := b.wall_at_cell(e_side, e_cell)
		if w != null and w != self:
			if w is Boulder:
				w.take_damage(explosion_damage, owner_combatant)
			else:
				w.take_damage(w.hp, owner_combatant)
		var victim := b.combatant_at(e_side, e_cell)
		if victim != null and victim.is_alive():
			victim.take_damage(explosion_damage, "earth", "boulder_blast")
	_cleanup()

func _fizzle() -> void:
	_spent = true
	_cleanup()

func _cleanup() -> void:
	if is_instance_valid(battle_ref):
		battle_ref._walls.erase(self)
	queue_free()
