class_name CardView
extends PanelContainer

@onready var _cost_badge: Label = $Margin/VBox/TopRow/CostBadge
@onready var _type_chip: Label = $Margin/VBox/TopRow/Spacer/TypeChip
@onready var _name_label: Label = $Margin/VBox/Name
@onready var _desc_label: Label = $Margin/VBox/Desc
@onready var _cost_label: Label = $Margin/VBox/BottomRow/CostLabel
@onready var _key_label: Label = $Margin/VBox/BottomRow/Spacer/KeyLabel

var move: MoveDef = null
var key_index: int = 0
var _can_play: bool = true
var _own_style: StyleBoxFlat

func _ready() -> void:
	var base := get_theme_stylebox("panel")
	if base is StyleBoxFlat:
		_own_style = (base as StyleBoxFlat).duplicate()
		add_theme_stylebox_override("panel", _own_style)

func bind(card: MoveDef, key: int) -> void:
	move = card
	key_index = key
	_refresh()

func set_playable(value: bool) -> void:
	_can_play = value
	modulate = Color(1, 1, 1, 1) if value else Color(0.55, 0.55, 0.6, 0.8)

func _refresh() -> void:
	if move == null:
		_cost_badge.text = "—"
		_type_chip.text = ""
		_name_label.text = "EMPTY"
		_desc_label.text = ""
		_cost_label.text = ""
		_key_label.text = "KEY: %d" % (key_index + 1)
		_apply_type_color(Color(0.6, 0.6, 0.65))
		return
	_cost_badge.text = str(move.mana_cost)
	_type_chip.text = move.move_type.to_upper() if not move.move_type.is_empty() else ""
	_name_label.text = move.display_name.to_upper()
	_desc_label.text = move.description
	_cost_label.text = "COST: %d" % move.mana_cost
	_key_label.text = "KEY: %d" % (key_index + 1)
	var color := type_color(move.move_type)
	_apply_type_color(color)
	_type_chip.modulate = color

func _apply_type_color(color: Color) -> void:
	if _own_style == null:
		return
	_own_style.border_color = color
	_own_style.bg_color = Color(color.r * 0.18 + 0.92, color.g * 0.18 + 0.92, color.b * 0.18 + 0.92, 0.92)

static func type_color(t: String) -> Color:
	match t:
		"fire": return Color(1.0, 0.45, 0.30)
		"grass": return Color(0.45, 0.85, 0.40)
		"earth": return Color(0.78, 0.60, 0.35)
		"electric": return Color(0.95, 0.85, 0.20)
		"wind": return Color(0.55, 0.85, 0.85)
		"fighting": return Color(0.85, 0.50, 0.40)
		"mind": return Color(0.78, 0.45, 0.95)
		"dark": return Color(0.45, 0.40, 0.55)
		"light": return Color(0.95, 0.85, 0.60)
		"time": return Color(0.70, 0.50, 0.95)
		"ice": return Color(0.50, 0.80, 0.95)
		"water": return Color(0.30, 0.55, 0.95)
	return Color(0.7, 0.7, 0.75)
