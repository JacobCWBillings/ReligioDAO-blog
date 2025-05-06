// src/blockchain/utils/metadata.ts
import { BlogNFTMetadata, NFTAttribute } from '../../types/blockchain';
import config from '../../config';

/**
 * Creates standardized metadata for a Blog NFT
 * This metadata is stored directly on-chain via the NFT for permanence
 * Only the blog content itself is stored on Swarm
 * 
 * @param title Blog title
 * @param description Blog description
 * @param contentReference Swarm content reference
 * @param author Author's address
 * @param category Blog category
 * @param tags List of tags
 * @param proposalId Optional proposal ID associated with this blog
 * @param previewImage Preview image reference (optional)
 * @returns BlogNFTMetadata object
 */
export function createBlogNFTMetadata(
  title: string,
  description: string,
  contentReference: string,
  author: string,
  category: string,
  tags: string[] | string,
  proposalId?: string,
  previewImage?: string
): BlogNFTMetadata {
  const approvalDate = new Date().toISOString();
  
  // Make sure tags is always an array
  const validTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
  
  // Collect attributes
  const attributes: NFTAttribute[] = [
    {
      trait_type: "Author",
      value: author
    },
    {
      trait_type: "PublishedDate",
      value: approvalDate
    },
    {
      trait_type: "Category",
      value: category
    }
  ];
  
  // Add tags as attributes
  validTags.forEach(tag => {
    attributes.push({
      trait_type: "Tag",
      value: tag
    });
  });
  
  // Create a compact but complete metadata structure
  return {
    name: title,
    description: description,
    image: previewImage 
      ? `${config.swarm.gateway}/bzz/${previewImage}` 
      : config.placeholderImage,
    attributes,
    properties: {
      contentReference, // Only the content reference points to Swarm
      proposalId,       // Optional proposal ID 
      approvalDate,
      category,
      tags: validTags,
      authorAddress: author
    }
  };
}

/**
 * Converts NFT metadata to a token URI
 * Uses base64 encoding to store directly on-chain for permanence
 * 
 * @param metadata BlogNFTMetadata object
 * @param method 'base64' | 'swarm' | 'ipfs'
 * @param reference Reference if using swarm or ipfs
 * @returns Token URI string
 */
export function metadataToTokenURI(
  metadata: BlogNFTMetadata, 
  method: 'base64' | 'swarm' | 'ipfs' = 'base64',
  reference?: string
): string {
  switch (method) {
    case 'base64':
      // Encode as base64 data URI (stored directly on-chain)
      const jsonString = JSON.stringify(metadata);
      const base64Data = btoa(unescape(encodeURIComponent(jsonString))); // Fix encoding for Unicode characters
      return `data:application/json;base64,${base64Data}`;
    
    case 'swarm':
      // Use Swarm reference - not recommended for metadata due to stamp expiration
      if (!reference) {
        throw new Error('Swarm reference is required when using method "swarm"');
      }
      return `bzz://${reference}`;
    
    case 'ipfs':
      // Use IPFS reference
      if (!reference) {
        throw new Error('IPFS reference is required when using method "ipfs"');
      }
      return `ipfs://${reference}`;
  }
}

/**
 * Parses metadata from token URI
 * Handles various URI formats: base64, Swarm, IPFS, HTTP
 * Now with graceful error handling for invalid metadata
 * 
 * @param tokenURI Token URI string (base64, Swarm, or IPFS)
 * @returns Promise resolving to BlogNFTMetadata
 */
export async function parseMetadataFromURI(tokenURI: string): Promise<BlogNFTMetadata> {
  try {
    // Handle different URI formats
    if (tokenURI.startsWith('data:application/json;base64,')) {
      // Base64 encoded JSON (preferred for on-chain storage)
      try {
        const base64Data = tokenURI.replace('data:application/json;base64,', '');
        const jsonString = decodeURIComponent(escape(atob(base64Data))); // Fix decoding for Unicode characters
        return JSON.parse(jsonString);
      } catch (innerErr) {
        console.warn(`Error parsing base64 data URI: ${innerErr}`);
        // Fall through to the fallback
      }
    } else if (tokenURI.startsWith('ipfs://')) {
      // IPFS URI
      try {
        const ipfsGateway = config.ipfsGateway;
        const ipfsHash = tokenURI.replace('ipfs://', '');
        const response = await fetch(`${ipfsGateway}${ipfsHash}`);
        return await response.json();
      } catch (innerErr) {
        console.warn(`Error fetching from IPFS: ${innerErr}`);
        // Fall through to the fallback
      }
    } else if (tokenURI.startsWith('bzz://')) {
      // Swarm URI
      try {
        const swarmGateway = config.swarm.gateway;
        const swarmRef = tokenURI.replace('bzz://', '');
        const response = await fetch(`${swarmGateway}/bzz/${swarmRef}`);
        return await response.json();
      } catch (innerErr) {
        console.warn(`Error fetching from Swarm: ${innerErr}`);
        // Fall through to the fallback
      }
    } else if (tokenURI.startsWith('http')) {
      // HTTP URI
      try {
        const response = await fetch(tokenURI);
        return await response.json();
      } catch (innerErr) {
        console.warn(`Error fetching from HTTP URI: ${innerErr}`);
        // Fall through to the fallback
      }
    } else if (/^[a-fA-F0-9]{64}$/.test(tokenURI)) {
      // Looks like a raw Swarm hash
      try {
        const swarmGateway = config.swarm.gateway;
        const response = await fetch(`${swarmGateway}/bytes/${tokenURI}`);
        return await response.json();
      } catch (innerErr) {
        console.warn(`Error fetching from Swarm hash: ${innerErr}`);
        // Fall through to the fallback
      }
    } else {
      // Try to parse as direct JSON
      try {
        return JSON.parse(tokenURI);
      } catch (innerErr) {
        console.warn(`Unsupported token URI format or invalid JSON: ${tokenURI.substring(0, 100)}...`);
        // Fall through to the fallback
      }
    }
    
    // If we reach here, all parsing attempts failed
    // Instead of throwing, return a fallback metadata object
    return createFallbackMetadata(tokenURI);
  } catch (err) {
    console.error(`Error parsing metadata from ${tokenURI ? tokenURI.substring(0, 50) + '...' : 'undefined'}:`, err);
    // Return minimal valid metadata to prevent crashes
    return createFallbackMetadata(tokenURI);
  }
}

/**
 * Creates fallback metadata for invalid NFTs
 * This ensures the application continues working even with invalid metadata
 * 
 * @param tokenURI Original tokenURI that failed to parse
 * @returns A minimal valid BlogNFTMetadata object
 */
function createFallbackMetadata(tokenURI: string): BlogNFTMetadata {
  const truncatedURI = tokenURI && tokenURI.length > 20 
    ? `${tokenURI.substring(0, 20)}...` 
    : tokenURI || 'unknown';
  
  return {
    name: "Invalid Metadata NFT",
    description: `This NFT has invalid metadata format and cannot be displayed properly. URI: ${truncatedURI}`,
    image: config.placeholderImage,
    attributes: [
      {
        trait_type: "Error",
        value: "Invalid Metadata Format"
      }
    ],
    properties: {
      contentReference: "",
      approvalDate: new Date().toISOString(),
      category: "Error",
      tags: ["invalid"],
      authorAddress: ""
    }
  };
}

/**
 * Extracts content reference from metadata
 * 
 * @param metadata BlogNFTMetadata object
 * @returns Content reference string or empty string
 */
export function extractContentReferenceFromMetadata(metadata: BlogNFTMetadata): string {
  if (metadata && metadata.properties && metadata.properties.contentReference) {
    return metadata.properties.contentReference;
  }
  return '';
}