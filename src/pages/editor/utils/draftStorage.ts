// src/pages/editor/utils/draftStorage.ts
import { EnhancedBlogDraft, UnifiedBlogData, AssetReference, EditorStep } from '../types/editorTypes';
// Import the existing BlogProposal type from blockchain types
import { BlogProposal } from '../../../types/blockchain';

/**
 * Enhanced draft storage service that:
 * 1. Maintains data format consistency with NFT proposals
 * 2. Tracks asset usage within drafts
 * 3. Stores workflow progress
 * 4. Provides migration from legacy format
 */
export class EnhancedDraftStorage {
  private readonly DRAFT_PREFIX = 'enhanced-blog-draft-';
  private readonly LEGACY_PREFIX = 'blog-draft-';
  private readonly ASSETS_PREFIX = 'religiodao-assets-';

  /**
   * Save a draft with enhanced tracking
   */
  saveDraft(
    draftData: Partial<EnhancedBlogDraft> & { title: string; content: string; authorAddress: string },
    workflowAction?: string
  ): EnhancedBlogDraft {
    const draftId = draftData.id || this.generateDraftId();
    const now = Date.now();
    
    // Analyze content for asset references
    const usedAssets = this.extractAssetReferences(draftData.content, draftData.authorAddress);
    const assetSnapshot = this.createAssetSnapshot(usedAssets);
    
    // Create enhanced draft
    const enhancedDraft: EnhancedBlogDraft = {
      id: draftId,
      title: draftData.title,
      content: draftData.content,
      category: draftData.category || '',
      tags: draftData.tags || [],
      authorAddress: draftData.authorAddress,
      preview: draftData.preview || this.generatePreview(draftData.content),
      banner: draftData.banner || null,
      description: draftData.description || '',
      contentReference: draftData.contentReference,
      isPublished: draftData.isPublished || false,
      usedAssets: usedAssets.map(ref => ref.assetId),
      assetSnapshot,
      stepProgress: draftData.stepProgress || {
        draft: true,
        swarm: Boolean(draftData.contentReference),
        governance: Boolean(draftData.isPublished)
      },
      createdAt: draftData.createdAt || now,
      lastModified: now,
      workflowHistory: [
        ...(draftData.workflowHistory || []),
        ...(workflowAction ? [{
          step: this.getCurrentStep(draftData),
          timestamp: now,
          action: workflowAction
        }] : [])
      ]
    };

    // Save to localStorage
    localStorage.setItem(
      `${this.DRAFT_PREFIX}${draftId}`,
      JSON.stringify(enhancedDraft)
    );

    return enhancedDraft;
  }

  /**
   * Load a draft with fallback to legacy format
   */
  loadDraft(draftId: string): EnhancedBlogDraft | null {
    try {
      // Try enhanced format first
      const enhancedData = localStorage.getItem(`${this.DRAFT_PREFIX}${draftId}`);
      if (enhancedData) {
        return JSON.parse(enhancedData) as EnhancedBlogDraft;
      }

      // Fallback to legacy format and migrate
      const legacyData = localStorage.getItem(`${this.LEGACY_PREFIX}${draftId}`);
      if (legacyData) {
        const legacyDraft = JSON.parse(legacyData);
        return this.migrateLegacyDraft(legacyDraft);
      }

      return null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  /**
   * Get all drafts for a user with migration support
   */
  getDrafts(authorAddress?: string): EnhancedBlogDraft[] {
    if (!authorAddress) return [];
    
    const drafts: EnhancedBlogDraft[] = [];
    const migratedDrafts: string[] = [];

    // Get all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        // Process enhanced drafts
        if (key.startsWith(this.DRAFT_PREFIX)) {
          const draftData = localStorage.getItem(key);
          if (draftData) {
            const draft = JSON.parse(draftData) as EnhancedBlogDraft;
            if (!authorAddress || draft.authorAddress.toLowerCase() === authorAddress.toLowerCase()) {
              drafts.push(draft);
            }
          }
        }
        
        // Process and migrate legacy drafts
        else if (key.startsWith(this.LEGACY_PREFIX)) {
          const draftData = localStorage.getItem(key);
          if (draftData) {
            const legacyDraft = JSON.parse(draftData);
            if (!authorAddress || legacyDraft.authorAddress?.toLowerCase() === authorAddress.toLowerCase()) {
              const migrated = this.migrateLegacyDraft(legacyDraft);
              drafts.push(migrated);
              migratedDrafts.push(key);
            }
          }
        }
      } catch (error) {
        console.error('Error processing draft:', error);
      }
    }

    // Clean up migrated legacy drafts (optional - can be disabled for safety)
    // migratedDrafts.forEach(key => localStorage.removeItem(key));

    // Sort by last modified (newest first)
    return drafts.sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Delete a draft (both enhanced and legacy versions)
   */
  deleteDraft(draftId: string): boolean {
    try {
      localStorage.removeItem(`${this.DRAFT_PREFIX}${draftId}`);
      localStorage.removeItem(`${this.LEGACY_PREFIX}${draftId}`); // Clean up legacy version too
      return true;
    } catch (error) {
      console.error('Error deleting draft:', error);
      return false;
    }
  }

  /**
   * Convert draft to proposal format for blockchain submission
   */
  draftToProposal(draft: EnhancedBlogDraft): BlogProposal {
    if (!draft.contentReference) {
      throw new Error('Draft must be published to Swarm before creating proposal');
    }
    
    if (!draft.description?.trim()) {
      throw new Error('Description is required for governance proposals');
    }

    return {
      title: draft.title,
      content: draft.content,
      contentReference: draft.contentReference,
      preview: draft.preview || this.generatePreview(draft.content),
      banner: draft.banner || null, // Ensure null instead of undefined
      category: draft.category,
      tags: draft.tags,
      authorAddress: draft.authorAddress,
      description: draft.description
    };
  }

  /**
   * Update draft workflow progress
   */
  updateWorkflowProgress(
    draftId: string,
    step: EditorStep,
    completed: boolean,
    action?: string
  ): EnhancedBlogDraft | null {
    const draft = this.loadDraft(draftId);
    if (!draft) return null;

    const updatedProgress = { 
      draft: draft.stepProgress?.draft ?? false,
      swarm: draft.stepProgress?.swarm ?? false,
      governance: draft.stepProgress?.governance ?? false
    };
    
    switch (step) {
      case 'draft':
        updatedProgress.draft = completed;
        break;
      case 'publish':
        updatedProgress.swarm = completed;
        break;
      case 'governance':
        updatedProgress.governance = completed;
        break;
    }

    const updatedDraft = {
      ...draft,
      stepProgress: updatedProgress,
      lastModified: Date.now()
    };

    return this.saveDraft(updatedDraft, action || `${step} ${completed ? 'completed' : 'started'}`);
  }

  /**
   * Get storage statistics for a user
   */
  getStorageStats(authorAddress: string) {
    const drafts = this.getDrafts(authorAddress);
    const assets = this.getUserAssets(authorAddress);
    
    const totalDrafts = drafts.length;
    const publishedDrafts = drafts.filter(d => d.isPublished).length;
    const totalAssets = assets.length;
    const usedAssets = new Set(drafts.flatMap(d => d.usedAssets || [])).size;
    
    return {
      totalDrafts,
      publishedDrafts,
      draftsPending: totalDrafts - publishedDrafts,
      totalAssets,
      usedAssets,
      unusedAssets: totalAssets - usedAssets,
      storageSize: this.calculateStorageSize(authorAddress)
    };
  }

  // Private helper methods

  private generateDraftId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePreview(content: string): string {
    // Remove markdown syntax and create preview
    const textContent = content.replace(/[#*_`-]/g, '');
    return textContent.length > 150 
      ? `${textContent.substring(0, 150)}...` 
      : textContent;
  }

  private extractAssetReferences(content: string, authorAddress: string): AssetReference[] {
    const assets = this.getUserAssets(authorAddress);
    const references: AssetReference[] = [];
    
    // Match image markdown: ![alt](url)
    const imageMatches = content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
    
    for (const match of imageMatches) {
      const [fullMatch, alt, url] = match;
      
      // Check if URL matches any of our stored assets
      for (const asset of assets) {
        const assetUrls = this.getAssetUrls(asset.reference);
        if (assetUrls.some(assetUrl => url.includes(asset.reference))) {
          references.push({
            assetId: asset.id,
            name: asset.name,
            reference: asset.reference,
            contentType: asset.contentType,
            insertedAt: Date.now(),
            usedInStep: 'draft', // Could be enhanced to track actual step
            markdownSnippet: fullMatch
          });
          break;
        }
      }
    }
    
    return references;
  }

  private createAssetSnapshot(references: AssetReference[]) {
    const snapshot: { [assetId: string]: any } = {};
    
    references.forEach(ref => {
      snapshot[ref.assetId] = {
        name: ref.name,
        reference: ref.reference,
        usedInContent: true,
        insertedAt: ref.insertedAt
      };
    });
    
    return snapshot;
  }

  private getCurrentStep(draftData: Partial<EnhancedBlogDraft>): EditorStep {
    if (draftData.isPublished) return 'success';
    if (draftData.contentReference) return 'governance';
    if (draftData.stepProgress?.swarm) return 'publish';
    return 'draft';
  }

  private migrateLegacyDraft(legacyDraft: any): EnhancedBlogDraft {
    const now = Date.now();
    
    return {
      id: legacyDraft.id,
      title: legacyDraft.title || '',
      content: legacyDraft.content || '',
      category: legacyDraft.category || '',
      tags: Array.isArray(legacyDraft.tags) ? legacyDraft.tags : [],
      authorAddress: legacyDraft.authorAddress || '',
      preview: legacyDraft.preview || this.generatePreview(legacyDraft.content || ''),
      banner: legacyDraft.banner || null,
      description: '', // Legacy drafts don't have description
      contentReference: legacyDraft.contentReference,
      isPublished: legacyDraft.isPublished || false,
      usedAssets: [], // Will be populated on next save
      assetSnapshot: {},
      stepProgress: {
        draft: true, // Always true if we're migrating an existing draft
        swarm: Boolean(legacyDraft.contentReference),
        governance: Boolean(legacyDraft.isPublished)
      },
      createdAt: legacyDraft.createdAt || now,
      lastModified: legacyDraft.lastModified || now,
      workflowHistory: [{
        step: 'draft',
        timestamp: now,
        action: 'Migrated from legacy format'
      }]
    };
  }

  private getUserAssets(authorAddress: string): any[] {
    try {
      const assetsJson = localStorage.getItem(`${this.ASSETS_PREFIX}${authorAddress}`);
      return assetsJson ? JSON.parse(assetsJson) : [];
    } catch (error) {
      console.error('Error loading user assets:', error);
      return [];
    }
  }

  private getAssetUrls(reference: string): string[] {
    // Return possible URLs for an asset reference
    return [
      `http://localhost:1633/bytes/${reference}`,
      `https://gateway.ethswarm.org/bytes/${reference}`,
      `https://api.gateway.ethswarm.org/bytes/${reference}`,
      `https://download.gateway.ethswarm.org/bytes/${reference}`
    ];
  }

  private calculateStorageSize(authorAddress: string): number {
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith(`${this.DRAFT_PREFIX}`) ||
        key.startsWith(`${this.LEGACY_PREFIX}`) ||
        key.startsWith(`${this.ASSETS_PREFIX}${authorAddress}`)
      )) {
        const data = localStorage.getItem(key);
        if (data) {
          totalSize += new Blob([data]).size;
        }
      }
    }
    
    return totalSize;
  }
}

// Export singleton instance
export const enhancedDraftStorage = new EnhancedDraftStorage();