class_name GridBuilder

const TILE_REF_PNGS := [
	"res://BlockTile_1781894212_0.png",
	"res://BlockTile_1781894212_1.png",
	"res://BlockTile_1781894212_2.png",
	"res://BlockTile_1781894212_3.png",
	"res://BlockTile_1781894212_4.png",
	"res://BlockTile_1781894212_5.png",
	"res://BlockTile_1781894212_6.png",
	"res://BlockTile_1781894212_7.png",
	"res://BlockTile_1781894212_8.png",
	"res://BlockTile_1781894212_9.png",
	"res://BlockTile_1781894212_10.png",
	"res://BlockTile_1781894212_11.png",
	# Zone 2 (BlockTile_1783783028) — indices 12-16 in TileType's map.
	"res://BlockTile_1783783028_0.png",
	"res://BlockTile_1783783028_1.png",
	"res://BlockTile_1783783028_2.png",
	"res://BlockTile_1783783028_3.png",
	"res://BlockTile_1783783028_4.png",
	# Zone 3 (BlockTile_1786792549, garden town) — indices 17-37.
	"res://BlockTile_1786792549_0.png",
	"res://BlockTile_1786792549_1.png",
	"res://BlockTile_1786792549_2.png",
	"res://BlockTile_1786792549_3.png",
	"res://BlockTile_1786792549_4.png",
	"res://BlockTile_1786792549_5.png",
	"res://BlockTile_1786792549_6.png",
	"res://BlockTile_1786792549_7.png",
	"res://BlockTile_1786792549_8.png",
	"res://BlockTile_1786792549_9.png",
	"res://BlockTile_1786792549_10.png",
	"res://BlockTile_1786792549_11.png",
	"res://BlockTile_1786792549_12.png",
	"res://BlockTile_1786792549_13.png",
	"res://BlockTile_1786792549_14.png",
	"res://BlockTile_1786792549_15.png",
	"res://BlockTile_1786792549_16.png",
	"res://BlockTile_1786792549_17.png",
	"res://BlockTile_1786792549_18.png",
	"res://BlockTile_1786792549_19.png",
	"res://BlockTile_1786792549_20.png",
	# Zone 4 (BlockTile_1787352578, stone room) — indices 38-40. Zone 4 REUSES
	# zone 3's texture palette (16 of its 19 PNGs are byte-identical dupes), so
	# only its 3 UNIQUE brick-floor textures are referenced here — the dupes
	# fingerprint to the zone-3 indices and inherit those kinds. (Adding the
	# dupes would override zone-3 kinds, since the map keeps the highest index.)
	# The room's floor + walls are largely the untextured default material,
	# classified by orientation in _extract_mesh_triangles.
	"res://BlockTile_1787352578_16.png",
	"res://BlockTile_1787352578_17.png",
	"res://BlockTile_1787352578_18.png",
]

const UP_NORMAL_THRESHOLD := 0.85
const MAX_TOP_TRI_EDGE := 2.0

static func build_from_node(root: Node) -> TileGrid:
	var fingerprint_to_index := _build_reference_fingerprints()
	var material_kind_cache: Dictionary = {}
	var triangles := _collect_triangles(root, fingerprint_to_index, material_kind_cache)
	if triangles.is_empty():
		return TileGrid.new()

	var min_x := INF
	var min_z := INF
	for t in triangles:
		var c: Vector3 = t.center
		min_x = minf(min_x, c.x)
		min_z = minf(min_z, c.z)

	var grid := TileGrid.new()
	grid.origin_xz = Vector2(min_x, min_z)

	for t in triangles:
		var c: Vector3 = t.center
		var kind: int = t.kind
		var coord := Vector2i(
			int(floor((c.x - min_x) / TileGrid.TILE_SIZE)),
			int(floor((c.z - min_z) / TileGrid.TILE_SIZE)),
		)
		var cell: TileGrid.Cell = grid.cells.get(coord, null)
		if cell == null:
			cell = TileGrid.Cell.new()
			grid.cells[coord] = cell
		if c.y > cell.absolute_top_y:
			cell.absolute_top_y = c.y
		match kind:
			TileType.Kind.ENCOUNTER_GRASS:
				cell.has_encounter_grass = true
			TileType.Kind.TREE:
				cell.has_tree = true
			TileType.Kind.WALL, TileType.Kind.CLIFF_EDGE:
				cell.has_wall = true
			TileType.Kind.WATER:
				cell.has_water = true
		if t.is_top:
			if c.y > cell.top_y + 0.01 or cell.kind == TileType.Kind.UNKNOWN:
				cell.kind = kind
				cell.top_y = c.y
			if _is_ground_kind(kind) and c.y > cell.ground_y:
				cell.ground_y = c.y

	grid.infer_missing_ground()
	_log_kind_summary(grid)
	return grid

static func _is_ground_kind(kind: int) -> bool:
	match kind:
		TileType.Kind.FLOOR, TileType.Kind.ENCOUNTER_GRASS, TileType.Kind.DECORATION, \
		TileType.Kind.PORTAL_ZONE2, TileType.Kind.PORTAL_ZONE1:
			return true
	return false

static func _build_reference_fingerprints() -> Dictionary:
	var out: Dictionary = {}
	for i in TILE_REF_PNGS.size():
		var path: String = TILE_REF_PNGS[i]
		var tex := load(path) as Texture2D
		if tex == null:
			push_warning("GridBuilder: missing reference texture %s" % path)
			continue
		var fp := _fingerprint_texture(tex)
		if fp != 0:
			out[fp] = i
	return out

static func _collect_triangles(root: Node, fingerprint_to_index: Dictionary, material_kind_cache: Dictionary) -> Array:
	var out: Array = []
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n is MeshInstance3D:
			_extract_mesh_triangles(n as MeshInstance3D, out, fingerprint_to_index, material_kind_cache)
		for child in n.get_children():
			stack.push_back(child)
	return out

static func _extract_mesh_triangles(mi: MeshInstance3D, out: Array, fingerprint_to_index: Dictionary, material_kind_cache: Dictionary) -> void:
	var mesh := mi.mesh
	if mesh == null:
		return
	var xform := mi.global_transform
	for surface_idx in mesh.get_surface_count():
		var mat := mi.get_active_material(surface_idx)
		var kind := _kind_for_material(mat, fingerprint_to_index, material_kind_cache)
		# Some BlockTile rooms (zone 4) render their floor + walls with an
		# UNtextured default material — no texture to fingerprint. Classify
		# those faces by orientation instead: a horizontal top is FLOOR you can
		# stand on, a vertical face is WALL. Only kicks in when the material
		# genuinely has no albedo texture, so textured zones are untouched.
		var untextured := mat != null and _albedo_texture_of(mat) == null
		var arrays := mesh.surface_get_arrays(surface_idx)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		if verts.is_empty():
			continue
		var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var indexed: bool = not indices.is_empty()
		var tri_count: int = indices.size() / 3 if indexed else verts.size() / 3
		for tri_i in tri_count:
			var i0: int
			var i1: int
			var i2: int
			if indexed:
				i0 = indices[tri_i * 3]
				i1 = indices[tri_i * 3 + 1]
				i2 = indices[tri_i * 3 + 2]
			else:
				i0 = tri_i * 3
				i1 = tri_i * 3 + 1
				i2 = tri_i * 3 + 2
			var v0 := xform * verts[i0]
			var v1 := xform * verts[i1]
			var v2 := xform * verts[i2]
			var e0 := v1 - v0
			var e1 := v2 - v0
			var e2 := v2 - v1
			var max_edge: float = maxf(e0.length(), maxf(e1.length(), e2.length()))
			var normal := e0.cross(e1)
			var nlen := normal.length()
			var is_top := false
			var ny_abs := 0.0
			if nlen >= 0.00001:
				normal /= nlen
				ny_abs = absf(normal.y)
				if max_edge <= MAX_TOP_TRI_EDGE:
					is_top = ny_abs >= UP_NORMAL_THRESHOLD
			var tri_kind := kind
			if untextured:
				# Up-facing horizontal = a floor you stand on; a ceiling (normal
				# pointing down) is NOT walkable ground, so require normal.y > 0.
				if is_top and normal.y > 0.0:
					tri_kind = TileType.Kind.FLOOR
				elif ny_abs < 0.5:
					tri_kind = TileType.Kind.WALL
			out.append({
				"center": (v0 + v1 + v2) / 3.0,
				"kind": tri_kind,
				"is_top": is_top,
			})

static func _kind_for_material(mat: Material, fingerprint_to_index: Dictionary, cache: Dictionary) -> int:
	if mat == null:
		return TileType.Kind.UNKNOWN
	if cache.has(mat):
		return cache[mat]
	var tex := _albedo_texture_of(mat)
	var kind: int = TileType.Kind.UNKNOWN
	var idx := -1
	if tex != null:
		var fp := _fingerprint_texture(tex)
		idx = fingerprint_to_index.get(fp, -1)
		kind = TileType.TEXTURE_INDEX_TO_KIND.get(idx, TileType.Kind.UNKNOWN)
	var mat_name: String = mat.resource_name if not mat.resource_name.is_empty() else "<unnamed>"
	print("  material '%s' -> PNG _%d -> %s" % [mat_name, idx, TileType.kind_name(kind)])
	cache[mat] = kind
	return kind

static func _albedo_texture_of(mat: Material) -> Texture2D:
	if mat is BaseMaterial3D:
		return (mat as BaseMaterial3D).albedo_texture
	return null

static func _fingerprint_texture(tex: Texture2D) -> int:
	var img := tex.get_image()
	if img == null:
		return 0
	if img.is_compressed():
		img.decompress()
	img.convert(Image.FORMAT_RGBA8)
	return hash(img.get_data())

static func _log_kind_summary(grid: TileGrid) -> void:
	var counts: Dictionary = {}
	var encounter_cells := 0
	var tree_cells := 0
	var wall_cells := 0
	var water_cells := 0
	for coord in grid.cells:
		var c := grid.cells[coord] as TileGrid.Cell
		counts[c.kind] = counts.get(c.kind, 0) + 1
		if c.has_encounter_grass:
			encounter_cells += 1
		if c.has_tree:
			tree_cells += 1
		if c.has_wall:
			wall_cells += 1
		if c.has_water:
			water_cells += 1
	var parts: PackedStringArray = []
	for k in counts:
		parts.append("%s=%d" % [TileType.kind_name(k), counts[k]])
	parts.append("encounter=%d tree=%d wall=%d water=%d" % [encounter_cells, tree_cells, wall_cells, water_cells])
	print("TileGrid: ", ", ".join(parts))
