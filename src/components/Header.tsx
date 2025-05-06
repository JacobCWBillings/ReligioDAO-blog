// src/components/Header.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from './WalletConnect';
import './Header.css';
import yesImage from '../assets/images/yes.png';
import noImage from '../assets/images/no.png';

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
                <Link to="/">Blogs</Link>
                <Link to="/proposals">Proposals</Link>
                {isConnected && <Link to="/submit-proposal">Submit Blog</Link>}
            </nav>

            <div className="header-right">
                <div>
                    {/* Only show Bee status to connected users who might need to interact with Swarm */}
                    {isConnected && (
                        <div className="status-indicators">
                            <div className="status-indicator">
                                <span>Bee</span>
                                <img 
                                    className="status-image" 
                                    src={isBeeRunning ? yesImage : noImage} 
                                    alt={isBeeRunning ? 'Connected' : 'Disconnected'} 
                                />
                            </div>
                            <div className="status-indicator">
                                <span>Stamp</span>
                                <img 
                                    className="status-image" 
                                    src={hasPostageStamp ? yesImage : noImage} 
                                    alt={hasPostageStamp ? 'Available' : 'Unavailable'} 
                                />
                            </div>
                        </div>
                    )}
                    <WalletConnect />
                </div>
            </div>
        </header>
    );
};