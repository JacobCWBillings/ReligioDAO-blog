import { useState, useEffect } from 'react';

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase' | 'brave' | 'trust' | 'none';

/**
 * Hook for detecting the type of wallet provider available in the browser
 */
export const useWalletProvider = () => {
  const [provider, setProvider] = useState<WalletProvider>('none');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const detectProvider = () => {
      if (!window.ethereum) {
        setProvider('none');
        setIsReady(true);
        return;
      }

      // Check for multiple injected providers
      if (window.ethereum.providers && window.ethereum.providers.length) {
        // Prioritize providers (MetaMask first, then others)
        for (const provider of window.ethereum.providers) {
          if (provider.isMetaMask) {
            setProvider('metamask');
            break;
          } else if (provider.isCoinbaseWallet) {
            setProvider('coinbase');
            break;
          } else if (provider.isTrust) {
            setProvider('trust');
            break;
          } else if (provider.isBraveWallet) {
            setProvider('brave');
            break;
          } else if (provider.isWalletConnect) {
            setProvider('walletconnect');
            break;
          }
        }
      } else {
        // Single provider detection
        if (window.ethereum.isMetaMask) {
          setProvider('metamask');
        } else if (window.ethereum.isCoinbaseWallet) {
          setProvider('coinbase');
        } else if (window.ethereum.isTrust) {
          setProvider('trust');
        } else if (window.ethereum.isBraveWallet) {
          setProvider('brave');
        } else if (window.ethereum.isWalletConnect) {
          setProvider('walletconnect');
        } else {
          // Default to metamask for unknown providers
          setProvider('metamask');
        }
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