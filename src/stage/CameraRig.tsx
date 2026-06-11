import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { registerStageObject } from './registry/registry';

/** Heroic product-shot framing; the Director tweens the rig in Phase 3. */
const RIG_POSITION: [number, number, number] = [0, 0.2, 6.2];
const CAMERA_FOV = 35;

/**
 * Camera rig (design §3.4): the camera lives inside a rig group, and GSAP
 * will tween rig position + look-at target position — never camera
 * quaternions — so reframings can't gimbal-flip. The lookAt itself is
 * applied per-frame here; mouse-parallax offsets layer on top in Phase 4.
 */
export function CameraRig() {
  const rig = useRef<Group>(null);
  const target = useRef<Group>(null);
  // Pre-allocated scratch — no allocation inside the frame loop (§8).
  const worldTarget = useRef(new Vector3());

  useEffect(() => {
    const unregisterRig = registerStageObject('cameraRig', rig.current!);
    const unregisterTarget = registerStageObject(
      'lookAtTarget',
      target.current!,
    );
    return () => {
      unregisterRig();
      unregisterTarget();
    };
  }, []);

  useFrame((state) => {
    target.current!.getWorldPosition(worldTarget.current);
    state.camera.lookAt(worldTarget.current);
  });

  return (
    <>
      <group ref={rig} position={RIG_POSITION}>
        <PerspectiveCamera makeDefault fov={CAMERA_FOV} near={0.1} far={40} />
      </group>
      <group ref={target} position={[0, 0, 0]} />
    </>
  );
}
