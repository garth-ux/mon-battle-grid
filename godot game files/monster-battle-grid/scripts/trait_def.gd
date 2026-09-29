class_name TraitDef
extends Resource

const RARITY_COMMON := 0.4
const RARITY_UNCOMMON := 0.4
const RARITY_SECRET := 0.2

@export var id: String = ""
@export var display_name: String = ""
@export var description: String = ""
@export var rarity: float = 0.4

# Effect dictionary. Keys are hook ids; values are floats / ints / bools.
# Recognized hook ids (more added as the registry grows):
#   dmg_taken_mult: float        - flat multiplier on damage received
#   dmg_dealt_mult: float        - flat multiplier on damage given (any source)
#   bullet_bonus: int            - flat damage added to basic shots
#   bullet_mult: float           - multiplier on basic shot damage
#   all_card_mult: float         - multiplier on all card damage
#   card_type_mult_<type>: float - multiplier on cards of a specific type
#   ammo_bonus: int              - extra basic-attack ammo slots
#   wall_bonus_hp: int           - extra HP on placed walls
#   immune_<status>: bool        - immunity to a status (poison, stun, ...)
#   heal_on_block_break: int     - heal N when destroying a wall
#   heal_on_stun: int            - heal N when stunning an enemy
#   heal_on_poison: bool         - poison heals you instead of damaging
#   guarded_on_type_<type>: bool - cards of type grant Guarded
#   guarded_on_reposition: bool  - movement cards grant Guarded
#   guard_steal: bool            - guard hits steal HP for you
#   combo_heal_every: int        - heal every N basic hits
#   combo_heal_amount: int       - amount healed by combo_heal
#   rat_on_block_break: bool     - spawn a rat when block breaks
#   rat_dmg_bonus: int           - bonus damage on rat attacks
#   boomerang_catch_heal: int    - heal when catching a boomerang
@export var effects: Dictionary = {}
