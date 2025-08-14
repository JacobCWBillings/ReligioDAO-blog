// src/pages/viewer/BlogDetailPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { formatAddress } from '../../utils/walletUtils';
import { BlogDetailSkeleton } from '../../components/skeletons/Skeleton';
import { services } from '../../swarm/services'; // Use new unified service container
import defaultImage from '../../static/media/default.jpg';
import './BlogDetailPage.css';

export const BlogDetailPage: React.FC = () => {
  const { blogId } = useParams<{ blogId: string }>();
  const navigate = useNavigate();
  const { getNFTById } = useBlogNFT();
  const { getProposalById } = useProposal();
  const { account, isConnected } = useWallet();
  
  // Component state
  const [blogContent, setBlogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [contentLoading, setContentLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blog, setBlog] = useState<any>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<any[]>([]);
  
  // Diagnostic info for development
  const [diagnostics, setDiagnostics] = useState<{
    cacheStatus: string;
    downloadMethod: string;
    gatewayUsed: string;
  }>({
    cacheStatus: 'unknown',
    downloadMethod: 'unknown',
    gatewayUsed: 'unknown'
  });

  /**
   * Fetch blog content using new ContentService
   */
  const fetchBlogContent = useCallback(async (contentReference: string) => {
    if (!contentReference || contentReference.trim() === '') {
      setError('Blog content reference not found');
      setContentLoading(false);
      return;
    }
    
    try {
      setContentLoading(true);
      setError(null);
      
      console.log(`Fetching blog content for reference: ${contentReference}`);
      
      // Check cache status
      const cacheStats = services.content.getCacheStats();
      const isCached = cacheStats.entries.some(e => e.reference === contentReference);
      
      setDiagnostics(prev => ({
        ...prev,
        cacheStatus: isCached ? 'cached' : 'not cached'
      }));
      
      // Use the new ContentService method
      const html = await services.content.getContentAsHtml(contentReference);
      
      if (!html || html.trim() === '') {
        throw new Error('Retrieved empty content from Swarm');
      }
      
      setBlogContent(html);
      setError(null);
      
      // Update diagnostics
      setDiagnostics(prev => ({
        ...prev,
        downloadMethod: isCached ? 'from cache' : 'fresh download',
        gatewayUsed: isCached ? 'N/A' : 'see console'
      }));
      
      console.log('Successfully retrieved blog content');
      
    } catch (err) {
      console.error('Error fetching blog content:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Provide helpful error messages based on error type
      if (errorMessage.includes('Invalid content reference')) {
        setError('Invalid content reference format. The blog may be corrupted.');
      } else if (errorMessage.includes('Failed to download from all gateways')) {
        setError('Unable to access content. Please check your connection or try again later.');
      } else {
        setError(`Failed to load blog content: ${errorMessage}`);
      }
    } finally {
      setContentLoading(false);
    }
  }, []);

  /**
   * Fetch blog metadata from blockchain
   */
  const fetchBlogData = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching blog data for ID:', id);
      const blogData = await getNFTById(id);
      
      if (!blogData) {
        setError('Blog not found');
        return;
      }
      
      console.log('Retrieved blog data:', blogData);
      setBlog(blogData);
      
      // Extract content reference
      const contentRef = blogData.contentReference || 
                        blogData.metadata?.properties?.contentReference;
      
      if (contentRef) {
        console.log('Content reference found:', contentRef);
        await fetchBlogContent(contentRef);
      } else {
        console.error('No content reference found in blog data');
        setError('Blog content reference not found');
      }
      
    } catch (err) {
      console.error('Error fetching blog data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load blog: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [getNFTById, fetchBlogContent]);

  /**
   * Load blog on component mount
   */
  useEffect(() => {
    if (blogId) {
      fetchBlogData(blogId);
    } else {
      setError('No blog ID provided');
      setLoading(false);
    }
  }, [blogId, fetchBlogData]);

  /**
   * Handler functions
   */
  const handleEdit = () => {
    if (blog) {
      navigate(`/editor?edit=${blog.tokenId}`);
    }
  };

  const handleShare = async () => {
    if (navigator.share && blog) {
      try {
        await navigator.share({
          title: blog.metadata.name,
          text: blog.metadata.description,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
      alert('URL copied to clipboard!');
    }
  };

  const handleRefreshContent = async () => {
    if (blog?.contentReference) {
      try {
        setContentLoading(true);
        setError(null);
        
        // Force refresh using new service method
        const html = await services.content.forceRefreshContent(blog.contentReference);
        setBlogContent(html);
        
        setDiagnostics(prev => ({
          ...prev,
          cacheStatus: 'refreshed',
          downloadMethod: 'forced refresh'
        }));
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Refresh failed: ${errorMessage}`);
      } finally {
        setContentLoading(false);
      }
    }
  };

  const handleClearCache = () => {
    services.content.clearCache();
    setDiagnostics(prev => ({
      ...prev,
      cacheStatus: 'cleared'
    }));
    alert('Cache cleared. Refresh the page to reload content.');
  };

  // Helper functions
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isAuthor = account && blog?.owner && 
    account.toLowerCase() === blog.owner.toLowerCase();

  const tags = blog?.metadata?.properties?.tags || 
    (Array.isArray(blog?.metadata?.tags) ? blog.metadata.tags : []);

  // Show loading skeleton
  if (loading) {
    return <BlogDetailSkeleton />;
  }

  // Show error state
  if (error && !blog) {
    return (
      <div className="blog-detail-page">
        <div className="blog-content-container">
          <div className="error-state">
            <h2>Error Loading Blog</h2>
            <p>{error}</p>
            <div className="error-actions">
              <button onClick={() => window.location.reload()} className="retry-btn">
                Retry
              </button>
              <button onClick={() => navigate('/blogs')} className="back-btn">
                Back to Blogs
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="blog-detail-page">
        <div className="blog-content-container">
          <p>Blog not found.</p>
          <button onClick={() => navigate('/blogs')}>Back to Blogs</button>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-detail-page">
      {/* Blog Banner */}
      <div className="blog-banner">
        <img 
          src={blog.metadata.image} 
          alt={blog.metadata.name} 
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultImage;
          }}
        />
      </div>
      
      <div className="blog-content-container">
        {/* Blog Header */}
        <div className="blog-header">
          <div className="blog-metadata">
            {blog.metadata?.properties?.category && (
              <span className="blog-category">
                <Link to={`/blogs?category=${encodeURIComponent(blog.metadata.properties.category)}`}>
                  {blog.metadata.properties.category}
                </Link>
              </span>
            )}
            <span className="blog-date">{formatDate(blog.createdAt)}</span>
          </div>
          
          <h1 className="blog-title">{blog.metadata.name}</h1>
          
          {tags.length > 0 && (
            <div className="blog-tags">
              {tags.map((tag: string, index: number) => (
                <Link
                  key={index}
                  to={`/blogs?tag=${encodeURIComponent(tag)}`}
                  className="blog-tag"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
          
          <div className="blog-author-info">
            <div className="blog-author-address">
              By: {formatAddress(blog.metadata?.properties?.authorAddress || blog.owner, 6, 4)}
            </div>
            {isAuthor && (
              <div className="blog-author-badge">Author</div>
            )}
          </div>
          
          <div className="blog-actions">
            {isAuthor && (
              <button onClick={handleEdit} className="edit-button">
                Edit Blog
              </button>
            )}
            <button onClick={handleShare} className="share-button">
              Share
            </button>
            <button onClick={handleRefreshContent} className="refresh-button" disabled={contentLoading}>
              Refresh Content
            </button>
          </div>
        </div>

        {/* Blog Content */}
        <div className="blog-content-section">
          {contentLoading ? (
            <div className="content-loading">
              <div className="loading-spinner"></div>
              <p>Loading blog content...</p>
            </div>
          ) : error ? (
            <div className="content-error">
              <h3>Content Loading Error</h3>
              <p>{error}</p>
              <div className="error-actions">
                <button onClick={handleRefreshContent} className="retry-button">
                  Retry Loading
                </button>
                {blog.contentReference && (
                  <div className="content-reference-info">
                    <p>Content Reference: <code>{blog.contentReference}</code></p>
                    <p>
                      View on Swarm: 
                      <a 
                        href={services.swarm.getContentUrl(blog.contentReference, {
                          usePublicGateway: true,
                          forWebDisplay: true
                        })}
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ marginLeft: '5px' }}
                      >
                        Open in Browser
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : blogContent ? (
            <div 
              className="blog-content"
              dangerouslySetInnerHTML={{ __html: blogContent }}
            />
          ) : (
            <div className="no-content">
              <p>No content available for this blog.</p>
              <button onClick={handleRefreshContent} className="retry-button">
                Try Loading Again
              </button>
            </div>
          )}
        </div>

        {/* Cache Management (for development/debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="cache-management">
            <h4>Cache Management</h4>
            <div className="cache-stats">
              <p>Cache Status: {diagnostics.cacheStatus}</p>
              <p>Download Method: {diagnostics.downloadMethod}</p>
              <p>Gateway Used: {diagnostics.gatewayUsed}</p>
            </div>
            <button onClick={handleClearCache} className="clear-cache-btn">
              Clear All Cache
            </button>
          </div>
        )}

        {/* Related Blogs Section */}
        {relatedBlogs.length > 0 && (
          <div className="related-blogs">
            <h3>Related Blogs</h3>
            <div className="related-blogs-grid">
              {relatedBlogs.map(relatedBlog => (
                <Link
                  key={relatedBlog.tokenId}
                  to={`/blog/${relatedBlog.tokenId}`}
                  className="related-blog-card"
                >
                  <img src={relatedBlog.metadata.image} alt={relatedBlog.metadata.name} />
                  <h4>{relatedBlog.metadata.name}</h4>
                  <p>{relatedBlog.metadata.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogDetailPage;