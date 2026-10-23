import {Seat} from './Seat';

const TABLE_WRAP_SIZE = 280;
const SEAT_RADIUS_RATIO = 0.42;

export function SeatingTable({tableNumber, seatsPerTable, placeByTableSeat, canEdit, isUpdating}) {
    const seats = Array.from({length: seatsPerTable}, (_, i) => i + 1);

    return (
        <div className="flex flex-col items-center">
            <div
                className="relative"
                style={{width: `${TABLE_WRAP_SIZE}px`, height: `${TABLE_WRAP_SIZE}px`}}
            >
                {/* The round table in the center */}
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center border-2 border-yellow-yellowDusty bg-yellow-yellowLight3 dark:bg-gray-gray700 dark:border-yellow-yellowDusty"
                    style={{
                        width: `${TABLE_WRAP_SIZE * 0.5}px`,
                        height: `${TABLE_WRAP_SIZE * 0.5}px`,
                        boxShadow: 'inset 0 0 24px rgba(162, 104, 17, 0.12)',
                    }}
                >
                    <span className="text-[0.6rem] uppercase tracking-wider font-semibold text-yellow-yellowDusty dark:text-yellow-yellowLight1">
                        Table
                    </span>
                    <span className="text-2xl font-display font-bold text-gray-gray700 dark:text-gray-gray100 leading-none">
                        {tableNumber}
                    </span>
                </div>

                {/* Seats positioned around the table circumference */}
                {seats.map((seatNum) => {
                    const angleDeg = -90 + ((seatNum - 1) * 360) / seatsPerTable;
                    const angleRad = (angleDeg * Math.PI) / 180;
                    const x = 50 + SEAT_RADIUS_RATIO * 100 * Math.cos(angleRad);
                    const y = 50 + SEAT_RADIUS_RATIO * 100 * Math.sin(angleRad);
                    const place = placeByTableSeat.get(`${tableNumber}-${seatNum}`);
                    return (
                        <Seat
                            key={seatNum}
                            seatNumber={seatNum}
                            place={place}
                            canEdit={canEdit}
                            isUpdating={isUpdating}
                            position={{left: `${x}%`, top: `${y}%`}}
                        />
                    );
                })}
            </div>
        </div>
    );
}
