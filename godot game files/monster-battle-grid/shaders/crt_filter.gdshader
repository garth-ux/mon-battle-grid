shader_type canvas_item;

// CRT post-process overlay — samples the finished frame (3D world + every
// CanvasLayer below SceneManager's layer-127 overlay) and re-draws it with
// barrel curvature, soft scanlines, slight bloom, chromatic fringe and a
// vignette. Subtle-to-moderate defaults per user; every knob is a uniform.
// Toggled with V (SceneManager hides the ColorRect).

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;

uniform float curvature : hint_range(0.0, 0.2) = 0.042;
uniform float scanline_strength : hint_range(0.0, 1.0) = 0.18;
uniform float scanline_px : hint_range(1.0, 8.0) = 3.0;
uniform float bloom_strength : hint_range(0.0, 0.1) = 0.25;
uniform float aberration_px : hint_range(0.0, 3.0) = 0.7;
uniform float vignette_strength : hint_range(0.0, 1.0) = 0.22;
uniform float brightness : hint_range(0.8, 1.5) =0.9;

vec2 curve_uv(vec2 uv, float amount) {
	vec2 c = uv * 2.0 - 1.0;
	float r2 = dot(c, c);
	c *= 1.0 + amount * r2;
	return c * 0.5 + 0.5;
}

void fragment() {
	vec2 uv = curve_uv(SCREEN_UV, curvature);
	// Outside the curved glass = black bezel.
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
		COLOR = vec4(0.0, 0.0, 0.0, 1.0);
	} else {
		vec2 centered = uv - 0.5;
		// Slight chromatic fringe, growing toward the edges.
		vec2 fringe = centered * SCREEN_PIXEL_SIZE * aberration_px * 4.0;
		float r = texture(screen_tex, uv + fringe).r;
		vec4 base = texture(screen_tex, uv);
		float b = texture(screen_tex, uv - fringe).b;
		vec3 col = vec3(r, base.g, b);
		// Slight bloom — a low mip of the frame, squared to favor brights
		// (halos, popups, glow tiles pick it up; flat ground barely changes).
		vec3 glow = textureLod(screen_tex, uv, 2.5).rgb;
		col += glow * glow * bloom_strength;
		// Soft scanlines every scanline_px physical pixels; they follow the
		// curved glass like a real tube's raster would.
		float line = sin(uv.y / SCREEN_PIXEL_SIZE.y * PI / scanline_px);
		col *= 1.0 - scanline_strength * (1.0 - line * line);
		// Soft bezel edge + vignette + brightness compensation for the dimming.
		float edge = smoothstep(0.0, 0.015, uv.x) * smoothstep(1.0, 0.985, uv.x)
			* smoothstep(0.0, 0.015, uv.y) * smoothstep(1.0, 0.985, uv.y);
		float vig = 1.0 - vignette_strength * pow(dot(centered, centered) * 2.0, 1.2);
		col *= vig * brightness * edge;
		COLOR = vec4(col, 1.0);
	}
}
