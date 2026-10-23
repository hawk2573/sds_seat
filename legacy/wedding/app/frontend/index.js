import {initializeBlock} from '@airtable/blocks/interface/ui';
import {Suspense} from 'react';
import {App} from './App';
import './style.css';

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center w-full h-full min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
            <div className="h-8 w-8 border-2 border-blue-blue border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

initializeBlock({
    interface: () => (
        <Suspense fallback={<LoadingFallback />}>
            <App />
        </Suspense>
    ),
});
