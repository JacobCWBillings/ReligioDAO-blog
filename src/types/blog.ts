// src/types/blog.ts
import { Article } from '../libetherjot';
import { ProposalStatus } from './blockchain';

/**
 * Extension of the original Etherjot Article type with blockchain-related properties
 * Brings together the DAO and NFT concepts for blog posts
 */
export interface BlockchainArticle extends Article {
  proposalId?: string;          // ID of the proposal in qgov
  proposalStatus?: ProposalStatus; // Status of the proposal (using standardized enum)
  nftTokenId?: string;          // NFT token ID if approved and minted
  authorAddress?: string;       // Author's wallet address
  isNFT?: boolean;              // Flag to indicate if article is represented as NFT
  contentReference?: string;    // Swarm reference to the content
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
 * For blog posts imported from blockchain/NFTs - maps to BlockchainArticle
 */
export function mapNFTToBlockchainArticle(
  nft: any, 
  content: string
): BlockchainArticle {
  // Extract basic properties from NFT metadata
  const { metadata, tokenId, proposalId } = nft;
  const { name, description, image, properties } = metadata;
  
  // Convert tags from NFT format to article format
  const tags = Array.isArray(properties.tags) ? properties.tags : [];
  
  // Map to BlockchainArticle structure
  return {
    title: name,
    html: content, // The full HTML content
    markdown: '', // We typically don't store the markdown in NFT metadata
    createdAt: new Date(properties.approvalDate).getTime(), // Convert ISO date to timestamp
    tags,
    path: `blogs/${tokenId}`, // Virtual path for routing
    category: properties.category || 'Uncategorized',
    banner: image || '',   // Make sure this is a string, not null
    commentsFeed: '', // Comments not supported in this version
    kind: 'regular', // Default kind
    stamp: '', // Required by Article interface
    preview: description || 'No description available', // Set preview from description
    nftTokenId: tokenId,
    proposalId,
    authorAddress: properties.authorAddress,
    isNFT: true,
    contentReference: properties.contentReference,
    proposalStatus: ProposalStatus.Executed // Since it's an NFT, the proposal was executed
  };
}

/**
 * Enum for blog publication status
 * Uses ProposalStatus enum but adds Draft state for local drafts
 */
export enum BlogStatus {
  Draft = 'Draft',               // Saved locally, not published
  ProposalPending = 'Pending',   // Submitted to qgov, awaiting voting
  ProposalActive = 'Active',     // Actively being voted on
  Approved = 'Approved',         // Approved but not yet minted as NFT
  Published = 'Published',       // Minted as NFT and published
  Rejected = 'Rejected'          // Rejected by DAO vote
}

/**
 * Converts ProposalStatus to BlogStatus
 */
export function mapProposalStatusToBlogStatus(status: ProposalStatus): BlogStatus {
  switch (status) {
    case ProposalStatus.Pending:
      return BlogStatus.ProposalPending;
    case ProposalStatus.Active:
      return BlogStatus.ProposalActive;
    case ProposalStatus.Approved:
      return BlogStatus.Approved;
    case ProposalStatus.Rejected:
      return BlogStatus.Rejected;
    case ProposalStatus.Executed:
      return BlogStatus.Published;
    case ProposalStatus.Canceled:
      return BlogStatus.Rejected;
    default:
      return BlogStatus.Draft;
  }
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