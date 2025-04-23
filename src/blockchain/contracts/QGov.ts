// src/blockchain/contracts/QGov.ts
import { ethers } from 'ethers';
import GeneralDAOVotingABI from '../abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../abis/NFTMintingModulePlus.json';
import { getContractAddresses } from '../../config';
import { 
  Proposal, 
  ProposalStatus, 
  BlogProposal, 
  TransactionStatus 
} from '../../types/blockchain';
import { sendTransaction } from '../utils/transaction';
import { extractContentReference } from '../utils/contentHash';

/**
 * Class representing the Q Governance (QGov) system
 * Handles DAO voting and proposal management
 */
export class QGovContract {
  private votingContract: ethers.Contract;
  private mintingContract: ethers.Contract;
  
  /**
   * Creates an instance of QGovContract
   * @param provider Ethers provider
   * @param signer Signer for transactions
   * @param chainId Optional chain ID, defaults to provider's network
   */
  constructor(
    private provider: ethers.Provider,
    private signer: ethers.Signer,
    private chainId?: number
  ) {
    const addresses = getContractAddresses(chainId);
    
    this.votingContract = new ethers.Contract(
      addresses.generalDAOVoting,
      GeneralDAOVotingABI.abi,
      signer
    );
    
    this.mintingContract = new ethers.Contract(
      addresses.nftMintingModule,
      NFTMintingModulePlusABI.abi,
      signer
    );
  }
  
  /**
   * Gets proposal count
   * @returns Promise resolving to proposal count
   */
  public async getProposalCount(): Promise<number> {
    const count = await this.votingContract.proposalCount();
    return count.toNumber();
  }
  
  /**
   * Gets proposal by ID
   * @param proposalId Proposal ID
   * @returns Promise resolving to Proposal object
   */
  public async getProposal(proposalId: string): Promise<Proposal | null> {
    try {
      const proposal = await this.votingContract.getProposal(proposalId);
      const status = await this.votingContract.getProposalStatus(proposalId);
      
      // Process voting results
      const [votesFor, votesAgainst] = [
        proposal.counters.votedFor,
        proposal.counters.votedAgainst
      ];
      
      return {
        id: proposal.id.toString(),
        title: proposal.remark,
        description: proposal.remark,
        proposer: proposal.target,
        status: this.mapStatus(status),
        createdAt: Number(proposal.params.votingStartTime) * 1000,
        votingEnds: Number(proposal.params.votingEndTime) * 1000,
        votesFor: Number(votesFor),
        votesAgainst: Number(votesAgainst),
        executed: proposal.executed,
        contentReference: extractContentReference(proposal.callData)
      };
    } catch (err) {
      console.error(`Error getting proposal ${proposalId}:`, err);
      return null;
    }
  }
  
  /**
   * Maps numeric status to ProposalStatus enum
   * @param status Numeric status from contract
   * @returns ProposalStatus enum value
   */
  private mapStatus(status: number): ProposalStatus {
    switch (status) {
      case 0: return ProposalStatus.Pending;
      case 1: return ProposalStatus.Active;
      case 2: return ProposalStatus.Approved;
      case 3: return ProposalStatus.Rejected;
      case 4: return ProposalStatus.Executed;
      case 5: return ProposalStatus.Canceled;
      default: return ProposalStatus.Pending;
    }
  }
  
  /**
   * Gets all proposals
   * @returns Promise resolving to array of Proposal objects
   */
  public async getAllProposals(): Promise<Proposal[]> {
    try {
      const count = await this.getProposalCount();
      
      const promises: Promise<Proposal | null>[] = [];
      for (let i = 1; i <= count; i++) {
        promises.push(this.getProposal(i.toString()));
      }
      
      const results = await Promise.all(promises);
      
      // Filter out null values
      return results.filter((proposal): proposal is Proposal => proposal !== null);
    } catch (err) {
      console.error('Error getting all proposals:', err);
      return [];
    }
  }
  
  /**
   * Creates a blog minting proposal
   * @param proposal BlogProposal object
   * @param votingSituation Voting situation name
   * @returns Promise resolving to TransactionStatus
   */
  public async createBlogMintingProposal(
    proposal: BlogProposal,
    votingSituation: string = 'default'
  ): Promise<TransactionStatus> {
    try {
      // Encode the mintTo function call
      const mintToCalldata = this.mintingContract.interface.encodeFunctionData(
        "mintTo",
        [proposal.authorAddress, proposal.contentReference]
      );
      
      // Create proposal title and description
      const title = `Blog Proposal: ${proposal.title}`;
      const description = `
        Blog: ${proposal.title}
        Author: ${proposal.authorAddress}
        Category: ${proposal.category}
        Tags: ${proposal.tags.join(', ')}
        Content Reference: ${proposal.contentReference}
        
        ${proposal.description}
      `;
      
      // Submit the proposal
      const tx = await this.votingContract.createProposal(
        votingSituation,
        title,
        mintToCalldata
      );
      
      // Wait for confirmation and return status
      return await sendTransaction(tx);
    } catch (err) {
      console.error('Error creating blog minting proposal:', err);
      throw err;
    }
  }
  
  /**
   * Votes on a proposal
   * @param proposalId Proposal ID
   * @param support True for yes vote, false for no
   * @returns Promise resolving to TransactionStatus
   */
  public async voteOnProposal(
    proposalId: string,
    support: boolean
  ): Promise<TransactionStatus> {
    try {
      let tx;
      if (support) {
        tx = await this.votingContract.voteFor(proposalId);
      } else {
        tx = await this.votingContract.voteAgainst(proposalId);
      }
      
      // Wait for confirmation and return status
      return await sendTransaction(tx);
    } catch (err) {
      console.error(`Error voting on proposal ${proposalId}:`, err);
      throw err;
    }
  }
  
  /**
   * Executes an approved proposal
   * @param proposalId Proposal ID
   * @returns Promise resolving to TransactionStatus
   */
  public async executeProposal(proposalId: string): Promise<TransactionStatus> {
    try {
      const tx = await this.votingContract.executeProposal(proposalId);
      
      // Wait for confirmation and return status
      return await sendTransaction(tx);
    } catch (err) {
      console.error(`Error executing proposal ${proposalId}:`, err);
      throw err;
    }
  }
  
  /**
   * Checks if an address has voted on a proposal
   * @param proposalId Proposal ID
   * @param voter Voter address
   * @returns Promise resolving to boolean
   */
  public async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    return await this.votingContract.hasUserVoted(proposalId, voter);
  }
  
  /**
   * Gets voting stats for a proposal
   * @param proposalId Proposal ID
   * @returns Promise resolving to voting stats object
   */
  public async getVotingStats(proposalId: string): Promise<any> {
    return await this.votingContract.getProposalVotingStats(proposalId);
  }
}

export default QGovContract;