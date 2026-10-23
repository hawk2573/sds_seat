import {StarIcon} from '@phosphor-icons/react';

export function Legend() {
    return (
        <div className="flex items-center gap-4 text-[0.7rem] text-gray-gray500 dark:text-gray-gray300">
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-gray700 border-2 border-gray-gray200 dark:border-gray-gray500" />
                <span>Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-gray100 dark:bg-gray-gray700 border-2 border-dashed border-gray-gray300 dark:border-gray-gray500" />
                <span>Empty</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-yellow-yellow flex items-center justify-center">
                    <StarIcon size={8} weight="fill" className="text-white" />
                </div>
                <span>VIP</span>
            </div>
        </div>
    );
}
