// src/blockchain/utils/metadata.ts
import { BlogNFTMetadata } from '../../types/blockchain';
import config from '../../config';

/**
 * Creates metadata for a Blog NFT
 * This metadata is stored directly on-chain via the NFT for permanence
 * Only the blog content itself is stored on Swarm
 * 
 * @param title Blog title
 * @param description Blog description
 * @param contentReference Swarm content reference
 * @param author Author's address
 * @param category Blog category
 * @param tags List of tags
 * @param previewImage Preview image reference (optional)
 * @returns BlogNFTMetadata object
 */
export function createBlogNFTMetadata(
  title: string,
  description: string,
  contentReference: string,
  author: string,
  category: string,
  tags: string[],
  previewImage?: string
): BlogNFTMetadata {
  const approvalDate = new Date().toISOString();
  
  // Make sure tags is always an array
  const validTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
  
  // Create a compact but complete metadata structure
  return {
    name: title,
    description: description,
    image: previewImage 
      ? `${config.swarm.gateway}/bzz/${previewImage}` 
      : config.placeholderImage,
    attributes: [
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
      },
      ...validTags.map(tag => ({
        trait_type: "Tag",
        value: tag
      }))
    ],
    properties: {
      contentReference, // Only the content reference points to Swarm
      approvalDate,
      category,
      tags: validTags,
      authorAddress: author
      // We don't need to store proposalId in the metadata
      // since the NFT itself is created through the proposal process
    }
  };
}

/**
 * Converts NFT metadata to a token URI
 * Use base64 encoding to store directly on-chain for permanence
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
 * @param tokenURI Token URI string (base64, Swarm, or IPFS)
 * @returns Promise resolving to BlogNFTMetadata
 */
export async function parseMetadataFromURI(tokenURI: string): Promise<BlogNFTMetadata> {
  try {
    // Handle different URI formats
    if (tokenURI.startsWith('data:application/json;base64,')) {
      // Base64 encoded JSON (preferred for on-chain storage)
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const jsonString = decodeURIComponent(escape(atob(base64Data))); // Fix decoding for Unicode characters
      return JSON.parse(jsonString);
    } else if (tokenURI.startsWith('ipfs://')) {
      // IPFS URI
      const ipfsGateway = config.ipfsGateway;
      const ipfsHash = tokenURI.replace('ipfs://', '');
      const response = await fetch(`${ipfsGateway}${ipfsHash}`);
      return await response.json();
    } else if (tokenURI.startsWith('bzz://')) {
      // Swarm URI
      const swarmGateway = config.swarm.gateway;
      const swarmRef = tokenURI.replace('bzz://', '');
      const response = await fetch(`${swarmGateway}/bzz/${swarmRef}`);
      return await response.json();
    } else if (tokenURI.startsWith('http')) {
      // HTTP URI
      const response = await fetch(tokenURI);
      return await response.json();
    } else if (/^[a-fA-F0-9]{64}$/.test(tokenURI)) {
      // Looks like a raw Swarm hash
      const swarmGateway = config.swarm.gateway;
      const response = await fetch(`${swarmGateway}/bytes/${tokenURI}`);
      return await response.json();
    } else {
      // Try to parse as direct JSON
      try {
        return JSON.parse(tokenURI);
      } catch {
        throw new Error(`Unsupported token URI format: ${tokenURI}`);
      }
    }
  } catch (err) {
    console.error(`Error parsing metadata from ${tokenURI}:`, err);
    // Return minimal valid metadata to prevent crashes
    return {
      name: "Error fetching metadata",
      description: "Failed to load blog metadata",
      image: "",
      attributes: [],
      properties: {
        contentReference: "",
        approvalDate: new Date().toISOString(),
        category: "",
        tags: [],
        authorAddress: ""
      }
    };
  }
}