// src/pages/viewer/BlogDetailPage.tsx - Fixed version
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { formatAddress } from '../../blockchain/utils/walletUtils';
import { BlogDetailSkeleton } from '../../components/skeletons/Skeleton';
import swarmContentService from '../../services/SwarmContentService';
import './BlogDetailPage.css';

export const BlogDetailPage: React.FC = () => {
  const { blogId } = useParams<{ blogId: string }>();
  const navigate = useNavigate();
  const { getNFTById } = useBlogNFT();
  const { getProposalById } = useProposal();
  const { account, isConnected } = useWallet();
  
  const [blogContent, setBlogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [contentLoading, setContentLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blog, setBlog] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<any[]>([]);
  const [fetchAttempted, setFetchAttempted] = useState<boolean>(false);

  // Fetch blog data when the component mounts
  useEffect(() => {
    let isMounted = true; // Flag to track if component is mounted
    
    const fetchBlog = async () => {
      if (!blogId) {
        if (isMounted) {
          setError('Blog ID not provided');
          setLoading(false);
        }
        return;
      }

      try {
        const blogData = await getNFTById(blogId);
        
        if (!isMounted) return; // Skip state updates if unmounted
        
        if (!blogData) {
          console.error('Blog not found for ID:', blogId);
          setError('Blog not found');
          setLoading(false);
          return;
        }
        
        console.log('Retrieved blog data:', blogData);
        setBlog(blogData);
        setError(null); // Clear any previous errors
        setLoading(false);
        
        // If the blog has a proposal ID, fetch proposal details
        if (blogData.proposalId) {
          try {
            const proposalData = await getProposalById(blogData.proposalId);
            if (isMounted && proposalData) {
              setProposal(proposalData);
            }
          } catch (err) {
            console.warn('Failed to fetch proposal details:', err);
            // Non-critical error, don't set global error state
          }
        }
        
        // Extract and validate content reference
        if (blogData.contentReference && typeof blogData.contentReference === 'string') {
          const contentRef = blogData.contentReference.trim();
          
          if (contentRef) {
            console.log(`Extracted content reference from blog metadata: ${contentRef}`);
            // Fetch blog content
            if (isMounted) {
              fetchBlogContent(contentRef);
            }
          } else {
            console.error('Content reference is empty in blog metadata');
            if (isMounted) {
              setError('Blog content reference is missing');
              setContentLoading(false);
            }
          }
        } else if (blogData.metadata?.properties?.contentReference && 
                  typeof blogData.metadata.properties.contentReference === 'string') {
          // Try fallback to nested content reference
          const contentRef = blogData.metadata.properties.contentReference.trim();
          
          if (contentRef) {
            console.log(`Using nested content reference from metadata properties: ${contentRef}`);
            if (isMounted) {
              fetchBlogContent(contentRef);
            }
          } else {
            console.error('Nested content reference is empty');
            if (isMounted) {
              setError('Blog content reference is missing');
              setContentLoading(false);
            }
          }
        } else {
          console.error('No content reference found in blog metadata');
          if (isMounted) {
            setError('Blog content reference is missing');
            setContentLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching blog:', err);
        
        if (!isMounted) return; // Skip state updates if unmounted
        
        setError(err instanceof Error && err.message.includes('token does not exist') 
          ? 'Blog not found' 
          : 'Failed to load blog');
        setLoading(false);
      }
    };

    // Fetch blog data
    fetchBlog();
    
    return () => {
      isMounted = false; // Cleanup function to handle unmounting
    };
  }, [blogId, getNFTById, getProposalById]);

  // Fetch the blog content from Swarm using our service
  // Updated fetchBlogContent function for BlogDetailPage.tsx
  const fetchBlogContent = async (contentReference: string) => {
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
      console.log(`Fetching blog content for reference: ${contentReference}`);
      
      // Use our standardized SwarmContentService
      const html = await swarmContentService.getContentAsHtml(contentReference);
      
      if (!html || html.trim() === '') {
        console.error('Retrieved empty content from Swarm');
        setError('Blog content is empty');
      } else {
        console.log('Successfully retrieved blog content');
        setBlogContent(html);
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      console.error('Error fetching blog content:', err);
      setError(`Failed to load blog content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setContentLoading(false);
    }
  };

  // Handle edit button click (only available to blog author)
  const handleEdit = () => {
    navigate(`/editor/${blogId}`);
  };

  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Determine if current user is the blog author
  const isAuthor = React.useMemo(() => {
    if (!isConnected || !account || !blog) return false;
    
    const authorAddress = blog.metadata?.properties?.authorAddress;
    return authorAddress && authorAddress.toLowerCase() === account.toLowerCase();
  }, [account, blog, isConnected]);

  // Handle share button click
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    // Show a toast or alert
    alert('Link copied to clipboard!');
  };
  
  // Handle retry content loading
  const handleRetryContentLoad = async () => {
    if (!blog) return;
    
    setError(null);
    setContentLoading(true);
    setFetchAttempted(false);
    
    // Extract content reference and retry
    const contentRef = blog.contentReference || 
                      (blog.metadata?.properties?.contentReference || '');
    
    if (contentRef.trim()) {
      // Clear from cache to force fresh fetch
      swarmContentService.removeFromCache(contentRef);
      fetchBlogContent(contentRef);
    } else {
      setError('Blog content reference is missing');
      setContentLoading(false);
    }
  };

  // If loading the blog, show skeleton
  if (loading) {
    return <BlogDetailSkeleton />;
  }

  // If error and no blog, show error state
  if (error && !blog) {
    return (
      <div className="blog-error-container">
        <h2>Oops! Something went wrong</h2>
        <p>{error}</p>
        <div className="blog-error-actions">
          <button onClick={() => window.location.reload()}>Try Again</button>
          <Link to="/blogs" className="back-link">Back to Blogs</Link>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="blog-error-container">
        <h2>Blog not found</h2>
        <p>The blog you're looking for doesn't exist or has been removed.</p>
        <Link to="/blogs" className="back-link">Back to Blogs</Link>
      </div>
    );
  }

  // Get tags from metadata
  const tags = blog.metadata?.properties?.tags && Array.isArray(blog.metadata.properties.tags) 
    ? blog.metadata.properties.tags 
    : [];

  return (
    <div className="blog-detail-page">
      {/* Blog Banner */}
      <div className="blog-banner">
        <img 
          src={blog.metadata.image} 
          alt={blog.metadata.name} 
          onError={(e) => {
            // Fallback to default image on error
            (e.target as HTMLImageElement).src = '/public/default.png';
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
            
            {proposal && (
              <span className="blog-approval-date">
                Approved: {formatDate(new Date(proposal.createdAt).getTime())}
              </span>
            )}
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
        
        {/* Content Reference Debug Info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="content-debug-info" style={{background: '#f8f8f8', padding: '10px', marginBottom: '20px', fontSize: '12px', fontFamily: 'monospace'}}>
            <div>Content Reference: {blog.contentReference || 'Not directly available'}</div>
            <div>Nested Reference: {blog.metadata?.properties?.contentReference || 'Not available in properties'}</div>
          </div>
        )}
        
        {/* Blog Content */}
        {contentLoading ? (
          <div className="blog-content-loading">
            <div className="loading-spinner"></div>
            <p>Loading content...</p>
          </div>
        ) : error ? (
          <div className="blog-content-error">
            <p>{error}</p>
            <button onClick={handleRetryContentLoad} className="retry-button">
              Retry Loading Content
            </button>
          </div>
        ) : blogContent ? (
          <div 
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: blogContent }}
          />
        ) : (
          <div className="blog-content-error">
            <p>Content could not be loaded. The content may be unavailable or has been removed from Swarm storage.</p>
            <button onClick={handleRetryContentLoad} className="retry-button">
              Retry Loading Content
            </button>
          </div>
        )}
        
        {/* Blog Footer */}
        <div className="blog-footer">
          <Link to="/blogs" className="back-to-blogs">
            ← Back to all blogs
          </Link>
          
          <div className="blog-token-info">
            <div className="blog-token-id">
              Token ID: {blog.tokenId}
            </div>
            <div className="blog-owner">
              Owner: {formatAddress(blog.owner, 6, 4)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Related Blogs Section */}
      {relatedBlogs.length > 0 && (
        <div className="related-blogs-section">
          <h3>Related Blogs</h3>
          <div className="related-blogs-grid">
            {relatedBlogs.map(relatedBlog => (
              <div key={relatedBlog.tokenId} className="related-blog-card">
                <Link to={`/blogs/${relatedBlog.tokenId}`}>
                  <img 
                    src={relatedBlog.metadata.image || '/public/default.png'} 
                    alt={relatedBlog.metadata.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/public/default.png';
                    }}
                  />
                  <h4>{relatedBlog.metadata.name}</h4>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogDetailPage;