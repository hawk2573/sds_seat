import {useDraggable, useDroppable} from '@dnd-kit/core';
import {StarIcon, UserIcon} from '@phosphor-icons/react';

const AVATAR_COLORS = [
    'bg-red-redLight1 text-red-redDark1',
    'bg-orange-orangeLight1 text-orange-orangeDark1',
    'bg-yellow-yellowLight1 text-yellow-yellowDark1',
    'bg-green-greenLight1 text-green-greenDark1',
    'bg-teal-tealLight1 text-teal-tealDark1',
    'bg-cyan-cyanLight1 text-cyan-cyanDark1',
    'bg-blue-blueLight1 text-blue-blueDark1',
    'bg-purple-purpleLight1 text-purple-purpleDark1',
    'bg-pink-pinkLight1 text-pink-pinkDark1',
];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

export const UNASSIGNED_ZONE_ID = 'unassigned-zone';
export const GUEST_DRAG_PREFIX = 'guest:';

function UnassignedGuestCard({guest, canEdit, isUpdating}) {
    const disabled = !canEdit || isUpdating;

    const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
        id: `${GUEST_DRAG_PREFIX}${guest.id}`,
        disabled,
    });

    const colorClass = AVATAR_COLORS[hashString(guest.id || guest.name) % AVATAR_COLORS.length];
    const initials = getInitials(guest.name);
    const cursorClass = canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default';
    const draggingClass = isDragging ? 'opacity-30' : '';

    return (
        <div
            ref={setNodeRef}
            {...(canEdit ? listeners : {})}
            {...(canEdit ? attributes : {})}
            className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-gray-gray700 border border-gray-gray200 dark:border-gray-gray600 shadow-sm hover:shadow transition-shadow ${cursorClass} ${draggingClass}`}
            style={{touchAction: 'none'}}
            title={guest.name}
        >
            <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-white dark:bg-gray-gray700 border border-gray-gray200 dark:border-gray-gray500 overflow-hidden flex items-center justify-center">
                    {guest.photoUrl ? (
                        <img
                            src={guest.photoUrl}
                            alt={guest.name}
                            className="w-full h-full object-cover pointer-events-none"
                            draggable={false}
                        />
                    ) : (
                        <div
                            className={`w-full h-full flex items-center justify-center text-[0.65rem] font-bold pointer-events-none ${colorClass}`}
                        >
                            {initials}
                        </div>
                    )}
                </div>
                {guest.isVip ? (
                    <div className="pointer-events-none absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-yellow text-white flex items-center justify-center border border-white dark:border-gray-gray700 shadow-sm">
                        <StarIcon size={8} weight="fill" />
                    </div>
                ) : null}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-gray700 dark:text-gray-gray100 truncate">
                    {guest.name}
                </div>
                {guest.isVip ? (
                    <div className="text-[0.6rem] uppercase tracking-wider font-semibold text-yellow-yellowDark1 dark:text-yellow-yellowLight1">
                        VIP
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function UnassignedSidebar({unassignedGuests, canEdit, isUpdating, activeDragType}) {
    const {isOver, setNodeRef} = useDroppable({
        id: UNASSIGNED_ZONE_ID,
        // Only act as a drop target when a SEAT is being dragged (to unassign).
        // Sidebar guests dropped back here would be a no-op.
        disabled: activeDragType !== 'seat',
    });

    const dropHintClass =
        activeDragType === 'seat'
            ? isOver
                ? 'ring-2 ring-red-redDark1 bg-red-redLight2 dark:bg-red-redDark1/20'
                : 'ring-2 ring-dashed ring-gray-gray300 dark:ring-gray-gray500'
            : '';

    const count = unassignedGuests.length;

    return (
        <aside
            ref={setNodeRef}
            className={`shrink-0 w-64 border-r border-gray-gray200 dark:border-gray-gray700 bg-gray-gray50 dark:bg-gray-gray800 flex flex-col transition-colors ${dropHintClass}`}
        >
            <header className="px-4 py-3 border-b border-gray-gray200 dark:border-gray-gray700">
                <div className="flex items-center gap-2">
                    <UserIcon size={16} className="text-gray-gray500 dark:text-gray-gray300" />
                    <h2 className="text-sm font-display font-semibold text-gray-gray700 dark:text-gray-gray100">
                        Unassigned
                    </h2>
                    <span className="ml-auto text-xs font-semibold text-gray-gray500 dark:text-gray-gray300 bg-gray-gray200 dark:bg-gray-gray700 rounded-full px-2 py-0.5">
                        {count}
                    </span>
                </div>
                <p className="mt-1 text-[0.65rem] text-gray-gray500 dark:text-gray-gray300">
                    {canEdit
                        ? count === 0
                            ? 'All guests are seated.'
                            : 'Drag a guest onto a seat to assign. Drag a seated guest here to unassign.'
                        : 'Read-only view.'}
                </p>
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {count === 0 ? (
                    <div className="text-xs text-center text-gray-gray400 dark:text-gray-gray400 py-8">
                        No unassigned guests.
                    </div>
                ) : (
                    unassignedGuests.map((guest) => (
                        <UnassignedGuestCard
                            key={guest.id}
                            guest={guest}
                            canEdit={canEdit}
                            isUpdating={isUpdating}
                        />
                    ))
                )}
            </div>
        </aside>
    );
}
