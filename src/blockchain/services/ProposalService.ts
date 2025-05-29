// src/blockchain/services/ProposalService.ts - Fixed TypeScript errors
import { ethers } from 'ethers';
import { BaseContractService } from './BaseContractService';
import { 
  BlogProposal, 
  Proposal, 
  ProposalStatus, 
  BlockchainError, 
  BlockchainErrorType, 
  TransactionStatus 
} from '../../types/blockchain';
import { IDAOVoting } from '../interfaces/IDAOVoting';
import { getContractAddresses, getVotingSituationName, qVotingParams, chainIdToQNetworkMap } from '../../config';
import GeneralDAOVotingABI from '../abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../abis/NFTMintingModulePlus.json';

/**
 * Extended TransactionStatus for proposal operations
 */
interface ProposalTransactionStatus extends TransactionStatus {
  proposalId?: string;
  tokenId?: string;
}

/**
 * Service for interacting with Q DAO governance proposals
 * Handles blog proposal creation, voting, and execution
 */
export class ProposalService extends BaseContractService {
  private generalDAOVoting!: ethers.Contract & IDAOVoting;
  private nftMintingModule!: ethers.Contract;
  private votingSituationName!: string;
  private networkParams: any;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    super(provider, signer);
  }

  /**
   * Initialize the service with contract instances
   */
  async init(chainId: number): Promise<void> {
    try {
      const contractAddresses = getContractAddresses(chainId);
      this.votingSituationName = getVotingSituationName(chainId) || 'BlogRitual Voting';
      
      // Get network-specific voting parameters
      const networkName = chainIdToQNetworkMap[chainId.toString()] || 'testnet';
      this.networkParams = qVotingParams[networkName as keyof typeof qVotingParams] || qVotingParams.testnet;
      
      // Initialize GeneralDAOVoting contract
      this.generalDAOVoting = new ethers.Contract(
        contractAddresses.generalDAOVoting,
        GeneralDAOVotingABI.abi,
        this.signer || this.provider
      ) as ethers.Contract & IDAOVoting;
      
      // Initialize NFTMintingModule contract
      this.nftMintingModule = new ethers.Contract(
        contractAddresses.nftMintingModule,
        NFTMintingModulePlusABI.abi,
        this.signer || this.provider
      );
      
      console.log('ProposalService initialized:', {
        chainId,
        networkName,
        votingSituation: this.votingSituationName,
        generalDAOVoting: contractAddresses.generalDAOVoting,
        nftMintingModule: contractAddresses.nftMintingModule
      });
    } catch (error) {
      console.error('Error initializing ProposalService:', error);
      throw new BlockchainError(
        'Failed to initialize ProposalService',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get a single proposal by ID using both contract data and official status
   */
  async getProposal(proposalId: string): Promise<Proposal | null> {
    try {
      // Get both proposal data and official status from Q contract
      const [contractProposal, contractStatusRaw] = await Promise.all([
        this.generalDAOVoting.getProposal(proposalId),
        this.generalDAOVoting.getProposalStatus(proposalId)
      ]);
      
      // Convert contract status to ProposalStatus enum
      const contractStatus = this.mapContractStatusToEnum(Number(contractStatusRaw));
      
      // Debug logging
      console.log(`Proposal ${proposalId} from Q contract:`, {
        contractStatus: Number(contractStatusRaw),
        contractStatusName: this.getStatusName(contractStatus),
        contractExecutedFlag: contractProposal.executed,
        votingStart: Number(contractProposal.params.votingStartTime),
        votingEnd: Number(contractProposal.params.votingEndTime),
        votesFor: Number(contractProposal.counters.votedFor),
        votesAgainst: Number(contractProposal.counters.votedAgainst)
      });
      
      // Map to application Proposal interface
      const proposal: Proposal = {
        id: proposalId,
        title: this.extractTitleFromRemark(contractProposal.remark),
        description: contractProposal.remark,
        proposer: await this.getProposalProposer(proposalId, contractProposal),
        createdAt: Number(contractProposal.params.votingStartTime) * 1000,
        votingEnds: Number(contractProposal.params.votingEndTime) * 1000,
        votesFor: Number(contractProposal.counters.votedFor),
        votesAgainst: Number(contractProposal.counters.votedAgainst),
        
        // CRITICAL: Use Q contract status as source of truth
        status: contractStatus,
        
        // CRITICAL: executed flag should match Q contract status
        executed: contractStatus === ProposalStatus.Executed,
        
        contentReference: this.extractContentReferenceFromCallData(contractProposal.callData)
      };
      
      // Verification: Check for inconsistencies and warn
      if (contractProposal.executed !== proposal.executed) {
        console.warn(`Inconsistency in proposal ${proposalId}:`, {
          contractExecutedFlag: contractProposal.executed,
          derivedExecutedFlag: proposal.executed,
          contractStatus: proposal.status,
          contractStatusName: this.getStatusName(proposal.status)
        });
      }
      
      return proposal;
    } catch (error) {
      console.error(`Error fetching proposal ${proposalId}:`, error);
      
      if (error instanceof Error && error.message.includes('call revert exception')) {
        // Proposal doesn't exist
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
   * Get all proposals from the DAO
   */
  async getAllProposals(): Promise<Proposal[]> {
    try {
      // Get total proposal count
      const proposalCount = await this.generalDAOVoting.proposalCount();
      const count = Number(proposalCount);
      
      if (count === 0) {
        return [];
      }
      
      console.log(`Fetching ${count} proposals from Q contract...`);
      
      // Fetch all proposals in batches to avoid timeouts
      const batchSize = 10;
      const proposals: Proposal[] = [];
      
      for (let i = 0; i < count; i += batchSize) {
        const batchPromises: Promise<Proposal | null>[] = [];
        const batchEnd = Math.min(i + batchSize, count);
        
        for (let j = i; j < batchEnd; j++) {
          // Q contracts use 0-indexed proposals, but we display them as 1-indexed to users
          batchPromises.push(this.getProposal(j.toString()));
        }
        
        const batchResults = await Promise.all(batchPromises);
        
        // Filter out null results and add to proposals array
        batchResults.forEach(proposal => {
          if (proposal) {
            proposals.push(proposal);
          }
        });
        
        console.log(`Fetched batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(count / batchSize)}: ${batchResults.filter(p => p).length} proposals`);
      }
      
      console.log(`Successfully fetched ${proposals.length} proposals from Q contract`);
      
      // Sort by creation date (newest first)
      return proposals.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error fetching all proposals:', error);
      throw new BlockchainError(
        'Failed to fetch proposals from Q contract',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create a new blog minting proposal
   */
  async createBlogMintingProposal(blogProposal: BlogProposal): Promise<ProposalTransactionStatus> {
    if (!this.signer) {
      throw new BlockchainError(
        'Signer required for creating proposals',
        BlockchainErrorType.ContractError
      );
    }

    try {
      // Prepare NFT metadata for the calldata
      const nftMetadata = {
        name: blogProposal.title,
        description: blogProposal.preview,
        image: blogProposal.banner || '',
        attributes: [
          { trait_type: 'Category', value: blogProposal.category },
          { trait_type: 'Author', value: blogProposal.authorAddress },
          { trait_type: 'Content Reference', value: blogProposal.contentReference }
        ],
        properties: {
          contentReference: blogProposal.contentReference,
          category: blogProposal.category,
          tags: blogProposal.tags,
          authorAddress: blogProposal.authorAddress,
          approvalDate: new Date().toISOString()
        }
      };

      // Encode the call data for NFT minting
      const callData = this.nftMintingModule.interface.encodeFunctionData(
        'mintWithMetadata',
        [
          blogProposal.authorAddress,
          JSON.stringify(nftMetadata)
        ]
      );

      // Create the proposal remark with structured information
      const proposalRemark = this.createProposalRemark(blogProposal);

      console.log('Creating blog proposal with:', {
        votingSituation: this.votingSituationName,
        remark: proposalRemark,
        callDataLength: callData.length,
        targetContract: await this.nftMintingModule.getAddress()
      });

      // Submit the proposal to Q DAO
      const tx = await this.generalDAOVoting.createProposal(
        this.votingSituationName,
        proposalRemark,
        callData
      );

      console.log(`Blog proposal transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt not available');
      }

      // Extract proposal ID from the ProposalCreated event
      let proposalId: string | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = this.generalDAOVoting.interface.parseLog(log);
          if (parsed && parsed.name === 'ProposalCreated') {
            proposalId = parsed.args.id.toString();
            break;
          }
        } catch (e) {
          // Not a matching log, continue
        }
      }

      console.log(`Blog proposal created successfully. Proposal ID: ${proposalId}`);

      return {
        hash: tx.hash,
        status: 'confirmed',
        confirmations: receipt.confirmations,
        receipt,
        proposalId: proposalId || undefined
      };
    } catch (error) {
      console.error('Error creating blog proposal:', error);
      throw this.classifyBlockchainError(error, 'Failed to create blog proposal');
    }
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(proposalId: string, support: boolean): Promise<TransactionStatus> {
    if (!this.signer) {
      throw new BlockchainError(
        'Signer required for voting',
        BlockchainErrorType.ContractError
      );
    }

    try {
      // Check if user has already voted
      const userAddress = await this.signer.getAddress();
      const hasVoted = await this.generalDAOVoting.hasUserVoted(proposalId, userAddress);
      
      if (hasVoted) {
        throw new BlockchainError(
          'You have already voted on this proposal',
          BlockchainErrorType.ContractError
        );
      }

      // Check proposal status
      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new BlockchainError(
          'Proposal not found',
          BlockchainErrorType.ContractError
        );
      }

      if (proposal.status !== ProposalStatus.Pending) {
        throw new BlockchainError(
          'Voting is not active for this proposal',
          BlockchainErrorType.ContractError
        );
      }

      console.log(`Voting ${support ? 'FOR' : 'AGAINST'} proposal ${proposalId}`);

      // Submit vote
      const tx = support 
        ? await this.generalDAOVoting.voteFor(proposalId)
        : await this.generalDAOVoting.voteAgainst(proposalId);

      console.log(`Vote transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt not available');
      }

      console.log(`Vote submitted successfully for proposal ${proposalId}`);

      return {
        hash: tx.hash,
        status: 'confirmed',
        confirmations: receipt.confirmations,
        receipt
      };
    } catch (error) {
      console.error(`Error voting on proposal ${proposalId}:`, error);
      throw this.classifyBlockchainError(error, 'Failed to vote on proposal');
    }
  }

  /**
   * Execute an approved proposal
   */
  async executeProposal(proposalId: string): Promise<ProposalTransactionStatus> {
    if (!this.signer) {
      throw new BlockchainError(
        'Signer required for executing proposals',
        BlockchainErrorType.ContractError
      );
    }

    try {
      // Verify proposal can be executed
      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new BlockchainError(
          'Proposal not found',
          BlockchainErrorType.ContractError
        );
      }

      if (proposal.status !== ProposalStatus.Accepted && proposal.status !== ProposalStatus.Passed) {
        throw new BlockchainError(
          `Proposal cannot be executed. Current status: ${this.getStatusName(proposal.status)}`,
          BlockchainErrorType.ContractError
        );
      }

      console.log(`Executing approved proposal ${proposalId}`);

      // Execute the proposal
      const tx = await this.generalDAOVoting.executeProposal(proposalId);
      
      console.log(`Proposal execution transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt not available');
      }

      // Try to extract token ID from transaction logs
      let tokenId: string | null = null;
      try {
        tokenId = await this.getTokenIdForExecutedProposal(proposalId, tx.hash);
      } catch (error) {
        console.warn('Could not extract token ID from execution transaction:', error);
      }

      console.log(`Proposal ${proposalId} executed successfully. Token ID: ${tokenId || 'Unknown'}`);

      return {
        hash: tx.hash,
        status: 'confirmed',
        confirmations: receipt.confirmations,
        receipt,
        tokenId: tokenId || undefined
      };
    } catch (error) {
      console.error(`Error executing proposal ${proposalId}:`, error);
      throw this.classifyBlockchainError(error, 'Failed to execute proposal');
    }
  }

  /**
   * Check if a user has voted on a proposal
   */
  async hasVoted(proposalId: string, userAddress: string): Promise<boolean> {
    try {
      return await this.generalDAOVoting.hasUserVoted(proposalId, userAddress);
    } catch (error) {
      console.error(`Error checking vote status for proposal ${proposalId}:`, error);
      return false;
    }
  }

  /**
   * Get proposals that are pending user action
   */
  async getPendingProposals(): Promise<Proposal[]> {
    try {
      const allProposals = await this.getAllProposals();
      // Note: May need to clarify which status represents "active voting"
      return allProposals.filter(p => 
        p.status === ProposalStatus.Pending || 
        p.status === ProposalStatus.UnderReview ||
        p.status === ProposalStatus.UnderEvaluation
      );
    } catch (error) {
      console.error('Error getting pending proposals:', error);
      return [];
    }
  }

  /**
   * Extract token ID from executed proposal transaction
   */
  async getTokenIdForExecutedProposal(proposalId: string, txHash: string): Promise<string | null> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) return null;

      // Look for Transfer event from NFT contract (ERC721 Transfer event signature)
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      for (const log of receipt.logs) {
        try {
          // Check if this is an ERC721 Transfer event
          if (log.topics.length >= 4 && log.topics[0] === transferEventSignature) {
            // Third topic (index 2) is the tokenId for ERC721 Transfer events
            const tokenId = BigInt(log.topics[3]).toString();
            console.log(`Found token ID ${tokenId} in execution transaction ${txHash}`);
            return tokenId;
          }
        } catch (e) {
          // Continue to next log
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting token ID:', error);
      return null;
    }
  }

  // Helper methods

  /**
   * Map contract status number to CORRECTED ProposalStatus enum
   */
  private mapContractStatusToEnum(status: number): ProposalStatus {
    switch (status) {
      case 0: return ProposalStatus.None;
      case 1: return ProposalStatus.Pending;
      case 2: return ProposalStatus.Rejected;
      case 3: return ProposalStatus.Accepted;  // This is "Approved" - ready for execution
      case 4: return ProposalStatus.Passed;    // Alternative approval state
      case 5: return ProposalStatus.Executed;  // Actually executed
      case 6: return ProposalStatus.Expired;
      case 7: return ProposalStatus.UnderReview;
      case 8: return ProposalStatus.UnderEvaluation;
      default: 
        console.warn(`Unknown Q governance proposal status: ${status}`);
        return ProposalStatus.None;
    }
  }

  private getStatusName(status: ProposalStatus): string {
    const statusNames: Record<ProposalStatus, string> = {
      [ProposalStatus.None]: 'None',
      [ProposalStatus.Pending]: 'Pending',
      [ProposalStatus.Rejected]: 'Rejected',
      [ProposalStatus.Accepted]: 'Approved',  // User-friendly name for "Accepted"
      [ProposalStatus.Passed]: 'Passed',
      [ProposalStatus.Executed]: 'Executed',
      [ProposalStatus.Expired]: 'Expired',
      [ProposalStatus.UnderReview]: 'Under Review',
      [ProposalStatus.UnderEvaluation]: 'Under Evaluation'
    };
    return statusNames[status] || 'Unknown';
  }

  private async getProposalProposer(proposalId: string, contractProposal: any): Promise<string> {
    try {
      // Try to get proposer from contract events
      const filter = this.generalDAOVoting.filters.ProposalCreated(proposalId);
      const events = await this.generalDAOVoting.queryFilter(filter, -1000); // Last 1000 blocks
      
      if (events.length > 0) {
        const event = events[0];
        // Type guard to check if this is an EventLog with args
        if ('args' in event && event.args) {
          return event.args.proposer || '0x0000000000000000000000000000000000000000';
        }
      }
      
      // Fallback to contract data if available
      return contractProposal.proposer || '0x0000000000000000000000000000000000000000';
    } catch (error) {
      console.warn(`Could not determine proposer for proposal ${proposalId}:`, error);
      return '0x0000000000000000000000000000000000000000';
    }
  }

  private extractTitleFromRemark(remark: string): string {
    try {
      const lines = remark.split('\n');
      const titleLine = lines.find(line => line.trim().startsWith('Blog:'));
      return titleLine ? titleLine.replace('Blog:', '').trim() : 'Untitled Blog Proposal';
    } catch (e) {
      return 'Untitled Blog Proposal';
    }
  }

  private extractContentReferenceFromCallData(callData: string | Uint8Array): string | undefined {
    try {
      // Convert BytesLike to string if needed
      const callDataString = typeof callData === 'string' ? callData : ethers.hexlify(callData);
      
      // Decode the NFT minting call data to extract content reference
      const decoded = this.nftMintingModule.interface.decodeFunctionData('mintWithMetadata', callDataString);
      if (decoded && decoded.length > 1) {
        const metadata = JSON.parse(decoded[1]);
        return metadata.properties?.contentReference;
      }
    } catch (error) {
      console.warn('Could not extract content reference from call data:', error);
    }
    return undefined;
  }

  private createProposalRemark(blogProposal: BlogProposal): string {
    return [
      `Blog: ${blogProposal.title}`,
      `Category: ${blogProposal.category}`,
      `Tags: ${blogProposal.tags.join(', ')}`,
      `Author: ${blogProposal.authorAddress}`,
      `Content Reference: ${blogProposal.contentReference}`,
      '',
      `Description: ${blogProposal.description}`,
      '',
      `Preview: ${blogProposal.preview}`
    ].join('\n');
  }

  private classifyBlockchainError(error: any, defaultMessage: string): BlockchainError {
    if (error instanceof BlockchainError) {
      return error;
    }

    let errorType = BlockchainErrorType.Unknown;
    let message = defaultMessage;

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
        errorType = BlockchainErrorType.UserRejected;
        message = 'Transaction was rejected by user';
      } else if (errorMessage.includes('insufficient funds')) {
        errorType = BlockchainErrorType.InsufficientFunds;
        message = 'Insufficient funds for transaction';
      } else if (errorMessage.includes('gas')) {
        errorType = BlockchainErrorType.GasLimitExceeded;
        message = 'Transaction failed due to gas issues';
      } else if (errorMessage.includes('revert') || errorMessage.includes('execution reverted')) {
        errorType = BlockchainErrorType.ContractError;
        message = `Contract execution failed: ${error.message}`;
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        errorType = BlockchainErrorType.NetworkError;
        message = 'Network connection error';
      }
    }

    return new BlockchainError(message, errorType, error instanceof Error ? error : new Error(String(error)));
  }

  // Getter methods for accessing contract instances (for advanced use cases)
  getGeneralDAOVotingContract(): ethers.Contract & IDAOVoting {
    if (!this.generalDAOVoting) {
      throw new Error('ProposalService not initialized');
    }
    return this.generalDAOVoting;
  }

  getNFTMintingModuleContract(): ethers.Contract {
    if (!this.nftMintingModule) {
      throw new Error('ProposalService not initialized');
    }
    return this.nftMintingModule;
  }

  getVotingSituationName(): string {
    return this.votingSituationName;
  }

  getNetworkParams(): any {
    return this.networkParams;
  }
}