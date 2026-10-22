/**
 * A SubViewport's canvas items resolve a PARENT_NODE filter and repeat to the SubViewport's own
 * `canvas_item_default_texture_filter` and `_repeat` (`viewport.cpp:3974-4017`), where the root
 * takes the project's (`editor_node.cpp:451-460`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseSubViewport } from './parser';
import { SubViewport } from './Component';
import { samplerProbe } from '../../../r3f/testing/samplerProbe';
import { type CanvasItemTextureSampler } from '../../../r3f/canvasItemTextureSampler';

const projectSettingsMock = vi.hoisted(() => ({ settings: null as Record<string, string> | null }));

vi.mock('../../../r3f/contexts/ProjectSettingsContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../r3f/contexts/ProjectSettingsContext')>()),
  useProjectSettings: () => projectSettingsMock,
}));

beforeEach(() => {
  projectSettingsMock.settings = null;
});

// CanvasItem enums (`canvas_item.h:52-69`).
const NEAREST = 1;
const LINEAR = 2;
const REPEAT_DISABLED = 1;
const REPEAT_MIRROR = 3;

function subViewport(raw: Record<string, string>): TscnNode {
  const heading = { type: 'node', attributes: { type: 'SubViewport', name: 'V' } };
  return {
    rawProperties: {},
    name: 'V',
    type: 'SubViewport',
    children: [],
    properties: parseSubViewport(heading, raw),
  };
}

/** The sampler an unstyled canvas item inside the sub-viewport resolves to. */
async function samplerInside(raw: Record<string, string>): Promise<CanvasItemTextureSampler> {
  const { Probe, resolved } = samplerProbe();
  await ReactThreeTestRenderer.create(
    <SubViewport node={subViewport(raw)}>
      <Probe />
    </SubViewport>
  );
  return resolved();
}

describe('<SubViewport> texture sampler default', () => {
  it('resolves to its own canvas_item_default_texture_filter and _repeat', async () => {
    // Viewport enums: filter 0 is Nearest, repeat 2 is Mirror.
    const inside = await samplerInside({
      canvas_item_default_texture_filter: '0',
      canvas_item_default_texture_repeat: '2',
    });
    expect(inside).toEqual({ filter: NEAREST, repeat: REPEAT_MIRROR });
  });

  it("keeps Linear and Disabled by default, not the project's canvas defaults", async () => {
    projectSettingsMock.settings = {
      'rendering/textures/canvas_textures/default_texture_filter': '0',
      'rendering/textures/canvas_textures/default_texture_repeat': '1',
    };
    expect(await samplerInside({})).toEqual({ filter: LINEAR, repeat: REPEAT_DISABLED });
  });
});
