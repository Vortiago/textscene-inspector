---
type: HTTPRequest
category: Other
status: linter-only
fixture: unit-http-request.tscn
# image: unit-http-request
visual: false
renders_as: nothing (a transform-only group)
---

# HTTPRequest

This node issues HTTP(S) requests at runtime and draws nothing, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `accept_gzip` | `true` | none — no visual effect |
| `body_size_limit` | `-1` | none — no visual effect |
| `download_chunk_size` | `65536` | none — no visual effect |
| `download_file` | `"res://downloads/file.zip"` | none — no visual effect |
| `max_redirects` | `8` | none — no visual effect |
| `timeout` | `10.0` | none — no visual effect |
| `use_threads` | `false` | none — no visual effect |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin HTTPRequest -->
Strict parsing format-checks these `HTTPRequest` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `accept_gzip` | true or false |  |
| `body_size_limit` | integer -1-2000000000 | warning |
| `download_chunk_size` | integer 256-16777216 | error |
| `download_file` | quoted string |  |
| `max_redirects` | integer -1-64 | warning |
| `timeout` | float >= 0 | error below |
| `use_threads` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`parser.ts` reuses the base `parseNode`, which reads only `transform`/`name`/`parent`/
`instance`/`index` — none of HTTPRequest's own properties. A malformed
`download_chunk_size` like `"abc"` is never read by the lenient path at all, so it has
no fallback value to report: the node still renders as the same empty transform group
the strict parser would accept.
