// src/services/SwarmService.ts - UPDATED: Added uploadMarkdownContent method
import { Bee } from '@ethersphere/bee-js';

export interface SwarmConfig {
  local: string;
  public: string;
  fallbacks: string[];
}

export interface SwarmUploadResult {
  reference: string;
  tagUid?: number;
}

export interface SwarmNodeStatus {
  nodeRunning: boolean;
  hasStamp: boolean;
  gateway: string;
  publicGateway: string;
  postageBatchId: string;
  nodeAddresses?: any;
  error?: string;
}

/**
 * Pure Swarm/Bee operations service
 * ONLY handles upload/download to/from Swarm network
 * No business logic, no local storage, no draft management
 */
export class SwarmService {
  private bee: Bee;
  private postageBatchId: string;
  private config: SwarmConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<SwarmConfig>, postageBatchId?: string) {
    this.config = {
      local: config?.local || 'http://localhost:1633',
      public: config?.public || 'https://api.gateway.ethswarm.org',
      fallbacks: config?.fallbacks || [
        'https://gateway.ethswarm.org',
        'https://download.gateway.ethswarm.org'
      ]
    };
    
    this.bee = new Bee(this.config.local);
    this.postageBatchId = postageBatchId || '';
  }

  /**
   * Initialize the service and find a usable postage stamp
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.postageBatchId) return;

    try {
      // Test if node is accessible
      await this.bee.getNodeInfo();
      
      if (!this.postageBatchId) {
        try {
          const stamps = await this.bee.getAllPostageBatch();
          const usableStamp = stamps.find(stamp => stamp.usable);
          
          if (usableStamp) {
            this.postageBatchId = usableStamp.batchID;
            console.log('Found usable postage stamp:', this.postageBatchId.substring(0, 8) + '...');
          } else {
            console.warn('No usable postage stamp found - service will be limited');
            // Don't throw error, let calling code handle this gracefully
          }
        } catch (stampError) {
          console.warn('Failed to get postage stamps:', stampError);
          // Continue without stamp - some operations may still work
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize SwarmService:', error);
      // Don't throw - allow service to be created in offline mode
      this.initialized = false;
    }
  }

  /**
   * Upload a file to Swarm with proper error handling
   */
  async uploadFile(file: File): Promise<SwarmUploadResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.postageBatchId) {
      throw new Error('No postage stamp available. Please check your Bee node setup.');
    }

    try {
      // Validate file
      if (!(file instanceof File)) {
        throw new Error('Expected File object for upload');
      }

      if (file.size === 0) {
        throw new Error('Cannot upload empty file');
      }

      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        throw new Error('File too large (max 100MB)');
      }

      console.log(`Uploading file: ${file.name} (${file.size} bytes)`);

      // Upload using bee-js with proper error handling
      const uploadResult = await this.bee.uploadFile(
        this.postageBatchId,
        file,
        undefined, // filename (will use file.name)
        {
          contentType: file.type,
          size: file.size
        }
      );

      console.log('Upload successful:', uploadResult.reference);

      return {
        reference: uploadResult.reference,
        tagUid: uploadResult.tagUid
      };

    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('postage')) {
          throw new Error('Postage stamp error: Please check your Bee node postage stamps');
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          throw new Error('Network error: Please check your Bee node connection');
        } else {
          throw new Error(`Upload failed: ${error.message}`);
        }
      } else {
        throw new Error('Unknown upload error');
      }
    }
  }

  /**
   * Upload content as HTML file with proper type handling
   */
  async uploadHtmlContent(htmlContent: string, filename: string = 'index.html'): Promise<SwarmUploadResult> {
    try {
      // Convert string to bytes and create File object
      const htmlBytes = new TextEncoder().encode(htmlContent);
      // FIXED: Create proper File with explicit type for Blob constructor
      const file = new File([htmlBytes as BlobPart], filename, { 
        type: 'text/html',
        lastModified: Date.now()
      });

      return await this.uploadFile(file);

    } catch (error) {
      console.error('Error uploading HTML content:', error);
      throw new Error(`Failed to upload HTML content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * NEW: Upload content as markdown file
   * FIXED: This avoids Swarm's website hosting restrictions for index.html
   */
  async uploadMarkdownContent(markdownContent: string, filename: string = 'blog-content.md'): Promise<SwarmUploadResult> {
    try {
      // Convert string to bytes and create File object
      const markdownBytes = new TextEncoder().encode(markdownContent);
      const file = new File([markdownBytes as BlobPart], filename, { 
        type: 'text/markdown',
        lastModified: Date.now()
      });

      return await this.uploadFile(file);

    } catch (error) {
      console.error('Error uploading markdown content:', error);
      throw new Error(`Failed to upload markdown content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON data as a file
   */
  async uploadJsonData(data: any, filename: string = 'data.json'): Promise<SwarmUploadResult> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const jsonBytes = new TextEncoder().encode(jsonString);
      // FIXED: Create proper File with explicit type for Blob constructor
      const file = new File([jsonBytes as BlobPart], filename, { 
        type: 'application/json',
        lastModified: Date.now()
      });

      return await this.uploadFile(file);

    } catch (error) {
      console.error('Error uploading JSON data:', error);
      throw new Error(`Failed to upload JSON data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload raw data bytes
   */
  async uploadData(data: Uint8Array, filename: string, contentType: string): Promise<SwarmUploadResult> {
    try {
      // FIXED: Create proper File with explicit type for Blob constructor
      const file = new File([data as BlobPart], filename, { 
        type: contentType,
        lastModified: Date.now()
      });

      return await this.uploadFile(file);

    } catch (error) {
      console.error('Error uploading raw data:', error);
      throw new Error(`Failed to upload data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download data from Swarm with fallback gateways
   */
  async downloadData(reference: string): Promise<Uint8Array> {
    if (!reference || reference.length !== 64) {
      throw new Error('Invalid Swarm reference');
    }

    const gateways = [this.config.local, this.config.public, ...this.config.fallbacks];
    const errors: string[] = [];

    for (const gateway of gateways) {
      try {
        console.log(`Attempting download from ${gateway}...`);
        const bee = new Bee(gateway);
        const data = await bee.downloadData(reference);
        console.log(`Successfully downloaded from ${gateway}`);
        return data;

      } catch (error) {
        const errorMsg = `${gateway}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(`Failed to download from ${gateway}:`, error);
        continue;
      }
    }

    throw new Error(`Failed to download from all gateways:\n${errors.join('\n')}`);
  }

  /**
   * Download data as text
   */
  async downloadText(reference: string): Promise<string> {
    const data = await this.downloadData(reference);
    return new TextDecoder().decode(data);
  }

  /**
   * Download data as JSON
   */
  async downloadJson(reference: string): Promise<any> {
    const text = await this.downloadText(reference);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Downloaded data is not valid JSON');
    }
  }

  /**
   * Generate URLs for content access
   */
  getContentUrl(reference: string, usePublicGateway: boolean = false, endpoint: 'bzz' | 'bytes' = 'bytes'): string {
    if (!reference || reference.length !== 64) {
      throw new Error('Invalid Swarm reference');
    }

    const gateway = usePublicGateway ? this.config.public : this.config.local;
    return `${gateway}/${endpoint}/${reference}`;
  }

  /**
   * Generate multiple URLs for content with different gateways/endpoints
   */
  getContentUrls(reference: string): {
    local: string;
    localWeb: string;
    public: string;
    publicWeb: string;
    fallbacks: string[];
  } {
    if (!reference || reference.length !== 64) {
      throw new Error('Invalid Swarm reference');
    }

    return {
      local: `${this.config.local}/bytes/${reference}`,
      localWeb: `${this.config.local}/bzz/${reference}`,
      public: `${this.config.public}/bytes/${reference}`,
      publicWeb: `${this.config.public}/bzz/${reference}`,
      fallbacks: this.config.fallbacks.map(gateway => `${gateway}/bytes/${reference}`)
    };
  }

  /**
   * Check accessibility of content across gateways
   */
  async validateContentAccess(reference: string): Promise<{
    workingUrls: string[];
    failedUrls: string[];
    isAccessible: boolean;
  }> {
    const urls = this.getContentUrls(reference);
    const allUrls = [urls.local, urls.public, ...urls.fallbacks];
    
    const workingUrls: string[] = [];
    const failedUrls: string[] = [];

    await Promise.allSettled(
      allUrls.map(async (url) => {
        try {
          const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            workingUrls.push(url);
          } else {
            failedUrls.push(url);
          }
        } catch (error) {
          failedUrls.push(url);
        }
      })
    );

    return {
      workingUrls,
      failedUrls,
      isAccessible: workingUrls.length > 0
    };
  }

  /**
   * Get comprehensive service status
   */
  async getStatus(): Promise<SwarmNodeStatus> {
    try {
      // Test local node connectivity
      const nodeInfo = await this.bee.getNodeInfo();
      
      // Check postage stamps
      let hasStamp = false;
      let stamps: any[] = [];
      
      try {
        stamps = await this.bee.getAllPostageBatch();
        hasStamp = stamps.some(stamp => stamp.usable);
      } catch (stampError) {
        console.warn('Could not fetch postage stamps:', stampError);
      }

      // Get node addresses
      let nodeAddresses;
      try {
        nodeAddresses = await this.bee.getNodeAddresses();
      } catch (addrError) {
        console.warn('Could not fetch node addresses:', addrError);
      }

      return {
        nodeRunning: true,
        hasStamp,
        gateway: this.config.local,
        publicGateway: this.config.public,
        postageBatchId: this.postageBatchId,
        nodeAddresses
      };

    } catch (error) {
      return {
        nodeRunning: false,
        hasStamp: false,
        gateway: this.config.local,
        publicGateway: this.config.public,
        postageBatchId: this.postageBatchId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SwarmConfig & { postageBatchId: string; initialized: boolean } {
    return {
      ...this.config,
      postageBatchId: this.postageBatchId,
      initialized: this.initialized
    };
  }

  /**
   * Update configuration (creates new Bee instance)
   */
  updateConfig(newConfig: Partial<SwarmConfig>, newPostageBatchId?: string): void {
    this.config = { ...this.config, ...newConfig };
    this.bee = new Bee(this.config.local);
    
    if (newPostageBatchId) {
      this.postageBatchId = newPostageBatchId;
    }
    
    // Reset initialization flag to force re-init with new config
    this.initialized = false;
  }

  /**
   * Test connectivity to all configured gateways
   */
  async testGatewayConnectivity(): Promise<{
    [gateway: string]: { accessible: boolean; responseTime?: number; error?: string; }
  }> {
    const allGateways = [this.config.local, this.config.public, ...this.config.fallbacks];
    const results: { [gateway: string]: { accessible: boolean; responseTime?: number; error?: string; } } = {};

    await Promise.allSettled(
      allGateways.map(async (gateway) => {
        const startTime = Date.now();
        try {
          const bee = new Bee(gateway);
          await bee.getNodeInfo();
          results[gateway] = {
            accessible: true,
            responseTime: Date.now() - startTime
          };
        } catch (error) {
          results[gateway] = {
            accessible: false,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return results;
  }
}