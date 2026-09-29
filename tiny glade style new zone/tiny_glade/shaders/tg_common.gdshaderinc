// Shared bits for the Tiny Glade zone shaders:
//   * value-noise helpers
//   * the meadow palette (terrain + grass share it so blades melt into the ground)
//   * drifting cloud shadows
//   * a soft "painterly" light(): wrapped lambert + back-lit translucency, no specular
// Every shader that includes this must write v_world in vertex().

varying vec3 v_world;

uniform float wrap_light : hint_range(0.0, 1.0) = 0.3;
uniform float translucency : hint_range(0.0, 3.0) = 0.0;
uniform float cloud_shadow_strength : hint_range(0.0, 1.0) = 0.32;

float tg_hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float tg_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(tg_hash(i), tg_hash(i + vec2(1.0, 0.0)), u.x),
			mix(tg_hash(i + vec2(0.0, 1.0)), tg_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float tg_fbm(vec2 p) {
	float a = 0.5;
	float s = 0.0;
	for (int i = 0; i < 4; i++) {
		s += a * tg_noise(p);
		p = p * 2.03 + vec2(17.1, 3.7);
		a *= 0.5;
	}
	return s;
}

vec3 tg_srgb(vec3 c) {
	return pow(c, vec3(2.2));
}

// Meadow colour at a world XZ position (linear).
vec3 tg_grass_color(vec2 xz) {
	float n1 = tg_fbm(xz * 0.055 + vec2(3.0, 7.0));
	float n2 = tg_noise(xz * 0.4);
	vec3 dark = tg_srgb(vec3(0.33, 0.47, 0.22));
	vec3 mid = tg_srgb(vec3(0.46, 0.60, 0.27));
	vec3 light = tg_srgb(vec3(0.66, 0.71, 0.34));
	vec3 c = mix(dark, mid, smoothstep(0.28, 0.5, n1));
	c = mix(c, light, smoothstep(0.52, 0.78, n1));
	return c * (0.9 + 0.2 * n2);
}

// 1 = full sun, lower = under a drifting cloud.
float tg_clouds(vec3 wp, float t) {
	vec2 p = wp.xz * 0.03 + vec2(t * 0.011, t * 0.005);
	return 1.0 - cloud_shadow_strength * smoothstep(0.5, 0.72, tg_fbm(p));
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float diff = clamp((ndl + wrap_light) / (1.0 + wrap_light), 0.0, 1.0);
	float cloud = LIGHT_IS_DIRECTIONAL ? tg_clouds(v_world, TIME) : 1.0;
	vec3 lc = LIGHT_COLOR * ATTENUATION * cloud / PI;
	DIFFUSE_LIGHT += diff * lc;
	if (translucency > 0.0) {
		// light shining through leaves / blades toward the camera
		float back = clamp(-ndl, 0.0, 1.0);
		float through = pow(clamp(-dot(VIEW, LIGHT), 0.0, 1.0), 3.0);
		DIFFUSE_LIGHT += translucency * (0.35 * back + through) * lc;
	}
}
