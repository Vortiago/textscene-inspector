import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PixelSnapProvider, useSnaps2DTransformsToPixel } from './PixelSnapContext';
import { projectSnaps2DTransformsToPixel } from '../../parser/projectSettingsParser';

const inSubViewport =
  (snaps: boolean) =>
  ({ children }: { children: ReactNode }) => <PixelSnapProvider snaps={snaps}>{children}</PixelSnapProvider>;

describe('useSnaps2DTransformsToPixel', () => {
  it('takes the project setting in the root viewport, off with no project', () => {
    expect(renderHook(useSnaps2DTransformsToPixel).result.current).toBe(false);
  });

  it('takes a SubViewport’s own property', () => {
    expect(renderHook(useSnaps2DTransformsToPixel, { wrapper: inSubViewport(true) }).result.current).toBe(
      true
    );
  });
});

describe('projectSnaps2DTransformsToPixel', () => {
  it('reads the setting', () => {
    expect(projectSnaps2DTransformsToPixel({ 'rendering/2d/snap/snap_2d_transforms_to_pixel': 'true' })).toBe(
      true
    );
  });

  it('is off when the project omits it', () => {
    expect(projectSnaps2DTransformsToPixel({})).toBe(false);
  });
});
