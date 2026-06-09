export const meta = {
  name: 'build-control-slices',
  description: 'Fan out the remaining 11 ld-58 Control (2D-UI) node-type slices',
  phases: [{ title: 'Build Control slices', detail: 'one agent per Control type' }],
};

// Absolute repo root — agents must write only inside this tree. Workflow
// scripts have no filesystem/process access, so the root can't be auto-derived;
// pass it at invocation:
//   Workflow({ name: 'build-control-slices', args: '/abs/path/to/repo' })
const ROOT = typeof args === 'string' ? args : args?.root;
if (!ROOT) {
  throw new Error(
    "build-control-slices: pass the repo root via args, e.g. Workflow({ name: 'build-control-slices', args: '/abs/path/to/repo' })"
  );
}
const UI = `${ROOT}/packages/textscene-core/src/nodes/2d/ui`;
const FIX = `${ROOT}/scenes/fixtures`;

// ---- Shared reference: the established slice pattern (replicate EXACTLY) ----
const SHARED = `
You are adding ONE Godot Control (2D-UI) node-type "vertical slice" to the
TextScene Inspector monorepo, in an EXISTING, well-established pattern. Match
the surrounding code's style, comment density, and idioms exactly.

ABSOLUTE RULES (violating these breaks the build for everyone):
- Write files ONLY inside this slice's own folder:
    ${UI}/<folder>/...
  and optionally ONE fixture at ${FIX}/unit-<kebab>.tscn
- DO NOT edit, create, or touch ANY shared/barrel file. Specifically NEVER touch:
    packages/textscene-core/src/parser/TscnParser.ts
    packages/textscene-core/src/r3f/controls/index.ts
    packages/textscene-core/src/nodes/2d/ui/uiParsers.test.ts
    apps/textscene-web/src/fixtures.ts
  The orchestrator wires those in afterward. If you edit them, parallel agents
  collide. Just create your own slice files.
- DO NOT run builds, type-check, lint, tests, or git. No bash mutations. Just
  write correct files per the template, then return your manifest. (You MAY
  read existing files to double-check the pattern.)
- Use the Write tool with ABSOLUTE paths.

THE SLICE SHAPE (each Control type = a folder with these files):
  types.ts        (OPTIONAL — only if the type adds fields beyond Control)
  parser.ts       parse<Type>(heading, properties) + is<Type>(heading) guard
  parser.test.ts  >= 3 vitest cases (happy / edge / type-guard)
  Component.tsx   the DOM component (React, NOT three/R3F unless told)
  index.ts        registers the PARSER into nodeRegistry
  index.r3f.ts    registers the COMPONENT into controlComponentRegistry

IMPORT DEPTH from ${UI}/<folder>/<file> is ALWAYS ../../../../ to reach
packages/textscene-core/src/<dir>. Reach sibling Control infra via ../control/...

============================ REFERENCE: types ============================
// nodes/2d/ui/control/types.ts (the BASE — every Control extends ControlProperties)
export interface ControlColor { r: number; g: number; b: number; a: number; }
export interface ControlProperties {
  name: string; parent?: string; instance?: string; index?: number; visible?: boolean;
  layoutMode?: number; anchorsPreset?: number;
  anchorLeft?: number; anchorTop?: number; anchorRight?: number; anchorBottom?: number;
  offsetLeft?: number; offsetTop?: number; offsetRight?: number; offsetBottom?: number;
  growHorizontal?: number; growVertical?: number;
  sizeFlagsHorizontal?: number; sizeFlagsVertical?: number;
  customMinimumSize?: { x: number; y: number };
  themeOverrideConstants?: Record<string, number>;   // theme_override_constants/<name> -> number
  themeOverrideColors?: Record<string, ControlColor>; // theme_override_colors/<name>  -> color
  themeOverrideFontSizes?: Record<string, number>;    // theme_override_font_sizes/<name> -> number
  themeOverrideStyles?: Record<string, string>;       // theme_override_styles/<name> -> resource ref string
}

// EXAMPLE type-extension (label/types.ts):
import type { ControlProperties } from '../control/types';
export interface LabelProperties extends ControlProperties {
  text?: string; horizontalAlignment?: number; verticalAlignment?: number; autowrapMode?: number;
}

========================== REFERENCE: parser ==========================
// The base parseControl(heading, properties) already fills EVERY ControlProperties
// field (anchors, offsets, size_flags, customMinimumSize, and ALL FOUR
// theme_override_* maps). Your parser DELEGATES to it, then adds type-specific
// fields. EXAMPLE (label/parser.ts):
import type { ParsedHeading } from '../../../../parser/utils';
import type { LabelProperties } from './types';
import { parseControl } from '../control/parser';
function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
function intOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}
export function parseLabel(heading: ParsedHeading, properties: Record<string, string>): LabelProperties {
  const result: LabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquote(properties.text);
  result.horizontalAlignment = intOr(properties.horizontal_alignment);
  result.verticalAlignment = intOr(properties.vertical_alignment);
  result.autowrapMode = intOr(properties.autowrap_mode);
  return result;
}
export function isLabel(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Label';
}
// A pure-container type with NO extra fields just returns parseControl (vbox/parser.ts):
//   export function parseHBoxContainer(h, p): ControlProperties { return parseControl(h, p); }
//   (import ControlProperties from '../control/types')

======================= REFERENCE: parser.test.ts =======================
import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseLabel, isLabel } from './parser';
function h(attributes: Record<string, string>): ParsedHeading { return { type: 'node', attributes }; }
describe('parseLabel', () => {
  it('unquotes text + parses alignment + font-size override', () => {
    const p = parseLabel(h({ name: 'T', type: 'Label' }), {
      text: '"Hello"', horizontal_alignment: '1', 'theme_override_font_sizes/font_size': '18',
    });
    expect(p.text).toBe('Hello');
    expect(p.horizontalAlignment).toBe(1);
    expect(p.themeOverrideFontSizes?.font_size).toBe(18);
  });
  it('type guard accepts/rejects', () => {
    expect(isLabel(h({ type: 'Label' }))).toBe(true);
    expect(isLabel(h({ type: 'Button' }))).toBe(false);
  });
});

======================= REFERENCE: Component.tsx =======================
// Every Control component: read props, compute outer layout via
// controlLayoutStyle(props, parentKind), render a <div data-control-type=... data-node-name=...>.
// CONTAINERS additionally wrap children in <ControlParentProvider kind="...">.
// LEAF controls render their content and (optionally) pass {children} through.

// (a) CONTAINER example (vboxcontainer/Component.tsx):
import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';
const DEFAULT_SEPARATION = 4;
export function VBoxContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const separation = props.themeOverrideConstants?.separation ?? DEFAULT_SEPARATION;
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'flex', flexDirection: 'column', gap: \`\${separation}px\`,
  };
  return (
    <div data-control-type="VBoxContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="column">{children}</ControlParentProvider>
    </div>
  );
}

// (b) LEAF example (label/Component.tsx) — note system font + controlColorToCss:
import { controlColorToCss } from '../../../../r3f/controls/styleBoxToCss';
// ...const style = { ...controlLayoutStyle(props, parentKind) }; set fontSize/color/textAlign...
// return <div data-control-type="Label" data-node-name={node.name} style={style}>{props.text ?? ''}</div>;

==================== REFERENCE: registration files ====================
// index.ts — register the PARSER (NodeRegistry). For a type WITH a types.ts add 'export * from "./types";'
import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseLabel, isLabel } from './parser';
const labelRegistration: NodeTypeRegistration = { typeName: 'Label', typeGuard: isLabel, parser: parseLabel };
nodeRegistry.register(labelRegistration);
export { labelRegistration };
export * from './parser';
export * from './types';   // only if types.ts exists

// index.r3f.ts — register the COMPONENT (ControlComponentRegistry):
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Label } from './Component';
controlComponentRegistry.register({ typeName: 'Label', Component: Label });
export { Label };

=================== HELPERS you may import (do not reimplement) ===================
// r3f/controls/styleBoxToCss.ts:
//   colorToCss(value: string): string | undefined           // gates on Color(...) form
//   controlColorToCss(c: {r,g,b,a} 0..1): string             // -> rgba()
//   styleBoxToCss(type: string, data: Record<string,string>): CSSProperties
// r3f/controls/resolveStyleBox.ts:
//   resolveStyleBoxCss(ref: string | undefined, internalResources): CSSProperties
//     // resolves a theme_override_styles/* SubResource("StyleBoxFlat_x") ref to CSS.
// r3f/SceneResourcesContext.tsx:
//   useSceneResources(): { internalResources, externalResources }   // call inside the Component
// resources/SubResourceResolver.ts: parseResourceReference(ref) -> {type:'SubResource'|'ExtResource', id} | null
// controlLayout.ts ParentLayoutKind: 'free'|'row'|'column'|'grid'|'center'|'margin'|'block'

================================ FIXTURE ================================
// Create ${FIX}/unit-<kebab>.tscn: a MINIMAL valid Godot 4 scene with a
// full-rect root Control containing your node type. Keep load_steps correct.
// Example skeleton (adapt; add a [sub_resource type="StyleBoxFlat" id="..."] if your
// type needs theme_override_styles):
//   [gd_scene format=3]
//   [node name="Root" type="Control"]
//   anchors_preset = 15
//   anchor_right = 1.0
//   anchor_bottom = 1.0
//   [node name="My<Type>" type="<Type>" parent="."]
//   ... a couple of representative properties ...
`;

// ---- The 11 ld-58 Control types (folder, class, parentKind, per-type spec) ----
const TYPES = [
  {
    folder: 'hboxcontainer', cls: 'HBoxContainer', kebab: 'hbox-container', hasTypes: false,
    spec: `CONTAINER. Identical to VBoxContainer but HORIZONTAL: flexDirection 'row',
provide kind "row", gap = themeOverrideConstants.separation ?? 4. parser just
returns parseControl (type ControlProperties from ../control/types). data-control-type="HBoxContainer".`,
  },
  {
    folder: 'gridcontainer', cls: 'GridContainer', kebab: 'grid-container', hasTypes: true,
    spec: `CONTAINER with a CSS grid. types.ts: GridContainerProperties extends ControlProperties { columns?: number }.
parser: parseControl + columns = intOr(properties.columns). Component: display:'grid',
gridTemplateColumns: \`repeat(\${props.columns ?? 1}, max-content)\`,
columnGap = (themeOverrideConstants.h_separation ?? 4)px, rowGap = (themeOverrideConstants.v_separation ?? 4)px.
Provide kind "grid". data-control-type="GridContainer".`,
  },
  {
    folder: 'centercontainer', cls: 'CenterContainer', kebab: 'center-container', hasTypes: false,
    spec: `CONTAINER that centers its child. No extra fields (parser returns parseControl).
Component: display:'flex', alignItems:'center', justifyContent:'center'. Provide kind "center".
data-control-type="CenterContainer".`,
  },
  {
    folder: 'margincontainer', cls: 'MarginContainer', kebab: 'margin-container', hasTypes: false,
    spec: `CONTAINER that pads its child. No extra fields (parser returns parseControl) — the
margins live in themeOverrideConstants (keys margin_left/margin_top/margin_right/margin_bottom).
Component: const c = props.themeOverrideConstants ?? {}; padding =
\`\${c.margin_top ?? 0}px \${c.margin_right ?? 0}px \${c.margin_bottom ?? 0}px \${c.margin_left ?? 0}px\`.
Also display:'flex', flexDirection:'column' so the single child fills width. Provide kind "margin".
data-control-type="MarginContainer".`,
  },
  {
    folder: 'scrollcontainer', cls: 'ScrollContainer', kebab: 'scroll-container', hasTypes: false,
    spec: `CONTAINER with scrolling. No extra fields (parser returns parseControl). Component:
overflow:'auto'. Provide kind "block" (child flows at natural size and scrolls).
data-control-type="ScrollContainer".`,
  },
  {
    folder: 'panel', cls: 'Panel', kebab: 'panel', hasTypes: false,
    spec: `A Control with a StyleBox background. NOT a container — its children anchor against
it, so provide kind "free". No extra parser fields (parser returns parseControl). Component:
call useSceneResources() -> { internalResources }; styleBoxCss = resolveStyleBoxCss(
props.themeOverrideStyles?.panel, internalResources). style = { ...controlLayoutStyle(props, parentKind),
...styleBoxCss }. If styleBoxCss has no backgroundColor, apply a neutral default
backgroundColor 'rgba(42, 42, 46, 0.92)' so an un-themed panel is still visible.
Wrap children in <ControlParentProvider kind="free">. data-control-type="Panel".
Import resolveStyleBoxCss from ../../../../r3f/controls/resolveStyleBox and useSceneResources
from ../../../../r3f/SceneResourcesContext.`,
  },
  {
    folder: 'panelcontainer', cls: 'PanelContainer', kebab: 'panel-container', hasTypes: false,
    spec: `A container that draws a StyleBox panel and lays its child inside the content margins.
No extra parser fields (parser returns parseControl). Component: useSceneResources() ->
{ internalResources }; styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.panel,
internalResources) — note styleBoxToCss already maps content_margin_* to CSS padding. style =
{ ...controlLayoutStyle(props, parentKind), ...styleBoxCss }; default backgroundColor
'rgba(42, 42, 46, 0.92)' when none. Provide kind "block". data-control-type="PanelContainer".
Same imports as Panel.`,
  },
  {
    folder: 'button', cls: 'Button', kebab: 'button', hasTypes: true,
    spec: `A clickable button (render NORMAL visual state; this is a viewer, not interactive).
types.ts: ButtonProperties extends ControlProperties { text?: string; disabled?: boolean;
flat?: boolean; alignment?: number }. parser: parseControl + text=unquote(properties.text),
disabled = properties.disabled === 'true', flat = properties.flat === 'true',
alignment = intOr(properties.alignment). Component: useSceneResources()->{internalResources};
styleBoxCss = resolveStyleBoxCss(props.themeOverrideStyles?.normal, internalResources).
Build style = { ...controlLayoutStyle(props, parentKind), display:'inline-flex',
alignItems:'center', justifyContent:'center', boxSizing:'border-box', cursor: props.disabled ? 'default':'pointer',
...DEFAULTS, ...styleBoxCss } where DEFAULTS (applied only if NOT flat and styleBoxCss is empty)
give a sensible button look: padding '6px 14px', borderRadius '4px',
backgroundColor 'rgba(70, 78, 94, 0.95)', color '#e8e8ea'. font size from
themeOverrideFontSizes.font_size; font color from themeOverrideColors.font_color via controlColorToCss
(overrides default color). opacity 0.6 when disabled. textAlign center. Render the text:
<div data-control-type="Button" data-node-name={node.name} style={style}>{props.text ?? ''}{children}</div>.`,
  },
  {
    folder: 'textbutton-NONE', skip: true,
  },
  {
    folder: 'texturerect', cls: 'TextureRect', kebab: 'texture-rect', hasTypes: true,
    spec: `Displays an image from a Texture2D ExtResource. types.ts: TextureRectProperties extends
ControlProperties { texture?: string; expandMode?: number; stretchMode?: number }. parser:
parseControl + texture = properties.texture (raw ref string, do NOT unquote), expandMode =
intOr(properties.expand_mode), stretchMode = intOr(properties.stretch_mode).
Component (host-agnostic image load — works in web AND VS Code via the file provider):
  import * as THREE from 'three';  // type-only use is fine; THREE is allowed in r3f components
  import { useResource } from '../../../../resources/useResource';
  import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
  import { parseResourceReference } from '../../../../resources/SubResourceResolver';
  Resolve path: if texture starts with 'res://' use it; else parseResourceReference -> ExtResource id
  -> externalResources.find(r => r.id === id)?.path. (Mirror Sprite3D's resolveTexturePath.)
  const tex = useResource<THREE.Texture>(path ?? '', 'Texture2D');  // ALWAYS call the hook (path '' short-circuits)
  const src = (tex.value?.image as { src?: string } | undefined)?.src;
  stretchMode -> objectFit: 0->'fill', 4|5->'contain', 6->'cover', else 'none'. center when 3 or 5.
  If src is present: render <img src={src} style={{ ...controlLayoutStyle, objectFit, width:'100%', height:'100%', display:'block' }} alt={node.name} data-control-type="TextureRect" data-node-name={node.name} />.
  Otherwise render a labeled placeholder <div data-control-type="TextureRect" data-control-fallback="true"
  style={{ ...controlLayoutStyle, minWidth:32, minHeight:32, outline:'1px dashed #c792ea' }} title={path ?? 'no texture'} />.
  NOTE: useResource needs ResourceLoaderContext; outside it the hook degrades to the placeholder — that is acceptable.`,
  },
  {
    folder: 'richtextlabel', cls: 'RichTextLabel', kebab: 'rich-text-label', hasTypes: true,
    spec: `A label that may contain BBCode. types.ts: RichTextLabelProperties extends ControlProperties
{ text?: string; bbcodeEnabled?: boolean; fitContent?: boolean }. parser: parseControl + text=unquote(properties.text)
(text may already be plain), bbcodeEnabled = properties.bbcode_enabled === 'true',
fitContent = properties.fit_content === 'true'. Component: strip BBCode for a best-effort render:
const plain = (props.text ?? '').replace(/\\[\\/?[^\\]]+\\]/g, ''); render plain text in a div with
whiteSpace:'pre-wrap'. Apply font size/color from theme overrides like Label (controlColorToCss).
data-control-type="RichTextLabel".`,
  },
  {
    folder: 'canvaslayer', cls: 'CanvasLayer', kebab: 'canvas-layer', hasTypes: true,
    spec: `IMPORTANT: CanvasLayer is NOT a Control (it has no anchors/offsets). It is a passthrough
layer that hosts Control children. types.ts: CanvasLayerProperties { name: string; visible?: boolean;
layer?: number }. parser: do NOT call parseControl. Build it directly:
  const result: CanvasLayerProperties = { name: heading.attributes.name || '' };
  if (properties.visible !== undefined) result.visible = properties.visible !== 'false';
  const layer = intOr(properties.layer); if (layer !== undefined) result.layer = layer;
  return result;
isCanvasLayer guard: heading.type==='node' && heading.attributes.type==='CanvasLayer'.
Component: a full-rect passthrough. style = { position:'absolute', inset:0,
display: props.visible === false ? 'none' : undefined }. Wrap children in
<ControlParentProvider kind="free"> so Control children anchor against the viewport.
data-control-type="CanvasLayer". (Import ControlComponentProps + ControlParentProvider as usual;
type props as CanvasLayerProperties.)`,
  },
].filter((t) => !t.skip);

const SLICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['controlType', 'filesWritten', 'parentKindProvided', 'summary'],
  properties: {
    controlType: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    parentKindProvided: { type: 'string', description: "free|row|column|grid|center|margin|block|n/a" },
    fixtureCreated: { type: 'string' },
    summary: { type: 'string' },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
};

phase('Build Control slices');
log(`Fanning out ${TYPES.length} Control slices: ${TYPES.map((t) => t.cls).join(', ')}`);

const results = await parallel(
  TYPES.map((t) => () =>
    agent(
      `${SHARED}

=================== YOUR ASSIGNMENT: ${t.cls} ===================
Folder: ${UI}/${t.folder}/
${t.hasTypes ? 'Create types.ts.' : 'No types.ts needed (type adds no fields beyond Control).'}
Fixture: ${FIX}/unit-${t.kebab}.tscn

SPEC:
${t.spec}

Create the full slice (parser.ts, parser.test.ts, Component.tsx, index.ts, index.r3f.ts${
        t.hasTypes ? ', types.ts' : ''
      }) plus the fixture, all via the Write tool with absolute paths. Then return your manifest.
Remember: do NOT touch any shared/barrel file, and do NOT run any build/test/git.`,
      { label: `slice:${t.cls}`, phase: 'Build Control slices', schema: SLICE_SCHEMA }
    )
  )
);

return {
  built: results.filter(Boolean),
  failed: TYPES.map((t) => t.cls).filter((_, i) => !results[i]),
};
