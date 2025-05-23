// src/pages/SimpleEditorPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SimpleBlogEditor } from '../components/SimpleBlogEditor';
import { PlatformStatusBanner, useSimpleApp } from '../contexts/SimpleAppContext';
import { useWallet } from '../contexts/WalletContext';
import { BlogDraft } from '../services/BeeBlogService';
import './SimpleEditorPage.css';

interface SimpleEditorPageProps {
  mode?: 'draft' | 'proposal';
}

export const SimpleEditorPage: React.FC<SimpleEditorPageProps> = ({ mode = 'draft' }) => {
  const { blogId } = useParams();
  const navigate = useNavigate();
  const { state } = useSimpleApp();
  const { isConnected, account } = useWallet();

  // Handle content published callback (for proposal mode)
  const handleContentPublished = (contentReference: string, draft: BlogDraft) => {
    console.log('Content published:', { contentReference, draft });
    
    if (mode === 'proposal') {
      // Show success message and navigate to proposal submission
      setTimeout(() => {
        navigate(`/submit-proposal?draftId=${draft.id}&contentRef=${contentReference}`);
      }, 2000);
    }
  };

  // Show initialization screen if app is not ready
  if (!state.isInitialized) {
    return (
      <div className="simple-editor-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Initializing ReligioDAO Blog Platform</h2>
          <p>Setting up your decentralized blogging environment...</p>
        </div>
      </div>
    );
  }

  // Show error screen if there's a critical error
  if (state.error) {
    return (
      <div className="simple-editor-error">
        <div className="error-content">
          <h2>Platform Error</h2>
          <p>{state.error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="simple-editor-page">
      {/* Platform status banner */}
      <PlatformStatusBanner />
      
      {/* Connection warning for proposal mode */}
      {mode === 'proposal' && !isConnected && (
        <div className="connection-warning">
          <div className="warning-content">
            <span className="warning-icon">🔐</span>
            <span>
              Connect your wallet to create blog proposals and participate in governance
            </span>
          </div>
        </div>
      )}
      
      {/* Main editor */}
      <div className="editor-content">
        <SimpleBlogEditor
          mode={mode}
          onContentPublished={handleContentPublished}
        />
      </div>
      
      {/* Help section for new users */}
      <div className="editor-help-section">
        <details className="help-accordion">
          <summary>Need Help? 📚</summary>
          <div className="help-content">
            <div className="help-section">
              <h4>Getting Started</h4>
              <ul>
                <li>Write your blog post using Markdown syntax</li>
                <li>Add a title and category (required fields)</li>
                <li>Use tags to help readers find your content</li>
                <li>Upload images by clicking the camera button</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Publishing Options</h4>
              <ul>
                <li><strong>Save Draft:</strong> Store locally for later editing</li>
                <li><strong>Publish to Swarm:</strong> Store permanently on decentralized network</li>
                {mode === 'proposal' && (
                  <li><strong>Submit Proposal:</strong> Create governance proposal for community voting</li>
                )}
              </ul>
            </div>
            
            {!state.status.beeNodeRunning && (
              <div className="help-section">
                <h4>Bee Node Setup</h4>
                <p>
                  To publish content to Swarm, you need a local Bee node running. 
                  <a 
                    href="https://docs.ethswarm.org/docs/bee/installation/quick-start" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Follow the installation guide
                  </a> to set up your node.
                </p>
              </div>
            )}
            
            <div className="help-section">
              <h4>Markdown Quick Reference</h4>
              <div className="markdown-examples">
                <code># Heading 1</code>
                <code>## Heading 2</code>
                <code>**Bold text**</code>
                <code>*Italic text*</code>
                <code>[Link](https://example.com)</code>
                <code>![Image](image-url)</code>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

// Export as default for easy importing
export default SimpleEditorPage;