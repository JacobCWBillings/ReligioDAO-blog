import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useWalletProvider, WalletProvider as ProviderType, ExtendedEthereumProvider } from '../hooks/useWalletProvider';

// Define wallet error types
export enum WalletErrorType {
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  NO_PROVIDER = 'NO_PROVIDER',
  UNSUPPORTED_NETWORK = 'UNSUPPORTED_NETWORK',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// Define context types
interface WalletContextType {
  account: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  network: ethers.Network | null;
  chainId: number | null;
  providerType: ProviderType;
  balance: string | null;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<boolean>;
  addToken: (address: string, symbol: string, decimals: number, image?: string) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
}

// Set default context values
const defaultContext: WalletContextType = {
  account: null,
  isConnected: false,
  isConnecting: false,
  provider: null,
  signer: null,
  network: null,
  chainId: null,
  providerType: 'none',
  balance: null,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  switchNetwork: async () => false,
  addToken: async () => false,
  refreshBalance: async () => {},
};

// Create context
const WalletContext = createContext<WalletContextType>(defaultContext);

// Hook for using wallet context
export const useWallet = () => useContext(WalletContext);

// Provider component props
interface WalletProviderProps {
  children: ReactNode;
  supportedChainIds?: number[]; // Optional array of supported chain IDs
}

// Provider component
export const WalletProvider: React.FC<WalletProviderProps> = ({ 
  children,
  supportedChainIds = [] // Default to all chains supported
}) => {
  const { provider: providerType, isReady } = useWalletProvider();
  
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [network, setNetwork] = useState<ethers.Network | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Check if wallet was previously connected and attempt to reconnect
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum && isReady) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const ethersProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(ethersProvider);
            
            const ethersSigner = await ethersProvider.getSigner();
            setSigner(ethersSigner);
            
            const ethersNetwork = await ethersProvider.getNetwork();
            setNetwork(ethersNetwork);
            setChainId(Number(ethersNetwork.chainId));
            
            setAccount(accounts[0]);
            setIsConnected(true);

            // Fetch balance for the account
            const balance = await ethersProvider.getBalance(accounts[0]);
            setBalance(ethers.formatEther(balance));
          }
        } catch (err) {
          console.error("Failed to check wallet connection:", err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    if (isReady) {
      checkConnection();
    }
  }, [isReady]);

  // Setup event listeners
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnect();
        } else if (accounts[0] !== account) {
          // User switched account
          setAccount(accounts[0]);
          
          // Update balance for new account
          if (provider) {
            provider.getBalance(accounts[0])
              .then(balance => setBalance(ethers.formatEther(balance)))
              .catch(err => console.error("Failed to fetch balance:", err));
          }
        }
      };

      const handleChainChanged = async (chainIdHex: string) => {
        // MetaMask recommends reloading the page on chain change
        // But we'll handle it gracefully without reload
        try {
          const newChainId = parseInt(chainIdHex, 16);
          setChainId(newChainId);
          
          if (window.ethereum) {
            const ethersProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(ethersProvider);
            
            const ethersSigner = await ethersProvider.getSigner();
            setSigner(ethersSigner);
            
            const ethersNetwork = await ethersProvider.getNetwork();
            setNetwork(ethersNetwork);
            
            // Check if connected to supported chain
            if (supportedChainIds.length > 0 && !supportedChainIds.includes(newChainId)) {
              setError(new Error(`Connected to unsupported network. Please switch to a supported network.`));
            } else {
              setError(null);
            }
            
            // Refresh balance
            if (account) {
              const balance = await ethersProvider.getBalance(account);
              setBalance(ethers.formatEther(balance));
            }
          }
        } catch (err) {
          console.error("Error handling chain change:", err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      };

      const handleDisconnect = (error: { code: number; message: string }) => {
        disconnect();
        setError(new Error(error.message));
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);

      return () => {
        if (typeof window.ethereum !== 'undefined') {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
          window.ethereum.removeListener('disconnect', handleDisconnect);
        }
      };
    }
  }, [account, provider, supportedChainIds]);

  // Connect wallet function
  const connect = async () => {
    setError(null);
    
    if (!window.ethereum) {
      const error = new Error("No Ethereum wallet found. Please install MetaMask or another wallet.");
      setError(error);
      return;
    }

    setIsConnecting(true);

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(ethersProvider);
      
      const ethersSigner = await ethersProvider.getSigner();
      setSigner(ethersSigner);
      
      const ethersNetwork = await ethersProvider.getNetwork();
      setNetwork(ethersNetwork);
      setChainId(Number(ethersNetwork.chainId));
      
      // Check if connected to supported network
      if (supportedChainIds.length > 0 && !supportedChainIds.includes(Number(ethersNetwork.chainId))) {
        setError(new Error(`Connected to unsupported network. Please switch to a supported network.`));
      }
      
      setAccount(accounts[0]);
      setIsConnected(true);
      
      // Fetch account balance
      const balance = await ethersProvider.getBalance(accounts[0]);
      setBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      
      // Categorize common wallet connection errors
      let errorMessage = "Failed to connect wallet";
      
      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes('user rejected') || message.includes('user denied')) {
          errorMessage = "Connection rejected by user";
        } else if (message.includes('already processing')) {
          errorMessage = "Connection request already pending";
        }
      }
      
      setError(new Error(errorMessage));
      
      // Reset connection state on error
      setAccount(null);
      setIsConnected(false);
      setProvider(null);
      setSigner(null);
      setNetwork(null);
      setChainId(null);
      setBalance(null);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet function
  const disconnect = () => {
    setAccount(null);
    setIsConnected(false);
    setProvider(null);
    setSigner(null);
    setNetwork(null);
    setChainId(null);
    setBalance(null);
    setError(null);
  };

  // Switch network function
  const switchNetwork = async (targetChainId: number): Promise<boolean> => {
    if (!window.ethereum) {
      setError(new Error("No Ethereum wallet found"));
      return false;
    }
    
    try {
      const chainIdHex = `0x${targetChainId.toString(16)}`;
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      
      return true;
    } catch (err) {
      console.error("Failed to switch network:", err);
      
      // Handle case where the chain hasn't been added to the wallet
      if (err instanceof Error && 'code' in err && (err as any).code === 4902) {
        setError(new Error("The requested network needs to be added to your wallet first"));
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      
      return false;
    }
  };

  // Add token to wallet
  const addToken = async (
    tokenAddress: string, 
    tokenSymbol: string, 
    tokenDecimals: number, 
    tokenImage?: string
  ): Promise<boolean> => {
    if (!window.ethereum) {
      setError(new Error("No Ethereum wallet found"));
      return false;
    }
    
    try {
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: [{
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        }],
      });
      
      return wasAdded;
    } catch (err) {
      console.error("Failed to add token to wallet:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  };

  // Refresh account balance
  const refreshBalance = async () => {
    if (!provider || !account) return;
    
    try {
      const balance = await provider.getBalance(account);
      setBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  };

  // Create context value
  const value = {
    account,
    isConnected,
    isConnecting,
    provider,
    signer,
    network,
    chainId,
    providerType,
    balance,
    error,
    connect,
    disconnect,
    switchNetwork,
    addToken,
    refreshBalance,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};