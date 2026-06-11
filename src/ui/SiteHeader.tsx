import { heroContent, chapters } from '../story/sections';
import { scrollToSection } from '../systems/scroll/scroll-engine';

export function SiteHeader() {
  return (
    <header className="site-header">
      <button
        type="button"
        className="site-header__wordmark"
        onClick={() => scrollToSection(heroContent.id)}
      >
        {heroContent.title}
      </button>
      <nav className="site-header__nav" aria-label="Sections">
        {chapters.slice(1).map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => scrollToSection(chapter.id)}
          >
            {chapter.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
