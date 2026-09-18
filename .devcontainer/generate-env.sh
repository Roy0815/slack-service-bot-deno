#!/usr/bin/env bash
#
# Regenerates the project-root .env from Codespaces secrets (Codespaces
# exposes repo/org secrets to the container as plain environment
# variables). Wired up as postCreateCommand so it runs on every container
# creation - safe to re-run, but it OVERWRITES .env each time, so treat
# Codespaces secrets (not a hand-edited .env) as the source of truth there.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ ! -f "${ENV_EXAMPLE}" ]]; then
  echo "generate-env.sh: ${ENV_EXAMPLE} not found, nothing to generate" >&2
  exit 1
fi

: > "${ENV_FILE}"
missing=0

while IFS= read -r line || [[ -n "${line}" ]]; do
  line="${line%$'\r'}"
  [[ "${line}" =~ ^[[:space:]]*$ ]] && continue
  [[ "${line}" =~ ^[[:space:]]*# ]] && continue

  key="${line%%=*}"
  key="${key//[[:space:]]/}"
  [[ -z "${key}" ]] && continue

  value="${!key:-}"
  if [[ -z "${value}" ]]; then
    echo "generate-env.sh: warning - no Codespaces secret set for ${key}, writing empty value" >&2
    missing=$((missing + 1))
  fi

  printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
done < "${ENV_EXAMPLE}"

if [[ "${missing}" -gt 0 ]]; then
  echo "generate-env.sh: wrote ${ENV_FILE} (${missing} secret(s) missing - set them in Codespaces repo settings and rebuild)" >&2
else
  echo "generate-env.sh: wrote ${ENV_FILE} from Codespaces secrets"
fi
