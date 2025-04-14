import { ethers } from 'ethers';

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
  contentReference: string;
  proposalId: string;
  approvalDate: string;
  category?: string;
  tags?: string[];
  authorAddress: string;
}

/**
 * Represents a proposal in the qgov system
 */
export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  contentReference: string;
  category: string;
  status: ProposalStatus;
  createdAt: number;
  votingEnds: number;
  votesFor: number;
  votesAgainst: number;
  executed: boolean;
  nftId?: string;
}

export enum ProposalStatus {
  Pending = 'Pending',
  Active = 'Active',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Executed = 'Executed',
  Canceled = 'Canceled'
}

/**
 * Blog NFT entity representing an approved blog
 */
export interface BlogNFT {
  tokenId: string;
  owner: string;
  metadata: BlogNFTMetadata;
  contentReference: string;
  proposalId: string;
  createdAt: number;
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
 * Interface for interacting with the BlogNFT contract
 */
export interface BlogNFTContract {
  getMintedTokens(): Promise<string[]>;
  getTokenMetadata(tokenId: string): Promise<BlogNFTMetadata>;
  mintToken(proposalId: string, contentReference: string, metadata: BlogNFTMetadata): Promise<TransactionStatus>;
  getTokensByOwner(ownerAddress: string): Promise<string[]>;
  ownerOf(tokenId: string): Promise<string>;
  getTokenURI(tokenId: string): Promise<string>;
}

/**
 * Interface for interacting with the qGov contract
 */
export interface QGovContract {
  createProposal(title: string, description: string, contentReference: string, category: string): Promise<TransactionStatus>;
  getProposal(proposalId: string): Promise<Proposal>;
  listProposals(): Promise<Proposal[]>;
  vote(proposalId: string, support: boolean): Promise<TransactionStatus>;
  executeProposal(proposalId: string): Promise<TransactionStatus>;
  getProposalVotes(proposalId: string): Promise<{for: number, against: number}>;
  getVoterStatus(proposalId: string, voter: string): Promise<{hasVoted: boolean, support: boolean}>;
}

/**
 * Common blockchain error types
 */
export enum BlockchainErrorType {
  UserRejected = 'UserRejected',
  NetworkError = 'NetworkError',
  ContractError = 'ContractError',
  UnsupportedNetwork = 'UnsupportedNetwork',
  InsufficientFunds = 'InsufficientFunds',
  Unknown = 'Unknown'
}

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