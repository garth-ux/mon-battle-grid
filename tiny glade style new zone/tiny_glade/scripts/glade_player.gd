class_name GladePlayer
extends CharacterBody3D

# Overworld player for the Tiny Glade zone. Same sprite, speed and controls as
# the main game's player.gd (WASD / arrows, screen-relative, flip_h for
# left), but physics-driven instead of TileGrid-stepped: it walks on the real
# terrain mesh, climbs the bridge ramps, bumps into walls / trunks / rocks and
# can wade into the pond up to `max_wade_depth` (the opaque water hides the
# submerged part of the sprite, so it reads as wading). The zone script reads
# `in_water` / `wade_depth` / `is_moving()` to spawn water ripples.

const SPEED := 4.6
const GRAVITY := 20.0
const WADE_SLOWDOWN := 0.55        # speed multiplier at full wade depth

@export var water_level := -0.6
@export var max_wade_depth := 0.45
## Walkable rectangle (world XZ): x = min x, y = min z, w/h = size.
@export var bounds := Rect2(-24.0, -26.0, 46.0, 40.0)

var camera: Camera3D
var in_water := false
var wade_depth := 0.0
## Set by the zone's --walk-test capture mode; overrides keyboard input.
var scripted_input := Vector2.ZERO

@onready var _sprite: AnimatedSprite3D = $Sprite


func _physics_process(delta: float) -> void:
	var input_vec := scripted_input
	if input_vec == Vector2.ZERO:
		if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D):
			input_vec.x += 1.0
		if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A):
			input_vec.x -= 1.0
		if Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S):
			input_vec.y += 1.0
		if Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W):
			input_vec.y -= 1.0
	var dir := Vector3.ZERO
	if input_vec != Vector2.ZERO and camera:
		input_vec = input_vec.normalized()
		# screen-relative: "up" walks away from the camera along the ground
		var fwd := -camera.global_basis.z
		fwd.y = 0.0
		var right := camera.global_basis.x
		right.y = 0.0
		dir = (right.normalized() * input_vec.x - fwd.normalized() * input_vec.y).normalized()
		if absf(input_vec.x) > 0.05:
			_sprite.flip_h = input_vec.x < 0.0

	wade_depth = water_level - global_position.y
	in_water = wade_depth > -0.02
	var speed := SPEED
	if in_water:
		speed *= lerpf(1.0, WADE_SLOWDOWN, clampf(wade_depth / max_wade_depth, 0.0, 1.0))
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed
	velocity.y = velocity.y - GRAVITY * delta if not is_on_floor() else -1.0

	var before := global_position
	move_and_slide()
	# too deep, or outside the play area -> undo the horizontal step (slide on the edge)
	var p := global_position
	if water_level - p.y > max_wade_depth or not bounds.has_point(Vector2(p.x, p.z)):
		global_position = before
		velocity.x = 0.0
		velocity.z = 0.0
	_play_anim(&"run" if dir != Vector3.ZERO else &"idle")


func is_moving() -> bool:
	return Vector2(velocity.x, velocity.z).length() > 0.3


func _play_anim(anim: StringName) -> void:
	if _sprite.animation != anim:
		_sprite.play(anim)
