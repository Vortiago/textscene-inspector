/**
 * The prompt an empty canvas shows, drawn as a Label3D in the bundled font. `LabelGlyphs` is
 * `React.lazy`, so the shaping engine stays out of the first paint.
 */

import { lazy } from 'react';
import type { TscnNode } from '../parser/types';
import { parseLabel3D } from '../nodes/3d/label3d/parser';
import type { Label3DProperties } from '../nodes/3d/label3d/types';
import { withGeometryInstance } from './visibilityRange/geometryInstance';
import type { NodeComponentProps } from './NodeComponentRegistry';
import { PendingSuspense } from '../resources/PendingSuspense';

const LabelGlyphs = lazy(() => import('../nodes/3d/label3d/LabelGlyphs'));

/** 0.35 world units high above the grid's centre, grey with a thin black outline. */
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

const PROMPT_HEIGHT = 0.4;

const PromptGlyphs = withGeometryInstance(({ node }: NodeComponentProps) => (
  <LabelGlyphs nodeRef={{ current: null }} properties={node.properties as Label3DProperties} />
));

export function EmptyScenePrompt() {
  const { pixel_size } = PROMPT_NODE.properties as Label3DProperties;
  return (
    <group position={[0, PROMPT_HEIGHT, 0]} scale={pixel_size}>
      <PendingSuspense>
        <PromptGlyphs node={PROMPT_NODE} />
      </PendingSuspense>
    </group>
  );
}
