import { ctaContent } from '../story/sections';
import { track } from '../systems/analytics/analytics';
import { MagneticButton } from '../ui/MagneticButton';

export function CtaSection() {
  return (
    <section
      id={ctaContent.id}
      data-section
      className="section cta"
      aria-labelledby={`${ctaContent.id}-title`}
      // Focus target for nav (navigateToSection) — never in tab order.
      tabIndex={-1}
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
          <MagneticButton
            className="button"
            onClick={() => track('cta_click', { cta: 'reserve' })}
          >
            {ctaContent.primaryAction}
          </MagneticButton>{' '}
          <MagneticButton
            className="button button--ghost"
            onClick={() => track('cta_click', { cta: 'find-room' })}
          >
            {ctaContent.secondaryAction}
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
