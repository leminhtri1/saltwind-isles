// GLSL ES 3.0 sources. One shared golden-hour sky function colours the sky dome, the fog that
// swallows distant islands and the reflections on the sea, so land, water and sky sit in one light.

const COMMON = `
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform float uFogDensity;
uniform float uTime;
const vec3 ZENITH = vec3(0.2, 0.34, 0.62);
const vec3 UPPER = vec3(0.47, 0.58, 0.78);
const vec3 HORIZON = vec3(0.99, 0.8, 0.62);
const vec3 SUNGLOW = vec3(1.0, 0.6, 0.3);
const vec3 SUNLIGHT = vec3(1.28, 1.0, 0.72);
vec3 skyColor(vec3 dir) {
  float y = max(dir.y, 0.0);
  vec3 c = mix(HORIZON, UPPER, smoothstep(0.0, 0.2, y));
  c = mix(c, ZENITH, smoothstep(0.16, 0.7, y));
  float s = max(dot(dir, uSunDir), 0.0);
  c += SUNGLOW * (pow(s, 5.0) * 0.42 + pow(s, 60.0) * 0.6);
  return c;
}
vec3 fogColor(vec3 dir) {
  vec3 h = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0, 0.015, 0.0));
  return skyColor(h);
}
vec3 applyFog(vec3 col, vec3 worldPos) {
  vec3 d = worldPos - uCamPos;
  float dist = length(d);
  float k = dist * uFogDensity;
  float f = 1.0 - exp(-k * k);
  return mix(col, fogColor(d / dist), clamp(f, 0.0, 1.0));
}
vec3 tonemap(vec3 c) { return vec3(1.0) - exp(-c * 1.55); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
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

export const LIT_FS = `#version 300 es
precision highp float;
${COMMON}
uniform float uAlpha;
uniform vec3 uTint;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float diff = max(dot(n, uSunDir), 0.0);
  vec3 amb = mix(vec3(0.3, 0.26, 0.28), vec3(0.42, 0.5, 0.68), n.y * 0.5 + 0.5);
  vec3 base = vColor.rgb * uTint;
  vec3 v = normalize(uCamPos - vWorld);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.18;
  vec3 col = base * (amb + SUNLIGHT * diff) + rim * HORIZON * 0.5;
  col = tonemap(col);
  col = mix(col, min(base * 1.15 + 0.08, vec3(1.0)), vColor.a);
  outColor = vec4(applyFog(col, vWorld), uAlpha);
}`;

export const SKY_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.99999, 1.0); }`;

export const SKY_FS = `#version 300 es
precision highp float;
${COMMON}
uniform mat4 uInvViewProj;
in vec2 vNdc;
out vec4 outColor;
void main() {
  vec4 p = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w - uCamPos);
  vec3 col = dir.y < 0.0 ? fogColor(dir) : skyColor(dir);
  float s = dot(dir, uSunDir);
  col += vec3(1.0, 0.92, 0.75) * smoothstep(0.99955, 0.9998, s) * 1.6;
  if (dir.y > 0.0) {
    vec2 uv = dir.xz / (dir.y + 0.06) * 1.6 + vec2(uTime * 0.004, 0.0);
    float n = vnoise(uv * vec2(1.2, 5.0)) * 0.6 + vnoise(uv * vec2(2.7, 9.0)) * 0.3 + vnoise(uv * 6.0) * 0.1;
    float cl = smoothstep(0.52, 0.85, n) * smoothstep(0.02, 0.2, dir.y) * (1.0 - smoothstep(0.5, 0.9, dir.y));
    vec3 cc = mix(vec3(1.0, 0.7, 0.55), vec3(1.0, 0.92, 0.82), smoothstep(0.0, 0.4, dir.y)) + SUNGLOW * pow(max(s, 0.0), 4.0) * 0.4;
    col = mix(col, cc, cl * 0.55);
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

export const WATER_FS = `#version 300 es
precision highp float;
${COMMON}
in vec3 vWorld;
in float vDepth;
out vec4 outColor;
void main() {
  vec2 p = vWorld.xz;
  float dist = length(uCamPos - vWorld);
  float t = uTime;
  vec2 g = vec2(0.0);
  // octaves of drifting value noise, each faded out before it shimmers into a moire at distance
  for (int i = 0; i < 4; i++) {
    float f = 0.011 * pow(2.6, float(i));
    float fade = clamp(1.0 - dist * f / 45.0, 0.0, 1.0);
    vec2 q = p * f + vec2(t * 0.05, -t * 0.035) * (1.0 + float(i));
    float e = 0.35;
    float h0 = vnoise(q), hx = vnoise(q + vec2(e, 0.0)), hz = vnoise(q + vec2(0.0, e));
    g += vec2(hx - h0, hz - h0) / e * 0.3 * fade;
  }
  float swell = clamp(1.0 - dist / 2200.0, 0.0, 1.0);
  g += vec2(0.6, 0.25) * cos(dot(p, vec2(0.028, 0.012)) + t * 0.9) * 0.25 * swell;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(uCamPos - vWorld);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 refl = skyColor(r);
  float depth = vDepth;
  vec3 shallow = vec3(0.24, 0.7, 0.64), deep = vec3(0.04, 0.2, 0.32);
  vec3 body = mix(shallow, deep, smoothstep(0.0, 20.0, depth)) * vec3(0.95, 0.88, 0.82);
  float spec = pow(max(dot(r, uSunDir), 0.0), 220.0) * 2.6 + pow(max(dot(r, uSunDir), 0.0), 24.0) * 0.18;
  vec3 col = mix(body, refl, clamp(fres, 0.0, 0.85)) + vec3(1.0, 0.78, 0.5) * spec;
  float wobble = sin(p.x * 0.12 + t * 0.9) * sin(p.y * 0.11 - t * 0.7) + vnoise(p * 0.08 + t * 0.1) - 0.5;
  float foam = smoothstep(1.8, 0.1, depth + wobble * 0.7) * smoothstep(-2.0, 0.0, depth);
  col = mix(col, vec3(0.98, 0.95, 0.9), foam * 0.85);
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

export const SPRITE_FS = `#version 300 es
precision highp float;
${COMMON}
uniform float uSoftness;
uniform float uFogged;
in vec2 vUv;
in vec4 vColor;
in vec3 vWorld;
out vec4 outColor;
void main() {
  float d = length(vUv * 2.0 - 1.0);
  float a = pow(max(1.0 - d, 0.0), uSoftness);
  vec3 col = vColor.rgb;
  if (uFogged > 0.5) col = applyFog(col, vWorld);
  float k = length(vWorld - uCamPos) * uFogDensity * 0.6;
  outColor = vec4(col, vColor.a * a * (uFogged > 0.5 ? 1.0 : exp(-k * k)));
}`;
