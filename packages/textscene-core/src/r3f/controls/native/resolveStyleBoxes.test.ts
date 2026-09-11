/**
 * `resolveStyleBoxes` (`buildSolveTree.ts`) — the walker's own
 * `theme_override_styles/*` resolution, now covering all four concrete
 * StyleBox kinds via `native/parseStyleBox.ts`'s discriminated
 * `ResolvedStyleBox`. Previously `StyleBoxLine`/`StyleBoxTexture` overrides
 * were silently DROPPED (parsed only `StyleBoxFlat`/`StyleBoxEmpty`) — these
 * tests pin that they are kept.
 */
import { describe, expect, it } from 'vitest';
import { resolveStyleBoxes } from './buildSolveTree';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../parser/types';

function node(overrides: Record<string, string>): TscnNode {
  return {
    name: 'N',
    type: 'Panel',
    children: [],
    properties: { themeOverrideStyles: overrides } as unknown as TscnNode['properties'],
  };
}

const internalResources: TscnInternalResource[] = [
  { id: 'Flat_x', type: 'StyleBoxFlat', data: { bg_color: 'Color(1, 0, 0, 1)' } },
  {
    id: 'Line_x',
    type: 'StyleBoxLine',
    data: { color: 'Color(0, 1, 0, 1)', thickness: '2', vertical: 'true' },
  },
  {
    id: 'Texture_x',
    type: 'StyleBoxTexture',
    data: { texture: 'ExtResource("1_tex")', texture_margin_left: '3' },
  },
];

const externalResources: TscnExternalResource[] = [{ id: '1_tex', path: 'res://icon.png', type: 'Texture2D' }];

describe('resolveStyleBoxes', () => {
  it('returns an empty map when the node declares no theme_override_styles', () => {
    const n: TscnNode = { name: 'N', type: 'Panel', children: [], properties: {} };
    expect(resolveStyleBoxes(n, { externalResources: [], internalResources })).toEqual({});
  });

  it('keeps a StyleBoxFlat override unchanged', () => {
    const out = resolveStyleBoxes(node({ panel: 'SubResource("Flat_x")' }), { externalResources, internalResources });
    expect(out.panel?.bgColor).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('keeps a StyleBoxLine override where it previously dropped it, with the correct effective content margin', () => {
    const out = resolveStyleBoxes(node({ separator: 'SubResource("Line_x")' }), {
      externalResources,
      internalResources,
    });
    const box = out.separator as { styleBoxKind?: string; line?: { color: unknown } } | undefined;
    expect(box).toBeDefined();
    expect(box!.styleBoxKind).toBe('line');
    expect(box!.line?.color).toEqual({ r: 0, g: 1, b: 0, a: 1 });
    // vertical=true, thickness=2, no content_margin authored → get_style_margin = thickness/2 on left/right.
    expect(out.separator!.contentMargin).toEqual({ left: 1, top: 0, right: 1, bottom: 0 });
  });

  it('keeps a StyleBoxTexture override where it previously dropped it, resolved against the node’s OWN external-resource scope', () => {
    const out = resolveStyleBoxes(node({ panel: 'SubResource("Texture_x")' }), {
      externalResources,
      internalResources,
    });
    const box = out.panel as { styleBoxKind?: string; texture?: { texture?: string } } | undefined;
    expect(box).toBeDefined();
    expect(box!.styleBoxKind).toBe('texture');
    expect(box!.texture?.texture).toBe('ExtResource("1_tex")');
    expect(out.panel!.contentMargin).toEqual({ left: 3, top: 0, right: 0, bottom: 0 });
  });

  it('omits a slot whose ref fails to resolve, same as before (an unknown id)', () => {
    const out = resolveStyleBoxes(node({ panel: 'SubResource("nope")' }), { externalResources, internalResources });
    expect(out.panel).toBeUndefined();
  });
});
