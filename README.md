# School of Design & Society Space Manager

An Airtable Extension that uses the School's normalized facilities base as a time-aware spatial operating layer. It maps `Spaces` to real floor-plan records and stores person-to-space history in `Space Assignments & Stewardship`. It does not create a parallel Seats or People system.

This repository now runs the SoDS facilities extension from its root. The original wedding seating demo has been preserved under `legacy/wedding/` for reference, with its application in `legacy/wedding/app/`. Two Kaplan second-floor source plans are committed under `assets/floor-plans/`; no floor-plan geometry or operational records have been fabricated.

See [the September 4 development setup](docs/DEVELOPMENT_SETUP.md) for the configured local preview, current Airtable setup, semester-date policy, and dependency audit results.

See [the September 7 floor-plan pilot](docs/FLOOR_PLAN_PILOT.md) for the four active zone plans, uploaded earlier comparison versions, saved geometry linking 64 existing workstations, printable PDFs, and remaining layout-review work.

## What works

- Setup discovers likely School tables and fields automatically. The normal screen shows one readiness summary and the Person Types used by the assignment queue; technical connections remain available under a collapsed Advanced section.
- The operational screen uses Floor and Workspace Area navigation. Zones with active workstations or mapped areas/rooms are offered, Building remains internal metadata, and Room stays visible in workstation breadcrumbs when the hierarchy includes one.
- Search accepts person name, email, Person ID, Space name, Space ID, short label, room number, and hierarchy ancestor names. Preferred Name and Role / Title are deliberately not used by the extension. A person result locates their active assignment or their next future assignment.
- Availability can cover one date or an inclusive range. A Space is shown only when it has capacity for the full range.
- Assignments are date-aware, capacity-aware, and based on `Space Assignments & Stewardship`; `Current?` is never used to calculate occupancy.
- New assignments default to the selected semester, or the semester containing the viewed date. Workstation assignments prefer the existing `Primary Desk Holder` choice when available.
- Missing or invalid occupancy dates mark a workstation as **Needs review** and exclude it from available results. People with unresolved occupancy dates are held out of the Needs workspace queue for review in Diagnostics.
- Exclusive and shared-space capacity conflicts block a save. Shared capacity uses peak simultaneous occupancy across the requested range. Other questionable conditions appear as warnings.
- Moves create a destination assignment and then close the source assignment; the original Space link is not overwritten.
- A Space panel shows present/future assignments, full history, access requirements, organizational context, and assignment actions.
- The floor-plan editor supports normalized points, rectangles, and polygons; pan/zoom; move; numeric resize/rotate; link to an existing Space; lock; undo/redo; save; and geometry-only deletion.
- When a floor-plan record or attachment is unavailable, the extension shows a selectable workstation list instead of an empty map, so assignment work can continue before mapping is complete.
- Diagnostics cover duplicate IDs/emails, incomplete assignments, invalid dates, overlapping occupancy, missing links, unmapped assignable Spaces, missing plan files, and stale geometry links.
- Read-only users retain map, search, history, availability, diagnostics, and print access while write controls are disabled.
- A plan checklist selects one or several zone sheets to display and print. Printing fits each complete sheet to its own portrait or landscape page with assignment highlights; a separate action prints the selected plans' roster.

## Architecture

```text
src/
  components/                 operational UI and setup
  config/schema.ts            name discovery, ID mappings, validation, rules
  services/assignmentEngine.ts pure date/capacity/conflict/move logic
  services/geometry.ts         normalized coordinate transforms
  services/diagnostics.ts      read-only data-quality checks
  services/airtable/           record adapters and guarded writes
  types/domain.ts              facilities domain model
tests/                         date, capacity, move, geometry, and schema tests
```

Presentation never reads literal Airtable field names. `dataMapper.ts` is the boundary between Airtable cell values and typed domain objects. Assignment and geometry calculations can run without React or Airtable.

The model deliberately keeps these separate:

| Concept | Airtable authority |
|---|---|
| Physical place | `Spaces` |
| Where a place appears | `Floor Plan Geometry` |
| Plan source/version | `Floor Plans` |
| Person | `People` |
| Person-to-Space relationship over time | `Space Assignments & Stewardship` |
| Zone ownership / organizational areas | Existing `Programs & Units` table |
| Semester date assistance | `Academic Terms` |
| Keys/cards, equipment, and requests | Existing specialist tables; not duplicated here |

## Supported Airtable schema

Required tables are `Spaces`, `People`, `Space Assignments & Stewardship`, `Academic Terms`, and the organizational-areas table (currently `Programs & Units`). Names may differ because Setup saves the selected table/field IDs.

Minimum required mappings:

| Table | Required mappings |
|---|---|
| Spaces | Space Name, Active? |
| People | Full Name |
| Space Assignments & Stewardship | Person, Space, Relationship Type, Start Date, Expected End Date, Actual End Date |
| Academic Terms | Term Name, Start Date, End Date |
| Organizational Areas (`Programs & Units`) | Name |

Strongly recommended mappings include stable Space/Person IDs; Space Type, Building Code, Level, room/area number, Parent Space, Zone Owner (the existing Managing Program / Unit link), Assignable?, Assignment Mode, Assignment Capacity; person email/type/status/affiliation/end date; assignment status, term, capacity, access, move, and notes fields.

The supported physical hierarchy is `Building → Floor → Zone → Workstation`, with an optional Room between Zone and Workstation when the physical layout needs it. All levels remain records in `Spaces`, connected by `Parent Space`; no separate Zones table is created. A Zone owns an organizational area such as MDes, PhD, or SoDS Operations, and descendants inherit that owner at runtime. The extension never auto-creates hierarchy records or copies ownership into every descendant.

When the base has no dedicated `Assignable?` mapping, only Space Types recognized as Desk or Workstation are treated as assignable. Floors, Zones, Rooms, and other containers are excluded from workstation availability metrics.

The legal/posted, CLSS, EMS, and furniture capacities are intentionally ignored. Only the dedicated `Assignment Capacity` field is used.

Optional integrations may be absent. The current interface summarizes assignment-level key/card requirements but does not read secrets or become a key-management app. Reservation instructions can be mapped, but the extension does not replace EMS. Asset and facilities-request detail adapters are planned, not implemented in this version.

## Floor-plan tables

Review and create these tables in Airtable, then map them in Setup. The extension does not mutate schema automatically.

### Floor Plans

Recommended fields:

- `Floor Plan Name` — primary text
- `Floor Plan ID` — stable text identifier
- `Building` — optional text, single select, or link consistent with the base
- `Level` — text or single select
- `Zone` — optional link to one Zone record in `Spaces`; blank for a full-floor overview
- `Plan File` — attachment (PNG, JPG/JPEG, SVG or WebP for clickable mapping; PDF for reference preview)
- `Version` — text
- `Effective Date`, `Retired Date` — dates
- `Active?` — checkbox
- `Original Width`, `Original Height` — numbers
- `Notes` — long text

Attachment URLs are read at runtime from the linked Floor Plan record. They are not copied into geometry or configuration.

### Floor Plan Geometry

Recommended fields:

- `Geometry ID` — primary text or formula/autonumber
- `Floor Plan` — link to Floor Plans
- `Space` — link to Spaces
- `Geometry Type` — single select: `point`, `rectangle`, `polygon`
- `X`, `Y`, `Width`, `Height`, `Rotation`, `Label X`, `Label Y`, `Z Index` — numbers
- `Polygon / Path JSON` — long text
- `Visible?`, `Locked?` — checkboxes
- `Last Updated` — date/time
- `Notes` — long text

Coordinates and polygon vertices are normalized to `0..1` relative to the displayed source plan. `Floor Plan` and `Space` links—not temporary attachment URLs—are the durable identity.

### Optional dedicated capacity fields

If equivalents do not already exist, consider adding to `Spaces`:

- `Assignable?` — checkbox
- `Assignment Mode` — single select: `Exclusive`, `Shared`, `Non-occupancy`
- `Assignment Capacity` — integer

Consider `Consumes Capacity?` on the assignment table when relationship names alone are not sufficient. If mapped, it takes precedence over the configured relationship list.

## Setup

1. Install dependencies with `npm ci`.
2. Configure local CLI authentication with `npx block set-api-key` using a personal access token with `block:manage` and access to the target base. Connected-app authentication is separate from the local CLI.
3. If the checkout has no local remote, connect it with `npx block add-remote <base-id>/<block-id> dev`, then run `npm start -- --remote=dev`. A checkout with `.block/remote.json` can use `npm start`. Open the developer extension in the target base and connect the URL printed by the server. Keep the terminal running while testing. The `.block/` directory and `.airtableblocksrc.json` are ignored by Git.
4. In Setup, check the readiness message and select the Person Types that should appear under **Needs workspace**. An empty selection deliberately means nobody is assumed to need a workstation.
5. Save and open Space Manager. Open **Advanced connections** only when a connection says it needs attention or an Airtable table was intentionally replaced.
6. Add Floor Plan records and attach actual source files when the visual map is needed. The workstation list works without them.

If a field is renamed after setup, its saved field ID continues to work. If it is deleted, Setup reports the missing ID instead of leaving a blank screen.

## Floor-plan editing

Choose the correct floor and versioned plan, then choose **Map workstations**. Select a drawing tool and link new geometry to an existing `Space`. For polygons, click each vertex and choose **Finish polygon**. Select existing geometry to drag it, enter dimensions/rotation, or lock it. Undo/redo is local until **Save map edits** is selected.

Deleting a map shape asks for confirmation and deletes only the `Floor Plan Geometry` record. It never deletes the linked Space or assignment history.

The repository includes two original second-floor PDFs under `assets/floor-plans/` for architectural and named-room reference. The current seating views are the four simplified zone files under `assets/floor-plans/zones/`: MDes, Faculty, PhD, and Public & Administrative. Each has an SVG, PNG, separate PDF under `output/pdf/`, and matching coordinate JSON. Their PNGs and geometry for the 64 existing workstation records are now saved in the pilot Airtable base. Earlier layouts are uploaded as inactive comparisons, with the first abstract sheets preserved under `assets/floor-plans/versions/draft-01/`. Change a plan's `Active?` field to make it available in the extension, then select the sheets to view/print. See the pilot guide for record links, layout caveats and outstanding Zone links. The mapper prefers an image even when the reference PDF is attached first.

The [pilot draft](docs/FLOOR_PLAN_PILOT.md) retains all 102 numbered desks from the old drawing plus the 14 proposed PhD positions on the right. Draft 02 restores source room footprints, circulation, stairs and furniture context while keeping the drawings clean. Its manifests reference the 64 existing workstation records and keep the other 52 primary symbols as unverified reference desks. Each image has independent normalized coordinates; use the same revision of the PNG and JSON. The drafts are not live geometry or an automatic import. A workstation shown on multiple plans uses multiple geometry records linked to the same Space; selection totals count that Space once.

## Assignment and conflict rules

Dates are calendar dates and boundaries are inclusive. Effective end is:

```text
Actual End Date, otherwise Expected End Date, otherwise open-ended
```

Canceled/cancelled, inactive, void, and declined assignments do not consume occupancy. Steward, Manager, Responsible Party, and Owner relationships are treated as non-capacity relationships even if an accidental capacity flag is present. Other behavior is driven by `Consumes Capacity?` or configured relationship names.

Before writing, validation checks required links/dates, end-before-start, missing/inactive Space, inactive Person warning, affiliation end warning, Space capacity, and overlapping exclusive assignments for a Person. Date overlap is:

```text
A.start <= B.end AND B.start <= A.end
```

Null assignment ends are infinity. Exclusive capacity-1 overlap and shared capacity overruns are blocking errors. The operational date filter checks one day unless a range is selected. Person overlap across different exclusive spaces is a warning because an intentional secondary relationship may need review.

Ending an assignment validates a real calendar date and rejects dates earlier than its start, both before confirmation and at the Airtable write boundary.

Moves validate first, create the destination assignment, then close the source one. If the second write fails, the error names the newly created record so staff can reconcile the partial result without losing history.

## Legacy KI-Desk Assignments migration

An Airtable Extension cannot read another base directly. Sync or import a reviewed staging table into the facilities base first. Do not turn `MDes` and `PhD` into permanent application tables.

For each legacy row, prepare a review sheet that resolves:

1. Person by institutional Person ID.
2. Otherwise person by institutional email.
3. Otherwise normalized name as a candidate requiring human review.
4. Desk number to an existing `Spaces` record. Never invent a Space or desk number.
5. Assignment dates from an authoritative term/source. Never invent missing dates.
6. Key number to the normalized key/access tables, not assignment notes, after key staff review.

Approved rows create or link one Person, one desk Space, and one `Space Assignments & Stewardship` history record. Ambiguous names remain unresolved; they are never auto-merged solely on a name match. The separate MDes/PhD source can then be retired only after counts and samples reconcile.

## Development and verification

```text
npm start          # Airtable local development server; requires a configured remote
npm run typecheck  # strict TypeScript validation
npm run lint       # source lint
npm test           # Vitest suite
npm run build      # typecheck plus deterministic browser bundle in dist/
npm run check      # lint, all tests, and the typechecked browser build
npm run audit:runtime # advisory check for production dependencies
```

The Blocks CLI exposes authenticated `release`, not a standalone build command. `npm run build` verifies that the complete browser application bundles; use `block release` only after configuring the intended Airtable remote and reviewing the release in that base.

## Known limitations

- Live-record and in-Airtable browser testing still requires access to the target base and a locally configured Blocks CLI remote. Credentials and `.block/` configuration are intentionally excluded from Git.
- PDF uses the browser's embedded renderer for reference preview with an open-file link. Clickable geometry is shown and edited on an image export (PNG/JPEG/SVG/WebP), fitted to the same rectangle as the shapes. Browser PDF viewer margins and independent scaling are not used as mapping coordinates.
- Polygon creation is vertex-based. Multi-select, snap-to-grid, alignment guides, keyboard nudging, and visual resize handles remain future editor improvements.
- Bulk assignment/move/end/extend review screens are not implemented. Individual assignment, end, and move workflows are guarded and functional.
- Assignment extension is not yet a dedicated action; staff can create the next history record or edit in Airtable. Assets, open facilities requests, key-copy details, and electronic-access records are not yet loaded into the detail panel.
- The setup wizard maps existing schema but intentionally does not create tables/fields.
- `@airtable/blocks-cli` currently brings deprecated development-only transitive packages and npm audit findings. The September 4 audit found 9 affected development packages and 0 affected runtime dependencies after targeted updates. The CLI's nested `qs` is overridden to 6.16.0 to fix server query-parser advisories. Do not use `npm audit fix --force`: its current proposal downgrades the CLI from 3.0.3 to 0.0.54. See the setup notes for details.

Before rollout, test against a copy of `template_SoDS Facilities & Access Manager`, verify Airtable field types and permission checks, attach the actual Kaplan plans, map a small pilot floor, and reconcile assignment/conflict diagnostics with facilities staff.

## Working across computers

See [Automatic GitHub sync](docs/GITHUB_AUTO_SYNC.md) for the two-repo VS Code workspace, automatic saved-work backups, status and pause controls, and setup on another Linux computer.
