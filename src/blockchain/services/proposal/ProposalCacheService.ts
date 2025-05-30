// src/blockchain/services/proposa/ProposalCacheService.ts
import { Proposal } from '../../../types/blockchain';

export interface CachedProposal extends Proposal {
  cachedAt: number;
}

export interface ProposalCache {
  proposals: CachedProposal[];
  lastUpdated: number;
  totalCount?: number;
}

export interface PaginatedCacheResult {
  proposals: Proposal[];
  total: number;
  hasMore: boolean;
  nextPage: number;
}

export class ProposalCacheService {
  private readonly CACHE_KEY_PREFIX = 'religiodao_proposals_cache';
  private readonly CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

  constructor() {}

  /**
   * Get cache key for a specific network
   */
  private getCacheKey(networkId: number): string {
    if (!networkId || networkId === 0) {
      throw new Error('Invalid network ID for cache key');
    }
    return `${this.CACHE_KEY_PREFIX}_${networkId}`;
  }

  /**
   * Load cached proposals from localStorage
   */
  loadFromCache(networkId: number): ProposalCache | null {
    try {
      const cacheKey = this.getCacheKey(networkId);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const cache: ProposalCache = JSON.parse(cached);
      
      // Check if cache is expired
      if (Date.now() - cache.lastUpdated > this.CACHE_EXPIRY_TIME) {
        this.clearCache(networkId);
        return null;
      }

      // Validate cache structure
      if (!cache.proposals || !Array.isArray(cache.proposals)) {
        console.warn('Invalid cache structure, clearing cache');
        this.clearCache(networkId);
        return null;
      }

      return cache;
    } catch (error) {
      console.error('Error loading proposals from cache:', error);
      this.clearCache(networkId);
      return null;
    }
  }

  /**
   * Save proposals to cache with error handling
   */
  saveToCache(networkId: number, proposals: CachedProposal[], totalCount?: number): boolean {
    try {
      const cacheKey = this.getCacheKey(networkId);
      const cache: ProposalCache = {
        proposals,
        lastUpdated: Date.now(),
        totalCount
      };

      localStorage.setItem(cacheKey, JSON.stringify(cache));
      return true;
    } catch (error) {
      console.error('Error saving proposals to cache:', error);
      
      // If localStorage is full, try clearing old cache and retry
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearCache(networkId);
        try {
          const cacheKey = this.getCacheKey(networkId);
          localStorage.setItem(cacheKey, JSON.stringify({
            proposals,
            lastUpdated: Date.now(),
            totalCount
          }));
          return true;
        } catch (retryError) {
          console.error('Failed to save to cache even after clearing:', retryError);
        }
      }
      
      return false;
    }
  }

  /**
   * Clear cached proposals for a network
   */
  clearCache(networkId: number): void {
    try {
      const cacheKey = this.getCacheKey(networkId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing proposal cache:', error);
    }
  }

  /**
   * Get paginated results from cached data
   */
  getPaginatedFromCache(
    cache: ProposalCache, 
    page: number, 
    pageSize: number
  ): PaginatedCacheResult {
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Ensure we don't go out of bounds
    const safeStartIndex = Math.max(0, Math.min(startIndex, cache.proposals.length));
    const safeEndIndex = Math.max(safeStartIndex, Math.min(endIndex, cache.proposals.length));
    
    const proposals = cache.proposals
      .slice(safeStartIndex, safeEndIndex)
      .map(({ cachedAt, ...proposal }) => proposal); // Remove cachedAt field

    return {
      proposals,
      total: cache.totalCount || cache.proposals.length,
      hasMore: safeEndIndex < cache.proposals.length,
      nextPage: safeEndIndex < cache.proposals.length ? page + 1 : page
    };
  }

  /**
   * Update a single proposal in cache
   */
  updateProposalInCache(networkId: number, updatedProposal: Proposal): boolean {
    try {
      const cache = this.loadFromCache(networkId);
      if (!cache) return false;

      const updatedProposals = cache.proposals.map(p => 
        p.id === updatedProposal.id 
          ? { ...updatedProposal, cachedAt: Date.now() }
          : p
      );

      return this.saveToCache(networkId, updatedProposals, cache.totalCount);
    } catch (error) {
      console.error('Error updating proposal in cache:', error);
      return false;
    }
  }

  /**
   * Search proposals in cache
   */
  searchInCache(networkId: number, searchTerm: string): Proposal[] {
    const cache = this.loadFromCache(networkId);
    if (!cache || !searchTerm) {
      return [];
    }

    const term = searchTerm.toLowerCase();
    return cache.proposals
      .filter(p => 
        p.title.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.proposer.toLowerCase().includes(term) ||
        (p.contentReference && p.contentReference.includes(term))
      )
      .map(({ cachedAt, ...proposal }) => proposal);
  }

  /**
   * Filter active proposals from cache
   */
  getActiveFromCache(networkId: number): Proposal[] {
    const cache = this.loadFromCache(networkId);
    if (!cache) return [];

    const now = Date.now();
    return cache.proposals
      .filter(p => p.votingEnds > now && (p.status === 1 || p.status === 0)) // Pending or None status
      .map(({ cachedAt, ...proposal }) => proposal);
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(networkId: number): {
    exists: boolean;
    count: number;
    lastUpdated: Date | null;
    isExpired: boolean;
    sizeInBytes: number;
  } {
    try {
      const cacheKey = this.getCacheKey(networkId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return {
          exists: false,
          count: 0,
          lastUpdated: null,
          isExpired: false,
          sizeInBytes: 0
        };
      }

      const cache: ProposalCache = JSON.parse(cached);
      const isExpired = Date.now() - cache.lastUpdated > this.CACHE_EXPIRY_TIME;

      return {
        exists: true,
        count: cache.proposals.length,
        lastUpdated: new Date(cache.lastUpdated),
        isExpired,
        sizeInBytes: new Blob([cached]).size
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        exists: false,
        count: 0,
        lastUpdated: null,
        isExpired: true,
        sizeInBytes: 0
      };
    }
  }

  /**
   * Clear all caches (for cleanup)
   */
  clearAllCaches(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing all caches:', error);
    }
  }
}