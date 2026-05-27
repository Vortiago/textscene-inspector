/**
 * WI-UX-6 regression: when a previously-missing path is uploaded the
 * panel must keep the row visible with the `uploaded ✓` state (and a
 * Remove button), not silently delete it. Mirrors main's
 * `apps/textscene-web/src/main.ts:46-140` behaviour where uploaded
 * rows persisted with a green ✓ until the user explicitly clicked
 * Remove.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MissingResourcesProvider,
  useMissingResources,
} from '../../contexts/MissingResourcesContext';
import { MissingResourcesPanel } from './MissingResourcesPanel';

/**
 * Drives the panel via a single context action button so the test can
 * step from `missing` → `uploaded` without remounting the provider.
 */
function ReportThenMark({
  path,
}: {
  path: string;
}) {
  const { report, markUploaded } = useMissingResources();
  // Report missing on mount so the panel paints a missing row first.
  useEffect(() => {
    report(path);
  }, [report, path]);
  return (
    <>
      <button
        data-testid="trigger-upload"
        onClick={() => markUploaded(path)}
      >
        upload
      </button>
    </>
  );
}

describe('<MissingResourcesPanel> uploaded-state (WI-UX-6)', () => {
  it('keeps the path visible as an uploaded ✓ row after a missing → loaded transition', async () => {
    render(
      <MissingResourcesProvider>
        <ReportThenMark path="res://textures/shared.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    expect(panel.querySelectorAll('[data-state="missing"]')).toHaveLength(1);
    expect(panel.querySelectorAll('[data-state="uploaded"]')).toHaveLength(0);

    // Simulate the host providing the file — `markUploaded` is what
    // useResource calls when it transitions from `'missing'` to
    // `'loaded'` for a previously-reported-missing path.
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-upload'));
    });

    // The row is still visible — now with the uploaded state. This is
    // the load-bearing parity property: main never dropped uploaded
    // rows from the panel.
    expect(panel.querySelectorAll('[data-state="missing"]')).toHaveLength(0);
    const uploadedRow = panel.querySelector('[data-state="uploaded"]');
    expect(uploadedRow).toBeTruthy();
    expect(uploadedRow?.getAttribute('data-path')).toBe('res://textures/shared.png');
    expect(uploadedRow?.textContent).toMatch(/✓/);
  });

  it('uploaded row exposes a Remove button', async () => {
    render(
      <MissingResourcesProvider>
        <ReportThenMark path="res://textures/test_texture.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-upload'));
    });

    const removeBtn = screen
      .getByTestId('missing-resources-panel')
      .querySelector('[data-state="uploaded"] button');
    expect(removeBtn).toBeTruthy();
    expect(removeBtn?.textContent).toBe('Remove');
  });

  it('clicking Remove on an uploaded row clears the panel state and forwards (path) to the host', async () => {
    function MarkUploadedOnMount({ path }: { path: string }) {
      const { markUploaded } = useMissingResources();
      useEffect(() => {
        markUploaded(path);
      }, [markUploaded, path]);
      return null;
    }

    const onRemove = vi.fn();
    render(
      <MissingResourcesProvider>
        <MarkUploadedOnMount path="res://textures/shared.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={onRemove} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const removeBtn = panel.querySelector(
      '[data-state="uploaded"] button'
    ) as HTMLButtonElement;
    expect(removeBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(onRemove).toHaveBeenCalledWith('res://textures/shared.png');
    // Panel empties (both sets empty) → returns null.
    expect(screen.queryByTestId('missing-resources-panel')).toBeNull();
  });
});
