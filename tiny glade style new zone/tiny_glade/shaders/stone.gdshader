// Procedural world-space masonry (bridge, castle walls, cobbles, rocks), painted to read
// like watercolour: soft bleeding mortar, broad warm/cool pigment washes, pigment pooling
// at stone edges and a fine paper grain. Each stone is bump-mapped as a soft pillow
// (surface-gradient bump, no UVs/tangents needed). Triplanar, so meshes need no UVs.
// The wobbly silhouettes themselves come from the Blender remesh + noise pass.
shader_type spatial;
render_mode specular_disabled;

#include "res://tiny_glade/shaders/tg_common.gdshaderinc"

uniform vec3 stone_a : source_color = vec3(0.84, 0.74, 0.58);
uniform vec3 stone_b : source_color = vec3(0.76, 0.64, 0.5);
uniform vec3 stone_c : source_color = vec3(0.66, 0.68, 0.5);
uniform float stone_c_amount : hint_range(0.0, 1.0) = 0.16;
uniform float bump_strength = 0.035;
uniform vec3 mortar_color : source_color = vec3(0.66, 0.56, 0.44);
uniform vec3 moss_color : source_color = vec3(0.42, 0.52, 0.32);
uniform vec3 warm_wash : source_color = vec3(0.93, 0.72, 0.52);
uniform vec3 cool_wash : source_color = vec3(0.68, 0.72, 0.8);
uniform vec2 brick_size = vec2(0.55, 0.27);
uniform float mortar = 0.03;
uniform float roundness = 0.8;
uniform float mortar_softness : hint_range(0.0, 1.0) = 0.55;
uniform float wash_strength : hint_range(0.0, 1.0) = 0.45;
uniform float edge_pooling : hint_range(0.0, 1.0) = 0.35;
uniform float moss_height = 0.4;
uniform float moss_fade = 0.9;

varying vec3 v_wnormal;

// x = stone face mask (0 mortar..1 face), y = per-stone random, z = distance-to-edge ramp
vec3 bricks(vec2 p) {
	// slightly wobbly courses so it reads hand-laid, not tiled
	p += vec2(tg_noise(p * 1.7), tg_noise(p * 1.7 + 11.0)) * 0.05;
	vec2 q = p / brick_size;
	float row = floor(q.y);
	q.x += 0.5 * mod(row, 2.0) + tg_hash(vec2(row, 3.1)) * 0.35;
	vec2 id = floor(q);
	vec2 f = fract(q);
	vec2 e = min(f, 1.0 - f) * brick_size;
	float edge = min(e.x, e.y);
	float m = smoothstep(mortar * 0.3, mortar * (1.0 + roundness * 3.0), edge);
	return vec3(m, tg_hash(id), smoothstep(0.0, mortar * 6.0, edge));
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_wnormal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec3 w = pow(abs(v_wnormal), vec3(4.0));
	w /= (w.x + w.y + w.z);
	vec3 bx = bricks(v_world.zy);
	vec3 bz = bricks(v_world.xy);
	vec3 by = bricks(v_world.xz * vec2(1.0, 1.9));
	vec3 b = bx * w.x + by * w.y + bz * w.z;

	// per-stone tone: honey <-> rose, with the odd sage-green stone
	vec3 stone = mix(stone_a, stone_b, smoothstep(0.3, 0.85, b.y));
	stone = mix(stone, stone_c, step(1.0 - stone_c_amount, fract(b.y * 7.31)) * 0.85);
	// pigment pools toward each stone's edge, like a dried watercolour wash
	stone *= mix(1.0 - 0.14 * edge_pooling, 1.0, b.z);
	// bleeding mortar: mostly a darker tint of the stone rather than a hard line
	vec3 mort = mix(mortar_color, stone * 0.86, mortar_softness);
	vec3 c = mix(mort, stone, b.x);

	// broad, soft warm/cool washes that ignore the stone pattern
	vec2 wp = v_world.xz * 0.35 + vec2(v_world.y * 0.45, -v_world.y * 0.2);
	float wash1 = tg_fbm(wp);
	float wash2 = tg_fbm(wp * 0.6 + 23.0);
	c = mix(c, c * warm_wash * 1.25, smoothstep(0.45, 0.75, wash1) * wash_strength);
	c = mix(c, c * cool_wash * 1.25, smoothstep(0.5, 0.8, wash2) * wash_strength * 0.8);
	// paper grain
	c *= 0.96 + 0.08 * tg_noise(v_world.xz * 40.0 + v_world.y * 37.0);

	// damp moss creeping up from the ground / water
	float n = tg_noise(v_world.xz * 1.3 + v_world.y);
	float moss = 1.0 - smoothstep(moss_height - 0.3, moss_height + moss_fade, v_world.y + n * 0.6);
	c = mix(c, moss_color * (0.85 + 0.25 * n), moss * 0.65);
	ALBEDO = c;
	ROUGHNESS = 1.0;

	// pillowed stones: height rises from the mortar to each stone's centre, each stone
	// tilted a little differently, plus a fine chisel noise
	float h = b.z * 0.7 + (b.y - 0.5) * 0.25 * b.x + tg_noise(v_world.xz * 9.0 + v_world.y * 7.0) * 0.12;
	h *= bump_strength;
	vec3 dpdx = dFdx(VERTEX);
	vec3 dpdy = dFdy(VERTEX);
	vec3 r1 = cross(dpdy, NORMAL);
	vec3 r2 = cross(NORMAL, dpdx);
	float det = dot(dpdx, r1);
	vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
	NORMAL = normalize(abs(det) * NORMAL - grad);
	AO = mix(0.8, 1.0, b.x);
	AO_LIGHT_AFFECT = 0.2;
}
