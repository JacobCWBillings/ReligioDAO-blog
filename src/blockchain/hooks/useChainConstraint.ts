// src/blockchain/hooks/useChainConstraint.ts
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { switchNetwork, isSupportedNetwork } from '../../utils/walletUtils';
import config from '../../config';
import { BlockchainError, BlockchainErrorType } from '../../types/blockchainTypes';

/**
 * Hook for constraining the app to the correct blockchain chain
 * Handles chain validation and switching
 */
export const useChainConstraint = () => {
  const { chainId, isConnected } = useWallet();
  const [isCorrectChain, setIsCorrectChain] = useState<boolean>(false);
  const [isSwithcingChain, setIsSwithcingChain] = useState<boolean>(false);
  const [chainError, setChainError] = useState<BlockchainError | null>(null);
  
  // Get the default chain ID from configuration
  const appChainId = config.defaultNetworkId;
  
  // Validate if the connected wallet is on the correct chain
  useEffect(() => {
    if (!isConnected || !chainId) {
      setIsCorrectChain(false);
      return;
    }
    
    // Check if wallet chain matches app chain
    const correctChain = chainId === appChainId;
    setIsCorrectChain(correctChain);
    
    if (!correctChain) {
      setChainError(new BlockchainError(
        `Connected to wrong network. Please switch to ${config.networks[appChainId].name}`,
        BlockchainErrorType.UnsupportedNetwork
      ));
    } else {
      setChainError(null);
    }
  }, [chainId, isConnected, appChainId]);

  /**
   * Switch the wallet to the correct chain
   * Uses window.ethereum directly for maximum compatibility
   * @returns Promise resolving to true if successful
   */
  const switchToCorrectChain = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      console.warn('Cannot switch chain: wallet not connected');
      return false;
    }
    
    if (!window.ethereum) {
      console.warn('Cannot switch chain: window.ethereum not available');
      setChainError(new BlockchainError(
        'No Ethereum wallet detected',
        BlockchainErrorType.NetworkError
      ));
      return false;
    }
    
    setIsSwithcingChain(true);
    setChainError(null);
    
    try {
      console.log(`Attempting to switch to chain ${appChainId}...`);
      const success = await switchNetwork(window.ethereum, appChainId);
      
      if (success) {
        console.log(`Successfully switched to chain ${appChainId}`);
      } else {
        console.warn(`Failed to switch to chain ${appChainId}`);
      }
      
      return success;
    } catch (err) {
      console.error('Error switching network:', err);
      setChainError(
        err instanceof BlockchainError 
          ? err 
          : new BlockchainError(
              'Failed to switch network',
              BlockchainErrorType.NetworkError,
              err instanceof Error ? err : new Error(String(err))
            )
      );
      return false;
    } finally {
      setIsSwithcingChain(false);
    }
  }, [isConnected, appChainId]);

  /**
   * Get the correct chain ID for the app regardless of wallet
   * @returns The constrained chain ID to use for contract interactions
   */
  const getConstrainedChainId = useCallback((): number => {
    // Always return the app's configured chain ID
    return appChainId;
  }, [appChainId]);

  return {
    isCorrectChain,
    isSwithcingChain,
    chainError,
    appChainId,
    switchToCorrectChain,
    getConstrainedChainId,
  };
};

export default useChainConstraint;