import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasItemCommands } from '../canvasShader/CanvasShaderSlot';
import { READY_REFERENCE, renderWithTexture } from './textureLoadStates.testkit';
import { TestDrawer } from './testDrawer.testkit';

/** Written by the mocked `CanvasItem2D` on each render, cleared after each test. */
const asked = vi.hoisted(() => ({ shadedCommands: [] as Array<() => CanvasItemCommands | null> }));

vi.mock('../components/CanvasItem2D', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/CanvasItem2D')>();
  return {
    CanvasItem2D: (props: ComponentProps<typeof actual.CanvasItem2D>) => {
      if (props.shadedCommands) asked.shadedCommands.push(props.shadedCommands);
      return <actual.CanvasItem2D {...props} />;
    },
  };
});

afterEach(() => {
  asked.shadedCommands.length = 0;
});

function lastCommands(): CanvasItemCommands | null {
  return asked.shadedCommands.at(-1)!();
}

describe('CanvasMeshBody shaded commands', () => {
  it('keeps the mesh commands of its surfaces when the texture changes', async () => {
    const { update } = await renderWithTexture(<TestDrawer />);
    const before = lastCommands();

    await update(<TestDrawer texture={READY_REFERENCE} />);
    const after = lastCommands();

    expect(after!.texture).not.toBe(before!.texture);
    expect(after!.commands).toBe(before!.commands);
  });
});
