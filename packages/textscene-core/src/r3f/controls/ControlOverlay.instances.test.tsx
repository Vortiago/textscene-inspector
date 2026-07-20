/**
 * The Control overlay renders Controls that live inside INSTANCED sub-scenes.
 *
 * A `.tscn` composed the normal Godot way — a HUD instanced into a level, a
 * widget instanced into that HUD — parses as a childless `Node` at the instance
 * boundary; the sub-scene's contents only exist in the **Live scene tree**
 * (ADR-0013), composed from the loader's cache. An overlay that walked the
 * static SceneGraph rendered an empty `display: contents` shell for the whole
 * HUD, so every UI assembled by instancing was invisible in the 2D workspace.
 *
 * Seam: `<ControlOverlay>` with its explicit props under a
 * `ResourceLoaderProvider` — the same boundary the other overlay suites use
 * (ADR-0009 keeps it independently testable). Assertions read the rendered DOM;
 * the live-tree walk itself is `liveSceneTree`'s own tested seam.
 */

import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { TscnExternalResource, TscnNode, TscnScene } from '../../parser/types';
import { ControlOverlay } from './index';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';

const LAYER_PATH = 'res://hud-layer.tscn';
const BADGE_PATH = 'res://hud-badge.tscn';

function node(name: string, type: string, extra: Partial<TscnNode> = {}): TscnNode {
  return {
    name,
    type,
    children: [],
    properties: { name } as Record<string, unknown>,
    ...extra,
  } as TscnNode;
}

/** A Label whose text is the assertion's observable. */
function label(name: string, text: string): TscnNode {
  return node(name, 'Label', { properties: { name, text } as Record<string, unknown> });
}

/** A TextureRect pointing at `id` — resolved against whatever scope it lands in. */
function textureRect(name: string, id: string): TscnNode {
  return node(name, 'TextureRect', {
    properties: { name, texture: `ExtResource("${id}")` } as Record<string, unknown>,
  });
}

function scene(nodes: TscnNode[], externalResources: TscnExternalResource[] = []): TscnScene {
  return { nodes, internalResources: [], externalResources } as TscnScene;
}

function instanceOf(name: string, id: string): TscnNode {
  return node(name, 'Node', { instance: `ExtResource("${id}")` });
}

function renderOverlay(
  nodes: TscnNode[],
  externalResources: TscnExternalResource[],
  fake: ReturnType<typeof createFakeResourceLoader>
): HTMLElement {
  return render(
    <ResourceLoaderProvider loader={fake.loader}>
      <ControlOverlay nodes={nodes} internalResources={[]} externalResources={externalResources} />
    </ResourceLoaderProvider>
  ).container;
}

describe('<ControlOverlay> — instanced sub-scenes', () => {
  it('renders the Controls inside an instanced sub-scene', () => {
    const loader = createFakeResourceLoader();
    loader.scenes.seed(LAYER_PATH, scene([label('LayerLabel', 'HUD LAYER')]));

    const container = renderOverlay(
      [node('Root', 'Node3D', { children: [instanceOf('Hud', '1_layer')] })],
      [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }],
      loader
    );

    expect(container.textContent).toContain('HUD LAYER');
  });

  it("resolves a sub-scene's texture in the SUB-SCENE's ExtResource scope", () => {
    // Host and sub-scene both declare id `1_tex` for DIFFERENT textures — the
    // shape a real project produces, since ids are per-file. Resolving the
    // instanced TextureRect against the host's scope picks the host's image, so
    // this fails LOUDLY (wrong src) rather than merely rendering nothing.
    const loader = createFakeResourceLoader();
    loader.scenes.seed(
      LAYER_PATH,
      scene([textureRect('LayerIcon', '1_tex')], [
        { id: '1_tex', path: 'res://sub-icon.svg', type: 'Texture2D' },
      ])
    );

    const container = renderOverlay(
      [instanceOf('Hud', '1_layer')],
      [
        { id: '1_layer', path: LAYER_PATH, type: 'PackedScene' },
        { id: '1_tex', path: 'res://HOST-icon.svg', type: 'Texture2D' },
      ],
      loader
    );

    const icon = container.querySelector('[data-control-type="TextureRect"]');
    expect(icon?.getAttribute('title')).toBe('res://sub-icon.svg');
  });

  it('renders Controls nested two instances deep', () => {
    // The game.tscn shape: a level instances a HUD, which instances a widget.
    const loader = createFakeResourceLoader();
    loader.scenes.seed(
      LAYER_PATH,
      // Single-root, as Godot writes a HUD: a CanvasLayer owning its children.
      scene(
        [
          node('HudLayer', 'CanvasLayer', {
            children: [label('LayerLabel', 'HUD LAYER'), instanceOf('Badge', '1_badge')],
          }),
        ],
        [{ id: '1_badge', path: BADGE_PATH, type: 'PackedScene' }]
      )
    );
    loader.scenes.seed(BADGE_PATH, scene([label('BadgeLabel', 'BADGE')]));

    const container = renderOverlay(
      [node('Root', 'Node3D', { children: [instanceOf('Hud', '1_layer')] })],
      [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }],
      loader
    );

    expect(container.textContent).toContain('HUD LAYER');
    expect(container.textContent).toContain('BADGE');
  });

  it('renders a MULTI-root sub-scene, which never collapses into the instance node', () => {
    // Instance root merge only applies to a single-root .tscn (ADR-0013); a
    // multi-root one keeps the instance node and injects the loaded roots
    // beneath it, still in the sub-scene's scope.
    const loader = createFakeResourceLoader();
    loader.scenes.seed(
      LAYER_PATH,
      scene([label('First', 'FIRST ROOT'), label('Second', 'SECOND ROOT')])
    );

    const container = renderOverlay(
      [instanceOf('Hud', '1_layer')],
      [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }],
      loader
    );

    expect(container.textContent).toContain('FIRST ROOT');
    expect(container.textContent).toContain('SECOND ROOT');
  });

  it('loads the sub-scene itself from a COLD cache', async () => {
    // Self-sufficiency: the overlay must not depend on a sibling layer having
    // walked the tree first. Nothing is seeded — the overlay has to request the
    // PackedScene and render once it resolves. Asserted through the DOM rather
    // than by spying on the loader, so it survives a change of request mechanism.
    const loader = createFakeResourceLoader();
    const container = renderOverlay(
      [instanceOf('Hud', '1_layer')],
      [{ id: '1_layer', path: LAYER_PATH, type: 'PackedScene' }],
      loader
    );

    expect(container.textContent).not.toContain('HUD LAYER');

    loader.scenes._resolve(LAYER_PATH, scene([label('LayerLabel', 'HUD LAYER')]));

    await waitFor(() => {
      expect(container.textContent).toContain('HUD LAYER');
    });
  });
});
