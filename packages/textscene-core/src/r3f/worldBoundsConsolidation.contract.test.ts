/**
 * Contract — promote `computeWorldBoundingBox` to the sanctioned
 * subtree-bounds util and route the last raw `Box3.setFromObject` call site
 * through it, so the SkinnedMesh trap cannot silently re-enter the codebase.
 *
 * Background: `THREE.Box3.setFromObject` prefers a mesh's own `object.boundingBox`
 * over `geometry.boundingBox`. `SkinnedMesh` defines `boundingBox` and computes it
 * lazily from POSED vertices; for GLTF-cloned skinned meshes that cached box lands
 * in a corrupted frame far from the origin. The selection/hover helpers were already
 * fixed (they route through `computeWorldBoundingBox`, which unions each descendant's
 * `geometry.boundingBox × matrixWorld` and ignores `SkinnedMesh.boundingBox`). The
 * one remaining production offender is `frameSceneBounds()` (frameSceneBounds.ts), the
 * scene auto-framing path: it calls `new THREE.Box3().setFromObject(obj)` per rendered
 * leaf, so a skinned GLB leaf contributes a corrupt box that drags the framed centre
 * toward the origin (non-empty + finite, so the existing guards do not catch it).
 *
 * SCOPE (kept identical to the plan-spec so the plan-judge reads one scope):
 *   1. Migrate the ONE production `Box3.setFromObject` call site (`frameSceneBounds`)
 *      onto `computeWorldBoundingBox`, preserving the mesh-vs-gizmo classification and
 *      the empty-state-grid skip.
 *   2. Promote `computeWorldBoundingBox` to a shared, discoverable subtree-bounds util
 *      (whether to relocate it out of `WorldBoxHelper.ts` is the plan's call — the only
 *      hard requirement is that both the helper and the framing path consume one util).
 *   3. Guard against NEW raw call sites with a runtime conformance scan (this file's
 *      last test), mirroring the repo's `linter/reactFree.test.ts` / ADR-0001 idiom.
 *      An eslint `no-restricted-syntax` rule is OUT of scope for this slice: the core
 *      eslint block globs only `.ts` files (not `.tsx`, where the offender lives), so it
 *      would not cover the call site without a new config block — deferred.
 *
 * T1 (the bug) and T4 (the guard) fail RED against `origin/main`; T2 and T3 are green
 * controls that must STAY green (no regression to the non-skinned and gizmo-only paths).
 */
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameSceneBounds } from './frameSceneBounds.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/r3f
const srcRoot = resolve(here, '..'); // .../src

/** A minimal controls stand-in — `frameSceneBounds` copies the framed centre here. */
function makeControls(): { target: THREE.Vector3; update(): void } {
  return { target: new THREE.Vector3(), update() {} };
}

function unitBoxGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(2, 2, 2); // local AABB (-1,-1,-1)..(1,1,1)
  geo.computeBoundingBox();
  return geo;
}

/** Frame a single-model scene and return the centre the controls were pointed at. */
function framedCentre(model: THREE.Object3D): THREE.Vector3 {
  const scene = new THREE.Scene();
  scene.add(model);
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const controls = makeControls();
  frameSceneBounds(scene, camera, controls);
  return controls.target;
}

describe('frameSceneBounds — routes subtree bounds through the sanctioned util (#119)', () => {
  it('frames a skinned-mesh scene at the rendered model, not the corrupt posed box', () => {
    const skinned = new THREE.SkinnedMesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    // Mimic the GLTF-clone bug: a posed/cached box in a far-away frame.
    skinned.boundingBox = new THREE.Box3(
      new THREE.Vector3(100, 100, 100),
      new THREE.Vector3(102, 102, 102)
    );
    const model = new THREE.Group();
    model.position.set(-9.5, -3.84, 3.93); // the platformer Player's instance origin
    model.add(skinned);

    const centre = framedCentre(model);
    // Must track the geometry (bind) box at the model origin — NOT the corrupt
    // posed box near (101,101,101) that raw `setFromObject` would union in.
    expect(centre.x).toBeCloseTo(-9.5, 1);
    expect(centre.y).toBeCloseTo(-3.84, 1);
    expect(centre.z).toBeCloseTo(3.93, 1);
  });

  it('frames a MIXED scene (corrupt skinned + plain meshes) at the geometry union, never dragged toward the posed box', () => {
    // The real GLB-platformer symptom: a corrupt-posed skinned mesh SHARING the
    // scene with plain geometry. The framed centre must track the union of the
    // geometry (bind) boxes; the posed box near (101,101,101) must never pull it.
    const skinned = new THREE.SkinnedMesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    skinned.boundingBox = new THREE.Box3(
      new THREE.Vector3(100, 100, 100),
      new THREE.Vector3(102, 102, 102)
    );
    const plainA = new THREE.Mesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    plainA.position.set(10, 0, 0);
    const plainB = new THREE.Mesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    plainB.position.set(-10, 0, 0);
    const model = new THREE.Group(); // skinned sits at the model origin
    model.add(skinned, plainA, plainB);

    const centre = framedCentre(model);
    // Geometry union: unit box at origin ∪ unit boxes at ±10 → x −11..11, y/z −1..1
    // → centre (0,0,0). Raw `setFromObject` would union the posed box and pull +100.
    expect(centre.x).toBeCloseTo(0, 4);
    expect(centre.y).toBeCloseTo(0, 4);
    expect(centre.z).toBeCloseTo(0, 4);
    expect(centre.distanceTo(new THREE.Vector3(101, 101, 101))).toBeGreaterThan(50);
  });

  it('frames a plain-mesh scene at the mesh (non-skinned path unchanged)', () => {
    const mesh = new THREE.Mesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    const model = new THREE.Group();
    model.position.set(4, 1, -2);
    model.add(mesh);

    const centre = framedCentre(model);
    expect(centre.x).toBeCloseTo(4, 5);
    expect(centre.y).toBeCloseTo(1, 5);
    expect(centre.z).toBeCloseTo(-2, 5);
  });

  it('frames a gizmo-only scene (Line, no mesh) via the fallback path', () => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(6, 0, 0),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial());
    const model = new THREE.Group();
    model.position.set(0, 3, 0);
    model.add(line);

    const centre = framedCentre(model);
    // Line spans x 0..6 at y=3 → centre (3,3,0). Pins that dropping the mesh-vs-gizmo
    // split (e.g. one whole-scene bounds call) does not lose the light/camera-only
    // framing fallback.
    expect(centre.x).toBeCloseTo(3, 4);
    expect(centre.y).toBeCloseTo(3, 4);
    expect(centre.z).toBeCloseTo(0, 4);
  });
});

/** All non-test `.ts`/`.tsx` source files under `src`. */
function productionSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...productionSourceFiles(full));
    } else if (
      (extname(full) === '.ts' || extname(full) === '.tsx') &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('bounds guard — no production source calls Box3.setFromObject directly (#119)', () => {
  it('scans a non-trivial number of source files (the walk is not empty)', () => {
    expect(productionSourceFiles(srcRoot).length).toBeGreaterThan(50);
  });

  it('finds zero raw `.setFromObject(` call sites outside tests', () => {
    const offenders = productionSourceFiles(srcRoot)
      .filter((f) => /\.setFromObject\s*\(/.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(srcRoot, f).split('\\').join('/'));
    // Subtree bounds must go through `computeWorldBoundingBox`; raw `setFromObject`
    // re-introduces the SkinnedMesh trap. Route the offender(s) through the util.
    expect(offenders).toEqual([]);
  });

  it('defines `computeWorldBoundingBox` in exactly ONE module (single source of truth)', () => {
    // The guard above only forbids raw `setFromObject`; nothing stops a future
    // edit from re-pasting a divergent copy of the util back into WorldBoxHelper.
    // Pin the definition to the one `bounds.ts` both call sites import from.
    const definers = productionSourceFiles(srcRoot)
      .filter((f) =>
        /function\s+computeWorldBoundingBox\b/.test(stripComments(readFileSync(f, 'utf8')))
      )
      .map((f) => relative(srcRoot, f).split('\\').join('/'));
    expect(definers).toEqual(['r3f/bounds.ts']);
  });
});
