#!/usr/bin/env bash
# Pre-deploy smoke test runner.
# Usage:
#   ./scripts/smoke-test.sh                          # tests against preview
#   SMOKE_BASE_URL=https://propmanage.ro ./scripts/smoke-test.sh   # tests against production
set -e
cd "$(dirname "$0")/.."
exec python backend/tests/test_dashboards_smoke.py
