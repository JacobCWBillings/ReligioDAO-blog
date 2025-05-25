// src/contexts/SimpleAppContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { beeBlogService } from '../services/BeeBlogService';

/**
 * Simple app configuration interface
 */
export interface SimpleAppConfig {
  title: string;
  description: string;
  swarmGateway: string;
  postageBatchId?: string;
  defaultCategory: string;
  supportedNetworks: number[];
}

/**
 * Platform status for diagnostics
 */
export interface PlatformStatus {
  beeNodeRunning: boolean;
  hasPostageStamp: boolean;
  swarmGateway: string;
  lastChecked: number;
}

/**
 * Simple app state interface
 */
interface SimpleAppState {
  config: SimpleAppConfig;
  status: PlatformStatus;
  isInitialized: boolean;
  error: string | null;
}

/**
 * Context interface
 */
interface SimpleAppContextType {
  state: SimpleAppState;
  updateConfig: (updates: Partial<SimpleAppConfig>) => void;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
  setError: (error: string) => void;
}

// Default configuration
const defaultConfig: SimpleAppConfig = {
  title: 'ReligioDAO Blog',
  description: 'Decentralized and self-governed',
  swarmGateway: 'http://localhost:1633',
  defaultCategory: 'General',
  supportedNetworks: [35441, 35442, 35443, 100, 31337] // Q networks, Gnosis, Local
};

// Default platform status
const defaultStatus: PlatformStatus = {
  beeNodeRunning: false,
  hasPostageStamp: false,
  swarmGateway: 'http://localhost:1633',
  lastChecked: 0
};

// Create context
const SimpleAppContext = createContext<SimpleAppContextType | null>(null);

// Custom hook to use the context
export const useSimpleApp = (): SimpleAppContextType => {
  const context = useContext(SimpleAppContext);
  if (!context) {
    throw new Error('useSimpleApp must be used within a SimpleAppProvider');
  }
  return context;
};

// Provider component
interface SimpleAppProviderProps {
  children: ReactNode;
}

export const SimpleAppProvider: React.FC<SimpleAppProviderProps> = ({ children }) => {
  const [state, setState] = useState<SimpleAppState>(() => {
    // Try to load saved config from localStorage
    const savedConfig = localStorage.getItem('religiodao-simple-config');
    const config = savedConfig ? { ...defaultConfig, ...JSON.parse(savedConfig) } : defaultConfig;
    
    return {
      config,
      status: defaultStatus,
      isInitialized: false,
      error: null
    };
  });

  // Initialize the app and check platform status
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize the bee blog service
        await beeBlogService.initialize();
        
        // Check platform status
        await refreshStatus();
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: null
        }));
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: error instanceof Error ? error.message : 'Failed to initialize application'
        }));
      }
    };

    initializeApp();
  }, []);

  // Periodically check platform status
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Function to refresh platform status
  const refreshStatus = async (): Promise<void> => {
    try {
      const serviceStatus = await beeBlogService.getServiceStatus();
      
      setState(prev => ({
        ...prev,
        status: {
          beeNodeRunning: serviceStatus.nodeRunning,
          hasPostageStamp: serviceStatus.hasStamp,
          swarmGateway: serviceStatus.gateway,
          lastChecked: Date.now()
        }
      }));
    } catch (error) {
      console.error('Failed to refresh status:', error);
      
      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          beeNodeRunning: false,
          hasPostageStamp: false,
          lastChecked: Date.now()
        }
      }));
    }
  };

  // Function to update configuration
  const updateConfig = (updates: Partial<SimpleAppConfig>): void => {
    setState(prev => {
      const newConfig = { ...prev.config, ...updates };
      
      // Save to localStorage
      localStorage.setItem('religiodao-simple-config', JSON.stringify(newConfig));
      
      return {
        ...prev,
        config: newConfig
      };
    });
  };

  // Function to clear error
  const clearError = (): void => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  };

  // Function to set error
  const setError = (error: string): void => {
    setState(prev => ({
      ...prev,
      error
    }));
  };

  const contextValue: SimpleAppContextType = {
    state,
    updateConfig,
    refreshStatus,
    clearError,
    setError
  };

  return (
    <SimpleAppContext.Provider value={contextValue}>
      {children}
    </SimpleAppContext.Provider>
  );
};

// Helper hook for checking if platform is ready
export const usePlatformReady = (): boolean => {
  const { state } = useSimpleApp();
  return state.isInitialized && state.status.beeNodeRunning && state.status.hasPostageStamp;
};

// Helper hook for platform diagnostics
export const usePlatformDiagnostics = () => {
  const { state, refreshStatus } = useSimpleApp();
  
  const getDiagnosticInfo = () => {
    const { status, config, isInitialized, error } = state;
    
    return {
      overall: isInitialized && !error && status.beeNodeRunning,
      details: [
        {
          name: 'App Initialized',
          status: isInitialized ? 'OK' : 'ERROR',
          message: isInitialized ? 'Application initialized successfully' : (error || 'Initialization pending')
        },
        {
          name: 'Bee Node',
          status: status.beeNodeRunning ? 'OK' : 'ERROR',
          message: status.beeNodeRunning ? `Connected to ${config.swarmGateway}` : 'Bee node not reachable'
        },
        {
          name: 'Postage Stamp',
          status: status.hasPostageStamp ? 'OK' : 'WARNING',
          message: status.hasPostageStamp ? 'Usable postage stamp found' : 'No usable postage stamp (using fallback)'
        },
        {
          name: 'Last Check',
          status: 'INFO',
          message: status.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : 'Never'
        }
      ]
    };
  };
  
  return {
    diagnostics: getDiagnosticInfo(),
    refresh: refreshStatus
  };
};

// Component for displaying platform status
export const PlatformStatusBanner: React.FC = () => {
  const { state } = useSimpleApp();
  
  if (state.isInitialized && state.status.beeNodeRunning) {
    return null; // Don't show banner when everything is working
  }
  
  if (!state.isInitialized) {
    return (
      <div className="platform-banner initializing">
        <div className="banner-content">
          <span className="banner-icon">⏳</span>
          <span>Initializing ReligioDAO Platform...</span>
        </div>
      </div>
    );
  }
  
  if (state.error) {
    return (
      <div className="platform-banner error">
        <div className="banner-content">
          <span className="banner-icon">❌</span>
          <span>Platform Error: {state.error}</span>
        </div>
      </div>
    );
  }
  
  if (!state.status.beeNodeRunning) {
    return (
      <div className="platform-banner warning">
        <div className="banner-content">
          <span className="banner-icon">⚠️</span>
          <span>
            Bee node offline - Content publishing disabled. 
            <a 
              href="https://docs.ethswarm.org/docs/bee/installation/quick-start" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ marginLeft: '8px', color: 'inherit', textDecoration: 'underline' }}
            >
              Install Bee
            </a>
          </span>
        </div>
      </div>
    );
  }
  
  return null;
};

// CSS for the status banner (add to your main CSS file)
export const platformStatusStyles = `
.platform-banner {
  width: 100%;
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.platform-banner.initializing {
  background-color: #e3f2fd;
  color: #1565c0;
  border-bottom: 1px solid #bbdefb;
}

.platform-banner.warning {
  background-color: #fff3e0;
  color: #ef6c00;
  border-bottom: 1px solid #ffcc80;
}

.platform-banner.error {
  background-color: #ffebee;
  color: #c62828;
  border-bottom: 1px solid #ffcdd2;
}

.banner-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.banner-icon {
  font-size: 16px;
}
`;