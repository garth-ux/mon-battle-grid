// Grass clumps (MultiMesh). UV.y = 0 at the root, 1 at the tip.
shader_type spatial;
render_mode world_vertex_coords, cull_disabled, specular_disabled;

#include "res://tiny_glade/shaders/tg_common.gdshaderinc"

uniform vec2 wind_dir = vec2(0.8, 0.35);
uniform float wind_strength = 0.12;
uniform vec3 tip_color : source_color = vec3(0.78, 0.78, 0.44);

varying float v_h;
varying vec3 v_root;
varying float v_rand;
varying vec3 v_base;

void vertex() {
	v_root = MODEL_MATRIX[3].xyz;
	v_rand = INSTANCE_CUSTOM.x;
	v_base = tg_grass_color(v_root.xz); // per-vertex: 25 evaluations per clump, not per pixel
	float h = UV.y;
	float gust = tg_noise(VERTEX.xz * 0.12 + wind_dir * TIME * 0.6);
	float sway = sin(TIME * 2.1 + VERTEX.x * 0.6 + VERTEX.z * 0.4) * 0.35 + gust;
	VERTEX.xz += normalize(wind_dir) * sway * wind_strength * h * h;
	VERTEX.y -= abs(sway) * wind_strength * 0.3 * h * h;
	v_world = VERTEX;
	v_h = h;
	// soft, ground-like shading: normals lean up
	NORMAL = normalize(mix(NORMAL, vec3(0.0, 1.0, 0.0), 0.75));
}

void fragment() {
	vec3 base = v_base;
	float r = v_rand;
	vec3 tip = mix(base * 1.2, tip_color, 0.35 + 0.35 * r);
	vec3 c = mix(base, tip, smoothstep(0.2, 1.0, v_h));
	c *= mix(0.62, 1.0, pow(v_h, 0.6)); // occlusion at the root
	ALBEDO = c;
	ROUGHNESS = 1.0;
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
}
