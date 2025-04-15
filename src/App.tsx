import { Bee } from '@ethersphere/bee-js';
import { Dates, Optional, Strings } from 'cafe-utility';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './App.css';
import { WalletProvider } from './contexts/WalletContext';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import { Article, Asset, GlobalState, getGlobalState } from './libetherjot';

// Layout Components
import { Layout } from './components/Layout';

// Pages
import { HomePage } from './pages/HomePage';
import { BlogEditorPage } from './pages/BlogEditorPage';
import { BlogListPage } from './pages/viewer/BlogListPage';
import { BlogDetailPage } from './pages/viewer/BlogDetailPage';
import { GlobalSettingsPage } from './pages/GlobalSettingsPage';
import { WelcomePage } from './WelcomePage';
import { ProposalListPage } from './pages/proposal/ProposalListPage';
import { ProposalDetailPage } from './pages/proposal/ProposalDetailPage';
import { ProposalSubmissionPage } from './pages/proposal/ProposalSubmissionPage';
import React from 'react';

// Define supported chain IDs for the dApp
const SUPPORTED_CHAIN_IDS = [
  1,     // Ethereum Mainnet
  100,   // Gnosis Chain
  31337, // Local development chain
];

function App() {
    const [globalState, setGlobalState] = useState<GlobalState | null>(null);
    const [isBeeRunning, setBeeRunning] = useState(false);
    const [hasPostageStamp, setHasPostageStamp] = useState(false);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const storedState = localStorage.getItem('state');
        if (storedState) {
            const parsedState = JSON.parse(storedState);
            getGlobalState(parsedState).then(state => {
                setGlobalState(state);
                setInitialized(true);
            });
        } else {
            setInitialized(true);
        }
    }, []);

    // Check Bee node connectivity
    async function checkBee() {
        fetch('http://localhost:1633/addresses')
            .then(async () => {
                if (!isBeeRunning) {
                    setBeeRunning(true);
                }
                const bee = new Bee('http://localhost:1633');
                const stamps = await bee.getAllPostageBatch();
                if (stamps.some(x => x.usable)) {
                    if (!hasPostageStamp) {
                        setHasPostageStamp(true);
                    }
                } else {
                    setHasPostageStamp(false);
                }
            })
            .catch(() => {
                setBeeRunning(false);
                setHasPostageStamp(false);
            });
    }

    useEffect(() => {
        checkBee();
        const interval = setInterval(() => {
            checkBee();
        }, Dates.seconds(5));
        return () => clearInterval(interval);
    }, []);

    // Show loading state while checking global state
    if (!initialized) {
        return <div className="app-loading">Loading ReligioDAO...</div>;
    }
    
    // If no global state exists, show the welcome page
    if (!globalState) {
        return (
            <WelcomePage
                setGlobalState={setGlobalState}
                isBeeRunning={isBeeRunning}
                hasPostageStamp={hasPostageStamp}
            />
        );
    }

    // Main application with routing
    return (
        <BrowserRouter>
            {/* Wrap application with enhanced WalletProvider with supported chain IDs */}
            <WalletProvider supportedChainIds={SUPPORTED_CHAIN_IDS}>
                <GlobalStateProvider initialState={globalState} setGlobalState={setGlobalState}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Layout 
                                    isBeeRunning={isBeeRunning} 
                                    hasPostageStamp={hasPostageStamp} 
                                />
                            }
                        >
                            {/* Home Page */}
                            <Route index element={<HomePage />} />
                            
                            {/* Blog Editor Routes */}
                            <Route path="editor">
                                <Route index element={<BlogEditorPage />} />
                                <Route path=":blogId" element={<BlogEditorPage />} />
                            </Route>
                            
                            {/* Blog Viewer Routes */}
                            <Route path="blogs">
                                <Route index element={<BlogListPage />} />
                                <Route path=":blogId" element={<BlogDetailPage />} />
                            </Route>
                            
                            {/* Proposal Routes */}
                            <Route path="proposals">
                                <Route index element={<ProposalListPage />} />
                                <Route path=":proposalId" element={<ProposalDetailPage />} />
                            </Route>
                            <Route path="submit-proposal" element={<ProposalSubmissionPage />} />
                            
                            {/* Settings */}
                            <Route path="settings" element={<GlobalSettingsPage />} />
                            
                            {/* 404 Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </GlobalStateProvider>
            </WalletProvider>
        </BrowserRouter>
    );
}