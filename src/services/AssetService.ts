// src/services/AssetService.ts
import { beeBlogService } from './BeeBlogService';

/**
 * Asset interface for managing uploaded files
 */
export interface Asset {
  id: string;
  name: string;
  originalName: string;
  reference: string;
  contentType: string;
  size: number;
  uploadedAt: number;
  authorAddress: string;
}

/**
 * Service for managing user assets with localStorage persistence
 * Handles both local development and public gateway scenarios
 */
export class AssetService {
  private storageKey = 'religiodao-assets';

  /**
   * Save an asset to localStorage
   */
  saveAsset(asset: Omit<Asset, 'id' | 'uploadedAt'>): Asset {
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const fullAsset: Asset = {
      id: assetId,
      uploadedAt: now,
      ...asset
    };

    const assets = this.getAssets(asset.authorAddress);
    assets.push(fullAsset);
    
    localStorage.setItem(`${this.storageKey}-${asset.authorAddress}`, JSON.stringify(assets));
    return fullAsset;
  }

  /**
   * Get all assets for a specific author
   */
  getAssets(authorAddress?: string): Asset[] {
    if (!authorAddress) return [];
    
    try {
      const assetsJson = localStorage.getItem(`${this.storageKey}-${authorAddress}`);
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
   * Get a specific asset by ID
   */
  getAsset(assetId: string, authorAddress: string): Asset | null {
    const assets = this.getAssets(authorAddress);
    return assets.find(asset => asset.id === assetId) || null;
  }

  /**
   * Update an asset (rename, etc.)
   */
  updateAsset(assetId: string, authorAddress: string, updates: Partial<Pick<Asset, 'name'>>): boolean {
    const assets = this.getAssets(authorAddress);
    const assetIndex = assets.findIndex(asset => asset.id === assetId);
    
    if (assetIndex === -1) return false;
    
    assets[assetIndex] = { ...assets[assetIndex], ...updates };
    localStorage.setItem(`${this.storageKey}-${authorAddress}`, JSON.stringify(assets));
    return true;
  }

  /**
   * Delete an asset
   */
  deleteAsset(assetId: string, authorAddress: string): boolean {
    try {
      const assets = this.getAssets(authorAddress);
      const filteredAssets = assets.filter(asset => asset.id !== assetId);
      
      localStorage.setItem(`${this.storageKey}-${authorAddress}`, JSON.stringify(filteredAssets));
      return true;
    } catch (error) {
      console.error('Error deleting asset:', error);
      return false;
    }
  }

  /**
   * Upload a file to Swarm and save as asset
   */
  async uploadAsset(file: File, authorAddress: string): Promise<Asset> {
    // Upload to Swarm using the bee service
    const reference = await beeBlogService.uploadAsset(file);
    
    // Create asset record
    const asset = this.saveAsset({
      name: file.name,
      originalName: file.name,
      reference,
      contentType: file.type,
      size: file.size,
      authorAddress
    });

    return asset;
  }

  /**
   * Generate markdown for inserting an asset
   * @param asset Asset to generate markdown for
   * @param altText Optional alt text
   * @param usePublicGateway Whether to use public gateway for the URL
   */
  generateAssetMarkdown(asset: Asset, altText?: string, usePublicGateway: boolean = true): string {
    // For published content, always use public gateway so anyone can view the images
    // Always use bytes endpoint for binary assets like images for direct access
    const imageUrl = beeBlogService.getContentUrl(asset.reference, usePublicGateway, asset.contentType);
    const alt = altText || asset.name.split('.')[0]; // Remove extension for alt text
    return `![${alt}](${imageUrl})`;
  }

  /**
   * Get URL for accessing an asset
   * @param asset Asset to get URL for
   * @param usePublicGateway Whether to use public gateway (default: false for development)
   */
  getAssetUrl(asset: Asset, usePublicGateway: boolean = false): string {
    // Use content type to determine the appropriate endpoint
    // Most assets (images, etc.) should use the bytes endpoint
    return beeBlogService.getContentUrl(asset.reference, usePublicGateway, asset.contentType);
  }

  /**
   * Get multiple URLs for an asset (local, public, fallbacks)
   * Useful for implementing fallback loading in UI components
   */
  getAssetUrls(asset: Asset): {
    local: string;
    public: string;
    fallbacks: string[];
    webAccessible: string;
  } {
    // Determine if this should be treated as web content
    const isBlogContent = asset.contentType.includes('text/html') || 
                         asset.contentType.includes('text/markdown') ||
                         asset.contentType.includes('application/json');
    
    return beeBlogService.getContentUrls(asset.reference, isBlogContent);
  }

  /**
   * Process existing markdown content to use public gateway URLs
   * This is useful when preparing content for publication
   */
  processMarkdownForPublication(markdown: string): string {
    return beeBlogService.processMarkdownForPublicViewing(markdown);
  }

  /**
   * Clear all assets for an author (for testing/cleanup)
   */
  clearAssets(authorAddress: string): void {
    localStorage.removeItem(`${this.storageKey}-${authorAddress}`);
  }

  /**
   * Get storage statistics
   */
  getStorageStats(authorAddress: string): {
    totalAssets: number;
    totalSize: number;
    oldestAsset: Date | null;
    newestAsset: Date | null;
  } {
    const assets = this.getAssets(authorAddress);
    
    if (assets.length === 0) {
      return {
        totalAssets: 0,
        totalSize: 0,
        oldestAsset: null,
        newestAsset: null
      };
    }

    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const timestamps = assets.map(asset => asset.uploadedAt);
    
    return {
      totalAssets: assets.length,
      totalSize,
      oldestAsset: new Date(Math.min(...timestamps)),
      newestAsset: new Date(Math.max(...timestamps))
    };
  }

  /**
   * Validate if an asset reference is accessible
   * Tries multiple gateways to ensure the asset is available
   * Also tries both bytes and bzz endpoints for maximum compatibility
   */
  async validateAssetAccess(asset: Asset): Promise<{
    accessible: boolean;
    workingUrls: string[];
    failedUrls: string[];
  }> {
    const urls = this.getAssetUrls(asset);
    const allUrls = [urls.local, urls.public, ...urls.fallbacks];
    
    // Also add web-accessible URL for testing
    if (!allUrls.includes(urls.webAccessible)) {
      allUrls.push(urls.webAccessible);
    }
    
    const workingUrls: string[] = [];
    const failedUrls: string[] = [];
    
    for (const url of allUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          workingUrls.push(url);
        } else {
          failedUrls.push(url);
        }
      } catch (error) {
        failedUrls.push(url);
      }
    }
    
    return {
      accessible: workingUrls.length > 0,
      workingUrls,
      failedUrls
    };
  }
}

// Create singleton instance
export const assetService = new AssetService();