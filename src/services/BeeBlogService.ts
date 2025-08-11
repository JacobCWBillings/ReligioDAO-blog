// src/services/BeeBlogService.ts - Legacy Compatibility Layer
// This file provides backward compatibility while delegating to the new service architecture

import { services, contentService, assetService } from './index';
import { enhancedDraftStorage, EnhancedBlogDraft } from '../utils/draftStorage';
import { BlogContent } from './ContentService';

/**
 * Legacy BlogDraft interface for backward compatibility
 */
export interface BlogDraft {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  banner?: string | null;
  authorAddress: string;
  contentReference?: string;
  isPublished?: boolean;
  createdAt?: number;
  lastModified?: number;
  preview?: string;
}

/**
 * Legacy BeeBlogService - Compatibility Layer
 * 
 * @deprecated Use the new service architecture (SwarmService, ContentService, AssetService)
 * This class provides backward compatibility while delegating to new services
 */
export class BeeBlogService {
  private static instance: BeeBlogService;
  private initialized: boolean = false;

  constructor() {
    console.warn(
      '⚠️ BeeBlogService is deprecated. Please migrate to the new service architecture:\n' +
      '- SwarmService for Swarm operations\n' +
      '- ContentService for blog content\n' +
      '- AssetService for asset management\n' +
      '- enhancedDraftStorage for draft management'
    );
  }

  /**
   * Get singleton instance
   * @deprecated Use individual services instead
   */
  static getInstance(): BeeBlogService {
    if (!BeeBlogService.instance) {
      BeeBlogService.instance = new BeeBlogService();
    }
    return BeeBlogService.instance;
  }

  /**
   * Initialize the service
   * @deprecated Use services.initialize() instead
   */
  async initialize(): Promise<void> {
    try {
      await services.initialize();
      this.initialized = true;
      console.log('BeeBlogService (compatibility layer) initialized');
    } catch (error) {
      console.error('BeeBlogService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get service status
   * @deprecated Use services.getStatus() instead
   */
  async getServiceStatus(): Promise<any> {
    return await services.getStatus();
  }

  /**
   * Upload blog content to Swarm
   * @deprecated Use contentService.uploadBlogContent() instead
   */
  async uploadBlogContent(blogData: {
    title: string;
    content: string;
    metadata: {
      author: string;
      category: string;
      tags: string[];
      createdAt: number;
      banner?: string;
    };
  }): Promise<string> {
    try {
      const blogContent: BlogContent = {
        title: blogData.title,
        content: blogData.content,
        metadata: {
          author: blogData.metadata.author,
          category: blogData.metadata.category,
          tags: blogData.metadata.tags,
          createdAt: blogData.metadata.createdAt,
          banner: blogData.metadata.banner || null
        }
      };

      return await contentService.uploadBlogContent(blogContent);
    } catch (error) {
      console.error('Legacy uploadBlogContent failed:', error);
      throw error;
    }
  }

  /**
   * Download blog content from Swarm
   * @deprecated Use contentService.downloadBlogContent() instead
   */
  async downloadBlogContent(reference: string): Promise<any> {
    try {
      return await contentService.downloadBlogContent(reference);
    } catch (error) {
      console.error('Legacy downloadBlogContent failed:', error);
      throw error;
    }
  }

  /**
   * Upload asset to Swarm
   * @deprecated Use assetService.uploadAsset() instead
   */
  async uploadAsset(file: File): Promise<string> {
    try {
      console.warn('uploadAsset is deprecated. Use assetService.uploadAsset() which returns full Asset object');
      // For backward compatibility, just return the reference
      const asset = await assetService.uploadAsset(file, 'legacy-user');
      return asset.reference;
    } catch (error) {
      console.error('Legacy uploadAsset failed:', error);
      throw error;
    }
  }

  /**
   * Get content URL
   * @deprecated Use contentService.getBlogUrl() or assetService.getAssetUrl() instead
   */
  getContentUrl(reference: string, usePublicGateway: boolean = false, contentType?: string): string {
    if (contentType === 'blog' || contentType === 'html') {
      return contentService.getBlogUrl(reference, usePublicGateway);
    } else {
      return services.swarm.getContentUrl(reference, usePublicGateway, 'bytes');
    }
  }

  /**
   * Get blog URL specifically
   * @deprecated Use contentService.getBlogUrl() instead
   */
  getBlogUrl(reference: string, usePublicGateway: boolean = true): string {
    return contentService.getBlogUrl(reference, usePublicGateway);
  }

  /**
   * Process markdown for publication
   * @deprecated Use assetService.processMarkdownForPublication() instead
   */
  processMarkdownForPublication(content: string): string {
    return assetService.processMarkdownForPublication(content);
  }

  // ================================
  // DRAFT MANAGEMENT - DEPRECATED
  // ================================
  // These methods are deprecated but provided for compatibility
  // They delegate to enhancedDraftStorage

  /**
   * Save a draft
   * @deprecated Use enhancedDraftStorage.saveDraft() instead
   */
  saveDraft(draftData: Partial<BlogDraft> & { title: string; content: string; authorAddress: string }): BlogDraft {
    console.warn('BeeBlogService.saveDraft() is deprecated. Use enhancedDraftStorage.saveDraft() instead');
    
    try {
      const enhancedDraft = enhancedDraftStorage.saveDraft(draftData, 'Legacy save');
      
      // Convert to legacy format
      return this.convertToLegacyDraft(enhancedDraft);
    } catch (error) {
      console.error('Legacy saveDraft failed:', error);
      throw error;
    }
  }

  /**
   * Load a draft
   * @deprecated Use enhancedDraftStorage.loadDraft() instead
   */
  loadDraft(draftId: string): BlogDraft | null {
    console.warn('BeeBlogService.loadDraft() is deprecated. Use enhancedDraftStorage.loadDraft() instead');
    
    try {
      const enhancedDraft = enhancedDraftStorage.loadDraft(draftId);
      return enhancedDraft ? this.convertToLegacyDraft(enhancedDraft) : null;
    } catch (error) {
      console.error('Legacy loadDraft failed:', error);
      return null;
    }
  }

  /**
   * Get all drafts for a user
   * @deprecated Use enhancedDraftStorage.getDrafts() instead
   */
  getDrafts(authorAddress?: string): BlogDraft[] {
    console.warn('BeeBlogService.getDrafts() is deprecated. Use enhancedDraftStorage.getDrafts() instead');
    
    if (!authorAddress) return [];
    
    try {
      const enhancedDrafts = enhancedDraftStorage.getDrafts(authorAddress);
      return enhancedDrafts.map(draft => this.convertToLegacyDraft(draft));
    } catch (error) {
      console.error('Legacy getDrafts failed:', error);
      return [];
    }
  }

  /**
   * Delete a draft
   * @deprecated Use enhancedDraftStorage.deleteDraft() instead
   */
  deleteDraft(draftId: string): boolean {
    console.warn('BeeBlogService.deleteDraft() is deprecated. Use enhancedDraftStorage.deleteDraft() instead');
    
    try {
      return enhancedDraftStorage.deleteDraft(draftId);
    } catch (error) {
      console.error('Legacy deleteDraft failed:', error);
      return false;
    }
  }

  /**
   * Publish a draft to Swarm
   * @deprecated Use contentService.uploadBlogContent() with enhancedDraftStorage separately
   */
  async publishDraft(draftId: string): Promise<{ draft: BlogDraft; contentReference: string }> {
    console.warn('BeeBlogService.publishDraft() is deprecated. Use contentService.uploadBlogContent() and enhancedDraftStorage separately');
    
    try {
      const enhancedDraft = enhancedDraftStorage.loadDraft(draftId);
      if (!enhancedDraft) {
        throw new Error('Draft not found');
      }

      // Process content for publication
      const processedContent = assetService.processMarkdownForPublication(enhancedDraft.content);

      // Create blog content for upload
      const blogContent: BlogContent = {
        title: enhancedDraft.title,
        content: processedContent,
        metadata: {
          author: enhancedDraft.authorAddress,
          category: enhancedDraft.category,
          tags: enhancedDraft.tags,
          createdAt: enhancedDraft.createdAt,
          banner: enhancedDraft.banner
        }
      };

      // Upload to Swarm
      const contentReference = await contentService.uploadBlogContent(blogContent);

      // Update draft with reference
      const updatedDraft = enhancedDraftStorage.saveDraft({
        ...enhancedDraft,
        content: processedContent,
        contentReference,
        isPublished: true
      }, 'Published via legacy API');

      return {
        draft: this.convertToLegacyDraft(updatedDraft),
        contentReference
      };
    } catch (error) {
      console.error('Legacy publishDraft failed:', error);
      throw error;
    }
  }

  // ================================
  // HELPER METHODS
  // ================================

  /**
   * Convert enhanced draft to legacy format
   */
  private convertToLegacyDraft(enhancedDraft: EnhancedBlogDraft): BlogDraft {
    return {
      id: enhancedDraft.id,
      title: enhancedDraft.title,
      content: enhancedDraft.content,
      category: enhancedDraft.category,
      tags: enhancedDraft.tags,
      banner: enhancedDraft.banner,
      authorAddress: enhancedDraft.authorAddress,
      contentReference: enhancedDraft.contentReference,
      isPublished: enhancedDraft.isPublished,
      createdAt: enhancedDraft.createdAt,
      lastModified: enhancedDraft.lastModified,
      preview: enhancedDraft.preview
    };
  }

  /**
   * Generate preview from content
   */
  private generatePreview(content: string): string {
    const textContent = content.replace(/[#*_`-]/g, '');
    return textContent.length > 150 
      ? `${textContent.substring(0, 150)}...` 
      : textContent;
  }
}

// Export singleton instance for backward compatibility
export const beeBlogService = BeeBlogService.getInstance();

// Export class for custom instantiation
export default BeeBlogService;

/**
 * Migration helper: Check if code is using deprecated methods
 */
export function checkForDeprecatedUsage(): {
  hasDeprecatedUsage: boolean;
  suggestions: string[];
} {
  const suggestions: string[] = [];

  // This is a basic check - in a real implementation you'd analyze the codebase
  suggestions.push('Replace beeBlogService.saveDraft() with enhancedDraftStorage.saveDraft()');
  suggestions.push('Replace beeBlogService.uploadBlogContent() with contentService.uploadBlogContent()');
  suggestions.push('Replace beeBlogService.uploadAsset() with assetService.uploadAsset()');
  suggestions.push('Replace beeBlogService.getServiceStatus() with services.getStatus()');

  return {
    hasDeprecatedUsage: true, // Would be determined by actual code analysis
    suggestions
  };
}

/**
 * Migration utility: Convert legacy service calls to new architecture
 */
export const migrationHelpers = {
  /**
   * Show migration guide for specific method
   */
  getMigrationGuide(method: string): string {
    const guides: { [key: string]: string } = {
      'saveDraft': 'enhancedDraftStorage.saveDraft(draftData, action)',
      'loadDraft': 'enhancedDraftStorage.loadDraft(draftId)',
      'getDrafts': 'enhancedDraftStorage.getDrafts(authorAddress)',
      'deleteDraft': 'enhancedDraftStorage.deleteDraft(draftId)',
      'uploadBlogContent': 'contentService.uploadBlogContent(blogContent)',
      'downloadBlogContent': 'contentService.downloadBlogContent(reference)',
      'uploadAsset': 'assetService.uploadAsset(file, authorAddress)',
      'getBlogUrl': 'contentService.getBlogUrl(reference, usePublicGateway)',
      'getServiceStatus': 'services.getStatus()',
      'initialize': 'services.initialize()'
    };

    return guides[method] || 'No migration guide available for this method';
  },

  /**
   * Generate migration checklist
   */
  generateMigrationChecklist(): string[] {
    return [
      '□ Replace all beeBlogService.saveDraft() calls with enhancedDraftStorage.saveDraft()',
      '□ Replace all beeBlogService.getDrafts() calls with enhancedDraftStorage.getDrafts()',
      '□ Replace all beeBlogService.uploadBlogContent() calls with contentService.uploadBlogContent()',
      '□ Replace all beeBlogService.uploadAsset() calls with assetService.uploadAsset()',
      '□ Update import statements to use new services',
      '□ Test all functionality with new service architecture',
      '□ Remove BeeBlogService import after migration complete',
      '□ Update error handling for new service APIs'
    ];
  }
};

// Log deprecation warning when this file is imported
console.warn(
  '🚨 DEPRECATION WARNING: BeeBlogService is deprecated!\n\n' +
  'Please migrate to the new service architecture:\n' +
  '• SwarmService - Pure Swarm operations\n' +
  '• ContentService - Blog content processing\n' +
  '• AssetService - Asset management\n' +
  '• enhancedDraftStorage - Draft management\n\n' +
  'See migrationUtils.ts for migration helpers.'
);