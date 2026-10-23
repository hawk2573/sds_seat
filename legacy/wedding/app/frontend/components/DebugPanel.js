// Toggle via the "Show debug panel" custom property in the Interface Designer.
// Useful to verify which build is loaded and to diagnose data-flow issues.

export function DebugPanel({
    buildTag,
    placesTable,
    guestsTable,
    places,
    unassignedGuests,
    seatedCount,
    totalSeats,
    vipCount,
    canEdit,
    isUpdating,
    activeDragId,
}) {
    const row = (label, value) => (
        <div className="flex items-center justify-between gap-4 py-0.5">
            <span className="text-gray-gray500 dark:text-gray-gray400">{label}</span>
            <span className="font-semibold text-gray-gray700 dark:text-gray-gray100 tabular-nums">
                {value}
            </span>
        </div>
    );

    const loadedAt = new Date().toISOString();

    return (
        <details
            className="mx-6 mt-3 rounded-lg border border-gray-gray200 dark:border-gray-gray700 bg-gray-gray50 dark:bg-gray-gray800"
            open
        >
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-gray700 dark:text-gray-gray100 select-none">
                🐛 Debug panel
            </summary>
            <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-[0.7rem] font-mono">
                {row('Build tag', buildTag)}
                {row('UI loaded at', loadedAt)}
                {row('Places table', placesTable?.name ? `${placesTable.name} (${placesTable.id})` : 'missing')}
                {row('Guests table', guestsTable?.name ? `${guestsTable.name} (${guestsTable.id})` : 'missing')}
                {row('Places loaded', places?.length ?? 0)}
                {row('Guests unassigned', unassignedGuests?.length ?? 0)}
                {row('Seated', `${seatedCount} / ${totalSeats}`)}
                {row('VIP seated', vipCount)}
                {row('Can edit', canEdit ? 'yes' : 'no')}
                {row('Update in flight', isUpdating ? 'yes' : 'no')}
                {row('Active drag', activeDragId ?? '—')}
            </div>
        </details>
    );
}
