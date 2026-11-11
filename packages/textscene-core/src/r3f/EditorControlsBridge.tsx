/**
 * `<EditorControlsBridge>` hands the navigation handle's reset and freelook to
 * `ViewportActionsContext`, so the toolbar reaches both from outside the `<Canvas>`.
 * `<GodotEditorControls>` publishes the handle as R3F's `state.controls`.
 */
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { EditorControlsHandle } from './EditorControlsHandle.js';
import { freelookControlOf } from './useFreelook.js';

export function EditorControlsBridge() {
  const actions = useOptionalViewportActions();
  const registerResetHandler = actions?.registerResetHandler;
  const registerFreelook = actions?.registerFreelook;
  const get = useThree((s) => s.get);
  const published = useThree((s) => s.controls);
  const controls = published instanceof EditorControlsHandle ? published : null;

  useEffect(() => {
    if (!registerResetHandler || !controls) return undefined;
    return registerResetHandler(() => controls.reset());
  }, [registerResetHandler, controls]);

  useEffect(() => {
    if (!registerFreelook || !controls) return undefined;
    return registerFreelook(freelookControlOf(controls, get));
  }, [registerFreelook, controls, get]);

  return null;
}
