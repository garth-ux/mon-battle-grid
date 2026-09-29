// Tree canopies: alpha-cut leaf-clump cards. Blender bakes a spherical custom normal
// per vertex (so each crown lights like one soft ball) and a tint + occlusion into COLOR.
shader_type spatial;
render_mode world_vertex_coords, cull_disabled, specular_disabled;

#include "res://tiny_glade/shaders/tg_common.gdshaderinc"

uniform sampler2D leaf_tex : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform float alpha_cut : hint_range(0.0, 1.0) = 0.45;
uniform float sway_strength = 0.1;
uniform float flutter_strength = 0.04;
uniform float saturation = 1.08;

void vertex() {
	float t = TIME;
	vec3 p = VERTEX;
	// whole crown sways slowly, individual cards flutter
	float sway = sin(t * 0.9 + p.x * 0.15 + p.z * 0.1) + 0.5 * sin(t * 1.7 + p.z * 0.3);
	float height = max(p.y, 0.0);
	VERTEX.x += sway * sway_strength * height * 0.12;
	VERTEX.z += sway * sway_strength * height * 0.06;
	VERTEX += vec3(sin(t * 4.1 + p.y * 3.0 + p.x * 2.0), sin(t * 3.3 + p.x * 2.7), cos(t * 3.7 + p.z * 2.3)) * flutter_strength;
	v_world = VERTEX;
}

void fragment() {
	vec4 tex = texture(leaf_tex, UV);
	vec3 c = tex.rgb * COLOR.rgb;
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	ALBEDO = mix(vec3(l), c, saturation);
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cut;
	ALPHA_ANTIALIASING_EDGE = 0.3;
	ALPHA_TEXTURE_COORDINATE = UV * vec2(textureSize(leaf_tex, 0));
	ROUGHNESS = 1.0;
	// cards are double sided but the whole crown shares one smooth outward normal
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
}
