/**
 * The root canvas samples its shadow inputs inside its own frame, after every `_process` and
 * animation of that frame (`renderer_viewport.cpp:688`), so a moving light's shadow is never a
 * frame behind it.
 */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { CaptureRenderer } from '../../testing/CaptureRenderer';
import { advanceFrameWithStubbedGl } from '../../testing/stubbedGl';
import { TICK_STEP, UNMOVED_LEFT, type PoseReading } from '../../testing/tickedLightProbe';

const reading = vi.hoisted((): PoseReading => ({ left: null }));

vi.mock('../../NodeDispatcher.js', async () => {
  const { TickedLightProbe } = await import('../../testing/tickedLightProbe');
  return { NodeDispatcher: () => <TickedLightProbe reading={reading} /> };
});

import { World2DContents } from './World2DContents';

const noScene = { nodes: [], internalResources: [], externalResources: [], pan: { x: 0, y: 0 }, zoom: 1 };

describe('the root canvas frame', () => {
  it("samples a light's shadow pose after the animation tick of the frame it draws", async () => {
    const captured: { current: THREE.WebGLRenderer | null } = { current: null };
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...noScene} />
        <CaptureRenderer captured={captured} />
      </SelectionProvider>
    );
    expect(reading.left).toBe(UNMOVED_LEFT);

    // The pose is React state, so the frame's update flushes inside `act`.
    await act(() => advanceFrameWithStubbedGl(renderer, captured.current!));

    expect(reading.left).toBe(UNMOVED_LEFT + TICK_STEP);
  });
});
