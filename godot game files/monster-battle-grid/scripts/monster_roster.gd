class_name MonsterRoster

# Central lookup for all monsters. Add new ones by dropping a .tres into
# res://data/monsters/ and appending its id here.
const IDS := [
	"cowboy", "hogglin", "lemmel", "malipole", "grunt", "slime", "dragone",
	"pixie", "giant", "mushroom", "fudo", "scimark", "toadazer", "icage",
	"cargot", "kingfencer", "atomippo", "modizard",
]

# The 5 starters (mon battle grid_starters.xlsx). Rare in the wild (1%) —
# random_def() deliberately excludes them; the overworld rolls them separately.
const STARTER_IDS := [
	"kindlekit", "dandeox", "gozo", "klawr", "drakecho",
]

# Zone 2 natives (mons.xlsx rows 5/18/19/20/120). Uniform roll for now —
# rarity weighting (common/semi-rare) comes later per user.
const ZONE2_IDS := [
	"droopider", "insidibear", "mosseer", "wherewolf", "jester",
]

# Zone 3 natives (garden town). Basic bullets + 5 type-matched cards each;
# bespoke basics + traits land in per-mon passes. Uniform roll for now.
const ZONE3_IDS := [
	"krrrrin", "gilga", "astragio", "baarister", "trikits",
]

static func load_by_id(id: String) -> MonsterDef:
	var path := "res://data/monsters/%s.tres" % id
	if not ResourceLoader.exists(path):
		push_warning("MonsterRoster: missing %s" % path)
		return null
	return load(path) as MonsterDef

static func load_all() -> Array[MonsterDef]:
	var out: Array[MonsterDef] = []
	for id in IDS + STARTER_IDS + ZONE2_IDS + ZONE3_IDS:
		var def := load_by_id(id)
		if def != null:
			out.append(def)
	return out

static func random_def() -> MonsterDef:
	return load_by_id(IDS.pick_random())

static func random_starter_def() -> MonsterDef:
	return load_by_id(STARTER_IDS.pick_random())

static func random_zone2_def() -> MonsterDef:
	return load_by_id(ZONE2_IDS.pick_random())

static func random_zone3_def() -> MonsterDef:
	return load_by_id(ZONE3_IDS.pick_random())
