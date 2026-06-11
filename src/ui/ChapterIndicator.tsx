import { chapters } from '../story/sections';
import { useAppStore } from '../state/store';
import { scrollToSection } from '../systems/scroll/scroll-engine';

/**
 * Fixed progress dots. Subscribes to currentChapter — a deliberate,
 * low-frequency reactive read (changes ~once per section, not per frame).
 */
export function ChapterIndicator() {
  const currentChapter = useAppStore((s) => s.currentChapter);

  return (
    <nav className="chapters" aria-label="Reading progress">
      {chapters.map((chapter, index) => (
        <button
          key={chapter.id}
          type="button"
          className="chapters__dot"
          aria-label={chapter.label}
          aria-current={index === currentChapter}
          onClick={() => scrollToSection(chapter.id)}
        />
      ))}
    </nav>
  );
}
