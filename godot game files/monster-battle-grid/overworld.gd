extends Node3D

const TILT_DEG := 25.0
const YAW_DEG := -25.0
const CAMERA_HEIGHT := 10.0
const CAMERA_SIZE := 6.0
const ENCOUNTER_RATE := 0.2
const STARTER_WILD_RATE := 0.01
# Zone 2 battle roll (user spec): 1% starter / 15% zone-1 crossover / 84% zone-2 mon.
const ZONE2_CROSSOVER_RATE := 0.15
# Zone 3 grass pool (user spec) — uniform roll after the 1% starter chance.
# The 5 garden-town natives plus the earlier crossover mons. Rarity weighting
# comes later.
const ZONE3_POOL: Array = [
	"krrrrin", "gilga", "astragio", "baarister", "trikits",
	"pixie", "mosseer", "slime", "malipole",
]
# Zone 1 has THREE green gradient pads; the southern one (world z past this
# line — pad at z≈12 vs the others at z≤4.5) is the zone-3 exit, the rest
# keep leading to zone 2.
const ZONE1_SOUTH_WORLD_Z := 8.0
# Zone 3 → zone 4: the black doorway at the top of the steps has no walkable
# floor, so the landing right below it is the trigger. That landing sits at
# world x∈[3,5], z≈0.5 (well clear of the plaza, which is z≥6).
const ZONE3_DOORWAY_X_MIN := 3.0
const ZONE3_DOORWAY_X_MAX := 5.0
const ZONE3_DOORWAY_Z_MAX := 1.2
const BATTLE_SCENE := "res://battle.tscn"
const ZONE_MAPS := {
	"zone1": "res://BlockTile_1781894212.glb",
	"zone2": "res://BlockTile_1783783028.glb",
	"zone3": "res://BlockTile_1786792549.glb",
	"zone4": "res://BlockTile_1787352578.glb",
}
# Per-zone Y rotation (degrees) applied to the loaded map instance. Empty =
# every map keeps its native orientation.
const ZONE_MAP_YAW := {}
# Per-zone camera yaw (degrees) — overrides YAW_DEG so a room can be viewed
# from a different angle without moving the map/entrance. Zone 4's walls are
# only textured on their inner faces, so we orbit the camera to look at the
# textured side instead of the blank outer wall.
# Zone 4's tall walls run along its NORTH + WEST sides (computed from the GLB),
# so the camera must sit in the open SOUTH-EAST quadrant to see the textured
# inner faces: +65 puts the back wall across the top and the side wall on the
# right, entrance at the bottom-left (matches the BlockTile editor view).
# Tune: +45 = cornered iso, +90 = back wall square-on.
const ZONE_CAMERA_YAW := {
	"zone4": 55.0,
}

@onready var _world: Node3D = $World
@onready var _camera_rig: Node3D = $CameraRig
@onready var _camera: Camera3D = $CameraRig/Camera3D
@onready var _player: Player = $Player

var _grid: TileGrid
var _hud: CanvasLayer
var _player_id_label: Label
var _mon_menu: MonMenu
# Portal tiles only fire once you've stepped OFF one — spawning on the
# return pad doesn't instantly bounce you back.
var _portal_armed: bool = true
# Zone 4 is a dead-end stone room reached through zone 3's doorway; you leave
# by walking back onto the tile you entered on. Stored on entry.
var _zone4_entry_cell: Vector2i = Vector2i.ZERO
# Rival NPC (Hallie Minerva) — zone 4 only. Animated billboard in the room
# centre; SPACE while adjacent opens her dialog, which starts the rival battle.
const RIVAL_FRAME_TIME := 0.18
const RIVAL_DIALOG_TEXT := "wow, i really did not expect you to show up, ready to lose?"
var _rival_npc: Node3D = null
var _rival_sprite: Sprite3D = null
var _rival_cell: Vector2i = Vector2i(9999, 9999)
var _rival_frames: Array[Texture2D] = []
var _rival_frame_i: int = 0
var _rival_frame_t: float = 0.0
var _dialog_layer: CanvasLayer = null
var _dialog_open: bool = false

func _ready() -> void:
	_load_zone_map()
	_force_pixel_filter(_world)
	_setup_camera_rig()
	_setup_hud()
	_grid = GridBuilder.build_from_node(_world)
	print("TileGrid built (%s): " % SceneManager.current_zone, _grid.size(), " cells")
	var spawn: Vector2i
	if SceneManager.spawn_at_portal:
		SceneManager.spawn_at_portal = false
		spawn = _find_zone_spawn()
		_portal_armed = false
	else:
		spawn = _grid.find_spawn()
		_portal_armed = true
	if SceneManager.current_zone == "zone4":
		_zone4_entry_cell = spawn
	_player.setup(_grid, spawn)
	# Zones that override the camera yaw (zone 4) shift the player's screen-
	# relative input rotation by the same delta, so "up" stays up-screen.
	_player.camera_yaw_deg += float(ZONE_CAMERA_YAW.get(SceneManager.current_zone, YAW_DEG)) - YAW_DEG
	_player.arrived.connect(_on_player_arrived)
	_snap_camera_to_player()
	# Monster menu (M) — browse all 18 + pick the partner. It owns the M key
	# and swallows all input while open, so the player freezes for free.
	_mon_menu = MonMenu.new()
	add_child(_mon_menu)
	_mon_menu.partner_changed.connect(func(_id: String) -> void: _refresh_player_id_label())
	_refresh_player_id_label()
	if SceneManager.current_zone == "zone4":
		_spawn_rival()
	print("Player spawned at cell ", spawn, " world=", _player.global_position)

func _setup_hud() -> void:
	_hud = CanvasLayer.new()
	_hud.layer = 64
	add_child(_hud)
	_player_id_label = Label.new()
	_player_id_label.anchor_left = 0.0
	_player_id_label.anchor_top = 1.0
	_player_id_label.anchor_right = 1.0
	_player_id_label.anchor_bottom = 1.0
	_player_id_label.offset_left = 16.0
	_player_id_label.offset_top = -52.0
	_player_id_label.offset_right = -16.0
	_player_id_label.offset_bottom = -16.0
	_player_id_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_player_id_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_player_id_label.add_theme_color_override("font_color", Color(0.95, 0.95, 1.0))
	_player_id_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_player_id_label.add_theme_constant_override("outline_size", 6)
	_player_id_label.add_theme_font_size_override("font_size", 18)
	_hud.add_child(_player_id_label)

func _refresh_player_id_label() -> void:
	if _player_id_label == null:
		return
	var def := MonsterRoster.load_by_id(SceneManager.current_player_id)
	var name_str := def.display_name if def != null else SceneManager.current_player_id
	var zone_str := SceneManager.current_zone.to_upper().insert(4, " ")
	_player_id_label.text = "%s   ·   PARTNER: %s   (M for monster menu)" % [zone_str, name_str.to_upper()]

# Swap the map instance to the current zone's GLB. Zone 1 is the .tscn
# default; other zones free the baked instance and load their own.
func _load_zone_map() -> void:
	var zone: String = SceneManager.current_zone
	if zone == "zone1":
		return
	var tiles := _world.get_node_or_null("Tiles")
	if tiles != null:
		_world.remove_child(tiles)
		tiles.free()
	var map_scene := load(ZONE_MAPS.get(zone, ZONE_MAPS["zone1"])) as PackedScene
	if map_scene == null:
		push_warning("Overworld: missing map for %s" % zone)
		return
	var inst := map_scene.instantiate()
	inst.name = "Tiles"
	if inst is Node3D:
		(inst as Node3D).rotation.y = deg_to_rad(float(ZONE_MAP_YAW.get(zone, 0.0)))
	_world.add_child(inst)

# Where to spawn after a zone transition. Zone 4 and the zone-3 doorway have
# no gradient pads, so they get position-based spawns; everything else uses the
# gradient-pad finder.
func _find_zone_spawn() -> Vector2i:
	var zone: String = SceneManager.current_zone
	if zone == "zone4":
		return _find_zone4_entry()
	if zone == "zone3" and SceneManager.portal_from_zone == "zone4":
		# Returning from zone 4 — land on the doorway landing at the top of the steps.
		var mid_x := (ZONE3_DOORWAY_X_MIN + ZONE3_DOORWAY_X_MAX) * 0.5
		return _find_cell_near_world(Vector2(mid_x, 0.5))
	var pad_kind := TileType.Kind.PORTAL_ZONE2 if zone == "zone1" else TileType.Kind.PORTAL_ZONE1
	return _find_portal_spawn(pad_kind)

# Zone 4's entrance = the walkable floor cell nearest the room's near edge
# (greatest world-z) — the bottom of the room, where the way in/out is. Also
# the tile you walk back onto to leave. (Hallie stands at the centre.)
func _find_zone4_entry() -> Vector2i:
	var best: Vector2i = _grid.find_spawn()
	var best_z := -INF
	for coord in _grid.cells:
		if not _grid.is_walkable(coord):
			continue
		var wz := _grid.cell_to_world(coord).z
		if wz > best_z:
			best_z = wz
			best = coord
	return best

# The walkable cell nearest the centroid of all walkable cells (room centre) —
# where Hallie stands.
func _find_room_center() -> Vector2i:
	var sum := Vector2.ZERO
	var n := 0
	for coord in _grid.cells:
		if _grid.is_walkable(coord):
			sum += Vector2(coord.x, coord.y)
			n += 1
	if n == 0:
		return _grid.find_spawn()
	var c := sum / float(n)
	var best: Vector2i = _grid.find_spawn()
	var best_d := INF
	for coord in _grid.cells:
		if not _grid.is_walkable(coord):
			continue
		var d := Vector2(coord.x, coord.y).distance_to(c)
		if d < best_d:
			best_d = d
			best = coord
	return best

# Nearest walkable cell to a target (world x,z).
func _find_cell_near_world(target: Vector2) -> Vector2i:
	var best: Vector2i = _grid.find_spawn()
	var best_d := INF
	for coord in _grid.cells:
		if not _grid.is_walkable(coord):
			continue
		var w := _grid.cell_to_world(coord)
		var d := Vector2(w.x, w.z).distance_to(target)
		if d < best_d:
			best_d = d
			best = coord
	return best

# Land on the destination zone's return pad (walkable portal cell closest to
# the pad cluster's centre). Falls back to the default spawn if none exists.
# Multi-pad zones filter by the zone we came FROM so the arrival pad matches
# the exit that leads back there (zone 1's south pad <-> zone 3).
func _find_portal_spawn(pad_kind: int) -> Vector2i:
	var candidates: Array = []
	for coord in _grid.cells:
		var c: TileGrid.Cell = _grid.cells[coord]
		if c.kind == pad_kind and _grid.is_walkable(coord):
			candidates.append(coord)
	if candidates.is_empty():
		return _grid.find_spawn()
	var from_zone: String = SceneManager.portal_from_zone
	if SceneManager.current_zone == "zone1":
		# Split the pads at the south line; land on the side we came from.
		var south: Array = []
		var north: Array = []
		for coord in candidates:
			var typed: Vector2i = coord
			if _grid.cell_to_world(typed).z > ZONE1_SOUTH_WORLD_Z:
				south.append(coord)
			else:
				north.append(coord)
		if from_zone == "zone3" and not south.is_empty():
			candidates = south
		elif from_zone != "zone3" and not north.is_empty():
			candidates = north
	elif SceneManager.current_zone == "zone3":
		# Coming down from zone 1's south exit — land on the pad nearest the
		# map's zone-1-facing corner (smallest x+z cluster of the exits).
		var best: Vector2i = candidates[0]
		var best_v := INF
		for coord in candidates:
			var typed2: Vector2i = coord
			var v := float(typed2.x + typed2.y)
			if v < best_v:
				best_v = v
				best = typed2
		var cluster: Array = []
		for coord in candidates:
			var typed3: Vector2i = coord
			if Vector2(typed3.x, typed3.y).distance_to(Vector2(best.x, best.y)) <= 4.0:
				cluster.append(coord)
		candidates = cluster
	var sum := Vector2.ZERO
	for coord in candidates:
		sum += Vector2(coord.x, coord.y)
	var center := sum / float(candidates.size())
	var best: Vector2i = candidates[0]
	var best_d := INF
	for coord in candidates:
		var d := Vector2(coord.x, coord.y).distance_to(center)
		if d < best_d:
			best_d = d
			best = coord
	return best

func _travel_to(zone: String) -> void:
	SceneManager.portal_from_zone = SceneManager.current_zone
	SceneManager.current_zone = zone
	SceneManager.spawn_at_portal = true
	print("Portal — traveling to ", zone)
	SceneManager.change_scene("res://overworld.tscn")

func _process(delta: float) -> void:
	_camera_rig.global_position = _player.global_position
	_animate_rival(delta)

func _snap_camera_to_player() -> void:
	_camera_rig.global_position = _player.global_position

func _setup_camera_rig() -> void:
	var tilt := deg_to_rad(TILT_DEG)
	var yaw := deg_to_rad(float(ZONE_CAMERA_YAW.get(SceneManager.current_zone, YAW_DEG)))
	_camera_rig.basis = Basis(Vector3.UP, yaw)

	var depth_offset := CAMERA_HEIGHT / tan(tilt)
	_camera.transform = Transform3D(
		Basis(Vector3.RIGHT, -tilt),
		Vector3(0.0, CAMERA_HEIGHT, depth_offset)
	)
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = CAMERA_SIZE

func _on_player_arrived(cell: Vector2i) -> void:
	# Portal pads: green gradient (zone 1) → zone 2; sandy gradient (zone 2)
	# → zone 1. Armed only after standing on a non-portal cell so the arrival
	# pad doesn't bounce you straight back.
	var kind := _grid.get_kind(cell)
	if kind == TileType.Kind.PORTAL_ZONE2 or kind == TileType.Kind.PORTAL_ZONE1:
		if _portal_armed:
			var dest := "zone1"
			if kind == TileType.Kind.PORTAL_ZONE2:
				# Zone 1's three green pads: the SOUTH pad leads to zone 3,
				# the others keep leading to zone 2.
				dest = "zone3" if _grid.cell_to_world(cell).z > ZONE1_SOUTH_WORLD_Z else "zone2"
			_travel_to(dest)
		return
	# Zone 3 → zone 4 through the black doorway landing at the top of the steps.
	if SceneManager.current_zone == "zone3":
		var w := _grid.cell_to_world(cell)
		if w.x >= ZONE3_DOORWAY_X_MIN and w.x <= ZONE3_DOORWAY_X_MAX and w.z <= ZONE3_DOORWAY_Z_MAX:
			if _portal_armed:
				_travel_to("zone4")
			return
	# Zone 4 → zone 3: walk back onto the tile you entered on.
	if SceneManager.current_zone == "zone4" and cell == _zone4_entry_cell:
		if _portal_armed:
			_travel_to("zone3")
		return
	_portal_armed = true
	if _grid.is_encounter(cell) and randf() < ENCOUNTER_RATE:
		var id := _roll_encounter_id()
		print("Wild encounter (%s): %s vs partner %s" % [SceneManager.current_zone, id, SceneManager.current_player_id])
		SceneManager.next_battle_enemy_id = id
		SceneManager.next_battle_player_id = SceneManager.current_player_id
		SceneManager.change_scene(BATTLE_SCENE)

# Zone battle rolls. Zone 1: 1% starter, else the zone-1 pool. Zone 2 (user
# spec): 1% starter / 15% zone-1 crossover / 84% zone-2 mon.
func _roll_encounter_id() -> String:
	var picked: MonsterDef = null
	if randf() < STARTER_WILD_RATE:
		picked = MonsterRoster.random_starter_def()
	elif SceneManager.current_zone == "zone2":
		picked = MonsterRoster.random_def() if randf() < ZONE2_CROSSOVER_RATE else MonsterRoster.random_zone2_def()
	elif SceneManager.current_zone == "zone3":
		# Garden town pool (user spec): pixies, mosseers, slimes, malipoles.
		picked = MonsterRoster.load_by_id(ZONE3_POOL[randi() % ZONE3_POOL.size()])
	else:
		picked = MonsterRoster.random_def()
	return picked.id if picked != null else "slime"

func _force_pixel_filter(node: Node) -> void:
	if node is MeshInstance3D:
		var mesh: Mesh = (node as MeshInstance3D).mesh
		if mesh != null:
			for i in mesh.get_surface_count():
				var mat := mesh.surface_get_material(i)
				if mat is BaseMaterial3D:
					var bm := mat as BaseMaterial3D
					bm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
					bm.texture_repeat = false
	for child in node.get_children():
		_force_pixel_filter(child)

# === RIVAL NPC (Hallie Minerva) ===

func _spawn_rival() -> void:
	_rival_cell = _find_room_center()
	for i in range(5):
		var tex := load("res://art/npc/rival_idle_%d.png" % i) as Texture2D
		if tex != null:
			_rival_frames.append(tex)
	_rival_npc = Node3D.new()
	_rival_sprite = Sprite3D.new()
	if not _rival_frames.is_empty():
		_rival_sprite.texture = _rival_frames[0]
	_rival_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_rival_sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	# Match the player exactly (player Sprite: pixel_size 0.04, y 0.66, 32px art).
	_rival_sprite.pixel_size = 0.04
	_rival_sprite.position.y = 0.66
	_rival_npc.add_child(_rival_sprite)
	_world.add_child(_rival_npc)
	_rival_npc.global_position = _grid.cell_to_world(_rival_cell)
	print("Hallie Minerva placed at cell ", _rival_cell)

func _animate_rival(delta: float) -> void:
	if _rival_sprite == null or _rival_frames.size() < 2:
		return
	_rival_frame_t += delta
	if _rival_frame_t >= RIVAL_FRAME_TIME:
		_rival_frame_t = 0.0
		_rival_frame_i = (_rival_frame_i + 1) % _rival_frames.size()
		_rival_sprite.texture = _rival_frames[_rival_frame_i]

func _player_near_rival() -> bool:
	if _rival_npc == null:
		return false
	var pc := _player.current_cell
	return absi(pc.x - _rival_cell.x) <= 1 and absi(pc.y - _rival_cell.y) <= 1

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var key := (event as InputEventKey).keycode
	if _dialog_open:
		if key == KEY_SPACE or key == KEY_ENTER or key == KEY_KP_ENTER:
			_confirm_dialog()
			get_viewport().set_input_as_handled()
		return
	if key == KEY_SPACE and _player_near_rival():
		_open_dialog()
		get_viewport().set_input_as_handled()

func _open_dialog() -> void:
	_dialog_open = true
	_dialog_layer = CanvasLayer.new()
	_dialog_layer.layer = 90
	_dialog_layer.add_to_group("ui_blocker")  # freezes the player
	add_child(_dialog_layer)
	var panel := PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = -520.0
	panel.offset_right = 520.0
	panel.offset_top = -230.0
	panel.offset_bottom = -60.0
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.09, 0.13, 0.96)
	style.border_color = Color(0.85, 0.55, 0.95)
	style.set_border_width_all(3)
	style.set_corner_radius_all(12)
	style.set_content_margin_all(24)
	panel.add_theme_stylebox_override("panel", style)
	_dialog_layer.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 16)
	panel.add_child(vbox)
	var name_lbl := Label.new()
	name_lbl.text = "HALLIE MINERVA"
	name_lbl.add_theme_font_size_override("font_size", 26)
	name_lbl.add_theme_color_override("font_color", Color(0.95, 0.75, 1.0))
	vbox.add_child(name_lbl)
	var body := Label.new()
	body.text = RIVAL_DIALOG_TEXT
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size", 30)
	body.add_theme_color_override("font_color", Color(0.92, 0.94, 1.0))
	vbox.add_child(body)
	var hint := Label.new()
	hint.text = "▶ SPACE"
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hint.add_theme_font_size_override("font_size", 20)
	hint.add_theme_color_override("font_color", Color(0.6, 0.62, 0.7))
	vbox.add_child(hint)

func _close_dialog() -> void:
	_dialog_open = false
	if _dialog_layer != null:
		_dialog_layer.queue_free()
		_dialog_layer = null

func _confirm_dialog() -> void:
	_close_dialog()
	SceneManager.build_rival_team()
	SceneManager.rival_battle = true
	SceneManager.next_battle_player_id = SceneManager.current_player_id
	if not SceneManager.rival_team.is_empty():
		SceneManager.next_battle_enemy_id = String(SceneManager.rival_team[0]["id"])
	else:
		SceneManager.next_battle_enemy_id = "kingfencer"
	print("Rival battle starting vs Hallie Minerva")
	SceneManager.change_scene(BATTLE_SCENE)
