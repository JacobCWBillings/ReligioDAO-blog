import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { Proposal, ProposalStatus, BlockchainErrorType, BlockchainError, TransactionStatus } from '../../types/blockchain';
import { getContractAddresses } from '../../config';
import QGovAbi from '../abis/QGov.json';

/**
 * Hook for interacting with the qGov contract for proposal management
 */
export const useProposal = () => {
  const { provider, signer, account, chainId, isConnected } = useWallet();
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);

  // Initialize contract when provider and signer are available
  useEffect(() => {
    if (!provider || !signer || !isConnected) return;

    try {
      const addresses = getContractAddresses(chainId);
      const qGovContract = new ethers.Contract(
        addresses.qGov,
        QGovAbi,
        signer
      );
      setContract(qGovContract);
      setError(null);
    } catch (err) {
      console.error('Error initializing qGov contract:', err);
      setError(new BlockchainError(
        'Failed to initialize qGov contract',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      ));
    }
  }, [provider, signer, chainId, isConnected]);

  // Get all proposals from the contract
  const getAllProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!contract) {
      throw new BlockchainError(
        'Contract not initialized',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Get proposal count from the contract
      const proposalCount = await contract.getProposalCount();
      
      const proposalPromises = [];
      for (let i = 0; i < proposalCount.toNumber(); i++) {
        proposalPromises.push(getProposalById(i));
      }
      
      const proposalResults = await Promise.all(proposalPromises);
      const validProposals = proposalResults.filter(Boolean) as Proposal[];
      setProposals(validProposals);
      return validProposals;
    } catch (err) {
      console.error('Error fetching proposals:', err);
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
  }, [contract]);

  // Get a specific proposal by ID
  const getProposalById = useCallback(async (proposalId: number | string): Promise<Proposal | null> => {
    if (!contract) return null;

    try {
      // Call the contract to get proposal data
      const proposalData = await contract.getProposal(proposalId);
      
      // Convert the returned data to our Proposal interface
      return {
        id: proposalId.toString(),
        title: proposalData.title,
        description: proposalData.description,
        proposer: proposalData.proposer,
        contentReference: proposalData.contentReference,
        category: proposalData.category,
        status: mapStatusToEnum(proposalData.status),
        createdAt: proposalData.createdAt.toNumber() * 1000, // Convert to milliseconds
        votingEnds: proposalData.votingEnds.toNumber() * 1000, // Convert to milliseconds
        votesFor: proposalData.votesFor.toNumber(),
        votesAgainst: proposalData.votesAgainst.toNumber(),
        executed: proposalData.executed,
        nftId: proposalData.nftId ? proposalData.nftId.toString() : undefined
      };
    } catch (err) {
      console.error(`Error fetching proposal ${proposalId}:`, err);
      return null;
    }
  }, [contract]);

  // Map numeric status from contract to our enum
  const mapStatusToEnum = (statusNum: number): ProposalStatus => {
    const statusMap: Record<number, ProposalStatus> = {
      0: ProposalStatus.Pending,
      1: ProposalStatus.Active,
      2: ProposalStatus.Approved,
      3: ProposalStatus.Rejected,
      4: ProposalStatus.Executed,
      5: ProposalStatus.Canceled
    };
    return statusMap[statusNum] || ProposalStatus.Pending;
  };

  // Create a new proposal
  const createProposal = useCallback(async (
    title: string,
    description: string,
    contentReference: string,
    category: string
  ): Promise<TransactionStatus> => {
    if (!contract || !account) {
      throw new BlockchainError(
        'Contract not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Call the createProposal function on the contract
      const tx = await contract.createProposal(
        title,
        description,
        contentReference,
        category
      );
      
      // Initial transaction status
      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'pending',
        confirmations: 0
      };
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Update status with confirmation details
      status.status = receipt.status === 1 ? 'confirmed' : 'failed';
      status.confirmations = 1;
      status.receipt = receipt;
      
      // If successful, update proposals list
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
  }, [contract, account, getAllProposals]);

  // Vote on a proposal
  const voteOnProposal = useCallback(async (
    proposalId: string,
    support: boolean
  ): Promise<TransactionStatus> => {
    if (!contract || !account) {
      throw new BlockchainError(
        'Contract not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Call the vote function on the contract
      const tx = await contract.vote(proposalId, support);
      
      // Initial transaction status
      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'pending',
        confirmations: 0
      };
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Update status with confirmation details
      status.status = receipt.status === 1 ? 'confirmed' : 'failed';
      status.confirmations = 1;
      status.receipt = receipt;
      
      // If successful, refresh the proposal
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
  }, [contract, account, getProposalById]);

  // Execute a proposal (e.g., mint NFT for approved blog)
  const executeProposal = useCallback(async (
    proposalId: string
  ): Promise<TransactionStatus> => {
    if (!contract || !account) {
      throw new BlockchainError(
        'Contract not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Call the execute function on the contract
      const tx = await contract.executeProposal(proposalId);
      
      // Initial transaction status
      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'pending',
        confirmations: 0
      };
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Update status with confirmation details
      status.status = receipt.status === 1 ? 'confirmed' : 'failed';
      status.confirmations = 1;
      status.receipt = receipt;
      
      // If successful, refresh the proposal
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
  }, [contract, account, getProposalById]);

  // Check if user has voted on a specific proposal
  const hasVoted = useCallback(async (
    proposalId: string
  ): Promise<{ hasVoted: boolean; support: boolean }> => {
    if (!contract || !account) {
      return { hasVoted: false, support: false };
    }

    try {
      const voterStatus = await contract.getVoterStatus(proposalId, account);
      return {
        hasVoted: voterStatus.hasVoted,
        support: voterStatus.support
      };
    } catch (err) {
      console.error('Error checking vote status:', err);
      return { hasVoted: false, support: false };
    }
  }, [contract, account]);

  return {
    proposals,
    loading,
    error,
    getAllProposals,
    getProposalById,
    createProposal,
    voteOnProposal,
    executeProposal,
    hasVoted
  };
};

export default useProposal;