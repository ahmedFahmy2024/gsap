/**
 * Story definition — the ordered chapters of the page, as pure data.
 *
 * Phase 1 scope: section identity + copy + layout hint. In Phase 3 this
 * grows into full scene descriptors (object pose, camera pose, environment,
 * annotations) per docs/ENGINEERING_DESIGN.md §5. Keep this module free of
 * React/GSAP/Three imports — it is the future CMS seam.
 */

/** Which half of the viewport is reserved for the 3D stage (Phase 2+). */
export type StageSide = 'left' | 'right' | 'full';

export interface SectionContent {
  /** DOM id; also the anchor target for nav scrollTo. */
  id: string;
  /** Short label used by nav and the chapter indicator. */
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  stageSide: StageSide;
}

/** The product narrative. Placeholder brand: ORBE, a sculptural speaker. */
export const heroContent = {
  id: 'hero',
  label: 'Orbe',
  title: 'ORBE',
  tagline: 'Sound, sculpted.',
  hint: 'Scroll',
} as const;

export const storySections: SectionContent[] = [
  {
    id: 'craft',
    label: 'Craft',
    eyebrow: 'Craft',
    title: 'Milled from a single block.',
    body: 'No seams, no fasteners, no compromise. The enclosure is carved from one billet of recycled aluminium, then hand-finished until the surface holds light like stone.',
    stageSide: 'left',
  },
  {
    id: 'acoustics',
    label: 'Acoustics',
    eyebrow: 'Acoustics',
    title: 'A field, not a beam.',
    body: 'Three drivers fire through a sculpted waveguide, projecting a 360° soundfield that stays coherent wherever you stand. The room becomes the speaker.',
    stageSide: 'right',
  },
  {
    id: 'detail',
    label: 'Detail',
    eyebrow: 'Detail',
    title: 'Every surface earns its place.',
    body: 'The volume ring is machined to a 12-micron tolerance and weighted to turn like a camera lens. Touch it once and you will understand the whole object.',
    stageSide: 'left',
  },
];

export const ctaContent = {
  id: 'cta',
  label: 'Reserve',
  eyebrow: 'Launch — autumn 2026',
  title: 'Hear it in person.',
  body: 'Reserve yours now, or find a listening room near you.',
  primaryAction: 'Reserve ORBE',
  secondaryAction: 'Find a listening room',
} as const;

/** Ordered chapter list driving nav + the chapter indicator. */
export const chapters = [
  { id: heroContent.id, label: heroContent.label },
  ...storySections.map(({ id, label }) => ({ id, label })),
  { id: ctaContent.id, label: ctaContent.label },
];
