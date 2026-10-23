import React from 'react';
import {initializeBlock} from '@airtable/blocks/ui';
import {App} from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error?: Error}> {
  state: {error?: Error} = {};
  static getDerivedStateFromError(error: Error) { return {error}; }
  render() {
    if (this.state.error) return <div className="fatal-error" role="alert"><p className="eyebrow">Space Manager could not start</p><h1>Configuration or data error</h1><p>{this.state.error.message}</p><p>Open the extension again after checking that configured tables and fields still exist. Renamed fields remain safe when their field IDs are unchanged.</p></div>;
    return this.props.children;
  }
}

initializeBlock(() => <ErrorBoundary><App /></ErrorBoundary>);
