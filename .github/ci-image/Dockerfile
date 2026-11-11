# The image that the browser and Godot jobs of CI run in. It holds what those jobs would otherwise
# install from the Ubuntu archive or download in each run: the system libraries of Chromium,
# lavapipe, xvfb, the locked Chromium and the Godot binary. Node, pnpm and the workspace packages
# stay with .github/actions/setup, which keys them on .nvmrc and the lockfile.
# scripts/ci/ciImage.mjs names the image by a hash of this file and the Playwright version.

# Only `playwright install` below runs on this Node. None of it stays in the image.
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS node

# Ubuntu 24.04, as ubuntu-latest is: the same Mesa, so lavapipe rasterises as it does on a runner.
FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852

LABEL org.opencontainers.image.source=https://github.com/Vortiago/textscene-inspector
LABEL org.opencontainers.image.description="What the browser and Godot jobs of CI install"

ENV DEBIAN_FRONTEND=noninteractive

# A build survives an outage of the Ubuntu archive, as on 2026-11-11, when no runner could
# resolve archive.ubuntu.com: it then installs from a mirror. Every package is signed, so a
# mirror cannot alter one. Not an apt mirror list: apt retries the first mirror for each file.
RUN getent hosts archive.ubuntu.com > /dev/null \
  || sed -i 's|^URIs: .*|URIs: http://mirrors.edge.kernel.org/ubuntu/|' /etc/apt/sources.list.d/ubuntu.sources

# git: actions/checkout clones with it, and the vendor step of `pnpm install` applies patches.
# zstd: actions/cache packs with it on a runner, and an entry packed another way never matches.
# mesa-vulkan-drivers: lavapipe, the driver of `pnpm test:gpu` and of `pnpm ref:godot`.
# xvfb and xauth: `xvfb-run`, the display Godot renders to.
# libatomic1: the pnpm that pnpm/action-setup installs loads it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl git libatomic1 unzip xz-utils zstd \
    mesa-vulkan-drivers xvfb xauth \
  && rm -rf /var/lib/apt/lists/*

ARG ENGINE_VERSION=4.6.3-stable
# Of the Linux x86_64 binary inside the release zip.
ARG ENGINE_SHA256=f64d4ed19fc9df9440321653fcc80df8c6e365ba7b6de0a29e2cfa9fa71bfeb3
RUN binary="Godot_v${ENGINE_VERSION}_linux.x86_64" \
  && curl -fsSL -o /tmp/godot.zip \
    "https://github.com/godotengine/godot/releases/download/${ENGINE_VERSION}/${binary}.zip" \
  && unzip -q /tmp/godot.zip -d /tmp/godot \
  && echo "${ENGINE_SHA256}  /tmp/godot/${binary}" | sha256sum --check \
  && install -m 755 "/tmp/godot/${binary}" /usr/local/bin/godot \
  && rm -r /tmp/godot.zip /tmp/godot \
  && godot --headless --version

# Where `pnpm playwright:install` looks first. It downloads only a Chromium this image lacks.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# The Playwright of pnpm-lock.yaml, which the build passes. `--with-deps` installs the system
# libraries that Playwright lists for its Chromium on this Ubuntu.
ARG PLAYWRIGHT_VERSION
RUN --mount=type=bind,from=node,source=/usr/local,target=/opt/node \
  test -n "${PLAYWRIGHT_VERSION}" \
  && apt-get update \
  && PATH="/opt/node/bin:${PATH}" npm_config_cache=/tmp/npm \
    npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/* /tmp/npm
