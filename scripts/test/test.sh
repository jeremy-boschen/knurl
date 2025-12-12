#!/bin/bash
set -e

# Initialize flags
RUN_UNIT=false
RUN_E2E=false
RUN_PERF=false
RUN_CHECK=false

# Default reports
REPORTS=()

# Arrays to hold parsed args
MODE_ARGS=()
REPORT_ARGS=()
WDIO_ARGS=()

# Helper function to generate coverage report
generate_coverage_report() {
  echo ""
  echo "GENERATING COVERAGE REPORT..."

  # Merge coverage: handles both Istanbul JSON and Cobertura XML merging
  node scripts/test/merge-coverage.mjs

  echo ""
  echo "CHECKING THRESHOLDS..."
  node scripts/test/check-coverage.js
}

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
      unit)  RUN_UNIT=true ;;
      e2e)   RUN_E2E=true ;;
      perf)  RUN_PERF=true ;;
      check) RUN_CHECK=true ;;
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
  # Note: Vitest testNamePattern requires full test names, not regex patterns
  # For now, all UI unit tests run when using --grep
  VITEST_COVERAGE=true node scripts/test/run-vitest-groups.mjs --run

  # Rename frontend coverage files to ui-unit-*
  if [ -f coverage/coverage-final.json ]; then
    mv coverage/coverage-final.json coverage/ui-unit-coverage.json
    echo "  Renamed coverage-final.json → ui-unit-coverage.json"
  fi
  if [ -f coverage/cobertura-coverage.xml ]; then
    mv coverage/cobertura-coverage.xml coverage/ui-unit-coverage.xml
    echo "  Renamed cobertura-coverage.xml → ui-unit-coverage.xml"
  fi

  echo ""
  echo "2️⃣  Running backend unit tests..."
  cd src-tauri
  RUST_TEST_ARGS=""
  # Extract grep pattern if present in WDIO_ARGS
  for i in "${!WDIO_ARGS[@]}"; do
    if [[ "${WDIO_ARGS[$i]}" == "--mochaOpts.grep" ]]; then
      RUST_TEST_ARGS="${WDIO_ARGS[$((i+1))]}"
      break
    fi
  done

  if cargo llvm-cov --version &> /dev/null 2>&1; then
    # Run tests once to collect coverage (no format flag = just collect)
    if [ -z "$RUST_TEST_ARGS" ]; then
      cargo llvm-cov --lib 2>&1 | grep -v "warning:" || true
    else
      cargo llvm-cov --lib -- "$RUST_TEST_ARGS" 2>&1 | grep -v "warning:" || true
    fi
    # Generate both LCOV and Cobertura from collected coverage data (without re-running tests)
    cargo llvm-cov report --lcov --output-path ../coverage/rust-unit-coverage.info 2>&1 | grep -v "warning:" || true
    cargo llvm-cov report --cobertura --output-path ../coverage/rust-unit-coverage.xml 2>&1 | grep -v "warning:" || true
  else
    echo "  (cargo-llvm-cov not installed, run: cargo install cargo-llvm-cov)"
    if [ -z "$RUST_TEST_ARGS" ]; then
      cargo test
    else
      cargo test -- "$RUST_TEST_ARGS"
    fi
  fi
  cd - > /dev/null

  # Convert Rust LCOV
  if [ -f coverage/rust-unit-coverage.info ]; then
    echo "Converting Rust LCOV to Istanbul format..."
    node scripts/test/lcov-to-istanbul.mjs coverage/rust-unit-coverage.info coverage/rust-unit-coverage.json
  fi
fi

# -----------------------------------------------------------------------------
# Execution: E2E Tests
# -----------------------------------------------------------------------------
if [ "$RUN_E2E" = true ]; then
  echo ""
  echo "3️⃣  Building Rust with coverage instrumentation..."
  cd src-tauri
  if cargo llvm-cov --version &> /dev/null 2>&1; then
    # Build with coverage instrumentation (but don't run tests yet)
    LLVM_PROFILE_FILE="coverage/e2e-%p.profraw" cargo llvm-cov build --no-report 2>&1 | grep -v "warning:" || true
  else
    echo "  (cargo-llvm-cov not installed, E2E Rust coverage skipped)"
    cargo build || true
  fi
  cd - > /dev/null

  echo ""
  echo "4️⃣  Running E2E tests..."

  # Construct command with proper quoting
  CMD=("yarn" "wdio" "run" "./wdio.conf.ts")

  # Add captured args
  for arg in "${WDIO_ARGS[@]}"; do
    CMD+=("$arg")
  done

  echo "   > ${CMD[@]}"
  "${CMD[@]}" || true

  echo "Aggregating E2E coverage..."
  node scripts/test/aggregate-e2e-coverage.mjs

  # Generate E2E Rust coverage
  echo "Generating E2E Rust coverage..."
  cd src-tauri
  if cargo llvm-cov --version &> /dev/null 2>&1; then
    cargo llvm-cov report --lcov --output-path ../coverage/rust-e2e-coverage.info 2>&1 | grep -v "warning:"
    cargo llvm-cov report --cobertura --output-path ../coverage/rust-e2e-coverage.xml 2>&1 | grep -v "warning:"
  fi
  cd - > /dev/null

  # Convert E2E Rust LCOV
  if [ -f coverage/rust-e2e-coverage.info ]; then
    echo "Converting E2E Rust LCOV to Istanbul format..."
    node scripts/test/lcov-to-istanbul.mjs coverage/rust-e2e-coverage.info coverage/rust-e2e-coverage.json
  fi
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
  
  CMD="yarn wdio run ./wdio.conf.ts --spec='src-common/e2e/specs/performance.e2e.ts'"
  # We still respect other args like grep if useful, but mostly perf is specific.
  
  echo "   > $CMD"
  eval "$CMD"
  
  echo "Generating Performance Report..."
  node scripts/test/generate-performance-report.mjs
fi

# -----------------------------------------------------------------------------
# Execution: Check (Quick Critical Tests)
# -----------------------------------------------------------------------------
if [ "$RUN_CHECK" = true ]; then
  echo ""
  echo "⚡ Running quick critical test check..."

  echo "  1️⃣ Frontend unit tests..."
  node scripts/test/run-vitest-groups.mjs --run

  echo "  2️⃣ Backend unit tests..."
  cd src-tauri && cargo test
  cd - > /dev/null

  # Determine the app binary path based on platform
  APP_BINARY="src-tauri/target/e2e-test/knurl"
  if [ "$OSTYPE" = "msys" ] || [ "$OSTYPE" = "win32" ]; then
    APP_BINARY="${APP_BINARY}.exe"
  fi

  # Check if app binary exists (should be pre-built by CI or user)
  if [ ! -f "$APP_BINARY" ]; then
    echo "  ⚠️  App binary not found at $APP_BINARY, building now..."
    cd src-tauri
    cargo build --profile e2e-test
    cd - > /dev/null
  fi

  echo "  3️⃣ E2E critical tests only..."
  yarn wdio run ./wdio.conf.ts --mochaOpts.grep "\[CRITICAL\]"

  echo "✅ Critical test suite passed!"
fi

# -----------------------------------------------------------------------------
# Finalize: Coverage Report (always generated if tests ran)
# -----------------------------------------------------------------------------
# Generate coverage report if any tests were run (unit, e2e, or check)
if [ "$RUN_UNIT" = true ] || [ "$RUN_E2E" = true ] || [ "$RUN_CHECK" = true ]; then
  generate_coverage_report
fi

echo ""
echo "✅ Test run complete!"