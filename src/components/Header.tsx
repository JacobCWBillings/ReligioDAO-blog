// src/components/Header.tsx - Updated for unified editor
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletConnect } from './WalletConnect';
import { useSimpleApp } from '../contexts/SimpleAppContext';
import { useWallet } from '../contexts/WalletContext';

import './Header.css';
import './HamburgerMenu.css';

interface HeaderProps {
  // Keep these props for backward compatibility, but they're now optional
  isBeeRunning?: boolean;
  hasPostageStamp?: boolean;
}

export const Header: React.FC<HeaderProps> = () => {
  const location = useLocation();
  const { state } = useSimpleApp();
  const { isConnected } = useWallet();
  
  // State for hamburger menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Get status from SimpleAppContext instead of props
  const { beeNodeRunning, hasPostageStamp } = state.status;

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Determine if we're in local or remote mode
  const isLocalMode = state.config.swarmGateway.includes('localhost') || 
                     state.config.swarmGateway.includes('127.0.0.1');

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo and Title */}
        <div className="header-brand">
          <Link to="/" className="brand-link">
            <img 
              src="/ReligioDAO_icon.jpg" 
              alt="ReligioDAO" 
              className="brand-logo"
              onError={(e) => {
                // Fallback if image doesn't load
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="brand-text">
              <h1 className="brand-title">{state.config.title}</h1>
              <p className="brand-subtitle">{state.config.description}</p>
            </div>
          </Link>
        </div>

        {/* Main Navigation - Always Visible */}
        <nav className="header-nav">
          <Link 
            to="/blogs" 
            className={`nav-link ${isActive('/blogs') ? 'active' : ''}`}
          >
            📚 Blogs
          </Link>
          
          <Link 
            to="/proposals" 
            className={`nav-link ${isActive('/proposals') ? 'active' : ''}`}
          >
            🗳️ Proposals
          </Link>
          
          {/* Show unified editor link in local mode */}
          {isLocalMode && (
            <Link 
              to="/editor" 
              className={`nav-link ${isActive('/editor') ? 'active' : ''}`}
            >
              ✏️ Editor
            </Link>
          )}
        </nav>

        {/* Header Actions with Hamburger Menu */}
        <div className="header-actions">
          {/* Hamburger Menu Button */}
          <button 
            className="hamburger-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Open menu"
          >
            <span className="hamburger-icon">☰</span>
          </button>

          {/* Hamburger Menu Overlay */}
          {isMenuOpen && (
            <>
              <div 
                className="menu-overlay" 
                onClick={() => setIsMenuOpen(false)}
              ></div>
              <div className="hamburger-menu">
                <div className="menu-header">
                  <h3>System & Account</h3>
                  <button 
                    className="close-button"
                    onClick={() => setIsMenuOpen(false)}
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="menu-content">
                  {/* Wallet Section */}
                  <div className="wallet-section">
                    <h4>Wallet</h4>
                    <WalletConnect />
                  </div>
                  
                  {/* Access Mode Indicator */}
                  {/* <div className="access-mode-section">
                    <div className={`access-indicator ${isLocalMode ? 'local' : 'remote'}`}>
                      <span className="mode-icon">{isLocalMode ? '🏠' : '🌐'}</span>
                      <span className="mode-text">
                        {isLocalMode ? 'Local Mode (Full Function)' : 'Remote Mode (Read Only)'}
                      </span>
                    </div>
                    
                    {!isLocalMode && (
                      <div className="github-link">
                        <a 
                          href="https://github.com/JacobCWBillings/ReligioDAO-blog" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="github-button"
                        >
                          📁 Get Full Version
                        </a>
                      </div>
                    )}
                  </div> */}

                  {/* Editor Info Section (only in local mode) */}
                  {isLocalMode && (
                    <div className="editor-info-section">
                      <h4>Editor Features</h4>
                      <div className="editor-features">
                        <div className="feature-item">
                          <span className="feature-icon">📝</span>
                          <span className="feature-text">Draft & Edit</span>
                        </div>
                        <div className="feature-item">
                          <span className="feature-icon">🌐</span>
                          <span className="feature-text">Publish to Swarm</span>
                        </div>
                        {isConnected && (
                          <div className="feature-item">
                            <span className="feature-icon">🗳️</span>
                            <span className="feature-text">Submit Governance</span>
                          </div>
                        )}
                      </div>
                      
                      {!isConnected && (
                        <div className="wallet-reminder">
                          <p>💡 Connect your wallet to access governance features</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* System Status (only in local mode) */}
                  {isLocalMode && (
                    <div className="status-section">
                      <h4>System Status</h4>
                      <div className="status-items">
                        <div className={`status-item ${beeNodeRunning ? 'status-ok' : 'status-error'}`}>
                          <span className="status-icon">{beeNodeRunning ? '🟢' : '🔴'}</span>
                          <span className="status-label">Bee Node</span>
                          <span className="status-value">{beeNodeRunning ? 'Running' : 'Offline'}</span>
                        </div>
                        
                        <div className={`status-item ${hasPostageStamp ? 'status-ok' : 'status-warning'}`}>
                          <span className="status-icon">{hasPostageStamp ? '🟢' : '🟡'}</span>
                          <span className="status-label">Postage Stamp</span>
                          <span className="status-value">{hasPostageStamp ? 'Available' : 'Missing'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Diagnostics Link */}
                  <div className="utilities-section">
                    <h4>Utilities</h4>
                    <Link 
                      to="/diagnostics" 
                      className={`menu-link ${isActive('/diagnostics') ? 'active' : ''}`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      🔧 Diagnostics
                    </Link>
                  </div>

                  
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};