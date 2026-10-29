import { useEffect, useState } from 'react';

const dismissedStorageKey = 'coolace:pwa-install-dismissed';

const isIosDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true;

export default function PwaExperience() {
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissedStorageKey) === 'true';
    } catch {
      return false;
    }
  });
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const iosDevice = isIosDevice();

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleDisplayMode = () => setInstalled(isStandalone());

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener?.('change', handleDisplayMode);

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissedStorageKey, 'true');
    } catch {
      // Dismissing the hint remains available for the current page if storage is disabled.
    }
  };

  const install = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
    } catch (error) {
      console.error('No se pudo iniciar la instalación de CoolAceGest:', error);
    }
  };

  const showInstallHint = !installed && !dismissed && (Boolean(installPrompt) || iosDevice);

  return (
    <div className="pwa-experience space-y-3">
      {!online && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Sin conexión. Los datos pueden estar desactualizados; consultar o guardar información requiere Internet.
        </div>
      )}
      {showInstallHint && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-800" aria-label="Instalar CoolAceGest">
          <div className="min-w-0 flex-1">
            {iosDevice ? (
              <>
                <p className="font-semibold">Agrega CoolAceGest a tu pantalla de inicio</p>
                <p className="mt-1 text-slate-600">En Safari, toca Compartir y elige «Añadir a pantalla de inicio».</p>
                <button type="button" className="mt-2 min-h-11 rounded-lg border border-blue-300 bg-white px-3 font-medium text-brand-blue" onClick={() => setIosInstructionsOpen((open) => !open)} aria-expanded={iosInstructionsOpen}>
                  {iosInstructionsOpen ? 'Ocultar instrucciones' : 'Ver instrucciones'}
                </button>
                {iosInstructionsOpen && <p className="mt-2 text-slate-700">1. Abre esta página en Safari. 2. Toca el botón Compartir. 3. Selecciona «Añadir a pantalla de inicio» y confirma.</p>}
              </>
            ) : (
              <>
                <p className="font-semibold">Instala CoolAceGest en este dispositivo</p>
                <p className="mt-1 text-slate-600">Accede a la aplicación desde tu pantalla de inicio.</p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {installPrompt && <button type="button" className="min-h-11 rounded-lg bg-brand-blue px-4 font-medium text-white hover:bg-brand-electric" onClick={install}>Instalar</button>}
            <button type="button" className="min-h-11 rounded-lg px-3 font-medium text-slate-600 hover:bg-white" onClick={dismiss} aria-label="Cerrar aviso de instalación">Ahora no</button>
          </div>
        </section>
      )}
    </div>
  );
}
