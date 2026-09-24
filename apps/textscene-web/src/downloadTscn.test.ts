/**
 * The Blob and anchor export. The anchor is in the document when it is clicked, and the
 * blob URL outlives the click's task, so every engine starts the download before the URL
 * is revoked. Fake timers pin that order, since happy-dom performs no download.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { downloadFilename, downloadTscn } from './downloadTscn';

const BLOB_URL = 'blob:mock-url';

/** What the anchor looked like at the moment it was clicked. */
interface ClickRecord {
  anchor: HTMLAnchorElement;
  wasInDocument: boolean;
  revokedBeforeClick: boolean;
}

let createObjectURL: MockInstance<typeof URL.createObjectURL>;
let revokeObjectURL: MockInstance<typeof URL.revokeObjectURL>;

/** Records each click, and throws from it when `refuse` is set. */
function spyOnClick(refuse = false): ClickRecord[] {
  const clicks: ClickRecord[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clicks.push({
      anchor: this,
      wasInDocument: this.isConnected,
      revokedBeforeClick: revokeObjectURL.mock.calls.length > 0,
    });
    if (refuse) throw new Error('synthetic click refused');
  });
  return clicks;
}

beforeEach(() => {
  vi.useFakeTimers();
  createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(BLOB_URL);
  revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('downloadTscn', () => {
  it('clicks an anchor in the document that names the blob and the file', async () => {
    const clicks = spyOnClick();

    downloadTscn('[gd_scene format=3]\n', 'level.tscn');

    expect(clicks).toHaveLength(1);
    const [click] = clicks;
    expect(click!.wasInDocument).toBe(true);
    expect(click!.anchor.href).toBe(BLOB_URL);
    expect(click!.anchor.download).toBe('level.tscn');
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    await expect(blob.text()).resolves.toBe('[gd_scene format=3]\n');
  });

  it('removes the anchor again once it has been clicked', () => {
    const clicks = spyOnClick();

    downloadTscn('text', 'level.tscn');

    expect(clicks[0]!.anchor.isConnected).toBe(false);
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('revokes the blob URL on a later task, never in the click task', () => {
    const clicks = spyOnClick();

    downloadTscn('text', 'level.tscn');

    expect(clicks[0]!.revokedBeforeClick).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(BLOB_URL);
  });

  it('still removes the anchor and revokes the URL when the click is refused', () => {
    const clicks = spyOnClick(true);

    expect(() => downloadTscn('text', 'level.tscn')).toThrow('synthetic click refused');

    expect(clicks[0]!.anchor.isConnected).toBe(false);
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(BLOB_URL);
  });

  it('exports an empty buffer as an empty file', async () => {
    spyOnClick();

    downloadTscn('', 'empty.tscn');

    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    await expect(blob.text()).resolves.toBe('');
  });
});

describe('downloadFilename', () => {
  it('names the download after the uploaded scene', () => {
    expect(downloadFilename('uploaded.tscn', 'demos/level.tscn')).toBe('uploaded.tscn');
  });

  it('names the download after the fixture file when nothing is uploaded', () => {
    expect(downloadFilename(null, 'demos/platformer/level.tscn')).toBe('level.tscn');
  });

  it('adds the .tscn extension to a name without one', () => {
    expect(downloadFilename('notes', '')).toBe('notes.tscn');
  });

  it('falls back to scene.tscn when there is neither an upload nor a fixture', () => {
    expect(downloadFilename(null, '')).toBe('scene.tscn');
  });
});
