import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';

/**
 * Post-processing pass (§11 Phase 4) — bloom, film grain, vignette.
 * This file is its own lazy chunk, mounted by StageCanvas ONLY on the
 * 'high' quality tier (§9: post is the first thing fillrate-limited
 * devices must not pay for), so `postprocessing` never ships to anyone
 * who can't afford it.
 *
 * The grade is deliberately quiet:
 * - Bloom thresholds at luminance 1 — only HDR emitters glow, which in
 *   this scene means the status LED (descriptor `led` values > 1 are
 *   authored as bloom fuel) and the hottest clearcoat reflections.
 * - Noise premultiplies, so the grain lives in the lit areas of the body
 *   and vanishes into the dark backdrop — film, not static.
 * - Vignette only affects rendered (opaque) pixels on the transparent
 *   canvas — it grades the object, not the page (the DOM backdrop behind
 *   the canvas stays untouched).
 */
export default function StageEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={0.55}
        luminanceThreshold={1}
        luminanceSmoothing={0.2}
      />
      <Noise premultiply opacity={0.5} />
      <Vignette eskil={false} offset={0.28} darkness={0.6} />
    </EffectComposer>
  );
}
