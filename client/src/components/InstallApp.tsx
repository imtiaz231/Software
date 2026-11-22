import { useEffect, useState } from 'react';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

/* Shows an "Install app" button on Android / desktop Chrome and a short tip on iPhone. Hidden once installed. */
export default function InstallApp() {
  const [evt, setEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(isStandalone());
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (installed) return null;
  if (evt) return <button className="btn ghost" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>Install the app</button>;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return <p className="muted small install-tip">To install on your iPhone: tap the Share button, then "Add to Home Screen".</p>;
  return null;
}
