import {useMemo, useState} from 'react';
import {DndContext, PointerSensor, useSensor, useSensors, DragOverlay} from '@dnd-kit/core';
import {SeatingTable} from './SeatingTable';
import {SeatAvatar} from './SeatAvatar';
import {Legend} from './Legend';
import {DebugPanel} from './DebugPanel';
import {BUILD_TAG} from '../version';
import {
    UnassignedSidebar,
    UNASSIGNED_ZONE_ID,
    GUEST_DRAG_PREFIX,
} from './UnassignedSidebar';

function parseGuestDragId(id) {
    if (typeof id !== 'string') return null;
    if (!id.startsWith(GUEST_DRAG_PREFIX)) return null;
    return id.slice(GUEST_DRAG_PREFIX.length);
}

export function SeatingGrid({
    places,
    unassignedGuests,
    numTables,
    seatsPerTable,
    onMovePlace,
    onAssignGuest,
    onUnassignPlace,
    canEdit,
    isUpdating,
    showDebug,
    placesTable,
    guestsTable,
}) {
    const [activeDragId, setActiveDragId] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {distance: 4},
        }),
    );

    const placeByTableSeat = useMemo(() => {
        const map = new Map();
        for (const place of places) {
            if (place.tableNumber == null || place.seatNumber == null) continue;
            map.set(`${place.tableNumber}-${place.seatNumber}`, place);
        }
        return map;
    }, [places]);

    const seatedCount = useMemo(
        () =>
            places.filter(
                (p) =>
                    p.guest &&
                    p.tableNumber != null &&
                    p.seatNumber != null &&
                    p.tableNumber >= 1 &&
                    p.tableNumber <= numTables &&
                    p.seatNumber >= 1 &&
                    p.seatNumber <= seatsPerTable,
            ).length,
        [places, numTables, seatsPerTable],
    );

    const totalSeats = numTables * seatsPerTable;
    const vipCount = useMemo(
        () => places.filter((p) => p.guest?.isVip).length,
        [places],
    );

    const activeDragGuestId = parseGuestDragId(activeDragId);
    const activeDragType = activeDragGuestId ? 'guest' : activeDragId ? 'seat' : null;

    const activePlace =
        activeDragType === 'seat' ? places.find((p) => p.id === activeDragId) : null;
    const activeUnassignedGuest =
        activeDragType === 'guest'
            ? unassignedGuests.find((g) => g.id === activeDragGuestId)
            : null;

    const handleDragStart = (event) => {
        setActiveDragId(event.active.id);
    };

    const handleDragCancel = () => {
        setActiveDragId(null);
    };

    const handleDragEnd = (event) => {
        setActiveDragId(null);
        const {active, over} = event;
        if (!over) return;

        const draggedGuestId = parseGuestDragId(active.id);

        if (draggedGuestId) {
            // Sidebar guest being dropped.
            // On the sidebar zone → no-op (guest was already unassigned).
            if (over.id === UNASSIGNED_ZONE_ID) return;
            // On a seat → assign.
            onAssignGuest?.({guestId: draggedGuestId, targetPlaceId: over.id});
            return;
        }

        // Existing behaviour: seat being dragged.
        if (over.id === UNASSIGNED_ZONE_ID) {
            onUnassignPlace?.({sourcePlaceId: active.id});
            return;
        }
        onMovePlace?.({sourcePlaceId: active.id, targetPlaceId: over.id});
    };

    return (
        <div className="w-full min-h-screen bg-gray-gray50 dark:bg-gray-gray800 flex flex-col">
            <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-gray200 dark:border-gray-gray700 bg-white dark:bg-gray-gray800">
                <div>
                    <h1 className="text-lg font-display font-semibold text-gray-gray700 dark:text-gray-gray100">
                        Seating Plan
                    </h1>
                    <p className="text-xs text-gray-gray500 dark:text-gray-gray300 mt-0.5">
                        {canEdit
                            ? 'Drag guests between seats, or from the sidebar onto a seat.'
                            : 'Read-only — you do not have permission to edit seat assignments.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="text-right">
                        <div className="text-[0.65rem] uppercase tracking-wider text-gray-gray400 dark:text-gray-gray400">
                            Seated
                        </div>
                        <div className="text-sm font-semibold text-gray-gray700 dark:text-gray-gray100">
                            {seatedCount} / {totalSeats}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[0.65rem] uppercase tracking-wider text-gray-gray400 dark:text-gray-gray400">
                            VIP
                        </div>
                        <div className="text-sm font-semibold text-yellow-yellowDark1 dark:text-yellow-yellowLight1">
                            {vipCount}
                        </div>
                    </div>
                    <Legend />
                    {showDebug && (
                        <span
                            className="text-[0.6rem] font-mono text-gray-gray400 dark:text-gray-gray400 bg-gray-gray100 dark:bg-gray-gray700 rounded px-1.5 py-0.5"
                            title={`Build tag: ${BUILD_TAG}`}
                        >
                            {BUILD_TAG}
                        </span>
                    )}
                </div>
            </header>

            {showDebug && (
                <DebugPanel
                    buildTag={BUILD_TAG}
                    placesTable={placesTable}
                    guestsTable={guestsTable}
                    places={places}
                    unassignedGuests={unassignedGuests}
                    seatedCount={seatedCount}
                    totalSeats={totalSeats}
                    vipCount={vipCount}
                    canEdit={canEdit}
                    isUpdating={isUpdating}
                    activeDragId={activeDragId}
                />
            )}

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    <UnassignedSidebar
                        unassignedGuests={unassignedGuests}
                        canEdit={canEdit}
                        isUpdating={isUpdating}
                        activeDragType={activeDragType}
                    />

                    <main className="flex-1 overflow-auto p-6">
                        <div className="grid gap-x-6 gap-y-16 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({length: numTables}, (_, i) => i + 1).map((tableNum) => (
                                <SeatingTable
                                    key={tableNum}
                                    tableNumber={tableNum}
                                    seatsPerTable={seatsPerTable}
                                    placeByTableSeat={placeByTableSeat}
                                    canEdit={canEdit}
                                    isUpdating={isUpdating}
                                />
                            ))}
                        </div>
                    </main>
                </div>

                <DragOverlay dropAnimation={null}>
                    {activePlace?.guest ? (
                        <div className="relative w-14 h-14 pointer-events-none scale-110 opacity-90">
                            <SeatAvatar
                                guest={activePlace.guest}
                                seatNumber={activePlace.seatNumber}
                            />
                        </div>
                    ) : activeUnassignedGuest ? (
                        <div className="relative w-14 h-14 pointer-events-none scale-110 opacity-90">
                            <SeatAvatar
                                guest={activeUnassignedGuest}
                                seatNumber={'·'}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
