extends Node3D
## Tiny Glade style zone.
##
## Geometry, layout, camera and sun direction all come from Blender
## (blender/build_tiny_glade.py -> models/tiny_glade_geo.glb). This script:
##   * swaps the imported materials for the stylised shaders (by material name)
##   * scatters grass clumps + flowers over the terrain (MultiMesh, density from vertex colour)
##   * spawns the controllable player (WASD / arrows) with trimesh collision on the
##     terrain, bridge, castle, rocks and trunks, and a follow camera that keeps the
##     authored angle (so the tilt-shift focus stays on the player)
##   * water ripples: rings spawn at the player's feet while wading, plus duck wakes
##   * adds ambient particles: sun-lit pollen and falling autumn leaves
##
## Run with `-- --capture=/path/shot.png` to save a screenshot after warm-up and quit;
## add `--walk-test` to have the player walk into the pond first.

const DIR := "res://tiny_glade/"

@export var player_enabled := true
@export var player_spawn := Vector3(-3.0, 4.0, 11.0)
@export var camera_follow_speed := 3.0
## Follow-camera distance relative to the authored shot (DOF focus band scales with it).
@export var camera_distance_scale := 0.7
## grass clumps / flowers per square metre inside the scatter region
@export var grass_density := 24.0
@export var flower_density := 6.0
@export var grass_view_distance := 75.0
@export var camera_drift := true
@export var drift_amount := 0.6

# WalkCollision: invisible smooth slab over the bridge deck + both ramps (from Blender), so
# the noise-softened stone edges can't snag the player.
const COLLIDERS := ["Terrain", "Bridge", "BridgeRamps", "WalkCollision", "Castle", "CastleArch", "Rocks", "Rubble"]
const MAX_RIPPLES := 8
const RIPPLE_LIFE := 2.6

@onready var geo: Node3D = $Geo
@onready var cam: Camera3D = $Camera
@onready var sun: DirectionalLight3D = $Sun

var _mats := {}
var _water_mat: ShaderMaterial
var _ducks: Array = []        # [Node3D, center: Vector3, rx, rz, speed, phase]
var _cam_base: Transform3D
var _cam_target: Vector3
var _t := 0.0
var _capture_path := ""
var _walk_test := false
var _frames := 0
var _player: GladePlayer
var _cam_offset: Vector3
var _ripples: Array[Vector4] = []     # x, z, age, strength
var _ripple_timer := 0.0
var _was_in_water := false
var _water_level := -0.6


func _ready() -> void:
	get_viewport().mesh_lod_threshold = 0.0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--capture="):
			_capture_path = a.trim_prefix("--capture=")
		elif a == "--walk-test":
			_walk_test = true
	_build_materials()
	var terrain: MeshInstance3D = null
	for n in _all_children(geo):
		if n is MeshInstance3D:
			_apply_materials(n)
			if n.name == "Terrain":
				terrain = n
			elif n.name == "Water":
				_water_level = (n.global_transform * n.mesh.get_aabb().position).y
			if player_enabled and (n.name in COLLIDERS or n.name.begins_with("Trunk")):
				_add_collision(n)
		elif n is Camera3D:
			cam.global_transform = n.global_transform
			cam.fov = n.fov
			n.current = false
		elif n is Light3D:
			sun.global_basis = n.global_basis
			n.visible = false
	cam.make_current()
	_cam_base = cam.global_transform
	# where the authored camera ray meets the ground: the follow camera keeps this offset
	var fwd := -_cam_base.basis.z
	_cam_target = _cam_base.origin + fwd * (-_cam_base.origin.y / fwd.y)
	_cam_offset = _cam_base.origin - _cam_target
	if player_enabled:
		_cam_offset *= camera_distance_scale
		var attr := cam.attributes as CameraAttributesPractical
		if attr:
			attr = attr.duplicate()
			attr.dof_blur_far_distance *= camera_distance_scale
			attr.dof_blur_far_transition *= camera_distance_scale
			attr.dof_blur_near_distance *= camera_distance_scale
			attr.dof_blur_near_transition *= camera_distance_scale
			cam.attributes = attr
	if terrain:
		_scatter(terrain)
	_setup_critters()
	_add_particles()
	if player_enabled:
		_spawn_player()


# ---------------------------------------------------------------- player
func _add_collision(mi: MeshInstance3D) -> void:
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	shape.shape = mi.mesh.create_trimesh_shape()
	body.add_child(shape)
	mi.add_child(body)


func _spawn_player() -> void:
	_player = load(DIR + "glade_player.tscn").instantiate()
	_player.camera = cam
	_player.water_level = _water_level
	add_child(_player)
	_player.global_position = player_spawn


# ---------------------------------------------------------------- materials
func _shader_mat(shader: String, params := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(DIR + "shaders/" + shader + ".gdshader")
	for k in params:
		m.set_shader_parameter(k, params[k])
	return m


func _noise_normal(freq: float, seed_: int) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.frequency = freq
	n.seed = seed_
	n.fractal_octaves = 3
	var t := NoiseTexture2D.new()
	t.width = 512
	t.height = 512
	t.seamless = true
	t.as_normal_map = true
	t.bump_strength = 6.0
	t.noise = n
	return t


func _build_materials() -> void:
	_mats["TG_Terrain"] = _shader_mat("terrain")
	_water_mat = _shader_mat("water", {
		"ripple_a": _noise_normal(0.012, 3), "ripple_b": _noise_normal(0.03, 9)})
	_mats["TG_Water"] = _water_mat
	_mats["TG_Stone"] = _shader_mat("stone", {
		"stone_a": Color(0.9, 0.72, 0.5), "stone_b": Color(0.86, 0.54, 0.42),
		"stone_c": Color(0.66, 0.7, 0.48), "mortar_color": Color(0.7, 0.54, 0.42), "brick_size": Vector2(0.62, 0.3),
		"moss_height": -0.2, "wrap_light": 0.5})
	_mats["TG_CastleStone"] = _shader_mat("stone", {
		"stone_a": Color(0.92, 0.76, 0.56), "stone_b": Color(0.86, 0.58, 0.46), "mortar_softness": 0.75,
		"stone_c": Color(0.68, 0.72, 0.52), "mortar_color": Color(0.72, 0.58, 0.46), "brick_size": Vector2(0.6, 0.3), "wrap_light": 0.5,
		"moss_height": 1.3, "moss_fade": 1.2})
	_mats["TG_Cobble"] = _shader_mat("stone", {
		"stone_a": Color(0.84, 0.74, 0.62), "stone_b": Color(0.78, 0.64, 0.56), "stone_c_amount": 0.08,
		"mortar_color": Color(0.58, 0.54, 0.47), "brick_size": Vector2(0.3, 0.26),
		"mortar": 0.035, "roundness": 1.2, "moss_height": -5.0})
	_mats["TG_Roof"] = _shader_mat("roof", {"wrap_light": 0.45})
	var leaves := {"translucency": 1.1, "wrap_light": 0.45}
	leaves["leaf_tex"] = load(DIR + "textures/leaf_clump_a.png")
	_mats["TG_Leaves"] = _shader_mat("foliage", leaves)
	leaves["leaf_tex"] = load(DIR + "textures/leaf_clump_b.png")
	_mats["TG_LeavesB"] = _shader_mat("foliage", leaves)
	_mats["TG_Bark"] = _std(Color(0.22, 0.17, 0.14), 0.95)
	_mats["TG_Rock"] = _shader_mat("stone", {
		"stone_a": Color(0.56, 0.56, 0.57), "stone_b": Color(0.46, 0.46, 0.48), "stone_c_amount": 0.0,
		"mortar_color": Color(0.5, 0.5, 0.5), "brick_size": Vector2(4.0, 4.0), "moss_height": -0.1})


func _std(c: Color, rough: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m


func _apply_materials(mi: MeshInstance3D) -> void:
	if mi.mesh == null:
		return
	if mi.name == "WalkCollision":
		mi.visible = false   # physics only
		return
	for i in mi.mesh.get_surface_count():
		var m := mi.mesh.surface_get_material(i)
		if m and _mats.has(m.resource_name):
			mi.set_surface_override_material(i, _mats[m.resource_name])
	if mi.name == "Water" or mi.name.begins_with("Lily"):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


func _all_children(n: Node) -> Array:
	var out := []
	for c in n.get_children():
		out.append(c)
		out.append_array(_all_children(c))
	return out


# ---------------------------------------------------------------- grass + flowers
func _grass_clump_mesh() -> ArrayMesh:
	# 5 blades x (2 segments, 5 shared verts, 3 tris) = 25 verts / 15 tris per clump,
	# indexed. Cheap enough to carpet the whole play area.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var base := 0
	for b in 5:
		var a := rng.randf() * TAU
		var dir := Vector3(cos(a), 0, sin(a))
		var off := dir * rng.randf_range(0.0, 0.09)
		var lean := dir * rng.randf_range(0.06, 0.18)
		var h := rng.randf_range(0.22, 0.38)
		var w := rng.randf_range(0.03, 0.045)
		var side := Vector3(-sin(a + 1.2), 0, cos(a + 1.2))
		var n := side.cross(Vector3.UP).normalized()
		var mid := off + lean * 0.3 + Vector3(0, h * 0.5, 0)
		for v in [[off - side * w, 0.0], [off + side * w, 0.0], [mid - side * w * 0.55, 0.5],
				[mid + side * w * 0.55, 0.5], [off + lean + Vector3(0, h, 0), 1.0]]:
			st.set_normal(n)
			st.set_uv(Vector2(0.5, v[1]))
			st.add_vertex(v[0])
		for i in [0, 1, 3, 0, 3, 2, 2, 3, 4]:
			st.add_index(base + i)
		base += 5
	return st.commit()


func _flower_mesh() -> ArrayMesh:
	# a little five-petal disc on a stem, tinted per instance
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var top := Vector3(0, 0.13, 0)
	for k in 5:
		var a := k / 5.0 * TAU
		var c := top + Vector3(cos(a), 0.1, sin(a)) * 0.03
		var s := Vector3(-sin(a), 0, cos(a)) * 0.018
		for v in [top, c + s, c - s, c + s + (c - top) * 0.6, c - s, c + s]:
			st.set_normal(Vector3.UP)
			st.set_uv(Vector2(1, 1))
			st.add_vertex(v)
	var sw := Vector3(0.006, 0, 0)
	for v in [Vector3.ZERO - sw, Vector3.ZERO + sw, top, Vector3.ZERO + sw, top + sw * 0.5, top]:
		st.set_normal(Vector3(0, 0, 1))
		st.set_uv(Vector2(0, 0))
		st.add_vertex(v)
	return st.commit()


func _scatter(terrain: MeshInstance3D) -> void:
	var arr := terrain.mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var cols: PackedColorArray = arr[Mesh.ARRAY_COLOR] if arr[Mesh.ARRAY_COLOR] else PackedColorArray()
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var xf := terrain.global_transform
	for i in verts.size():
		verts[i] = xf * verts[i]
	# scatter over the walkable area plus a margin the camera can see around it
	var region := Rect2(-40.0, -42.0, 78.0, 72.0)
	if not player_enabled:
		region = Rect2(_cam_target.x - 30.0, _cam_target.z - 30.0, 60.0, 50.0)
	var tri_count := idx.size() / 3
	var cdf_grass := PackedFloat32Array()
	var cdf_flower := PackedFloat32Array()
	cdf_grass.resize(tri_count)
	cdf_flower.resize(tri_count)
	var acc_g := 0.0
	var acc_f := 0.0
	for t in tri_count:
		var a := verts[idx[t * 3]]
		var b := verts[idx[t * 3 + 1]]
		var c := verts[idx[t * 3 + 2]]
		var ctr := (a + b + c) / 3.0
		var wg := 0.0
		var wf := 0.0
		if region.has_point(Vector2(ctr.x, ctr.z)):
			var area := (b - a).cross(c - a).length() * 0.5
			var ca := cols[idx[t * 3]] if cols.size() else Color.WHITE
			wg = area * ca.r
			wf = area * ca.g
		acc_g += wg
		acc_f += wf
		cdf_grass[t] = acc_g
		cdf_flower[t] = acc_f

	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	# grass in 10 m chunks: each chunk frustum-culls on its own and fades out with distance
	var clump := _grass_clump_mesh()
	var gmat := _shader_mat("grass", {"translucency": 0.6, "wrap_light": 0.5})
	var all_grass := _make_multimesh(clump, int(acc_g * grass_density), true, false)
	_fill(all_grass, verts, idx, cdf_grass, acc_g, rng, Vector2(0.7, 1.35))
	var chunks := {}
	for i in all_grass.instance_count:
		var xf_i := all_grass.get_instance_transform(i)
		var key := Vector2i(floori(xf_i.origin.x / 10.0), floori(xf_i.origin.z / 10.0))
		if not chunks.has(key):
			chunks[key] = []
		chunks[key].append([xf_i, all_grass.get_instance_custom_data(i)])
	var grass_root := Node3D.new()
	grass_root.name = "Grass"
	add_child(grass_root)
	for key in chunks:
		var items: Array = chunks[key]
		var mm := _make_multimesh(clump, items.size(), true, false)
		for i in items.size():
			mm.set_instance_transform(i, items[i][0])
			mm.set_instance_custom_data(i, items[i][1])
		var gmi := MultiMeshInstance3D.new()
		gmi.multimesh = mm
		gmi.material_override = gmat
		gmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gmi.visibility_range_end = grass_view_distance
		gmi.visibility_range_end_margin = 10.0
		gmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		grass_root.add_child(gmi)

	var flower_count := int(acc_f * flower_density)
	var flowers := _make_multimesh(_flower_mesh(), flower_count, false, true)
	_fill(flowers, verts, idx, cdf_flower, acc_f, rng, Vector2(0.9, 1.6))
	var palette := [Color(0.55, 0.66, 1.0), Color(0.62, 0.62, 0.98), Color(0.97, 0.96, 0.92),
		Color(0.98, 0.7, 0.8), Color(0.97, 0.47, 0.3)]
	var weights := [0.42, 0.22, 0.16, 0.14, 0.06]
	for i in flower_count:
		var r := rng.randf()
		var k := 0
		while k < weights.size() - 1 and r > weights[k]:
			r -= weights[k]
			k += 1
		flowers.set_instance_color(i, palette[k])
	var fmat := StandardMaterial3D.new()
	fmat.vertex_color_use_as_albedo = true
	fmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	fmat.roughness = 1.0
	fmat.rim_enabled = true
	fmat.rim = 0.4
	var fmi := MultiMeshInstance3D.new()
	fmi.name = "Flowers"
	fmi.multimesh = flowers
	fmi.material_override = fmat
	fmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(fmi)


func _make_multimesh(mesh: Mesh, count: int, custom: bool, colors: bool) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = custom
	mm.use_colors = colors
	mm.mesh = mesh
	mm.instance_count = count
	return mm


func _fill(mm: MultiMesh, verts: PackedVector3Array, idx: PackedInt32Array,
		cdf: PackedFloat32Array, total: float, rng: RandomNumberGenerator, scale: Vector2) -> void:
	if total <= 0.0:
		mm.instance_count = 0
		return
	for i in mm.instance_count:
		var t := mini(cdf.bsearch(rng.randf() * total), cdf.size() - 1)
		var a := verts[idx[t * 3]]
		var b := verts[idx[t * 3 + 1]]
		var c := verts[idx[t * 3 + 2]]
		var u := rng.randf()
		var v := rng.randf()
		if u + v > 1.0:
			u = 1.0 - u
			v = 1.0 - v
		var p := a + (b - a) * u + (c - a) * v
		var s := rng.randf_range(scale.x, scale.y)
		var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.8, 1.2), s))
		mm.set_instance_transform(i, Transform3D(basis, p))
		if mm.use_custom_data:
			mm.set_instance_custom_data(i, Color(rng.randf(), 0, 0, 0))


# ---------------------------------------------------------------- critters
func _setup_critters() -> void:
	var i := 0
	while geo.find_child("Duck%d" % i, true, false):
		var d: Node3D = geo.find_child("Duck%d" % i, true, false)
		_ducks.append([d, d.global_position, 1.4 + i * 0.4, 0.9 + i * 0.3, 0.16 - i * 0.03, i * 2.1])
		i += 1


func _process(delta: float) -> void:
	_t += delta
	# ducks paddle on slow ellipses and push rings into the water shader
	var wakes: Array[Vector4] = [Vector4(), Vector4(), Vector4(), Vector4()]
	for k in _ducks.size():
		var d = _ducks[k]
		var a: float = d[5] + _t * d[4]
		var node: Node3D = d[0]
		var c: Vector3 = d[1]
		var off := Vector3(cos(a) * d[2] - d[2] * cos(d[5]), 0, sin(a) * d[3] - d[3] * sin(d[5]))
		node.global_position = c + off + Vector3(0, sin(_t * 2.3 + k) * 0.012, 0)
		var vel := Vector3(-sin(a) * d[2], 0, cos(a) * d[3])
		node.rotation.y = atan2(-vel.z, vel.x)
		if k < 4:
			wakes[k] = Vector4(node.global_position.x, node.global_position.z, 1.0, 0)
	_water_mat.set_shader_parameter("ducks", wakes)
	_update_ripples(delta)
	# follow camera: authored angle and distance, eased toward the player
	if _player:
		var goal := _player.global_position
		_cam_target = _cam_target.lerp(goal, 1.0 - exp(-camera_follow_speed * delta))
	var o := Vector3.ZERO
	if camera_drift:
		o = Vector3(sin(_t * 0.05) * 1.6, sin(_t * 0.037) * 0.5, sin(_t * 0.043) * 0.9) * drift_amount
	var cp := _cam_target + _cam_offset + o
	cam.global_transform = Transform3D(Basis.looking_at(_cam_target - cp, Vector3.UP), cp)
	if _capture_path != "":
		_frames += 1
		if _walk_test and _player:
			_player.scripted_input = Vector2(0.35, -1.0) if _frames < 95 else Vector2.ZERO
		if _frames == 150:
			get_viewport().get_texture().get_image().save_png(_capture_path)
			get_tree().quit()


# ---------------------------------------------------------------- water ripples
func _update_ripples(delta: float) -> void:
	for i in range(_ripples.size() - 1, -1, -1):
		_ripples[i].z += delta
		if _ripples[i].z > RIPPLE_LIFE:
			_ripples.remove_at(i)
	if _player:
		var wading := _player.in_water
		var pos := _player.global_position
		if wading and not _was_in_water:
			_add_ripple(pos, 1.4)            # the splash as you step in
		_ripple_timer -= delta
		if wading and _ripple_timer <= 0.0:
			var moving := _player.is_moving()
			_add_ripple(pos, 1.0 if moving else 0.45)
			_ripple_timer = 0.3 if moving else 1.3
		_was_in_water = wading
	var packed: Array[Vector4] = []
	for i in MAX_RIPPLES:
		packed.append(_ripples[i] if i < _ripples.size() else Vector4.ZERO)
	_water_mat.set_shader_parameter("ripples", packed)


func _add_ripple(pos: Vector3, strength: float) -> void:
	if _ripples.size() >= MAX_RIPPLES:
		_ripples.remove_at(0)
	_ripples.append(Vector4(pos.x, pos.z, 0.0, strength))


# ---------------------------------------------------------------- ambience
func _add_particles() -> void:
	# pollen / dust motes glinting in the low sun
	var pollen := GPUParticles3D.new()
	pollen.name = "Pollen"
	pollen.amount = 500
	pollen.lifetime = 12.0
	pollen.preprocess = 12.0
	pollen.visibility_aabb = AABB(Vector3(-40, -5, -40), Vector3(80, 20, 80))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(22, 3, 16)
	pm.gravity = Vector3(0.05, 0.02, 0)
	pm.initial_velocity_min = 0.05
	pm.initial_velocity_max = 0.2
	pm.direction = Vector3(1, 0.2, 0)
	pm.spread = 180
	pm.turbulence_enabled = true
	pm.turbulence_noise_strength = 0.6
	pm.turbulence_noise_scale = 4.0
	pm.scale_min = 0.5
	pm.scale_max = 1.2
	var fade := Gradient.new()
	fade.set_color(0, Color(1, 1, 1, 0))
	fade.set_color(1, Color(1, 1, 1, 0))
	fade.add_point(0.2, Color(1, 1, 1, 1))
	fade.add_point(0.8, Color(1, 1, 1, 1))
	var ft := GradientTexture1D.new()
	ft.gradient = fade
	pm.color_ramp = ft
	pollen.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.05, 0.05)
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	qm.vertex_color_use_as_albedo = true
	qm.albedo_color = Color(1.6, 1.4, 1.0)
	qm.albedo_texture = _soft_dot()
	q.material = qm
	pollen.draw_pass_1 = q
	pollen.position = Vector3(-2, 2.5, 0)
	add_child(pollen)

	# autumn leaves drifting down across the shot
	var leaves := GPUParticles3D.new()
	leaves.name = "FallingLeaves"
	leaves.amount = 70
	leaves.lifetime = 14.0
	leaves.preprocess = 14.0
	leaves.visibility_aabb = AABB(Vector3(-40, -15, -40), Vector3(80, 30, 80))
	var lm := ParticleProcessMaterial.new()
	lm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	lm.emission_box_extents = Vector3(22, 1, 16)
	lm.gravity = Vector3(0.25, -0.35, 0.1)
	lm.initial_velocity_max = 0.3
	lm.angular_velocity_min = -120
	lm.angular_velocity_max = 120
	lm.angle_max = 360
	lm.turbulence_enabled = true
	lm.turbulence_noise_strength = 1.2
	lm.scale_min = 0.8
	lm.scale_max = 1.3
	var lc := Gradient.new()
	lc.set_color(0, Color(0.93, 0.55, 0.25))
	lc.set_color(1, Color(0.85, 0.7, 0.3))
	lc.add_point(0.5, Color(0.75, 0.38, 0.2))
	var lct := GradientTexture1D.new()
	lct.gradient = lc
	lm.color_initial_ramp = lct
	leaves.process_material = lm
	var lq := QuadMesh.new()
	lq.size = Vector2(0.16, 0.16)
	var lqm := StandardMaterial3D.new()
	lqm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	lqm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	lqm.cull_mode = BaseMaterial3D.CULL_DISABLED
	lqm.vertex_color_use_as_albedo = true
	lqm.albedo_texture = load(DIR + "textures/leaf_single.png")
	lq.material = lqm
	leaves.draw_pass_1 = lq
	leaves.position = Vector3(2, 9, -2)
	add_child(leaves)


func _soft_dot() -> GradientTexture2D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 32
	t.height = 32
	return t
