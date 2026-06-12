import type { SectionContent } from '../story/sections';

/**
 * Generic narrative chapter. Copy occupies one half of the viewport; the
 * other half is a transparent window reserved for the fixed 3D stage
 * (Phase 2). stageSide names where the *object* will sit, so copy takes
 * the opposite side.
 */
export function StorySection({ content }: { content: SectionContent }) {
  const stageClass =
    content.stageSide === 'left'
      ? 'section--stage-left'
      : content.stageSide === 'right'
        ? 'section--stage-right'
        : '';

  return (
    <section
      id={content.id}
      data-section
      className={`section ${stageClass}`}
      aria-labelledby={`${content.id}-title`}
      // Focus target for nav (navigateToSection) — never in tab order.
      tabIndex={-1}
    >
      <div className="container">
        <div className="section__copy">
          <p className="eyebrow" data-reveal>
            {content.eyebrow}
          </p>
          <h2 id={`${content.id}-title`} className="headline" data-reveal>
            {content.title}
          </h2>
          <p className="lede" data-reveal>
            {content.body}
          </p>
        </div>
      </div>
    </section>
  );
}
