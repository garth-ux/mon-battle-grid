class_name TileGrid
extends RefCounted

const TILE_SIZE := 1.0
const BLOCKER_HEIGHT := 1.5
const GROUND_CLUSTER_TOLERANCE := 0.2
# Max height of a single walkable STEP riser. Garden stone steps rise ~0.5m;
# real walls/roofs jump 1m+ from their neighbours, so this cleanly separates a
# climbable step from a wall you must not stand on.
const STEP_RISER := 0.7

class Cell:
	var kind: int = TileType.Kind.UNKNOWN
	var top_y: float = 0.0
	var absolute_top_y: float = -INF
	var ground_y: float = -INF
	var inferred_ground_y: float = -INF
	var has_encounter_grass: bool = false
	var has_tree: bool = false
	var has_wall: bool = false
	var has_water: bool = false

var origin_xz := Vector2.ZERO
var cells: Dictionary = {}

func get_cell(coord: Vector2i) -> Cell:
	return cells.get(coord, null)

func get_kind(coord: Vector2i) -> int:
	var c := get_cell(coord)
	return c.kind if c != null else TileType.Kind.UNKNOWN

func get_effective_ground_y(cell: Cell) -> float:
	if cell == null:
		return -INF
	if cell.ground_y > -1e9:
		return cell.ground_y
	return cell.inferred_ground_y

# The height of the surface the player would stand on in this cell. When the
# cell has a real top face (kind set by an is_top triangle — floor, step top,
# wall cap) that face IS the surface; otherwise fall back to the (inferred)
# ground. Used by both walkability and cell_to_world so the player rides the
# actual surface instead of sinking to a neighbour's level.
func _surface_y(cell: Cell) -> float:
	if cell == null:
		return -INF
	if cell.kind != TileType.Kind.UNKNOWN:
		return cell.top_y
	return get_effective_ground_y(cell)

func is_walkable(coord: Vector2i) -> bool:
	var c := get_cell(coord)
	if c == null:
		return false
	if c.has_water:
		return false
	# Foliage — trees, hedges, planted pots — always blocks, even where the
	# billboard sits on a walkable floor tile (the cell reads FLOOR but carries
	# has_tree).
	if c.has_tree:
		return false
	var surf := _surface_y(c)
	if surf <= -1e9:
		return false
	# Wall-textured stone is reused for BOTH tall walls AND low garden
	# staircases, so it's walkable only when it reads as a STEP — its own
	# surface within one small riser (STEP_RISER) of a neighbour's surface. A
	# real wall / roof jumps far higher than that and stays solid; the player's
	# MAX_STEP check also blocks actually reaching any tall top that slips
	# through. Genuine ground tops (floor, lawn, cobblestone, grass, glass
	# panels) are always walkable, ignoring tall geometry bleeding in from a
	# neighbour.
	match c.kind:
		TileType.Kind.WALL, TileType.Kind.CLIFF_EDGE:
			return _is_step(coord, surf)
		TileType.Kind.UNKNOWN:
			# Legacy height heuristic for unclassified cells — keeps zones 1-2
			# behaving as before; a tall thing standing on the cell blocks it.
			if c.absolute_top_y > -1e9 and c.absolute_top_y - surf > BLOCKER_HEIGHT:
				return false
	return true

# A wall-textured cell counts as a walkable STEP when its standing surface sits
# within one small riser (STEP_RISER) of a neighbour's surface. Tall walls and
# roofs jump higher than a riser above every neighbour and fail this, staying
# solid. A run of stone steps chains because each tier is a riser from the
# next. The player's per-move MAX_STEP check still gates the real climb.
func _is_step(coord: Vector2i, surf: float) -> bool:
	for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		var n := get_cell(coord + d)
		if n == null:
			continue
		var ns := _surface_y(n)
		if ns <= -1e9:
			continue
		if absf(surf - ns) <= STEP_RISER:
			return true
	return false

func is_encounter(coord: Vector2i) -> bool:
	var c := get_cell(coord)
	return c != null and c.has_encounter_grass

func cell_to_world(coord: Vector2i) -> Vector3:
	var cell := get_cell(coord)
	var y := 0.0
	if cell != null:
		var surf := _surface_y(cell)
		if surf > -1e9:
			y = surf
		elif cell.top_y != 0.0:
			y = cell.top_y
	return Vector3(
		origin_xz.x + (float(coord.x) + 0.5) * TILE_SIZE,
		y,
		origin_xz.y + (float(coord.y) + 0.5) * TILE_SIZE,
	)

func world_to_cell(world_pos: Vector3) -> Vector2i:
	return Vector2i(
		int(floor((world_pos.x - origin_xz.x) / TILE_SIZE)),
		int(floor((world_pos.z - origin_xz.y) / TILE_SIZE)),
	)

func infer_missing_ground() -> void:
	var to_infer: Array = []
	for coord in cells:
		var c: Cell = cells[coord]
		if c.ground_y <= -1e9:
			to_infer.append(coord)
	for coord in to_infer:
		var c: Cell = cells[coord]
		var samples: Array = []
		for dx in range(-1, 2):
			for dz in range(-1, 2):
				if dx == 0 and dz == 0:
					continue
				var n := get_cell(coord + Vector2i(dx, dz))
				if n != null and n.ground_y > -1e9:
					samples.append(n.ground_y)
		if samples.size() >= 2:
			samples.sort()
			c.inferred_ground_y = samples[samples.size() / 2]

func find_spawn() -> Vector2i:
	if cells.is_empty():
		return Vector2i.ZERO
	var mode_y := _dominant_ground_y()
	var candidates: Array = []
	for coord in cells:
		if not is_walkable(coord):
			continue
		if is_encounter(coord):
			continue
		var c: Cell = cells[coord]
		var eff := get_effective_ground_y(c)
		if eff <= -1e9:
			continue
		if absf(eff - mode_y) <= GROUND_CLUSTER_TOLERANCE:
			candidates.append(coord)
	if candidates.is_empty():
		for coord in cells:
			if is_walkable(coord):
				return coord
		return Vector2i.ZERO
	var sum := Vector2.ZERO
	for coord in candidates:
		sum += Vector2(coord.x, coord.y)
	var center := sum / float(candidates.size())
	var best: Vector2i = candidates[0]
	var best_score := INF
	for coord in candidates:
		var d := Vector2(coord.x, coord.y).distance_to(center)
		if d < best_score:
			best_score = d
			best = coord
	return best

func _dominant_ground_y() -> float:
	var counts: Dictionary = {}
	for coord in cells:
		var c: Cell = cells[coord]
		if c.ground_y > -1e9:
			var key := snappedf(c.ground_y, 0.05)
			counts[key] = counts.get(key, 0) + 1
	var mode: float = 0.0
	var max_count := 0
	for k in counts:
		if counts[k] > max_count:
			max_count = counts[k]
			mode = k
	return mode

func size() -> int:
	return cells.size()
