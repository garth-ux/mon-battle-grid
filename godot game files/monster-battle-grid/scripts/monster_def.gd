class_name MonsterDef
extends Resource

@export var id: String = ""
@export var display_name: String = ""
@export var monster_type: String = ""

@export_group("Stats")
@export var max_hp: int = 100
@export var max_mana: int = 10
@export var max_ammo: int = 3
@export var reload_ms: int = 3000

@export_group("Art")
@export var sprite: Texture2D

@export_group("Combat")
@export var basic_attack_id: String = ""
# How the basic (SPACE) attack behaves:
#   "bullet"        — fires a forward bullet (default).
#   "block_builder" — places a 1-HP block 1 cell forward (Hogglin).
@export var basic_attack_kind: String = "bullet"
@export var deck: Array[Resource] = []
@export var trait_pool: Array[Resource] = []
