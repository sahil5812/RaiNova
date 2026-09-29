"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const VS_SOURCE = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FS_SOURCE = `
precision highp float;

uniform vec2  uR;
uniform float uT, uS, uSc, uBl;

// ── Math ────────────────────────────────────────────────────────────
const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ── Render budget ───────────────────────────────────────────────────
const int SEA_TRACE_STEPS  = 8;
const int SEA_OCTAVES_GEO  = 3;
const int SEA_OCTAVES_FRAG = 5;

// ── Hash / noise ────────────────────────────────────────────────────
const vec2  HASH_DOT   = vec2(127.1, 311.7);
const float HASH_SCALE = 43758.5453123;

// ── Sea octave ──────────────────────────────────────────────────────
const mat2  SEA_OCT_M        = mat2(1.6, 1.2, -1.2, 1.6);
const float SEA_OCT_POWER    = 0.65;
const float SEA_UV_X_SCALE   = 0.75;
const float SEA_FREQ_BASE    = 0.16;
const float SEA_FREQ_MUL     = 1.9;
const float SEA_AMP_MUL      = 0.22;
const float SEA_CHOPPY_BLEND = 0.20;
const float SEA_TRACE_FAR    = 1000.0;

// ── Scene transitions ───────────────────────────────────────────────
const float STORM_FADE_LO = 0.500;
const float STORM_FADE_HI = 0.667;
const float NIGHT_FADE_LO = 0.667;
const float NIGHT_FADE_HI = 0.833;

// ── Camera ──────────────────────────────────────────────────────────
const float CAM_HEIGHT_START = 5.2;
const float CAM_HEIGHT_END   = 4.4;
const float CAM_DRIFT_SPEED  = 0.5;
const float CAM_PITCH        = 0.20;
const float CAM_FOCAL        = -1.8;
const float CAM_BARREL       = 0.10;

// ── Sky gradient ────────────────────────────────────────────────────
const float SKY_GRAD_EXP = 0.42;

// ── Clouds ──────────────────────────────────────────────────────────
const float CLOUD_FREQ_A    = 5.5;
const float CLOUD_FREQ_B    = 8.0;
const float CLOUD_TIME_A    = 0.012;
const float CLOUD_TIME_B    = 0.008;
const float CLOUD_THRESH_LO = 0.62;
const float CLOUD_THRESH_HI = 0.86;
const float CLOUD_BLEND_A   = 0.65;
const float CLOUD_BLEND_B   = 0.35;
const float CLOUD_HOR_LO    = -0.02;
const float CLOUD_HOR_HI    = 0.24;
const float CLOUD_AMT_BASE  = 0.06;
const float CLOUD_AMT_STORM = 0.22;
const float CLOUD_DARKEN    = 0.97;
const float CLOUD_MIX       = 0.35;
const vec3  CLOUD_COL_CLEAR = vec3(1.00, 0.82, 0.65);
const vec3  CLOUD_COL_STORM = vec3(0.42, 0.48, 0.56);

// ── Sun ─────────────────────────────────────────────────────────────
const float SUN_ARC_END      = 0.46;
const float SUN_ARC_X        = -0.75;
const float SUN_ARC_Y_SCALE  = 0.38;
const float SUN_ARC_Y_OFFSET = 0.00;
const float SUN_GLOW_LO      = -0.10;
const float SUN_GLOW_HI      = 0.06;
const float SUN_HALO_EXP_A   = 380.0;
const float SUN_HALO_SCL_A   = 6.8;
const float SUN_HALO_EXP_B   = 22.0;
const float SUN_HALO_SCL_B   = 0.22;
const float SUN_HALO_EXP_C   = 5.0;
const float SUN_HALO_SCL_C   = 0.09;
const float SUN_HALO_EXP_D   = 3.0;
const float SUN_HALO_SCL_D   = 0.035;
const float SUN_DISK_LO      = 0.99975;
const float SUN_DISK_HI      = 0.99998;
const float SUN_DISK_SCL     = 1.8;
const float SUN_HORIZON_FALL = 24.0;
const float SUN_HORIZON_SCL  = 0.11;

// ── Moon ────────────────────────────────────────────────────────────
const vec3  MOON_DIR_RAW     = vec3(-0.14, 0.42, -1.0);
const float MOON_THRESHOLD   = 0.04;
const float MOON_DISK_LO     = 0.99985;
const float MOON_DISK_HI     = 0.99998;
const float MOON_DISK_SCL    = 3.5;
const vec3  MOON_COL_DISK    = vec3(0.95, 0.97, 1.00);
const vec3  MOON_COL_CORONA  = vec3(0.88, 0.92, 1.00);
const float MOON_CORONA_EXP  = 820.0; const float MOON_CORONA_SCL  = 5.0;
const vec3  MOON_COL_HALO1   = vec3(0.65, 0.75, 0.95);
const float MOON_HALO1_EXP   = 60.0;  const float MOON_HALO1_SCL   = 0.18;
const vec3  MOON_COL_HALO2   = vec3(0.40, 0.52, 0.82);
const float MOON_HALO2_EXP   = 12.0;  const float MOON_HALO2_SCL   = 0.07;

// ── Stars in sky ────────────────────────────────────────────────────
const float STAR_HOR_LO     = 0.02;
const float STAR_HOR_HI     = 0.28;
const float STAR_STORM_SUPP = 0.88;
const float STAR_NIGHT_SCL  = 2.80;
const float NIGHT_STARS_THRESHOLD = 0.02;

// ── Horizon mist ────────────────────────────────────────────────────
const float HZ_MIST_CLEAR   = 38.0;
const float HZ_MIST_STORM   = 22.0;
const float HZ_MIST_SCL     = 0.09;
const float HZ_MIST_STORM_ADD = 0.10;

// ── Storm sky tint ──────────────────────────────────────────────────
const vec3  STORM_SKY_TINT     = vec3(0.91, 0.94, 0.98);
const float STORM_SKY_TINT_AMT = 0.22;

// ── Lightning ────────────────────────────────────────────────────────
const float LT_RATE          = 0.28;
const float LT_PROB          = 0.30;
const float LT_DECAY         = 9.0;
const float LT_BOLT_ELEV_MIN = 0.015;
const float LT_BOLT_ELEV_MAX = 0.82;
const float LT_BOLT_WIDTH    = 0.0020;
const float LT_BOLT_GLOW     = 0.013;
const float LT_JITTER        = 0.070;
const float LT_SEGS          = 9.0;
const float LT_BRANCH_SEGS   = 5.0;
const float LT_BRANCH_SPREAD = 0.09;
const vec3  LT_COL_SHEET     = vec3(0.76, 0.86, 1.00);
const vec3  LT_COL_BOLT      = vec3(0.96, 0.97, 1.00);
const float LT_SHEET_BRIGHT  = 2.2;
const float LT_BOLT_BRIGHT   = 12.0;
const float LT_GLOW_BRIGHT   = 1.6;
const float LT_BRANCH_BRIGHT = 6.0;
const float LT_WATER_BRIGHT  = 0.55;

// ── Sea surface rendering ───────────────────────────────────────────
const float SEA_HORIZON_BLEND  = -0.05;
const float SEA_HORIZON_EXP    = 0.30;
const float SEA_MIX_THRESHOLD  = 0.001;
const float SEA_NORMAL_EPS_K   = 0.10;
const float FRESNEL_EXP        = 3.0;
const float FRESNEL_SCL        = 0.65;
const float REFL_SUN_EXP_A     = 140.0; const float REFL_SUN_SCL_A = 3.0;
const float REFL_SUN_EXP_B     = 18.0;  const float REFL_SUN_SCL_B = 0.10;
const vec3  REFL_MOON_COL_A = vec3(0.90, 0.94, 1.00);
const float REFL_MOON_EXP_A = 320.0;   const float REFL_MOON_SCL_A = 2.40;
const vec3  REFL_MOON_COL_B = vec3(0.72, 0.82, 0.98);
const float REFL_MOON_EXP_B = 28.0;    const float REFL_MOON_SCL_B = 0.42;
const vec3  REFL_MOON_COL_C = vec3(0.50, 0.62, 0.88);
const float REFL_MOON_EXP_C = 6.0;     const float REFL_MOON_SCL_C = 0.12;
const float DIFF_WRAP        = 0.4;
const float DIFF_LIFT        = 0.6;
const float DIFF_EXP         = 80.0;
const float DIFF_WATER_SCL   = 0.12;
const float SSS_ATTEN_K   = 0.001;
const float SSS_SCL       = 0.18;
const float SPEC_EXP      = 60.0;
const float GLITTER_UV_SCL    = 18.0;
const float GLITTER_TIME_U    = 0.55;
const float GLITTER_TIME_V    = 0.22;
const float GLITTER_THRESH    = 0.94;
const float GLITTER_SCL       = 0.09;
const vec3  MSPEC_COL_A   = vec3(0.88, 0.93, 1.00);
const float MSPEC_EXP_A   = 380.0; const float MSPEC_SCL_A = 0.55;
const vec3  MSPEC_COL_B   = vec3(0.70, 0.80, 0.97);
const float MSPEC_EXP_B   = 22.0;  const float MSPEC_SCL_B = 0.14;
const float FOG_SCALE = 1.6;

// ── Post-processing ─────────────────────────────────────────────────
const float HOR_EDGE_LO    = -0.008;
const float HOR_EDGE_HI    = 0.018;
const float HOR_BLEND      = 0.25;
const float GRAIN_UV_SCL   = 0.5;
const float GRAIN_TIME_SCL = 12.0;
const float GRAIN_STR      = 0.003;
const float GAMMA          = 0.78;

// ── Scene palettes ──────────────────────────────────────────────────
const vec3 SKY_TOP_PREDAWN  = vec3(0.38, 0.40, 0.64);
const vec3 SKY_TOP_DAWN     = vec3(0.42, 0.60, 0.90);
const vec3 SKY_TOP_DAY      = vec3(0.04, 0.22, 0.62);
const vec3 SKY_TOP_DUSK     = vec3(0.14, 0.04, 0.26);
const vec3 SKY_TOP_STORM    = vec3(0.04, 0.05, 0.09);
const vec3 SKY_TOP_NIGHT    = vec3(0.01, 0.01, 0.05);

const vec3 SKY_HOR_PREDAWN  = vec3(0.70, 0.52, 0.64);
const vec3 SKY_HOR_DAWN     = vec3(0.98, 0.50, 0.12);
const vec3 SKY_HOR_DAY      = vec3(0.50, 0.68, 0.92);
const vec3 SKY_HOR_DUSK     = vec3(0.98, 0.22, 0.02);
const vec3 SKY_HOR_STORM    = vec3(0.15, 0.17, 0.23);
const vec3 SKY_HOR_NIGHT    = vec3(0.02, 0.02, 0.06);

const vec3 SUN_COL_PREDAWN  = vec3(0.90, 0.55, 0.62);
const vec3 SUN_COL_DAWN     = vec3(1.00, 0.88, 0.35);
const vec3 SUN_COL_DAY      = vec3(1.00, 0.96, 0.80);
const vec3 SUN_COL_DUSK     = vec3(1.00, 0.28, 0.04);
const vec3 SUN_COL_STORM    = vec3(0.26, 0.28, 0.34);
const vec3 SUN_COL_NIGHT    = vec3(0.72, 0.78, 0.98);

const vec3 SEA_BASE_PREDAWN = vec3(0.02, 0.02, 0.06);
const vec3 SEA_BASE_DAWN    = vec3(0.08, 0.04, 0.02);
const vec3 SEA_BASE_DAY     = vec3(0.02, 0.10, 0.26);
const vec3 SEA_BASE_DUSK    = vec3(0.09, 0.05, 0.03);
const vec3 SEA_BASE_STORM   = vec3(0.03, 0.04, 0.06);
const vec3 SEA_BASE_NIGHT   = vec3(0.01, 0.01, 0.04);

const vec3 SEA_WATER_PREDAWN = vec3(0.25, 0.28, 0.54);
const vec3 SEA_WATER_DAWN    = vec3(0.82, 0.55, 0.32);
const vec3 SEA_WATER_DAY     = vec3(0.42, 0.82, 0.88);
const vec3 SEA_WATER_DUSK    = vec3(0.32, 0.18, 0.08);
const vec3 SEA_WATER_STORM   = vec3(0.48, 0.54, 0.60);
const vec3 SEA_WATER_NIGHT   = vec3(0.20, 0.32, 0.62);

const vec3 FOG_COL_PREDAWN  = vec3(0.60, 0.46, 0.58);
const vec3 FOG_COL_DAWN     = vec3(0.92, 0.65, 0.45);
const vec3 FOG_COL_DAY      = vec3(0.60, 0.76, 0.94);
const vec3 FOG_COL_DUSK     = vec3(0.30, 0.10, 0.06);
const vec3 FOG_COL_STORM    = vec3(0.12, 0.14, 0.18);
const vec3 FOG_COL_NIGHT    = vec3(0.01, 0.01, 0.04);

const float SEA_H_PREDAWN = 0.42;
const float SEA_H_DAWN  = 0.62;
const float SEA_H_DAY   = 0.48;
const float SEA_H_DUSK  = 0.72;
const float SEA_H_NIGHT = 0.48;
const float SEA_H_STORM = 1.35;
const float SEA_H_STORM_EXTRA = 0.25;

const float SEA_CH_PREDAWN = 0.68;
const float SEA_CH_DAWN  = 1.00;
const float SEA_CH_DAY   = 0.75;
const float SEA_CH_DUSK  = 1.25;
const float SEA_CH_NIGHT = 0.75;
const float SEA_CH_STORM = 2.80;

const float SEA_SPD_PREDAWN = 0.48;
const float SEA_SPD_DAWN  = 0.80;
const float SEA_SPD_DAY   = 0.65;
const float SEA_SPD_DUSK  = 0.90;
const float SEA_SPD_NIGHT = 0.55;
const float SEA_SPD_STORM = 1.40;

const float FOG_DEN_PREDAWN = 0.010;
const float FOG_DEN_DAWN  = 0.012;
const float FOG_DEN_DAY   = 0.010;
const float FOG_DEN_DUSK  = 0.014;
const float FOG_DEN_NIGHT = 0.028;
const float FOG_DEN_STORM = 0.046;

const float MOON_AMT_PREDAWN = 0.62;
const float MOON_AMT_DAWN  = 0.10;
const float MOON_AMT_DAY   = 0.00;
const float MOON_AMT_DUSK  = 0.00;
const float MOON_AMT_NIGHT = 0.80;
const float MOON_AMT_STORM = 0.10;

float sat(float x) { return clamp(x, 0.0, 1.0); }

float smoother(float x) {
  x = sat(x);
  return x*x*x * (x*(x*6.0 - 15.0) + 10.0);
}

vec3 sCol(vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5) {
  int si = int(uSc);
  vec3 a = c0, b = c1;
  if      (si == 1) { a = c1; b = c2; }
  else if (si == 2) { a = c2; b = c3; }
  else if (si == 3) { a = c3; b = c4; }
  else if (si == 4) { a = c4; b = c5; }
  else if (si == 5) { a = c5; b = c0; }
  return mix(a, b, uBl);
}

float sF(float c0, float c1, float c2, float c3, float c4, float c5) {
  int si = int(uSc);
  float a = c0, b = c1;
  if      (si == 1) { a = c1; b = c2; }
  else if (si == 2) { a = c2; b = c3; }
  else if (si == 3) { a = c3; b = c4; }
  else if (si == 4) { a = c4; b = c5; }
  else if (si == 5) { a = c5; b = c0; }
  return mix(a, b, uBl);
}

float hash(vec2 p) {
  return fract(sin(dot(p, HASH_DOT)) * HASH_SCALE);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f * (3.0 - 2.0*f);
  float a = hash(i),              b = hash(i + vec2(1,0));
  float c = hash(i + vec2(0,1)),  d = hash(i + vec2(1,1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float snoise(vec2 p) { return noise(p) * 2.0 - 1.0; }

float sea_octave(vec2 uv, float choppy) {
  uv += snoise(uv);
  vec2 wv  = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, SEA_OCT_POWER), choppy);
}

float seaMap(vec3 p, float seaH, float ch, float seaT) {
  float freq = SEA_FREQ_BASE, amp = seaH, choppy = ch;
  vec2  uv   = p.xz; uv.x *= SEA_UV_X_SCALE;
  float d, h = 0.0;
  for (int i = 0; i < SEA_OCTAVES_GEO; i++) {
    d    = sea_octave((uv + seaT) * freq, choppy);
    d   += sea_octave((uv - seaT) * freq, choppy);
    h   += d * amp;
    uv  *= SEA_OCT_M;
    freq *= SEA_FREQ_MUL;
    amp  *= SEA_AMP_MUL;
    choppy = mix(choppy, 1.0, SEA_CHOPPY_BLEND);
  }
  return p.y - h;
}

float seaMapFine(vec3 p, float seaH, float ch, float seaT) {
  float freq = SEA_FREQ_BASE, amp = seaH, choppy = ch;
  vec2  uv   = p.xz; uv.x *= SEA_UV_X_SCALE;
  float d, h = 0.0;
  for (int i = 0; i < SEA_OCTAVES_FRAG; i++) {
    d    = sea_octave((uv + seaT) * freq, choppy);
    d   += sea_octave((uv - seaT) * freq, choppy);
    h   += d * amp;
    uv  *= SEA_OCT_M;
    freq *= SEA_FREQ_MUL;
    amp  *= SEA_AMP_MUL;
    choppy = mix(choppy, 1.0, SEA_CHOPPY_BLEND);
  }
  return p.y - h;
}

float seaTrace(vec3 ori, vec3 dir, out vec3 p, float seaH, float ch, float seaT) {
  float tm = 0.0, tx = SEA_TRACE_FAR;
  float hx = seaMap(ori + dir * tx, seaH, ch, seaT);
  if (hx > 0.0) { p = ori + dir * tx; return tx; }
  float hm = seaMap(ori, seaH, ch, seaT);
  float tmid = 0.0;
  for (int i = 0; i < SEA_TRACE_STEPS; i++) {
    tmid = mix(tm, tx, hm / (hm - hx));
    p    = ori + dir * tmid;
    float hmid = seaMap(p, seaH, ch, seaT);
    if (hmid < 0.0) { tx = tmid; hx = hmid; }
    else            { tm = tmid; hm = hmid; }
  }
  return tmid;
}

vec3 seaNormal(vec3 p, float eps, float seaH, float ch, float seaT) {
  vec3 n;
  n.y = seaMapFine(p, seaH, ch, seaT);
  n.x = seaMapFine(vec3(p.x + eps, p.y, p.z), seaH, ch, seaT) - n.y;
  n.z = seaMapFine(vec3(p.x, p.y, p.z + eps), seaH, ch, seaT) - n.y;
  n.y = eps;
  return normalize(n);
}

void main() {
  vec2  uv = (gl_FragCoord.xy - uR * 0.5) / uR.y;
  float s  = smoother(uS);

  float storm = smoothstep(STORM_FADE_LO, STORM_FADE_HI, s);
  float night = smoothstep(NIGHT_FADE_LO, NIGHT_FADE_HI, s);

  float seaH  = sF(SEA_H_DAWN, SEA_H_DAY, SEA_H_DUSK, SEA_H_STORM, SEA_H_NIGHT, SEA_H_PREDAWN)
               + storm * SEA_H_STORM_EXTRA;
  float seaCh = sF(SEA_CH_DAWN, SEA_CH_DAY, SEA_CH_DUSK, SEA_CH_STORM, SEA_CH_NIGHT, SEA_CH_PREDAWN);
  float seaT  = uT * sF(SEA_SPD_DAWN, SEA_SPD_DAY, SEA_SPD_DUSK, SEA_SPD_STORM, SEA_SPD_NIGHT, SEA_SPD_PREDAWN);

  float ltSlot  = floor(uT * LT_RATE);
  float ltRand  = hash(vec2(ltSlot, 17.31));
  float ltPhase = fract(uT * LT_RATE);
  float ltFire  = step(1.0 - LT_PROB, ltRand);
  float ltRand2 = hash(vec2(ltSlot, 5.77));
  float ltPhase2 = clamp(ltPhase - 0.12, 0.0, 1.0);
  float ltFire2  = step(1.0 - LT_PROB * 0.5, ltRand2);
  float ltFlash = (ltFire  * exp(-ltPhase  * LT_DECAY)
                + ltFire2 * exp(-ltPhase2 * LT_DECAY) * 0.55) * storm;

  vec3 skyTop   = sCol(SKY_TOP_DAWN,   SKY_TOP_DAY,   SKY_TOP_DUSK,   SKY_TOP_STORM,   SKY_TOP_NIGHT,   SKY_TOP_PREDAWN);
  vec3 skyHori  = sCol(SKY_HOR_DAWN,   SKY_HOR_DAY,   SKY_HOR_DUSK,   SKY_HOR_STORM,   SKY_HOR_NIGHT,   SKY_HOR_PREDAWN);
  vec3 sunCol   = sCol(SUN_COL_DAWN,   SUN_COL_DAY,   SUN_COL_DUSK,   SUN_COL_STORM,   SUN_COL_NIGHT,   SUN_COL_PREDAWN);
  vec3 seaBase  = sCol(SEA_BASE_DAWN,  SEA_BASE_DAY,  SEA_BASE_DUSK,  SEA_BASE_STORM,  SEA_BASE_NIGHT,  SEA_BASE_PREDAWN);
  vec3 seaWater = sCol(SEA_WATER_DAWN, SEA_WATER_DAY, SEA_WATER_DUSK, SEA_WATER_STORM, SEA_WATER_NIGHT, SEA_WATER_PREDAWN);
  vec3 fogCol   = sCol(FOG_COL_DAWN,   FOG_COL_DAY,   FOG_COL_DUSK,   FOG_COL_STORM,   FOG_COL_NIGHT,   FOG_COL_PREDAWN);
  float fogDen  = sF(FOG_DEN_DAWN, FOG_DEN_DAY, FOG_DEN_DUSK, FOG_DEN_STORM, FOG_DEN_NIGHT, FOG_DEN_PREDAWN);

  if (int(uSc) == 1) {
    float t  = uBl;
    float d5 = t * t * t * t * t;
    sunCol   = mix(SUN_COL_DAY,      SUN_COL_DUSK,   d5);
    seaWater = mix(SEA_WATER_DAY,    SEA_WATER_DUSK, d5);
    seaBase  = mix(SEA_BASE_DAY,     SEA_BASE_DUSK,  d5);
    fogCol   = mix(FOG_COL_DAY,      FOG_COL_DUSK,   d5);
    fogDen   = mix(FOG_DEN_DAY,      FOG_DEN_DUSK,   d5);
  }

  float sunProgress = clamp(s / SUN_ARC_END, 0.0, 1.0);
  float sunAngle    = sunProgress * PI;
  vec3  sunDir  = normalize(vec3(cos(sunAngle) * SUN_ARC_X,
                                  sin(sunAngle) * SUN_ARC_Y_SCALE + SUN_ARC_Y_OFFSET,
                                  -1.0));
  vec3  moonDir = normalize(MOON_DIR_RAW);
  float moonAmt = sF(MOON_AMT_DAWN, MOON_AMT_DAY, MOON_AMT_DUSK, MOON_AMT_STORM, MOON_AMT_NIGHT, MOON_AMT_PREDAWN);
  float sunAbove = step(0.0, sunDir.y);
  float sunGlow  = smoothstep(SUN_GLOW_LO, SUN_GLOW_HI, sunDir.y);

  vec3 ori = vec3(0.0, mix(CAM_HEIGHT_START, CAM_HEIGHT_END, s), uT * CAM_DRIFT_SPEED);
  vec3 rd  = normalize(vec3(uv.x, uv.y - CAM_PITCH, CAM_FOCAL));
  rd.z    += length(uv) * CAM_BARREL;
  rd       = normalize(rd);

  vec3 skyCol;
  {
    float elev = clamp(rd.y, 0.0, 1.0);

    vec3 skyTopFinal  = skyTop;
    vec3 skyHoriFinal = skyHori;
    if (int(uSc) == 1) {
      float t = uBl;
      float db = t * t * t * t * t;
      skyTopFinal  = mix(SKY_TOP_DAY,     SKY_TOP_DUSK,   db);
      skyHoriFinal = mix(SKY_HOR_DAY,     SKY_HOR_DUSK,   db * db);
    }
    if (int(uSc) == 0) {
      float db = uBl * uBl;
      skyTopFinal  = mix(SKY_TOP_DAWN,    SKY_TOP_DAY,    db);
      skyHoriFinal = mix(SKY_HOR_DAWN,    SKY_HOR_DAY,    uBl);
    }

    float gradExp = SKY_GRAD_EXP;
    if (int(uSc) == 2) gradExp = 0.22;
    if (int(uSc) == 1) {
      float db = uBl * uBl * uBl * uBl * uBl;
      gradExp = mix(SKY_GRAD_EXP, 0.22, db);
    }

    skyCol = mix(skyHoriFinal, skyTopFinal, pow(elev, gradExp));

    if (int(uSc) == 2 || (int(uSc) == 1 && uBl > 0.6)) {
      float duskAmt = (int(uSc) == 2) ? 1.0 : (uBl - 0.6) / 0.4;
      float midBand = exp(-pow((elev - 0.12) / 0.09, 2.0));
      vec3  crimson = vec3(0.78, 0.10, 0.04);
      skyCol = mix(skyCol, crimson, midBand * 0.55 * duskAmt);
    }

    float cn1    = noise(vec2(rd.x * CLOUD_FREQ_A + rd.y * 3.0, uT * CLOUD_TIME_A));
    float cn2    = noise(vec2(rd.x * CLOUD_FREQ_B - rd.y * 4.0, uT * CLOUD_TIME_B));
    float clouds = smoothstep(CLOUD_THRESH_LO, CLOUD_THRESH_HI,
                              cn1 * CLOUD_BLEND_A + cn2 * CLOUD_BLEND_B);
    clouds *= smoothstep(CLOUD_HOR_LO, CLOUD_HOR_HI, rd.y)
           * (CLOUD_AMT_BASE + storm * CLOUD_AMT_STORM);
    vec3 cloudC  = mix(CLOUD_COL_CLEAR, CLOUD_COL_STORM, storm);
    skyCol = mix(skyCol, mix(skyCol * CLOUD_DARKEN, cloudC, CLOUD_MIX), clouds);

    float sd = max(dot(rd, sunDir), 0.0);
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_A) * SUN_HALO_SCL_A * sunGlow;
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_B) * SUN_HALO_SCL_B * sunGlow;
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_C) * SUN_HALO_SCL_C * sunGlow;
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_D) * SUN_HALO_SCL_D * sunGlow;
    skyCol += sunCol * smoothstep(SUN_DISK_LO, SUN_DISK_HI, dot(rd, sunDir))
                     * SUN_DISK_SCL * sunGlow;
    skyCol += sunCol * exp(-abs(rd.y) * SUN_HORIZON_FALL) * SUN_HORIZON_SCL * sunGlow;

    if (moonAmt > MOON_THRESHOLD) {
      float md = max(dot(rd, moonDir), 0.0);
      skyCol += MOON_COL_DISK   * smoothstep(MOON_DISK_LO, MOON_DISK_HI, dot(rd, moonDir))
                                * MOON_DISK_SCL * moonAmt;
      skyCol += MOON_COL_CORONA * pow(md, MOON_CORONA_EXP) * MOON_CORONA_SCL * moonAmt;
      skyCol += MOON_COL_HALO1  * pow(md, MOON_HALO1_EXP)  * MOON_HALO1_SCL  * moonAmt;
      skyCol += MOON_COL_HALO2  * pow(md, MOON_HALO2_EXP)  * MOON_HALO2_SCL  * moonAmt;
    }

    float predawnStars = smoothstep(0.833, 0.916, s);
    float starVis = max(night, predawnStars);
    if (starVis > NIGHT_STARS_THRESHOLD) {
      float starAngle = uT * 0.008;
      float cT = cos(starAngle), sT = sin(starAngle);
      vec3 srd = vec3(mat2(cT,-sT,sT,cT) * rd.xy, rd.z);

      float sn  = hash(srd.xy * 300.0 + vec2(srd.z * 300.0));
      float sBright = pow(clamp(sn - 0.9994, 0.0, 1.0) * 1667.0, 1.6);
      float sMedium = pow(clamp(sn - 0.998,  0.0, 1.0) *  500.0, 2.0) * 0.30;
      float sFaint  = pow(clamp(sn - 0.993,  0.0, 1.0) *  143.0, 2.0) * 0.07;
      float stars = sBright + sMedium + sFaint;
      float scintSpeed = 0.30 + sn * 0.60;
      stars *= 0.92 + 0.08 * sin(uT * scintSpeed + sn * 19.7);

      float starMask = smoothstep(STAR_HOR_LO, STAR_HOR_HI, rd.y)
                     * (1.0 - storm * STAR_STORM_SUPP);
      skyCol += vec3(stars) * starMask * starVis * STAR_NIGHT_SCL;
    }

    skyCol += LT_COL_SHEET * ltFlash * LT_SHEET_BRIGHT;

    if (ltFlash > 0.003 && rd.y > LT_BOLT_ELEV_MIN && rd.y < LT_BOLT_ELEV_MAX) {
      float screenX = rd.x / max(0.05, -rd.z);
      float elevN   = (rd.y - LT_BOLT_ELEV_MIN) / (LT_BOLT_ELEV_MAX - LT_BOLT_ELEV_MIN);
      float boltGlow = 0.0;
      float horizFade = smoothstep(0.0, 0.12, elevN);

      // Procedural lightning bolt segment evaluation
      for (int bi = 0; bi < 2; bi++) {
        float bSeed = ltSlot * 7.3 + float(bi) * 50.0;
        float j     = bSeed * 17.3;
        float curX  = (hash(vec2(bSeed, 0.3)) - 0.5) * 1.0;
        
        for (int i = 0; i < 16; i++) {
          float fi = float(i);
          float segHi = 1.0 - fi / 16.0;
          float segLo = 1.0 - (fi + 1.0) / 16.0;
          float nextX = curX + (hash(vec2(j + fi * 0.71, 2.0)) - 0.5) * 0.06;

          if (elevN >= segLo && elevN < segHi) {
            float t = (segHi - elevN) / (segHi - segLo);
            float cx = mix(curX, nextX, t);
            float dM = abs(screenX - cx);
            boltGlow += smoothstep(0.0007, 0.0, dM) * 4.5;
            boltGlow += exp(-dM * 120.0) * 1.2;
            boltGlow += exp(-dM * 40.0)  * 0.35;
          }
          curX = nextX;
        }
      }

      skyCol += LT_COL_BOLT * boltGlow * ltFlash * horizFade;
    }

    float hzMist = exp(-abs(rd.y) * mix(HZ_MIST_CLEAR, HZ_MIST_STORM, storm));
    skyCol += fogCol * hzMist * (HZ_MIST_SCL + storm * HZ_MIST_STORM_ADD);
    skyCol  = mix(skyCol, skyCol * STORM_SKY_TINT, storm * STORM_SKY_TINT_AMT);
  }

  float seaMix = pow(smoothstep(0.0, SEA_HORIZON_BLEND, rd.y), SEA_HORIZON_EXP);
  vec3  col;

  if (seaMix > SEA_MIX_THRESHOLD) {
    vec3 p;
    seaTrace(ori, rd, p, seaH, seaCh, seaT);
    vec3  dist   = p - ori;
    float eps    = dot(dist, dist) * SEA_NORMAL_EPS_K / uR.x;
    vec3  n      = seaNormal(p, eps, seaH, seaCh, seaT);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), FRESNEL_EXP) * FRESNEL_SCL;

    vec3  reflDir = reflect(rd, n);
    float rElev   = clamp(reflDir.y, 0.0, 1.0);
    vec3  reflSky = mix(skyHori, skyTop, pow(rElev, SKY_GRAD_EXP));

    float rSun = max(dot(reflDir, sunDir), 0.0);
    reflSky += sunCol * pow(rSun, REFL_SUN_EXP_A) * REFL_SUN_SCL_A * sunGlow;
    reflSky += sunCol * pow(rSun, REFL_SUN_EXP_B) * REFL_SUN_SCL_B * sunGlow;

    if (moonAmt > MOON_THRESHOLD) {
      float rMoon = max(dot(reflDir, moonDir), 0.0);
      reflSky += REFL_MOON_COL_A * pow(rMoon, REFL_MOON_EXP_A) * REFL_MOON_SCL_A * moonAmt;
      reflSky += REFL_MOON_COL_B * pow(rMoon, REFL_MOON_EXP_B) * REFL_MOON_SCL_B * moonAmt;
      reflSky += REFL_MOON_COL_C * pow(rMoon, REFL_MOON_EXP_C) * REFL_MOON_SCL_C * moonAmt;
    }

    float diff      = pow(dot(n, sunDir) * DIFF_WRAP + DIFF_LIFT, DIFF_EXP) * sunGlow;
    vec3  refracted = seaBase + diff * seaWater * DIFF_WATER_SCL;
    vec3  waterCol  = mix(refracted, reflSky, fresnel);

    float atten = max(1.0 - dot(dist, dist) * SSS_ATTEN_K, 0.0);
    waterCol   += seaWater * (p.y - seaH) * SSS_SCL * atten;

    float specNrm = (SPEC_EXP + 8.0) / (PI * 8.0);
    float spec    = pow(max(dot(reflect(-sunDir, n), -rd), 0.0), SPEC_EXP) * specNrm;
    waterCol     += sunCol * spec * sunAbove;

    float glitter = noise(p.xz * GLITTER_UV_SCL + vec2(uT * GLITTER_TIME_U, uT * GLITTER_TIME_V));
    waterCol += sunCol * smoothstep(GLITTER_THRESH, 1.0, glitter) * GLITTER_SCL * sunGlow * sunAbove;

    if (moonAmt > MOON_THRESHOLD) {
      waterCol += MSPEC_COL_A * pow(max(dot(reflect(-moonDir,n),-rd),0.0), MSPEC_EXP_A) * MSPEC_SCL_A * moonAmt;
      waterCol += MSPEC_COL_B * pow(max(dot(reflect(-moonDir,n),-rd),0.0), MSPEC_EXP_B) * MSPEC_SCL_B * moonAmt;
    }

    waterCol += LT_COL_SHEET * ltFlash * LT_WATER_BRIGHT;
    waterCol = mix(waterCol, fogCol, 1.0 - exp(-length(dist) * fogDen * FOG_SCALE));

    col = mix(skyCol, waterCol, seaMix);
  } else {
    col = skyCol;
  }

  col  = mix(fogCol, col, smoothstep(HOR_EDGE_LO, HOR_EDGE_HI, rd.y) * HOR_BLEND
           + (1.0 - HOR_BLEND));
  col += (hash(gl_FragCoord.xy * GRAIN_UV_SCL + floor(uT * GRAIN_TIME_SCL)) - 0.5)
       * GRAIN_STR;
  gl_FragColor = vec4(clamp(pow(col, vec3(GAMMA)), 0.0, 1.0), 1.0);
}
`;

const SCENE_NAMES = ["DAWN", "MIDDAY", "DUSK", "STORM", "NIGHT", "PRE-DAWN"];
const SCENE_DESCS = [
  "Gold floods the horizon. Warm amber and peach across every swell.",
  "Full light. Deep cerulean sea scattering white specular across every swell.",
  "The sun descends in copper and ember. Long reflections stretch across darkening water.",
  "Waves amplify. The sky thickens. Multi-branch lightning across the western ocean.",
  "Stars emerge. The moon leaves a silver path on the swells.",
  "The last stars hold. A red-orange ember glows at the edge of the world."
];

// Scene text color palette from original implementation
const SCENE_COLORS = [
  [255, 185, 80],  // DAWN     - warm gold
  [210, 235, 255], // MIDDAY   - cool sky white
  [255, 175, 80],  // DUSK     - amber-orange
  [180, 188, 205], // STORM    - cold grey-white
  [110, 138, 225], // NIGHT    - blue-indigo moonlight
  [150, 140, 185], // PRE-DAWN - dusty lavender
];

const lerpColor = (a: number[], b: number[], t: number): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const getSceneColor = (s: number): [number, number, number] => {
  const raw = s * (SCENE_COLORS.length - 1);
  const i = Math.min(Math.floor(raw), SCENE_COLORS.length - 2);
  return lerpColor(SCENE_COLORS[i], SCENE_COLORS[i + 1], raw - i);
};

const applySceneColor = (s: number) => {
  if (typeof document === "undefined") return;
  const [r, g, b] = getSceneColor(s);
  const root = document.documentElement;
  root.style.setProperty("--fg", `rgb(${r},${g},${b})`);
  root.style.setProperty("--fg-hud", `rgba(${r},${g},${b},0.75)`);
  root.style.setProperty("--fg-dot", `rgba(${r},${g},${b},0.3)`);
  root.style.setProperty("--fg-dotact", `rgba(${r},${g},${b},0.95)`);

  const nightT = Math.max(0, Math.min(1, (s - 0.583) / 0.25));
  const scrimVal = (0.18 + nightT * 0.56).toFixed(3);
  root.style.setProperty("--scrim", scrimVal);
};

const getMumbaiTimeRatio = (): number => {
  try {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const h = ist.getHours() + ist.getMinutes() / 60;

    // 05:30 - 08:30 -> DAWN (0.0)
    if (h >= 5.5 && h < 8.5) return 0.0;
    // 08:30 - 16:45 -> MIDDAY (0.2)
    if (h >= 8.5 && h < 16.75) return 0.2;
    // 16:45 - 19:15 -> DUSK (0.4)
    if (h >= 16.75 && h < 19.25) return 0.4;
    // 19:15 - 22:30 -> STORM (0.6)
    if (h >= 19.25 && h < 22.5) return 0.6;
    // 22:30 - 03:30 -> NIGHT (0.8)
    if (h >= 22.5 || h < 3.5) return 0.8;
    // 03:30 - 05:30 -> PRE-DAWN (1.0)
    return 1.0;
  } catch {
    return 0.2;
  }
};

export const OceanSkyBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialRatio = getMumbaiTimeRatio();
  const initialSceneIdx = Math.min(SCENE_NAMES.length - 1, Math.round(initialRatio * (SCENE_NAMES.length - 1)));
  const [currentSceneIdx, setCurrentSceneIdx] = useState<number>(initialSceneIdx);
  const [isCinematic, setIsCinematic] = useState<boolean>(false);
  const isCinematicRef = useRef<boolean>(false);

  // Direct DOM element refs to eliminate 60 FPS React root re-renders
  const sceneNameRef = useRef<HTMLSpanElement | null>(null);
  const hudPctRef = useRef<HTMLSpanElement | null>(null);
  const progFillRef = useRef<HTMLDivElement | null>(null);
  const lastPRef = useRef<number>(-1);
  const lastIdxRef = useRef<number>(-1);
  const lastColorSRef = useRef<number>(-1);

  // Smooth interpolation target initialized to real-time Mumbai time (Option A)
  const targetSmoothRef = useRef<number>(initialRatio);
  const currentSmoothRef = useRef<number>(initialRatio);

  useEffect(() => {
    isCinematicRef.current = isCinematic;
    if (typeof document !== "undefined") {
      if (isCinematic) {
        document.body.classList.add("cinematic-mode");
      } else {
        document.body.classList.remove("cinematic-mode");
      }
    }
  }, [isCinematic]);

  const setScene = useCallback((idx: number) => {
    const targetRatio = idx / (SCENE_NAMES.length - 1);
    targetSmoothRef.current = targetRatio;

    // Smoothly scroll active page container to match
    const containers = document.querySelectorAll<HTMLElement>(".overflow-y-auto, .overflow-auto");
    for (let i = 0; i < containers.length; i++) {
      const c = containers[i];
      if (c.scrollHeight > c.clientHeight + 10 && c.clientHeight > 150) {
        c.scrollTo({
          top: targetRatio * (c.scrollHeight - c.clientHeight),
          behavior: "smooth",
        });
        break;
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      console.warn("WebGL not supported for OceanSkyBackground");
      return;
    }

    // Compile helper
    const compileShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vert = compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const frag = compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vert || !frag) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(prog));
      return;
    }

    gl.useProgram(prog);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRLoc = gl.getUniformLocation(prog, "uR");
    const uTLoc = gl.getUniformLocation(prog, "uT");
    const uSLoc = gl.getUniformLocation(prog, "uS");
    const uScLoc = gl.getUniformLocation(prog, "uSc");
    const uBlLoc = gl.getUniformLocation(prog, "uBl");

    // Responsive resize with DPR cap for 60fps performance
    const handleResize = () => {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        gl.viewport(0, 0, pw, ph);
      }
      gl.uniform2f(uRLoc, pw, ph);
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });

    // ── Unified Scroll & Wheel Observers ──────────────────────────────────────
    // 1. Capture scroll on window, document, and ANY scrollable sub-container (Active only in Full Ocean View)
    let cachedScrollEl: HTMLElement | null = null;
    const handleScroll = (e?: Event) => {
      if (!isCinematicRef.current) return;
      let scrollRatio = -1;
      const target = e?.target as HTMLElement | Document | Window | null;

      if (target && target instanceof HTMLElement && target.scrollHeight > target.clientHeight + 10) {
        cachedScrollEl = target;
        scrollRatio = target.scrollTop / (target.scrollHeight - target.clientHeight);
      } else if (cachedScrollEl && cachedScrollEl.isConnected && cachedScrollEl.scrollHeight > cachedScrollEl.clientHeight + 10) {
        scrollRatio = cachedScrollEl.scrollTop / (cachedScrollEl.scrollHeight - cachedScrollEl.clientHeight);
      } else {
        // Fallback: check any visible scroll container
        const containers = document.querySelectorAll<HTMLElement>(".overflow-y-auto, .overflow-auto");
        for (let i = 0; i < containers.length; i++) {
          const c = containers[i];
          if (c.scrollHeight > c.clientHeight + 10 && c.clientHeight > 150) {
            cachedScrollEl = c;
            scrollRatio = c.scrollTop / (c.scrollHeight - c.clientHeight);
            break;
          }
        }
        if (scrollRatio < 0) {
          const winMax = document.documentElement.scrollHeight - window.innerHeight;
          if (winMax > 10) {
            scrollRatio = (window.scrollY || document.documentElement.scrollTop) / winMax;
          }
        }
      }

      if (scrollRatio >= 0) {
        targetSmoothRef.current = Math.max(0, Math.min(1, scrollRatio));
      }
    };

    // Use capture: true so scroll events from internal div.overflow-y-auto containers are caught!
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    // 2. Wheel Listener: Forward scroll events to active scrollable modal/dashboard
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      // If hovering directly over deck.gl 3D map canvas, let DeckGL handle zooming unless user holds Shift or Alt
      if (target && target.tagName.toLowerCase() === "canvas" && target.id !== "webgl_canvas") {
        if (!e.shiftKey && !e.altKey) {
          return;
        }
      }

      // Check if user is scrolling inside an inner scrollable container (e.g. WeatherPortalView)
      let el = target;
      let scrollContainer: HTMLElement | null = null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 10
        ) {
          scrollContainer = el;
          break;
        }
        el = el.parentElement;
      }

      if (scrollContainer) {
        // Let the container scroll naturally; handleScroll captures and updates targetSmoothRef smoothly
        return;
      }

      // If user scrolls on background/margin while a scrollable view is open, forward scroll to that view
      const activeContainer = document.querySelector<HTMLElement>(".overflow-y-auto, .overflow-auto");
      if (activeContainer && activeContainer.scrollHeight > activeContainer.clientHeight + 10) {
        activeContainer.scrollTop += e.deltaY;
        return;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });

    let isTabVisible = true;
    const handleVisibility = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    let animId: number;
    const t0 = performance.now();
    let lastTime = t0;

    const renderLoop = (now: number) => {
      animId = requestAnimationFrame(renderLoop);
      if (!isTabVisible) return;

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Smoothly approach target scene (SMOOTH_SPEED = 4.5 for cinematic glide)
      const speed = 4.5;
      currentSmoothRef.current +=
        (targetSmoothRef.current - currentSmoothRef.current) *
        (1 - Math.exp(-dt * speed));

      const s = Math.max(0, Math.min(1, currentSmoothRef.current));
      const n = SCENE_NAMES.length;
      const raw = s * (n - 1);
      const si = Math.min(Math.floor(raw), n - 2);
      const bl = raw - si;

      const p = Math.round(s * 100);
      const nextIdx = Math.min(n - 1, Math.round(raw));

      // Direct DOM updates: eliminates 60 React re-renders per second!
      if (p !== lastPRef.current) {
        lastPRef.current = p;
        if (hudPctRef.current) hudPctRef.current.textContent = `${String(p).padStart(3, "0")}%`;
        if (progFillRef.current) progFillRef.current.style.width = `${p}%`;
      }
      if (nextIdx !== lastIdxRef.current) {
        lastIdxRef.current = nextIdx;
        setCurrentSceneIdx(nextIdx);
        if (sceneNameRef.current) sceneNameRef.current.textContent = SCENE_NAMES[nextIdx];
      }

      // Throttle root CSS variable updates
      if (Math.abs(s - lastColorSRef.current) > 0.02) {
        lastColorSRef.current = s;
        applySceneColor(s);
      }

      gl.uniform1f(uTLoc, (now - t0) / 1000);
      gl.uniform1f(uSLoc, s);
      gl.uniform1f(uScLoc, si);
      gl.uniform1f(uBlLoc, bl);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, { capture: true } as any);
      window.removeEventListener("wheel", handleWheel);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <>
      {/* Fullscreen High-Performance Procedural WebGL Canvas */}
      <canvas
        ref={canvasRef}
        id="webgl_canvas"
        className="fixed inset-0 w-full h-full object-cover block -z-30 select-none pointer-events-none"
      />

      {/* ── Authentic Transparent Bottom Scrim Overlay ─────────── */}
      <div
        style={{
          background: `linear-gradient(to top, rgba(0, 0, 8, var(--scrim, 0.18)) 0%, rgba(0, 0, 8, calc(var(--scrim, 0.18) * 0.4)) 40%, transparent 70%)`,
        }}
        className="fixed inset-0 pointer-events-none -z-20 transition-opacity duration-500"
      />




      {/* Bottom typography overlay removed per user request to prevent card overlap */}
    </>
  );
};

export default OceanSkyBackground;
