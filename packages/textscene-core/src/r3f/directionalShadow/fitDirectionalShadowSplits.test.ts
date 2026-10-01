/**
 * Each split's box is checked through three's own shadow matrices, as `fitDirectionalShadowBox.test.ts`
 * checks the single box: a box is right when `LightShadow.updateMatrices` maps its slice into the
 * map's unit cube.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cameraSliceCorners, type DirectionalShadowBox } from './fitDirectionalShadowBox';
import {
  NO_BLEND,
  fitDirectionalShadowSplits,
  type DirectionalShadowSplitFitInput,
  type DirectionalShadowSplits,
} from './fitDirectionalShadowSplits';
import type { DirectionalShadowDeclaration } from './declaration';

const ATLAS_SIZE = 4096;
const WHOLE_ATLAS = { x: 0, y: 0, width: ATLAS_SIZE, height: ATLAS_SIZE };
/** The second of two lights' shares: half the atlas's width at its full height. */
const SECOND_OF_TWO = { x: 2048, y: 0, width: 2048, height: ATLAS_SIZE };
const SUN_DIRECTION = new THREE.Vector3(-0.4, -0.8, -0.45).normalize();
const FACE_TOLERANCE = 1e-9;
/** The slice the camera below shows up to the max distance of 80. */
const SPLIT_ENDS = [8.045, 16.04, 40.025, 80];

function declaring(overrides: Partial<DirectionalShadowDeclaration> = {}): DirectionalShadowDeclaration {
  return {
    maxDistance: 80,
    pancakeSize: 20,
    fadeStart: 0.8,
    depthBias: -0.0003,
    normalBias: 2,
    splitCount: 4,
    splitOffsets: [0.1, 0.2, 0.5],
    blendSplits: false,
    sharesAtlas: true,
    ...overrides,
  };
}

function perspectiveCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 4000);
  camera.position.set(5.5, 25, 90);
  camera.lookAt(5.5, 12, 0);
  camera.updateMatrixWorld();
  return camera;
}

function fitInput(declaration = declaring(), lightRect = WHOLE_ATLAS): DirectionalShadowSplitFitInput {
  const lightPosition = new THREE.Vector3(11, 12.3, -31);
  return {
    camera: perspectiveCamera(),
    lightPosition,
    targetPosition: lightPosition.clone().add(SUN_DIRECTION),
    up: new THREE.Vector3(0, 1, 0),
    declaration,
    lightRect,
  };
}

function fit(input: DirectionalShadowSplitFitInput): DirectionalShadowSplits {
  const splits = fitDirectionalShadowSplits(input);
  if (!splits) throw new Error('expected finite split boxes, got null');
  return splits;
}

/** three's world-to-map matrix for a light carrying `box`, as the shadow pass builds it. */
function shadowMatrix(input: DirectionalShadowSplitFitInput, box: DirectionalShadowBox): THREE.Matrix4 {
  const light = new THREE.DirectionalLight();
  light.position.copy(input.lightPosition);
  light.target.position.copy(input.targetPosition);
  const { left, right, top, bottom, near, far } = box;
  Object.assign(light.shadow.camera, { left, right, top, bottom, near, far });
  light.shadow.camera.updateProjectionMatrix();
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  light.shadow.updateMatrices(light);
  return light.shadow.matrix;
}

function isInsideMap(matrix: THREE.Matrix4, point: THREE.Vector3): boolean {
  const mapped = point.clone().applyMatrix4(matrix);
  return [mapped.x, mapped.y, mapped.z].every(
    (value) => value >= -FACE_TOLERANCE && value <= 1 + FACE_TOLERANCE
  );
}

function boxWidth(box: DirectionalShadowBox): number {
  return box.right - box.left;
}

describe('fitDirectionalShadowSplits', () => {
  it('covers every corner of each split’s own slice', () => {
    const input = fitInput();
    const { boxes } = fit(input);
    const starts = [0.05, ...SPLIT_ENDS];
    boxes.forEach((box, split) => {
      const matrix = shadowMatrix(input, box);
      for (const corner of cameraSliceCorners(input.camera, starts[split]!, SPLIT_ENDS[split]!)) {
        expect(isInsideMap(matrix, corner)).toBe(true);
      }
    });
  });

  it('gives the nearest split the smallest box', () => {
    const widths = fit(fitInput()).boxes.map(boxWidth);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    expect(widths[0]! * 4).toBeLessThan(widths[3]!);
  });

  it('counts each of four splits’ texels against a quarter of the atlas', () => {
    const { boxes } = fit(fitInput());
    // Snapping moves each edge by at most half a step, two texels over the split's 2048.
    boxes.forEach((box) => expect(box.normalBias / 2).toBeCloseTo(boxWidth(box) / 2048, 2));
  });

  it('counts each of two splits’ texels against the whole atlas width', () => {
    const { boxes } = fit(fitInput(declaring({ splitCount: 2 })));
    boxes.forEach((box) => expect(box.normalBias / 2).toBeCloseTo(boxWidth(box) / ATLAS_SIZE, 2));
  });

  it('counts each of two splits’ texels against half the atlas for one of two lights', () => {
    // `light_storage.cpp:2614-2617`: two splits of a 2048-wide share are 2048 square.
    const { boxes } = fit(fitInput(declaring({ splitCount: 2 }), SECOND_OF_TWO));
    boxes.forEach((box) => expect(box.normalBias / 2).toBeCloseTo(boxWidth(box) / 2048, 2));
  });

  it('counts each of four splits’ texels against the taller side for one of two lights (edge case)', () => {
    // Four splits of a 2048 × 4096 share are 1024 × 2048, and the larger side counts.
    const { boxes } = fit(fitInput(declaring(), SECOND_OF_TWO));
    boxes.forEach((box) => expect(box.normalBias / 2).toBeCloseTo(boxWidth(box) / 2048, 2));
  });

  it('reaches every split as far towards the light as the whole view', () => {
    const nears = fit(fitInput()).boxes.map((box) => box.near);
    for (const near of nears) expect(near).toBeCloseTo(nears[3]!, 6);
  });

  it('keeps a caster far towards the light inside the nearest split’s map', () => {
    const input = fitInput();
    const { boxes } = fit(input);
    const nearSlice = cameraSliceCorners(input.camera, 0.05, SPLIT_ENDS[0]!);
    const centre = nearSlice.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).divideScalar(8);
    // Beyond one diameter of the nearest split's own sphere, the old reach.
    const caster = centre.clone().addScaledVector(SUN_DIRECTION, -100);
    expect(isInsideMap(shadowMatrix(input, boxes[0]!), caster)).toBe(true);
  });

  it('spends the declared bias over each split’s own depth range', () => {
    const { boxes } = fit(fitInput());
    for (const box of boxes) {
      // Godot's range is the split's diameter plus the pancake. The snapped width is that
      // diameter to within a few texels.
      const godotDepth = (box.bias * (box.far - box.near)) / -0.0003;
      expect(godotDepth).toBeCloseTo(boxWidth(box) + 20, 0);
    }
  });

  it('writes each split’s far end, bias and normal bias into its slot', () => {
    const { boxes, slots } = fit(fitInput());
    slots.forEach(([splitEnd, depthBias, normalBias], slot) => {
      expect(splitEnd).toBeCloseTo(SPLIT_ENDS[slot]!, 9);
      expect(depthBias).toBe(boxes[slot]!.bias);
      expect(normalBias).toBe(boxes[slot]!.normalBias);
    });
  });

  it('marks no slot as blending while blending is off', () => {
    const { slots } = fit(fitInput());
    expect(slots.slice(0, 3).map((slot) => slot[3])).toEqual([NO_BLEND, NO_BLEND, NO_BLEND]);
  });

  it('starts each blend a tenth short of its split’s far end', () => {
    const { slots } = fit(fitInput(declaring({ blendSplits: true })));
    slots
      .slice(0, 3)
      .forEach(([splitEnd, , , blendStart]) => expect(blendStart).toBeCloseTo(splitEnd * 0.9, 9));
  });

  it('widens each blending split to start where the previous split starts', () => {
    const blended = fit(fitInput(declaring({ blendSplits: true }))).boxes.map(boxWidth);
    const plain = fit(fitInput()).boxes.map(boxWidth);
    expect(blended[0]).toBe(plain[0]);
    expect(blended[2]).toBeGreaterThan(plain[2]!);
  });

  it('fades the shadow out over the far end of the last split', () => {
    const { fade, slots } = fit(fitInput());
    expect(fade.to).toBe(slots[3]![0]);
    expect(fade.to).toBe(80);
    expect(fade.from).toBeCloseTo(64, 12);
  });

  it('fades from the fade start of the last split’s far end, whichever split holds it', () => {
    const { fade, slots } = fit(fitInput(declaring({ fadeStart: 0.1 })));
    // Godot scales the far end itself, not the last split's own range.
    expect(fade.from).toBeCloseTo(8, 12);
    expect(fade.from).toBeLessThan(slots[0]![0]);
  });

  it('keeps a finite fade for a nan fade start (error case)', () => {
    expect(fit(fitInput(declaring({ fadeStart: Number.NaN }))).fade.from).toBeCloseTo(79.92, 12);
  });

  it('keeps a negative blend start apart from the no-blend marker (edge case)', () => {
    // Godot's setter keeps an offset below the inspector range, so a split can end behind the eye.
    const declaration = declaring({ blendSplits: true, splitOffsets: [-0.1, 0.2, 0.5] });
    const { slots } = fit(fitInput(declaration));
    expect(slots[0]![3]).toBeLessThan(0);
    expect(slots[0]![3]).toBeCloseTo(slots[0]![0] * 0.9, 9);
  });

  it('marks no slot as blending past the last split, even with blending on', () => {
    const { slots } = fit(fitInput(declaring({ blendSplits: true })));
    expect(slots[3]![3]).toBe(NO_BLEND);
  });

  it('repeats the last of two splits in the slots past it (edge case)', () => {
    const { boxes, fade, slots } = fit(fitInput(declaring({ splitCount: 2, blendSplits: true })));
    expect(boxes).toHaveLength(2);
    expect(fade.to).toBe(80);
    expect(slots[2]!.slice(0, 3)).toEqual(slots[1]!.slice(0, 3));
    expect(slots[3]!.slice(0, 3)).toEqual(slots[1]!.slice(0, 3));
    expect(slots[1]![0]).toBe(80);
    // Godot blends its last split against a slot it never set up. Here it does not blend.
    expect(slots[1]![3]).toBe(NO_BLEND);
    expect(slots[2]![3]).toBe(NO_BLEND);
  });

  it('answers null when a split gets no finite box (error case)', () => {
    const input = fitInput();
    input.camera.projectionMatrixInverse.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(fitDirectionalShadowSplits(input)).toBeNull();
  });
});
