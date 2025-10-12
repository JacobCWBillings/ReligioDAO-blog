// src/services/SwarmService.ts
import { Bee, Data, FileData, UploadResult } from '@ethersphere/bee-js';
import {
  buildSwarmUrl,
  cleanSwarmReference,
  isValidSwarmReference,
  getEndpointForContent,
  DEFAULT_GATEWAYS,
  SWARM_LIMITS,
  processMarkdownUrls
} from '../utils/swarmUtils';
import {
  SwarmConfig,
  SwarmUploadResult,
  SwarmDownloadOptions
} from '../../types/contentTypes';

export interface SwarmNodeStatus {
  nodeRunning: boolean;
  hasStamp: boolean;
  gateway: string;
  publicGateway: string;
  postageBatchId?: string;
  nodeAddresses?: any;
  error?: string;
}

/**
 * Core Swarm service for all network operations
 * Handles uploads, downloads, and gateway management
 */
export class SwarmService {
  private bee: Bee;
  private postageBatchId: string = '';
  private isInitialized: boolean = false;
  
  public config: SwarmConfig;

  constructor(config?: Partial<SwarmConfig>, postageBatchId?: string) {
    this.config = {
      local: config?.local || DEFAULT_GATEWAYS.local,
      public: config?.public || DEFAULT_GATEWAYS.public,
      fallbacks: config?.fallbacks || DEFAULT_GATEWAYS.fallbacks,
      postageBatchId: config?.postageBatchId || postageBatchId
    };
    
    this.bee = new Bee(this.config.local);
    this.postageBatchId = postageBatchId || '';
  }

  /**
   * Initialize the service and check node connectivity
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Check node connectivity
      const nodeInfo = await this.bee.getNodeInfo();
      console.log('Connected to Bee node:', nodeInfo);
      
      // Get or create postage stamp
      if (!this.postageBatchId) {
        await this.ensurePostageStamp();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SwarmService:', error);
      // Continue with public gateway fallback
      this.isInitialized = true;
    }
  }

  /**
   * Ensure we have a usable postage stampbytes
   */
  private async ensurePostageStamp(): Promise<void> {
    try {
      const stamps = await this.bee.getAllPostageBatch();
      const usableStamp = stamps.find(stamp => 
        stamp.usable && stamp.depth >= 20
      );
      
      if (usableStamp) {
        this.postageBatchId = usableStamp.batchID;
        console.log('Found usable postage stamp:', this.postageBatchId);
      } else {
        console.warn('No usable postage stamp found');
      }
    } catch (error) {
      console.warn('Could not fetch postage stamps:', error);
    }
  }

  /**
   * Upload a file to Swarm
   */
  async uploadFile(file: File): Promise<SwarmUploadResult> {
    try {
      await this.initialize();
      
      // Validate file size
      if (file.size > SWARM_LIMITS.MAX_FILE_SIZE) {
        throw new Error(`File exceeds maximum size of ${SWARM_LIMITS.MAX_FILE_SIZE} bytes`);
      }
      
      // Try local node first
      if (this.postageBatchId) {
        try {
          const result = await this.bee.uploadFile(
            this.postageBatchId,
            file,
            file.name,
            { contentType: file.type }
          );
          
          const endpoint = getEndpointForContent(file.type);
          const url = buildSwarmUrl(result.reference, this.config.local, { endpoint });
          
          console.log(`File uploaded to local node: ${result.reference}`);
          
          return {
            reference: result.reference,
            tagUid: result.tagUid,
            url
          };
        } catch (localError) {
          console.warn('Local upload failed, trying public gateway:', localError);
        }
      }
      
      // Fallback to public gateway
      return await this.uploadToPublicGateway(file);
      
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload content as a file
   */
  async uploadContent(
    content: string | Uint8Array,
    filename: string,
    contentType: string = 'text/plain'
  ): Promise<SwarmUploadResult> {
    const bytes = typeof content === 'string' 
      ? new TextEncoder().encode(content)
      : content;
    
    const file = new File([bytes.buffer as ArrayBuffer], filename, { 
      type: contentType,
      lastModified: Date.now()
    });
    
    return this.uploadFile(file);
  }

  /**
   * Upload JSON data
   */
  async uploadJson(data: any, filename: string = 'data.json'): Promise<SwarmUploadResult> {
    const jsonString = JSON.stringify(data, null, 2);
    return this.uploadContent(jsonString, filename, 'application/json');
  }

  /**
   * Download data from Swarm with fallback gateways
   */
  async downloadData(
    reference: string,
    options: SwarmDownloadOptions = {}
  ): Promise<Uint8Array> {
    const cleanRef = cleanSwarmReference(reference);
    
    if (!isValidSwarmReference(cleanRef)) {
      throw new Error(`Invalid Swarm reference: ${reference}`);
    }
    
    const timeout = options.timeout || SWARM_LIMITS.DEFAULT_TIMEOUT;
    const gateways = [this.config.local, this.config.public, ...this.config.fallbacks];
    const errors: string[] = [];
    
    for (const gateway of gateways) {
      try {
        // Determine endpoint based on usage
        const endpoint = options.forWebDisplay !== false ? 'bzz' : 'bytes';
        
        // Build URL with optional filename for collection access
        const url = buildSwarmUrl(cleanRef, gateway, {
          endpoint,
          filename: options.filename
        });
        
        console.log(`Attempting download from: ${url}`);
        
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeout)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        console.log(`Successfully downloaded ${buffer.byteLength} bytes from ${gateway}`);
        
        return new Uint8Array(buffer);
        
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
   * Download text content
   */
  async downloadText(
    reference: string,
    filename?: string
  ): Promise<string> {
    const data = await this.downloadData(reference, { 
      filename,
      forWebDisplay: true 
    });
    return new TextDecoder().decode(data);
  }

  /**
   * Download JSON data
   */
  async downloadJson(
    reference: string,
    filename?: string
  ): Promise<any> {
    const text = await this.downloadText(reference, filename);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Downloaded data is not valid JSON');
    }
  }

  /**
   * Get URL for content
   */
  getContentUrl(
    reference: string,
    options: {
      usePublicGateway?: boolean;
      forWebDisplay?: boolean;
      filename?: string;
    } = {}
  ): string {
    const gateway = options.usePublicGateway 
      ? this.config.public 
      : this.config.local;
    
    const endpoint = options.forWebDisplay !== false ? 'bzz' : 'bytes';
    
    return buildSwarmUrl(reference, gateway, {
      endpoint,
      filename: options.filename
    });
  }

  /**
   * Get multiple URLs for content with fallbacks
   */
  getContentUrls(
    reference: string,
    filename?: string
  ): {
    local: string;
    public: string;
    fallbacks: string[];
  } {
    const cleanRef = cleanSwarmReference(reference);
    
    return {
      local: buildSwarmUrl(cleanRef, this.config.local, { 
        endpoint: 'bzz', 
        filename 
      }),
      public: buildSwarmUrl(cleanRef, this.config.public, { 
        endpoint: 'bzz', 
        filename 
      }),
      fallbacks: this.config.fallbacks.map(gateway =>
        buildSwarmUrl(cleanRef, gateway, { 
          endpoint: 'bzz', 
          filename 
        })
      )
    };
  }

  /**
   * Upload to public gateway (fallback)
   */
  private async uploadToPublicGateway(file: File): Promise<SwarmUploadResult> {
    // Note: This would require a public gateway that accepts uploads
    // Most public gateways are read-only, so this is a placeholder
    throw new Error('Public gateway upload not implemented. Please ensure local Bee node is running.');
  }

  /**
   * Validate content accessibility
   */
  async validateContentAccess(
    reference: string,
    filename?: string
  ): Promise<{
    workingUrls: string[];
    failedUrls: string[];
    isAccessible: boolean;
  }> {
    const urls = this.getContentUrls(reference, filename);
    const allUrls = [urls.local, urls.public, ...urls.fallbacks];
    
    const workingUrls: string[] = [];
    const failedUrls: string[] = [];
    
    await Promise.allSettled(
      allUrls.map(async (url) => {
        try {
          const response = await fetch(url, { 
            method: 'HEAD', 
            signal: AbortSignal.timeout(5000) 
          });
          
          if (response.ok) {
            workingUrls.push(url);
          } else {
            failedUrls.push(url);
          }
        } catch {
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
   * Get service status
   */
  async getStatus(): Promise<SwarmNodeStatus> {
    try {
      const nodeInfo = await this.bee.getNodeInfo();
      
      let hasStamp = false;
      try {
        const stamps = await this.bee.getAllPostageBatch();
        hasStamp = stamps.some(stamp => stamp.usable);
      } catch {
        // Ignore stamp check errors
      }
      
      return {
        nodeRunning: true,
        hasStamp,
        gateway: this.config.local,
        publicGateway: this.config.public,
        postageBatchId: this.postageBatchId
      };
    } catch (error) {
      return {
        nodeRunning: false,
        hasStamp: false,
        gateway: this.config.local,
        publicGateway: this.config.public,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SwarmConfig>, postageBatchId?: string): void {
    this.config = { ...this.config, ...config };
    
    if (postageBatchId) {
      this.postageBatchId = postageBatchId;
    }
    
    this.bee = new Bee(this.config.local);
    this.isInitialized = false;
  }
}