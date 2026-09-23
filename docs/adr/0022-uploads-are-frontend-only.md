# ADR 0022: User uploads are frontend-only; the backend serves fixtures and nothing else

- Status: Accepted

An **Uploaded scene** and its **Resource upload**s live only in the browser: in memory,
for the session, never sent to or stored on the backend. The only content role of the
backend is to serve the **Fixture catalog**, the committed demo, test and showcase
corpus. The single way user content leaves the browser is the explicit
"Download .tscn" export (ADR-0020).

This is a privacy promise, not an implementation accident. People point the previewer
at unreleased, proprietary game scenes, and it must be safe to do so without a thought
about where the bytes go. There is deliberately no upload endpoint to be careless with.

Consequences: the decision forecloses share-by-link of an uploaded scene, server-side
persistence and cross-device sync. A feature that wants to transmit user content must
reopen this ADR explicitly and make the egress a separate, unmistakable user action,
never a side effect of previewing. Ephemeral edits (reset on scene switch, ADR-0020) and
the frontend-only upload rule are two halves of one contract: the previewer holds the
user's work only for the session, only locally.
