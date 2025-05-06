// src/components/skeletons/Skeleton.tsx
import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  type?: 'text' | 'title' | 'avatar' | 'thumbnail' | 'button' | 'card' | 'banner';
  width?: string;
  height?: string;
  count?: number;
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  type = 'text',
  width,
  height,
  count = 1,
  circle = false,
  className = ''
}) => {
  // Function to determine appropriate default dimensions based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'title':
        return { width: width || '70%', height: height || '32px' };
      case 'avatar':
        return { width: width || '40px', height: height || '40px', borderRadius: '50%' };
      case 'thumbnail':
        return { width: width || '100%', height: height || '200px' };
      case 'button':
        return { width: width || '100px', height: height || '40px', borderRadius: '4px' };
      case 'card':
        return { width: width || '100%', height: height || '300px' };
      case 'banner':
        return { width: width || '100%', height: height || '300px' };
      case 'text':
      default:
        return { width: width || '100%', height: height || '16px' };
    }
  };

  // Create a style object based on props and type
  const styles = {
    ...getTypeStyles(),
    borderRadius: circle ? '50%' : '',
  };
  
  // Create multiple skeleton elements if count > 1
  const elements = [];
  for (let i = 0; i < count; i++) {
    elements.push(
      <div 
        key={i} 
        className={`skeleton-pulse ${className}`} 
        style={{
          ...styles, 
          marginBottom: i < count - 1 ? '8px' : '0',
        }}
      />
    );
  }
  
  return <>{elements}</>;
};

export default Skeleton;

// Specialized skeleton components for different use cases

export const BlogCardSkeleton: React.FC = () => {
  return (
    <div className="blog-card blog-card-skeleton">
      <div className="blog-card-image-container">
        <Skeleton type="thumbnail" />
      </div>
      <div className="blog-card-content" style={{ padding: '20px' }}>
        <Skeleton type="title" width="90%" />
        <Skeleton type="text" count={3} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
          <Skeleton width="30%" />
          <Skeleton width="30%" />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <Skeleton width="20%" height="24px" />
          <Skeleton width="25%" height="24px" />
          <Skeleton width="15%" height="24px" />
        </div>
      </div>
    </div>
  );
};

export const BlogDetailSkeleton: React.FC = () => {
  return (
    <div className="blog-detail-skeleton">
      <Skeleton type="banner" height="400px" />
      <div style={{ padding: '40px' }}>
        <Skeleton type="title" width="40%" height="24px" />
        <Skeleton type="title" width="70%" height="36px" />
        <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
          <Skeleton width="80px" height="24px" />
          <Skeleton width="80px" height="24px" />
          <Skeleton width="80px" height="24px" />
        </div>
        <div style={{ marginTop: '40px' }}>
          <Skeleton count={5} />
          <div style={{ margin: '20px 0' }}>
            <Skeleton type="thumbnail" height="300px" />
          </div>
          <Skeleton count={8} />
        </div>
      </div>
    </div>
  );
};

export const BlogListSkeleton: React.FC = () => {
  return (
    <div className="blog-grid">
      {[...Array(6)].map((_, index) => (
        <BlogCardSkeleton key={index} />
      ))}
    </div>
  );
};


export const ProposalListSkeleton: React.FC = () => {
  return (
    <div className="proposal-skeleton">
      {Array(3).fill(0).map((_, index) => (
        <div key={index} className="proposal-card-skeleton">
          <div className="proposal-header-skeleton">
            <div className="proposal-title-skeleton"></div>
            <div className="proposal-status-skeleton"></div>
          </div>
          <div className="proposal-description-skeleton">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line" style={{ width: '70%' }}></div>
          </div>
          <div className="vote-progress-skeleton">
            <div className="progress-bar-skeleton"></div>
            <div className="vote-counts-skeleton">
              <div className="vote-count-skeleton"></div>
              <div className="vote-count-skeleton"></div>
            </div>
          </div>
          <div className="proposal-footer-skeleton">
            <div className="proposer-skeleton"></div>
            <div className="date-skeleton"></div>
          </div>
        </div>
      ))}
    </div>
  );
};