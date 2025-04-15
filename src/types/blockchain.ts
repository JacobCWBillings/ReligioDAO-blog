// src/types/blockchain.ts

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
  contentReference: string;    // Swarm reference to the blog content
  proposalId: string;          // ID of the governance proposal that approved this blog
  approvalDate: string;        // ISO date string when the blog was approved
  category?: string;           // Blog category
  tags?: string[];             // Array of tags associated with the blog
  authorAddress: string;       // Ethereum address of the author
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