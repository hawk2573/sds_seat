# Wedding Seating Plan

> A visual, drag-and-drop seating chart for a wedding — 10 round tables of 8 seats each, rendered as circular layouts with guest avatars, VIP badges, and instant persistence to Airtable.

**Built for:** Wedding Seating
**Airtable Base:** Wedding Seating (`apphKq7PuzI3NPWbA`)
**Last Updated:** 2026-04-10

---

## Features

- **Visual seating grid** — 10 round tables rendered as circles with 8 numbered seats positioned around each table's circumference. Grid is responsive (1 to 4 columns depending on viewport).
- **Occupied seat display** — each guest appears as a circular avatar (photo from Airtable or auto-generated colored initials) with their first name below and a seat-number badge.
- **Empty seat indication** — unassigned seats are shown as dashed gray circles with their seat number clearly visible, and act as valid drop targets.
- **VIP badge** — a yellow star badge is overlaid on the avatar for guests flagged as VIP in the Guests table.
- **Drag & drop reassignment** — guests can be dragged between seats. Dropping on an empty seat moves them; dropping on another occupied seat swaps the two guests. Both records update atomically via `updateRecordsAsync`.
- **Configurable grid size** — number of tables (4 to 20) and seats per table (4 to 12) exposed as custom properties, editable by the interface builder.
- **Dark mode** — follows the user's system color scheme.

---

## Data Model

The extension uses a **junction table pattern**. Seating is modeled as a separate `Places` table rather than with fields on `Guests` directly — each seat is a first-class record.

### `Guests`
Holds guest metadata (name, photo, email, company, meal preference, VIP flag, notes). The extension only reads from this table.

### `Places`
Seed this table with one record per physical seat. For a 10×8 layout, insert 80 records at setup.

| Field | Type | Purpose |
|-------|------|---------|
| `Place Label` | Single line text | Primary field, e.g. `T01-S3` |
| `Table Number` | Number (integer) | 1…N |
| `Seat Number` | Number (integer) | 1…N |
| `Guest` | Linked record → Guests | 0 or 1 guest per place |

Drag & drop updates the `Guest` link field on the target and source `Places` records — never the guest record itself.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [Airtable CLI](https://www.npmjs.com/package/@airtable/blocks-cli) — install with `npm install -g @airtable/blocks-cli`
- An Airtable Personal Access Token with `block:manage` scope (create one at [airtable.com/create/tokens](https://airtable.com/create/tokens))

### Local Development

1. Unzip the project folder and open it in your terminal:
   ```bash
   cd wedding_seating_plan
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Register your API key (first time only):
   ```bash
   block set-api-key
   ```
   Paste your Personal Access Token when prompted.

4. Start the development server:
   ```bash
   block run
   ```
   The dev server runs at `https://localhost:9000` with a self-signed certificate (expected — Chrome will warn but you can proceed).

5. In Airtable, open the Interface page that hosts the extension and enable **Development mode** to load the local version.

### Important — Interface page permissions

The Places table must have **Edit records inline: Enabled** on the Interface page hosting the extension. Otherwise drag & drop is read-only (the extension shows "Read-only — you do not have permission to edit seat assignments").

To enable:
1. Open the Interface in edit mode
2. Select the page containing the extension
3. In the settings panel, find the Places table
4. Set `Edit records inline` to `Enabled`

---

## Publishing Updates

To publish a new version to the Airtable workspace:

```bash
block release
```

Enter a release message when prompted (e.g., `v1.1 — Added date filter`). The update is live for all workspace users immediately and replaces the previous version.

---

## Configuration

Once the extension is loaded in an Interface page, open its properties panel to configure:

| Property | Type | Default |
|----------|------|---------|
| Places table | Table | `Places` |
| Place — table number | Field | `Table Number` |
| Place — seat number | Field | `Seat Number` |
| Place — linked guest | Field | `Guest` |
| Guests table | Table | `Guests` |
| Guest — name | Field | `Name` |
| Guest — photo | Field | `Photo` |
| Guest — VIP | Field | `VIP` |
| Number of tables | Enum | `10 tables` |
| Seats per table | Enum | `8 seats` |

The defaults reference the tables and fields in the original Wedding Seating base. If you deploy the extension in a different base, override them via the properties panel — **no code changes needed**.

---

## Project Structure

```
wedding_seating_plan/
├── frontend/
│   ├── index.js                  # Entry point — initializes the extension
│   ├── App.js                    # Root component + custom properties + config gate
│   ├── types.js                  # Default table and field ID constants
│   ├── hooks/
│   │   └── usePlaces.js          # Loads Places + Guests, builds the view model, exposes movePlace()
│   └── components/
│       ├── SeatingGrid.js        # Top-level layout, header, dnd-kit context
│       ├── SeatingTable.js       # One round table with 8 seats arranged by trigonometry
│       ├── Seat.js               # Single seat — combined draggable + droppable
│       ├── SeatAvatar.js         # Photo/initials + VIP badge + seat number badge + name label
│       ├── Legend.js             # Header legend (occupied / empty / VIP)
│       └── ConfigMissing.js      # Instructions shown when custom properties aren't set
├── .block/                       # Airtable extension config (do not edit)
├── .cursor/, .windsurf/          # SDK rules for Cursor/Windsurf IDE assistants
├── tailwind.config.js            # Airtable design tokens for Tailwind
├── package.json
└── README.md                     # This file
```

### Key Files

| File | Purpose |
|------|---------|
| `frontend/App.js` | Declares custom properties via `useCustomProperties`, gates rendering until config is complete, delegates to `SeatingGrid` via a child component so `usePlaces` is never called with `null`. |
| `frontend/hooks/usePlaces.js` | `useRecords` on Places + Guests with field limiting, builds a `{id, tableNumber, seatNumber, guest}[]` model, exposes `movePlace({sourcePlaceId, targetPlaceId})` for swap/move with `updateRecordsAsync`. |
| `frontend/components/Seat.js` | Uses `useDraggable` + `useDroppable` from `@dnd-kit/core` with merged refs on a single DOM node. `touch-action: none` to allow pointer drag gestures. |
| `frontend/types.js` | Default table and field IDs from the original base. **Update these if the schema changes** — or use the custom properties panel to override at runtime. |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@airtable/blocks` | Airtable Interface Extensions SDK — hooks, models, data access |
| `react` / `react-dom` | UI framework (React 19) |
| `@dnd-kit/core` | Drag & drop — pointer sensors, droppable/draggable hooks, DragOverlay |
| `@phosphor-icons/react` | Icons (star, gear) |
| `tailwindcss` | Styling with Airtable design tokens |

---

## Architecture Notes

### Why a Places junction table?

An earlier version stored the seating directly on the Guests table via `Table Number` and `Seat Number` number fields. This worked but conflated two concepts: a guest (metadata) and a seat assignment. The junction table makes each seat a first-class record — the extension can render all 80 seats even when they're empty, and swaps are a simple link-field update on two Place records instead of a cross-record mutation.

This pattern also scales naturally if the customer later wants multiple events: each event gets its own set of 80 Place records.

### Why dnd-kit instead of HTML5 Drag and Drop?

The HTML5 Drag and Drop API works but has rough edges (ghost images, pointer accuracy, no touch support, quirky drop detection on absolutely-positioned elements). `@dnd-kit/core` gives us a `DragOverlay` that follows the cursor precisely, built-in touch support, and clean `isOver` state for visual feedback.

### Merged draggable + droppable refs

Each seat is both draggable (if occupied) and droppable (always). dnd-kit supports this natively — we pass the same DOM node to both `setNodeRef` callbacks. This keeps the event coordinate math consistent and avoids layout surprises.

---

## Troubleshooting

### "Read-only — you do not have permission to edit seat assignments"
→ The Interface page has `Edit records inline: Disabled` for the Places table. See the "Important — Interface page permissions" section above.

### "Configure the seating plan" screen appears
→ One or more custom properties aren't set. Open the extension's properties panel in the Interface editor and select the 8 tables/fields listed in the Configuration table.

### `block run` shows `https://localhost:9000` with a certificate warning
→ Expected. The dev server uses a self-signed cert. Click "Advanced" → "Proceed" in Chrome.

### Mixed content warning on airtable.com even after stopping `block run`
→ Chrome may cache a security exception. Quit Chrome completely and relaunch. If that fails, clear site data for `airtable.com` in `chrome://settings/content/all`.

### Schema changes in Airtable don't appear in the extension
→ Hot reload picks up code changes but not base schema changes. Refresh the Interface page in the browser after creating/renaming tables or fields.

---

## Support

For questions or issues with this extension, contact the delivery team.
