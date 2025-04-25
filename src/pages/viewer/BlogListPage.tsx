// src/pages/viewer/BlogListPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { useWallet } from '../../contexts/WalletContext';
import { BlogCard } from '../../components/BlogCard';
import { BlogListSkeleton } from '../../components/skeletons/Skeleton';
import { BlogFilter, BlogSort } from '../../types/blockchain';
import './BlogListPage.css';

export const BlogListPage: React.FC = () => {
  const { 
    loading, 
    error, 
    totalSupply,
    categories,
    tags,
    getPaginatedNFTs,
    getPopularCategories
  } = useBlogNFT();
  
  const { isConnected } = useWallet();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [totalPages, setTotalPages] = useState(1);
  
  // Blog list state
  const [blogs, setBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  
  // Filter and sort state
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<BlogSort>({ field: 'createdAt', direction: 'desc' });
  
  // Display options state
  const [showFilters, setShowFilters] = useState(false);
  
  // Popular categories (for quick filter buttons)
  const [popularCategories, setPopularCategories] = useState<{ name: string; count: number }[]>([]);
  
  // Create filter object from selected filters
  const activeFilter = useMemo((): BlogFilter => {
    const filter: BlogFilter = {};
    if (selectedCategory) filter.category = selectedCategory;
    if (selectedTag) filter.tag = selectedTag;
    if (searchTerm) filter.searchTerm = searchTerm;
    return filter;
  }, [selectedCategory, selectedTag, searchTerm]);
  
  // Load blogs with pagination
  const loadBlogs = useCallback(async () => {
    setIsLoading(true);
    setHasError(null);
    
    try {
      const result = await getPaginatedNFTs(
        currentPage,
        pageSize,
        activeFilter,
        sortOption
      );
      
      setBlogs(result.items);
      setTotalPages(Math.ceil(result.total / pageSize));
    } catch (err) {
      console.error('Error loading blogs:', err);
      setHasError('Failed to load blogs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, activeFilter, sortOption, getPaginatedNFTs]);
  
  // Load blogs when dependencies change
  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);
  
  // Load popular categories
  useEffect(() => {
    const fetchPopularCategories = async () => {
      try {
        const popular = await getPopularCategories(5);
        setPopularCategories(popular);
      } catch (err) {
        console.error('Error getting popular categories:', err);
      }
    };
    
    fetchPopularCategories();
  }, [getPopularCategories]);
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Handle category selection
  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      // Clicking the active category deselects it
      setSelectedCategory('');
    } else {
      setSelectedCategory(category);
    }
    // Reset to first page when changing filters
    setCurrentPage(1);
  };
  
  // Handle tag selection
  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTag(e.target.value);
    setCurrentPage(1);
  };
  
  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [
      'createdAt' | 'title' | 'category' | 'votes',
      'asc' | 'desc'
    ];
    setSortOption({ field, direction });
    setCurrentPage(1);
  };
  
  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // Don't reset page immediately to avoid flickering during typing
    // We'll reset on form submission or after typing stops
  };
  
  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedTag('');
    setSearchTerm('');
    setSortOption({ field: 'createdAt', direction: 'desc' });
    setCurrentPage(1);
  };
  
  // Toggle filters visibility
  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };
  
  // Render loading state
  if (loading && isLoading && currentPage === 1) {
    return (
      <div className="blog-list-page">
        <div className="blogs-header">
          <h1>Blog Posts</h1>
          <p>Discover community-approved content</p>
        </div>
        <BlogListSkeleton />
      </div>
    );
  }
  
  return (
    <div className="blog-list-page">
      <div className="blogs-header">
        <h1>ReligioDAO Blog</h1>
        <p>Discover community-approved content</p>
      </div>
      
      <div className="filter-section">
        <div className="search-box">
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search blogs..."
              value={searchTerm}
              onChange={handleSearch}
              aria-label="Search blogs"
            />
            <button type="submit" className="search-button">
              <span className="search-icon">🔍</span>
            </button>
          </form>
        </div>
        
        <div className="filter-toggle">
          <button 
            onClick={toggleFilters} 
            className={`filter-toggle-button ${showFilters ? 'active' : ''}`}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'} <span>{showFilters ? '▲' : '▼'}</span>
          </button>
        </div>
        
        {showFilters && (
          <div className="filter-controls">
            <div className="filter-group">
              <label>Category</label>
              <div className="category-filters">
                {categories.map(category => (
                  <button
                    key={category}
                    className={`category-filter ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="filter-group">
              <label htmlFor="tag-filter">Tag</label>
              <select
                id="tag-filter"
                value={selectedTag}
                onChange={handleTagChange}
                className="filter-select"
              >
                <option value="">All Tags</option>
                {tags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="sort-filter">Sort By</label>
              <select
                id="sort-filter"
                value={`${sortOption.field}-${sortOption.direction}`}
                onChange={handleSortChange}
                className="filter-select"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
                <option value="category-asc">Category A-Z</option>
                <option value="category-desc">Category Z-A</option>
              </select>
            </div>
            
            {(selectedCategory || selectedTag || searchTerm) && (
              <div className="filter-actions">
                <button 
                  onClick={resetFilters} 
                  className="clear-filters-button"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Popular Categories Quick Filter */}
        {popularCategories.length > 0 && (
          <div className="popular-categories">
            <h3>Popular Categories</h3>
            <div className="category-chips">
              {popularCategories.map(({ name, count }) => (
                <button
                  key={name}
                  className={`category-chip ${selectedCategory === name ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(name)}
                >
                  {name} <span className="count">({count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Blog grid or empty state */}
      {hasError ? (
        <div className="error-message">
          <h3>Error</h3>
          <p>{hasError}</p>
          <button onClick={loadBlogs}>Try Again</button>
        </div>
      ) : blogs.length > 0 ? (
        <>
          <div className="blog-count-info">
            <p>
              Showing {blogs.length} {blogs.length === 1 ? 'blog' : 'blogs'}
              {totalSupply > 0 ? ` of ${totalSupply} total` : ''}
              {Object.keys(activeFilter).length > 0 ? ' (filtered)' : ''}
            </p>
          </div>
          
          <div className="blog-grid">
            {blogs.map(blog => (
              <BlogCard 
                key={blog.tokenId} 
                blog={blog}
                showProposalStatus={true}
              />
            ))}
          </div>
          
          {/* Show loading indicator when fetching more blogs */}
          {isLoading && currentPage > 1 && (
            <div className="loading-more">
              <div className="loading-spinner"></div>
              <p>Loading more blogs...</p>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </button>
              
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="no-blogs">
          <h3>No Blogs Found</h3>
          {Object.keys(activeFilter).length > 0 ? (
            <>
              <p>No blogs match your current filters.</p>
              <button onClick={resetFilters} className="clear-filters-button">
                Clear Filters
              </button>
            </>
          ) : totalSupply === 0 ? (
            <p>No blogs have been published yet. Be the first to contribute!</p>
          ) : (
            <p>Try adjusting your search or check back later for new content.</p>
          )}
        </div>
      )}
      
      {/* CTA for submitting new blogs */}
      {isConnected ? (
        <div className="submit-blog-cta">
          <h3>Have something to share?</h3>
          <p>Submit your blog post to be reviewed by the ReligioDAO community.</p>
          <Link to="/submit-proposal" className="submit-blog-button">
            Submit New Blog
          </Link>
        </div>
      ) : (
        <div className="connect-wallet-cta">
          <h3>Want to contribute?</h3>
          <p>Connect your wallet to submit blog posts for community review.</p>
        </div>
      )}
    </div>
  );
};

export default BlogListPage;