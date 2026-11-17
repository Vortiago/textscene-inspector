import { useDrawsEditorOnly } from '../../../../r3f/contexts/EditorHintContext';
import type { Light2DProperties } from './types';

/** `enabled`, and outside the editor not `editor_only` (`light_2d.cpp:38-59`). */
export function useLight2DEnabled(props: Light2DProperties): boolean {
  const drawsEditorOnly = useDrawsEditorOnly(props.editor_only);
  return props.enabled && drawsEditorOnly;
}
