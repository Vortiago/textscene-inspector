import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ViewportModeProvider, type ViewportMode } from '../ViewportMode/ViewportModeContext';
import { fakeEditorView } from '../../testing/fakeEditorCamera';
import { PreviewViewStatusProvider } from '../TscnPreviewShell/previewViewStatus';
import { ViewportToolbar } from './ViewportToolbar';
import { TestPreviewCamera } from '../TscnPreviewShell/previewCamera.testkit';

function renderToolbar({
  mode = '3D',
  previewedCameraPath = null,
  editor = fakeEditorView(),
}: {
  mode?: ViewportMode;
  previewedCameraPath?: string | null;
  editor?: ReturnType<typeof fakeEditorView>;
} = {}) {
  render(
    <ViewportModeProvider initialMode={mode}>
      <PreviewViewStatusProvider value={editor.heard}>
        <TestPreviewCamera initialCamera={previewedCameraPath}>
          <ViewportToolbar
            view={{
              ...editor.view,
              settled: new Promise(() => {}),
              captureImage: () => new Promise(() => {}),
            }}
          />
        </TestPreviewCamera>
      </PreviewViewStatusProvider>
    </ViewportModeProvider>
  );
  return screen.queryByRole('button', { name: 'Freelook' });
}

describe('ViewportToolbar Freelook button', () => {
  it('writes freelook on the editor camera on a click, and shows it pressed', async () => {
    const button = renderToolbar();
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => fireEvent.click(button!));

    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('follows a toggle that ends outside the toolbar, as on Escape', async () => {
    const editor = fakeEditorView();
    const button = renderToolbar({ editor });
    await act(async () => fireEvent.click(button!));

    act(() => editor.report({ isToggled: false }));

    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  it('is disabled during a camera preview, and says why', () => {
    const button = renderToolbar({ previewedCameraPath: 'Root/Camera3D' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.title).toContain('camera preview');
  });

  it('is disabled in orthographic view, and says why', () => {
    const editor = fakeEditorView();
    const button = renderToolbar({ editor }) as HTMLButtonElement;

    act(() => editor.report({ isAvailable: false }));

    expect(button.disabled).toBe(true);
    expect(button.title).toContain('perspective view');
  });

  it('hides in 2D, where no canvas flies', () => {
    expect(renderToolbar({ mode: '2D' })).toBeNull();
  });

  it('hides until the view reports a 3D canvas’s freelook', () => {
    const editor = fakeEditorView();
    editor.heard.forget();

    expect(renderToolbar({ editor })).toBeNull();
  });
});
