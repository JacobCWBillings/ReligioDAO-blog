// src/components/ChainWarning.tsx
import React, { useState } from 'react';
import { useChainConstraint } from '../blockchain/hooks/useChainConstraint';
import config from '../config';

interface ChainWarningProps {
  className?: string;
}

export const ChainWarning: React.FC<ChainWarningProps> = ({ className = '' }) => {
  const { isCorrectChain, isSwithcingChain, switchToCorrectChain, appChainId } = useChainConstraint();
  const [switchError, setSwitchError] = useState<string | null>(null);

  if (isCorrectChain) {
    return null;
  }

  const correctNetwork = config.networks[appChainId];

  const handleSwitchNetwork = async () => {
    setSwitchError(null);
    
    try {
      const success = await switchToCorrectChain();
      
      if (!success) {
        setSwitchError('Failed to switch network. Please try manually switching in your wallet.');
      }
      // If success is true, the useChainConstraint hook will automatically 
      // update isCorrectChain and this component will disappear
    } catch (error) {
      console.error('Network switch error:', error);
      setSwitchError(
        error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred while switching networks.'
      );
    }
  };

  return (
    <div className={`chain-warning-banner ${className}`}>
      <div className="chain-warning-content">
        <div className="chain-warning-icon">⚠️</div>
        <div className="chain-warning-text">
          <p>You're connected to the wrong network!</p>
          <p>Please switch to <strong>{correctNetwork.name}</strong> to use ReligioDAO.</p>
          {switchError && (
            <p style={{ color: '#e74c3c', fontSize: '0.9rem', marginTop: '4px' }}>
              {switchError}
            </p>
          )}
        </div>
        <button 
          className="chain-switch-button" 
          onClick={handleSwitchNetwork}
          disabled={isSwithcingChain}
        >
          {isSwithcingChain ? 'Switching...' : `Switch to ${correctNetwork.name}`}
        </button>
      </div>
    </div>
  );
};

export default ChainWarning;