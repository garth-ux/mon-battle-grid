class_name TraitRegistry

# Aggregate trait effects from a list of TraitDef resources.
# All methods are pure — they read from the traits array and return a value.
# Combatant / damage pipeline calls these at the appropriate hook points.

# === DAMAGE MULTIPLIERS ===

static func damage_taken_mult(traits: Array) -> float:
	var mult := 1.0
	for t in traits:
		if t is TraitDef and t.effects.has("dmg_taken_mult"):
			mult *= float(t.effects["dmg_taken_mult"])
	return mult

static func damage_dealt_mult(traits: Array) -> float:
	var mult := 1.0
	for t in traits:
		if t is TraitDef and t.effects.has("dmg_dealt_mult"):
			mult *= float(t.effects["dmg_dealt_mult"])
	return mult

static func bullet_bonus(traits: Array) -> int:
	var bonus := 0
	for t in traits:
		if t is TraitDef and t.effects.has("bullet_bonus"):
			bonus += int(t.effects["bullet_bonus"])
	return bonus

static func bullet_mult(traits: Array) -> float:
	var mult := 1.0
	for t in traits:
		if t is TraitDef and t.effects.has("bullet_mult"):
			mult *= float(t.effects["bullet_mult"])
	return mult

static func card_mult(traits: Array, card_type: String) -> float:
	var mult := 1.0
	for t in traits:
		if t is TraitDef:
			if t.effects.has("all_card_mult"):
				mult *= float(t.effects["all_card_mult"])
			if not card_type.is_empty():
				var key := "card_type_mult_" + card_type
				if t.effects.has(key):
					mult *= float(t.effects[key])
	return mult

# === RESOURCES ===

static func ammo_bonus(traits: Array) -> int:
	var bonus := 0
	for t in traits:
		if t is TraitDef and t.effects.has("ammo_bonus"):
			bonus += int(t.effects["ammo_bonus"])
	return bonus

static func wall_bonus_hp(traits: Array) -> int:
	var bonus := 0
	for t in traits:
		if t is TraitDef and t.effects.has("wall_bonus_hp"):
			bonus += int(t.effects["wall_bonus_hp"])
	return bonus

# === IMMUNITIES ===

static func is_immune(traits: Array, status: String) -> bool:
	if status.is_empty():
		return false
	var key := "immune_" + status
	for t in traits:
		if t is TraitDef and t.effects.get(key, false):
			return true
	return false

# === EVENT HEALS (callers fire when the event happens) ===

static func heal_on_block_break(traits: Array) -> int:
	var amt := 0
	for t in traits:
		if t is TraitDef and t.effects.has("heal_on_block_break"):
			amt = maxi(amt, int(t.effects["heal_on_block_break"]))
	return amt

static func heal_on_stun(traits: Array) -> int:
	var amt := 0
	for t in traits:
		if t is TraitDef and t.effects.has("heal_on_stun"):
			amt = maxi(amt, int(t.effects["heal_on_stun"]))
	return amt

static func boomerang_catch_heal(traits: Array) -> int:
	var amt := 0
	for t in traits:
		if t is TraitDef and t.effects.has("boomerang_catch_heal"):
			amt = maxi(amt, int(t.effects["boomerang_catch_heal"]))
	return amt

static func combo_heal(traits: Array) -> Dictionary:
	# Returns { "every": N, "amount": M } or empty dict if no combo_heal trait.
	for t in traits:
		if t is TraitDef and t.effects.has("combo_heal_every"):
			return {
				"every": int(t.effects["combo_heal_every"]),
				"amount": int(t.effects.get("combo_heal_amount", 0)),
			}
	return {}

static func reload_mult(traits: Array) -> float:
	var mult := 1.0
	for t in traits:
		if t is TraitDef and t.effects.has("reload_mult"):
			mult *= float(t.effects["reload_mult"])
	return mult

static func revive_hp_pct(traits: Array) -> int:
	# Returns the highest revive percent if any trait grants revive, else 0.
	var pct := 0
	for t in traits:
		if t is TraitDef and t.effects.has("revive_hp_pct"):
			pct = maxi(pct, int(t.effects["revive_hp_pct"]))
	return pct

static func charge_heal(traits: Array) -> int:
	var amt := 0
	for t in traits:
		if t is TraitDef and t.effects.has("charge_heal"):
			amt = maxi(amt, int(t.effects["charge_heal"]))
	return amt

static func card_type_heal(traits: Array, card_type: String) -> int:
	if card_type.is_empty():
		return 0
	var amt := 0
	var key := "card_type_heal_" + card_type
	for t in traits:
		if t is TraitDef and t.effects.has(key):
			amt = maxi(amt, int(t.effects[key]))
	return amt

# Bonus damage added to Lemmel's rat attacks (rat_pack, trash_toss,
# street_swarm + trash_toss-miss wandering rat). Rat Flood trait grants +10.
static func rat_dmg_bonus(traits: Array) -> int:
	var bonus := 0
	for t in traits:
		if t is TraitDef and t.effects.has("rat_dmg_bonus"):
			bonus += int(t.effects["rat_dmg_bonus"])
	return bonus

# Tunnel Rats trait — when ANY wall breaks (yours or enemy), the holder
# releases a wandering rat that homes at the wall demolisher's side.
static func has_rat_on_block_break(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("rat_on_block_break", false):
			return true
	return false

# Poison Drinker — poison DoT ticks HEAL instead of damaging.
static func heal_on_poison(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("heal_on_poison", false):
			return true
	return false

# Ancient Claim — zone steal lasts 50% longer if unhit for 10s.
static func steal_duration(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("steal_duration", false):
			return true
	return false

# Sleep Spores / Stunning Touche — basic shots carry a brief stun rider.
static func basic_stuns(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("basic_stuns", false):
			return true
	return false

# Extended Lunge — every Nth basic hit follows up with a 3-wide slash. 0 = off.
static func wide_slash_every(traits: Array) -> int:
	for t in traits:
		if t is TraitDef and t.effects.has("wide_slash_every"):
			return int(t.effects["wide_slash_every"])
	return 0

# Triple Echo — every 3rd card played echoes 10 DMG at the enemy after 0.5s.
static func has_echo_card(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("echo_card", false):
			return true
	return false

# === GUARDED SYSTEM ===
# Guarded = take 50% less damage (Combatant.is_guarded halves the mult).
# Triggers: playing a card of the keyed type (3s), playing a movement card
# (2s), dropping below half HP (permanent), or standing behind a block.

static func guarded_on_type(traits: Array, card_type: String) -> bool:
	if card_type.is_empty():
		return false
	var key := "guarded_on_type_" + card_type
	for t in traits:
		if t is TraitDef and t.effects.get(key, false):
			return true
	return false

static func guarded_on_reposition(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("guarded_on_reposition", false):
			return true
	return false

static func guard_below_half(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("guard_below_half", false):
			return true
	return false

static func guarded_behind_block(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("guarded_behind_block", false):
			return true
	return false

# Modizard guard traits — consumed by Battle._basic_call_guard when spawning
# guard turrets. Bomb Lobbers: guard shots deal 12 instead of 5. Pickpockets:
# guard bullet hits steal 2 HP back to the owner.
static func guard_bombs(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("guard_bombs", false):
			return true
	return false

static func guard_steal(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("guard_steal", false):
			return true
	return false

# === STARTER TRAITS (mon battle grid_starters.xlsx) ===

# Essence Drinker (Drakecho) — heal N HP per mana point stolen. Consumed by
# Battle.steal_mana so every steal source (basic, Mana Thief) pays out.
static func heal_per_mana_stolen(traits: Array) -> int:
	var total := 0
	for t in traits:
		if t is TraitDef and t.effects.has("heal_per_mana_stolen"):
			total += int(t.effects["heal_per_mana_stolen"])
	return total

# Mana Thief (Dandeox) — every Nth card played steals mana from the opponent.
# Empty dict = trait absent.
static func mana_steal(traits: Array) -> Dictionary:
	for t in traits:
		if t is TraitDef and t.effects.has("mana_steal_every"):
			return {
				"every": int(t.effects["mana_steal_every"]),
				"amount": int(t.effects.get("mana_steal_amount", 0)),
			}
	return {}

# Outside Time (Drakecho) — type effectiveness never applies to the holder.
# Received side lives in Combatant.take_damage; the dealt side needs attacker
# context at the damage site and comes online with the attacker-traits pass.
static func type_neutral(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("type_neutral", false):
			return true
	return false

# Tinder Nerves (Kindlekit) — taking water damage self-blinds for N ms. 0 = off.
static func blind_self_on_water_ms(traits: Array) -> int:
	for t in traits:
		if t is TraitDef and t.effects.has("blind_self_on_water_ms"):
			return int(t.effects["blind_self_on_water_ms"])
	return 0

# Tinder Nerves (Kindlekit) — taking fire/fighting damage charges the next
# fire/fighting card by this mult. 0.0 = off.
static func tinder_charge_mult(traits: Array) -> float:
	for t in traits:
		if t is TraitDef and t.effects.has("tinder_charge_mult"):
			return float(t.effects["tinder_charge_mult"])
	return 0.0

# Night Terror (Droopider) — a basic that damages a SLEEPING enemy stuns it
# for this many ms (the waking hit). 0 = off.
static func sleep_hit_stun_ms(traits: Array) -> int:
	for t in traits:
		if t is TraitDef and t.effects.has("sleep_hit_stun_ms"):
			return int(t.effects["sleep_hit_stun_ms"])
	return 0

# Waking Dream (Droopider) — hand refresh is instant (no 2s hold) while the
# opponent is asleep.
static func instant_refresh_on_sleep(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("instant_refresh_on_sleep", false):
			return true
	return false

# Shift Change (Insidibear) — swapping OUT heals this % of max HP (banked
# into the benched state). 0 = off.
static func swap_out_heal_pct(traits: Array) -> int:
	for t in traits:
		if t is TraitDef and t.effects.has("swap_out_heal_pct"):
			return int(t.effects["swap_out_heal_pct"])
	return 0

# Short Fuse (Insidibear) — opens the battle (and every swap-in) already
# raging, but rage runs 10s instead of 15 and the holder takes x1.2 while it
# lasts (both folded into Battle._apply_rage).
static func rage_at_start(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("rage_at_start", false):
			return true
	return false

# Inside Job (Insidibear secret) — swapping out leaves a lurker behind the
# enemy field that pot-shots them from the rear.
static func has_inside_job(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("inside_job", false):
			return true
	return false

# Earthen Ward (Mosseer) — cards of this type grant Guarded only if the card
# actually damages the opponent. The post-play hook arms a short window on
# Battle; Battle's damaged hook pays it when matching-typed damage lands.
static func guarded_on_type_damage(traits: Array, card_type: String) -> bool:
	var key := "guarded_on_type_damage_%s" % card_type
	for t in traits:
		if t is TraitDef and t.effects.get(key, false):
			return true
	return false

# Fortune Told (Mosseer secret) — after forcing enough opponent hand-shuffles
# in one battle, grass cards deal x1.5 for the rest of the match.
static func has_fortune_told(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("fortune_told", false):
			return true
	return false

# Lingering Shadow (Wherewolf) — swapping out leaves a prowling shadow on the
# opponent's grid that stuns on contact (spent on trigger).
static func has_lingering_shadow(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("lingering_shadow", false):
			return true
	return false

# Opportunist (Wherewolf) — Shadow Strike against an already-stunned target
# crits (x2, applied in Battle._shadow_strike_land).
static func shadow_crit_on_stunned(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("shadow_crit_on_stunned", false):
			return true
	return false

# Phantom Fang (Wherewolf secret) — replaces Shadow Strike: vanish on release
# + a boomerang shadow that shoves/drags the victim to the rear/front.
static func has_phantom_fang(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("phantom_fang", false):
			return true
	return false

# Limelight (Jester) — Halo Beam hits briefly MARK the victim: they take
# ×1.2 from all sources (a taken-mult buff applied by the beam step).
static func has_limelight(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("limelight", false):
			return true
	return false

# Bright Ward (Jester) — a beam hit that lands damage grants the caster
# Guarded (the "shielded" wording on the sheet).
static func has_bright_ward(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("bright_ward", false):
			return true
	return false

# Afterglow (Jester secret) — each beam drops a 3s heal_font under the caster.
static func has_afterglow(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("afterglow", false):
			return true
	return false

# Nightmare (Droopider secret) — EVERY mind card the holder plays lulls the
# opponent to sleep (consumed by the execute() post-play hook).
static func sleep_on_mind_card(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("sleep_on_mind_card", false):
			return true
	return false

# Krrrrin (zone 3) ram-hit traits — checked in Battle._ram_impact.
static func ram_grants_guard(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("guarded_on_ram", false):
			return true
	return false

static func ram_burns_trail(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("burn_trail_on_ram", false):
			return true
	return false

static func ram_burns_enemy(traits: Array) -> bool:
	for t in traits:
		if t is TraitDef and t.effects.get("burn_enemy_on_ram", false):
			return true
	return false
