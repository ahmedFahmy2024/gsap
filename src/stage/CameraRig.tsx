import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { Group, PerspectiveCamera as PerspectiveCameraImpl } from 'three';
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
 * Camera rig (design §3.4): the camera lives inside a rig group, and GSAP
 * tweens rig position + look-at target position — never camera
 * quaternions — so reframings can't gimbal-flip. The lookAt itself is
 * applied per-frame here; mouse-parallax offsets layer on top in Phase 4.
 * The camera object is registered too, but only for fov tweens.
 */
export function CameraRig() {
  const rig = useRef<Group>(null);
  const target = useRef<Group>(null);
  const camera = useRef<PerspectiveCameraImpl>(null);
  // Pre-allocated scratch — no allocation inside the frame loop (§8).
  const worldTarget = useRef(new Vector3());

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

  useFrame((state) => {
    target.current!.getWorldPosition(worldTarget.current);
    state.camera.lookAt(worldTarget.current);
  });

  return (
    <>
      <group ref={rig} position={RIG_POSITION}>
        <PerspectiveCamera
          ref={camera}
          makeDefault
          fov={stageSpace.referenceFov}
          near={0.1}
          far={40}
        />
      </group>
      <group ref={target} position={[0, 0, 0]} />
    </>
  );
}
