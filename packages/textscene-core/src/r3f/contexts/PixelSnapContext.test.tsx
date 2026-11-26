import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PixelSnapProvider, useSnaps2DTransformsToPixel } from './PixelSnapContext';

const inSubViewport =
  (snaps: boolean) =>
  ({ children }: { children: ReactNode }) => <PixelSnapProvider snaps={snaps}>{children}</PixelSnapProvider>;

describe('useSnaps2DTransformsToPixel', () => {
  it('is off in the root viewport of no project', () => {
    expect(renderHook(useSnaps2DTransformsToPixel).result.current).toBe(false);
  });

  it('takes a SubViewport’s own property', () => {
    expect(renderHook(useSnaps2DTransformsToPixel, { wrapper: inSubViewport(true) }).result.current).toBe(
      true
    );
  });
});
