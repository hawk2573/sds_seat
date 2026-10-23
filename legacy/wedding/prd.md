# Wedding Seating Plan — Product Requirements Document

**Customer:** Wedding Seating
**Project:** wedding-seating
**Consultant:** Noam
**Created:** 2026-04-10
**Last Updated:** 2026-04-10
**Status:** Approved

---

## 1. Extension Overview

| Item | Detail |
|------|--------|
| Extension Name | Wedding Seating Plan |
| Customer | Wedding Seating |
| Purpose | Visual seating chart for a wedding — drag & drop guests onto numbered seats across 10 round tables. |
| Target Users | Wedding planner / couple organizing the seating (1–3 users) |
| Base | Wedding Seating (`apphKq7PuzI3NPWbA`) |
| Trigger | User opens the Seating Plan interface to arrange guests before the event. |

### Background

Organizing 80 guests across 10 round tables of 8 is painful in a spreadsheet — you can't see who sits next to whom, which VIPs are scattered where, or which seats are still free. Native Airtable views show records as rows, not as a physical room layout. This extension gives the couple a visual, draggable seating chart rendered as round tables with numbered seats, so they can iterate on the plan and spot problems at a glance.

---

## 2. Functional Requirements

### 2.1 Visual Seating Grid

**Priority:** Must Have

Display 10 round tables arranged in a grid. Each table shows its number (1–10) and 8 seats arranged in a circle around the table. Seats are numbered 1–8.

**User Story:** As a wedding planner, I want to see all 10 tables and their 80 seats at once, so that I can visually assess the full seating plan.

**Details:**
- Tables rendered as circles in a responsive grid (e.g., 5 × 2 or 4 × 3 depending on viewport)
- Each table shows its table number (1–10) in the center
- 8 seats positioned around the circumference of each table, numbered 1–8
- Seat number is always visible
- Layout is stable — tables don't reflow unexpectedly when a seat is updated

**Data Sources:**

| Table | Fields Used | Field IDs | Access |
|-------|------------|-----------|--------|
| Guests | Table Number | `fldCfCAjmivLZwi5A` | Read |
| Guests | Seat Number | `fldW3PFejW2L6hAGq` | Read |

---

### 2.2 Occupied Seat Display (Photo + Name)

**Priority:** Must Have

When a seat is occupied (a guest has that Table Number + Seat Number), show the guest's photo and name on the seat.

**User Story:** As a wedding planner, I want to see each guest's face and name on their assigned seat, so that I can recognize who is sitting where without reading a list.

**Details:**
- Occupied seats display the guest photo as a circular thumbnail
- Guest name displayed below or next to the photo (truncated if too long)
- If the guest has no photo, show a placeholder (initials on a colored circle)
- Clicking an occupied seat could optionally show more guest details (meal preference, notes) — nice to have

**Data Sources:**

| Table | Fields Used | Field IDs | Access |
|-------|------------|-----------|--------|
| Guests | Name | `fldFQgQcYILPPl9PU` | Read |
| Guests | Photo | `fldbpeTmvrNcHLIum` | Read |
| Guests | Table Number | `fldCfCAjmivLZwi5A` | Read |
| Guests | Seat Number | `fldW3PFejW2L6hAGq` | Read |

---

### 2.3 Empty Seat Indication

**Priority:** Must Have

Seats that are not assigned to any guest are visually distinct (grayed out) but still visible, showing their seat number.

**User Story:** As a wedding planner, I want to see which seats are still available at each table, so that I can quickly spot where there is room.

**Details:**
- Empty seats rendered as gray/muted circles with the seat number inside
- Empty seats are still valid drop targets for drag & drop
- Visual distinction between occupied and empty is obvious at a glance

---

### 2.4 VIP Badge

**Priority:** Must Have

Seats occupied by a guest flagged as VIP display a visible VIP badge.

**User Story:** As a wedding planner, I want to spot VIP guests at a glance, so that I can make sure they are distributed appropriately and placed well.

**Details:**
- Small badge (e.g., gold star or "VIP" tag) overlaid on the seat
- Only shown when the guest's VIP checkbox field is true
- Does not obscure the photo or name

**Data Sources:**

| Table | Fields Used | Field IDs | Access |
|-------|------------|-----------|--------|
| Guests | VIP | `fldVIA859ng3LWB8T` | Read |

---

### 2.5 Drag & Drop Reassignment

**Priority:** Must Have

User can drag a guest from one seat to another. Dropping on an empty seat moves the guest there. Dropping on an occupied seat swaps the two guests.

**User Story:** As a wedding planner, I want to drag guests between seats to experiment with arrangements, so that I can iterate on the plan without editing fields manually.

**Details:**
- Click-and-hold on an occupied seat starts the drag
- While dragging, the source seat shows a "being moved" state (dimmed or ghosted)
- Hover highlights valid drop targets (empty seats + other occupied seats)
- Drop on an **empty seat**: guest's Table Number and Seat Number update to the new position
- Drop on an **occupied seat**: the two guests swap positions (both records are updated)
- Updates are written to Airtable via `updateRecordsAsync`
- Optimistic UI: the move is reflected immediately in the view, then confirmed by the API
- Works on desktop (mouse). Touch support is nice-to-have.

**Data Sources:**

| Table | Fields Used | Field IDs | Access |
|-------|------------|-----------|--------|
| Guests | Table Number | `fldCfCAjmivLZwi5A` | Read-Write |
| Guests | Seat Number | `fldW3PFejW2L6hAGq` | Read-Write |

---

## 3. Data Model

### Tables in Scope

| Table | Table ID | Role in Extension | Access Level |
|-------|----------|-------------------|-------------|
| Guests | `tbl7AorYDijc5NafK` | Primary data source — every guest and their seat assignment | Read-Write |

### Key Relationships

Flat table — no linked relationships. Table/Seat assignment is driven by two integer fields (`Table Number`, `Seat Number`) rather than linked records.

### Fields by Feature

| Feature | Table | Field | Field ID | Type | Usage |
|---------|-------|-------|----------|------|-------|
| 2.1 Grid layout | Guests | Table Number | `fldCfCAjmivLZwi5A` | number | Filter/group guests into tables |
| 2.1 Grid layout | Guests | Seat Number | `fldW3PFejW2L6hAGq` | number | Position within the table |
| 2.2 Occupied display | Guests | Name | `fldFQgQcYILPPl9PU` | singleLineText | Display |
| 2.2 Occupied display | Guests | Photo | `fldbpeTmvrNcHLIum` | multipleAttachments | Display (first attachment as avatar) |
| 2.4 VIP badge | Guests | VIP | `fldVIA859ng3LWB8T` | checkbox | Display (badge visibility) |
| 2.5 Drag & drop | Guests | Table Number | `fldCfCAjmivLZwi5A` | number | Edit on drop |
| 2.5 Drag & drop | Guests | Seat Number | `fldW3PFejW2L6hAGq` | number | Edit on drop |

*Not used in v1 but available for future:* Email, Company, Meal preference, Notes.

---

## 4. User Interface Specification

### Layout

Single full-width view — a grid of 10 round tables. Each table is a circular element with 8 seats positioned around its circumference. No tabs, no sidebar. The grid scrolls vertically if the viewport is short.

### Views

#### View 1: Seating Plan

**Purpose:** Arrange guests across 10 tables of 8 seats.
**Layout:** Responsive grid of circular tables (default: 5 columns × 2 rows on wide screens, 2 × 5 or 1 × 10 on narrow).

**Components:**
- **Header bar** — Extension title ("Seating Plan"), a small summary ("72 / 80 guests seated"), and a legend (occupied / empty / VIP).
- **Table grid** — 10 round tables, each labeled "Table N" in the center.
- **Seat circles** — 8 per table, numbered 1–8, positioned around the circumference. Each seat is either occupied (photo + name + optional VIP badge) or empty (gray with just the seat number).
- **Optional unassigned pool** — list of guests that have no Table Number assigned yet, available as drag sources. *Nice-to-have for v1.*

**Interactions:**
- Drag an occupied seat onto an empty seat → guest moves, Airtable updated.
- Drag an occupied seat onto another occupied seat → the two guests swap.
- Hover a seat → slight elevation / highlight to confirm it's a drop target.
- Click an occupied seat (optional) → small popover with full guest details (meal preference, notes, email).

### Navigation

Single view — no navigation needed.

### Design References

No design references provided. Using default wireframe style — visual design will be refined during code generation if needed. Natural fit would be a warm, elegant palette (soft creams, gold accents for VIP) but no customer direction yet.

### Responsive Behavior

Extension renders within the Airtable interface panel. Minimum width: 700px for a 2-column table grid. Below 700px, tables stack in a single column.

---

## 5. Technical Approach

### Architecture

- Single React component tree: `App` → `SeatingGrid` → `Table` × 10 → `Seat` × 8.
- Guest data loaded once via `useRecords()` on the Guests table with field limiting (`Name`, `Photo`, `VIP`, `Table Number`, `Seat Number`).
- Each `Table` component builds an 8-slot array, mapping guests by `Seat Number`. Empty slots render as placeholder seats.
- Seats rendered with absolute positioning on a circle using trigonometry (`left = 50% + R*cos(θ)`, `top = 50% + R*sin(θ)`) where θ steps by 45° for 8 seats.
- Drag & drop implemented with HTML5 Drag and Drop API (native, no extra dependency). Each occupied seat is `draggable`, each seat (empty or occupied) is a drop target.
- On drop, compute the new `Table Number` / `Seat Number` for the dragged guest (and for the displaced guest in a swap) and call `table.updateRecordsAsync([{ id, fields }, ...])`.

### Performance Considerations

- Dataset is tiny (≤80 records). No pagination, no virtualization needed.
- Field limiting keeps the `useRecords()` payload small and avoids re-renders when irrelevant fields change.
- Photo attachments: use the smallest thumbnail size Airtable provides to keep the grid light.

### SDK Hooks Planned

| SDK Hook | Usage |
|----------|-------|
| `useBase` | Access the base, get the Guests table by ID |
| `useRecords` | Load all guest records with field limiting |
| `useWatchable` | Not needed — `useRecords` already reactive |
| `table.updateRecordsAsync` | Write Table Number / Seat Number on drag-drop and swap |
| `useViewport` *(optional)* | Adapt grid columns to available width |

---

## 6. Constraints & Assumptions

- Fixed topology: exactly **10 tables** and **8 seats per table** (hardcoded for v1). If the customer later wants a variable number, we'll add a settings panel.
- Assumes every guest record has (or will have) valid `Table Number` (1–10) and `Seat Number` (1–8) once placed. Guests with no assignment are not shown on any table in v1. *[Assumed — confirm with customer]*
- Dataset is small (~80 guests max). No performance tuning required.
- Desktop-first. Drag & drop on touch devices is nice-to-have, not required. *[Assumed — confirm with customer]*
- All users have edit access to the Guests table.
- No external API integrations required.

---

## 7. Acceptance Criteria

| # | Criterion | Feature | Expected Result |
|---|-----------|---------|-----------------|
| AC-1 | User sees 10 round tables in a grid | §2.1 | Extension displays exactly 10 numbered tables, each with 8 numbered seats |
| AC-2 | Seat numbers 1–8 are visible on every table | §2.1 | Each of the 8 seat positions shows its number |
| AC-3 | Occupied seats show guest photo and name | §2.2 | A guest with Table=3, Seat=5 appears at position 5 of table 3 with their photo and name |
| AC-4 | Guests with no photo show a placeholder | §2.2 | Seat shows a colored circle with initials instead of breaking |
| AC-5 | Empty seats are visually distinct | §2.3 | Empty seats appear gray/muted but still show the seat number |
| AC-6 | VIP guests show a badge | §2.4 | Any seat where the guest's VIP checkbox is true shows a visible VIP indicator |
| AC-7 | Dragging to an empty seat moves the guest | §2.5 | Drag guest from Table 1 Seat 2 to Table 4 Seat 7 → guest record updated to Table=4, Seat=7 |
| AC-8 | Dragging to an occupied seat swaps guests | §2.5 | Drag guest A onto guest B → both records updated, positions swapped |
| AC-9 | Changes persist in Airtable | §2.5 | After a drop, the new assignment is visible when refreshing the extension or opening the record |
| AC-10 | Performance acceptable | Performance | Initial load under 3 seconds; drag response under 500ms |

---

## 8. Sign-Off Record

| Item | Detail |
|------|--------|
| Approved By | Consultant confirmed |
| Approval Date | 2026-04-10 |
| Delivery Consultant | Noam |
| Approval Method | Consultant confirmed |
| Mockup URL | mockups/mockup.html |
| Notes | — |

---

## 9. Revision History

| Date | Changes | Source |
|------|---------|--------|
| 2026-04-10 | Initial draft | Requirements gathering (Noam) |
