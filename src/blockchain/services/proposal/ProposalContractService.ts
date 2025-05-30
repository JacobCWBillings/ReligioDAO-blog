// src/blockchain/services/proposal/ProposalContractService.ts
import { ethers } from 'ethers';
import { BaseContractService } from '../BaseContractService';
import { 
  BlogProposal, 
  TransactionStatus,
  BlockchainError,
  BlockchainErrorType 
} from '../../../types/blockchain';
import { ContractDAOProposal } from './ProposalMapper';
import { createBigInt } from './EventTypes';
import GeneralDAOVotingABI from '../../abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../../abis/NFTMintingModulePlus.json';
import { getCurrentNetworkConfig, getVotingSituationName } from '../../../config';

export interface PaginatedContractResult {
  proposals: ContractDAOProposal[];
  total: number;
  hasMore: boolean;
}

export class ProposalContractService extends BaseContractService {
  private generalDAOVoting: ethers.Contract;
  private nftMintingModule: ethers.Contract;
  private networkId: number = 0;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    super(provider, signer);
    
    // Initialize with dummy addresses - will be updated in init()
    this.generalDAOVoting = new ethers.Contract(
      ethers.ZeroAddress, 
      GeneralDAOVotingABI.abi, 
      provider
    );
    this.nftMintingModule = new ethers.Contract(
      ethers.ZeroAddress, 
      NFTMintingModulePlusABI.abi, 
      provider
    );
  }

  /**
   * Initialize the service with network-specific contract addresses
   */
  async init(chainId: number): Promise<void> {
    if (this.isInitialized && this.networkId === chainId) {
      return; // Already initialized for this network
    }

    this.networkId = chainId;
    const networkConfig = getCurrentNetworkConfig(chainId);
    
    if (!networkConfig) {
      throw new BlockchainError(
        `Unsupported network: ${chainId}`,
        BlockchainErrorType.UnsupportedNetwork
      );
    }

    if (!networkConfig.contracts.generalDAOVoting || networkConfig.contracts.generalDAOVoting === ethers.ZeroAddress) {
      throw new BlockchainError(
        `GeneralDAOVoting contract address not configured for network ${chainId}`,
        BlockchainErrorType.ContractError
      );
    }

    try {
      // Initialize contracts with proper addresses
      this.generalDAOVoting = new ethers.Contract(
        networkConfig.contracts.generalDAOVoting,
        GeneralDAOVotingABI.abi,
        this.signer || this.provider
      );

      this.nftMintingModule = new ethers.Contract(
        networkConfig.contracts.nftMintingModule,
        NFTMintingModulePlusABI.abi,
        this.signer || this.provider
      );

      // Test connection by calling a read-only method
      await this.generalDAOVoting.proposalCount();
      
      this.isInitialized = true;
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize contracts for network ${chainId}`,
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get total number of proposals from the contract
   */
  async getTotalProposalCount(): Promise<number> {
    this.ensureInitialized();
    
    try {
      const count = await this.generalDAOVoting.proposalCount();
      return Number(count);
    } catch (error) {
      console.error('Error getting total proposal count:', error);
      throw new BlockchainError(
        'Failed to get total proposal count',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Fetch proposals with pagination using getProposalList
   */
  async getProposalsPaginated(
    page: number = 0, 
    pageSize: number = 10
  ): Promise<PaginatedContractResult> {
    this.ensureInitialized();
    
    try {
      const totalCount = await this.getTotalProposalCount();
      
      if (totalCount === 0) {
        return {
          proposals: [],
          total: 0,
          hasMore: false
        };
      }

      // Calculate offset and limit for getProposalList
      // getProposalList returns proposals in creation order, so we need to reverse for newest first
      const offset = Math.max(0, totalCount - (page + 1) * pageSize);
      const limit = Math.min(pageSize, totalCount - page * pageSize);

      if (limit <= 0) {
        return {
          proposals: [],
          total: totalCount,
          hasMore: false
        };
      }

      // Fetch proposals using getProposalList
      const contractProposals: ContractDAOProposal[] = await this.generalDAOVoting.getProposalList(offset, limit);
      
      // Reverse to get newest first (create a copy since ethers.js returns read-only arrays)
      const reversedProposals = [...contractProposals].reverse();
      
      const hasMore = offset > 0;
      
      return {
        proposals: reversedProposals,
        total: totalCount,
        hasMore
      };

    } catch (error) {
      console.error('Error in getProposalsPaginated:', error);
      throw new BlockchainError(
        'Failed to fetch paginated proposals',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get a single proposal by ID using getProposal
   */
  async getProposal(proposalId: string): Promise<ContractDAOProposal | null> {
    this.ensureInitialized();
    
    try {
      const id = parseInt(proposalId);
      if (isNaN(id) || id < 0) {
        throw new Error(`Invalid proposal ID: ${proposalId}`);
      }

      const contractProposal: ContractDAOProposal = await this.generalDAOVoting.getProposal(id);
      
      // Check if proposal exists (ID 0 typically means not found)
      if (!contractProposal || contractProposal.id === createBigInt(0)) {
        return null;
      }

      return contractProposal;
    } catch (error) {
      console.error(`Error fetching proposal ${proposalId}:`, error);
      
      // Don't throw for not found cases
      if (error instanceof Error && error.message.includes('Invalid proposal ID')) {
        return null;
      }
      
      throw new BlockchainError(
        `Failed to fetch proposal ${proposalId}`,
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get proposal status using the contract method
   */
  async getProposalStatus(proposalId: string): Promise<number> {
    this.ensureInitialized();
    
    try {
      const id = parseInt(proposalId);
      const contractStatus = await this.generalDAOVoting.getProposalStatus(id);
      return Number(contractStatus);
    } catch (error) {
      console.error(`Error getting proposal status for ${proposalId}:`, error);
      throw new BlockchainError(
        `Failed to get proposal status for ${proposalId}`,
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create a blog minting proposal
   */
  async createBlogMintingProposal(proposal: BlogProposal): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      if (!this.signer) {
        throw new BlockchainError(
          'No signer available for transaction',
          BlockchainErrorType.ContractError
        );
      }

      // Get the voting situation name for this network
      const votingSituationName = getVotingSituationName(this.networkId) || 'BlogRitual Voting';
      
      // Validate inputs
      if (!proposal.title?.trim()) {
        throw new Error('Proposal title is required');
      }
      
      if (!proposal.contentReference?.trim()) {
        throw new Error('Content reference is required');
      }

      // Prepare the remark (title + description)
      const remark = `${proposal.title.trim()}\n${proposal.description?.trim() || ''}`;
      
      // Encode the content reference as callData
      const callData = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [proposal.contentReference]);

      const result = await this.executeTransaction(async () => {
        return this.generalDAOVoting.createProposal(
          votingSituationName,
          remark,
          callData
        );
      });

      return result;
    } catch (error) {
      console.error('Error creating blog minting proposal:', error);
      
      let errorType = BlockchainErrorType.ContractError;
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('insufficient funds')) {
          errorType = BlockchainErrorType.InsufficientFunds;
        }
      }
      
      throw new BlockchainError(
        'Failed to create proposal',
        errorType,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(proposalId: string, support: boolean): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      if (!this.signer) {
        throw new BlockchainError(
          'No signer available for transaction',
          BlockchainErrorType.ContractError
        );
      }

      const id = parseInt(proposalId);
      if (isNaN(id) || id < 0) {
        throw new Error(`Invalid proposal ID: ${proposalId}`);
      }

      const result = await this.executeTransaction(async () => {
        if (support) {
          return this.generalDAOVoting.voteFor(id);
        } else {
          return this.generalDAOVoting.voteAgainst(id);
        }
      });

      return result;
    } catch (error) {
      console.error('Error voting on proposal:', error);
      
      let errorType = BlockchainErrorType.ContractError;
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('already voted')) {
          errorType = BlockchainErrorType.ContractError;
        }
      }
      
      throw new BlockchainError(
        'Failed to vote on proposal',
        errorType,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Execute a proposal
   */
  async executeProposal(proposalId: string): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      if (!this.signer) {
        throw new BlockchainError(
          'No signer available for transaction',
          BlockchainErrorType.ContractError
        );
      }

      const id = parseInt(proposalId);
      if (isNaN(id) || id < 0) {
        throw new Error(`Invalid proposal ID: ${proposalId}`);
      }

      const result = await this.executeTransaction(async () => {
        return this.generalDAOVoting.executeProposal(id);
      });

      return result;
    } catch (error) {
      console.error('Error executing proposal:', error);
      
      let errorType = BlockchainErrorType.ContractError;
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('not approved') || errorMessage.includes('not ready')) {
          errorType = BlockchainErrorType.ContractError;
        }
      }
      
      throw new BlockchainError(
        'Failed to execute proposal',
        errorType,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if user has voted on a proposal
   */
  async hasVoted(proposalId: string, account: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const id = parseInt(proposalId);
      if (isNaN(id) || id < 0) {
        return false;
      }
      
      return await this.generalDAOVoting.hasUserVoted(id, account);
    } catch (error) {
      console.error('Error checking if user has voted:', error);
      return false;
    }
  }

  /**
   * Get voting statistics for a proposal
   */
  async getProposalVotingStats(proposalId: string): Promise<{
    requiredQuorum: bigint;
    currentQuorum: bigint;
    requiredMajority: bigint;
    currentMajority: bigint;
    currentVetoQuorum: bigint;
    requiredVetoQuorum: bigint;
  } | null> {
    this.ensureInitialized();
    
    try {
      const id = parseInt(proposalId);
      if (isNaN(id) || id < 0) {
        return null;
      }
      
      return await this.generalDAOVoting.getProposalVotingStats(id);
    } catch (error) {
      console.error('Error getting proposal voting stats:', error);
      return null;
    }
  }

  /**
   * Get available voting situations
   */
  async getVotingSituations(): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      return await this.generalDAOVoting.getVotingSituations();
    } catch (error) {
      console.error('Error getting voting situations:', error);
      return [];
    }
  }

  /**
   * Get contract instance for event handling
   */
  getContract(): ethers.Contract {
    this.ensureInitialized();
    return this.generalDAOVoting;
  }

  /**
   * Get network ID
   */
  getNetworkId(): number {
    return this.networkId;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Execute transaction helper with improved error handling and proper confirmations handling
   */
  private async executeTransaction(
    transactionFunction: () => Promise<ethers.ContractTransactionResponse>
  ): Promise<TransactionStatus> {
    try {
      const tx = await transactionFunction();
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      // Handle ethers v6 confirmations properly
      let confirmationsCount = 0;
      try {
        confirmationsCount = await receipt.confirmations();
      } catch {
        // Fallback if confirmations method fails
        confirmationsCount = 1;
      }

      return {
        hash: tx.hash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations: confirmationsCount,
        receipt
      };
    } catch (error) {
      console.error('Transaction execution failed:', error);
      
      // Try to extract more specific error information
      let errorMessage = 'Transaction failed';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Extract revert reason if available
        if ('reason' in error && error.reason) {
          errorMessage = error.reason as string;
        } else if ('code' in error && error.code === 'CALL_EXCEPTION') {
          errorMessage = 'Transaction reverted';
        }
      }
      
      return {
        hash: '',
        status: 'failed',
        confirmations: 0,
        error: new Error(errorMessage)
      };
    }
  }
}