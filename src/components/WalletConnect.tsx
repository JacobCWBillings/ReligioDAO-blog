import React, { useState } from 'react';
import { useWallet, useWalletProvider } from '../hooks/wallet';
import './WalletConnect.css';

export const WalletConnect: React.FC = () => {
    const { account, isConnected, isConnecting, connect, disconnect, error, chainId } = useWallet();
    const { provider } = useWalletProvider();
    const [showDropdown, setShowDropdown] = useState(false);

    // Format address to display only first 6 and last 4 characters
    const shortenedAddress = account ? 
        `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 
        '';
    
    // Handle connect button click
    const handleConnect = () => {
        if (provider === 'none') {
            // If no wallet is installed, open MetaMask install page
            window.open('https://metamask.io/download.html', '_blank');
        } else {
            connect();
        }
    };
    
    // Handle disconnect button click
    const handleDisconnect = () => {
        disconnect();
        setShowDropdown(false);
    };

    // Toggle the dropdown menu
    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    return (
        <div className="wallet-connect-container">
            {isConnected ? (
                <div className="wallet-connected" data-provider={provider}>
                    <button 
                        className="wallet-address-button" 
                        onClick={toggleDropdown}
                        title={account || undefined}
                    >
                        <div className="wallet-icon"></div>
                        <span>{shortenedAddress}</span>
                        <span className="dropdown-arrow">▼</span>
                    </button>
                    
                    {showDropdown && (
                        <div className="wallet-dropdown">
                            <div className="dropdown-address">
                                <span className="dropdown-label">Connected:</span>
                                <span className="dropdown-value" title={account || undefined}>{shortenedAddress}</span>
                            </div>
                            <div className="dropdown-wallet">
                                <span className="dropdown-label">Wallet:</span>
                                <span className="dropdown-value">
                                    {provider === 'metamask' ? 'MetaMask' : 
                                     provider === 'walletconnect' ? 'WalletConnect' : 
                                     'Ethereum Wallet'}
                                </span>
                            </div>
                            {chainId && (
                                <div className="dropdown-network">
                                    <span className="dropdown-label">Network:</span>
                                    <span className="dropdown-value">
                                        {chainId === 1 ? 'Ethereum Mainnet' : 
                                         chainId === 5 ? 'Goerli Testnet' :
                                         chainId === 31337 ? 'Localhost' : 
                                         `Chain ID: ${chainId}`}
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
                    {isConnecting ? 'Connecting...' : 
                     provider === 'none' ? 'Install Wallet' : 'Connect Wallet'}
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

export default WalletConnect;