
// src/pages/editor/components/DraftManager.tsx
import React, { useState, useEffect } from 'react';
import { useWallet } from '../../../contexts/WalletContext';
import { EnhancedBlogDraft } from '../types/editorTypes';
import { enhancedDraftStorage } from '../utils/draftStorage';

interface DraftManagerProps {
  currentDraft?: EnhancedBlogDraft | null;
  onLoadDraft: (draft: EnhancedBlogDraft) => void;
  onDeleteDraft: (draftId: string) => void;
  onNewDraft: () => void;
  className?: string;
}

/**
 * DraftManager handles loading, displaying, and managing user drafts
 */
export const DraftManager: React.FC<DraftManagerProps> = ({
  currentDraft,
  onLoadDraft,
  onDeleteDraft,
  onNewDraft,
  className = ''
}) => {
  const { account, isConnected } = useWallet();
  const [drafts, setDrafts] = useState<EnhancedBlogDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load drafts when component mounts or account changes
  useEffect(() => {
    if (isConnected && account) {
      loadDrafts();
    } else {
      setDrafts([]);
    }
  }, [isConnected, account]);

  const loadDrafts = async () => {
    if (!account) return;
    
    setIsLoading(true);
    try {
      const userDrafts = enhancedDraftStorage.getDrafts(account);
      setDrafts(userDrafts);
    } catch (error) {
      console.error('Failed to load drafts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      const success = enhancedDraftStorage.deleteDraft(draftId);
      if (success) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
        onDeleteDraft(draftId);
      }
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStepProgress = (draft: EnhancedBlogDraft): string => {
    if (draft.isPublished) return 'Published';
    if (draft.contentReference) return 'On Swarm';
    if (draft.stepProgress?.draft) return 'Draft';
    return 'Started';
  };

  if (!isConnected) {
    return (
      <div className={`draft-manager ${className}`}>
        <div className="draft-manager-placeholder">
          <p>Connect your wallet to access your drafts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`draft-manager ${className}`}>
      <div className="draft-manager-header">
        <button 
          className="new-draft-btn"
          onClick={onNewDraft}
          title="Create a new blog draft"
        >
          + New Draft
        </button>
        
        <button 
          className="drafts-toggle"
          onClick={() => setShowDrafts(!showDrafts)}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : `Drafts (${drafts.length})`} 
          <span className="toggle-icon">{showDrafts ? '▼' : '▶'}</span>
        </button>
      </div>

      {showDrafts && (
        <div className="drafts-list">
          {drafts.length === 0 ? (
            <div className="no-drafts">
              <p>No drafts yet</p>
              <p>Create your first blog post!</p>
            </div>
          ) : (
            drafts.map(draft => (
              <div 
                key={draft.id}
                className={`draft-item ${draft.id === currentDraft?.id ? 'active' : ''}`}
              >
                <div className="draft-content">
                  <div className="draft-header">
                    <h4 className="draft-title" title={draft.title}>
                      {draft.title || 'Untitled'}
                    </h4>
                    <span className="draft-status">
                      {getStepProgress(draft)}
                    </span>
                  </div>
                  
                  <div className="draft-meta">
                    <span className="draft-category">{draft.category || 'No category'}</span>
                    <span className="draft-date">{formatDate(draft.lastModified)}</span>
                  </div>
                  
                  {draft.preview && (
                    <p className="draft-preview">{draft.preview}</p>
                  )}
                  
                  {draft.usedAssets && draft.usedAssets.length > 0 && (
                    <div className="draft-assets">
                      📎 {draft.usedAssets.length} asset{draft.usedAssets.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                
                <div className="draft-actions">
                  <button 
                    className="load-btn"
                    onClick={() => onLoadDraft(draft)}
                    title="Load this draft"
                  >
                    Load
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteDraft(draft.id)}
                    title="Delete this draft"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
          
          {/* Storage stats */}
          {account && drafts.length > 0 && (
            <div className="storage-stats">
              <StorageStats authorAddress={account} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Storage stats sub-component
const StorageStats: React.FC<{ authorAddress: string }> = ({ authorAddress }) => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const storageStats = enhancedDraftStorage.getStorageStats(authorAddress);
    setStats(storageStats);
  }, [authorAddress]);

  if (!stats) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="storage-stats-details">
      <h5>Storage Overview</h5>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">Drafts:</span>
          <span className="stat-value">{stats.totalDrafts}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Published:</span>
          <span className="stat-value">{stats.publishedDrafts}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Assets:</span>
          <span className="stat-value">{stats.usedAssets}/{stats.totalAssets}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Storage:</span>
          <span className="stat-value">{formatBytes(stats.storageSize)}</span>
        </div>
      </div>
    </div>
  );
};