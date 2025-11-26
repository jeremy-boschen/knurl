#!/bin/bash
set -e

# Initialize flags
RUN_UNIT=false
RUN_E2E=false
RUN_PERF=false

# Default reports
REPORTS=()

# Arrays to hold parsed args
MODE_ARGS=()
REPORT_ARGS=()
WDIO_ARGS=()

# -----------------------------------------------------------------------------
# Helper: Parse Arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode=*)
      MODE_ARGS+=("${1#--mode=}")
      shift
      ;;
    --mode)
      MODE_ARGS+=("$2")
      shift 2
      ;;
    --report=*)
      REPORT_ARGS+=("${1#--report=}")
      shift
      ;;
    --report)
      REPORT_ARGS+=("$2")
      shift 2
      ;;
    --spec=*)
      # Pass through to WDIO
      WDIO_ARGS+=("--spec" "${1#--spec=}")
      shift
      ;;
    --spec)
      WDIO_ARGS+=("--spec" "$2")
      shift 2
      ;;
    --grep=*|--test=*)
      # Pass through to WDIO
      val="${1#*=}"
      WDIO_ARGS+=("--mochaOpts.grep" "$val")
      shift
      ;;
    --grep|--test)
      WDIO_ARGS+=("--mochaOpts.grep" "$2")
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Helper: Determine Modes
# -----------------------------------------------------------------------------
if [[ ${#MODE_ARGS[@]} -eq 0 ]]; then
  # Default to running everything if no mode specified? 
  # Or strictly unit + e2e?
  echo "No mode specified, defaulting to unit + e2e"
  RUN_UNIT=true
  RUN_E2E=true
else
  for mode in "${MODE_ARGS[@]}"; do
    case $mode in
      unit) RUN_UNIT=true ;;
      e2e)  RUN_E2E=true ;;
      perf) RUN_PERF=true ;;
      *) echo "Unknown mode: $mode"; exit 1 ;;
    esac
  done
fi

# -----------------------------------------------------------------------------
# Helper: Determine Reports
# -----------------------------------------------------------------------------
# If no reports specified, default to 'text-summary' (console) + 'html' + 'json-summary'
# Mapping:
#   console -> text, text-summary
#   json    -> json, json-summary
#   html    -> html
#   lcov    -> lcov
if [[ ${#REPORT_ARGS[@]} -eq 0 ]]; then
  # Default set
  COVERAGE_REPORTERS="json,json-summary,lcov,text,text-summary,html"
else
  reporters=""
  for r in "${REPORT_ARGS[@]}"; do
    case $r in
      console) reporters="${reporters}text,text-summary," ;;
      json)    reporters="${reporters}json,json-summary," ;;
      html)    reporters="${reporters}html," ;;
      lcov)    reporters="${reporters}lcov," ;;
      *)       reporters="${reporters}${r}," ;; # Allow passing raw istanbul reporter names
    esac
  done
  COVERAGE_REPORTERS=${reporters%,}
fi

export COVERAGE_REPORTERS

# Clean coverage directories if we are running tests
if [ "$RUN_UNIT" = true ] || [ "$RUN_E2E" = true ] || [ "$RUN_PERF" = true ]; then
  echo "Cleaning coverage directories..."
  rm -rf coverage .nyc_output
  mkdir -p coverage
fi

# -----------------------------------------------------------------------------
# Execution: Unit Tests
# -----------------------------------------------------------------------------
if [ "$RUN_UNIT" = true ]; then
  echo ""
  echo "1️⃣  Running frontend unit tests..."
  VITEST_COVERAGE=true node scripts/test/run-vitest-groups.mjs --run

  echo ""
  echo "2️⃣  Running backend unit tests..."
  cd src-tauri
  if cargo llvm-cov --version &> /dev/null 2>&1; then
    cargo llvm-cov --lib --lcov --output-path ../coverage/rust-lcov.info
    cargo llvm-cov --lib --cobertura --output-path ../coverage/cobertura-rust.xml
  else
    echo "  (cargo-llvm-cov not installed, run: cargo install cargo-llvm-cov)"
    cargo test
  fi
  cd - > /dev/null

  # Convert Rust LCOV
  if [ -f coverage/rust-lcov.info ]; then
    echo "Converting Rust LCOV to Istanbul format..."
    node scripts/test/lcov-to-istanbul.mjs coverage/rust-lcov.info coverage/rust-coverage.json
  fi
fi

# -----------------------------------------------------------------------------
# Execution: E2E Tests
# -----------------------------------------------------------------------------
if [ "$RUN_E2E" = true ]; then
  echo ""
  echo "3️⃣  Running E2E tests..."
  
  # Construct command
  CMD="yarn wdio run ./wdio.conf.ts"
  
  # Add captured args
  for arg in "${WDIO_ARGS[@]}"; do
    CMD="$CMD $arg"
  done
  
  echo "   > $CMD"
  eval "$CMD"

  echo "Aggregating E2E coverage..."
  node scripts/test/aggregate-e2e-coverage.mjs
  
  echo "Converting E2E to Cobertura..."
  node scripts/test/convert-e2e-to-cobertura.mjs
fi

# -----------------------------------------------------------------------------
# Execution: Perf Tests
# -----------------------------------------------------------------------------
if [ "$RUN_PERF" = true ]; then
  echo ""
  echo "🚀 Running Performance Benchmark..."
  
  # Force the spec for perf
  # Note: If user provided --spec args, they might conflict or append. 
  # Perf usually targets specific scenarios.
  
  CMD="yarn wdio run ./wdio.conf.ts --spec='test/specs/performance-benchmark.e2e.ts'"
  # We still respect other args like grep if useful, but mostly perf is specific.
  
  echo "   > $CMD"
  eval "$CMD"
  
  echo "Generating Performance Report..."
  node scripts/test/generate-performance-report.mjs
fi

# -----------------------------------------------------------------------------
# Finalize: Coverage Merge & Check
# -----------------------------------------------------------------------------
# Only merge if we ran tests that produce coverage
if [ "$RUN_UNIT" = true ] || [ "$RUN_E2E" = true ]; then
  echo ""
  echo "MERGING COVERAGE..."
  
  # 1. Merge Istanbul JSONs (Frontend Unit + Rust Unit + E2E Aggregated)
  node scripts/test/merge-coverage.mjs

  # 2. Merge Cobertura XMLs (Frontend + Rust + E2E) - useful for CI
  node scripts/test/merge-cobertura.mjs

  echo ""
  echo "CHECKING THRESHOLDS..."
  node scripts/test/check-coverage.js
fi

echo ""
echo "✅ Test run complete!"