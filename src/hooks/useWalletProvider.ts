import { useState, useEffect } from 'react';

export type WalletProvider = 'metamask' | 'walletconnect' | 'none';

export const useWalletProvider = () => {
  const [provider, setProvider] = useState<WalletProvider>('none');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const detectProvider = () => {
      if (window.ethereum) {
        if (window.ethereum.isMetaMask) {
          setProvider('metamask');
        } else {
          // Check for other providers
          const providerInfo = window.ethereum.providers?.find(
            (p: any) => p.isWalletConnect
          );
          
          if (providerInfo) {
            setProvider('walletconnect');
          } else {
            setProvider('metamask'); // Default to metamask if we can't specifically identify
          }
        }
      } else {
        setProvider('none');
      }
      
      setIsReady(true);
    };

    // Detect on mount
    detectProvider();
    
    // Also detect when visibility changes (user might install extension while page is open)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        detectProvider();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { provider, isReady };
};

export default useWalletProvider;