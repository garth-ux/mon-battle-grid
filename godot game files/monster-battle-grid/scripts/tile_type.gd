class_name TileType
extends RefCounted

enum Kind {
	UNKNOWN,
	FLOOR,
	ENCOUNTER_GRASS,
	WATER,
	TREE,
	WALL,
	CLIFF_EDGE,
	DECORATION,
	PORTAL_ZONE2,  # green gradient pad (zone 1 tex _9) — travel to zone 2
	PORTAL_ZONE1,  # sandy gradient pad (zone 2 tex _3) — travel back to zone 1
}

# Indices 0-11 = zone 1 (BlockTile_1781894212), 12-16 = zone 2
# (BlockTile_1783783028, textures extracted from the GLB as loose reference
# PNGs — GridBuilder matches by image fingerprint, so embedded GLB textures
# resolve to the same indices).
const TEXTURE_INDEX_TO_KIND := {
	0: Kind.WATER,
	1: Kind.CLIFF_EDGE,
	2: Kind.FLOOR,
	3: Kind.FLOOR,
	4: Kind.TREE,
	5: Kind.DECORATION,
	6: Kind.ENCOUNTER_GRASS,
	7: Kind.WALL,
	8: Kind.WALL,
	9: Kind.PORTAL_ZONE2,
	10: Kind.TREE,
	11: Kind.TREE,
	12: Kind.FLOOR,            # zone 2 speckled sand
	13: Kind.WALL,             # zone 2 red rock
	14: Kind.TREE,             # zone 2 cactus (acts exactly like trees)
	15: Kind.PORTAL_ZONE1,     # zone 2 gradient strip — back to zone 1
	16: Kind.ENCOUNTER_GRASS,  # zone 2 brown tall grass
	# Zone 3 (BlockTile_1786792549, garden town) — indices 17-37. Geometry
	# census (July 2026): props (flags, plant pots, hedges) block movement
	# per user spec; the two lawns + cobbles are walkable; sprig tufts are
	# the encounter decal; green gradient pads exit back to zone 1.
	17: Kind.FLOOR,            # flat glass floor panels (_0) — walkable grid
	18: Kind.WALL,             # teal pane (unused in this map)
	19: Kind.WALL,             # plant pot rim (white pot, grass spill)
	20: Kind.TREE,             # hedge blob
	21: Kind.TREE,             # fern (unused in this map)
	22: Kind.FLOOR,            # lawn A
	23: Kind.WALL,             # grey stone wall (vined bricks)
	24: Kind.WALL,             # stone trim
	25: Kind.FLOOR,            # white cobblestone plaza
	26: Kind.WALL,             # flagpole
	27: Kind.WALL,             # flag finial / lantern
	28: Kind.WALL,             # royal standard flag
	29: Kind.WALL,             # plank cladding
	30: Kind.WALL,             # black doorway void
	31: Kind.ENCOUNTER_GRASS,  # grass tuft (_14) — the real encounter decal
	32: Kind.TREE,             # decorated pine tree
	33: Kind.FLOOR,            # lawn B
	34: Kind.FLOOR,            # mossy glass floor (_17) — walkable, no encounter
	35: Kind.WALL,             # grey raised structure / roofs
	36: Kind.FLOOR,            # flower decal (unused in this map)
	37: Kind.PORTAL_ZONE1,     # green gradient pads — exit back to zone 1
	# Zone 4 (BlockTile_1787352578, stone room) — only its 3 UNIQUE textures are
	# referenced (indices 38-40): the grey brick FLOOR at y≈1.0 (dual-use for
	# walls too, handled by the step-aware is_walkable like zone-3 grey stone).
	# Zone 4's other textures are dupes of zone 3's and inherit those kinds; its
	# untextured base/walls are classified by orientation in GridBuilder.
	# Entry/return are position-based (no portal tiles here).
	38: Kind.FLOOR, 39: Kind.FLOOR, 40: Kind.FLOOR,
}

static func is_walkable(kind: int) -> bool:
	match kind:
		Kind.FLOOR, Kind.ENCOUNTER_GRASS, Kind.DECORATION, Kind.PORTAL_ZONE2, Kind.PORTAL_ZONE1:
			return true
	return false

static func is_encounter(kind: int) -> bool:
	return kind == Kind.ENCOUNTER_GRASS

static func from_texture_path(path: String) -> int:
	if path.is_empty():
		return Kind.UNKNOWN
	var basename := path.get_file().get_basename()
	var parts := basename.split("_")
	if parts.size() == 0:
		return Kind.UNKNOWN
	var last := parts[parts.size() - 1]
	if not last.is_valid_int():
		return Kind.UNKNOWN
	var idx := int(last)
	return TEXTURE_INDEX_TO_KIND.get(idx, Kind.UNKNOWN)

static func kind_name(kind: int) -> String:
	return Kind.keys()[kind]
