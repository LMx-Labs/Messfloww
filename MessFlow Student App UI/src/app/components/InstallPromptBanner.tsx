import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Zap } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export function InstallPromptBanner() {
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed it
    const dismissed = localStorage.getItem('messfloww_install_dismissed') === 'true';
    
    // Show banner if:
    // 1. Browser says it's installable
    // 2. It's not already installed
    // 3. User hasn't dismissed it
    if (isInstallable && !isInstalled && !dismissed) {
      // Small delay to not overwhelm user immediately on load
      const timer = setTimeout(() => setShowBanner(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowBanner(false);
    }
  }, [isInstallable, isInstalled]);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('messfloww_install_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setShowBanner(false);
    }
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-24 left-4 right-4 z-50 pointer-events-auto shadow-2xl"
        >
          <div className="bg-[#1E2A38]/95 backdrop-blur-md border border-[#FFD54F]/30 rounded-2xl p-4 flex items-center gap-3">
            {/* App Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD54F] to-[#FFE082] flex items-center justify-center shadow-lg shadow-[#FFD54F]/20">
              <Zap className="w-6 h-6 text-[#121212]" />
            </div>
            
            {/* Text Content */}
            <div className="flex-1">
              <h4 className="text-white font-medium text-sm">Install Messfloww App</h4>
              <p className="text-gray-400 text-xs mt-0.5">Order faster. One tap access.</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-[#FFD54F] hover:bg-[#FFE082] text-[#121212] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Install</span>
              </button>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
