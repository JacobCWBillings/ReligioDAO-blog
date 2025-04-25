// src/types/proposal.ts
import { ProposalStatus, BlogNFTMetadata, Proposal, ProposalVote, BlogProposalWithMetadata } from './blockchain';

// Export the types to maintain backward compatibility while avoiding duplication
export { ProposalStatus };
export type { Proposal, ProposalVote, BlogProposalWithMetadata };

// This file now serves as a re-export to maintain existing imports
// while consolidating type definitions in blockchain.ts