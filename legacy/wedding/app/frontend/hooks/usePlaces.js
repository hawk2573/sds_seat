import {useRecords} from '@airtable/blocks/interface/ui';
import {useCallback, useMemo, useState} from 'react';

export function usePlaces({
    placesTable,
    placeTableNumberField,
    placeSeatNumberField,
    placeGuestField,
    guestsTable,
    guestNameField,
    guestPhotoField,
    guestVipField,
}) {
    const placeFieldIds = useMemo(
        () => [placeTableNumberField.id, placeSeatNumberField.id, placeGuestField.id],
        [placeTableNumberField, placeSeatNumberField, placeGuestField],
    );
    const guestFieldIds = useMemo(
        () => [guestNameField.id, guestPhotoField.id, guestVipField.id],
        [guestNameField, guestPhotoField, guestVipField],
    );

    const placeRecords = useRecords(placesTable, {fields: placeFieldIds});
    const guestRecords = useRecords(guestsTable, {fields: guestFieldIds});

    const [isUpdating, setIsUpdating] = useState(false);

    const guestsById = useMemo(() => {
        const map = new Map();
        if (!guestRecords) return map;
        for (const record of guestRecords) {
            const attachments = record.getCellValue(guestPhotoField);
            const firstAttachment =
                Array.isArray(attachments) && attachments.length > 0 ? attachments[0] : null;
            const photoUrl =
                firstAttachment?.thumbnails?.small?.url ||
                firstAttachment?.thumbnails?.large?.url ||
                firstAttachment?.url ||
                null;

            map.set(record.id, {
                id: record.id,
                name: record.getCellValueAsString(guestNameField) || 'Unnamed guest',
                photoUrl,
                isVip: Boolean(record.getCellValue(guestVipField)),
            });
        }
        return map;
    }, [guestRecords, guestNameField, guestPhotoField, guestVipField]);

    const places = useMemo(() => {
        if (!placeRecords) return [];
        return placeRecords.map((record) => {
            const tableNumber = record.getCellValue(placeTableNumberField);
            const seatNumber = record.getCellValue(placeSeatNumberField);
            const linkedGuests = record.getCellValue(placeGuestField);
            const firstLink =
                Array.isArray(linkedGuests) && linkedGuests.length > 0 ? linkedGuests[0] : null;
            const guest = firstLink ? guestsById.get(firstLink.id) || null : null;

            return {
                id: record.id,
                tableNumber: typeof tableNumber === 'number' ? tableNumber : null,
                seatNumber: typeof seatNumber === 'number' ? seatNumber : null,
                guest,
            };
        });
    }, [placeRecords, placeTableNumberField, placeSeatNumberField, placeGuestField, guestsById]);

    const unassignedGuests = useMemo(() => {
        const placedGuestIds = new Set();
        for (const place of places) {
            if (place.guest?.id) placedGuestIds.add(place.guest.id);
        }
        const out = [];
        for (const guest of guestsById.values()) {
            if (!placedGuestIds.has(guest.id)) out.push(guest);
        }
        out.sort((a, b) => {
            if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return out;
    }, [places, guestsById]);

    const canEdit = useMemo(() => {
        if (!placesTable || !placeGuestField) return false;
        return placesTable.hasPermissionToUpdateRecords([
            {
                fields: {
                    [placeGuestField.id]: [],
                },
            },
        ]);
    }, [placesTable, placeGuestField]);

    const movePlace = useCallback(
        async ({sourcePlaceId, targetPlaceId}) => {
            if (!placesTable || !placeGuestField) return;
            if (!canEdit) return;
            if (sourcePlaceId === targetPlaceId) return;

            const source = places.find((p) => p.id === sourcePlaceId);
            const target = places.find((p) => p.id === targetPlaceId);
            if (!source || !target || !source.guest) return;

            const draggedGuestLink = [{id: source.guest.id}];
            const displacedGuestLink = target.guest ? [{id: target.guest.id}] : [];

            try {
                setIsUpdating(true);
                await placesTable.updateRecordsAsync([
                    {
                        id: targetPlaceId,
                        fields: {
                            [placeGuestField.id]: draggedGuestLink,
                        },
                    },
                    {
                        id: sourcePlaceId,
                        fields: {
                            [placeGuestField.id]: displacedGuestLink,
                        },
                    },
                ]);
            } finally {
                setIsUpdating(false);
            }
        },
        [places, placesTable, placeGuestField, canEdit],
    );

    const assignGuestToPlace = useCallback(
        async ({guestId, targetPlaceId}) => {
            if (!placesTable || !placeGuestField) return;
            if (!canEdit) return;
            if (!guestId || !targetPlaceId) return;

            const target = places.find((p) => p.id === targetPlaceId);
            if (!target) return;

            // If the target already holds the same guest, nothing to do.
            if (target.guest?.id === guestId) return;

            try {
                setIsUpdating(true);
                // If target is occupied, the previous guest simply becomes
                // unassigned again (their Place record no longer links to them).
                await placesTable.updateRecordAsync(targetPlaceId, {
                    [placeGuestField.id]: [{id: guestId}],
                });
            } finally {
                setIsUpdating(false);
            }
        },
        [places, placesTable, placeGuestField, canEdit],
    );

    const unassignFromPlace = useCallback(
        async ({sourcePlaceId}) => {
            if (!placesTable || !placeGuestField) return;
            if (!canEdit) return;
            if (!sourcePlaceId) return;

            const source = places.find((p) => p.id === sourcePlaceId);
            if (!source || !source.guest) return;

            try {
                setIsUpdating(true);
                await placesTable.updateRecordAsync(sourcePlaceId, {
                    [placeGuestField.id]: [],
                });
            } finally {
                setIsUpdating(false);
            }
        },
        [places, placesTable, placeGuestField, canEdit],
    );

    return {
        places,
        unassignedGuests,
        movePlace,
        assignGuestToPlace,
        unassignFromPlace,
        canEdit,
        isUpdating,
    };
}
