// src/components/ChainWarning.tsx
import React from 'react';
import { useChainConstraint } from '../blockchain/hooks/useChainConstraint';
import config from '../config';

interface ChainWarningProps {
  className?: string;
}

export const ChainWarning: React.FC<ChainWarningProps> = ({ className = '' }) => {
  const { isCorrectChain, isSwithcingChain, switchToCorrectChain, appChainId } = useChainConstraint();

  if (isCorrectChain) {
    return null;
  }

  const correctNetwork = config.networks[appChainId];

  return (
    <div className={`chain-warning-banner ${className}`}>
      <div className="chain-warning-content">
        <div className="chain-warning-icon">⚠️</div>
        <div className="chain-warning-text">
          <p>You're connected to the wrong network!</p>
          <p>Please switch to <strong>{correctNetwork.name}</strong> to use ReligioDAO.</p>
        </div>
        <button 
          className="chain-switch-button" 
          onClick={switchToCorrectChain}
          disabled={isSwithcingChain}
        >
          {isSwithcingChain ? 'Switching...' : `Switch to ${correctNetwork.name}`}
        </button>
      </div>
    </div>
  );
};

export default ChainWarning;