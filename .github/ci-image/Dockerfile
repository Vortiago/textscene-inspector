# The image that the browser jobs and the real-Godot job of CI run in. It holds what a job would
# otherwise install from the Ubuntu archive or download in each run: the system libraries of
# Chromium, lavapipe, the locked Chromium, and the Godot binary with xvfb for `pnpm ref:godot`.
# scripts/ci/ciImage.mjs names the image by a hash of this file and the Playwright version.

# Only `playwright install` below runs on this Node. None of it stays in the image.
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS node

# Ubuntu 24.04, as ubuntu-latest is: the same Mesa, so lavapipe rasterises as it does on a runner.
FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852

ENV DEBIAN_FRONTEND=noninteractive

# A build survives an outage of the Ubuntu archive, as on 2026-11-11, when no runner could
# resolve archive.ubuntu.com: it then installs from a mirror. Every package is signed, so a
# mirror cannot alter one. Not an apt mirror list: apt retries the first mirror for each file.
RUN getent hosts archive.ubuntu.com > /dev/null \
  || sed -i 's|^URIs: .*|URIs: http://mirrors.edge.kernel.org/ubuntu/|' /etc/apt/sources.list.d/ubuntu.sources

# What the actions of a job need: git for actions/checkout and the vendor step of `pnpm install`,
# libatomic1 for pnpm, and zstd for the entries of actions/cache. curl and unzip fetch Godot below.
# mesa-vulkan-drivers is lavapipe, the driver of `pnpm test:gpu` and of Godot. xvfb and xauth give
# `xvfb-run`, the display of Godot, which opens none without libXcursor and loads libXinerama too.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl git libatomic1 unzip zstd \
    mesa-vulkan-drivers xvfb xauth libxcursor1 libxinerama1 \
  && rm -rf /var/lib/apt/lists/*

# No job runs these two in the image. The Claude review job copies them and libwrap onto its
# runner, where they isolate a subprocess: bubblewrap makes user namespaces, which a job container
# does not allow.
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap socat \
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

# Where Playwright looks for its browsers, at build time and in a job.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# The Playwright of pnpm-lock.yaml, which the build passes. `--with-deps` installs the system
# libraries that Playwright lists for its Chromium on this Ubuntu. `--only-shell` leaves out the
# headed Chromium, 403 MB that no job starts.
ARG PLAYWRIGHT_VERSION
RUN --mount=type=bind,from=node,source=/usr/local,target=/opt/node \
  test -n "${PLAYWRIGHT_VERSION}" \
  && apt-get update \
  && PATH="/opt/node/bin:${PATH}" npm_config_cache=/tmp/npm \
    npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps --only-shell chromium \
  && rm -rf /var/lib/apt/lists/* /tmp/npm
