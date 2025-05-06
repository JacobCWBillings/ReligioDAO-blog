// src/tests/blockchain-hooks.test.ts

import { ethers } from 'ethers';
import config from '../config';
import { BlogNFTMetadata } from '../types/blockchain';

// Function extracted from useBlogNFT for testing
async function fetchMetadata(tokenURI: string): Promise<BlogNFTMetadata> {
  try {
    // Handle different URI formats
    if (tokenURI.startsWith('data:application/json;base64,')) {
      // Base64 encoded JSON
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const jsonString = atob(base64Data);
      return JSON.parse(jsonString);
    } else if (tokenURI.startsWith('ipfs://')) {
      // IPFS URI
      const ipfsGateway = 'https://ipfs.io/ipfs/';
      const ipfsHash = tokenURI.replace('ipfs://', '');
      const response = await fetch(`${ipfsGateway}${ipfsHash}`);
      return await response.json();
    } else if (tokenURI.startsWith('http')) {
      // HTTP URI
      const response = await fetch(tokenURI);
      return await response.json();
    } else if (tokenURI.startsWith('bzz://')) {
      // Swarm URI
      const swarmGateway = config.swarm.gateway;
      const swarmRef = tokenURI.replace('bzz://', '');
      const response = await fetch(`${swarmGateway}/bzz/${swarmRef}`);
      return await response.json();
    } else {
      // Try to parse as direct JSON (unlikely but possible)
      try {
        return JSON.parse(tokenURI);
      } catch {
        throw new Error(`Unsupported token URI format: ${tokenURI}`);
      }
    }
  } catch (err) {
    console.error(`Error fetching metadata from ${tokenURI}:`, err);
    // Return a minimal valid metadata object to prevent crashes
    return {
      name: "Error fetching metadata",
      description: "Failed to load blog metadata",
      image: "",
      attributes: [],
      properties: {
        contentReference: "",
        proposalId: "",
        approvalDate: new Date().toISOString(),
        category: "",
        tags: [],
        authorAddress: ""
      }
    };
  }
}

// Fix in src/__tests__/blockchain-hooks.test.ts
function extractContentReference(callData: string): string {
  try {
    if (!callData || !callData.startsWith('0x')) return '';
    
    // Remove function selector (first 4 bytes / 8 hex chars)
    const dataWithoutSelector = callData.slice(10);
    
    // In a mintTo(address, string) call, the string data comes after the address
    // This simplified parsing approach would need to be refined in production
    const stringDataStart = 128; // Skip offset to string (64 chars) + address param (64 chars)
    
    if (dataWithoutSelector.length < stringDataStart + 64) return '';
    
    // Try to extract what might be the Swarm reference
    // The first 32 bytes after the offset typically contain the string length
    const lengthHex = dataWithoutSelector.slice(stringDataStart, stringDataStart + 64);
    const length = parseInt(lengthHex, 16);
    
    // Extract the actual string data
    const stringStart = stringDataStart + 64;
    const stringEnd = stringStart + (Math.ceil(length / 32) * 64);
    
    if (dataWithoutSelector.length < stringEnd) return '';
    
    const contentHex = dataWithoutSelector.slice(stringStart, stringEnd);
    
    // Convert hex to UTF-8 string
    let result = '';
    for (let i = 0; i < contentHex.length; i += 2) {
      if (i + 2 <= 2 * length) {
        const hexChar = contentHex.substring(i, i + 2);
        const char = String.fromCharCode(parseInt(hexChar, 16));
        if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) { // Printable ASCII
          result += char;
        }
      }
    }
    
    // Try to extract a Swarm reference ("bzz://...") - FIXED to include dashes
    const bzzMatch = result.match(/bzz:\/\/[a-zA-Z0-9\-_]+/);
    if (bzzMatch) {
      return bzzMatch[0];
    }
    
    return result;
  } catch (err) {
    console.error('Error extracting content reference:', err);
    return '';
  }
}

// Function to filter NFTs based on criteria (extracted from useBlogNFT)
function filterNFTs(nfts: any[], filter?: any): any[] {
  if (!filter) return nfts;
  
  return nfts.filter(nft => {
    // Filter by category
    if (filter.category && nft.metadata.properties.category) {
      if (nft.metadata.properties.category.toLowerCase() !== filter.category.toLowerCase()) {
        return false;
      }
    }
    
    // Filter by tag
    if (filter.tag && nft.metadata.properties.tags) {
      const tags = Array.isArray(nft.metadata.properties.tags) 
        ? nft.metadata.properties.tags 
        : [];
      
      if (!tags.some((tag: string) => tag.toLowerCase() === filter.tag?.toLowerCase())) {
        return false;
      }
    }
    
    // Filter by author
    if (filter.author && nft.metadata.properties.authorAddress) {
      if (nft.metadata.properties.authorAddress.toLowerCase() !== filter.author.toLowerCase()) {
        return false;
      }
    }
    
    // Filter by date range
    if (filter.fromDate && nft.createdAt < filter.fromDate) {
      return false;
    }
    
    if (filter.toDate && nft.createdAt > filter.toDate) {
      return false;
    }
    
    // Filter by search term
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      const title = nft.metadata.name.toLowerCase();
      const description = nft.metadata.description.toLowerCase();
      
      if (!title.includes(term) && !description.includes(term)) {
        return false;
      }
    }
    
    return true;
  });
}

describe('ReligioDAO Blockchain Hook Functions', () => {
  describe('Metadata Handling', () => {
    it('should parse base64 encoded metadata', async () => {
      const testMetadata = {
        name: "Test Blog Post",
        description: "This is a test blog post",
        image: "https://example.com/image.jpg",
        attributes: [
          { trait_type: "Author", value: "Test Author" }
        ],
        properties: {
          contentReference: "bzz://testContentRef",
          proposalId: "123",
          approvalDate: new Date().toISOString(),
          category: "Test",
          tags: ["test", "blog"],
          authorAddress: "0x1234567890123456789012345678901234567890"
        }
      };
      
      const base64Metadata = 'data:application/json;base64,' + btoa(JSON.stringify(testMetadata));
      const result = await fetchMetadata(base64Metadata);
      
      expect(result.name).toBe(testMetadata.name);
      expect(result.properties.contentReference).toBe(testMetadata.properties.contentReference);
      expect(result.properties.category).toBe(testMetadata.properties.category);
    });
    
    it('should handle invalid metadata gracefully', async () => {
      const result = await fetchMetadata('invalid:data');
      
      expect(result.name).toBe("Error fetching metadata");
      expect(result.properties.contentReference).toBe("");
    });
  });
  
  describe('NFT Filtering', () => {
    it('should filter NFTs by category', () => {
      const testNFTs = [
        {
          tokenId: '1',
          owner: '0x1234',
          metadata: {
            name: "Test 1",
            description: "Description 1",
            properties: {
              category: "Technology",
              tags: ["tech", "blog"],
              authorAddress: "0xabc"
            }
          },
          createdAt: 1000
        },
        {
          tokenId: '2',
          owner: '0x5678',
          metadata: {
            name: "Test 2",
            description: "Description 2",
            properties: {
              category: "Philosophy",
              tags: ["philosophy", "blog"],
              authorAddress: "0xdef"
            }
          },
          createdAt: 2000
        }
      ];
      
      const filtered = filterNFTs(testNFTs, { category: "Technology" });
      expect(filtered.length).toBe(1);
      expect(filtered[0].tokenId).toBe('1');
    });
    
    it('should filter NFTs by tag', () => {
      const testNFTs = [
        {
          tokenId: '1',
          metadata: {
            name: "Test 1",
            properties: {
              tags: ["tech", "blog"]
            }
          }
        },
        {
          tokenId: '2',
          metadata: {
            name: "Test 2",
            properties: {
              tags: ["philosophy", "blog"]
            }
          }
        }
      ];
      
      const filtered = filterNFTs(testNFTs, { tag: "tech" });
      expect(filtered.length).toBe(1);
      expect(filtered[0].tokenId).toBe('1');
    });
    
    it('should filter NFTs by search term', () => {
      const testNFTs = [
        {
          tokenId: '1',
          metadata: {
            name: "Blockchain Technology",
            description: "About blockchain",
            properties: {}
          }
        },
        {
          tokenId: '2',
          metadata: {
            name: "Philosophy of Mind",
            description: "About consciousness",
            properties: {}
          }
        }
      ];
      
      const filtered = filterNFTs(testNFTs, { searchTerm: "blockchain" });
      expect(filtered.length).toBe(1);
      expect(filtered[0].tokenId).toBe('1');
    });
  });
  
  describe('Contract Data Parsing', () => {
    it('should extract Swarm content reference from calldata', () => {
      // Mock calldata for a mintTo function with a Swarm reference
      const mockCalldata = 
        '0x12345678' + // Function selector
        '000000000000000000000000abcdef1234567890abcdef1234567890abcdef12' + // Address param
        '0000000000000000000000000000000000000000000000000000000000000040' + // Offset to string
        '0000000000000000000000000000000000000000000000000000000000000018' + // String length (24 bytes)
        '627a7a3a2f2f746573742d636f6e74656e742d726566000000000000000000000'; // "bzz://test-content-ref" + padding
      
      const result = extractContentReference(mockCalldata);
      expect(result).toBe('bzz://test-content-ref');
    });
    
    it('should handle invalid calldata gracefully', () => {
      const result = extractContentReference('0xinvalid');
      expect(result).toBe('');
    });
  });
});