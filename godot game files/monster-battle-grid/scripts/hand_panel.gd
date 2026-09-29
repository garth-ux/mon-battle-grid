class_name HandPanel
extends Control

const CARD_SCENE := preload("res://card_view.tscn")
const REFRESH_HOLD_SECONDS := 2.0
const REFRESH_COOLDOWN_SECONDS := 5.0

@onready var _row: HBoxContainer = $Row
@onready var _refresh_label: Label = $RefreshLabel

var _combatant: Combatant
var _battle: Battle
var _card_views: Array[CardView] = []
var _bonus_view: CardView
var _hold_remaining: float = REFRESH_HOLD_SECONDS
var _holding: bool = false
var _cooldown_remaining: float = 0.0

func _ready() -> void:
	for i in Combatant.HAND_SIZE:
		var v := CARD_SCENE.instantiate() as CardView
		_row.add_child(v)
		v.bind(null, i)
		_card_views.append(v)
	# Third slot (key 3) — only visible while a granted bonus card is live
	# (Aegis Pillar's Shatter, Rewind Fork's Return).
	_bonus_view = CARD_SCENE.instantiate() as CardView
	_row.add_child(_bonus_view)
	_bonus_view.bind(null, 2)
	_bonus_view.visible = false
	_update_refresh_label()

func bind_combatant(c: Combatant, battle: Battle = null) -> void:
	_combatant = c
	_battle = battle
	c.hand_changed.connect(func(_h): _refresh())
	c.mana_changed.connect(func(_m, _mx): _refresh())
	_refresh()

func _refresh() -> void:
	if _combatant == null:
		return
	for i in _card_views.size():
		var v := _card_views[i]
		if i < _combatant.hand.size():
			v.bind(_combatant.hand[i], i)
			v.set_playable(_combatant.can_play(i))
		else:
			v.bind(null, i)
			v.set_playable(false)
	if _bonus_view != null:
		if _combatant.bonus_card != null:
			_bonus_view.visible = true
			_bonus_view.bind(_combatant.bonus_card, 2)
			_bonus_view.set_playable(_combatant.can_play_bonus())
		else:
			_bonus_view.visible = false

func try_play(key_index: int) -> bool:
	if _combatant == null:
		return false
	if not _combatant.can_play(key_index):
		return false
	play_flourish(key_index)
	var played := _combatant.play_card(key_index)
	if played != null:
		MoveRegistry.execute(played, _combatant, _battle)
		return true
	return false

func try_play_bonus() -> bool:
	if _combatant == null:
		return false
	if _combatant.can_play_bonus():
		play_bonus_flourish()
	var played := _combatant.play_bonus_card()
	if played != null:
		MoveRegistry.execute(played, _combatant, _battle)
		_refresh()
		return true
	return false

# === PLAY FLOURISH ===
# A ghost of the played card slides up and vanishes over 0.5s (user design).
# Spawned BEFORE play_card so the ghost captures the card's face; the real
# hand refreshes instantly underneath. Works for the enemy panel too — the
# AI calls play_flourish directly.

const FLOURISH_S := 0.5
const FLOURISH_RISE := 46.0

func play_flourish(index: int) -> void:
	if index < 0 or index >= _card_views.size():
		return
	_spawn_ghost(_card_views[index])

func play_bonus_flourish() -> void:
	if _bonus_view != null and _bonus_view.visible:
		_spawn_ghost(_bonus_view)

func _spawn_ghost(view: CardView) -> void:
	if view == null or not view.visible:
		return
	var ghost := view.duplicate() as Control
	if ghost == null:
		return
	ghost.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ghost.z_index = 10
	add_child(ghost)
	ghost.global_position = view.global_position
	var tw := create_tween().set_parallel(true)
	tw.tween_property(ghost, "position:y", ghost.position.y - FLOURISH_RISE, FLOURISH_S).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
	tw.tween_property(ghost, "modulate:a", 0.0, FLOURISH_S)
	tw.chain().tween_callback(ghost.queue_free)

func _process(delta: float) -> void:
	if _cooldown_remaining > 0.0:
		_cooldown_remaining = maxf(0.0, _cooldown_remaining - delta)
		_update_refresh_label()
		if _cooldown_remaining == 0.0:
			_hold_remaining = REFRESH_HOLD_SECONDS
	if _holding and _cooldown_remaining <= 0.0:
		_hold_remaining = maxf(0.0, _hold_remaining - delta)
		_update_refresh_label()
		if _hold_remaining <= 0.0:
			_trigger_refresh()

func begin_hold() -> void:
	if _cooldown_remaining > 0.0:
		return
	# Waking Dream (Droopider) — while the opponent is asleep, the refresh is
	# instant (no 2s hold). Still gated by the cooldown above.
	if _combatant != null and _battle != null \
			and TraitRegistry.instant_refresh_on_sleep(_combatant.traits):
		var opp: Combatant = _battle.get_opponent(_combatant)
		if opp != null and is_instance_valid(opp) and opp.is_asleep():
			_trigger_refresh()
			return
	_holding = true
	_hold_remaining = REFRESH_HOLD_SECONDS
	_update_refresh_label()

func end_hold() -> void:
	_holding = false
	if _cooldown_remaining <= 0.0:
		_hold_remaining = REFRESH_HOLD_SECONDS
		_update_refresh_label()

func _trigger_refresh() -> void:
	_holding = false
	_cooldown_remaining = REFRESH_COOLDOWN_SECONDS
	_hold_remaining = REFRESH_HOLD_SECONDS
	if _combatant != null:
		_combatant.refresh_hand()
		print("[HAND] refreshed: ", _combatant.hand.map(func(c): return c.id if c else "—"))
	_update_refresh_label()

func _update_refresh_label() -> void:
	if _refresh_label == null:
		return
	if _cooldown_remaining > 0.0:
		_refresh_label.text = "R: refresh — cooldown %.1fs" % _cooldown_remaining
		_refresh_label.modulate = Color(0.55, 0.55, 0.60)
	elif _holding:
		_refresh_label.text = "R: hold to refresh… %.1fs" % _hold_remaining
		_refresh_label.modulate = Color(1.0, 0.85, 0.45)
	else:
		_refresh_label.text = "R: hold 2s to refresh hand"
		_refresh_label.modulate = Color(0.85, 0.85, 0.95)
