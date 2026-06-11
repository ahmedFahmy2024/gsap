import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { classifyQuality, type QualityTier } from '../systems/quality/quality';

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
  /**
   * Device quality tier, classified once at boot (§3.8). 'static' means
   * the canvas never mounts and the DOM story stands alone (§9). Runtime
   * degradation (Phase 5) lowers it through setQualityTier.
   */
  qualityTier: QualityTier;
  /** True once the stage's Suspense tree has committed (canvas fade-in). */
  stageReady: boolean;
  /** 3D asset loading progress 0–100, mirrored out of the stage chunk. */
  stageProgress: number;
  setReducedMotion: (value: boolean) => void;
  setCurrentChapter: (index: number) => void;
  setQualityTier: (tier: QualityTier) => void;
  setStageReady: (value: boolean) => void;
  setStageProgress: (value: number) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  reducedMotion: false,
  currentChapter: 0,
  qualityTier: classifyQuality(),
  stageReady: false,
  stageProgress: 0,
  setReducedMotion: (value) => set({ reducedMotion: value }),
  setCurrentChapter: (index) => set({ currentChapter: index }),
  setQualityTier: (tier) => set({ qualityTier: tier }),
  setStageReady: (value) => set({ stageReady: value }),
  setStageProgress: (value) => set({ stageProgress: value }),
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
