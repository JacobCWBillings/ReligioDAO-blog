import { Article } from '../libetherjot';

/**
 * Extension of the original Etherjot Article type with blockchain-related properties
 */
export interface BlockchainArticle extends Article {
  proposalId?: string;          // ID of the proposal in qgov
  proposalStatus?: string;      // Status of the proposal
  nftTokenId?: string;          // NFT token ID if approved and minted
  authorAddress?: string;       // Author's wallet address
  isNFT?: boolean;              // Flag to indicate if article is represented as NFT
}

/**
 * Represents a blog draft being edited but not yet published or proposed
 */
export interface BlogDraft {
  id: string;
  title: string;
  content: string;
  preview: string;
  banner: string | null;
  category: string;
  tags: string[];
  authorAddress: string;
  lastModified: number;
  isAutoSaved: boolean;
}

/**
 * Represents a blog proposal ready for submission to qgov
 */
export interface BlogProposal {
  title: string;
  content: string;
  contentReference: string;  // Swarm reference to the content
  preview: string;
  banner: string | null;
  category: string;
  tags: string[];
  authorAddress: string;
  description: string;      // Proposal description for voting
}

/**
 * Enum for blog publication status
 */
export enum BlogStatus {
  Draft = 'Draft',               // Saved locally, not published
  ProposalPending = 'Pending',   // Submitted to qgov, awaiting voting
  ProposalActive = 'Voting',     // Actively being voted on
  Approved = 'Approved',         // Approved but not yet minted as NFT
  Published = 'Published',       // Minted as NFT and published
  Rejected = 'Rejected'          // Rejected by DAO vote
}

/**
 * Interface for blog filtering operations
 */
export interface BlogFilter {
  category?: string;
  tag?: string;
  author?: string;
  status?: BlogStatus;
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
  items: BlockchainArticle[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Blog comment interface for decentralized commenting
 */
export interface BlogComment {
  id: string;
  blogId: string;
  author: string;
  content: string;
  timestamp: number;
  replyTo?: string;
}

/**
 * Blog statistics interface
 */
export interface BlogStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}