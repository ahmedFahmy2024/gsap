import { CameraRig } from './CameraRig';
import { HeroModel } from './HeroModel';
import { Lighting } from './Lighting';
import { StageAnnotations } from '../sync/StageAnnotations';

/**
 * Scene contents: camera rig + lighting + hero + annotation layer.
 * Responsive composition is the Director's job now — it resolves descriptor
 * poses in normalized stage space (§5) and scales/places heroGroup through
 * the registry — so this component is static and never re-renders.
 *
 * StageAnnotations mounts AFTER HeroModel so the anchors are registered by
 * the time its lookup effect runs.
 */
export function StageScene() {
  return (
    <>
      <CameraRig />
      <Lighting />
      <HeroModel />
      <StageAnnotations />
    </>
  );
}
