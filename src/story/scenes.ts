/**
 * Scene descriptors — the full story definition (docs/ENGINEERING_DESIGN.md §5).
 *
 * Each chapter is a plain, serializable descriptor: object pose, camera pose,
 * environment state, content binding, annotations, transition spec, and
 * responsive overrides. The Director (systems/director) is a generic
 * interpreter of this array; adding scene #6 means appending a descriptor and
 * a DOM section — no new animation code. Pure data: no imports from
 * React/GSAP/Three (§10 — this is the future CMS seam).
 *
 * Coordinate convention (§5 normalized stage space):
 *   x — fraction of the stage width, measured from center (+ is right)
 *   y — fraction of the stage height, measured from center (+ is up)
 *   z — absolute world units (+ is toward the camera)
 * "Stage" size is the world-space rectangle the reference camera sees at
 * z = 0 (see `stageSpace`); the Director resolves fractions to world units
 * at tween-init time, so descriptors survive resizes and aspect changes.
 */

/** A point in normalized stage space (see module doc). */
export interface StagePoint {
  x: number;
  y: number;
  z: number;
}

export interface HeroPose {
  position: StagePoint;
  /**
   * Y-axis rotation in radians. Yaw-only by design: the hero carries its
   * baked contact shadow, so pitch/roll would tilt the ground plane.
   * Pitch drama is authored through camera height + lookAt instead.
   */
  yaw: number;
  /** Uniform scale; multiplied by the responsive fit clamp at resolution. */
  scale: number;
}

export interface CameraPose {
  /** Camera-rig position (the camera sits inside the rig, §3.4). */
  position: StagePoint;
  /** Look-at target position; the camera tracks it every frame. */
  lookAt: StagePoint;
  /** Field of view, degrees. */
  fov: number;
}

/**
 * Environment state (§5): the page backdrop tint behind the canvas plus the
 * Phase 4 material color story. All values ride the master scrub timeline —
 * the Director tweens them through registry material handles — so the mood
 * is a pure function of scroll position, like every pose.
 */
export interface EnvironmentState {
  /** Page backdrop tint (CSS color, tweened on the DOM backdrop div). */
  backdrop: string;
  /** Status-LED emissive intensity. Values > 1 feed the high-tier bloom. */
  led: number;
  /**
   * Fresnel-style rim accent on the enclosure (physical-material sheen).
   * MUST stay > 0 in every scene: the shader compiles the sheen path only
   * when sheen > 0, and crossing zero mid-scroll would recompile mid-frame.
   */
  sheen: number;
  /** sRGB hex tint of that rim accent — the per-chapter color story. */
  sheenColor: string;
  /** Enclosure env-map intensity — how much the studio light mood reads. */
  bodyEnv: number;
  /** Volume-ring env-map intensity — pushed up for the detail close-up. */
  ringEnv: number;
  /** Soundfield particle opacity 0–1 (the acoustics "field" moment). */
  particles: number;
}

export interface SceneAnnotation {
  /** Globally unique; the Director toggles visibility under this id. */
  id: string;
  /** Named anchor registered by the stage (artist-placed empties in a glTF). */
  anchor: `anchor:${string}`;
  text: string;
  /**
   * [enter, leave] in local section traversal progress 0–1, where 0 is
   * "section top touches viewport bottom" and 1 is "section bottom leaves
   * viewport top".
   */
  visibleRange: [number, number];
}

/** Inbound transition: how the scene is travelled INTO from the previous one. */
export interface TransitionSpec {
  /** Ease token name from story/motion.ts. */
  ease: 'travel' | 'reveal' | 'exit';
  /**
   * Fraction (0–1) of the inbound scroll gap during which the previous pose
   * holds before travel begins — the "read the copy, then the object moves"
   * rhythm. 0.35 ≈ rest for a third of the gap, travel through the rest.
   */
  hold: number;
}

/** Partial descriptor deep-merged over the base per breakpoint (§5). */
export interface ScenePatch {
  hero?: {
    position?: Partial<StagePoint>;
    yaw?: number;
    scale?: number;
  };
  camera?: {
    position?: Partial<StagePoint>;
    lookAt?: Partial<StagePoint>;
    fov?: number;
  };
  environment?: Partial<EnvironmentState>;
  /** Replaces the annotation list wholesale (mobile drops density, §7). */
  annotations?: SceneAnnotation[];
}

export const breakpointQueries = {
  mobile: '(max-width: 47.99rem)',
  tablet: '(min-width: 48rem) and (max-width: 74.99rem)',
  /** §12: landscape phones are their own breakpoint, not "small desktop". */
  landscapePhone: '(max-height: 32rem) and (orientation: landscape)',
} as const;

export type BreakpointName = keyof typeof breakpointQueries;

/** Merge order: later entries win where queries overlap (most specific last). */
export const breakpointMergeOrder: readonly BreakpointName[] = [
  'tablet',
  'mobile',
  'landscapePhone',
];

export interface SceneDescriptor {
  /** Matches the DOM section id, the chapter id, and the timeline label. */
  id: string;
  name: string;
  hero: HeroPose;
  camera: CameraPose;
  environment: EnvironmentState;
  transition: TransitionSpec;
  /**
   * Local section progress (0–1 of "section top: viewport bottom → viewport
   * top") at which the DOM copy reveal triggers (Layer 2). 0.3 ≈ the Phase 1
   * 'top 70%' feel.
   */
  contentRevealAt: number;
  annotations: SceneAnnotation[];
  responsive: Partial<Record<BreakpointName, ScenePatch>>;
}

/**
 * Reference stage geometry. The rig's resting pose lives here so the stage
 * (CameraRig) and the Director resolve the SAME stage-space basis; the basis
 * always uses the reference distance/FOV, never the scrubbed camera pose, so
 * authored fractions stay deterministic while the camera travels.
 */
export const stageSpace = {
  referenceFov: 35,
  referenceDistance: 6.2,
  /** World-units of width the hero composition wants; below this the
   *  resolved hero scale clamps down proportionally (replaces the Phase 2
   *  StageScene fit scalar). */
  heroDesignWidth: 2.6,
} as const;

/*
 * Yaw choreography: 0 → π (craft shows the seamless back) → 2π (acoustics
 * returns the grille to camera) → 2π+0.85 (detail angles the crown) → 2π
 * (CTA settles back to the heroic front). Monotonic-ish and numeric, so
 * scrubbing can never gimbal-flip (§3.4).
 */
const TAU = Math.PI * 2;

export const scenes: SceneDescriptor[] = [
  {
    id: 'hero',
    name: 'Hero — center stage',
    hero: { position: { x: 0, y: 0.015, z: 0 }, yaw: 0, scale: 1 },
    camera: {
      position: { x: 0, y: 0.05, z: 6.2 },
      lookAt: { x: 0, y: 0.01, z: 0 },
      fov: 35,
    },
    // Resting mood — HeroModel's initial material props read THIS scene's
    // environment, so the pre-scroll frame and the scrubbed t=0 frame match.
    environment: {
      backdrop: '#0b0b0c',
      led: 4,
      sheen: 0.12,
      sheenColor: '#566070',
      bodyEnv: 1.1,
      ringEnv: 1.2,
      particles: 0,
    },
    transition: { ease: 'travel', hold: 0 },
    contentRevealAt: 0.3,
    annotations: [],
    responsive: {
      mobile: { hero: { scale: 0.85 }, camera: { position: { z: 6.8 } } },
      landscapePhone: { hero: { scale: 0.6 }, camera: { position: { z: 6.8 } } },
    },
  },
  {
    id: 'craft',
    name: 'Craft — the seamless enclosure',
    hero: { position: { x: -0.21, y: 0.01, z: 0 }, yaw: Math.PI, scale: 0.94 },
    camera: {
      position: { x: -0.05, y: 0.05, z: 5.5 },
      lookAt: { x: -0.21, y: 0.02, z: 0 },
      fov: 35,
    },
    // Warm milled-metal mood while the seamless back is presented; the LED
    // faces away here, so it dims rather than glowing through the body.
    environment: {
      backdrop: '#100d0d',
      led: 2.5,
      sheen: 0.3,
      sheenColor: '#ffb38a',
      bodyEnv: 1.3,
      ringEnv: 1.1,
      particles: 0,
    },
    transition: { ease: 'travel', hold: 0.35 },
    contentRevealAt: 0.3,
    annotations: [],
    responsive: {
      tablet: {
        hero: { position: { x: -0.14 } },
        camera: { lookAt: { x: -0.14 } },
      },
      mobile: {
        hero: { position: { x: 0, y: 0.1 }, scale: 0.7 },
        camera: { position: { x: 0, z: 6.4 }, lookAt: { x: 0, y: 0.12 } },
      },
      landscapePhone: {
        hero: { position: { x: -0.18, y: 0 }, scale: 0.55 },
        camera: { position: { z: 6 }, lookAt: { x: -0.18, y: 0 } },
      },
    },
  },
  {
    id: 'acoustics',
    name: 'Acoustics — the grille faces you',
    hero: { position: { x: 0.21, y: 0.015, z: 0 }, yaw: TAU, scale: 1 },
    camera: {
      position: { x: 0.05, y: 0.04, z: 5.3 },
      lookAt: { x: 0.21, y: 0.02, z: 0 },
      fov: 37,
    },
    // The "field, not a beam" moment: cool rim, bright LED beacon, and the
    // soundfield particles at full presence — the page's one particle beat.
    environment: {
      backdrop: '#0a0d12',
      led: 5.5,
      sheen: 0.22,
      sheenColor: '#8fb0ff',
      bodyEnv: 1.05,
      ringEnv: 1.2,
      particles: 0.8,
    },
    transition: { ease: 'travel', hold: 0.35 },
    contentRevealAt: 0.3,
    annotations: [
      {
        id: 'acoustics-waveguide',
        anchor: 'anchor:grille',
        text: 'Sculpted tri-driver waveguide',
        visibleRange: [0.3, 0.8],
      },
    ],
    responsive: {
      tablet: {
        hero: { position: { x: 0.14 } },
        camera: { lookAt: { x: 0.14 } },
      },
      mobile: {
        hero: { position: { x: 0, y: 0.1 }, scale: 0.72 },
        camera: { position: { x: 0, z: 6.2 }, lookAt: { x: 0, y: 0.12 } },
      },
      landscapePhone: {
        hero: { position: { x: 0.18, y: 0 }, scale: 0.55 },
        camera: { position: { z: 6 }, lookAt: { x: 0.18, y: 0 } },
        annotations: [],
      },
    },
  },
  {
    id: 'detail',
    name: 'Detail — close on the volume ring',
    hero: {
      position: { x: -0.17, y: -0.02, z: 0 },
      yaw: TAU + 0.85,
      scale: 1.32,
    },
    camera: {
      position: { x: -0.06, y: 0.14, z: 3.6 },
      lookAt: { x: -0.17, y: 0.1, z: 0 },
      fov: 30,
    },
    // Ring close-up: the body recedes (bodyEnv down) while the machined
    // ring catches more of the studio — "every surface earns its place".
    environment: {
      backdrop: '#070708',
      led: 3,
      sheen: 0.16,
      sheenColor: '#e6e1d8',
      bodyEnv: 0.85,
      ringEnv: 2.2,
      particles: 0,
    },
    transition: { ease: 'travel', hold: 0.3 },
    contentRevealAt: 0.3,
    annotations: [
      {
        id: 'detail-ring',
        anchor: 'anchor:ring',
        text: '12-micron machined volume ring',
        visibleRange: [0.3, 0.85],
      },
    ],
    responsive: {
      tablet: {
        hero: { position: { x: -0.12 } },
        camera: { lookAt: { x: -0.12 } },
      },
      mobile: {
        hero: { position: { x: 0, y: 0.06 }, scale: 0.95 },
        camera: { position: { x: 0, z: 4.6 }, lookAt: { x: 0, y: 0.14 } },
      },
      landscapePhone: {
        hero: { position: { x: -0.14, y: -0.02 }, scale: 0.8 },
        camera: { position: { z: 4.2 }, lookAt: { x: -0.14, y: 0.04 } },
        annotations: [],
      },
    },
  },
  {
    id: 'cta',
    name: 'CTA — heroic return',
    hero: { position: { x: 0, y: 0.01, z: 0 }, yaw: TAU, scale: 1.04 },
    camera: {
      position: { x: 0, y: 0.05, z: 6 },
      lookAt: { x: 0, y: 0.01, z: 0 },
      fov: 35,
    },
    // Heroic return with the brand accent on the rim and the LED as a
    // beacon — the conversion moment gets the warmest grade of the story.
    environment: {
      backdrop: '#0b0b0c',
      led: 5,
      sheen: 0.26,
      sheenColor: '#e8602c',
      bodyEnv: 1.2,
      ringEnv: 1.5,
      particles: 0,
    },
    transition: { ease: 'travel', hold: 0.25 },
    contentRevealAt: 0.3,
    annotations: [],
    responsive: {
      mobile: { hero: { scale: 0.8 }, camera: { position: { z: 6.6 } } },
      landscapePhone: { hero: { scale: 0.6 }, camera: { position: { z: 6.4 } } },
    },
  },
];

/**
 * Union of every annotation across base descriptors and responsive patches,
 * unique by id — what the stage's annotation layer mounts. (Which subset is
 * *visible* at any moment is the Director's call, per active breakpoint.)
 */
export const allAnnotations: SceneAnnotation[] = (() => {
  const seen = new Map<string, SceneAnnotation>();
  for (const scene of scenes) {
    const lists = [
      scene.annotations,
      ...Object.values(scene.responsive).map((patch) => patch.annotations ?? []),
    ];
    for (const annotation of lists.flat()) {
      if (!seen.has(annotation.id)) {
        seen.set(annotation.id, annotation);
      }
    }
  }
  return [...seen.values()];
})();
