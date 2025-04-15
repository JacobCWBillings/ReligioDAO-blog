// src/components/proposal/BlogProposalMinting.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNFT } from '../../blockchain/hooks/useNFT';
import { BlogNFTMetadata } from '../../types/blockchain';
import './BlogProposalMinting.css';

interface BlogProposalMintingProps {
  proposalId: string;
  title: string;
  description: string;
  contentReference: string;
  category?: string;
  tags?: string[];
  authorAddress: string;
}

export const BlogProposalMinting: React.FC<BlogProposalMintingProps> = ({
  proposalId,
  title,
  description,
  contentReference,
  category,
  tags,
  authorAddress,
}) => {
  const navigate = useNavigate();
  const { mintNFT, loading, error } = useNFT();
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);

  const handleMintNFT = async () => {
    setIsMinting(true);
    setMintError(null);
    
    try {
      // Generate placeholder image URL
      // In a real implementation, you might want to generate a preview image from the content
      const placeholderImage = `http://localhost:1633/bytes/${contentReference}`;
      
      // Create metadata for NFT
      const metadata: BlogNFTMetadata = {
        name: title,
        description: description.length > 300 ? description.substring(0, 297) + '...' : description,
        image: placeholderImage,
        attributes: [
          {
            trait_type: "Author",
            value: authorAddress
          },
          {
            trait_type: "PublishedDate",
            value: new Date().toISOString()
          },
          {
            trait_type: "Category",
            value: category || "Uncategorized"
          }
        ],
        properties: {
          contentReference: contentReference,
          proposalId: proposalId,
          approvalDate: new Date().toISOString(),
          category: category,
          tags: tags || [],
          authorAddress: authorAddress
        }
      };
      
      // Call the mintNFT function
      const result = await mintNFT(proposalId, contentReference, metadata);
      
      if (result.status === 'confirmed') {
        setMintSuccess(true);
        
        // Try to extract token ID from receipt
        if (result.receipt && result.receipt.logs && result.receipt.logs.length > 0) {
          // This is a simplified approach - in practice you'd decode the logs properly
          // to extract the token ID from the Transfer event
          setTokenId("1"); // Placeholder
        }
      } else {
        setMintError('Transaction failed to confirm. Please try again.');
      }
    } catch (err) {
      console.error('Error minting NFT:', err);
      setMintError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsMinting(false);
    }
  };

  const viewNFT = () => {
    // Navigate to the blog detail page using the token ID
    if (tokenId) {
      navigate(`/blogs/${tokenId}`);
    }
  };

  return (
    <div className="blog-proposal-minting">
      {mintSuccess ? (
        <div className="minting-success">
          <h3>Blog Published Successfully!</h3>
          <p>Your blog has been minted as an NFT and is now publicly available.</p>
          <button className="view-blog-button" onClick={viewNFT}>
            View Published Blog
          </button>
        </div>
      ) : (
        <>
          <div className="minting-info">
            <p>This proposal has been approved by the DAO and is ready to be executed.</p>
            <p>Executing this proposal will mint an NFT to represent the blog post, making it publicly available.</p>
            
            <div className="blog-summary">
              <h3>Blog Summary</h3>
              <div className="summary-item">
                <span className="label">Title:</span>
                <span className="value">{title}</span>
              </div>
              <div className="summary-item">
                <span className="label">Category:</span>
                <span className="value">{category || "Uncategorized"}</span>
              </div>
              {tags && tags.length > 0 && (
                <div className="summary-item">
                  <span className="label">Tags:</span>
                  <span className="value">{tags.join(", ")}</span>
                </div>
              )}
              <div className="summary-item">
                <span className="label">Author:</span>
                <span className="value">{authorAddress.substring(0, 6)}...{authorAddress.substring(38)}</span>
              </div>
              <div className="summary-item">
                <span className="label">Content Hash:</span>
                <span className="value">{contentReference.substring(0, 8)}...{contentReference.substring(contentReference.length - 6)}</span>
              </div>
            </div>
          </div>
          
          <button 
            className="mint-button"
            onClick={handleMintNFT}
            disabled={isMinting}
          >
            {isMinting ? 'Minting...' : 'Publish Blog (Mint NFT)'}
          </button>
          
          {mintError && <div className="mint-error">{mintError}</div>}
          {error && <div className="mint-error">{error.message}</div>}
        </>
      )}
    </div>
  );
};

export default BlogProposalMinting;