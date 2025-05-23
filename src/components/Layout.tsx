// src/components/Layout.tsx - Updated for SimpleAppContext
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ReadOnlyMode } from './ReadOnlyMode';
import { useSimpleApp, PlatformStatusBanner } from '../contexts/SimpleAppContext';
import ChainWarning from './ChainWarning';
import { useWallet } from '../contexts/WalletContext';
import DiagnosticButton from './DiagnosticButton';
import './Layout.css';

export const Layout: React.FC = () => {
    const { state } = useSimpleApp();
    const { isConnected } = useWallet();

    return (
        <div className="app-container">
            {/* Platform Status Banner - replaces the old BeeWarningBanner */}
            <PlatformStatusBanner />

            {/* Main layout */}
            <Header 
                isBeeRunning={state.status.beeNodeRunning} 
                hasPostageStamp={state.status.hasPostageStamp}
            />
            
            {/* Show chain warning only if wallet is connected */}
            {isConnected && <ChainWarning />}
            
            <ReadOnlyMode />

            <main className="content-container">
                <Outlet />
            </main>

            <DiagnosticButton />
        </div>
    );
};