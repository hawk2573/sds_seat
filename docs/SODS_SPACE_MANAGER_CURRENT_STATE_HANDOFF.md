# SoDS Space Manager: Current-State Handoff

> **Later update:** [September 4 development setup](DEVELOPMENT_SETUP.md) records subsequent code changes, semester dates populated with the owner's approval, the created geometry table, and the current dependency audit. The September 2 observations below remain a historical snapshot.

> **Internal facilities-planning context:** Share only in an approved School workspace with an appropriate audience.
>
> **Purpose:** Give another ChatGPT enough verified context to help finalize the School of Design & Society facilities workspace structure and decide what, if anything, should be placed in ChatGPT reference datasets.
>
> **Snapshot date:** September 2, 2026. Counts and configuration observations below are a point-in-time snapshot of the live Airtable base and the current `main` branch.
>
> **Source-of-truth rule:** Airtable is authoritative for current facilities and assignment records. GitHub is authoritative for extension code. A ChatGPT dataset should contain durable reference material or deliberately de-identified snapshots—not a competing operational database.

## Executive summary

The **School of Design & Society Space Manager** is a custom Airtable extension for browsing workstations, checking availability on a date or date range, and preserving assignment history when a person is assigned, moved, or removed from a workspace.

It is an interface over the existing normalized facilities base. It does **not** create a separate seats system, People directory, key system, asset system, or request system.

The current extension is suitable for **controlled testing against a copy of the base**, but its live data is not ready to produce authoritative occupancy totals. The main blockers are:

1. All 65 live relationship records currently have a blank `Start Date`.
2. The only Academic Term record has blank start and end dates.
3. The active numbered second-floor plan is present as a repository file but is not attached to its Airtable `Plan File` field.
4. The base currently has no `Floor Plan Geometry` table, so no clickable map shapes can be saved.
5. The 92 drawn desk positions have not been fully reconciled to the 64 existing workstation records.

Until the date problem is fixed, the extension can incorrectly make occupied desks look available and can make assigned people look as though they still need a workstation. Setup saying **Ready** means the required tables and fields are connected; it does not mean the record values are complete or trustworthy.

## What the extension is—and is not

### It is

- A date-aware workstation assignment interface.
- A friendlier operational view over existing Airtable records.
- A way to browse by floor and workspace area without exposing every facilities field.
- A guarded workflow for creating, moving, and ending individual assignments while preserving history.
- A diagnostics surface for structural and data-quality problems.
- An optional floor-plan mapping tool when plan files and geometry storage are configured.

### It is not

- A replacement for the Airtable base.
- A schema builder or migration tool.
- A key, card-access, asset, inventory, subscription, or facilities-request application.
- A bulk assignment/import tool.
- A source for People or Space records.
- A system that automatically creates missing desks from a drawing.
- A fully released production extension yet.

## System boundaries

| System | Authoritative for | Notes |
|---|---|---|
| **Airtable** | People, physical Spaces, organizational links, terms, assignments and history, plan metadata, and eventually plan geometry | Live operational source of truth |
| **This GitHub repository** | Extension code, tests, technical documentation, and approved source-plan files | Product/development source of truth |
| **Controlled ChatGPT reference files/datasets** | Policies, glossary, schema explanation, naming rules, SOPs, decision log, and approved static references | Explanatory context only unless a deliberate dated snapshot is supplied |
| **Supported and approved live connection to Airtable, if available** | Current records for ChatGPT-assisted work, subject to source permissions | Prefer read-only, least-privileged access over repeatedly uploading full exports when current data is needed |

Uploading an Airtable export to a ChatGPT dataset does not make that dataset part of this extension. The extension reads the Airtable base directly through the Airtable Extensions SDK.

For structure-planning work, any future ChatGPT-to-Airtable connection should start read-only and allowlist only the necessary tables, fields, and views. Do not expose keys, card access, restricted notes, or person-to-desk history through that connection unless each category is separately authorized.

## Physical-space model

The agreed model and the simplified user interface are intentionally different:

```text
Data model:    Building → Floor → Zone → optional Room → Workstation
Extension UI:             Floor → Workspace area       → Workstation
```

Every physical level is a record in the existing `Spaces` table. The hierarchy is created with the self-linked `Parent Space` field; a separate Zones table is not needed.

- **Building** remains useful internal metadata and a parent record, but it is hidden from normal extension navigation.
- **Floor** is the first selector shown to the user.
- **Zone** is one value in Airtable's `Space Type` field; the extension labels those records **Workspace area**.
- **Room** is optional. Use it only when a workstation is physically inside a meaningful room.
- **Workstation** is the extension label for a `Desk / Workstation` Space.
- A workstation can link directly to a Zone in an open studio.
- A Zone's `Managing Program / Unit` link is interpreted as its **Area owner**. Descendants inherit that owner at runtime; ownership is not copied onto every child record.

Person affiliation and workspace-area ownership are different concepts. A person's `Primary Program / Unit` describes their affiliation; a Zone's `Managing Program / Unit` describes who owns or manages that area.

### Terminology crosswalk

| Airtable/data term | Extension label | Meaning |
|---|---|---|
| `Zone` | **Workspace area** | A meaningful cluster of workstations or rooms |
| `Managing Program / Unit` | **Area owner** | Organizational owner of a Zone |
| `Desk / Workstation` | **Workstation** | A capacity-consuming assignable place |
| `Primary Program / Unit` | **Affiliation** | A person's main organizational affiliation |
| `Programs & Units` | **Organizational areas** in explanatory text | Current table name; final base terminology is still undecided |

## Current extension screens

### Workspaces

The primary operational screen:

- Selects a **Floor** and **Workspace area**.
- Defaults to the first floor that contains active workstations; currently that is Level 2.
- Shows only Zones containing active workstations, plus an unzoned group when needed.
- Selects a view date or an inclusive availability range.
- Can apply an Academic Term's dates when valid term dates exist.
- Searches mapped person and space identifiers and hierarchy names.
- Shows metrics for Workstations, Assigned now, Available, Starting later, Over capacity, and Not on plan.
- Opens a workstation detail panel with current/future assignments and history.
- Supports individual assign, move, and end actions when the user has permission.
- Prints a floor roster.
- Shows a selectable workstation list when no usable visual plan is available.

The normal UI deliberately omits a Building selector, Preferred Name, and Role/Title.

### Needs workspace

This screen lists active people whose `Person Type` is selected in Setup and who lack an active, dated, capacity-consuming workstation assignment on the selected date.

- An empty Person Type selection means the queue is intentionally off.
- The latest observed configuration showed no Person Types selected; confirm this in Setup because the value is stored in extension configuration rather than in a normal Airtable table.
- The live Person Type choices are `Staff`, `Faculty`, `Student`, `Contractor`, and `Other`.
- Current records use only `Student` and `Staff`.

Because the existing assignments have no Start Dates, the queue cannot currently determine that those assignments are active.

### Diagnostics

Diagnostics are read-only and include:

- Duplicate mapped Space IDs, Person IDs, and emails.
- Assignments missing a Person, Space, or Start Date.
- Invalid date order.
- Overlapping capacity-consuming assignments.
- Missing/deleted hierarchy parents, cross-floor links, and cycles.
- Workstations outside the supported Zone/optional-Room hierarchy.
- Zones with no owner.
- Missing plan attachments.
- Geometry linked to deleted plans or Spaces.
- Active assignable Spaces that have not been placed on a plan.

Some checks are only available when the corresponding optional field is mapped. The current People table has no `Person ID` or `Email` field, so duplicate-ID/email diagnostics and those search paths have no data to inspect.

### Setup

Setup was deliberately simplified. The normal screen now contains:

1. A single readiness summary.
2. Buttons for choosing which Person Types should appear in **Needs workspace**.
3. A two-row connection summary for operational data and the optional map.
4. A collapsed **Advanced connections** section for table/field troubleshooting and assignment rules.

Setup automatically discovers likely table and field names, then saves stable Airtable IDs in extension `globalConfig` under:

```text
sodsSpaceManager.schema.v1
sodsSpaceManager.rules.v1
```

Renaming a mapped field normally does not break the extension because its Airtable ID remains stable. Deleting or replacing a field does require remapping.

Setup never creates, renames, or deletes Airtable tables or fields.

## Current Airtable configuration

### Technical identifiers

| Item | Current value |
|---|---|
| Base | `template_SoDS Facilities & Access Manager` |
| Base ID | `appr3HkHrFMEyePyN` |
| Extension name | `SDS Space Manager` / SoDS Space Manager |
| Block ID | `blkyXmfJYFXj8cJwa` |
| Repository | `tacocloudmin/airtable-seat-assignments` |

These IDs are useful for development and troubleshooting. Normal extension behavior should continue to use saved Airtable IDs rather than hard-coded display names.

### Tables used directly by the extension

| Role | Airtable table | Table ID | Current records | Status |
|---|---|---|---:|---|
| Required | `Spaces` | `tbl9Tnn3AiRA4MEkI` | 129 | Connected |
| Required | `People` | `tblcaIny2Hjzjf3lV` | 54 | Connected |
| Required | `Space Assignments & Stewardship` | `tblKHq2ZiWkY0vZ9U` | 65 | Connected, but dates are missing |
| Required | `Academic Terms` | `tblJ9Yl8XUBxDmYGL` | 1 | Connected, but term dates are missing |
| Required | `Programs & Units` | `tblQbuUFcd5nyo3EI` | 9 | Connected |
| Optional | `Floor Plans` | `tbleh5yFAuV2KUsbp` | 2 | Connected; active plan lacks attachment |
| Optional | `Floor Plan Geometry` | Not present | 0 | Must be created/mapped before clickable geometry can be saved |

The base also contains access, key, asset, inventory, software, subscription, and facilities-request tables. Those remain separate specialist systems. The extension does not currently load or modify their detailed records.

### What is required versus optional

At minimum, Setup currently requires mappings for:

- `Spaces`: Space Name and Active?
- `People`: Full Name
- `Space Assignments & Stewardship`: Person, Space, Relationship Type, Start Date, Expected End Date, and Actual End Date
- `Academic Terms`: Term Name, Start Date, and End Date
- `Programs & Units`: organizational-area name

`Floor Plans` and `Floor Plan Geometry` are optional so staff can use the workstation list before visual mapping is complete.

### Current fallback behavior

The live base does not have dedicated `Assignable?`, `Assignment Mode`, or `Assignment Capacity` fields mapped on Spaces. Therefore the extension currently:

- Treats only Space Types recognized as Desk/Workstation as assignable.
- Treats each such workstation as exclusive.
- Uses an assignment capacity of 1.
- Ignores legal, CLSS, EMS, event, and other unrelated capacity fields.

There is also no confirmed `Consumes Capacity?` field on the assignment table. Capacity is therefore determined by configured Relationship Type names. The default capacity list includes `Occupant` and `Primary Desk Holder`; `Steward`, `Manager`, `Responsible Party`, and `Owner` are always non-capacity relationships.

## Verified live-data snapshot

### Spaces

There are 129 Space records:

| Space Type | Count |
|---|---:|
| Building | 1 |
| Floor | 2 |
| Zone | 26 |
| Room | 30 |
| Desk / Workstation | 64 |
| Cabinet | 1 |
| Shelf | 4 |
| Storage Area | 1 |

By Level, there are 32 records on Level 1, 96 on Level 2, and the Building record has no Level. All 64 workstations are on Level 2.

Current workstation grouping:

| Parent workspace area | Existing workstations | Stable-ID pattern |
|---|---:|---|
| MDes Student Workspace Area | 50 | `SPC-KI-MDES-D###` |
| PhD Student Workspace Area | 14 | `SPC-KI-PHD-D###` |

Level 1 currently has no workstations. It should not be used as the default assignment floor merely because it appears first alphabetically.

### People

There are 54 active People records:

| Person Type currently in use | Count |
|---|---:|
| Student | 49 |
| Staff | 5 |

The extension uses Full Name, Person Type, status, affiliation, and expected end/graduation information when mapped. Preferred Name and Role/Title are intentionally not used in the extension UI.

### Programs & Units

Nine active organizational records currently exist:

- School of Design & Society
- SoDS Administration
- Institute of Design
- Interprofessional Projects (IPRO)
- Master of Design (MDes)
- PhD in Design
- Shared SoDS Operations
- Kaplan Institute Facilities & Operations
- Idea Shop & Maker Space Operations

The table is technically named `Programs & Units`, but these records mix a School, academic programs, administrative units, shared services, and facility operations. That is why the extension uses neutral labels such as **Affiliation**, **Workspace area**, and **Area owner**. Whether the Airtable table itself should be renamed is still an information-architecture decision.

### Academic Terms

One active term exists: `Fall 2026` (`2026FA`). Its `Start Date` and `End Date` cells are both blank.

The fields are mapped, so schema Setup can report them as connected. The term is not operationally usable until authoritative dates are entered.

### Assignments and stewardship

There are 65 relationship records:

| Relationship Type | Count | Capacity behavior |
|---|---:|---|
| Primary Desk Holder | 49 | Capacity-consuming by default |
| Occupant | 4 | Capacity-consuming by default |
| Steward | 12 | Never consumes workstation capacity |

All 65 records have a Person and a Space. All 65 have `Current?` checked. However:

| Date completeness | Count |
|---|---:|
| Has Start Date | 0 |
| Has Expected End Date | 0 |
| Has Actual End Date | 0 |

This is the most important current data-quality issue.

The extension intentionally does not use `Current?` to calculate occupancy. It uses:

```text
Start Date through Actual End Date,
otherwise Start Date through Expected End Date,
otherwise Start Date with no end.
```

Date boundaries are inclusive. An assignment without a Start Date has no calculable time range, is flagged by Diagnostics, and cannot safely count as current occupancy. Dates must come from an authoritative term, onboarding source, or reviewed migration record; they must not be invented.

## Floor-plan status

Both PDFs in the repository depict **Kaplan Level 2**. Neither should be configured as a first-floor plan.

The links below are repository-relative. Uploading this Markdown file alone will not give another ChatGPT access to the PDFs, especially when the repository is private. If the receiving ChatGPT needs to inspect the drawings, provide approved repository access or upload the files separately after confirming the workspace's facilities-security permissions.

### Numbered assignment plan

- Repository file: [`assets/floor-plans/Kaplan Numbered Floor Plan.pdf`](../assets/floor-plans/Kaplan%20Numbered%20Floor%20Plan.pdf)
- Airtable record: `Kaplan Institute - Second Floor - Numbered Assignment Plan`
- Stable plan ID: `KI-L2-NUMBERED-2018`
- Role: primary assignment and workstation-numbering reference
- Airtable state: active
- Airtable `Plan File`: currently empty; the correct PDF still needs to be uploaded

The plan shows 92 numbered positions:

- Student desks 1–72
- Faculty/PhD desks 1–20

The numbering restarts between populations, so a bare number such as “Desk 1” is not unique.

### AutoCAD named-room reference

- Repository file: [`assets/floor-plans/KI New Floorplan.pdf`](../assets/floor-plans/KI%20New%20Floorplan.pdf)
- Airtable record: `Kaplan Institute - Second Floor - AutoCAD Named-Room Reference`
- Stable plan ID: `KI-L2-AUTOCAD-REFERENCE-2019`
- Role: reference for names, room boundaries, and physical context
- Airtable state: inactive/reference
- Airtable `Plan File`: attached

Although wording embedded in the source PDF refers to a first floor, the facilities owner confirmed that both supplied plans represent the operational second floor. The Airtable records are therefore intentionally configured as Level 2.

### Plan-to-inventory reconciliation

The current Airtable inventory contains 64 numbered workstation records whose numbering appears to correspond to 64 of the 92 drawn positions, pending physical and semantic reconciliation:

- MDes: numbers 7–64 except 39–46, for 50 records
- PhD: numbers 7–20, for 14 records

The apparent gaps total 28 positions:

- Student/MDes candidates: 1–6, 39–46, and 65–72 = 22
- Faculty/PhD candidates: 1–6 = 6

Do **not** automatically create these 28 Spaces. “Student” on the drawing has not yet been formally approved as equivalent to MDes, and “Faculty/PhD” has not yet been formally approved as equivalent to the current PhD inventory. First reconcile the drawing to the physical floor, agree on human-readable names, and approve canonical Space IDs.

### Geometry

No workstation geometry has been traced. More importantly, the live base currently has no `Floor Plan Geometry` table. The extension's map button remains disabled until both a plan attachment and a mapped geometry table are available.

When implemented, each geometry record should link one existing Space to one Floor Plan and store normalized point, rectangle, or polygon coordinates. Deleting a map shape should delete only its Geometry record, never the Space or assignment history.

## Read and write behavior

### Reads

The extension reads mapped Airtable records into an internal typed model, then calculates hierarchy, occupancy, availability, and diagnostics in the browser. It never treats an attachment URL as a durable identifier.

### Writes

With appropriate Airtable permissions, the extension can:

- Create one assignment relationship.
- End an assignment by setting its actual end date and related optional status fields.
- Move a person by creating a new destination assignment and closing the source assignment.
- Create or update floor-plan geometry records once that optional table exists.
- Delete a geometry record after confirmation.

Moves preserve history; they do not overwrite the original assignment's Space link.

### Things it does not write

- People
- Spaces or missing workstations
- Programs/organizational areas
- Academic Terms
- Floor Plan records or attachments
- Airtable tables or fields
- Keys, access, assets, software, subscriptions, or facilities requests

Read-only users retain browsing, search, history, availability, diagnostics, and printing. Write controls are disabled or rejected through Airtable permission checks.

## Testing status

The repository currently has automated coverage for schema discovery, hierarchy behavior, date/capacity/conflict logic, guarded writes, geometry calculations, diagnostics, and setup UI. The current branch has passed TypeScript checking, linting, the test suite, and a production bundle build.

That verifies implementation behavior; it does not certify the live records.

### Safe test sequence

1. Test against a copy of `template_SoDS Facilities & Access Manager`.
2. Enter authoritative start/end dates for a small reviewed sample of assignments and at least one Academic Term.
3. Confirm Diagnostics catches the remaining undated records.
4. Select the intended Person Types under **Needs workspace**—probably `Student` for the first pilot, but this is a policy decision.
5. Upload the correct numbered Level 2 PDF to the active Floor Plan record.
6. Create and map a `Floor Plan Geometry` table matching the documented schema.
7. Trace a small pilot area and validate overlay alignment in Airtable before mapping the full floor.
8. Test assign, end, and move with disposable test records and confirm history is preserved.
9. Reconcile availability counts with a manual roster before production use.

### Current status statement

> The extension is ready for controlled testing against a copy of the base, but the workspace data is not production-ready. The main blockers are authoritative assignment dates, Academic Term dates, the missing numbered-plan attachment, the missing Floor Plan Geometry table, plan-to-inventory reconciliation, and pilot geometry validation.

### Known implementation caveats to test explicitly

- A new assignment currently defaults to Relationship Type `Occupant`, while most live desk records use `Primary Desk Holder`. Agree on the intended default before production testing.
- The end-assignment prompt does not yet validate date format or prevent an end date before the assignment's start date before writing.
- A full exclusive workstation blocks a new assignment. A configured shared space at capacity currently produces a warning rather than a blocking error.
- Diagnostics currently treats any overlapping capacity-consuming relationships on one Space as an error, even if a future shared-space capacity would allow them.
- Read-only mode is inferred from assignment-create permission; a user with different assignment-versus-geometry permissions may see confusing map controls until separate permission handling is added.
- Active Floor Plans are matched by Level, not Building. That is acceptable for the current single-building workflow but would be ambiguous if multiple buildings later use the same level names.
- PDF display uses the browser's embedded PDF viewer, so exact overlay alignment must be validated inside Airtable.
- There is no bulk assign/move/end flow or dedicated extend action in the current version.

## Recommended ChatGPT workspace and dataset structure

Use this rule of thumb:

> If it changes day-to-day operations or identifies a person, keep it live in Airtable. If it defines the extension, keep it in GitHub. If it explains the system and changes slowly, it may belong in a reference dataset.

### Keep in approved operational systems

- People and identifiers
- Person Type, status, and affiliation
- Authoritative Spaces hierarchy
- Assignment start/end dates and history
- Academic Terms used operationally
- Area ownership/stewardship links
- Floor Plan records and Floor Plan Geometry
- Keys, card access, assets, inventory, and facilities requests, currently represented by separately scoped Airtable tables
- Restricted notes, under separate access controls

Do not maintain an editable copy of these records in ChatGPT as a second source of truth. Keeping sensitive specialist data in Airtable does not by itself make broad access safe; retain separate permissions and limit each user or integration to its business need.

### Keep in GitHub

- Extension source code and tests
- Technical documentation
- Sanitized fixtures only
- Implemented schema expectations and naming behavior
- Approved floor-plan source files, subject to facilities/security review and repository-membership policy
- This handoff document

Never commit live Airtable exports, People data, credentials, temporary authenticated URLs, or restricted facilities details.

Floor plans can remain recoverable from Git history even after deletion from the current branch. Confirm the permitted audience before committing a plan; if a committed plan later proves sensitive, ordinary file deletion is not sufficient remediation.

### Good reference-dataset candidates

A small collection is better than a dump of the entire base:

1. **Facilities schema and glossary**
   - Table purposes
   - Field definitions
   - Hierarchy rules
   - Terminology crosswalk
   - Stable-ID conventions

2. **Workspace-assignment policy and SOP**
   - Who normally needs a workstation
   - Which relationship types consume capacity
   - Start/end-date policy
   - Assign, move, end, exception, and audit procedures

3. **Extension guide**
   - What each screen does
   - What Setup means
   - Write boundaries
   - Troubleshooting and testing steps

4. **Decision log**
   - Settled terminology
   - Approved hierarchy
   - Plan-to-Space crosswalk decisions
   - Owners and review dates

5. **Approved floor-plan references**
   - Only after checking facilities/security sensitivity and audience permissions
   - Include revision notes and a clear primary/reference designation

6. **Blank migration and reconciliation templates**
   - No real People data
   - Explicit columns for source, confidence, reviewer, and resolution

### Suitable aggregated or privacy-reviewed snapshots

If the other ChatGPT needs quantitative context, provide reviewed aggregate exports such as:

- Workstation counts by floor and workspace area
- Aggregate occupancy/availability by term
- Data-quality issue counts
- A sanitized Space catalog without restricted notes
- Assignment trends with no direct identifiers and no tiny groups that can be re-identified

Removing names is not automatically de-identification. Exact dates, stable Space IDs, rare areas, small cohorts, and location history can still identify people. Apply an institution-approved privacy review and small-cell threshold before upload.

Every snapshot should include:

- Source base/table/view
- Extraction date and time
- “As of” date
- Row count
- Schema version
- Redactions applied
- Sensitivity classification
- Approved destination audience
- Owner
- Version and any snapshot it supersedes
- Review/expiration date
- Retention, archival, or deletion date

Use a one-way flow:

```text
Airtable → reviewed and redacted export → ChatGPT dataset
```

Do not write AI-edited snapshot data back to Airtable without human review.

Only one snapshot in a series should be labeled current. Archive or delete superseded copies according to the approved retention rule so ChatGPT cannot silently mix conflicting versions.

An uploaded export does not retain Airtable's row, field, view, or source-system access controls. Before upload, review the destination workspace/project audience, sharing settings, retention policy, and deletion path.

### Never put in a general reference dataset

- Airtable or GitHub personal access tokens
- API keys, OAuth secrets, cookies, or authenticated URLs
- Raw unrestricted Airtable backups
- Names, emails, school IDs, or person-to-desk assignment history
- Key numbers, card-access details, or security procedures
- Restricted internal notes
- Accommodation, HR, or student-sensitive information
- Security-sensitive floor-plan annotations
- A static copy of live Spaces presented as current without an explicit refresh/version policy

OpenAI's current product guidance says ChatGPT Work can use uploaded files, workspace resources, and approved connected systems, with access depending on workspace and source-system permissions. That supports using durable files for reference context and a permissioned live source for current records, but the exact governance still needs to match the School's plan and admin settings. See [ChatGPT Work admin FAQ](https://learn.chatgpt.com/docs/enterprise/work-admin-faq) and [Get started with ChatGPT Work](https://learn.chatgpt.com/docs/get-started-with-work).

## Decisions the next ChatGPT should help finalize

Treat these as open questions, not settled facts:

1. Is **Workspace area** the approved user-facing term while `Zone` remains the underlying Space Type?
2. Should Airtable's `Programs & Units` table and `Managing Program / Unit` field be renamed, or should only the extension use friendlier labels?
3. Can a Zone have multiple owners, or exactly one Area owner?
4. Are the drawing's Student positions truly the MDes inventory, and are Faculty/PhD positions truly the PhD inventory?
5. Which of the 28 apparent plan gaps are real workstations today?
6. What final names and stable IDs should any confirmed new workstations receive?
7. Which Person Types belong in **Needs workspace**: Student only, or also Faculty, Staff, Contractor, or Other?
8. Which Relationship Types consume workstation capacity?
9. Would an explicit `Consumes Capacity?` field be clearer than a configured list of relationship names?
10. What is the authoritative source and remediation policy for missing assignment Start Dates?
11. Should expected ends follow Academic Terms, remain indefinite, or use another lifecycle rule?
12. Are dedicated `Assignable?`, `Assignment Mode`, and `Assignment Capacity` fields worth adding?
13. Who will upload the numbered plan, create the Geometry table, approve a pilot trace, and validate overlay alignment?
14. Should Building remain hidden-but-retained metadata, as currently recommended?
15. Which base tables and fields should be visible to ChatGPT through any approved live connector?

## Source priority for future work

When sources disagree, use this order unless the facilities owner explicitly changes it:

1. Reviewed live Airtable records for operational state.
2. Approved facilities-owner decisions and documented policy.
3. The numbered Level 2 plan for workstation numbering and assignment geometry.
4. The AutoCAD-derived Level 2 plan for room names and physical boundaries.
5. Repository documentation and code for extension behavior.
6. Historical/legacy source tables only as migration evidence requiring review.

Never infer missing dates, merge people solely by a name match, or create Spaces solely because a number appears on a drawing.

## Repository reference

The current implementation lives at:

```text
https://github.com/tacocloudmin/airtable-seat-assignments
```

Important paths:

```text
src/App.tsx                         primary UI and screen behavior
src/components/SetupWizard.tsx    simplified setup experience
src/config/schema.ts               auto-discovery and saved mapping rules
src/services/assignmentEngine.ts  date, capacity, availability, and conflict logic
src/services/spaceHierarchy.ts    hierarchy and inherited-location behavior
src/services/diagnostics.ts       read-only diagnostic rules
src/services/airtable/writes.ts   guarded assignment and geometry writes
assets/floor-plans/               two Kaplan Level 2 source PDFs
docs/                              handoff and future operational documentation
```

The old wedding-seating prototype is retained only under `legacy/wedding/` and is not the running facilities extension.

---

### Suggested instruction to the next ChatGPT

> Use this document as a verified current-state handoff, not as permission to mutate Airtable. Help design a simpler overall workspace and dataset structure while preserving Airtable as the live operational source of truth. Separate confirmed facts from recommendations, keep People/assignment/access data out of static datasets, and do not propose creating the 28 apparent missing workstations until the plan-to-inventory crosswalk and canonical IDs are approved.
