class_name Player
extends Node3D

# Free-movement overworld player (was tile-stepped). Held keys move a
# velocity-based character with screen-relative controls (camera yaw baked
# in) and axis-separated footprint collision against the TileGrid — blocked
# tiles (water, trees, rocks/walls, cliffs over MAX_STEP) stop the matching
# axis so you slide along obstacles. The `arrived` signal still fires once
# per CELL entered, so the overworld's encounter roll is untouched: same
# 20%-per-grass-tile odds per distance travelled as the old step movement.
#
# Animations come from art/player/idle_*.png (7 frames) + run_*.png (4
# frames), extracted from the user's test GIFs. Art faces RIGHT natively;
# flip_h mirrors it for screen-left movement.

signal arrived(cell: Vector2i)

const SPEED := 4.6                 # m/s (old step pace was ~5.5)
const FOOT_RADIUS := 0.28          # footprint half-extent for corner probes
const MAX_STEP := 1.5              # climbable height between cells (old rule)
const CAMERA_YAW_DEG := -45.0      # must match overworld.gd YAW_DEG
# Effective input yaw — overworld shifts this by the same delta when a zone
# overrides the camera yaw (zone 4), so "up" stays up-screen everywhere.
var camera_yaw_deg: float = CAMERA_YAW_DEG
const GROUND_LERP := 14.0          # y smoothing toward the current tile top

var tile_grid: TileGrid
var current_cell: Vector2i = Vector2i.ZERO

@onready var _sprite: AnimatedSprite3D = $Sprite

func setup(grid: TileGrid, spawn_cell: Vector2i) -> void:
	tile_grid = grid
	current_cell = spawn_cell
	global_position = tile_grid.cell_to_world(spawn_cell)

func _physics_process(delta: float) -> void:
	if tile_grid == null:
		return
	# An open UI (mon menu) freezes movement — it registers as "ui_blocker".
	if get_tree().get_first_node_in_group("ui_blocker") != null:
		_play_anim(&"idle")
		return
	var input_vec := Vector2.ZERO
	if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D):
		input_vec.x += 1.0
	if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A):
		input_vec.x -= 1.0
	if Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S):
		input_vec.y += 1.0
	if Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W):
		input_vec.y -= 1.0
	if input_vec == Vector2.ZERO:
		_play_anim(&"idle")
		_settle_ground_y(delta)
		return
	input_vec = input_vec.normalized()
	# Screen-relative: rotate input by the camera yaw so pressing up walks
	# "up" on screen instead of along the diagonal world axis.
	var yaw := deg_to_rad(camera_yaw_deg)
	var dir3 := (Basis(Vector3.UP, yaw) * Vector3(input_vec.x, 0.0, input_vec.y)).normalized()
	var motion := dir3 * SPEED * delta
	# Axis-separated moves — a blocked axis cancels alone, so we slide.
	var pos := global_position
	var try_x := pos + Vector3(motion.x, 0.0, 0.0)
	if _can_stand(try_x):
		pos = try_x
	var try_z := pos + Vector3(0.0, 0.0, motion.z)
	if _can_stand(try_z):
		pos = try_z
	global_position = Vector3(pos.x, global_position.y, pos.z)
	_play_anim(&"run")
	if absf(input_vec.x) > 0.05:
		_sprite.flip_h = input_vec.x < 0.0
	# Cell-entry bookkeeping BEFORE ground settle so y tracks the new tile.
	var cell := tile_grid.world_to_cell(global_position)
	if cell != current_cell:
		current_cell = cell
		arrived.emit(cell)
	_settle_ground_y(delta)

func _play_anim(anim: StringName) -> void:
	if _sprite.animation != anim:
		_sprite.play(anim)

func _settle_ground_y(delta: float) -> void:
	var target_y := tile_grid.cell_to_world(current_cell).y
	global_position.y = lerpf(global_position.y, target_y, minf(1.0, GROUND_LERP * delta))

# All four footprint corners must land on walkable cells within a climbable
# step of the CURRENT cell — water/trees/rocks fail is_walkable, ledges fail
# the step check.
func _can_stand(pos: Vector3) -> bool:
	var cur_y := tile_grid.cell_to_world(current_cell).y
	for i in range(4):
		var ox := FOOT_RADIUS if i % 2 == 0 else -FOOT_RADIUS
		var oz := FOOT_RADIUS if i < 2 else -FOOT_RADIUS
		var c := tile_grid.world_to_cell(pos + Vector3(ox, 0.0, oz))
		if not tile_grid.is_walkable(c):
			return false
		if absf(tile_grid.cell_to_world(c).y - cur_y) > MAX_STEP:
			return false
	return true
