# Development setup — September 4, 2026

## Local preview

The working checkout has a default `.block/remote.json` and named `.block/dev.remote.json` pointing to the existing SoDS extension:

- Base: `SDS_Facilities & Access Manager` (`appr3HkHrFMEyePyN`). This is the existing base, not a duplicated test base.
- Extension: `blkyXmfJYFXj8cJwa`.
- Development URL: `https://localhost:9000`.

Run `npm start` from the repository root, then use the printed URL in the extension's development panel inside Airtable. `npm start -- --remote=dev` selects the same extension explicitly. Local edits rebuild automatically. The development server must remain running.

Authentication is saved through `npx block set-api-key`. The token needs `block:manage` and access to this base. It is separate from connected Airtable-app authentication. Do not commit a token. Both local remote configuration and application-local CLI credential files are ignored by Git.

Run `npm run check` to lint, run all regression tests, and create a typechecked browser bundle. `npm run audit:runtime` checks runtime dependencies. `npm run build` creates a local verification bundle; it does not publish a release.

Validation after the changes: lint passed, all 78 tests passed, the strict TypeScript/browser build passed, and `git diff --check` passed. The development server was restarted after dependency updates and reported a successful bundle at the URL above.

## Airtable setup completed

- Created `Floor Plan Geometry` (`tblIpc3ShEuxNJsJ3`) with 17 fields, including links to the existing Spaces and Floor Plans tables, geometry type, normalized coordinates, polygon JSON, rotation, visibility, locking, ordering, and update timestamp. The extension discovers these names during setup.
- Filled the existing Fall 2026 Academic Term with August 17–December 12. The source is the [Illinois Tech Registrar academic calendar](https://www.iit.edu/registrar/academic-calendar): August 17 is the fall term start, and December 12 is the last day of ID full-semester courses and final exam week.
- At the facilities owner's instruction to assume assignments begin and end each semester, set all 65 previously undated assignment/stewardship records to Start Date `2026-08-17`, Expected End Date `2026-12-12`, and the existing Fall 2026 term link. Readback verified all 65 records. These are owner-approved semester assumptions, not independently recovered historical dates. Actual End Date was left unchanged.

No People or Spaces were created, and no map shapes were invented. The numbered plan still needs its PDF attachment before geometry can be traced. Uploading the local PDF requires `data.records:write` on the token or a manual upload in Airtable. A direct upload attempt was rejected with HTTP 403 while the token was configured for development.

## Assignment behavior

New assignments default to the full selected semester or the active semester containing the viewed date. If no valid term is found, dates need to be entered in the dialog. Workstation assignments prefer the existing `Primary Desk Holder` choice. A move preserves the source relationship type and semester end.

Missing/invalid occupancy dates now withhold availability and show Needs review in the list, map, detail panel, and summary. An end date must be a valid calendar date on or after the assignment's start. Shared-space availability measures peak simultaneous occupancy, and capacity overruns block saves and appear in diagnostics.

## Dependency audit

The initial install had 18 affected packages: 1 low, 7 moderate, 8 high, and 2 critical. These counts include parent packages affected through their dependencies; they are not a count of independent attacks against the extension.

Updates applied:

- Vitest 3.2.4 → 3.2.7, addressing its server advisory.
- TypeScript ESLint parser/plugin 6.21.0 → 8.69.0, removing the pinned vulnerable minimatch dependency.
- Compatible body-parser update and an override of the CLI's nested qs to 6.16.0. Query parsing was smoke-tested.

After updates, `npm audit` reports 9 affected packages: 6 moderate, 2 high, 1 critical. All are under Airtable Blocks CLI 3.0.3, which was the latest published release when checked. `npm audit --omit=dev` reports **0 vulnerabilities**.

The remaining roots are the CLI's old Octokit dependencies and tar 6. Its installed code uses these to download and extract GitHub templates in `lib/helpers/app_template_utils.js`. They are development dependencies, not imported by the extension's browser application. They still require upstream fixes; a clean runtime audit does not certify the entire development environment.

Do not run `npm audit fix --force` to remove these warnings. Its current proposal is to downgrade the CLI to 0.0.54. Cross-major overrides of Octokit and tar also need explicit compatibility work because the CLI depends on their older APIs. Keep the warnings visible and review a new official CLI release when available.

## Remaining browser validation

No browser-control session was available during setup. The CLI built the development bundle and reported its listening URL, but the extension still needs a visual check inside Airtable, including PDF overlay alignment and a small set of reviewed workstation shapes. Production release and live assignment/move/end smoke tests have not been performed.
