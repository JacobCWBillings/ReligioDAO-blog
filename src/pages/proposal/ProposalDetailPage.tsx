// src/pages/proposal/ProposalDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { Proposal, ProposalStatus } from '../../types/blockchain';
import { BlogProposalMinting } from '../../components/proposal/BlogProposalMinting';
import './ProposalDetailPage.css';
import swarmContentService from '../../services/SwarmContentService';

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

  // Load proposal data
  useEffect(() => {
    const loadProposal = async () => {
      if (!proposalId) return;
      
      try {
        const proposalData = await getProposalById(proposalId);
        if (proposalData) {
          setProposal(proposalData);
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
        const voted = await hasVoted(proposalId);
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
      const result = await voteOnProposal(proposalId, support);
      
      if (result.status === 'confirmed') {
        setVoteSuccess(true);
        setUserHasVoted(true);
        
        // Refresh proposal data
        const updatedProposal = await getProposalById(proposalId);
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
    
    // Refresh the proposal data after execution
    if (proposalId) {
      getProposalById(proposalId).then(updatedProposal => {
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
  
  // Get status color and label
  const getStatusInfo = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.Pending:
        return { color: 'gray', label: 'Pending' };
      case ProposalStatus.Active:
        return { color: 'blue', label: 'Voting Active' };
      case ProposalStatus.Approved:
        return { color: 'green', label: 'Approved' };
      case ProposalStatus.Rejected:
        return { color: 'red', label: 'Rejected' };
      case ProposalStatus.Executed:
        return { color: 'purple', label: 'Executed' };
      case ProposalStatus.Canceled:
        return { color: 'orange', label: 'Canceled' };
      default:
        return { color: 'gray', label: 'Unknown' };
    }
  };
  
  // Calculate voting progress
  const calculateProgress = (votesFor: number, votesAgainst: number) => {
    const total = votesFor + votesAgainst;
    if (total === 0) return 0;
    return (votesFor / total) * 100;
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
  
  const statusInfo = getStatusInfo(proposal.status);
  const progress = calculateProgress(proposal.votesFor, proposal.votesAgainst);
  const canExecute = proposal.status === ProposalStatus.Approved && !proposal.executed;
  
  // Extract title and tags from proposal description (simplified approach)
  const extractBlogInfo = () => {
    const lines = proposal.description.split('\n');
    const blogTitle = lines.find(line => line.trim().startsWith('Blog:'))?.replace('Blog:', '').trim() || proposal.title;
    const category = lines.find(line => line.trim().startsWith('Category:'))?.replace('Category:', '').trim() || '';
    const tags = lines.find(line => line.trim().startsWith('Tags:'))?.replace('Tags:', '').trim().split(',').map(tag => tag.trim()) || [];
    const authorAddress = lines.find(line => line.trim().startsWith('Author:'))?.replace('Author:', '').trim() || '';
    
    return { blogTitle, category, tags, authorAddress };
  };
  
  const blogInfo = extractBlogInfo();

  return (
    <div className="proposal-detail-page">
      <div className="proposal-header">
        <h1>{proposal.title}</h1>
        
        <div className="proposal-meta">
          <span className={`proposal-status status-${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <span className="proposal-id">ID: {proposal.id}</span>
          <span className="proposal-date">Created: {formatDate(proposal.createdAt)}</span>
        </div>
        
        <div className="proposal-proposer">
          Proposed by: <span className="address">{proposal.proposer}</span>
        </div>
      </div>
      
      <div className="proposal-content">
        <div className="proposal-description">
          <h2>Description</h2>
          <div className="description-box">
            {proposal.description.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>
        
        {/* Content Preview Section */}
        {proposal.contentReference && (
          <div className="proposal-content-preview">
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
              <div className="proposal-preview-container">
                <div 
                  className="proposal-content"
                  dangerouslySetInnerHTML={{ __html: proposalContent }}
                />
                <div className="preview-fade"></div>
              </div>
            ) : (
              <p>No content preview available.</p>
            )}
          </div>
        )}
        
        <div className="proposal-voting">
          <h2>Voting</h2>
          
          <div className="voting-info">
            <div className="voting-period">
              <span>Voting Ends: {formatDate(proposal.votingEnds)}</span>
              {proposal.votingEnds < Date.now() && !proposal.executed && (
                <span className="voting-ended">Voting has ended</span>
              )}
            </div>
            
            <div className="vote-counts">
              <div className="vote-for">
                <span className="vote-label">For:</span>
                <span className="vote-value">{proposal.votesFor}</span>
              </div>
              <div className="vote-against">
                <span className="vote-label">Against:</span>
                <span className="vote-value">{proposal.votesAgainst}</span>
              </div>
            </div>
            
            <div className="vote-progress-container">
              <div 
                className="vote-progress-bar" 
                style={{ width: `${progress}%` }}
              ></div>
              <span className="vote-progress-label">{progress.toFixed(1)}% For</span>
            </div>
          </div>
          
          {proposal.status === ProposalStatus.Active && isConnected && (
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
        </div>
        
        {canExecute && isConnected && (
          <div className="proposal-execution">
            <h2>Execute Proposal</h2>
            <BlogProposalMinting
              proposalId={proposal.id}
              title={blogInfo.blogTitle}
              description={proposal.description}
              contentReference={proposal.contentReference || ''}
              category={blogInfo.category}
              tags={blogInfo.tags}
              authorAddress={blogInfo.authorAddress}
              onExecuteSuccess={handleExecuteSuccess}
            />
          </div>
        )}
        
        {proposal.executed && (
          <div className="proposal-executed">
            <h2>Proposal Executed</h2>
            <p>This proposal has been executed successfully and minted as an NFT.</p>
            
            <div className="view-blog-container">
              {nftTokenId ? (
                // Use the extracted NFT token ID when available
                <Link to={`/blogs/${nftTokenId}`} className="view-blog-button">
                  View Blog Post
                </Link>
              ) : (
                // Fall back to proposal ID if token ID not available
                <Link to={`/blogs/${proposal.id}`} className="view-blog-button">
                  View Blog Post
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="proposal-footer">
        <Link to="/proposals" className="back-to-proposals">
          Back to Proposals
        </Link>
      </div>
    </div>
  );
};

export default ProposalDetailPage;