// src/pages/viewer/BlogDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { useWallet } from '../../contexts/WalletContext';
import { marked } from 'marked';
import { getContentUrl } from '../../config';
import './BlogDetailPage.css';

export const BlogDetailPage: React.FC = () => {
  const { blogId } = useParams<{ blogId: string }>();
  const navigate = useNavigate();
  const { getNFTById } = useBlogNFT();
  const { account, isConnected } = useWallet();
  
  const [blogContent, setBlogContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blog, setBlog] = useState<any>(null);

  // Fetch blog data when the component mounts
  useEffect(() => {
    let mounted = true; // For cleanup
    
    const fetchBlog = async () => {
      if (!blogId) {
        setError('Blog ID not provided');
        setLoading(false);
        return;
      }

      try {
        const blogData = await getNFTById(blogId);
        
        if (!mounted) return; // Component unmounted, skip updating state
        
        if (!blogData) {
          setError('Blog not found');
          setLoading(false);
          return;
        }
        
        setBlog(blogData);
        await fetchBlogContent(blogData.contentReference);
      } catch (err) {
        console.error('Error fetching blog:', err);
        
        if (!mounted) return; // Component unmounted
        
        if (err instanceof Error && err.message.includes('Contract not initialized')) {
          // Try again in a bit if contract isn't ready
          setTimeout(fetchBlog, 1000);
        } else if (err instanceof Error && err.message.includes('token does not exist')) {
          setError('Blog not found');
          setLoading(false);
        } else {
          setError('Failed to load blog');
          setLoading(false);
        }
      }
    };

    // Initial delay to ensure contract is initialized
    setTimeout(fetchBlog, 500);
    
    return () => {
      mounted = false; // Cleanup
    };
  }, [blogId, getNFTById]);

  // Fetch the actual blog content from Swarm
  const fetchBlogContent = async (contentReference: string) => {
    try {
      // Construct the URL to fetch from Swarm
      const contentUrl = getContentUrl(contentReference);
      
      // Fetch the content
      const response = await fetch(contentUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch blog content: ${response.statusText}`);
      }
      
      // Get the content as text
      const contentText = await response.text();
      
      // Parse markdown to HTML
      const htmlContent = marked(contentText);
      
      setBlogContent(htmlContent);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching blog content:', err);
      setError('Failed to load blog content');
      setLoading(false);
    }
  };

  // Handle edit button click
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

  // Get appropriate image URL
  const getImageUrl = (imageUri: string) => {
    if (!imageUri) return '/etherjot/default.png';
    
    return imageUri.startsWith('http') 
      ? imageUri 
      : imageUri.startsWith('ipfs://') 
        ? `https://ipfs.io/ipfs/${imageUri.replace('ipfs://', '')}` 
        : imageUri.startsWith('data:') 
          ? imageUri 
          : '/etherjot/default.png';
  };

  if (loading) {
    return <div className="loading">Loading blog...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>{error}</h2>
        <Link to="/blogs" className="back-link">Back to Blogs</Link>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="error-container">
        <h2>Blog not found</h2>
        <Link to="/blogs" className="back-link">Back to Blogs</Link>
      </div>
    );
  }

  // Get tags from metadata
  const tags = blog.metadata.properties.tags && Array.isArray(blog.metadata.properties.tags) 
    ? blog.metadata.properties.tags 
    : [];

  return (
    <div className="blog-detail-page">
      <div className="blog-banner">
        <img 
          src={getImageUrl(blog.metadata.image)} 
          alt={blog.metadata.name} 
          onError={(e) => {
            // Fallback to default image on error
            (e.target as HTMLImageElement).src = '/etherjot/default.png';
          }}
        />
      </div>
      
      <div className="blog-content-container">
        <div className="blog-header">
          <div className="blog-metadata">
            {blog.metadata.properties.category && (
              <span className="blog-category">{blog.metadata.properties.category}</span>
            )}
            <span className="blog-date">{formatDate(blog.createdAt)}</span>
          </div>
          
          <h1 className="blog-title">{blog.metadata.name}</h1>
          
          {tags.length > 0 && (
            <div className="blog-tags">
              {tags.map((tag: string, index: number) => (
                <span key={index} className="blog-tag">{tag}</span>
              ))}
            </div>
          )}
          
          {isConnected && account && (
            <div className="blog-actions">
              <button onClick={handleEdit} className="edit-button">
                Edit Blog
              </button>
            </div>
          )}
        </div>
        
        <div 
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: blogContent }}
        />
        
        <div className="blog-footer">
          <Link to="/blogs" className="back-to-blogs">
            ← Back to all blogs
          </Link>
          
          <div className="blog-author">
            <span>Published by: </span>
            <span className="author-address">
              {blog.metadata.properties.authorAddress 
                ? `${blog.metadata.properties.authorAddress.substring(0, 6)}...${blog.metadata.properties.authorAddress.substring(38)}`
                : 'Unknown'
              }
            </span>
          </div>
          
          <div className="blog-share">
            <span>Share:</span>
            <button 
              className="share-button" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
              }}
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogDetailPage;