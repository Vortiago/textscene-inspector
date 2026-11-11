# The browser jobs of CI run in one prebuilt image

- Status: Accepted

## Context

On 2026-11-11 no GitHub runner could resolve `archive.ubuntu.com`. Every job that ran `apt-get` at
run time failed before its first test: the web previewer E2E run, which installs lavapipe, and the
Claude review, which installs bubblewrap.

A job of the last green run on main before this decision (run 4958) spent 10 to 25 s on Node, pnpm
and the workspace packages, 4 to 6 s on Chromium and 6 s on `apt-get`. The first two come from
caches keyed on the lockfile. The golden shards then run for 500 to 990 s each.

## Decision

The jobs that start Chromium run in one container image: the golden shards, the web previewer E2E
run, the renderer consumer run and the VS Code for the Web run. `.github/ci-image/Dockerfile`
builds it on Ubuntu 24.04, as `ubuntu-latest` is. It holds the system libraries that Playwright
lists for Chromium, lavapipe, the locked Chromium, and the Godot binary with `xvfb-run` for the
tests that render through Godot.

The image is `ghcr.io/<owner>/<repository>/ci:<tag>`, so a run in a fork publishes the fork's own
image. The tag is a hash of the Dockerfile and the Playwright version of the lockfile
(`scripts/ci/ciImage.mjs`). The `image` job of `ci.yml` builds and publishes the image only when
the tag does not exist. So a commit that changes neither input reuses the published image, and a
pull request that changes one runs in its own image. A build takes about 90 s, and a job pulls the
image in 14 to 21 s.

Node, pnpm and the workspace packages stay with `.github/actions/setup`.

## Considered options

- Workspace packages in the image: the pnpm store is 619 MB, and the image would be stale after
  each lockfile change. The cache keyed on the lockfile restores inside the 10 to 25 s setup step.
- One image per merge to main, with the repository, the goldens and generated output: the goldens
  and the Godot reference images are committed files, and no job generates them. A pull request
  that changes a scene or the lockfile would need a check that the image is not stale, and a pull
  request to a feature branch has a base that is not main.
- Every Linux job in the image: the other jobs install nothing from the Ubuntu archive, so the
  image would add its pull time to each and remove no failure.
- The Electron jobs in the image: a container job runs as root, and Electron then needs
  `--no-sandbox`, which changes what the test starts.
- A tag that moves, such as `latest`: a pull request that changes the Dockerfile would run in the
  image of main, and pass or fail for the wrong image.

## Consequences

- A browser job starts about 10 s later than on the runner. The pull of 14 to 21 s replaces the 4
  to 6 s restore of Chromium and, in the E2E job, 6 s of `apt-get`. The decision buys independence
  from the Ubuntu archive, not time.
- The Claude review job is not in the image and still runs `apt-get`: bubblewrap needs user
  namespaces, which a job container does not give.
- The image build still reads the Ubuntu archive, once for each new tag. When the archive does not
  resolve, the build installs from a mirror.
- The token of a fork's pull request cannot publish. Such a pull request that changes an input of
  the image fails in the `image` job, with a message that names the cause, until a maintainer
  pushes its branch to the repository. The job's `permissions` block raises the token of a
  Dependabot run, which is read-only by default.
- ghcr.io keeps every tag. An old tag is safe to delete once no open branch computes it.
