// src/types/blockchain.ts
import { ethers } from 'ethers';

/**
 * Enum for proposal statuses
 * Used across the application for consistent status representation
 */
/**
 * CORRECTED: Q Governance ProposalStatus enum mapping
 * This matches the actual Q governance contract status values
 */
export enum ProposalStatus {
  None = 0,              // Initial/empty state
  Pending = 1,           // Created but voting hasn't started yet
  Rejected = 2,          // Voting finished with rejection
  Accepted = 3,          // Voting finished with approval - ready for execution
  Passed = 4,            // Alternative approval state (need to clarify difference with Accepted)
  Executed = 5,          // Proposal has been executed
  Expired = 6,           // Proposal voting period expired
  UnderReview = 7,       // Proposal is under review
  UnderEvaluation = 8    // Proposal is under evaluation
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
 * Blog NFT Metadata structure for NFT representation of approved blogs
 */
export interface BlogNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: NFTAttribute[];
  properties: BlogProperties;
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface BlogProperties {
  contentReference: string;    // Swarm reference to the blog content
  proposalId?: string;         // ID of the governance proposal that approved this blog
  approvalDate: string;        // ISO date string when the blog was approved
  category?: string;           // Blog category
  tags?: string[];             // Array of tags associated with the blog
  authorAddress: string;       // Ethereum address of the author
}

/**
 * Represents a blog proposal ready for submission to governance
 */
export interface BlogProposal {
  title: string;               // Blog post title
  content: string;             // Markdown content of the blog
  contentReference: string;    // Swarm reference to the content
  preview: string;             // Short preview text of the blog
  banner: string | null;       // Optional banner image reference
  category: string;            // Blog category
  tags: string[];              // Array of blog tags
  authorAddress: string;       // Author's Ethereum address
  description: string;         // Proposal description for voting
}

/**
 * Interface for a blog proposal with metadata
 */
export interface BlogProposalWithMetadata extends Proposal {
  metadata: BlogNFTMetadata;    // Metadata for the NFT if minted
}

/**
 * Blog NFT entity representing an approved blog
 */
export interface BlogNFT {
  tokenId: string;                  // The NFT token ID
  owner: string;                    // Current owner of the NFT
  metadata: BlogNFTMetadata;        // The metadata associated with the NFT
  contentReference: string;         // Swarm reference to the blog content
  proposalId: string;               // ID of the governance proposal
  createdAt: number;                // Timestamp when the blog was created/approved
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

/**
 * Transaction status tracking
 */
export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  error?: Error;
  receipt?: ethers.TransactionReceipt;
}

/**
 * Interface for blog filtering operations
 */
export interface BlogFilter {
  category?: string;
  tag?: string;
  author?: string;
  status?: string;
  searchTerm?: string;
  fromDate?: number;
  toDate?: number;
}

/**
 * Interface for blog sorting operations
 */
export interface BlogSort {
  field: 'createdAt' | 'title' | 'category' | 'votes';
  direction: 'asc' | 'desc';
}

/**
 * Interface for paginated blog results
 */
export interface PaginatedBlogs {
  items: BlogNFT[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Common blockchain error types
 */
export enum BlockchainErrorType {
  UserRejected = 'UserRejected',     // User rejected transaction in wallet
  NetworkError = 'NetworkError',      // Network connection issues
  ContractError = 'ContractError',    // Smart contract errors or reverts
  UnsupportedNetwork = 'UnsupportedNetwork', // Wrong network/chain
  InsufficientFunds = 'InsufficientFunds',   // Not enough funds for transaction
  GasLimitExceeded = 'GasLimitExceeded',     // Gas limit issues
  NonceError = 'NonceError',                 // Transaction nonce problems
  Timeout = 'Timeout',                       // Transaction timeout
  Unknown = 'Unknown'                        // Unclassified errors
}

/**
 * Custom error class for blockchain-related errors
 * Provides standardized error handling across the application
 */
export class BlockchainError extends Error {
  type: BlockchainErrorType;
  originalError?: Error;
  
  constructor(message: string, type: BlockchainErrorType, originalError?: Error) {
    super(message);
    this.name = 'BlockchainError';
    this.type = type;
    this.originalError = originalError;
  }
}