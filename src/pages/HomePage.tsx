// src/pages/HomePage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useBlogNFT } from '../blockchain/hooks/useBlogNFT';
import { useProposal } from '../blockchain/hooks/useProposal';
import { BlogCard } from '../components/BlogCard';
import TrendingBlogs from '../components/TrendingBlogs';
import { formatAddress } from '../blockchain/utils/walletUtils';
import './HomePage.css';

export const HomePage: React.FC = () => {
  const { account, isConnected, connect } = useWallet();
  const { getRecentNFTs, totalSupply } = useBlogNFT();
  const { getPendingProposals } = useProposal();
  
  const [recentBlogs, setRecentBlogs] = useState<any[]>([]);
  const [pendingProposals, setPendingProposals] = useState<any[]>([]);
  const [totalBlogs, setTotalBlogs] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  // Load recent blogs, stats, and any pending proposals needing votes
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get most recent 3 blogs
        const recent = await getRecentNFTs(3);
        setRecentBlogs(recent);
        
        // Get total blog count
        setTotalBlogs(totalSupply);
        
        // If user is connected, get proposals needing votes
        if (isConnected) {
          const pending = await getPendingProposals();
          setPendingProposals(pending);
        }
      } catch (err) {
        console.error('Error loading homepage data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [getRecentNFTs, totalSupply, getPendingProposals, isConnected]);
  
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>ReligioDAO Blog</h1>
          <p className="hero-tagline">
            A decentralized platform for community-approved content
          </p>
          <div className="hero-actions">
            <Link to="/blogs" className="primary-button">
              Explore Blogs
            </Link>
            {isConnected ? (
              <Link to="/submit-proposal" className="secondary-button">
                Submit Blog
              </Link>
            ) : (
              <button onClick={connect} className="secondary-button">
                Connect Wallet
              </button>
            )}
          </div>
          
          {/* Platform Stats */}
          <div className="platform-stats">
            <div className="stat-item">
              <span className="stat-value">{totalBlogs}</span>
              <span className="stat-label">Published Blogs</span>
            </div>
            {isConnected && pendingProposals.length > 0 && (
              <div className="stat-item highlight">
                <span className="stat-value">{pendingProposals.length}</span>
                <span className="stat-label">Pending Votes</span>
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Main Content */}
      <section className="home-content">
        <div className="home-layout">
          {/* Main Column - Latest Blogs */}
          <div className="main-column">
            <div className="section-header">
              <h2>Latest Blogs</h2>
              <Link to="/blogs" className="section-link">View All</Link>
            </div>
            
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading latest content...</p>
              </div>
            ) : recentBlogs.length > 0 ? (
              <div className="recent-blogs-grid">
                {recentBlogs.map(blog => (
                  <BlogCard 
                    key={blog.tokenId} 
                    blog={blog}
                    showRecentIndicator={true}
                    showProposalStatus={true}
                  />
                ))}
              </div>
            ) : (
              <div className="no-blogs-message">
                <p>No blogs have been published yet.</p>
                {isConnected ? (
                  <Link to="/submit-proposal" className="primary-button">
                    Submit the First Blog
                  </Link>
                ) : (
                  <button onClick={connect} className="primary-button">
                    Connect to Submit
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="sidebar-column">
            {/* User Welcome Card (if connected) */}
            {isConnected && account && (
              <div className="welcome-card">
                <h3>Welcome Back</h3>
                <div className="user-address">
                  {formatAddress(account, 6, 4)}
                </div>
                
                {/* Vote Requests */}
                {pendingProposals.length > 0 ? (
                  <div className="action-needed">
                    <h4>Action Needed</h4>
                    <p>{pendingProposals.length} proposals require your vote</p>
                    <Link to="/proposals" className="vote-now-button">
                      Vote Now
                    </Link>
                  </div>
                ) : (
                  <p className="no-actions">No pending votes required</p>
                )}
                
                <div className="user-actions">
                  <Link to="/submit-proposal" className="action-link">
                    Submit Blog
                  </Link>
                  <Link to="/proposals" className="action-link">
                    View Proposals
                  </Link>
                </div>
              </div>
            )}
            
            {/* Popular Blogs */}
            <TrendingBlogs maxItems={5} title="Popular Blogs" filter="popular" />
            
            {/* Categories/Tags Section */}
            <div className="categories-card">
              <h3>Explore Categories</h3>
              <div className="categories-grid">
                <Link to="/blogs?category=Technology" className="category-item category-tech">
                  Technology
                </Link>
                <Link to="/blogs?category=Philosophy" className="category-item category-philosophy">
                  Philosophy
                </Link>
                <Link to="/blogs?category=Science" className="category-item category-science">
                  Science
                </Link>
                <Link to="/blogs?category=Arts" className="category-item category-arts">
                  Arts
                </Link>
                <Link to="/blogs?category=Religion" className="category-item category-religion">
                  Religion
                </Link>
                <Link to="/blogs?category=Culture" className="category-item category-culture">
                  Culture
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* DAO Information Section */}
      <section className="dao-info-section">
        <div className="dao-info-container">
          <h2>About ReligioDAO</h2>
          <p>
            ReligioDAO is a decentralized autonomous organization focused on fostering
            thoughtful discussions across various belief systems. Our blog platform
            operates with community governance, where members vote on content proposals.
          </p>
          <div className="dao-features">
            <div className="feature-item">
              <div className="feature-icon">🔍</div>
              <h3>Community Curated</h3>
              <p>All content is approved through democratic voting by DAO members</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔗</div>
              <h3>Blockchain Powered</h3>
              <p>Content is stored on Swarm with NFT representation for permanence</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📝</div>
              <h3>Submit Proposals</h3>
              <p>Anyone can submit blog proposals for the community to review</p>
            </div>
          </div>
          <div className="dao-actions">
            <Link to="/blogs" className="primary-button">
              Browse Blogs
            </Link>
            <a href="https://github.com/yourusername/religiodao-blog" target="_blank" rel="noopener noreferrer" className="secondary-button">
              View Source Code
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;