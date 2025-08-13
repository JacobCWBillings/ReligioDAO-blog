// src/pages/viewer/BlogDetailPage.tsx - Fixed with correct contentReference access
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { formatAddress } from '../../utils/walletUtils';
import { BlogDetailSkeleton } from '../../components/skeletons/Skeleton';
import { services } from '../../swarm/services'; // Use new service architecture
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
  const [fetchAttempted, setFetchAttempted] = useState<boolean>(false);
  const [relatedBlogs, setRelatedBlogs] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Enhanced fetch blog content with better error handling and debugging
  const fetchBlogContent = useCallback(async (contentReference: string) => {
    if (!contentReference || contentReference.trim() === '') {
      setError('Blog content reference not found');
      setContentLoading(false);
      return;
    }
    
    // Avoid double fetch
    if (fetchAttempted) return;
    setFetchAttempted(true);
    
    try {
      setContentLoading(true);
      setError(null);
      console.log(`Fetching blog content for reference: ${contentReference}`);
      
      // Add debug information
      setDebugInfo(`Attempting to fetch content with reference: ${contentReference}`);
      
      // Use the enhanced ContentService with proper blog handling
      const html = await services.content.getContentAsHtml(contentReference);
      
      if (!html || html.trim() === '') {
        console.error('Retrieved empty content from Swarm');
        setError('Blog content is empty');
        setDebugInfo('Retrieved empty content from Swarm');
      } else {
        console.log('Successfully retrieved blog content');
        
        // FIXED: Check if content looks like proper HTML
        if (html.includes('<!DOCTYPE html>') || html.includes('<html')) {
          setBlogContent(html);
          setError(null);
          setDebugInfo(`Successfully loaded HTML content (${html.length} characters)`);
        } else if (html.includes('{"website-index-document"') || html.includes('\x00')) {
          // This indicates we got binary/collection data instead of HTML
          console.error('Received binary/collection data instead of HTML. This suggests an endpoint mismatch.');
          setError('Content format error: Received collection metadata instead of HTML. The blog may need to be re-uploaded or the content service needs fixing.');
          setDebugInfo('ERROR: Received binary collection data. Check console for technical details.');
          
          // Log technical details for debugging
          console.error('Raw content preview:', html.substring(0, 200));
          console.error('Content reference:', contentReference);
          console.error('This usually means the content was uploaded as a collection but is being accessed as raw bytes.');
        } else {
          // Content doesn't look like HTML but isn't binary either
          console.warn('Content doesn\'t appear to be proper HTML');
          setBlogContent(html); // Still try to display it
          setDebugInfo(`Loaded content that may not be proper HTML (${html.length} characters)`);
        }
      }
    } catch (err) {
      console.error('Error fetching blog content:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load blog content: ${errorMessage}`);
      setDebugInfo(`ERROR: ${errorMessage}`);
      
      // Additional debugging for common issues
      if (errorMessage.includes('Failed to download blog HTML')) {
        setDebugInfo(prev => prev + '\n\nTip: This error suggests the content was uploaded as a Swarm collection but the download is using the wrong endpoint. Check ContentService.downloadBlogHtml method.');
      }
    } finally {
      setContentLoading(false);
    }
  }, [fetchAttempted]);

  // Fetch blog metadata from blockchain
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
      
      // FIXED: Extract content reference from the correct location
      // BlogNFT interface has contentReference as a top-level property
      const contentRef = blogData.contentReference || 
                        blogData.metadata?.properties?.contentReference;
      
      if (contentRef) {
        console.log('Extracted content reference from blog data:', contentRef);
        await fetchBlogContent(contentRef);
      } else {
        console.error('No content reference found in blog data');
        setError('Blog content reference not found');
        setDebugInfo('No contentReference found in blog data. Check BlogNFT structure.');
      }
      
    } catch (err) {
      console.error('Error fetching blog data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load blog: ${errorMessage}`);
      setDebugInfo(`Blog fetch error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [getNFTById, fetchBlogContent]);

  // Load blog on component mount
  useEffect(() => {
    if (blogId) {
      fetchBlogData(blogId);
    } else {
      setError('No blog ID provided');
      setLoading(false);
    }
  }, [blogId, fetchBlogData]);

  // Handler functions
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

  const handleRetry = () => {
    if (blog?.contentReference) {
      setFetchAttempted(false);
      setError(null);
      setBlogContent('');
      setDebugInfo('Clearing cache and retrying...');
      
      // Clear the cached content for this reference
      services.content.removeFromCache(blog.contentReference);
      fetchBlogContent(blog.contentReference);
    } else if (blogId) {
      // Retry the entire process
      setFetchAttempted(false);
      setBlog(null);
      setBlogContent('');
      setError(null);
      setDebugInfo('Retrying blog data fetch...');
      fetchBlogData(blogId);
    }
  };

  const handleForceRefresh = async () => {
    if (!blog?.contentReference) return;
    
    try {
      setContentLoading(true);
      setError(null);
      setDebugInfo('Force refreshing content...');
      
      const html = await services.content.forceRefreshContent(blog.contentReference);
      setBlogContent(html);
      setDebugInfo('Content force refreshed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Force refresh failed: ${errorMessage}`);
      setDebugInfo(`Force refresh error: ${errorMessage}`);
    } finally {
      setContentLoading(false);
    }
  };

  // Show loading skeleton while fetching
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
            {debugInfo && (
              <details style={{ marginTop: '20px' }}>
                <summary>Debug Information</summary>
                <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  {debugInfo}
                </pre>
              </details>
            )}
            <button onClick={handleRetry} style={{ marginTop: '20px' }}>
              Retry
            </button>
            <button onClick={() => navigate('/blogs')} style={{ marginTop: '10px', marginLeft: '10px' }}>
              Back to Blogs
            </button>
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

  // Helper functions
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isAuthor = account && blog.owner && 
    account.toLowerCase() === blog.owner.toLowerCase();

  const tags = blog.metadata?.properties?.tags || 
    (Array.isArray(blog.metadata?.tags) ? blog.metadata.tags : []);

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
              By: {formatAddress(blog.metadata?.properties?.authorAddress, 6, 4)}
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
          </div>
        </div>

        {/* Blog Content */}
        <div className="blog-content-section">
          {contentLoading ? (
            <div className="content-loading">
              <div className="loading-spinner"></div>
              <p>Loading blog content...</p>
              {debugInfo && (
                <p style={{ fontSize: '12px', color: '#666' }}>{debugInfo}</p>
              )}
            </div>
          ) : error ? (
            <div className="content-error">
              <h3>Content Loading Error</h3>
              <p>{error}</p>
              {debugInfo && (
                <details style={{ marginTop: '15px' }}>
                  <summary>Technical Details</summary>
                  <pre style={{ background: '#fff5f5', padding: '10px', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                    {debugInfo}
                  </pre>
                </details>
              )}
              <div style={{ marginTop: '15px' }}>
                <button onClick={handleRetry} className="retry-button">
                  Retry Loading Content
                </button>
                {blog.contentReference && (
                  <div style={{ marginTop: '10px', fontSize: '12px' }}>
                    <p>Content Reference: <code>{blog.contentReference}</code></p>
                    <p>
                      Direct Link: 
                      <a 
                        href={`http://localhost:1633/bzz/${blog.contentReference}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ marginLeft: '5px' }}
                      >
                        Open in Swarm
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
              <button onClick={handleRetry} className="retry-button">
                Retry Loading
              </button>
            </div>
          )}
        </div>

        {/* Debug Panel (only show in development or when there are issues) */}
        {(process.env.NODE_ENV === 'development' || error || debugInfo) && (
          <details className="debug-panel" style={{ marginTop: '40px', fontSize: '12px' }}>
            <summary>Debug Information</summary>
            <div style={{ background: '#f8f8f8', padding: '15px', marginTop: '10px' }}>
              <h4>Blog Data:</h4>
              <pre>{JSON.stringify(blog, null, 2)}</pre>
              
              <h4>Status:</h4>
              <ul>
                <li>Blog ID: {blogId}</li>
                <li>Content Reference: {blog?.contentReference || 'Not found'}</li>
                <li>Content Loading: {contentLoading ? 'Yes' : 'No'}</li>
                <li>Content Length: {blogContent.length} characters</li>
                <li>Error: {error || 'None'}</li>
              </ul>
              
              {debugInfo && (
                <>
                  <h4>Debug Log:</h4>
                  <pre>{debugInfo}</pre>
                </>
              )}
              
              <h4>Helpful Links:</h4>
              <ul>
                {blog?.contentReference && (
                  <>
                    <li>
                      <a href={`http://localhost:1633/bzz/${blog.contentReference}`} target="_blank" rel="noopener noreferrer">
                        Local Swarm (bzz)
                      </a>
                    </li>
                    <li>
                      <a href={`http://localhost:1633/bytes/${blog.contentReference}`} target="_blank" rel="noopener noreferrer">
                        Local Swarm (bytes)
                      </a>
                    </li>
                    <li>
                      <a href={`https://api.gateway.ethswarm.org/bzz/${blog.contentReference}`} target="_blank" rel="noopener noreferrer">
                        Public Swarm (bzz)
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </details>
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