// Wedding Seating base — table & field identifiers.
// Source: schema.md (base apphKq7PuzI3NPWbA)

export const TABLE_IDS = {
    GUESTS: 'tbl7AorYDijc5NafK',
    PLACES: 'tblsJD7PCV4IvY6rS',
};

export const FIELD_IDS = {
    GUESTS: {
        NAME: 'fldFQgQcYILPPl9PU',
        PHOTO: 'fldbpeTmvrNcHLIum',
        EMAIL: 'fldkrwJBIXNbVEvES',
        COMPANY: 'fldzhqxsOYgcP4q9j',
        MEAL: 'fld2m5YbEVTLiNhwG',
        VIP: 'fldVIA859ng3LWB8T',
        NOTES: 'fldeGD7zI7K7ilfdY',
    },
    PLACES: {
        PLACE_LABEL: 'fld0s4SKQ4EDKyJMi',
        TABLE_NUMBER: 'fldRKq0nR8EiWWenQ',
        SEAT_NUMBER: 'fld9t7Ac8ehE65YaK',
        GUEST: 'fldEf6Cuju9hp6a5y',
    },
};

export const SEATING_DEFAULTS = {
    NUM_TABLES: 10,
    SEATS_PER_TABLE: 8,
};
