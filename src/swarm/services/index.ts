// src/services/index.ts
import { SwarmService } from './SwarmService';
import { ContentService } from './ContentService';
import { AssetService } from './AssetService';
import { ContentPipeline } from './ContentPipeline';
import { NFTMintingService } from '../../blockchain/services/NFTMintingService';
import { ProposalService } from '../../blockchain/services/ProposalService';
import { ServiceConfig } from '../../types/contentTypes';

/**
 * Integrated service container
 * Provides centralized access to all services with proper dependency injection
 */
export class ServiceContainer {
  // Core Swarm services
  private _swarmService: SwarmService;
  private _contentService: ContentService;
  private _assetService: AssetService;
  
  // Blockchain services (optional, initialized on demand)
  private _nftMintingService?: NFTMintingService;
  private _proposalService?: ProposalService;
  
  // Integration layer
  private _contentPipeline?: ContentPipeline;
  
  private _initialized: boolean = false;

  constructor(config?: ServiceConfig) {
    // Initialize core services
    this._swarmService = new SwarmService(
      config?.swarm,
      config?.postageBatchId
    );
    
    this._contentService = new ContentService(
      this._swarmService,
      config?.cacheExpiryMinutes || 30
    );
    
    this._assetService = new AssetService(this._swarmService);
    
    // Auto-initialize if requested
    if (config?.autoInitialize !== false) {
      this.initialize().catch(error => {
        console.error('Failed to auto-initialize services:', error);
      });
    }
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    try {
      await this._swarmService.initialize();
      this._initialized = true;
      console.log('Services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get SwarmService instance
   */
  get swarm(): SwarmService {
    return this._swarmService;
  }

  /**
   * Get ContentService instance
   */
  get content(): ContentService {
    return this._contentService;
  }

  /**
   * Get AssetService instance
   */
  get assets(): AssetService {
    return this._assetService;
  }

  /**
   * Get or create ContentPipeline
   */
  get pipeline(): ContentPipeline {
    if (!this._contentPipeline) {
      if (!this._nftMintingService || !this._proposalService) {
        throw new Error('Blockchain services must be initialized before accessing pipeline');
      }
      
      this._contentPipeline = new ContentPipeline(
        this._contentService,
        this._assetService,
        this._nftMintingService,
        this._proposalService
      );
    }
    
    return this._contentPipeline;
  }

  /**
   * Initialize blockchain services
   */
  initializeBlockchainServices(
    nftMintingService: NFTMintingService,
    proposalService: ProposalService
  ): void {
    this._nftMintingService = nftMintingService;
    this._proposalService = proposalService;
    
    // Create pipeline if both services are available
    if (this._nftMintingService && this._proposalService) {
      this._contentPipeline = new ContentPipeline(
        this._contentService,
        this._assetService,
        this._nftMintingService,
        this._proposalService
      );
    }
  }

  /**
   * Check if services are initialized
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get service status
   */
  async getStatus() {
    return await this._swarmService.getStatus();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this._contentService.clearCache();
    console.log('Content cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this._contentService.getCacheStats();
  }

  /**
   * Force refresh content
   */
  async forceRefreshContent(reference: string): Promise<string> {
    return await this._contentService.forceRefreshContent(reference);
  }

  /**
   * Update configuration
   */
  updateConfig(config: ServiceConfig): void {
    if (config.swarm || config.postageBatchId) {
      this._swarmService.updateConfig(
        config.swarm || {},
        config.postageBatchId
      );
      this._initialized = false;
    }
  }
}

// Default service configuration
const defaultConfig: ServiceConfig = {
  swarm: {
    local: 'http://localhost:1633',
    public: 'https://api.gateway.ethswarm.org',
    fallbacks: [
      'https://gateway.ethswarm.org',
      'https://download.gateway.ethswarm.org'
    ]
  },
  autoInitialize: true,
  cacheExpiryMinutes: 30
};

// Create and export default service container
export const services = new ServiceContainer(defaultConfig);

// Export individual services for direct access
export const swarmService = services.swarm;
export const contentService = services.content;
export const assetService = services.assets;

// Export service classes for custom instantiation
export { SwarmService, ContentService, AssetService, ContentPipeline };

// Export utility function for creating configured containers
export function createServices(config?: ServiceConfig): ServiceContainer {
  return new ServiceContainer(config);
}

// Export initialization helper
export async function initializeServices(
  config?: ServiceConfig
): Promise<ServiceContainer> {
  const container = new ServiceContainer(config);
  await container.initialize();
  return container;
}

// Export React hook for using services
export function useServices(): ServiceContainer {
  return services;
}