/**
 * @file App.tsx
 * @description Root application shell for Image LemGendizer.
 * Provides the outer layout (header, footer, error boundary) and renders the active page.
 */
import {
  HeaderSection,
  FooterSection,
  ErrorBoundary,
  SVGFilters
} from './components';
import { useTranslation } from 'react-i18next';
import './styles/App.css';
import './styles/TabPanel.css';
import ImageLemGendizer from './pages/ImageLemGendizer';

/**
 * Root application component — thin shell for routing and layout
 * @component
 * @returns {JSX.Element} App component
 */
function App() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary t={t}>
      <div className="app-container">
        <SVGFilters />
        <HeaderSection />

        <ImageLemGendizer />

        <FooterSection />
      </div>
    </ErrorBoundary>
  );
}

export default App;
