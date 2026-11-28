import { createExternalStore } from '../../utils/externalStore';
import { useRootScene } from '../hooks/useRootScene';
import { World2DContents } from '../world2D/World2DContents';

const view = createExternalStore({ pan: { x: 0, y: 0 }, zoom: 1 });

export function WrittenWorld2D() {
  const { rootScene, nodes } = useRootScene();
  return rootScene && nodes && <World2DContents {...rootScene} nodes={nodes} view={view} />;
}
