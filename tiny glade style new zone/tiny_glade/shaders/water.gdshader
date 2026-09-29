// Pond water. Opaque on purpose so the Environment's screen-space reflections pick up the
// bridge arches, trees and sky. Depth comes from Blender (COLOR.r = water depth / 1.4 m),
// so shallow edges glow teal-brown and the middle falls off to deep slate blue.
shader_type spatial;
render_mode cull_back;

uniform vec3 shallow_color : source_color = vec3(0.42, 0.46, 0.4);
uniform vec3 mid_color : source_color = vec3(0.2, 0.25, 0.33);
uniform vec3 deep_color : source_color = vec3(0.1, 0.13, 0.22);
uniform vec3 shore_color : source_color = vec3(0.86, 0.9, 0.86);
uniform sampler2D ripple_a : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D ripple_b : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float ripple_strength = 0.35;
uniform float roughness = 0.05;
// xz = duck position, z = speed (0..1), w unused. Up to 4 ducks leave ring wakes.
uniform vec4 ducks[4];
// Player ripples: xy = centre (world xz), z = age in seconds, w = strength (0 = unused).
uniform vec4 ripples[8];
uniform float ripple_speed = 1.3;
uniform float ripple_life = 2.6;

varying vec3 v_world;
varying float v_depth;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_depth = COLOR.r;
}

void fragment() {
	vec2 p = v_world.xz;
	vec3 na = texture(ripple_a, p * 0.09 + vec2(TIME * 0.012, TIME * 0.007)).xyz * 2.0 - 1.0;
	vec3 nb = texture(ripple_b, p * 0.21 - vec2(TIME * 0.018, -TIME * 0.011)).xyz * 2.0 - 1.0;
	vec2 slope = (na.xy + nb.xy * 0.6) * ripple_strength * 0.25;
	// concentric wake rings around each duck
	for (int i = 0; i < 4; i++) {
		vec2 d = p - ducks[i].xy;
		float r = length(d);
		float fade = exp(-r * 1.6) * ducks[i].z;
		float wave = sin(r * 26.0 - TIME * 5.0);
		slope += (d / max(r, 1e-3)) * wave * fade * 0.35;
	}
	// expanding rings where the player wades: a travelling wave packet plus a soft
	// bright crest, both fading with age
	float crest = 0.0;
	for (int i = 0; i < 8; i++) {
		vec4 rp = ripples[i];
		if (rp.w <= 0.0) {
			continue;
		}
		vec2 d = p - rp.xy;
		float r = length(d);
		float front = 0.12 + rp.z * ripple_speed;
		float x = r - front;
		float packet = exp(-x * x * 18.0);
		float fade = rp.w * (1.0 - smoothstep(0.0, ripple_life, rp.z)) / (1.0 + front * 1.5);
		slope += (d / max(r, 1e-3)) * sin(x * 30.0) * packet * fade * 0.9;
		crest += exp(-x * x * 160.0) * fade;
	}
	vec3 n_world = normalize(vec3(-slope.x, 1.0, -slope.y));
	NORMAL = normalize((VIEW_MATRIX * vec4(n_world, 0.0)).xyz);

	float d = clamp(v_depth, 0.0, 1.0);
	vec3 c = mix(shallow_color, mid_color, smoothstep(0.0, 0.25, d));
	c = mix(c, deep_color, smoothstep(0.25, 0.85, d));
	// soft bright line where water meets the bank
	float shore = 1.0 - smoothstep(0.0, 0.05, d);
	shore *= 0.5 + 0.5 * sin(p.x * 3.0 + p.y * 2.0 + TIME * 1.3);
	c = mix(c, shore_color, shore * 0.35);
	c = mix(c, shore_color, clamp(crest * 0.7, 0.0, 0.6));
	ALBEDO = c;
	ROUGHNESS = roughness;
	METALLIC = 0.0;
	SPECULAR = 0.5;
}

