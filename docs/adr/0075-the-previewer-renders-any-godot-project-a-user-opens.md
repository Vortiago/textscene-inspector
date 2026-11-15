# The previewer renders any Godot project a user opens

- Status: Accepted. The owner stated the goal on 2026-11-13.
- Related: ADR-0041 (the surface of a shader the previewer does not render), ADR-0055 and ADR-0072
  (the port of Godot's shaders).

## Context

The owner's words: "We're rendering users scenes, that includes their own shaders."

The plans measured their scope against the scenes of the corpus and the features the previewer
draws today. The port of Godot's shaders took its scope from the lit surface patches of ADR-0055,
so the shadow passes, the sky and a user's shader had no owner. The owner found each gap later, as
new work.

## Decision

**The renderer's subject is any Godot project a user opens, not the scenes and the features the
previewer draws today.** The linter has the same rule for every valid `.tscn` (AGENTS.md).

- **Port Godot's mechanism, not a list of features.** A mechanism is the shading language, a file
  format or a whole node family. A port of the features that the corpus uses stops at the first
  project of a user that uses another one.
- **A user's own shader is part of the scene.** The renderer draws it as Godot does. The default
  surface of ADR-0041 serves only the shader that the renderer cannot draw yet.
- **Test a plan with one question:** does it draw what a user brings that the corpus does not hold?
  When a plan can be read two ways, take the general reading, or ask the owner before the work
  starts.
- **A line that cuts scope names its owner.** Such a line says "out of scope", "later",
  "follow-up", "not filed" or "host input". Its owner is an open issue. A comparison sheet,
  `GLOSSARY.md` and a code comment carry no issue number, so the pull request body names the owner
  of a line in one of them.
- **A plan that covers less than the request shows the missing part when it is proposed.**

## Consequences

- "No corpus scene needs it" is no reason to leave a Godot behaviour out. It can decide the order
  of the work.
- A plan takes its scope from the owner's request. An ADR about a narrower subject does not set it.
- The port of Godot's shaders changes its scope and its structure. ADR-0055 and ADR-0072 carry the
  amendment.
