/**
 * Descriptor validation (docs/ENGINEERING_DESIGN.md §5) — pure functions,
 * no DOM, no GSAP. The Director runs this in DEV and warns; in a CMS future
 * the same suite becomes the publish gate. Anchor *existence* can't be
 * checked here (anchors live in the runtime registry); the Director
 * cross-checks those separately once the stage is ready.
 */

import { ease } from './motion';
import type {
  EnvironmentState,
  SceneAnnotation,
  SceneDescriptor,
  ScenePatch,
} from './scenes';

const isUnit = (value: number) => value >= 0 && value <= 1;
const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** Returns human-readable problems; empty array = valid story. */
export function validateStory(
  story: SceneDescriptor[],
  chapters: readonly { id: string }[],
): string[] {
  const problems: string[] = [];

  if (story.length === 0) {
    return ['story has no scenes'];
  }

  const ids = story.map((scene) => scene.id);
  if (new Set(ids).size !== ids.length) {
    problems.push(`scene ids are not unique: ${ids.join(', ')}`);
  }

  // Scenes and chapters (nav, indicator, DOM sections) must agree on order —
  // the Director indexes both by position.
  if (
    chapters.length !== story.length ||
    chapters.some((chapter, i) => chapter.id !== story[i].id)
  ) {
    problems.push(
      `scenes [${ids.join(', ')}] do not match chapters [${chapters
        .map((c) => c.id)
        .join(', ')}] in order`,
    );
  }

  const annotationIds = new Set<string>();
  for (const scene of story) {
    const at = `scene "${scene.id}"`;

    if (!(scene.transition.ease in ease)) {
      problems.push(`${at}: unknown ease token "${scene.transition.ease}"`);
    }
    if (!isUnit(scene.transition.hold) || scene.transition.hold > 0.9) {
      problems.push(`${at}: transition.hold must be 0–0.9`);
    }
    if (!isUnit(scene.contentRevealAt)) {
      problems.push(`${at}: contentRevealAt must be 0–1`);
    }
    problems.push(...validatePose(scene.hero.scale, scene.camera.fov, at));
    problems.push(...validateEnvironment(scene.environment, at));

    for (const annotation of scene.annotations) {
      if (annotationIds.has(annotation.id)) {
        problems.push(`${at}: duplicate annotation id "${annotation.id}"`);
      }
      annotationIds.add(annotation.id);
      problems.push(...validateAnnotation(annotation, at));
    }

    for (const [breakpoint, patch] of Object.entries(scene.responsive)) {
      problems.push(
        ...validatePatch(patch, `${at} responsive.${breakpoint}`),
      );
    }
  }

  return problems;
}

function validatePose(scale: number, fov: number, at: string): string[] {
  const problems: string[] = [];
  if (scale <= 0) {
    problems.push(`${at}: hero scale must be > 0`);
  }
  if (fov < 10 || fov > 120) {
    problems.push(`${at}: camera fov ${fov} outside sane range 10–120`);
  }
  return problems;
}

/**
 * Environment ranges. The sheen floor is a *shader* constraint, not taste:
 * three only compiles the sheen code path while sheen > 0, so a scene
 * authored at 0 would trigger a program recompile mid-scrub (§12 jank).
 */
function validateEnvironment(
  env: Partial<EnvironmentState>,
  at: string,
): string[] {
  const problems: string[] = [];
  for (const key of ['backdrop', 'sheenColor'] as const) {
    const color = env[key];
    if (color !== undefined && !isHexColor(color)) {
      problems.push(`${at}: ${key} "${color}" is not a #rrggbb color`);
    }
  }
  if (env.led !== undefined && (env.led < 0 || env.led > 10)) {
    problems.push(`${at}: led intensity must be 0–10`);
  }
  if (env.sheen !== undefined && (env.sheen <= 0 || env.sheen > 1)) {
    problems.push(`${at}: sheen must be in (0, 1] — see compile-once note`);
  }
  for (const key of ['bodyEnv', 'ringEnv'] as const) {
    const value = env[key];
    if (value !== undefined && (value <= 0 || value > 4)) {
      problems.push(`${at}: ${key} must be in (0, 4]`);
    }
  }
  if (env.particles !== undefined && !isUnit(env.particles)) {
    problems.push(`${at}: particles must be 0–1`);
  }
  return problems;
}

function validateAnnotation(
  annotation: SceneAnnotation,
  at: string,
): string[] {
  const [enter, leave] = annotation.visibleRange;
  if (!isUnit(enter) || !isUnit(leave) || enter >= leave) {
    return [
      `${at}: annotation "${annotation.id}" visibleRange [${enter}, ${leave}] must satisfy 0 ≤ enter < leave ≤ 1`,
    ];
  }
  return [];
}

function validatePatch(patch: ScenePatch, at: string): string[] {
  const problems: string[] = [];
  if (patch.hero?.scale !== undefined && patch.hero.scale <= 0) {
    problems.push(`${at}: hero scale must be > 0`);
  }
  if (
    patch.camera?.fov !== undefined &&
    (patch.camera.fov < 10 || patch.camera.fov > 120)
  ) {
    problems.push(`${at}: camera fov outside sane range 10–120`);
  }
  if (patch.environment) {
    problems.push(...validateEnvironment(patch.environment, at));
  }
  for (const annotation of patch.annotations ?? []) {
    problems.push(...validateAnnotation(annotation, at));
  }
  return problems;
}
