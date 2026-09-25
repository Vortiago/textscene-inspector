/**
 * The source pane's download button and paste-to-preview notice. The app fetches
 * `DEFAULT_FIXTURE` on mount, so the "nothing has rendered" state needs that fetch to fail
 * before the garbage is typed: otherwise hold-last-valid has a render to fall back on.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@textscene/core', async () => {
  const real = await vi.importActual<typeof import('@textscene/core')>('@textscene/core');
  return { ...real, TscnCanvas: () => null, TscnSceneContents: () => null };
});

import { R3FApp } from './r3f-main';

const STUB_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const VALID_PASTE_TSCN = `[gd_scene load_steps=1 format=3]

[node name="PastedRoot" type="Node3D"]
`;

const GARBAGE = 'not a scene at all }{ ]] [[';

function resetPersistence() {
  try {
    globalThis.localStorage.clear();
  } catch {
    // happy-dom can throw here, and clearing storage is optional.
  }
}

function mockFetchOk(text = STUB_TSCN) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(text),
  } as unknown as Response) as unknown as typeof fetch;
}

function mockFetchFail() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    statusText: 'Not Found',
  } as unknown as Response) as unknown as typeof fetch;
}

async function waitForScene(rootName = 'StubRoot') {
  await waitFor(() => {
    expect(screen.queryByText(rootName)).toBeTruthy();
  });
}

function paneTextarea() {
  return within(screen.getByTestId('source-pane')).getByRole('textbox') as HTMLTextAreaElement;
}

function typeBuffer(text: string) {
  fireEvent.change(paneTextarea(), { target: { value: text } });
}

beforeEach(() => {
  resetPersistence();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#203 empty-pane placeholder', () => {
  it('shows the "Paste or type your .tscn here…" placeholder when the buffer is empty', async () => {
    mockFetchFail();
    render(<R3FApp />);

    await waitFor(() => {
      expect(paneTextarea().placeholder).toBe('Paste or type your .tscn here…');
    });
  });
});

describe('#203 paste-to-preview into an empty pane', () => {
  it('renders the scene once valid content is pasted into an empty pane', async () => {
    mockFetchFail();
    render(<R3FApp />);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy());

    typeBuffer(VALID_PASTE_TSCN);
    await waitForScene('PastedRoot');
  });
});

describe('#203 empty/error state — fatally-broken paste with no prior valid render', () => {
  it('shows a clear notice (not a silent blank viewport) for from-scratch broken content', async () => {
    mockFetchFail();
    render(<R3FApp />);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy());

    expect(screen.queryByTestId('unrenderable-buffer-notice')).toBeNull();

    typeBuffer(GARBAGE);
    await waitFor(() => {
      expect(screen.queryByTestId('unrenderable-buffer-notice')).toBeTruthy();
    });
  });

  it('clears the notice once the buffer recovers to something renderable', async () => {
    mockFetchFail();
    render(<R3FApp />);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy());

    typeBuffer(GARBAGE);
    await waitFor(() => {
      expect(screen.queryByTestId('unrenderable-buffer-notice')).toBeTruthy();
    });

    typeBuffer(VALID_PASTE_TSCN);
    await waitFor(() => {
      expect(screen.queryByTestId('unrenderable-buffer-notice')).toBeNull();
    });
    await waitForScene('PastedRoot');
  });

  it('never shows the notice once a valid render has occurred, even if the buffer later breaks', async () => {
    mockFetchOk();
    render(<R3FApp />);
    await waitForScene();

    typeBuffer(GARBAGE);
    await waitFor(() => {
      // hold-last-valid keeps the old render, so the "nothing has rendered" notice stays away.
      expect(screen.queryByText('StubRoot')).toBeTruthy();
    });
    expect(screen.queryByTestId('unrenderable-buffer-notice')).toBeNull();
  });
});

describe('#203 Download .tscn', () => {
  function stubDownloadApis() {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    return { createObjectURL, revokeObjectURL, clickSpy };
  }

  it('is disabled when the buffer is empty', async () => {
    mockFetchFail();
    render(<R3FApp />);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy());

    const button = screen.getByTestId('download-tscn-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('exports the current buffer contents as a downloaded .tscn file', async () => {
    mockFetchOk();
    render(<R3FApp />);
    await waitForScene();

    const { createObjectURL, revokeObjectURL, clickSpy } = stubDownloadApis();

    const button = screen.getByTestId('download-tscn-button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    await expect(blob.text()).resolves.toBe(paneTextarea().value);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download.endsWith('.tscn')).toBe(true);

    // Not yet: `click()` only schedules the navigation, so the blob URL outlives this turn or
    // the browser can lose the race to fetch it.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });
});
