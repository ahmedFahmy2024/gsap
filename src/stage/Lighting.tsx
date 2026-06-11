import { Environment, Lightformer } from '@react-three/drei';
import { useAppStore } from '../state/store';
import { renderProfiles } from '../systems/quality/quality';

/**
 * Lighting rig (design §9): a procedural studio environment built from
 * Lightformers and rendered ONCE into an env map (frames={1}) — no HDRI
 * download, no real-time lights, no shadow maps. The grounded look comes
 * from ContactShadows in StageScene. Colors echo styles/tokens.css: warm
 * key, cool rim, an accent-tinted kicker (--color-accent #e8602c family).
 */
export function Lighting() {
  const qualityTier = useAppStore((s) => s.qualityTier);
  const profile =
    qualityTier === 'static' ? renderProfiles.low : renderProfiles[qualityTier];

  return (
    <Environment resolution={profile.envResolution} frames={1}>
      {/* Key — big warm softbox overhead-front; defines the clearcoat sweep */}
      <Lightformer
        form="rect"
        intensity={2.2}
        color="#fff2e2"
        position={[0, 4, 3]}
        scale={[7, 3, 1]}
        target={[0, 0, 0]}
      />
      {/* Rim — cool strip behind-left, separates the dark body from the bg */}
      <Lightformer
        form="rect"
        intensity={1.2}
        color="#dfe7ff"
        position={[-5, 1.5, -2]}
        scale={[3, 5, 1]}
        target={[0, 0, 0]}
      />
      {/* Kicker — accent-warm sliver from the right */}
      <Lightformer
        form="rect"
        intensity={0.7}
        color="#ffd9c2"
        position={[5, 0.5, 1]}
        scale={[2, 4, 1]}
        target={[0, 0, 0]}
      />
      {/* Faint bottom fill so the underside never reads as a void */}
      <Lightformer
        form="ring"
        intensity={0.3}
        color="#ffffff"
        position={[0, -3.5, 4]}
        scale={[4, 4, 1]}
        target={[0, 0, 0]}
      />
    </Environment>
  );
}
