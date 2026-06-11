/**
 * Asset Management Layer (docs/ENGINEERING_DESIGN.md §3.7, §9).
 *
 * Phase 2 ships a *procedural* hero (zero file assets), so the manifest is
 * empty — but the contract is live: anything the stage loads must be listed
 * here, preloaded during the loading state, and counted against the budget.
 *
 * Pipeline for when the real ORBE glTF lands:
 *   1. Drop the authored file in `assets-src/` (git-tracked, not served).
 *   2. `bun run assets:optimize` → gltf-transform (Meshopt geometry +
 *      KTX2 textures; KTX2 needs KTX-Software's `toktx` on PATH) writes
 *      the servable file to `public/models/`.
 *   3. Add an entry below; swap HeroModel's primitives for `useGLTF`.
 *   4. Named empties in the glTF (`anchor_*`) register as stage anchors.
 *
 * Budgets (§9): total 3D payload ≤ 4 MB compressed; hero glTF ≤ 1.5 MB.
 */

export interface AssetEntry {
  /** Public URL the runtime loads from (under /models or /textures). */
  url: string;
  /** Compressed size ceiling for this asset, enforced in review. */
  budgetBytes: number;
}

export const ASSET_BUDGET_TOTAL_BYTES = 4 * 1024 * 1024;
export const ASSET_BUDGET_HERO_BYTES = 1.5 * 1024 * 1024;

export const assetManifest: AssetEntry[] = [];
