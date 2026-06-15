import { TonConnectUIProvider } from '@tonconnect/ui-react';
import MainScreen from './components/MainScreen';

export default function App() {
  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} actionsConfiguration={{ twaReturnUrl: 'https://t.me' }}>
      <MainScreen />
    </TonConnectUIProvider>
  );
}
