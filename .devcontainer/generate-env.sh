#!/usr/bin/env bash
#
# Regenerates the project-root .env and .env.production from Codespaces
# secrets (Codespaces exposes repo/org secrets to the container as plain
# environment variables). Wired up as postCreateCommand so it runs on every
# container creation - safe to re-run, but it OVERWRITES both files each
# time, so treat Codespaces secrets (not hand-edited files) as the source of
# truth there.
#
#   .env             test/sandbox keys, read by `slack run` (local app)
#   .env.production  prod keys, pushed to the deployed app by
#                    scripts/sync-env-to-slack.js
#
# For every key in .env.example the value is resolved as:
#   DEV_<KEY> / PROD_<KEY>  (environment-specific secret)
#   <KEY>                   (unprefixed secret, shared by both environments)
#   empty                   (with a warning)
# There is deliberately no fallback between DEV_ and PROD_.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

if [[ ! -f "${ENV_EXAMPLE}" ]]; then
  echo "generate-env.sh: ${ENV_EXAMPLE} not found, nothing to generate" >&2
  exit 1
fi

# write_env <prefix> <target file>
write_env() {
  local prefix="$1"
  local env_file="$2"
  local missing=0
  local line key prefixed value

  : > "${env_file}"

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ "${line}" =~ ^[[:space:]]*$ ]] && continue
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue

    key="${line%%=*}"
    key="${key//[[:space:]]/}"
    [[ -z "${key}" ]] && continue

    prefixed="${prefix}${key}"
    value="${!prefixed:-${!key:-}}"
    if [[ -z "${value}" ]]; then
      echo "generate-env.sh: warning - neither ${prefixed} nor ${key} set as Codespaces secret, writing empty value to ${env_file##*/}" >&2
      missing=$((missing + 1))
    fi

    printf '%s="%s"\n' "${key}" "${value}" >> "${env_file}"
  done < "${ENV_EXAMPLE}"

  if [[ "${missing}" -gt 0 ]]; then
    echo "generate-env.sh: wrote ${env_file} (${missing} secret(s) missing - set them in Codespaces repo settings and rebuild)" >&2
  else
    echo "generate-env.sh: wrote ${env_file} from Codespaces secrets"
  fi
}

write_env "DEV_" "${PROJECT_ROOT}/.env"
write_env "PROD_" "${PROJECT_ROOT}/.env.production"
