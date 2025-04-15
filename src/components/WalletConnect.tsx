import React from 'react';
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
    };
    
    // Refresh balance
    const handleRefreshBalance = () => {
        refreshBalance();
    };

    return (
        <div className="wallet-connect-container">
            {isConnected ? (
                <div className="wallet-connected" data-provider={providerType}>
                    <div className="wallet-info">
                        <div className="wallet-address" title={account || undefined}>
                            {shortenedAddress}
                        </div>
                        <div className="wallet-network">
                            {getChainName(chainId)}
                        </div>
                        {balance && (
                            <div className="wallet-balance" onClick={handleRefreshBalance}>
                                {parseFloat(balance).toFixed(4)} ETH
                            </div>
                        )}
                        <button 
                            className="disconnect-button"
                            onClick={handleDisconnect}
                        >
                            Disconnect
                        </button>
                    </div>
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