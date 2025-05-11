// src/components/DiagnosticPanel.tsx
import React, { useState, useEffect } from 'react';

interface DiagnosticInfo {
  environment: {
    userAgent: string;
    protocol: string;
    host: string;
    path: string;
    nodeEnv: string;
    publicUrl: string;
  };
  localStorage: {
    available: boolean;
    itemCount: number;
    hasState: boolean;
    stateKeys: string[];
  };
  runtime: {
    memoryUsage?: number;
    platform: string;
    isOnline: boolean;
  };
  swarm: {
    beeRunning: boolean;
    hasPostageStamp: boolean;
    beeApi: string;
  };
}

interface DiagnosticPanelProps {
  isBeeRunning: boolean;
  hasPostageStamp: boolean;
  globalState: any | null;
  isVisible: boolean;
  onClose: () => void;
}

const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ 
  isBeeRunning, 
  hasPostageStamp,
  globalState,
  isVisible,
  onClose
}) => {
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(null);
  
  useEffect(() => {
    if (isVisible) {
      gatherDiagnostics();
    }
  }, [isVisible]);
  
  const gatherDiagnostics = () => {
    try {
      // Check localStorage availability
      let localStorageAvailable = false;
      try {
        const test = "test";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        localStorageAvailable = true;
      } catch(e) {
        localStorageAvailable = false;
      }
      
      // Get state keys if available
      let stateKeys: string[] = [];
      let hasState = false;
      if (localStorageAvailable && localStorage.getItem('state')) {
        hasState = true;
        try {
          const parsedState = JSON.parse(localStorage.getItem('state')!);
          stateKeys = Object.keys(parsedState);
        } catch (e) {
          stateKeys = ["Error parsing state"];
        }
      }
      
      // Create diagnostic info object
      const info: DiagnosticInfo = {
        environment: {
          userAgent: navigator.userAgent,
          protocol: window.location.protocol,
          host: window.location.host,
          path: window.location.pathname,
          nodeEnv: process.env.NODE_ENV || 'unknown',
          publicUrl: process.env.PUBLIC_URL || '/',
        },
        localStorage: {
          available: localStorageAvailable,
          itemCount: localStorageAvailable ? Object.keys(localStorage).length : 0,
          hasState,
          stateKeys,
        },
        runtime: {
          platform: navigator.platform,
          isOnline: navigator.onLine,
        },
        swarm: {
          beeRunning: isBeeRunning,
          hasPostageStamp,
          beeApi: globalState?.beeApi || 'unknown',
        }
      };
      
      setDiagnosticInfo(info);
    } catch (e) {
      console.error("Error gathering diagnostics:", e);
    }
  };
  
  if (!isVisible) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px',
          background: '#f0f0f0',
          padding: '5px 10px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '10px',
          opacity: 0.6
        }}
        onClick={() => onClose()}
      >
        Diagnostics Available (Ctrl+Shift+D)
      </div>
    );
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 9999,
        padding: '20px',
        overflow: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          borderRadius: '5px',
          maxWidth: '800px',
          margin: '0 auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2>ReligioDAO Diagnostics</h2>
          <button onClick={onClose}>Close</button>
        </div>
        
        {diagnosticInfo ? (
          <div>
            <section>
              <h3>Environment</h3>
              <pre>{JSON.stringify(diagnosticInfo.environment, null, 2)}</pre>
            </section>
            
            <section>
              <h3>LocalStorage</h3>
              <pre>{JSON.stringify(diagnosticInfo.localStorage, null, 2)}</pre>
            </section>
            
            <section>
              <h3>Runtime</h3>
              <pre>{JSON.stringify(diagnosticInfo.runtime, null, 2)}</pre>
            </section>
            
            <section>
              <h3>Swarm</h3>
              <pre>{JSON.stringify(diagnosticInfo.swarm, null, 2)}</pre>
            </section>
            
            <div style={{ marginTop: '20px' }}>
              <button onClick={gatherDiagnostics}>Refresh Diagnostics</button>
              <button 
                onClick={() => {
                  localStorage.removeItem('state');
                  window.location.reload();
                }}
                style={{ marginLeft: '10px', backgroundColor: '#ffcccc' }}
              >
                Clear State & Reload
              </button>
            </div>
          </div>
        ) : (
          <p>Loading diagnostics...</p>
        )}
      </div>
    </div>
  );
};

export default DiagnosticPanel;