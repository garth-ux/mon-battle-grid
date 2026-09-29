class_name Combatant
extends Node3D

# Pure damage pipeline. take_damage() reads state, writes HP, emits a signal.
# Side effects (popups, hitstop, sprite stretch, screen shake) live in
# OTHER nodes that listen to these signals. Same pattern as DEVLOG.md:91-96.

signal damaged(amount: int, mult: float, source_type: String, source: String)
signal blocked(reason: String)
signal healed(amount: int)
signal ammo_changed(ammo: int, max_ammo: int, reloading: bool)
signal mana_changed(mana: int, max_mana: int)
signal hand_changed(hand: Array)
signal trait_changed(trait_def: TraitDef)
signal buff_applied(id: String, taken_mult: float, dealt_mult: float, duration_ms: int)
signal buff_expired(id: String)
signal stunned(duration_ms: int)
signal unstunned()
signal poisoned(duration_ms: int, dmg_per_tick: int)
signal unpoisoned()
signal burned(duration_ms: int, dmg_per_tick: int)
signal unburned()
signal thorn_shield_changed(active: bool)
signal silenced(duration_ms: int)
signal unsilenced()
signal blinded(duration_ms: int)
signal unblinded()
signal rooted(duration_ms: int)
signal unrooted()
signal slept(duration_ms: int)
signal woke()
signal poison_absorb_changed(active: bool)
signal vanished(duration_ms: int)
signal unvanished()
signal armor_changed(armor: int)
signal guarded_gained(duration_ms: int)
signal guarded_lost()
signal died()

@export var monster_def: MonsterDef
@export var monster_type: String = ""
@export var max_hp: int = 100
@export var max_mana: int = 10
@export var max_ammo: int = 3
@export var reload_ms: int = 3000
@export var iframe_ms: int = 336  # ~3 ticks at 112ms
@export var display_name: String = ""
@export var basic_attack_kind: String = "bullet"  # "bullet" | "block_builder" | "charged_bullet" | "charged_walker"

const IDLE_BOB_FREQ := 1.4
const IDLE_BOB_AMOUNT := 0.06
const SPRITE_HALF_HEIGHT := 0.8
const HIT_STRETCH_DURATION := 0.32
const HIT_STRETCH_AMOUNT := 0.38
const HIT_FLASH_DURATION := 0.18
const HIT_FLASH_BRIGHTNESS := 3.0

var hp: int
var mana: int = 5
var ammo: int
# Armor (Grabbakat Barrier/Flex) — bonus HP consumed before real HP. Stacks,
# never decays, battle-scoped. Absorbs FINAL damage (after type/trait mults).
var armor: int = 0
# Guarded — take 50% less damage. Three sources, checked in is_guarded():
#   timed:      guarded_until_ms, granted by card-play trait triggers
#               (guarded_on_type_<type> 3s, guarded_on_reposition 2s)
#   permanent:  _event_guard_triggered (Event Guard — sticks once HP < 50%)
#   positional: guarded_behind_block trait + a wall directly in front
#               (needs battle_ctx, set by Battle at setup)
var guarded_until_ms: int = 0
var _was_guarded: bool = false
var _event_guard_triggered: bool = false
var battle_ctx = null
# When this combatant last took real damage (Ancient Claim's 10s-unhit check).
# Initialized to battle start in apply_def so the clock begins at the bell.
var last_damaged_at_ms: int = 0
# Lifetime basic-attack hits this battle (combo heals, Extended Lunge,
# Toadazer charge stacks). Incremented by Battle.on_basic_hit.
var basic_hit_count: int = 0
# Lifetime cards played this battle (Triple Echo counts every 3rd).
# Incremented by MoveRegistry.execute's post-play hook.
var cards_played_count: int = 0
# Forced hand-shuffles inflicted on the opponent this battle (Mosseer's
# Fortune Shot; his secret Fortune Told trait pays out at the threshold).
var forced_shuffles: int = 0
# Cooldown gate for cooldown-based basics (boomerang 3s, tile steal 2s,
# line thrust 2s, warp shot 4s, guard recall 5s). Ammo basics ignore it.
var basic_cd_until_ms: int = 0
# Committed-rush lock (Krrrrin's Ram): while set, this combatant can't be
# moved by the player input or the enemy AI — it's mid-charge/recoil and
# stays exposed to damage. Cleared when the timer lapses or on apply_def.
var rush_until_ms: int = 0

func is_rushing() -> bool:
	return Time.get_ticks_msec() < rush_until_ms

func basic_cd_ready() -> bool:
	return Time.get_ticks_msec() >= basic_cd_until_ms

func start_basic_cd(ms: int) -> void:
	basic_cd_until_ms = Time.get_ticks_msec() + ms

func reset_basic_cd() -> void:
	basic_cd_until_ms = 0
var iframe_until_ms: int = 0
var reloading_until_ms: int = 0
var stun_until_ms: int = 0
var _was_stunned: bool = false
var poison_until_ms: int = 0
var poison_next_tick_ms: int = 0
var poison_dmg_per_tick: int = 0
var poison_source_label: String = ""
var _was_poisoned: bool = false
const POISON_TICK_PERIOD_MS := 1000
# Burn status (user design): poison's fire twin — DoT per second, PLUS while
# burning (or standing on ground that burns you) all damage received is x1.2.
# The vulnerability half lives in take_damage; burn-immunity exempts both.
var burn_until_ms: int = 0
var burn_next_tick_ms: int = 0
var burn_dmg_per_tick: int = 0
var burn_source_label: String = ""
var _was_burned: bool = false
const BURN_STATUS_TICK_PERIOD_MS := 1000
const BURN_VULN_MULT := 1.2
# Hogglin thorn_shield — one-shot reactive defense. When active, the next
# bullet that would damage us instead bounces off + we spit a 30 DMG thorn
# bullet back at the shooter. Cleared on use.
var thorn_shield_active: bool = false
const THORN_SHIELD_RETALIATION_DAMAGE := 30
# Silence status — blocks card play only. Movement + basic attack still work.
var silence_until_ms: int = 0
var _was_silenced: bool = false
# Blind status (starters pass) — while blinded, every attack you make has a
# BLIND_MISS_CHANCE chance to deal 0 damage. Rolled at the damage-math sites
# (_final_card_damage for cards, _basic_attack_damage for basics) via
# roll_blind_miss(). Does not block any action.
const BLIND_MISS_CHANCE := 0.2
var blind_until_ms: int = 0
var _was_blinded: bool = false
# Root status (starters pass) — blocks VOLUNTARY movement only. Cards, basic
# attacks, and forced displacement (pulls/pushes/slips) all still work.
var root_until_ms: int = 0
var _was_rooted: bool = false
# Sleep status (Droopider) — blocks move/card/basic like stun AND pauses the
# AI, but ANY damage wakes the sleeper instantly. Self-expires after its
# duration so a never-hit sleeper eventually stirs. `last_hit_woke_sleep` is
# set true for exactly the take_damage call that wakes them, so an
# attacker-aware site (on_basic_hit for Night Terror) can react.
var sleep_until_ms: int = 0
var _was_asleep: bool = false
var last_hit_woke_sleep: bool = false
# Litany of Stone (Gozo) — flat damage absorption during the channel window.
# Applied AFTER mults, before armor; fully-absorbed hits emit blocked("absorbed")
# so the battle listener can refund the mana.
var flat_reduction: int = 0
var flat_reduction_until_ms: int = 0
# Poison absorb (Mushroom absorb_poison) — for the duration window, stepping
# on poison tiles HEALS instead of damages. Used as a tile counter-play.
var poison_absorb_until_ms: int = 0
var _was_poison_absorbing: bool = false
# Vanish (Giant) — intangible to basic/bullet attacks only. Bullets check
# is_vanished() and sail straight through (no hit, no thorn, no block).
# Cards, tiles, and contact damage still land. Sprite renders semi-transparent
# while active (alpha handled in _tick_idle_bob's modulate pass).
const VANISH_ALPHA := 0.45
var vanish_until_ms: int = 0
var _was_vanished: bool = false
# Direction of the last cell move (cell delta normalized to ±1 axes). Updated
# by Battle.set_caster_cell so frozen_tile contact can slip the combatant in
# the direction they were already travelling.
var last_move_direction: Vector2i = Vector2i.ZERO
# Malipole charged-bullet state. begin_charge starts the timer on SPACE
# press; release fires only if is_charge_complete returns true. Combo counter
# increments on each charged-bullet hit; at CHARGED_HITS_TO_CHORUS it
# triggers Frog Chorus frenzy via Battle and resets to zero.
const CHARGE_DURATION_MS := 1500
const CHARGED_HITS_TO_CHORUS := 3
const CHARGED_CHORUS_DURATION_MS := 3000
var charge_active: bool = false
var charge_started_at_ms: int = 0
var consecutive_charged_hits: int = 0
# Sonar Jam mana boost — while active, mana regen interval is divided by
# mana_boost_factor (2.0 default ≈ Sonar Jam's 2×; Overclock sets 3.0).
# Self-applied buff, distinct from the multiplicative buff system because it
# changes a tick cadence rather than a damage multiplier.
var mana_boost_until_ms: int = 0
var mana_boost_factor: float = 2.0
# Timestamps of recent card plays (post-play hook appends) — Drakecho's
# Static Tick reads "2 other cards within 3s" off this.
var card_played_times: Array = []
# Atomippo Event Horizon — toggle that makes movement off a gravity tile
# cost 2 input commands. Set when an arrow press / AI step happens on a
# gravity_well_tile cell; the next attempt clears it + completes the move.
# Reset to false whenever the combatant leaves the gravity tile.
var gravity_pending: bool = false
const POISON_ABSORB_HEAL_PER_TILE := 10
var traits: Array = []
var deck: Array = []
var hand: Array = []
# Discard entries: { "card": MoveDef, "ready_at_ms": int }. A card with
# ready_at_ms > now is still cooling and won't reshuffle into the deck.
var discard: Array = []
# Active buff entries: { id, damage_taken_mult, damage_dealt_mult, expires_at_ms, visual }
var buffs: Array = []
const HAND_SIZE := 2
const MANA_REGEN_INTERVAL_S := 1.5    # React: ~1 mana per 1.5s
const REFILL_CHECK_INTERVAL_S := 0.5  # how often to retry refilling hand as cards thaw
var _mana_regen_timer: float = 0.0
var _refill_check_timer: float = 0.0
var _idle_time: float = 0.0
var _idle_offset: float = 0.0
var _sprite_base_position: Vector3
var _sprite_base_scale: Vector3 = Vector3.ONE
var _hit_stretch_time: float = 0.0
var _hit_flash_time: float = 0.0
var _revive_pct: int = 0
var _revive_used: bool = false

@onready var sprite: Sprite3D = $Sprite

func _ready() -> void:
	add_to_group("combatants")
	if monster_def != null:
		apply_def(monster_def)
	else:
		hp = max_hp
		ammo = max_ammo
	_sprite_base_position = sprite.position
	_sprite_base_scale = sprite.scale
	_idle_offset = randf() * TAU
	damaged.connect(_on_self_damaged)

func _on_self_damaged(_amount: int, _mult: float, _src_type: String, _src: String) -> void:
	_hit_stretch_time = HIT_STRETCH_DURATION
	_hit_flash_time = HIT_FLASH_DURATION

func apply_def(def: MonsterDef, forced_trait_index: int = -1) -> void:
	monster_def = def
	display_name = def.display_name
	monster_type = def.monster_type
	max_hp = def.max_hp
	max_mana = def.max_mana
	basic_attack_kind = def.basic_attack_kind
	traits = []
	# Caught partner instances carry a LOCKED trait (SceneManager.caught_mons);
	# debug overrides use the same path. -1 = classic 40/40/20 roll.
	var rolled: TraitDef = null
	if forced_trait_index >= 0 and forced_trait_index < def.trait_pool.size():
		rolled = def.trait_pool[forced_trait_index] as TraitDef
	else:
		rolled = _roll_trait(def.trait_pool)
	if rolled != null:
		traits = [rolled]
	max_ammo = def.max_ammo + TraitRegistry.ammo_bonus(traits)
	reload_ms = int(round(float(def.reload_ms) * TraitRegistry.reload_mult(traits)))
	_revive_pct = TraitRegistry.revive_hp_pct(traits)
	_revive_used = false
	hp = max_hp
	mana = 5
	ammo = max_ammo
	armor = 0
	guarded_until_ms = 0
	_was_guarded = false
	_event_guard_triggered = false
	last_damaged_at_ms = Time.get_ticks_msec()
	basic_hit_count = 0
	cards_played_count = 0
	basic_cd_until_ms = 0
	rush_until_ms = 0
	_clear_buffs()
	stun_until_ms = 0
	_was_stunned = false
	poison_until_ms = 0
	poison_next_tick_ms = 0
	poison_dmg_per_tick = 0
	poison_source_label = ""
	_was_poisoned = false
	burn_until_ms = 0
	burn_next_tick_ms = 0
	burn_dmg_per_tick = 0
	burn_source_label = ""
	_was_burned = false
	if thorn_shield_active:
		thorn_shield_active = false
		thorn_shield_changed.emit(false)
	silence_until_ms = 0
	_was_silenced = false
	blind_until_ms = 0
	_was_blinded = false
	root_until_ms = 0
	_was_rooted = false
	sleep_until_ms = 0
	_was_asleep = false
	last_hit_woke_sleep = false
	bonus_card = null
	flat_reduction = 0
	flat_reduction_until_ms = 0
	mana_boost_factor = 2.0
	card_played_times = []
	forced_shuffles = 0
	poison_absorb_until_ms = 0
	_was_poison_absorbing = false
	_mana_regen_timer = 0.0
	_refill_check_timer = 0.0
	if sprite != null and def.sprite != null:
		sprite.texture = def.sprite
	_setup_deck(def.deck)
	trait_changed.emit(rolled)
	mana_changed.emit(mana, max_mana)

func _setup_deck(starting_deck: Array) -> void:
	deck = starting_deck.duplicate()
	deck.shuffle()
	hand = []
	discard = []
	_refill_hand()

func _refill_hand() -> void:
	var changed := false
	while hand.size() < HAND_SIZE:
		if deck.is_empty():
			# Pull thawed cards from discard; cooling cards stay behind.
			var now_ms := Time.get_ticks_msec()
			var thawed: Array = []
			var cooling: Array = []
			for entry in discard:
				if int(entry.get("ready_at_ms", 0)) <= now_ms:
					thawed.append(entry["card"])
				else:
					cooling.append(entry)
			if thawed.is_empty():
				break  # nothing thawed — hand stays under-full until something is ready
			deck = thawed
			deck.shuffle()
			discard = cooling
		hand.append(deck.pop_back())
		changed = true
	if changed:
		hand_changed.emit(hand)

func can_play(index: int) -> bool:
	if index < 0 or index >= hand.size():
		return false
	var card: MoveDef = hand[index]
	if card == null:
		return false
	if is_silenced():
		return false
	return card.mana_cost <= mana

func play_card(index: int) -> MoveDef:
	if not can_play(index):
		return null
	var card: MoveDef = hand[index]
	mana = maxi(0, mana - card.mana_cost)
	mana_changed.emit(mana, max_mana)
	hand.remove_at(index)
	# Stamp ready_at = now + cooldown so the card can't be reshuffled until it thaws.
	discard.append({"card": card, "ready_at_ms": Time.get_ticks_msec() + card.cooldown_ms})
	_refill_hand()
	return card

func refresh_hand() -> void:
	# Move current hand into discard, immediately ready (no cooldown — they weren't played).
	for c in hand:
		discard.append({"card": c, "ready_at_ms": 0})
	hand = []
	_refill_hand()

# Mosseer's Fortune Shot — the hand is rammed back INTO THE DECK and redrawn
# (literal sheet reading: fate may deal the same cards straight back).
# Distinct from refresh_hand's hand->discard path: these cards stay in the
# deck rotation with no cooldown stamp.
func force_shuffle_hand() -> void:
	for c in hand:
		if c != null:
			deck.append(c)
	hand = []
	deck.shuffle()
	_refill_hand()
	hand_changed.emit(hand)

# Insert a card directly into a hand slot. Used by boomerang catch — the card
# returns to the caster's hand at slot 0 (App3D.tsx:8132). If the slot is
# occupied, the bumped card cycles back to the deck so deck thaws aren't lost.
func return_card_to_hand_slot(card: MoveDef, slot: int) -> void:
	if card == null:
		return
	slot = clampi(slot, 0, HAND_SIZE - 1)
	if slot < hand.size():
		var bumped: MoveDef = hand[slot]
		hand[slot] = card
		if bumped != null:
			deck.append(bumped)
			deck.shuffle()
	else:
		while hand.size() < slot:
			hand.append(null)
		hand.append(card)
	hand_changed.emit(hand)

# === BONUS CARD (key 3) ===
# A granted card outside the deck/discard cycle — Aegis Pillar's Shatter,
# Rewind Fork's Return. One at a time; granting replaces. Shown by the hand
# panel in a third slot only while present.

var bonus_card: MoveDef = null

func grant_bonus_card(card: MoveDef) -> void:
	bonus_card = card
	hand_changed.emit(hand)

func clear_bonus_card() -> void:
	if bonus_card != null:
		bonus_card = null
		hand_changed.emit(hand)

func can_play_bonus() -> bool:
	return bonus_card != null and not is_silenced() and bonus_card.mana_cost <= mana

func play_bonus_card() -> MoveDef:
	if not can_play_bonus():
		return null
	var card: MoveDef = bonus_card
	mana = maxi(0, mana - card.mana_cost)
	mana_changed.emit(mana, max_mana)
	bonus_card = null
	hand_changed.emit(hand)
	return card

# Sends a card back to the deck (boomerang miss / timeout).
func return_card_to_deck(card: MoveDef) -> void:
	if card == null:
		return
	deck.append(card)
	deck.shuffle()

# Drops a cooling discard entry for `card` if present. Prevents a returned-to-
# hand boomerang from also showing up later via the discard reshuffle.
func remove_card_from_discard(card: MoveDef) -> bool:
	for i in range(discard.size() - 1, -1, -1):
		var entry: Dictionary = discard[i]
		if entry.get("card") == card:
			discard.remove_at(i)
			return true
	return false

func _roll_trait(pool: Array) -> TraitDef:
	if pool.is_empty():
		return null
	var total := 0.0
	for t in pool:
		if t is TraitDef:
			total += t.rarity if t.rarity > 0.0 else TraitDef.RARITY_COMMON
	if total <= 0.0:
		return pool[0]
	var r := randf() * total
	var c := 0.0
	for t in pool:
		if t is TraitDef:
			c += t.rarity if t.rarity > 0.0 else TraitDef.RARITY_COMMON
			if r <= c:
				return t
	return pool[pool.size() - 1]

func set_texture(tex: Texture2D) -> void:
	sprite.texture = tex

# === DAMAGE PIPELINE ===

func take_damage(amount: int, source_type: String = "", source: String = "") -> int:
	last_hit_woke_sleep = false
	if _is_iframed():
		blocked.emit("iframes")
		return 0
	if amount <= 0:
		return 0
	var mult := 1.0
	if not source_type.is_empty():
		mult = TypeWheel.multiplier(source_type, monster_type)
		# Outside Time (Drakecho) — type effectiveness never applies to the
		# holder. Received side only; the dealt side needs attacker context.
		if TraitRegistry.type_neutral(traits):
			mult = 1.0
	mult *= TraitRegistry.damage_taken_mult(traits)
	mult *= buff_damage_taken_mult()
	# Guarded (trait system) — halve incoming damage. Folded into the mult so
	# the popup shows the number that actually landed.
	if is_guarded():
		mult *= 0.5
	# Sanctified Ground (Gozo) — standing on your own blessed tile takes 30%
	# less. Positional read via battle_ctx, same shape as Shell Cover.
	if battle_ctx != null and battle_ctx.blessed_tile_under(self):
		mult *= 0.7
	# Burn vulnerability (user design) — burning, or standing on ground that
	# burns you, means every hit lands 1.2x. Burn-immunity exempts.
	if not is_burn_immune() and not TraitRegistry.is_immune(traits, "burn"):
		if is_burned() or (battle_ctx != null and battle_ctx.burn_tile_under(self)):
			mult *= BURN_VULN_MULT
	var final := int(round(float(amount) * mult))
	# Litany of Stone — flat absorption while channeling.
	if flat_reduction > 0 and Time.get_ticks_msec() < flat_reduction_until_ms:
		final -= flat_reduction
		if final <= 0:
			blocked.emit("absorbed")
			return 0
	if final <= 0:
		return 0
	last_damaged_at_ms = Time.get_ticks_msec()
	# Armor soaks final damage before HP. The damaged signal still carries the
	# full hit so popups read the real number; the armor bar tells the story.
	var to_hp := final
	if armor > 0:
		var absorbed := mini(armor, final)
		armor -= absorbed
		to_hp = final - absorbed
		armor_changed.emit(armor)
	hp = maxi(0, hp - to_hp)
	# Sleep breaks on any damage that lands (soft CC, unlike stun). The flag
	# lets Night Terror (on_basic_hit) turn the waking hit into a brief stun.
	if is_asleep():
		sleep_until_ms = 0
		_was_asleep = false  # keep _tick_stun_state from re-emitting woke next frame
		last_hit_woke_sleep = true
		woke.emit()
	# Event Guard — permanently Guarded once HP drops below 50% (from the
	# NEXT hit onward; this hit lands at full value).
	if not _event_guard_triggered and hp > 0 and hp * 2 < max_hp and TraitRegistry.guard_below_half(traits):
		_event_guard_triggered = true
	damaged.emit(final, mult, source_type, source)
	if hp == 0 and _revive_pct > 0 and not _revive_used:
		_revive_used = true
		hp = maxi(1, int(round(float(max_hp) * _revive_pct / 100.0)))
		healed.emit(hp)
	if hp == 0:
		died.emit()
	return final

func heal(amount: int) -> int:
	if amount <= 0 or hp >= max_hp:
		return 0
	var actual := mini(amount, max_hp - hp)
	hp += actual
	healed.emit(actual)
	return actual

func add_armor(amount: int) -> void:
	if amount <= 0:
		return
	armor += amount
	armor_changed.emit(armor)

func register_basic_hit() -> int:
	basic_hit_count += 1
	return basic_hit_count

func has_buff(id: String) -> bool:
	for buff in buffs:
		if String(buff.get("id", "")) == id:
			return true
	return false

# Remove a buff by id before its timer expires (Toadazer charge consumption).
func consume_buff(id: String) -> bool:
	for i in range(buffs.size()):
		var buff: Dictionary = buffs[i]
		if String(buff.get("id", "")) == id:
			var visual = buff.get("visual")
			if visual != null and is_instance_valid(visual):
				visual.queue_free()
			buffs.remove_at(i)
			buff_expired.emit(id)
			return true
	return false

# === GUARDED ===

func grant_guarded(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > guarded_until_ms:
		guarded_until_ms = new_until
		_was_guarded = true
		guarded_gained.emit(duration_ms)

func is_guarded() -> bool:
	if Time.get_ticks_msec() < guarded_until_ms:
		return true
	if _event_guard_triggered:
		return true
	# Shell Cover — guarded while a block stands directly in front.
	if battle_ctx != null and TraitRegistry.guarded_behind_block(traits):
		var side: String = battle_ctx.get_side(self)
		var ccell: Vector2i = battle_ctx.get_caster_cell(self)
		var info: Dictionary = MoveRegistry._project_forward(side, ccell, 1)
		if not info.is_empty():
			var w_side: String = info["side"]
			if battle_ctx.wall_at_cell(w_side, Vector2i(int(info["x"]), ccell.y)) != null:
				return true
	return false

# === RESOURCES ===

func spend_mana(cost: int) -> bool:
	if cost > mana:
		return false
	mana = maxi(0, mana - cost)
	mana_changed.emit(mana, max_mana)
	return true

func gain_mana(amount: int) -> void:
	var old := mana
	mana = mini(max_mana, mana + amount)
	if mana != old:
		mana_changed.emit(mana, max_mana)

func consume_ammo() -> bool:
	refresh_reload()
	if _is_reloading() or ammo <= 0:
		return false
	ammo -= 1
	if ammo == 0:
		reloading_until_ms = Time.get_ticks_msec() + reload_ms
	ammo_changed.emit(ammo, max_ammo, _is_reloading())
	return true

func refresh_reload() -> void:
	if reloading_until_ms > 0 and Time.get_ticks_msec() >= reloading_until_ms:
		ammo = max_ammo
		reloading_until_ms = 0
		ammo_changed.emit(ammo, max_ammo, false)

# Give one shot back instantly and cancel any reload in progress. Lunapra's
# crescent catch uses this — a caught boomerang costs nothing.
func refund_ammo() -> void:
	ammo = mini(ammo + 1, max_ammo)
	reloading_until_ms = 0
	ammo_changed.emit(ammo, max_ammo, false)

func _process(delta: float) -> void:
	if reloading_until_ms > 0:
		refresh_reload()
	_tick_idle_bob(delta)
	_tick_stun_state()
	if is_alive():
		_tick_buffs()
		_tick_poison()
		_tick_burn()
		_tick_mana_regen(delta)
		_tick_refill_check(delta)

# Emits unstunned() the frame the stun timer expires so visual listeners can
# clean up. Stun does NOT block buff/mana ticks — those are passive systems;
# only callers' card-play / movement / basic-fire branches should gate on
# is_stunned().
func _tick_stun_state() -> void:
	var now_stunned := is_stunned()
	if _was_stunned and not now_stunned:
		unstunned.emit()
	_was_stunned = now_stunned
	var now_silenced := is_silenced()
	if _was_silenced and not now_silenced:
		unsilenced.emit()
	_was_silenced = now_silenced
	var now_blinded := is_blinded()
	if _was_blinded and not now_blinded:
		unblinded.emit()
	_was_blinded = now_blinded
	var now_rooted := is_rooted()
	if _was_rooted and not now_rooted:
		unrooted.emit()
	_was_rooted = now_rooted
	var now_asleep := is_asleep()
	if _was_asleep and not now_asleep:
		woke.emit()  # self-expired; damage-wake emits woke inline in take_damage
	_was_asleep = now_asleep
	var now_absorbing := is_poison_absorbing()
	if _was_poison_absorbing and not now_absorbing:
		poison_absorb_changed.emit(false)
	_was_poison_absorbing = now_absorbing
	var now_vanished := is_vanished()
	if _was_vanished and not now_vanished:
		unvanished.emit()
	_was_vanished = now_vanished
	# Halo tracks the TIMED guard only — permanent/positional guards halve
	# damage quietly (their conditions are visible on the board itself).
	var now_guarded := Time.get_ticks_msec() < guarded_until_ms
	if _was_guarded and not now_guarded:
		guarded_lost.emit()
	_was_guarded = now_guarded

# === SILENCE ===

func apply_silence(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > silence_until_ms:
		silence_until_ms = new_until
		silenced.emit(duration_ms)

func is_silenced() -> bool:
	return Time.get_ticks_msec() < silence_until_ms

# === BLIND ===
# While blinded, attacks have a 20% chance to whiff (deal 0). The roll lives
# here so both card and basic damage math share it; the MISS popup rides
# battle_ctx so the whiff is visible wherever it happens.

func apply_blind(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	if TraitRegistry.is_immune(traits, "blind"):
		blocked.emit("blind_immune")
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > blind_until_ms:
		blind_until_ms = new_until
		blinded.emit(duration_ms)

func is_blinded() -> bool:
	return Time.get_ticks_msec() < blind_until_ms

func roll_blind_miss() -> bool:
	if not is_blinded():
		return false
	if randf() >= BLIND_MISS_CHANCE:
		return false
	print("%s is BLINDED — attack misses!" % display_name)
	if battle_ctx != null:
		battle_ctx._spawn_popup(global_position + Vector3(0.0, 1.0, 0.0), "MISS", Color(0.7, 0.7, 0.75))
	return true

# === ROOT ===
# Movement lock only (unlike stun): rooted combatants still play cards and
# fire basics. Gated at the voluntary-movement sites in battle.gd; forced
# displacement ignores it.

func apply_root(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	if TraitRegistry.is_immune(traits, "root"):
		blocked.emit("root_immune")
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > root_until_ms:
		root_until_ms = new_until
		rooted.emit(duration_ms)

func is_rooted() -> bool:
	return Time.get_ticks_msec() < root_until_ms

# === POISON ABSORB ===
# Mushroom "absorb poison": cures self poison + opens a window where poison
# tiles heal instead of damage. TimedEffect checks is_poison_absorbing() on
# tick / trigger_for and routes to heal() if active.

func activate_poison_absorb(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	# Also cure current poison.
	if poison_until_ms > 0:
		poison_until_ms = 0
		poison_dmg_per_tick = 0
		if _was_poisoned:
			unpoisoned.emit()
			_was_poisoned = false
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > poison_absorb_until_ms:
		poison_absorb_until_ms = new_until
		poison_absorb_changed.emit(true)

func is_poison_absorbing() -> bool:
	return Time.get_ticks_msec() < poison_absorb_until_ms

# === VANISH ===
# Giant's Vanish card — see field comments above. Overlapping casts extend.

func apply_vanish(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > vanish_until_ms:
		vanish_until_ms = new_until
		vanished.emit(duration_ms)

func is_vanished() -> bool:
	return Time.get_ticks_msec() < vanish_until_ms

func _tick_idle_bob(delta: float) -> void:
	if sprite == null:
		return
	if _hit_stretch_time > 0.0:
		_hit_stretch_time = maxf(0.0, _hit_stretch_time - delta)
		var hs := _hit_stretch_time / HIT_STRETCH_DURATION
		var s := hs * hs * HIT_STRETCH_AMOUNT
		sprite.scale.y = _sprite_base_scale.y * (1.0 - s)
		sprite.scale.x = _sprite_base_scale.x * (1.0 + s * 0.65)
		sprite.position.y = _sprite_base_position.y - s * SPRITE_HALF_HEIGHT * 0.35
	else:
		_idle_time += delta
		var phase := _idle_offset + _idle_time * IDLE_BOB_FREQ * TAU
		var s := sin(phase) * IDLE_BOB_AMOUNT
		sprite.scale.y = _sprite_base_scale.y * (1.0 + s)
		sprite.scale.x = _sprite_base_scale.x * (1.0 - s * 0.4)
		sprite.position.y = _sprite_base_position.y + s * SPRITE_HALF_HEIGHT
	# Vanish renders the sprite ghost-transparent; flash + reset both respect it.
	var alpha := VANISH_ALPHA if is_vanished() else 1.0
	if _hit_flash_time > 0.0:
		_hit_flash_time = maxf(0.0, _hit_flash_time - delta)
		var ft := _hit_flash_time / HIT_FLASH_DURATION
		var b := 1.0 + ft * (HIT_FLASH_BRIGHTNESS - 1.0)
		sprite.modulate = Color(b, b, b, alpha)
	else:
		var idle_color := Color(1.0, 1.0, 1.0, alpha)
		if sprite.modulate != idle_color:
			sprite.modulate = idle_color

# === I-FRAMES ===

func grant_iframes(ms: int = -1) -> void:
	var duration := ms if ms > 0 else iframe_ms
	iframe_until_ms = Time.get_ticks_msec() + duration

func _is_iframed() -> bool:
	return Time.get_ticks_msec() < iframe_until_ms

func _is_reloading() -> bool:
	return reloading_until_ms > 0 and Time.get_ticks_msec() < reloading_until_ms

# === STUN ===
# Trait immunity (TraitRegistry.is_immune(traits, "stun")) hard-blocks all
# stun attempts and emits a "stun_immune" blocked signal so panels can show
# a feedback popup. Overlapping stuns extend the timer rather than stacking.

func apply_stun(duration_ms: int, source = null) -> void:
	if duration_ms <= 0:
		return
	if TraitRegistry.is_immune(traits, "stun"):
		blocked.emit("stun_immune")
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > stun_until_ms:
		stun_until_ms = new_until
		stunned.emit(duration_ms)
		# Clinch — stunning an ENEMY heals the stunner. Self-stuns pass no
		# source, so channel/wind-up cards never trigger it.
		if source != null and source is Combatant and source != self:
			var src: Combatant = source
			if is_instance_valid(src) and src.is_alive():
				var stun_heal := TraitRegistry.heal_on_stun(src.traits)
				if stun_heal > 0:
					src.heal(stun_heal)

func is_stunned() -> bool:
	return Time.get_ticks_msec() < stun_until_ms

# === SLEEP ===
# Droopider's soft CC: blocks actions like stun, but ANY damage wakes it (see
# take_damage). Self-expires after the duration. `immune_sleep` trait key
# blocks it via the generic reader (none carry it yet).

func apply_sleep(duration_ms: int) -> void:
	if duration_ms <= 0:
		return
	if TraitRegistry.is_immune(traits, "sleep"):
		blocked.emit("sleep_immune")
		return
	var new_until := Time.get_ticks_msec() + duration_ms
	if new_until > sleep_until_ms:
		sleep_until_ms = new_until
		slept.emit(duration_ms)

func is_asleep() -> bool:
	return Time.get_ticks_msec() < sleep_until_ms

# === POISON ===
# DoT status: damages the combatant once per POISON_TICK_PERIOD_MS while
# poison_until_ms is in the future. Re-applying poison extends the timer and
# upgrades dmg_per_tick to whichever is higher (matches React stacking rule).
# Source label is preserved so the popup attributes damage to the original
# caster. Trait immunity blocks the apply call entirely.

func apply_poison(duration_ms: int, dmg_per_tick: int, source: String = "") -> void:
	if duration_ms <= 0 or dmg_per_tick <= 0:
		return
	if TraitRegistry.is_immune(traits, "poison"):
		blocked.emit("poison_immune")
		return
	var now := Time.get_ticks_msec()
	var new_until := now + duration_ms
	var was_active := poison_until_ms > now
	if new_until > poison_until_ms:
		poison_until_ms = new_until
	poison_dmg_per_tick = maxi(poison_dmg_per_tick, dmg_per_tick)
	if source != "":
		poison_source_label = source
	# Schedule next tick at +1s if we weren't already poisoned, otherwise leave
	# the existing cadence alone.
	if not was_active:
		poison_next_tick_ms = now + POISON_TICK_PERIOD_MS
	poisoned.emit(duration_ms, dmg_per_tick)

func is_poisoned() -> bool:
	return Time.get_ticks_msec() < poison_until_ms

# === BURN ===
# Fire twin of poison: same stacking rules (extend timer, keep highest DoT),
# fire-typed ticks, and the x1.2 taken vulnerability read in take_damage.

func apply_burn(duration_ms: int, dmg_per_tick: int, source: String = "") -> void:
	if duration_ms <= 0 or dmg_per_tick <= 0:
		return
	if TraitRegistry.is_immune(traits, "burn") or is_burn_immune():
		blocked.emit("burn_immune")
		return
	var now := Time.get_ticks_msec()
	var new_until := now + duration_ms
	var was_active := burn_until_ms > now
	if new_until > burn_until_ms:
		burn_until_ms = new_until
	burn_dmg_per_tick = maxi(burn_dmg_per_tick, dmg_per_tick)
	if source != "":
		burn_source_label = source
	if not was_active:
		burn_next_tick_ms = now + BURN_STATUS_TICK_PERIOD_MS
	burned.emit(duration_ms, dmg_per_tick)

func is_burned() -> bool:
	return Time.get_ticks_msec() < burn_until_ms

func _tick_burn() -> void:
	var now_burned := is_burned()
	if not now_burned:
		if _was_burned:
			unburned.emit()
			burn_dmg_per_tick = 0
		_was_burned = false
		return
	_was_burned = true
	var now := Time.get_ticks_msec()
	while now >= burn_next_tick_ms and is_burned():
		take_damage(burn_dmg_per_tick, "fire", burn_source_label if burn_source_label != "" else "burn")
		burn_next_tick_ms += BURN_STATUS_TICK_PERIOD_MS
		if not is_alive():
			break

# === THORN SHIELD ===

func activate_thorn_shield() -> void:
	if thorn_shield_active:
		return  # already up, no double-signal
	thorn_shield_active = true
	thorn_shield_changed.emit(true)

func consume_thorn_shield() -> void:
	if not thorn_shield_active:
		return
	thorn_shield_active = false
	thorn_shield_changed.emit(false)

# === MALIPOLE CHARGED BULLET ===
# Press SPACE: begin_charge(); release SPACE: caller checks is_charge_complete
# and calls _fire_basic with the charged flag, then cancel_charge() either way.
# A stun during charging cancels the in-progress shot.

func begin_charge() -> void:
	charge_active = true
	charge_started_at_ms = Time.get_ticks_msec()

func cancel_charge() -> void:
	charge_active = false
	charge_started_at_ms = 0

func is_charge_complete() -> bool:
	if not charge_active:
		return false
	return Time.get_ticks_msec() - charge_started_at_ms >= CHARGE_DURATION_MS

# Called by Bullet on a charged-bullet hitting a combatant. Returns true if
# the threshold was reached and the combo should trigger frenzy (counter
# resets to 0 in that case). Battle owns the frenzy-buff dispatch since the
# halo + tween live in the MoveRegistry helper.
func register_charged_hit() -> bool:
	consecutive_charged_hits += 1
	if consecutive_charged_hits >= CHARGED_HITS_TO_CHORUS:
		consecutive_charged_hits = 0
		return true
	return false

func _tick_poison() -> void:
	var now_poisoned := is_poisoned()
	if not now_poisoned:
		if _was_poisoned:
			unpoisoned.emit()
			poison_dmg_per_tick = 0
		_was_poisoned = false
		return
	_was_poisoned = true
	var now := Time.get_ticks_msec()
	while now >= poison_next_tick_ms and is_poisoned():
		# Poison Drinker — the DoT feeds instead of hurting.
		if TraitRegistry.heal_on_poison(traits):
			heal(poison_dmg_per_tick)
		else:
			take_damage(poison_dmg_per_tick, "", poison_source_label)
		poison_next_tick_ms += POISON_TICK_PERIOD_MS
		if not is_alive():
			break

# === BUFFS ===
# A buff is a transient stat multiplier. apply_buff replaces same-id buffs
# (no stacking — replaying battle_cry refreshes the duration). buff_expired
# fires per buff so listeners can clean up visuals.

func apply_buff(id: String, taken_mult: float, dealt_mult: float, duration_ms: int) -> Dictionary:
	# Replace any existing buff with same id (frees its visual).
	for i in range(buffs.size() - 1, -1, -1):
		if buffs[i]["id"] == id:
			_free_buff_visual(buffs[i])
			buffs.remove_at(i)
	var buff := {
		"id": id,
		"damage_taken_mult": taken_mult,
		"damage_dealt_mult": dealt_mult,
		"expires_at_ms": Time.get_ticks_msec() + duration_ms,
		"visual": null,
	}
	buffs.append(buff)
	buff_applied.emit(id, taken_mult, dealt_mult, duration_ms)
	return buff

func buff_damage_taken_mult() -> float:
	var m := 1.0
	for buff in buffs:
		m *= float(buff["damage_taken_mult"])
	return m

func buff_damage_dealt_mult() -> float:
	var m := 1.0
	for buff in buffs:
		# Frog Chorus frenzy: each call rolls a fresh random multiplier
		# inside [dealt_min, dealt_max]. Other buffs use the fixed value.
		if buff.has("dealt_min") and buff.has("dealt_max"):
			m *= randf_range(float(buff["dealt_min"]), float(buff["dealt_max"]))
		else:
			m *= float(buff["damage_dealt_mult"])
	return m

# Card-aware variant. If a buff has a card_type_mult_<type> key matching the
# card's type (e.g. Water Breathing's card_type_mult_water = 1.5), that
# specific mult is used for that buff. Otherwise falls back to the standard
# dealt_min/max or damage_dealt_mult logic. Used by _final_card_damage so
# type-specific card buffs can coexist with frenzy or generic dealt buffs.
func buff_damage_dealt_mult_for_card(card_type: String) -> float:
	var m := 1.0
	var type_key := ""
	if not card_type.is_empty():
		type_key = "card_type_mult_" + card_type
	for buff in buffs:
		if not type_key.is_empty() and buff.has(type_key):
			m *= float(buff[type_key])
			continue
		# Cards-only flat mult (Insidibear's rage: "cards do 1.2x") — basics
		# read buff_damage_dealt_mult() instead, which ignores this key.
		if buff.has("all_card_mult"):
			m *= float(buff["all_card_mult"])
		if buff.has("dealt_min") and buff.has("dealt_max"):
			m *= randf_range(float(buff["dealt_min"]), float(buff["dealt_max"]))
		else:
			m *= float(buff["damage_dealt_mult"])
	return m

# True if any active buff sets frozen_immune. Water Breathing uses this to
# let Scimark walk through frozen_tile hexes without slipping.
func is_frozen_immune() -> bool:
	for buff in buffs:
		if buff.get("frozen_immune", false):
			return true
	return false

# True if any active buff sets burn_immune. Explosive Skin (Modizard) uses
# this to stand on burn_tiles for free while the buff runs.
func is_burn_immune() -> bool:
	for buff in buffs:
		if buff.get("burn_immune", false):
			return true
	return false

# Sum of active buffs' card_type_heal_<type> keys (Fudo's Earth Armour).
# Read by MoveRegistry.execute after every card play — playing a card of the
# keyed type heals the caster.
func buff_card_type_heal(card_type: String) -> int:
	var total := 0
	var key := "card_type_heal_%s" % card_type
	for buff in buffs:
		total += int(buff.get(key, 0))
	return total

# Flat card-damage bonus from buffs (Mosseer's seer_charge: next grass card
# +10). Added after the multiplier stack in _final_card_damage.
func buff_card_flat_bonus(card_type: String) -> int:
	var total := 0
	var key := "card_type_flat_%s" % card_type
	for buff in buffs:
		total += int(buff.get(key, 0))
	return total

# === FIRE AND ICE (Modizard) ===
# Persistent water<->fire swap on THIS combatant: monster_type + every
# water/fire card in deck/hand/discard. Toggles on each cast; battle-scoped
# (Combatant state is rebuilt every battle). Cards are privatized
# (duplicated, identity-mapped across the three arrays) on first toggle so
# the shared .tres resources are NEVER mutated.

var fire_ice_swapped: bool = false
var _cards_privatized: bool = false

func toggle_fire_ice() -> bool:
	if not _cards_privatized:
		_privatize_cards()
	fire_ice_swapped = not fire_ice_swapped
	monster_type = _fire_ice_swap(monster_type)
	for card in deck:
		var m := card as MoveDef
		if m != null:
			m.move_type = _fire_ice_swap(m.move_type)
	for card in hand:
		var m := card as MoveDef
		if m != null:
			m.move_type = _fire_ice_swap(m.move_type)
	for entry in discard:
		var m: MoveDef = entry.get("card")
		if m != null:
			m.move_type = _fire_ice_swap(m.move_type)
	hand_changed.emit(hand)
	# Nudge the panel so the type chip redraws immediately.
	mana_changed.emit(mana, max_mana)
	return fire_ice_swapped

static func _fire_ice_swap(t: String) -> String:
	if t == "water":
		return "fire"
	if t == "fire":
		return "water"
	return t

func _privatize_cards() -> void:
	_cards_privatized = true
	var mapping: Dictionary = {}
	for i in range(deck.size()):
		deck[i] = _private_card(deck[i], mapping)
	for i in range(hand.size()):
		hand[i] = _private_card(hand[i], mapping)
	for i in range(discard.size()):
		var entry: Dictionary = discard[i]
		entry["card"] = _private_card(entry.get("card"), mapping)

# Same original MoveDef always maps to the same duplicate, so deck/hand/
# discard stay identity-consistent (cooldown reshuffle checks keep working).
func _private_card(card, mapping: Dictionary) -> MoveDef:
	var m := card as MoveDef
	if m == null:
		return null
	if not mapping.has(m):
		mapping[m] = m.duplicate()
	return mapping[m] as MoveDef

func _tick_buffs() -> void:
	if buffs.is_empty():
		return
	var now := Time.get_ticks_msec()
	var remaining: Array = []
	for buff in buffs:
		if int(buff["expires_at_ms"]) > now:
			remaining.append(buff)
		else:
			_free_buff_visual(buff)
			buff_expired.emit(buff["id"])
	buffs = remaining

func _clear_buffs() -> void:
	for buff in buffs:
		_free_buff_visual(buff)
	buffs = []

func _free_buff_visual(buff: Dictionary) -> void:
	var v = buff.get("visual")
	if v != null and is_instance_valid(v):
		v.queue_free()

# === MANA REGEN + HAND THAW TICKS ===

func apply_mana_boost(duration_ms: int) -> void:
	mana_boost_until_ms = maxi(mana_boost_until_ms, Time.get_ticks_msec() + duration_ms)

func is_mana_boosting() -> bool:
	return Time.get_ticks_msec() < mana_boost_until_ms

func _current_mana_regen_interval() -> float:
	# Sonar Jam / Immolation run at the default 2× (interval halved);
	# Drakecho's Overclock raises the factor to 3× for its window.
	return MANA_REGEN_INTERVAL_S / mana_boost_factor if is_mana_boosting() else MANA_REGEN_INTERVAL_S

func _tick_mana_regen(delta: float) -> void:
	if mana >= max_mana:
		_mana_regen_timer = 0.0
		return
	_mana_regen_timer += delta
	var interval := _current_mana_regen_interval()
	while _mana_regen_timer >= interval:
		_mana_regen_timer -= interval
		gain_mana(1)
		if mana >= max_mana:
			break
		# Re-sample in case the boost expired between iterations.
		interval = _current_mana_regen_interval()

func _tick_refill_check(delta: float) -> void:
	# Re-attempt refilling the hand as cooling cards thaw. Cheap when hand is full.
	if hand.size() >= HAND_SIZE:
		_refill_check_timer = 0.0
		return
	_refill_check_timer += delta
	if _refill_check_timer >= REFILL_CHECK_INTERVAL_S:
		_refill_check_timer = 0.0
		_refill_hand()

# === QUERIES ===

func is_alive() -> bool:
	return hp > 0

func hp_fraction() -> float:
	return float(hp) / float(max_hp) if max_hp > 0 else 0.0
