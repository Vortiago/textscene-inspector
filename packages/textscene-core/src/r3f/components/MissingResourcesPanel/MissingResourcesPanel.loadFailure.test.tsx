import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MissingResourcesProvider, useMissingResources } from '../../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { MissingResourcesPanel } from './MissingResourcesPanel';

const ATLAS = 'res://atlas.tres';

function ReportMissingOnMount({ path }: { path: string }) {
  const { report } = useMissingResources();
  useEffect(() => report(path), [report, path]);
  return null;
}

async function mountFailedRow(onUpload = vi.fn()) {
  const fake = createFakeResourceLoader();
  render(
    <ResourceLoaderProvider loader={fake.loader}>
      <MissingResourcesProvider>
        <ReportMissingOnMount path={ATLAS} />
        <MissingResourcesPanel onUpload={onUpload} onRemove={vi.fn()} />
      </MissingResourcesProvider>
    </ResourceLoaderProvider>
  );
  await screen.findByTestId('missing-resources-panel');
  act(() =>
    fake.loadOutcomes._resolve(ATLAS, { isFailed: true, chain: [ATLAS, 'res://gone.png'], cause: 'missing' })
  );
  return screen.getByTestId('missing-resources-panel').querySelector('[data-state="missing"]')!;
}

describe('a missing row for a file Godot fails to load', () => {
  it('names the chain to the file that failed first', async () => {
    const row = await mountFailedRow();

    expect(row.querySelector('[data-testid="load-failure-chain"]')?.textContent).toBe(
      'Fails to load: res://atlas.tres → res://gone.png (missing)'
    );
  });

  it('hands the host the file that failed first', async () => {
    const onUpload = vi.fn();
    const row = await mountFailedRow(onUpload);
    const file = new File(['bytes'], 'gone.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(row.querySelector('input[type="file"]')!, { target: { files: [file] } });
    });

    expect(onUpload).toHaveBeenCalledWith('res://gone.png', file);
  });
});
