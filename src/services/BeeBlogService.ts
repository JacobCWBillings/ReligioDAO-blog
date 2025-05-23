// src/services/BeeBlogService.ts
import { Bee } from '@ethersphere/bee-js';
import { ethers } from 'ethers';

/**
 * Blog draft interface for local storage
 */
export interface BlogDraft {
  id: string;
  title: string;
  content: string;
  preview: string;
  banner?: string;
  category: string;
  tags: string[];
  authorAddress: string;
  createdAt: number;
  lastModified: number;
  contentReference?: string;
  isPublished?: boolean;
}

/**
 * Blog content structure for Swarm storage
 */
export interface BlogContent {
  title: string;
  content: string;
  metadata: {
    author: string;
    category: string;
    tags: string[];
    createdAt: number;
    banner?: string;
  };
}

/**
 * Service for managing blog content using bee-js directly
 * Replaces etherjot dependencies with direct Swarm integration
 */
export class BeeBlogService {
  private bee: Bee;
  private postageBatchId: string;
  private gateway: string;
  
  constructor(gateway: string = 'http://localhost:1633', postageBatchId?: string) {
    this.gateway = gateway;
    this.bee = new Bee(gateway);
    this.postageBatchId = postageBatchId || '';
  }

  /**
   * Initialize the service by finding a usable postage stamp
   */
  async initialize(): Promise<void> {
    if (!this.postageBatchId) {
      try {
        const stamps = await this.bee.getAllPostageBatch();
        const usableStamp = stamps.find(stamp => stamp.usable);
        if (usableStamp) {
          this.postageBatchId = usableStamp.batchID;
        } else {
          console.warn('No usable postage stamp found - using fallback');
          this.postageBatchId = '0'.repeat(64); // Development fallback
        }
      } catch (error) {
        console.error('Failed to initialize postage stamp:', error);
        this.postageBatchId = '0'.repeat(64); // Development fallback
      }
    }
  }

  /**
   * Save a blog draft to localStorage
   */
  saveDraft(draft: Partial<BlogDraft> & { title: string; content: string }): BlogDraft {
    const draftId = draft.id || `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const fullDraft: BlogDraft = {
      id: draftId,
      title: draft.title,
      content: draft.content,
      preview: this.generatePreview(draft.content),
      banner: draft.banner,
      category: draft.category || '',
      tags: draft.tags || [],
      authorAddress: draft.authorAddress || '',
      createdAt: draft.createdAt || now,
      lastModified: now,
      contentReference: draft.contentReference,
      isPublished: draft.isPublished || false
    };

    localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(fullDraft));
    return fullDraft;
  }

  /**
   * Load a blog draft from localStorage
   */
  loadDraft(draftId: string): BlogDraft | null {
    try {
      const draftJson = localStorage.getItem(`blog-draft-${draftId}`);
      if (!draftJson) return null;
      
      return JSON.parse(draftJson) as BlogDraft;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  /**
   * Get all drafts for a specific author
   */
  getDrafts(authorAddress?: string): BlogDraft[] {
    const drafts: BlogDraft[] = [];
    
    // Get all keys that start with 'blog-draft-'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('blog-draft-')) {
        try {
          const draftJson = localStorage.getItem(key);
          if (draftJson) {
            const draft = JSON.parse(draftJson) as BlogDraft;
            
            // Filter by author if specified
            if (!authorAddress || draft.authorAddress.toLowerCase() === authorAddress.toLowerCase()) {
              drafts.push(draft);
            }
          }
        } catch (error) {
          console.error('Error parsing draft:', error);
        }
      }
    }
    
    // Sort by last modified (newest first)
    return drafts.sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Delete a blog draft
   */
  deleteDraft(draftId: string): boolean {
    try {
      localStorage.removeItem(`blog-draft-${draftId}`);
      return true;
    } catch (error) {
      console.error('Error deleting draft:', error);
      return false;
    }
  }

  /**
   * Upload blog content to Swarm and return the reference
   */
  async uploadBlogContent(blogContent: BlogContent): Promise<string> {
    if (!this.postageBatchId) {
      await this.initialize();
    }

    try {
      // Create a comprehensive content object with metadata
      const contentWithMetadata = {
        version: '1.0',
        type: 'religiodao-blog-post',
        ...blogContent,
        uploadedAt: new Date().toISOString()
      };

      // Convert to JSON string
      const contentJson = JSON.stringify(contentWithMetadata, null, 2);
      
      // Upload to Swarm - removed contentType since uploadData doesn't support it
      const uploadResult = await this.bee.uploadData(
        this.postageBatchId,
        Buffer.from(contentJson, 'utf-8')
      );

      return uploadResult.reference;
    } catch (error) {
      console.error('Error uploading blog content:', error);
      throw new Error(`Failed to upload content to Swarm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download blog content from Swarm
   */
  async downloadBlogContent(reference: string): Promise<BlogContent> {
    try {
      const data = await this.bee.downloadData(reference);
      const contentJson = new TextDecoder().decode(data);
      const parsedContent = JSON.parse(contentJson);
      
      // Validate the content structure
      if (!parsedContent.title || !parsedContent.content) {
        throw new Error('Invalid blog content structure');
      }
      
      return parsedContent as BlogContent;
    } catch (error) {
      console.error('Error downloading blog content:', error);
      throw new Error(`Failed to download content from Swarm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a blog draft to Swarm and update the draft with the reference
   */
  async publishDraft(draftId: string): Promise<{ draft: BlogDraft; contentReference: string }> {
    const draft = this.loadDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    // Create blog content object
    const blogContent: BlogContent = {
      title: draft.title,
      content: draft.content,
      metadata: {
        author: draft.authorAddress,
        category: draft.category,
        tags: draft.tags,
        createdAt: draft.createdAt,
        banner: draft.banner
      }
    };

    // Upload to Swarm
    const contentReference = await this.uploadBlogContent(blogContent);

    // Update draft with content reference
    const updatedDraft = {
      ...draft,
      contentReference,
      isPublished: true,
      lastModified: Date.now()
    };

    // Save updated draft
    localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(updatedDraft));

    return { draft: updatedDraft, contentReference };
  }

  /**
   * Upload an asset (image, etc.) to Swarm
   */
  async uploadAsset(file: File): Promise<string> {
    if (!this.postageBatchId) {
      await this.initialize();
    }

    try {
      // Use uploadFile instead of uploadData to preserve file type information
      const uploadResult = await this.bee.uploadFile(
        this.postageBatchId,
        file,
        file.name,
        {
          contentType: file.type
        }
      );

      return uploadResult.reference;
    } catch (error) {
      console.error('Error uploading asset:', error);
      throw new Error(`Failed to upload asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a preview from blog content
   */
  private generatePreview(content: string, maxLength: number = 200): string {
    // Remove markdown formatting for preview
    const cleanContent = content
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .replace(/!\[(.*?)\]\(.*?\)/g, '') // Remove images
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .trim();

    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }

    return cleanContent.substring(0, maxLength).trim() + '...';
  }

  /**
   * Get a URL for accessing content through the Swarm gateway
   */
  getContentUrl(reference: string): string {
    return `${this.gateway}/bytes/${reference}`;
  }

  /**
   * Check if the Bee node is running
   */
  async isNodeRunning(): Promise<boolean> {
    try {
      await this.bee.getNodeAddresses();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we have a usable postage stamp
   */
  async hasUsableStamp(): Promise<boolean> {
    try {
      const stamps = await this.bee.getAllPostageBatch();
      return stamps.some(stamp => stamp.usable);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status for diagnostics
   */
  async getServiceStatus(): Promise<{
    nodeRunning: boolean;
    hasStamp: boolean;
    gateway: string;
    postageBatchId: string;
  }> {
    const nodeRunning = await this.isNodeRunning();
    const hasStamp = nodeRunning ? await this.hasUsableStamp() : false;
    
    return {
      nodeRunning,
      hasStamp,
      gateway: this.gateway,
      postageBatchId: this.postageBatchId
    };
  }
}

// Create a singleton instance
export const beeBlogService = new BeeBlogService();