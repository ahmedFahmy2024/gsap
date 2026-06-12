import { heroContent } from '../story/sections';

export function HeroSection() {
  return (
    <section
      id={heroContent.id}
      data-section
      className="section hero"
      aria-label={heroContent.tagline}
      // Focus target for nav (navigateToSection) — never in tab order.
      tabIndex={-1}
    >
      <div className="container section__copy">
        <h1 className="display" data-reveal>
          {heroContent.title}
        </h1>
        <p className="hero__tagline" data-reveal>
          {heroContent.tagline}
        </p>
      </div>
      <p className="hero__hint" data-reveal>
        {heroContent.hint}
      </p>
    </section>
  );
}
