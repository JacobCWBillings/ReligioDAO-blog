// src/blockchain/hooks/useBlogNFT.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { useChainConstraint } from './useChainConstraint';
import { 
  BlogNFT, 
  BlogFilter,
  BlogSort,
  PaginatedBlogs,
  BlockchainErrorType, 
  BlockchainError 
} from '../../types/blockchain';
import { getContractAddresses } from '../../config';
import { parseMetadataFromURI } from '../utils/metadata';
import { toNumber } from '../utils/blockchainUtils';

import QRC721PlusABI from '../abis/QRC721Plus.json';

/**
 * Enhanced hook for interacting with the Blog NFT contract
 * Provides React-friendly access to reading NFT data with pagination and caching
 */
export const useBlogNFT = () => {
  const { provider, signer, account, chainId, isConnected } = useWallet();
  const { getConstrainedChainId, isCorrectChain, chainError } = useChainConstraint();
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [nfts, setNfts] = useState<BlogNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);
  const [isCacheInitialized, setCacheInitialized] = useState(false);
  
  // Cache of token metadata to avoid redundant fetches
  const [metadataCache, setMetadataCache] = useState<Record<string, any>>({});
  
  // Pagination state
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  
  // Stats for filtering
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  
  // Initialize contract when provider is available
  useEffect(() => {
    if (!provider) return;

    try {
      // Use the constrained chain ID instead of the wallet's chain ID
      const constrainedChainId = getConstrainedChainId();
      const addresses = getContractAddresses(constrainedChainId);
      
      // For read-only operations, we can use the provider directly
      // For operations that require signing, we'll use the signer if available
      const contractProvider = signer || provider;
      
      const nftContract = new ethers.Contract(
        addresses.blogNFT,
        QRC721PlusABI.abi,
        contractProvider
      );
      
      setContract(nftContract);
      // Set error from chain validation if there is one
      if (chainError) {
        setError(chainError);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Error initializing NFT contract:', err);
      setError(new BlockchainError(
        'Failed to initialize NFT contract',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      ));
    }
  }, [provider, signer, chainId, isConnected]);

  // Function to get the total supply of NFTs
  const getTotalSupply = useCallback(async (): Promise<number> => {
    if (!contract) return 0;
    
    try {
      const code = await provider?.getCode(contract.target);
      if (code === '0x') {
        return 0;
      }
      
      const totalSupplyBig = await contract.totalSupply();
      return toNumber(totalSupplyBig);
    } catch (err) {
      console.error('Error getting total supply:', err);
      return 0;
    }
  }, [contract, provider]);

  // Initialize cache and get basic stats about the NFTs
  useEffect(() => {
    const initializeCache = async () => {
      if (!contract || isCacheInitialized) return;
      
      setLoading(true);
      
      try {
        // Get the total supply
        const supply = await getTotalSupply();
        setTotalSupply(supply);
        setHasMoreData(supply > 0);
        
        // If there's a reasonable number of NFTs, pre-fetch some metadata
        // This helps with filtering and sorting later
        if (supply > 0 && supply <= 50) {
          // Get the first batch (up to 50 NFTs)
          const batchSize = 10;
          const batches = Math.ceil(supply / batchSize);
          
          for (let batch = 0; batch < batches; batch++) {
            const startIdx = batch * batchSize;
            const endIdx = Math.min(startIdx + batchSize, supply);
            
            const fetchPromises = [];
            for (let i = startIdx; i < endIdx; i++) {
              fetchPromises.push(fetchNFTMetadata(i));
            }
            
            await Promise.all(fetchPromises);
          }
        }
        
        setCacheInitialized(true);
      } catch (err) {
        console.error('Error initializing cache:', err);
      } finally {
        setLoading(false);
      }
    };
    
    initializeCache();
  }, [contract, isCacheInitialized, getTotalSupply]);

  /**
   * Fetch NFT metadata by index with enhanced error handling
   * 
   * @param index NFT index or token ID
   * @returns Promise resolving to BlogNFT or null
   */
  const fetchNFTMetadata = async (index: number | string): Promise<BlogNFT | null> => {
    if (!contract) return null;
    
    let tokenId: string;
    
    try {
      // Determine if this is an index or a token ID
      if (typeof index === 'number') {
        try {
          // Get token ID at index
          const tokenIdBN = await contract.tokenByIndex(index);
          tokenId = tokenIdBN.toString();
        } catch (err) {
          console.error(`Error getting token ID at index ${index}:`, err);
          return null;
        }
      } else {
        tokenId = index.toString();
      }
      
      // If we already have this in cache, return it
      if (metadataCache[tokenId]) {
        return metadataCache[tokenId];
      }
      
      // Get owner and token URI with individual error handling
      let owner: string;
      let tokenURI: string;
      
      try {
        owner = await contract.ownerOf(tokenId);
      } catch (err) {
        console.error(`Error getting owner of token ${tokenId}:`, err);
        return null; // Skip this token if we can't get the owner
      }
      
      try {
        tokenURI = await contract.tokenURI(tokenId);
      } catch (err) {
        console.error(`Error getting URI for token ${tokenId}:`, err);
        // Create a minimal tokenURI for our fallback mechanism
        tokenURI = JSON.stringify({
          name: "Error: Failed to retrieve metadata",
          description: `Error retrieving metadata for token ID ${tokenId}`,
          properties: { category: "Error" }
        });
      }
      
      // Parse metadata - our updated parseMetadataFromURI will handle errors
      const metadata = await parseMetadataFromURI(tokenURI);
      
      // Check if this is an error NFT from our fallback system
      const isErrorNFT = metadata.properties.category === "Error";
      
      // Create BlogNFT object
      const nft: BlogNFT = {
        tokenId,
        owner,
        metadata,
        contentReference: metadata.properties.contentReference || "",
        proposalId: metadata.properties.proposalId || "",
        createdAt: metadata.properties.approvalDate 
          ? new Date(metadata.properties.approvalDate).getTime() 
          : Date.now() // Fallback to current time if approval date missing
      };
      
      // Update cache
      setMetadataCache(prev => ({
        ...prev,
        [tokenId]: nft
      }));
      
      // Only add to filtering categories if this isn't an error NFT
      if (!isErrorNFT) {
        // Extract categories and tags for filtering options
        if (metadata.properties.category && typeof metadata.properties.category === 'string') {
          setCategories(prev => 
            prev.includes(metadata.properties.category as string) 
              ? prev 
              : [...prev, metadata.properties.category as string]
          );
        }

        if (metadata.properties.tags && Array.isArray(metadata.properties.tags)) {
          // Ensure we only include string values
          const validTags = metadata.properties.tags
            .filter((tag): tag is string => typeof tag === 'string' && tag !== '')
            .filter(tag => !tags.includes(tag));
          
          if (validTags.length > 0) {
            setTags(prev => [...prev, ...validTags]);
          }
        }
        
        if (metadata.properties.authorAddress) {
          setAuthors(prev => 
            prev.includes(metadata.properties.authorAddress) 
              ? prev 
              : [...prev, metadata.properties.authorAddress]
          );
        }
      }
      
      return nft;
    } catch (err) {
      console.error(`Error in fetchNFTMetadata for ${index}:`, err);
      return null;
    }
  };

  /**
   * Fetch all minted blog NFTs with improved error handling
   * 
   * @returns Promise resolving to array of BlogNFT objects
   */
  const getAllNFTs = useCallback(async (): Promise<BlogNFT[]> => {
    // First check if we have a valid contract
    if (!contract) {
      // Don't throw an error here, just return empty array
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // Get the total supply of NFTs
      const totalSupply = await getTotalSupply();
      
      // If we have no NFTs, return empty array
      if (totalSupply === 0) {
        setNfts([]);
        return [];
      }
      
      // Create array of promises (parallel execution)
      const tokenPromises: Promise<BlogNFT | null>[] = [];
      
      // Add individual error handling for each NFT fetch
      for (let i = 0; i < totalSupply; i++) {
        const fetchPromise = (async () => {
          try {
            const tokenId = await contract.tokenByIndex(i);
            return await fetchNFTMetadata(tokenId);
          } catch (err) {
            console.error(`Error fetching NFT at index ${i}:`, err);
            return null; // Return null for this specific NFT instead of failing everything
          }
        })();
        
        tokenPromises.push(fetchPromise);
      }
      
      // Wait for all promises to resolve
      const allResults = await Promise.all(tokenPromises);
      
      // Filter out null values with type predicate
      const validNfts = allResults.filter((nft): nft is BlogNFT => nft !== null);
      
      setNfts(validNfts);
      return validNfts;
    } catch (err) {
      console.error('Error fetching all NFTs:', err);
      // Don't throw error, just log it and return empty array
      return [];
    } finally {
      setLoading(false);
    }
  }, [contract, getTotalSupply, fetchNFTMetadata]);

  /**
   * Get a specific NFT by token ID
   * 
   * @param tokenId Token ID
   * @returns Promise resolving to BlogNFT object or null
   */
  const getNFTById = useCallback(async (tokenId: string): Promise<BlogNFT | null> => {
    if (!contract) return null;
    
    // Check if we have it in cache
    if (metadataCache[tokenId]) {
      return metadataCache[tokenId];
    }

    try {
      // Check if token exists by trying to get its owner
      const owner = await contract.ownerOf(tokenId);
      
      // Get token URI and metadata
      const tokenURI = await contract.tokenURI(tokenId);
      const metadata = await parseMetadataFromURI(tokenURI);
      
      // Create NFT object
      const nft: BlogNFT = {
        tokenId,
        owner,
        metadata,
        contentReference: metadata.properties.contentReference,
        proposalId: metadata.properties.proposalId || "",
        createdAt: new Date(metadata.properties.approvalDate).getTime()
      };
      
      // Update cache
      setMetadataCache(prev => ({
        ...prev,
        [tokenId]: nft
      }));
      
      return nft;
    } catch (err) {
      console.error(`Error fetching NFT ${tokenId}:`, err);
      return null;
    }
  }, [contract, metadataCache]);

  /**
   * Filter NFTs based on criteria
   * Now with handling for invalid/error NFTs
   * 
   * @param nftsToFilter Array of NFTs to filter
   * @param filter Filter criteria
   * @returns Filtered array of NFTs
   */
  const filterNFTs = useCallback((
    nftsToFilter: BlogNFT[],
    filter?: BlogFilter
  ): BlogNFT[] => {
    if (!filter) return nftsToFilter;
    
    return nftsToFilter.filter(nft => {
      // Skip NFTs with invalid metadata (they have "Error" category)
      // Only include them if specifically searching for errors
      if (nft.metadata.properties.category === "Error") {
        return filter.category === "Error";
      }
      
      // Safely access properties with null checks to prevent more errors
      
      // Filter by category
      if (filter.category && nft.metadata.properties.category) {
        const categoryValue = String(nft.metadata.properties.category).toLowerCase();
        const filterCategory = String(filter.category).toLowerCase();
        if (categoryValue !== filterCategory) {
          return false;
        }
      }
      
      // Filter by tag - Fixed to avoid 'never' type issues
      if (filter.tag && nft.metadata.properties.tags) {
        // Safe conversion of filter.tag to lowercase string
        const filterTagLower = String(filter.tag).toLowerCase();
        
        // Handle different tag formats safely
        let tagsArray: string[] = [];
        
        if (Array.isArray(nft.metadata.properties.tags)) {
          // Extract only string tags
          tagsArray = nft.metadata.properties.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map(tag => String(tag).toLowerCase());
        } else if (typeof nft.metadata.properties.tags === 'string') {
          tagsArray = [String(nft.metadata.properties.tags).toLowerCase()];
        }
        
        // Check if any tag matches
        if (!tagsArray.some(tag => tag === filterTagLower)) {
          return false;
        }
      }
      
      // Filter by author
      if (filter.author && nft.metadata.properties.authorAddress) {
        const authorValue = String(nft.metadata.properties.authorAddress).toLowerCase();
        const filterAuthor = String(filter.author).toLowerCase();
        if (authorValue !== filterAuthor) {
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
        const term = String(filter.searchTerm).toLowerCase();
        const title = String(nft.metadata.name || '').toLowerCase();
        const description = String(nft.metadata.description || '').toLowerCase();
        const category = String(nft.metadata.properties.category || '').toLowerCase();
        
        // Handle tags safely with proper type checking
        let tagsText = '';
        if (Array.isArray(nft.metadata.properties.tags)) {
          tagsText = nft.metadata.properties.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map(tag => String(tag))
            .join(' ')
            .toLowerCase();
        } else if (typeof nft.metadata.properties.tags === 'string') {
          tagsText = String(nft.metadata.properties.tags).toLowerCase();
        }
        
        // Check if any of these fields contain the search term
        if (!title.includes(term) && 
            !description.includes(term) && 
            !category.includes(term) && 
            !tagsText.includes(term)) {
          return false;
        }
      }
      
      return true;
    });
  }, []);

  /**
   * Sort NFTs based on criteria
   * 
   * @param nftsToSort Array of NFTs to sort
   * @param sort Sort criteria
   * @returns Sorted array of NFTs
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
          const titleA = String(a.metadata.name || '');
          const titleB = String(b.metadata.name || '');
          comparison = titleA.localeCompare(titleB);
          break;
        case 'category':
          const categoryA = String(a.metadata.properties.category || '');
          const categoryB = String(b.metadata.properties.category || '');
          comparison = categoryA.localeCompare(categoryB);
          break;
        default:
          comparison = a.createdAt - b.createdAt;
          break;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, []);

  /**
   * Get paginated NFTs with filtering and sorting
   * This is an optimized version that avoids loading all NFTs at once
   * 
   * @param page Page number (1-based)
   * @param pageSize Number of items per page
   * @param filter Filter criteria
   * @param sort Sort criteria
   * @returns Promise resolving to PaginatedBlogs object
   */
  const getPaginatedNFTs = useCallback(async (
    page: number = 1,
    pageSize: number = 10,
    filter?: BlogFilter,
    sort?: BlogSort
  ): Promise<PaginatedBlogs> => {
    // Validate inputs
    const validPage = Math.max(1, page);
    const validPageSize = Math.max(1, Math.min(50, pageSize)); // Limit page size to avoid excessive fetching
    
    // Determine if we need to load more NFTs
    const needsFullDataset = Boolean(
      filter?.category || 
      filter?.tag || 
      filter?.author || 
      filter?.searchTerm || 
      filter?.fromDate || 
      filter?.toDate
    );
    
    try {
      let filteredNfts: BlogNFT[] = [];
      
      if (needsFullDataset) {
        // For filtering, we need to load all NFTs first
        // This is not ideal for large collections, but necessary for accurate filtering
        const allNfts = nfts.length > 0 ? nfts : await getAllNFTs();
        
        // Apply filters
        filteredNfts = filterNFTs(allNfts, filter);
      } else {
        // No filtering needed, fetch only the required page
        // This is more efficient for large collections when not filtering
        const supply = await getTotalSupply();
        
        // If we're requesting a page beyond what's available
        if ((validPage - 1) * validPageSize >= supply) {
          return {
            items: [],
            total: supply,
            page: validPage,
            pageSize: validPageSize,
            hasMore: false
          };
        }
        
        // Calculate start and end indices for this page
        const startIndex = (validPage - 1) * validPageSize;
        const endIndex = Math.min(startIndex + validPageSize, supply);
        
        // Fetch only the NFTs needed for this page
        const fetchPromises: Promise<BlogNFT | null>[] = [];
        for (let i = startIndex; i < endIndex; i++) {
          fetchPromises.push(fetchNFTMetadata(i));
        }
        
        const pageResults = await Promise.all(fetchPromises);
        filteredNfts = pageResults.filter((nft): nft is BlogNFT => nft !== null);
      }
    
      // Apply sorting
      const sortedNfts = sortNFTs(filteredNfts, sort);
      
      if (needsFullDataset) {
        // Calculate pagination for the filtered and sorted results
        const startIndex = (validPage - 1) * validPageSize;
        const endIndex = Math.min(startIndex + validPageSize, sortedNfts.length);
        const paginatedItems = sortedNfts.slice(startIndex, endIndex);
        
        return {
          items: paginatedItems,
          total: sortedNfts.length,
          page: validPage,
          pageSize: validPageSize,
          hasMore: endIndex < sortedNfts.length
        };
      } else {
        // For non-filtered requests, we've already fetched just the page we need
        return {
          items: sortedNfts,
          total: totalSupply,
          page: validPage,
          pageSize: validPageSize,
          hasMore: (validPage * validPageSize) < totalSupply
        };
      }
    } catch (err) {
      console.error('Error fetching paginated NFTs:', err);
      
      // Return empty result on error
      return {
        items: [],
        total: 0,
        page: page,
        pageSize: pageSize,
        hasMore: false
      };
    }
  }, [nfts, getAllNFTs, filterNFTs, sortNFTs, getTotalSupply, totalSupply, fetchNFTMetadata]);

  /**
   * Get all categories from NFTs
   * 
   * @returns Array of unique categories
   */
  const getAllCategories = useCallback((): string[] => {
    // Use the pre-computed categories if available
    if (categories.length > 0) {
      return categories;
    }
    
    // Otherwise compute from current NFTs
    const categorySet = new Set<string>();
    
    nfts.forEach(nft => {
      if (nft.metadata.properties.category) {
        categorySet.add(String(nft.metadata.properties.category));
      }
    });
    
    return Array.from(categorySet);
  }, [nfts, categories]);

  /**
   * Get all tags from NFTs
   * 
   * @returns Array of unique tags
   */
  const getAllTags = useCallback((): string[] => {
    // Use the pre-computed tags if available
    if (tags.length > 0) {
      return tags;
    }
    
    // Otherwise compute from current NFTs
    const tagSet = new Set<string>();
    
    nfts.forEach(nft => {
      if (nft.metadata.properties.tags) {
        if (Array.isArray(nft.metadata.properties.tags)) {
          nft.metadata.properties.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .forEach(tag => tagSet.add(tag));
        } else if (typeof nft.metadata.properties.tags === 'string') {
          tagSet.add(nft.metadata.properties.tags);
        }
      }
    });
    
    return Array.from(tagSet);
  }, [nfts, tags]);

  /**
   * Get popular categories based on post count
   * 
   * @param limit Maximum number of categories to return
   * @returns Array of categories with post counts
   */
  const getPopularCategories = useCallback((limit: number = 5): { name: string; count: number }[] => {
    // Build category counts
    const categoryCounts: Record<string, number> = {};
    
    nfts.forEach(nft => {
      const category = nft.metadata.properties.category;
      if (category) {
        const categoryStr = String(category);
        categoryCounts[categoryStr] = (categoryCounts[categoryStr] || 0) + 1;
      }
    });
    
    // Convert to array, sort by count, and limit
    return Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }, [nfts]);

  /**
   * Get recent NFTs
   * 
   * @param count Number of recent NFTs to get
   * @returns Array of recent NFTs
   */
  const getRecentNFTs = useCallback((count: number = 5): BlogNFT[] => {
    return [...nfts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, count);
  }, [nfts]);

  // Compute loading states for UI feedback
  const hasLoaded = useMemo(() => !loading && nfts.length > 0, [loading, nfts]);
  const isEmpty = useMemo(() => !loading && nfts.length === 0 && isCacheInitialized, [loading, nfts, isCacheInitialized]);

  return {
    nfts,
    loading,
    error,
    hasLoaded,
    isEmpty,
    hasMoreData,
    totalSupply,
    isCorrectChain, // New property to show if user is on correct chain
    categories: useMemo(() => getAllCategories(), [getAllCategories]),
    tags: useMemo(() => getAllTags(), [getAllTags]),
    authors,
    getAllNFTs,
    getNFTById,
    filterNFTs,
    sortNFTs,
    getPaginatedNFTs,
    getAllCategories,
    getAllTags,
    getPopularCategories,
    getRecentNFTs
  };
};

export default useBlogNFT;