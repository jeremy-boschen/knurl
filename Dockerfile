# Knurl CI Image
# Pre-configured with all dependencies for building and testing
FROM ubuntu:24.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_VERSION=20 \
    RUST_BACKTRACE=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable && \
    /root/.cargo/bin/rustup default stable && \
    /root/.cargo/bin/rustup component add clippy

# Set Rust environment - place cargo/rustup in PATH
ENV PATH="/root/.cargo/bin:${PATH}" \
    RUSTUP_HOME="/root/.rustup" \
    CARGO_HOME="/root/.cargo"

# Install Node package manager (yarn is installed globally via npm)
RUN npm install -g yarn

# Verify installations (use full paths to ensure they work)
RUN node --version && \
    npm --version && \
    yarn --version && \
    /root/.cargo/bin/rustc --version && \
    /root/.cargo/bin/cargo --version && \
    /root/.cargo/bin/cargo clippy --version

# Set working directory
WORKDIR /workspace

# Default command
CMD ["/bin/bash"]
