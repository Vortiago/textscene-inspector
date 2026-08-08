/**
 * The gallery's stylesheet. Everything visual is decided here, so re-styling
 * never touches a comparison sheet (SHEET-STANDARD.md) and refreshing the
 * screenshots never touches the styling.
 */

export const CSS = String.raw`
:root{
  --bg:#f5f6f8; --panel:#fff; --panel-2:#eceef2; --ink:#161a20; --muted:#5c6470;
  --line:#dde1e8; --godot:#b07430; --ours:#37729e; --ok:#2f8158; --warn:#b4553a; --err:#a23b3b;
  /* Finished, but draws nothing. Distinct from --ours, which means "our render". */
  --novis:#4a6f8f;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0e1014; --panel:#161a20; --panel-2:#1d222b; --ink:#e6e9ee; --muted:#98a1af;
  --line:#272d38; --godot:#d69b58; --ours:#69a8d6; --ok:#57b085; --warn:#e07a5f; --err:#e06a6a;
  --novis:#7fa6c4;
}}
:root[data-theme=dark]{--bg:#0e1014;--panel:#161a20;--panel-2:#1d222b;--ink:#e6e9ee;--muted:#98a1af;--line:#272d38;--godot:#d69b58;--ours:#69a8d6;--ok:#57b085;--warn:#e07a5f;--err:#e06a6a;--novis:#7fa6c4}
:root[data-theme=light]{--bg:#f5f6f8;--panel:#fff;--panel-2:#eceef2;--ink:#161a20;--muted:#5c6470;--line:#dde1e8;--godot:#b07430;--ours:#37729e;--ok:#2f8158;--warn:#b4553a;--err:#a23b3b;--novis:#4a6f8f}
*{box-sizing:border-box}
body{margin:0;display:grid;grid-template-columns:264px 1fr;min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.6}
.side{border-right:1px solid var(--line);background:var(--panel);padding:18px 14px;position:sticky;top:0;height:100vh;overflow-y:auto}
.brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:15px;letter-spacing:-.01em;margin-bottom:14px}
.dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--godot),var(--ours))}
#search{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2);color:var(--ink);font:inherit;font-size:13px;margin-bottom:12px}
#search:focus{outline:2px solid var(--ours);outline-offset:1px}
.nav-cat{font-size:12px;font-weight:700;letter-spacing:-.01em;color:var(--ink);margin:18px 0 6px;padding:0 8px 4px;border-bottom:1px solid var(--line)}
.nav-cat:first-child{margin-top:0}
.nav-group{margin-bottom:8px}
.nav-head{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:0 8px 5px}
.nav-item{display:block;width:100%;text-align:left;border:0;background:none;color:var(--ink);font:inherit;font-size:13.5px;padding:5px 8px;border-radius:6px;cursor:pointer}
.nav-item:hover{background:var(--panel-2)}
.nav-item[aria-current=true]{background:var(--ours);color:#fff}
.nav-item.novis{color:var(--muted)}
.nav-item.novis::after{content:"○";float:right;font-size:10px;line-height:1.6;opacity:.6}
/* Status: a small nav dot (.st) and a header/section chip (.status). */
.st{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle}
.st-done{background:var(--ok)}.st-limitation{background:var(--warn)}.st-unimplemented{background:var(--err)}
.st-unreviewed{background:var(--muted);opacity:.55}.st-linter-only{background:var(--novis)}
.status{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:20px;color:#fff;white-space:nowrap}
.status.st-done{background:var(--ok)}.status.st-limitation{background:var(--warn)}.status.st-unimplemented{background:var(--err)}
.status.st-unreviewed{background:none;color:var(--muted);border:1px solid var(--line)}
.status.st-linter-only{background:var(--novis)}
.sheet-head .status{margin-left:auto}
.status-note{height:3px;border-radius:3px;margin:-6px 0 20px}
.status-note.st-done{background:var(--ok)}.status-note.st-limitation{background:var(--warn)}.status-note.st-unimplemented{background:var(--err)}
.status-note.st-unreviewed{background:var(--line)}.status-note.st-linter-only{background:var(--novis)}
.prop{border-top:1px solid var(--line);padding-top:24px;margin-top:30px}
.prop:first-of-type{border-top:0;padding-top:4px;margin-top:8px}
.prop-head{display:flex;align-items:center;gap:12px;margin:0 0 14px}
.prop-head h3{margin:0;font-size:18px;letter-spacing:-.01em;text-transform:none;color:var(--ink)}
.prop .prose{margin-top:16px}
.prose.intro{margin-top:0;margin-bottom:4px}
.novisual{background:var(--panel-2);border:1px dashed var(--line);border-radius:12px;padding:26px;text-align:center;color:var(--muted);font-size:14px}
main{padding:28px clamp(16px,4vw,48px)}
.sheet{max-width:900px;margin:0 auto}
.sheet-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:18px}
.sheet-head h2{margin:0;font-size:26px;letter-spacing:-.02em}
.renders{color:var(--muted);font-size:14px}
/* Godot reference chips — generated from the node catalog, never hand-written
   into a sheet. Godot-toned to read as "the engine's side" of the comparison. */
.reflink{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;color:var(--godot);border:1px solid var(--godot);border-radius:20px;padding:2px 9px;white-space:nowrap;opacity:.85}
.reflink:hover{background:var(--godot);color:var(--panel);opacity:1}
/* Inline ADR citation in prose, linked by the generator (never hand-written). */
.adr{color:var(--ours);text-decoration:none;border-bottom:1px dotted currentColor}
.adr:hover{border-bottom-style:solid}
.renders code{color:var(--ours)}
.fixture{margin-left:auto;font-size:12px;color:var(--muted);text-decoration:none;white-space:nowrap}
.fixture code{color:inherit}
.fixture:hover{color:var(--ours);text-decoration:underline}
code{font-family:var(--mono);font-size:.9em;background:var(--panel-2);padding:1px 5px;border-radius:4px}
.compare{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
/* Slider: godot underneath fills the box; ours overlays it, clipped from the
   LEFT by --split so the left band shows godot and the right band shows ours —
   which is what the corner tags say. */
.stage{position:relative;user-select:none;touch-action:none;background:var(--panel-2);--split:50%}
.stage img{display:block;width:100%;height:auto}
.stage .img-ours{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 0 0 var(--split))}
.stage.sbs{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.stage.sbs .img-ours{position:static;width:100%;height:auto;clip-path:none}
.stage.sbs .handle{display:none}
.handle{position:absolute;top:0;bottom:0;left:var(--split);width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);cursor:ew-resize}
.handle::after{content:"";position:absolute;top:50%;left:50%;width:28px;height:28px;transform:translate(-50%,-50%);border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.4)}
.tag{position:absolute;top:8px;font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#fff;padding:3px 7px;border-radius:5px}
.tag.g{left:8px;background:var(--godot)}.tag.o{right:8px;background:var(--ours)}
.stage.sbs .tag.o{right:auto;left:calc(50% + 8px)}
.modes{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--line)}
.modes button{font:inherit;font-size:12.5px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);border-radius:7px;padding:5px 11px;cursor:pointer}
.modes button[aria-pressed=true]{background:var(--ours);border-color:var(--ours);color:#fff}
.prose{margin-top:22px}
.prose h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:26px 0 10px}
.prose p{margin:0 0 12px;max-width:70ch}
.prose ul{margin:0 0 12px;padding-left:20px;max-width:70ch}
.prose li{margin:0 0 5px}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:440px}
th,td{text-align:left;padding:8px 13px;border-bottom:1px solid var(--line)}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
td{font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
@media (max-width:720px){body{grid-template-columns:1fr}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}}
`;
