// src/services/index.ts - CONSERVATIVE update that doesn't break existing code
import { SwarmService, SwarmConfig } from './SwarmService';
import { ContentService } from './ContentService';
import { AssetService } from './AssetService';

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  swarm?: Partial<SwarmConfig>;
  postageBatchId?: string;
  autoInitialize?: boolean;
}

/**
 * Service container for dependency injection and configuration
 */
export class ServiceContainer {
  private _swarmService: SwarmService;
  private _contentService: ContentService;
  private _assetService: AssetService;
  private _initialized: boolean = false;

  constructor(config?: ServiceConfig) {
    // Initialize SwarmService with config
    this._swarmService = new SwarmService(config?.swarm, config?.postageBatchId);
    
    // Initialize other services with SwarmService dependency
    this._contentService = new ContentService(this._swarmService);
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
   * Update configuration
   */
  updateConfig(config: ServiceConfig): void {
    if (config.swarm || config.postageBatchId) {
      this._swarmService.updateConfig(config.swarm || {}, config.postageBatchId);
      this._initialized = false; // Force re-initialization
    }
  }

  /**
   * Reset services (useful for testing)
   */
  reset(): void {
    this._initialized = false;
  }

  // ==========================================
  // SAFE CACHE MANAGEMENT METHODS
  // Only add methods that work with existing ContentService
  // ==========================================

  /**
   * Clear content cache (if ContentService has clearCache method)
   */
  clearContentCache(): void {
    try {
      // Check if the method exists before calling it
      if (this._contentService && typeof (this._contentService as any).clearCache === 'function') {
        (this._contentService as any).clearCache();
        console.log('ContentService: Cache cleared via services container');
      } else {
        console.warn('ContentService: clearCache method not available');
      }
    } catch (error) {
      console.error('Error clearing content cache:', error);
    }
  }

  /**
   * Get content cache stats (if ContentService has getCacheStats method)
   */
  getContentCacheStats(): any {
    try {
      // Check if the method exists before calling it
      if (this._contentService && typeof (this._contentService as any).getCacheStats === 'function') {
        return (this._contentService as any).getCacheStats();
      } else {
        console.warn('ContentService: getCacheStats method not available');
        return { size: 0, entries: [], message: 'Cache stats not available' };
      }
    } catch (error) {
      console.error('Error getting content cache stats:', error);
      return { size: 0, entries: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Clean expired content cache entries (if ContentService has cleanExpiredCache method)
   */
  cleanExpiredContentCache(): number {
    try {
      // Check if the method exists before calling it
      if (this._contentService && typeof (this._contentService as any).cleanExpiredCache === 'function') {
        return (this._contentService as any).cleanExpiredCache();
      } else {
        console.warn('ContentService: cleanExpiredCache method not available');
        return 0;
      }
    } catch (error) {
      console.error('Error cleaning expired content cache:', error);
      return 0;
    }
  }

  /**
   * Check if content is cached (if ContentService has isCached method)
   */
  isContentCached(contentReference: string): boolean {
    try {
      // Check if the method exists before calling it
      if (this._contentService && typeof (this._contentService as any).isCached === 'function') {
        return (this._contentService as any).isCached(contentReference);
      } else {
        // Fallback: assume not cached if method doesn't exist
        return false;
      }
    } catch (error) {
      console.error('Error checking cache status:', error);
      return false;
    }
  }

  /**
   * Force refresh content (if ContentService has forceRefreshContent method)
   */
  async forceRefreshContent(contentReference: string): Promise<string> {
    try {
      // Check if the method exists before calling it
      if (this._contentService && typeof (this._contentService as any).forceRefreshContent === 'function') {
        return await (this._contentService as any).forceRefreshContent(contentReference);
      } else {
        // Fallback: use regular getContentAsHtml method
        console.warn('ContentService: forceRefreshContent method not available, using getContentAsHtml');
        return await this._contentService.getContentAsHtml(contentReference, true);
      }
    } catch (error) {
      console.error('Error force refreshing content:', error);
      throw error;
    }
  }

  /**
   * Basic performance maintenance (safe version)
   */
  async performMaintenance(): Promise<{ message: string; cacheCleanedEntries?: number }> {
    try {
      console.log('Services: Performing basic maintenance...');
      
      // Try to clean expired cache if method exists
      let cacheCleanedEntries = 0;
      try {
        cacheCleanedEntries = this.cleanExpiredContentCache();
      } catch (error) {
        console.warn('Could not clean cache during maintenance:', error);
      }
      
      const result = {
        message: 'Basic maintenance completed',
        cacheCleanedEntries
      };
      
      console.log('Services: Maintenance completed', result);
      return result;
      
    } catch (error) {
      console.error('Service maintenance failed:', error);
      throw error;
    }
  }

  /**
   * Safe service health check
   */
  async getServiceHealth(): Promise<{
    swarm: boolean;
    content: boolean;
    assets: boolean;
    overall: boolean;
  }> {
    try {
      const swarmStatus = await this._swarmService.getStatus();
      const swarmHealthy = swarmStatus.nodeRunning || swarmStatus.publicGateway !== '';
      
      // Test content service by checking if it has basic methods
      const contentHealthy = !!(this._contentService && 
                              typeof this._contentService.getContentAsHtml === 'function');
      
      // Test asset service by checking if it has basic methods
      const assetsHealthy = !!(this._assetService && 
                              typeof this._assetService.getAssets === 'function');
      
      return {
        swarm: swarmHealthy,
        content: contentHealthy,
        assets: assetsHealthy,
        overall: swarmHealthy && contentHealthy && assetsHealthy
      };
      
    } catch (error) {
      console.error('Service health check failed:', error);
      return {
        swarm: false,
        content: false,
        assets: false,
        overall: false
      };
    }
  }
}

// Default service container instance (unchanged)
const defaultConfig: ServiceConfig = {
  swarm: {
    local: 'http://localhost:1633',
    public: 'https://api.gateway.ethswarm.org',
    fallbacks: [
      'https://gateway.ethswarm.org',
      'https://download.gateway.ethswarm.org'
    ]
  },
  autoInitialize: true
};

export const services = new ServiceContainer(defaultConfig);

// Export individual services for direct access (unchanged)
export const swarmService = services.swarm;
export const contentService = services.content;
export const assetService = services.assets;

// Export service classes for custom instantiation (unchanged)
export { SwarmService, ContentService, AssetService };

// Export types (safe - only export types that definitely exist)
export type { SwarmConfig, SwarmUploadResult, SwarmNodeStatus } from './SwarmService';
export type { BlogContent, ProcessedBlogContent } from './ContentService';
export type { Asset, AssetMetadata, AssetValidationResult, AssetStorageStats } from './AssetService';

/**
 * Utility function to create a configured service container (unchanged)
 */
export function createServices(config?: ServiceConfig): ServiceContainer {
  return new ServiceContainer(config);
}

/**
 * Utility function for service initialization in app setup (unchanged)
 */
export async function initializeServices(config?: ServiceConfig): Promise<ServiceContainer> {
  const container = new ServiceContainer(config);
  await container.initialize();
  return container;
}

/**
 * React hook for using services in components (unchanged)
 */
export function useServices(): ServiceContainer {
  return services;
}

/**
 * SAFE service health check utility
 */
export async function checkServiceHealth() {
  return await services.getServiceHealth();
}