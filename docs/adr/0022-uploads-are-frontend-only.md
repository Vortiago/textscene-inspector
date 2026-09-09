# ADR 0022 — User uploads are frontend-only; the backend serves fixtures and nothing else

- Status: Accepted (2026-07-12)

An **Uploaded scene** and its **Resource upload**s live exclusively in the browser:
in-memory, session-only, never sent to or stored on the backend. The backend's only
content role is serving the **Fixture catalog**, the committed demo, test and showcase
corpus. The single way user content leaves the browser is the explicit
"Download .tscn" export (ADR-0020).

This is a privacy promise, not an implementation accident. People point the previewer
at unreleased, proprietary game scenes, and it must be safe to do so without thinking
about where the bytes go. There is deliberately no upload endpoint to be careless with.

Consequences, the features this knowingly forecloses until this ADR is revisited:
share-by-link of an uploaded scene, server-side persistence, and cross-device sync.
Any future feature wanting to transmit user content must reopen this ADR explicitly
and make the egress a separate, unmistakable user action, never a side effect of
previewing. Edits being ephemeral (reset on scene switch, ADR-0020) and the
frontend-only upload rule are two halves of the same contract. The previewer holds
your work only for the session, only locally.
