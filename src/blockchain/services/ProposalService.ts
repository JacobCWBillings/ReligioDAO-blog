// src/blockchain/services/ProposalService.ts
import { ethers } from 'ethers';
import { getContractAddresses, getVotingSituationName } from '../../config';
import { 
  BlogProposal, 
  TransactionStatus, 
  BlockchainError, 
  BlockchainErrorType
} from '../../types/blockchain';
import { createBlogNFTMetadata, metadataToTokenURI } from '../utils/metadata';
import { extractContentReference } from '../utils/contentHash';
import { toNumber } from '../utils/blockchainUtils';

import GeneralDAOVotingABI from '../abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../abis/NFTMintingModulePlus.json';

/**
 * Service for interacting with the DAO's proposal system for blog NFT minting
 * Handles all interaction with the governance and minting contracts
 */
export class ProposalService {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null;
  private votingContract: ethers.Contract | null = null;
  private nftMintingModule: ethers.Contract | null = null;
  private votingSituationName: string | undefined;
  
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer || null;
  }
  
  /**
   * Initialize contracts
   * @param chainId Optional chain ID to use specific network configuration
   */
  public async init(chainId?: number): Promise<void> {
    if (!this.signer) {
      throw new BlockchainError(
        "Signer is required for proposal operations",
        BlockchainErrorType.ContractError
      );
    }
    
    const addresses = getContractAddresses(chainId);
    this.votingSituationName = getVotingSituationName(chainId);
    
    // Initialize voting contract
    this.votingContract = new ethers.Contract(
      addresses.generalDAOVoting,
      GeneralDAOVotingABI.abi,
      this.signer
    );
    
    // Initialize NFT minting module
    this.nftMintingModule = new ethers.Contract(
      addresses.nftMintingModule,
      NFTMintingModulePlusABI.abi,
      this.signer
    );
  }

  /**
   * Create a blog minting proposal
   * This function creates a proposal with complete blog metadata stored on-chain
   * 
   * @param proposal BlogProposal object with all blog details
   * @returns Promise resolving to TransactionStatus
   */
  public async createBlogMintingProposal(
    proposal: BlogProposal
  ): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      // Create complete metadata object for the blog
      const metadata = createBlogNFTMetadata(
        proposal.title,
        proposal.description,
        proposal.contentReference, // This is the only part pointing to Swarm
        proposal.authorAddress,
        proposal.category,
        proposal.tags,
        undefined, // proposal ID not available yet
        proposal.banner || undefined
      );
      
      // Convert metadata to base64 encoded URI - this will be stored on-chain
      const tokenURI = metadataToTokenURI(metadata, 'base64');
      
      // Encode the mintTo function call with the complete metadata
      const mintToCalldata = this.nftMintingModule!.interface.encodeFunctionData(
        "mintTo",
        [proposal.authorAddress, tokenURI]
      );
      
      // Create a human-readable proposal description
      const proposalDescription = `
        Blog: ${proposal.title}
        Author: ${proposal.authorAddress}
        Category: ${proposal.category}
        Tags: ${proposal.tags.join(', ')}
        Content Reference: ${proposal.contentReference}
        
        ${proposal.description}
      `;
      
      // Submit the proposal to QGov
      const tx = await this.votingContract!.createProposal(
        this.votingSituationName,
        proposalDescription,
        mintToCalldata
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
      
      return status;
    } catch (err) {
      console.error('Error creating blog minting proposal:', err);
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('insufficient funds')) {
          errorType = BlockchainErrorType.InsufficientFunds;
        } else if (errorMessage.includes('network error') || errorMessage.includes('timeout')) {
          errorType = BlockchainErrorType.NetworkError;
        }
      }
      
      throw new BlockchainError(
        'Failed to create blog minting proposal',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Vote on a blog minting proposal
   * 
   * @param proposalId Proposal ID
   * @param support True for yes vote, false for no
   * @returns Promise resolving to TransactionStatus
   */
  public async voteOnProposal(
    proposalId: string,
    support: boolean
  ): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      // Vote on the proposal
      const method = support ? 'voteFor' : 'voteAgainst';
      const tx = await this.votingContract![method](proposalId);
      
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
        } else if (errorMessage.includes('network error') || errorMessage.includes('timeout')) {
          errorType = BlockchainErrorType.NetworkError;
        }
      }
      
      throw new BlockchainError(
        'Failed to vote on proposal',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Execute an approved proposal to mint the blog NFT
   * This will create an NFT with all metadata stored directly on-chain
   * 
   * @param proposalId Proposal ID
   * @returns Promise resolving to TransactionStatus
   */
  public async executeProposal(proposalId: string): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      // Execute the approved proposal
      // The NFT will be created with all metadata on-chain
      const tx = await this.votingContract!.executeProposal(proposalId);
      
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
        } else if (errorMessage.includes('network error') || errorMessage.includes('timeout')) {
          errorType = BlockchainErrorType.NetworkError;
        }
      }
      
      throw new BlockchainError(
        'Failed to execute proposal',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get all pending proposals that need votes
   * This focuses on what users need (proposals to vote on)
   * rather than emphasizing proposal IDs
   * 
   * @returns Promise resolving to array of pending proposals
   */
  public async getPendingProposals(): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      const proposalIds = await this.getAllProposalIds();
      const pendingProposals = [];
      
      for (const id of proposalIds) {
        const proposal = await this.getProposal(id);
        // Only include active proposals that need votes
        if (Number(proposal.status) === 1) { // Active status
          pendingProposals.push(proposal);
        }
      }
      
      return pendingProposals;
    } catch (err) {
      console.error('Error getting pending proposals:', err);
      throw new BlockchainError(
        'Failed to get pending proposals',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get proposal details
   * 
   * @param proposalId Proposal ID
   * @returns Promise resolving to proposal details
   */
  public async getProposal(proposalId: string): Promise<any> {
    this.ensureInitialized();
    
    try {
      const proposal = await this.votingContract!.getProposal(proposalId);
      const status = await this.votingContract!.getProposalStatus(proposalId);
      const callData = proposal.callData;
      
      // Extract content reference from the calldata
      const contentReference = extractContentReference(callData);
      
      return {
        id: proposalId.toString(),
        title: proposal.remark || "Blog Proposal",
        description: proposal.remark || "",
        proposer: proposal.target,
        createdAt: toNumber(proposal.params.votingStartTime),
        votingEnds: toNumber(proposal.params.votingEndTime),
        votesFor: toNumber(proposal.counters.votedFor),
        votesAgainst: toNumber(proposal.counters.votedAgainst),
        status: toNumber(status),
        executed: proposal.executed,
        callData,
        contentReference
      };
    } catch (err) {
      console.error('Error getting proposal details:', err);
      throw new BlockchainError(
        'Failed to get proposal details',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get all proposal IDs
   * 
   * @returns Promise resolving to array of proposal IDs
   */
  public async getAllProposalIds(): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      const proposalCount = await this.votingContract!.proposalCount();
      const count = toNumber(proposalCount);
      
      // Create an array of IDs from 1 to count
      return Array.from({ length: count }, (_, i) => (i + 1).toString());
    } catch (err) {
      console.error('Error getting all proposal IDs:', err);
      throw new BlockchainError(
        'Failed to get all proposal IDs',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Check if a user has voted on a proposal
   * 
   * @param proposalId Proposal ID
   * @param voter Voter address
   * @returns Promise resolving to boolean indicating if voter has voted
   */
  public async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      return await this.votingContract!.hasUserVoted(proposalId, voter);
    } catch (err) {
      console.error('Error checking if user has voted:', err);
      throw new BlockchainError(
        'Failed to check if user has voted',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Ensure contracts are initialized
   * @throws BlockchainError if not initialized
   */
  private ensureInitialized(): void {
    if (!this.votingContract || !this.nftMintingModule) {
      throw new BlockchainError(
        "ProposalService not initialized. Call init() first.",
        BlockchainErrorType.ContractError
      );
    }
  }
}