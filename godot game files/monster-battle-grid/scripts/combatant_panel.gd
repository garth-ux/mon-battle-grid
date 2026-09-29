class_name CombatantPanel
extends PanelContainer

const SEGMENTS := 10
const SEG_SIZE := Vector2(18, 14)
const MANA_SEG_SIZE := Vector2(18, 6)
const MANA_FILL := Color(0.35, 0.75, 1.0)
const MANA_EMPTY := Color(0.12, 0.18, 0.30, 0.6)

@onready var _name_label: Label = $Margin/VBox/Header/Name
@onready var _type_label: Label = $Margin/VBox/Header/TypeChip
@onready var _bar: HBoxContainer = $Margin/VBox/HBar
@onready var _mbar: HBoxContainer = $Margin/VBox/MBar
@onready var _hp_text: Label = $Margin/VBox/Footer/HPText
@onready var _mana_text: Label = $Margin/VBox/Footer/ManaText
@onready var _ammo_text: Label = $Margin/VBox/Footer/AmmoText
@onready var _trait_line: Label = $Margin/VBox/TraitLine

var _combatant: Combatant
var _accent: Color = Color(0.35, 0.85, 0.45)
var _segment_rects: Array = []
var _mana_rects: Array = []
# Battle sets this on the ENEMY panel only — blinks CATCHABLE! while the
# combatant sits inside the catch window (≤25% max HP, matches the red bar).
var show_catchable: bool = false
var _catchable_label: Label

func _ready() -> void:
	_bar.add_theme_constant_override("separation", 2)
	for i in SEGMENTS:
		var r := ColorRect.new()
		r.custom_minimum_size = SEG_SIZE
		_bar.add_child(r)
		_segment_rects.append(r)
	_mbar.add_theme_constant_override("separation", 2)
	for i in SEGMENTS:
		var r := ColorRect.new()
		r.custom_minimum_size = MANA_SEG_SIZE
		_mbar.add_child(r)
		_mana_rects.append(r)
	_catchable_label = Label.new()
	_catchable_label.text = "◈ CATCHABLE! (C)"
	_catchable_label.add_theme_font_size_override("font_size", 13)
	_catchable_label.add_theme_color_override("font_color", Color(0.78, 0.55, 0.98))
	_catchable_label.visible = false
	$Margin/VBox.add_child(_catchable_label)
	var blink := _catchable_label.create_tween().set_loops()
	blink.tween_property(_catchable_label, "modulate:a", 0.25, 0.5)
	blink.tween_property(_catchable_label, "modulate:a", 1.0, 0.5)

func bind_combatant(c: Combatant, accent: Color) -> void:
	_combatant = c
	_accent = accent
	c.damaged.connect(func(_a, _b, _c, _d): _refresh())
	c.healed.connect(func(_a): _refresh())
	c.ammo_changed.connect(func(_a, _b, _c): _refresh())
	c.mana_changed.connect(func(_m, _mx): _refresh())
	c.trait_changed.connect(func(_t): _refresh())
	c.armor_changed.connect(func(_a): _refresh())
	c.died.connect(_refresh)
	_refresh()

func _refresh() -> void:
	if _combatant == null:
		return
	_name_label.text = _combatant.display_name.to_upper() if not _combatant.display_name.is_empty() else "—"
	_type_label.text = _combatant.monster_type.to_upper()
	_type_label.modulate = _type_color(_combatant.monster_type)
	var hp_str := "HP %d / %d" % [_combatant.hp, _combatant.max_hp]
	if _combatant.armor > 0:
		hp_str += "  [+%d ARMOR]" % _combatant.armor
	_hp_text.text = hp_str
	_mana_text.text = "MP %d / %d" % [_combatant.mana, _combatant.max_mana]
	var ammo_str := "AMMO %d / %d" % [_combatant.ammo, _combatant.max_ammo]
	if _combatant._is_reloading():
		ammo_str = "RELOADING…"
	_ammo_text.text = ammo_str
	if _combatant.traits.size() > 0 and _combatant.traits[0] != null:
		var t: TraitDef = _combatant.traits[0]
		_trait_line.text = "✦ %s — %s" % [t.display_name.to_upper(), t.description]
	else:
		_trait_line.text = "✦ no trait"
	var fraction := _combatant.hp_fraction()
	if _catchable_label != null:
		# Same ceil'd threshold as Battle._try_catch so the tag never lies.
		var catch_threshold := int(ceil(float(_combatant.max_hp) * 0.25))
		_catchable_label.visible = show_catchable and _combatant.hp > 0 and _combatant.hp <= catch_threshold
	var filled := int(ceil(fraction * SEGMENTS))
	if fraction <= 0.0:
		filled = 0
	var fill := _accent
	if fraction <= 0.25:
		fill = Color(0.95, 0.30, 0.30)
	elif fraction <= 0.5:
		fill = Color(0.95, 0.75, 0.30)
	var empty := Color(0.15, 0.15, 0.18, 0.6)
	for i in SEGMENTS:
		(_segment_rects[i] as ColorRect).color = fill if i < filled else empty
	# Mana bar: cyan segments, scaled to max_mana (cap at SEGMENTS visible).
	var max_mana := maxi(1, _combatant.max_mana)
	var mana_filled := clampi(_combatant.mana, 0, max_mana)
	for i in SEGMENTS:
		var rect := _mana_rects[i] as ColorRect
		# Only show segments up to max_mana — hide the rest.
		if i >= max_mana:
			rect.color = Color(0, 0, 0, 0)
			rect.visible = false
		else:
			rect.visible = true
			rect.color = MANA_FILL if i < mana_filled else MANA_EMPTY

static func _type_color(type_name: String) -> Color:
	match type_name:
		"fire": return Color(1.0, 0.45, 0.30)
		"grass": return Color(0.45, 0.85, 0.40)
		"earth": return Color(0.78, 0.60, 0.35)
		"electric": return Color(0.95, 0.85, 0.20)
		"wind": return Color(0.70, 0.95, 0.85)
		"fighting": return Color(0.85, 0.50, 0.40)
		"mind": return Color(0.78, 0.45, 0.95)
		"dark": return Color(0.45, 0.40, 0.55)
		"light": return Color(1.0, 0.95, 0.75)
		"time": return Color(0.70, 0.50, 0.95)
		"ice": return Color(0.60, 0.85, 0.95)
		"water": return Color(0.30, 0.55, 0.95)
	return Color(0.85, 0.85, 0.85)
