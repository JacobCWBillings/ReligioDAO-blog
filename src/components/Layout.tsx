// src/components/Layout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AssetBrowser } from '../asset-browser/AssetBrowser';
import { AssetPicker } from '../asset-browser/AssetPicker';
import { useGlobalState } from '../contexts/GlobalStateContext';
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
            
            <main className="content-container">
                <Outlet />
            </main>
        </div>
    );
};