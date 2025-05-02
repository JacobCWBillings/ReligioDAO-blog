  // src/components/proposal/ProposalCard.tsx
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
  // Calculate displayed status based on contract state and execution status
  const displayStatus = useMemo(() => {
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
  }, [proposal]);

  // Get status color, label and additional information
  const getStatusInfo = (status: ProposalStatus) => {
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
    return "50 %";
  };

  // Calculate left % for quorum progress bar
  const getQuorumLeft = (): string => {
    const votesTotal = proposal.votesFor + proposal.votesAgainst;
    // If we had the total supply, we could calculate this
    // For now, we'll use 0% for simplicity
    return "0 %";
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

  const statusInfo = getStatusInfo(displayStatus);
  const progressPercentage = calculateProgress(proposal.votesFor, proposal.votesAgainst);
  const blogInfo = getBlogInfo();
  
  return (
    <Link 
      to={`/proposals/${proposal.id}`}
      className={`proposal-card ${needsAttention ? 'needs-attention' : ''} ${className}`}
    >
      <div className="proposal-card-header">
        <div className="proposal-card-title-container">
          <h3 className="proposal-card-title">
            {compact ? `Proposal ${proposal.id}` : proposal.title}
          </h3>
          {!compact && blogInfo.blogTitle && (
            <div className="proposal-card-subtitle">
              Blog: {blogInfo.blogTitle}
            </div>
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
              {displayStatus === ProposalStatus.Active ? 
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
              <div className="proposal-card-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>
          
          <div className="proposal-card-votes">
            <div className="proposal-card-vote proposal-card-vote-yes">
              <span>Yes</span>
              <span>{progressPercentage.toFixed(0)} %</span>
              <span>{proposal.votesFor}</span>
            </div>
            <div className="proposal-card-vote proposal-card-vote-no">
              <span>No</span>
              <span>{(100 - progressPercentage).toFixed(0)} %</span>
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
        
        {/* Call-to-action hints based on status */}
        {displayStatus === ProposalStatus.Active && (
          <div className="proposal-card-action-hint">Click to vote</div>
        )}
        {displayStatus === ProposalStatus.Approved && !proposal.executed && (
          <div className="proposal-card-action-hint">Ready to execute</div>
        )}
        {displayStatus === ProposalStatus.Executed && (
          <div className="proposal-card-action-hint">View blog post</div>
        )}
      </div>
    </Link>
  );
};

// export default ProposalCard;