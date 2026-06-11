/**
 * Performance / Quality Layer (docs/ENGINEERING_DESIGN.md §3.8, §9).
 *
 * Classifies the device ONCE at boot into a quality tier; every expensive
 * feature reads its enablement from the tier (via useAppStore.qualityTier),
 * never decides locally. Runtime *degradation* (drei PerformanceMonitor)
 * is a Phase 5 deliverable and will lower the tier through the same store.
 *
 * Pure module: no React, no Three — safe to import from the main chunk.
 */

export type QualityTier = 'high' | 'medium' | 'low' | 'static';

/** Renderer knobs each non-static tier is allowed (§9 quality table). */
export interface RenderProfile {
  /** Device-pixel-ratio clamp passed to the Canvas. */
  dpr: [min: number, max: number];
  /** Resolution of the procedural environment map. */
  envResolution: number;
  /** Resolution of the (render-once) contact-shadow target. */
  shadowResolution: number;
}

export const renderProfiles: Record<Exclude<QualityTier, 'static'>, RenderProfile> = {
  high: { dpr: [1, 2], envResolution: 256, shadowResolution: 512 },
  medium: { dpr: [1, 1.5], envResolution: 256, shadowResolution: 256 },
  low: { dpr: [1, 1], envResolution: 128, shadowResolution: 256 },
};

/** Non-standard navigator extensions used as classification hints. */
interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
    );
  } catch {
    return false;
  }
}

/**
 * Boot-time heuristic (§3.8): WebGL availability, reduced-motion +
 * save-data, then coarse capability signals. Deliberately conservative —
 * a wrong 'medium' looks fine; a wrong 'high' janks.
 */
export function classifyQuality(): QualityTier {
  if (!webglAvailable()) {
    return 'static';
  }

  const hints = navigator as Navigator & NavigatorHints;
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  if (reducedMotion && hints.connection?.saveData) {
    return 'static';
  }

  if (hints.deviceMemory !== undefined && hints.deviceMemory <= 2) {
    return 'low';
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const fewCores = navigator.hardwareConcurrency <= 4;
  if (coarsePointer || fewCores || (hints.deviceMemory ?? 8) <= 4) {
    return 'medium';
  }

  return 'high';
}
