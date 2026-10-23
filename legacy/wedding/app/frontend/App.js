import {useBase, useCustomProperties} from '@airtable/blocks/interface/ui';
import {FieldType} from '@airtable/blocks/interface/models';
import {SeatingGrid} from './components/SeatingGrid';
import {ConfigMissing} from './components/ConfigMissing';
import {usePlaces} from './hooks/usePlaces';
import {TABLE_IDS, FIELD_IDS, SEATING_DEFAULTS} from './types';

const NUM_TABLES_OPTIONS = [
    {value: '4', label: '4 tables'},
    {value: '6', label: '6 tables'},
    {value: '8', label: '8 tables'},
    {value: '10', label: '10 tables'},
    {value: '12', label: '12 tables'},
    {value: '15', label: '15 tables'},
    {value: '20', label: '20 tables'},
];

const SEATS_PER_TABLE_OPTIONS = [
    {value: '4', label: '4 seats'},
    {value: '6', label: '6 seats'},
    {value: '8', label: '8 seats'},
    {value: '10', label: '10 seats'},
    {value: '12', label: '12 seats'},
];

function findFieldById(table, id) {
    if (!table) return undefined;
    return table.fields.find((f) => f.id === id);
}

function findFieldByType(table, fieldType) {
    if (!table) return undefined;
    return table.fields.find((f) => f.config?.type === fieldType);
}

function getCustomProperties(base) {
    const placesTable =
        base.getTableByIdIfExists(TABLE_IDS.PLACES) ||
        base.tables.find((t) => t.name.toLowerCase().includes('place')) ||
        undefined;
    const guestsTable =
        base.getTableByIdIfExists(TABLE_IDS.GUESTS) ||
        base.tables.find((t) => t.name.toLowerCase().includes('guest')) ||
        undefined;

    const isNumber = (field) => field.config?.type === FieldType.NUMBER;
    const isLink = (field) => field.config?.type === FieldType.MULTIPLE_RECORD_LINKS;
    const isText = (field) =>
        field.config?.type === FieldType.SINGLE_LINE_TEXT ||
        field.config?.type === FieldType.MULTILINE_TEXT;
    const isAttachments = (field) => field.config?.type === FieldType.MULTIPLE_ATTACHMENTS;
    const isCheckbox = (field) => field.config?.type === FieldType.CHECKBOX;

    const props = [
        {
            key: 'placesTable',
            label: 'Places table (seats)',
            type: 'table',
            defaultValue: placesTable,
        },
    ];

    if (placesTable) {
        props.push(
            {
                key: 'placeTableNumberField',
                label: 'Place — table number',
                type: 'field',
                table: placesTable,
                shouldFieldBeAllowed: isNumber,
                defaultValue:
                    findFieldById(placesTable, FIELD_IDS.PLACES.TABLE_NUMBER) ||
                    findFieldByType(placesTable, FieldType.NUMBER),
            },
            {
                key: 'placeSeatNumberField',
                label: 'Place — seat number',
                type: 'field',
                table: placesTable,
                shouldFieldBeAllowed: isNumber,
                defaultValue:
                    findFieldById(placesTable, FIELD_IDS.PLACES.SEAT_NUMBER) ||
                    findFieldByType(placesTable, FieldType.NUMBER),
            },
            {
                key: 'placeGuestField',
                label: 'Place — linked guest',
                type: 'field',
                table: placesTable,
                shouldFieldBeAllowed: isLink,
                defaultValue:
                    findFieldById(placesTable, FIELD_IDS.PLACES.GUEST) ||
                    findFieldByType(placesTable, FieldType.MULTIPLE_RECORD_LINKS),
            },
        );
    }

    props.push({
        key: 'guestsTable',
        label: 'Guests table',
        type: 'table',
        defaultValue: guestsTable,
    });

    if (guestsTable) {
        props.push(
            {
                key: 'guestNameField',
                label: 'Guest — name',
                type: 'field',
                table: guestsTable,
                shouldFieldBeAllowed: isText,
                defaultValue:
                    findFieldById(guestsTable, FIELD_IDS.GUESTS.NAME) ||
                    findFieldByType(guestsTable, FieldType.SINGLE_LINE_TEXT),
            },
            {
                key: 'guestPhotoField',
                label: 'Guest — photo',
                type: 'field',
                table: guestsTable,
                shouldFieldBeAllowed: isAttachments,
                defaultValue:
                    findFieldById(guestsTable, FIELD_IDS.GUESTS.PHOTO) ||
                    findFieldByType(guestsTable, FieldType.MULTIPLE_ATTACHMENTS),
            },
            {
                key: 'guestVipField',
                label: 'Guest — VIP',
                type: 'field',
                table: guestsTable,
                shouldFieldBeAllowed: isCheckbox,
                defaultValue:
                    findFieldById(guestsTable, FIELD_IDS.GUESTS.VIP) ||
                    findFieldByType(guestsTable, FieldType.CHECKBOX),
            },
        );
    }

    props.push(
        {
            key: 'numTables',
            label: 'Number of tables',
            type: 'enum',
            possibleValues: NUM_TABLES_OPTIONS,
            defaultValue: String(SEATING_DEFAULTS.NUM_TABLES),
        },
        {
            key: 'seatsPerTable',
            label: 'Seats per table',
            type: 'enum',
            possibleValues: SEATS_PER_TABLE_OPTIONS,
            defaultValue: String(SEATING_DEFAULTS.SEATS_PER_TABLE),
        },
        {
            key: 'showDebug',
            label: 'Show debug panel',
            type: 'boolean',
            defaultValue: false,
        },
    );

    return props;
}

export function App() {
    const base = useBase();
    const {customPropertyValueByKey, errorState} = useCustomProperties(getCustomProperties);

    const placesTable = customPropertyValueByKey?.placesTable ?? null;
    const placeTableNumberField = customPropertyValueByKey?.placeTableNumberField ?? null;
    const placeSeatNumberField = customPropertyValueByKey?.placeSeatNumberField ?? null;
    const placeGuestField = customPropertyValueByKey?.placeGuestField ?? null;
    const guestsTable = customPropertyValueByKey?.guestsTable ?? null;
    const guestNameField = customPropertyValueByKey?.guestNameField ?? null;
    const guestPhotoField = customPropertyValueByKey?.guestPhotoField ?? null;
    const guestVipField = customPropertyValueByKey?.guestVipField ?? null;

    const numTables = parseInt(customPropertyValueByKey?.numTables ?? '10', 10);
    const seatsPerTable = parseInt(customPropertyValueByKey?.seatsPerTable ?? '8', 10);
    const showDebug = Boolean(customPropertyValueByKey?.showDebug);

    if (errorState) {
        return (
            <ConfigMissing
                title="Configuration error"
                message={errorState.message || 'Could not load custom properties.'}
            />
        );
    }

    const allConfigured = Boolean(
        base &&
            placesTable &&
            placeTableNumberField &&
            placeSeatNumberField &&
            placeGuestField &&
            guestsTable &&
            guestNameField &&
            guestPhotoField &&
            guestVipField,
    );

    if (!allConfigured) {
        return (
            <ConfigMissing
                title="Configure the seating plan"
                message="Open the properties panel (right sidebar) and select the Places table with its Table/Seat/Guest fields, and the Guests table with its Name/Photo/VIP fields."
            />
        );
    }

    return (
        <SeatingApp
            placesTable={placesTable}
            placeTableNumberField={placeTableNumberField}
            placeSeatNumberField={placeSeatNumberField}
            placeGuestField={placeGuestField}
            guestsTable={guestsTable}
            guestNameField={guestNameField}
            guestPhotoField={guestPhotoField}
            guestVipField={guestVipField}
            numTables={numTables}
            seatsPerTable={seatsPerTable}
            showDebug={showDebug}
        />
    );
}

function SeatingApp({
    placesTable,
    placeTableNumberField,
    placeSeatNumberField,
    placeGuestField,
    guestsTable,
    guestNameField,
    guestPhotoField,
    guestVipField,
    numTables,
    seatsPerTable,
    showDebug,
}) {
    const {
        places,
        unassignedGuests,
        movePlace,
        assignGuestToPlace,
        unassignFromPlace,
        canEdit,
        isUpdating,
    } = usePlaces({
        placesTable,
        placeTableNumberField,
        placeSeatNumberField,
        placeGuestField,
        guestsTable,
        guestNameField,
        guestPhotoField,
        guestVipField,
    });

    return (
        <SeatingGrid
            places={places}
            unassignedGuests={unassignedGuests}
            numTables={numTables}
            seatsPerTable={seatsPerTable}
            onMovePlace={movePlace}
            onAssignGuest={assignGuestToPlace}
            onUnassignPlace={unassignFromPlace}
            canEdit={canEdit}
            isUpdating={isUpdating}
            showDebug={showDebug}
            placesTable={placesTable}
            guestsTable={guestsTable}
        />
    );
}
