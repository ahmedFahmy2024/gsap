import { useControls } from 'leva';
import { Perf } from 'r3f-perf';
import { getStageObject } from './registry/registry';

/**
 * Dev-only tuning surface (design §11 Phase 2: Leva panel + r3f-perf).
 * Lazy-loaded by StageCanvas behind `import.meta.env.DEV`, so neither
 * library reaches the production bundle.
 *
 * Every control mutates through the ref registry — the same write path
 * the Director uses in Phase 3 — via transient `onChange` callbacks, so
 * dragging a slider never re-renders React.
 */
export default function StageDevTools() {
  useControls('hero', {
    yaw: {
      value: 0,
      min: -Math.PI,
      max: Math.PI,
      onChange: (value: number) => {
        const hero = getStageObject('heroGroup');
        if (hero) {
          hero.rotation.y = value;
        }
      },
    },
    y: {
      value: 0.06,
      min: -1.5,
      max: 1.5,
      onChange: (value: number) => {
        const hero = getStageObject('heroGroup');
        if (hero) {
          hero.position.y = value;
        }
      },
    },
    x: {
      value: 0,
      min: -3,
      max: 3,
      onChange: (value: number) => {
        const hero = getStageObject('heroGroup');
        if (hero) {
          hero.position.x = value;
        }
      },
    },
  });

  useControls('camera rig', {
    z: {
      value: 6.2,
      min: 3,
      max: 12,
      onChange: (value: number) => {
        const rig = getStageObject('cameraRig');
        if (rig) {
          rig.position.z = value;
        }
      },
    },
    y: {
      value: 0.2,
      min: -2,
      max: 3,
      onChange: (value: number) => {
        const rig = getStageObject('cameraRig');
        if (rig) {
          rig.position.y = value;
        }
      },
    },
  });

  return <Perf position="top-left" />;
}
