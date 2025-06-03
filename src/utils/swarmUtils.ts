// src/utils/swarmUtils.ts
/**
 * Utility functions for standardized Swarm content handling
 * Optimized for web-first blog content access
 */

// Standard file name for web content
export const STANDARD_CONTENT_FILENAME = 'index.html';
export const STANDARD_MARKDOWN_FILENAME = 'content.md';
export const STANDARD_JSON_FILENAME = 'content.json';

/**
 * Clean any prefixes from a Swarm reference
 * @param reference The raw Swarm reference that might contain prefixes
 * @returns Cleaned reference
 */
export const cleanSwarmReference = (reference: string): string => {
  return reference
    .replace('bzz://', '')
    .replace('bytes://', '')
    .trim();
};

/**
 * Content type categorization for optimal Swarm endpoint selection
 */
export enum ContentCategory {
  WebContent, // HTML, markdown, JSON - use bzz endpoint
  BinaryAsset, // Images, videos, audio - use bytes endpoint
  Document,   // PDFs, docs - use bytes endpoint
  Unknown     // Default
}

/**
 * Determine content category based on MIME type
 * @param contentType MIME type of the content
 * @returns The appropriate content category
 */
export const getContentCategory = (contentType: string = ''): ContentCategory => {
  const type = contentType.toLowerCase();
  
  // Web content should use bzz endpoint for browser accessibility
  if (
    type.includes('text/html') || 
    type.includes('text/markdown') || 
    type.includes('application/json') ||
    type.includes('text/plain')
  ) {
    return ContentCategory.WebContent;
  }
  
  // Binary media assets
  if (
    type.startsWith('image/') || 
    type.startsWith('audio/') || 
    type.startsWith('video/')
  ) {
    return ContentCategory.BinaryAsset;
  }
  
  // Document formats
  if (
    type.includes('application/pdf') ||
    type.includes('application/msword') ||
    type.includes('application/vnd.openxmlformats')
  ) {
    return ContentCategory.Document;
  }
  
  // Default to unknown
  return ContentCategory.Unknown;
};

/**
 * Build a web-optimized URL for retrieving content from Swarm
 * Uses bzz endpoint for web content with proper path structure
 * 
 * @param reference Swarm content reference
 * @param gateway Swarm gateway URL (defaults to local node)
 * @param filename Optional filename within the collection
 * @returns Full URL to the content
 */
export const buildSwarmContentUrl = (
  reference: string, 
  gateway: string = 'http://localhost:1633',
  filename: string = STANDARD_CONTENT_FILENAME
): string => {
  const cleanRef = cleanSwarmReference(reference);
  // For web content, we use the bzz endpoint with proper path
  return `${gateway}/bzz/${cleanRef}/${filename}`;
};

/**
 * Build a URL for retrieving raw binary content from Swarm
 * @param reference Swarm content reference
 * @param gateway Swarm gateway URL (defaults to local node)
 * @returns Full URL to access the raw bytes
 */
export const buildSwarmBytesUrl = (
  reference: string,
  gateway: string = 'http://localhost:1633'
): string => {
  const cleanRef = cleanSwarmReference(reference);
  return `${gateway}/bytes/${cleanRef}`;
};

/**
 * Determine if a reference is a raw file or a collection
 * @param reference The reference string to analyze
 * @returns Boolean indicating if the reference is likely a raw file reference
 */
export const isRawFileReference = (reference: string): boolean => {
  // Raw files typically don't have path components and are shorter
  return !reference.includes('/') && reference.length <= 64;
};

/**
 * Extract just the hash portion from a reference that may contain path information
 * @param reference The reference that might contain path information
 * @returns The clean hash portion only
 */
export const extractHashFromReference = (reference: string): string => {
  // Remove any protocol prefixes first
  const cleanRef = cleanSwarmReference(reference);
  // If there's a path component, extract just the hash
  return cleanRef.split('/')[0];
};

/**
 * Create the appropriate URL to access content in Swarm based on its type
 * Uses best practice of bzz endpoint for web content and bytes for binary
 * 
 * @param reference Swarm reference to the content
 * @param type Optional content type to determine appropriate endpoint
 * @param gateway Optional Swarm gateway URL
 * @returns The full URL to access the content
 */
export const createContentUrl = (
  reference: string, 
  type?: string,
  gateway: string = 'http://localhost:1633'
): string => {
  // If no type provided, use the hash format to guess
  if (!type) {
    return isRawFileReference(reference) 
      ? buildSwarmBytesUrl(reference, gateway)
      : buildSwarmContentUrl(reference, gateway);
  }
  
  // Use content category to determine endpoint
  const category = getContentCategory(type);
  
  switch (category) {
    case ContentCategory.WebContent:
      // Web content should use bzz endpoint
      return buildSwarmContentUrl(
        reference, 
        gateway, 
        type.includes('markdown') ? STANDARD_MARKDOWN_FILENAME : 
        type.includes('json') ? STANDARD_JSON_FILENAME : 
        STANDARD_CONTENT_FILENAME
      );
    
    case ContentCategory.BinaryAsset:
    case ContentCategory.Document:
    case ContentCategory.Unknown:
    default:
      // Binary content uses bytes endpoint
      return buildSwarmBytesUrl(reference, gateway);
  }
};

/**
 * Create a URL specifically for asset (binary content) access
 * @param reference Swarm reference to the asset
 * @param type Optional content type
 * @param gateway Optional Swarm gateway URL
 * @returns The full URL to access the asset
 */
export const createAssetUrl = (
  reference: string, 
  type?: string,
  gateway: string = 'http://localhost:1633'
): string => {
  // Assets almost always use bytes endpoint for direct access
  return buildSwarmBytesUrl(reference, gateway);
};

/**
 * Create a blog-friendly URL for sharing content
 * @param reference Swarm reference to the blog content
 * @param gateway Optional Swarm gateway URL (preferably public)
 * @returns A web-friendly URL for the blog post
 */
export const createBlogUrl = (
  reference: string,
  gateway: string = 'https://gateway.ethswarm.org'
): string => {
  const cleanRef = cleanSwarmReference(reference);
  // Blog content should always use bzz endpoint for web accessibility
  return `${gateway}/bzz/${cleanRef}/`;
};