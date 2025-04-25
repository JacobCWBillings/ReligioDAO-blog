// src/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from './WalletConnect';
import './Header.css';

interface HeaderProps {
    isBeeRunning: boolean;
    hasPostageStamp: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isBeeRunning, hasPostageStamp }) => {
    const { isConnected } = useWallet();

    return (
        <header className="app-header">
            <div className="header-left">
                <Link to="/" className="logo-link">
                    <h1>ReligioDAO Blog</h1>
                </Link>
            </div>

            <nav className="header-nav">
                <Link to="/">Home</Link>
                <Link to="/blogs">Blogs</Link>
                {isConnected && <Link to="/editor">Submit Blog</Link>}
                <Link to="/proposals">Proposals</Link>
            </nav>

            <div className="header-right">
                <div className="status-indicators">
                    <div className="status-indicator">
                        <span>Bee</span>
                        <img 
                            className="status-image" 
                            src={isBeeRunning ? '/etherjot/yes.png' : '/etherjot/no.png'} 
                            alt={isBeeRunning ? 'Connected' : 'Disconnected'} 
                        />
                    </div>
                    <div className="status-indicator">
                        <span>Stamp</span>
                        <img 
                            className="status-image" 
                            src={hasPostageStamp ? '/etherjot/yes.png' : '/etherjot/no.png'} 
                            alt={hasPostageStamp ? 'Available' : 'Unavailable'} 
                        />
                    </div>
                </div>

                {/* Wallet Connection */}
                <WalletConnect />
            </div>
        </header>
    );
};