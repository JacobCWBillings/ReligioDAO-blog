// src/components/TrendingBlogs.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BlogNFT } from '../types/blockchain';
import { useBlogNFT } from '../blockchain/hooks/useBlogNFT';
import { formatAddress } from '../blockchain/utils/walletUtils';
import defaultImage from '../static/media/default.jpg'
import './TrendingBlogs.css';

interface TrendingBlogsProps {
  maxItems?: number;
  title?: string;
  filter?: 'recent' | 'popular';
}

export const TrendingBlogs: React.FC<TrendingBlogsProps> = ({
  maxItems = 5,
  title = 'Popular Blogs',
  filter = 'popular'
}) => {
  const { getAllNFTs } = useBlogNFT();
  const [blogs, setBlogs] = useState<BlogNFT[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Function to load blogs
  const loadBlogs = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all blogs
      const allBlogs = await getAllNFTs();
      
      // Sort based on filter type
      let sortedBlogs: BlogNFT[];
      
      if (filter === 'recent') {
        // Sort by creation date (newest first)
        sortedBlogs = [...allBlogs].sort((a, b) => b.createdAt - a.createdAt);
      } else {
        // For 'popular', we should ideally use some kind of popularity metric
        // Since we don't have that yet, we'll simulate by using some metrics
        
        // Randomize slightly to simulate popularity in this demo
        // In a real implementation, you would use actual metrics like view count
        const getSimulatedPopularity = (blog: BlogNFT) => {
          // Use tokenId as a simple way to deterministically vary popularity
          const tokenNum = parseInt(blog.tokenId, 10) || 0;
          const randomFactor = (tokenNum % 10) / 10; // 0.0 to 0.9
          
          // Weight recent posts slightly higher
          const recencyFactor = (Date.now() - blog.createdAt) / (1000 * 60 * 60 * 24 * 30); // age in months
          const recencyScore = Math.max(0.5, 1 - (recencyFactor * 0.1)); // 0.5 to 1.0 based on age
          
          // Consider tags count as a popularity indicator
          const tagsCount = blog.metadata.properties.tags?.length || 0;
          const tagsScore = Math.min(1, tagsCount / 5); // 0.0 to 1.0 based on tags
          
          // Final simulated popularity score
          return recencyScore * 0.5 + tagsScore * 0.3 + randomFactor * 0.2;
        };
        
        // Sort by our simulated popularity
        sortedBlogs = [...allBlogs].sort(
          (a, b) => getSimulatedPopularity(b) - getSimulatedPopularity(a)
        );
      }
      
      // Limit the number of blogs
      setBlogs(sortedBlogs.slice(0, maxItems));
    } catch (err) {
      console.error('Error loading trending blogs:', err);
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }, [getAllNFTs, filter, maxItems]);
  
  // Load blogs on mount and when dependencies change
  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);
  
  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };
  
  // Render loading skeleton
  if (loading) {
    return (
      <div className="trending-blogs">
        <h3>{title}</h3>
        <div className="trending-blogs-list">
          {[...Array(maxItems)].map((_, index) => (
            <div key={index} className="trending-blog-skeleton">
              <div className="trending-blog-image-skeleton"></div>
              <div className="trending-blog-content-skeleton">
                <div className="trending-blog-title-skeleton"></div>
                <div className="trending-blog-meta-skeleton"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // If no blogs, don't render the component
  if (blogs.length === 0) {
    return null;
  }
  
  return (
    <div className="trending-blogs">
      <h3>{title}</h3>
      <div className="trending-blogs-list">
        {blogs.map((blog, index) => (
          <Link 
            to={`/blogs/${blog.tokenId}`} 
            key={blog.tokenId}
            className="trending-blog-item"
          >
            <div className="trending-blog-rank">{index + 1}</div>
            <div className="trending-blog-image">
              <img 
                src={blog.metadata.image || defaultImage} 
                alt={blog.metadata.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = defaultImage;
                }}
              />
              {filter === 'recent' && index === 0 && (
                <div className="trending-blog-badge">New</div>
              )}
            </div>
            <div className="trending-blog-content">
              <h4 className="trending-blog-title">{blog.metadata.name}</h4>
              <div className="trending-blog-meta">
                <span className="trending-blog-author">
                  By {formatAddress(blog.metadata.properties.authorAddress, 4, 4)}
                </span>
                <span className="trending-blog-date">
                  {formatDate(blog.createdAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="trending-blogs-footer">
        <Link to="/blogs" className="view-all-link">
          View All Blogs
        </Link>
      </div>
    </div>
  );
};

export default TrendingBlogs;