import React from 'react';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useWallet } from '../contexts/WalletContext';
import './HomePage.css';

export const HomePage: React.FC = () => {
    const { globalState } = useGlobalState();
    const { isConnected, connect } = useWallet();

    return (
        <div className="home-page">
            <div className="hero-section">
                <h1>{globalState.configuration.title || 'ReligioDAO Blog Platform'}</h1>
                <p className="subtitle">A community-governed blogging platform on the decentralized web</p>
                
                <div className="cta-buttons">
                    <Link to="/blogs" className="primary-button">
                        Read Blogs
                    </Link>
                    
                    {isConnected ? (
                        <Link to="/editor" className="secondary-button">
                            Create New Blog
                        </Link>
                    ) : (
                        <button onClick={connect} className="secondary-button">
                            Connect Wallet to Contribute
                        </button>
                    )}
                </div>
            </div>

            <div className="info-section">
                <div className="info-card">
                    <h2>Write</h2>
                    <p>Create compelling content using our Markdown editor with media support</p>
                </div>
                
                <div className="info-card">
                    <h2>Propose</h2>
                    <p>Submit your blog as a proposal to the DAO for community review</p>
                </div>
                
                <div className="info-card">
                    <h2>Publish</h2>
                    <p>Approved blogs are minted as NFTs and published on the decentralized Swarm network</p>
                </div>
            </div>

            <div className="recent-blogs">
                <h2>Recent Blogs</h2>
                {globalState.articles.length > 0 ? (
                    <div className="blog-preview-list">
                        {globalState.articles.slice(0, 3).map((article, index) => (
                            <div key={index} className="blog-preview">
                                <h3>{article.title}</h3>
                                <p>{article.preview}</p>
                                <Link to={`/blogs/${article.path}`}>Read More</Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No blogs have been published yet.</p>
                )}
            </div>
        </div>
    );
};