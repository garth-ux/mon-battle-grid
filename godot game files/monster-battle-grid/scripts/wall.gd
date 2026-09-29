class_name Wall
extends Node3D

# A placed block / wall. Lives on a specific (grid_side, cell) and absorbs
# incoming bullets. Owner's bullets pass through (friendly fire skipped).
# When destroyed, the bullet's shooter is the "destroyer" — that's who gets
# the heal_on_block_break trait bonus (matches React's Demolitionist semantics).

signal destroyed(owner_combatant: Combatant, destroyer: Combatant)

@export var max_hp: int = 1
@export var hp: int = 1
@export var owner_combatant: Combatant = null
@export var grid_side: String = ""
@export var cell: Vector2i = Vector2i.ZERO
# Team of the owner ("player" / "enemy"). Used by bullets for friendly-fire
# checks — separate from grid_side because a wall placed on the opponent's
# grid (Pixie call_family scenario) still belongs to its caster's team.
@export var owner_side: String = ""
# Auto-despawn after lifetime_ms milliseconds. 0 = infinite (default).
# Used by hex_tiles "block" roll so the spawned block self-clears.
@export var lifetime_ms: int = 0

const FLASH_DURATION := 0.18
const FLASH_EMISSION_PEAK := 6.0

@onready var _mesh: MeshInstance3D = _find_mesh()
var _flash_time: float = 0.0
var _flash_rest_energy: float = 0.0
var _elapsed_ms: int = 0

# The visual: either a direct "Mesh" child (code-built boulders) or the
# MeshInstance3D nested inside the instanced blocks.glb (user block art).
func _find_mesh() -> MeshInstance3D:
	var direct := get_node_or_null("Mesh")
	if direct is MeshInstance3D:
		return direct
	for child in find_children("*", "MeshInstance3D", true, false):
		return child
	return null

func _ready() -> void:
	add_to_group("walls")
	hp = max_hp
	# Duplicate the materials so per-wall flash/tint doesn't bleed across
	# instances. Boulders keep their code-built material_override; the GLB
	# block gets per-surface duplicates (2 textured surfaces) with emission
	# enabled so the damage flash can glow over the texture.
	if _mesh != null:
		if _mesh.material_override != null:
			_mesh.material_override = _mesh.material_override.duplicate()
		else:
			for s in range(_mesh.get_surface_override_material_count()):
				var mat := _mesh.get_active_material(s) as StandardMaterial3D
				if mat != null:
					var dup := mat.duplicate() as StandardMaterial3D
					dup.emission_enabled = true
					if not mat.emission_enabled:
						dup.emission = Color(1.0, 0.85, 0.55)
					dup.emission_energy_multiplier = 0.0
					_mesh.set_surface_override_material(s, dup)
		var m0 := _mesh.get_active_material(0) as StandardMaterial3D
		if m0 != null:
			_flash_rest_energy = m0.emission_energy_multiplier

func take_damage(amount: int = 1, destroyer: Combatant = null) -> void:
	if hp <= 0:
		return
	hp = maxi(0, hp - amount)
	_flash_time = FLASH_DURATION
	if hp == 0:
		destroyed.emit(owner_combatant, destroyer)
		queue_free()

# Visual tint for signature walls (Aegis Pillar purple) — applied to this
# wall's duplicated materials so shared wall scenes stay untouched. On the
# textured GLB block the tint MULTIPLIES the texture (purple stone).
func set_tint(color: Color) -> void:
	if _mesh == null:
		return
	for s in range(maxi(1, _mesh.get_surface_override_material_count())):
		var mat := _mesh.get_active_material(s) as StandardMaterial3D
		if mat != null:
			mat.albedo_color = color
			if mat.emission_enabled:
				mat.emission = color

func _process(delta: float) -> void:
	if _flash_time > 0.0 and _mesh != null:
		_flash_time = maxf(0.0, _flash_time - delta)
		var ft := _flash_time / FLASH_DURATION
		for s in range(maxi(1, _mesh.get_surface_override_material_count())):
			var mat := _mesh.get_active_material(s) as StandardMaterial3D
			if mat != null:
				mat.emission_energy_multiplier = _flash_rest_energy + ft * (FLASH_EMISSION_PEAK - _flash_rest_energy)
	if lifetime_ms > 0:
		_elapsed_ms += int(delta * 1000.0)
		if _elapsed_ms >= lifetime_ms:
			queue_free()
