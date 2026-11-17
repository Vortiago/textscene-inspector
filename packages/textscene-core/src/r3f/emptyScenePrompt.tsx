import type { RefObject } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../parser/types';
import { parseLabel3D } from '../nodes/3d/label3d/parser';
import type { Label3DProperties } from '../nodes/3d/label3d/types';
import LabelGlyphs from '../nodes/3d/label3d/LabelGlyphs';
import { withGeometryInstance } from './visibilityRange/geometryInstance';
import type { NodeComponentProps } from './NodeComponentRegistry';

// Parsed, not written out: the parser holds Label3D's defaults for every property not named here.
const PROMPT_NODE: TscnNode = {
  name: 'EmptyScenePrompt',
  type: 'Label3D',
  rawProperties: {},
  children: [],
  properties: parseLabel3D(
    { type: 'Label3D', attributes: {} },
    {
      text: '"Load a scene to begin"',
      font_size: '35',
      pixel_size: '0.01',
      modulate: 'Color(0.533, 0.533, 0.533, 1)',
      outline_size: '2',
    }
  ),
};

const PROMPT_PIXEL_SIZE = (PROMPT_NODE.properties as Label3DProperties).pixel_size;
const PROMPT_HEIGHT = 0.4;
const NO_NODE_GROUP: RefObject<THREE.Object3D | null> = { current: null };

const PromptGlyphs = withGeometryInstance(({ node }: NodeComponentProps) => (
  <LabelGlyphs nodeRef={NO_NODE_GROUP} properties={node.properties as Label3DProperties} />
));

export default function EmptyScenePrompt() {
  return (
    <group position={[0, PROMPT_HEIGHT, 0]} scale={PROMPT_PIXEL_SIZE}>
      <PromptGlyphs node={PROMPT_NODE} />
    </group>
  );
}
