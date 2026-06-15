import { TonConnectUIProvider } from '@tonconnect/ui-react';
import MainScreen from './components/MainScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

type AbsoluteUrl = `${string}://${string}`;

function toAbsoluteUrl(value: string, fallback: AbsoluteUrl): AbsoluteUrl {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'tg:') {
      return url.toString() as AbsoluteUrl;
    }
  } catch {
    // Keep the fallback below. Telegram WebView can be dramatic, let it breathe.
  }

  return fallback;
}

function getAppOrigin(): AbsoluteUrl {
  if (typeof window === 'undefined') {
    return 'https://t.me' as AbsoluteUrl;
  }

  return toAbsoluteUrl(window.location.origin, 'https://t.me' as AbsoluteUrl);
}

function getManifestUrl(): AbsoluteUrl {
  const origin = getAppOrigin();
  return toAbsoluteUrl(new URL('/tonconnect-manifest.json', origin).toString(), origin);
}

function getTwaReturnUrl(): AbsoluteUrl {
  const origin = getAppOrigin();

  // TonConnect expects an absolute URL type. In a real Telegram Mini App the app origin is valid,
  // and in weird local/preview cases we safely fall back to Telegram instead of breaking TypeScript/Railway.
  return origin;
}

export default function App() {
  return (
    <ErrorBoundary>
      <TonConnectUIProvider
        manifestUrl={getManifestUrl()}
        actionsConfiguration={{ twaReturnUrl: getTwaReturnUrl() }}
      >
        <MainScreen />
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}
