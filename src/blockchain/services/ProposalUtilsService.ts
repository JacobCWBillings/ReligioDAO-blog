// src/blockchain/services/ProposalUtilsService.ts
import { 
    Proposal, 
    ProposalStatus, 
    BlogNFTMetadata 
  } from '../../types/blockchain';
  import { toNumber, blockchainTimeToJsTime } from '../utils/blockchainUtils';
  import { extractContentReference } from '../utils/contentHash';
  
  /**
   * Service for proposal utility functions
   * Handles ID conversion, status mapping, and data formatting
   */
  export class ProposalUtilsService {
    /**
     * Convert UI proposal ID (1-based) to blockchain proposal ID (0-based)
     * This is needed because the UI displays proposal IDs starting from 1,
     * but the blockchain uses 0-based indexing.
     * 
     * @param uiProposalId UI proposal ID (1-based, as displayed to users)
     * @returns Blockchain proposal ID (0-based, as expected by the contract)
     */
    public uiToBlockchainProposalId(uiProposalId: string): string {
      // Convert to number, subtract 1, convert back to string
      const uiId = parseInt(uiProposalId, 10);
      
      // If it's not a valid number, return as is
      if (isNaN(uiId)) {
        console.warn(`Invalid UI proposal ID: ${uiProposalId}`);
        return uiProposalId;
      }
      
      // Subtract 1 to get blockchain ID (0-based)
      const blockchainId = Math.max(0, uiId - 1);
      return blockchainId.toString();
    }
  
    /**
     * Convert blockchain proposal ID (0-based) to UI proposal ID (1-based)
     * This is needed because the blockchain uses 0-based indexing,
     * but the UI displays proposal IDs starting from 1.
     * 
     * @param blockchainProposalId Blockchain proposal ID (0-based, from contract)
     * @returns UI proposal ID (1-based, for display to users)
     */
    public blockchainToUiProposalId(blockchainProposalId: string): string {
      // Convert to number, add 1, convert back to string
      const blockchainId = parseInt(blockchainProposalId, 10);
      
      // If it's not a valid number, return as is
      if (isNaN(blockchainId)) {
        console.warn(`Invalid blockchain proposal ID: ${blockchainProposalId}`);
        return blockchainProposalId;
      }
      
      // Add 1 to get UI ID (1-based)
      const uiId = blockchainId + 1;
      return uiId.toString();
    }
  
    /**
     * Map contract status number to ProposalStatus enum
     * 
     * @param status Status number from contract
     * @returns ProposalStatus enum value
     */
    public mapContractStatusToEnum(status: number): ProposalStatus {
      switch (status) {
        case 0:
          return ProposalStatus.Pending;
        case 1:
          return ProposalStatus.Active;
        case 2:
          return ProposalStatus.Approved;
        case 3:
          return ProposalStatus.Rejected;
        case 4:
          return ProposalStatus.Executed;
        case 5:
          return ProposalStatus.Canceled;
        default:
          return ProposalStatus.Pending;
      }
    }
  
    /**
     * Extract blog information from proposal description
     * 
     * @param description Proposal description text
     * @returns Object with blog title, category, tags, and author address
     */
    public extractBlogInfo(description: string): {
      blogTitle: string;
      category: string;
      tags: string[];
      authorAddress: string;
    } {
      try {
        const lines = description.split('\n');
        const blogTitle = lines.find(line => 
          line.trim().startsWith('Blog:'))?.replace('Blog:', '').trim() || '';
        const category = lines.find(line => 
          line.trim().startsWith('Category:'))?.replace('Category:', '').trim() || '';
        const tags = lines.find(line => 
          line.trim().startsWith('Tags:'))?.replace('Tags:', '').trim().split(',').map(tag => tag.trim()) || [];
        const authorAddress = lines.find(line => 
          line.trim().startsWith('Author:'))?.replace('Author:', '').trim() || '';
        
        return { blogTitle, category, tags, authorAddress };
      } catch (e) {
        return { blogTitle: '', category: '', tags: [], authorAddress: '' };
      }
    }
  
    /**
     * Convert raw proposal data from contract to Proposal type
     * 
     * @param rawProposal Raw proposal data from contract
     * @param statusNum Status number from contract
     * @param proposalId UI proposal ID (1-based)
     * @returns Proposal object
     */
    public formatProposal(rawProposal: any, statusNum: number, proposalId: string): Proposal {
      // Extract content reference from calldata
      const contentReference = extractContentReference(rawProposal.callData);
      
      // Convert timestamps to milliseconds
      const createdAt = blockchainTimeToJsTime(rawProposal.params.votingStartTime);
      const votingEnds = blockchainTimeToJsTime(rawProposal.params.votingEndTime);
      
      // Map to Proposal type
      return {
        id: proposalId, // This is the UI-facing ID (1-based)
        title: rawProposal.remark || "Blog Proposal",
        description: rawProposal.remark || "",
        proposer: rawProposal.target,
        status: this.mapContractStatusToEnum(statusNum),
        createdAt,
        votingEnds,
        votesFor: toNumber(rawProposal.counters.votedFor),
        votesAgainst: toNumber(rawProposal.counters.votedAgainst),
        executed: rawProposal.executed,
        contentReference
      };
    }
  
    /**
     * Create a description for blog minting proposal
     * 
     * @param title Blog title
     * @param authorAddress Author's address
     * @param category Blog category
     * @param tags Blog tags
     * @param contentReference Content reference
     * @param description Additional description
     * @returns Formatted proposal description
     */
    public createProposalDescription(
      title: string,
      authorAddress: string,
      category: string,
      tags: string[] | string,
      contentReference: string,
      description: string
    ): string {
      // Format tags if they're an array
      const tagsStr = Array.isArray(tags) ? tags.join(', ') : tags;
      
      // Create a human-readable proposal description
      return `
  Blog: ${title}
  Author: ${authorAddress}
  Category: ${category}
  Tags: ${tagsStr}
  Content Reference: ${contentReference}
  
  ${description}
      `.trim();
    }


/**
 * Check if a proposal matches the target voting situation
 * 
 * @param rawProposal Raw proposal data from contract
 * @param targetVotingSituation Voting situation name from config
 * @returns Boolean indicating if the proposal matches the target situation
 */
public doesProposalMatchVotingSituation(
  rawProposal: any,
  targetVotingSituation?: string
): boolean {
  // If no target voting situation is provided, accept all proposals
  if (!targetVotingSituation) {
    return true;
  }
  
  // Check if the proposal's related voting situation matches the target
  return rawProposal.relatedVotingSituation === targetVotingSituation;
}

/**
 * Filter an array of raw proposals by voting situation
 * 
 * @param rawProposals Array of raw proposals from contract
 * @param targetVotingSituation Voting situation name from config
 * @returns Filtered array of proposals
 */
public filterProposalsByVotingSituation(
  rawProposals: any[],
  targetVotingSituation?: string
  ): any[] {
    if (!targetVotingSituation) {
      console.warn('No target voting situation provided, returning all proposals');
      return rawProposals;
    }
    
    return rawProposals.filter(proposal => 
      this.doesProposalMatchVotingSituation(proposal, targetVotingSituation)
    );
  }
}

  