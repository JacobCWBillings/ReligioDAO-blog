import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

// Define context types
interface WalletContextType {
    account: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    network: ethers.Network | null;
    chainId: number | null;
    error: Error | null;
    connect: () => Promise<void>;
    disconnect: () => void;
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
    error: null,
    connect: async () => {},
    disconnect: () => {},
};

// Create context
const WalletContext = createContext<WalletContextType>(defaultContext);

// Hook for using wallet context
export const useWallet = () => useContext(WalletContext);

// Provider component props
interface WalletProviderProps {
    children: ReactNode;
}

// Provider component
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
    const [account, setAccount] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [network, setNetwork] = useState<ethers.Network | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [error, setError] = useState<Error | null>(null);

    // Check if already connected on initial load
    useEffect(() => {
        const checkConnection = async () => {
            if (window.ethereum) {
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
                    }
                } catch (err) {
                    console.error("Failed to check wallet connection:", err);
                    setError(err instanceof Error ? err : new Error(String(err)));
                }
            }
        };

        checkConnection();
    }, []);

    // Setup event listeners
    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = (accounts: string[]) => {
                if (accounts.length === 0) {
                    disconnect();
                } else if (accounts[0] !== account) {
                    setAccount(accounts[0]);
                    setIsConnected(true);
                }
            };

            const handleChainChanged = (chainIdHex: string) => {
                window.location.reload(); // Recommended by MetaMask
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
    }, [account]);

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
            
            setAccount(accounts[0]);
            setIsConnected(true);
        } catch (err) {
            console.error("Failed to connect wallet:", err);
            setError(err instanceof Error ? err : new Error(String(err)));
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
        error,
        connect,
        disconnect,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

// Add type definition for window.ethereum
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on: (event: string, listener: (...args: any[]) => void) => void;
            removeListener: (event: string, listener: (...args: any[]) => void) => void;
            isMetaMask?: boolean;
        };
    }
}