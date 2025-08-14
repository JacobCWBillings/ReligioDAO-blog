// src/types/contentTypes.ts
import { BlogNFTMetadata } from './blockchainTypes';

/**
 * Core content reference structure for Swarm storage
 */
export interface ContentReference {
  reference: string;
  endpoint: 'bzz' | 'bytes';
  filename?: string;
  contentType?: string;
}

/**
 * Complete content references for a blog post
 */
export interface ContentReferences {
  // Primary content (markdown)
  content: ContentReference & {
    filename: 'blog-content.md';
  };
  
  // NFT metadata JSON
  metadata?: ContentReference & {
    filename: 'metadata.json';
  };
  
  // Banner/preview image
  banner?: ContentReference;
  
  // Assets used in content
  assets: ContentReference[];
  
  // Collection manifest (if uploaded as collection)
  collection?: {
    reference: string;
    manifest: Record<string, string>;
  };
}

/**
 * Blog content structure for uploads
 */
export interface BlogContent {
  title: string;
  content: string;
  metadata: {
    author: string;
    category: string;
    tags: string[];
    createdAt: number;
    banner?: string | null;
    description?: string;
  };
}

/**
 * Processed blog content with version info
 */
export interface ProcessedBlogContent extends BlogContent {
  version: string;
  type: string;
  uploadedAt: string;
  contentReference?: string;
  metadataReference?: string;
}

/**
 * Asset information structure
 */
export interface Asset {
  id: string;
  name: string;
  reference: string;
  contentType: string;
  size: number;
  uploadedAt: number;
  userAddress: string;
  gateway?: 'local' | 'public';
}

/**
 * Asset URLs for different access methods
 */
export interface AssetUrls {
  local: string;
  public: string;
  fallbacks: string[];
  webAccessible: string;
}

/**
 * Swarm upload result
 */
export interface SwarmUploadResult {
  reference: string;
  tagUid?: number;
  url: string;
}

/**
 * Swarm download options
 */
export interface SwarmDownloadOptions {
  filename?: string;      // For accessing files within collections
  forWebDisplay?: boolean; // If true, prefer bzz endpoint
  timeout?: number;        // Custom timeout in milliseconds
}

/**
 * Content validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Pipeline preparation result
 */
export interface PreparedContent {
  content: ProcessedBlogContent;
  metadata: BlogNFTMetadata;
  references: ContentReferences;
  proposalCalldata?: string;
  tokenURI?: string;
}

/**
 * Service configuration
 */
export interface SwarmConfig {
  local: string;
  public: string;
  fallbacks: string[];
  postageBatchId?: string;
}

export interface ServiceConfig {
  swarm?: Partial<SwarmConfig>;
  postageBatchId?: string;
  autoInitialize?: boolean;
  cacheExpiryMinutes?: number;
}

/**
 * Metadata versioning
 */
export interface MetadataVersion {
  version: string;
  storageMethod: 'swarm' | 'ipfs' | 'arweave';
  features: string[];
}

/**
 * Cache entry structure
 */
export interface CachedContent {
  content: string;
  html: string;
  timestamp: number;
  contentType?: string;
  references?: ContentReferences;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalAssets: number;
  totalSize: number;
  assetsByType: Record<string, number>;
  oldestAsset?: number;
  newestAsset?: number;
}