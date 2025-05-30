// src/blockchain/hooks/useProposal.ts - Fixed with better initialization control
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useChainConstraint } from './useChainConstraint';
import { 
  BlogProposal, 
  Proposal, 
  BlockchainError, 
  BlockchainErrorType, 
  TransactionStatus 
} from '../../types/blockchain';
import { ProposalService } from '../services/ProposalService';

/**
 * Enhanced React hook for interacting with the DAO's proposal system
 * Fixed to prevent multiple initializations
 */
export const useProposal = () => {
  const { provider, readOnlyProvider, signer, readOnlySigner, account, chainId, isConnected } = useWallet();
  const { getConstrainedChainId } = useChainConstraint();
  
  const [proposalService, setProposalService] = useState<ProposalService | null>(null);
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
  
  // Use refs to track initialization state more reliably
  const mountedRef = useRef(true);
  const initializationRef = useRef<Promise<void> | null>(null);
  const currentServiceRef = useRef<ProposalService | null>(null);
  const currentNetworkRef = useRef<number>(0);

  // Get the constrained chain ID in a stable way
  const constrainedChainId = getConstrainedChainId();

  // Stable initialization effect - only depends on core provider changes
  useEffect(() => {
    mountedRef.current = true;
    
    const activeProvider = provider || readOnlyProvider;
    
    // Don't reinitialize if we already have a service for this network
    if (currentServiceRef.current && currentNetworkRef.current === constrainedChainId && activeProvider) {
      console.log(`ProposalService already initialized for network ${constrainedChainId}`);
      return;
    }
    
    if (!activeProvider) {
      console.log('No provider available for ProposalService initialization');
      return;
    }

    const initializeService = async () => {
      // Prevent multiple simultaneous initializations
      if (initializationRef.current) {
        console.log('ProposalService initialization already in progress, waiting...');
        await initializationRef.current;
        return;
      }

      console.log(`Initializing ProposalService for network ${constrainedChainId}`);
      
      // Create initialization promise and store it to prevent duplicate calls
      const initPromise = (async () => {
        try {
          const activeSigner = isConnected && signer ? signer : (readOnlySigner || undefined);
          const service = new ProposalService(activeProvider, activeSigner);
          
          // Initialize the service
          await service.init(constrainedChainId);
          
          if (mountedRef.current) {
            setProposalService(service);
            currentServiceRef.current = service;
            currentNetworkRef.current = constrainedChainId;
            
            // Get service status for diagnostics
            const status = service.getServiceStatus();
            setServiceStatus(status);
            
            setError(null);
            console.log('ProposalService initialized successfully');
          }
        } catch (err) {
          console.error('Error initializing ProposalService:', err);
          if (mountedRef.current) {
            setError(new BlockchainError(
              'Failed to initialize ProposalService',
              BlockchainErrorType.ContractError,
              err instanceof Error ? err : new Error(String(err))
            ));
          }
        }
      })();
      
      initializationRef.current = initPromise;
      await initPromise;
      initializationRef.current = null;
    };
    
    initializeService();

    return () => {
      mountedRef.current = false;
    };
  }, [
    // Only depend on essential provider and network changes
    provider, // Provider instance reference
    readOnlyProvider, // Provider instance reference
    signer, // Signer instance reference
    constrainedChainId, // Use constrained chain ID instead of wallet chain ID
    isConnected, // Track connection state changes
    readOnlySigner // Track read-only signer changes
  ]);

  /**
   * Load initial proposals with improved error handling
   */
  const loadInitialProposals = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    if (!proposalService || !currentServiceRef.current) {
      console.log("Proposal service not yet initialized, skipping initial load");
      return;
    }

    if (loading) {
      console.log("Already loading, skipping");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await proposalService.getProposalsPaginated(0, 10, forceRefresh);
      
      if (mountedRef.current) {
        setProposals(result.proposals);
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
  }, [proposalService, loading]);

  /**
   * Load more proposals (pagination)
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
        setProposals(prev => [...prev, ...result.proposals]);
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
   * Refresh all proposals
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
    if (proposalService && !initialLoaded && !loading) {
      console.log('ProposalService ready, loading initial proposals');
      loadInitialProposals();
    }
  }, [proposalService, initialLoaded, loading, loadInitialProposals]);

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
    
    // Service status
    serviceStatus,
    
    // Pagination methods
    loadInitialProposals,
    loadMoreProposals,
    refreshProposals,
    
    // Core methods
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