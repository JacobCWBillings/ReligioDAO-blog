// src/pages/viewer/BlogListPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { BlogCard } from '../../components/BlogCard';
import { BlogFilter, BlogSort, PaginatedBlogs } from '../../types/blockchain';
import './BlogListPage.css';

export const BlogListPage: React.FC = () => {
  // State for filtering and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [filter, setFilter] = useState<BlogFilter>({});
  const [sort, setSort] = useState<BlogSort>({ field: 'createdAt', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paginatedBlogs, setPaginatedBlogs] = useState<PaginatedBlogs>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 12,
    hasMore: false
  });

  // Get NFT hook and its functions
  const { 
    loading, 
    error, 
    getAllNFTs, 
    getPaginatedNFTs, 
    getAllCategories 
  } = useBlogNFT();

  // Load blogs with current filters and sorting
  const loadBlogs = useCallback(async () => {
    try {
      // Create filter based on selected options
      const activeFilter: BlogFilter = {
        ...filter,
        searchTerm: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined
      };

      const result = await getPaginatedNFTs(currentPage, pageSize, activeFilter, sort);
      setPaginatedBlogs(result);
    } catch (err) {
      console.error('Error loading blogs:', err);
    }
  }, [filter, sort, currentPage, pageSize, searchTerm, selectedCategory, getPaginatedNFTs]);

  // Load initial data
  useEffect(() => {
    const init = async () => {
      await getAllNFTs();
      await loadBlogs();
    };
    
    init();
  }, [getAllNFTs, loadBlogs]);

  // Update when filter/sort changes
  useEffect(() => {
    loadBlogs();
  }, [filter, sort, currentPage, searchTerm, selectedCategory, loadBlogs]);

  // Get all available categories
  const categories = ['all', ...getAllCategories()];

  // Handle search input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle category selection
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page on category change
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [
      'createdAt' | 'title' | 'category' | 'votes',
      'asc' | 'desc'
    ];
    setSort({ field, direction });
    setCurrentPage(1); // Reset to first page on sort change
  };

  // Handle pagination
  const handleNextPage = () => {
    if (paginatedBlogs.hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setFilter({});
    setSort({ field: 'createdAt', direction: 'desc' });
    setCurrentPage(1);
  };

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
            onChange={handleSearch}
          />
        </div>
        
        <div className="filter-controls">
          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`category-filter ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="sort-control">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select" 
              value={`${sort.field}-${sort.direction}`}
              onChange={handleSortChange}
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
              <option value="category-asc">Category (A-Z)</option>
              <option value="category-desc">Category (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="loading-indicator">Loading blogs...</div>}
      
      {error && (
        <div className="error-message">
          <p>Error loading blogs: {error.message}</p>
          <button onClick={loadBlogs}>Try Again</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {paginatedBlogs.items.length > 0 ? (
            <>
              <div className="blog-grid">
                {paginatedBlogs.items.map(blog => (
                  <BlogCard key={blog.tokenId} blog={blog} />
                ))}
              </div>
              
              <div className="pagination">
                <button 
                  onClick={handlePrevPage} 
                  disabled={currentPage <= 1}
                  className="pagination-button"
                >
                  Previous
                </button>
                
                <span className="page-info">
                  Page {currentPage} of {Math.ceil(paginatedBlogs.total / pageSize)}
                </span>
                
                <button 
                  onClick={handleNextPage} 
                  disabled={!paginatedBlogs.hasMore}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="no-blogs">
              <p>No blogs found matching your criteria.</p>
              {(selectedCategory !== 'all' || searchTerm) && (
                <button 
                  className="clear-filters-button"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BlogListPage;