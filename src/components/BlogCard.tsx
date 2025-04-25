// src/components/BlogCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { BlogNFT } from '../types/blockchain';
import { formatAddress } from '../blockchain/utils/walletUtils';
import { HighlightedTitle, HighlightedPreview } from './TextHighlighter';
import './BlogCard.css';

interface BlogCardProps {
  blog: BlogNFT;
  showProposalStatus?: boolean;
  showRecentIndicator?: boolean;
  searchTerm?: string;
  onClick?: () => void;
}

export const BlogCard: React.FC<BlogCardProps> = ({ 
  blog, 
  showProposalStatus = false,
  showRecentIndicator = true,
  searchTerm = '',
  onClick
}) => {
  // Extract necessary data from blog NFT
  const { tokenId, metadata, createdAt } = blog;
  const { name, description, image, properties } = metadata;
  
  // Check if this is an error/invalid NFT
  const isErrorNFT = properties.category === "Error";
  
  // Get tags from properties (ensuring it's an array)
  const tags = properties.tags && Array.isArray(properties.tags) 
    ? properties.tags 
    : [];
  
  // Format the date for display
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Handle image loading errors by falling back to default image
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/public/default.png';
  };
  
  // Format the description to a limited preview
  const getPreviewText = (text: string, maxLength: number = 120): string => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    
    // Try to cut at the end of a word to avoid cutting words in half
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) { // Only use lastSpace if it's reasonably far into the text
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  };
  
  // Get appropriate CSS class based on category
  const getCategoryClass = (category: string): string => {
    const categories = ['Technology', 'Philosophy', 'Science', 'Arts', 'Religion', 'Culture'];
    const index = categories.findIndex(c => 
      c.toLowerCase() === (category || '').toLowerCase()
    );
    return `category-${index !== -1 ? index + 1 : 'default'}`;
  };
  
  // Determine if this is a recently approved blog (within last 7 days)
  const isRecentlyApproved = () => {
    if (!showRecentIndicator || isErrorNFT) return false;
    
    const now = new Date();
    const blogDate = new Date(createdAt);
    const diffTime = Math.abs(now.getTime() - blogDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 7; // Show indicator for blogs approved in the last 7 days
  };
  
  // Handle card click
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };
  
  // If this is an error NFT, display a special error card
  if (isErrorNFT) {
    return (
      <div className="blog-card error-nft-card">
        <Link to={`/blogs/${tokenId}`} className="blog-card-link" onClick={handleClick}>
          <div className="error-badge">Invalid Metadata</div>
          <div className="blog-card-content">
            <h3 className="blog-card-title">{name || "Invalid NFT"}</h3>
            <p className="blog-card-preview">{description || "This NFT has corrupted or invalid metadata and cannot be displayed properly."}</p>
            <div className="error-nft-footer">
              <span className="token-id">Token ID: {tokenId}</span>
            </div>
          </div>
        </Link>
      </div>
    );
  }
  
  // Regular NFT rendering
  return (
    <div className={`blog-card ${isRecentlyApproved() ? 'blog-card-recent' : ''}`}>
      <Link 
        to={`/blogs/${tokenId}`} 
        className="blog-card-link"
        onClick={handleClick}
      >
        <div className="blog-card-image-container">
          <img 
            src={image || '/public/default.png'} 
            alt={name} 
            className="blog-card-image" 
            onError={handleImageError}
          />
          {properties.category && (
            <span className={`blog-card-category ${getCategoryClass(properties.category)}`}>
              {properties.category}
            </span>
          )}
          
          {/* New badge for recently approved blogs */}
          {isRecentlyApproved() && (
            <div className="blog-card-new-badge">NEW</div>
          )}
        </div>
        
        <div className="blog-card-content">
          {/* Use text highlighter if search term is provided */}
          {searchTerm ? (
            <h3 className="blog-card-title">
              <HighlightedTitle title={name} highlight={searchTerm} />
            </h3>
          ) : (
            <h3 className="blog-card-title">{name}</h3>
          )}
          
          {/* Use text highlighter for preview with search term */}
          {searchTerm ? (
            <div className="blog-card-preview">
              <HighlightedPreview text={description} highlight={searchTerm} maxLength={120} />
            </div>
          ) : (
            <p className="blog-card-preview">{getPreviewText(description)}</p>
          )}
          
          <div className="blog-card-meta">
            <span className="blog-card-date">{formatDate(createdAt)}</span>
            <span className="blog-card-author">
              By: {formatAddress(properties.authorAddress, 4, 4)}
            </span>
          </div>
          
          {tags.length > 0 && (
            <div className="blog-card-tags">
              {tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="blog-card-tag">{tag}</span>
              ))}
              {tags.length > 3 && <span className="blog-card-tag">+{tags.length - 3}</span>}
            </div>
          )}
          
          {/* Updated status indicator with animation for approved proposals */}
          {showProposalStatus && properties.proposalId && (
            <div className="blog-card-proposal">
              {isRecentlyApproved() ? (
                <span className="blog-card-proposal-badge badge-animate">Recently Approved</span>
              ) : (
                <span className="blog-card-proposal-badge">Approved</span>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
};

export default BlogCard;