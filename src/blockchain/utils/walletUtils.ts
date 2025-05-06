// src/blockchain/utils/walletUtils.ts
import { ethers } from 'ethers';
import { walletConnectionInfo } from '../../config';
import { BlockchainError, BlockchainErrorType } from '../../types/blockchain';

/**
 * Wallet connection status
 */
export enum WalletConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

/**
 * Network metadata
 */
export interface NetworkInfo {
  chainId: string;         // Hex string with chainId
  name: string;            // Network name
  rpcUrl: string;          // RPC URL
  explorerUrl: string;     // Block explorer URL
  nativeCurrency: {
    name: string;          // Currency name
    symbol: string;        // Currency symbol
    decimals: number;      // Currency decimals
  };
}

/**
 * Gets network information for a specific chain ID
 * 
 * @param chainId Chain ID (number)
 * @returns NetworkInfo object or null if chain not supported
 */
export function getNetworkInfo(chainId: number): NetworkInfo | null {
  const networkConfig = walletConnectionInfo[chainId];
  if (!networkConfig) {
    return null;
  }
  
  return {
    chainId: networkConfig.chainId,
    name: networkConfig.name,
    rpcUrl: networkConfig.rpcUrl,
    explorerUrl: networkConfig.explorerUrl,
    nativeCurrency: networkConfig.nativeCurrency
  };
}

/**
 * Formats an address for display
 * 
 * @param address Ethereum address
 * @param startChars Number of characters to show at the start
 * @param endChars Number of characters to show at the end
 * @returns Formatted address
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (!address || address.length < (startChars + endChars + 3)) {
    return address || '';
  }
  
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Validates an Ethereum address
 * 
 * @param address Address to validate
 * @returns True if address is valid
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch (err) {
    return false;
  }
}

/**
 * Checks if a network is supported
 * 
 * @param chainId Chain ID to check
 * @returns True if network is supported
 */
export function isSupportedNetwork(chainId: number | null): boolean {
  if (!chainId) return false;
  
  return Boolean(walletConnectionInfo[chainId]);
}

/**
 * Switch to a specific network in the wallet
 * 
 * @param provider Web3 provider with ethereum.request method
 * @param chainId Chain ID to switch to
 * @returns Promise resolving to true if switch was successful
 */
export async function switchNetwork(provider: any, chainId: number): Promise<boolean> {
  try {
    if (!provider || !provider.request) {
      throw new BlockchainError(
        'Invalid provider',
        BlockchainErrorType.NetworkError
      );
    }
    
    const networkInfo = getNetworkInfo(chainId);
    if (!networkInfo) {
      throw new BlockchainError(
        `Network with chainId ${chainId} is not supported`,
        BlockchainErrorType.UnsupportedNetwork
      );
    }
    
    // Request network switch
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: networkInfo.chainId }]
    });
    
    return true;
  } catch (err: any) {
    // Error code 4902 means the network is not added to wallet
    if (err.code === 4902) {
      return await addNetwork(provider, chainId);
    }
    
    console.error('Error switching network:', err);
    throw new BlockchainError(
      'Failed to switch network',
      BlockchainErrorType.NetworkError,
      err instanceof Error ? err : new Error(String(err))
    );
  }
}

/**
 * Add a network to the wallet
 * 
 * @param provider Web3 provider with ethereum.request method
 * @param chainId Chain ID to add
 * @returns Promise resolving to true if network was added
 */
export async function addNetwork(provider: any, chainId: number): Promise<boolean> {
  try {
    if (!provider || !provider.request) {
      throw new BlockchainError(
        'Invalid provider',
        BlockchainErrorType.NetworkError
      );
    }
    
    const networkInfo = getNetworkInfo(chainId);
    if (!networkInfo) {
      throw new BlockchainError(
        `Network with chainId ${chainId} is not supported`,
        BlockchainErrorType.UnsupportedNetwork
      );
    }
    
    // Request adding the network
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: networkInfo.chainId,
          chainName: networkInfo.name,
          rpcUrls: [networkInfo.rpcUrl],
          blockExplorerUrls: [networkInfo.explorerUrl],
          nativeCurrency: networkInfo.nativeCurrency
        }
      ]
    });
    
    return true;
  } catch (err) {
    console.error('Error adding network:', err);
    throw new BlockchainError(
      'Failed to add network',
      BlockchainErrorType.NetworkError,
      err instanceof Error ? err : new Error(String(err))
    );
  }
}

/**
 * Opens a transaction in the block explorer
 * 
 * @param txHash Transaction hash
 * @param chainId Chain ID
 */
export function openTransactionInExplorer(txHash: string, chainId: number): void {
  const networkInfo = getNetworkInfo(chainId);
  if (!networkInfo) {
    console.error(`Network with chainId ${chainId} is not supported`);
    return;
  }
  
  const url = `${networkInfo.explorerUrl}/tx/${txHash}`;
  window.open(url, '_blank');
}

/**
 * Opens an address in the block explorer
 * 
 * @param address Ethereum address
 * @param chainId Chain ID
 */
export function openAddressInExplorer(address: string, chainId: number): void {
  const networkInfo = getNetworkInfo(chainId);
  if (!networkInfo) {
    console.error(`Network with chainId ${chainId} is not supported`);
    return;
  }
  
  const url = `${networkInfo.explorerUrl}/address/${address}`;
  window.open(url, '_blank');
}