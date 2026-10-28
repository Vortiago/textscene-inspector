/**
 * `useBuildSolveTree` resolves each `theme_override_styles/*` slot of a Control
 * and keeps all four StyleBox kinds through `native/parseStyleBox.ts`'s
 * `ResolvedStyleBox`.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { useBuildSolveTree } from './buildSolveTree';
import { controlNode } from './testing/solveNode';
import { isLocalToScene } from '../../../resources/textures/viewporttexture/localToScene';
import type { StyleBoxTextureData } from './styleBoxTexture';

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
  {
    id: 'Texture_local',
    type: 'StyleBoxTexture',
    data: { texture: 'ExtResource("1_tex")', resource_local_to_scene: 'true' },
  },
  { id: 'Theme_shared', type: 'Theme', data: { 'Panel/styles/panel': 'SubResource("Texture_local")' } },
  {
    id: 'Theme_local',
    type: 'Theme',
    data: { 'Panel/styles/panel': 'SubResource("Texture_local")', resource_local_to_scene: 'true' },
  },
];

const externalResources: TscnExternalResource[] = [
  { id: '1_tex', path: 'res://icon.png', type: 'Texture2D' },
];

function panelWith(overrides?: Record<string, string>): TscnNode {
  return controlNode('N', 'Panel', overrides ? { themeOverrideStyles: overrides } : {});
}

function styleBoxesOf(node: TscnNode) {
  const { result } = renderHook(() => useBuildSolveTree([node], externalResources, internalResources));
  return result.current.tree[0]!.styleBoxes;
}

describe('useBuildSolveTree style boxes', () => {
  it('resolves no slot when the node declares no theme_override_styles', () => {
    expect(styleBoxesOf(panelWith())).toEqual({});
  });

  it('keeps a StyleBoxFlat override', () => {
    expect(styleBoxesOf(panelWith({ panel: 'SubResource("Flat_x")' })).panel?.bgColor).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });

  it('keeps a StyleBoxLine override with its effective content margin', () => {
    const boxes = styleBoxesOf(panelWith({ separator: 'SubResource("Line_x")' }));
    const box = boxes.separator as { styleBoxKind?: string; line?: { color: unknown } } | undefined;
    expect(box?.styleBoxKind).toBe('line');
    expect(box?.line?.color).toEqual({ r: 0, g: 1, b: 0, a: 1 });
    // vertical=true, thickness=2, no content_margin authored: get_style_margin is thickness/2 on left and right.
    expect(boxes.separator!.contentMargin).toEqual({ left: 1, top: 0, right: 1, bottom: 0 });
  });

  it("keeps a StyleBoxTexture override, resolved against the node's own external-resource scope", () => {
    const boxes = styleBoxesOf(panelWith({ panel: 'SubResource("Texture_x")' }));
    const box = boxes.panel as { styleBoxKind?: string; texture?: { texture?: string } } | undefined;
    expect(box?.styleBoxKind).toBe('texture');
    expect(box?.texture?.texture).toBe('ExtResource("1_tex")');
    expect(boxes.panel!.contentMargin).toEqual({ left: 3, top: 0, right: 0, bottom: 0 });
  });

  it('omits a slot whose ref names an unknown id', () => {
    expect(styleBoxesOf(panelWith({ panel: 'SubResource("nope")' })).panel).toBeUndefined();
  });

  /** A ViewportTexture in a StyleBoxTexture is set up only when every holder is local to scene (`core/io/resource.cpp:497-503`). */
  it('holds an override StyleBoxTexture texture through the StyleBoxTexture', () => {
    const boxes = styleBoxesOf(panelWith({ panel: 'SubResource("Texture_x")' }));
    expect(textureOf(boxes.panel)?.holders).toEqual([internalResources[2]]);
  });

  it('holds a Theme StyleBoxTexture texture through the Theme too, local to scene as the Theme says', () => {
    const holders = ['Theme_shared', 'Theme_local'].map((id) => {
      const boxes = styleBoxesOf(controlNode('N', 'Panel', { theme: `SubResource("${id}")` }));
      return textureOf(boxes.panel)?.holders.map(isLocalToScene);
    });
    expect(holders).toEqual([
      [false, true],
      [true, true],
    ]);
  });
});

function textureOf(box: unknown): StyleBoxTextureData | undefined {
  return (box as { texture?: StyleBoxTextureData } | undefined)?.texture;
}
