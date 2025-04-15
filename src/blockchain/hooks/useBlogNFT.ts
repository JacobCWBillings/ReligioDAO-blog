// src/blockchain/hooks/useBlogNFT.ts
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { 
  BlogNFT, 
  BlogNFTMetadata, 
  BlockchainErrorType, 
  BlockchainError, 
  BlogFilter,
  BlogSort,
  PaginatedBlogs
} from '../../types/blockchain';
import { getContractAddresses } from '../../config';

// ABI for QRC721Plus contract
const QRC721PlusABI = [
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function getApproved(uint256 tokenId) view returns (address)"
];

/**
 * Hook for interacting with the Blog NFT contract.
 * This hook focuses on read operations from the NFT contract as write operations
 * (minting) are handled through the DAO governance system.
 */
export const useBlogNFT = () => {
  const { provider, signer, account, chainId, isConnected } = useWallet();
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [nfts, setNfts] = useState<BlogNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);

  // Initialize contract when provider is available
  useEffect(() => {
    if (!provider) return;

    try {
      const addresses = getContractAddresses(chainId);
      
      // For read-only operations, we can use the provider directly
      // For operations that require signing, we'll use the signer if available
      const contractProvider = signer || provider;
      
      const nftContract = new ethers.Contract(
        addresses.blogNFT,
        QRC721PlusABI,
        contractProvider
      );
      
      setContract(nftContract);
      setError(null);
    } catch (err) {
      console.error('Error initializing NFT contract:', err);
      setError(new BlockchainError(
        'Failed to initialize NFT contract',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      ));
    }
  }, [provider, signer, chainId, isConnected]);

  /**
   * Fetch all minted blog NFTs
   */
  const getAllNFTs = useCallback(async (): Promise<BlogNFT[]> => {
    if (!contract) {
      throw new BlockchainError(
        'Contract not initialized',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Get the total supply of NFTs
      const totalSupply = await contract.totalSupply();
      
      // Fetch all token IDs and their data
      const tokenPromises = [];
      for (let i = 0; i < totalSupply.toNumber(); i++) {
        const tokenId = await contract.tokenByIndex(i);
        tokenPromises.push(getNFTById(tokenId.toString()));
      }
      
      const allNfts = await Promise.all(tokenPromises);
      
      // Filter out any nulls (in case of errors fetching individual NFTs)
      const validNfts = allNfts.filter(Boolean) as BlogNFT[];
      
      setNfts(validNfts);
      return validNfts;
    } catch (err) {
      console.error('Error fetching all NFTs:', err);
      const blockchainError = new BlockchainError(
        'Failed to fetch NFTs',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [contract]);

  /**
   * Get a specific NFT by token ID
   */
  const getNFTById = useCallback(async (tokenId: string): Promise<BlogNFT | null> => {
    if (!contract) return null;

    try {
      // Check if token exists by trying to get its owner
      const owner = await contract.ownerOf(tokenId);
      
      // Get token URI and metadata
      const tokenURI = await contract.tokenURI(tokenId);
      const metadata = await fetchMetadata(tokenURI);
      
      return {
        tokenId,
        owner,
        metadata,
        contentReference: metadata.properties.contentReference,
        proposalId: metadata.properties.proposalId,
        createdAt: new Date(metadata.properties.approvalDate).getTime()
      };
    } catch (err) {
      console.error(`Error fetching NFT ${tokenId}:`, err);
      return null;
    }
  }, [contract]);

  /**
   * Get NFTs owned by a specific address
   */
  const getNFTsByOwner = useCallback(async (ownerAddress: string): Promise<BlogNFT[]> => {
    if (!contract) {
      throw new BlockchainError(
        'Contract not initialized',
        BlockchainErrorType.ContractError
      );
    }

    try {
      // Get the number of NFTs owned by this address
      const balance = await contract.balanceOf(ownerAddress);
      
      // Fetch all tokens owned by this address
      const tokenPromises = [];
      for (let i = 0; i < balance.toNumber(); i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
        tokenPromises.push(getNFTById(tokenId.toString()));
      }
      
      const ownerNfts = await Promise.all(tokenPromises);
      return ownerNfts.filter(Boolean) as BlogNFT[];
    } catch (err) {
      console.error(`Error fetching NFTs for owner ${ownerAddress}:`, err);
      const blockchainError = new BlockchainError(
        'Failed to fetch owner NFTs',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
      throw blockchainError;
    }
  }, [contract, getNFTById]);

  /**
   * Fetch metadata from a token URI
   */
  const fetchMetadata = async (tokenURI: string): Promise<BlogNFTMetadata> => {
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
      } else {
        // Assume it's direct JSON (unlikely but possible)
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
          authorAddress: ""
        }
      };
    }
  };

  /**
   * Filter NFTs based on criteria
   */
  const filterNFTs = useCallback((
    nftsToFilter: BlogNFT[],
    filter?: BlogFilter
  ): BlogNFT[] => {
    if (!filter) return nftsToFilter;
    
    return nftsToFilter.filter(nft => {
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
        
        if (!tags.some(tag => tag.toLowerCase() === filter.tag?.toLowerCase())) {
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
  }, []);

  /**
   * Sort NFTs based on criteria
   */
  const sortNFTs = useCallback((
    nftsToSort: BlogNFT[],
    sort?: BlogSort
  ): BlogNFT[] => {
    if (!sort) return nftsToSort;
    
    return [...nftsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'title':
          comparison = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case 'category':
          const categoryA = a.metadata.properties.category || '';
          const categoryB = b.metadata.properties.category || '';
          comparison = categoryA.localeCompare(categoryB);
          break;
        case 'votes':
          // If votes are stored in metadata, we could sort by them
          // For now, defaulting to createdAt
          comparison = a.createdAt - b.createdAt;
          break;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, []);

  /**
   * Get paginated NFTs with filtering and sorting
   */
  const getPaginatedNFTs = useCallback(async (
    page: number = 1,
    pageSize: number = 10,
    filter?: BlogFilter,
    sort?: BlogSort
  ): Promise<PaginatedBlogs> => {
    // Fetch all NFTs if not already cached
    let allNfts = nfts;
    if (allNfts.length === 0) {
      allNfts = await getAllNFTs();
    }
    
    // Apply filters
    const filteredNfts = filterNFTs(allNfts, filter);
    
    // Apply sorting
    const sortedNfts = sortNFTs(filteredNfts, sort);
    
    // Calculate pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, sortedNfts.length);
    const paginatedItems = sortedNfts.slice(startIndex, endIndex);
    
    return {
      items: paginatedItems,
      total: sortedNfts.length,
      page,
      pageSize,
      hasMore: endIndex < sortedNfts.length
    };
  }, [nfts, getAllNFTs, filterNFTs, sortNFTs]);

  /**
   * Get all categories from NFTs
   */
  const getAllCategories = useCallback((): string[] => {
    const categories = new Set<string>();
    
    nfts.forEach(nft => {
      if (nft.metadata.properties.category) {
        categories.add(nft.metadata.properties.category);
      }
    });
    
    return Array.from(categories);
  }, [nfts]);

  /**
   * Get all tags from NFTs
   */
  const getAllTags = useCallback((): string[] => {
    const tags = new Set<string>();
    
    nfts.forEach(nft => {
      if (nft.metadata.properties.tags && Array.isArray(nft.metadata.properties.tags)) {
        nft.metadata.properties.tags.forEach(tag => tags.add(tag));
      }
    });
    
    return Array.from(tags);
  }, [nfts]);

  return {
    nfts,
    loading,
    error,
    getAllNFTs,
    getNFTById,
    getNFTsByOwner,
    filterNFTs,
    sortNFTs,
    getPaginatedNFTs,
    getAllCategories,
    getAllTags
  };
};

export default useBlogNFT;