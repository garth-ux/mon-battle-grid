class_name GridDiagnostic

const NEIGHBOR_OFFSETS := [
	Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1),
	Vector2i(-1, 0),                   Vector2i(1, 0),
	Vector2i(-1, 1),  Vector2i(0, 1),  Vector2i(1, 1),
]

static func dump(root: Node, grid: TileGrid, focus_cell: Vector2i) -> void:
	print("\n========== GLB DIAGNOSTIC ==========")
	_dump_mesh_summary(root)
	_dump_ground_y_histogram(grid)
	_dump_focus_cell(root, grid, focus_cell)
	for offset in NEIGHBOR_OFFSETS:
		_dump_focus_cell(root, grid, focus_cell + offset)
	print("========== END DIAGNOSTIC ==========\n")

static func _dump_mesh_summary(root: Node) -> void:
	print("\n-- MeshInstance3D summary --")
	var stack: Array[Node] = [root]
	var total_tris := 0
	var mi_count := 0
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D
			if mi.mesh != null:
				mi_count += 1
				var surf_count := mi.mesh.get_surface_count()
				var tri_count := 0
				var mat_names: Array = []
				for s in surf_count:
					var mat := mi.get_active_material(s)
					var mat_name: String = mat.resource_name if mat != null else "<null>"
					if mat_name.is_empty():
						mat_name = "<unnamed>"
					mat_names.append(mat_name)
					var arrays := mi.mesh.surface_get_arrays(s)
					var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
					var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
					var tc: int = indices.size() / 3 if not indices.is_empty() else verts.size() / 3
					tri_count += tc
				total_tris += tri_count
				var aabb := mi.get_aabb()
				print("  [%d] '%s'  surfaces=%d  tris=%d  aabb=%s  mats=%s" % [
					mi_count, mi.name, surf_count, tri_count, aabb, mat_names
				])
		for child in n.get_children():
			stack.push_back(child)
	print("-- total: %d MeshInstance3Ds, %d triangles --" % [mi_count, total_tris])

static func _dump_ground_y_histogram(grid: TileGrid) -> void:
	print("\n-- ground_y histogram (cells with ground_y set) --")
	var buckets: Dictionary = {}
	var unset := 0
	for coord in grid.cells:
		var c := grid.cells[coord] as TileGrid.Cell
		if c.ground_y <= -1e9:
			unset += 1
			continue
		var key := snappedf(c.ground_y, 0.05)
		buckets[key] = buckets.get(key, 0) + 1
	var sorted_keys := buckets.keys()
	sorted_keys.sort()
	for k in sorted_keys:
		print("  ground_y ~ %.2f : %d cells" % [k, buckets[k]])
	print("  (unset: %d cells)" % unset)

static func _dump_focus_cell(root: Node, grid: TileGrid, coord: Vector2i) -> void:
	var cell := grid.get_cell(coord)
	if cell == null:
		print("\n-- cell %s: NOT IN GRID --" % [coord])
		return
	print("\n-- cell %s --" % [coord])
	print("  kind=%s top_y=%.3f ground_y=%.3f abs_top_y=%.3f" % [
		TileType.kind_name(cell.kind),
		cell.top_y,
		cell.ground_y,
		cell.absolute_top_y,
	])
	print("  flags: encounter=%s tree=%s wall=%s water=%s" % [
		cell.has_encounter_grass, cell.has_tree, cell.has_wall, cell.has_water
	])
	print("  walkable=%s" % grid.is_walkable(coord))
	var world_x := grid.origin_xz.x + (float(coord.x) + 0.5) * TileGrid.TILE_SIZE
	var world_z := grid.origin_xz.y + (float(coord.y) + 0.5) * TileGrid.TILE_SIZE
	var cell_min_x := world_x - 0.5
	var cell_max_x := world_x + 0.5
	var cell_min_z := world_z - 0.5
	var cell_max_z := world_z + 0.5
	print("  world XZ ~ (%.2f, %.2f), cell bounds X[%.2f,%.2f] Z[%.2f,%.2f]" % [
		world_x, world_z, cell_min_x, cell_max_x, cell_min_z, cell_max_z
	])

	var tris: Array = _triangles_in_cell(root, cell_min_x, cell_max_x, cell_min_z, cell_max_z)
	print("  triangles in cell (centroid intersect): %d" % tris.size())
	tris.sort_custom(func(a, b): return a.center.y > b.center.y)
	var print_limit := mini(tris.size(), 12)
	for i in print_limit:
		var t = tris[i]
		print("    Y=%.3f  normal.y=%.2f  edges=%.2f/%.2f/%.2f  kind=%s  surf='%s'" % [
			t.center.y, t.normal.y, t.e0, t.e1, t.e2, TileType.kind_name(t.kind), t.surface_name
		])
	if tris.size() > print_limit:
		print("    ... (%d more)" % (tris.size() - print_limit))

static func _triangles_in_cell(root: Node, min_x: float, max_x: float, min_z: float, max_z: float) -> Array:
	var fingerprint_to_index := _build_fp_map()
	var material_kind_cache: Dictionary = {}
	var out: Array = []
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n is MeshInstance3D:
			var mi := n as MeshInstance3D
			if mi.mesh != null:
				_extract_for_cell(mi, min_x, max_x, min_z, max_z, fingerprint_to_index, material_kind_cache, out)
		for child in n.get_children():
			stack.push_back(child)
	return out

static func _extract_for_cell(mi: MeshInstance3D, min_x: float, max_x: float, min_z: float, max_z: float, fp_map: Dictionary, cache: Dictionary, out: Array) -> void:
	var mesh := mi.mesh
	var xform := mi.global_transform
	for surface_idx in mesh.get_surface_count():
		var mat := mi.get_active_material(surface_idx)
		var kind := _kind_for_material(mat, fp_map, cache)
		var mat_name: String = mat.resource_name if mat != null else "<null>"
		var arrays := mesh.surface_get_arrays(surface_idx)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		if verts.is_empty():
			continue
		var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var indexed: bool = not indices.is_empty()
		var tri_count: int = indices.size() / 3 if indexed else verts.size() / 3
		for tri_i in tri_count:
			var i0: int = indices[tri_i * 3] if indexed else tri_i * 3
			var i1: int = indices[tri_i * 3 + 1] if indexed else tri_i * 3 + 1
			var i2: int = indices[tri_i * 3 + 2] if indexed else tri_i * 3 + 2
			var v0 := xform * verts[i0]
			var v1 := xform * verts[i1]
			var v2 := xform * verts[i2]
			var center := (v0 + v1 + v2) / 3.0
			if center.x < min_x or center.x >= max_x or center.z < min_z or center.z >= max_z:
				continue
			var e0v := v1 - v0
			var e1v := v2 - v0
			var e2v := v2 - v1
			var normal := e0v.cross(e1v)
			var nlen := normal.length()
			if nlen > 0.00001:
				normal /= nlen
			out.append({
				"center": center,
				"normal": normal,
				"kind": kind,
				"surface_name": "%s#%d" % [mat_name, surface_idx],
				"e0": e0v.length(),
				"e1": e1v.length(),
				"e2": e2v.length(),
			})

static func _build_fp_map() -> Dictionary:
	var out: Dictionary = {}
	for i in GridBuilder.TILE_REF_PNGS.size():
		var path: String = GridBuilder.TILE_REF_PNGS[i]
		var tex := load(path) as Texture2D
		if tex == null:
			continue
		var fp := _fingerprint(tex)
		if fp != 0:
			out[fp] = i
	return out

static func _kind_for_material(mat: Material, fp_map: Dictionary, cache: Dictionary) -> int:
	if mat == null:
		return TileType.Kind.UNKNOWN
	if cache.has(mat):
		return cache[mat]
	var tex: Texture2D = null
	if mat is BaseMaterial3D:
		tex = (mat as BaseMaterial3D).albedo_texture
	var kind: int = TileType.Kind.UNKNOWN
	if tex != null:
		var fp := _fingerprint(tex)
		var idx: int = fp_map.get(fp, -1)
		kind = TileType.TEXTURE_INDEX_TO_KIND.get(idx, TileType.Kind.UNKNOWN)
	cache[mat] = kind
	return kind

static func _fingerprint(tex: Texture2D) -> int:
	var img := tex.get_image()
	if img == null:
		return 0
	if img.is_compressed():
		img.decompress()
	img.convert(Image.FORMAT_RGBA8)
	return hash(img.get_data())
