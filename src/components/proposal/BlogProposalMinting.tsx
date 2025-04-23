// src/components/proposal/BlogProposalMinting.tsx
import React, { useState } from 'react';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { Link } from 'react-router-dom';
import './BlogProposalMinting.css';

interface BlogProposalMintingProps {
  proposalId: string;
  title: string;
  description: string;
  contentReference: string;
  category: string;
  tags: string[];
  authorAddress: string;
}

export const BlogProposalMinting: React.FC<BlogProposalMintingProps> = ({
  proposalId,
  title,
  description,
  contentReference,
  category,
  tags,
  authorAddress
}) => {
  const { executeProposal, loading, error } = useProposal();
  const { isConnected } = useWallet();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeSuccess, setExecuteSuccess] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  
  const handleExecute = async () => {
    if (!isConnected) {
      setExecuteError('Please connect your wallet to execute this proposal');
      return;
    }
    
    setIsExecuting(true);
    setExecuteError(null);
    
    try {
      const result = await executeProposal(proposalId);
      
      if (result.status === 'confirmed') {
        setExecuteSuccess(true);
      } else {
        setExecuteError('Transaction failed to confirm. Please try again.');
      }
    } catch (err) {
      console.error('Error executing proposal:', err);
      setExecuteError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <div className="blog-proposal-minting">
      {executeSuccess ? (
        <div className="execution-success">
          <h3>Proposal Executed Successfully!</h3>
          <p>The blog post has been minted as an NFT and is now published.</p>
          <Link to={`/blogs/${proposalId}`} className="view-blog-button">
            View Blog Post
          </Link>
        </div>
      ) : (
        <>
          <div className="execution-info">
            <p>This proposal has been approved and is ready to be executed.</p>
            <p>Executing this proposal will mint an NFT for the blog and make it publicly available.</p>
            
            <div className="blog-info">
              <h4>{title}</h4>
              <div className="blog-meta">
                <span className="blog-category">{category}</span>
                <div className="blog-tags">
                  {tags.map((tag, i) => (
                    <span key={i} className="blog-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <p className="blog-author">Author: {authorAddress.substring(0, 6)}...{authorAddress.substring(38)}</p>
            </div>
          </div>
          
          <div className="execution-actions">
            <button
              className="execute-button"
              onClick={handleExecute}
              disabled={isExecuting || loading}
            >
              {isExecuting ? 'Executing...' : 'Execute Proposal'}
            </button>
            
            {(executeError || error) && (
              <div className="execution-error">
                {executeError || (error && error.message)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BlogProposalMinting;