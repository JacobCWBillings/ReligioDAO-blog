// src/blockchain/hooks/useProposal.ts
import { useState, useEffect, useCallback } from 'react';
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
 * React hook for interacting with the DAO's proposal system for blog minting
 * Provides a React-friendly interface to ProposalService
 */
export const useProposal = () => {
  const { provider, signer, account, chainId, isConnected } = useWallet();
  const { getConstrainedChainId, isCorrectChain, chainError } = useChainConstraint();
  const [proposalService, setProposalService] = useState<ProposalService | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);

  // Initialize ProposalService
  useEffect(() => {
    if (!provider || !signer || !isConnected) return;

    try {
      const service = new ProposalService(provider, signer);
      
      const initService = async () => {
        // Use the constrained chain ID instead of the wallet's chain ID
        const constrainedChainId = getConstrainedChainId();
        await service.init(constrainedChainId);
        setProposalService(service);
        
        // Set error from chain validation if there is one
        if (chainError) {
          setError(chainError);
        } else {
          setError(null);
        }
      };
      
      initService();
    } catch (err) {
      console.error('Error initializing ProposalService:', err);
      setError(new BlockchainError(
        'Failed to initialize ProposalService',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      ));
    }
  }, [provider, signer, chainId, isConnected]);

  /**
   * Get proposal by ID
   * 
   * @param proposalId Proposal ID
   * @returns Promise resolving to Proposal object or null
   */
  const getProposalById = useCallback(async (proposalId: string): Promise<Proposal | null> => {
    if (!proposalService) return null;
    return await proposalService.getProposal(proposalId);
  }, [proposalService]);

  /**
   * Fetch all proposals
   * 
   * @returns Promise resolving to array of Proposal objects
   */
  const getAllProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!proposalService) {
      setLoading(true);
      console.log("Proposal service not yet initialized, returning empty array");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const allProposals = await proposalService.getAllProposals();
      setProposals(allProposals);
      return allProposals;
    } catch (err) {
      console.error('Error fetching all proposals:', err);
      const blockchainError = new BlockchainError(
        'Failed to fetch proposals',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [proposalService]);

  /**
   * Create a blog minting proposal
   * 
   * @param proposal BlogProposal object
   * @returns Promise resolving to TransactionStatus
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
      if (status.status === 'confirmed') {
        await getAllProposals();
      }
      
      return status;
    } catch (err) {
      console.error('Error creating proposal:', err);
      
      if (err instanceof BlockchainError) {
        // If it's already a BlockchainError, just propagate it
        setError(err);
        throw err;
      }
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('insufficient funds')) {
          errorType = BlockchainErrorType.InsufficientFunds;
        }
      }
      
      const blockchainError = new BlockchainError(
        'Failed to create proposal',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
      
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [proposalService, account, getAllProposals]);

  /**
   * Vote on a proposal
   * 
   * @param proposalId Proposal ID
   * @param support True for supporting the proposal, false for opposing
   * @returns Promise resolving to TransactionStatus
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
      if (status.status === 'confirmed') {
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
      
      if (err instanceof BlockchainError) {
        // If it's already a BlockchainError, just propagate it
        setError(err);
        throw err;
      }
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('already voted')) {
          errorType = BlockchainErrorType.ContractError;
        }
      }
      
      const blockchainError = new BlockchainError(
        'Failed to vote on proposal',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
      
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [proposalService, account, getProposalById]);

  /**
   * Execute a proposal to mint the NFT
   * 
   * @param proposalId Proposal ID
   * @returns Promise resolving to TransactionStatus with optional tokenId
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
      if (status.status === 'confirmed') {
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
      
      if (err instanceof BlockchainError) {
        // If it's already a BlockchainError, just propagate it
        setError(err);
        throw err;
      }
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('not approved')) {
          errorType = BlockchainErrorType.ContractError;
        }
      }
      
      const blockchainError = new BlockchainError(
        'Failed to execute proposal',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
      
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [proposalService, account, getProposalById]);

  /**
   * Check if a user has voted on a specific proposal
   * 
   * @param proposalId Proposal ID
   * @returns Promise resolving to boolean indicating if the current account has voted
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
   * Get all proposals that need votes
   * 
   * @returns Promise resolving to array of pending proposals
   */
  const getPendingProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!proposalService) {
      return [];
    }
    
    try {
      return await proposalService.getPendingProposals();
    } catch (err) {
      console.error('Error getting pending proposals:', err);
      return [];
    }
  }, [proposalService]);

  /**
   * Get NFT token ID for an executed proposal
   * 
   * @param proposalId Proposal ID
   * @param executionTxHash Transaction hash of execution
   * @returns Promise resolving to token ID or null
   */
  const getTokenIdForExecutedProposal = useCallback(async (
    proposalId: string,
    executionTxHash: string
  ): Promise<string | null> => {
    if (!proposalService) return null;
    
    try {
      return await proposalService.getTokenIdForExecutedProposal(proposalId, executionTxHash);
    } catch (err) {
      console.error('Error getting token ID for executed proposal:', err);
      return null;
    }
  }, [proposalService]);

  return {
    proposals,
    loading,
    error,
    isCorrectChain, // New property to indicate if on correct chain
    getAllProposals,
    getProposalById,
    createBlogProposal,
    voteOnProposal,
    executeProposal,
    hasVoted,
    getPendingProposals,
    getTokenIdForExecutedProposal
  };
};

export default useProposal;