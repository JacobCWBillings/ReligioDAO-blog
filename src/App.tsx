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
import React from 'react';

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
        return <div>Loading...</div>;
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
            <WalletProvider>
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
                            <Route index element={<HomePage />} />
                            <Route path="editor">
                                <Route index element={<BlogEditorPage />} />
                                <Route path=":blogId" element={<BlogEditorPage />} />
                            </Route>
                            <Route path="blogs">
                                <Route index element={<BlogListPage />} />
                                <Route path=":blogId" element={<BlogDetailPage />} />
                            </Route>
                            <Route path="settings" element={<GlobalSettingsPage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </GlobalStateProvider>
            </WalletProvider>
        </BrowserRouter>
    );
}

export default App;