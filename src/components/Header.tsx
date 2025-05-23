// src/components/Header.tsx - Updated for SimpleAppContext compatibility
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletConnect } from './WalletConnect';
import { useSimpleApp } from '../contexts/SimpleAppContext';
import { useWallet } from '../contexts/WalletContext';
import './Header.css';

interface HeaderProps {
  // Keep these props for backward compatibility, but they're now optional
  isBeeRunning?: boolean;
  hasPostageStamp?: boolean;
}

export const Header: React.FC<HeaderProps> = () => {
  const location = useLocation();
  const { state } = useSimpleApp();
  const { isConnected } = useWallet();

  // Get status from SimpleAppContext instead of props
  const { beeNodeRunning, hasPostageStamp } = state.status;

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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

        {/* Navigation */}
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
          
          {isConnected && (
            <>
              <Link 
                to="/editor" 
                className={`nav-link ${isActive('/editor') ? 'active' : ''}`}
              >
                ✏️ Write
              </Link>
              
              <Link 
                to="/proposal-editor" 
                className={`nav-link ${isActive('/proposal-editor') ? 'active' : ''}`}
              >
                📝 Propose
              </Link>
            </>
          )}
          
          <Link 
            to="/diagnostics" 
            className={`nav-link ${isActive('/diagnostics') ? 'active' : ''}`}
          >
            🔧 Diagnostics
          </Link>
        </nav>

        {/* Status and Wallet */}
        <div className="header-actions">
          {/* Platform Status Indicators */}
          <div className="status-indicators">
            <div className={`status-indicator ${beeNodeRunning ? 'status-ok' : 'status-error'}`}>
              <span className="status-icon">{beeNodeRunning ? '🟢' : '🔴'}</span>
              <span className="status-text">Bee</span>
            </div>
            
            <div className={`status-indicator ${hasPostageStamp ? 'status-ok' : 'status-warning'}`}>
              <span className="status-icon">{hasPostageStamp ? '🟢' : '🟡'}</span>
              <span className="status-text">Stamp</span>
            </div>
          </div>

          {/* Wallet Connection */}
          <WalletConnect />
        </div>
      </div>
    </header>
  );
};