class_name MoveDef
extends Resource

# Tile effect ids consumed by the place-tile handler:
#   "holy_tile"    - heals anyone 3 HP/s for 3s (gold)
#   "heal_font"    - heals owner only 3 HP/s for 6s (green puddle)
#   "poison_trap"  - poison DoT 1/tick for owner-opposite side
#   "spore_cloud"  - AoE poison patch
#   "vamp_mist"    - damages target, heals attacker
#   "frozen_tile"  - freezes/slows anyone standing on it
#   "silence_bomb" - blocks cards / silences enemy
#   "vine_snare"   - immobilizes
#   "lily_pad"     - aids movement
#
# Status effect ids (applied to combatants on hit):
#   "burn", "poison", "freeze", "stun", "wet", "shock", "sleep"

@export_group("Identity")
@export var id: String = ""
@export var display_name: String = ""
@export var move_type: String = ""

@export_group("Cost")
@export var mana_cost: int = 1
@export var cooldown_ms: int = 1000

@export_group("Display")
@export_multiline var description: String = ""

@export_group("Effect")
@export var effect_id: String = ""        # routes to MoveRegistry handler
@export var damage: int = 0
@export var range_tiles: int = 1          # cells the effect reaches in front
@export var area_radius: int = 0          # AoE radius in cells around target
@export var hit_count: int = 1            # how many separate hits land

@export_group("Tile Placed")
@export var tile_effect_id: String = ""   # "holy_tile", "heal_font", "poison_trap"...
@export var tile_lifetime_ms: int = 0
@export var tile_owner_only: bool = true  # heal_font: true; holy_tile: false

@export_group("Buff / Self")
@export var self_buff_id: String = ""     # "charge", "guard_below_half", "armor"
@export var buff_mult: float = 1.0
@export var buff_duration_ms: int = 0
@export var self_heal: int = 0
# Armor granted to the caster (Grabbakat Barrier = 15, Flex = 5). Consumed by
# the gain_armor effect; armor is bonus HP damaged before real HP.
@export var armor_gain: int = 0
# Self-stun applied at cast time. Used by Scimark's locked beam, Atomippo's
# Gravity Slam + Graviton Beam. 0 = no lock. Read by individual handlers
# that opt in (e.g., _beam) so legacy cards keep their unlocked behavior.
@export var caster_lock_ms: int = 0

@export_group("Status Applied")
@export var status_id: String = ""        # "burn", "poison", "freeze", "stun"
@export var status_duration_ms: int = 0
@export var status_dot: int = 0           # damage per tick if a DoT

@export_group("Movement / Displacement")
@export var caster_offset: Vector2i = Vector2i.ZERO   # caster teleport offset (Lunge, blink)
@export var target_displacement: Vector2i = Vector2i.ZERO  # push/pull target
@export var random_destination: bool = false           # random_hop, frog teleport
# True for any card that moves the caster OR the opponent. Read by future
# Shadow Step trait (guarded_on_reposition) to apply Guarded on play. Silent
# until that system lands — set on shadow_dive, swoop, lasso, dash_attack,
# displace, teleport, tunnel, random_hop, reap.
@export var is_movement_card: bool = false

@export_group("Effect Variants")
# Giant's Hammer Down: 1.5s freeze, no opponent pull. Cone footprint is the
# same for both variants (contact cell at depth 1 + 3-wide head at depth 2);
# when false, _hammer_down runs Atomippo's Gravity Slam timing (2s freeze +
# drag-opp-closer pulls). Keeps both mons on one effect_id.
@export var hammer_faithful: bool = false
# React-vanilla Zone Steal (Giant): skip the gravity_field DoT column that
# Atomippo's Crushing Field lays behind the steal. Claim + push + stun unchanged.
@export var zone_no_dot: bool = false
