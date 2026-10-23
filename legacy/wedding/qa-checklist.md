# Wedding Seating Plan — QA Checklist (Archival Record)

**Customer:** Wedding Seating
**Project:** wedding-seating
**Generated:** 2026-04-10
**Source of test cases:** prd.md §7 (Acceptance Criteria) + §2 Functional Requirements + §6 Constraints

**Total tests:** 25 (3 smoke + 10 functional + 4 data integrity + 4 edge cases + 3 error handling + 2 performance + 3 navigation/layout)

---

## Pre-flight Setup

Before running any test, verify:

1. **Interface page permission** — the Airtable Interface page that hosts the extension has `Edit records inline: Enabled` for the **Places** table. Without this, drag & drop is read-only (hard block).
2. **Dev server running** — `block run` from `wedding_seating_plan/` directory.
3. **Custom properties configured** — Places table + Table/Seat/Guest fields + Guests table + Name/Photo/VIP fields. Verify via the properties panel in the Interface editor.

---

## Smoke Tests

| ID | Name | Source | Status | Notes |
|----|------|--------|--------|-------|
| SMOKE-1 | Extension loads and shows 10 round tables in a grid | AC-1 | ⬜ Pending | |
| SMOKE-2 | Seated guests display with photo or initials + name | AC-3 | ⬜ Pending | |
| SMOKE-3 | Drag a guest to an empty seat moves them and persists | AC-7 + AC-9 | ⬜ Pending | |

---

## Functional

| ID | Name | Priority | Source | Status | Notes |
|----|------|----------|--------|--------|-------|
| TC-1 | 10 tables displayed in grid | Must | AC-1 | ⬜ Pending | |
| TC-2 | Seat numbers 1–8 visible on every table | Must | AC-2 | ⬜ Pending | |
| TC-3 | Occupied seat shows photo/initials + name | Must | AC-3 | ⬜ Pending | |
| TC-4 | Placeholder avatar for guests without photo | Should | AC-4 | ⬜ Pending | |
| TC-5 | Empty seats visually distinct | Must | AC-5 | ⬜ Pending | |
| TC-6 | VIP badge on VIP guests | Must | AC-6 | ⬜ Pending | |
| TC-7 | Drag to empty seat moves the guest | Must | AC-7 | ⬜ Pending | |
| TC-8 | Drag to occupied seat swaps the two guests | Must | AC-8 | ⬜ Pending | |
| TC-9 | Stats header updates after drag | Should | §2 | ⬜ Pending | |
| TC-10 | Responsive grid columns | Should | §2.1 | ⬜ Pending | |

## Data Integrity

| ID | Name | Priority | Source | Status | Notes |
|----|------|----------|--------|--------|-------|
| DI-1 | Drag-move persists to Airtable | Must | AC-9 | ⬜ Pending | |
| DI-2 | Swap persists both records | Must | AC-8 | ⬜ Pending | |
| DI-3 | Page reload shows the persisted state | Must | §5 | ⬜ Pending | |
| DI-4 | External change in Airtable reflects in extension | Should | §5 | ⬜ Pending | |

## Edge Cases

| ID | Name | Priority | Source | Status | Notes |
|----|------|----------|--------|--------|-------|
| EC-1 | Guest with no Place assignment is hidden | Should | §6 | ⬜ Pending | |
| EC-2 | Place outside grid is hidden | Should | §6 | ⬜ Pending | |
| EC-3 | Dragging onto itself does nothing | Must | §2 | ⬜ Pending | |
| EC-4 | Configure number of tables via custom property | Should | §2 | ⬜ Pending | |

## Error Handling

| ID | Name | Priority | Source | Status | Notes |
|----|------|----------|--------|--------|-------|
| ER-1 | Read-only mode when interface page disables inline editing | Must | §6 | ⬜ Pending | |
| ER-2 | Missing custom property shows config screen | Must | §5 | ⬜ Pending | |
| ER-3 | Browser console shows no errors during normal use | Should | §6 | ⬜ Pending | |

## Performance

| ID | Name | Priority | Source | Status | Notes |
|----|------|----------|--------|--------|-------|
| PF-1 | Initial load under 3 seconds | Should | AC-10 | ⬜ Pending | |
| PF-2 | Drag response under 500ms | Should | AC-10 | ⬜ Pending | |

## Navigation & Layout

| ID | Name | Priority | Source | Status | Notes |
|----|------|----------|--------|--------|-------|
| NV-1 | Header shows Seated count + VIP count + legend | Should | §4 | ⬜ Pending | |
| NV-2 | Dark mode support | Should | §4 | ⬜ Pending | |
| NV-3 | Tables fill the full available width | Should | §4 | ⬜ Pending | |

---

## Results Summary

**Will be updated after the consultant completes the interactive checklist.**

- Passed: —
- Failed: —
- Skipped: —
- Known issues: —
