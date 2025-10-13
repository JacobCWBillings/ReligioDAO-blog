// src/pages/proposal/components/BlogProposalMinting.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useProposal } from '../../../blockchain/hooks/useProposal';
import { useWallet } from '../../../contexts/WalletContext';
import { Proposal, ProposalStatus } from '../../../types/blockchainTypes';
import { services } from '../../../swarm/services';
import './BlogProposalMinting.css';

interface BlogProposalMintingProps {
  proposalId: string;
  proposal: Proposal;
  onExecuteSuccess?: (tokenId: string | null) => void;
}

export const BlogProposalMinting: React.FC<BlogProposalMintingProps> = ({
  proposalId,
  proposal,
  onExecuteSuccess
}) => {
  const { executeProposal, getProposalById } = useProposal();
  const { account, isConnected } = useWallet();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [metadataInfo, setMetadataInfo] = useState<{
    hasMetadata: boolean;
    isValid: boolean;
    details?: any;
  }>({
    hasMetadata: false,
    isValid: false
  });

  // Extract blog info from proposal
  const extractBlogInfo = useCallback(() => {
    try {
      const lines = proposal.description.split('\n');
      const blogTitle = lines.find(line => 
        line.trim().startsWith('Blog:'))?.replace('Blog:', '').trim() || proposal.title;
      const category = lines.find(line => 
        line.trim().startsWith('Category:'))?.replace('Category:', '').trim() || 'Uncategorized';
      const tags = lines.find(line => 
        line.trim().startsWith('Tags:'))?.replace('Tags:', '').trim().split(',').map(tag => tag.trim()) || [];
      const authorAddress = lines.find(line => 
        line.trim().startsWith('Author:'))?.replace('Author:', '').trim() || proposal.proposer;
      
      return { blogTitle, category, tags, authorAddress };
    } catch (e) {
      return { 
        blogTitle: proposal.title, 
        category: 'Uncategorized', 
        tags: [], 
        authorAddress: proposal.proposer 
      };
    }
  }, [proposal]);

  // Check if metadata is properly prepared
  useEffect(() => {
    const checkMetadata = async () => {
      if (!proposal.contentReference) {
        setMetadataInfo({ hasMetadata: false, isValid: false });
        return;
      }

      try {
        // Check if we can access the content
        const validation = await services.swarm.validateContentAccess(proposal.contentReference);
        
        if (validation.isAccessible) {
          const blogInfo = extractBlogInfo();
          setMetadataInfo({
            hasMetadata: true,
            isValid: true,
            details: {
              title: blogInfo.blogTitle,
              category: blogInfo.category,
              tags: blogInfo.tags,
              author: blogInfo.authorAddress,
              contentReference: proposal.contentReference
            }
          });
        } else {
          setMetadataInfo({
            hasMetadata: true,
            isValid: false,
            details: { error: 'Content not accessible on Swarm' }
          });
        }
      } catch (error) {
        console.error('Error checking metadata:', error);
        setMetadataInfo({ hasMetadata: false, isValid: false });
      }
    };

    checkMetadata();
  }, [proposal, extractBlogInfo]);

  const handleExecuteProposal = useCallback(async () => {
    if (!isConnected || !account) {
      setExecuteError('Please connect your wallet to execute this proposal');
      return;
    }

    if (!proposalId) {
      setExecuteError('Invalid proposal ID');
      return;
    }

    setIsExecuting(true);
    setExecuteError(null);

    try {
      // Verify the proposal is in the correct state
      const currentProposal = await getProposalById(proposalId);
      if (!currentProposal) {
        throw new Error('Proposal not found');
      }

      if (currentProposal.status !== ProposalStatus.Accepted) {
        throw new Error('Proposal is not approved for execution');
      }

      if (currentProposal.executed) {
        throw new Error('Proposal has already been executed');
      }

      // Execute the proposal
      console.log(`Executing proposal ${proposalId}...`);
      const result = await executeProposal(proposalId);

      if (result.status === 'confirmed') {
        setExecuteSuccess(true);
        const tokenId = result.tokenId || null;
        setMintedTokenId(tokenId);
        
        console.log('Proposal executed successfully', {
          proposalId,
          tokenId,
          transactionHash: result.hash
        });

        // Call success callback
        if (onExecuteSuccess) {
          onExecuteSuccess(tokenId);
        }
      } else {
        throw new Error(result.error?.message || 'Execution failed');
      }
    } catch (error) {
      console.error('Error executing proposal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setExecuteError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [proposalId, account, isConnected, executeProposal, getProposalById, onExecuteSuccess]);

  const handleRetryExecution = useCallback(() => {
    setExecuteError(null);
    setExecuteSuccess(false);
    setMintedTokenId(null);
  }, []);

  if (executeSuccess) {
    return (
      <div className="blog-proposal-minting execution-success">
        <div className="success-header">
          <div className="success-icon">✅</div>
          <h3>Proposal Executed Successfully!</h3>
        </div>
        
        <div className="success-details">
          <p>The blog proposal has been executed and an NFT has been minted.</p>
          
          {mintedTokenId && (
            <div className="minted-nft-info">
              <strong>NFT Token ID:</strong> 
              <span className="token-id">{mintedTokenId}</span>
            </div>
          )}
          
          {metadataInfo.isValid && metadataInfo.details && (
            <div className="blog-summary">
              <h4>Blog Details:</h4>
              <div className="detail-item">
                <span className="label">Title:</span>
                <span className="value">{metadataInfo.details.title}</span>
              </div>
              
              <div className="detail-item">
                <span className="label">Category:</span>
                <span className="value">{metadataInfo.details.category}</span>
              </div>
              
              {metadataInfo.details.tags && metadataInfo.details.tags.length > 0 && (
                <div className="detail-item">
                  <span className="label">Tags:</span>
                  <span className="value">{metadataInfo.details.tags.join(', ')}</span>
                </div>
              )}
              
              <div className="detail-item">
                <span className="label">Author:</span>
                <span className="value blockchain-address">{metadataInfo.details.author}</span>
              </div>
              
              {metadataInfo.details.contentReference && (
                <div className="detail-item">
                  <span className="label">Content:</span>
                  <a 
                    href={services.swarm.getContentUrl(metadataInfo.details.contentReference, {
                      usePublicGateway: true,
                      forWebDisplay: true
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="content-link"
                  >
                    View on Swarm
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const blogInfo = extractBlogInfo();

  return (
    <div className="blog-proposal-minting">
      <div className="execution-info">
        <h3>Execute Approved Proposal</h3>
        <p>
          This proposal has been approved by the community and is ready for execution. 
          Executing will mint an NFT representing the approved blog post.
        </p>
        
        {/* Metadata Status */}
        <div className="metadata-status">
          <h4>Metadata Status</h4>
          {metadataInfo.isValid ? (
            <div className="status-valid">
              <span className="status-icon">✅</span>
              <span>Metadata is valid and ready for minting</span>
            </div>
          ) : (
            <div className="status-warning">
              <span className="status-icon">⚠️</span>
              <span>Metadata validation in progress or unavailable</span>
            </div>
          )}
        </div>
        
        <div className="blog-preview">
          <h4>Blog to be Minted:</h4>
          <div className="preview-item">
            <strong>Title:</strong> {blogInfo.blogTitle}
          </div>
          
          <div className="preview-item">
            <strong>Category:</strong> {blogInfo.category}
          </div>
          
          {blogInfo.tags.length > 0 && (
            <div className="preview-item">
              <strong>Tags:</strong> {blogInfo.tags.join(', ')}
            </div>
          )}
          
          <div className="preview-item">
            <strong>Author:</strong> {blogInfo.authorAddress}
          </div>
          
          {proposal.contentReference && (
            <div className="preview-item">
              <strong>Content Reference:</strong> 
              <code className="reference-code">
                {proposal.contentReference.substring(0, 16)}...
              </code>
            </div>
          )}
        </div>

        {/* Content Access Status */}
        {proposal.contentReference && (
          <div className="content-access-info">
            <h4>Content Accessibility</h4>
            <div className="access-links">
              <a 
                href={services.swarm.getContentUrl(proposal.contentReference, {
                  usePublicGateway: true,
                  forWebDisplay: true
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="access-link"
              >
                View on Public Gateway
              </a>
              <a 
                href={services.swarm.getContentUrl(proposal.contentReference, {
                  usePublicGateway: false,
                  forWebDisplay: true
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="access-link"
              >
                View on Local Node
              </a>
            </div>
          </div>
        )}
      </div>

      {executeError && (
        <div className="execution-error">
          <div className="error-icon">⌛</div>
          <div className="error-content">
            <h4>Execution Failed</h4>
            <p>{executeError}</p>
            <button 
              className="retry-button"
              onClick={handleRetryExecution}
              disabled={isExecuting}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="execution-actions">
        {!isConnected ? (
          <div className="connect-wallet-message">
            <p>Please connect your wallet to execute this proposal.</p>
          </div>
        ) : (
          <button
            className="execute-button"
            onClick={handleExecuteProposal}
            disabled={isExecuting || !metadataInfo.isValid}
          >
            {isExecuting ? (
              <>
                <span className="loading-spinner"></span>
                Executing Proposal...
              </>
            ) : (
              'Execute Proposal & Mint NFT'
            )}
          </button>
        )}
      </div>

      {isExecuting && (
        <div className="execution-progress">
          <div className="progress-info">
            <h4>Executing Proposal...</h4>
            <p>Please confirm the transaction in your wallet and wait for confirmation.</p>
            <div className="progress-steps">
              <div className="step active">
                <span className="step-number">1</span>
                <span className="step-text">Submitting transaction</span>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <span className="step-text">Waiting for confirmation</span>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <span className="step-text">Minting NFT</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogProposalMinting;