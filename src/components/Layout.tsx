// src/components/Layout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ReadOnlyMode } from './ReadOnlyMode';
import { AssetBrowser } from '../asset-browser/AssetBrowser';
import { AssetPicker } from '../asset-browser/AssetPicker';
import { useGlobalState } from '../contexts/GlobalStateContext';
import ChainWarning from './ChainWarning';
import { useWallet } from '../contexts/WalletContext';
import { BeeWarningBanner } from './BeeWarningBanner';
import DiagnosticButton from './DiagnosticButton';
import './Layout.css';

interface LayoutProps {
    isBeeRunning: boolean;
    hasPostageStamp: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ isBeeRunning, hasPostageStamp }) => {
    const { 
        globalState, 
        updateGlobalState,
        showAssetBrowser, 
        setShowAssetBrowser,
        showAssetPicker,
        assetPickerCallback
    } = useGlobalState();
    
    const { isConnected } = useWallet(); // Add this to check wallet connection

    // Function to insert asset in the current editor context
    const insertAsset = (reference: string) => {
        // This will be called from the AssetBrowser
        console.log('Insert asset with reference:', reference);
        setShowAssetBrowser(false);
    };

    return (
        <div className="app-container">
            {/* Render asset browser/picker modals when needed */}
            {showAssetBrowser && (
                <AssetBrowser
                    globalState={globalState}
                    setGlobalState={(state) => updateGlobalState(() => state)}
                    setShowAssetBrowser={setShowAssetBrowser}
                    insertAsset={insertAsset}
                />
            )}
            
            {showAssetPicker && (
                <AssetPicker 
                    globalState={globalState} 
                    callback={assetPickerCallback} 
                />
            )}

            {/* Main layout */}
            <Header 
                isBeeRunning={isBeeRunning} 
                hasPostageStamp={hasPostageStamp}
            />
            
            {/* Show warning only to connected users who need to interact with Swarm */}
            {isConnected && (!isBeeRunning || !hasPostageStamp) && (
                <BeeWarningBanner 
                    isBeeRunning={isBeeRunning} 
                    hasPostageStamp={hasPostageStamp} 
                />
            )}

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