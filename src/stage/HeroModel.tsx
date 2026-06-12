import { ContactShadows } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { ReactNode } from 'react';
import { useAppStore } from '../state/store';
import { renderProfiles } from '../systems/quality/quality';
import { registerStageObject } from './registry/registry';

/*
 * Material palette — echoes styles/tokens.css (--color-accent #e8602c,
 * warm-neutral darks); keep the two in sync by eye when tokens change.
 */
const BODY_COLOR = '#26262a';
const GRILLE_COLOR = '#121215';
const METAL_COLOR = '#cfc9c0';
const BASE_COLOR = '#1b1b1e';
const ACCENT_COLOR = '#e8602c';

/**
 * Idle float (§6 Layer 3) — small, slow, elapsed-based. All three axes are
 * bounded oscillations: Phase 3's Director authors specific yaw framings
 * (and anchors annotations to physical points), so the Phase 2 unbounded
 * yaw drift would slowly walk the presented face — and the labels — away
 * from the choreography. Sway composes; drift fights (§6 Layer 3).
 */
const FLOAT_BOB_AMPLITUDE = 0.05;
const FLOAT_BOB_SPEED = 0.9;
const FLOAT_YAW_AMPLITUDE = 0.06;
const FLOAT_YAW_SPEED = 0.22;
const FLOAT_ROLL_AMPLITUDE = 0.015;
const FLOAT_ROLL_SPEED = 0.6;

/**
 * ORBE — the hero object. Phase 2 ships it as *procedural* geometry
 * (sculpted sphere body, fabric grille cap, machined volume ring, pedestal)
 * so the stage, lighting, and registry contracts are real with zero asset
 * bytes. When an authored glTF lands, only this file changes: swap the
 * primitives for `useGLTF` (see systems/assets/manifest.ts for the
 * pipeline) — the registered names and anchor contract stay identical.
 *
 * Structure (one writer per property, §8):
 *   heroGroup (registered)  — Director-owned pose, scrubbed by Layer 1
 *   ├─ heroFloat (registered) — idle-float wrapper, frame-loop-owned
 *   │  └─ meshes + anchors
 *   └─ contact shadow — inside heroGroup so it travels/scales with the
 *      choreographed pose (and why descriptor rotation is yaw-only: pitch
 *      or roll would tilt the ground plane), but outside heroFloat so the
 *      idle bob floats *above* it.
 */
export function HeroModel() {
  const hero = useRef<Group>(null);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const profile =
    qualityTier === 'static' ? renderProfiles.low : renderProfiles[qualityTier];

  useEffect(() => registerStageObject('heroGroup', hero.current!), []);

  return (
    <group ref={hero} position={[0, 0.06, 0]}>
      <FloatGroup>
        {/* Enclosure — "milled from a single block", soft-squashed sphere */}
        <group scale={[1, 0.94, 1]}>
          <mesh>
            <sphereGeometry args={[1, 96, 64]} />
            <meshPhysicalMaterial
              color={BODY_COLOR}
              roughness={0.32}
              metalness={0.05}
              clearcoat={1}
              clearcoatRoughness={0.18}
              envMapIntensity={1.1}
            />
          </mesh>
          {/* Grille — matte front cap (sphere cap rotated to face +z) */}
          <mesh rotation-x={Math.PI / 2}>
            <sphereGeometry args={[1.005, 96, 32, 0, Math.PI * 2, 0, 0.62]} />
            <meshStandardMaterial
              color={GRILLE_COLOR}
              roughness={0.88}
              metalness={0}
            />
          </mesh>
        </group>

        {/* Volume ring — machined aluminium, seated into the crown */}
        <mesh position={[0, 0.85, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.42, 0.045, 24, 96]} />
          <meshStandardMaterial
            color={METAL_COLOR}
            metalness={1}
            roughness={0.28}
            envMapIntensity={1.2}
          />
        </mesh>

        {/* Status LED — the one point of brand accent */}
        <mesh position={[0, -0.32, 0.945]}>
          <sphereGeometry args={[0.018, 16, 16]} />
          <meshStandardMaterial
            color="#000000"
            emissive={ACCENT_COLOR}
            emissiveIntensity={4}
          />
        </mesh>

        {/* Pedestal base */}
        <mesh position={[0, -1.06, 0]}>
          <cylinderGeometry args={[0.34, 0.42, 0.16, 64]} />
          <meshStandardMaterial
            color={BASE_COLOR}
            metalness={0.9}
            roughness={0.4}
          />
        </mesh>

        {/* Annotation anchors (§7) — named points the Sync Layer projects
            to screen space in Phase 3. A real glTF replaces these with
            artist-placed empties. */}
        <Anchor name="anchor:ring" position={[0, 0.85, 0]} />
        <Anchor name="anchor:grille" position={[0, 0, 1.02]} />
      </FloatGroup>

      {/* Grounding (§9): baked-style contact shadow, rendered once — no
          real-time shadow maps anywhere on the stage. */}
      <ContactShadows
        position={[0, -1.3, 0]}
        opacity={0.55}
        scale={7}
        blur={2.4}
        far={2.4}
        resolution={profile.shadowResolution}
        frames={1}
        color="#000000"
      />
    </group>
  );
}

/**
 * Additive idle motion on its own wrapper group so it composes with — and
 * never fights — the Director's scrubbed pose on heroGroup (§6 Layer 3).
 * Everything derives from elapsed time, so the motion is frame-rate
 * independent (iOS Low Power Mode caps rAF at 30 fps, §12).
 */
function FloatGroup({ children }: { children: ReactNode }) {
  const float = useRef<Group>(null);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  useEffect(() => registerStageObject('heroFloat', float.current!), []);

  // On reduced-motion flip, park the float offsets so framing is exact.
  useEffect(() => {
    if (reducedMotion && float.current) {
      float.current.position.y = 0;
      float.current.rotation.y = 0;
      float.current.rotation.z = 0;
    }
  }, [reducedMotion]);

  useFrame((state) => {
    if (reducedMotion) {
      return;
    }
    const group = float.current!;
    const elapsed = state.clock.elapsedTime;
    group.position.y =
      Math.sin(elapsed * FLOAT_BOB_SPEED) * FLOAT_BOB_AMPLITUDE;
    group.rotation.y =
      Math.sin(elapsed * FLOAT_YAW_SPEED) * FLOAT_YAW_AMPLITUDE;
    group.rotation.z =
      Math.sin(elapsed * FLOAT_ROLL_SPEED + 1.7) * FLOAT_ROLL_AMPLITUDE;
  });

  return <group ref={float}>{children}</group>;
}

function Anchor({
  name,
  position,
}: {
  name: `anchor:${string}`;
  position: [number, number, number];
}) {
  const anchor = useRef<Group>(null);
  useEffect(() => registerStageObject(name, anchor.current!), [name]);
  return <group ref={anchor} position={position} />;
}
