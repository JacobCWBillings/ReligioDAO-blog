// src/pages/proposal/ProposalDetailPage.tsx - Complete corrected version
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { Proposal, ProposalStatus } from '../../types/blockchain';
import { BlogProposalMinting } from '../../components/proposal/BlogProposalMinting';
import swarmContentService from '../../services/SwarmContentService';
import { formatAddress } from '../../blockchain/utils/walletUtils';
import './ProposalDetailPage.css';

/**
 * Get the display status - always use Q contract status as source of truth
 */
const getDisplayStatus = (proposal: Proposal | null): ProposalStatus | null => {
  if (!proposal) return null;
  
  // CORRECTED: Always use Q contract status as source of truth
  return proposal.status;
};

/**
 * Get status name for a ProposalStatus enum value
 */
const getStatusName = (status: ProposalStatus): string => {
  const statusNames: Record<ProposalStatus, string> = {
    [ProposalStatus.None]: 'None',
    [ProposalStatus.Pending]: 'Pending',
    [ProposalStatus.Rejected]: 'Rejected',
    [ProposalStatus.Accepted]: 'Approved', // User-friendly name
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
  const [fetchContentAttempted, setFetchContentAttempted] = useState<boolean>(false);
  
  // Add state for the NFT token ID after execution
  const [nftTokenId, setNftTokenId] = useState<string | null>(null);
  
  // New state to control content expansion
  const [showFullContent, setShowFullContent] = useState<boolean>(false);

  // Load proposal data
  useEffect(() => {
    const loadProposal = async () => {
      if (!proposalId) return;
      
      try {
        // Convert from 1-indexed URL param to 0-indexed contract ID
        // URL /proposals/1 -> contract ID "0", URL /proposals/2 -> contract ID "1", etc.
        const urlId = parseInt(proposalId);
        const contractProposalId = (urlId - 1).toString();
        
        console.log(`Loading proposal: URL ID ${urlId} -> Contract ID ${contractProposalId}`);
        
        const proposalData = await getProposalById(contractProposalId);
        if (proposalData) {
          setProposal(proposalData);
          
          // Debug logging to understand status mapping
          console.log('Proposal Status Debug:', {
            urlProposalId: proposalId,
            contractProposalId: contractProposalId,
            proposalId: proposalData.id,
            contractStatus: proposalData.status,
            contractStatusName: getStatusName(proposalData.status),
            appExecuted: proposalData.executed
          });
        }
      } catch (err) {
        console.error('Error loading proposal:', err);
      }
    };
    
    loadProposal();
  }, [proposalId, getProposalById]);

  // Function to fetch content from Swarm
  const fetchProposalContent = async (contentReference: string) => {
    if (!contentReference || contentReference.trim() === '') {
      setContentError('Content reference not found in proposal data');
      return;
    }
    
    // Avoid double fetch
    if (fetchContentAttempted) return;
    setFetchContentAttempted(true);
    
    try {
      setContentLoading(true);
      console.log(`Fetching proposal content for reference: ${contentReference}`);
      
      // Use standardized SwarmContentService
      const html = await swarmContentService.getContentAsHtml(contentReference);
      
      if (!html || html.trim() === '') {
        setContentError('Retrieved empty content');
      } else {
        setProposalContent(html);
        setContentError(null);
      }
    } catch (err) {
      console.error('Error fetching proposal content:', err);
      setContentError(`Failed to load content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setContentLoading(false);
    }
  };

  // Call this when proposal loads and has a content reference
  useEffect(() => {
    if (proposal?.contentReference) {
      fetchProposalContent(proposal.contentReference);
    }
  }, [proposal]);
  
  // Check if the user has already voted
  useEffect(() => {
    const checkVoteStatus = async () => {
      if (!proposalId || !account || !isConnected) return;
      
      try {
        // Convert URL ID to contract ID for voting check
        const contractProposalId = (parseInt(proposalId) - 1).toString();
        const voted = await hasVoted(contractProposalId);
        setUserHasVoted(voted);
      } catch (err) {
        console.error('Error checking vote status:', err);
      }
    };
    
    checkVoteStatus();
  }, [proposalId, account, isConnected, hasVoted]);
  
  // Handle voting
  const handleVote = async (support: boolean) => {
    if (!proposalId || !isConnected) return;
    
    setIsVoting(true);
    setVoteError(null);
    
    try {
      // Convert URL ID to contract ID for voting
      const contractProposalId = (parseInt(proposalId) - 1).toString();
      const result = await voteOnProposal(contractProposalId, support);
      
      if (result.status === 'confirmed') {
        setVoteSuccess(true);
        setUserHasVoted(true);
        
        // Refresh proposal data using contract ID
        const updatedProposal = await getProposalById(contractProposalId);
        if (updatedProposal) {
          setProposal(updatedProposal);
        }
      } else {
        setVoteError('Vote transaction failed to confirm. Please try again.');
      }
    } catch (err) {
      console.error('Error voting on proposal:', err);
      setVoteError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsVoting(false);
    }
  };
  
  // Handle execution success callback from BlogProposalMinting
  const handleExecuteSuccess = (tokenId: string | null) => {
    console.log(`Proposal executed successfully with token ID: ${tokenId}`);
    setNftTokenId(tokenId);
    
    // Refresh the proposal data after execution using contract ID
    if (proposalId) {
      const contractProposalId = (parseInt(proposalId) - 1).toString();
      getProposalById(contractProposalId).then(updatedProposal => {
        if (updatedProposal) {
          setProposal(updatedProposal);
        }
      }).catch(err => {
        console.error('Error refreshing proposal after execution:', err);
      });
    }
  };
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format relative time
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
  
  // Toggle full content display
  const toggleContentDisplay = () => {
    setShowFullContent(!showFullContent);
  };
  
  // CORRECTED: Use the corrected status mapping
  const displayStatus = useMemo(() => getDisplayStatus(proposal), [proposal]);
  
  // Get status color and label with updated descriptions
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
        return { color: 'gray', label: 'None', description: 'Initial state' };
      case ProposalStatus.Pending:
        return { color: 'yellow', label: 'Pending', description: 'Awaiting voting period' };
      case ProposalStatus.Rejected:
        return { color: 'red', label: 'Rejected', description: 'Rejected by community vote' };
      case ProposalStatus.Accepted:
        return { color: 'green', label: 'Approved', description: 'Ready for execution' };
      case ProposalStatus.Passed:
        return { color: 'green', label: 'Passed', description: 'Alternative approval state' };
      case ProposalStatus.Executed:
        return { color: 'green', label: 'Executed', description: 'NFT minted successfully' };
      case ProposalStatus.Expired:
        return { color: 'purple', label: 'Expired', description: 'Voting period expired' };
      case ProposalStatus.UnderReview:
        return { color: 'blue', label: 'Under Review', description: 'Proposal under review' };
      case ProposalStatus.UnderEvaluation:
        return { color: 'blue', label: 'Under Evaluation', description: 'Proposal under evaluation' };
      default:
        return { color: 'gray', label: 'Unknown', description: 'Unknown status' };
    }
  };
  
  // Calculate voting progress
  const calculateProgress = (votesFor: number, votesAgainst: number) => {
    const total = votesFor + votesAgainst;
    if (total === 0) return 0;
    return (votesFor / total) * 100;
  };
  
  // Extract blog information from proposal description
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
  
  // Handle retry content loading
  const handleRetryContentLoad = () => {
    if (!proposal?.contentReference) return;
    
    setContentError(null);
    setContentLoading(true);
    setFetchContentAttempted(false);
    
    // Clear from cache to force fresh fetch
    swarmContentService.removeFromCache(proposal.contentReference);
    fetchProposalContent(proposal.contentReference);
  };
  
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
  
  const statusInfo = getStatusInfo(displayStatus!, proposal);
  const progress = calculateProgress(proposal.votesFor, proposal.votesAgainst);
  const isActive = isActiveVoting(proposal);
  
  // CORRECTED: Can only execute if Q contract status is "Accepted" (3)
  const canExecute = proposal.status === ProposalStatus.Accepted && isConnected;
  
  // CORRECTED: Proposal is fully complete when Q contract status is Executed (5)
  const isFullyExecuted = proposal.status === ProposalStatus.Executed;
  
  const blogInfo = extractBlogInfo();

  return (
    <div className="proposal-detail-page">
      <div className="proposal-nav-bar">
        <Link to="/proposals" className="back-to-proposals">
          ← All Proposals
        </Link>
        <div className="proposal-id-display">
          Proposal #{parseInt(proposal.id) + 1}
        </div>
      </div>
      
      <div className="proposal-header">
        <div className="proposal-status-banner">
          <div className={`proposal-status-indicator status-indicator-${statusInfo.color}`}></div>
          <h1>{blogInfo.blogTitle || proposal.title}</h1>
          <div className={`proposal-status status-${statusInfo.color}`}>
            {statusInfo.label}
          </div>
        </div>
        
        <div className="proposal-meta">
          <div className="proposal-date">
            <div className="meta-label">Created</div>
            <div className="meta-value">{formatDate(proposal.createdAt)}</div>
          </div>
          <div className="proposal-date">
            <div className="meta-label">Voting Ends</div>
            <div className="meta-value">
              {formatDate(proposal.votingEnds)}
              {isActive && (
                <span className="voting-time-remaining">
                  ({formatRelativeTime(proposal.votingEnds)})
                </span>
              )}
            </div>
          </div>
          <div className="proposal-proposer">
            <div className="meta-label">Proposed by</div>
            <div className="meta-value address">{formatAddress(proposal.proposer, 6, 4)}</div>
          </div>
        </div>
        
        {(blogInfo.category || blogInfo.tags.length > 0) && (
          <div className="blog-meta-section">
            {blogInfo.category && (
              <div className="blog-category-tag">{blogInfo.category}</div>
            )}
            {blogInfo.tags.length > 0 && (
              <div className="blog-tags-container">
                {blogInfo.tags.map((tag, index) => (
                  <span key={index} className="blog-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="proposal-content-grid">
        <div className="proposal-main-content">
          <div className="proposal-section">
            <h2>Description</h2>
            <div className="proposal-description-content">
              {proposal.description.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
          
          {/* Content Preview Section */}
          {proposal.contentReference && (
            <div className="proposal-section">
              <h2>Blog Content Preview</h2>
              
              {contentLoading ? (
                <div className="content-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading content preview...</p>
                </div>
              ) : contentError ? (
                <div className="content-error">
                  <p>{contentError}</p>
                  <button 
                    onClick={handleRetryContentLoad} 
                    className="retry-button"
                  >
                    Retry Loading Content
                  </button>
                </div>
              ) : proposalContent ? (
                <div className={`proposal-preview-container ${showFullContent ? 'expanded' : ''}`}>
                  <div 
                    className="proposal-content-preview"
                    dangerouslySetInnerHTML={{ __html: proposalContent }}
                  />
                  {!showFullContent && <div className="preview-fade"></div>}
                  <button 
                    className="content-toggle-button"
                    onClick={toggleContentDisplay}
                  >
                    {showFullContent ? 'Show Less' : 'Show More'}
                  </button>
                </div>
              ) : (
                <p>No content preview available.</p>
              )}
            </div>
          )}
          
          {/* CORRECTED: Execution section - only show when Q contract status is Accepted (3) */}
          {canExecute && (
            <div className="proposal-section">
              <h2>Execute Proposal</h2>
              <BlogProposalMinting
                proposalId={proposal.id}
                title={blogInfo.blogTitle || proposal.title}
                description={proposal.description}
                contentReference={proposal.contentReference || ''}
                category={blogInfo.category}
                tags={blogInfo.tags}
                authorAddress={blogInfo.authorAddress || proposal.proposer}
                onExecuteSuccess={handleExecuteSuccess}
              />
            </div>
          )}
          
          {/* CORRECTED: Executed proposal section - only show when Q contract status is Executed (5) */}
          {isFullyExecuted && (
            <div className="proposal-section executed-section">
              <h2>Proposal Executed</h2>
              <div className="execution-success-message">
                <div className="success-icon">✓</div>
                <p>This proposal has been executed successfully. The NFT has been minted by the Q governance system.</p>
              </div>
              {nftTokenId && (
                <div className="token-id-info">
                  NFT Token ID: <span className="token-id">{nftTokenId}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="proposal-sidebar">
          <div className="proposal-section voting-section">
            <h2>Voting</h2>
            
            <div className="voting-info">
              <div className="voting-stats">
                <div className="quorum-info">
                  <span>Quorum 50%</span>
                  <span>0% left</span>
                </div>
                
                <div className="vote-progress-container">
                  <div 
                    className="vote-progress-bar" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                
                <div className="vote-counts">
                  <div className="vote-for">
                    <span className="vote-label">For:</span>
                    <span className="vote-value">{proposal.votesFor}</span>
                  </div>
                  <div className="vote-percent">
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="vote-against">
                    <span className="vote-label">Against:</span>
                    <span className="vote-value">{proposal.votesAgainst}</span>
                  </div>
                </div>
              </div>
              
              {/* Show voting actions only if proposal is actively accepting votes */}
              {isActive && isConnected && (
                <div className="voting-actions">
                  {userHasVoted ? (
                    <div className="already-voted">
                      You have already voted on this proposal
                    </div>
                  ) : voteSuccess ? (
                    <div className="vote-success">
                      Your vote has been recorded
                    </div>
                  ) : (
                    <>
                      <button 
                        className="vote-button vote-for-button"
                        onClick={() => handleVote(true)}
                        disabled={isVoting}
                      >
                        {isVoting ? 'Voting...' : 'Vote For'}
                      </button>
                      <button 
                        className="vote-button vote-against-button"
                        onClick={() => handleVote(false)}
                        disabled={isVoting}
                      >
                        {isVoting ? 'Voting...' : 'Vote Against'}
                      </button>
                    </>
                  )}
                  
                  {voteError && <div className="vote-error">{voteError}</div>}
                </div>
              )}
              
              {/* Show voting ended message for inactive proposals */}
              {!isActive && proposal.status !== ProposalStatus.Pending && (
                <div className="voting-ended-message">
                  Voting has ended for this proposal
                </div>
              )}
              
              {/* Show waiting message for pending proposals that aren't active yet */}
              {proposal.status === ProposalStatus.Pending && !isActive && (
                <div className="voting-pending-message">
                  Voting period has not started yet
                </div>
              )}
            </div>
          </div>
          
          <div className="proposal-section proposal-details-section">
            <h2>Details</h2>
            <div className="proposal-details-list">
              <div className="detail-item">
                <div className="detail-label">Status</div>
                <div className={`detail-value status-text-${statusInfo.color}`}>
                  {statusInfo.label}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Created</div>
                <div className="detail-value">{formatDate(proposal.createdAt)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Voting Period</div>
                <div className="detail-value">
                  {isActive ? (
                    formatRelativeTime(proposal.votingEnds)
                  ) : (
                    'Ended'
                  )}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Proposer</div>
                <div className="detail-value address">{formatAddress(proposal.proposer, 6, 4)}</div>
              </div>
              {blogInfo.authorAddress && blogInfo.authorAddress !== proposal.proposer && (
                <div className="detail-item">
                  <div className="detail-label">Blog Author</div>
                  <div className="detail-value address">{formatAddress(blogInfo.authorAddress, 6, 4)}</div>
                </div>
              )}
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
        </div>
      </div>
    </div>
  );
};

export default ProposalDetailPage;