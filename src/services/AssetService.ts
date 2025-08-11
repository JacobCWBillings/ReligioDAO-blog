// src/services/AssetService.ts - FIXED VERSION (No Circular Dependencies)
import { SwarmService } from './SwarmService';

export interface Asset {
  id: string;
  name: string;
  originalName: string;
  reference: string;
  contentType: string;
  size: number;
  uploadedAt: number;
  authorAddress: string;
  tags?: string[];
  description?: string;
}

export interface AssetMetadata {
  name: string;
  originalName: string;
  reference: string;
  contentType: string;
  size: number;
  authorAddress: string;
  tags?: string[];
  description?: string;
}

export interface AssetValidationResult {
  workingUrls: string[];
  failedUrls: string[];
  isAccessible: boolean;
}

export interface AssetStorageStats {
  totalAssets: number;
  totalSize: number;
  averageSize: number;
  byContentType: { [type: string]: number };
  storageUsed: number;
}

/**
 * FIXED: Asset management service with proper dependency injection
 * - Only handles asset metadata and local storage
 * - Delegates all Swarm operations to SwarmService
 * - No circular dependencies or singleton creation
 */
export class AssetService {
  private readonly STORAGE_PREFIX = 'religiodao-assets-';
  
  // FIXED: Clean dependency injection without default singleton
  constructor(private swarmService: SwarmService) {}

  /**
   * Upload asset file and store metadata
   */
  async uploadAsset(file: File, authorAddress: string, options?: {
    tags?: string[];
    description?: string;
    customName?: string;
  }): Promise<Asset> {
    try {
      // Validate file before upload
      this.validateFile(file);
      
      console.log(`Uploading asset: ${file.name} (${file.size} bytes)`);
      
      // Delegate to SwarmService for upload
      const uploadResult = await this.swarmService.uploadFile(file);
      
      // Create asset metadata
      const assetMetadata: AssetMetadata = {
        name: options?.customName || file.name,
        originalName: file.name,
        reference: uploadResult.reference,
        contentType: file.type,
        size: file.size,
        authorAddress,
        tags: options?.tags || [],
        description: options?.description || ''
      };
      
      // Save metadata locally
      const asset = this.saveAssetMetadata(assetMetadata);
      
      console.log('Asset uploaded successfully:', asset.id);
      return asset;
      
    } catch (error) {
      console.error('Error uploading asset:', error);
      throw new Error(`Failed to upload asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all assets for a user
   */
  getAssets(authorAddress: string): Asset[] {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${authorAddress}`;
      const assetsJson = localStorage.getItem(storageKey);
      
      if (!assetsJson) return [];
      
      const assets = JSON.parse(assetsJson) as Asset[];
      
      // Sort by upload date (newest first)
      return assets.sort((a, b) => b.uploadedAt - a.uploadedAt);
      
    } catch (error) {
      console.error('Error loading assets:', error);
      return [];
    }
  }

  /**
   * Get single asset by ID
   */
  getAsset(assetId: string, authorAddress: string): Asset | null {
    const assets = this.getAssets(authorAddress);
    return assets.find(asset => asset.id === assetId) || null;
  }

  /**
   * Get asset by Swarm reference
   */
  getAssetByReference(reference: string, authorAddress: string): Asset | null {
    const assets = this.getAssets(authorAddress);
    return assets.find(asset => asset.reference === reference) || null;
  }

  /**
   * Rename an asset
   */
  renameAsset(assetId: string, newName: string, authorAddress: string): Asset | null {
    try {
      const assets = this.getAssets(authorAddress);
      const assetIndex = assets.findIndex(asset => asset.id === assetId);
      
      if (assetIndex === -1) {
        throw new Error('Asset not found');
      }
      
      if (!newName.trim()) {
        throw new Error('Asset name cannot be empty');
      }
      
      // Check for duplicate names
      const duplicateExists = assets.some((asset, index) => 
        index !== assetIndex && asset.name.toLowerCase() === newName.trim().toLowerCase()
      );
      
      if (duplicateExists) {
        throw new Error('An asset with this name already exists');
      }
      
      // Update asset name
      assets[assetIndex].name = newName.trim();
      
      // Save updated assets
      this.saveAssetsToStorage(assets, authorAddress);
      
      return assets[assetIndex];
      
    } catch (error) {
      console.error('Error renaming asset:', error);
      throw error;
    }
  }

  /**
   * Update asset metadata
   */
  updateAssetMetadata(assetId: string, updates: {
    name?: string;
    tags?: string[];
    description?: string;
  }, authorAddress: string): Asset | null {
    try {
      const assets = this.getAssets(authorAddress);
      const assetIndex = assets.findIndex(asset => asset.id === assetId);
      
      if (assetIndex === -1) {
        throw new Error('Asset not found');
      }
      
      // Apply updates
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          throw new Error('Asset name cannot be empty');
        }
        assets[assetIndex].name = updates.name.trim();
      }
      
      if (updates.tags !== undefined) {
        assets[assetIndex].tags = updates.tags;
      }
      
      if (updates.description !== undefined) {
        assets[assetIndex].description = updates.description;
      }
      
      // Save updated assets
      this.saveAssetsToStorage(assets, authorAddress);
      
      return assets[assetIndex];
      
    } catch (error) {
      console.error('Error updating asset metadata:', error);
      throw error;
    }
  }

  /**
   * Delete an asset (only removes metadata, doesn't delete from Swarm)
   */
  deleteAsset(assetId: string, authorAddress: string): boolean {
    try {
      const assets = this.getAssets(authorAddress);
      const filteredAssets = assets.filter(asset => asset.id !== assetId);
      
      if (filteredAssets.length === assets.length) {
        return false; // Asset not found
      }
      
      // Save updated assets list
      this.saveAssetsToStorage(filteredAssets, authorAddress);
      
      console.log('Asset metadata deleted:', assetId);
      return true;
      
    } catch (error) {
      console.error('Error deleting asset:', error);
      return false;
    }
  }

  /**
   * Generate markdown for asset insertion
   */
  generateAssetMarkdown(asset: Asset, altText?: string, usePublicGateway: boolean = true): string {
    const imageUrl = this.getAssetUrl(asset, usePublicGateway);
    const alt = altText || asset.name.split('.')[0] || 'Asset';
    
    if (asset.contentType.startsWith('image/')) {
      return `![${alt}](${imageUrl})`;
    } else {
      // For non-images, create a link
      return `[📎 ${asset.name}](${imageUrl})`;
    }
  }

  /**
   * Get asset URL
   */
  getAssetUrl(asset: Asset, usePublicGateway: boolean = true): string {
    return this.swarmService.getContentUrl(asset.reference, usePublicGateway, 'bytes');
  }

  /**
   * Get all possible URLs for an asset
   */
  getAssetUrls(asset: Asset): {
    local: string;
    public: string;
    webAccessible: string;
    fallbacks: string[];
  } {
    const urls = this.swarmService.getContentUrls(asset.reference);
    return {
      local: urls.local,
      public: urls.public,
      webAccessible: urls.publicWeb,
      fallbacks: urls.fallbacks
    };
  }

  /**
   * Validate asset accessibility across gateways
   */
  async validateAssetAccess(asset: Asset): Promise<AssetValidationResult> {
    try {
      return await this.swarmService.validateContentAccess(asset.reference);
    } catch (error) {
      console.error('Error validating asset access:', error);
      return {
        workingUrls: [],
        failedUrls: [],
        isAccessible: false
      };
    }
  }

  /**
   * Process markdown content to use specified gateway URLs
   */
  processMarkdownForPublication(content: string): string {
    try {
      // Replace local asset URLs with public gateway URLs
      return content.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bytes\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );
    } catch (error) {
      console.error('Error processing markdown for publication:', error);
      return content;
    }
  }

  /**
   * Process markdown content to use local gateway URLs
   */
  processMarkdownForDevelopment(content: string): string {
    try {
      // Replace public gateway URLs with local gateway URLs
      const publicGatewayPattern = new RegExp(
        `!\\[([^\\]]*)\\]\\((https?://[^/]+)/(bytes|bzz)/([^)]+)\\)`,
        'g'
      );

      return content.replace(publicGatewayPattern, (match, alt, gateway, endpoint, reference) => {
        const localUrl = this.swarmService.getContentUrl(reference, false, 'bytes');
        return `![${alt}](${localUrl})`;
      });
    } catch (error) {
      console.error('Error processing markdown for development:', error);
      return content;
    }
  }

  /**
   * Search assets by name, tags, or description
   */
  searchAssets(authorAddress: string, query: string): Asset[] {
    const assets = this.getAssets(authorAddress);
    const lowercaseQuery = query.toLowerCase();
    
    return assets.filter(asset => {
      return (
        asset.name.toLowerCase().includes(lowercaseQuery) ||
        asset.originalName.toLowerCase().includes(lowercaseQuery) ||
        asset.description?.toLowerCase().includes(lowercaseQuery) ||
        asset.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      );
    });
  }

  /**
   * Filter assets by content type
   */
  filterAssetsByType(authorAddress: string, contentType: string): Asset[] {
    const assets = this.getAssets(authorAddress);
    return assets.filter(asset => asset.contentType.startsWith(contentType));
  }

  /**
   * Get storage statistics for a user
   */
  getStorageStats(authorAddress: string): AssetStorageStats {
    const assets = this.getAssets(authorAddress);
    
    const totalAssets = assets.length;
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const averageSize = totalAssets > 0 ? totalSize / totalAssets : 0;
    
    // Group by content type
    const byContentType: { [type: string]: number } = {};
    assets.forEach(asset => {
      const mainType = asset.contentType.split('/')[0];
      byContentType[mainType] = (byContentType[mainType] || 0) + 1;
    });
    
    // Calculate storage used in localStorage
    const storageUsed = this.calculateStorageSize(authorAddress);
    
    return {
      totalAssets,
      totalSize,
      averageSize,
      byContentType,
      storageUsed
    };
  }

  /**
   * Export assets metadata as JSON
   */
  exportAssets(authorAddress: string): string {
    const assets = this.getAssets(authorAddress);
    return JSON.stringify(assets, null, 2);
  }

  /**
   * Import assets metadata from JSON
   */
  importAssets(authorAddress: string, assetsJson: string, merge: boolean = true): Asset[] {
    try {
      const importedAssets = JSON.parse(assetsJson) as Asset[];
      
      // Validate imported data
      this.validateImportedAssets(importedAssets);
      
      if (merge) {
        const existingAssets = this.getAssets(authorAddress);
        const existingIds = new Set(existingAssets.map(asset => asset.id));
        
        // Add only new assets
        const newAssets = importedAssets.filter(asset => !existingIds.has(asset.id));
        const mergedAssets = [...existingAssets, ...newAssets];
        
        this.saveAssetsToStorage(mergedAssets, authorAddress);
        return mergedAssets;
      } else {
        // Replace all assets
        this.saveAssetsToStorage(importedAssets, authorAddress);
        return importedAssets;
      }
      
    } catch (error) {
      console.error('Error importing assets:', error);
      throw new Error(`Failed to import assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all assets for a user
   */
  clearAssets(authorAddress: string): void {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${authorAddress}`;
      localStorage.removeItem(storageKey);
      console.log('All assets cleared for user:', authorAddress);
    } catch (error) {
      console.error('Error clearing assets:', error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Validate file before upload
   */
  private validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size === 0) {
      throw new Error('Cannot upload empty file');
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('File too large (max 100MB)');
    }

    // Check for supported file types
    const supportedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'application/pdf'
    ];

    if (!supportedTypes.includes(file.type)) {
      console.warn('Unsupported file type, proceeding anyway:', file.type);
    }
  }

  /**
   * Save asset metadata to localStorage
   */
  private saveAssetMetadata(metadata: AssetMetadata): Asset {
    const asset: Asset = {
      id: this.generateAssetId(),
      ...metadata,
      uploadedAt: Date.now()
    };

    const assets = this.getAssets(metadata.authorAddress);
    assets.push(asset);
    
    this.saveAssetsToStorage(assets, metadata.authorAddress);
    
    return asset;
  }

  /**
   * Save assets array to localStorage
   */
  private saveAssetsToStorage(assets: Asset[], authorAddress: string): void {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${authorAddress}`;
      localStorage.setItem(storageKey, JSON.stringify(assets));
    } catch (error) {
      console.error('Error saving assets to storage:', error);
      throw new Error('Failed to save assets: Storage quota exceeded or unavailable');
    }
  }

  /**
   * Generate unique asset ID
   */
  private generateAssetId(): string {
    return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate storage size for a user's assets
   */
  private calculateStorageSize(authorAddress: string): number {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${authorAddress}`;
      const data = localStorage.getItem(storageKey);
      return data ? new Blob([data]).size : 0;
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return 0;
    }
  }

  /**
   * Validate imported assets data
   */
  private validateImportedAssets(assets: any[]): void {
    if (!Array.isArray(assets)) {
      throw new Error('Invalid assets data: Expected array');
    }

    for (const asset of assets) {
      if (!asset.id || !asset.name || !asset.reference || !asset.contentType) {
        throw new Error('Invalid asset data: Missing required fields');
      }

      if (typeof asset.reference !== 'string' || asset.reference.length !== 64) {
        throw new Error('Invalid asset reference');
      }
    }
  }
}

// FIXED: Export only the class - let services/index.ts handle dependency injection
export default AssetService;