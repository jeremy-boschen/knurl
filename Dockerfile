# Knurl CI Image (Node 24 LTS, minimal size)
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_VERSION=24.0.0 \
    RUST_BACKTRACE=1 \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      build-essential \
      pkg-config \
      libssl-dev \
      libgtk-3-dev \
      libwebkit2gtk-4.1-dev \
      libsoup-3.0-dev \
      libjavascriptcoregtk-4.1-dev \
    ; \
    \
    # --- Node.js 24 LTS (official tarball) ---
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) node_arch="x64" ;; \
      arm64) node_arch="arm64" ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
    rm -f /tmp/node.tar.xz; \
    \
    # Corepack ships with Node 24 → Yarn without global npm install
    corepack enable; \
    corepack prepare yarn@4.10.3 --activate; \
    \
    # --- Rust (minimal) ---
    curl -fsSL https://sh.rustup.rs -o /tmp/rustup-init.sh; \
    sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain stable; \
    rm -f /tmp/rustup-init.sh; \
    rustup component add clippy; \
    \
    # verify
    node --version; \
    npm --version; \
    yarn --version; \
    rustc --version; \
    cargo --version; \
    cargo clippy --version; \
    \
    # cleanup
    rm -rf /var/lib/apt/lists/
