/**
 * An uploaded path keeps its row, in the `uploaded ✓` state with a Remove
 * button, until the user clicks Remove.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MissingResourcesProvider,
  useMissingResources,
} from '../../contexts/MissingResourcesContext';
import { MissingResourcesPanel } from './MissingResourcesPanel';

/** One button steps from `missing` to `uploaded` without a remount of the provider. */
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

    // `useResource` calls `markUploaded` when a reported-missing path loads.
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-upload'));
    });

    // The row stays, now in the uploaded state.
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
    // Both sets are empty, so the panel renders nothing.
    expect(screen.queryByTestId('missing-resources-panel')).toBeNull();
  });
});
