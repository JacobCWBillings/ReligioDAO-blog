// src/blockchain/utils/proposalUtils.ts
import { Proposal, ProposalStatus } from '../../types/blockchain';

/**
 * Get the display status of a proposal based on its state
 * This function ensures consistent display across the application
 * by accounting for execution status alongside the contract status
 * 
 * @param proposal The proposal object
 * @returns The status to display to users
 */
export const getDisplayStatus = (proposal: Proposal): ProposalStatus => {
  // For proposals that are marked executed, always show "Executed" regardless of status
  if (proposal.executed) {
    return ProposalStatus.Executed;
  }
  
  // For proposals that are approved but not executed, show "Approved" status
  if (proposal.status === ProposalStatus.Approved && !proposal.executed) {
    return ProposalStatus.Approved;
  }
  
  // Otherwise show the actual status from the contract
  return proposal.status;
};

/**
 * Get detailed status information for a proposal
 * @param status The proposal status enum value
 * @returns Object with color, label, and description
 */
export const getStatusInfo = (status: ProposalStatus) => {
  switch (status) {
    case ProposalStatus.Pending:
      return { 
        color: 'yellow', 
        label: 'Pending',
        description: 'Awaiting voting period'
      };
    case ProposalStatus.Active:
      return { 
        color: 'blue', 
        label: 'Active',
        description: 'Voting in progress'
      };
    case ProposalStatus.Approved:
      return { 
        color: 'green', 
        label: 'Approved',
        description: 'Ready for execution'
      };
    case ProposalStatus.Rejected:
      return { 
        color: 'red', 
        label: 'Rejected',
        description: 'Proposal was rejected'
      };
    case ProposalStatus.Executed:
      return { 
        color: 'green', 
        label: 'Executed',
        description: 'Proposal executed successfully'
      };
    case ProposalStatus.Canceled:
      return { 
        color: 'purple', 
        label: 'Canceled',
        description: 'Proposal was canceled'
      };
    default:
      return { 
        color: 'gray', 
        label: 'Unknown',
        description: 'Unknown status'
      };
  }
};

/**
 * Calculate the voting progress percentage
 * @param votesFor Number of votes in favor
 * @param votesAgainst Number of votes against
 * @returns Percentage (0-100) of votes in favor
 */
export const calculateProgress = (votesFor: number, votesAgainst: number): number => {
  const total = votesFor + votesAgainst;
  if (total === 0) return 0;
  return (votesFor / total) * 100;
};

/**
 * Format timestamp as a user-friendly date
 * @param timestamp Timestamp in milliseconds
 * @returns Formatted date string
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format timestamp as relative time (for voting end times)
 * @param timestamp Timestamp in milliseconds
 * @returns Human-readable remaining time
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffInSeconds = Math.floor((timestamp - now) / 1000);
  
  if (diffInSeconds < 0) return 'Ended';
  
  const days = Math.floor(diffInSeconds / 86400);
  const hours = Math.floor((diffInSeconds % 86400) / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m remaining`;
  } else {
    return 'Ending soon';
  }
};

/**
 * Extract blog information from proposal description
 * @param description The proposal description text
 * @returns Object with blog title, category, tags, and author address
 */
export const extractBlogInfo = (description: string) => {
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
};

/**
 * Format a given enum string to be human-readable
 * Converts camelCase or SNAKE_CASE to Title Case with spaces
 * @param enumValue The enum value as a string
 * @returns Formatted string for display
 */
export const formatEnumLabel = (enumValue: string): string => {
  // Handle camelCase
  const withSpaces = enumValue.replace(/([A-Z])/g, ' $1').trim();
  
  // Handle SNAKE_CASE
  const fromSnake = withSpaces.replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  return fromSnake
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};