import { ctaContent } from '../story/sections';
import { MagneticButton } from '../ui/MagneticButton';

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
          <MagneticButton className="button">
            {ctaContent.primaryAction}
          </MagneticButton>{' '}
          <MagneticButton className="button button--ghost">
            {ctaContent.secondaryAction}
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
