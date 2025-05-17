// src/components/BeeSyncButton.tsx
import React, { useState } from 'react';
import { Bee } from '@ethersphere/bee-js';
import { createReligioDAOState } from '../utils/platformInitializer';
import { getGlobalState } from '../libetherjot';
import './BeeSyncButton.css';

interface BeeSyncButtonProps {
  isLocal?: boolean; // Use a simpler style for header integration
  onSuccess?: (newState: any) => void;
  onError?: (error: Error) => void;
}

const BeeSyncButton: React.FC<BeeSyncButtonProps> = ({ 
  isLocal = false,
  onSuccess,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const checkLocalBee = async (): Promise<{isRunning: boolean, hasStamp: string | null}> => {
    try {
      // Check if local Bee is running
      const bee = new Bee('http://localhost:1633');
      await bee.getNodeAddresses(); // Will throw if not running
      
      try {
        // Get usable stamps
        const stamps = await bee.getAllPostageBatch();
        const usableStamps = stamps.filter(stamp => stamp.usable);
        
        if (usableStamps.length === 0) {
          return { isRunning: true, hasStamp: null };
        }
        
        // Find stamp with highest capacity
        if (usableStamps.length > 0) {
          const bestStamp = usableStamps.reduce((a, b) => 
            (a.depth > b.depth ? a : b)
          );
          return { isRunning: true, hasStamp: bestStamp.batchID };
        }
      } catch (e) {
        console.warn("Couldn't fetch stamps:", e);
      }
      
      return { isRunning: true, hasStamp: null };
    } catch (e) {
      return { isRunning: false, hasStamp: null };
    }
  };

  const syncWithLocalBee = async () => {
    setIsLoading(true);
    setStatus('idle');
    setMessage("Checking local Bee node...");
    
    try {
      // Check if local Bee is running with stamps
      const { isRunning, hasStamp } = await checkLocalBee();
      
      if (!isRunning) {
        setStatus('error');
        setMessage("No local Bee node detected. Make sure your Bee node is running on http://localhost:1633");
        setIsLoading(false);
        if (onError) onError(new Error("No local Bee node detected"));
        return;
      }
      
      if (!hasStamp) {
        setStatus('error');
        setMessage("Local Bee node found, but no usable postage stamps detected. Create a stamp using: curl -X POST http://localhost:1633/stamps/100000000/24");
        setIsLoading(false);
        if (onError) onError(new Error("No usable postage stamps"));
        return;
      }
      
      setMessage("Local Bee node with stamps found! Reinitializing the platform...");
      
      // Reinitialize the platform with local Bee
      const platformState = await createReligioDAOState("ReligioDAO Blog Platform", {
        useLocalBee: true,
        beeApi: 'http://localhost:1633',
        postageBatchId: hasStamp
      });
      
      // Convert to GlobalState
      const state = await getGlobalState(platformState);
      
      // Update localStorage
      localStorage.setItem('state', JSON.stringify(platformState));
      
      setStatus('success');
      setMessage("Successfully connected to local Bee node! Refresh the page to apply changes.");
      
      if (onSuccess) onSuccess(state);
    } catch (error) {
      console.error("Error syncing with local Bee:", error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLocal) {
    // Simple version for header integration
    return (
      <button 
        onClick={syncWithLocalBee}
        disabled={isLoading}
        title="Sync with local Bee node"
        className="bee-sync-button-local"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderRadius: '4px',
          backgroundColor: status === 'success' ? '#4caf50' : '#ff8a00',
          color: 'white',
          border: 'none',
          cursor: isLoading ? 'default' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          fontSize: '0.8rem'
        }}
      >
        {/* Bee icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ marginRight: '5px' }}
        >
          <path d="M12 3a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.4v2.2L9 14a1 1 0 1 0 2 0v-1.5h2V14a1 1 0 1 0 2 0l-1-1.4v-2.2a4 4 0 0 0-2-7.4z"/>
          <path d="M13 15v4h2a2 2 0 0 0 2-2v-2h-4z"/>
          <path d="M11 15H7v2a2 2 0 0 0 2 2h2v-4z"/>
        </svg>
        {isLoading ? 'Syncing...' : 'Sync with Bee'}
      </button>
    );
  }

  // Full version for diagnostics page
  return (
    <div className="bee-sync-container" style={{ marginBottom: '20px' }}>
      <h3>Local Bee Node Integration</h3>
      <p>
        Connect your ReligioDAO platform to a local Bee node for full decentralized functionality.
        This will enable storage of blog content on the Swarm network.
      </p>
      
      <button 
        onClick={syncWithLocalBee}
        disabled={isLoading}
        className={`bee-sync-button ${status}`}
        style={{
          padding: '10px 16px',
          borderRadius: '4px',
          backgroundColor: '#ff8a00',
          color: 'white',
          border: 'none',
          cursor: isLoading ? 'default' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          marginBottom: '10px'
        }}
      >
        {isLoading ? 'Syncing with Bee Node...' : 'Sync with Local Bee Node'}
      </button>
      
      {message && (
        <div 
          className={`sync-message ${status}`}
          style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: status === 'error' ? '#ffebee' : 
                             status === 'success' ? '#e8f5e9' : '#fff8e1',
            color: status === 'error' ? '#c62828' : 
                   status === 'success' ? '#2e7d32' : '#f57f17',
            marginTop: '10px'
          }}
        >
          {message}
          {status === 'success' && (
            <div style={{ marginTop: '10px' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  backgroundColor: '#2e7d32',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BeeSyncButton;