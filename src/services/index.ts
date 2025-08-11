// src/services/index.ts - Service Locator and Configuration
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
}

// Default service container instance
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

// Export individual services for direct access
export const swarmService = services.swarm;
export const contentService = services.content;
export const assetService = services.assets;

// Export service classes for custom instantiation
export { SwarmService, ContentService, AssetService };

// Export types
export type { SwarmConfig, SwarmUploadResult, SwarmNodeStatus } from './SwarmService';
export type { BlogContent, ProcessedBlogContent } from './ContentService';
export type { Asset, AssetMetadata, AssetValidationResult, AssetStorageStats } from './AssetService';

/**
 * Utility function to create a configured service container
 */
export function createServices(config?: ServiceConfig): ServiceContainer {
  return new ServiceContainer(config);
}

/**
 * Utility function for service initialization in app setup
 */
export async function initializeServices(config?: ServiceConfig): Promise<ServiceContainer> {
  const container = new ServiceContainer(config);
  await container.initialize();
  return container;
}

/**
 * React hook for using services in components
 */
export function useServices(): ServiceContainer {
  return services;
}

/**
 * Service health check utility
 */
export async function checkServiceHealth(): Promise<{
  swarm: boolean;
  content: boolean;
  assets: boolean;
  overall: boolean;
}> {
  try {
    const swarmStatus = await services.swarm.getStatus();
    const swarmHealthy = swarmStatus.nodeRunning || swarmStatus.publicGateway !== '';
    
    // Test content service by trying to generate simple HTML
    let contentHealthy = true;
    try {
      const testContent = {
        title: 'Test',
        content: 'Test content',
        metadata: {
          author: 'test',
          category: 'test',
          tags: [],
          createdAt: Date.now()
        }
      };
      // Just test the HTML generation, don't upload
      await (services.content as any).generateBlogHtml(testContent);
    } catch (error) {
      contentHealthy = false;
    }
    
    // Test asset service by checking local storage
    let assetsHealthy = true;
    try {
      const stats = services.assets.getStorageStats('test');
      assetsHealthy = typeof stats === 'object';
    } catch (error) {
      assetsHealthy = false;
    }
    
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

/**
 * Development utilities
 */
export const devUtils = {
  /**
   * Reset all local data (useful for development/testing)
   */
  clearAllData(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('religiodao-') || key.startsWith('enhanced-blog-draft-')) {
          localStorage.removeItem(key);
        }
      }
      console.log('All ReligioDAO data cleared from localStorage');
    }
  },

  /**
   * Get storage usage information
   */
  getStorageInfo(): {
    totalSize: number;
    byPrefix: { [prefix: string]: number };
    availableSpace: number;
  } {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { totalSize: 0, byPrefix: {}, availableSpace: 0 };
    }

    const keys = Object.keys(localStorage);
    let totalSize = 0;
    const byPrefix: { [prefix: string]: number } = {};

    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (data) {
        const size = new Blob([data]).size;
        totalSize += size;

        // Group by prefix
        const prefix = key.split('-')[0];
        byPrefix[prefix] = (byPrefix[prefix] || 0) + size;
      }
    }

    // Estimate available space (5MB limit for localStorage)
    const availableSpace = Math.max(0, 5 * 1024 * 1024 - totalSize);

    return {
      totalSize,
      byPrefix,
      availableSpace
    };
  },

  /**
   * Test service connectivity
   */
  async testConnectivity(): Promise<void> {
    console.log('Testing service connectivity...');
    
    const swarmStatus = await services.swarm.getStatus();
    console.log('Swarm status:', swarmStatus);
    
    const gatewayTest = await services.swarm.testGatewayConnectivity();
    console.log('Gateway connectivity:', gatewayTest);
    
    const healthCheck = await checkServiceHealth();
    console.log('Service health:', healthCheck);
  }
};

// Export default container
export default services;