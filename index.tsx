
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary class to handle application-wide failures.
 * Extends React.Component to provide error-catching capabilities.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Added explicit props declaration to resolve "Property 'props' does not exist" errors in environments where inheritance might not be fully inferred
  props: ErrorBoundaryProps;
  // Fix: Use property initializer for state to resolve "Property 'state' does not exist" errors and simplify component structure
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  // Static method required by React to update state when a child throws
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Lifecycle method for logging error details to the console
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("DuoSpace Core Error:", error, errorInfo);
  }

  // Hard reset mechanism to recover from corrupted local state
  handleReset = () => {
    try {
      localStorage.clear();
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.location.href = url.origin + url.pathname;
    } catch (e) {
      window.location.reload();
    }
  };

  render() {
    // Fix: Access state and props from this, ensuring they are inferred correctly from the base React.Component
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div style={{ 
          height: '100dvh', display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', backgroundColor: '#060606', 
          color: '#fff', fontFamily: 'monospace', padding: '2rem', textAlign: 'center' 
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '2rem', animation: 'pulse 2s infinite' }}>🛸</div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5em', marginBottom: '1rem', color: '#ff3333' }}>System Malfunction</h1>
          <p style={{ opacity: 0.4, fontSize: '0.7rem', marginBottom: '2.5rem', maxWidth: '300px', lineHeight: '1.6' }}>
            Satellite link severed or local buffer corrupted. {error?.message}
          </p>
          <button 
            onClick={this.handleReset}
            style={{ 
              background: 'transparent', color: '#fff', border: '2px solid #fff', padding: '1.2rem 2.5rem', 
              fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.3em', borderRadius: '2rem',
              transition: 'all 0.3s'
            }}
          >
            Hard Reset Link
          </button>
          <style>{`
            @keyframes pulse { 0% { opacity: 0.5; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.5; transform: scale(0.95); } }
          `}</style>
        </div>
      );
    }
    return children;
  }
}

// Silence early initialization errors that don't impact final UX
window.addEventListener('error', (e) => {
  if (e.message.includes('Uncaught')) {
    console.warn("Caught early boot error, suppressed for UX stability.");
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
