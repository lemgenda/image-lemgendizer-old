import React from 'react';
import PropTypes from 'prop-types';
import '../styles/ErrorBoundary.css';

/**
 * ErrorBoundary - A class component to catch rendering errors in its child tree.
 * Provides a fallback UI to prevent the whole app from crashing.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service

        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            const { t } = this.props;

            // Fallback UI
            return (
                <div className="error-boundary-container">
                    <div className="error-boundary-card">
                        <div className="error-icon">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <h1 className="error-title">
                            {t ? t('error.boundary.title') : 'Something went wrong'}
                        </h1>
                        <p className="error-message">
                            {t ? t('error.boundary.subtitle') : 'An unexpected error occurred. We apologize for the inconvenience.'}
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="error-details">
                                <summary>{t ? t('error.boundary.details') : 'Technical Details'}</summary>
                                <pre className="error-stack">
                                    {this.state.error.toString()}
                                    <br />
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="error-actions">
                            <button
                                className="btn btn-primary"
                                onClick={this.handleReload}
                            >
                                <i className="fas fa-sync"></i> {t ? t('error.boundary.reload') : 'Reload Application'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    children: PropTypes.node.isRequired,
    t: PropTypes.func
};

export default ErrorBoundary;
