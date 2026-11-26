// GLSL ES 3.0: a bright late-morning sky shared by sky, haze and sea reflections, with cumulus shadows.

const COMMON = `
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform float uFogDensity;
uniform float uTime;
uniform vec4 uClouds[40];
const vec3 ZENITH = vec3(0.09, 0.3, 0.74);
const vec3 UPPER = vec3(0.3, 0.56, 0.9);
const vec3 HORIZON = vec3(0.74, 0.86, 0.96);
const vec3 SUNLIGHT = vec3(1.32, 1.26, 1.14);
vec3 skyColor(vec3 dir) {
	float y = max(dir.y, 0.0);
	vec3 c = mix(HORIZON, UPPER, smoothstep(0.0, 0.25, y));
	c = mix(c, ZENITH, smoothstep(0.2, 0.85, y));
	float s = max(dot(dir, uSunDir), 0.0);
	return c + vec3(1.0, 0.95, 0.85) * (pow(s, 8.0) * 0.22 + pow(s, 90.0) * 0.5);
}
vec3 fogColor(vec3 dir) {
	return skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0, 0.02, 0.0))) * vec3(0.97, 0.99, 1.0);
}
vec3 applyFog(vec3 col, vec3 worldPos) {
	vec3 d = worldPos - uCamPos;
	float dist = length(d);
	float k = dist * uFogDensity;
	return mix(col, fogColor(d / dist), clamp(1.0 - exp(-k * k * 1.2) , 0.0, 1.0) * 0.96);
}
vec3 tonemap(vec3 c) { return vec3(1.0) - exp(-c * 1.45); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float cloudLight(vec3 p) {
	float lit = 1.0, n = vnoise(p.xz * 0.012) - 0.5;
	for (int i = 0; i < 40; i++) {
		vec4 c = uClouds[i];
		vec2 q = p.xz + uSunDir.xz / uSunDir.y * (c.y - p.y) - c.xz;
		lit *= 1.0 - 0.62 * smoothstep(1.0, 0.45, length(q * vec2(0.8, 1.15)) / c.w + n * 0.5);
	}
	return lit;
}
`;
const HEAD = `#version 300 es
precision highp float;
${COMMON}
`;

export const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vColor;
void main() {
	vec4 w = uModel * vec4(aPos, 1.0);
	vWorld = w.xyz;
	vNormal = mat3(uModel) * aNormal;
	vColor = aColor;
	gl_Position = uViewProj * w;
}`;

export const LIT_FS = HEAD + `uniform float uAlpha;
uniform float uGround;
uniform vec3 uTint;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vColor;
out vec4 outColor;
void main() {
	vec3 n = normalize(vNormal);
	if (!gl_FrontFacing) n = -n;
	vec3 base = vColor.rgb * uTint;
	float shade = 1.0;
	if (uGround > 0.5) {
		vec2 p = vWorld.xz;
		float fade = clamp(1.0 - length(uCamPos - vWorld) / 1800.0, 0.0, 1.0);
		float m = vnoise(p * 0.11) * 0.55 + vnoise(p * 0.37) * 0.3 + vnoise(p * 1.3) * 0.15;
		base *= 1.0 + (m - 0.5) * 0.34 * fade;
		shade = cloudLight(vWorld);
	}
	float diff = max(dot(n, uSunDir), 0.0) * shade;
	vec3 amb = mix(vec3(0.3, 0.33, 0.3), vec3(0.46, 0.56, 0.74), n.y * 0.5 + 0.5) * (0.82 + 0.18 * shade);
	vec3 v = normalize(uCamPos - vWorld);
	float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.12;
	vec3 col = base * (amb + SUNLIGHT * diff) + rim * HORIZON * 0.5;
	col = tonemap(col);
	col = mix(col, min(base * 1.15 + 0.08, vec3(1.0)), vColor.a);
	outColor = vec4(applyFog(col, vWorld), uAlpha);
}`;

export const SKY_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.99999, 1.0); }`;

export const SKY_FS = HEAD + `uniform mat3 uCamBasis;
uniform vec2 uLens;
in vec2 vNdc;
out vec4 outColor;
void main() {
	vec3 dir = normalize(uCamBasis * vec3(vNdc * uLens, 1.0));
	vec3 col = dir.y < 0.0 ? fogColor(dir) : skyColor(dir);
	col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9997, dot(dir, uSunDir)) * 1.4;
	if (dir.y > 0.0) {
		vec2 uv = dir.xz / (dir.y + 0.08) * 1.4 + vec2(uTime * 0.003, 0.0);
		float n = vnoise(uv * vec2(0.9, 6.0)) * 0.65 + vnoise(uv * vec2(2.4, 14.0)) * 0.35;
		col = mix(col, vec3(1.0), smoothstep(0.6, 0.95, n) * smoothstep(0.05, 0.3, dir.y) * 0.35);
	}
	outColor = vec4(col, 1.0);
}`;

export const WATER_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in float aDepth;
uniform mat4 uViewProj;
out vec3 vWorld;
out float vDepth;
void main() {
	vWorld = aPos;
	vDepth = aDepth;
	gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const WATER_FS = HEAD + `in vec3 vWorld;
in float vDepth;
out vec4 outColor;
void main() {
	vec2 p = vWorld.xz;
	float dist = length(uCamPos - vWorld);
	float t = uTime;
	vec2 g = vec2(0.0);
	for (int i = 0; i < 4; i++) {
		float f = 0.011 * pow(2.6, float(i));
		float fade = clamp(1.0 - dist * f / 45.0, 0.0, 1.0);
		vec2 q = p * f + vec2(t * 0.05, -t * 0.035) * (1.0 + float(i));
		float e = 0.35;
		float h0 = vnoise(q), hx = vnoise(q + vec2(e, 0.0)), hz = vnoise(q + vec2(0.0, e));
		g += vec2(hx - h0, hz - h0) / e * (i == 0 ? 0.06 : 0.13) * fade;
	}
	float swell = clamp(1.0 - dist / 2200.0, 0.0, 1.0);
	g += vec2(0.6, 0.25) * cos(dot(p, vec2(0.028, 0.012)) + t * 0.9) * 0.2 * swell;
	vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
	vec3 v = normalize(uCamPos - vWorld);
	float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
	vec3 r = reflect(-v, n);
	r.y = abs(r.y);
	vec3 refl = skyColor(r);
	float light = cloudLight(vWorld);
	float depth = vDepth;
	vec3 body = mix(vec3(0.36, 0.93, 0.84), vec3(0.0, 0.62, 0.72), smoothstep(0.0, 6.0, depth));
	body = mix(body, vec3(0.02, 0.24, 0.5), smoothstep(5.0, 34.0, depth));
	body *= 0.62 + 0.38 * light;
	float spec = (pow(max(dot(r, uSunDir), 0.0), 300.0) * 3.0 + pow(max(dot(r, uSunDir), 0.0), 30.0) * 0.12) * light;
	vec3 col = mix(body, refl, clamp(fres, 0.0, 0.7)) + vec3(1.0, 0.97, 0.9) * spec;
	float wobble = sin(p.x * 0.12 + t * 0.9) * sin(p.y * 0.11 - t * 0.7) + vnoise(p * 0.08 + t * 0.1) - 0.5;
	float foam = smoothstep(1.6, 0.1, depth + wobble * 0.7) * smoothstep(-2.0, 0.0, depth);
	col = mix(col, vec3(0.98, 0.99, 1.0), foam * 0.9);
	outColor = vec4(applyFog(col, vWorld), 1.0);
}`;

export const SPRITE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in vec4 aColor;
uniform mat4 uViewProj;
out vec2 vUv;
out vec4 vColor;
out vec3 vWorld;
void main() {
	vUv = aUv;
	vColor = aColor;
	vWorld = aPos;
	gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const SPRITE_FS = HEAD + `uniform float uSoftness;
uniform float uFogged;
uniform float uCloud;
uniform vec3 uRight;
uniform vec3 uUp;
in vec2 vUv;
in vec4 vColor;
in vec3 vWorld;
out vec4 outColor;
void main() {
	vec2 q = vUv * 2.0 - 1.0;
	float d = length(q);
	float a = pow(max(1.0 - d, 0.0), uSoftness);
	vec3 col = vColor.rgb;
	if (uCloud > 0.5) {
		if (d > 1.0) discard;
		vec3 n = normalize(uRight * q.x + uUp * q.y + normalize(cross(uRight, uUp)) * sqrt(1.0 - d * d));
		float l = clamp(dot(n, uSunDir) * 0.55 + 0.5, 0.0, 1.0);
		col = mix(vec3(0.58, 0.66, 0.8), vec3(1.06, 1.05, 1.02), l) * vColor.rgb;
		a = smoothstep(1.0, 0.5, d + (vnoise(vUv * 5.0 + vColor.a * 13.0) - 0.5) * 0.35);
		outColor = vec4(applyFog(col, vWorld), a);
		return;
	}
	if (uFogged > 0.5) col = applyFog(col, vWorld);
	float k = length(vWorld - uCamPos) * uFogDensity * 0.6;
	outColor = vec4(col, vColor.a * a * (uFogged > 0.5 ? 1.0 : exp(-k * k)));
}`;
