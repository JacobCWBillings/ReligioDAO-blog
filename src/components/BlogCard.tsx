// src/components/BlogCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { BlogNFT } from '../types/blockchain';
import { getContentUrl } from '../config';
import './BlogCard.css';

interface BlogCardProps {
  blog: BlogNFT;
}

export const BlogCard: React.FC<BlogCardProps> = ({ blog }) => {
  const { metadata, tokenId, createdAt } = blog;
  const { name, description, image, properties } = metadata;
  
  // Format date
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Truncate description if too long
  const shortDescription = description.length > 150 
    ? `${description.substring(0, 150)}...` 
    : description;
  
  // Get appropriate image URL
  const imageUrl = image.startsWith('http') 
    ? image 
    : image.startsWith('ipfs://') 
      ? `https://ipfs.io/ipfs/${image.replace('ipfs://', '')}` 
      : image.startsWith('data:') 
        ? image 
        : '/etherjot/default.png';
  
  // Get tags array or empty array if no tags
  const tags = properties.tags && Array.isArray(properties.tags) 
    ? properties.tags 
    : [];
  
  return (
    <div className="blog-card">
      <div className="blog-card-image">
        <img src={imageUrl} alt={name} onError={(e) => {
          // Fallback to default image on error
          (e.target as HTMLImageElement).src = '/etherjot/default.png';
        }} />
      </div>
      
      <div className="blog-card-content">
        {properties.category && (
          <div className="blog-card-category">{properties.category}</div>
        )}
        
        <h2 className="blog-card-title">{name}</h2>
        <p className="blog-card-preview">{shortDescription}</p>
        
        {tags.length > 0 && (
          <div className="blog-card-tags">
            {tags.map((tag, index) => (
              <span key={index} className="blog-tag">{tag}</span>
            ))}
          </div>
        )}
        
        <div className="blog-card-footer">
          <span className="blog-date">{formattedDate}</span>
          <Link to={`/blogs/${tokenId}`} className="read-more">
            Read More
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BlogCard;