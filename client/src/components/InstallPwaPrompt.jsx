import React, { useState, useEffect } from 'react';

export const InstallPwaPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent default Chrome 76+ install prompt
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div class="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-50 bg-surface-container-lowest border border-primary/30 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
      <div class="flex items-center gap-3">
        <img src="/logo.png" alt="Kharcha App Logo" class="w-11 h-11 rounded-xl object-cover shadow-sm shrink-0" />
        <div class="flex flex-col">
          <span class="font-title-md text-[15px] font-bold text-on-surface">Install Kharcha App</span>
          <span class="font-body-sm text-[12px] text-on-surface-variant">Add to phone home screen for 1-tap app access</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          class="px-3.5 py-2 bg-primary text-on-primary font-title-md text-xs rounded-full hover:bg-primary-container active:scale-95 transition-all shadow-xs"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          class="p-1 text-on-surface-variant hover:text-on-surface rounded-full"
          aria-label="Dismiss prompt"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
};
