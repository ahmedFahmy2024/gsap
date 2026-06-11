import { ctaContent } from '../story/sections';

export function CtaSection() {
  return (
    <section
      id={ctaContent.id}
      data-section
      className="section cta"
      aria-labelledby={`${ctaContent.id}-title`}
    >
      <div className="container section__copy">
        <p className="eyebrow" data-reveal>
          {ctaContent.eyebrow}
        </p>
        <h2 id={`${ctaContent.id}-title`} className="headline" data-reveal>
          {ctaContent.title}
        </h2>
        <p className="lede" data-reveal>
          {ctaContent.body}
        </p>
        <div data-reveal>
          <button type="button" className="button">
            {ctaContent.primaryAction}
          </button>{' '}
          <button type="button" className="button button--ghost">
            {ctaContent.secondaryAction}
          </button>
        </div>
      </div>
    </section>
  );
}
