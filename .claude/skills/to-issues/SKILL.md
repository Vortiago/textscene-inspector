---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tickets, or break down work into issues.
---

# To issues

This skill breaks a plan into issues that anyone can pick up alone, as vertical slices (tracer bullets).

You should already have the issue tracker and the triage label vocabulary. If not, run `/setup-matt-pocock-skills`.

## Process

### 1. Gather context

Work from the conversation context. If the user passes an issue reference (number, URL or path) as an argument, fetch it from the issue tracker and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not explored the codebase yet, do so to understand the current code. Use the project's domain glossary in issue titles and descriptions, and respect the ADRs in the area you touch.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice through every integration layer, not a horizontal slice of one layer.

A slice is 'HITL' or 'AFK'. A HITL slice needs a human, for example for an architectural decision or a design review. An AFK slice can be implemented and merged without a human. Prefer AFK where you can.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through every layer (schema, API, UI, tests).
- A completed slice can be demonstrated or verified on its own.
- Prefer many thin slices to a few thick ones.
</vertical-slice-rules>

### 4. Quiz the user

Show the breakdown as a numbered list. For each slice, show:

- **Title**: a short descriptive name.
- **Type**: HITL or AFK.
- **Blocked by**: the slices that must complete first, if any.
- **User stories covered**: the user stories it addresses, if the source has them.

Ask the user:

- Is the granularity right (too coarse or too fine)?
- Are the dependencies correct?
- Should a slice be merged or split?
- Are the right slices marked HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Publish the issues

1. Publish the issues in dependency order, blockers first, so the "Blocked by" field can name real issue identifiers.
2. Publish one new issue for each approved slice, with the body template below.
3. Apply the `needs-triage` label to each issue, so it enters the normal triage flow.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking ticket (if any)

Or "None - can start immediately" if no blockers.

</issue-template>

Do not close or change a parent issue.
