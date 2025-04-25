// src/blockchain/utils/contentHash.ts
import { ethers } from 'ethers';
import { Bee } from '@ethersphere/bee-js';
import config from '../../config';

/**
 * Uploads content to Swarm and returns the reference
 * @param content Content string or binary data
 * @param postageBatchId Postage batch ID for Swarm upload
 * @param tags Optional tags for indexing
 * @returns Promise resolving to Swarm reference
 */
export async function uploadToSwarm(
  content: string | Uint8Array, 
  postageBatchId: string,
  tags?: string[]
): Promise<string> {
  try {
    const bee = new Bee(config.swarm.gateway);
    
    // Convert string to bytes if needed
    const contentData = typeof content === 'string' 
      ? new TextEncoder().encode(content) 
      : content;
    
    // Upload to Swarm
    const result = await bee.uploadData(postageBatchId, contentData);
    
    return result.reference;
  } catch (err) {
    console.error('Failed to upload content to Swarm:', err);
    throw err;
  }
}

/**
 * Downloads content from Swarm by reference
 * @param reference Swarm content reference
 * @returns Promise resolving to content string
 */
export async function downloadFromSwarm(reference: string): Promise<string> {
  try {
    const bee = new Bee(config.swarm.gateway);
    
    // Download from Swarm
    const result = await bee.downloadData(reference);
    
    // Convert to string
    return new TextDecoder().decode(result);
  } catch (err) {
    console.error(`Failed to download content from Swarm (${reference}):`, err);
    throw err;
  }
}

/**
 * Extracts content reference from contract calldata
 * Robust implementation that handles multiple formats and edge cases
 * 
 * @param callData Contract call data (e.g., from mintTo function call)
 * @returns Extracted content reference or empty string
 */
export function extractContentReference(callData: string): string {
  try {
    // Guard against invalid input
    if (!callData || typeof callData !== 'string' || !callData.startsWith('0x')) {
      return '';
    }
    
    // First try to parse as metadata URI in the mintTo function
    try {
      // Remove function selector (first 4 bytes / 10 hex chars including 0x)
      const dataWithoutSelector = callData.slice(10);
      
      // For mintTo(address, string) function:
      // First parameter is address (32 bytes / 64 hex chars)
      // Second parameter is string, which starts with an offset (32 bytes / 64 hex chars)
      const stringOffsetPos = 64; // Skip the address parameter
      const stringOffsetHex = dataWithoutSelector.slice(stringOffsetPos, stringOffsetPos + 64);
      const stringOffset = parseInt(stringOffsetHex, 16) * 2; // Convert byte offset to hex char offset
      
      // Guard against invalid offsets
      if (isNaN(stringOffset) || stringOffset <= 0 || dataWithoutSelector.length < stringOffset + 64) {
        return '';
      }
      
      // Get string length from the offset position
      const stringLengthHex = dataWithoutSelector.slice(stringOffset, stringOffset + 64);
      const stringLength = parseInt(stringLengthHex, 16) * 2; // Convert byte length to hex char length
      
      // Guard against invalid string length
      if (isNaN(stringLength) || stringLength <= 0 || dataWithoutSelector.length < stringOffset + 64 + stringLength) {
        return '';
      }
      
      // Get string data
      const stringDataPos = stringOffset + 64;
      const stringDataHex = dataWithoutSelector.slice(stringDataPos, stringDataPos + stringLength);
      
      // Convert hex to string
      let contentString = '';
      try {
        if (stringDataHex) {
          const bytes = ethers.getBytes(`0x${stringDataHex}`);
          contentString = ethers.toUtf8String(bytes);
        }
      } catch (e) {
        // If direct conversion fails, try character by character to handle partial UTF-8
        contentString = '';
        for (let i = 0; i < stringDataHex.length; i += 2) {
          const charCode = parseInt(stringDataHex.substr(i, 2), 16);
          if (charCode >= 32 && charCode <= 126) { // Only printable ASCII
            contentString += String.fromCharCode(charCode);
          }
        }
      }
      
      // Extract different types of references
      
      // Check for base64 metadata that contains a content reference
      if (contentString.startsWith('data:application/json;base64,')) {
        try {
          const base64Data = contentString.replace('data:application/json;base64,', '');
          const jsonString = atob(base64Data);
          const metadata = JSON.parse(jsonString);
          
          if (metadata && metadata.properties && metadata.properties.contentReference) {
            return metadata.properties.contentReference;
          }
        } catch (e) {
          // Fall through to other extraction methods
        }
      }
      
      // Check for direct Swarm reference
      const bzzMatch = contentString.match(/bzz:\/\/([a-zA-Z0-9\-_]{64})/);
      if (bzzMatch && bzzMatch[1]) {
        return bzzMatch[1];
      }
      
      // Check for raw Swarm hash (64 hex chars)
      const hashMatch = contentString.match(/([a-fA-F0-9]{64})/);
      if (hashMatch && hashMatch[1] && isValidSwarmReference(hashMatch[1])) {
        return hashMatch[1];
      }
      
      return contentString;
    } catch (innerErr) {
      // Fall through to simpler extraction if the structured approach fails
    }
    
    // Simpler fallback extraction - just look for patterns in the raw calldata
    const bzzMatch = callData.match(/bzz:\/\/([a-zA-Z0-9\-_]{64})/);
    if (bzzMatch && bzzMatch[1]) {
      return bzzMatch[1];
    }
    
    // Look for a 64-character hex string that could be a Swarm reference
    const hexMatch = callData.match(/([a-fA-F0-9]{64})/g);
    if (hexMatch) {
      for (const match of hexMatch) {
        if (isValidSwarmReference(match)) {
          return match;
        }
      }
    }
    
    return '';
  } catch (err) {
    console.error('Error extracting content reference:', err);
    return '';
  }
}

/**
 * Validates if a string is a valid Swarm reference
 * @param reference Potential Swarm reference
 * @returns True if valid reference format
 */
export function isValidSwarmReference(reference: string): boolean {
  // Basic validation - Swarm refs are 64 hex chars or have bzz:// prefix
  if (reference.startsWith('bzz://')) {
    const ref = reference.slice(6);
    return /^[a-fA-F0-9]{64}$/.test(ref);
  }
  
  return /^[a-fA-F0-9]{64}$/.test(reference);
}

/**
 * Creates a Swarm URL for a reference
 * @param reference Swarm reference
 * @param isBytes If true, create a bytes URL instead of bzz URL
 * @returns Full Swarm URL
 */
export function createSwarmUrl(reference: string, isBytes: boolean = false): string {
  // Handle bzz:// prefix
  const cleanRef = reference.startsWith('bzz://') ? reference.slice(6) : reference;
  
  // Create appropriate URL
  const urlType = isBytes ? 'bytes' : 'bzz';
  return `${config.swarm.gateway}/${urlType}/${cleanRef}`;
}