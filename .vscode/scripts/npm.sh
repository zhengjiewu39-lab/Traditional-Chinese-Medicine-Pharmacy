#!/usr/bin/env bash
set -e

if ! command -v npm >/dev/null 2>&1; then
  echo "错误: 未找到 npm，请先安装 Node.js (https://nodejs.org)" >&2
  exit 1
fi

cd "$(cd "$(dirname "$0")/../.." && pwd)"
export DISABLE_ESLINT_PLUGIN=true
export BROWSER=none

exec npm "$@"
