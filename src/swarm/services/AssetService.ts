// src/services/AssetService.ts
import { SwarmService } from './SwarmService';
import { 
  Asset, 
  AssetUrls, 
  StorageStats,
  SwarmUploadResult 
} from '../../types/contentTypes';
import {
  buildWebContentUrl,
  processMarkdownUrls,
  DEFAULT_GATEWAYS
} from '../utils/swarmUtils';

/**
 * Service for managing user assets (images, documents, etc.)
 */
export class AssetService {
  private readonly STORAGE_KEY_PREFIX = 'religio_assets_';
  
  constructor(private swarmService: SwarmService) {}

  /**
   * Upload an asset
   */
  async uploadAsset(file: File, userAddress: string): Promise<Asset> {
    try {
      // Validate file
      this.validateAssetFile(file);
      
      // Upload to Swarm
      const result = await this.swarmService.uploadFile(file);
      
      // Create asset record
      const asset: Asset = {
        id: this.generateAssetId(),
        name: file.name,
        reference: result.reference,
        contentType: file.type,
        size: file.size,
        uploadedAt: Date.now(),
        userAddress,
        gateway: 'public'
      };
      
      // Save to local storage
      this.saveAsset(asset, userAddress);
      
      console.log(`Asset uploaded successfully: ${asset.name} (${asset.reference})`);
      return asset;
      
    } catch (error) {
      console.error('Failed to upload asset:', error);
      throw new Error(`Failed to upload asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get URLs for an asset
   */
  getAssetUrls(asset: Asset): AssetUrls {
    // Always use bzz for web-displayable content
    return {
      local: buildWebContentUrl(asset.reference, DEFAULT_GATEWAYS.local),
      public: buildWebContentUrl(asset.reference, DEFAULT_GATEWAYS.public),
      fallbacks: DEFAULT_GATEWAYS.fallbacks.map(gateway =>
        buildWebContentUrl(asset.reference, gateway)
      ),
      webAccessible: buildWebContentUrl(asset.reference, DEFAULT_GATEWAYS.public)
    };
  }

  /**
   * Generate markdown for embedding an asset
   */
  generateAssetMarkdown(
    asset: Asset,
    altText?: string,
    usePublicGateway: boolean = true
  ): string {
    const alt = altText || asset.name;
    const gateway = usePublicGateway 
      ? DEFAULT_GATEWAYS.public
      : DEFAULT_GATEWAYS.local;
    
    // Use bzz endpoint for web display
    const url = buildWebContentUrl(asset.reference, gateway);
    
    if (asset.contentType.startsWith('image/')) {
      return `![${alt}](${url})`;
    } else {
      return `[${alt}](${url})`;
    }
  }

  /**
   * Process markdown for publication
   */
  processMarkdownForPublication(content: string): string {
    return processMarkdownUrls(content, true);
  }

  /**
   * Get all assets for a user
   */
  getAssets(userAddress: string): Asset[] {
    const key = this.getStorageKey(userAddress);
    const stored = localStorage.getItem(key);
    
    if (!stored) return [];
    
    try {
      const assets = JSON.parse(stored);
      return Array.isArray(assets) ? assets : [];
    } catch {
      return [];
    }
  }

  /**
   * Save an asset
   */
  private saveAsset(asset: Asset, userAddress: string): void {
    const assets = this.getAssets(userAddress);
    assets.push(asset);
    
    const key = this.getStorageKey(userAddress);
    localStorage.setItem(key, JSON.stringify(assets));
  }

  /**
   * Delete an asset
   */
  deleteAsset(assetId: string, userAddress: string): void {
    const assets = this.getAssets(userAddress);
    const filtered = assets.filter(a => a.id !== assetId);
    
    const key = this.getStorageKey(userAddress);
    localStorage.setItem(key, JSON.stringify(filtered));
  }

  /**
   * Rename an asset
   */
  renameAsset(assetId: string, newName: string, userAddress: string): void {
    const assets = this.getAssets(userAddress);
    const asset = assets.find(a => a.id === assetId);
    
    if (asset) {
      asset.name = newName;
      const key = this.getStorageKey(userAddress);
      localStorage.setItem(key, JSON.stringify(assets));
    }
  }

  /**
   * Validate asset accessibility
   */
  async validateAssetAccess(asset: Asset): Promise<{
    workingUrls: string[];
    failedUrls: string[];
    isAccessible: boolean;
  }> {
    return this.swarmService.validateContentAccess(asset.reference);
  }

  /**
   * Get storage statistics
   */
  getStorageStats(userAddress: string): StorageStats {
    const assets = this.getAssets(userAddress);
    
    const assetsByType: Record<string, number> = {};
    let totalSize = 0;
    
    assets.forEach(asset => {
      const type = asset.contentType.split('/')[0];
      assetsByType[type] = (assetsByType[type] || 0) + 1;
      totalSize += asset.size;
    });
    
    return {
      totalAssets: assets.length,
      totalSize,
      assetsByType,
      oldestAsset: assets.length > 0 
        ? Math.min(...assets.map(a => a.uploadedAt))
        : undefined,
      newestAsset: assets.length > 0
        ? Math.max(...assets.map(a => a.uploadedAt))
        : undefined
    };
  }

  /**
   * Find assets used in content
   */
  findAssetsInContent(content: string, userAddress: string): Asset[] {
    const assets = this.getAssets(userAddress);
    const usedAssets: Asset[] = [];
    
    assets.forEach(asset => {
      if (content.includes(asset.reference)) {
        usedAssets.push(asset);
      }
    });
    
    return usedAssets;
  }

  /**
   * Validate asset file
   */
  private validateAssetFile(file: File): void {
    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit');
    }
    
    // Type validation (optional, customize as needed)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/markdown'
    ];
    
    if (!allowedTypes.some(type => file.type.startsWith(type.split('/')[0]))) {
      throw new Error(`File type ${file.type} is not supported`);
    }
  }

  /**
   * Generate unique asset ID
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get storage key for user
   */
  private getStorageKey(userAddress: string): string {
    return `${this.STORAGE_KEY_PREFIX}${userAddress.toLowerCase()}`;
  }
}