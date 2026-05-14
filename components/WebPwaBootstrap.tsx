import { useEffect } from 'react';
import { Platform } from 'react-native';

const THEME_COLOR = '#522eb4';

function isLocalOrTunnelHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    hostname.endsWith('.exp.direct') ||
    hostname.endsWith('.ngrok.io') ||
    hostname.endsWith('.ngrok-free.app')
  );
}

/**
 * Manifest / meta PWA senza `public/index.html` custom (evita conflitti con Expo SSR).
 * Service worker solo su host “produzione”: su Metro (`expo start --web`) può causare pagina bianca.
 */
export function WebPwaBootstrap() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `${window.location.origin}/manifest.json`;
      document.head.appendChild(link);
    }

    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = THEME_COLOR;
      document.head.appendChild(meta);
    }

    if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
      const m = document.createElement('meta');
      m.name = 'mobile-web-app-capable';
      m.content = 'yes';
      document.head.appendChild(m);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m = document.createElement('meta');
      m.name = 'apple-mobile-web-app-capable';
      m.content = 'yes';
      document.head.appendChild(m);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const m = document.createElement('meta');
      m.name = 'apple-mobile-web-app-title';
      m.content = 'WorkTracker';
      document.head.appendChild(m);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = `${window.location.origin}/pwa-192.png`;
      document.head.appendChild(link);
    }

    const host = window.location.hostname;
    if (isLocalOrTunnelHost(host)) {
      void navigator.serviceWorker?.getRegistrations?.().then((regs) => {
        regs.forEach((r) => {
          void r.unregister();
        });
      });
      return;
    }

    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
