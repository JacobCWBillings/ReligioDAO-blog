// src/components/ReadOnlyMode.tsx
import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import './ReadOnlyMode.css';

export const ReadOnlyMode: React.FC = () => {
  const { isConnected, connect } = useWallet();
  
  if (isConnected) return null;
  
  return (
    <div className="read-only-banner">
      <div className="read-only-content">
        <div className="read-only-icon">🔍</div>
        <div className="read-only-text">
          <h4>You're in Read-Only Mode</h4>
          <p>Connect your wallet to submit proposals, vote, and participate in governance</p>
        </div>
      </div>
    </div>
  );
};