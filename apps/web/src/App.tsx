import { TonConnectUIProvider } from '@tonconnect/ui-react';
import MainScreen from './components/MainScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

function getManifestUrl() {
  return `${window.location.origin}/tonconnect-manifest.json`;
}

export default function App() {
  return (
    <ErrorBoundary>
      <TonConnectUIProvider
        manifestUrl={getManifestUrl()}
        actionsConfiguration={{ twaReturnUrl: window.location.origin }}
      >
        <MainScreen />
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}
