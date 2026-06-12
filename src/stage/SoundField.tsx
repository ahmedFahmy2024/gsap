import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending } from 'three';
import type { Points, PointsMaterial } from 'three';
import { useAppStore } from '../state/store';
import { registerStageHandle } from './registry/registry';

/**
 * The GPU particle moment (§11 Phase 4): a soft ellipsoid field of points
 * around ORBE that materializes during the acoustics chapter — "a field,
 * not a beam" made literal. One draw call, capped count per quality tier,
 * zero allocation after mount.
 *
 * Ownership split (§8 one writer per property):
 *   - opacity     — Director, scrubbed on the master timeline via the
 *                   'material:particles' handle (descriptor environment).
 *   - rotation    — frame loop here (Layer 3 drift, delta-based).
 *   - visible     — frame loop, derived from opacity, so the invisible
 *                   field costs no draw call for ~80% of the page.
 */
const PARTICLE_COUNTS = { high: 900, medium: 450, low: 0 } as const;

/** Field shell radii (world units, pre-heroGroup-scale). */
const INNER_RADIUS = 1.45;
const OUTER_RADIUS = 2.55;
/** Vertical squash: a soundfield reads as a wide halo, not a ball. */
const UPPER_SQUASH = 0.8;
/** Lower hemisphere flattens harder so the field stays above the contact
 *  shadow plane at y = -1.3 instead of raining through the floor. */
const LOWER_SQUASH = 0.42;
const DRIFT_SPEED = 0.045;

/** Points participate in raycasts by default (threshold-based); opting out
 *  keeps the field from falsely occluding drei <Html> annotation labels. */
const NO_RAYCAST = () => null;

/** Deterministic PRNG (mulberry32): render-pure per the React Compiler
 *  rules, and the field layout survives HMR/StrictMode remounts unchanged. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function SoundField() {
  const points = useRef<Points>(null);
  const material = useRef<PointsMaterial>(null);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const count =
    qualityTier === 'static' ? 0 : PARTICLE_COUNTS[qualityTier];

  const positions = useMemo(() => {
    const random = mulberry32(0x0e8b);
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Uniform direction via cos-distributed polar angle; bias the radius
      // outward (sqrt) so the shell doesn't clump at its inner wall.
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const radius =
        INNER_RADIUS + (OUTER_RADIUS - INNER_RADIUS) * Math.sqrt(random());
      const y = radius * cosPhi;
      array[i * 3] = radius * sinPhi * Math.cos(theta);
      array[i * 3 + 1] = y * (y < 0 ? LOWER_SQUASH : UPPER_SQUASH);
      array[i * 3 + 2] = radius * sinPhi * Math.sin(theta);
    }
    return array;
  }, [count]);

  useEffect(() => {
    if (material.current) {
      return registerStageHandle('material:particles', material.current);
    }
  }, [count]);

  useFrame((_, delta) => {
    const field = points.current;
    const mat = material.current;
    if (!field || !mat) {
      return;
    }
    // Frame loop owns `visible`: a fully faded field skips its draw call.
    field.visible = mat.opacity > 0.001;
    if (field.visible && !reducedMotion) {
      field.rotation.y += delta * DRIFT_SPEED;
    }
  });

  if (count === 0) {
    return null;
  }

  return (
    <points ref={points} raycast={NO_RAYCAST} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#8fb0ff"
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
