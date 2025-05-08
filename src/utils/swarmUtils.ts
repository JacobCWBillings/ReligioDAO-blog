// src/utils/swarmUtils.ts
/**
 * Utility functions for standardized Swarm content handling
 */

// Standard file name for all markdown content
export const STANDARD_CONTENT_FILENAME = 'content.md';

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
 * Build a standardized URL for retrieving content from Swarm
 * @param reference Swarm content reference
 * @param gateway Swarm gateway URL (defaults to local node)
 * @returns Full URL to the content
 */
export const buildSwarmContentUrl = (
  reference: string, 
  gateway: string = 'http://localhost:1633'
): string => {
  const cleanRef = cleanSwarmReference(reference);
  return `${gateway}/bzz/${cleanRef}/${STANDARD_CONTENT_FILENAME}`;
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
 * Create the appropriate URL to access an asset in Swarm based on its type
 * @param reference Swarm reference to the asset
 * @param type Optional content type to determine appropriate endpoint
 * @param gateway Optional Swarm gateway URL
 * @returns The full URL to access the asset
 */
export const createAssetUrl = (
  reference: string, 
  type?: string,
  gateway: string = 'http://localhost:1633'
): string => {
  // Determine if this is an image or other binary content
  if (type && (type.startsWith('image/') || type.startsWith('audio/') || type.startsWith('video/'))) {
    return buildSwarmBytesUrl(reference, gateway);
  }
  
  // Default to bytes endpoint for most reliable content access
  return buildSwarmBytesUrl(reference, gateway);
};