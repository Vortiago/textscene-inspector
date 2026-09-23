---
name: to-prd
description: Turn the current conversation context into a PRD and publish it to the project issue tracker. Use when user wants to create a PRD from the current context.
---

This skill writes a PRD from the conversation context and your knowledge of the codebase. Do not interview the user: combine what you already know.

You should already have the issue tracker and the triage label vocabulary. If not, run `/setup-matt-pocock-skills`.

## Process

1. If you have not explored the repo yet, explore it to understand the current code. Use the project's domain glossary in the whole PRD, and respect the ADRs in the area you touch.

2. Sketch the major modules to build or change. Look for deep modules that you can extract and test in isolation. A deep module holds a lot of function behind a simple, testable interface that rarely changes. A shallow module does not.

3. Check with the user that these modules match their expectations.

4. Ask the user which modules need tests.

5. Write the PRD from the template below.

6. Publish it to the project issue tracker with the `needs-triage` label, so it enters the normal triage flow.

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (that is, similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

</prd-template>
