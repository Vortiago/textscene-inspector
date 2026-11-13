/**
 * A MeshInstance2D whose texture is a CanvasTexture. CanvasMeshItem draws it, so MultiMeshInstance2D
 * lights the same way.
 */
import './index';
import { MeshInstance2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import { UndrawnMeshesProvider } from '../../../r3f/contexts/UndrawnMeshesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import {
  CANVAS_TEXTURE_REF,
  describeCanvasTextureItem,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import { subResource } from '../../../testing/subResource';
import type { TscnInternalResource } from '../../../parser/types';

const QUAD = subResource('QuadMesh', 'Quad', { size: 'Vector2(100, 100)' });

function render(wrapper: TscnInternalResource) {
  const mesh = parsedNode(
    { type: 'MeshInstance2D', name: 'M' },
    { mesh: 'SubResource("Quad")', texture: CANVAS_TEXTURE_REF }
  );
  return renderLitItem(
    <UndrawnMeshesProvider>
      <NodePathProvider path="Root/M">
        <MeshInstance2D node={mesh} />
      </NodePathProvider>
    </UndrawnMeshesProvider>,
    [QUAD, wrapper]
  );
}

describeCanvasTextureItem('MeshInstance2D', render);
