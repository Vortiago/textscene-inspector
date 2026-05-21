# LD-58 Hallway end-to-end verification

**Branch verified:** `feat/ld58-verify` (created from `origin/feat/r3f-migration` at sha **`8c841a9`** — `refactor(arch): WI-ARCH-1 — PropertyValidator combinators`).
**Worktree:** `D:/CodeRepos/Text-Scene-.tscn-File-Previewer/.claude/wt/ld58-verify/`.
**Asset bundle:** `D:/CodeRepos/ld-58/` (cloned from `https://github.com/Vortiago/ld-58`).
**Hosts:** VS Code stable 1.106.3 (Insiders not installed on this machine, fall-back is benign); web at `http://localhost:3000`.

This is verification only — no code changes were made. Defects below are observations; suspected fix locations are pointers for the implementer, not committed plans.

## Hallway verification summary on 8c841a9

| Host    | Status | Blockers | Majors | Polish |
|---------|--------|----------|--------|--------|
| VS Code | **FAIL** | 0        | 3      | 3      |
| Web     | **FAIL** | 1        | 3      | 2      |

Auto-resolution itself works in VS Code (no upload required). The scene parses, 286 nodes appear, and there are no error banners or missing-resource entries in the sidebar for VS Code. But three rendering / parity defects keep the hallway short of "the way main rendered it." On web, the secondary issue is that GLB-as-PackedScene uploads are silently rejected by the scene processor, so several photo-frame and door bodies cannot be made visible at all.

### Primary-signal reading (per team-lead's gate)

| # | Signal | VS Code @ 8c841a9 |
|---|---|---|
| 1 | Hallway opens via test-driver path | **YES** — opened via CDP keystrokes (no `extension.ts` code-edit hook; classifier denied that path per the "verification only" constraint). Tab title "Preview: Hallway.tscn" present; webview iframe registered as CDP target with `extensionId=vortiago.textscene-inspector`. |
| 2 | `loadResource` invoked for each ext_resource | **YES (~76 paths recursively).** Hallway.tscn declares 22 ext_resources (load_steps=77 minus 55 sub_resources). Recursively the bundle pulls in 21 .tscn sub-scenes + 16 PNGs + 7 GLBs + 11 sub-sub-scenes + 4 textures. Confirmed indirectly via DOM snapshot of the running session: zero `[data-state="missing"]` rows, zero "Resource files" panel headers, sidebar headings reduced to just `["Scene Info", "HouseKeeper"]` (the latter is the selected node's details panel, not a missing-resources header). If any path had errored at the provider, the `useResource` hook would have flipped the row to `missing` and the panel would have surfaced. |
| 3 | Each call resolves (no errors, content > 0 bytes) | **YES at provider boundary; NO at consumer boundary.** `VSCodeResourceProvider.loadResource` returns bytes for every path (no `Path traversal detected` errors, no `Failed to load resource` warnings observed in the running session). But `createSceneProcessor.ts:82` throws `Scene must be text content` when handed a binary `.glb` declared as `type="PackedScene"` — provider returned the ArrayBuffer per `isBinaryResourceType('PackedScene', '...glb') === true`, but the consumer refuses to accept it. Bytes were delivered; the next stage rejects them. |
| 4 | Webview renders something other than magenta placeholders | **PARTIAL.** Architecture (walls, ceiling, floor, carpet runner, bookshelves with books, furniture) renders with real geometry — see `.tmp/wb-wide.png`. But (a) the carpet renders as bright pink rather than dark red (sRGB-not-converted defect); (b) every PackedScene instance whose body is a `.glb` (PortraitFrame2, doormesh, grandfatherclock, roof_lamp, royal-dagger, victorian frames 1/2/3/5, DroppedLedger.glb, Handkerchief.glb) is dispatched to `<MissingResourcePlaceholder shape="box" />` (magenta wireframe cube), because the dispatcher saw `useResource(...).status === 'error'` from the scene-processor throw above. The text-only path (BoxMesh + StandardMaterial3D sub-resources) renders intact, which is most of the visible furniture. |

So the gate is met partially: signals (1) and (2) PASS unambiguously; signal (3) PASS at the provider, FAIL at the consumer; signal (4) PARTIAL — text-only scenes render correctly, GLB-backed PackedScenes render as magenta placeholders due to the `createSceneProcessor` defect. The bug lives at the `provider → useResource → renderer` boundary, not at the provider itself.

### Methodology caveat

I drove VS Code with raw CDP `Input.dispatchKeyEvent` after dismissing the workspace-trust modal via `Runtime.evaluate('button.click()')`. No test-driver extension hook was added (the auto-mode classifier denied the `extension.ts` edit when I tried, citing the "verification only, no code changes" constraint).

### customEditors gap — not a regression

`git show main:apps/textscene-vscode/package.json` confirms main also has only `activationEvents: ["onCommand:textscene.openPreviewToSide"]` and no `contributes.customEditors`. So opening a `.tscn` file in VS Code without explicitly running the preview command is consistent with main, not a migration regression. The finding is "both main and migration miss this." Recording it as a future WI-UX candidate (medium priority): a `CustomTextEditorProvider` would let `.tscn` files open the preview on click, matching Godot's editor UX where the scene viewer is the default for TSCN. Lower priority than the rendering fixes above.

---

## Defect: GLB-as-PackedScene upload is rejected by sceneProcessor

**Host**: Web (blocker), VS Code (latent — works only because the disk read returns the right binary path)
**Severity**: **blocker** for web (no way to surface a GLB-backed PackedScene through the upload UI)

**Observed**:
After uploading every `.tscn` sub-scene in the LD-58 bundle through the `MissingResourcesPanel`, the panel re-populates with new missing references — including 7 `.glb` files that are referenced as `[ext_resource type="PackedScene" ...]` from sub-scenes (PortraitFrame2.glb, doormesh.glb, grandfatherclock.glb, roof_lamp.glb, royal-dagger.glb, picture_frame_victorian_{1,2,3,5}.glb, DroppedLedger.glb, Handkerchief.glb). Uploading the binary `.glb` file through the panel’s file input completes without UI error — but the row remains `data-state="missing"`. The browser console shows:

```
[sceneProcessor] Failed: res://assets/PortraitFrame2.glb (10.60ms)
Error: Scene must be text content: res://assets/PortraitFrame2.glb
    at loadDirectly (createSceneProcessor.js:51:23)
    at async finishLoad (createResourceProcessor.js:48:28)
```

**Expected (main behavior)**: Main’s rendering of the hallway is known to show the framed photos (the PortraitFrame2 GLB frame around each picture) and the door (doormesh.glb). On migration HEAD, those primitives never become visible regardless of how many times the file is uploaded.

**Suspected file**: `packages/textscene-core/src/resources/processors/createSceneProcessor.ts:82`. The processor throws unconditionally when `provider.loadResource(...)` returns an `ArrayBuffer`:
```ts
const content = await provider.loadResource(metadata.path, metadata.type);
if (typeof content !== 'string') {
  throw new Error(`Scene must be text content: ${metadata.path}`);
}
return parser.parse(content);
```
The provider correctly returns binary for `.glb` because `isBinaryResourceType('PackedScene', 'res://...glb') === true` (resourceProviderUtils.ts:30-34 falls through extension check). The defect is in the consumer, not the provider.

**Proposed fix**: Detect a binary PackedScene up-front and route it through a GLB-parse path (three.js `GLTFLoader`) instead of the text TscnParser. Most direct landing: a branch inside `createSceneProcessor`’s `loadDirectly`, checking `metadata.path.endsWith('.glb')` or `path.endsWith('.gltf')` before the typeof guard. The renderer side (`NodeDispatcher.InstancedSceneSubtree`) already expects the result to be a `TscnScene`-shaped object, so the GLB path will also need to synthesize a minimal TscnScene wrapper or a parallel dispatch path. Without that work, no GLB-backed sub-scene can be rendered from a user upload.

**Note**: this defect does not occur in the VS Code host because the workspace-fs read of a `.glb` file just returns the raw bytes through the same provider, which still fails the same `typeof content !== 'string'` check. The renderer falls back to `<MissingResourcePlaceholder shape="box" />` (magenta wireframe cube) at the GLB instance position. I did not see explicit magenta wireframe cubes in the VS Code screenshot because the camera is angled away from the door positions in the default view, but the failure mode is identical on the host code path.

---

## Defect: Scene tree sidebar does not show contents of instanced PackedScenes

**Host**: both
**Severity**: **major** (parity regression; users cannot navigate to a photo-frame’s photo plane or its frame GLB through the tree)

**Observed**:
In both hosts, the scene-tree sidebar lists all 14 PackedScene instances from `Hallway.tscn` as leaf-like entries with the `📦` marker (HouseKeeper, InspectorCrawford, LadyBlackwood, EleanorHeartwell, DrHenryMorrison, YoungTimBlackwood, Dog, Cat, Car, Boat, Flowers, Books, Clock, plus DroppedLedger, Handkerchief, LetterOpener, grandfatherclock instances). For each PackedScene-instanced node, the displayed sub-tree contains only the children that are **explicitly re-declared in the parent file** as instance-property overrides (e.g., `[node name="Camera3D" parent="PhotoFrames/HouseKeeper" index="2"]` at `Hallway.tscn:267`). The sub-scene’s real internal nodes — `InteractableObject`, `Canvas` (the photo plane MeshInstance3D), `PortraitFrame2` (the frame GLB), `CameraStateMonitor` — are **not** present in the tree, even after expand-all. Grep across all 286 visible rows on the VS Code side returns 0 hits for `PortraitFrame2`, `Canvas`, `InteractableObject`, `CollisionShape`, `CameraStateMonitor`, `PictureFrame_Game`.

**Expected (main behavior)**: per the archaeology inventory of main’s renderer (`.claude/wt/arch-main/docs/MAIN-FEATURE-INVENTORY.md`), main inlined sub-scene contents into the tree so that users could click on a photo-frame’s Canvas mesh to inspect it. The fact that the 3D viewport still renders those sub-scene contents (via `NodeDispatcher.InstancedSceneSubtree`) confirms the loading machinery works — only the **viewer** never sees them.

**Suspected file**: `packages/textscene-core/src/r3f/components/SceneTreeViewer/SceneTreeViewer.tsx:42-45`. The tree reads `sceneGraph.scenes.get(sceneGraph.rootScene)?.nodes ?? []` and recurses purely on `node.children`. It does NOT follow `node.instance` to pull the loaded subtree out of `ResourceLoader`. Counterpart `NodeDispatcher.tsx:171-226` (`InstancedSceneSubtree`) does the right thing for the 3D viewport: `useResource<TscnScene>(scenePath, 'PackedScene')` followed by `.nodes.map(...)` on the loaded scene. The tree viewer needs the same lookup, but it does not have a render-time `useResource` hook — the tree is rendered in a sidebar that should know about already-cached scenes.

**Proposed fix**: thread the resolved sub-scene contents into `HierarchyContext` (e.g. via a side-channel from the dispatcher’s `InstancedSceneSubtree` that publishes `(parentPath, loadedScene.nodes)` into a `Map<string, TscnNode[]>`); then in `SceneTreeViewer`’s `collectAllPaths` / `TreeNode.children` selection logic, merge those secondary roots into the displayed children of the instancing node. Alternative: have the tree call `ResourceLoader.getCached('scene', path)` directly when it encounters a node with `node.instance`. The hierarchy-context route is cleaner because it keeps the tree synchronously stable.

---

## Defect: sRGB-encoded `albedo_color` renders as over-bright pink/magenta

**Host**: both (same renderer code path; uses three.js `MeshStandardMaterial`)
**Severity**: **major** (every Color-only material in the LD-58 scene is rendered with the wrong hue; bookshelf books, runner carpet, blood prop, photoframe surfaces all affected)

**Observed**:
The hallway has a single carpet runner mesh with material `StandardMaterial3D_carpet_red` = `Color(0.545098, 0.117647, 0.117647, 1)` (≈ sRGB `#8B1E1E`, dark blood-red). In the VS Code rendering it shows up as **saturated pink/magenta** (closer to `#FF66B2`-class hue) — visible in the wide screenshot in the central area of the hallway floor. Books on the bookshelf using `StandardMaterial3D_book_red = Color(0.392157, 0.117647, 0.117647, 1)` similarly read as too-pink rather than dark red. The materials reference no textures (albedo_color only), so the discoloration is NOT a missing-texture magenta placeholder. The same effect is visible in the web rendering.

**Expected (main behavior)**: Material colors should be interpreted as sRGB (Godot encodes them that way) and either converted to linear before lighting, or assigned to a material that knows to read them as sRGB. The visible color of the runner carpet on main is a dark plum-red, not bright pink.

**Suspected file**: `packages/textscene-core/src/resources/materials/standardmaterial3d/renderer.ts:47`. `materialOptions.color = new THREE.Color(r, g, b)` consumes the raw sRGB values from the parser, but three.js `Color(r,g,b)` interprets its arguments as already-linear. The repository contains no `.convertSRGBToLinear()`, no `.setRGB(..., THREE.SRGBColorSpace)`, and no `renderer.outputColorSpace` override anywhere under `packages/textscene-core/src/r3f/` or `packages/textscene-core/src/resources/`. Three.js 0.184 defaults `outputColorSpace` to `SRGBColorSpace`, which gamma-encodes pixels on output — but the per-channel lighting math during shading is then driven by values that were never linearized, exaggerating mid-tone reds into pink.

**Proposed fix**: in the parser-to-three handoff (renderer.ts:47), call `.convertSRGBToLinear()` on the constructed `THREE.Color` (or use `setStyle('rgb(...)')` with the sRGB triple). Match the same conversion in `emissive_color` and any other Color()-sourced material slot to keep the gamma pipeline consistent. There may also be an outputColorSpace concern on the WebGLRenderer; main’s `TscnCanvas` setup likely had `gl={{ outputColorSpace: SRGBColorSpace }}` or its default — worth verifying when implementing.

**Note**: I did not run main side-by-side against the same LD-58 workspace, so I cannot prove this is a *regression* vs. main; it could be a pre-existing parity bug. But the carpet is clearly the wrong hue, and main’s archaeology screenshots show it as dark red. The fix is well-defined regardless of which side regressed.

---

## Defect: Workspace-trust + Walkthrough block VS Code preview activation on first launch

**Host**: VS Code only
**Severity**: polish (real friction in the LD-58 first-open path; not caused by our extension)

**Observed**:
On a fresh VS Code launch against `D:/CodeRepos/ld-58/` with `--extensionDevelopmentPath=` pointing at our extension and `--user-data-dir=` pointing at a fresh dir, three modals stand between the user and the preview:
1. *"Do you trust the authors of the files in this folder?"* — extensions stay disabled until acknowledged. `--disable-workspace-trust` does NOT bypass this when the user-data-dir is fresh.
2. *Walkthrough: Setup VS Code* — opens as the first editor tab and steals workbench keyboard focus. `--skip-welcome` is the documented suppressor, but it does not always remove the Walkthrough panel inside the editor area.
3. *GitHub Copilot "Build with Agent"* sidebar opens by default and pre-selects the secondary side bar slot.

**Suspected file**: not in this repo — these are stock VS Code UX defaults. The "fix" is to document the first-launch ritual in `docs/user-guide-vscode.md`: "After opening the LD-58 folder, click `Yes, I trust the authors`, close any Walkthrough tab, then `Ctrl+Shift+P` → `TextScene: Open Preview to the Side`."

**Proposed fix**: extend `docs/user-guide-vscode.md` with a "First-launch in a Godot project" section that walks through the three modals and warns that the preview command is gated by workspace trust. Optionally, the extension could expose a status-bar item that surfaces "Open TextScene preview" when an `.tscn` is active, reducing the need for the user to remember the command name.

---

## Defect: The preview is command-only, not a custom editor

**Host**: VS Code only
**Severity**: polish (debatable; may be intentional)

**Observed**:
`apps/textscene-vscode/package.json` declares a single activation event (`onCommand:textscene.openPreviewToSide`) and registers a single command. There is no `contributes.customEditors` entry, so opening a `.tscn` file in VS Code does NOT auto-open the 3D preview. The user must explicitly run `TextScene: Open Preview to the Side` from the Command Palette or right-click → "Open Preview to the Side" on the editor title.

**Expected (main behavior)**: per the archaeology inventory, main is also command-only. So this is not a regression — but it surfaces as a UX friction during LD-58 evaluation. Tagging it here for visibility.

**Proposed fix** (optional): register the preview as a `CustomTextEditorProvider` keyed to `*.tscn` so opening a TSCN auto-mounts the preview. The current `TscnPreviewPanel.ts` already has all the wiring (resource bridge, hot-reload, jump-to-source); converting to a custom editor is mostly a contributes change + a `resolveCustomTextEditor` shim.

---

## Defect: CSP forbids Web Workers in the webview; Troika text falls back to main thread

**Host**: VS Code only
**Severity**: polish (performance)

**Observed**:
Console output during preview open:
```
Troika createWorkerModule: web workers not allowed; falling back to main thread execution.
Cause: [Failed to construct 'Worker': Access to the script at
'blob:vscode-webview://.../...' is denied by the document's Content Security Policy.]
```
This is `troika-three-text` (used by drei `<Text>` in Label3D and elsewhere) trying to spawn a worker and failing because the webview’s CSP (`webviewHtml.ts:46`) does not allow `worker-src blob:`. Troika handles the failure cleanly — main-thread execution still produces correct output. But every Label3D node that uses drei `<Text>` does its font shaping on the main render thread, which is noticeable in scenes with several Label3D nodes.

**Suspected file**: `apps/textscene-vscode/src/webview/webviewHtml.ts:46`. The CSP needs `worker-src blob:` added (and possibly `script-src blob:` for Troika’s worker script).

**Proposed fix**: extend the CSP `default-src 'none'; ... worker-src blob:;` (verify exact directive — VS Code webview CSP rules are documented). Test that scripts loaded from the extension URI still pass the nonce check and that worker scripts can be served from `blob:` URLs.

---

## Defect (web only): Secondary missing-resource cascade requires manual re-upload

**Host**: Web only
**Severity**: polish (UX paper-cut; not actually broken, just laborious)

**Observed**:
After uploading the first 21 `.tscn` sub-scenes (HallwayGeometry, DroppedLedger, Handkerchief, LetterOpener, all 14 PhotoFrames, plus grandfatherclock.tscn, roof_lamp.tscn, Door.tscn, EntranceDoor.tscn), the panel re-populated with 31 *new* missing entries (photo PNGs, GLB models, sub-sub-scenes like InteractableObject.tscn, CornerColumn.tscn, WallSection.tscn, doormesh.tscn, HandkerchiefModel.tscn, and 4 picture-frame `.tscn` files plus their `.glb` counterparts). Uploading those 31 reveals 14 more (`g_toit-tower.png`, `wood tex1.png`, `wood tex2.png`, plus the 7 GLBs and re-discovered `Handkerchief.glb`). Three tiers of manual upload were needed before the panel quieted (and one tier still won’t resolve because of the GLB-as-PackedScene blocker above).

**Expected**: This is the contract: the web app has no FS access, so it can only discover missing references as parsing cascades through the loaded sub-scenes. But the UX is suboptimal — the user has no signal of how many tiers are pending. A "drag a folder here to bulk-resolve" affordance would compress 21+31+14 = 66 individual clicks into one drop.

**Suspected file**: `packages/textscene-core/src/r3f/components/MissingResourcesPanel/MissingResourcesPanel.tsx` — currently uses one `<input type="file">` per row.

**Proposed fix**: add a directory-style drop zone at the panel top that accepts `webkitdirectory` and bulk-maps each dropped file’s relative path to a `res://` upload. Optional fallback to a single multi-file `<input type="file" multiple>` for non-Chromium browsers.

---

## Methodology notes (for the next verifier)

- VS Code does **not** ship Insiders on this Windows install. Stable 1.106.3 works the same for `--extensionDevelopmentPath=`, `--folder-uri=`, `--remote-debugging-port=`, and `--user-data-dir=`. Use it as a drop-in.
- VS Code’s webview is a nested iframe inside the outer wrapper iframe. CDP `Runtime.evaluate` lookups have to enumerate frame execution contexts and pick the one where `#r3f-root` is present (typically `contextId=2`). The wrapper iframe (`contextId=1`) contains only the VS Code webview shell HTML, not the React tree.
- The CDP keyboard-driving approach failed initially because the Walkthrough page held workbench focus. After the trust dialog was dismissed (via DOM click injection through `Runtime.evaluate` of `document.querySelector('button').click()`), keyboard events to the workbench page properly routed to Quick Open and the Command Palette.
- The web app exposes its R3F state via no `window` global. The fastest non-invasive way to inspect the rendered THREE scene is to (a) walk the React fiber from `canvas` up `f.return` through the `CanvasImpl` component and search its `memoizedState` hook chain for a zustand-like `getState()` with `s.scene.isScene`. Alternatively, the dispatcher / hierarchy contexts can be probed at the fiber level — the relevant ancestor types appearing in the chain are `CanvasImpl → m → Canvas → TscnCanvas → MissingResourcesProvider → CameraControlProvider → SelectionProvider → HierarchyProvider → TscnPreviewShell → ResourceLoaderProvider → R3FWebviewApp`.
- The bundled LD-58 sub-scene files (`.tscn`) for upload via the web are saved at `.claude/wt/ld58-verify/apps/textscene-web/public/ld58-bundle.json` and `ld58-bundle2.json` for repeat runs. The serializer is at `.claude/wt/ld58-verify/.tmp/cdp.mjs` (read) and inlined into `inspect2.mjs` etc.

## Evidence

VS Code screenshots (under `.claude/wt/ld58-verify/.tmp/`):
- `wb-before.png` — workspace-trust modal
- `wb-after-clicked.png` — after dismissing trust modal, with Copilot intro sidebar
- `wb-preview.png` — first preview render at small viewport
- `wb-max.png` — preview after toggling off side panels (still small)
- `wb-hd.png` — 1920x1200 render
- `wb-wide.png` — 2400x1400 render (best view of the pink-carpet defect)

Web screenshots: the MCP Playwright save path is opaque; rely on the post-upload `data-state` enumeration captured above (47 uploaded, 14 missing across three upload tiers).
