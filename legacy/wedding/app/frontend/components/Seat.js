import {useCallback} from 'react';
import {useDraggable, useDroppable} from '@dnd-kit/core';
import {SeatAvatar} from './SeatAvatar';

export function Seat({seatNumber, place, canEdit, isUpdating, position}) {
    const placeId = place?.id;
    const guest = place?.guest;
    const draggableDisabled = !placeId || !guest || !canEdit || isUpdating;
    const droppableDisabled = !placeId;

    const {isOver, setNodeRef: setDropRef} = useDroppable({
        id: placeId || `missing-${seatNumber}`,
        disabled: droppableDisabled,
    });

    const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        isDragging,
    } = useDraggable({
        id: placeId || `missing-${seatNumber}`,
        disabled: draggableDisabled,
    });

    // Combine both refs on the same DOM node — dnd-kit treats draggable and
    // droppable as independent collections, so they can share an element.
    const setMergedRef = useCallback(
        (node) => {
            setDropRef(node);
            setDragRef(node);
        },
        [setDropRef, setDragRef],
    );

    const highlightClass =
        isOver && !isDragging
            ? 'ring-4 ring-blue-blue ring-offset-2 ring-offset-gray-gray50 dark:ring-offset-gray-gray800'
            : '';
    const draggingClass = isDragging ? 'opacity-30' : '';
    const cursorClass = guest && canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default';

    const title = !place
        ? `Seat ${seatNumber} — not in base`
        : guest
          ? guest.name
          : `Seat ${seatNumber} — empty`;

    return (
        <div
            ref={setMergedRef}
            {...(guest && canEdit ? listeners : {})}
            {...(guest && canEdit ? attributes : {})}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-110 ${cursorClass} ${draggingClass} ${highlightClass}`}
            style={{left: position.left, top: position.top, touchAction: 'none'}}
            title={title}
        >
            {guest ? (
                <SeatAvatar guest={guest} seatNumber={seatNumber} />
            ) : (
                <div className="w-14 h-14 rounded-full bg-gray-gray100 dark:bg-gray-gray700 border-2 border-dashed border-gray-gray300 dark:border-gray-gray500 flex items-center justify-center pointer-events-none">
                    <span className="text-sm font-semibold text-gray-gray400 dark:text-gray-gray400">
                        {seatNumber}
                    </span>
                </div>
            )}
        </div>
    );
}
