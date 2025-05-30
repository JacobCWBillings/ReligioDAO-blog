// src/blockchain/services/ProposalService.ts - Fixed with better error handling
import { ethers } from 'ethers';
import { 
  BlogProposal, 
  Proposal, 
  ProposalStatus, 
  TransactionStatus,
  BlockchainError,
  BlockchainErrorType 
} from '../../types/blockchain';

// Import our new modular services
import { ProposalCacheService, PaginatedCacheResult } from './proposal/ProposalCacheService';
import { ProposalMapper } from './proposal/ProposalMapper';
import { ProposalEventService } from './proposal/ProposalEventService';
import { ProposalContractService } from './proposal/ProposalContractService';

export interface PaginatedProposals {
  proposals: Proposal[];
  total: number;
  hasMore: boolean;
  nextPage: number;
}

/**
 * Main ProposalService that orchestrates all proposal-related operations
 * Now focused on coordination rather than implementation details
 */
export class ProposalService {
  private contractService: ProposalContractService;
  private cacheService: ProposalCacheService;
  private eventService: ProposalEventService;
  private networkId: number = 0;
  private isInitialized: boolean = false;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.contractService = new ProposalContractService(provider, signer);
    this.cacheService = new ProposalCacheService();
    // eventService will be initialized after contract service
    this.eventService = new ProposalEventService(provider, new ethers.Contract(ethers.ZeroAddress, [], provider));
  }

  /**
   * Initialize the service with network-specific configuration
   */
  async init(chainId: number): Promise<void> {
    if (this.isInitialized && this.networkId === chainId) {
      return; // Already initialized for this network
    }

    try {
      // Initialize contract service first
      await this.contractService.init(chainId);
      
      // Initialize event service with the contract
      const contract = this.contractService.getContract();
      this.eventService = new ProposalEventService(contract.runner?.provider as ethers.Provider, contract);
      
      this.networkId = chainId;
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing ProposalService:', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new BlockchainError(
        'ProposalService not initialized. Call init() first.',
        BlockchainErrorType.ContractError
      );
    }
  }

  /**
   * Get total number of proposals
   */
  async getTotalProposalCount(): Promise<number> {
    this.ensureInitialized();
    return this.contractService.getTotalProposalCount();
  }

  /**
   * Fetch proposals with pagination and caching - FIXED
   */
  async getProposalsPaginated(
    page: number = 0, 
    pageSize: number = 10,
    forceRefresh: boolean = false
  ): Promise<PaginatedProposals> {
    this.ensureInitialized();

    try {
      // Try cache first unless forcing refresh
      if (!forceRefresh) {
        const cache = this.cacheService.loadFromCache(this.networkId);
        if (cache) {
          const cachedResult = this.cacheService.getPaginatedFromCache(cache, page, pageSize);
          return {
            proposals: cachedResult.proposals,
            total: cachedResult.total,
            hasMore: cachedResult.hasMore,
            nextPage: cachedResult.nextPage
          };
        }
      }

      // Fetch from contract
      const contractResult = await this.contractService.getProposalsPaginated(page, pageSize);
      
      console.log(`ProposalService: Received ${contractResult.proposals.length} proposals from contract`);
      
      // Filter out invalid proposals first
      const validContractProposals = ProposalMapper.filterValidProposals(contractResult.proposals);
      
      console.log(`ProposalService: ${validContractProposals.length} valid proposals after filtering`);
      
      // Map contract data to our format
      const proposals: Proposal[] = [];
      
      for (const contractProposal of validContractProposals) {
        try {
          const mappedProposal = ProposalMapper.mapContractProposalToProposal(contractProposal);
          proposals.push(mappedProposal);
        } catch (mappingError) {
          console.warn('ProposalService: Failed to map individual proposal:', {
            proposalId: contractProposal.id?.toString(),
            error: mappingError
          });
          continue;
        }
      }
      
      console.log(`ProposalService: Successfully mapped ${proposals.length} proposals`);

      // Enrich with event data (don't fail if this doesn't work)
      try {
        await this.eventService.enrichProposalsWithProposerData(proposals);
      } catch (eventError) {
        console.warn('ProposalService: Failed to enrich with event data, continuing without:', eventError);
      }

      // Cache the results if this is the first page or a refresh
      if (page === 0 || forceRefresh) {
        const cachedProposals = proposals.map(p => ({
          ...p,
          cachedAt: Date.now()
        }));
        this.cacheService.saveToCache(this.networkId, cachedProposals, contractResult.total);
      }
      
      // FIXED: Use the contract service's pagination results instead of hardcoded false
      return {
        proposals,
        total: contractResult.total,
        hasMore: contractResult.hasMore, // This was hardcoded to false before!
        nextPage: contractResult.hasMore ? page + 1 : page
      };

    } catch (error) {
      console.error('Error in getProposalsPaginated:', error);
      
      if (error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError(
        'Failed to fetch proposals',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get a single proposal by ID
   */
  async getProposal(proposalId: string): Promise<Proposal | null> {
    this.ensureInitialized();

    try {
      // Check cache first
      const cache = this.cacheService.loadFromCache(this.networkId);
      if (cache) {
        const cached = cache.proposals.find(p => p.id === proposalId);
        if (cached) {
          const { cachedAt, ...proposal } = cached;
          return proposal;
        }
      }

      // Fetch from contract
      const contractProposal = await this.contractService.getProposal(proposalId);
      if (!contractProposal) {
        return null;
      }

      // Validate the proposal first
      const validProposals = ProposalMapper.filterValidProposals([contractProposal]);
      if (validProposals.length === 0) {
        console.warn(`ProposalService: Proposal ${proposalId} is invalid`);
        return null;
      }

      // Map to our format
      const proposal = ProposalMapper.mapContractProposalToProposal(validProposals[0]);
      
      // Enrich with event data
      try {
        await this.eventService.enrichProposalsWithProposerData([proposal]);
      } catch (eventError) {
        console.warn('ProposalService: Failed to enrich single proposal with event data:', eventError);
      }

      return proposal;
    } catch (error) {
      console.error(`Error fetching proposal ${proposalId}:`, error);
      
      // Don't throw for single proposal failures
      if (error instanceof Error && error.message.includes('Invalid contract proposal data')) {
        console.warn(`ProposalService: Proposal ${proposalId} has invalid data, returning null`);
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Get proposal status directly from contract
   */
  async getProposalStatus(proposalId: string): Promise<ProposalStatus> {
    this.ensureInitialized();
    
    try {
      const contractStatus = await this.contractService.getProposalStatus(proposalId);
      return ProposalMapper.mapContractStatusToEnum(contractStatus);
    } catch (error) {
      console.error(`Error getting proposal status for ${proposalId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh a single proposal in cache
   */
  async refreshProposal(proposalId: string): Promise<Proposal | null> {
    this.ensureInitialized();

    try {
      const proposal = await this.getProposal(proposalId);
      
      if (proposal) {
        // Update cache
        this.cacheService.updateProposalInCache(this.networkId, proposal);
      }

      return proposal;
    } catch (error) {
      console.error(`Error refreshing proposal ${proposalId}:`, error);
      return null;
    }
  }

  /**
   * Get all proposals (backwards compatibility)
   */
  async getAllProposals(): Promise<Proposal[]> {
    this.ensureInitialized();

    try {
      // Try cache first
      const cache = this.cacheService.loadFromCache(this.networkId);
      if (cache && cache.proposals.length > 0) {
        return cache.proposals.map(({ cachedAt, ...proposal }) => proposal);
      }

      // Fetch first batch
      const result = await this.getProposalsPaginated(0, 50, true);
      return result.proposals;
    } catch (error) {
      console.error('Error in getAllProposals:', error);
      
      // Return empty array instead of throwing for better UX
      return [];
    }
  }

  /**
   * Get active proposals (currently accepting votes)
   */
  async getActiveProposals(): Promise<Proposal[]> {
    this.ensureInitialized();

    const cached = this.cacheService.getActiveFromCache(this.networkId);
    if (cached.length > 0) {
      return cached;
    }

    // Fallback: fetch recent proposals and filter
    try {
      const result = await this.getProposalsPaginated(0, 20);
      const now = Date.now();
      return result.proposals.filter(p => 
        p.status === ProposalStatus.Pending && p.votingEnds > now
      );
    } catch (error) {
      console.error('Error getting active proposals:', error);
      return [];
    }
  }

  /**
   * Search proposals by text
   */
  searchProposals(searchTerm: string): Proposal[] {
    if (!this.isInitialized) {
      return [];
    }
    
    return this.cacheService.searchInCache(this.networkId, searchTerm);
  }

  /**
   * Create a blog minting proposal
   */
  async createBlogMintingProposal(proposal: BlogProposal): Promise<TransactionStatus> {
    this.ensureInitialized();

    try {
      const result = await this.contractService.createBlogMintingProposal(proposal);

      // Clear cache on successful creation
      if (result.status === 'confirmed') {
        this.cacheService.clearCache(this.networkId);
      }

      return result;
    } catch (error) {
      console.error('Error creating blog minting proposal:', error);
      throw error;
    }
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(proposalId: string, support: boolean): Promise<TransactionStatus> {
    this.ensureInitialized();

    try {
      const result = await this.contractService.voteOnProposal(proposalId, support);

      // Refresh specific proposal in cache if successful
      if (result.status === 'confirmed') {
        await this.refreshProposal(proposalId);
      }

      return result;
    } catch (error) {
      console.error('Error voting on proposal:', error);
      throw error;
    }
  }

  /**
   * Execute a proposal
   */
  async executeProposal(proposalId: string): Promise<TransactionStatus & { tokenId?: string }> {
    this.ensureInitialized();

    try {
      const result = await this.contractService.executeProposal(proposalId);

      // Extract token ID from receipt if execution was successful
      if (result.status === 'confirmed' && result.receipt) {
        const tokenId = await this.eventService.extractTokenIdFromReceipt(result.receipt);
        
        // Refresh specific proposal in cache
        await this.refreshProposal(proposalId);
        
        return {
          ...result,
          tokenId: tokenId || undefined
        };
      }

      return result;
    } catch (error) {
      console.error('Error executing proposal:', error);
      throw error;
    }
  }

  /**
   * Check if user has voted on a proposal
   */
  async hasVoted(proposalId: string, account: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      return await this.contractService.hasVoted(proposalId, account);
    } catch (error) {
      // Fallback to event-based check
      console.warn('Contract hasVoted failed, trying event-based check:', error);
      try {
        return await this.eventService.hasUserVotedByEvents(proposalId, account);
      } catch (eventError) {
        console.error('Event-based vote check also failed:', eventError);
        return false;
      }
    }
  }

  /**
   * Get comprehensive proposal information including events
   */
  async getProposalWithEvents(proposalId: string): Promise<{
    proposal: Proposal | null;
    events: Awaited<ReturnType<ProposalEventService['getProposalEventSummary']>>;
  }> {
    this.ensureInitialized();

    try {
      const [proposal, events] = await Promise.all([
        this.getProposal(proposalId),
        this.eventService.getProposalEventSummary(proposalId)
      ]);

      return { proposal, events };
    } catch (error) {
      console.error(`Error getting proposal with events for ${proposalId}:`, error);
      return {
        proposal: null,
        events: {
          votes: [],
          totalVotes: 0,
          uniqueVoters: 0
        }
      };
    }
  }

  /**
   * Get service status and diagnostics
   */
  getServiceStatus(): {
    initialized: boolean;
    networkId: number;
    cacheStats: ReturnType<ProposalCacheService['getCacheStats']>;
    eventCacheStats: ReturnType<ProposalEventService['getCacheStats']>;
  } {
    return {
      initialized: this.isInitialized,
      networkId: this.networkId,
      cacheStats: this.cacheService.getCacheStats(this.networkId),
      eventCacheStats: this.eventService.getCacheStats()
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    if (this.isInitialized) {
      this.cacheService.clearCache(this.networkId);
    }
    this.eventService.clearCache();
  }

  /**
   * Clear all caches across networks (for cleanup)
   */
  clearAllCaches(): void {
    this.cacheService.clearAllCaches();
    this.eventService.clearCache();
  }

  // Legacy methods for backwards compatibility
  async getPendingProposals(): Promise<Proposal[]> {
    return this.getActiveProposals();
  }

  async getTokenIdForExecutedProposal(proposalId: string, executionTxHash: string): Promise<string | null> {
    // This is a backwards compatibility method
    // In the new architecture, token ID is returned directly from executeProposal
    console.warn('getTokenIdForExecutedProposal is deprecated. Token ID is now returned from executeProposal.');
    return null;
  }
}