/**
 * <TextureRect> render contract: the degraded path. In a non-DOM/decode test
 * (and outside a ResourceLoaderProvider) the texture never decodes, so the
 * component renders its placeholder — a dashed, layout-sized box titled with the
 * resolved texture path. The stretch/expand → CSS mapping (the loaded path) is
 * unit-tested in Component.fit.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TextureRect } from './Component';
import { parseTextureRect } from './parser';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnExternalResource, TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'TextureRect', name: 'Portrait' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Portrait', type: 'TextureRect', children: [], properties: parseTextureRect(heading, raw) };
}

function renderRect(raw: Record<string, string> = {}, externalResources: TscnExternalResource[] = []) {
  const { container } = render(
    <SceneResourcesProvider externalResources={externalResources}>
      <TextureRect node={node(raw)} />
    </SceneResourcesProvider>
  );
  return container.querySelector('[data-control-type="TextureRect"]') as HTMLElement;
}

describe('<TextureRect>', () => {
  it('renders a dashed, layout-sized placeholder when the texture is unavailable', () => {
    const div = renderRect();
    expect(div.getAttribute('data-control-fallback')).toBe('true');
    expect(div.style.outline).toContain('dashed');
    expect(div.style.position).toBe('absolute'); // free-parent layout applied to the wrapper
  });

  it('titles the placeholder with the resolved texture path (or "no texture")', () => {
    expect(renderRect().getAttribute('title')).toBe('no texture');

    const ext: TscnExternalResource = { id: '1_abc', type: 'Texture2D', path: 'res://portrait.png' };
    const withTex = renderRect({ texture: 'ExtResource("1_abc")' }, [ext]);
    expect(withTex.getAttribute('title')).toBe('res://portrait.png');
  });
});
