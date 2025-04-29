// src/blockchain/hooks/useProposal.ts
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { 
  BlogProposal, 
  Proposal, 
  ProposalStatus, 
  BlockchainError, 
  BlockchainErrorType, 
  TransactionStatus 
} from '../../types/blockchain';
import { ProposalService } from '../services/ProposalService';
import { blockchainTimeToJsTime } from '../utils/blockchainUtils';
import { extractTokenIdFromMintingReceipt, extractNFTTokenIdFromReceipt } from '../utils/transactionUtils';
import { getContractAddresses } from '../../config';

/**
 * React hook for interacting with the DAO's proposal system for blog minting
 * Provides a React-friendly interface to ProposalService
 */
export const useProposal = () => {
  const { provider, signer, account, chainId, isConnected } = useWallet();
  const [proposalService, setProposalService] = useState<ProposalService | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);

  // Initialize ProposalService when provider and signer are available
  useEffect(() => {
    if (!provider || !signer || !isConnected) return;

    try {
      const service = new ProposalService(provider, signer);
      
      const initService = async () => {
        // Convert chainId which could be null to undefined
        await service.init(chainId ?? undefined);
        setProposalService(service);
        setError(null);
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

    try {
      const rawProposal = await proposalService.getProposal(proposalId);
      
      // Map numeric status to enum value
      let status = ProposalStatus.Pending;
      switch (Number(rawProposal.status)) {
        case 0:
          status = ProposalStatus.Pending;
          break;
        case 1:
          status = ProposalStatus.Active;
          break;
        case 2:
          status = ProposalStatus.Approved;
          break;
        case 3:
          status = ProposalStatus.Rejected;
          break;
        case 4:
          status = ProposalStatus.Executed;
          break;
        case 5:
          status = ProposalStatus.Canceled;
          break;
      }
      
      // Convert timestamps to milliseconds
      const createdAt = blockchainTimeToJsTime(rawProposal.createdAt);
      const votingEnds = blockchainTimeToJsTime(rawProposal.votingEnds);
      
      return {
        id: rawProposal.id,
        title: rawProposal.title,
        description: rawProposal.description,
        proposer: rawProposal.proposer,
        status,
        createdAt,
        votingEnds,
        votesFor: Number(rawProposal.votesFor),
        votesAgainst: Number(rawProposal.votesAgainst),
        executed: rawProposal.executed,
        contentReference: rawProposal.contentReference
      };
    } catch (err) {
      console.error(`Error fetching proposal ${proposalId}:`, err);
      return null;
    }
  }, [proposalService]);

  /**
   * Fetch all proposals
   * 
   * @returns Promise resolving to array of Proposal objects
   */
  const getAllProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!proposalService) {
      throw new BlockchainError(
        'ProposalService not initialized',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Get all proposal IDs
      const proposalIds = await proposalService.getAllProposalIds();
      
      // Create array of promises for parallel execution
      const proposalPromises = proposalIds.map(id => getProposalById(id));
      
      // Wait for all promises to resolve at once
      const allResults = await Promise.all(proposalPromises);
      
      // Filter out null values with type predicate
      const validProposals = allResults.filter((proposal): proposal is Proposal => proposal !== null);
      
      setProposals(validProposals);
      return validProposals;
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
  }, [proposalService, getProposalById]);

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
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof BlockchainError) {
        // If it's already a BlockchainError, just propagate it
        setError(err);
        throw err;
      } else if (err instanceof Error) {
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
      
      // If it's already a BlockchainError, just propagate it
      if (err instanceof BlockchainError) {
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
   * Enhanced to extract the token ID from the transaction receipt
   * 
   * @param proposalId Proposal ID
   * @returns Promise resolving to TransactionStatus with optional tokenId
   */
  const executeProposal = useCallback(async (
    proposalId: string
  ): Promise<TransactionStatus & { tokenId?: string }> => {
    if (!proposalService || !account || !chainId) {
      throw new BlockchainError(
        'ProposalService not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      const status = await proposalService.executeProposal(proposalId);
      
      // Extract token ID from transaction receipt if available
      let tokenId: string | undefined = undefined;
      if (status.status === 'confirmed' && status.receipt) {
        // First try to extract using the specialized function for our minting module
        tokenId = extractTokenIdFromMintingReceipt(status.receipt) ?? undefined;
        
        // If that doesn't work, try with the general NFT token extraction
        if (!tokenId) {
          // Get NFT contract address from config
          const contractAddresses = getContractAddresses(chainId);
          // Try to extract from Transfer event
          tokenId = extractNFTTokenIdFromReceipt(
            status.receipt, 
            contractAddresses.blogNFT
          ) ?? undefined;
        }
        
        if (tokenId) {
          console.log(`Extracted token ID from receipt: ${tokenId}`);
        }
      }
      
      // Refresh the proposal if successful
      if (status.status === 'confirmed') {
        const updatedProposal = await getProposalById(proposalId);
        if (updatedProposal) {
          setProposals(prev => 
            prev.map(p => p.id === proposalId ? updatedProposal : p)
          );
        }
      }
      
      // Return both the transaction status and the token ID
      return {
        ...status,
        tokenId
      };
    } catch (err) {
      console.error('Error executing proposal:', err);
      
      // If it's already a BlockchainError, just propagate it
      if (err instanceof BlockchainError) {
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
  }, [proposalService, account, chainId, getProposalById]);

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
      const pendingProposalsRaw = await proposalService.getPendingProposals();
      
      // Convert raw proposals to our Proposal interface
      const proposalPromises = pendingProposalsRaw.map(p => getProposalById(p.id));
      const results = await Promise.all(proposalPromises);
      
      // Filter out nulls
      return results.filter((p): p is Proposal => p !== null);
    } catch (err) {
      console.error('Error getting pending proposals:', err);
      return [];
    }
  }, [proposalService, getProposalById]);

  /**
   * Get NFT token ID for an executed proposal
   * Useful for linking to the newly minted blog posts
   * 
   * @param proposalId Proposal ID 
   * @param executionTxHash Transaction hash of execution
   * @returns Promise resolving to token ID or null
   */
  const getTokenIdForExecutedProposal = useCallback(async (
    proposalId: string,
    executionTxHash: string
  ): Promise<string | null> => {
    if (!provider || !chainId) return null;
    
    try {
      const receipt = await provider.getTransactionReceipt(executionTxHash);
      
      if (receipt) {
        // First try specialized extraction
        let tokenId = extractTokenIdFromMintingReceipt(receipt);
        
        // If not found, try general NFT extraction
        if (!tokenId) {
          const contractAddresses = getContractAddresses(chainId);
          tokenId = extractNFTTokenIdFromReceipt(receipt, contractAddresses.blogNFT);
        }
        
        return tokenId;
      }
      
      return null;
    } catch (err) {
      console.error('Error getting token ID for executed proposal:', err);
      return null;
    }
  }, [provider, chainId]);

  return {
    proposals,
    loading,
    error,
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