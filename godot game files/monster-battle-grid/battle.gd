class_name Battle
extends Node3D

const GRID_COLS := 4
const GRID_ROWS := 4
const CELL_SPACING := 2.5
const COMBATANT_Y := 0.16
const MOVE_TIME := 0.14

const SIDE_PLAYER := "player"
const SIDE_ENEMY := "enemy"

const PLAYER_GRID_PATH := "res://art/battle/battleground_B2.glb"
const ENEMY_GRID_PATH := "res://art/battle/battleground_R2.glb"
const BACKGROUND_PATH := "res://art/battle/battleground_bg.glb"

@export_group("Background")
@export var background_rotation_deg: float = -90.0
@export var background_world_center: Vector3 = Vector3(-6.2, -12.6, -15.4)
@export var background_scale: float = 3.6

const BULLET_SCENE := preload("res://bullet.tscn")
const WALL_SCENE := preload("res://wall.tscn")
const TILE_SCENE := preload("res://timed_effect.tscn")
const TURRET_SCENE := preload("res://turret.tscn")
const POPUP_SCENE := preload("res://damage_popup.tscn")
# Mushroom's charged-walker basic spawns a fairy-ring-style forward walker
# at the caster's cell. Same sprite as Fairy Ring's mushrooms.
const BASIC_MUSHROOM_SPRITE := preload("res://art/allies/mushroom_soldier.png")
const POPUP_OFFSET := Vector3(0.0, 2.0, 0.0)

@export var player_monster_id: String = "cargot"
@export var enemy_monster_id: String = "slime"
@export var enemy_fire_interval: float = 2.2
@export var enemy_move_interval: float = 1.4
# Enemy card AI — random playable card from its 2-card hand on a jittered
# cadence (mana is the natural throttle). Tune difficulty here.
@export var enemy_card_interval_min: float = 3.5
@export var enemy_card_interval_max: float = 5.5
@export var enemy_first_card_delay: float = 4.0

var _enemy_fire_timer: float = 0.0
var _enemy_move_timer: float = 0.0
var _enemy_card_timer: float = 0.0
var _enemy_next_card_in: float = 4.0
var _enemy_hand_panel: HandPanel = null
var _enemy_card_label: Label = null
var _announce_tween: Tween = null
var _enemy_moving: bool = false
var _battle_over: bool = false
var _hitstop_remaining: float = 0.0
# Team swap (T key) — cycle through SceneManager.team (up to 3 caught
# copies) mid-battle. Each member keeps its own HP/mana within this battle;
# statuses/buffs clear on swap (apply_def), which is the tactical trade.
const TEAM_SWAP_CD_MS := 3000
var _team_swap_cd_until_ms: int = 0
var _team_member_state: Dictionary = {}  # caught_mons index -> {hp, mana}

# Rival 3v3 (Hallie Minerva). When _rival_battle both sides field up to three
# mons: the enemy sends in her next mon when the active one faints (and will
# occasionally AI-switch), and the player auto-swaps to the next LIVING team
# member on KO. The fight ends only when a whole side is down. A short
# "Ready / Set / Go" countdown opens the match — movement is allowed during
# it, abilities are locked (rival battles only).
var _rival_battle: bool = false
var _enemy_team: Array = []               # of {"id","trait_index"} — Hallie's mons
var _enemy_team_index: int = 0
var _enemy_team_dead: Array = []          # bool per _enemy_team slot
var _enemy_team_state: Dictionary = {}    # team slot -> {hp, mana}, banked on AI-switch
const ENEMY_SWAP_CD_MS := 6000
const ENEMY_SWAP_CHANCE := 0.15           # per card-AI beat, when >1 mon is up
var _enemy_swap_cd_until_ms: int = 0
# Player faint-swap tracking (rival battles) — caught_mons instances that have
# already been KO'd this fight, so we never send a dead mon back in.
var _player_team_dead: Dictionary = {}
var _countdown_active: bool = false

# Insidibear RAGE (zone-2 row 18) — every 3rd landed basic ignites it: cards
# x1.2 (cards ONLY — all_card_mult buff key), rage skin, and his basic
# becomes a stunning laser on a 3s CD. 15s or until swapped; Short Fuse
# variant = starts raging, 10s, takes x1.2 while it burns.
const RAGE_MS := 15000
const RAGE_RISKY_MS := 10000
const RAGE_CARD_MULT := 1.2
const RAGE_RISKY_TAKEN := 1.2
const INSIDIBEAR_RAGE_HITS := 3
const RAGE_LASER_CD_MS := 3000
const RAGE_LASER_DAMAGE := 12
const RAGE_LASER_STUN_MS := 1000
const RAGE_LASER_SPEED := 24.0
const RAGE_SLOW_SHOT_DAMAGE := 8
const RAGE_SLOW_SHOT_SPEED := 6.5
const INSIDIBEAR_RAGE_SPRITE := "res://art/monsters/insidibear_rage.png"

# Inside Job (Insidibear secret) — the benched bear lurks behind the enemy
# grid, pacing rows, pot-shotting the enemy when they share his row AND
# stand in their rear tiles.
const GHOST_MOVE_S := 0.9
const GHOST_SHOT_CD_S := 2.0
const GHOST_DAMAGE := 6
const GHOST_REAR_COLS := 2
var _inside_job_ghost: Node3D = null
var _inside_job_instance: int = -1
var _ghost_row: int = 0
var _ghost_dir: int = 1
var _ghost_move_timer: float = 0.0
var _ghost_shot_timer: float = 0.0

# Lingering Shadow (Wherewolf trait) — swap-out leaves a shadow prowling the
# opponent's grid; contact stuns 1s and spends it. Recalled on swap-back.
var _lingering_shadow: Node3D = null
var _lingering_cell: Vector2i = Vector2i.ZERO
var _lingering_instance: int = -1
var _lingering_step_timer: float = 0.0

# Catch mechanic (C key) — lasso-style line 4 tiles ahead on the player's
# row. Eligible when the enemy is at/below 25% max HP; the 1.5s attempt
# freezes both sides (_catch_pause gates _process AI + player input).
const CATCH_RANGE := 4
const CATCH_MANA_COST := 3
const CATCH_CD_MS := 1000
const CATCH_HP_FRACTION := 0.25
const CATCH_PAUSE_S := 1.5
const CATCH_COLOR := Color(0.75, 0.50, 0.95)
var _catch_cd_until_ms: int = 0
var _catch_pause: bool = false
var _charge_indicator: Node3D = null  # Malipole charge halo (SPACE-hold)
# Atomippo Crushing Field column-steal state. While active, the stolen
# column cells (4 cells on the opposing grid at zone_steal_col, all rows)
# are blocked to non-owner combatants. MVP scope: caster cannot YET walk
# onto the stolen column (deferred until cell-tracking allows cross-side
# logical positions). The column visuals + opp-block + DoT pressure tiles
# on the adjacent column all still resolve correctly.
var _zone_steal: Dictionary = {}  # {owner, side, col, expires_at_ms, visuals: Array[Node3D]}
var _shake_remaining: float = 0.0
var _shake_total: float = 0.0
var _shake_max_amount: float = 0.0
var _camera_base_position: Vector3 = Vector3.ZERO

const PLAYER_GRID_OFFSET := Vector3(-9.25, 0.0, 3.75)
const ENEMY_GRID_OFFSET := Vector3(1.75, 0.0, 3.75)

@onready var _world: Node3D = $World
@onready var _player: Combatant = $Player
@onready var _enemy: Combatant = $Enemy
@onready var _camera: Camera3D = $Camera3D
@onready var _player_panel: CombatantPanel = $UI/PlayerPanel
@onready var _enemy_panel: CombatantPanel = $UI/EnemyPanel
@onready var _hand_panel: HandPanel = $UI/HandPanel

var _player_cell: Vector2i = Vector2i(GRID_COLS - 1, GRID_ROWS / 2)
var _enemy_cell: Vector2i = Vector2i(0, GRID_ROWS / 2)
var _moving: bool = false
var _walls: Array = []  # of Wall
var _tiles: Array = []  # of TimedEffect
var _turrets: Array = []  # of Turret

func _ready() -> void:
	_setup_camera()
	_spawn_background(BACKGROUND_PATH)
	_spawn_grid(PLAYER_GRID_PATH, PLAYER_GRID_OFFSET, "PlayerGrid")
	_spawn_grid(ENEMY_GRID_PATH, ENEMY_GRID_OFFSET, "EnemyGrid")
	if SceneManager.next_battle_enemy_id != "":
		enemy_monster_id = SceneManager.next_battle_enemy_id
		SceneManager.next_battle_enemy_id = ""
	if SceneManager.next_battle_player_id != "":
		player_monster_id = SceneManager.next_battle_player_id
		SceneManager.next_battle_player_id = ""
	# Caught partner copies fight with their locked trait; species-only picks
	# (debug mode) and enemies roll fresh.
	_player.apply_def(MonsterRoster.load_by_id(player_monster_id), SceneManager.partner_trait_index(player_monster_id))
	_enemy.apply_def(MonsterRoster.load_by_id(enemy_monster_id))
	# Rival 3v3 (Hallie): capture her team and arm the faint-swap machinery.
	# enemy_monster_id already loaded rival_team[0] above (overworld set it as
	# next_battle_enemy_id), so slot 0 is already in the field. Consume the flag.
	if SceneManager.rival_battle and not SceneManager.rival_team.is_empty():
		_rival_battle = true
		_enemy_team = SceneManager.rival_team.duplicate(true)
		_enemy_team_index = 0
		_enemy_team_dead.resize(_enemy_team.size())
		_enemy_team_dead.fill(false)
		# Apply slot 0's trait (-1 = the random roll apply_def already did).
		var lead_trait := int(_enemy_team[0].get("trait_index", -1))
		if lead_trait >= 0:
			_enemy.apply_def(MonsterRoster.load_by_id(enemy_monster_id), lead_trait)
		SceneManager.rival_battle = false
		print("RIVAL 3v3 — Hallie fields %d mons: %s" % [_enemy_team.size(), str(_enemy_team)])
	_player.global_position = _player_cell_to_world(_player_cell)
	_enemy.global_position = _enemy_cell_to_world(_enemy_cell)
	_player.damaged.connect(_on_combatant_damaged.bind(_player, "player"))
	_enemy.damaged.connect(_on_combatant_damaged.bind(_enemy, "enemy"))
	_player.blocked.connect(_on_combatant_blocked.bind("player"))
	_enemy.blocked.connect(_on_combatant_blocked.bind("enemy"))
	_player.died.connect(_on_combatant_died.bind("player"))
	_enemy.died.connect(_on_combatant_died.bind("enemy"))
	_player.died.connect(_on_player_died)
	_enemy.died.connect(_on_enemy_died)
	_player.damaged.connect(_on_damage_popup.bind(_player))
	_enemy.damaged.connect(_on_damage_popup.bind(_enemy))
	_player.blocked.connect(_on_blocked_popup.bind(_player))
	_enemy.blocked.connect(_on_blocked_popup.bind(_enemy))
	_player.healed.connect(_on_heal_popup.bind(_player))
	_enemy.healed.connect(_on_heal_popup.bind(_enemy))
	_player.damaged.connect(_on_damage_shake)
	_enemy.damaged.connect(_on_damage_shake)
	_player.stunned.connect(_on_stunned.bind(_player))
	_enemy.stunned.connect(_on_stunned.bind(_enemy))
	_player.unstunned.connect(_on_unstunned.bind(_player))
	_enemy.unstunned.connect(_on_unstunned.bind(_enemy))
	_player.poisoned.connect(_on_poisoned.bind(_player))
	_enemy.poisoned.connect(_on_poisoned.bind(_enemy))
	_player.unpoisoned.connect(_on_unpoisoned.bind(_player))
	_enemy.unpoisoned.connect(_on_unpoisoned.bind(_enemy))
	_player.burned.connect(_on_burned.bind(_player))
	_enemy.burned.connect(_on_burned.bind(_enemy))
	_player.unburned.connect(_on_unburned.bind(_player))
	_enemy.unburned.connect(_on_unburned.bind(_enemy))
	_player.thorn_shield_changed.connect(_on_thorn_shield_changed.bind(_player))
	_enemy.thorn_shield_changed.connect(_on_thorn_shield_changed.bind(_enemy))
	_player.silenced.connect(_on_silenced.bind(_player))
	_enemy.silenced.connect(_on_silenced.bind(_enemy))
	_player.unsilenced.connect(_on_unsilenced.bind(_player))
	_enemy.unsilenced.connect(_on_unsilenced.bind(_enemy))
	_player.blinded.connect(_on_blinded.bind(_player))
	_enemy.blinded.connect(_on_blinded.bind(_enemy))
	_player.unblinded.connect(_on_unblinded.bind(_player))
	_enemy.unblinded.connect(_on_unblinded.bind(_enemy))
	_player.rooted.connect(_on_rooted.bind(_player))
	_enemy.rooted.connect(_on_rooted.bind(_enemy))
	_player.unrooted.connect(_on_unrooted.bind(_player))
	_enemy.unrooted.connect(_on_unrooted.bind(_enemy))
	_player.slept.connect(_on_slept.bind(_player))
	_enemy.slept.connect(_on_slept.bind(_enemy))
	_player.woke.connect(_on_woke.bind(_player))
	_enemy.woke.connect(_on_woke.bind(_enemy))
	# Trait hooks that react to TAKING damage (Tinder Nerves) — signal
	# listeners, never inside take_damage itself.
	_player.damaged.connect(_on_damaged_trait_hooks.bind(_player))
	_enemy.damaged.connect(_on_damaged_trait_hooks.bind(_enemy))
	# Card hooks on blocked hits (Litany of Stone's full absorbs refund mana).
	_player.blocked.connect(_on_blocked_card_hooks.bind(_player))
	_enemy.blocked.connect(_on_blocked_card_hooks.bind(_enemy))
	# Buff-expiry hooks (rage skin restore).
	_player.buff_expired.connect(_on_buff_expired_hooks.bind(_player))
	_enemy.buff_expired.connect(_on_buff_expired_hooks.bind(_enemy))
	_player.poison_absorb_changed.connect(_on_poison_absorb_changed.bind(_player))
	_enemy.poison_absorb_changed.connect(_on_poison_absorb_changed.bind(_enemy))
	_player.guarded_gained.connect(_on_guarded_gained.bind(_player))
	_enemy.guarded_gained.connect(_on_guarded_gained.bind(_enemy))
	_player.guarded_lost.connect(_on_guarded_lost.bind(_player))
	_enemy.guarded_lost.connect(_on_guarded_lost.bind(_enemy))
	# Guarded's Shell Cover check queries walls at damage time.
	_player.battle_ctx = self
	_enemy.battle_ctx = self
	_player_panel.bind_combatant(_player, Color(0.35, 0.65, 1.0))
	_enemy_panel.bind_combatant(_enemy, Color(1.0, 0.45, 0.45))
	# Only the enemy panel advertises the catch window (all battles are wild;
	# trainer battles will clear this flag when they exist).
	_enemy_panel.show_catchable = true
	_hand_panel.bind_combatant(_player, self)
	# Enemy hand — visible top-right under the enemy HP panel (user design),
	# scaled down. Reuses HandPanel wholesale; the refresh hint is hidden and
	# no input ever routes here (the AI plays through play_flourish + play_card).
	_enemy_hand_panel = load("res://hand_panel.tscn").instantiate() as HandPanel
	($UI as CanvasLayer).add_child(_enemy_hand_panel)
	_enemy_hand_panel.anchor_left = 1.0
	_enemy_hand_panel.anchor_right = 1.0
	_enemy_hand_panel.anchor_top = 0.0
	_enemy_hand_panel.anchor_bottom = 0.0
	_enemy_hand_panel.offset_left = -500.0
	_enemy_hand_panel.offset_right = 100.0
	_enemy_hand_panel.offset_top = 122.0
	_enemy_hand_panel.offset_bottom = 372.0
	_enemy_hand_panel.scale = Vector2(1.2, 1.2)
	_enemy_hand_panel.get_node("RefreshLabel").visible = false
	_enemy_hand_panel.bind_combatant(_enemy, self)
	# Short Fuse — an Insidibear on either side opens the fight already raging.
	if TraitRegistry.rage_at_start(_player.traits):
		_apply_rage(_player)
	if TraitRegistry.rage_at_start(_enemy.traits):
		_apply_rage(_enemy)
	# Top-center announcement for enemy card plays.
	_enemy_card_label = Label.new()
	_enemy_card_label.anchor_left = 0.5
	_enemy_card_label.anchor_right = 0.5
	_enemy_card_label.offset_left = -320.0
	_enemy_card_label.offset_right = 320.0
	_enemy_card_label.offset_top = 14.0
	_enemy_card_label.offset_bottom = 44.0
	_enemy_card_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_enemy_card_label.add_theme_font_size_override("font_size", 20)
	_enemy_card_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_enemy_card_label.add_theme_constant_override("outline_size", 6)
	_enemy_card_label.modulate.a = 0.0
	($UI as CanvasLayer).add_child(_enemy_card_label)
	_enemy_next_card_in = enemy_first_card_delay
	print("Battle ready  player_cell=%s @ %s  enemy_cell=%s @ %s" % [
		_player_cell, _player.global_position, _enemy_cell, _enemy.global_position
	])
	print("Player: %s (%s) HP=%d/%d  trait=%s" % [
		_player.display_name, _player.monster_type, _player.hp, _player.max_hp,
		_trait_name(_player)
	])
	print("Enemy:  %s (%s) HP=%d/%d  trait=%s" % [
		_enemy.display_name, _enemy.monster_type, _enemy.hp, _enemy.max_hp,
		_trait_name(_enemy)
	])
	# Ready / Set / Go — rival battles only (per spec). Movement stays live so
	# both sides can jockey for position; abilities unlock on "GO!".
	if _rival_battle:
		_start_countdown()

func _trait_name(c: Combatant) -> String:
	if c.traits.size() > 0 and c.traits[0] != null:
		return (c.traits[0] as TraitDef).id
	return "none"

func _on_combatant_damaged(amount: int, mult: float, source_type: String, source: String, who: Combatant, label: String) -> void:
	print("%s took %d dmg (%s vs %s, x%.2f %s)  source=%s  hp=%d/%d" % [
		label.to_upper(), amount, source_type, who.monster_type, mult,
		TypeWheel.describe(mult), source, who.hp, who.max_hp
	])

func _on_combatant_blocked(reason: String, label: String) -> void:
	print("%s BLOCKED (%s)" % [label.to_upper(), reason])

func _on_combatant_died(label: String) -> void:
	print("%s DIED" % label.to_upper())

func _process(delta: float) -> void:
	_update_shake(delta)
	if _battle_over:
		return
	if _catch_pause:
		return  # catch attempt in progress — both sides hold still
	if _countdown_active:
		return  # Ready/Set/Go — enemy AI + status ticks frozen; player may move
	if _hitstop_remaining > 0.0:
		_hitstop_remaining = maxf(0.0, _hitstop_remaining - delta)
		return
	if not _enemy.is_alive() or not _player.is_alive():
		return
	# Phantom-cell validity: if the player stands on an extended cell and
	# neither a zone steal nor an owned stolen tile justifies it any more
	# (Giant's tile expired underfoot), send him home. From the enemy FRONT
	# column that's a gentle free snap — he could have walked back. From any
	# DEEPER column he was stranded in enemy territory: forced return + 2s
	# stun (user rule).
	if _player_cell.x >= GRID_COLS:
		var ext_col := _player_cell.x - GRID_COLS
		var zone_ok := _player_cell.x == GRID_COLS and _player_can_extend_zone_steal()
		if not zone_ok and not _player_stolen_tile_at(ext_col, _player_cell.y):
			var was_deep := ext_col >= 1
			var snap_cell := Vector2i(GRID_COLS - 1, _player_cell.y)
			_player_cell = snap_cell
			var snap := create_tween()
			snap.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
			snap.tween_property(_player, "global_position", _player_cell_to_world(snap_cell), 0.25)
			if was_deep:
				_player.apply_stun(2000)
				print("%s stranded deep in enemy territory — hauled home and stunned" % _player.display_name)
	# Inside Job lurker paces + shoots regardless of the enemy's stun state.
	_tick_inside_job(delta)
	# Lingering Shadow prowls (and grips) regardless of the enemy's stun state.
	_tick_lingering_shadow(delta)
	# Frozen enemy AI under stun OR sleep — timers pause so behavior resumes
	# cleanly (a sleeping enemy does nothing until damage wakes it).
	if _enemy.is_stunned() or _enemy.is_asleep():
		return
	_enemy_fire_timer += delta
	if _enemy_fire_timer >= enemy_fire_interval:
		_enemy_fire_timer = 0.0
		_fire_basic(_enemy, Vector3.LEFT)
	_enemy_move_timer += delta
	if _enemy_move_timer >= enemy_move_interval:
		_enemy_move_timer = 0.0
		_try_move_enemy_random()
	# Card AI — jittered cadence; a stunned enemy pauses (return above), a
	# silenced one hesitates (can_play fails, the beat is spent).
	_enemy_card_timer += delta
	if _enemy_card_timer >= _enemy_next_card_in:
		_enemy_card_timer = 0.0
		_enemy_next_card_in = randf_range(enemy_card_interval_min, enemy_card_interval_max)
		# Rival Hallie occasionally rotates to another live mon instead of
		# playing a card — spends the beat if she does.
		if _rival_battle and _enemy_try_switch():
			return
		_enemy_try_play_card()

func _on_damage_shake(amount: int, _mult: float, _src_type: String, _src: String) -> void:
	if amount >= 25:
		_trigger_hitstop(0.14)
		_trigger_shake(0.28, 0.16)
	elif amount >= 10:
		_trigger_hitstop(0.07)
		_trigger_shake(0.18, 0.09)
	else:
		_trigger_shake(0.12, 0.05)

func _trigger_hitstop(seconds: float) -> void:
	_hitstop_remaining = maxf(_hitstop_remaining, seconds)

func _trigger_shake(duration: float, max_amount: float) -> void:
	if duration > _shake_remaining or max_amount > _shake_max_amount:
		_shake_remaining = duration
		_shake_total = duration
		_shake_max_amount = max_amount

func _update_shake(delta: float) -> void:
	if _camera_base_position == Vector3.ZERO:
		return
	if _shake_remaining > 0.0:
		_shake_remaining = maxf(0.0, _shake_remaining - delta)
		var t := _shake_remaining / _shake_total
		var a := _shake_max_amount * t
		var offset := Vector3(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * a
		_camera.position = _camera_base_position + offset
	elif _camera.position != _camera_base_position:
		_camera.position = _camera_base_position

func _try_move_enemy_random() -> void:
	if _enemy_moving or not _enemy.is_alive() or _enemy.is_rooted() or _enemy.is_rushing():
		return
	# Event Horizon — same toggle as the player. The first step from a
	# gravity tile gets consumed; the next tick of the AI walk timer steps
	# through normally.
	if _is_gravity_tile_at(SIDE_ENEMY, _enemy_cell):
		if not _enemy.gravity_pending:
			_enemy.gravity_pending = true
			return
		_enemy.gravity_pending = false
	else:
		_enemy.gravity_pending = false
	var dirs: Array[Vector2i] = [
		Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)
	]
	dirs.shuffle()
	for dir in dirs:
		var target := _enemy_cell + dir
		if target.x < 0 or target.x >= GRID_COLS:
			continue
		if target.y < 0 or target.y >= GRID_ROWS:
			continue
		if combatant_blocked_at(SIDE_ENEMY, target):
			continue  # wall OR broken_tile blocks traversal
		_enemy_cell = target
		# Record travel direction — frozen tiles slide you the way you were going.
		_enemy.last_move_direction = dir
		_enemy_moving = true
		var dest := _enemy_cell_to_world(target)
		var tween := create_tween()
		tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tween.tween_property(_enemy, "global_position", dest, MOVE_TIME * 1.4)
		tween.finished.connect(func() -> void: _enemy_moving = false)
		return

# === ENEMY CARD AI ===
# Mirrors the player's card flow exactly: random playable card from the
# 2-card hand via can_play/play_card, executed through MoveRegistry (all
# handlers are side-aware, so effects resolve mirrored automatically).
# Granted bonus cards (Shatter / Return) get a 50% look-in first so they
# don't rot in the third slot.

func _enemy_try_play_card() -> void:
	if _battle_over or _catch_pause or not _enemy.is_alive():
		return
	if _enemy.can_play_bonus() and randf() < 0.5:
		_enemy_hand_panel.play_bonus_flourish()
		var bonus := _enemy.play_bonus_card()
		if bonus != null:
			_announce_enemy_card(bonus)
			MoveRegistry.execute(bonus, _enemy, self)
			return
	var playable: Array = []
	for i in range(_enemy.hand.size()):
		if _enemy.can_play(i):
			playable.append(i)
	if playable.is_empty():
		return
	var idx: int = playable.pick_random()
	_enemy_hand_panel.play_flourish(idx)
	var played := _enemy.play_card(idx)
	if played != null:
		_announce_enemy_card(played)
		MoveRegistry.execute(played, _enemy, self)

func _announce_enemy_card(card: MoveDef) -> void:
	_spawn_popup(_enemy.global_position + POPUP_OFFSET, "⚡ %s" % card.display_name.to_upper(), CombatantPanel._type_color(card.move_type))
	if _enemy_card_label == null:
		return
	_enemy_card_label.text = "%s played %s" % [_enemy.display_name.to_upper(), card.display_name.to_upper()]
	_enemy_card_label.add_theme_color_override("font_color", CombatantPanel._type_color(card.move_type))
	if _announce_tween != null and _announce_tween.is_valid():
		_announce_tween.kill()
	_enemy_card_label.modulate.a = 1.0
	_announce_tween = create_tween()
	_announce_tween.tween_interval(1.2)
	_announce_tween.tween_property(_enemy_card_label, "modulate:a", 0.0, 0.4)

func _on_enemy_died() -> void:
	# Rival 3v3 — Hallie sends in her next living mon; victory only when her
	# whole team is down.
	if _rival_battle:
		if _enemy_team_index >= 0 and _enemy_team_index < _enemy_team_dead.size():
			_enemy_team_dead[_enemy_team_index] = true
		var nxt := _next_living_enemy_index()
		if nxt >= 0:
			_enemy_swap_to(nxt, false)
			_announce_center("HALLIE SENDS OUT %s!" % _enemy.display_name.to_upper(), Color(1.0, 0.55, 0.55))
			return
	_show_result_animation("victory")

func _on_player_died() -> void:
	# Rival 3v3 — auto-swap to the next living team member; defeat only when the
	# whole player team is down (symmetric with Hallie's swap-on-faint).
	if _rival_battle and _player_faint_swap():
		return
	_show_result_animation("defeat")

# === RIVAL 3v3 (HALLIE) ===

# The next of Hallie's mons that hasn't fainted, scanning forward from the
# active slot. -1 when her whole team is down.
func _next_living_enemy_index() -> int:
	for step in range(1, _enemy_team.size()):
		var idx := (_enemy_team_index + step) % _enemy_team.size()
		if idx < _enemy_team_dead.size() and not _enemy_team_dead[idx]:
			return idx
	return -1

# Reload the ENEMY combatant node with another of Hallie's mons. bank_current
# preserves the outgoing mon's HP/mana for a voluntary AI-switch (so switching
# back resumes it); a faint-swap passes false (the outgoing mon is dead).
func _enemy_swap_to(index: int, bank_current: bool) -> void:
	if index < 0 or index >= _enemy_team.size():
		return
	if bank_current and _enemy.is_alive():
		_enemy_team_state[_enemy_team_index] = {"hp": _enemy.hp, "mana": _enemy.mana}
	_enemy_team_index = index
	var entry: Dictionary = _enemy_team[index]
	var def := MonsterRoster.load_by_id(String(entry["id"]))
	if def == null:
		return
	# apply_def emits trait_changed/hand_changed/mana_changed → the enemy panel
	# and enemy hand panel (both bound to _enemy) refresh themselves.
	_enemy.apply_def(def, int(entry.get("trait_index", -1)))
	enemy_monster_id = String(entry["id"])
	# Resume a previously-benched mon's banked pools (a fresh mon has none).
	if _enemy_team_state.has(index):
		var st: Dictionary = _enemy_team_state[index]
		_enemy.hp = clampi(int(st["hp"]), 1, _enemy.max_hp)
		_enemy.mana = clampi(int(st["mana"]), 0, _enemy.max_mana)
		_enemy.mana_changed.emit(_enemy.mana, _enemy.max_mana)
	_enemy.global_position = _enemy_cell_to_world(_enemy_cell)
	_enemy_swap_cd_until_ms = Time.get_ticks_msec() + ENEMY_SWAP_CD_MS
	# Short Fuse — swapping in counts as entering the fight.
	if TraitRegistry.rage_at_start(_enemy.traits):
		_apply_rage(_enemy)
	# Swap punch, mirroring the player's T-swap flourish.
	_enemy.scale = Vector3(0.5, 0.5, 0.5)
	var pop := create_tween()
	pop.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	pop.tween_property(_enemy, "scale", Vector3.ONE, 0.3)
	print("Hallie → %s (mon %d/%d)" % [_enemy.display_name, _enemy_team_index + 1, _enemy_team.size()])

# Voluntary AI-switch — a low per-beat chance to rotate to another live mon.
# Not while stunned/asleep or on cooldown. Returns true if it switched.
func _enemy_try_switch() -> bool:
	if _enemy.is_stunned() or _enemy.is_asleep():
		return false
	if Time.get_ticks_msec() < _enemy_swap_cd_until_ms:
		return false
	# Collect live alternatives.
	var alts: Array = []
	for i in range(_enemy_team.size()):
		if i == _enemy_team_index:
			continue
		if i < _enemy_team_dead.size() and not _enemy_team_dead[i]:
			alts.append(i)
	if alts.is_empty():
		return false
	if randf() >= ENEMY_SWAP_CHANCE:
		return false
	_enemy_swap_to(int(alts.pick_random()), true)
	_announce_center("HALLIE SWITCHES TO %s!" % _enemy.display_name.to_upper(), Color(1.0, 0.7, 0.5))
	return true

# Player symmetric faint-swap: on active-mon KO, field the next living team
# member. Returns false (→ defeat) when the whole team is down. Benched mons
# never take damage, so any team member other than a KO'd one is alive.
func _player_faint_swap() -> bool:
	var team: Array = SceneManager.team
	if team.size() <= 1:
		return false
	var cur := SceneManager.current_partner_instance
	_player_team_dead[cur] = true
	var pos := team.find(cur)
	if pos < 0:
		pos = 0
	var target := -1
	for step in range(1, team.size()):
		var idx := int(team[(pos + step) % team.size()])
		if not bool(_player_team_dead.get(idx, false)):
			target = idx
			break
	if target < 0:
		return false
	var entry: Dictionary = SceneManager.caught_mons[target]
	var def := MonsterRoster.load_by_id(String(entry["id"]))
	if def == null:
		return false
	_player.apply_def(def, int(entry["trait_index"]))
	player_monster_id = String(entry["id"])
	SceneManager.current_partner_instance = target
	SceneManager.current_player_id = String(entry["id"])
	# Resume banked pools if this member already fought and was swapped out.
	if _team_member_state.has(target):
		var st: Dictionary = _team_member_state[target]
		_player.hp = clampi(int(st["hp"]), 1, _player.max_hp)
		_player.mana = clampi(int(st["mana"]), 0, _player.max_mana)
		_player.mana_changed.emit(_player.mana, _player.max_mana)
	# Short Fuse — entering the fight ignites rage.
	if TraitRegistry.rage_at_start(_player.traits):
		_apply_rage(_player)
	_player.global_position = _player_cell_to_world(_player_cell)
	_player.scale = Vector3(0.5, 0.5, 0.5)
	var pop := create_tween()
	pop.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	pop.tween_property(_player, "scale", Vector3.ONE, 0.3)
	_spawn_popup(_player.global_position, "▶ %s" % _player.display_name.to_upper(), Color(0.55, 0.85, 1.0))
	_announce_center("GO, %s!" % _player.display_name.to_upper(), Color(0.55, 0.85, 1.0))
	print("Player faint-swap → %s" % _player.display_name)
	return true

# Big fading center message (mon send-ins / switches). Reuses a transient
# Label under the UI layer; independent of the enemy card announcer.
func _announce_center(text: String, color: Color) -> void:
	var ui := $UI as CanvasLayer
	var lbl := Label.new()
	lbl.text = text
	lbl.modulate = color
	lbl.add_theme_font_size_override("font_size", 40)
	lbl.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl.add_theme_constant_override("outline_size", 8)
	lbl.anchor_left = 0.5
	lbl.anchor_right = 0.5
	lbl.anchor_top = 0.35
	lbl.anchor_bottom = 0.35
	lbl.offset_left = -400.0
	lbl.offset_right = 400.0
	lbl.offset_top = -30.0
	lbl.offset_bottom = 30.0
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	ui.add_child(lbl)
	var tw := create_tween()
	tw.tween_interval(1.2)
	tw.tween_property(lbl, "modulate:a", 0.0, 0.5)
	tw.tween_callback(lbl.queue_free)

# Ready / Set / Go — 3s opening countdown. Sets _countdown_active (blocks
# abilities + freezes enemy AI via _process); movement input is unaffected.
func _start_countdown() -> void:
	_countdown_active = true
	var ui := $UI as CanvasLayer
	var lbl := Label.new()
	lbl.add_theme_font_size_override("font_size", 88)
	lbl.add_theme_color_override("font_outline_color", Color.BLACK)
	lbl.add_theme_constant_override("outline_size", 12)
	lbl.anchor_left = 0.5
	lbl.anchor_right = 0.5
	lbl.anchor_top = 0.5
	lbl.anchor_bottom = 0.5
	lbl.offset_left = -400.0
	lbl.offset_right = 400.0
	lbl.offset_top = -80.0
	lbl.offset_bottom = 80.0
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	ui.add_child(lbl)
	var steps := [
		{"text": "READY…", "color": Color(1.0, 0.85, 0.3)},
		{"text": "SET…", "color": Color(1.0, 0.6, 0.3)},
		{"text": "GO!", "color": Color(0.45, 0.95, 0.55)},
	]
	var tw := create_tween()
	for step in steps:
		var s: Dictionary = step
		tw.tween_callback(_countdown_show_step.bind(lbl, String(s["text"]), Color(s["color"])))
		tw.tween_interval(1.0)
	tw.tween_callback(_end_countdown.bind(lbl))

func _countdown_show_step(lbl: Label, text: String, color: Color) -> void:
	if lbl == null or not is_instance_valid(lbl):
		return
	lbl.text = text
	lbl.modulate = color
	lbl.scale = Vector2(0.6, 0.6)
	lbl.pivot_offset = lbl.size * 0.5
	var punch := create_tween()
	punch.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	punch.tween_property(lbl, "scale", Vector2.ONE, 0.25)

func _end_countdown(lbl: Label) -> void:
	_countdown_active = false
	if lbl == null or not is_instance_valid(lbl):
		return
	var fade := create_tween()
	fade.tween_property(lbl, "modulate:a", 0.0, 0.3)
	fade.tween_callback(lbl.queue_free)

# Animated end-of-battle banners (hand-drawn GIF frames in art/UI, extracted
# to <kind>_N.png). Cycles the frames on a looping tween — runs independent
# of _process, so _battle_over halting the loop doesn't stop it. `subtitle`
# adds a small line beneath (catch shows the caught mon's name).
const RESULT_ANIMS := {
	"victory": {"prefix": "res://art/UI/victory_", "count": 5, "color": Color(0.45, 0.95, 0.55)},
	"defeat": {"prefix": "res://art/UI/defeat_", "count": 8, "color": Color(0.95, 0.45, 0.45)},
	"catch": {"prefix": "res://art/UI/catch_", "count": 8, "color": Color(0.78, 0.55, 0.98)},
}
const RESULT_FRAME_S := 0.1
const RESULT_SIZE := 460.0

func _show_result_animation(kind: String, subtitle: String = "") -> void:
	_battle_over = true
	if not RESULT_ANIMS.has(kind):
		_show_result_banner(kind.to_upper(), Color.WHITE)
		return
	var cfg: Dictionary = RESULT_ANIMS[kind]
	var frames: Array[Texture2D] = []
	for i in int(cfg["count"]):
		var tex := load("%s%d.png" % [cfg["prefix"], i]) as Texture2D
		if tex != null:
			frames.append(tex)
	if frames.is_empty():
		_show_result_banner(kind.to_upper(), cfg["color"])
		return
	var ui := $UI as CanvasLayer
	var rect := TextureRect.new()
	rect.texture = frames[0]
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.anchor_left = 0.5
	rect.anchor_top = 0.5
	rect.anchor_right = 0.5
	rect.anchor_bottom = 0.5
	rect.offset_left = -RESULT_SIZE * 0.5
	rect.offset_top = -RESULT_SIZE * 0.5 - 20.0
	rect.offset_right = RESULT_SIZE * 0.5
	rect.offset_bottom = RESULT_SIZE * 0.5 - 20.0
	rect.modulate.a = 0.0
	ui.add_child(rect)
	create_tween().tween_property(rect, "modulate:a", 1.0, 0.25)
	var loop := create_tween().set_loops()
	for i in frames.size():
		var frame: Texture2D = frames[i]
		loop.tween_callback(func() -> void: rect.texture = frame)
		loop.tween_interval(RESULT_FRAME_S)
	if not subtitle.is_empty():
		var label := Label.new()
		label.text = subtitle
		label.modulate = cfg["color"]
		label.add_theme_font_size_override("font_size", 34)
		label.add_theme_color_override("font_outline_color", Color.BLACK)
		label.add_theme_constant_override("outline_size", 8)
		label.anchor_left = 0.5
		label.anchor_top = 0.5
		label.anchor_right = 0.5
		label.anchor_bottom = 0.5
		label.offset_left = -400.0
		label.offset_top = RESULT_SIZE * 0.5 - 60.0
		label.offset_right = 400.0
		label.offset_bottom = RESULT_SIZE * 0.5 - 10.0
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		ui.add_child(label)

# Text fallback banner — used if a result animation's frames fail to load.
func _show_result_banner(text: String, color: Color) -> void:
	_battle_over = true
	var ui := $UI as CanvasLayer
	var banner := Label.new()
	banner.text = text
	banner.modulate = color
	banner.add_theme_font_size_override("font_size", 96)
	banner.add_theme_color_override("font_outline_color", Color.BLACK)
	banner.add_theme_constant_override("outline_size", 12)
	banner.anchor_left = 0.5
	banner.anchor_top = 0.5
	banner.anchor_right = 0.5
	banner.anchor_bottom = 0.5
	banner.offset_left = -400.0
	banner.offset_top = -80.0
	banner.offset_right = 400.0
	banner.offset_bottom = 80.0
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	ui.add_child(banner)

func _spawn_popup(world_pos: Vector3, text: String, color: Color) -> void:
	var popup := POPUP_SCENE.instantiate() as DamagePopup
	popup.text = text
	popup.modulate = color
	_world.add_child(popup)
	popup.global_position = world_pos + POPUP_OFFSET

func _on_damage_popup(amount: int, mult: float, _source_type: String, _source: String, who: Combatant) -> void:
	var text := "-%d" % amount
	var color := Color(1, 1, 1, 1)
	if mult > 1.0:
		color = Color(1.0, 0.85, 0.25, 1.0)
		text = "-%d!" % amount
	elif mult < 1.0:
		color = Color(0.55, 0.75, 1.0, 1.0)
	_spawn_popup(who.global_position, text, color)

func _on_blocked_popup(_reason: String, who: Combatant) -> void:
	_spawn_popup(who.global_position, "BLOCK", Color(0.65, 0.65, 0.75, 1.0))

func _on_heal_popup(amount: int, who: Combatant) -> void:
	_spawn_popup(who.global_position, "+%d" % amount, Color(0.40, 1.0, 0.55, 1.0))

# Stun-state visuals: a slow-spinning yellow ring parented above the combatant.
# Ring is named "StunHalo" so it can be located and freed on unstunned without
# tracking a separate dictionary.
const STUN_HALO_NAME := "StunHalo"

func _on_stunned(_duration_ms: int, who: Combatant) -> void:
	# Re-use halo if the stun was re-applied — just don't double-spawn.
	if who.find_child(STUN_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = STUN_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.45
	torus.outer_radius = 0.65
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.92, 0.30, 0.85)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.85, 0.20)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 1.8, 0.0)
	var spin := halo.create_tween().set_loops()
	spin.tween_property(ring, "rotation:y", TAU, 0.6)
	spin.tween_property(ring, "rotation:y", 0.0, 0.0)
	_spawn_popup(who.global_position, "STUN", Color(1.0, 0.92, 0.30, 1.0))

func _on_unstunned(who: Combatant) -> void:
	var halo := who.find_child(STUN_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Burn halo — ember-orange ring low on the body. While it runs (or the
# combatant stands on hostile burning ground), all damage taken is x1.2.
const BURN_HALO_NAME := "BurnHalo"

func _on_burned(_duration_ms: int, _dot: int, who: Combatant) -> void:
	if who.find_child(BURN_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = BURN_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.40
	torus.outer_radius = 0.58
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.45, 0.10, 0.85)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.35, 0.05)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 0.45, 0.0)
	var flicker := halo.create_tween().set_loops()
	flicker.tween_property(mat, "emission_energy_multiplier", 1.6, 0.18).set_trans(Tween.TRANS_SINE)
	flicker.tween_property(mat, "emission_energy_multiplier", 3.2, 0.18).set_trans(Tween.TRANS_SINE)
	_spawn_popup(who.global_position, "BURN", Color(1.0, 0.55, 0.15, 1.0))

func _on_unburned(who: Combatant) -> void:
	var halo := who.find_child(BURN_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Blind halo — smoky grey ring at eye height. While it runs, the wearer's
# attacks roll Combatant.BLIND_MISS_CHANCE to whiff.
const BLIND_HALO_NAME := "BlindHalo"

func _on_blinded(_duration_ms: int, who: Combatant) -> void:
	if who.find_child(BLIND_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = BLIND_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.35
	torus.outer_radius = 0.52
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.35, 0.35, 0.40, 0.85)
	mat.emission_enabled = true
	mat.emission = Color(0.25, 0.25, 0.30)
	mat.emission_energy_multiplier = 1.6
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 1.45, 0.0)
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.35, 0.35).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.85, 0.35).set_trans(Tween.TRANS_SINE)
	_spawn_popup(who.global_position, "BLIND", Color(0.55, 0.55, 0.62, 1.0))

func _on_unblinded(who: Combatant) -> void:
	var halo := who.find_child(BLIND_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Root halo — earthy brown ring hugging the ground. Movement lock only;
# rooted combatants still attack and play cards.
const ROOT_HALO_NAME := "RootHalo"

func _on_rooted(_duration_ms: int, who: Combatant) -> void:
	if who.find_child(ROOT_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = ROOT_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.50
	torus.outer_radius = 0.70
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.40, 0.18, 0.90)
	mat.emission_enabled = true
	mat.emission = Color(0.45, 0.32, 0.12)
	mat.emission_energy_multiplier = 2.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	_spawn_popup(who.global_position, "ROOT", Color(0.70, 0.52, 0.25, 1.0))

func _on_unrooted(who: Combatant) -> void:
	var halo := who.find_child(ROOT_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Sleep halo — soft indigo ring at head height + Zzz popup. Blocks actions
# like stun but breaks on damage (Droopider).
const SLEEP_HALO_NAME := "SleepHalo"

func _on_slept(_duration_ms: int, who: Combatant) -> void:
	if who.find_child(SLEEP_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = SLEEP_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.42
	torus.outer_radius = 0.60
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.50, 0.95, 0.85)
	mat.emission_enabled = true
	mat.emission = Color(0.45, 0.40, 0.95)
	mat.emission_energy_multiplier = 2.4
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 1.5, 0.0)
	var drift := halo.create_tween().set_loops()
	drift.tween_property(ring, "rotation:y", TAU, 1.4)
	drift.tween_property(ring, "rotation:y", 0.0, 0.0)
	_spawn_popup(who.global_position, "Zzz", Color(0.70, 0.66, 1.0, 1.0))

func _on_woke(who: Combatant) -> void:
	var halo := who.find_child(SLEEP_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Damage-taken trait hooks. Tinder Nerves (Kindlekit): water damage blinds
# the holder 1s; fire/fighting damage charges the next fire/fighting card
# (one-shot buff, consumed by the execute() post-play hook).
const TINDER_CHARGE_MS := 10000

func _on_damaged_trait_hooks(amount: int, _mult: float, source_type: String, _source: String, who: Combatant) -> void:
	if amount <= 0 or not who.is_alive():
		return
	var blind_ms := TraitRegistry.blind_self_on_water_ms(who.traits)
	if blind_ms > 0 and source_type == "water":
		who.apply_blind(blind_ms)
		print("%s — Tinder Nerves: water sting, self-blind %dms" % [who.display_name, blind_ms])
	var tinder := TraitRegistry.tinder_charge_mult(who.traits)
	if tinder > 0.0 and source_type in ["fire", "fighting"] and not who.has_buff("tinder_charge"):
		var buff: Dictionary = who.apply_buff("tinder_charge", 1.0, 1.0, TINDER_CHARGE_MS)
		buff["card_type_mult_fire"] = tinder
		buff["card_type_mult_fighting"] = tinder
		var halo := MoveRegistry._make_buff_halo(Color(1.0, 0.55, 0.20))
		who.add_child(halo)
		halo.position = Vector3(0.0, 0.1, 0.0)
		buff["visual"] = halo
		print("%s — Tinder Nerves: CHARGED, next fire/fighting card x%.1f" % [who.display_name, tinder])
	# Earthen Ward (Mosseer) — the armed holder's earth card damaged this
	# combatant inside the window → the holder Guards up. Window consumed.
	if source_type == "earth":
		var warder := get_opponent(who)
		if warder != null and is_instance_valid(warder):
			var wkey := warder.get_instance_id()
			if _earthen_ward.has(wkey) and Time.get_ticks_msec() < int(_earthen_ward[wkey]) \
					and TraitRegistry.guarded_on_type_damage(warder.traits, "earth"):
				_earthen_ward.erase(wkey)
				warder.grant_guarded(EARTHEN_WARD_GUARD_MS)
				print("%s — Earthen Ward: earth strike lands, GUARDED %dms" % [warder.display_name, EARTHEN_WARD_GUARD_MS])
	# Litany of Stone — hits that land during the channel still refund 1 mana
	# (full absorbs come through _on_blocked_card_hooks instead).
	if who.flat_reduction > 0 and Time.get_ticks_msec() < who.flat_reduction_until_ms:
		who.gain_mana(1)
		print("%s — Litany absorbs the blow (+1 mana)" % who.display_name)
	# Sanctified Ground — damage taken while standing on your own blessed
	# tile accumulates; at 45 the blessing shatters.
	if blessed_tile_under(who):
		var key := who.get_instance_id()
		_bless_absorbed[key] = int(_bless_absorbed.get(key, 0)) + amount
		if int(_bless_absorbed[key]) >= BLESS_BREAK_DAMAGE:
			_bless_absorbed.erase(key)
			clear_blessed_tiles(who)
			print("%s's Sanctified Ground shatters (45 damage absorbed)" % who.display_name)

# Litany of Stone: a fully-absorbed hit emits blocked("absorbed") — refund.
func _on_blocked_card_hooks(reason: String, who: Combatant) -> void:
	if reason == "absorbed" and who.flat_reduction > 0 and Time.get_ticks_msec() < who.flat_reduction_until_ms:
		who.gain_mana(1)
		print("%s — Litany fully absorbs the blow (+1 mana)" % who.display_name)

# === SANCTIFIED GROUND / AEGIS PILLAR support (Gozo) ===

const BLESS_BREAK_DAMAGE := 45
var _bless_absorbed: Dictionary = {}  # combatant instance id -> damage soaked on blessed ground
var _aegis_pillars: Dictionary = {}   # caster instance id -> Wall
# Mimic Shroud decoys — owner instance id -> Turret. The decoy copies its
# owner's basic shots (_spawn_basic_bullet mirror); stale/freed entries are
# skipped via is_instance_valid, overwritten on recast.
var _mimics: Dictionary = {}
# Rewind Fork recordings — caster instance id -> {side, cell, hp}. Written
# at cast, consumed by the RETURN bonus card or the 4s timeout.
var _rewinds: Dictionary = {}

# === EARTHEN WARD (Mosseer trait) ===
# Playing an earth card arms a short window (post-play hook). If the opponent
# then takes earth-typed damage inside it, the holder gains Guarded — the
# closest honest read of "earth cards provide (guarded) if attack lands"
# that survives delayed/tile/projectile cards. Paid by _on_damaged_trait_hooks;
# trait re-checked at pay time so a T-swap mid-window can't inherit the guard.
const EARTHEN_WARD_WINDOW_MS := 6000
const EARTHEN_WARD_GUARD_MS := 3000
var _earthen_ward: Dictionary = {}  # holder instance id -> window expiry ms

func arm_earthen_ward(holder: Combatant) -> void:
	if holder == null or not is_instance_valid(holder):
		return
	_earthen_ward[holder.get_instance_id()] = Time.get_ticks_msec() + EARTHEN_WARD_WINDOW_MS

# === NIGHTMARE (Droopider secret trait) ===
# ONE mind card per match carries the nightmare (user rule): rolled lazily
# the first time a holder plays any mind card — random among ALL their mind
# cards (deck + hand + discard) — then fixed for the whole battle, surviving
# team swaps out and back. Checked by the post-play hook 3d.
var _nightmare_cards: Dictionary = {}  # holder instance id -> MoveDef

func is_nightmare_card(holder: Combatant, move: MoveDef) -> bool:
	var key := holder.get_instance_id()
	if not _nightmare_cards.has(key):
		var minds: Array = []
		for c in holder.deck:
			if c is MoveDef and c.move_type == "mind":
				minds.append(c)
		for c in holder.hand:
			if c is MoveDef and c.move_type == "mind":
				minds.append(c)
		for entry in holder.discard:
			var dc = entry.get("card")
			if dc is MoveDef and dc.move_type == "mind":
				minds.append(dc)
		if minds.is_empty():
			return false
		_nightmare_cards[key] = minds[randi() % minds.size()]
		var picked: MoveDef = _nightmare_cards[key]
		print("Nightmare settles into %s for this match" % picked.display_name)
	return _nightmare_cards.get(key) == move

func blessed_tile_under(c: Combatant) -> bool:
	if c == null or not is_instance_valid(c):
		return false
	var tile := tile_at_cell(get_side(c), get_caster_cell(c), "blessed_tile")
	return tile != null and tile.owner_combatant == c

# Burn vulnerability read (Combatant.take_damage): true if the combatant is
# standing on a burn tile that WOULD burn them (non-owner, or harms_owner).
func burn_tile_under(c: Combatant) -> bool:
	if c == null or not is_instance_valid(c):
		return false
	var tile := tile_at_cell(get_side(c), get_caster_cell(c), "burn_tile")
	return tile != null and (tile.owner_combatant != c or tile.harms_owner)

func clear_blessed_tiles(owner_combatant: Combatant) -> void:
	for i in range(_tiles.size() - 1, -1, -1):
		var t: TimedEffect = _tiles[i]
		if not is_instance_valid(t):
			_tiles.remove_at(i)
			continue
		if t.effect_id == "blessed_tile" and t.owner_combatant == owner_combatant:
			_tiles.remove_at(i)
			t.queue_free()

func register_aegis(caster: Combatant, wall: Wall) -> void:
	_aegis_pillars[caster.get_instance_id()] = wall
	# Pillar destroyed by the enemy → the Shatter card goes with it.
	wall.destroyed.connect(func(_o, _d) -> void:
		if is_instance_valid(caster) and caster.bonus_card != null and caster.bonus_card.effect_id == "aegis_shatter":
			caster.clear_bonus_card()
			print("%s's Aegis Pillar fell — Shatter lost" % caster.display_name)
	)

func aegis_pillar_of(caster: Combatant) -> Wall:
	var wall = _aegis_pillars.get(caster.get_instance_id())
	if wall != null and is_instance_valid(wall):
		return wall as Wall
	return null

# Guarded halo — pale shield-blue ring while a TIMED guard runs (trait
# triggers). Permanent (Event Guard) and positional (Shell Cover) guards
# don't show a halo; their halved popups + board state tell the story.
const GUARD_HALO_NAME := "GuardHalo"

func _on_guarded_gained(_duration_ms: int, who: Combatant) -> void:
	if who.find_child(GUARD_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = GUARD_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.55
	torus.outer_radius = 0.78
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.60, 0.85, 1.0, 0.75)
	mat.emission_enabled = true
	mat.emission = Color(0.55, 0.80, 1.0)
	mat.emission_energy_multiplier = 2.5
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 0.15, 0.0)
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.35, 0.4).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.80, 0.4).set_trans(Tween.TRANS_SINE)

func _on_guarded_lost(who: Combatant) -> void:
	var halo := who.find_child(GUARD_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Poison halo — sickly green ring, smaller + lower than the stun halo so a
# combatant that's both stunned AND poisoned shows both clearly stacked.
const POISON_HALO_NAME := "PoisonHalo"

func _on_poisoned(_duration_ms: int, _dot: int, who: Combatant) -> void:
	if who.find_child(POISON_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = POISON_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.40
	torus.outer_radius = 0.55
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.85, 0.30, 0.75)
	mat.emission_enabled = true
	mat.emission = Color(0.40, 0.80, 0.20)
	mat.emission_energy_multiplier = 2.6
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 1.4, 0.0)
	var pulse := halo.create_tween().set_loops()
	pulse.tween_property(mat, "albedo_color:a", 0.30, 0.6).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(mat, "albedo_color:a", 0.75, 0.6).set_trans(Tween.TRANS_SINE)
	_spawn_popup(who.global_position, "POISON", Color(0.55, 0.85, 0.30, 1.0))

func _on_unpoisoned(who: Combatant) -> void:
	var halo := who.find_child(POISON_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

# Thorn shield indicator — bright spiky green ring with rapid spin that sits
# at sprite height. Despawns instantly when the shield is consumed by a hit
# so the player sees the absorption land. Uses a STAR-shaped flat plane
# (rendered double-sided) to read as "thorns".
const THORN_HALO_NAME := "ThornHalo"

func _on_thorn_shield_changed(active: bool, who: Combatant) -> void:
	if active:
		if who.find_child(THORN_HALO_NAME, false, false) != null:
			return
		var halo := Node3D.new()
		halo.name = THORN_HALO_NAME
		# Outer thorn ring — chunky torus with strong green emission.
		var ring := MeshInstance3D.new()
		var torus := TorusMesh.new()
		torus.inner_radius = 0.55
		torus.outer_radius = 0.85
		ring.mesh = torus
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.35, 0.95, 0.45, 0.85)
		mat.emission_enabled = true
		mat.emission = Color(0.25, 0.95, 0.30)
		mat.emission_energy_multiplier = 3.2
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		ring.material_override = mat
		halo.add_child(ring)
		# Inner "shield" disc — softer green flat plane.
		var disc := MeshInstance3D.new()
		var plane := PlaneMesh.new()
		plane.size = Vector2(1.5, 1.5)
		disc.mesh = plane
		var dmat := StandardMaterial3D.new()
		dmat.albedo_color = Color(0.40, 0.90, 0.50, 0.30)
		dmat.emission_enabled = true
		dmat.emission = Color(0.25, 0.85, 0.30)
		dmat.emission_energy_multiplier = 1.8
		dmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		dmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		dmat.cull_mode = BaseMaterial3D.CULL_DISABLED
		disc.material_override = dmat
		halo.add_child(disc)
		who.add_child(halo)
		halo.position = Vector3(0.0, 1.1, 0.0)
		# Fast spin to convey "active defense".
		var spin := halo.create_tween().set_loops()
		spin.tween_property(ring, "rotation:y", TAU, 0.45)
		spin.tween_property(ring, "rotation:y", 0.0, 0.0)
	else:
		var halo := who.find_child(THORN_HALO_NAME, false, false)
		if halo != null:
			# Brief flash on consumption — quick scale-up + fade, then free.
			# Reparent to world so it survives even if `who` moves during the
			# tween (halo would otherwise stick to caster).
			halo.reparent(_world)
			var burst := halo.create_tween().set_parallel(true)
			burst.tween_property(halo, "scale", Vector3.ONE * 1.8, 0.20)
			for child in halo.get_children():
				var m := (child as MeshInstance3D).material_override as StandardMaterial3D
				if m != null:
					burst.tween_property(m, "albedo_color:a", 0.0, 0.20)
			burst.chain().tween_callback(halo.queue_free)
		_spawn_popup(who.global_position, "BLOCK", Color(0.35, 0.95, 0.45, 1.0))

const BASIC_DAMAGE := 12

func _fire_basic(shooter: Combatant, dir: Vector3, is_charged: bool = false) -> void:
	# Per-mon basic attack dispatch (mons.xlsx column F pass):
	#   builders:  block_builder (Hogglin, launch 2) / statue_builder (Fudo,
	#              launch 3) / guard_builder (Modizard) / charged_walker (Mushroom)
	#   melee:     stun_jab (Grabbakat) / spike_melee (Slime) / tile_steal
	#              (Giant) / line_thrust (Kingfencer)
	#   special:   boomerang (Lunapra) / triple_shot (Pixie) / warp_shot (Atomippo)
	#   bullets:   default + variants drain_shot (Dragone), ice_spike (Icage),
	#              scrap_shot (Cargot) — flags applied in _spawn_basic_bullet.
	match shooter.basic_attack_kind:
		"block_builder":
			_basic_build_or_launch(shooter, 2)
		"statue_builder":
			_basic_build_or_launch(shooter, 3)
		"charged_walker":
			_basic_spawn_walker(shooter)
		"guard_builder":
			_basic_call_guard(shooter)
		"boomerang":
			_basic_boomerang(shooter)
		"stun_jab":
			_basic_stun_jab(shooter)
		"charged_spike":
			# Slime: tap/early release = 2-tile spike, full charge = 4 tiles.
			_basic_spike_melee(shooter, 4 if is_charged else 2)
		"charged_claw":
			# Klawr (starter): tap = 2-tile claw + 1.5s poison floor on hit,
			# full charge = 4 tiles + the far two tiles freeze over.
			_basic_claw_melee(shooter, is_charged)
		"rage_shot":
			# Insidibear (zone 2): calm = slow 2-ammo shot; raging = stunning
			# laser on a 3s CD.
			_basic_rage_shot(shooter, dir)
		"seer_shot":
			# Mosseer (zone 2): weak 5-clip bullet on a 0.5s CD — the payload
			# is the 5-hit forced shuffle (on_basic_hit hub).
			_basic_seer_shot(shooter, dir)
		"charged_shadow":
			# Wherewolf (zone 2): full charge = 18 + 1s stun from behind;
			# early release = half damage. Phantom Fang holders send the
			# boomerang shadow instead. The AI can't hold SPACE, so an enemy
			# wherewolf always gets the full-charge version.
			if TraitRegistry.has_phantom_fang(shooter.traits):
				_phantom_fang(shooter)
			else:
				_shadow_strike(shooter, is_charged or shooter == _enemy)
		"jester_beam":
			# Jester (zone 2): 3-ammo sequential light beam down the row that
			# ignores blocks entirely. 5s reload.
			_basic_jester_beam(shooter)
		"ram_shot":
			# Krrrrin (zone 3): 80-damage straight-line charge, slow 3s recoil.
			_basic_ram(shooter)
		"triple_shot":
			_basic_triple_shot(shooter, dir)
		"tile_steal":
			_basic_tile_steal(shooter)
		"charged_thrust":
			# Kingfencer (July 2026 rework): tap = 2-tile thrust; full charge
			# = rush slice down the row (20) and glide home. AI taps.
			if is_charged:
				_basic_rush_slice(shooter)
			else:
				_basic_line_thrust(shooter)
		_:
			# Plain bullets + flag variants (drain_shot / ice_spike /
			# scrap_shot / warp_shot) — flags applied in _spawn_basic_bullet.
			_basic_fire_bullet(shooter, dir, is_charged)

# Shared basic-attack damage math (bullets AND melee basics).
func _basic_attack_damage(shooter: Combatant, base_val: int) -> int:
	# Blind — 20% chance the whole swing whiffs (deals 0 everywhere it lands).
	if shooter.roll_blind_miss():
		return 0
	var base := float(base_val)
	base *= TraitRegistry.bullet_mult(shooter.traits)
	base *= TraitRegistry.damage_dealt_mult(shooter.traits)
	base *= shooter.buff_damage_dealt_mult()
	var bonus := TraitRegistry.bullet_bonus(shooter.traits)
	return maxi(1, int(round(base)) + bonus)

const WARP_BASE_DAMAGE := 10

func _basic_fire_bullet(shooter: Combatant, dir: Vector3, is_charged: bool = false) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var base := BASIC_DAMAGE
	if shooter.basic_attack_kind == "warp_shot":
		base = WARP_BASE_DAMAGE
	elif shooter.basic_attack_kind == "sleep_shot":
		base = SLEEP_SHOT_DAMAGE  # Droopider — weak shot, the sleep is the payload
	_spawn_basic_bullet(shooter, dir, _basic_attack_damage(shooter, base), is_charged)

func _spawn_basic_bullet(shooter: Combatant, dir: Vector3, dmg: int, is_charged: bool) -> void:
	var bullet := BULLET_SCENE.instantiate() as Bullet
	bullet.direction = dir.normalized()
	bullet.source_type = shooter.monster_type
	var label := "charged" if is_charged else "basic"
	bullet.source_label = "%s_%s" % [shooter.display_name.to_lower(), label]
	bullet.ignore = shooter
	bullet.owner_side = get_side(shooter)
	bullet.battle = self
	bullet.damage = dmg
	bullet.is_charged = is_charged
	bullet.is_basic = true
	# Sleep Spores / Stunning Touche — basic shots carry a brief stun rider.
	if TraitRegistry.basic_stuns(shooter.traits):
		bullet.status_id = "stun"
		bullet.status_duration_ms = BASIC_STUN_MS
	# mons.xlsx bullet variants.
	match shooter.basic_attack_kind:
		"drain_shot":
			bullet.drain_ratio = 2.0 if shooter.has_buff("latch") else 1.0
		"ice_spike":
			bullet.homing_target = get_opponent(shooter)
			bullet.freeze_on_miss = true
			bullet.speed = 10.0
		"scrap_shot":
			bullet.build_block_on_hit = true
		"warp_shot":
			bullet.warp_on_hit = true
		"sleep_shot":
			# Droopider Sleepnosis — phases through walls/structures.
			bullet.pierce_walls = true
		"rage_shot":
			# Insidibear: raging = fast stunning laser; calm = lobbed slow slug.
			if shooter.has_buff("rage"):
				bullet.speed = RAGE_LASER_SPEED
				bullet.status_id = "stun"
				bullet.status_duration_ms = RAGE_LASER_STUN_MS
			else:
				bullet.speed = RAGE_SLOW_SHOT_SPEED
		"stun_volley":
			# Gozo (starter): 2-shot clip — the clip-emptying shot carries a
			# 1s ROOT rider (movement lock; victim can still attack).
			if shooter.ammo == 0:
				bullet.status_id = "root"
				bullet.status_duration_ms = GOZO_VOLLEY_ROOT_MS
	_world.add_child(bullet)
	var spawn := shooter.global_position + dir.normalized() * 0.6
	spawn.y += 0.55
	bullet.global_position = spawn
	# Mimic Shroud — a live decoy copies its owner's basic shots.
	var mimic = _mimics.get(shooter.get_instance_id())
	if mimic != null and is_instance_valid(mimic):
		spawn_turret_bullet(mimic, dir)

# Called by Bullet when a charged-bullet lands a combatant hit. Forwards to
# the shooter's combo counter; at threshold, applies the Frog Chorus frenzy.
func on_charged_hit(shooter: Combatant) -> void:
	if not is_instance_valid(shooter):
		return
	if shooter.register_charged_hit():
		MoveRegistry.apply_frenzy_buff(shooter, Combatant.CHARGED_CHORUS_DURATION_MS, "Chorus combo")

# === BASIC-HIT TRAIT HUB ===
# Called by Bullet for every BASIC-attack shot that lands on a combatant.
# Drives: combo heals (Loyal Heart / Holy Ground / Gutter Feast), Extended
# Lunge's 3-wide follow-up slash, and the Toadazer charge stack.

const BASIC_STUN_MS := 250          # Sleep Spores / Stunning Touche rider
const WIDE_SLASH_DAMAGE := 15       # Extended Lunge follow-up, per cell
const TOADAZER_CHARGE_HITS := 4     # mons.xlsx row 38: charge every 4 hits
const TOADAZER_CHARGE_MULT := 1.6
const TOADAZER_CHARGE_DURATION_MS := 10000
const LEMMEL_HEAL_EVERY := 8        # mons.xlsx row 17: 8 hits → heal 10
const LEMMEL_HEAL_AMOUNT := 10
const SCIMARK_SLICE_EVERY := 3      # mons.xlsx row 12: 3rd hit → wide slice
const DRAGONE_LATCH_EVERY := 10     # mons.xlsx row 42: 10 hits → latch 3s
const DRAGONE_LATCH_MS := 3000
# Starter basics (mon battle grid_starters.xlsx sheet 1, col F).
const KINDLEKIT_BURN_EVERY := 3     # 3rd damaging hit burns the victim's tile
const KINDLEKIT_BURN_MS := 3000
const DRAKECHO_STEAL_EVERY := 3     # 3rd hit steals 1 mana
const GOZO_VOLLEY_ROOT_MS := 1000   # clip-emptying shot roots 1s
const DANDEOX_BLIND_EVERY := 3      # 3rd landed hit blinds
const DANDEOX_BLIND_MS := 2000
const DROOPIDER_SLEEP_EVERY := 3    # zone-2 row 5: 3rd landed hit → sleep
const DROOPIDER_SLEEP_MS := 3000
const SLEEP_SHOT_DAMAGE := 8        # Droopider's weak basic (sleep is the payload)
const MOSSEER_SHUFFLE_HITS := 5     # zone-2 row 10: 5th landed hit → forced shuffle
const SEER_SHOT_DAMAGE := 6         # Mosseer's weak basic (the shuffle is the payload)
const SEER_SHOT_CD_MS := 500        # anti-spam gap between Fortune Shots
const SEER_CHARGE_BONUS := 10       # shuffle proc: next grass CARD +10 (one-shot)
const SEER_CHARGE_MS := 15000
const MOSSEER_FORTUNE_SHUFFLES := 3 # Fortune Told secret: shuffles → grass ×1.5
const FORTUNE_TOLD_MULT := 1.5
const SHADOW_STRIKE_DAMAGE := 18      # zone-2 row 20: full-charge Shadow Strike
const SHADOW_STRIKE_HALF_DAMAGE := 9  # early release = half (user rule)
const SHADOW_STRIKE_STUN_MS := 1000
const SHADOW_STRIKE_DELAY_S := 0.5    # ghost telegraph before the lunge (dodge window)
const SHADOW_STRIKE_CD_MS := 3000
const OPPORTUNIST_CRIT_MULT := 2.0    # Opportunist trait: strike vs stunned crits
const PHANTOM_FANG_DAMAGE := 8        # secret trait boomerang, per leg
const PHANTOM_FANG_RANGE := 4
const PHANTOM_FANG_STEP_S := 0.13
const PHANTOM_FANG_VANISH_MS := 2000
const LINGERING_SHADOW_STUN_MS := 1000
const LINGERING_SHADOW_STEP_S := 0.9
const JESTER_BEAM_DAMAGE := 12      # zone-2 row 120: Halo Beam per-hit
const JESTER_BEAM_STEP_S := 0.1     # sequential tile-by-tile sweep cadence
const LIMELIGHT_MARK_MS := 3000     # marked enemies take ×1.2 from all sources
const LIMELIGHT_MARK_MULT := 1.2
const BRIGHT_WARD_GUARD_MS := 1500  # guarded when a beam hit lands damage
const AFTERGLOW_HEAL_MS := 3000     # heal_font under jester per beam

func on_basic_hit(shooter: Combatant, victim: Combatant) -> void:
	if shooter == null or not is_instance_valid(shooter):
		return
	var count := shooter.register_basic_hit()
	# Night Terror (Droopider trait) — a basic that WOKE a sleeping target
	# (last_hit_woke_sleep set by take_damage) stuns it briefly. Basics only.
	var nt := TraitRegistry.sleep_hit_stun_ms(shooter.traits)
	if nt > 0 and victim != null and is_instance_valid(victim) and victim.last_hit_woke_sleep:
		victim.apply_stun(nt, shooter)
		print("%s — Night Terror: %s jolts awake, stunned %dms" % [shooter.display_name, victim.display_name, nt])
	# Combo heal — every Nth basic hit heals.
	var ch := TraitRegistry.combo_heal(shooter.traits)
	if not ch.is_empty():
		var every := int(ch.get("every", 0))
		if every > 0 and count % every == 0:
			shooter.heal(int(ch.get("amount", 0)))
	# Extended Lunge — every Nth basic hit follows up with a 3-wide slash at
	# the victim's column (their row ±1, 15 DMG each — victim included).
	var ws := TraitRegistry.wide_slash_every(shooter.traits)
	if ws > 0 and count % ws == 0 and victim != null and is_instance_valid(victim):
		_wide_slash_followup(shooter, victim)
	# Per-mon basic identities (mons.xlsx column F).
	var mon_id := shooter.monster_def.id if shooter.monster_def != null else ""
	match mon_id:
		"toadazer":
			# Every 4th hit CHARGES the next electric card (×1.6). Consumed by
			# MoveRegistry's post-play hook; Charge Sip heals 7 on discharge.
			if count % TOADAZER_CHARGE_HITS == 0 and not shooter.has_buff("toadazer_charge"):
				var buff: Dictionary = shooter.apply_buff("toadazer_charge", 1.0, 1.0, TOADAZER_CHARGE_DURATION_MS)
				buff["card_type_mult_electric"] = TOADAZER_CHARGE_MULT
				var halo := MoveRegistry._make_buff_halo(Color(1.0, 0.85, 0.25))
				shooter.add_child(halo)
				halo.position = Vector3(0.0, 0.1, 0.0)
				buff["visual"] = halo
				print("%s CHARGED — next electric card ×%.1f" % [shooter.display_name, TOADAZER_CHARGE_MULT])
		"lemmel":
			if count % LEMMEL_HEAL_EVERY == 0:
				shooter.heal(LEMMEL_HEAL_AMOUNT)
				print("%s — 8-hit rhythm heal +%d" % [shooter.display_name, LEMMEL_HEAL_AMOUNT])
		"scimark":
			if count % SCIMARK_SLICE_EVERY == 0 and victim != null and is_instance_valid(victim):
				_wide_slash_followup(shooter, victim)
		"dragone":
			# 10th hit → LATCH: drain shots heal 200% for 3s.
			if count % DRAGONE_LATCH_EVERY == 0 and not shooter.has_buff("latch"):
				var lbuff: Dictionary = shooter.apply_buff("latch", 1.0, 1.0, DRAGONE_LATCH_MS)
				var lhalo := MoveRegistry._make_buff_halo(Color(0.75, 0.15, 0.25))
				shooter.add_child(lhalo)
				lhalo.position = Vector3(0.0, 0.1, 0.0)
				lbuff["visual"] = lhalo
				print("%s LATCHES — draining 200%% for %dms" % [shooter.display_name, DRAGONE_LATCH_MS])
		"kindlekit":
			# Starter: every 3rd damaging hit sets the victim's tile on fire.
			if count % KINDLEKIT_BURN_EVERY == 0 and victim != null and is_instance_valid(victim):
				var kv_side := get_side(victim)
				var kv_cell := get_caster_cell(victim)
				spawn_tile(shooter, kv_side, kv_cell, "burn_tile", KINDLEKIT_BURN_MS, false)
				print("%s ignites the ground under %s" % [shooter.display_name, victim.display_name])
		"drakecho":
			# Starter: every 3rd hit siphons 1 mana (Essence Drinker heals on it).
			if count % DRAKECHO_STEAL_EVERY == 0 and victim != null and is_instance_valid(victim):
				steal_mana(shooter, victim, 1)
		"dandeox":
			# Starter: every 3rd landed hit blinds 2s (20% whiff chance).
			if count % DANDEOX_BLIND_EVERY == 0 and victim != null and is_instance_valid(victim):
				victim.apply_blind(DANDEOX_BLIND_MS)
		"droopider":
				# Zone-2 row 5: every 3rd landed hit lulls the enemy to sleep.
				# Skip the hit that JUST woke them (avoids instant re-sleep).
				if count % DROOPIDER_SLEEP_EVERY == 0 and victim != null and is_instance_valid(victim) \
						and not victim.last_hit_woke_sleep:
					victim.apply_sleep(DROOPIDER_SLEEP_MS)
					print("%s lulls %s to sleep" % [shooter.display_name, victim.display_name])
		"insidibear":
				# Zone-2 row 18: every 3rd landed hit ignites (or refreshes) RAGE.
				if count % INSIDIBEAR_RAGE_HITS == 0:
					_apply_rage(shooter)
		"mosseer":
				# Zone-2 row 10: every 5th landed hit rams the victim's hand
				# back into their deck (redraw) + charges the next grass card.
				if count % MOSSEER_SHUFFLE_HITS == 0 and victim != null and is_instance_valid(victim):
					_mosseer_fortune_proc(shooter, victim)

func _wide_slash_followup(shooter: Combatant, victim: Combatant) -> void:
	var v_side := get_side(victim)
	var v_cell := get_caster_cell(victim)
	for dy in range(-1, 2):
		var cy := v_cell.y + dy
		if cy < 0 or cy >= GRID_ROWS:
			continue
		var cell := Vector2i(v_cell.x, cy)
		MoveRegistry._spawn_punch(self, cell_to_world(v_side, cell), get_side(shooter) == SIDE_ENEMY)
		var target := combatant_at(v_side, cell)
		if target != null and target.is_alive():
			target.take_damage(WIDE_SLASH_DAMAGE, shooter.monster_type, "wide_slash")

# Shared mana-steal event (Drakecho's basic, Dandeox's Mana Thief trait).
# Steals up to `amount` of what the victim actually has; Essence Drinker pays
# the taker heal_per_mana_stolen HP per point. Returns the amount stolen.
func steal_mana(taker: Combatant, victim: Combatant, amount: int) -> int:
	if taker == null or victim == null:
		return 0
	if not is_instance_valid(taker) or not is_instance_valid(victim):
		return 0
	var stolen: int = mini(amount, victim.mana)
	if stolen <= 0:
		return 0
	victim.spend_mana(stolen)
	taker.gain_mana(stolen)
	var heal_per := TraitRegistry.heal_per_mana_stolen(taker.traits)
	if heal_per > 0:
		taker.heal(heal_per * stolen)
	print("%s steals %d mana from %s%s" % [
		taker.display_name, stolen, victim.display_name,
		(" (Essence Drinker +%d)" % (heal_per * stolen)) if heal_per > 0 else ""
	])
	return stolen

# === CATCH MECHANIC (C key) ===
# Aimed like Lasso: the line scans CATCH_RANGE cells forward on the player's
# row and connects with the FIRST combatant inline (walls don't block it —
# lasso semantics). Costs 3 mana per throw, 1s cooldown; connecting with an
# enemy above the 25% window pops TOO STRONG (mana spent — the CATCHABLE!
# panel tag tells you when to throw). Eligible connect → 1.5s frozen attempt
# → chance 90%→40% across the HP window. Success records an INSTANCE in
# SceneManager.caught_mons keeping the trait the enemy fought with (visible
# on its panel — informed hunting; React rolled fresh instead), then ends
# the battle with a CAUGHT banner. Duplicates are the point — no
# "already caught" block.

func _try_team_swap() -> void:
	if _battle_over or _catch_pause or _player.is_stunned():
		return
	var team: Array = SceneManager.team
	if team.size() <= 1:
		print("Team swap — no other members on the active team")
		return
	var now := Time.get_ticks_msec()
	if now < _team_swap_cd_until_ms:
		return
	var cur := SceneManager.current_partner_instance
	var pos := team.find(cur)
	if pos < 0:
		pos = 0
	var next_instance := int(team[(pos + 1) % team.size()])
	if next_instance == cur:
		return
	var entry: Dictionary = SceneManager.caught_mons[next_instance]
	var def := MonsterRoster.load_by_id(String(entry["id"]))
	if def == null:
		return
	# Shift Change (Insidibear) — swapping out tops the outgoing mon up FIRST
	# so the heal is banked into its benched state.
	var swap_heal_pct := TraitRegistry.swap_out_heal_pct(_player.traits)
	if swap_heal_pct > 0:
		var healed := _player.heal(int(round(float(_player.max_hp) * float(swap_heal_pct) / 100.0)))
		if healed > 0:
			print("%s — Shift Change: +%d HP on the way out" % [_player.display_name, healed])
	# Inside Job (Insidibear secret) — remember whether the OUTGOING mon lurks.
	var outgoing_inside_job := TraitRegistry.has_inside_job(_player.traits)
	# Lingering Shadow (Wherewolf) — same swap-out bookkeeping.
	var outgoing_lingering := TraitRegistry.has_lingering_shadow(_player.traits)
	# Bank the outgoing member's HP/mana so swapping back resumes it (each
	# member keeps its own pool within the battle; statuses/buffs are wiped
	# by apply_def — the tactical cost of the swap).
	_team_member_state[cur] = {"hp": _player.hp, "mana": _player.mana}
	_player.apply_def(def, int(entry["trait_index"]))
	player_monster_id = String(entry["id"])
	SceneManager.current_partner_instance = next_instance
	SceneManager.current_player_id = String(entry["id"])
	# Resume this member's banked pools if it has already fought this battle.
	if _team_member_state.has(next_instance):
		var st: Dictionary = _team_member_state[next_instance]
		_player.hp = clampi(int(st["hp"]), 1, _player.max_hp)
		_player.mana = clampi(int(st["mana"]), 0, _player.max_mana)
		_player.mana_changed.emit(_player.mana, _player.max_mana)
	_team_swap_cd_until_ms = now + TEAM_SWAP_CD_MS
	# Inside Job bookkeeping: the lurker rejoins the fight when its owner
	# swaps back in; the outgoing bear slips behind the enemy field.
	if next_instance == _inside_job_instance:
		_free_inside_job_ghost()
	if outgoing_inside_job:
		_spawn_inside_job_ghost(cur)
	# Lingering Shadow bookkeeping — recalled when its owner rejoins; the
	# outgoing wherewolf's shadow stays to prowl the opponent's tiles.
	if next_instance == _lingering_instance:
		_free_lingering_shadow()
	if outgoing_lingering:
		_spawn_lingering_shadow(cur)
	# Short Fuse — swapping IN counts as entering the fight: ignite rage.
	if TraitRegistry.rage_at_start(_player.traits):
		_apply_rage(_player)
	_player.global_position = _player_cell_to_world(_player_cell)
	# Swap punch + announce.
	_player.scale = Vector3(0.5, 0.5, 0.5)
	var pop := create_tween()
	pop.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	pop.tween_property(_player, "scale", Vector3.ONE, 0.3)
	_spawn_popup(_player.global_position, "▶ %s" % _player.display_name.to_upper(), Color(0.55, 0.85, 1.0))
	print("Team swap → %s (%d/%d)" % [_player.display_name, (pos + 1) % team.size() + 1, team.size()])

# === INSIDIBEAR: RAGE + INSIDE JOB ===

func _apply_rage(who: Combatant) -> void:
	var risky := TraitRegistry.rage_at_start(who.traits)
	var dur := RAGE_RISKY_MS if risky else RAGE_MS
	var buff: Dictionary = who.apply_buff("rage", RAGE_RISKY_TAKEN if risky else 1.0, 1.0, dur)
	buff["all_card_mult"] = RAGE_CARD_MULT
	var halo := MoveRegistry._make_buff_halo(Color(0.95, 0.20, 0.20))
	who.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	var rage_tex := load(INSIDIBEAR_RAGE_SPRITE) as Texture2D
	if rage_tex != null:
		who.set_texture(rage_tex)
	_spawn_popup(who.global_position + POPUP_OFFSET, "RAGE!", Color(0.95, 0.25, 0.25))
	print("%s RAGES — cards x%.1f for %.0fs%s" % [who.display_name, RAGE_CARD_MULT, dur / 1000.0, " (reckless: takes x1.2)" if risky else ""])

# Restore the calm skin the moment rage burns out (a swap restores it via
# apply_def instead).
func _on_buff_expired_hooks(id: String, who: Combatant) -> void:
	if id == "rage" and who.monster_def != null:
		who.set_texture(who.monster_def.sprite)

# Grudge Shot — Insidibear's two-mode basic. Calm: weak slow shot on a
# 2-ammo clip. Raging: ammo-free stunning laser, 3s cooldown. The bullet's
# speed/rider are set in _spawn_basic_bullet's kind match.
func _basic_rage_shot(shooter: Combatant, dir: Vector3) -> void:
	if shooter.has_buff("rage"):
		if not shooter.basic_cd_ready():
			return
		shooter.start_basic_cd(RAGE_LASER_CD_MS)
		_spawn_basic_bullet(shooter, dir, _basic_attack_damage(shooter, RAGE_LASER_DAMAGE), false)
	else:
		if not shooter.consume_ammo():
			print("%s out of ammo (reloading)" % shooter.display_name)
			return
		_spawn_basic_bullet(shooter, dir, _basic_attack_damage(shooter, RAGE_SLOW_SHOT_DAMAGE), false)

# Fortune Shot — Mosseer's weak "always up" basic: a big 5-round clip with a
# short 0.5s CD so it can't be turbo-mashed. The real payload is the 5-hit
# forced shuffle paid by the on_basic_hit hub.
func _basic_seer_shot(shooter: Combatant, dir: Vector3) -> void:
	if not shooter.basic_cd_ready():
		return
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	shooter.start_basic_cd(SEER_SHOT_CD_MS)
	_spawn_basic_bullet(shooter, dir, _basic_attack_damage(shooter, SEER_SHOT_DAMAGE), false)

# Fortune Shot payoff — ram the victim's hand back into their deck (they
# redraw; fate may deal the same cards straight back), charge the shooter's
# next grass CARD +10 (one-shot, re-proc refreshes), and advance the Fortune
# Told (secret trait) shuffle count toward the permanent grass ×1.5.
func _mosseer_fortune_proc(shooter: Combatant, victim: Combatant) -> void:
	victim.force_shuffle_hand()
	_spawn_popup(victim.global_position, "SHUFFLED!", Color(0.55, 0.95, 0.45))
	var buff: Dictionary = shooter.apply_buff("seer_charge", 1.0, 1.0, SEER_CHARGE_MS)
	buff["card_type_flat_grass"] = SEER_CHARGE_BONUS
	var halo := MoveRegistry._make_buff_halo(Color(0.45, 0.90, 0.35))
	shooter.add_child(halo)
	halo.position = Vector3(0.0, 0.1, 0.0)
	buff["visual"] = halo
	print("%s reads the cards — %s shuffles; next grass card +%d" % [shooter.display_name, victim.display_name, SEER_CHARGE_BONUS])
	shooter.forced_shuffles += 1
	if shooter.forced_shuffles == MOSSEER_FORTUNE_SHUFFLES and TraitRegistry.has_fortune_told(shooter.traits):
		var fbuff: Dictionary = shooter.apply_buff("fortune_told", 1.0, 1.0, 999999000)
		fbuff["card_type_mult_grass"] = FORTUNE_TOLD_MULT
		var fhalo := MoveRegistry._make_buff_halo(Color(1.0, 0.85, 0.30))
		shooter.add_child(fhalo)
		fhalo.position = Vector3(0.0, 0.1, 0.0)
		fbuff["visual"] = fhalo
		_spawn_popup(shooter.global_position, "FORTUNE TOLD!", Color(1.0, 0.85, 0.30))
		print("%s — FORTUNE TOLD: grass cards x%.1f for the match" % [shooter.display_name, FORTUNE_TOLD_MULT])

# === WHEREWOLF: SHADOW STRIKE (mons.xlsx row 20) ===
# Hold-SPACE basic on a 3s CD: a greyed semi-transparent wherewolf appears on
# the tile BEHIND the opponent, and 0.5s later lunges at the cell the opponent
# stood on at cast time — 18 full charge / 9 early release, + 1s stun.
# DODGEABLE: stepping off the cell during the telegraph whiffs it.

func _shadow_strike(shooter: Combatant, full_charge: bool) -> void:
	if not shooter.basic_cd_ready():
		return
	var victim := get_opponent(shooter)
	if victim == null or not is_instance_valid(victim) or not victim.is_alive():
		return
	shooter.start_basic_cd(SHADOW_STRIKE_CD_MS)
	var v_side := get_side(victim)
	var target_cell := get_caster_cell(victim)
	# "Behind" = one column deeper into the victim's territory. Extrapolates
	# past the back edge (same cell math as the Inside Job lurker).
	var behind_dx := 1 if v_side == SIDE_ENEMY else -1
	var ghost_cell := Vector2i(target_cell.x + behind_dx, target_cell.y)
	var ghost := _make_shadow_ghost()
	_world.add_child(ghost)
	ghost.global_position = cell_to_world(v_side, ghost_cell)
	var base := SHADOW_STRIKE_DAMAGE if full_charge else SHADOW_STRIKE_HALF_DAMAGE
	var tw := create_tween()
	tw.tween_interval(SHADOW_STRIKE_DELAY_S)
	tw.tween_callback(_shadow_strike_land.bind(shooter, v_side, target_cell, base, ghost))

func _shadow_strike_land(shooter: Combatant, v_side: String, cell: Vector2i, base: int, ghost: Node3D) -> void:
	_free_shadow_ghost(ghost)
	if _battle_over:
		return
	MoveRegistry._spawn_punch(self, cell_to_world(v_side, cell), get_side(shooter) == SIDE_ENEMY)
	var victim := combatant_at(v_side, cell)
	if victim == null or not victim.is_alive():
		if is_instance_valid(shooter):
			print("%s — Shadow Strike whiffs (target slipped away)" % shooter.display_name)
		return
	if shooter == null or not is_instance_valid(shooter):
		return
	var dmg := _basic_attack_damage(shooter, base)
	# Opportunist — striking an ALREADY-stunned target crits (checked before
	# this strike applies its own stun).
	if dmg > 0 and victim.is_stunned() and TraitRegistry.shadow_crit_on_stunned(shooter.traits):
		dmg = int(round(dmg * OPPORTUNIST_CRIT_MULT))
		_spawn_popup(victim.global_position, "CRIT!", Color(1.0, 0.85, 0.25))
		print("%s — Opportunist: crit on the stunned %s" % [shooter.display_name, victim.display_name])
	victim.take_damage(dmg, shooter.monster_type, "shadow_strike")
	if dmg > 0:
		victim.apply_stun(SHADOW_STRIKE_STUN_MS, shooter)
	on_basic_hit(shooter, victim)

# Semi-transparent shadow apparition — the user's "shadow of a man" art
# (4-frame loop). Shared by Shadow Strike's telegraph, Phantom Fang's flying
# shadow, and the Lingering Shadow prowler.
func _make_shadow_ghost() -> Node3D:
	var ghost := Node3D.new()
	var spr := MoveRegistry._make_fx_sprite(MoveRegistry.WWSHADOW_FRAMES, 0.045)
	spr.position.y = 0.8
	spr.modulate = Color(1.0, 1.0, 1.0, 0.60)
	ghost.add_child(spr)
	ghost.ready.connect(func() -> void:
		var tw := spr.create_tween().set_loops()
		for i in range(MoveRegistry.WWSHADOW_FRAMES.size()):
			var tex: Texture2D = MoveRegistry.WWSHADOW_FRAMES[(i + 1) % MoveRegistry.WWSHADOW_FRAMES.size()]
			tw.tween_interval(MoveRegistry.WWSHADOW_FRAME_S)
			tw.tween_callback(func() -> void: spr.texture = tex))
	return ghost

func _free_shadow_ghost(ghost: Node3D) -> void:
	if ghost == null or not is_instance_valid(ghost):
		return
	var spr := ghost.get_child(0) as Sprite3D
	var tw := create_tween()
	if spr != null:
		tw.tween_property(spr, "modulate:a", 0.0, 0.2)
	else:
		tw.tween_interval(0.2)
	tw.tween_callback(ghost.queue_free)

# Phantom Fang (secret trait) — replaces Shadow Strike: on release the wolf
# VANISHES 2s (bullets pass through; cards/tiles still land) and a shadow
# flies boomerang-style down his row. Outbound hits shove the victim to the
# REAR column of their row; return-leg hits drag them to the FRONT. Weak 8,
# once per leg. Same 3s CD; launches on any release (charge is the wind-up).
func _phantom_fang(shooter: Combatant) -> void:
	if not shooter.basic_cd_ready():
		return
	var side := get_side(shooter)
	var start := get_caster_cell(shooter)
	var out_path: Array = []
	for d in range(1, PHANTOM_FANG_RANGE + 1):
		var info := MoveRegistry._project_forward(side, start, d)
		if info.is_empty():
			break
		out_path.append({"side": info["side"], "cell": Vector2i(int(info["x"]), start.y)})
	if out_path.is_empty():
		return
	shooter.start_basic_cd(SHADOW_STRIKE_CD_MS)
	shooter.apply_vanish(PHANTOM_FANG_VANISH_MS)
	var dmg := _basic_attack_damage(shooter, PHANTOM_FANG_DAMAGE)
	var vis := _make_shadow_ghost()
	_world.add_child(vis)
	vis.global_position = cell_to_world(side, start)
	var flight: Array = out_path.duplicate()
	var back: Array = out_path.duplicate()
	back.reverse()
	flight.append_array(back)
	flight.append({"side": side, "cell": start})
	var out_len := out_path.size()
	var state := {"hit_out": false, "hit_back": false}
	var tween := create_tween()
	for i in range(flight.size()):
		var entry: Dictionary = flight[i]
		tween.tween_callback(_fang_step.bind(shooter, vis, entry, dmg, i >= out_len, state))
		tween.tween_interval(PHANTOM_FANG_STEP_S)
	tween.tween_callback(func() -> void:
		if is_instance_valid(vis):
			vis.queue_free())
	print("%s melts into shadow and sends the fang" % shooter.display_name)

func _fang_step(shooter: Combatant, vis: Node3D, entry: Dictionary, dmg: int, returning: bool, state: Dictionary) -> void:
	var e_side: String = entry["side"]
	var e_cell: Vector2i = entry["cell"]
	if is_instance_valid(vis):
		var glide := create_tween()
		glide.tween_property(vis, "global_position", cell_to_world(e_side, e_cell), PHANTOM_FANG_STEP_S)
	var leg_key := "hit_back" if returning else "hit_out"
	if state.get(leg_key, false):
		return
	var target := combatant_at(e_side, e_cell)
	if target == null or target == shooter or not target.is_alive():
		return
	if shooter == null or not is_instance_valid(shooter):
		return
	state[leg_key] = true
	target.take_damage(dmg, shooter.monster_type, "phantom_fang")
	on_basic_hit(shooter, target)
	_fang_displace(target, returning)

# Slide the fang's victim to the extreme column of their row: REAR when hit
# on the outbound leg (shoved away), FRONT when clipped on the return (dragged
# along). Walls, turrets and broken tiles stop the slide short.
func _fang_displace(victim: Combatant, returning: bool) -> void:
	if victim == null or not is_instance_valid(victim) or not victim.is_alive():
		return
	var v_side := get_side(victim)
	var cell := get_caster_cell(victim)
	# On the enemy grid the rear is high x; on the player grid it's x=0.
	var rear_dir := 1 if v_side == SIDE_ENEMY else -1
	var step := -rear_dir if returning else rear_dir
	var dest := cell
	while true:
		var nxt := Vector2i(dest.x + step, dest.y)
		if nxt.x < 0 or nxt.x >= GRID_COLS:
			break
		if combatant_blocked_at(v_side, nxt):
			break
		if turret_at_cell(v_side, nxt) != null:
			break
		dest = nxt
	if dest == cell:
		return
	set_caster_cell(victim, dest)
	var tw := create_tween()
	tw.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tw.tween_property(victim, "global_position", cell_to_world(v_side, dest), 0.25)
	print("%s is %s by the fang" % [victim.display_name, "dragged to the front" if returning else "shoved to the rear"])

# === LINGERING SHADOW (Wherewolf trait) ===
# Swapping Wherewolf out leaves his shadow prowling the OPPONENT'S grid: one
# random adjacent cell every 0.9s. The moment the enemy shares its cell
# (either party moving) they're stunned 1s and the shadow is spent. Recalled
# when its owner swaps back in; respawns on his next swap-out.

func _spawn_lingering_shadow(instance_idx: int) -> void:
	_free_lingering_shadow()
	# Same "shadow of a man" art as Shadow Strike, a touch fainter.
	var ghost := _make_shadow_ghost()
	var g_spr := ghost.get_child(0) as Sprite3D
	if g_spr != null:
		g_spr.modulate = Color(1.0, 1.0, 1.0, 0.5)
	_world.add_child(ghost)
	# Start on a random enemy-grid cell that isn't under the enemy's feet.
	var cells: Array = []
	for x in range(GRID_COLS):
		for y in range(GRID_ROWS):
			var c := Vector2i(x, y)
			if c != _enemy_cell:
				cells.append(c)
	_lingering_cell = cells[randi() % cells.size()]
	ghost.global_position = _enemy_cell_to_world(_lingering_cell)
	_lingering_shadow = ghost
	_lingering_instance = instance_idx
	_lingering_step_timer = 0.0
	print("Lingering Shadow — Wherewolf's shadow stays to prowl")

func _tick_lingering_shadow(delta: float) -> void:
	if _lingering_shadow == null or not is_instance_valid(_lingering_shadow):
		return
	if not _enemy.is_alive():
		return
	# Contact first — covers the enemy walking onto the shadow AND the shadow
	# drifting onto the enemy on its last step.
	if _enemy_cell == _lingering_cell:
		_enemy.apply_stun(LINGERING_SHADOW_STUN_MS)
		_spawn_popup(_enemy.global_position, "SHADOW GRIP!", Color(0.55, 0.45, 0.75))
		print("Lingering Shadow catches %s — stunned" % _enemy.display_name)
		_free_lingering_shadow()
		return
	_lingering_step_timer += delta
	if _lingering_step_timer < LINGERING_SHADOW_STEP_S:
		return
	_lingering_step_timer = 0.0
	var dirs: Array = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	dirs.shuffle()
	for d in dirs:
		var dv: Vector2i = d
		var nxt: Vector2i = _lingering_cell + dv
		if nxt.x < 0 or nxt.x >= GRID_COLS or nxt.y < 0 or nxt.y >= GRID_ROWS:
			continue
		_lingering_cell = nxt
		var tw := create_tween()
		tw.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tw.tween_property(_lingering_shadow, "global_position", _enemy_cell_to_world(nxt), 0.3)
		break

func _free_lingering_shadow() -> void:
	if _lingering_shadow != null and is_instance_valid(_lingering_shadow):
		_lingering_shadow.queue_free()
	_lingering_shadow = null
	_lingering_instance = -1

# === JESTER: HALO BEAM (mons.xlsx row 120) ===
# 3-ammo light beam (5s reload) that sweeps tile-by-tile down the caster's
# row and passes through blocks entirely — no stop, no chip. Dodgeable by
# changing rows before the sweep arrives. Traits: Limelight marks the victim
# (×1.2 taken from ALL sources, 3s), Bright Ward guards the caster when a
# beam hit lands damage, Afterglow drops a heal_font under the caster.

func _basic_jester_beam(shooter: Combatant) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var start := get_caster_cell(shooter)
	var path: Array = []
	for d in range(1, GRID_COLS * 2 + 1):
		var info := MoveRegistry._project_forward(side, start, d)
		if info.is_empty():
			break
		path.append({"side": info["side"], "cell": Vector2i(int(info["x"]), start.y)})
	if path.is_empty():
		return
	# Blind rolls once for the whole sweep, like every other basic swing.
	var dmg := _basic_attack_damage(shooter, JESTER_BEAM_DAMAGE)
	# Afterglow (secret) — the beam leaves healing light under the caster.
	# heal_font pays the owner only, so jester drinks it by holding his ground.
	if TraitRegistry.has_afterglow(shooter.traits):
		spawn_tile(shooter, side, start, "heal_font", AFTERGLOW_HEAL_MS, true)
	var tween := create_tween()
	for i in range(path.size()):
		var entry: Dictionary = path[i]
		tween.tween_callback(_jester_beam_step.bind(shooter, entry, dmg))
		tween.tween_interval(JESTER_BEAM_STEP_S)

func _jester_beam_step(shooter: Combatant, entry: Dictionary, dmg: int) -> void:
	if _battle_over:
		return
	var e_side: String = entry["side"]
	var e_cell: Vector2i = entry["cell"]
	MoveRegistry._spawn_beam_segment(self, cell_to_world(e_side, e_cell), get_side(shooter) == SIDE_ENEMY)
	var target := combatant_at(e_side, e_cell)
	if target == null or target == shooter or not target.is_alive():
		return
	if shooter == null or not is_instance_valid(shooter):
		return
	var dealt := target.take_damage(dmg, shooter.monster_type, "halo_beam")
	on_basic_hit(shooter, target)
	# Limelight — beam hits MARK the victim briefly: ×1.2 taken from all
	# sources (rides the buff system's taken-mult; re-mark refreshes).
	if target.is_alive() and TraitRegistry.has_limelight(shooter.traits):
		var mark: Dictionary = target.apply_buff("limelight_mark", LIMELIGHT_MARK_MULT, 1.0, LIMELIGHT_MARK_MS)
		var halo := MoveRegistry._make_buff_halo(Color(1.0, 0.90, 0.40))
		target.add_child(halo)
		halo.position = Vector3(0.0, 0.1, 0.0)
		mark["visual"] = halo
		print("%s — Limelight: %s is MARKED (takes x%.1f for %.0fs)" % [shooter.display_name, target.display_name, LIMELIGHT_MARK_MULT, LIMELIGHT_MARK_MS / 1000.0])
	# Bright Ward — a beam that LANDS damage shields the caster.
	if dealt > 0 and TraitRegistry.has_bright_ward(shooter.traits):
		shooter.grant_guarded(BRIGHT_WARD_GUARD_MS)
		print("%s — Bright Ward: GUARDED %dms" % [shooter.display_name, BRIGHT_WARD_GUARD_MS])

func _spawn_inside_job_ghost(instance_idx: int) -> void:
	_free_inside_job_ghost()
	var ghost := Node3D.new()
	var spr := Sprite3D.new()
	spr.texture = load(INSIDIBEAR_RAGE_SPRITE) as Texture2D
	spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	spr.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	spr.pixel_size = 0.045
	spr.position.y = 0.8
	spr.modulate = Color(1.0, 1.0, 1.0, 0.85)
	ghost.add_child(spr)
	_world.add_child(ghost)
	_ghost_row = 0
	_ghost_dir = 1
	_ghost_move_timer = 0.0
	_ghost_shot_timer = 0.0
	ghost.global_position = _inside_job_world(_ghost_row)
	_inside_job_ghost = ghost
	_inside_job_instance = instance_idx
	print("Inside Job — Insidibear slips behind the enemy field")

func _inside_job_world(row: int) -> Vector3:
	# One tile beyond the enemy grid's back column (cell math extrapolates).
	return _enemy_cell_to_world(Vector2i(GRID_COLS, row))

func _free_inside_job_ghost() -> void:
	if _inside_job_ghost != null and is_instance_valid(_inside_job_ghost):
		_inside_job_ghost.queue_free()
	_inside_job_ghost = null
	_inside_job_instance = -1

func _tick_inside_job(delta: float) -> void:
	if _inside_job_ghost == null or not is_instance_valid(_inside_job_ghost):
		return
	# Pace up and down the back edge.
	_ghost_move_timer += delta
	if _ghost_move_timer >= GHOST_MOVE_S:
		_ghost_move_timer = 0.0
		_ghost_row += _ghost_dir
		if _ghost_row >= GRID_ROWS:
			_ghost_row = GRID_ROWS - 2
			_ghost_dir = -1
		elif _ghost_row < 0:
			_ghost_row = 1
			_ghost_dir = 1
		var tw := create_tween()
		tw.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tw.tween_property(_inside_job_ghost, "global_position", _inside_job_world(_ghost_row), 0.3)
	# Pot-shot: enemy in his row AND lingering in their rear tiles.
	_ghost_shot_timer += delta
	if _ghost_shot_timer < GHOST_SHOT_CD_S:
		return
	if not _enemy.is_alive():
		return
	if _enemy_cell.y != _ghost_row or _enemy_cell.x < GRID_COLS - GHOST_REAR_COLS:
		return
	_ghost_shot_timer = 0.0
	var bullet := BULLET_SCENE.instantiate() as Bullet
	bullet.direction = Vector3.LEFT
	bullet.source_type = "dark"
	bullet.source_label = "insidibear_inside_job"
	bullet.ignore = _inside_job_ghost
	bullet.owner_side = SIDE_PLAYER
	bullet.battle = self
	bullet.damage = GHOST_DAMAGE
	_world.add_child(bullet)
	var spawn: Vector3 = _inside_job_ghost.global_position + Vector3.LEFT * 0.6
	spawn.y += 0.55
	bullet.global_position = spawn

func _try_catch() -> void:
	if _battle_over or _catch_pause or _player.is_stunned():
		return
	if Time.get_ticks_msec() < _catch_cd_until_ms:
		print("Catch line still recoiling (cooldown)")
		return
	if not _player.spend_mana(CATCH_MANA_COST):
		print("Catch needs %d mana" % CATCH_MANA_COST)
		return
	_catch_cd_until_ms = Time.get_ticks_msec() + CATCH_CD_MS
	var side := get_side(_player)
	var ccell := get_caster_cell(_player)
	var target: Combatant = null
	var last_entry: Dictionary = {}
	for d in range(1, CATCH_RANGE + 1):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			break
		last_entry = info
		var s_side: String = info["side"]
		var s_cell := Vector2i(int(info["x"]), ccell.y)
		var occupant := combatant_at(s_side, s_cell)
		if occupant != null and occupant != _player:
			target = occupant
			break
	var from: Vector3 = _player.global_position + Vector3(0.0, 0.8, 0.0)
	var to: Vector3
	if target != null:
		to = target.global_position + Vector3(0.0, 0.8, 0.0)
	elif not last_entry.is_empty():
		to = cell_to_world(last_entry["side"], Vector2i(int(last_entry["x"]), ccell.y)) + Vector3(0.0, 0.8, 0.0)
	else:
		to = from + Vector3.RIGHT * 2.0
	MoveRegistry._spawn_lasso_rope(self, from, to)
	if target == null:
		print("Catch line whiffed — nothing inline within %d tiles" % CATCH_RANGE)
		return
	var threshold := int(ceil(float(target.max_hp) * CATCH_HP_FRACTION))
	if target.hp > threshold:
		_spawn_popup(target.global_position + POPUP_OFFSET, "TOO STRONG!", CATCH_COLOR)
		print("Catch failed — %s at %d HP, needs ≤%d (25%%)" % [target.display_name, target.hp, threshold])
		return
	_begin_catch_attempt(target, threshold)

func _begin_catch_attempt(target: Combatant, threshold: int) -> void:
	_catch_pause = true
	_spawn_popup(target.global_position + POPUP_OFFSET, "CATCHING…", CATCH_COLOR)
	# Struggle wobble while the roll charges.
	var base_scale: Vector3 = target.scale
	var wobble := create_tween().set_loops(3)
	wobble.tween_property(target, "scale", base_scale * 1.10, 0.12)
	wobble.tween_property(target, "scale", base_scale * 0.92, 0.24)
	wobble.tween_property(target, "scale", base_scale, 0.12)
	var t := create_tween()
	t.tween_interval(CATCH_PAUSE_S)
	t.tween_callback(_resolve_catch.bind(target, threshold))

func _resolve_catch(target: Combatant, threshold: int) -> void:
	if _battle_over or not is_instance_valid(target) or not target.is_alive():
		_catch_pause = false
		return
	# 90% at death's door → 40% right at the window edge (React curve mapped
	# onto the 25% window).
	var chance := clampf(0.9 - 0.5 * (float(target.hp) / float(threshold)), 0.4, 0.9)
	print("Catch roll: %s hp=%d threshold=%d → %.0f%%" % [target.display_name, target.hp, threshold, chance * 100.0])
	if randf() < chance:
		_catch_success(target)
	else:
		_catch_pause = false
		_spawn_popup(target.global_position + POPUP_OFFSET, "BROKE FREE!", Color(0.95, 0.50, 0.40))
		print("%s broke free!" % target.display_name)

func _catch_success(target: Combatant) -> void:
	var mon_id := target.monster_def.id if target.monster_def != null else ""
	# Keep the trait the enemy fought with — its panel showed it, so hunting a
	# specific trait is an informed decision.
	var trait_index := 0
	var trait_label := "no trait"
	if target.monster_def != null and target.traits.size() > 0 and target.traits[0] != null:
		trait_index = maxi(0, target.monster_def.trait_pool.find(target.traits[0]))
		trait_label = (target.traits[0] as TraitDef).display_name
	SceneManager.record_catch(mon_id, trait_index)
	print("CAUGHT %s (trait: %s)!" % [target.display_name, trait_label])
	# Capture suck-in: shrink the mon away, then the banner ends the battle.
	var shrink := create_tween()
	shrink.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	shrink.tween_property(target, "scale", Vector3(0.02, 0.02, 0.02), 0.45)
	_show_result_animation("catch", target.display_name.to_upper())

# Mushroom's charged-walker basic — release on full charge spawns a
# mushroom soldier at the caster's current cell. The walker uses the same
# forward_walker + poison_trap trail as Fairy Ring, plus a small contact
# damage payload so it threatens enemies it physically catches. The walker
# overlaps the caster for the first ~1.5s before its first forward step,
# then crosses the grid as a moving threat.
const BASIC_MUSHROOM_HP := 8
const BASIC_MUSHROOM_STEP_INTERVAL_S := 1.5
const BASIC_MUSHROOM_TRAIL_LIFETIME_MS := 6000
const BASIC_MUSHROOM_CONTACT_DMG := 5

func _basic_spawn_walker(shooter: Combatant) -> void:
	if not shooter.consume_ammo():
		print("%s out of mushroom slots (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var m := spawn_turret(shooter, side, ccell, BASIC_MUSHROOM_HP, 99.0, 0, BASIC_MUSHROOM_SPRITE, Color.WHITE)
	if m == null:
		return
	m.fires_bullets = false
	m.move_interval_s = BASIC_MUSHROOM_STEP_INTERVAL_S
	m.forward_walker = true
	m.drop_tile_on_step = "poison_trap"
	m.drop_tile_lifetime_ms = BASIC_MUSHROOM_TRAIL_LIFETIME_MS
	m.contact_damage = BASIC_MUSHROOM_CONTACT_DMG
	m.contact_label = "mushroom_basic"
	m.contact_type = shooter.monster_type
	print("%s spawns mushroom soldier at %s/%s" % [shooter.display_name, side, str(ccell)])

const GUARD_MAX := 2
const GUARD_HP := 15
const GUARD_FIRE_INTERVAL_S := 2.0
const GUARD_BULLET_DAMAGE := 5
const GUARD_BOMB_DAMAGE := 12

# Modizard basic — "Call a guard" (reverted to the original version per
# user): 1 ammo summons a stationary guard turret at the rear column of the
# shooter's row, max 2 alive. Guards fire every ~2s for 5 DMG — 12 with
# Bomb Lobbers; Pickpockets gives guard bullets the 2 HP siphon.
func _basic_call_guard(shooter: Combatant) -> void:
	var side := get_side(shooter)
	var guard_count := 0
	for t in get_tree().get_nodes_in_group("turrets"):
		var turret := t as Turret
		if turret == null or turret.hp <= 0:
			continue
		if turret.is_guard and turret.owner_combatant == shooter:
			guard_count += 1
	if guard_count >= GUARD_MAX:
		print("%s already commands %d guards" % [shooter.display_name, GUARD_MAX])
		return
	if not shooter.consume_ammo():
		print("%s out of guard charges (reloading)" % shooter.display_name)
		return
	var ccell := get_caster_cell(shooter)
	var rear_x := 0 if side == SIDE_PLAYER else GRID_COLS - 1
	var guard_cell := Vector2i(rear_x, clampi(ccell.y, 0, GRID_ROWS - 1))
	var dmg := GUARD_BOMB_DAMAGE if TraitRegistry.guard_bombs(shooter.traits) else GUARD_BULLET_DAMAGE
	var guard := spawn_turret(shooter, side, guard_cell, GUARD_HP, GUARD_FIRE_INTERVAL_S, dmg)
	if guard != null:
		guard.is_guard = true
		guard.bullet_type = shooter.monster_type
		if TraitRegistry.guard_steal(shooter.traits):
			guard.bullet_steal_heal = 2
	print("%s calls a guard at %s/%s (%d DMG shots every %.1fs)" % [shooter.display_name, side, str(guard_cell), dmg, GUARD_FIRE_INTERVAL_S])

func _basic_build_block(shooter: Combatant) -> void:
	if not shooter.consume_ammo():
		print("%s out of build charges (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	# 1 cell directly forward — may cross to opponent grid if shooter is at front.
	var info := MoveRegistry._project_forward(side, ccell, 1)
	if info.is_empty():
		return
	var block_side: String = info["side"]
	var block_cell := Vector2i(info["x"], ccell.y)
	var hp := 1 + TraitRegistry.wall_bonus_hp(shooter.traits)
	spawn_wall(shooter, block_side, block_cell, hp)
	print("%s built block at %s/%s (HP %d)" % [shooter.display_name, block_side, str(block_cell), hp])

# === BUILDER BASICS WITH LAUNCH (Hogglin range 2, Fudo statue range 3) ===
# mons.xlsx: pressing basic with your own block directly in front LAUNCHES it
# forward instead of building — it slides launch_range cells, the first
# non-friendly wall/combatant takes damage and stops it, and the block
# crumbles at the end either way. Building stays ammo-gated as before.

const LAUNCH_DAMAGE := 15
const LAUNCH_STEP_S := 0.10

func _basic_build_or_launch(shooter: Combatant, launch_range: int) -> void:
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var front := MoveRegistry._project_forward(side, ccell, 1)
	if front.is_empty():
		return
	var f_side: String = front["side"]
	var f_cell := Vector2i(int(front["x"]), ccell.y)
	var own_wall := wall_at_cell(f_side, f_cell)
	if own_wall != null and own_wall.owner_combatant == shooter and not (own_wall is Boulder):
		_launch_wall(shooter, own_wall, launch_range)
		return
	_basic_build_block(shooter)

func _launch_wall(shooter: Combatant, wall: Wall, launch_range: int) -> void:
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	_walls.erase(wall)  # in flight — no longer a standing block
	var cells: Array = []
	for d in range(2, 2 + launch_range):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			break
		cells.append({"side": info["side"], "cell": Vector2i(int(info["x"]), ccell.y)})
	var dmg := _basic_attack_damage(shooter, LAUNCH_DAMAGE)
	var state := {"stopped": false}
	var captured_wall: Wall = wall
	var tween := create_tween()
	for i in range(cells.size()):
		var entry: Dictionary = cells[i]
		tween.tween_callback(_launch_wall_step.bind(shooter, captured_wall, entry, dmg, state))
		tween.tween_interval(LAUNCH_STEP_S)
	tween.tween_callback(func() -> void:
		if is_instance_valid(captured_wall):
			captured_wall.queue_free())
	print("%s launches the block forward (%d cells max)" % [shooter.display_name, launch_range])

func _launch_wall_step(shooter: Combatant, wall: Wall, entry: Dictionary, dmg: int, state: Dictionary) -> void:
	if state.get("stopped", false) or not is_instance_valid(wall):
		return
	var e_side: String = entry["side"]
	var e_cell: Vector2i = entry["cell"]
	var slide := create_tween()
	slide.tween_property(wall, "global_position", cell_to_world(e_side, e_cell), LAUNCH_STEP_S)
	var blocking := wall_at_cell(e_side, e_cell)
	if blocking != null and blocking != wall and blocking.owner_combatant != shooter:
		blocking.take_damage(1, shooter)
		state["stopped"] = true
		return
	# Ally units (mushroom soldiers, rats, guards, fairies…) get plowed too.
	var t_turret := turret_at_cell(e_side, e_cell)
	if t_turret != null and t_turret.owner_combatant != shooter and t_turret.hp > 0:
		t_turret.take_damage(dmg, shooter)
		state["stopped"] = true
		return
	var target := combatant_at(e_side, e_cell)
	if target != null and target != shooter and target.is_alive():
		target.take_damage(dmg, shooter.monster_type, "block_launch")
		on_basic_hit(shooter, target)
		state["stopped"] = true

# === LUNAPRA: CRESCENT TOSS (mons.xlsx row 7) ===
# Cooldown-only weak boomerang: flies 3 cells out along the cast row and
# returns over the same cells to the origin. Any combatant on a visited cell
# takes damage (out AND back can both connect). Catching it — standing on
# its cell during the return leg — resets the 3s cooldown instantly.

const BOOMERANG_BASIC_DAMAGE := 8
const BOOMERANG_BASIC_CD_MS := 3000
const BOOMERANG_BASIC_RANGE := 3
const BOOMERANG_BASIC_STEP_S := 0.13

func _basic_boomerang(shooter: Combatant) -> void:
	var side := get_side(shooter)
	var start := get_caster_cell(shooter)
	var out_path: Array = []
	for d in range(1, BOOMERANG_BASIC_RANGE + 1):
		var info := MoveRegistry._project_forward(side, start, d)
		if info.is_empty():
			break
		out_path.append({"side": info["side"], "cell": Vector2i(int(info["x"]), start.y)})
	if out_path.is_empty():
		return
	# 1 ammo + 3s reload = "3s cooldown unless caught" — catching refunds
	# the shot instantly (see _boomerang_step).
	if not shooter.consume_ammo():
		print("%s crescent still returning (reloading)" % shooter.display_name)
		return
	var dmg := _basic_attack_damage(shooter, BOOMERANG_BASIC_DAMAGE)
	var vis := _make_crescent_visual()
	_world.add_child(vis)
	vis.global_position = cell_to_world(side, start) + Vector3(0.0, 0.8, 0.0)
	var spin := vis.create_tween().set_loops()
	spin.tween_property(vis.get_child(0), "rotation:y", TAU, 0.35).as_relative()
	# Full flight: out, back over the same cells, then the origin cell.
	var flight: Array = out_path.duplicate()
	var back: Array = out_path.duplicate()
	back.reverse()
	flight.append_array(back)
	flight.append({"side": side, "cell": start})
	var out_len := out_path.size()
	var state := {"caught": false}
	var tween := create_tween()
	for i in range(flight.size()):
		var entry: Dictionary = flight[i]
		tween.tween_callback(_boomerang_step.bind(shooter, vis, entry, dmg, i >= out_len, state))
		tween.tween_interval(BOOMERANG_BASIC_STEP_S)
	tween.tween_callback(func() -> void:
		if is_instance_valid(vis):
			vis.queue_free())

func _boomerang_step(shooter: Combatant, vis: Node3D, entry: Dictionary, dmg: int, returning: bool, state: Dictionary) -> void:
	if state.get("caught", false):
		return
	var e_side: String = entry["side"]
	var e_cell: Vector2i = entry["cell"]
	if is_instance_valid(vis):
		var glide := create_tween()
		glide.tween_property(vis, "global_position", cell_to_world(e_side, e_cell) + Vector3(0.0, 0.8, 0.0), BOOMERANG_BASIC_STEP_S)
	# Crescent breaks blocks in its path (user amend) — enemy walls take a
	# hit and the crescent powers on through.
	var blocking := wall_at_cell(e_side, e_cell)
	if blocking != null and is_instance_valid(shooter) and blocking.owner_combatant != shooter:
		blocking.take_damage(1, shooter)
	var target := combatant_at(e_side, e_cell)
	if target != null and target != shooter and target.is_alive():
		target.take_damage(dmg, shooter.monster_type, "crescent_toss")
		on_basic_hit(shooter, target)
	# Catch on the return leg: the shot is refunded, reload cancelled.
	if returning and is_instance_valid(shooter) and shooter.is_alive():
		if get_side(shooter) == e_side and get_caster_cell(shooter) == e_cell:
			state["caught"] = true
			shooter.refund_ammo()
			if is_instance_valid(vis):
				vis.queue_free()
			print("%s catches the crescent — shot refunded" % shooter.display_name)

func _make_crescent_visual() -> Node3D:
	var root := Node3D.new()
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.34, 0.10, 0.34)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.85, 0.35)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.75, 0.25)
	mat.emission_energy_multiplier = 2.5
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material_override = mat
	root.add_child(mesh)
	return root

# === GRABBAKAT: STUN JAB (mons.xlsx row 8) ===
# 2-tile melee jab: low damage + 1s stun + pull 1 tile toward Grabbakat.
# If the pull lands the target directly in front of him, 2s stun instead.
# Walls block the jab from reaching deeper.

const JAB_BASE_DAMAGE := 8
const JAB_STUN_MS := 1000
const JAB_PULLED_STUN_MS := 2000

func _basic_stun_jab(shooter: Combatant) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var dmg := _basic_attack_damage(shooter, JAB_BASE_DAMAGE)
	for d in range(1, 3):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			return
		var j_side: String = info["side"]
		var j_cell := Vector2i(int(info["x"]), ccell.y)
		MoveRegistry._spawn_punch(self, cell_to_world(j_side, j_cell), get_side(shooter) == SIDE_ENEMY)
		var wall := wall_at_cell(j_side, j_cell)
		if wall != null:
			if wall.owner_combatant != shooter:
				wall.take_damage(1, shooter)
			return
		var target := combatant_at(j_side, j_cell)
		if target != null and target.is_alive():
			target.take_damage(dmg, shooter.monster_type, "stun_jab")
			if not target.is_alive():
				return
			var stun_ms := JAB_STUN_MS
			if d == 2:
				var pull_info := MoveRegistry._project_forward(side, ccell, 1)
				if not pull_info.is_empty():
					var p_side: String = pull_info["side"]
					var p_cell := Vector2i(int(pull_info["x"]), ccell.y)
					if p_side == get_side(target) and not combatant_blocked_at(p_side, p_cell):
						set_caster_cell(target, p_cell)
						var captured_target: Combatant = target
						var yank := create_tween()
						yank.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
						yank.tween_property(captured_target, "global_position", cell_to_world(p_side, p_cell), 0.15)
						stun_ms = JAB_PULLED_STUN_MS
			target.apply_stun(stun_ms, shooter)
			on_basic_hit(shooter, target)
			return

# === SLIME: SPIKE (mons.xlsx row 6, charged per user amend) ===
# Melee spike: tap covers the 2 tiles ahead; holding SPACE (charged_spike)
# extends the reach to 4 tiles. Each combatant hit takes damage and their
# floor turns poisoned (acid pool) for 5s. Walls block deeper reach.

const SPIKE_BASE_DAMAGE := 12
const SPIKE_POISON_MS := 5000

func _basic_spike_melee(shooter: Combatant, reach: int = 2) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var dmg := _basic_attack_damage(shooter, SPIKE_BASE_DAMAGE)
	for d in range(1, reach + 1):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			return
		var s_side: String = info["side"]
		var s_cell := Vector2i(int(info["x"]), ccell.y)
		MoveRegistry._spawn_punch(self, cell_to_world(s_side, s_cell), get_side(shooter) == SIDE_ENEMY)
		var wall := wall_at_cell(s_side, s_cell)
		if wall != null:
			if wall.owner_combatant != shooter:
				wall.take_damage(1, shooter)
			return
		var target := combatant_at(s_side, s_cell)
		if target != null and target.is_alive():
			target.take_damage(dmg, shooter.monster_type, "slime_spike")
			spawn_tile(shooter, s_side, s_cell, "acid_pool", SPIKE_POISON_MS, false)
			on_basic_hit(shooter, target)

# === KLAWR: CHARGED CLAW (starter) ===
# Slime-spike sibling. Tap = 2-tile claw; a landed hit FREEZES the victim's
# floor (user amend — they slide the way they were travelling). Full 1.5s
# charge = 4-tile reach AND the far two tiles (depths 3-4) freeze over too.
# Walls stop the sweep. NOTE: ALL frozen tiles are persistent (July 2026
# user rule) — they slip on every crossing and only expire by lifetime.

const CLAW_FREEZE_MS := 4000
const CLAW_FREEZE_FROM_DEPTH := 3

func _basic_claw_melee(shooter: Combatant, charged: bool) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var reach := 4 if charged else 2
	var dmg := _basic_attack_damage(shooter, SPIKE_BASE_DAMAGE)
	for d in range(1, reach + 1):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			return
		var s_side: String = info["side"]
		var s_cell := Vector2i(int(info["x"]), ccell.y)
		MoveRegistry._spawn_punch(self, cell_to_world(s_side, s_cell), get_side(shooter) == SIDE_ENEMY)
		var wall := wall_at_cell(s_side, s_cell)
		if wall != null:
			if wall.owner_combatant != shooter:
				wall.take_damage(1, shooter)
			return
		var target := combatant_at(s_side, s_cell)
		if target != null and target.is_alive():
			target.take_damage(dmg, shooter.monster_type, "klawr_claw")
			spawn_tile(shooter, s_side, s_cell, "frozen_tile", CLAW_FREEZE_MS, false)
			on_basic_hit(shooter, target)
		elif charged and d >= CLAW_FREEZE_FROM_DEPTH:
			spawn_tile(shooter, s_side, s_cell, "frozen_tile", CLAW_FREEZE_MS, false)

# === PIXIE: TRIPLE SHOT (mons.xlsx row 4) ===
# One ammo → three staggered weak bolts, each with an independent crit roll.

const TRIPLE_SHOT_DAMAGE := 2  # was 5 — user rebalance (July 2026)
const TRIPLE_CRIT_CHANCE := 0.15
const TRIPLE_STAGGER_S := 0.09

func _basic_triple_shot(shooter: Combatant, dir: Vector3) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var captured: Combatant = shooter
	var tween := create_tween()
	for i in range(3):
		tween.tween_callback(_fire_pixie_bolt.bind(captured, dir))
		tween.tween_interval(TRIPLE_STAGGER_S)

func _fire_pixie_bolt(shooter: Combatant, dir: Vector3) -> void:
	if not is_instance_valid(shooter) or not shooter.is_alive():
		return
	var dmg := _basic_attack_damage(shooter, TRIPLE_SHOT_DAMAGE)
	if randf() < TRIPLE_CRIT_CHANCE:
		dmg *= 2
	_spawn_basic_bullet(shooter, dir, dmg, false)

# === GIANT: TILE STEAL (mons.xlsx row 23, yammie) ===
# Ammo-gated punch (3 charges, 3s reload — set on giant.tres) that damages
# the tile 1 ahead AND claims it for 5s: anyone can stand on a stolen tile,
# but the enemy ticks 2/s while they do. Giant himself can WALK onto his
# stolen tile even when it's on the enemy grid — the zone-steal phantom cell
# now honors player-owned stolen tiles on the enemy front column.

const TILE_STEAL_DAMAGE := 12
const TILE_STEAL_DURATION_MS := 5000

func _basic_tile_steal(shooter: Combatant) -> void:
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var info := MoveRegistry._project_forward(side, ccell, 1)
	if info.is_empty():
		return
	if not shooter.consume_ammo():
		print("%s out of steals (reloading)" % shooter.display_name)
		return
	var t_side: String = info["side"]
	var t_cell := Vector2i(int(info["x"]), ccell.y)
	MoveRegistry._spawn_punch(self, cell_to_world(t_side, t_cell), get_side(shooter) == SIDE_ENEMY)
	var target := combatant_at(t_side, t_cell)
	if target != null and target.is_alive():
		target.take_damage(_basic_attack_damage(shooter, TILE_STEAL_DAMAGE), shooter.monster_type, "tile_steal")
		on_basic_hit(shooter, target)
	spawn_tile(shooter, t_side, t_cell, "stolen_tile", TILE_STEAL_DURATION_MS, false)

# === ATOMIPPO: WARP SHOT (user amend) ===
# A regular bullet at 10 base damage whose hit teleports the victim to a
# random unblocked tile on their grid — flagged in _spawn_basic_bullet,
# resolved here from Bullet's combatant-hit path.

func on_warp_hit(victim: Combatant) -> void:
	if victim == null or not is_instance_valid(victim) or not victim.is_alive():
		return
	var v_side := get_side(victim)
	var v_cell := get_caster_cell(victim)
	for attempt in range(14):
		var cand := Vector2i(randi() % GRID_COLS, randi() % GRID_ROWS)
		if cand == v_cell or combatant_blocked_at(v_side, cand):
			continue
		MoveRegistry._spawn_teleport_flash(self, cell_to_world(v_side, v_cell))
		set_caster_cell(victim, cand)
		var captured_victim: Combatant = victim
		var dest := cell_to_world(v_side, cand)
		var warp := create_tween()
		warp.tween_property(captured_victim, "global_position", dest, 0.12)
		MoveRegistry._spawn_teleport_flash(self, dest)
		print("warp shot scrambles %s to %s" % [victim.display_name, str(cand)])
		return

# === KINGFENCER: LINE THRUST + RUSH SLICE (mons.xlsx row 44, July 2026 rework) ===
# 1-ammo rapier basic on a 2s reload. Tap SPACE = 2-tile thrust. HOLD SPACE
# (charged_thrust) = RUSH SLICE: dash down the row slashing everything passed
# for 20, then glide back to the start tile (rush pattern — the logical cell
# never moves). Stunning Touche's stun rider applies on both; Extended Lunge
# and the rest fire via the on_basic_hit hub. Fleche Tempo's reload_mult now
# matters (ammo-based basic).

const THRUST_DAMAGE := 12
const RUSH_SLICE_DAMAGE := 20
const RUSH_SLICE_STEP_S := 0.06
const RUSH_SLICE_RETURN_S := 0.7  # slow glide home (movement-locked), like the ram

func _basic_line_thrust(shooter: Combatant) -> void:
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var dmg := _basic_attack_damage(shooter, THRUST_DAMAGE)
	for d in range(1, 3):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			return
		var t_side: String = info["side"]
		var t_cell := Vector2i(int(info["x"]), ccell.y)
		MoveRegistry._spawn_slash(self, cell_to_world(t_side, t_cell), 0)
		var wall := wall_at_cell(t_side, t_cell)
		if wall != null:
			if wall.owner_combatant != shooter:
				wall.take_damage(1, shooter)
			return
		var target := combatant_at(t_side, t_cell)
		if target != null and target.is_alive():
			target.take_damage(dmg, shooter.monster_type, "line_thrust")
			if target.is_alive() and TraitRegistry.basic_stuns(shooter.traits):
				target.apply_stun(BASIC_STUN_MS, shooter)
			on_basic_hit(shooter, target)

func _basic_rush_slice(shooter: Combatant) -> void:
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var path: Array = []
	for d in range(1, GRID_COLS * 2 + 1):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			break
		var p_side: String = info["side"]
		var p_cell := Vector2i(int(info["x"]), ccell.y)
		var wall := wall_at_cell(p_side, p_cell)
		if wall != null and wall.owner_combatant != shooter:
			break  # enemy blocks wall off the lane
		path.append({"side": p_side, "cell": p_cell})
	if path.is_empty():
		return
	if not shooter.consume_ammo():
		print("%s out of ammo (reloading)" % shooter.display_name)
		return
	var dmg := _basic_attack_damage(shooter, RUSH_SLICE_DAMAGE)
	var home := cell_to_world(side, ccell)
	var last: Dictionary = path[path.size() - 1]
	var out_time := RUSH_SLICE_STEP_S * path.size()
	# Dash out slicing each cell, then slowly glide home. Logical cell stays put
	# (rush pattern) so he remains targetable; movement is locked out + back.
	lock_rush(shooter, out_time + RUSH_SLICE_RETURN_S)
	var move_tw := create_tween()
	move_tw.tween_property(shooter, "global_position", cell_to_world(last["side"], last["cell"]), out_time)
	move_tw.tween_property(shooter, "global_position", home, RUSH_SLICE_RETURN_S).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	var hit_tw := create_tween()
	for i in range(path.size()):
		var entry: Dictionary = path[i]
		hit_tw.tween_callback(_rush_slice_cell.bind(shooter, entry, dmg))
		hit_tw.tween_interval(RUSH_SLICE_STEP_S)
	print("%s rushes the lane — %d cells" % [shooter.display_name, path.size()])

func _rush_slice_cell(shooter: Combatant, entry: Dictionary, dmg: int) -> void:
	if _battle_over:
		return
	var e_side: String = entry["side"]
	var e_cell: Vector2i = entry["cell"]
	MoveRegistry._spawn_slash(self, cell_to_world(e_side, e_cell), 0)
	var target := combatant_at(e_side, e_cell)
	if target == null or target == shooter or not target.is_alive():
		return
	if shooter == null or not is_instance_valid(shooter):
		return
	target.take_damage(dmg, shooter.monster_type, "rush_slice")
	if target.is_alive() and TraitRegistry.basic_stuns(shooter.traits):
		target.apply_stun(BASIC_STUN_MS, shooter)
	on_basic_hit(shooter, target)

# Committed-rush movement lock — shared by every move where the caster dashes
# out and slowly returns to its start tile (Krrrrin Ram, Divebomb, Iai, Cinder
# Rush, Kingfencer rush slice). While locked, neither the player input nor the
# enemy AI can move the caster (both gates honour `is_rushing()`), so it can't
# snap around and fight the return tween — and it stays a valid damage target
# the whole time. Duration should cover the full out + return.
func lock_rush(c: Combatant, seconds: float) -> void:
	if c == null or not is_instance_valid(c):
		return
	c.rush_until_ms = maxi(c.rush_until_ms, Time.get_ticks_msec() + int(seconds * 1000.0))

# === KRRRRIN: RAM (mons.xlsx row 26) ===
# 80-damage straight-line charge down the row: rams the FIRST enemy (or wall)
# in the lane, then slowly recoils to the start tile over 3s — that recoil IS
# the 3s cooldown. Logical cell never moves (rush pattern) so the opponent can
# still target Krrrrin's home tile during the return. On damaging an ENEMY the
# mon's single trait fires: Bracing Charge (Guarded through the recoil) /
# Cinder Trail (burn tiles on every cell of the return path) / Searing Brand
# (enemy BURNED 30s — cleared early only by a team swap, which apply_def wipes).
const RAM_DAMAGE := 30
const RAM_CD_MS := 3000
const RAM_RECOIL_S := 3.0
const RAM_CHARGE_STEP_S := 0.07
const RAM_GUARD_MS := 3000
const RAM_BURN_TILE_MS := 4000
const RAM_BURN_ENEMY_MS := 30000
const RAM_BURN_ENEMY_DPS := 2

func _basic_ram(shooter: Combatant) -> void:
	if not shooter.basic_cd_ready():
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var path: Array = []
	var hit_cell: Dictionary = {}
	var hit_target: Combatant = null
	var hit_wall: Wall = null
	for d in range(1, GRID_COLS * 2 + 1):
		var info := MoveRegistry._project_forward(side, ccell, d)
		if info.is_empty():
			break
		var p_side: String = info["side"]
		var p_cell := Vector2i(int(info["x"]), ccell.y)
		path.append({"side": p_side, "cell": p_cell})
		var w := wall_at_cell(p_side, p_cell)
		if w != null and w.owner_combatant != shooter:
			hit_wall = w
			hit_cell = {"side": p_side, "cell": p_cell}
			break
		var t := combatant_at(p_side, p_cell)
		if t != null and t != shooter and t.is_alive():
			hit_target = t
			hit_cell = {"side": p_side, "cell": p_cell}
			break
	if path.is_empty():
		return
	shooter.start_basic_cd(RAM_CD_MS)
	var impact: Dictionary = hit_cell if not hit_cell.is_empty() else path[path.size() - 1]
	var home := cell_to_world(side, ccell)
	var impact_world := cell_to_world(impact["side"], impact["cell"])
	var charge_time := maxf(RAM_CHARGE_STEP_S, RAM_CHARGE_STEP_S * path.size())
	# Commit-lock: no moving during the charge + 3s recoil (Krrrrin stays out of
	# position and takes damage normally — the recoil is the punishable window).
	lock_rush(shooter, charge_time + RAM_RECOIL_S)
	# Charge out fast, resolve the impact, then the slow 3s recoil home.
	var tw := create_tween()
	tw.tween_property(shooter, "global_position", impact_world, charge_time).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_callback(_ram_impact.bind(shooter, impact, hit_target, hit_wall, path))
	tw.tween_property(shooter, "global_position", home, RAM_RECOIL_S).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	print("%s charges the ram — %d cells" % [shooter.display_name, path.size()])

func _ram_impact(shooter: Combatant, impact: Dictionary, target: Combatant, wall: Wall, path: Array) -> void:
	if _battle_over or shooter == null or not is_instance_valid(shooter):
		return
	MoveRegistry._spawn_punch(self, cell_to_world(impact["side"], impact["cell"]), get_side(shooter) == SIDE_ENEMY)
	var dmg := _basic_attack_damage(shooter, RAM_DAMAGE)
	# Wall in the way — smash it; no enemy hit, so no trait payoff.
	if wall != null and is_instance_valid(wall):
		wall.take_damage(dmg, shooter)
		return
	if target == null or not is_instance_valid(target) or not target.is_alive():
		return  # whiffed down an empty lane
	var dealt := target.take_damage(dmg, shooter.monster_type, "ram")
	if dealt <= 0:
		return  # blind miss — no trait payoff
	on_basic_hit(shooter, target)
	# Trait payoffs (one per Krrrrin copy).
	if TraitRegistry.ram_grants_guard(shooter.traits):
		shooter.grant_guarded(RAM_GUARD_MS)
		print("%s — Bracing Charge: GUARDED %dms" % [shooter.display_name, RAM_GUARD_MS])
	if TraitRegistry.ram_burns_trail(shooter.traits):
		for entry in path:
			spawn_tile(shooter, entry["side"], entry["cell"], "burn_tile", RAM_BURN_TILE_MS, false)
		print("%s — Cinder Trail: the charge lane ignites" % shooter.display_name)
	if TraitRegistry.ram_burns_enemy(shooter.traits) and target.is_alive():
		target.apply_burn(RAM_BURN_ENEMY_MS, RAM_BURN_ENEMY_DPS, "searing_brand")
		print("%s — Searing Brand: %s burns for %ds" % [shooter.display_name, target.display_name, RAM_BURN_ENEMY_MS / 1000])

# === CARGOT: SCRAP-ON-HIT + ICAGE: ICE-SPIKE MISS (bullet callbacks) ===

func on_scrap_hit(shooter: Combatant) -> void:
	if shooter == null or not is_instance_valid(shooter):
		return
	var side := get_side(shooter)
	var ccell := get_caster_cell(shooter)
	var info := MoveRegistry._project_forward(side, ccell, 1)
	if info.is_empty():
		return
	var b_side: String = info["side"]
	var b_cell := Vector2i(int(info["x"]), ccell.y)
	if wall_at_cell(b_side, b_cell) != null or combatant_at(b_side, b_cell) != null:
		return
	var hp := 1 + TraitRegistry.wall_bonus_hp(shooter.traits)
	spawn_wall(shooter, b_side, b_cell, hp)
	print("%s scrap shot builds a block at %s/%s" % [shooter.display_name, b_side, str(b_cell)])

func on_ice_spike_miss(shooter: Combatant, exit_pos: Vector3) -> void:
	if shooter == null or not is_instance_valid(shooter):
		return
	var opp_side := forward_side(get_side(shooter))
	var far_x := GRID_COLS - 1 if get_side(shooter) == SIDE_PLAYER else 0
	var best_y := 0
	var best_d := INF
	for y in range(GRID_ROWS):
		var dz := absf(cell_to_world(opp_side, Vector2i(far_x, y)).z - exit_pos.z)
		if dz < best_d:
			best_d = dz
			best_y = y
	spawn_tile(shooter, opp_side, Vector2i(far_x, best_y), "frozen_tile", 4000, false)
	print("%s ice spike sails wide — tile frozen at %s/(%d,%d)" % [shooter.display_name, opp_side, far_x, best_y])

const CAMERA_TILT_DEG := 50.0
const CAMERA_YAW_DEG := 20.0
const CAMERA_HEIGHT := 11.0
const CAMERA_SIZE := 15.0

func _setup_camera() -> void:
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = CAMERA_SIZE
	_camera.near = 0.1
	_camera.far = 100.0
	var tilt := deg_to_rad(CAMERA_TILT_DEG)
	var yaw := deg_to_rad(CAMERA_YAW_DEG)
	var depth := CAMERA_HEIGHT / tan(tilt)
	var local_offset := Vector3(0.0, CAMERA_HEIGHT, depth)
	var rotated := Quaternion(Vector3.UP, yaw) * local_offset
	_camera.global_position = rotated
	_camera.look_at(Vector3.ZERO, Vector3.UP)
	_camera.current = true
	_camera_base_position = _camera.position

func _spawn_grid(scene_path: String, offset: Vector3, node_name: String) -> void:
	var packed := load(scene_path) as PackedScene
	if packed == null:
		push_warning("Battle: missing grid scene %s" % scene_path)
		return
	var inst := packed.instantiate()
	inst.name = node_name
	_world.add_child(inst)
	inst.position = offset

func _spawn_background(scene_path: String) -> void:
	var packed := load(scene_path) as PackedScene
	if packed == null:
		push_warning("Battle: missing background scene %s" % scene_path)
		return
	var inst := packed.instantiate() as Node3D
	inst.name = "Background"
	_world.add_child(inst)
	# Measure bounds at identity transform first
	var bounds := _collect_bounds(inst)
	var local_center := bounds.get_center()
	# Build rotation+scale basis, position so the content's center lands at desired world point
	var basis := Basis(Vector3.UP, deg_to_rad(background_rotation_deg)).scaled(Vector3.ONE * background_scale)
	var rotated_center := basis * local_center
	inst.transform = Transform3D(basis, background_world_center - rotated_center)
	_force_pixel_filter(inst)
	var final_bounds := _collect_bounds(inst)
	print("Background loaded  rotation=%.0f°  scale=%.2f  centered at %s  span=%s" % [
		background_rotation_deg, background_scale, background_world_center, final_bounds.size
	])

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

func _collect_bounds(node: Node) -> AABB:
	var result := AABB()
	var first := true
	var stack: Array[Node] = [node]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
			var world_aabb := (n as MeshInstance3D).global_transform * (n as MeshInstance3D).get_aabb()
			if first:
				result = world_aabb
				first = false
			else:
				result = result.merge(world_aabb)
		for child in n.get_children():
			stack.push_back(child)
	return result

# === MOVE REGISTRY API ===
# These are the public methods MoveRegistry handlers call to query state and
# spawn world FX. Keep them side-effect-light so handlers stay testable.

func get_side(c: Combatant) -> String:
	if c == _player:
		return SIDE_PLAYER
	if c == _enemy:
		return SIDE_ENEMY
	return ""

func get_opponent(c: Combatant) -> Combatant:
	if c == _player:
		return _enemy
	if c == _enemy:
		return _player
	return null

func get_caster_cell(c: Combatant) -> Vector2i:
	if c == _player:
		return _player_cell
	if c == _enemy:
		return _enemy_cell
	return Vector2i.ZERO

# Returns the combatant on (side, cell) or null. Each grid has a single
# combatant for now; the API is per-cell so multi-mon battles drop in cleanly.
func combatant_at(side: String, cell: Vector2i) -> Combatant:
	if side == SIDE_PLAYER and _player_cell == cell and _player.is_alive():
		return _player
	if side == SIDE_ENEMY and _enemy_cell == cell and _enemy.is_alive():
		return _enemy
	return null

func cell_to_world(side: String, cell: Vector2i) -> Vector3:
	if side == SIDE_PLAYER:
		return _player_cell_to_world(cell)
	return _enemy_cell_to_world(cell)

# "Forward" from a side = the side you're facing. Used by card effects to
# project the caster's cell into the opponent's grid.
func forward_side(caster_side: String) -> String:
	return SIDE_ENEMY if caster_side == SIDE_PLAYER else SIDE_PLAYER

# Caster's front cell on the opponent grid. For player at (px, py): (0, py)
# on enemy grid. For enemy at (ex, ey): (GRID_COLS-1, ey) on player grid.
func forward_cell(caster_side: String, caster_cell: Vector2i, depth: int = 0) -> Vector2i:
	if caster_side == SIDE_PLAYER:
		return Vector2i(clampi(depth, 0, GRID_COLS - 1), caster_cell.y)
	return Vector2i(clampi(GRID_COLS - 1 - depth, 0, GRID_COLS - 1), caster_cell.y)

# Parent for ephemeral effect nodes (slashes, rings, beam segments). Lives
# under the World container so they inherit the same world space as combatants.
func spawn_world_fx(node: Node3D) -> void:
	_world.add_child(node)

# Malipole charge indicator: cyan torus parented to the player that scales up
# over CHARGE_DURATION_MS so the player can see how close they are to a full
# charge. Released early or on full release, _hide_charge_indicator clears it.
func _show_charge_indicator() -> void:
	_hide_charge_indicator()
	var halo := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.5
	torus.outer_radius = 0.72
	halo.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.40, 0.85, 1.00, 0.50)
	mat.emission_enabled = true
	mat.emission = Color(0.45, 0.80, 1.00)
	mat.emission_energy_multiplier = 3.4
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	halo.material_override = mat
	_player.add_child(halo)
	halo.position = Vector3(0.0, 0.15, 0.0)
	halo.scale = Vector3.ONE * 0.25
	_charge_indicator = halo
	var charge_s := float(Combatant.CHARGE_DURATION_MS) / 1000.0
	var tween := halo.create_tween()
	tween.tween_property(halo, "scale", Vector3.ONE * 1.4, charge_s).set_trans(Tween.TRANS_SINE)

func _hide_charge_indicator() -> void:
	if _charge_indicator != null:
		if is_instance_valid(_charge_indicator):
			_charge_indicator.queue_free()
		_charge_indicator = null

# Used by dash_attack / displace to update cell tracking after a tween moves
# a combatant in world space. Also captures the move direction so contact
# tiles (frozen_tile) can react to the trajectory.
func set_caster_cell(c: Combatant, cell: Vector2i) -> void:
	var old_cell: Vector2i
	if c == _player:
		old_cell = _player_cell
		_player_cell = cell
	elif c == _enemy:
		old_cell = _enemy_cell
		_enemy_cell = cell
	else:
		return
	var delta := cell - old_cell
	if delta != Vector2i.ZERO:
		c.last_move_direction = Vector2i(signi(delta.x), signi(delta.y))

# === WALL API ===

func wall_at_cell(side: String, cell: Vector2i) -> Wall:
	for w in _walls:
		if not is_instance_valid(w):
			continue
		if w.grid_side == side and w.cell == cell:
			return w
	return null

# True if a combatant attempting to enter (side, cell) should be blocked.
# Used by all combatant-movement validation (player walk, enemy AI walk,
# turret walks, teleport destinations, random_hop teleport, frozen slip).
# Bullets and card projectiles do NOT use this — they only check walls so
# the broken_tile lets them fly through.
func combatant_blocked_at(side: String, cell: Vector2i) -> bool:
	if wall_at_cell(side, cell) != null:
		return true
	var tile := tile_at_cell(side, cell)
	if tile != null and tile.effect_id == "broken_tile":
		return true
	# Zone-steal stolen column blocks all non-owner movement. (MVP: blocks
	# the owner too, because we haven't yet hooked cross-grid walking; once
	# that lands, the caster's own movement code can bypass this check.)
	if zone_steal_active_at(side, cell):
		return true
	return false

# True if a gravity_well_tile occupies (side, cell). Read by player and
# enemy AI movement code to gate the gravity_pending toggle.
func _is_gravity_tile_at(side: String, cell: Vector2i) -> bool:
	var t := tile_at_cell(side, cell)
	return t != null and (t.effect_id == "gravity_well_tile" or t.effect_id == "creeping_vine")

# True if (side, cell) is currently part of the stolen Crushing Field column.
func zone_steal_active_at(side: String, cell: Vector2i) -> bool:
	if _zone_steal.is_empty():
		return false
	if Time.get_ticks_msec() >= int(_zone_steal["expires_at_ms"]):
		return false
	return side == String(_zone_steal["side"]) and cell.x == int(_zone_steal["col"])

func set_zone_steal(owner_combatant: Combatant, side: String, col: int, duration_ms: int, visuals: Array) -> void:
	# Replace any prior steal (last cast wins).
	clear_zone_steal()
	_zone_steal = {
		"owner": owner_combatant,
		"side": side,
		"col": col,
		"expires_at_ms": Time.get_ticks_msec() + duration_ms,
		"visuals": visuals,
	}

func clear_zone_steal() -> void:
	if _zone_steal.is_empty():
		return
	var visuals: Array = _zone_steal.get("visuals", [])
	for v in visuals:
		if is_instance_valid(v):
			v.queue_free()
	# Punishment: if the player is still on the phantom stolen cell when the
	# steal ends, snap them back to their own front column + 10 DMG + 1s stun.
	# Exception: a Giant stolen_tile can still justify the phantom — then the
	# per-frame validity check handles the eventual (gentle) snap instead.
	if _zone_steal.get("owner") == _player and _player_cell.x >= GRID_COLS and not _player_stolen_tile_at(_player_cell.x - GRID_COLS, _player_cell.y):
		var snap_cell := Vector2i(GRID_COLS - 1, _player_cell.y)
		_player_cell = snap_cell
		_zone_steal = {}  # clear first so _player_cell_to_world routes normally
		if is_instance_valid(_player):
			var dest := _player_cell_to_world(snap_cell)
			var tween := create_tween()
			tween.set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
			tween.tween_property(_player, "global_position", dest, 0.25)
			_player.take_damage(10, "", "zone_steal_recoil")
			_player.apply_stun(1000)
		return
	_zone_steal = {}

func spawn_wall(owner_combatant: Combatant, side: String, cell: Vector2i, wall_hp: int) -> Wall:
	# Replace any existing wall on the same cell so a re-cast overwrites cleanly.
	var existing := wall_at_cell(side, cell)
	if existing != null:
		_walls.erase(existing)
		existing.queue_free()
	# Displace any combatant standing on the cell — wall takes the space.
	# Push toward the side's back row (further from opponent) so the combatant
	# stays useful and the wall actually intercepts projectiles fired from them.
	var occupant := combatant_at(side, cell)
	if occupant != null:
		var push_dir := -1 if side == SIDE_PLAYER else 1
		var push_cell := Vector2i(cell.x + push_dir, cell.y)
		if push_cell.x >= 0 and push_cell.x < GRID_COLS:
			set_caster_cell(occupant, push_cell)
			var dest := cell_to_world(side, push_cell)
			var push_tween := create_tween()
			push_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
			push_tween.tween_property(occupant, "global_position", dest, 0.12)
	var wall := WALL_SCENE.instantiate() as Wall
	wall.max_hp = wall_hp
	wall.hp = wall_hp
	wall.owner_combatant = owner_combatant
	wall.grid_side = side
	wall.owner_side = get_side(owner_combatant)
	wall.cell = cell
	_walls.append(wall)
	_world.add_child(wall)
	wall.global_position = cell_to_world(side, cell)
	wall.destroyed.connect(_on_wall_destroyed.bind(wall))
	return wall

func _on_wall_destroyed(owner_combatant: Combatant, destroyer: Combatant, wall: Wall = null) -> void:
	# Demolitionist-style trait: destroyer heals on wall break.
	if destroyer != null and is_instance_valid(destroyer):
		var heal := TraitRegistry.heal_on_block_break(destroyer.traits)
		if heal > 0:
			destroyer.heal(heal)
	# Tunnel Rats — ANY wall breaking (yours or enemy) releases a wandering
	# rat at the broken cell for each holder of the trait.
	if wall != null and is_instance_valid(wall):
		_release_tunnel_rats(wall.grid_side, wall.cell)
	# Clean stale refs lazily.
	for i in range(_walls.size() - 1, -1, -1):
		if not is_instance_valid(_walls[i]):
			_walls.remove_at(i)

func _release_tunnel_rats(rat_side: String, rat_cell: Vector2i) -> void:
	if _player != null and is_instance_valid(_player) and _player.is_alive() and TraitRegistry.has_rat_on_block_break(_player.traits):
		MoveRegistry._spawn_wandering_rat(self, _player, rat_side, rat_cell, 10 + TraitRegistry.rat_dmg_bonus(_player.traits))
		print("%s — Tunnel Rats releases a rat at %s/%s" % [_player.display_name, rat_side, str(rat_cell)])
	if _enemy != null and is_instance_valid(_enemy) and _enemy.is_alive() and TraitRegistry.has_rat_on_block_break(_enemy.traits):
		MoveRegistry._spawn_wandering_rat(self, _enemy, rat_side, rat_cell, 10 + TraitRegistry.rat_dmg_bonus(_enemy.traits))
		print("%s — Tunnel Rats releases a rat at %s/%s" % [_enemy.display_name, rat_side, str(rat_cell)])

# === TILE API ===

func tile_at_cell(side: String, cell: Vector2i, effect_id: String = "") -> TimedEffect:
	for t in _tiles:
		if not is_instance_valid(t):
			continue
		if t.grid_side != side or t.cell != cell:
			continue
		if effect_id != "" and t.effect_id != effect_id:
			continue
		return t
	return null

func spawn_tile(owner_combatant: Combatant, side: String, cell: Vector2i, effect_id: String, lifetime_ms: int, _owner_only: bool) -> TimedEffect:
	# Replace any existing tile on the same cell — last-cast wins.
	var existing := tile_at_cell(side, cell)
	if existing != null:
		_tiles.erase(existing)
		existing.queue_free()
	var tile := TILE_SCENE.instantiate() as TimedEffect
	tile.effect_id = effect_id
	tile.lifetime_ms = lifetime_ms
	tile.owner_combatant = owner_combatant
	tile.grid_side = side
	tile.cell = cell
	_tiles.append(tile)
	_world.add_child(tile)
	tile.global_position = cell_to_world(side, cell)
	tile.bind_battle(self)
	tile.expired.connect(_on_tile_expired.bind(tile))
	return tile

const SILENCE_HALO_NAME := "SilenceHalo"

func _on_silenced(_duration_ms: int, who: Combatant) -> void:
	if who.find_child(SILENCE_HALO_NAME, false, false) != null:
		return
	var halo := Node3D.new()
	halo.name = SILENCE_HALO_NAME
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.4
	torus.outer_radius = 0.55
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.75, 0.50, 0.95, 0.80)
	mat.emission_enabled = true
	mat.emission = Color(0.65, 0.35, 0.95)
	mat.emission_energy_multiplier = 2.8
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	halo.add_child(ring)
	who.add_child(halo)
	halo.position = Vector3(0.0, 2.05, 0.0)
	_spawn_popup(who.global_position, "SILENCE", Color(0.75, 0.50, 0.95, 1.0))

func _on_unsilenced(who: Combatant) -> void:
	var halo := who.find_child(SILENCE_HALO_NAME, false, false)
	if halo != null:
		halo.queue_free()

const POISON_ABSORB_HALO_NAME := "PoisonAbsorbHalo"

func _on_poison_absorb_changed(active: bool, who: Combatant) -> void:
	if active:
		if who.find_child(POISON_ABSORB_HALO_NAME, false, false) != null:
			return
		var halo := Node3D.new()
		halo.name = POISON_ABSORB_HALO_NAME
		var ring := MeshInstance3D.new()
		var torus := TorusMesh.new()
		torus.inner_radius = 0.50
		torus.outer_radius = 0.70
		ring.mesh = torus
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.45, 1.0, 0.55, 0.80)
		mat.emission_enabled = true
		mat.emission = Color(0.30, 0.95, 0.50)
		mat.emission_energy_multiplier = 3.0
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		ring.material_override = mat
		halo.add_child(ring)
		who.add_child(halo)
		halo.position = Vector3(0.0, 1.55, 0.0)
		var pulse := halo.create_tween().set_loops()
		pulse.tween_property(mat, "albedo_color:a", 0.35, 0.6).set_trans(Tween.TRANS_SINE)
		pulse.tween_property(mat, "albedo_color:a", 0.80, 0.6).set_trans(Tween.TRANS_SINE)
		_spawn_popup(who.global_position, "ABSORB", Color(0.45, 1.0, 0.55, 1.0))
	else:
		var halo := who.find_child(POISON_ABSORB_HALO_NAME, false, false)
		if halo != null:
			halo.queue_free()

func clear_all_tiles() -> void:
	# Wipe every TimedEffect tile on the field. Used by Toadazer shock_therapy
	# (mirrors React's `setLilyPadTraps([])`).
	for t in _tiles.duplicate():
		if is_instance_valid(t):
			t.queue_free()
	_tiles.clear()

func _on_tile_expired(_effect_id: String, _owner_combatant: Combatant, tile: TimedEffect) -> void:
	_tiles.erase(tile)
	# Clean stale refs lazily.
	for i in range(_tiles.size() - 1, -1, -1):
		if not is_instance_valid(_tiles[i]):
			_tiles.remove_at(i)

# === TURRET API ===

func turret_at_cell(side: String, cell: Vector2i) -> Turret:
	for t in _turrets:
		if not is_instance_valid(t):
			continue
		if t.grid_side == side and t.cell == cell:
			return t
	return null

func spawn_turret(owner_combatant: Combatant, side: String, cell: Vector2i, max_hp: int, fire_interval_s: float, bullet_damage: int, sprite_texture: Texture2D = null, sprite_tint: Color = Color.WHITE) -> Turret:
	# Last-cast wins on the same cell.
	var existing := turret_at_cell(side, cell)
	if existing != null:
		_turrets.erase(existing)
		existing.queue_free()
	var turret := TURRET_SCENE.instantiate() as Turret
	turret.owner_combatant = owner_combatant
	turret.grid_side = side
	turret.owner_side = get_side(owner_combatant)
	turret.cell = cell
	turret.max_hp = max_hp
	turret.hp = max_hp
	turret.fire_interval_s = fire_interval_s
	turret.bullet_damage = bullet_damage
	if owner_combatant != null:
		turret.bullet_type = owner_combatant.monster_type
	# Sprite override — set BEFORE add_child so _ready builds the sprite path.
	if sprite_texture != null:
		turret.sprite_texture = sprite_texture
		turret.sprite_tint = sprite_tint
	_turrets.append(turret)
	_world.add_child(turret)
	turret.global_position = cell_to_world(side, cell)
	turret.bind_battle(self)
	turret.destroyed.connect(_on_turret_destroyed.bind(turret))
	return turret

# Generic card-bullet spawner used by quickdraw + ricochet. dir is the bullet's
# travel direction (typically RIGHT for player, LEFT for enemy). speed overrides
# the default; for quickdraw it's roughly 2× normal. is_ricochet flips the
# bullet's bounce flag so it reverses at the far edge for a second pass.
func spawn_card_bullet(from_combatant: Combatant, dir: Vector3, dmg: int, speed: float, is_ricochet: bool, label: String) -> void:
	var bullet := BULLET_SCENE.instantiate() as Bullet
	bullet.direction = dir.normalized()
	bullet.speed = speed
	bullet.damage = dmg
	bullet.source_type = from_combatant.monster_type
	bullet.source_label = "%s_%s" % [from_combatant.display_name.to_lower(), label]
	bullet.ignore = from_combatant
	bullet.owner_side = get_side(from_combatant)
	bullet.battle = self
	bullet.is_ricochet = is_ricochet
	_world.add_child(bullet)
	var spawn := from_combatant.global_position + dir.normalized() * 0.6
	spawn.y += 0.55
	bullet.global_position = spawn

func spawn_thorn_retaliation(from_combatant: Combatant, _target_node: Node3D) -> void:
	# Hogglin thorn_shield retaliation. Fires a grass-typed bullet straight
	# down the row toward the opponent's side — NOT homing on the shooter.
	# Player thorn fires RIGHT; enemy thorn fires LEFT.
	var bullet := BULLET_SCENE.instantiate() as Bullet
	var dir := Vector3.RIGHT if get_side(from_combatant) == SIDE_PLAYER else Vector3.LEFT
	bullet.direction = dir
	bullet.source_type = "grass"
	bullet.source_label = "%s_thorn" % from_combatant.display_name.to_lower()
	bullet.ignore = from_combatant
	bullet.owner_side = get_side(from_combatant)
	bullet.battle = self
	bullet.damage = Combatant.THORN_SHIELD_RETALIATION_DAMAGE
	_world.add_child(bullet)
	var spawn := from_combatant.global_position + dir * 0.6
	spawn.y += 0.55
	bullet.global_position = spawn

func spawn_turret_bullet(turret: Turret, dir: Vector3) -> void:
	var bullet := BULLET_SCENE.instantiate() as Bullet
	bullet.direction = dir.normalized()
	bullet.source_type = turret.bullet_type
	bullet.source_label = "%s_turret" % (turret.owner_combatant.display_name.to_lower() if is_instance_valid(turret.owner_combatant) else "tur")
	bullet.ignore = turret
	bullet.owner_side = turret.owner_side
	bullet.battle = self
	bullet.damage = turret.bullet_damage
	bullet.status_id = turret.bullet_status_id
	bullet.status_duration_ms = turret.bullet_status_duration_ms
	bullet.status_dot = turret.bullet_status_dot
	# Pickpockets (Modizard guards): bullet hits siphon HP back to the owner.
	bullet.steal_heal = turret.bullet_steal_heal
	bullet.steal_beneficiary = turret.owner_combatant
	_world.add_child(bullet)
	var spawn := turret.global_position + dir.normalized() * 0.6
	spawn.y += 0.65
	bullet.global_position = spawn

func _on_turret_destroyed(owner_combatant: Combatant, destroyer, turret: Turret = null) -> void:
	# rat_on_block_break-style trait could attach here later; for now the
	# destroyer's heal_on_block_break also fires when they break a turret —
	# treating turrets and walls as the same "construct" category.
	if destroyer != null and is_instance_valid(destroyer) and destroyer is Combatant:
		var heal := TraitRegistry.heal_on_block_break((destroyer as Combatant).traits)
		if heal > 0:
			(destroyer as Combatant).heal(heal)
	# (Guard recall cooldown removed — reverted to the ammo-based guard basic.)
	for i in range(_turrets.size() - 1, -1, -1):
		if not is_instance_valid(_turrets[i]):
			_turrets.remove_at(i)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		SceneManager.change_scene("res://overworld.tscn")
		get_viewport().set_input_as_handled()
		return
	# R-hold for refresh works even during hitstop/battle-over so the UI stays responsive.
	if event is InputEventKey and event.keycode == KEY_R:
		if event.pressed and not event.echo:
			_hand_panel.begin_hold()
		elif not event.pressed:
			_hand_panel.end_hold()
		get_viewport().set_input_as_handled()
		return
	# Charged basics (Malipole charged_bullet, Mushroom charged_walker, etc.):
	# SPACE press starts charging, release fires only if held the full
	# CHARGE_DURATION_MS. Other mons fall through to the instant-fire branch
	# below. Any basic_attack_kind starting with "charged_" uses this UI.
	if event is InputEventKey and event.keycode == KEY_SPACE and _player.basic_attack_kind.begins_with("charged_"):
		if event.pressed and not event.echo:
			if not _player.is_stunned() and not _player.is_asleep() and not _player.charge_active and not _battle_over and not _catch_pause and not _countdown_active:
				_player.begin_charge()
				_show_charge_indicator()
		elif not event.pressed:
			var was_complete := _player.is_charge_complete()
			_player.cancel_charge()
			_hide_charge_indicator()
			if was_complete and not _battle_over and not _catch_pause and not _countdown_active:
				_fire_basic(_player, Vector3.RIGHT, true)
			elif _player.basic_attack_kind in ["charged_spike", "charged_claw", "charged_shadow", "charged_thrust"] and not _battle_over and not _catch_pause and not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
				# Slime / Klawr: an early release still jabs the short version.
				# Wherewolf: early release = half-damage Shadow Strike (or the
				# Phantom Fang, which launches on any release).
				_fire_basic(_player, Vector3.RIGHT, false)
		get_viewport().set_input_as_handled()
		return
	if _hitstop_remaining > 0.0 or _battle_over or _catch_pause:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		# Stunned player can't act on cards/basics/movement until the timer
		# clears. Debug keys (B/H) still work for testing.
		match event.keycode:
			KEY_SPACE:
				if not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
					_fire_basic(_player, Vector3.RIGHT)
				get_viewport().set_input_as_handled()
				return
			KEY_1:
				if not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
					_hand_panel.try_play(0)
				get_viewport().set_input_as_handled()
				return
			KEY_2:
				if not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
					_hand_panel.try_play(1)
				get_viewport().set_input_as_handled()
				return
			KEY_3:
				if not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
					_hand_panel.try_play_bonus()
				get_viewport().set_input_as_handled()
				return
			KEY_C:
				if not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
					_try_catch()
				get_viewport().set_input_as_handled()
				return
			KEY_T:
				if not _player.is_stunned() and not _player.is_asleep() and not _countdown_active:
					_try_team_swap()
				get_viewport().set_input_as_handled()
				return
			KEY_B:
				_enemy.grant_iframes()
				_enemy.take_damage(10, "ice", "debug_blocked")
				get_viewport().set_input_as_handled()
				return
			KEY_H:
				_player.take_damage(15, "earth", "debug_self_hit")
				get_viewport().set_input_as_handled()
				return
	if _moving or _player.is_stunned() or _player.is_rooted() or _player.is_asleep() or _player.is_rushing():
		return
	var dir := Vector2i.ZERO
	if event.is_action_pressed("ui_left"):
		dir = Vector2i(-1, 0)
	elif event.is_action_pressed("ui_right"):
		dir = Vector2i(1, 0)
	elif event.is_action_pressed("ui_up"):
		dir = Vector2i(0, 1)
	elif event.is_action_pressed("ui_down"):
		dir = Vector2i(0, -1)
	if dir != Vector2i.ZERO:
		_try_move_player(dir)
		get_viewport().set_input_as_handled()

func _try_move_player(dir: Vector2i) -> void:
	var target := _player_cell + dir
	if target.y < 0 or target.y >= GRID_ROWS:
		return
	if target.x < 0:
		return
	# Event Horizon: if standing on a gravity tile, the first move attempt
	# is consumed (input lost, no movement). The second attempt resolves
	# normally. Toggle lives on the combatant.
	if _is_gravity_tile_at(SIDE_PLAYER, _player_cell):
		if not _player.gravity_pending:
			_player.gravity_pending = true
			return
		_player.gravity_pending = false
	else:
		_player.gravity_pending = false
	# Normal bounds: 0..GRID_COLS-1. With a player-owned zone_steal active,
	# the player can occupy a phantom cell at x = GRID_COLS — this maps
	# visually to the stolen column on the enemy grid. y movement on the
	# stolen column stays at x = GRID_COLS too.
	var on_stolen_extension := false
	if target.x >= GRID_COLS:
		var ext_col := target.x - GRID_COLS
		if target.x == GRID_COLS and _player_can_extend_zone_steal():
			on_stolen_extension = true
		elif _player_stolen_tile_at(ext_col, target.y):
			# Claimed ground is walkable — but not through the enemy's body.
			on_stolen_extension = combatant_at(SIDE_ENEMY, Vector2i(ext_col, target.y)) == null
	if target.x >= GRID_COLS and not on_stolen_extension:
		return
	if combatant_blocked_at(SIDE_PLAYER, target) and not on_stolen_extension:
		return  # wall OR broken_tile blocks traversal
	_player_cell = target
	# Record travel direction — frozen tiles slide you the way you were going.
	_player.last_move_direction = dir
	_moving = true
	var dest := _player_cell_to_world(target)
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(_player, "global_position", dest, MOVE_TIME)
	tween.finished.connect(func() -> void: _moving = false)

# True if Crushing Field is currently active and owned by the player. The
# player can step onto the phantom cell at x = GRID_COLS, which renders on
# the stolen column of the enemy grid.
func _player_can_extend_zone_steal() -> bool:
	if _zone_steal.is_empty():
		return false
	if Time.get_ticks_msec() >= int(_zone_steal["expires_at_ms"]):
		return false
	if _zone_steal.get("owner") != _player:
		return false
	return String(_zone_steal["side"]) == SIDE_ENEMY

# Giant's tile-steal basic: a player-owned stolen_tile on ANY enemy column
# opens the matching phantom cell (x = GRID_COLS + col) — he can chain steals
# and walk deeper into claimed territory, column by column.
func _player_stolen_tile_at(col: int, y: int) -> bool:
	if col < 0 or col >= GRID_COLS:
		return false
	var tile := tile_at_cell(SIDE_ENEMY, Vector2i(col, y), "stolen_tile")
	return tile != null and tile.owner_combatant == _player

func _player_cell_to_world(cell: Vector2i) -> Vector3:
	# Phantom cell at x = GRID_COLS = visually on the enemy grid: the stolen
	# COLUMN while a player zone_steal runs, else the enemy front column when
	# standing on a player-owned stolen tile (Giant's basic).
	if cell.x >= GRID_COLS:
		if cell.x == GRID_COLS and _player_can_extend_zone_steal():
			var stolen_col := int(_zone_steal["col"])
			return _enemy_cell_to_world(Vector2i(stolen_col, cell.y))
		# Stolen-tile phantom: x = GRID_COLS + col maps straight onto the
		# enemy grid column (also used as the snap-source when a tile dies).
		var ext_col := mini(cell.x - GRID_COLS, GRID_COLS - 1)
		return _enemy_cell_to_world(Vector2i(ext_col, cell.y))
	var local_x := float(cell.x) * CELL_SPACING
	var local_z := -float(cell.y) * CELL_SPACING
	return PLAYER_GRID_OFFSET + Vector3(local_x, COMBATANT_Y, local_z)

func _enemy_cell_to_world(cell: Vector2i) -> Vector3:
	var local_x := float(cell.x) * CELL_SPACING
	var local_z := -float(cell.y) * CELL_SPACING
	return ENEMY_GRID_OFFSET + Vector3(local_x, COMBATANT_Y, local_z)
