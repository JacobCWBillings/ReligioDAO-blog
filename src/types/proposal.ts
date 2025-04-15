// src/types/proposal.ts
import { BlogNFTMetadata } from './blockchain';

/**
 * Enum for proposal statuses
 */
export enum ProposalStatus {
  Pending = 'Pending',    // Created but voting hasn't started yet
  Active = 'Active',      // Voting is active
  Approved = 'Approved',  // Voting finished with approval
  Rejected = 'Rejected',  // Voting finished with rejection
  Executed = 'Executed',  // Proposal has been executed (NFT minted)
  Canceled = 'Canceled'   // Proposal was canceled
}

/**
 * Interface representing a governance proposal
 */
export interface Proposal {
  id: string;                    // Unique proposal ID
  title: string;                 // Proposal title
  description: string;           // Proposal description
  proposer: string;              // Address of the proposer
  createdAt: number;             // Timestamp when proposal was created
  votingEnds: number;            // Timestamp when voting ends
  votesFor: number;              // Number of votes in favor
  votesAgainst: number;          // Number of votes against
  status: ProposalStatus;        // Current status of the proposal
  executed: boolean;             // Whether the proposal has been executed
  contentReference?: string;     // Reference to the blog content on Swarm
}

/**
 * Interface for a blog proposal with metadata
 */
export interface BlogProposalWithMetadata extends Proposal {
  metadata: BlogNFTMetadata;    // Metadata for the NFT if minted
}

/**
 * Interface for user's vote on a proposal
 */
export interface ProposalVote {
  proposalId: string;           // ID of the proposal
  voter: string;                // Address of the voter
  support: boolean;             // True for "for", false for "against"
  weight: number;               // Voting power/weight
  timestamp: number;            // When the vote was cast
}