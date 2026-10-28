/**
 * Godot rebuilds the texture atlases once a frame, before any viewport draws. A mounted frame loop
 * takes that step, so a render under it rebuilds nothing of its own.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ViewportPassOrchestrator, ViewportPassProvider } from '../contexts/ViewportPassRegistryContext';
import { areAtlasesUpdatedPerFrame } from './updateTextureAtlases';

async function mountOrchestrator() {
  return ReactThreeTestRenderer.create(
    <ViewportPassProvider>
      <ViewportPassOrchestrator />
    </ViewportPassProvider>
  );
}

describe('areAtlasesUpdatedPerFrame', () => {
  it('is true while a pass orchestrator runs the frame loop, even with no passes', async () => {
    const renderer = await mountOrchestrator();
    expect(areAtlasesUpdatedPerFrame()).toBe(true);
    await renderer.unmount();
  });

  it('is false once the orchestrator unmounts, so each render rebuilds the atlases itself', async () => {
    const renderer = await mountOrchestrator();
    await renderer.unmount();
    expect(areAtlasesUpdatedPerFrame()).toBe(false);
  });
});
