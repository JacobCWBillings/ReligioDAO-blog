// src/components/VirtualizedBlogList.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BlogNFT } from '../types/blockchain';
import { BlogCard } from './BlogCard';
import './VirtualizedBlogList.css';

interface VirtualizedBlogListProps {
  blogs: BlogNFT[];
  itemHeight: number;
  containerHeight?: number;
  showProposalStatus?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export const VirtualizedBlogList: React.FC<VirtualizedBlogListProps> = ({
  blogs,
  itemHeight,
  containerHeight = 800,
  showProposalStatus = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleBlogs, setVisibleBlogs] = useState<BlogNFT[]>([]);
  
  // Calculate which items should be visible based on scroll position
  const updateVisibleItems = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const viewportHeight = containerRef.current.clientHeight;
    
    // Add buffer on top and bottom so items don't pop in and out too abruptly
    const bufferSize = 3;
    
    // Calculate the range of visible items
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
    const endIndex = Math.min(
      blogs.length - 1,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + bufferSize
    );
    
    // Get visible blogs
    const visible = blogs.slice(startIndex, endIndex + 1);
    setVisibleBlogs(visible);
    
    // Check if we should load more blogs
    if (
      hasMore &&
      onLoadMore &&
      !loadingMore &&
      endIndex > blogs.length - 5 // Load more when 5 or fewer items remain
    ) {
      onLoadMore();
    }
  }, [blogs, itemHeight, hasMore, onLoadMore, loadingMore]);
  
  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    // Update scroll position
    setScrollTop(containerRef.current.scrollTop);
    
    // Update visible items
    updateVisibleItems();
  }, [updateVisibleItems]);
  
  // Update visible items when blogs change
  useEffect(() => {
    updateVisibleItems();
  }, [blogs, updateVisibleItems]);
  
  // Calculate total height for the scrollable area
  const totalHeight = blogs.length * itemHeight;
  
  // Calculate positions for each visible blog
  const blogItems = visibleBlogs.map((blog, index) => {
    const originalIndex = blogs.findIndex(b => b.tokenId === blog.tokenId);
    const top = originalIndex * itemHeight;
    
    return (
      <div
        key={blog.tokenId}
        className="virtualized-blog-item"
        style={{
          position: 'absolute',
          top: `${top}px`,
          height: `${itemHeight}px`,
          width: '100%'
        }}
      >
        <BlogCard blog={blog} showProposalStatus={showProposalStatus} />
      </div>
    );
  });
  
  return (
    <div 
      ref={containerRef}
      className="virtualized-blog-container"
      style={{ height: `${containerHeight}px` }}
      onScroll={handleScroll}
    >
      <div
        className="virtualized-blog-content"
        style={{ height: `${totalHeight}px`, position: 'relative' }}
      >
        {blogItems}
        
        {loadingMore && (
          <div className="virtualized-loading-indicator">
            <div className="loading-spinner"></div>
            <p>Loading more...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualizedBlogList;