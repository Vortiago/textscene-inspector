/**
 * The pose of a 2D light's shadow as React state: sampled off the cookie quad on
 * mount and every frame, and republished only when the light moves or changes reach.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SHADOW_SNAPSHOT_PRIORITY } from './ShadowCasterStage';
import { sameShadowLight, sampleShadowLight, type ShadowLightPose } from './shadowLightSample';

/**
 * Everything `sampleShadowLight` reads: the quad's and the light node's world
 * matrices and the quad's bounds. Comparing these 36 numbers before sampling
 * spares a still scene a 4×4 inverse and short-lived objects per light per frame.
 */
const SAMPLE_INPUTS = 36;

/** Scratch for the current frame's read, compared against the previous frame's. */
const inputScratch = new Float64Array(SAMPLE_INPUTS);

function readSampleInputs(quad: THREE.Mesh, out: Float64Array): boolean {
  const parent = quad.parent;
  if (!parent) return false;
  const geometry = quad.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return false;

  quad.updateWorldMatrix(true, false);
  const quadElements = quad.matrixWorld.elements;
  const lightElements = parent.matrixWorld.elements;
  for (let i = 0; i < 16; i += 1) {
    out[i] = quadElements[i]!;
    out[i + 16] = lightElements[i]!;
  }
  out[32] = box.min.x;
  out[33] = box.min.y;
  out[34] = box.max.x;
  out[35] = box.max.y;
  return true;
}

/**
 * The pose of the light whose cookie `quad` draws, sampled on mount and every
 * frame, republished only on a change, and null while `enabled` is false. Three
 * assembles a world transform in the render loop, so the layout pass serves a
 * still frame and the frame callback an animated light, as in ShadowCasterStage.
 */
export function useShadowLightPose(quad: THREE.Mesh | null, enabled: boolean): ShadowLightPose | null {
  const [pose, setPose] = useState<ShadowLightPose | null>(null);
  const published = useRef(pose);
  const inputs = useRef(new Float64Array(SAMPLE_INPUTS));
  const inputsRead = useRef(false);

  const sample = useCallback(() => {
    // `readSampleInputs` is what refreshes the matrices, so the sample below
    // does not walk the ancestor chain a second time.
    let matricesFresh = false;
    if (enabled && quad && readSampleInputs(quad, inputScratch)) {
      matricesFresh = true;
      const previous = inputs.current;
      if (inputsRead.current) {
        let moved = false;
        for (let i = 0; i < SAMPLE_INPUTS; i += 1) {
          if (previous[i] !== inputScratch[i]) {
            moved = true;
            break;
          }
        }
        if (!moved) return;
      }
      previous.set(inputScratch);
      inputsRead.current = true;
    } else {
      inputsRead.current = false;
    }

    const next = enabled ? sampleShadowLight(quad, matricesFresh) : null;
    if (sameShadowLight(published.current, next)) return;
    published.current = next;
    setPose(next);
  }, [quad, enabled]);

  useLayoutEffect(() => {
    // A new quad or a change of `enabled` makes the cached inputs another
    // light's, so they are dropped rather than compared against.
    inputsRead.current = false;
    sample();
  }, [sample]);
  useFrame(sample, SHADOW_SNAPSHOT_PRIORITY);

  return pose;
}
