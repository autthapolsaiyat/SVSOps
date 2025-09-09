#!/usr/bin/env bash
set -e
for i in {1..60}; do
  if curl -fsS http://localhost:8080/api/ready >/dev/null 2>&1; then
    echo "READY OK"; exit 0
  fi
  sleep 0.5
done
echo "NOT READY"; exit 1
