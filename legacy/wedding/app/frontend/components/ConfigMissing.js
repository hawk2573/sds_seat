import {GearIcon} from '@phosphor-icons/react';

export function ConfigMissing({title, message}) {
    return (
        <div className="flex items-center justify-center w-full h-full min-h-screen bg-gray-gray50 dark:bg-gray-gray800 p-8">
            <div className="max-w-md text-center bg-white dark:bg-gray-gray700 rounded-lg shadow-sm dark:shadow-none border border-gray-gray200 dark:border-gray-gray600 p-8">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-blueLight3 dark:bg-gray-gray600 flex items-center justify-center">
                        <GearIcon size={24} className="text-blue-blue" weight="bold" />
                    </div>
                </div>
                <h2 className="text-lg font-display font-semibold text-gray-gray700 dark:text-gray-gray100 mb-2">
                    {title}
                </h2>
                <p className="text-sm text-gray-gray500 dark:text-gray-gray300">{message}</p>
            </div>
        </div>
    );
}
