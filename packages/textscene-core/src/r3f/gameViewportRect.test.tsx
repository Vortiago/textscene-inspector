/** The game viewport rect: Godot's `Rect2(0, 0, size)` (`renderer_viewport.cpp:390`) in canvas pixels. */
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGameViewportRect } from './gameViewportRect';
import { withProject } from './testing/ProjectFixture';

describe('useGameViewportRect', () => {
  it("frames Godot's default 1152x648 at the canvas origin without a project", () => {
    expect(renderHook(useGameViewportRect).result.current).toEqual({ x: 0, y: 0, w: 1152, h: 648 });
  });

  it("takes the project's viewport size", async () => {
    const project = '[display]\n\nwindow/size/viewport_width=1280\nwindow/size/viewport_height=720\n';
    const { result } = renderHook(useGameViewportRect, { wrapper: withProject(project) });
    await waitFor(() => expect(result.current).toEqual({ x: 0, y: 0, w: 1280, h: 720 }));
  });

  it('keeps one rect across renders while the size holds', () => {
    const { result, rerender } = renderHook(useGameViewportRect);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
