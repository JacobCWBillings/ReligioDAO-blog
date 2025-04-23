// src/pages/viewer/BlogListPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBlogNFT } from '../../blockchain/hooks/useBlogNFT';
import { BlogCard } from '../../components/BlogCard';
import { BlogFilter, BlogSort, BlogNFT } from '../../types/blockchain';
import './BlogListPage.css';

export const BlogListPage: React.FC = () => {
  const { getAllNFTs, getAllCategories, getAllTags, filterNFTs, sortNFTs, loading } = useBlogNFT();
  
  const [blogs, setBlogs] = useState<BlogNFT[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<BlogSort>({ field: 'createdAt', direction: 'desc' });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all blog NFTs on component mount
  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        setIsLoading(true);
        const nfts = await getAllNFTs();
        setBlogs(nfts);
        
        // Get all categories and tags
        const allCategories = nfts.reduce((acc: string[], nft) => {
          const category = nft.metadata.properties.category;
          if (category && !acc.includes(category)) {
            acc.push(category);
          }
          return acc;
        }, []);
        
        const allTags = nfts.reduce((acc: string[], nft) => {
          const nftTags = nft.metadata.properties.tags || [];
          nftTags.forEach(tag => {
            if (!acc.includes(tag)) {
              acc.push(tag);
            }
          });
          return acc;
        }, []);
        
        setCategories(allCategories);
        setTags(allTags);
      } catch (err) {
        console.error('Error fetching blogs:', err);
        setError('Failed to load blogs. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBlogs();
  }, [getAllNFTs]);
  
  // Apply filters and sorting
  const filteredAndSortedBlogs = React.useMemo(() => {
    // Create filter object
    const filter: BlogFilter = {};
    if (selectedCategory) filter.category = selectedCategory;
    if (selectedTag) filter.tag = selectedTag;
    if (searchTerm) filter.searchTerm = searchTerm;
    
    // Apply filtering
    const filtered = filterNFTs(blogs, filter);
    
    // Apply sorting
    return sortNFTs(filtered, sortOption);
  }, [blogs, selectedCategory, selectedTag, searchTerm, sortOption, filterNFTs, sortNFTs]);
  
  // Handle category selection
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
  };
  
  // Handle tag selection
  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTag(e.target.value);
  };
  
  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [
      'createdAt' | 'title' | 'category' | 'votes',
      'asc' | 'desc'
    ];
    setSortOption({ field, direction });
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedTag('');
    setSearchTerm('');
    setSortOption({ field: 'createdAt', direction: 'desc' });
  };
  
  if (loading || isLoading) {
    return (
      <div className="blog-list-loading">
        <div className="loader"></div>
        <p>Loading blogs...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="blog-list-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }
  
  return (
    <div className="blog-list-page">
      <div className="blog-list-header">
        <h1>Blog Posts</h1>
        <p>Discover community-approved content</p>
      </div>
      
      <div className="blog-list-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="tag-filter">Tag</label>
            <select
              id="tag-filter"
              value={selectedTag}
              onChange={handleTagChange}
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
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="category-asc">Category A-Z</option>
              <option value="category-desc">Category Z-A</option>
            </select>
          </div>
          
          <button className="reset-filters" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
        
        <div className="search-row">
          <input
            type="text"
            placeholder="Search blogs..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
          />
        </div>
      </div>
      
      {filteredAndSortedBlogs.length === 0 ? (
        <div className="no-blogs-found">
          <h3>No blogs found</h3>
          <p>Try adjusting your filters or check back later for new content</p>
        </div>
      ) : (
        <>
          <div className="results-count">
            Showing {filteredAndSortedBlogs.length} {filteredAndSortedBlogs.length === 1 ? 'result' : 'results'}
          </div>
          
          <div className="blog-grid">
            {filteredAndSortedBlogs.map(blog => (
              <div key={blog.tokenId} className="blog-item">
                <BlogCard blog={blog} />
              </div>
            ))}
          </div>
        </>
      )}
      
      <div className="blog-list-footer">
        <Link to="/submit-proposal" className="submit-blog-button">
          Submit New Blog
        </Link>
      </div>
    </div>
  );
};

export default BlogListPage;