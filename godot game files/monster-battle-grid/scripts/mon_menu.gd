class_name MonMenu
extends CanvasLayer

# Overworld monster menu (M). Two tabs (TAB switches):
#   PARTY    — your caught copies. ENTER toggles a copy in/out of the active
#              3-mon team (team[0] = lead = overworld partner + battle starter,
#              cycled in battle with T). Shows the copy's locked trait + its
#              deck rendered as cards, 3 per row.
#   BESTIARY — the full dex (all 28 species). Caught species show normally;
#              uncaught show a greyed silhouette + "???" (read-only).
# Bug-test mode (SceneManager.debug_unlock_all): PARTY also lists uncaught
# species so any mon can be fielded, and T cycles the selected trait.
#
# While open it swallows EVERY key in _input (runs before the overworld
# Player's _unhandled_input) so the player freezes for free. Pure code UI.

signal partner_changed(id: String)

const TAB_PARTY := 0
const TAB_BESTIARY := 1

const PANEL_W := 1000.0
const PANEL_H := 580.0
const MENU_SCALE := 1.8  # whole-menu size multiplier (1.5 = 50% bigger). Tune freely.
const COLOR_BG := Color(0.08, 0.09, 0.13, 0.97)
const COLOR_BORDER := Color(0.35, 0.40, 0.55)
const COLOR_TEXT := Color(0.88, 0.90, 0.95)
const COLOR_DIM_TEXT := Color(0.62, 0.65, 0.72)
const COLOR_LOCKED := Color(0.38, 0.40, 0.46)
const COLOR_SELECTED := Color(1.0, 0.88, 0.40)
const COLOR_PARTNER := Color(0.45, 0.95, 0.55)
const COLOR_TEAM := Color(0.45, 0.80, 1.0)
const COLOR_DEBUG := Color(0.95, 0.60, 0.35)
const COLOR_SILHOUETTE := Color(0.05, 0.05, 0.08, 1.0)

var _defs: Array[MonsterDef] = []
# Row model: {"def": MonsterDef, "instance": int, "discovered": bool}.
# instance indexes SceneManager.caught_mons (-1 = species row).
var _rows: Array[Dictionary] = []
var _tab: int = TAB_PARTY
var _selected: int = 0
var _open: bool = false

var _root: Control
var _scaler: Control
var _tab_labels: Array[Label] = []
var _row_labels: Array[Label] = []
var _row_box: VBoxContainer
var _roster_title: Label
var _left_scroll: ScrollContainer
var _sprite_rect: TextureRect
var _name_label: Label
var _type_label: Label
var _stats_label: Label
var _basic_label: Label
var _caught_label: Label
var _detail_scroll: ScrollContainer
var _detail_vbox: VBoxContainer
var _hint_label: Label

func _ready() -> void:
	layer = 80
	_defs = MonsterRoster.load_all()
	_build_ui()
	visible = false

func is_open() -> bool:
	return _open

func _input(event: InputEvent) -> void:
	if not (event is InputEventKey):
		return
	var key_event := event as InputEventKey
	if not key_event.pressed:
		return
	var key := key_event.keycode
	if not _open:
		if key == KEY_M and not key_event.echo:
			_open_menu()
			get_viewport().set_input_as_handled()
		return
	if not key_event.echo or key == KEY_UP or key == KEY_DOWN or key == KEY_W or key == KEY_S:
		match key:
			KEY_M, KEY_ESCAPE:
				_close()
			KEY_TAB:
				_switch_tab()
			KEY_UP, KEY_W:
				_move_selection(-1)
			KEY_DOWN, KEY_S:
				_move_selection(1)
			KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
				_activate_row()
			KEY_T:
				_debug_cycle_trait()
	get_viewport().set_input_as_handled()

func _open_menu() -> void:
	_open = true
	visible = true
	add_to_group("ui_blocker")
	# Scale grows the menu around the screen centre (recomputed each open so it
	# stays centred if the window was resized).
	if _scaler != null:
		_scaler.pivot_offset = get_viewport().get_visible_rect().size * 0.5
	_rebuild_rows()
	# Land on the current partner if it's in this tab.
	for i in range(_rows.size()):
		var row := _rows[i]
		if (row["def"] as MonsterDef).id == SceneManager.current_player_id \
				and int(row["instance"]) == SceneManager.current_partner_instance:
			_selected = i
			break
	_refresh_all()

func _close() -> void:
	_open = false
	visible = false
	if is_in_group("ui_blocker"):
		remove_from_group("ui_blocker")

func _switch_tab() -> void:
	_tab = TAB_BESTIARY if _tab == TAB_PARTY else TAB_PARTY
	_selected = 0
	_rebuild_rows()
	_refresh_all()

func _move_selection(delta: int) -> void:
	if _rows.is_empty():
		return
	_selected = wrapi(_selected + delta, 0, _rows.size())
	_refresh_rows()
	_refresh_detail()

# ENTER: PARTY toggles team membership; BESTIARY is read-only.
func _activate_row() -> void:
	if _tab != TAB_PARTY or _rows.is_empty():
		return
	var row := _rows[_selected]
	var def := row["def"] as MonsterDef
	var instance := int(row["instance"])
	if instance < 0:
		# Debug species row — field it directly (no persistent instance).
		if SceneManager.debug_unlock_all:
			SceneManager.current_player_id = def.id
			SceneManager.current_partner_instance = -1
			partner_changed.emit(def.id)
			_refresh_rows()
		return
	if not SceneManager.team_toggle(instance):
		print("[MENU] team full (%d) — remove one first" % SceneManager.TEAM_SIZE)
	partner_changed.emit(SceneManager.current_player_id)
	_refresh_rows()
	_refresh_detail()

func _debug_cycle_trait() -> void:
	if not SceneManager.debug_unlock_all or _rows.is_empty():
		return
	var row := _rows[_selected]
	var def := row["def"] as MonsterDef
	var instance := int(row["instance"])
	var pool_size := def.trait_pool.size()
	if pool_size == 0:
		return
	if instance >= 0:
		var entry: Dictionary = SceneManager.caught_mons[instance]
		entry["trait_index"] = (int(entry["trait_index"]) + 1) % pool_size
		print("[MENU/debug] %s copy trait → %d" % [def.id, int(entry["trait_index"])])
	else:
		if SceneManager.debug_trait_overrides.has(def.id):
			var nxt := int(SceneManager.debug_trait_overrides[def.id]) + 1
			if nxt >= pool_size:
				SceneManager.debug_trait_overrides.erase(def.id)
			else:
				SceneManager.debug_trait_overrides[def.id] = nxt
		else:
			SceneManager.debug_trait_overrides[def.id] = 0
	_refresh_rows()
	_refresh_detail()

# === ROW MODEL ===

func _rebuild_rows() -> void:
	_rows.clear()
	if _tab == TAB_PARTY:
		for def in _defs:
			var copies: Array = []
			for i in range(SceneManager.caught_mons.size()):
				if SceneManager.caught_mons[i]["id"] == def.id:
					copies.append(i)
			for i in copies:
				_rows.append({"def": def, "instance": i, "discovered": true})
			# Debug: also list uncaught species so any mon is fieldable.
			if copies.is_empty() and SceneManager.debug_unlock_all:
				_rows.append({"def": def, "instance": -1, "discovered": false})
	else:
		for def in _defs:
			var discovered := not SceneManager.caught_instances(def.id).is_empty()
			_rows.append({"def": def, "instance": -1, "discovered": discovered})
	_selected = clampi(_selected, 0, maxi(0, _rows.size() - 1))
	for l in _row_labels:
		l.free()
	_row_labels.clear()
	for row in _rows:
		var l := _make_label("", 15, COLOR_DIM_TEXT)
		_row_box.add_child(l)
		_row_labels.append(l)

func _row_trait_name(row: Dictionary) -> String:
	var def := row["def"] as MonsterDef
	var instance := int(row["instance"])
	if instance < 0:
		return ""
	var ti := int(SceneManager.caught_mons[instance]["trait_index"])
	if ti >= 0 and ti < def.trait_pool.size() and def.trait_pool[ti] != null:
		return (def.trait_pool[ti] as TraitDef).display_name
	return "?"

# Team slot (1-based) of a caught instance, or 0 if not on the team.
func _team_slot(instance: int) -> int:
	var pos: int = SceneManager.team.find(instance)
	return pos + 1

# === UI CONSTRUCTION ===

func _build_ui() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_root)
	var dim := ColorRect.new()
	dim.color = Color(0.0, 0.0, 0.0, 0.62)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(dim)
	# MENU_SCALE is applied here, on a plain Control that is NOT a direct child
	# of a Container. Scaling a Control inside a Container (the CenterContainer)
	# has no effect — the container overwrites the child's transform every
	# layout pass — so the whole menu is wrapped in this scaler instead. The
	# dim overlay stays a sibling so it always covers the full screen.
	_scaler = Control.new()
	_scaler.set_anchors_preset(Control.PRESET_FULL_RECT)
	_scaler.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scaler.scale = Vector2(MENU_SCALE, MENU_SCALE)
	_root.add_child(_scaler)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_scaler.add_child(center)

	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_BG
	style.border_color = COLOR_BORDER
	style.set_border_width_all(2)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(14)
	panel.add_theme_stylebox_override("panel", style)
	panel.custom_minimum_size = Vector2(PANEL_W, PANEL_H)
	center.add_child(panel)

	var outer := VBoxContainer.new()
	outer.add_theme_constant_override("separation", 8)
	panel.add_child(outer)

	# --- Tab bar ---
	var tab_bar := HBoxContainer.new()
	tab_bar.add_theme_constant_override("separation", 20)
	outer.add_child(tab_bar)
	for tab_name in ["PARTY", "BESTIARY"]:
		var t := _make_label(tab_name, 20, COLOR_DIM_TEXT)
		tab_bar.add_child(t)
		_tab_labels.append(t)
	outer.add_child(HSeparator.new())

	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 14)
	columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	outer.add_child(columns)

	# --- Left: roster list ---
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(260, 0)
	left.add_theme_constant_override("separation", 4)
	columns.add_child(left)
	_roster_title = _make_label("", 16, COLOR_TEXT)
	left.add_child(_roster_title)
	_left_scroll = ScrollContainer.new()
	_left_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_left_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(_left_scroll)
	_row_box = VBoxContainer.new()
	_row_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_row_box.add_theme_constant_override("separation", 2)
	_left_scroll.add_child(_row_box)

	# --- Right: detail pane ---
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 6)
	columns.add_child(right)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	right.add_child(header)
	_sprite_rect = TextureRect.new()
	_sprite_rect.custom_minimum_size = Vector2(110, 110)
	_sprite_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_sprite_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_sprite_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	header.add_child(_sprite_rect)
	var header_text := VBoxContainer.new()
	header_text.add_theme_constant_override("separation", 2)
	header_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(header_text)
	_name_label = _make_label("", 24, COLOR_TEXT)
	header_text.add_child(_name_label)
	_type_label = _make_label("", 15, COLOR_TEXT)
	header_text.add_child(_type_label)
	_stats_label = _make_label("", 14, COLOR_DIM_TEXT)
	header_text.add_child(_stats_label)
	_basic_label = _make_label("", 14, COLOR_DIM_TEXT)
	# Long basic-attack blurbs (zone-2 mons) must WRAP, not widen the panel —
	# without this the detail pane stretches past PANEL_W.
	_basic_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_basic_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_text.add_child(_basic_label)
	_caught_label = _make_label("", 14, COLOR_DIM_TEXT)
	header_text.add_child(_caught_label)

	right.add_child(HSeparator.new())

	_detail_scroll = ScrollContainer.new()
	_detail_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_detail_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(_detail_scroll)
	_detail_vbox = VBoxContainer.new()
	_detail_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail_vbox.add_theme_constant_override("separation", 6)
	_detail_scroll.add_child(_detail_vbox)

	_hint_label = _make_label("", 13, COLOR_DIM_TEXT)
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	outer.add_child(_hint_label)

func _make_label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

# Compact deck card for the 3-per-row grid (CardView's scene is too big /
# has a KEY badge; this reuses its type palette only).
func _make_mini_card(m: MoveDef) -> Control:
	var col := CardView.type_color(m.move_type)
	var card := PanelContainer.new()
	var st := StyleBoxFlat.new()
	st.bg_color = Color(col.r * 0.22 + 0.07, col.g * 0.22 + 0.07, col.b * 0.22 + 0.07, 0.95)
	st.border_color = col
	st.set_border_width_all(2)
	st.set_corner_radius_all(6)
	st.set_content_margin_all(8)
	card.add_theme_stylebox_override("panel", st)
	card.custom_minimum_size = Vector2(0, 104)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 2)
	card.add_child(vb)
	var top := HBoxContainer.new()
	var name_l := _make_label(m.display_name.to_upper(), 13, COLOR_TEXT)
	name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	top.add_child(name_l)
	var cost := _make_label(str(m.mana_cost), 14, col)
	top.add_child(cost)
	vb.add_child(top)
	vb.add_child(_make_label(m.move_type.to_upper(), 10, col))
	if not m.description.is_empty():
		var d := _make_label(m.description, 10, COLOR_DIM_TEXT)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		vb.add_child(d)
	return card

# === REFRESH ===

func _refresh_all() -> void:
	for i in range(_tab_labels.size()):
		_tab_labels[i].add_theme_color_override("font_color", COLOR_SELECTED if i == _tab else COLOR_DIM_TEXT)
	_refresh_rows()
	_refresh_detail()

func _refresh_rows() -> void:
	if _tab == TAB_PARTY:
		_roster_title.text = "PARTY — TEAM %d / %d" % [SceneManager.team.size(), SceneManager.TEAM_SIZE]
	else:
		var found := 0
		for def in _defs:
			if not SceneManager.caught_instances(def.id).is_empty():
				found += 1
		_roster_title.text = "BESTIARY — %d / %d DISCOVERED" % [found, _defs.size()]
	for i in range(_row_labels.size()):
		var row := _rows[i]
		var def := row["def"] as MonsterDef
		var instance := int(row["instance"])
		var discovered: bool = row["discovered"]
		var label := _row_labels[i]
		var cursor := "▶ " if i == _selected else "   "
		var text := ""
		var color := COLOR_DIM_TEXT
		if _tab == TAB_BESTIARY and not discovered:
			text = "%s???" % cursor
			color = COLOR_LOCKED
		elif _tab == TAB_BESTIARY:
			var n := SceneManager.caught_instances(def.id).size()
			text = "%s%s  ×%d" % [cursor, def.display_name, n]
			color = COLOR_PARTNER
		else:
			# PARTY tab.
			var slot := _team_slot(instance) if instance >= 0 else 0
			var is_lead := slot == 1
			var badge := ""
			if is_lead:
				badge = "★ "
			elif slot > 0:
				badge = "%d " % slot
			text = "%s%s%s" % [cursor, badge, def.display_name]
			if instance >= 0:
				text += " · %s" % _row_trait_name(row)
			if is_lead:
				color = COLOR_PARTNER
			elif slot > 0:
				color = COLOR_TEAM
			elif instance < 0:
				color = COLOR_LOCKED
		if i == _selected:
			color = COLOR_SELECTED
		label.text = text
		label.add_theme_color_override("font_color", color)
	if _selected >= 0 and _selected < _row_labels.size():
		_left_scroll.ensure_control_visible(_row_labels[_selected])
	_refresh_hint()

func _refresh_hint() -> void:
	var hint := "TAB  switch view      ↑/↓  select      "
	if _tab == TAB_PARTY:
		hint += "ENTER  add/remove from team      "
	hint += "M / ESC  close"
	if SceneManager.debug_unlock_all and _tab == TAB_PARTY:
		hint += "      T  cycle trait (debug)"
	_hint_label.text = hint

func _refresh_detail() -> void:
	if _rows.is_empty():
		return
	var row := _rows[_selected]
	var def := row["def"] as MonsterDef
	var instance := int(row["instance"])
	var discovered: bool = row["discovered"]
	for child in _detail_vbox.get_children():
		child.queue_free()

	# Undiscovered bestiary entry — silhouette + locked text, nothing else.
	if _tab == TAB_BESTIARY and not discovered:
		_sprite_rect.texture = def.sprite
		_sprite_rect.modulate = COLOR_SILHOUETTE
		_name_label.text = "???"
		_type_label.text = "???"
		_type_label.add_theme_color_override("font_color", COLOR_LOCKED)
		_stats_label.text = ""
		_basic_label.text = ""
		_caught_label.text = "NOT YET DISCOVERED"
		_caught_label.add_theme_color_override("font_color", COLOR_LOCKED)
		var hint := _make_label("Catch this monster to reveal its cards and traits.", 13, COLOR_LOCKED)
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hint.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_detail_vbox.add_child(hint)
		_detail_scroll.scroll_vertical = 0
		return

	_sprite_rect.texture = def.sprite
	_sprite_rect.modulate = Color.WHITE
	_name_label.text = def.display_name.to_upper()
	_type_label.text = def.monster_type.to_upper()
	_type_label.add_theme_color_override("font_color", CombatantPanel._type_color(def.monster_type))
	_stats_label.text = "HP %d    MANA %d    AMMO %d    RELOAD %.1fs" % [def.max_hp, def.max_mana, def.max_ammo, float(def.reload_ms) / 1000.0]
	_basic_label.text = "BASIC ATTACK: %s" % _basic_kind_name(def.basic_attack_kind)

	if _tab == TAB_PARTY and instance >= 0:
		var slot := _team_slot(instance)
		if slot == 1:
			_caught_label.text = "★ TEAM LEAD (starts battle)  ·  trait: %s" % _row_trait_name(row)
			_caught_label.add_theme_color_override("font_color", COLOR_PARTNER)
		elif slot > 0:
			_caught_label.text = "TEAM SLOT %d  ·  trait: %s" % [slot, _row_trait_name(row)]
			_caught_label.add_theme_color_override("font_color", COLOR_TEAM)
		else:
			_caught_label.text = "not on team — ENTER to add  ·  trait: %s" % _row_trait_name(row)
			_caught_label.add_theme_color_override("font_color", COLOR_DIM_TEXT)
	else:
		var caught: Array = SceneManager.caught_instances(def.id)
		if not caught.is_empty():
			_caught_label.text = "CAUGHT ×%d" % caught.size()
			_caught_label.add_theme_color_override("font_color", COLOR_PARTNER)
		elif SceneManager.debug_unlock_all and SceneManager.debug_trait_overrides.has(def.id):
			var ti := int(SceneManager.debug_trait_overrides[def.id])
			var t_name := "?"
			if ti < def.trait_pool.size() and def.trait_pool[ti] != null:
				t_name = (def.trait_pool[ti] as TraitDef).display_name
			_caught_label.text = "DEBUG TRAIT → %s" % t_name
			_caught_label.add_theme_color_override("font_color", COLOR_DEBUG)
		else:
			_caught_label.text = "not caught yet"
			_caught_label.add_theme_color_override("font_color", COLOR_DIM_TEXT)

	# Deck rendered as cards, 3 per row.
	_add_section_header("CARDS  (%d)" % def.deck.size())
	if def.deck.is_empty():
		_detail_vbox.add_child(_make_label("No cards yet — this monster's kit is still being written.", 13, COLOR_DIM_TEXT))
	else:
		var grid := GridContainer.new()
		grid.columns = 3
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_detail_vbox.add_child(grid)
		for card in def.deck:
			var m := card as MoveDef
			if m != null:
				grid.add_child(_make_mini_card(m))

	_add_spacer()
	if _tab == TAB_PARTY and instance >= 0:
		_add_section_header("TRAIT POOL  (this copy is locked to its caught trait)")
	else:
		_add_section_header("TRAIT POOL  (one rolls each battle: 40 / 40 / 20)")
	for t in def.trait_pool:
		var trait_def := t as TraitDef
		if trait_def == null:
			continue
		var pct := int(round(trait_def.rarity * 100.0))
		var t_title := _make_label("%s   ·   %d%%" % [trait_def.display_name, pct], 15, COLOR_TEXT)
		_detail_vbox.add_child(t_title)
		if not trait_def.description.is_empty():
			var t_desc := _make_label(trait_def.description, 13, COLOR_DIM_TEXT)
			t_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			t_desc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_detail_vbox.add_child(t_desc)
	_detail_scroll.scroll_vertical = 0

func _add_section_header(text: String) -> void:
	var h := _make_label(text, 16, COLOR_SELECTED)
	_detail_vbox.add_child(h)

func _add_spacer() -> void:
	var s := Control.new()
	s.custom_minimum_size = Vector2(0, 10)
	_detail_vbox.add_child(s)

func _basic_kind_name(kind: String) -> String:
	match kind:
		"bullet":
			return "standard bullet"
		"block_builder":
			return "block builder — press again to launch it 2 tiles"
		"statue_builder":
			return "statue builder — press again to topple it 3 tiles"
		"charged_bullet":
			return "charged bullet (hold SPACE)"
		"charged_walker":
			return "charged walker (hold SPACE)"
		"guard_builder":
			return "guard summoner (max 2 turrets)"
		"boomerang":
			return "crescent toss — breaks blocks, catch to refund the shot"
		"stun_jab":
			return "2-tile stun jab that pulls the enemy in"
		"charged_spike":
			return "2-tile spike (hold SPACE: 4 tiles) that poisons the floor"
		"triple_shot":
			return "triple shot, each bolt can crit"
		"tile_steal":
			return "steals the tile ahead for 5s — walkable, enemy ticks on it"
		"drain_shot":
			return "drain shot — heals what it deals; 10 hits = LATCH"
		"ice_spike":
			return "homing ice spike — misses can freeze a tile"
		"scrap_shot":
			return "shot that builds a block when it lands"
		"warp_shot":
			return "bullet (10) that warps the enemy to a random tile"
		"charged_thrust":
			return "2-tile rapier thrust (1 ammo, 2s reload) — hold SPACE: rush slice (20) down the row and return"
		"stun_volley":
			return "2-shot clip — the 2nd shot roots 1s, then reloads"
		"charged_claw":
			return "2-tile claw that freezes the floor (hold SPACE: 4 tiles)"
		"sleep_shot":
			return "weak piercing bolt — every 3rd hit puts the enemy to SLEEP"
		"rage_shot":
			return "slow 2-ammo slug; 3 hits = RAGE (cards x1.2 + stunning laser)"
		"seer_shot":
			return "weak 5-clip bolt — every 5th hit SHUFFLES the enemy's hand + charges your next grass card"
		"charged_shadow":
			return "hold SPACE — a shadow appears behind the enemy and strikes their tile 0.5s later (18 + 1s stun, 3s CD; early release = 9)"
		"jester_beam":
			return "3-ammo light beam sweeping your row — passes through blocks (5s reload)"
		"ram_shot":
			return "RAM — 30-damage straight-line charge, slow 3s recoil (3s cooldown)"
	return kind
