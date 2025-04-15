// src/blockchain/services/ProposalService.ts
import { ethers } from 'ethers';
import { getContractAddresses } from '../../config';
import { BlogProposal, TransactionStatus, BlockchainError, BlockchainErrorType } from '../../types/blockchain';

// ABI for GeneralDAOVoting contract (simplified for readability)
const GeneralDAOVotingABI = [
  "function createProposal(string memory title, string memory description, bytes memory callData) public returns (uint256)",
  "function vote(uint256 proposalId, bool support) public",
  "function executeProposal(uint256 proposalId) public",
  "function getProposal(uint256 proposalId) public view returns (tuple(uint256 id, string title, string description, address proposer, uint256 createdAt, uint256 votingEnds, uint256 votesFor, uint256 votesAgainst, uint8 status, bool executed))",
  "function getProposalCallData(uint256 proposalId) public view returns (bytes memory)",
  "function getProposalVotes(uint256 proposalId) public view returns (uint256 votesFor, uint256 votesAgainst)",
  "function hasVoted(uint256 proposalId, address voter) public view returns (bool)",
  "function getAllProposals() public view returns (uint256[] memory)"
];

// ABI for NFTMintingModulePlus contract
const NFTMintingModuleABI = [
  "function mintTo(address to, string memory tokenURI) public"
];

/**
 * Service for interacting with the DAO's proposal system for blog NFT minting
 */
export class ProposalService {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null;
  private votingContract: ethers.Contract | null = null;
  private nftMintingModule: ethers.Contract | null = null;
  
  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer || null;
  }
  
  /**
   * Initialize contracts
   */
  public async init(chainId?: number): Promise<void> {
    if (!this.signer) {
      throw new BlockchainError(
        "Signer is required for proposal operations",
        BlockchainErrorType.ContractError
      );
    }
    
    const addresses = getContractAddresses(chainId);
    
    // Initialize voting contract
    this.votingContract = new ethers.Contract(
      addresses.generalDAOVoting,
      GeneralDAOVotingABI,
      this.signer
    );
    
    // Initialize NFT minting module
    this.nftMintingModule = new ethers.Contract(
      addresses.nftMintingModule,
      NFTMintingModuleABI,
      this.signer
    );
  }

  /**
   * Create a blog minting proposal
   */
  public async createBlogMintingProposal(
    proposal: BlogProposal
  ): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      // Encode the mintTo function call for the NFT minting module
      const mintToCalldata = this.nftMintingModule!.interface.encodeFunctionData(
        "mintTo",
        [proposal.authorAddress, proposal.contentReference]
      );
      
      // Create the blog minting proposal title and description
      const title = `Blog Minting: ${proposal.title}`;
      const description = `
        Blog: ${proposal.title}
        Author: ${proposal.authorAddress}
        Category: ${proposal.category}
        Tags: ${proposal.tags.join(', ')}
        Content Reference: ${proposal.contentReference}
        
        ${proposal.description}
      `;
      
      // Submit the proposal to the voting contract
      const tx = await this.votingContract!.createProposal(
        title,
        description,
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
   */
  public async voteOnProposal(
    proposalId: string,
    support: boolean
  ): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      // Vote on the proposal
      const tx = await this.votingContract!.vote(proposalId, support);
      
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
   */
  public async executeProposal(proposalId: string): Promise<TransactionStatus> {
    this.ensureInitialized();
    
    try {
      // Execute the approved proposal
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
   * Get proposal details
   */
  public async getProposal(proposalId: string): Promise<any> {
    this.ensureInitialized();
    
    try {
      const proposal = await this.votingContract!.getProposal(proposalId);
      const callData = await this.votingContract!.getProposalCallData(proposalId);
      const [votesFor, votesAgainst] = await this.votingContract!.getProposalVotes(proposalId);
      
      return {
        id: proposal.id.toString(),
        title: proposal.title,
        description: proposal.description,
        proposer: proposal.proposer,
        createdAt: proposal.createdAt.toString(),
        votingEnds: proposal.votingEnds.toString(),
        votesFor: votesFor.toString(),
        votesAgainst: votesAgainst.toString(),
        status: proposal.status,
        executed: proposal.executed,
        callData
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
   */
  public async getAllProposalIds(): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      const proposalIds = await this.votingContract!.getAllProposals();
      return proposalIds.map(id => id.toString());
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
   */
  public async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      return await this.votingContract!.hasVoted(proposalId, voter);
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

export default ProposalService;