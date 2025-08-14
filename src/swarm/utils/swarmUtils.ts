// src/utils/swarmUtils.ts
/**
 * Utility functions for Swarm content handling
 * Single source of truth for URL patterns and best practices
 */

// Standard filenames for content types
export const STANDARD_CONTENT_FILENAME = 'index.html';
export const STANDARD_MARKDOWN_FILENAME = 'blog-content.md';
export const STANDARD_METADATA_FILENAME = 'metadata.json';

// Content type detection patterns
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const WEB_CONTENT_TYPES = ['text/html', 'text/markdown', 'application/json', 'text/plain'];
const BINARY_TYPES = ['application/octet-stream', 'application/zip', 'application/pdf'];

/**
 * Content categories for endpoint selection
 */
export enum ContentCategory {
  WebContent,   // HTML, markdown, JSON - use bzz
  WebAsset,     // Images for web display - use bzz
  RawBinary,    // Downloads, archives - use bytes
  Unknown
}

/**
 * Clean Swarm reference from any prefixes
 */
export const cleanSwarmReference = (reference: string): string => {
  if (!reference) return '';
  
  return reference
    .replace(/^bzz:\/\//, '')
    .replace(/^bytes:\/\//, '')
    .replace(/^swarm:\/\//, '')
    .split('/')[0]  // Remove any path components
    .trim()
    .toLowerCase();
};

/**
 * Validate Swarm reference format
 */
export const isValidSwarmReference = (reference: string): boolean => {
  const cleaned = cleanSwarmReference(reference);
  return /^[a-f0-9]{64}$/.test(cleaned);
};

/**
 * Determine content category from MIME type
 */
export const getContentCategory = (contentType: string = ''): ContentCategory => {
  const type = contentType.toLowerCase();
  
  // Web content and displayable assets use bzz
  if (WEB_CONTENT_TYPES.some(t => type.includes(t))) {
    return ContentCategory.WebContent;
  }
  
  // Images for web display use bzz for proper headers
  if (IMAGE_TYPES.some(t => type.includes(t))) {
    return ContentCategory.WebAsset;
  }
  
  // True binary data uses bytes
  if (BINARY_TYPES.some(t => type.includes(t))) {
    return ContentCategory.RawBinary;
  }
  
  // Default to web content for unknown types
  return ContentCategory.WebContent;
};

/**
 * Determine the appropriate endpoint for content type
 */
export const getEndpointForContent = (
  contentType: string,
  forceBytes: boolean = false
): 'bzz' | 'bytes' => {
  if (forceBytes) return 'bytes';
  
  const category = getContentCategory(contentType);
  
  switch (category) {
    case ContentCategory.RawBinary:
      return 'bytes';
    case ContentCategory.WebContent:
    case ContentCategory.WebAsset:
    default:
      return 'bzz';
  }
};

/**
 * Build URL for accessing content from Swarm
 */
export const buildSwarmUrl = (
  reference: string,
  gateway: string,
  options: {
    endpoint?: 'bzz' | 'bytes';
    filename?: string;
    path?: string;
  } = {}
): string => {
  const cleanRef = cleanSwarmReference(reference);
  
  if (!isValidSwarmReference(cleanRef)) {
    throw new Error(`Invalid Swarm reference: ${reference}`);
  }
  
  const endpoint = options.endpoint || 'bzz';
  const pathComponent = options.filename || options.path || '';
  
  // Build URL with optional path/filename
  const baseUrl = `${gateway}/${endpoint}/${cleanRef}`;
  return pathComponent ? `${baseUrl}/${pathComponent}` : baseUrl;
};

/**
 * Build URL specifically for web content
 */
export const buildWebContentUrl = (
  reference: string,
  gateway: string = 'https://api.gateway.ethswarm.org',
  filename?: string
): string => {
  return buildSwarmUrl(reference, gateway, {
    endpoint: 'bzz',
    filename
  });
};

/**
 * Build URL specifically for raw bytes
 */
export const buildBytesUrl = (
  reference: string,
  gateway: string = 'https://api.gateway.ethswarm.org'
): string => {
  return buildSwarmUrl(reference, gateway, {
    endpoint: 'bytes'
  });
};

/**
 * Generate gateway fallback URLs
 */
export const generateFallbackUrls = (
  reference: string,
  primaryGateway: string,
  fallbackGateways: string[],
  options: {
    endpoint?: 'bzz' | 'bytes';
    filename?: string;
  } = {}
): string[] => {
  const allGateways = [primaryGateway, ...fallbackGateways];
  return allGateways.map(gateway => 
    buildSwarmUrl(reference, gateway, options)
  );
};

/**
 * Extract filename from path or URL
 */
export const extractFilename = (path: string): string => {
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
};

/**
 * Determine if content should be cached
 */
export const shouldCacheContent = (contentType: string): boolean => {
  // Cache web content and images, not large binaries
  const category = getContentCategory(contentType);
  return category !== ContentCategory.RawBinary;
};

/**
 * Process markdown for Swarm URLs
 * Ensures all embedded content uses correct endpoints
 */
export const processMarkdownUrls = (
  markdown: string,
  usePublicGateway: boolean = true
): string => {
  const gateway = usePublicGateway 
    ? 'https://api.gateway.ethswarm.org'
    : 'http://localhost:1633';
  
  // Convert any bytes URLs to bzz for images
  return markdown
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^\/]+)\/bytes\/([a-f0-9]{64})\)/gi,
      `![$1](${gateway}/bzz/$3)`
    )
    // Ensure local URLs use public gateway if specified
    .replace(
      /!\[([^\]]*)\]\(http:\/\/localhost:1633\/bzz\/([a-f0-9]{64})\)/gi,
      usePublicGateway ? `![$1](${gateway}/bzz/$2)` : '$&'
    );
};

/**
 * Create a shareable blog URL
 */
export const createShareableUrl = (
  reference: string,
  usePublicGateway: boolean = true
): string => {
  const gateway = usePublicGateway
    ? 'https://api.gateway.ethswarm.org'
    : 'http://localhost:1633';
    
  return buildWebContentUrl(reference, gateway);
};

/**
 * Parse Swarm URL to extract components
 */
export const parseSwarmUrl = (url: string): {
  gateway: string;
  endpoint: 'bzz' | 'bytes';
  reference: string;
  path?: string;
} | null => {
  const match = url.match(
    /^(https?:\/\/[^\/]+)\/(bzz|bytes)\/([a-f0-9]{64})(?:\/(.+))?$/i
  );
  
  if (!match) return null;
  
  return {
    gateway: match[1],
    endpoint: match[2] as 'bzz' | 'bytes',
    reference: match[3],
    path: match[4]
  };
};

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAYS = {
  local: 'http://localhost:1633',
  public: 'https://api.gateway.ethswarm.org',
  fallbacks: [
    'https://gateway.ethswarm.org',
    'https://download.gateway.ethswarm.org'
  ]
};

/**
 * Swarm limits and constraints
 */
export const SWARM_LIMITS = {
  MAX_CHUNK_SIZE: 4096,           // 4KB per chunk
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB recommended max
  REFERENCE_LENGTH: 64,             // Hex characters
  DEFAULT_TIMEOUT: 30000,           // 30 seconds
  UPLOAD_TIMEOUT: 60000,            // 60 seconds
};