import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../../contexts/GlobalStateContext';
import { Article } from '../../libetherjot';
import './BlogListPage.css';

export const BlogListPage: React.FC = () => {
    const { globalState } = useGlobalState();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Get unique categories from all articles
    const categories = ['all', ...new Set(globalState.articles.map(article => article.category))];

    // Filter articles based on category and search term
    useEffect(() => {
        let filtered = [...globalState.articles];
        
        // Apply category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(article => article.category === selectedCategory);
        }
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(article => 
                article.title.toLowerCase().includes(term) || 
                article.preview.toLowerCase().includes(term) ||
                article.tags.some(tag => tag.toLowerCase().includes(term))
            );
        }
        
        // Sort by date, newest first
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        
        setFilteredArticles(filtered);
    }, [selectedCategory, searchTerm, globalState.articles]);

    return (
        <div className="blog-list-page">
            <div className="blogs-header">
                <h1>Community Blogs</h1>
                <p>Browse articles from the ReligioDAO community</p>
            </div>

            <div className="filter-section">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search blogs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="category-filters">
                    {categories.map(category => (
                        <button
                            key={category}
                            className={`category-filter ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {filteredArticles.length > 0 ? (
                <div className="blog-grid">
                    {filteredArticles.map((article, index) => {
                        // Get banner image URL
                        const bannerAsset = article.banner 
                            ? globalState.assets.find(x => x.reference === article.banner) 
                            : null;
                        const bannerSrc = bannerAsset 
                            ? `http://localhost:1633/bytes/${article.banner}` 
                            : '/etherjot/default.png';
                            
                        return (
                            <div key={index} className="blog-card">
                                <div className="blog-card-image">
                                    <img src={bannerSrc} alt={article.title} />
                                </div>
                                <div className="blog-card-content">
                                    <div className="blog-card-category">{article.category}</div>
                                    <h2 className="blog-card-title">{article.title}</h2>
                                    <p className="blog-card-preview">{article.preview}</p>
                                    <div className="blog-card-tags">
                                        {article.tags.map((tag, i) => (
                                            <span key={i} className="blog-tag">{tag}</span>
                                        ))}
                                    </div>
                                    <div className="blog-card-footer">
                                        <span className="blog-date">
                                            {new Date(article.createdAt).toLocaleDateString()}
                                        </span>
                                        <Link to={`/blogs/${article.path.replace('post/', '')}`} className="read-more">
                                            Read More
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="no-blogs">
                    <p>No blogs found matching your criteria.</p>
                    {selectedCategory !== 'all' || searchTerm ? (
                        <button 
                            className="clear-filters-button"
                            onClick={() => {
                                setSelectedCategory('all');
                                setSearchTerm('');
                            }}
                        >
                            Clear Filters
                        </button>
                    ) : null}
                </div>
            )}
        </div>
    );
};