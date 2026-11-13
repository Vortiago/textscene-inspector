# Godot's shaders run through one translator

- Status: Accepted. The owner approved the plan on 2026-11-13.
- Supersedes: ADR-0055 (the port of the lit surface by hand, and its triggers).
- Amends: ADR-0072 (the surface outputs as the module's inner seam, and the place of the
  translator's inputs).
- Related: ADR-0075 (a user's shader is part of the scene).

## Context

ADR-0055 ported Godot's lit surface to TSL node materials by hand, one feature at a time. ADR-0075
sets the goal: the package draws any Godot project a user opens, a user's own `.gdshader` included.
A hand port draws only the shaders someone has ported, so it cannot reach that goal.

Godot draws every material through one chain. A generator writes shading language text, the parser
reads it, and the compiler links it into a template, Godot's renderer GLSL, at its slots. A mode
table renames each built-in and turns each render mode into a define. A user's shader enters the
chain as text, as Godot's own materials do.

## Decision

**The package ports Godot's chain, with TSL node objects as its output in place of GLSL text.**

- **The work list is the instruction table.** `pnpm godot:shader-language` reads Godot 4.6.3's
  source and writes one row for each type, keyword, operator signature, statement, tree node,
  built-in function overload, built-in, render mode, hint and preprocessor directive. Each row
  names the issue that translates it. A row is translated when a probe names it.
- **One front end and one emitter.** The tokenizer, parser and type check are a port of
  `shader_language.cpp`, with Godot's type rules read from the table and Godot's messages for a
  text Godot refuses. A construct not translated yet fails with its row and its owning issue. The
  emitter walks the typed tree and calls TSL functions. It builds node objects, never JavaScript
  text, so a page with no `unsafe-eval` runs it. three's GLSL transpiler is not used: it writes
  text and drops constructs with no error.
- **A probe proves an instruction.** A probe is a shading language function that applies one
  instruction to a table of inputs: signed zeros, subnormals, large values, the infinities and NaN.
  `pnpm godot:probes` records Godot's answers as float bits. The real-GL test runs the translation
  on the same inputs and compares the bits.
- **Godot's own shaders run through the same translator.** The templates are parsed with their
  slots, one variant for each define set. The generators of the built-in materials are hand ports
  whose proof is text equal to Godot's. The binding tables and the passes are hand written. The
  plan of #1451 lists these parts and their owners.
- **Godot's source is in the CI image.** The generators and their `--check` read it at
  `/opt/godot-source` through `scripts/godotSource.mjs`, and run in the "Shader package" job.
  The decoupling test lists the scripts that may read it. No script reads the local checkout.
- **The package tests itself in three layers**, with no previewer code: unit tests in
  `packages/textscene-core/src/shaders/`, the probes on a real GL context
  (`pnpm test:shaders:gpu`), and end to end pages that compare a plain three.js page with a live
  Godot render (`pnpm test:shaders:e2e`). A slice records Godot's answers and fails its coverage
  test before it adds code.
- **The guide explains what is translated.** `apps/textscene-three-godot-shaders/guide/` has one
  chapter for each family the translator reads, with Godot's recorded values, and the showcases of
  the end to end layer. The table's generator writes it, and `--check` fails when it is stale.

The switch, the golden rule and the bundle ceiling of ADR-0055 stay until the translated materials
are the default. The anchor checks of the shader patches stay until the last patch goes.

## Considered options

- **Continue the hand port.** It draws only the features someone ports, and a user's shader not at
  all.
- **Use three's GLSL transpiler.** It writes JavaScript text, takes no define set, and drops a
  construct it does not read with no error.

## Consequences

- The first lit surface on the node path comes after the language and the scene template, not in
  the second slice of the old plan.
- A Godot upgrade is a regeneration of the table, the probe record and the guide, and the diff
  shows what changed in the language (#1835).
- The **Surface outputs** stop being a seam when the scene template runs, because the template
  reads the names Godot's compiler gives.
