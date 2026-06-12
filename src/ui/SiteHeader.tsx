import { heroContent, chapters } from '../story/sections';
import { navigateToSection } from './navigation';

export function SiteHeader() {
  return (
    <header className="site-header">
      <button
        type="button"
        className="site-header__wordmark"
        onClick={() => navigateToSection(heroContent.id)}
      >
        {heroContent.title}
      </button>
      <nav className="site-header__nav" aria-label="Sections">
        {chapters.slice(1).map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => navigateToSection(chapter.id)}
          >
            {chapter.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
