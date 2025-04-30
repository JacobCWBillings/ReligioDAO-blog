// src/App.tsx
import React from 'react';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { Bee } from '@ethersphere/bee-js';
import { GlobalState, getGlobalState } from './libetherjot';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import { WalletProvider } from './contexts/WalletContext';
import { createReligioDAOState } from './utils/platformInitializer';

// Layout Components
import './App.css';
import { Layout } from './components/Layout';

// Pages
import { HomePage } from './pages/HomePage';
import { EditorPage } from './EditorPage';
import { BlogListPage } from './pages/viewer/BlogListPage';
import { BlogDetailPage } from './pages/viewer/BlogDetailPage';
import { GlobalSettingsPage } from './pages/GlobalSettingsPage';
import { ProposalListPage } from './pages/proposal/ProposalListPage';
import { ProposalDetailPage } from './pages/proposal/ProposalDetailPage';
import { ProposalSubmissionPage } from './pages/proposal/ProposalSubmissionPage';
import { Dates } from 'cafe-utility';

// Define supported chain IDs for the dApp
const SUPPORTED_CHAIN_IDS = [
  1,     // Ethereum Mainnet
  100,   // Gnosis Chain
  31337, // Local development chain
  35441, // Q mainnet
  35442, // Q devnet
  35443, // Q testnet
];

export function App() {
    const [globalState, setGlobalState] = useState<GlobalState | null>(null);
    const [isBeeRunning, setBeeRunning] = useState(false);
    const [hasPostageStamp, setHasPostageStamp] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [initializingPlatform, setInitializingPlatform] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);

    // Load existing state from localStorage
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

    // Initialize platform if no global state exists
    useEffect(() => {
        // Only run this effect if we're initialized and there's no global state
        if (initialized && !globalState) {
            setInitializingPlatform(true);
            
            const initializeReligioDAOPlatform = async () => {
                try {
                    // Check if we can use local Bee
                    const useLocalBee = isBeeRunning && hasPostageStamp;
                    
                    // Create a default global state for the ReligioDAO platform
                    const platformState = await createReligioDAOState("ReligioDAO Blog Platform", {
                        useLocalBee,
                        beeApi: useLocalBee ? 'http://localhost:1633' : 'https://download.gateway.ethswarm.org',
                        postageBatchId: useLocalBee ? await fetchPostageStamp() : ''
                    });
                    
                    // Customize the default state for ReligioDAO
                    platformState.configuration.header.description = 
                        "A decentralized blogging platform governed by the ReligioDAO community";
                    platformState.configuration.footer.description = 
                        "Content on this platform is approved by ReligioDAO governance and stored on Swarm";
                    
                    // Use public gateway for content retrieval if not using local Bee
                    if (!useLocalBee) {
                        platformState.beeApi = 'https://download.gateway.ethswarm.org';
                    }
                    
                    // Convert to GlobalState and save
                    const state = await getGlobalState(platformState);
                    localStorage.setItem('state', JSON.stringify(platformState));
                    setGlobalState(state);
                    
                } catch (error) {
                    console.error("Failed to initialize ReligioDAO platform:", error);
                    setInitError("Failed to initialize the platform. Please refresh to try again.");
                } finally {
                    setInitializingPlatform(false);
                }
            };
            
            // Helper to fetch a usable postage stamp if available
            const fetchPostageStamp = async () => {
                if (isBeeRunning) {
                    try {
                        const bee = new Bee('http://localhost:1633');
                        const stamps = await bee.getAllPostageBatch();
                        const usableStamp = stamps.find(stamp => stamp.usable);
                        return usableStamp?.batchID || '';
                    } catch (error) {
                        console.warn("Error fetching postage stamp:", error);
                        return '';
                    }
                }
                return '';
            };
            
            initializeReligioDAOPlatform();
        }
    }, [initialized, globalState, isBeeRunning, hasPostageStamp]);

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
    
    // Show loading or error states during platform initialization
    if (!globalState) {
        if (initializingPlatform) {
            return <div className="app-loading">Initializing ReligioDAO Platform...</div>;
        }
        
        if (initError) {
            return (
                <div className="platform-init-error">
                    <h2>Platform Initialization Error</h2>
                    <p>{initError}</p>
                    <button onClick={() => window.location.reload()}>Retry</button>
                </div>
            );
        }
        
        return <div className="app-loading">Preparing ReligioDAO Platform...</div>;
    }

    // Updated routing in App.tsx
    // This ensures clear separation between blogs and proposals

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
                        
                        {/* Editor Routes - Consolidated */}
                        <Route path="editor">
                            <Route index element={<EditorPage mode="standard" />} />
                            <Route path=":blogId" element={<EditorPage mode="standard" />} />
                        </Route>
                        
                        {/* Proposal Editor Route */}
                        <Route path="proposal-editor" element={<EditorPage mode="proposal" />} />
                        
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