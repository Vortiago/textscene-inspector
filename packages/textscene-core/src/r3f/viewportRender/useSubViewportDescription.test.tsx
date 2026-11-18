import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { heading } from '../../parser/testing/parserKit';
import { parseSubViewport } from '../../nodes/viewport/subviewport/parser';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types';
import { withProject } from '../testing/ProjectFixture';
import { useSubViewportDescription } from './useSubViewportDescription';

function subViewport(properties: Record<string, string>): SubViewportProperties {
  return parseSubViewport(heading('SubViewport', { name: 'V' }), properties);
}

describe('useSubViewportDescription', () => {
  it("describes the node with the game's rules", () => {
    const { result } = renderHook(() => useSubViewportDescription(subViewport({ msaa_3d: '2' })), {
      wrapper: withProject(null),
    });

    expect(result.current).toMatchObject({ msaa3D: 2, camera: 'current', drawsEditorChrome: false });
  });

  it("takes the project's bias where the node sets none", async () => {
    const { result } = renderHook(() => useSubViewportDescription(subViewport({})), {
      wrapper: withProject('[rendering]\ntextures/default_filters/texture_mipmap_bias=-0.5\n'),
    });

    await waitFor(() => expect(result.current.mipmapBias).toBe(-0.5));
  });

  it('keeps one object while equal properties arrive as a new object (edge case)', () => {
    const { result, rerender } = renderHook(({ properties }) => useSubViewportDescription(properties), {
      initialProps: { properties: subViewport({ msaa_2d: '1' }) },
      wrapper: withProject(null),
    });
    const first = result.current;

    rerender({ properties: subViewport({ msaa_2d: '1' }) });

    expect(result.current).toBe(first);
  });
});
