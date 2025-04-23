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
 * Improved to more reliably extract Swarm references
 * @param callData Contract call data
 * @returns Extracted content reference or empty string
 */
export function extractContentReference(callData: string): string {
    try {
      if (!callData || !callData.startsWith('0x')) return '';
      
      // Remove function selector (first 4 bytes / 8 hex chars)
      const dataWithoutSelector = callData.slice(10);
      
      // In mintTo(address, string) function, the string comes after the address
      // Get string data offset (typically 64 bytes after address)
      const stringOffsetPos = 64; // Skip the address parameter (32 bytes = 64 hex chars)
      const stringOffsetHex = dataWithoutSelector.slice(stringOffsetPos, stringOffsetPos + 64);
      const stringOffset = parseInt(stringOffsetHex, 16);
      
      // Get string length from the offset position
      const stringLengthPos = stringOffset * 2; // Convert byte offset to hex char offset
      if (dataWithoutSelector.length < stringLengthPos + 64) return '';
      
      const stringLengthHex = dataWithoutSelector.slice(stringLengthPos, stringLengthPos + 64);
      const stringLength = parseInt(stringLengthHex, 16);
      
      // Get string data
      const stringDataPos = stringLengthPos + 64;
      if (dataWithoutSelector.length < stringDataPos + (stringLength * 2)) return '';
      
      const stringDataHex = dataWithoutSelector.slice(stringDataPos, stringDataPos + (stringLength * 2));
      
      // Convert hex to string
      const bytes = ethers.toUtf8Bytes(`0x${stringDataHex}`);
      const contentRef = ethers.toUtf8String(bytes).replace(/[^\x20-\x7E]/g, '');
      
      // Extract bzz:// reference if present - FIXED to include dashes
      const bzzMatch = contentRef.match(/bzz:\/\/[a-zA-Z0-9\-_]+/);
      if (bzzMatch) {
        return bzzMatch[0];
      }
      
      return contentRef;
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