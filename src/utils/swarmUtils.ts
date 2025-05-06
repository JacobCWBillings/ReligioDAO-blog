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
 * @param gateway Swarm gateway URL
 * @returns Full URL to the content
 */
export const buildSwarmContentUrl = (
  reference: string, 
  gateway: string = 'https://gateway.ethswarm.org'
): string => {
  const cleanRef = cleanSwarmReference(reference);
  return `${gateway}/bzz/${cleanRef}/${STANDARD_CONTENT_FILENAME}`;
};

/**
 * Determine if a reference is already standardized (contains the path)
 * @param reference The reference string to check
 * @returns Boolean indicating if the reference contains path info
 */
export const isStandardizedReference = (reference: string): boolean => {
  return reference.includes('/');
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