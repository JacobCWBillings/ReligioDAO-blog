// src/contexts/SimpleAppContext.tsx - ENHANCED VERSION
// Unified management of both Swarm and Blockchain services
import React, { createContext, useContext, useState, useEffect } from 'react';
import { services } from '../swarm/services';
import { NFTMintingService } from '../blockchain/services/NFTMintingService';
import { ProposalService } from '../blockchain/services/ProposalService';
import { useWallet } from './WalletContext';

/**
 * Enhanced configuration interface for the simple app
 * Maintains backward compatibility with Header.tsx and other components
 */
export interface SimpleAppConfig {
  // App branding (used by Header component)
  title: string;
  description: string;
  defaultCategory: string;
  supportedNetworks: number[];
  
  // Swarm configuration
  swarmGateway: string;
  publicGateway: string;
  postageBatchId: string;
  
  // Enhanced features
  autoRefreshInterval: number;
}

/**
 * Enhanced status interface including blockchain services
 */
export interface SimpleAppStatus {
  // Swarm services status
  beeNodeRunning: boolean;
  hasPostageStamp: boolean;
  swarmGateway: string;
  publicGateway: string;
  initialized: boolean;
  lastChecked: number;
  
  // Blockchain services status
  blockchainInitialized: boolean;
  blockchainError: string | null;
  pipelineAvailable: boolean;
  walletConnected: boolean;
  chainId: number | null;
}

/**
 * Enhanced state interface
 */
export interface SimpleAppState {
  config: SimpleAppConfig;
  status: SimpleAppStatus;
  isInitialized: boolean;
  error: string | null;
  
  // Blockchain service instances (when available)
  nftMintingService: NFTMintingService | null;
  proposalService: ProposalService | null;
}

/**
 * Enhanced context interface
 */
export interface SimpleAppContextType {
  state: SimpleAppState;
  updateConfig: (updates: Partial<SimpleAppConfig>) => void;
  refreshStatus: () => Promise<void>;
  refreshBlockchainServices: () => Promise<void>;
  clearError: () => void;
  setError: (error: string) => void;
}

const SimpleAppContext = createContext<SimpleAppContextType | null>(null);

export const useSimpleApp = (): SimpleAppContextType => {
  const context = useContext(SimpleAppContext);
  if (!context) {
    throw new Error('useSimpleApp must be used within SimpleAppProvider');
  }
  return context;
};

// Default configuration - includes all backward compatibility properties
const defaultConfig: SimpleAppConfig = {
  // App branding
  title: 'ReligioDAO Blog',
  description: 'Decentralized and self-governed',
  defaultCategory: 'General',
  supportedNetworks: [35441, 35442, 35443, 100, 31337], // Q networks, Gnosis, Local
  
  // Swarm configuration
  swarmGateway: 'http://localhost:1633',
  publicGateway: 'https://api.gateway.ethswarm.org',
  postageBatchId: '',
  
  // Enhanced features
  autoRefreshInterval: 30000
};

// Default status
const defaultStatus: SimpleAppStatus = {
  beeNodeRunning: false,
  hasPostageStamp: false,
  swarmGateway: defaultConfig.swarmGateway,
  publicGateway: defaultConfig.publicGateway,
  initialized: false,
  lastChecked: 0,
  blockchainInitialized: false,
  blockchainError: null,
  pipelineAvailable: false,
  walletConnected: false,
  chainId: null
};

interface SimpleAppProviderProps {
  children: React.ReactNode;
}

export const SimpleAppProvider: React.FC<SimpleAppProviderProps> = ({ children }) => {
  // Get wallet state for blockchain service coordination
  const { provider, signer, chainId, isConnected } = useWallet();
  
  const [state, setState] = useState<SimpleAppState>(() => {
    // Load saved configuration with backward compatibility
    const savedConfig = localStorage.getItem('religiodao-simple-config');
    let config = defaultConfig;
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Merge with defaults to ensure all properties exist
        config = { ...defaultConfig, ...parsed };
      } catch (error) {
        console.warn('Failed to parse saved config, using defaults:', error);
      }
    }
    
    return {
      config,
      status: {
        ...defaultStatus,
        walletConnected: false,
        chainId: null
      },
      isInitialized: false,
      error: null,
      nftMintingService: null,
      proposalService: null
    };
  });

  // Initialize Swarm services on mount
  useEffect(() => {
    const initializeSwarmServices = async () => {
      try {
        console.log('Initializing ReligioDAO Swarm services...');
        
        // Initialize the unified service architecture
        await services.initialize();
        
        // Check Swarm status
        await refreshStatus();
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: null
        }));

        console.log('ReligioDAO Swarm services initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Swarm services:', error);
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: error instanceof Error ? error.message : 'Failed to initialize Swarm services'
        }));
      }
    };

    initializeSwarmServices();
  }, []);

  // Initialize blockchain services when wallet connects/changes
  useEffect(() => {
    const initializeBlockchainServices = async () => {
      if (!isConnected || !provider || !chainId) {
        // Clear blockchain services when wallet disconnects
        setState(prev => ({
          ...prev,
          status: {
            ...prev.status,
            blockchainInitialized: false,
            blockchainError: null,
            pipelineAvailable: false,
            walletConnected: false,
            chainId: null
          },
          nftMintingService: null,
          proposalService: null
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          walletConnected: true,
          chainId: chainId,
          blockchainError: 'Initializing blockchain services...'
        }
      }));

      try {
        console.log('Initializing blockchain services for chain:', chainId);

        // Create service instances with wallet provider
        const signerOrUndefined = signer || undefined;
        const nftMintingService = new NFTMintingService(provider, signerOrUndefined);
        const proposalService = new ProposalService(provider, signerOrUndefined);

        // Initialize services with network configuration
        await nftMintingService.init(chainId);
        await proposalService.init(chainId);

        // Register with the unified service container
        services.initializeBlockchainServices(nftMintingService, proposalService);

        // Check if pipeline is now available
        const pipelineAvailable = services.hasPipeline;

        setState(prev => ({
          ...prev,
          status: {
            ...prev.status,
            blockchainInitialized: true,
            blockchainError: null,
            pipelineAvailable
          },
          nftMintingService,
          proposalService
        }));

        console.log('Blockchain services initialized successfully', {
          pipelineAvailable,
          chainId
        });

      } catch (error) {
        console.error('Failed to initialize blockchain services:', error);
        setState(prev => ({
          ...prev,
          status: {
            ...prev.status,
            blockchainInitialized: false,
            blockchainError: error instanceof Error ? error.message : 'Failed to initialize blockchain services',
            pipelineAvailable: false
          },
          nftMintingService: null,
          proposalService: null
        }));
      }
    };

    initializeBlockchainServices();
  }, [isConnected, provider, signer, chainId]);

  // Periodically check platform status
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatus();
    }, state.config.autoRefreshInterval);

    return () => clearInterval(interval);
  }, [state.config.autoRefreshInterval]);

  // Function to refresh Swarm status
  const refreshStatus = async (): Promise<void> => {
    try {
      const serviceStatus = await services.getStatus();
      
      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          beeNodeRunning: serviceStatus.nodeRunning,
          hasPostageStamp: serviceStatus.hasStamp,
          swarmGateway: serviceStatus.gateway,
          publicGateway: serviceStatus.publicGateway,
          initialized: services.isInitialized,
          lastChecked: Date.now()
        }
      }));
    } catch (error) {
      console.error('Failed to refresh Swarm status:', error);
      
      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          beeNodeRunning: false,
          hasPostageStamp: false,
          initialized: services.isInitialized,
          lastChecked: Date.now()
        }
      }));
    }
  };

  // Function to refresh blockchain services
  const refreshBlockchainServices = async (): Promise<void> => {
    if (!isConnected || !provider || !chainId) {
      return;
    }

    try {
      console.log('Refreshing blockchain services...');
      
      // Re-initialize blockchain services
      const signerOrUndefined = signer || undefined;
      const nftMintingService = new NFTMintingService(provider, signerOrUndefined);
      const proposalService = new ProposalService(provider, signerOrUndefined);

      await nftMintingService.init(chainId);
      await proposalService.init(chainId);

      services.initializeBlockchainServices(nftMintingService, proposalService);

      const pipelineAvailable = services.hasPipeline;

      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          blockchainInitialized: true,
          blockchainError: null,
          pipelineAvailable
        },
        nftMintingService,
        proposalService
      }));

      console.log('Blockchain services refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh blockchain services:', error);
      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          blockchainInitialized: false,
          blockchainError: error instanceof Error ? error.message : 'Failed to refresh blockchain services',
          pipelineAvailable: false
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
      
      // Update service configuration if needed
      if (updates.swarmGateway || updates.postageBatchId) {
        services.updateConfig({
          swarm: {
            local: updates.swarmGateway || prev.config.swarmGateway
          },
          postageBatchId: updates.postageBatchId
        });
      }
      
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
    refreshBlockchainServices,
    clearError,
    setError
  };

  return (
    <SimpleAppContext.Provider value={contextValue}>
      {children}
    </SimpleAppContext.Provider>
  );
};

// Enhanced helper hooks
export const usePlatformReady = (): boolean => {
  const { state } = useSimpleApp();
  return (
    state.isInitialized && 
    state.status.initialized &&
    (state.status.beeNodeRunning || state.status.publicGateway !== '')
  );
};

export const useBlockchainReady = (): boolean => {
  const { state } = useSimpleApp();
  return (
    state.status.blockchainInitialized &&
    state.status.pipelineAvailable &&
    state.nftMintingService !== null &&
    state.proposalService !== null
  );
};

export const usePlatformDiagnostics = () => {
  const { state, refreshStatus, refreshBlockchainServices } = useSimpleApp();
  
  const getDiagnosticInfo = () => {
    const { status, config, isInitialized, error } = state;
    
    return {
      overall: isInitialized && !error && status.initialized && 
               (status.beeNodeRunning || status.publicGateway !== ''),
      swarmReady: status.beeNodeRunning || Boolean(status.publicGateway),
      blockchainReady: status.blockchainInitialized && status.pipelineAvailable,
      details: [
        {
          name: 'App Initialized',
          status: isInitialized ? 'OK' : 'ERROR',
          message: isInitialized ? 'Application initialized successfully' : (error || 'Initialization pending')
        },
        {
          name: 'Swarm Services',
          status: status.initialized ? 'OK' : 'ERROR',
          message: status.initialized ? 'Swarm service architecture initialized' : 'Swarm services not initialized'
        },
        {
          name: 'Bee Node',
          status: status.beeNodeRunning ? 'OK' : 'WARNING',
          message: status.beeNodeRunning ? `Connected to ${config.swarmGateway}` : 'Local Bee node not reachable (using public gateway)'
        },
        {
          name: 'Public Gateway',
          status: status.publicGateway ? 'OK' : 'WARNING',
          message: status.publicGateway ? `Available: ${status.publicGateway}` : 'No public gateway configured'
        },
        {
          name: 'Postage Stamp',
          status: status.hasPostageStamp ? 'OK' : 'WARNING',
          message: status.hasPostageStamp ? 'Usable postage stamp found' : 'No usable postage stamp (limited functionality)'
        },
        {
          name: 'Wallet Connection',
          status: status.walletConnected ? 'OK' : 'WARNING',
          message: status.walletConnected ? `Connected to chain ${status.chainId}` : 'No wallet connected (governance unavailable)'
        },
        {
          name: 'Blockchain Services',
          status: status.blockchainInitialized ? 'OK' : (status.walletConnected ? 'ERROR' : 'WARNING'),
          message: status.blockchainInitialized ? 'Blockchain services ready' : 
                   (status.blockchainError || (status.walletConnected ? 'Failed to initialize' : 'Wallet required'))
        },
        {
          name: 'Content Pipeline',
          status: status.pipelineAvailable ? 'OK' : 'WARNING',
          message: status.pipelineAvailable ? 'Full pipeline available' : 'Limited to Swarm publishing only'
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
    refreshSwarm: refreshStatus,
    refreshBlockchain: refreshBlockchainServices
  };
};

// Component for displaying platform status
export const PlatformStatusBanner: React.FC = () => {
  const { state } = useSimpleApp();
  
  // Only show critical errors that prevent core functionality
  if (state.error) {
    return (
      <div className="platform-banner error">
        <div className="banner-content">
          <span className="banner-icon">⚠️</span>
          <span>Platform Error: {state.error}</span>
        </div>
      </div>
    );
  }
  
  // Show initialization status
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
  
  // No banner for normal operation
  return null;
};

// CSS styles remain the same as before
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