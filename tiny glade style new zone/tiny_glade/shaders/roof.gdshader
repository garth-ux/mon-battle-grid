// Terracotta shingles for the conical tower roofs (rows by height, columns by angle
// around the roof's own origin).
shader_type spatial;
render_mode specular_disabled;

#include "res://tiny_glade/shaders/tg_common.gdshaderinc"

uniform vec3 tile_a : source_color = vec3(0.74, 0.43, 0.24);
uniform vec3 tile_b : source_color = vec3(0.6, 0.32, 0.18);
uniform float row_height = 0.2;
uniform float columns = 34.0;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 rel = v_world - NODE_POSITION_WORLD;
	float ang = atan(rel.z, rel.x) / TAU + 0.5;
	float row = floor(rel.y / row_height);
	float col = ang * columns + 0.5 * mod(row, 2.0);
	float fy = fract(rel.y / row_height);
	float fx = fract(col);
	// scalloped shingle bottoms
	float scallop = fy - 0.25 * (1.0 - pow(abs(fx * 2.0 - 1.0), 2.0));
	float shade = smoothstep(-0.2, 0.5, scallop);
	vec3 c = mix(tile_a, tile_b, tg_hash(vec2(floor(col), row)));
	c *= mix(0.8, 1.02, shade);
	// soft watercolour washes + sun-bleached patches
	c = mix(c, c * vec3(1.1, 0.92, 0.85), smoothstep(0.4, 0.75, tg_fbm(v_world.xz * 0.8 + rel.y * 0.5)) * 0.5);
	c = mix(c, tg_srgb(vec3(0.85, 0.66, 0.46)), 0.25 * smoothstep(0.3, 0.9, tg_noise(v_world.xz * 4.0 + rel.y)));
	ALBEDO = c;
	ROUGHNESS = 0.85;
}
