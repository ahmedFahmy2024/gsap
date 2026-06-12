import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import {
  CubeCamera,
  DoubleSide,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Scene,
  WebGLCubeRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { useAppStore } from '../state/store';
import { renderProfiles } from '../systems/quality/quality';

/**
 * One emissive panel in the studio rig. Geometry/material semantics are
 * identical to drei's <Lightformer>: a tone-mapping-exempt DoubleSide basic
 * material whose color is scaled by intensity, aimed at the origin.
 */
interface LightformerSpec {
  form: 'rect' | 'ring';
  intensity: number;
  color: string;
  position: [number, number, number];
  scale: [number, number, number];
}

/*
 * Colors echo styles/tokens.css: warm key, cool rim, an accent-tinted
 * kicker (--color-accent #e8602c family).
 */
const LIGHTFORMERS: LightformerSpec[] = [
  // Key — big warm softbox overhead-front; defines the clearcoat sweep
  {
    form: 'rect',
    intensity: 2.2,
    color: '#fff2e2',
    position: [0, 4, 3],
    scale: [7, 3, 1],
  },
  // Rim — cool strip behind-left, separates the dark body from the bg
  {
    form: 'rect',
    intensity: 1.2,
    color: '#dfe7ff',
    position: [-5, 1.5, -2],
    scale: [3, 5, 1],
  },
  // Kicker — accent-warm sliver from the right
  {
    form: 'rect',
    intensity: 0.7,
    color: '#ffd9c2',
    position: [5, 0.5, 1],
    scale: [2, 4, 1],
  },
  // Faint bottom fill so the underside never reads as a void
  {
    form: 'ring',
    intensity: 0.3,
    color: '#ffffff',
    position: [0, -3.5, 4],
    scale: [4, 4, 1],
  },
];

/**
 * Lighting rig (design §9): a procedural studio environment rendered ONCE
 * into a cube render target — no HDRI download, no real-time lights, no
 * shadow maps. The grounded look comes from ContactShadows in HeroModel.
 *
 * Phase 5 note: this used to be drei `<Environment frames={1}>` with
 * `<Lightformer>` children, but drei's Environment statically imports its
 * file-loading paths (EXRLoader + fflate, RGBELoader, gainmap-js,
 * GroundProjectedEnv) — ~17 KB gz of dead code for a procedural rig, the
 * bulk of the stage chunk's budget overage. This is the same render
 * (verified against drei's EnvironmentPortal/Lightformer sources): meshes
 * into a HalfFloat cube target via CubeCamera.update, assigned to
 * scene.environment, previous environment restored on cleanup.
 */
export function Lighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const profile =
    qualityTier === 'static' ? renderProfiles.low : renderProfiles[qualityTier];
  const resolution = profile.envResolution;

  // Layout effect (like drei) so the env map exists before the first paint;
  // build/teardown are symmetric for StrictMode. The imperative work lives
  // in a module function — renderer/scene mutation stays out of compiler
  // territory (§12 React Compiler note).
  useLayoutEffect(
    () => createStudioEnvironment(gl, scene, resolution),
    [gl, scene, resolution],
  );

  return null;
}

/**
 * Renders the rig into a cube env map once and installs it on the scene.
 * Returns the cleanup that restores the previous environment.
 */
function createStudioEnvironment(
  gl: WebGLRenderer,
  scene: Scene,
  resolution: number,
): () => void {
  const fbo = new WebGLCubeRenderTarget(resolution);
  fbo.texture.type = HalfFloatType;

  const virtualScene = new Scene();
  const cubeCamera = new CubeCamera(0.1, 1000, fbo);
  virtualScene.add(cubeCamera);

  const disposables: { dispose: () => void }[] = [];
  for (const spec of LIGHTFORMERS) {
    const geometry =
      spec.form === 'ring'
        ? new RingGeometry(0.25, 0.5, 64)
        : new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({
      toneMapped: false,
      side: DoubleSide,
    });
    material.color.set(spec.color).multiplyScalar(spec.intensity);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...spec.position);
    mesh.scale.set(...spec.scale);
    mesh.lookAt(0, 0, 0);
    virtualScene.add(mesh);
    disposables.push(geometry, material);
  }

  const autoClear = gl.autoClear;
  gl.autoClear = true;
  cubeCamera.update(gl, virtualScene);
  gl.autoClear = autoClear;

  // The env map now lives in the render target; the source rig can go.
  disposables.forEach((d) => d.dispose());

  const previousEnvironment = scene.environment;
  scene.environment = fbo.texture;
  return () => {
    scene.environment = previousEnvironment;
    fbo.dispose();
  };
}
