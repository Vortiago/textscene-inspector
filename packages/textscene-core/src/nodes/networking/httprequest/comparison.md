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

Issues HTTP requests at runtime and draws nothing, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin HTTPRequest -->
Strict parsing format-checks these `HTTPRequest` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `accept_gzip` | true or false |  |
| `body_size_limit` | integer -1-2000000000 | warning |
| `download_chunk_size` | integer 256-16777216 | error |
| `download_file` | quoted string, or the &"…" StringName jacket |  |
| `max_redirects` | integer -1-64 | warning |
| `timeout` | float >= 0 | error below |
| `use_threads` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

`index.ts` registers the base `parseNode`, which reads only the heading attributes and `transform`. A malformed `download_chunk_size` is never read on the lenient path, so there is no fallback to report.
