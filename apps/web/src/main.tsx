import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

declare global {
  interface Window {
    __TONKET_REACT_MOUNTED__?: boolean;
    __TONKET_BOOT_STAGE__?: string;
    __TONKET_SHOW_FATAL__?: (message: unknown, detail?: unknown) => void;
  }
}

function renderFatal(error: unknown, detail?: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown frontend boot error');
  const stack = error instanceof Error ? error.stack : String(detail || '');
  console.error('[TONKET boot fatal]', error, detail);

  if (typeof window.__TONKET_SHOW_FATAL__ === 'function') {
    window.__TONKET_SHOW_FATAL__(message, stack || detail || '');
    return;
  }

  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<main style="min-height:100dvh;background:#0f0f13;color:#fff;padding:18px;font-family:system-ui">
      <section style="border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.12);border-radius:24px;padding:18px">
        <h1>TONKET frontend boot failed</h1>
        <pre style="white-space:pre-wrap;word-break:break-word">${message}\n\n${stack || ''}</pre>
      </section>
    </main>`;
  }
}

async function boot() {
  window.__TONKET_BOOT_STAGE__ = 'main_started';

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    renderFatal('Root element #root was not found');
    return;
  }

  try {
    window.__TONKET_BOOT_STAGE__ = 'importing_app';
    const { default: App } = await import('./App');
    window.__TONKET_BOOT_STAGE__ = 'rendering_app';

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );

    window.__TONKET_REACT_MOUNTED__ = true;
    window.__TONKET_BOOT_STAGE__ = 'mounted';
  } catch (error) {
    window.__TONKET_BOOT_STAGE__ = 'failed';
    renderFatal(error);
  }
}

void boot();
