// This file exports all wallet-related hooks for easier imports

export { useWalletProvider } from './useWalletProvider';
export { useWallet } from '../contexts/WalletContext';

// Re-export wallet types
export type { WalletProvider } from './useWalletProvider';