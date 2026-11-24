import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';

import { viewProviders } from './viewProviders';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import {
  useRegisterViewportRect,
  useViewportRect,
  type RegisterViewportRect,
} from './contexts/ViewportRectContext';

function withViewProviders() {
  return viewProviders({
    hierarchyValue: { sceneGraph: null, panelId: 'p' },
    loader: createFakeResourceLoader().loader,
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

describe('viewProviders', () => {
  it("carries a stretching container's published rect to the sub-viewport at the same path", () => {
    let register!: RegisterViewportRect;
    const { getByTestId } = render(
      withViewProviders()(
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
