/**
 * The web previewer's toolbar, rendered through the shell's `toolbar` slot.
 *
 * Lives beside `r3f-main.tsx` rather than inside it: it is a self-contained
 * component over its props plus the shell's missing-resources context, and the
 * entry module is long enough without it.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useMissingResources, type ViewportSelectorOption } from '@textscene/core';
import { fixtures } from './fixturesAll';
import { FixtureTreeView } from './FixtureTree';
import { NO_FIXTURE } from './sceneSelection';
import styles from './r3f-main.module.css';

export interface ToolbarProps {
  options: readonly ViewportSelectorOption[];
  fixtureFile: string;
  uploadedTscnName: string | null;
  loadError: string | null;
  onFixtureChange: (value: string) => void;
  /**
   * One or more files picked via the file input — a scene plus, optionally,
   * its resources. The handler matches them against the shell-reported
   * missing-paths set.
   */
  onFilesSelected: (files: File[]) => void;
  paneVisible: boolean;
  onTogglePane: () => void;
  /** Compact problem-count text (e.g. "✖ 1 / ⚠ 2"), or `null` when the buffer is clean. */
  problemBadge: string | null;
}

/** Small scene/node glyph for the scene chip. */
function SceneGlyph() {
  return (
    <svg className={styles.sceneGlyph} viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M8 1.6 14 5v6L8 14.4 2 11V5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 5l6 3 6-3M8 8v6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Web toolbar: a compact "scene chip" in the shell top bar that opens a
 * command palette (click, or Ctrl/Cmd+K) for opening a `.tscn` and switching
 * scenes. The palette LEADS with "Open a .tscn from disk…" — the real-world
 * primary action — and lists the built-in fixtures below under a "dev only"
 * heading. Those fixtures are development scaffolding slated for removal; when
 * `options` is empty the palette degrades cleanly to just the open action +
 * the current-file chip.
 *
 * Note on missing files: a scene's missing `res://` dependencies are provided
 * separately and per-path in the shell's Resources tab — deliberately kept
 * distinct from "open a scene" so a picked file always maps to a known
 * target. A compact badge nudges the user toward that tab without
 * requiring it be open first.
 */
export function Toolbar({
  options,
  fixtureFile,
  uploadedTscnName,
  loadError,
  onFixtureChange,
  onFilesSelected,
  paneVisible,
  onTogglePane,
  problemBadge,
}: ToolbarProps) {
  // Reset Camera lives in the shared <ViewportToolbar>, floated over the viewport.
  const tscnInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // `<Toolbar>` is rendered THROUGH the shell's `toolbar` slot, i.e. as
  // a descendant of the shell's own `<MissingResourcesProvider>` — so this
  // reads the SAME live missing-paths set the shell's own
  // `<MissingResourcesPanel>` (in the Resources tab) aggregates, without any
  // new plumbing. Surfacing it here means a missing texture/scene is visible
  // without opening that tab first.
  const { missingPaths } = useMissingResources();

  // Built-in dev fixtures to switch between (drop the uploaded-placeholder
  // option, whose value is the empty sentinel).
  const scenes = useMemo(() => options.filter((o) => o.value !== NO_FIXTURE), [options]);

  const currentLabel =
    uploadedTscnName ?? scenes.find((o) => o.value === fixtureFile)?.label ?? 'No scene';

  // Ctrl/Cmd+K toggles the palette; Escape closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset + focus search each time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function selectScene(value: string) {
    onFixtureChange(value);
    setOpen(false);
  }

  function handleTscnFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onFilesSelected(Array.from(files));
    // Reset so the same filename(s) can be re-opened.
    if (tscnInputRef.current) tscnInputRef.current.value = '';
    setOpen(false);
  }

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.openButton}
        data-testid="source-pane-toggle"
        onClick={onTogglePane}
        aria-expanded={paneVisible}
        title="Toggle the source pane"
      >
        {paneVisible ? 'Hide' : 'Show'} Source
        {problemBadge && (
          <span className={styles.problemBadge} data-testid="problem-badge">
            {problemBadge}
          </span>
        )}
      </button>
      {/* Primary action — open your own .tscn from disk. Triggers the same
          hidden input the ⌘K palette uses; kept visible because the built-in
          fixtures are dev-only scaffolding, so this is the real entry point. */}
      <button
        type="button"
        className={styles.openButton}
        onClick={() => tscnInputRef.current?.click()}
        title="Open a .tscn file from disk"
      >
        <span className={styles.openIcon} aria-hidden>
          ⤓
        </span>
        Open <code className={styles.openExt}>.tscn</code>
      </button>
      <button
        type="button"
        className={styles.sceneChip}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Current scene — click to switch (Ctrl+K)"
      >
        <SceneGlyph />
        {uploadedTscnName ? (
          <span
            className={styles.sceneName}
            data-testid="uploaded-tscn-label"
            title={uploadedTscnName}
          >
            {uploadedTscnName}
          </span>
        ) : (
          <span className={styles.sceneName}>{currentLabel}</span>
        )}
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>

      {/* Opens the staged Godot-vs-ours comparison gallery (public/parity/,
          served at /parity/ in dev and on the deployed site). */}
      <a
        className={styles.openButton}
        href="parity/index.html"
        target="_blank"
        rel="noopener"
        title="Open the Godot ⇄ ours render-comparison gallery"
      >
        <span className={styles.openIcon} aria-hidden>
          ⇄
        </span>
        Parity
      </a>

      {missingPaths.size > 0 && (
        <span
          className={styles.missingResourcesBadge}
          data-testid="missing-resources-badge"
          title="Resources referenced by this scene are missing — see the Resources tab"
        >
          ⚠ {missingPaths.size} missing
        </span>
      )}

      {loadError && (
        <span role="alert" className={styles.errorMessage}>
          {loadError}
        </span>
      )}

      {/* Always rendered (visually hidden) so the open-file action — and the
          upload tests — can reach it whether or not the palette is open. */}
      <input
        ref={tscnInputRef}
        type="file"
        // Multi-select — a .tscn plus its resource files can be picked
        // in one gesture. `accept` covers the file kinds handleFilesUpload's
        // basename-matching can actually resolve: the binary resource
        // extensions (resourceProviderUtils.isBinaryResourceType) plus the
        // text resources the pipeline routes (.tres materials/tilesets) —
        // missing rows are routinely .tres, and drag-and-drop already
        // accepts them, so the picker must too.
        accept=".tscn,.tres,.glb,.gltf,.png,.jpg,.jpeg,.webp,.svg,.wav,.ogg,.mp3"
        multiple
        onChange={handleTscnFileChange}
        className={styles.srOnly}
        data-testid="upload-tscn-input"
        tabIndex={-1}
        aria-hidden
      />

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden />
          <div className={styles.palette} role="dialog" aria-label="Open or switch scene">
            {/* Primary action — open the user's own .tscn. */}
            <button
              type="button"
              className={styles.openDisk}
              onClick={() => tscnInputRef.current?.click()}
            >
              <span className={styles.openDiskIcon} aria-hidden>
                ⤓
              </span>
              Open a <code>.tscn</code> from disk…
            </button>

            {scenes.length > 0 && (
              <>
                <input
                  ref={searchRef}
                  className={styles.search}
                  placeholder="Search built-in scenes…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Filter built-in scenes"
                />
                <div className={styles.list}>
                  <FixtureTreeView
                    fixtures={fixtures}
                    query={query}
                    selectedFile={uploadedTscnName ? '' : fixtureFile}
                    onSelect={selectScene}
                  />
                </div>
                <div className={styles.devNote}>Built-in scenes are a development aid.</div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
