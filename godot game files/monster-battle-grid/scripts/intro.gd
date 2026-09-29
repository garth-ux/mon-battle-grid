extends Control

# Opening scene — the uncle stands lit in the centre of a dark frame over the
# Factions map and asks you to pick your starter. ←/→ (or A/D) select, ENTER
# confirms: the starter is recorded as a caught instance (40/40/20 trait
# roll), becomes the partner, and the overworld loads with menu gating live.
# ESC = dev skip — flips SceneManager.debug_unlock_all back ON and drops into
# the overworld exactly like the pre-intro builds (all mons selectable).

const OVERWORLD_SCENE := "res://overworld.tscn"
const UNCLE_FRAME_COUNT := 5
const UNCLE_FRAME_TIME := 0.22
const UNCLE_SIZE := 128.0        # 32px art at 4x
const STARTER_SPRITE_SIZE := 88.0

const COLOR_TITLE := Color(0.96, 0.90, 0.72)
const COLOR_TEXT := Color(0.90, 0.88, 0.82)
const COLOR_DIM := Color(0.66, 0.64, 0.58)
const COLOR_SELECTED := Color(1.0, 0.88, 0.40)

var _starters: Array[MonsterDef] = []
var _selected: int = 0
var _done: bool = false

var _uncle: TextureRect
var _uncle_frames: Array[Texture2D] = []
var _uncle_frame: int = 0
var _uncle_timer: float = 0.0
var _cards: Array[PanelContainer] = []
var _name_labels: Array[Label] = []

func _ready() -> void:
	for id in MonsterRoster.STARTER_IDS:
		var def := MonsterRoster.load_by_id(id)
		if def != null:
			_starters.append(def)
	for i in range(UNCLE_FRAME_COUNT):
		var tex := load("res://art/npc/uncle_idle_%d.png" % i) as Texture2D
		if tex != null:
			_uncle_frames.append(tex)
	_build_ui()
	_refresh_selection()

func _process(delta: float) -> void:
	if _uncle_frames.is_empty() or _uncle == null:
		return
	_uncle_timer += delta
	if _uncle_timer >= UNCLE_FRAME_TIME:
		_uncle_timer -= UNCLE_FRAME_TIME
		_uncle_frame = (_uncle_frame + 1) % _uncle_frames.size()
		_uncle.texture = _uncle_frames[_uncle_frame]

func _unhandled_input(event: InputEvent) -> void:
	if _done or not (event is InputEventKey):
		return
	var key_event := event as InputEventKey
	if not key_event.pressed or key_event.echo:
		return
	match key_event.keycode:
		KEY_LEFT, KEY_A:
			_selected = wrapi(_selected - 1, 0, _starters.size())
			_refresh_selection()
		KEY_RIGHT, KEY_D:
			_selected = wrapi(_selected + 1, 0, _starters.size())
			_refresh_selection()
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
			_confirm_starter()
		KEY_ESCAPE:
			_dev_skip()
	get_viewport().set_input_as_handled()

func _confirm_starter() -> void:
	if _done or _starters.is_empty():
		return
	_done = true
	var def := _starters[_selected]
	var trait_index := _roll_trait_index(def.trait_pool.size())
	SceneManager.record_catch(def.id, trait_index)
	SceneManager.current_player_id = def.id
	SceneManager.current_partner_instance = SceneManager.caught_mons.size() - 1
	var trait_name := "no trait"
	if trait_index < def.trait_pool.size() and def.trait_pool[trait_index] != null:
		trait_name = (def.trait_pool[trait_index] as TraitDef).display_name
	print("[INTRO] starter chosen: %s (trait: %s)" % [def.id, trait_name])
	SceneManager.change_scene(OVERWORLD_SCENE)

func _dev_skip() -> void:
	if _done:
		return
	_done = true
	SceneManager.debug_unlock_all = true
	print("[INTRO] dev skip — debug_unlock_all ON, partner stays %s" % SceneManager.current_player_id)
	SceneManager.change_scene(OVERWORLD_SCENE)

# 40/40/20 — same odds the wild rolls use.
func _roll_trait_index(pool_size: int) -> int:
	if pool_size <= 0:
		return 0
	var r := randf()
	var idx := 0 if r < 0.4 else (1 if r < 0.8 else 2)
	return mini(idx, pool_size - 1)

# === UI CONSTRUCTION ===

func _build_ui() -> void:
	# Map backdrop, dimmed — the "dark frame" the uncle sits lit inside.
	var map := TextureRect.new()
	map.texture = load("res://art/UI/factions_map.png")
	map.set_anchors_preset(Control.PRESET_FULL_RECT)
	map.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	map.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	map.modulate = Color(0.78, 0.75, 0.72)
	add_child(map)
	var dark := ColorRect.new()
	dark.color = Color(0.02, 0.02, 0.05, 0.55)
	dark.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dark)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_child(column)

	# Uncle stage — warm radial spotlight with the animated uncle on top.
	var stage := Control.new()
	stage.custom_minimum_size = Vector2(320, 210)
	column.add_child(stage)
	var spotlight := TextureRect.new()
	spotlight.texture = _make_spotlight_texture()
	spotlight.stretch_mode = TextureRect.STRETCH_SCALE
	spotlight.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	spotlight.size = Vector2(320, 320)
	spotlight.position = (stage.custom_minimum_size - spotlight.size) * 0.5
	var glow_mat := CanvasItemMaterial.new()
	glow_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	spotlight.material = glow_mat
	stage.add_child(spotlight)
	_uncle = TextureRect.new()
	if not _uncle_frames.is_empty():
		_uncle.texture = _uncle_frames[0]
	_uncle.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_uncle.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_uncle.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_uncle.size = Vector2(UNCLE_SIZE, UNCLE_SIZE)
	_uncle.position = (stage.custom_minimum_size - _uncle.size) * 0.5
	stage.add_child(_uncle)

	var title := _make_label("WELCOME TO THE WILDS", 30, COLOR_TITLE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)

	var dialog := _make_label(
		"\"About time you woke up! These lands aren't safe without a partner at your side.\nGo on — pick your first mon.\"",
		16, COLOR_TEXT)
	dialog.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(dialog)

	# Starter row.
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(row)
	for def in _starters:
		var card := PanelContainer.new()
		card.add_theme_stylebox_override("panel", _make_card_style(false))
		row.add_child(card)
		_cards.append(card)
		var card_box := VBoxContainer.new()
		card_box.add_theme_constant_override("separation", 4)
		card_box.alignment = BoxContainer.ALIGNMENT_CENTER
		card.add_child(card_box)
		var sprite := TextureRect.new()
		sprite.texture = def.sprite
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		sprite.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		sprite.custom_minimum_size = Vector2(STARTER_SPRITE_SIZE, STARTER_SPRITE_SIZE)
		card_box.add_child(sprite)
		var name_label := _make_label(def.display_name.to_upper(), 15, COLOR_DIM)
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card_box.add_child(name_label)
		_name_labels.append(name_label)
		var type_label := _make_label(def.monster_type.to_upper(), 12, CombatantPanel._type_color(def.monster_type))
		type_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card_box.add_child(type_label)

	var hint := _make_label("←/→  SELECT      ENTER  CHOOSE", 13, COLOR_DIM)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(hint)

func _make_spotlight_texture() -> GradientTexture2D:
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	grad.colors = PackedColorArray([
		Color(1.0, 0.92, 0.72, 0.42),
		Color(1.0, 0.88, 0.62, 0.14),
		Color(1.0, 0.85, 0.55, 0.0),
	])
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(0.5, 0.0)
	tex.width = 320
	tex.height = 320
	return tex

func _make_card_style(selected: bool) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.07, 0.10, 0.82)
	style.border_color = COLOR_SELECTED if selected else Color(0.30, 0.32, 0.40, 0.6)
	style.set_border_width_all(2 if selected else 1)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(10)
	return style

func _refresh_selection() -> void:
	for i in range(_cards.size()):
		_cards[i].add_theme_stylebox_override("panel", _make_card_style(i == _selected))
		_name_labels[i].add_theme_color_override("font_color", COLOR_SELECTED if i == _selected else COLOR_DIM)

func _make_label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l
