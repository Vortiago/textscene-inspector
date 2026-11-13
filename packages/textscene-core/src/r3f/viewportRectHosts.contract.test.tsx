/**
 * A stretched SubViewport waits for the rect its SubViewportContainer publishes, so a host that
 * mounts the viewport passes without `ViewportRectProvider` would leave it blank. Every host reaches
 * the passes through `previewShellProviders`, and this contract fails when one stops doing so.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TscnSceneProvider } from './TscnSceneProvider';
import {
  useRegisterViewportRect,
  useViewportRect,
  type RegisterViewportRect,
} from './contexts/ViewportRectContext';
import type { ResourceProvider } from '../resources/ResourceProvider';

const SCENE = '[gd_scene format=3]\n\n[node name="Root" type="Control"]\n';

function Publisher({ onReady }: { onReady: (register: RegisterViewportRect) => void }) {
  const register = useRegisterViewportRect();
  useEffect(() => onReady(register), [register, onReady]);
  return null;
}

function Reader({ path }: { path: string }) {
  const rect = useViewportRect(path);
  return <span data-testid="rect">{rect ? `${rect.x}x${rect.y}` : 'none'}</span>;
}

/** The production files under `dir` that mount the viewport pass registry, which the rect travels beside. */
function passProviderMounts(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(
      (entry) => entry.isFile() && /\.tsx$/.test(entry.name) && !/\.test\.|\.testkit\./.test(entry.name)
    )
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => readFileSync(file, 'utf8').includes('<ViewportPassProvider>'));
}

describe('the viewport rect provider in every host entry', () => {
  it('reaches a consumer through TscnSceneProvider, the renderer package host', () => {
    let register!: RegisterViewportRect;
    const provider: ResourceProvider = { loadResource: vi.fn(async () => null) };
    const { getByTestId } = render(
      <TscnSceneProvider source={SCENE} provider={provider}>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Root/Booth/View" />
      </TscnSceneProvider>
    );
    act(() => {
      register('Root/Booth/View', { x: 150, y: 100 });
    });
    expect(getByTestId('rect').textContent).toBe('150x100');
  });

  it('mounts the pass registry only where the rect provider sits beside it', () => {
    const mounts = passProviderMounts(join(import.meta.dirname, '..'));
    expect(mounts.map((file) => file.split('/src/')[1])).toEqual([
      'r3f/components/TscnPreviewShell/previewShellProviders.tsx',
    ]);
    expect(readFileSync(mounts[0]!, 'utf8')).toContain('<ViewportRectProvider>');
  });
});
