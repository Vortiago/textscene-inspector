/**
 * The preview panel's provider stack carries a stretching container's forced rect to the
 * sub-viewport it sizes. Without `ViewportRectProvider` in the stack, every consumer reads the
 * empty default and a stretching container keeps the authored size.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';

import { previewShellProviders } from './previewShellProviders';
import {
  useRegisterViewportRect,
  useViewportRect,
  type RegisterViewportRect,
} from '../../contexts/ViewportRectContext';

function withShellProviders() {
  return previewShellProviders({
    hierarchyValue: { sceneGraph: null, panelId: 'p' },
    initialActiveCameraPath: undefined,
    onMissingPathsChange: undefined,
    initialViewportMode: undefined,
    initialViewport: { mode: '2D', showGrid: false, frameOnOpen: false },
    panelId: 'p',
    rootScenePath: 'main.tscn',
  });
}

function Publisher({ onReady }: { onReady: (register: RegisterViewportRect) => void }) {
  const register = useRegisterViewportRect();
  useEffect(() => onReady(register), [register, onReady]);
  return null;
}

function Reader({ path }: { path: string }) {
  const rect = useViewportRect(path);
  return <span data-testid="rect">{rect ? `${rect.x}x${rect.y}` : 'none'}</span>;
}

describe('previewShellProviders', () => {
  it('carries a published viewport rect to a consumer at the same path', () => {
    let register!: RegisterViewportRect;
    const { getByTestId } = render(
      withShellProviders()(
        <>
          <Publisher onReady={(fn) => (register = fn)} />
          <Reader path="Booth/View" />
        </>
      )
    );
    act(() => {
      register('Booth/View', { x: 150, y: 100 });
    });
    expect(getByTestId('rect').textContent).toBe('150x100');
  });
});
