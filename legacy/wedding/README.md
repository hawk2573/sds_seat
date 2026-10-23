# Wedding Seating Plan — Airtable Interface Extension

Visual drag-and-drop seating chart for a wedding. Arrange guests across round tables with numbered seats directly from a custom Airtable interface.

**Used as the V3 (SDK) demo** in the [Airmakers](https://airmakers.io) YouTube video on Airtable custom interfaces.

## What it does

- Renders N round tables × M seats each (configurable via custom properties)
- Each occupied seat shows the guest's photo, name, and a VIP badge when applicable
- Drag & drop a guest from one seat to another — empty slot moves them, occupied slot swaps the two
- **Unassigned guests sidebar** — guests not yet placed are listed in a sidebar, draggable onto any seat. Drag a seated guest back onto the sidebar to unassign.
- Fully configurable via Airtable custom properties: pick the tables and fields at interface-design time

## Data model

| Table | Purpose |
|-------|---------|
| `Guests` | Master list of people (Name, Photo, VIP, Email, Company, Meal, Notes) |
| `Places` | Seat slots (Table Number, Seat Number, linked Guest) |

Assignments live on `Places.Guest` — a linked record from Places to Guests. Unassigned = guest in `Guests` not linked from any `Places` row.

## Stack

- Airtable Interface Extensions SDK (`@airtable/blocks/interface/ui`)
- React 19
- `@dnd-kit/core` for accessible drag & drop
- Tailwind CSS (Airtable design tokens via `tailwind.config.js`)
- `@phosphor-icons/react` for icons

## Project layout

```
wedding-seating/
├── prd.md                         # Product requirements
├── schema.md                      # Base schema reference
├── status.md                      # Build stage tracker
├── lessons-learned.md             # Post-build notes
├── qa-checklist.md                # QA reference
├── qa-checklist.html              # Interactive QA checklist
├── mockups/                       # HTML mockups
└── wedding_seating_plan/          # The Airtable extension project
    ├── block.json
    ├── package.json
    ├── tailwind.config.js
    └── frontend/
        ├── index.js               # Entry point with <Suspense>
        ├── App.js                 # Custom-properties wiring + layout
        ├── types.js               # Table/field ID constants
        ├── hooks/
        │   └── usePlaces.js       # Data hooks: places, unassignedGuests, movePlace, assignGuestToPlace, unassignFromPlace
        └── components/
            ├── SeatingGrid.js     # Main layout + DndContext + drag routing
            ├── SeatingTable.js    # One round table with trigonometrically placed seats
            ├── Seat.js            # Droppable + draggable seat
            ├── SeatAvatar.js      # Photo / initials / VIP badge / seat number
            ├── UnassignedSidebar.js # Sidebar with unassigned guest cards (draggable)
            ├── Legend.js          # Legend footer
            └── ConfigMissing.js   # Empty state when properties are not set
```

## Running locally

```bash
cd wedding_seating_plan
npm install --legacy-peer-deps
```

Then open the Extension Manager in Airtable → Dev Server → Start, and load the extension via the "Develop" button inside the interface you added it to.

## License

MIT.
