import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3 } from 'three';
import type { Group, PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { transientStore, useAppStore } from '../state/store';
import { stageSpace } from '../story/scenes';
import { registerStageObject } from './registry/registry';

/**
 * Resting pose before the Director's first build = the reference framing
 * the normalized stage space is defined against (story/scenes.ts §5) —
 * keeping the two in one place is what makes authored fractions land where
 * they were tuned.
 */
const RIG_POSITION: [number, number, number] = [
  0,
  0.2,
  stageSpace.referenceDistance,
];

/**
 * Mouse-parallax extents (world units) and damping response. Deliberately
 * small: the offset reads as the camera "breathing" toward the cursor, not
 * as a second camera move competing with the choreography. The lookAt runs
 * after the offset, so the composition re-aims and the result is a subtle
 * orbit around the scene's focal point.
 */
const PARALLAX_X = 0.1;
const PARALLAX_Y = 0.06;
/** MathUtils.damp lambda — higher snaps faster; ~3.5 trails the cursor. */
const PARALLAX_DAMPING = 3.5;

/**
 * Camera rig (design §3.4): the camera lives inside a rig group, and GSAP
 * tweens rig position + look-at target position — never camera
 * quaternions — so reframings can't gimbal-flip. The lookAt is applied
 * per-frame here, and the Phase-4 mouse parallax is a damped offset on its
 * own group INSIDE the rig (§6 Layer 3): the Director owns rig.position,
 * the frame loop owns parallax.position, and the transforms compose
 * structurally — the two writers never share a property (§8).
 * The camera object is registered too, but only for fov tweens.
 */
export function CameraRig() {
  const rig = useRef<Group>(null);
  const parallax = useRef<Group>(null);
  const target = useRef<Group>(null);
  const camera = useRef<PerspectiveCameraImpl>(null);
  // Pre-allocated scratch — no allocation inside the frame loop (§8).
  const worldTarget = useRef(new Vector3());
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  useEffect(() => {
    const unregisterRig = registerStageObject('cameraRig', rig.current!);
    const unregisterTarget = registerStageObject(
      'lookAtTarget',
      target.current!,
    );
    const unregisterCamera = registerStageObject('camera', camera.current!);
    return () => {
      unregisterRig();
      unregisterTarget();
      unregisterCamera();
    };
  }, []);

  // Park the parallax offset when motion is reduced, so framing is exact.
  useEffect(() => {
    if (reducedMotion && parallax.current) {
      parallax.current.position.set(0, 0, 0);
    }
  }, [reducedMotion]);

  useFrame((state, delta) => {
    if (!reducedMotion) {
      const offset = parallax.current!.position;
      const { pointerX, pointerY } = transientStore.getState();
      // Frame-rate-independent exponential damping toward the pointer; the
      // pointer values stay 0 on touch devices (usePointerSync is mouse-only).
      offset.x = MathUtils.damp(
        offset.x,
        pointerX * PARALLAX_X,
        PARALLAX_DAMPING,
        delta,
      );
      offset.y = MathUtils.damp(
        offset.y,
        pointerY * PARALLAX_Y,
        PARALLAX_DAMPING,
        delta,
      );
    }
    target.current!.getWorldPosition(worldTarget.current);
    state.camera.lookAt(worldTarget.current);
  });

  return (
    <>
      <group ref={rig} position={RIG_POSITION}>
        <group ref={parallax}>
          <PerspectiveCamera
            ref={camera}
            makeDefault
            fov={stageSpace.referenceFov}
            near={0.1}
            far={40}
          />
        </group>
      </group>
      <group ref={target} position={[0, 0, 0]} />
    </>
  );
}
