/**
 * Regression: aggregated missing-files panel.
 *
 * Verifies the DOM-side panel mirrors `main:apps/textscene-web/src/main.ts`
 * `updateResourceFilesList`:
 *   - hidden when no missing + no uploaded paths,
 *   - one row per missing path (with per-row file input),
 *   - uploading flips a missing row to uploaded (with Remove button).
 */
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MissingResourcesProvider,
  useMissingResources,
} from '../../contexts/MissingResourcesContext';
import { MissingResourcesPanel } from './MissingResourcesPanel';

function ReportMissingOnMount({ path }: { path: string }) {
  const { report } = useMissingResources();
  useEffect(() => {
    report(path);
  }, [report, path]);
  return null;
}

function MarkUploadedOnMount({ path }: { path: string }) {
  const { markUploaded } = useMissingResources();
  useEffect(() => {
    markUploaded(path);
  }, [markUploaded, path]);
  return null;
}

describe('<MissingResourcesPanel>', () => {
  it('renders nothing when no paths are missing and none uploaded', () => {
    const { container } = render(
      <MissingResourcesProvider>
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );
    expect(container.querySelector('[data-testid="missing-resources-panel"]')).toBeNull();
  });

  it('shows one row per missing path reported via context', async () => {
    render(
      <MissingResourcesProvider>
        <ReportMissingOnMount path="res://textures/foo.png" />
        <ReportMissingOnMount path="res://textures/bar.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    expect(panel).toBeTruthy();

    const missingRows = panel.querySelectorAll('[data-state="missing"]');
    expect(missingRows).toHaveLength(2);

    const paths = Array.from(missingRows).map((r) => r.getAttribute('data-path'));
    expect(paths).toEqual(
      expect.arrayContaining(['res://textures/foo.png', 'res://textures/bar.png'])
    );
  });

  it('upload row file-input change fires onUpload with (path, file)', async () => {
    const onUpload = vi.fn();
    render(
      <MissingResourcesProvider>
        <ReportMissingOnMount path="res://textures/foo.png" />
        <MissingResourcesPanel onUpload={onUpload} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const input = panel.querySelector(
      '[data-state="missing"] input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(['stub bytes'], 'foo.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith('res://textures/foo.png', file);
  });

  it('renders uploaded rows with Remove button, fires onRemove(path)', async () => {
    const onRemove = vi.fn();
    render(
      <MissingResourcesProvider>
        <MarkUploadedOnMount path="res://textures/shared.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={onRemove} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const uploadedRow = panel.querySelector('[data-state="uploaded"]');
    expect(uploadedRow).toBeTruthy();
    expect(uploadedRow?.getAttribute('data-path')).toBe('res://textures/shared.png');

    const removeBtn = uploadedRow!.querySelector('button') as HTMLButtonElement;
    expect(removeBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(removeBtn);
    });
    expect(onRemove).toHaveBeenCalledWith('res://textures/shared.png');
  });

  it('hands the host the OWNING FILE when a row names a resource inside a .tres', async () => {
    // A failed load is reported under its whole **Sub-resource path**, so a row
    // can carry `file::id` — but a host keys its provider by file, and what the
    // user picked IS the file. Passing the address through would store the bytes
    // under a key nothing ever asks for.
    const onUpload = vi.fn();
    render(
      <MissingResourcesProvider>
        <ReportMissingOnMount path="res://meshes/wheel.tres::ORMMaterial3D_x" />
        <MissingResourcesPanel onUpload={onUpload} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const input = panel.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bytes'], 'wheel.tres', { type: 'text/plain' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(onUpload).toHaveBeenCalledWith('res://meshes/wheel.tres', file);
  });

  it('shows one uploaded row per FILE and removes under that same key', async () => {
    // An upload against an address row is recorded against the owning file, so
    // the row the user sees — and removes — is the file. The pair has to agree on
    // that key or the removal misses the bytes the upload stored, silently
    // leaving it in place and breaking the "Remove → row reappears" round-trip.
    const onRemove = vi.fn();
    render(
      <MissingResourcesProvider>
        <MarkUploadedOnMount path="res://meshes/wheel.tres::ORMMaterial3D_x" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={onRemove} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const uploadedRows = panel.querySelectorAll('[data-state="uploaded"]');
    expect(uploadedRows).toHaveLength(1);
    expect(uploadedRows[0]!.getAttribute('data-path')).toBe('res://meshes/wheel.tres');

    await act(async () => {
      fireEvent.click(uploadedRows[0]!.querySelector('button') as HTMLButtonElement);
    });

    expect(onRemove).toHaveBeenCalledWith('res://meshes/wheel.tres');
    expect(screen.queryByTestId('missing-resources-panel')).toBeNull();
  });

  it('uploading a missing path moves it from missing to uploaded set', async () => {
    function MissingThenUpload({ path }: { path: string }) {
      const { report, markUploaded } = useMissingResources();
      useEffect(() => {
        report(path);
      }, [report, path]);
      return (
        <button data-testid="trigger-upload" onClick={() => markUploaded(path)}>
          upload
        </button>
      );
    }

    render(
      <MissingResourcesProvider>
        <MissingThenUpload path="res://textures/a.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    expect(panel.querySelectorAll('[data-state="missing"]')).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-upload'));
    });

    expect(panel.querySelectorAll('[data-state="missing"]')).toHaveLength(0);
    expect(panel.querySelectorAll('[data-state="uploaded"]')).toHaveLength(1);
  });

  it('renders both uploaded and missing rows simultaneously, uploaded first', async () => {
    // One path uploaded while another is still missing: both rows show.
    render(
      <MissingResourcesProvider>
        <ReportMissingOnMount path="res://textures/different.png" />
        <MarkUploadedOnMount path="res://textures/shared.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const rows = Array.from(panel.querySelectorAll('[data-state]')) as HTMLElement[];
    expect(rows).toHaveLength(2);

    // Uploaded row first, then missing row — matches main's ordering.
    expect(rows[0]?.getAttribute('data-state')).toBe('uploaded');
    expect(rows[0]?.getAttribute('data-path')).toBe('res://textures/shared.png');
    expect(rows[1]?.getAttribute('data-state')).toBe('missing');
    expect(rows[1]?.getAttribute('data-path')).toBe('res://textures/different.png');
  });

  it('Remove on an uploaded row clears it from the panel even when the host onRemove is a no-op', async () => {
    // The panel must drop the uploaded entry from its own state so the
    // row vanishes immediately. Hosts that delete the file from their
    // provider afterwards may take longer to fire the re-resolve event,
    // but the row should not stay frozen in the meantime.
    const onRemove = vi.fn();
    render(
      <MissingResourcesProvider>
        <MarkUploadedOnMount path="res://textures/shared.png" />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={onRemove} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    expect(panel.querySelectorAll('[data-state="uploaded"]')).toHaveLength(1);

    const removeBtn = panel.querySelector(
      '[data-state="uploaded"] button'
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(onRemove).toHaveBeenCalledWith('res://textures/shared.png');
    // The uploaded entry is gone from context state; panel is empty so
    // it returns null. With no rows the panel root unmounts.
    expect(screen.queryByTestId('missing-resources-panel')).toBeNull();
  });

  it('uploaded row exposes the full path via `title` for hover discoverability', async () => {
    const longPath = 'res://textures/deeply/nested/subfolder/test_texture.png';
    render(
      <MissingResourcesProvider>
        <MarkUploadedOnMount path={longPath} />
        <MissingResourcesPanel onUpload={vi.fn()} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    );

    const panel = await screen.findByTestId('missing-resources-panel');
    const pathEl = panel.querySelector(
      '[data-state="uploaded"] [title]'
    ) as HTMLElement;
    expect(pathEl).toBeTruthy();
    expect(pathEl.getAttribute('title')).toBe(longPath);
    // Text content is the full path; CSS ellipsis happens at render time
    // and is not observable through happy-dom's measured layout.
    expect(pathEl.textContent).toBe(longPath);
  });
});
