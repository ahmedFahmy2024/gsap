import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';

/**
 * Two stores, two contracts (docs/ENGINEERING_DESIGN.md §8):
 *
 * - useAppStore: low-frequency reactive state. Subscribing from components
 *   is the point — changes here are *supposed* to re-render UI.
 * - transientStore: high-frequency values written every scroll frame.
 *   Read with transientStore.getState() inside frame loops / GSAP
 *   callbacks ONLY. Never subscribe to it from a component.
 */

interface AppState {
  /** Mirrors prefers-reduced-motion; synced by useReducedMotionSync. */
  reducedMotion: boolean;
  /** Index into story chapters — drives nav highlight + indicator dots. */
  currentChapter: number;
  setReducedMotion: (value: boolean) => void;
  setCurrentChapter: (index: number) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  reducedMotion: false,
  currentChapter: 0,
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setCurrentChapter: (index) => set({ currentChapter: index }),
}));

interface TransientState {
  /** Normalized document scroll progress, 0–1. */
  scrollProgress: number;
  /** Scroll velocity as reported by the scroll engine, px/frame-ish. */
  scrollVelocity: number;
}

export const transientStore = createStore<TransientState>()(() => ({
  scrollProgress: 0,
  scrollVelocity: 0,
}));
