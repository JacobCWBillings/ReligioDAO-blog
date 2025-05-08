// src/blockchain/services/ProposalService.ts
import { ethers } from 'ethers';
import { 
  BlogProposal, 
  Proposal, 
  ProposalStatus, 
  BlockchainError, 
  BlockchainErrorType, 
  TransactionStatus 
} from '../../types/blockchain';
import { BaseContractService } from './BaseContractService';
import { DAOVotingService } from './DAOVotingService';
import { NFTMintingService } from './NFTMintingService';
import { ProposalUtilsService } from './ProposalUtilsService';
import { extractTokenIdFromMintingReceipt, extractNFTTokenIdFromReceipt } from '../utils/transactionUtils';

/**
 * Service for managing blog proposals and voting
 * This is a higher-level service that coordinates the specialized services
 */
export class ProposalService extends BaseContractService {
  private daoVotingService: DAOVotingService;
  private nftMintingService: NFTMintingService;
  private proposalUtils: ProposalUtilsService;
  
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    super(provider, signer);
    
    // Initialize specialized services
    this.daoVotingService = new DAOVotingService(provider, signer);
    this.nftMintingService = new NFTMintingService(provider, signer);
    this.proposalUtils = new ProposalUtilsService();
  }
  
  /**
   * Initialize all services
   * @param chainId Optional chain ID to use specific network configuration
   */
  public async init(chainId?: number): Promise<void> {
    try {
      // Initialize all specialized services
      await this.daoVotingService.init(chainId);
      await this.nftMintingService.init(chainId);
      
      this.isInitialized = true;
    } catch (err) {
      console.error("Error initializing ProposalService:", err);
      throw new BlockchainError(
        "Failed to initialize ProposalService",
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Create a blog minting proposal
   * This combines NFT metadata creation and proposal submission
   * 
   * @param proposal BlogProposal object with all blog details
   * @returns Promise resolving to TransactionStatus with proposal ID
   */
  public async createBlogMintingProposal(
    proposal: BlogProposal
  ): Promise<TransactionStatus & { proposalId?: string }> {
    this.ensureInitialized();
    this.ensureRealWallet(); // Check if we have a real wallet connected
    
    const votingSituation = this.daoVotingService.getVotingSituation();
    if (!votingSituation) {
      throw new BlockchainError(
        "Voting situation name not configured",
        BlockchainErrorType.ContractError
      );
    }
    
    try {
      // 1. Create metadata for the blog NFT
      const metadata = this.nftMintingService.createBlogMetadata(
        proposal.title,
        proposal.preview,
        proposal.contentReference,
        proposal.authorAddress,
        proposal.category,
        proposal.tags,
        undefined, // proposal ID not available yet
        proposal.banner || undefined
      );
      
      // 2. Convert metadata to on-chain tokenURI
      const tokenURI = this.nftMintingService.createTokenURI(metadata, 'base64');
      
      // 3. Prepare mintTo calldata for the proposal
      const mintToCalldata = this.nftMintingService.prepareMintToCalldata(
        proposal.authorAddress, 
        tokenURI
      );
      
      // 4. Create proposal description
      const proposalDescription = this.proposalUtils.createProposalDescription(
        proposal.title,
        proposal.authorAddress,
        proposal.category,
        proposal.tags,
        proposal.contentReference,
        proposal.description
      );
      
      // 5. Submit the proposal to the DAO
      return await this.daoVotingService.createProposal(
        votingSituation,
        proposalDescription,
        mintToCalldata
      );
    } catch (err) {
      console.error('Error creating blog minting proposal:', err);
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof BlockchainError) {
        throw err; // Re-throw BlockchainError as is
      } else if (err instanceof Error) {
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
   * Vote on a proposal
   * 
   * @param proposalId Proposal ID as displayed in the UI (1-based)
   * @param support True for yes vote, false for no
   * @returns Promise resolving to TransactionStatus
   */
  public async voteOnProposal(
    proposalId: string,
    support: boolean
  ): Promise<TransactionStatus> {
    this.ensureInitialized();
    this.ensureRealWallet(); // Check if we have a real wallet connected

    // Convert UI proposal ID to blockchain ID
    const blockchainProposalId = this.proposalUtils.uiToBlockchainProposalId(proposalId);
    
    // Submit vote
    if (support) {
      return await this.daoVotingService.voteFor(blockchainProposalId);
    } else {
      return await this.daoVotingService.voteAgainst(blockchainProposalId);
    }
  }

  /**
   * Execute an approved proposal to mint the blog NFT
   * 
   * @param proposalId Proposal ID as displayed in the UI (1-based)
   * @returns Promise resolving to TransactionStatus with optional token ID
   */
  public async executeProposal(
    proposalId: string
  ): Promise<TransactionStatus & { tokenId?: string }> {
    this.ensureInitialized();
    this.ensureRealWallet(); // Check if we have a real wallet connected

    // Convert UI proposal ID to blockchain ID
    const blockchainProposalId = this.proposalUtils.uiToBlockchainProposalId(proposalId);
    
    // Execute proposal
    const status = await this.daoVotingService.executeProposal(blockchainProposalId);
    
    // Extract token ID from transaction receipt if available
    let tokenId: string | undefined = undefined;
    if (status.status === 'confirmed' && status.receipt) {
      // First try to extract using the specialized function for our minting module
      tokenId = extractTokenIdFromMintingReceipt(status.receipt) ?? undefined;
      
      // If that doesn't work, try with the general NFT token extraction
      if (!tokenId) {
        const nftContractAddress = this.nftMintingService.getNFTContractAddress();
        if (nftContractAddress) {
          // Try to extract from Transfer event
          tokenId = extractNFTTokenIdFromReceipt(
            status.receipt, 
            nftContractAddress
          ) ?? undefined;
        }
      }
      
      if (tokenId) {
        console.log(`Extracted token ID from receipt: ${tokenId}`);
      }
    }
    
    // Return both the transaction status and the token ID
    return {
      ...status,
      tokenId
    };
  }

  /**
   * Get a specific proposal by ID
   * 
   * @param proposalId Proposal ID as displayed in the UI (1-based)
   * @returns Promise resolving to Proposal object or null
   */
  public async getProposal(proposalId: string): Promise<Proposal | null> {
    this.ensureInitialized();
    
    // Convert UI proposal ID to blockchain ID
    const blockchainProposalId = this.proposalUtils.uiToBlockchainProposalId(proposalId);
    
    try {
      // Get proposal data from contract
      const rawProposal = await this.daoVotingService.getRawProposal(blockchainProposalId);
      
      // Check if the proposal matches our target voting situation
      const votingSituation = this.daoVotingService.getVotingSituation();
      if (!this.proposalUtils.doesProposalMatchVotingSituation(rawProposal, votingSituation)) {
        // console.log(`Proposal ${proposalId} skipped: voting situation "${rawProposal.relatedVotingSituation}" doesn't match target "${votingSituation}"`);
        return null; // Skip proposals that don't match
      }
      
      const statusNum = await this.daoVotingService.getProposalStatus(blockchainProposalId);
      
      // Format proposal data
      return this.proposalUtils.formatProposal(
        rawProposal,
        statusNum,
        proposalId // Use the original UI proposal ID
      );
    } catch (err) {
      console.error(`Error fetching proposal ${proposalId}:`, err);
      return null;
    }
  }

  /**
   * Get all proposals
   * 
   * @returns Promise resolving to array of Proposal objects
   */
  public async getAllProposals(): Promise<Proposal[]> {
    this.ensureInitialized();
    
    try {
      // Get all proposal IDs from contract (blockchain IDs)
      const blockchainProposalIds = await this.daoVotingService.getAllProposalIds();
      
      // Convert blockchain IDs to UI IDs
      const uiProposalIds = blockchainProposalIds.map(id => 
        this.proposalUtils.blockchainToUiProposalId(id)
      );
      
      // Create array of promises for parallel execution
      const proposalPromises = uiProposalIds.map(id => this.getProposal(id));
      
      // Wait for all promises to resolve at once
      const allResults = await Promise.all(proposalPromises);
      
      // Filter out null values
      return allResults.filter((proposal): proposal is Proposal => proposal !== null);
    } catch (err) {
      console.error('Error fetching all proposals:', err);
      throw new BlockchainError(
        'Failed to fetch proposals',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get all proposals that need votes
   * 
   * @returns Promise resolving to array of pending or active proposals
   */
  public async getPendingProposals(): Promise<Proposal[]> {
    const allProposals = await this.getAllProposals();
    
    // Filter to only include pending/active proposals
    return allProposals.filter(p => 
      p.status === ProposalStatus.Pending || 
      p.status === ProposalStatus.Active
    );
  }

  /**
   * Check if a user has voted on a proposal
   * 
   * @param proposalId Proposal ID as displayed in the UI (1-based)
   * @param voter Voter address
   * @returns Promise resolving to boolean indicating if user has voted
   */
  public async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    this.ensureInitialized();
    
    // Convert UI proposal ID to blockchain ID
    const blockchainProposalId = this.proposalUtils.uiToBlockchainProposalId(proposalId);
    
    return await this.daoVotingService.hasUserVoted(blockchainProposalId, voter);
  }

  /**
   * Get token ID for an executed proposal
   * 
   * @param proposalId Proposal ID as displayed in the UI (1-based)
   * @param executionTxHash Transaction hash of execution
   * @returns Promise resolving to token ID or null
   */
  public async getTokenIdForExecutedProposal(
    proposalId: string,
    executionTxHash: string
  ): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      const receipt = await this.provider.getTransactionReceipt(executionTxHash);
      
      if (receipt) {
        // First try specialized extraction
        let tokenId = extractTokenIdFromMintingReceipt(receipt);
        
        // If not found, try general NFT extraction
        if (!tokenId) {
          const nftContractAddress = this.nftMintingService.getNFTContractAddress();
          if (nftContractAddress) {
            tokenId = extractNFTTokenIdFromReceipt(receipt, nftContractAddress);
          }
        }
        
        return tokenId;
      }
      
      return null;
    } catch (err) {
      console.error('Error getting token ID for executed proposal:', err);
      return null;
    }
  }
}