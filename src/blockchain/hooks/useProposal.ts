// src/blockchain/hooks/useProposal.ts
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { 
  BlogProposal, 
  Proposal, 
  ProposalStatus, 
  BlockchainErrorType, 
  BlockchainError, 
  TransactionStatus 
} from '../../types/blockchain';
import { ProposalService } from '../services/ProposalService';

/**
 * Hook for interacting with the DAO's proposal system for blog minting
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
        // Fix: Convert chainId which could be null to undefined
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
   */
  const getProposalById = useCallback(async (proposalId: string): Promise<Proposal | null> => {
    if (!proposalService) return null;

    try {
      const proposal = await proposalService.getProposal(proposalId);
      
      // Map status to enum
      let status = ProposalStatus.Pending;
      switch (Number(proposal.status)) {
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
      
      return {
        id: proposal.id,
        title: proposal.title,
        description: proposal.description,
        proposer: proposal.proposer,
        status,
        createdAt: Number(proposal.createdAt) * 1000, // Convert to milliseconds
        votingEnds: Number(proposal.votingEnds) * 1000, // Convert to milliseconds
        votesFor: Number(proposal.votesFor),
        votesAgainst: Number(proposal.votesAgainst),
        executed: proposal.executed,
        // Try to parse the callData to extract content reference
        contentReference: extractContentReference(proposal.callData)
      };
    } catch (err) {
      console.error(`Error fetching proposal ${proposalId}:`, err);
      return null;
    }
  }, [proposalService]);

  /**
   * Fetch all proposals
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
   */
  const executeProposal = useCallback(async (
    proposalId: string
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
   * Extract content reference from calldata
   * This is a helper function to try and parse the contentReference from the calldata
   */
  const extractContentReference = (callData: string): string => {
    try {
      // This is a very simplified approach - in practice, you'd need to properly decode the ABI
      // assuming mintTo(address, string) format
      if (!callData || !callData.startsWith('0x')) return '';
      
      // Try to find the string data part - this is a simplification
      const dataWithoutFunctionSelector = callData.slice(10);
      
      // The string data typically comes after the address (which is 32 bytes/64 hex chars)
      // This is very approximate and might need adjustments based on actual contract encoding
      const stringDataStart = 128; // Skip function selector (8 chars) + address param (64 chars) + offset (64 chars)
      if (dataWithoutFunctionSelector.length < stringDataStart) return '';
      
      // Try to extract what might be the Swarm reference
      const potentialReference = dataWithoutFunctionSelector.slice(stringDataStart, stringDataStart + 128);
      
      // Convert hex to UTF-8 string, filtering out non-printable characters
      const bytes = ethers.toUtf8Bytes(`0x${potentialReference}`);
      const reference = ethers.toUtf8String(bytes).replace(/[^\x20-\x7E]/g, '');
      
      return reference;
    } catch (err) {
      console.error('Error extracting content reference:', err);
      return '';
    }
  };

  return {
    proposals,
    loading,
    error,
    getAllProposals,
    getProposalById,
    createBlogProposal,
    voteOnProposal,
    executeProposal,
    hasVoted
  };
};

export default useProposal;