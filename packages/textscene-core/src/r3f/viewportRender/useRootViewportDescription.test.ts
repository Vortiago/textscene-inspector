import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { useRootViewportDescription } from './useRootViewportDescription';
import type { ViewportDescription } from './viewportDescription';

vi.mock('../contexts/ProjectSettingsContext.js', () => ({ useProjectSettings: vi.fn() }));

function descriptionsOfTwoReaders(
  settings: Record<string, string> | null
): [ViewportDescription, ViewportDescription] {
  vi.mocked(useProjectSettings).mockReturnValue({ settings } as ReturnType<typeof useProjectSettings>);
  return [
    renderHook(useRootViewportDescription).result.current,
    renderHook(useRootViewportDescription).result.current,
  ];
}

describe('useRootViewportDescription', () => {
  it('gives every reader of one settings object the same description', () => {
    const [first, second] = descriptionsOfTwoReaders({
      'rendering/textures/default_filters/texture_mipmap_bias': '-0.5',
    });

    expect(first).toBe(second);
  });

  it('gives every reader the same description without a project', () => {
    const [first, second] = descriptionsOfTwoReaders(null);

    expect(first).toBe(second);
  });

  it('builds a new description for new settings', () => {
    const [before] = descriptionsOfTwoReaders({});
    const [after] = descriptionsOfTwoReaders({
      'rendering/textures/default_filters/texture_mipmap_bias': '1',
    });

    expect([before.mipmapBias, after.mipmapBias]).toEqual([0, 1]);
  });
});
