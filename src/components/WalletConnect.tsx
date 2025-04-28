// src/components/WalletConnect.tsx
import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './WalletConnect.css';

export const WalletConnect: React.FC = () => {
    const { 
        account, 
        isConnected, 
        isConnecting, 
        connect, 
        disconnect, 
        error, 
        chainId, 
        balance, 
        providerType,
        refreshBalance
    } = useWallet();
    
    const [showDropdown, setShowDropdown] = useState(false);

    // Format address to display only first 6 and last 4 characters
    const shortenedAddress = account ? 
        `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 
        '';
    
    // Format chain name based on chain ID
    const getChainName = (chainId: number | null) => {
        if (!chainId) return 'Unknown Network';
        
        switch (chainId) {
            case 1: return 'Ethereum Mainnet';
            case 5: return 'Goerli Testnet';
            case 11155111: return 'Sepolia Testnet';
            case 100: return 'Gnosis Chain';
            case 31337: return 'Local Dev Chain';
            case 35441: return 'Q Mainnet';
            case 35442: return 'Q Devnet';
            case 35443: return 'Q Testnet';
            default: return `Chain ID: ${chainId}`;
        }
    };

    // Handle connect button click
    const handleConnect = () => {
        connect();
    };
    
    // Handle disconnect button click
    const handleDisconnect = () => {
        disconnect();
        setShowDropdown(false);
    };
    
    // Toggle dropdown menu
    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    return (
        <div className="wallet-connect-container">
            {isConnected ? (
                <div className="wallet-connected" data-provider={providerType}>
                    <button 
                        className="wallet-address-button"
                        onClick={toggleDropdown}
                        aria-expanded={showDropdown}
                    >
                        <div className="wallet-icon"></div>
                        <span>{shortenedAddress}</span>
                        <span className="dropdown-arrow">▼</span>
                    </button>
                    
                    {showDropdown && (
                        <div className="wallet-dropdown">
                            <div className="dropdown-wallet">
                                <span className="dropdown-label">Wallet:</span>
                                <span className="dropdown-value">{providerType || 'Web3'}</span>
                            </div>
                            
                            <div className="dropdown-network">
                                <span className="dropdown-label">Network:</span>
                                <span className="dropdown-value">{getChainName(chainId)}</span>
                            </div>
                            
                            <div className="dropdown-address">
                                <span className="dropdown-label">Address:</span>
                                <span className="dropdown-value">{shortenedAddress}</span>
                            </div>
                            
                            {balance && (
                                <div className="dropdown-balance">
                                    <span className="dropdown-label">Balance:</span>
                                    <span className="dropdown-value" onClick={refreshBalance}>
                                        {parseFloat(balance).toFixed(4)} QGov
                                    </span>
                                </div>
                            )}
                            
                            <button 
                                className="disconnect-button"
                                onClick={handleDisconnect}
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <button 
                    className="connect-button" 
                    onClick={handleConnect}
                    disabled={isConnecting}
                >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
            )}
            
            {error && (
                <div className="wallet-error">
                    {error.message}
                </div>
            )}
        </div>
    );
};