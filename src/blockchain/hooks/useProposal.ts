// src/blockchain/hooks/useProposal.ts - STREAMLINED VERSION
// Modified to use centralized services from SimpleAppContext while maintaining existing interface
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useSimpleApp } from '../../contexts/SimpleAppContext'; // NEW: Use centralized services
import { useChainConstraint } from './useChainConstraint';
import { 
  BlogProposal, 
  Proposal, 
  BlockchainError, 
  BlockchainErrorType, 
  TransactionStatus 
} from '../../types/blockchainTypes';

/**
 * STREAMLINED React hook for interacting with the DAO's proposal system
 * Now uses centralized services from SimpleAppContext instead of managing its own
 * Maintains exact same interface for backward compatibility
 */
export const useProposal = () => {
  const { account, isConnected } = useWallet();
  const { state: appState } = useSimpleApp(); // NEW: Get services from context
  const { getConstrainedChainId } = useChainConstraint();
  
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  
  // Track service status for diagnostics
  const [serviceStatus, setServiceStatus] = useState<{
    initialized: boolean;
    networkId: number;
    cacheStats?: any;
  }>({ initialized: false, networkId: 0 });
  
  const mountedRef = useRef(true);
  const constrainedChainId = getConstrainedChainId();

  // NEW: Get proposal service from centralized context
  const proposalService = appState.proposalService;
  const isServiceReady = appState.status.blockchainInitialized && proposalService !== null;

  // Update service status when centralized services change
  useEffect(() => {
    if (proposalService && isServiceReady) {
      const status = proposalService.getServiceStatus();
      setServiceStatus(status);
      setError(null);
    } else if (appState.status.blockchainError) {
      setError(new BlockchainError(
        appState.status.blockchainError,
        BlockchainErrorType.ContractError
      ));
    }
  }, [proposalService, isServiceReady, appState.status.blockchainError]);

  /**
   * Load initial proposals with improved error handling
   * Always loads newest proposals first
   */
  const loadInitialProposals = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    if (!proposalService || !isServiceReady) {
      console.log("Proposal service not yet ready, skipping initial load");
      return;
    }

    if (loading) {
      console.log("Already loading, skipping");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get newest proposals (page 0)
      const result = await proposalService.getProposalsPaginated(0, 10, forceRefresh);
      
      if (mountedRef.current) {
        // Ensure newest first order
        const sortedProposals = [...result.proposals].sort((a, b) => b.createdAt - a.createdAt);
        setProposals(sortedProposals);
        setTotalCount(result.total);
        setHasMore(result.hasMore);
        setCurrentPage(0);
        setInitialLoaded(true);
        
        // Update service status
        const status = proposalService.getServiceStatus();
        setServiceStatus(status);
      }
    } catch (err) {
      console.error('Error loading initial proposals:', err);
      if (mountedRef.current) {
        const blockchainError = err instanceof BlockchainError ? err : new BlockchainError(
          'Failed to load proposals',
          BlockchainErrorType.ContractError,
          err instanceof Error ? err : new Error(String(err))
        );
        setError(blockchainError);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [proposalService, isServiceReady, loading]);

  /**
   * Load more (older) proposals for pagination
   */
  const loadMoreProposals = useCallback(async (): Promise<void> => {
    if (!proposalService || !hasMore || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = currentPage + 1;
      const result = await proposalService.getProposalsPaginated(nextPage, 10);
      
      if (mountedRef.current) {
        // Append new proposals to existing ones, keeping newest-first order
        const sortedNewProposals = [...result.proposals].sort((a, b) => b.createdAt - a.createdAt);
        setProposals(prev => {
          const combined = [...prev, ...sortedNewProposals];
          return combined.sort((a, b) => b.createdAt - a.createdAt);
        });
        setTotalCount(result.total);
        setHasMore(result.hasMore);
        setCurrentPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more proposals:', err);
      if (mountedRef.current) {
        const blockchainError = err instanceof BlockchainError ? err : new BlockchainError(
          'Failed to load more proposals',
          BlockchainErrorType.ContractError,
          err instanceof Error ? err : new Error(String(err))
        );
        setError(blockchainError);
      }
    } finally {
      if (mountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [proposalService, hasMore, loadingMore, currentPage]);

  /**
   * Refresh all proposals, always loading newest first
   */
  const refreshProposals = useCallback(async (): Promise<void> => {
    if (proposalService) {
      proposalService.clearCache();
    }
    await loadInitialProposals(true);
  }, [loadInitialProposals, proposalService]);

  /**
   * Get proposal by ID
   */
  const getProposalById = useCallback(async (proposalId: string): Promise<Proposal | null> => {
    if (!proposalService) return null;
    
    try {
      return await proposalService.getProposal(proposalId);
    } catch (err) {
      console.error(`Error fetching proposal ${proposalId}:`, err);
      return null;
    }
  }, [proposalService]);

  /**
   * Create a blog minting proposal
   */
  const createBlogProposal = useCallback(async (
    proposal: BlogProposal
  ): Promise<TransactionStatus> => {
    if (!proposalService || !account) {
      throw new BlockchainError(
        'ProposalService not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      const status = await proposalService.createBlogMintingProposal(proposal);
      
      // Refresh proposals list if successful
      if (status.status === 'confirmed' && mountedRef.current) {
        await refreshProposals();
      }
      
      return status;
    } catch (err) {
      console.error('Error creating proposal:', err);
      
      const blockchainError = err instanceof BlockchainError ? err : new BlockchainError(
        'Failed to create proposal',
        BlockchainErrorType.Unknown,
        err instanceof Error ? err : new Error(String(err))
      );
      
      if (mountedRef.current) setError(blockchainError);
      throw blockchainError;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [proposalService, account, refreshProposals]);

  /**
   * Vote on a proposal
   */
  const voteOnProposal = useCallback(async (
    proposalId: string,
    support: boolean
  ): Promise<TransactionStatus> => {
    if (!proposalService || !account) {
      throw new BlockchainError(
        'ProposalService not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      const status = await proposalService.voteOnProposal(proposalId, support);
      
      // Refresh the proposal if successful
      if (status.status === 'confirmed' && mountedRef.current) {
        const updatedProposal = await getProposalById(proposalId);
        if (updatedProposal) {
          setProposals(prev => 
            prev.map(p => p.id === proposalId ? updatedProposal : p)
          );
        }
      }
      
      return status;
    } catch (err) {
      console.error('Error voting on proposal:', err);
      
      const blockchainError = err instanceof BlockchainError ? err : new BlockchainError(
        'Failed to vote on proposal',
        BlockchainErrorType.Unknown,
        err instanceof Error ? err : new Error(String(err))
      );
      
      if (mountedRef.current) setError(blockchainError);
      throw blockchainError;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [proposalService, account, getProposalById]);

  /**
   * Execute a proposal
   */
  const executeProposal = useCallback(async (
    proposalId: string
  ): Promise<TransactionStatus & { tokenId?: string }> => {
    if (!proposalService || !account) {
      throw new BlockchainError(
        'ProposalService not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      const status = await proposalService.executeProposal(proposalId);
      
      // Refresh the proposal if successful
      if (status.status === 'confirmed' && mountedRef.current) {
        const updatedProposal = await getProposalById(proposalId);
        if (updatedProposal) {
          setProposals(prev => 
            prev.map(p => p.id === proposalId ? updatedProposal : p)
          );
        }
      }
      
      return status;
    } catch (err) {
      console.error('Error executing proposal:', err);
      
      const blockchainError = err instanceof BlockchainError ? err : new BlockchainError(
        'Failed to execute proposal',
        BlockchainErrorType.Unknown,
        err instanceof Error ? err : new Error(String(err))
      );
      
      if (mountedRef.current) setError(blockchainError);
      throw blockchainError;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [proposalService, account, getProposalById]);

  /**
   * Check if user has voted
   */
  const hasVoted = useCallback(async (
    proposalId: string
  ): Promise<boolean> => {
    if (!proposalService || !account) {
      return false;
    }

    try {
      return await proposalService.hasVoted(proposalId, account);
    } catch (err) {
      console.error('Error checking vote status:', err);
      return false;
    }
  }, [proposalService, account]);

  /**
   * Search proposals
   */
  const searchProposals = useCallback((searchTerm: string): Proposal[] => {
    if (!proposalService || !searchTerm.trim()) {
      return [];
    }
    
    return proposalService.searchProposals(searchTerm);
  }, [proposalService]);

  /**
   * Get active proposals
   */
  const getActiveProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!proposalService) {
      return [];
    }
    
    try {
      return await proposalService.getActiveProposals();
    } catch (err) {
      console.error('Error getting active proposals:', err);
      return [];
    }
  }, [proposalService]);

  // Backwards compatibility methods
  const getAllProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!proposalService) {
      return [];
    }

    setLoading(true);
    try {
      const allProposals = await proposalService.getAllProposals();
      if (mountedRef.current) {
        setProposals(allProposals);
        setTotalCount(allProposals.length);
        setHasMore(false);
        setCurrentPage(0);
        setInitialLoaded(true);
      }
      return allProposals;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [proposalService]);

  // Auto-load initial proposals when service is ready
  useEffect(() => {
    if (proposalService && isServiceReady && !initialLoaded && !loading) {
      console.log('ProposalService ready from centralized context, loading initial proposals');
      loadInitialProposals();
    }
  }, [proposalService, isServiceReady, initialLoaded, loading, loadInitialProposals]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    // Data
    proposals,
    totalCount,
    currentPage,
    hasMore,
    
    // Loading states
    loading,
    loadingMore,
    error,
    initialLoaded,
    
    // Service status (enhanced with centralized info)
    serviceStatus: {
      ...serviceStatus,
      centralized: true, // Indicate this is using centralized services
      blockchainReady: isServiceReady,
      contextError: appState.status.blockchainError
    },
    
    // Pagination methods
    loadInitialProposals,
    loadMoreProposals,
    refreshProposals,
    
    // Core methods (same interface as before)
    getAllProposals,
    getProposalById,
    createBlogProposal,
    voteOnProposal,
    executeProposal,
    hasVoted,
    getActiveProposals,
    searchProposals
  };
};

export default useProposal;