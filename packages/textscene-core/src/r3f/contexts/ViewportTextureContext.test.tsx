/**
 * Every Texture2D slot reads the target registry, so a publish re-renders only the readers of the
 * path it publishes at.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { ViewportTextureProvider, useViewportTexture } from './ViewportTextureContext.js';
import { ViewportTexturePublisher, viewportEntry } from '../testing/ViewportTexturePublisher';

/** Counts its renders into `renders`. */
function Reader({ path, renders }: { path: string | null; renders: number[] }) {
  useViewportTexture(path);
  renders[0]!++;
  return null;
}

const ENTRY = viewportEntry(new THREE.Texture(), { x: 4, y: 4 });

describe('useViewportTexture', () => {
  it('leaves a reader of no path alone when a target publishes', () => {
    const renders = [0];
    const reader = <Reader path={null} renders={renders} />;
    const { rerender } = render(<ViewportTextureProvider>{reader}</ViewportTextureProvider>);
    rerender(
      <ViewportTextureProvider>
        {reader}
        <ViewportTexturePublisher path="/Root/View" entry={ENTRY} />
      </ViewportTextureProvider>
    );
    expect(renders[0]).toBe(1);
  });

  it('gives a reader the target published at its path', () => {
    let read: unknown = null;
    function Probe() {
      read = useViewportTexture('/Root/View');
      return null;
    }
    render(
      <ViewportTextureProvider>
        <Probe />
        <ViewportTexturePublisher path="/Root/View" entry={ENTRY} />
      </ViewportTextureProvider>
    );
    expect(read).toBe(ENTRY);
  });
});
