class_name DamagePopup
extends Label3D

const LIFETIME := 1.1
const FLOAT_DISTANCE := 0.9

var _elapsed: float = 0.0
var _base_color: Color = Color.WHITE
var _captured: bool = false
var _start_pos: Vector3

func _ready() -> void:
	_base_color = modulate
	no_depth_test = true

func _process(delta: float) -> void:
	if not _captured:
		_start_pos = global_position
		_captured = true
	_elapsed += delta
	if _elapsed >= LIFETIME:
		queue_free()
		return
	var t := _elapsed / LIFETIME
	global_position = _start_pos + Vector3(0.0, FLOAT_DISTANCE * t, 0.0)
	var fade := 1.0 - smoothstep(0.55, 1.0, t)
	modulate = Color(_base_color.r, _base_color.g, _base_color.b, _base_color.a * fade)
