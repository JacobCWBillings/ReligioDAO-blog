// src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { Bee } from '@ethersphere/bee-js';
import { GlobalState, getGlobalState } from './libetherjot';
import { GlobalStateProvider } from './contexts/GlobalStateContext';
import { WalletProvider } from './contexts/WalletContext';
import { createReligioDAOState } from './utils/platformInitializer';
import { ethers } from 'ethers';

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
import DiagnosticPage from './pages/DiagnosticPage';
import { Dates } from 'cafe-utility';

// Import DiagnosticPanel
import DiagnosticPanel from './components/DiagnosticPanel';

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
    const [diagnosticMode, setDiagnosticMode] = useState(false);

    // Diagnostic utility functions
    const diagnoseEnvironment = () => {
      console.log("==== ENVIRONMENT DIAGNOSTICS ====");
      console.log("User Agent:", navigator.userAgent);
      console.log("Protocol:", window.location.protocol);
      console.log("Host:", window.location.host);
      console.log("Path:", window.location.pathname);
      console.log("NODE_ENV:", process.env.NODE_ENV);
      console.log("PUBLIC_URL:", process.env.PUBLIC_URL);
      console.log("Local Storage Available:", isLocalStorageAvailable());
      console.log("Local Storage Items:", Object.keys(localStorage).length);
    };

    const isLocalStorageAvailable = () => {
      try {
        const test = "test";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch(e) {
        return false;
      }
    };

    const diagnoseLocalStorage = () => {
      console.log("==== LOCAL STORAGE DIAGNOSTICS ====");
      try {
        const keys = Object.keys(localStorage);
        console.log("Total items:", keys.length);
        console.log("Keys:", keys);
        
        // Check if 'state' exists
        if (localStorage.getItem('state')) {
          try {
            const stateSize = localStorage.getItem('state')!.length;
            console.log("State size (chars):", stateSize);
            const parsedState = JSON.parse(localStorage.getItem('state')!);
            console.log("State parsed successfully");
            console.log("State top-level keys:", Object.keys(parsedState));
            console.log("Collections:", parsedState.collections);
          } catch (e) {
            console.error("Error parsing state:", e);
          }
        } else {
          console.log("No state found in localStorage");
        }
      } catch (e) {
        console.error("Error accessing localStorage:", e);
      }
    };

    // Create a minimal state without Swarm dependencies
    const createMinimalState = () => {
      // Create a minimal state that doesn't depend on Swarm
      const wallet = ethers.Wallet.createRandom();
      return {
          beeApi: 'https://download.gateway.ethswarm.org',
          postageBatchId: '',
          privateKey: wallet.privateKey,
          pages: [],
          articles: [],
          feed: wallet.address.toLowerCase(),
          configuration: {
              title: 'ReligioDAO Blog Platform',
              header: {
                  title: 'ReligioDAO',
                  logo: '',
                  description: 'A decentralized blogging platform (Emergency Mode)',
                  linkLabel: 'Governance',
                  linkAddress: '/proposals'
              },
              main: { highlight: 'Featured' },
              footer: {
                  description: 'Running in emergency mode without Swarm integration',
                  links: { discord: '', twitter: '', github: '', youtube: '', reddit: '' }
              },
              extensions: { ethereumAddress: '', donations: false, comments: false }
          },
          collections: {},
          assets: []
      };
  };

    // Load existing state from localStorage with diagnostics
    useEffect(() => {
        diagnoseEnvironment();
        diagnoseLocalStorage();
        
        const storedState = localStorage.getItem('state');
        if (storedState) {
            console.log("Found stored state, attempting to parse and use");
            try {
                const parsedState = JSON.parse(storedState);
                console.log("State parsed successfully, loading global state");
                getGlobalState(parsedState)
                    .then(state => {
                        console.log("Global state loaded successfully");
                        setGlobalState(state);
                        setInitialized(true);
                    })
                    .catch(error => {
                        console.error("Failed to get global state from parsed state:", error);
                        // Handle the error by clearing the localStorage and retrying
                        console.log("Clearing invalid state and retrying initialization");
                        localStorage.removeItem('state');
                        setInitialized(true); // This will trigger the next useEffect
                    });
            } catch (e) {
                console.error("Error parsing stored state:", e);
                localStorage.removeItem('state');
                setInitialized(true);
            }
        } else {
            console.log("No stored state found, proceeding to initialization");
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
                    // Always use false for useLocalBee in production builds
                    const isProduction = process.env.NODE_ENV === 'production';
                    const useLocalBee = !isProduction && isBeeRunning && hasPostageStamp;
                    
                    console.log("Initializing platform with settings:", {
                        useLocalBee,
                        beeApi: useLocalBee ? 'http://localhost:1633' : 'https://download.gateway.ethswarm.org',
                        environment: process.env.NODE_ENV
                    });
                    
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
                    // For critical platform initialization errors, provide a recovery option
                    console.error("Failed to initialize ReligioDAO platform:", error);
                    setInitError("Platform initialization failed. You can try one of the recovery options below.");
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

    // Toggle diagnostic mode with keyboard shortcut (Ctrl+Shift+D)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                setDiagnosticMode(prev => !prev);
                e.preventDefault();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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
                    <div className="recovery-options">
                        <h3>Recovery Options:</h3>
                        <button onClick={() => window.location.reload()} className="retry-button">
                            Retry Initialization
                        </button>
                        <button 
                            onClick={() => {
                                // Create minimal state without Swarm dependencies
                                const minimalState = createMinimalState();
                                const globalMinimalState = getGlobalState(minimalState as any);
                                globalMinimalState.then(state => {
                                    setGlobalState(state);
                                    localStorage.setItem('state', JSON.stringify(minimalState));
                                });
                            }} 
                            className="continue-button"
                        >
                            Continue Without Swarm
                        </button>
                    </div>
                    
                    <div className="error-details">
                        <p>
                            If you continue to see this error, try clearing your browser's localStorage 
                            and reloading the page.
                        </p>
                        <button 
                            onClick={() => {
                                localStorage.clear();
                                window.location.reload();
                            }}
                            className="clear-storage-button"
                        >
                            Clear Storage & Reload
                        </button>
                    </div>
                </div>
            );
        }
        
        return <div className="app-loading">Preparing ReligioDAO Platform...</div>;
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
                            {/* Make BlogListPage the landing page */}
                            <Route index element={<BlogListPage />} />
                            
                            {/* Move HomePage to a different route */}
                            <Route path="home" element={<HomePage />} />
                            
                            {/* Editor Routes - Consolidated */}
                            <Route path="editor">
                                <Route index element={<EditorPage mode="proposal" />} />
                                <Route path=":blogId" element={<EditorPage mode="proposal" />} />
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

                            {/* Add Diagnostic Route */}
                            <Route path="diagnostics" element={<DiagnosticPage />} />
                            
                            {/* 404 Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>

                    {/* Add the diagnostic panel - always rendered but only visible when activated */}
                    <DiagnosticPanel 
                        isBeeRunning={isBeeRunning}
                        hasPostageStamp={hasPostageStamp}
                        globalState={globalState}
                        isVisible={diagnosticMode}
                        onClose={() => setDiagnosticMode(false)}
                    />

                </GlobalStateProvider>
            </WalletProvider>
        </BrowserRouter>
    );
}