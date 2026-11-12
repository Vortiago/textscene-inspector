/** The browser ResourceProvider: uploaded files in memory, then the fixtures mirror. */

import { isBinaryResourceType, info } from '@textscene/core';
import type { ResourceProvider } from '@textscene/core';
import type { DirectoryEntry } from '@textscene/core/resources/projectListing';
import { fixtureUrlForRes } from '../corpusRoot';
import { FIXTURE_LISTING_URL, mirrorEntries, mirrorFolderOf, type FixtureListing } from '../fixtureListing';

export interface WebResourceProviderOptions {
  /**
   * Whether the site serves the `/fixtures/` mirror. Without it, a missing res:// path goes
   * to the upload prompt with no request, which could only 404.
   */
  hasFixturesMirror?: boolean;
}

export class WebResourceProvider implements ResourceProvider {
  private readonly hasFixturesMirror: boolean;

  constructor({ hasFixturesMirror = true }: WebResourceProviderOptions = {}) {
    this.hasFixturesMirror = hasFixturesMirror;
  }

  /**
   * Uploaded files, keyed per corpus root by {@link uploadKey}, each with its upload's serial
   * from `uploadCount`. A serial, not the file's `lastModified` and `size`: two different files
   * can share both.
   */
  private uploadedFiles: Map<string, { file: File; serial: number }> = new Map();
  private uploadCount = 0;
  /**
   * Public-fixtures subtree the active scene's res:// namespace maps onto: '' for
   * the fixtures root (unit fixtures, examples, the flattened isometric corpus),
   * or a demo project's own root, such as 'demos/2d/platformer', so paths never collide.
   */
  private resourceRoot = '';
  /**
   * The mirror files a fetch has delivered, keyed by {@link uploadKey}. Written by `loadResource` after each
   * successful fetch and never cleared, since the mirror is the static site and never changes under a running page.
   */
  private readonly deliveredMirrorFiles = new Set<string>();

  /**
   * The mirror's folders, fetched on the first listing. Written only by `fixtureListing`. A null answer is kept: the site
   * never gains a mirror under a running page.
   */
  private listingLookup: Promise<FixtureListing | null> | null = null;

  setResourceRoot(root: string): void {
    this.resourceRoot = root;
  }

  /**
   * Compound storage key: active corpus root + NUL separator + res:// path.
   * Scopes every upload to the corpus root active when it was added, so a
   * file uploaded in corpus A is never served under a different corpus root.
   */
  private uploadKey(path: string): string {
    return `${this.resourceRoot}\0${path}`;
  }

  /**
   * Adds an uploaded file, scoped to the active corpus root, so another root does
   * not see it.
   * @param path - Godot resource path, such as 'res://scenes/Door.tscn'
   * @param file - The uploaded File object
   */
  addUploadedFile(path: string, file: File): void {
    this.uploadedFiles.set(this.uploadKey(path), { file, serial: ++this.uploadCount });
  }

  /**
   * Removes an uploaded file under every corpus root. The uploaded-rows UI keys on
   * the bare res:// path across corpus switches, so a root-scoped delete no-ops
   * after a switch while the row vanishes. A later request falls through to the
   * fixtures fetch.
   */
  removeUploadedFile(path: string): boolean {
    const suffix = `\0${path}`;
    let removed = false;
    for (const key of this.uploadedFiles.keys()) {
      if (key.endsWith(suffix)) {
        this.uploadedFiles.delete(key);
        removed = true;
      }
    }
    return removed;
  }

  /**
   * Which file `loadResource` would read, with no read: an upload by its serial, else the
   * mirror's file under the active corpus root. Null for a mirror file no fetch has delivered
   * yet, so the linter keeps nothing a failed fetch answered and reads the file again.
   */
  async stamp(path: string): Promise<string | null> {
    const key = this.uploadKey(path);
    const upload = this.uploadedFiles.get(key);
    if (upload !== undefined) return `upload:${upload.serial}`;
    return this.deliveredMirrorFiles.has(key) ? `mirror:${this.resourceRoot}` : null;
  }

  /**
   * The entries of the `res://` folder `folder`: the mirror's folder under the active corpus root, with the files uploaded to
   * it. Null when neither holds the folder.
   */
  async listDirectory(folder: string): Promise<DirectoryEntry[] | null> {
    const listing = this.hasFixturesMirror ? await this.fixtureListing() : null;
    const mirrored = listing && mirrorEntries(listing, mirrorFolderOf(folder, this.resourceRoot));
    const uploaded = this.uploadedEntries(folder);
    if (!mirrored && uploaded.size === 0) return null;
    const entries = new Map((mirrored ?? []).map((entry) => [entry.name, entry]));
    for (const [name, entry] of uploaded) entries.set(name, entries.get(name) ?? entry);
    return [...entries.values()];
  }

  private fixtureListing(): Promise<FixtureListing | null> {
    this.listingLookup ??= fetchFixtureListing();
    return this.listingLookup;
  }

  /** What the uploads of the active corpus root put in `folder`: a file directly in it, a folder for one deeper. */
  private uploadedEntries(folder: string): Map<string, DirectoryEntry> {
    const prefix = folder === 'res://' ? folder : `${folder}/`;
    const entries = new Map<string, DirectoryEntry>();
    for (const key of this.uploadedFiles.keys()) {
      const [root, path] = key.split('\0') as [string, string];
      if (root !== this.resourceRoot || !path.startsWith(prefix)) continue;
      const [name, ...deeper] = path.slice(prefix.length).split('/') as [string, ...string[]];
      entries.set(name, { name, isDirectory: deeper.length > 0 });
    }
    return entries;
  }

  async loadResource(path: string, type?: string, maxBytes?: number): Promise<string | ArrayBuffer | null> {
    // Uploaded files of the active corpus root first.
    const upload = this.uploadedFiles.get(this.uploadKey(path));
    if (upload) {
      if (!isBinaryResourceType(type, path)) return upload.file.text();
      return (maxBytes === undefined ? upload.file : upload.file.slice(0, maxBytes)).arrayBuffer();
    }

    // A path the mirror cannot hold, or a host without the mirror, holds no file.
    if (!this.hasFixturesMirror || !path.startsWith('res://')) return null;

    // Convert Godot path to fixture path under the active corpus root. Both are taken before the
    // fetch, since a corpus switch while it runs changes the root.
    const fixtureUrl = fixtureUrlForRes(path, this.resourceRoot);
    const mirrorKey = this.uploadKey(path);

    info(`[WebResourceProvider] Attempting to fetch ${type}: ${fixtureUrl}`);
    const response = await fetch(fixtureUrl);

    // Null, per the provider contract: a refusal carries no file, and the static host answers an
    // unknown path with the SPA's HTML fallback. Each caller answers for itself: a scene load
    // fails as `Resource not found`, `request` marks a failed event, and `tryLoad` says nothing.
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return null;

    const content = isBinaryResourceType(type, path)
      ? await readBytes(response, maxBytes)
      : await response.text();
    this.deliveredMirrorFiles.add(mirrorKey);
    info(`[WebResourceProvider] Successfully loaded ${type}: ${path}`);
    return content;
  }
}

/** The mirror's listing, or null where the site serves none, as the public edition does not, or the fetch fails. */
async function fetchFixtureListing(): Promise<FixtureListing | null> {
  try {
    const response = await fetch(FIXTURE_LISTING_URL);
    // The static host answers an unknown path with the SPA's HTML fallback.
    if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) return null;
    return (await response.json()) as FixtureListing;
  } catch {
    // An offline or refusing host has no listing, which a FileDialog draws as an empty list.
    return null;
  }
}

/**
 * The response body, or its first `maxBytes` bytes. A static host may ignore a `Range` header, so the
 * stream is read to the cap and cancelled, which stops the transfer either way.
 */
async function readBytes(response: Response, maxBytes: number | undefined): Promise<ArrayBuffer> {
  if (maxBytes === undefined || !response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
  } finally {
    await reader.cancel();
  }
  return new Blob(chunks).slice(0, maxBytes).arrayBuffer();
}
