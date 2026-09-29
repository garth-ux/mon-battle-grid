class_name Bullet
extends Node3D

const HIT_RADIUS := 0.7
const WALL_HIT_RADIUS := 0.95           # walls are bigger than mons → wider catch zone
const WALL_MESH_OFFSET := Vector3(0.0, 0.7, 0.0)  # wall.tscn mesh sits at +0.7 Y
const TURRET_HIT_RADIUS := 0.80         # cone-sized, between mon and wall
const TURRET_MESH_OFFSET := Vector3(0.0, 0.55, 0.0)
const BOULDER_HIT_RADIUS := 0.90        # big rock, generous catch zone
const BOULDER_MESH_OFFSET := Vector3(0.0, 0.55, 0.0)  # sphere center sits at +0.55 Y
const MAX_LIFETIME := 4.0

var direction: Vector3 = Vector3.RIGHT
var speed: float = 13.0
var damage: int = 12
var source_type: String = ""
var source_label: String = "basic"
# ignore can be a Combatant OR a Turret — the actual shooter that this bullet
# came from, so it doesn't immediately self-hit. owner_side broadens that to
# friendly-fire: a player-owned turret shooting past the player should not
# damage them, and vice versa.
var ignore: Node = null
var owner_side: String = ""
var battle: Battle = null
# Optional status applied on combatant hit (mushroom turret bullets, etc.).
var status_id: String = ""
var status_duration_ms: int = 0
var status_dot: int = 0
# Lunapra ricochet: bullet reverses direction once when it sails past the
# opposing grid's far edge, getting a second pass at hitting the enemy.
var is_ricochet: bool = false
var _bounced: bool = false
const RICOCHET_BOUNCE_X := 10.5  # past enemy grid back (x_max ≈ 9.25)
# Malipole charged-bullet: flag set at fire time. On combatant hit, increments
# the combo counter on the shooter; at threshold Battle applies Frog Chorus
# frenzy. Walls/turrets do NOT count — only combatant hits.
var is_charged: bool = false
# Pickpockets (Modizard guards): on combatant hit, siphon steal_heal HP back
# to steal_beneficiary. Set by Battle.spawn_turret_bullet from the turret.
var steal_heal: int = 0
var steal_beneficiary: Combatant = null
# True only for basic-attack shots (set by Battle._basic_fire_bullet). On
# combatant hit, feeds Battle.on_basic_hit — combo heals, Extended Lunge,
# Toadazer charge stacks. Card/turret bullets never count.
var is_basic: bool = false
# Droopider's Sleepnosis basic — phases through walls & structures entirely
# (no damage to them, no stopping), reaching the combatant behind.
var pierce_walls: bool = false
# Basic-attack variants (mons.xlsx pass), set by Battle._basic_fire_bullet:
# Dragone drain_shot — heal the shooter for dealt × drain_ratio (2.0 latched).
var drain_ratio: float = 0.0
# Icage ice_spike — steer toward this node while flying.
var homing_target: Node3D = null
const HOMING_TURN := 3.2  # radians/sec steering cap
# Icage ice_spike — 50% chance to freeze a tile at the far edge on a miss.
var freeze_on_miss: bool = false
var _miss_handled: bool = false
const MISS_EDGE_X := 10.2
# Cargot scrap_shot — landing a combatant hit builds a block in front of the
# shooter (Battle.on_scrap_hit).
var build_block_on_hit: bool = false
# Atomippo warp_shot — a hit teleports the victim to a random tile.
var warp_on_hit: bool = false

var _elapsed: float = 0.0
var _hit: bool = false

# Tracer sprite (art/battle art/bullet-sprite.png) points RIGHT — flip when
# travelling left. Checked per-frame so ricochet reversals + homing turns
# stay correct without touching those sites.
@onready var _sprite: Sprite3D = get_node_or_null("Sprite")

func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed > MAX_LIFETIME:
		_handle_miss()
		queue_free()
		return
	if _sprite != null:
		var facing_left := direction.x < 0.0
		if _sprite.flip_h != facing_left:
			_sprite.flip_h = facing_left
	# Ice-spike homing: steer horizontally toward the target.
	if homing_target != null and is_instance_valid(homing_target):
		var to_target := homing_target.global_position - global_position
		to_target.y = 0.0
		if to_target.length() > 0.05:
			direction = direction.slerp(to_target.normalized(), minf(1.0, HOMING_TURN * delta)).normalized()
	position += direction * speed * delta
	if freeze_on_miss and not _miss_handled and absf(global_position.x) > MISS_EDGE_X:
		_handle_miss()
		queue_free()
		return
	if _hit:
		return
	# Ricochet bounce — flip direction once when bullet exits the far side
	# of the opposing grid. After bouncing it travels back through the row
	# for a second chance at hitting.
	if is_ricochet and not _bounced:
		if direction.x > 0.0 and global_position.x > RICOCHET_BOUNCE_X:
			direction = -direction
			_bounced = true
		elif direction.x < 0.0 and global_position.x < -RICOCHET_BOUNCE_X:
			direction = -direction
			_bounced = true
	# Rolling boulders (Giant) — damageable by ANYONE's bullets, no friendly
	# skip: shooting your own boulder to detonate it next to the enemy is
	# intended tech. Takes the bullet's REAL damage (20-point pool), unlike
	# walls' 1-per-hit model.
	for bo in get_tree().get_nodes_in_group("boulders"):
		var boulder := bo as Boulder
		if boulder == null or boulder.hp <= 0:
			continue
		var boulder_hit_pos := boulder.global_position + BOULDER_MESH_OFFSET
		if global_position.distance_to(boulder_hit_pos) <= BOULDER_HIT_RADIUS:
			boulder.take_damage(damage, _shooter_combatant())
			_hit = true
			queue_free()
			return
	# Walls first — they sit between shooter and target. Friendly walls (same
	# owner side as shooter) pass through so you don't shoot through your own
	# block. Compare to mesh-center (root + offset) not root — root sits at
	# floor level so vertical offset narrows the horizontal window.
	# pierce_walls bullets (Droopider) skip this block entirely.
	for w in ([] if pierce_walls else get_tree().get_nodes_in_group("walls")):
		var wall := w as Wall
		if wall == null:
			continue
		if _is_friendly_wall(wall):
			continue
		var wall_hit_pos := wall.global_position + WALL_MESH_OFFSET
		if global_position.distance_to(wall_hit_pos) <= WALL_HIT_RADIUS:
			wall.take_damage(1, _shooter_combatant())
			_hit = true
			queue_free()
			return
	# Turrets second — between walls and mons spatially, and they can be
	# damaged by enemy bullets. Friendly-fire skip via owner side.
	for t in get_tree().get_nodes_in_group("turrets"):
		var turret := t as Turret
		if turret == null or turret == ignore or turret.hp <= 0:
			continue
		if _is_friendly_turret(turret):
			continue
		var turret_hit_pos := turret.global_position + TURRET_MESH_OFFSET
		if global_position.distance_to(turret_hit_pos) <= TURRET_HIT_RADIUS:
			turret.take_damage(damage, _shooter_combatant())
			_hit = true
			queue_free()
			return
	for c in get_tree().get_nodes_in_group("combatants"):
		var combatant := c as Combatant
		if combatant == null or combatant == ignore or not combatant.is_alive():
			continue
		if _is_friendly_combatant(combatant):
			continue
		if combatant.is_vanished():
			continue  # Vanish (Giant) — intangible to bullets; they sail through
		if global_position.distance_to(combatant.global_position) <= HIT_RADIUS:
			# Thorn shield reactive defense — block + fire retaliation back at
			# the shooter (Hogglin's thorn_shield card).
			if combatant.thorn_shield_active:
				combatant.consume_thorn_shield()
				combatant.blocked.emit("thorn_shield")
				if battle != null and is_instance_valid(ignore):
					battle.spawn_thorn_retaliation(combatant, ignore as Node3D)
				_hit = true
				queue_free()
				return
			var dealt := combatant.take_damage(damage, source_type, source_label)
			# Dragone drain_shot — feed the shooter.
			if drain_ratio > 0.0 and dealt > 0:
				var drinker := _shooter_combatant()
				if drinker != null and drinker.is_alive():
					drinker.heal(int(round(float(dealt) * drain_ratio)))
			# Cargot scrap_shot — landing a hit builds a block in front.
			if build_block_on_hit and battle != null:
				var builder := _shooter_combatant()
				if builder != null:
					battle.on_scrap_hit(builder)
			# Atomippo warp_shot — the hit scrambles the victim's position.
			if warp_on_hit and battle != null and combatant.is_alive():
				battle.on_warp_hit(combatant)
			# Status rider — applied after damage if target survives.
			if status_id != "" and status_duration_ms > 0 and combatant.is_alive():
				if status_id == "stun":
					combatant.apply_stun(status_duration_ms, _shooter_combatant())
				elif status_id == "poison":
					combatant.apply_poison(status_duration_ms, maxi(status_dot, 1), source_label)
				elif status_id == "root":
					combatant.apply_root(status_duration_ms)
				elif status_id == "blind":
					combatant.apply_blind(status_duration_ms)
				elif status_id == "burn":
					combatant.apply_burn(status_duration_ms, maxi(status_dot, 1), source_label)
			# Charged-bullet combo: credit the shooter. Battle handles threshold.
			if is_charged and battle != null:
				var shooter := ignore as Combatant
				if shooter != null and is_instance_valid(shooter):
					battle.on_charged_hit(shooter)
			# Pickpockets: guard bullets siphon HP back to their owner.
			if steal_heal > 0 and steal_beneficiary != null and is_instance_valid(steal_beneficiary) and steal_beneficiary.is_alive():
				steal_beneficiary.heal(steal_heal)
			# Basic-hit traits: combo heals, Extended Lunge, Toadazer charge.
			if is_basic and battle != null:
				var basic_shooter := _shooter_combatant()
				if basic_shooter != null:
					battle.on_basic_hit(basic_shooter, combatant)
			_hit = true
			queue_free()
			return

# Ice-spike miss: 50% chance to freeze a tile at the far edge of the row the
# spike sailed out of. Battle picks the nearest row for our exit z.
func _handle_miss() -> void:
	if not freeze_on_miss or _miss_handled or _hit or battle == null:
		return
	_miss_handled = true
	if randf() < 0.5:
		battle.on_ice_spike_miss(_shooter_combatant(), global_position)

# The shooter as a Combatant, or null — guards against passing a freed
# Turret/Combatant into typed `destroyer: Combatant` params (Wall, Boulder).
# A turret can die while its last bullet is still in flight; the dangling
# ref then fails Godot's typed-argument check and hard-crashes (seen with
# Modizard guards shooting an En Garde wall).
func _shooter_combatant() -> Combatant:
	if ignore == null or not is_instance_valid(ignore):
		return null
	return ignore as Combatant

func _is_friendly_wall(wall: Wall) -> bool:
	if wall.owner_combatant == ignore:
		return true
	if owner_side != "" and wall.owner_side == owner_side:
		return true
	return false

func _is_friendly_turret(turret: Turret) -> bool:
	if turret.owner_combatant == ignore:
		return true
	if owner_side != "" and turret.owner_side == owner_side:
		return true
	return false

func _is_friendly_combatant(combatant: Combatant) -> bool:
	if owner_side == "" or battle == null:
		return false
	return battle.get_side(combatant) == owner_side
