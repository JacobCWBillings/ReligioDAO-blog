import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Bee } from '@ethersphere/bee-js';
import { marked } from 'marked';
import { useGlobalState } from '../../contexts/GlobalStateContext';
import { useWallet } from '../../contexts/WalletContext';
import { Article } from '../../libetherjot';
import './BlogDetailPage.css';

export const BlogDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { blogId } = useParams();
    const { globalState } = useGlobalState();
    const { isConnected, account } = useWallet();
    
    const [article, setArticle] = useState<Article | null>(null);
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Find the article based on the URL parameter
    useEffect(() => {
        if (blogId && globalState.articles) {
            const foundArticle = globalState.articles.find(a => 
                a.path.includes(blogId) || a.path.replace('post/', '') === blogId
            );
            
            if (foundArticle) {
                setArticle(foundArticle);
            } else {
                setError('Blog post not found');
                setLoading(false);
            }
        }
    }, [blogId, globalState.articles]);

    // Fetch the article content from Swarm
    useEffect(() => {
        const fetchArticleContent = async () => {
            if (!article) return;
            
            try {
                const bee = new Bee('http://localhost:1633');
                const markdownResponse = await bee.downloadFile(article.markdown);
                const markdownText = markdownResponse.data.text();
                const htmlContent = marked(markdownText);
                
                setContent(htmlContent);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching article content:', err);
                setError('Failed to load blog content');
                setLoading(false);
            }
        };

        if (article) {
            fetchArticleContent();
        }
    }, [article]);

    // Get banner image URL
    const getBannerUrl = () => {
        if (!article || !article.banner) return '/etherjot/default.png';
        
        const bannerAsset = globalState.assets.find(x => x.reference === article.banner);
        return bannerAsset 
            ? `http://localhost:1633/bytes/${article.banner}` 
            : '/etherjot/default.png';
    };

    // Handle edit button click
    const handleEdit = () => {
        if (article) {
            navigate(`/editor/${article.path.replace('post/', '')}`);
        }
    };

    if (loading) {
        return <div className="loading">Loading blog post...</div>;
    }

    if (error) {
        return (
            <div className="error-container">
                <h2>{error}</h2>
                <Link to="/blogs" className="back-link">Back to Blogs</Link>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="error-container">
                <h2>Blog post not found</h2>
                <Link to="/blogs" className="back-link">Back to Blogs</Link>
            </div>
        );
    }

    return (
        <div className="blog-detail-page">
            <div className="blog-banner">
                <img src={getBannerUrl()} alt={article.title} />
            </div>
            
            <div className="blog-content-container">
                <div className="blog-header">
                    <div className="blog-metadata">
                        <span className="blog-category">{article.category}</span>
                        <span className="blog-date">
                            {new Date(article.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </span>
                    </div>
                    
                    <h1 className="blog-title">{article.title}</h1>
                    
                    <div className="blog-tags">
                        {article.tags.map((tag, index) => (
                            <span key={index} className="blog-tag">{tag}</span>
                        ))}
                    </div>
                    
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
                    dangerouslySetInnerHTML={{ __html: content }}
                />
                
                <div className="blog-footer">
                    <Link to="/blogs" className="back-to-blogs">
                        ← Back to all blogs
                    </Link>
                    
                    <div className="blog-share">
                        <span>Share:</span>
                        <button className="share-button" onClick={() => navigator.clipboard.writeText(window.location.href)}>
                            Copy Link
                        </button>
                        {/* Additional share buttons could be added here */}
                    </div>
                </div>
            </div>
        </div>
    );
};