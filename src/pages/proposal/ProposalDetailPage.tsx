// src/pages/proposal/ProposalDetailPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { Proposal, ProposalStatus } from '../../types/blockchainTypes';
import { BlogProposalMinting } from './components/BlogProposalMinting';
import { services } from '../../swarm/services'; // Use new unified service container
import { formatAddress } from '../../utils/walletUtils';
import './ProposalDetailPage.css';

/**
 * Get status name for a ProposalStatus enum value
 */
const getStatusName = (status: ProposalStatus): string => {
  const statusNames: Record<ProposalStatus, string> = {
    [ProposalStatus.None]: 'None',
    [ProposalStatus.Pending]: 'Pending',
    [ProposalStatus.Rejected]: 'Rejected',
    [ProposalStatus.Accepted]: 'Approved',
    [ProposalStatus.Passed]: 'Passed',
    [ProposalStatus.Executed]: 'Executed',
    [ProposalStatus.Expired]: 'Expired',
    [ProposalStatus.UnderReview]: 'Under Review',
    [ProposalStatus.UnderEvaluation]: 'Under Evaluation'
  };
  return statusNames[status] || 'Unknown';
};

/**
 * Helper function to determine if proposal is actively accepting votes
 */
const isActiveVoting = (proposal: Proposal): boolean => {
  return proposal.status === ProposalStatus.Pending && 
         Date.now() < proposal.votingEnds;
};

export const ProposalDetailPage: React.FC = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const navigate = useNavigate();
  const { getProposalById, voteOnProposal, hasVoted, loading, error } = useProposal();
  const { account, isConnected } = useWallet();
  
  // Basic proposal state
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [userHasVoted, setUserHasVoted] = useState<boolean>(false);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [voteSuccess, setVoteSuccess] = useState<boolean>(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Content preview state
  const [proposalContent, setProposalContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [contentError, setContentError] = useState<string | null>(null);
  
  // NFT token ID after execution
  const [nftTokenId, setNftTokenId] = useState<string | null>(null);
  
  // Content expansion state
  const [showFullContent, setShowFullContent] = useState<boolean>(false);
  
  // Execution success notification
  const [showExecutionSuccess, setShowExecutionSuccess] = useState<boolean>(false);

  const contractProposalId = proposalId;

  /**
   * Load proposal data
   */
  useEffect(() => {
    const loadProposal = async () => {
      if (!contractProposalId) {
        console.error('No proposal ID provided');
        return;
      }
      
      try {
        console.log(`Loading proposal: ID ${contractProposalId}`);
        
        const proposalData = await getProposalById(contractProposalId);
        if (proposalData) {
          setProposal(proposalData);
          
          console.log('Proposal loaded:', {
            proposalId: contractProposalId,
            status: proposalData.status,
            statusName: getStatusName(proposalData.status),
            hasContentReference: !!proposalData.contentReference
          });
          
        } else {
          console.warn(`No proposal found for ID ${contractProposalId}`);
        }
      } catch (err) {
        console.error('Error loading proposal:', err);
      }
    };
    
    loadProposal();
  }, [contractProposalId, getProposalById]);

  /**
   * Fetch proposal content using new ContentService
   */
  const fetchProposalContent = async (contentReference: string) => {
    if (!contentReference || contentReference.trim() === '') {
      setContentError('Content reference not found in proposal data');
      return;
    }
    
    setContentLoading(true);
    setContentError(null);
    
    try {
      console.log(`Fetching proposal content for reference: ${contentReference}`);
      
      // Validate content reference format
      if (!/^[a-fA-F0-9]{64}$/.test(contentReference.trim())) {
        throw new Error(`Invalid content reference format: ${contentReference}`);
      }
      
      // Use the new ContentService with proper error handling
      const html = await services.content.getContentAsHtml(contentReference);
      
      if (!html || html.trim() === '') {
        throw new Error('Retrieved empty content from Swarm');
      }
      
      setProposalContent(html);
      setContentError(null);
      console.log('Successfully retrieved proposal content');
      
    } catch (err) {
      console.error('Error fetching proposal content:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('Invalid content reference')) {
        setContentError('The content reference appears to be invalid. This proposal may have corrupted data.');
      } else if (errorMessage.includes('Failed to download from all gateways')) {
        setContentError('Unable to access content. The Swarm network may be unavailable.');
      } else {
        setContentError(`Failed to load content: ${errorMessage}`);
      }
    } finally {
      setContentLoading(false);
    }
  };

  /**
   * Fetch content when proposal loads
   */
  useEffect(() => {
    if (proposal?.contentReference) {
      console.log('Proposal has content reference, fetching content...');
      fetchProposalContent(proposal.contentReference);
    } else if (proposal) {
      console.log('Proposal loaded but no content reference found');
    }
  }, [proposal]);
  
  /**
   * Check if the user has already voted
   */
  useEffect(() => {
    const checkVoteStatus = async () => {
      if (!contractProposalId || !account || !isConnected) return;
      
      try {
        const voted = await hasVoted(contractProposalId);
        setUserHasVoted(voted);
      } catch (err) {
        console.error('Error checking vote status:', err);
      }
    };
    
    checkVoteStatus();
  }, [contractProposalId, account, isConnected, hasVoted]);
  
  /**
   * Handle voting
   */
  const handleVote = async (support: boolean) => {
    if (!contractProposalId || !isConnected) return;
    
    setIsVoting(true);
    setVoteError(null);
    
    try {
      const result = await voteOnProposal(contractProposalId, support);
      
      if (result.status === 'confirmed') {
        setVoteSuccess(true);
        setUserHasVoted(true);
        
        // Refresh proposal data
        const updatedProposal = await getProposalById(contractProposalId);
        if (updatedProposal) {
          setProposal(updatedProposal);
        }
      } else {
        setVoteError('Vote transaction failed to confirm. Please try again.');
      }
    } catch (err) {
      console.error('Error voting on proposal:', err);
      setVoteError(err instanceof Error ? err.message : 'Failed to vote on proposal');
    } finally {
      setIsVoting(false);
    }
  };

  /**
   * Handle content refresh
   */
  const handleRefreshContent = async () => {
    if (!proposal?.contentReference) return;
    
    try {
      setContentLoading(true);
      setContentError(null);
      
      // Force refresh using new service method
      const html = await services.content.forceRefreshContent(proposal.contentReference);
      setProposalContent(html);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setContentError(`Refresh failed: ${errorMessage}`);
    } finally {
      setContentLoading(false);
    }
  };

  /**
   * Format relative time
   */
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff < 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  /**
   * Get status display info
   */
  const getStatusInfo = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.Pending:
        return { color: '#2196f3', label: 'Active', description: 'Currently accepting votes' };
      case ProposalStatus.Accepted:
        return { color: '#4caf50', label: 'Approved', description: 'Proposal approved, ready for execution' };
      case ProposalStatus.Executed:
        return { color: '#9c27b0', label: 'Executed', description: 'Proposal has been executed' };
      case ProposalStatus.Rejected:
        return { color: '#f44336', label: 'Rejected', description: 'Proposal was rejected by voters' };
      case ProposalStatus.Expired:
        return { color: '#607d8b', label: 'Expired', description: 'Proposal voting period has expired' };
      default:
        return { color: 'gray', label: 'Unknown', description: 'Unknown status' };
    }
  };
  
  /**
   * Calculate voting progress
   */
  const calculateProgress = (votesFor: number, votesAgainst: number) => {
    const total = votesFor + votesAgainst;
    if (total === 0) return 0;
    return (votesFor / total) * 100;
  };
  
  /**
   * Extract blog information from proposal description
   */
  const extractBlogInfo = () => {
    if (!proposal) return { blogTitle: '', category: '', tags: [], authorAddress: '' };
    
    try {
      const lines = proposal.description.split('\n');
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
  
  // Handle invalid proposal
  if (!contractProposalId) {
    return (
      <div className="error-container">
        <h2>Invalid Proposal ID</h2>
        <p>No proposal ID provided.</p>
        <Link to="/proposals" className="back-link">Back to Proposals</Link>
      </div>
    );
  }
  
  if (loading) {
    return <div className="loading-indicator">Loading proposal...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Proposal</h2>
        <p>{error.message}</p>
        <Link to="/proposals" className="back-link">Back to Proposals</Link>
      </div>
    );
  }
  
  if (!proposal) {
    return (
      <div className="error-container">
        <h2>Proposal Not Found</h2>
        <p>The proposal you are looking for does not exist or has been removed.</p>
        <Link to="/proposals" className="back-link">Back to Proposals</Link>
      </div>
    );
  }
  
  const statusInfo = getStatusInfo(proposal.status);
  const progress = calculateProgress(proposal.votesFor, proposal.votesAgainst);
  const isActive = isActiveVoting(proposal);
  const canExecute = proposal.status === ProposalStatus.Accepted && isConnected && !proposal.executed;
  const blogInfo = extractBlogInfo();

  return (
    <div className="proposal-detail-page">
      {/* Execution Success Notification */}
      {showExecutionSuccess && (
        <div className="execution-success-banner">
          <div className="success-content">
            <span className="success-icon">🎉</span>
            <span>Proposal executed successfully!</span>
            {nftTokenId && (
              <Link to={`/blog/${nftTokenId}`} className="view-blog-link">
                View Blog NFT #{nftTokenId}
              </Link>
            )}
            <button 
              onClick={() => setShowExecutionSuccess(false)}
              className="close-banner-btn"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="proposal-content">
        {/* Header Section */}
        <div className="proposal-header">
          <div className="breadcrumb">
            <Link to="/proposals">Proposals</Link> / Proposal #{proposal.id}
          </div>
          
          <div className="proposal-title-section">
            <h1 className="proposal-title">{proposal.title}</h1>
            <div className="proposal-meta">
              <span 
                className="status-badge" 
                style={{ backgroundColor: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              <span className="proposal-id">#{proposal.id}</span>
            </div>
          </div>
        </div>

        {/* Content Preview Section */}
        {proposal.contentReference && (
          <div className="content-preview-section">
            <h3>Blog Content Preview</h3>
            {contentLoading ? (
              <div className="content-loading">
                <div className="loading-spinner"></div>
                <p>Loading blog content...</p>
              </div>
            ) : contentError ? (
              <div className="content-error">
                <h4>Content Loading Error</h4>
                <p>{contentError}</p>
                <div className="error-actions">
                  <button onClick={handleRefreshContent} className="retry-button">
                    Retry Loading
                  </button>
                  {proposal.contentReference && (
                    <div className="content-reference-info">
                      <p>Content Reference: <code>{proposal.contentReference}</code></p>
                      <p>
                        View on Swarm:
                        <a 
                          href={services.swarm.getContentUrl(proposal.contentReference, {
                            usePublicGateway: true,
                            forWebDisplay: true
                          })}
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ marginLeft: '5px' }}
                        >
                          Open in Browser
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : proposalContent ? (
              <div className="content-preview">
                <div 
                  className={`blog-content-preview ${showFullContent ? 'expanded' : 'collapsed'}`}
                  dangerouslySetInnerHTML={{ __html: proposalContent }}
                />
                <button 
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="toggle-content-btn"
                >
                  {showFullContent ? 'Show Less' : 'Show More'}
                </button>
              </div>
            ) : (
              <div className="no-content">
                <p>No content preview available.</p>
              </div>
            )}
          </div>
        )}

        {/* Voting Section */}
        <div className="voting-section">
          <div className="voting-stats">
            <div className="vote-counts">
              <div className="vote-count for">
                <span className="count">{proposal.votesFor}</span>
                <span className="label">For</span>
              </div>
              <div className="vote-count against">
                <span className="count">{proposal.votesAgainst}</span>
                <span className="label">Against</span>
              </div>
            </div>
            
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="progress-text">
              {progress.toFixed(1)}% in favor
            </div>
          </div>

          {/* Voting Actions */}
          {isActive && isConnected && !userHasVoted && (
            <div className="voting-actions">
              <h4>Cast Your Vote</h4>
              <div className="vote-buttons">
                <button 
                  onClick={() => handleVote(true)}
                  disabled={isVoting}
                  className="vote-btn vote-for"
                >
                  {isVoting ? 'Voting...' : 'Vote For'}
                </button>
                <button 
                  onClick={() => handleVote(false)}
                  disabled={isVoting}
                  className="vote-btn vote-against"
                >
                  {isVoting ? 'Voting...' : 'Vote Against'}
                </button>
              </div>
              {voteError && (
                <div className="vote-error">{voteError}</div>
              )}
            </div>
          )}

          {userHasVoted && (
            <div className="voted-notice">
              <span className="voted-icon">✓</span>
              You have already voted on this proposal.
            </div>
          )}

          {!isConnected && (
            <div className="connect-wallet-notice">
              <p>Connect your wallet to vote on this proposal.</p>
            </div>
          )}
        </div>

        {/* Proposal Details */}
        <div className="proposal-details">
          <h3>Proposal Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <div className="detail-label">Status</div>
              <div className="detail-value">
                <span 
                  className="status-indicator" 
                  style={{ backgroundColor: statusInfo.color }}
                ></span>
                {statusInfo.description}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Voting Ends</div>
              <div className="detail-value">
                {isActive ? formatRelativeTime(proposal.votingEnds) : 'Ended'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Proposer</div>
              <div className="detail-value address">{formatAddress(proposal.proposer, 6, 4)}</div>
            </div>
            {proposal.contentReference && (
              <div className="detail-item">
                <div className="detail-label">Content Ref</div>
                <div className="detail-value content-ref">
                  {proposal.contentReference.substring(0, 10)}...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Execution Section */}
        {canExecute && (
          <div className="execution-section">
            <BlogProposalMinting 
              proposalId={proposal.id}
              proposal={proposal}
              onExecuteSuccess={(tokenId: string | null) => {
                setNftTokenId(tokenId);
                setShowExecutionSuccess(true);
                // Refresh proposal to update status
                getProposalById(contractProposalId).then(updated => {
                  if (updated) setProposal(updated);
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalDetailPage;