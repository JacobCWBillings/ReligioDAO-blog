// src/App.tsx - Updated to use SimpleAppContext
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { SimpleAppProvider } from './contexts/SimpleAppContext';
import { Layout } from './components/Layout';

// Import the new SimpleEditorPage
import SimpleEditorPage from './pages/SimpleEditorPage';

// Keep existing pages
import { BlogListPage } from './pages/viewer/BlogListPage';
import { BlogDetailPage } from './pages/viewer/BlogDetailPage';
import { ProposalListPage } from './pages/proposal/ProposalListPage';
import { ProposalDetailPage } from './pages/proposal/ProposalDetailPage';
import { ProposalSubmissionPage } from './pages/proposal/ProposalSubmissionPage';
import DiagnosticPage from './pages/DiagnosticPage';

import './App.css';

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
  return (
    <BrowserRouter>
      <WalletProvider supportedChainIds={SUPPORTED_CHAIN_IDS}>
        <SimpleAppProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Make BlogListPage the landing page */}
              <Route index element={<BlogListPage />} />
              
              {/* New simplified editor routes */}
              <Route path="editor" element={<SimpleEditorPage mode="draft" />} />
              <Route path="proposal-editor" element={<SimpleEditorPage mode="proposal" />} />
              
              {/* Legacy editor route - redirect to new editor */}
              <Route path="editor/:blogId" element={<Navigate to="/editor" replace />} />
              
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
              
              {/* Diagnostic Route */}
              <Route path="diagnostics" element={<DiagnosticPage />} />
              
              {/* 404 Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </SimpleAppProvider>
      </WalletProvider>
    </BrowserRouter>
  );
}