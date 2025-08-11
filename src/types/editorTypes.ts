// src/pages/editor/types/editorTypes.ts
export type EditorStep = 'draft' | 'review' | 'publish' | 'governance' | 'success';

/**
 * Unified blog data structure that works for both drafts and proposals
 * Aligns with NFT storage format while supporting draft functionality
 */
export interface UnifiedBlogData {
  // Core content (required for both drafts and proposals)
  title: string;
  content: string;
  category: string;
  tags: string[];
  authorAddress: string;
  
  // Optional metadata
  preview?: string;
  banner?: string | null;
  description?: string; // Required for governance proposals
  
  // Swarm/publication data
  contentReference?: string;
  
  // Asset tracking (enhance draft-asset integration)
  usedAssets?: string[]; // Array of asset IDs referenced in content
  
  // Workflow state
  stepProgress?: {
    draft: boolean;
    swarm: boolean;
    governance: boolean;
  };
  
  // Timestamps
  createdAt: number;
  lastModified: number;
}

/**
 * Enhanced draft structure that maintains compatibility with existing system
 * but aligns with proposal format and includes workflow state
 */
export interface EnhancedBlogDraft extends UnifiedBlogData {
  id: string;
  isPublished?: boolean;
  
  // Enhanced asset integration
  assetSnapshot?: {
    [assetId: string]: {
      name: string;
      reference: string;
      usedInContent: boolean;
      insertedAt: number;
    };
  };
  
  // Workflow history for better UX
  workflowHistory?: {
    step: EditorStep;
    timestamp: number;
    action: string;
  }[];
}

// Note: We use the existing BlogProposal from src/types/blockchain
// instead of defining our own to avoid type conflicts

/**
 * Asset reference information for tracking usage in drafts
 */
export interface AssetReference {
  assetId: string;
  name: string;
  reference: string;
  contentType: string;
  insertedAt: number;
  usedInStep: EditorStep;
  markdownSnippet: string; // The actual markdown that was inserted
}

/**
 * Editor workflow state
 */
export interface EditorWorkflowState {
  currentStep: EditorStep;
  stepStatus: {
    draft: boolean;
    swarm: boolean;
    governance: boolean;
  };
  canProgress: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Form validation errors
 */
export interface EditorFormErrors {
  title?: string;
  content?: string;
  category?: string;
  description?: string;
  tags?: string;
}