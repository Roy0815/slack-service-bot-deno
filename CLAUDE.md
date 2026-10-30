# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Slack bot for the club Schwerathletik Mannheim, built on the Deno Slack SDK and running entirely on Slack's infrastructure ("Run on Slack", no own server). Successor of the legacy bot [Roy0815/slack-service-bot](https://github.com/Roy0815/slack-service-bot) on AWS Lambda, which still receives incoming webhooks (e.g. DocuSeal "signed") and triggers workflows.

Code and comments are English; user-facing texts (Slack UI, docs) are German.

## Commands

```bash
deno task test                    # fmt --check + lint + all tests (same as CI on PRs into main)
deno test --allow-read src/masterdata/functions/set_leave_date/mod_test.ts   # single file
deno test --allow-read --filter "leave date"                                 # single test by name
deno fmt                          # format
slack run                         # local dev app, reads .env (test/sandbox keys)
slack deploy                      # update the deployed (prod) app
npm run env:dry-run | env:sync    # push .env.production to the deployed app (never .env)
npm run docs:dev                  # VitePress docs preview
```

Branches: `main` = production. Docs on GitHub Pages are deployed from `main` and describe only what is live there.

## Architecture

- **Only custom functions, no workflows in code.** Every function is a step used in Workflow Builder; workflows are maintained in Slack. [manifest.ts](manifest.ts) is the registry: a function not listed in `functions` is not deployed. Every external host must be in `outgoingDomains`, otherwise the runtime blocks the request.
- **Layout:** `src/<domain>/functions/<name>/` with `definition.ts` (`DefineFunction`, `callback_id` = `<domain>_<name>`, input/output schema), `mod.ts` (handler), optional `blocks.ts`/`views.ts`/`constants.ts`, and `*_test.ts` next to the code. Domains: `expenses`, `google_drive`, `masterdata`, `signatures`, `utility`; `src/gym/` is an early, unregistered prototype.
- **Interactive functions** return `{ completed: false }` and finish later in `addBlockActionsHandler` / `addViewSubmissionHandler` / `addViewClosedHandler` via `functions.completeSuccess/completeError`. Closing a modal must end the function with an error so the workflow doesn't hang. Reference implementation: [src/shared/functions/approver/mod.ts](src/shared/functions/approver/mod.ts) (generic approve/reject step, reused by multiple flows).
- **Workflow Builder quirks:** inputs it doesn't display (`message_ts`, `file_id`) are typed as plain `string`. Nested objects inside object parameters fail manifest validation, keep object schemas flat (see [src/shared/masterdata/schema.ts](src/shared/masterdata/schema.ts)).

### Shared code (`src/shared/`)

| What | Where |
| --- | --- |
| Masterdata (member data in Google Sheets) | interface `MasterdataService` + types in [masterdata/types.ts](src/shared/masterdata/types.ts); backend wired up only in [masterdata/service.ts](src/shared/masterdata/service.ts) (`getMasterdataService(env)`); implementation [masterdata/google_sheets_service.ts](src/shared/masterdata/google_sheets_service.ts) (column mapping lives here) |
| Google auth (JWT, scope-parametrized, no external package) | [google_service_account.ts](src/shared/google_service_account.ts) |
| Join public channel on demand / DM requester for private ones | `withChannelAccess` in [channel_access.ts](src/shared/channel_access.ts) |
| Small helpers (`assertOk`, `errorMessage`, date formatting, `EmailPattern`) | [util.ts](src/shared/util.ts) |

Signatures (DocuSeal) are behind a provider interface: [src/signatures/lib/provider.ts](src/signatures/lib/provider.ts) → `docuseal.ts`. Template field/role names live in `src/signatures/coaching_contract.ts` and `bank_change_form.ts`.

## Testing

Handlers are tested with `SlackFunctionTester` from the SDK. The SDK always builds a real API client, so **all HTTP (Slack API, Google, DocuSeal) is mocked by stubbing `fetch`** with [src/shared/testing/fetch_stub.ts](src/shared/testing/fetch_stub.ts) (responses keyed by URL substring, arrays for sequences, `{__status, body}` for errors; returns recorded calls for assertions). For Google, use `createTestGoogleServiceAccountEnv()` from [src/shared/testing/test_google_key.ts](src/shared/testing/test_google_key.ts). Example: [src/masterdata/functions/set_leave_date/mod_test.ts](src/masterdata/functions/set_leave_date/mod_test.ts).

## Env & secrets

Do not read `.env` / `.env.production` (contain secrets). Required keys are maintained only in [.env.example](.env.example); both env files are regenerated from Codespaces secrets (`DEV_`/`PROD_`/unprefixed) by `.devcontainer/generate-env.sh` on every container build. `GOOGLE_SERVICE_ACC_PRIVATE_KEY` is single-line with literal `\n`.

## Docs (German, VitePress, `docs/`) — keep in sync when changing functions

- [docs/technik/referenz.md](docs/technik/referenz.md): every function with `callback_id`, inputs/outputs, env vars. Read this first to understand a function without opening its code.
- [docs/technik/freigaben.md](docs/technik/freigaben.md): who may use which step (`slack function access`); add new functions to the table.
- [docs/technik/umgebungen.md](docs/technik/umgebungen.md): env/secret handling in detail.
- `docs/anleitung/`: end-user guides for members and admins.
