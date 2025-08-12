// src/components/proposal/BlogProposalMinting.tsx
import React, { useState, useCallback } from 'react';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { ProposalStatus } from '../../types/blockchain';
import './BlogProposalMinting.css';

interface BlogProposalMintingProps {
  proposalId: string;
  title: string;
  description: string;
  contentReference: string;
  category?: string;
  tags?: string[];
  authorAddress?: string;
  onExecuteSuccess?: (tokenId: string | null) => void;
}

export const BlogProposalMinting: React.FC<BlogProposalMintingProps> = ({
  proposalId,
  title,
  description,
  contentReference,
  category,
  tags,
  authorAddress,
  onExecuteSuccess
}) => {
  const { executeProposal, getProposalById } = useProposal();
  const { account, isConnected } = useWallet();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);

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
      // First, verify the proposal is in the correct state
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
          
          <div className="blog-summary">
            <h4>Blog Details:</h4>
            <div className="detail-item">
              <span className="label">Title:</span>
              <span className="value">{title}</span>
            </div>
            
            {category && (
              <div className="detail-item">
                <span className="label">Category:</span>
                <span className="value">{category}</span>
              </div>
            )}
            
            {tags && tags.length > 0 && (
              <div className="detail-item">
                <span className="label">Tags:</span>
                <span className="value">{tags.join(', ')}</span>
              </div>
            )}
            
            {authorAddress && (
              <div className="detail-item">
                <span className="label">Author:</span>
                <span className="value blockchain-address">{authorAddress}</span>
              </div>
            )}
            
            {contentReference && (
              <div className="detail-item">
                <span className="label">Content Reference:</span>
                <span className="value content-ref">{contentReference.substring(0, 16)}...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-proposal-minting">
      <div className="execution-info">
        <h3>Execute Approved Proposal</h3>
        <p>
          This proposal has been approved by the community and is ready for execution. 
          Executing will mint an NFT representing the approved blog post.
        </p>
        
        <div className="blog-preview">
          <h4>Blog to be Minted:</h4>
          <div className="preview-item">
            <strong>Title:</strong> {title}
          </div>
          
          {category && (
            <div className="preview-item">
              <strong>Category:</strong> {category}
            </div>
          )}
          
          {tags && tags.length > 0 && (
            <div className="preview-item">
              <strong>Tags:</strong> {tags.join(', ')}
            </div>
          )}
          
          {description && (
            <div className="preview-item">
              <strong>Description:</strong> 
              <div className="description-text">{description}</div>
            </div>
          )}
        </div>
      </div>

      {executeError && (
        <div className="execution-error">
          <div className="error-icon">❌</div>
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
            disabled={isExecuting}
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