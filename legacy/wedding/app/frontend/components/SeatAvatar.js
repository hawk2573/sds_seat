import {StarIcon} from '@phosphor-icons/react';

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
    const initials = parts
        .slice(0, 2)
        .map((p) => p[0])
        .join('');
    return initials.toUpperCase() || '?';
}

export function SeatAvatar({guest, seatNumber}) {
    const colorClass = AVATAR_COLORS[hashString(guest.id || guest.name) % AVATAR_COLORS.length];
    const initials = getInitials(guest.name);
    const firstName = guest.name.split(/\s+/)[0];

    return (
        <>
            <div className="pointer-events-none w-14 h-14 rounded-full bg-white dark:bg-gray-gray700 border-2 border-gray-gray200 dark:border-gray-gray500 shadow-sm flex items-center justify-center overflow-hidden">
                {guest.photoUrl ? (
                    <img
                        src={guest.photoUrl}
                        alt={guest.name}
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                    />
                ) : (
                    <div
                        className={`w-full h-full flex items-center justify-center text-xs font-bold pointer-events-none ${colorClass}`}
                    >
                        {initials}
                    </div>
                )}
            </div>

            {/* Seat number badge */}
            <div className="pointer-events-none absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-gray700 dark:bg-gray-gray100 text-white dark:text-gray-gray700 text-[0.6rem] font-bold flex items-center justify-center border-2 border-white dark:border-gray-gray800">
                {seatNumber}
            </div>

            {/* VIP badge */}
            {guest.isVip ? (
                <div className="pointer-events-none absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-yellow text-white flex items-center justify-center border-2 border-white dark:border-gray-gray800 shadow-sm">
                    <StarIcon size={10} weight="fill" />
                </div>
            ) : null}

            {/* Guest name label */}
            <div className="pointer-events-none absolute top-[68px] left-1/2 -translate-x-1/2 max-w-[90px] truncate text-[0.65rem] font-semibold text-gray-gray700 dark:text-gray-gray100 bg-white/90 dark:bg-gray-gray700/90 px-1.5 py-0.5 rounded">
                {firstName}
            </div>
        </>
    );
}
