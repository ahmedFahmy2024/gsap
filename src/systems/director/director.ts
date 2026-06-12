import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Object3D, PerspectiveCamera } from 'three';
import { useAppStore } from '../../state/store';
import { ease, duration, stagger, revealDistance } from '../../story/motion';
import {
  breakpointMergeOrder,
  breakpointQueries,
  scenes,
  stageSpace,
  type BreakpointName,
  type SceneDescriptor,
  type ScenePatch,
  type StagePoint,
} from '../../story/scenes';
import { chapters } from '../../story/sections';
import { validateStory } from '../../story/validate';
import {
  getStageObject,
  listStageObjects,
} from '../../stage/registry/registry';
import { getMasterScrub, setLabelResolver } from '../scroll/scroll-engine';

gsap.registerPlugin(ScrollTrigger);

/** Id of the Layer-1 ScrollTrigger; the label resolver looks it up by id so
 *  a reverted timeline self-invalidates instead of dangling. */
const MASTER_TRIGGER_ID = 'orbe-master';

export interface DirectorOptions {
  reducedMotion: boolean;
  /** Layer 1 animates registry objects, so it can only build once the lazy
   *  stage chunk has committed (useDirector rebuilds on the flip). */
  stageReady: boolean;
}

/** The registry/DOM handles Layer 1 writes to. `three` types only (§3.3). */
interface StageTargets {
  hero: Object3D;
  rig: Object3D;
  look: Object3D;
  camera: PerspectiveCamera | undefined;
  backdrop: HTMLElement | null;
}

/**
 * The single creation site for every ScrollTrigger in the app
 * (docs/ENGINEERING_DESIGN.md §6 — no component creates its own).
 *
 * Phase 3 builds the full layered model from the scene descriptors (§5):
 *   Layer 1 — ONE master scrub timeline carrying all hero/camera/environment
 *             motion, labels at scene anchors, function-based values +
 *             invalidateOnRefresh throughout.
 *   Layer 2 — toggle-based DOM reveals per section (designed beats, never
 *             scrubbed) + annotation visibility windows.
 * Everything is (re)built per breakpoint via gsap.matchMedia; responsive
 * descriptor patches are deep-merged before interpretation.
 *
 * Must run inside a gsap context (useDirector wraps it in useGSAP) so all
 * of it — including the matchMedia — reverts on unmount/rebuild. The
 * returned function cleans up the non-GSAP side effects and is invoked by
 * that same context revert.
 */
export function buildStory(
  scope: HTMLElement,
  options: DirectorOptions,
): () => void {
  if (import.meta.env.DEV) {
    for (const problem of validateStory(scenes, chapters)) {
      console.warn(`[director] invalid story: ${problem}`);
    }
  }

  const mm = gsap.matchMedia(scope);

  // 'all' keeps the handler active on every viewport; the named queries only
  // report which responsive patches apply via ctx.conditions. The handler
  // re-runs (after an automatic revert) whenever a condition flips.
  mm.add({ all: 'all', ...breakpointQueries }, (ctx) => {
    // Stale visibility from the previous breakpoint's triggers must not
    // survive the rebuild; active triggers re-assert on their first refresh.
    useAppStore.getState().clearAnnotations();

    const conditions = (ctx.conditions ?? {}) as Partial<
      Record<BreakpointName, boolean>
    >;
    const active = breakpointMergeOrder.filter((bp) => conditions[bp]);
    const merged = scenes.map((scene) => mergeScene(scene, active));

    const beats = merged.flatMap((scene, index) => {
      const section = scope.querySelector<HTMLElement>(
        `#${scene.id}[data-section]`,
      );
      if (!section) {
        if (import.meta.env.DEV) {
          console.warn(`[director] scene "${scene.id}" has no DOM section`);
        }
        return [];
      }
      return [{ scene, index, section }];
    });

    for (const { scene, index, section } of beats) {
      createChapterTrigger(section, index);
      if (!options.reducedMotion) {
        createRevealTimeline(section, scene);
      }
      // Annotation windows are information, not motion — built in both
      // modes; CSS suppresses their transitions under reduced motion.
      createAnnotationTriggers(section, scene);
    }

    if (options.stageReady) {
      const targets = resolveStageTargets(scope, merged);
      if (targets) {
        if (options.reducedMotion) {
          applyRestingPose(merged[0], targets);
        } else {
          buildMasterTimeline(scope, beats, targets);
        }
      }
    }

    // Mixed-order creation corrupts refresh order (§12) — sort once per build.
    ScrollTrigger.sort();
  });

  return () => {
    setLabelResolver(null);
    useAppStore.getState().clearAnnotations();
  };
}

/* ------------------------------------------------------------------ *
 * Layer 1 — the master scrub timeline                                 *
 * ------------------------------------------------------------------ */

function buildMasterTimeline(
  scope: HTMLElement,
  beats: { scene: SceneDescriptor; section: HTMLElement }[],
  targets: StageTargets,
): void {
  const maxScroll = ScrollTrigger.maxScroll(window);
  if (maxScroll <= 0 || beats.length === 0) {
    return;
  }

  // Scroll progress at which each scene's pose settles: its section centered
  // in the viewport. Measured once per build; within a breakpoint all
  // sections are 100svh-proportional, so the fractions hold across resizes
  // (pose VALUES are function-based and re-resolve on every refresh).
  const clamp01 = gsap.utils.clamp(0, 1);
  const anchors = beats.map(({ section }) =>
    clamp01(
      (absoluteTop(section) +
        section.offsetHeight / 2 -
        window.innerHeight / 2) /
        maxScroll,
    ),
  );

  const timeline = gsap.timeline({
    defaults: { ease: ease.travel },
    scrollTrigger: {
      id: MASTER_TRIGGER_ID,
      trigger: scope,
      start: 0,
      end: 'max',
      // Exact vs. smoothed scrub is the scroll engine's decision (§6).
      scrub: getMasterScrub(),
      invalidateOnRefresh: true,
    },
  });

  // Pad the timeline to exactly 1s so timeline time === document scroll
  // progress, letting scene anchors be used as tween positions directly.
  timeline.to({}, { duration: 0 }, 1);

  beats.forEach(({ scene }, index) => {
    timeline.addLabel(scene.id, anchors[index]);

    if (index === 0) {
      // Zero-duration pose at t=0: the baseline framing, applied the moment
      // the scrub first renders and re-applied whenever scroll returns to 0.
      addPoseTweens(timeline, scene, targets, 0, 0, ease.travel);
      return;
    }

    const previous = anchors[index - 1];
    const gap = anchors[index] - previous;
    if (gap <= 0) {
      if (import.meta.env.DEV) {
        console.warn(
          `[director] scene "${scene.id}" shares a scroll anchor with its predecessor; skipping its transition`,
        );
      }
      return;
    }
    // The inbound transition occupies the scroll gap between the two scene
    // anchors, minus the authored hold (§5): rest while the copy is read,
    // then travel.
    const at = previous + gap * scene.transition.hold;
    addPoseTweens(
      timeline,
      scene,
      targets,
      at,
      anchors[index] - at,
      ease[scene.transition.ease],
    );
  });

  setLabelResolver((id) => {
    const trigger = ScrollTrigger.getById(MASTER_TRIGGER_ID);
    if (!trigger || !(id in timeline.labels)) {
      return null;
    }
    return trigger.labelToScroll(id);
  });
}

/**
 * One scene's pose as tweens on the registry objects — heroGroup, cameraRig,
 * lookAtTarget, camera fov, plus the DOM backdrop tint. Never heroFloat:
 * the idle wrapper stays frame-loop-owned (§6 Layer 3, one writer per
 * property §8). All spatial values are function-based so every refresh
 * re-resolves normalized stage space against the live viewport.
 */
function addPoseTweens(
  timeline: gsap.core.Timeline,
  scene: SceneDescriptor,
  targets: StageTargets,
  at: number,
  travel: number,
  easing: string,
): void {
  const { hero, rig, look, camera, backdrop } = targets;
  const shared = { duration: travel, ease: easing };

  timeline.to(
    hero.position,
    { ...stagePointVars(scene.hero.position), ...shared },
    at,
  );
  timeline.to(hero.rotation, { y: scene.hero.yaw, ...shared }, at);
  timeline.to(
    hero.scale,
    {
      x: heroScale(scene),
      y: heroScale(scene),
      z: heroScale(scene),
      ...shared,
    },
    at,
  );
  timeline.to(
    rig.position,
    { ...stagePointVars(scene.camera.position), ...shared },
    at,
  );
  timeline.to(
    look.position,
    { ...stagePointVars(scene.camera.lookAt), ...shared },
    at,
  );
  if (camera) {
    timeline.to(
      camera,
      {
        fov: scene.camera.fov,
        ...shared,
        onUpdate: () => camera.updateProjectionMatrix(),
      },
      at,
    );
  }
  if (backdrop) {
    timeline.to(
      backdrop,
      { backgroundColor: scene.environment.backdrop, ...shared },
      at,
    );
  }
}

/** Reduced-motion framing: the hero scene's pose applied once, statically.
 *  Values are resolved immediately (no triggers to refresh them); a rebuild
 *  on preference flips re-resolves. */
function applyRestingPose(scene: SceneDescriptor, targets: StageTargets): void {
  const world = stageWorldSize();
  const setPoint = (object: Object3D, point: StagePoint) => {
    gsap.set(object.position, {
      x: point.x * world.width,
      y: point.y * world.height,
      z: point.z,
    });
  };

  setPoint(targets.hero, scene.hero.position);
  gsap.set(targets.hero.rotation, { y: scene.hero.yaw });
  const scale = heroScale(scene)();
  gsap.set(targets.hero.scale, { x: scale, y: scale, z: scale });
  setPoint(targets.rig, scene.camera.position);
  setPoint(targets.look, scene.camera.lookAt);
  if (targets.camera) {
    const camera = targets.camera;
    gsap.set(camera, {
      fov: scene.camera.fov,
      onUpdate: () => camera.updateProjectionMatrix(),
    });
  }
  if (targets.backdrop) {
    gsap.set(targets.backdrop, {
      backgroundColor: scene.environment.backdrop,
    });
  }
}

function resolveStageTargets(
  scope: HTMLElement,
  merged: SceneDescriptor[],
): StageTargets | null {
  const hero = getStageObject('heroGroup');
  const rig = getStageObject('cameraRig');
  const look = getStageObject('lookAtTarget');
  if (!hero || !rig || !look) {
    if (import.meta.env.DEV) {
      console.warn(
        `[director] stage ready but registry incomplete (have: ${listStageObjects().join(', ')})`,
      );
    }
    return null;
  }

  if (import.meta.env.DEV) {
    const registered = new Set(listStageObjects());
    for (const scene of merged) {
      for (const annotation of scene.annotations) {
        if (!registered.has(annotation.anchor)) {
          console.warn(
            `[director] scene "${scene.id}": annotation anchor "${annotation.anchor}" is not registered`,
          );
        }
      }
    }
  }

  return {
    hero,
    rig,
    look,
    camera: getStageObject('camera') as PerspectiveCamera | undefined,
    backdrop: scope.querySelector<HTMLElement>('[data-backdrop]'),
  };
}

/* ------------------------------------------------------------------ *
 * Layer 2 — chapter tracking, reveals, annotation windows             *
 * ------------------------------------------------------------------ */

function createChapterTrigger(section: HTMLElement, index: number): void {
  // Chapter tracking is information, not motion — runs in both modes.
  // setCurrentChapter is low-frequency (fires on boundary cross only),
  // so writing reactive state from this callback is within the §8 rules.
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => {
      if (self.isActive) {
        useAppStore.getState().setCurrentChapter(index);
      }
    },
  });
}

function createRevealTimeline(
  section: HTMLElement,
  scene: SceneDescriptor,
): void {
  const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]', section);
  if (targets.length === 0) {
    return;
  }

  // Toggle-based, not scrubbed: reveals play a designed beat when their
  // moment arrives and reverse on the way back up (§6 Layer 2). The
  // trigger point is the scene's content binding (§5).
  gsap
    .timeline({
      scrollTrigger: {
        trigger: section,
        start: `top ${(1 - scene.contentRevealAt) * 100}%`,
        toggleActions: 'play none none reverse',
      },
    })
    .fromTo(
      targets,
      { autoAlpha: 0, y: revealDistance },
      {
        autoAlpha: 1,
        y: 0,
        duration: duration.reveal,
        ease: ease.reveal,
        stagger: stagger.text,
      },
    );
}

function createAnnotationTriggers(
  section: HTMLElement,
  scene: SceneDescriptor,
): void {
  for (const annotation of scene.annotations) {
    const [enter, leave] = annotation.visibleRange;
    // visibleRange is local traversal progress: 0 = section top touches
    // viewport bottom, 1 = section bottom leaves viewport top. Numeric
    // function-based positions stay correct across refreshes.
    const traversal = () => section.offsetHeight + window.innerHeight;
    const entryScroll = () => absoluteTop(section) - window.innerHeight;
    ScrollTrigger.create({
      trigger: section,
      start: () => entryScroll() + enter * traversal(),
      end: () => entryScroll() + leave * traversal(),
      onToggle: (self) =>
        useAppStore
          .getState()
          .setAnnotationVisible(annotation.id, self.isActive),
    });
  }
}

/* ------------------------------------------------------------------ *
 * Descriptor resolution helpers                                       *
 * ------------------------------------------------------------------ */

/**
 * World size of the stage rectangle at z = 0 under the reference camera
 * (§5 normalized stage space). Derived from the window aspect and the
 * reference constants — deterministic while the *actual* camera travels,
 * and available without importing Three or waiting for the canvas.
 */
function stageWorldSize(): { width: number; height: number } {
  const height =
    2 *
    stageSpace.referenceDistance *
    Math.tan((stageSpace.referenceFov * Math.PI) / 360);
  return { width: height * (window.innerWidth / window.innerHeight), height };
}

/** Function-based world coordinates for a stage point (re-resolved on every
 *  ScrollTrigger refresh via invalidateOnRefresh). */
function stagePointVars(point: StagePoint) {
  return {
    x: () => point.x * stageWorldSize().width,
    y: () => point.y * stageWorldSize().height,
    z: point.z,
  };
}

/** Authored scale × the responsive fit clamp (replaces the Phase 2
 *  StageScene fit scalar — the Director owns responsive scaling now). */
function heroScale(scene: SceneDescriptor): () => number {
  return () =>
    scene.hero.scale *
    Math.min(1, stageWorldSize().width / stageSpace.heroDesignWidth);
}

/** Document-space top of an element. Computed from layout offsets, not from
 *  scroll position — scroll state stays the scroll engine's monopoly (§10). */
function absoluteTop(element: HTMLElement): number {
  let top = 0;
  let node: Element | null = element;
  while (node instanceof HTMLElement) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top;
}

function mergeScene(
  scene: SceneDescriptor,
  active: readonly BreakpointName[],
): SceneDescriptor {
  let merged = scene;
  for (const breakpoint of active) {
    const patch = scene.responsive[breakpoint];
    if (patch) {
      merged = applyPatch(merged, patch);
    }
  }
  return merged;
}

function applyPatch(
  scene: SceneDescriptor,
  patch: ScenePatch,
): SceneDescriptor {
  return {
    ...scene,
    hero: {
      position: { ...scene.hero.position, ...patch.hero?.position },
      yaw: patch.hero?.yaw ?? scene.hero.yaw,
      scale: patch.hero?.scale ?? scene.hero.scale,
    },
    camera: {
      position: { ...scene.camera.position, ...patch.camera?.position },
      lookAt: { ...scene.camera.lookAt, ...patch.camera?.lookAt },
      fov: patch.camera?.fov ?? scene.camera.fov,
    },
    environment: { ...scene.environment, ...patch.environment },
    annotations: patch.annotations ?? scene.annotations,
  };
}
