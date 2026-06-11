import { ContactShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { CameraRig } from './CameraRig';
import { HeroModel } from './HeroModel';
import { Lighting } from './Lighting';
import { useAppStore } from '../state/store';
import { renderProfiles } from '../systems/quality/quality';

/**
 * World-units of horizontal room the hero composition needs. On narrow
 * viewports the whole composition scales down to fit (a first cut of the
 * normalized stage-space convention, §5 — full per-breakpoint descriptor
 * overrides arrive with the Director in Phase 3).
 */
const HERO_DESIGN_WIDTH = 2.6;

/**
 * Scene contents: camera rig + lighting + hero + grounding shadow.
 * `viewport` only changes on (debounced) resize, so this component
 * re-renders at resize frequency — never per frame.
 */
export function StageScene() {
  const viewport = useThree((s) => s.viewport);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const profile =
    qualityTier === 'static' ? renderProfiles.low : renderProfiles[qualityTier];
  const fit = Math.min(1, viewport.width / HERO_DESIGN_WIDTH);

  return (
    <>
      <CameraRig />
      <Lighting />
      <group scale={fit}>
        <HeroModel />
        {/* Grounding (§9): baked-style contact shadow, rendered once —
            no real-time shadow maps anywhere on the stage. The plane sits
            outside heroFloat so the idle bob floats *above* it. */}
        <ContactShadows
          position={[0, -1.24, 0]}
          opacity={0.55}
          scale={7}
          blur={2.4}
          far={2.4}
          resolution={profile.shadowResolution}
          frames={1}
          color="#000000"
        />
      </group>
    </>
  );
}
