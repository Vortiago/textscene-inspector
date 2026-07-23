import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Modulate2DContext, multiplyModulate, useParentModulate } from '../../../r3f/canvasItemModulate';
import { node2dGroupProps, node2dGroupSpread } from '../../../r3f/node2dTransform';
import type { CanvasModulateProperties } from './types';

export function CanvasModulate({ node, children }: NodeComponentProps) {
  const props = node.properties as CanvasModulateProperties;

  const transform = useMemo(
    () => node2dGroupSpread(node2dGroupProps(props, 0)),
    [props],
  );

  const parentModulate = useParentModulate();
  const modulate = useMemo(
    () => multiplyModulate(parentModulate, multiplyModulate(props.modulate, props.color)),
    [parentModulate, props.modulate, props.color],
  );

  return (
    <group name={node.name} {...transform}>
      <Modulate2DContext.Provider value={modulate}>
        {children}
      </Modulate2DContext.Provider>
    </group>
  );
}
