// src/components/proposal/ProposalCard.tsx - Complete component with 0-based indexing fix
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Proposal, ProposalStatus } from '../../types/blockchain';
import { formatAddress } from '../../blockchain/utils/walletUtils';
import './ProposalCard.css';

interface ProposalCardProps {
  proposal: Proposal;
  showVotingProgress?: boolean;
  compact?: boolean;
  needsAttention?: boolean;
  className?: string;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  showVotingProgress = true,
  compact = false,
  needsAttention = false,
  className = '',
}) => {
  // CORRECTED: Always use Q contract status as source of truth
  const displayStatus = useMemo(() => proposal.status, [proposal]);

  // Helper function to determine if proposal is actively accepting votes
  const isActiveVoting = (proposal: Proposal): boolean => {
    return proposal.status === ProposalStatus.Pending && 
           Date.now() < proposal.votingEnds;
  };

  // Get status color, label and additional information
  const getStatusInfo = (status: ProposalStatus, proposal: Proposal) => {
    // Check if this is an active voting period
    if (status === ProposalStatus.Pending && isActiveVoting(proposal)) {
      return { 
        color: 'blue', 
        label: 'Active Voting',
        description: 'Voting in progress'
      };
    }

    switch (status) {
      case ProposalStatus.None:
        return { 
          color: 'gray', 
          label: 'None',
          description: 'Initial state'
        };
      case ProposalStatus.Pending:
        return { 
          color: 'yellow', 
          label: 'Pending',
          description: 'Awaiting voting period'
        };
      case ProposalStatus.Rejected:
        return { 
          color: 'red', 
          label: 'Rejected',
          description: 'Rejected by community vote'
        };
      case ProposalStatus.Accepted:
        return { 
          color: 'green', 
          label: 'Approved',
          description: 'Ready for execution'
        };
      case ProposalStatus.Passed:
        return { 
          color: 'green', 
          label: 'Passed',
          description: 'Alternative approval state'
        };
      case ProposalStatus.Executed:
        return { 
          color: 'green', 
          label: 'Executed',
          description: 'NFT minted by Q governance'
        };
      case ProposalStatus.Expired:
        return { 
          color: 'purple', 
          label: 'Expired',
          description: 'Voting period expired'
        };
      case ProposalStatus.UnderReview:
        return { 
          color: 'blue', 
          label: 'Under Review',
          description: 'Proposal under review'
        };
      case ProposalStatus.UnderEvaluation:
        return { 
          color: 'blue', 
          label: 'Under Evaluation',
          description: 'Proposal under evaluation'
        };
      default:
        return { 
          color: 'gray', 
          label: 'Unknown',
          description: 'Unknown status'
        };
    }
  };

  // Calculate voting progress percentage
  const calculateProgress = (votesFor: number, votesAgainst: number) => {
    const total = votesFor + votesAgainst;
    if (total === 0) return 0;
    return (votesFor / total) * 100;
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format relative time for voting end
  const formatRelativeTime = (timestamp: number) => {
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

  // Get formatted quorum percentage
  const getQuorumPercentage = (): string => {
    // This would typically come from blockchain data
    // For now we'll use a default of 50%
    return "50%";
  };

  // Calculate left % for quorum progress bar
  const getQuorumLeft = (): string => {
    const votesTotal = proposal.votesFor + proposal.votesAgainst;
    // If we had the total supply, we could calculate this
    // For now, we'll use 0% for simplicity
    return "0%";
  };

  // Extract blog information from proposal description
  const getBlogInfo = () => {
    try {
      const lines = proposal.description.split('\n');
      const blogTitle = lines.find(line => 
        line.trim().startsWith('Blog:'))?.replace('Blog:', '').trim() || '';
      const category = lines.find(line => 
        line.trim().startsWith('Category:'))?.replace('Category:', '').trim() || '';
      const tags = lines.find(line => 
        line.trim().startsWith('Tags:'))?.replace('Tags:', '').trim().split(',').map(tag => tag.trim()) || [];
      
      return { blogTitle, category, tags };
    } catch (e) {
      return { blogTitle: '', category: '', tags: [] };
    }
  };

  const statusInfo = getStatusInfo(displayStatus, proposal);
  const progressPercentage = calculateProgress(proposal.votesFor, proposal.votesAgainst);
  const blogInfo = getBlogInfo();
  const isActive = isActiveVoting(proposal);
  
  // SIMPLIFIED: Use proposal.id directly (0-based indexing)
  return (
    <Link 
      to={`/proposals/${proposal.id}`}
      className={`proposal-card ${needsAttention ? 'needs-attention' : ''} ${className}`}
    >
      <div className="proposal-card-header">
        <div className="proposal-card-title-container">
          <h3 className="proposal-card-title">
            {blogInfo.blogTitle || proposal.title || 'Untitled Blog Proposal'}
          </h3>
          {!compact && proposal.title && blogInfo.blogTitle !== proposal.title && (
            <div className="proposal-card-subtitle">{proposal.title}</div>
          )}
        </div>
        <div className={`proposal-card-status status-${statusInfo.color}`}>
          {statusInfo.label}
        </div>
      </div>

      {!compact && (
        <div className="proposal-card-metadata">
          <div className="proposal-card-info">
            <span className="proposal-card-label">Quorum {getQuorumPercentage()}</span>
            <span className="proposal-card-label">
              {isActive ? 
                formatRelativeTime(proposal.votingEnds) : 
                `Voting ended ${formatDate(proposal.votingEnds)}`
              }
            </span>
          </div>
          
          {blogInfo.category && (
            <div className="proposal-card-category">
              {blogInfo.category}
              {blogInfo.tags.length > 0 && (
                <div className="proposal-card-tags">
                  {blogInfo.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="proposal-card-tag">{tag}</span>
                  ))}
                  {blogInfo.tags.length > 3 && (
                    <span className="proposal-card-tag">+{blogInfo.tags.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showVotingProgress && (
        <div className="proposal-card-voting">
          <div className="proposal-card-quorum">
            <div className="proposal-card-progress-label">
              <span>Quorum {getQuorumPercentage()}</span>
              <span>{getQuorumLeft()} left</span>
            </div>
            <div className="proposal-card-progress-bar">
              <div 
                className="proposal-card-progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="proposal-card-votes">
            <div className="proposal-card-vote proposal-card-vote-yes">
              <span>Yes</span>
              <span>{progressPercentage.toFixed(0)}%</span>
              <span>{proposal.votesFor}</span>
            </div>
            <div className="proposal-card-vote proposal-card-vote-no">
              <span>No</span>
              <span>{(100 - progressPercentage).toFixed(0)}%</span>
              <span>{proposal.votesAgainst}</span>
            </div>
          </div>
        </div>
      )}

      <div className="proposal-card-footer">
        <div className="proposal-card-proposer">
          By: {formatAddress(proposal.proposer, 6, 4)}
        </div>
        <div className="proposal-card-date">
          {formatDate(proposal.createdAt)}
        </div>
        
        {/* CORRECTED: Call-to-action hints based on Q contract status */}
        {isActive && (
          <div className="proposal-card-action-hint">Click to vote</div>
        )}
        {displayStatus === ProposalStatus.Accepted && (
          <div className="proposal-card-action-hint">Ready to execute</div>
        )}
        {displayStatus === ProposalStatus.Executed && (
          <div className="proposal-card-action-hint">NFT minted</div>
        )}
      </div>
    </Link>
  );
};

export default ProposalCard;