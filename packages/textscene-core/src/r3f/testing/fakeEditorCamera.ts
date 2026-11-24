import { createEditorCameras } from '../editorCamera/editorCameras';
import { EMPTY_VIEW_STATUS } from '../viewStatus/viewStatus';
import { renderHook } from '@testing-library/react';
import { useHeardStatus } from '../components/TscnPreviewShell/previewViewStatus';

export function fakeEditorView() {
  const cameras = createEditorCameras();
  const heard = renderHook(useHeardStatus).result.current;
  const freelook = { isToggled: false, isAvailable: true };
  const calls: string[] = [];
  const report = () => heard.onStatusChange({ ...EMPTY_VIEW_STATUS, freelook: { ...freelook } });
  cameras.slot('Camera3D').bind({
    get: (property) => (property === 'freelook' ? freelook.isToggled : null),
    set(property, value) {
      if (property !== 'freelook' || typeof value !== 'boolean') return false;
      freelook.isToggled = value;
      report();
      return true;
    },
    call(method) {
      calls.push(method);
      return null;
    },
  });
  report();
  return {
    view: { editorCamera: cameras.of('3D') },
    heard,
    calls,
    /** The canvas leaves the toggle, as on Escape, or changes the projection. */
    report(next: Partial<typeof freelook>) {
      Object.assign(freelook, next);
      report();
    },
  };
}
