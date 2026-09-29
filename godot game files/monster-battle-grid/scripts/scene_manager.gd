extends Node

const FADE_DURATION := 0.35
const CRT_SHADER := "res://shaders/crt_filter.gdshader"

var _layer: CanvasLayer
var _fade: ColorRect
var _busy: bool = false

# CRT overlay — full-screen post-process on layer 127 (just below the fade)
# so every scene gets it and transitions stay clean. V toggles at runtime.
var crt_enabled: bool = true
var _crt_layer: CanvasLayer
var _crt_rect: ColorRect

# Battle handoff state — overworld writes, battle reads + consumes.
var next_battle_enemy_id: String = ""
var next_battle_player_id: String = ""
# Rival battle (Hallie Minerva): a 3v3 where you must down all three of her
# mons. rival_team = up to 3 {"id","trait_index"} dicts, built when the fight
# starts (guaranteeing a type advantage over your team). Consumed by battle.gd.
var rival_battle: bool = false
var rival_team: Array = []

# Persistent across scenes — the player's currently-selected monster.
# Overworld lets the user cycle this with M; battle reads it for player_monster_id.
var current_player_id: String = "cargot"

# Overworld zone. Portal tiles flip this and reload the overworld;
# spawn_at_portal makes the reload place the player on the matching return
# pad instead of the default spawn. portal_from_zone remembers where the
# trip started so multi-pad zones (zone 1 has three green pads) can land
# the player on the pad that leads back there.
var current_zone: String = "zone1"
var spawn_at_portal: bool = false
var portal_from_zone: String = ""

# Caught mon instances. Catching the same species again adds a NEW instance
# with its own locked trait (user design: hunt duplicates for their traits —
# no "already caught" block). Entry: {"id": String, "trait_index": int}.
# Session-scoped until a save system exists.
var caught_mons: Array = []

# Active team — up to 3 indices into caught_mons. Battle starts with
# team[0]; T cycles through members mid-fight. Managed in the Mon Menu
# (ENTER toggles membership); new catches auto-join while there's room.
const TEAM_SIZE := 3
var team: Array = []

func record_catch(mon_id: String, trait_index: int) -> void:
	caught_mons.append({"id": mon_id, "trait_index": trait_index})
	if team.size() < TEAM_SIZE:
		team.append(caught_mons.size() - 1)
		_sync_partner_to_team()
	print("[CATCH] %s recorded (trait slot %d) — %d caught, team %d/%d" % [
		mon_id, trait_index, caught_mons.size(), team.size(), TEAM_SIZE
	])

func team_toggle(instance: int) -> bool:
	if instance < 0 or instance >= caught_mons.size():
		return false
	if team.has(instance):
		if team.size() <= 1:
			return false  # keep at least one active mon
		team.erase(instance)
	elif team.size() < TEAM_SIZE:
		team.append(instance)
	else:
		return false
	_sync_partner_to_team()
	return true

# The overworld partner / battle starter is always team slot 1.
func _sync_partner_to_team() -> void:
	if team.is_empty():
		return
	var lead: Dictionary = caught_mons[int(team[0])]
	current_player_id = lead["id"]
	current_partner_instance = int(team[0])

func caught_instances(mon_id: String) -> Array:
	var out: Array = []
	for entry in caught_mons:
		if entry["id"] == mon_id:
			out.append(entry)
	return out

# Which caught copy is the active partner — index into caught_mons, or -1
# when the partner is a species-only pick (debug mode / pre-quiz default).
var current_partner_instance: int = -1

# Bug-test mode (user-requested). While true: every species is selectable in
# the Mon Menu regardless of caught status, and T cycles traits (overrides
# below for species rows, rewrites the instance for caught copies).
# Default OFF now the intro starter-select gates the roster — press ESC on
# the intro screen to flip it ON for a dev session (or set true here).
var debug_unlock_all: bool = false
var debug_trait_overrides: Dictionary = {}  # mon_id -> trait index (0/1/2)

# The trait index battle should force on the PLAYER combatant, or -1 to roll
# fresh. Priority: the selected caught instance (if it matches the id being
# fielded), then a debug override, then roll.
func partner_trait_index(mon_id: String) -> int:
	if current_partner_instance >= 0 and current_partner_instance < caught_mons.size():
		var entry: Dictionary = caught_mons[current_partner_instance]
		if entry["id"] == mon_id:
			return int(entry["trait_index"])
	if debug_unlock_all and debug_trait_overrides.has(mon_id):
		return int(debug_trait_overrides[mon_id])
	return -1

# Build Hallie's 3-mon team, GUARANTEEING at least one of hers type-beats one
# of yours. The type wheel: each type does 1.1x vs the NEXT, so the counter to
# a player type P is the type immediately BEFORE P in the wheel. Slot 1 is a
# mon of that counter type; slots 2-3 are distinct random roster mons. Traits
# roll fresh in battle (trait_index -1), like wild mons.
const _TYPE_WHEEL := ["fire", "grass", "earth", "electric", "wind", "fighting", "mind", "dark", "light", "time", "ice", "water"]

func build_rival_team() -> void:
	rival_team.clear()
	# Collect the player's team types (fall back to the active partner).
	var player_types: Array = []
	for inst in team:
		if inst >= 0 and inst < caught_mons.size():
			var pdef := MonsterRoster.load_by_id(String(caught_mons[inst]["id"]))
			if pdef != null:
				player_types.append(pdef.monster_type)
	if player_types.is_empty():
		var d := MonsterRoster.load_by_id(current_player_id)
		if d != null:
			player_types.append(d.monster_type)
	# Counter type for a randomly chosen player mon.
	var counter_type := ""
	if not player_types.is_empty():
		var target: String = player_types[randi() % player_types.size()]
		var ti := _TYPE_WHEEL.find(target)
		if ti >= 0:
			counter_type = _TYPE_WHEEL[(ti - 1 + _TYPE_WHEEL.size()) % _TYPE_WHEEL.size()]
	var pool: Array = MonsterRoster.IDS.duplicate()
	pool.append_array(MonsterRoster.ZONE2_IDS)
	pool.append_array(MonsterRoster.ZONE3_IDS)
	var picked: Array = []
	if counter_type != "":
		var c := _pick_mon_of_type(pool, counter_type)
		if c != "":
			picked.append(c)
	pool.shuffle()
	for id in pool:
		if picked.size() >= 3:
			break
		if id not in picked:
			picked.append(id)
	for id in picked:
		rival_team.append({"id": id, "trait_index": -1})
	print("Rival team built (counter=%s): %s" % [counter_type, str(picked)])

func _pick_mon_of_type(pool: Array, type: String) -> String:
	var matches: Array = []
	for id in pool:
		var def := MonsterRoster.load_by_id(id)
		if def != null and def.monster_type == type:
			matches.append(id)
	return String(matches[randi() % matches.size()]) if not matches.is_empty() else ""

func _ready() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 128
	add_child(_layer)
	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.anchor_right = 1.0
	_fade.anchor_bottom = 1.0
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_layer.add_child(_fade)
	_setup_crt_overlay()

func _setup_crt_overlay() -> void:
	var shader := load(CRT_SHADER) as Shader
	if shader == null:
		push_warning("SceneManager: CRT shader missing at %s" % CRT_SHADER)
		return
	_crt_layer = CanvasLayer.new()
	_crt_layer.layer = 127
	add_child(_crt_layer)
	_crt_rect = ColorRect.new()
	_crt_rect.color = Color.WHITE
	_crt_rect.anchor_right = 1.0
	_crt_rect.anchor_bottom = 1.0
	_crt_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mat := ShaderMaterial.new()
	mat.shader = shader
	_crt_rect.material = mat
	_crt_layer.add_child(_crt_rect)
	_crt_rect.visible = crt_enabled

# V toggles the CRT everywhere. _input (not _unhandled_input) so scenes that
# blanket-consume keys (intro) can't eat it; MonMenu still swallows it while
# open, which is fine.
func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_V:
		crt_enabled = not crt_enabled
		if _crt_rect != null:
			_crt_rect.visible = crt_enabled
		print("[CRT] filter %s" % ("ON" if crt_enabled else "OFF"))

func change_scene(path: String) -> void:
	if _busy:
		return
	_busy = true
	await _tween_alpha(1.0)
	get_tree().change_scene_to_file(path)
	await get_tree().process_frame
	await _tween_alpha(0.0)
	_busy = false

func _tween_alpha(target: float) -> void:
	var tween := create_tween()
	tween.tween_property(_fade, "color:a", target, FADE_DURATION)
	await tween.finished
