// Meadow ground. Vertex colour from Blender: R grass density, G flower density, B dirt / wet bank.
shader_type spatial;
render_mode specular_disabled;

#include "res://tiny_glade/shaders/tg_common.gdshaderinc"

uniform float water_level = -0.6;
uniform vec3 dirt_color : source_color = vec3(0.47, 0.38, 0.28);
uniform vec3 mud_color : source_color = vec3(0.24, 0.24, 0.2);
uniform float speckle_density : hint_range(0.0, 1.0) = 0.55;

varying vec4 v_col;

vec3 flower_speckles(vec2 xz, float amount, inout float hit) {
	// tiny painted dots for distant flowers (the MultiMesh covers the near ones)
	vec2 cell = floor(xz * 6.0);
	vec2 f = fract(xz * 6.0) - 0.5;
	float h = tg_hash(cell);
	vec2 off = vec2(tg_hash(cell + 7.1), tg_hash(cell + 3.3)) - 0.5;
	float d = length(f - off * 0.6);
	hit = step(1.0 - amount * speckle_density, h) * (1.0 - smoothstep(0.08, 0.14, d));
	float k = fract(h * 13.7);
	vec3 c = k < 0.45 ? vec3(0.55, 0.64, 1.0) : k < 0.75 ? vec3(0.97, 0.96, 0.92) : k < 0.92 ? vec3(0.98, 0.68, 0.78) : vec3(0.96, 0.45, 0.3);
	return tg_srgb(c);
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_col = COLOR;
}

void fragment() {
	vec3 g = tg_grass_color(v_world.xz);
	// grass is a touch darker where blades are sparse (it reads as "under" the grass)
	g *= mix(0.78, 1.0, v_col.r);
	float dn = tg_noise(v_world.xz * 1.7);
	vec3 dirt = dirt_color * (0.85 + 0.3 * dn);
	vec3 c = mix(g, dirt, smoothstep(0.25, 0.8, v_col.b));
	// wet mud below the waterline
	c = mix(c, mud_color, smoothstep(water_level + 0.15, water_level - 0.25, v_world.y));
	float hit;
	vec3 fl = flower_speckles(v_world.xz, v_col.g, hit);
	c = mix(c, fl, hit);
	ALBEDO = c;
	ROUGHNESS = 1.0;
}
