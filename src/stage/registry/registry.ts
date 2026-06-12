import type { Object3D } from 'three';

/**
 * Named ref registry — the ONLY Stage↔Director contract
 * (docs/ENGINEERING_DESIGN.md §3.3, §10).
 *
 * Stage components register their Object3Ds on mount; the Director (and
 * dev tools) animate/mutate through `getStageObject` without ever importing
 * stage internals. The `three` import above is type-only, so pulling this
 * module into the main chunk (the Director lives there) does NOT pull
 * Three.js out of the lazy stage chunk.
 */

export type StageObjectName =
  /** Scrub target: the Director writes the choreographed pose here (Phase 3). */
  | 'heroGroup'
  /** Additive idle-float wrapper inside heroGroup — frame loop only (§6 Layer 3). */
  | 'heroFloat'
  /** Camera rig group; the camera sits inside it (§3.4). */
  | 'cameraRig'
  /** Look-at target the camera tracks every frame (§3.4). */
  | 'lookAtTarget'
  /** The PerspectiveCamera itself — fov tweens only; pose goes through the
   *  rig + target, never camera quaternions (§3.4). */
  | 'camera'
  /** Annotation anchors, e.g. 'anchor:ring' (§7). */
  | `anchor:${string}`;

const stageObjects = new Map<StageObjectName, Object3D>();

/* Change subscription so React consumers (the annotation layer) can resolve
 * objects via useSyncExternalStore instead of effect-time polling — robust
 * against late registration (e.g. a Suspense-loaded glTF committing after
 * the consumer). The Director doesn't subscribe; it rebuilds on stageReady. */
let registryVersion = 0;
const listeners = new Set<() => void>();

function notify(): void {
  registryVersion += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeStageObjects(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Monotonic snapshot for useSyncExternalStore; bumps on every change. */
export function getStageRegistryVersion(): number {
  return registryVersion;
}

/**
 * Registers an object under a stable name. Returns the unregister function
 * so callers can use it directly as a React effect cleanup (StrictMode-
 * symmetric: mount → register, unmount → unregister).
 */
export function registerStageObject(
  name: StageObjectName,
  object: Object3D,
): () => void {
  stageObjects.set(name, object);
  notify();
  return () => {
    if (stageObjects.get(name) === object) {
      stageObjects.delete(name);
      notify();
    }
  };
}

export function getStageObject(name: StageObjectName): Object3D | undefined {
  return stageObjects.get(name);
}

/** Diagnostic helper for dev tools / descriptor validation (Phase 3). */
export function listStageObjects(): StageObjectName[] {
  return [...stageObjects.keys()];
}
