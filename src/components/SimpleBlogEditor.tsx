// src/components/SimpleBlogEditor.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { useWallet } from '../contexts/WalletContext';
import { beeBlogService, BlogDraft } from '../services/BeeBlogService';
import './SimpleBlogEditor.css';

interface SimpleBlogEditorProps {
  mode?: 'draft' | 'proposal';
  onContentPublished?: (contentReference: string, draft: BlogDraft) => void;
}

export const SimpleBlogEditor: React.FC<SimpleBlogEditorProps> = ({ 
  mode = 'draft',
  onContentPublished 
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { account, isConnected } = useWallet();
  
  // Editor state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('# Your Blog Title\n\nStart writing your blog post here...');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [banner, setBanner] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [serviceStatus, setServiceStatus] = useState({
    nodeRunning: false,
    hasStamp: false,
    gateway: '',
    postageBatchId: ''
  });
  
  // Draft management
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-save timer
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize service and load data
  useEffect(() => {
    const initializeEditor = async () => {
      // Initialize the bee service
      await beeBlogService.initialize();
      
      // Check service status
      const status = await beeBlogService.getServiceStatus();
      setServiceStatus(status);
      
      // Load drafts if user is connected
      if (isConnected && account) {
        const userDrafts = beeBlogService.getDrafts(account || undefined);
        setDrafts(userDrafts);
      }
      
      // Load specific draft if draftId is provided
      const draftId = searchParams.get('draftId');
      if (draftId) {
        const draft = beeBlogService.loadDraft(draftId);
        if (draft) {
          loadDraftIntoEditor(draft);
          setCurrentDraftId(draftId);
        }
      }
    };
    
    initializeEditor();
  }, [isConnected, account, searchParams]);
  
  // Auto-save functionality
  useEffect(() => {
    if (!isConnected || !account || !title || !content) return;
    
    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    // Set new timer for auto-save (3 seconds after user stops typing)
    autoSaveTimer.current = setTimeout(() => {
      handleAutoSave();
    }, 3000);
    
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [title, content, category, tags, banner, isConnected, account]);
  
  // Load draft data into editor
  const loadDraftIntoEditor = (draft: BlogDraft) => {
    setTitle(draft.title);
    setContent(draft.content);
    setCategory(draft.category);
    setTags(draft.tags.join(', '));
    setBanner(draft.banner || '');
  };
  
  // Auto-save draft
  const handleAutoSave = async () => {
    if (!isConnected || !account || !title.trim()) return;
    
    setAutoSaving(true);
    try {
      const draft = beeBlogService.saveDraft({
        id: currentDraftId || undefined,
        title: title.trim(),
        content,
        category: category.trim(),
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        banner,
        authorAddress: account
      });
      
      setCurrentDraftId(draft.id);
      
      // Refresh drafts list
      const userDrafts = beeBlogService.getDrafts(account || undefined);
      setDrafts(userDrafts);
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setAutoSaving(false);
    }
  };
  
  // Manual save draft
  const handleSaveDraft = async () => {
    if (!isConnected) {
      setError('Please connect your wallet to save drafts');
      return;
    }
    
    if (!title.trim()) {
      setError('Please enter a title for your blog');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const draft = beeBlogService.saveDraft({
        id: currentDraftId || undefined,
        title: title.trim(),
        content,
        category: category.trim(),
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        banner,
        authorAddress: account!
      });
      
      setCurrentDraftId(draft.id);
      setSuccess('Draft saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh drafts list
      const userDrafts = beeBlogService.getDrafts(account || undefined);
      setDrafts(userDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };
  
  // Publish to Swarm
  const handlePublishToSwarm = async () => {
    if (!isConnected) {
      setError('Please connect your wallet to publish');
      return;
    }
    
    if (!title.trim() || !category.trim()) {
      setError('Please fill in all required fields (title and category)');
      return;
    }
    
    if (!serviceStatus.nodeRunning) {
      setError('Bee node is not running. Please start your local Bee node or use a public gateway.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // First, save as draft if not already saved
      let draftId = currentDraftId;
      if (!draftId) {
        const draft = beeBlogService.saveDraft({
          title: title.trim(),
          content,
          category: category.trim(),
          tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          banner,
          authorAddress: account!
        });
        draftId = draft.id;
        setCurrentDraftId(draftId);
      }
      
      // Publish to Swarm
      const { draft, contentReference } = await beeBlogService.publishDraft(draftId);
      
      setSuccess(`Content published to Swarm! Reference: ${contentReference.substring(0, 10)}...`);
      
      // Call callback if provided (for proposal mode)
      if (onContentPublished) {
        onContentPublished(contentReference, draft);
      }
      
      // For proposal mode, navigate to proposal submission
      if (mode === 'proposal') {
        navigate(`/submit-proposal?draftId=${draftId}`);
      }
      
      // Refresh drafts list
      const userDrafts = beeBlogService.getDrafts(account || undefined);
      setDrafts(userDrafts);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish content');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image must be smaller than 5MB');
      return;
    }
    
    setLoading(true);
    try {
      const imageReference = await beeBlogService.uploadAsset(file);
      const imageUrl = beeBlogService.getContentUrl(imageReference);
      
      // Insert image markdown at cursor position
      const imageMarkdown = `![${file.name}](${imageUrl})`;
      setContent(prev => prev + '\n\n' + imageMarkdown);
      
      setSuccess('Image uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };
  
  // Load a draft from the sidebar
  const handleLoadDraft = (draft: BlogDraft) => {
    loadDraftIntoEditor(draft);
    setCurrentDraftId(draft.id);
    setShowDrafts(false);
  };
  
  // Delete a draft
  const handleDeleteDraft = (draftId: string) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      beeBlogService.deleteDraft(draftId);
      
      // Refresh drafts list
      if (account) {
        const userDrafts = beeBlogService.getDrafts(account || undefined);
        setDrafts(userDrafts);
      }
      
      // If we deleted the current draft, reset the editor
      if (draftId === currentDraftId) {
        setCurrentDraftId(null);
        setTitle('');
        setContent('# Your Blog Title\n\nStart writing your blog post here...');
        setCategory('');
        setTags('');
        setBanner('');
      }
    }
  };
  
  // Create new draft
  const handleNewDraft = () => {
    setCurrentDraftId(null);
    setTitle('');
    setContent('# Your Blog Title\n\nStart writing your blog post here...');
    setCategory('');
    setTags('');
    setBanner('');
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="simple-blog-editor">
      <div className="editor-layout">
        {/* Sidebar */}
        <aside className="editor-sidebar">
          <div className="sidebar-section">
            <h3>
              {mode === 'proposal' ? 'Blog Proposal' : 'Blog Editor'}
              {autoSaving && <span className="auto-saving">●</span>}
            </h3>
            
            <button 
              className="new-draft-btn"
              onClick={handleNewDraft}
            >
              + New Draft
            </button>
          </div>
          
          {/* Service Status */}
          {!serviceStatus.nodeRunning && (
            <div className="status-warning">
              <strong>⚠️ Bee Node Offline</strong>
              <p>Start your local Bee node to publish content</p>
            </div>
          )}
          
          {/* Drafts */}
          {isConnected && (
            <div className="sidebar-section">
              <button 
                className="drafts-toggle"
                onClick={() => setShowDrafts(!showDrafts)}
              >
                Drafts ({drafts.length}) {showDrafts ? '▼' : '▶'}
              </button>
              
              {showDrafts && (
                <div className="drafts-list">
                  {drafts.length === 0 ? (
                    <p className="no-drafts">No drafts yet</p>
                  ) : (
                    drafts.map(draft => (
                      <div 
                        key={draft.id} 
                        className={`draft-item ${draft.id === currentDraftId ? 'active' : ''}`}
                      >
                        <div className="draft-info">
                          <div className="draft-title">{draft.title || 'Untitled'}</div>
                          <div className="draft-date">
                            {new Date(draft.lastModified).toLocaleDateString()}
                          </div>
                          {draft.contentReference && (
                            <div className="draft-published">📝 Published</div>
                          )}
                        </div>
                        <div className="draft-actions">
                          <button 
                            className="load-btn"
                            onClick={() => handleLoadDraft(draft)}
                          >
                            Load
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteDraft(draft.id)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Meta fields */}
          <div className="sidebar-section">
            <div className="field">
              <label>Title *</label>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter blog title"
              />
            </div>
            
            <div className="field">
              <label>Category *</label>
              <input 
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Technology, Opinion"
              />
            </div>
            
            <div className="field">
              <label>Tags</label>
              <input 
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </div>
            
            <div className="field">
              <label>Banner URL</label>
              <input 
                type="text"
                value={banner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder="https://example.com/banner.jpg"
              />
            </div>
          </div>
          
          {/* Actions */}
          <div className="sidebar-section">
            <div className="action-buttons">
              <button 
                className="save-draft-btn"
                onClick={handleSaveDraft}
                disabled={loading || !title.trim()}
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageUpload}
              />
              
              <button 
                className="upload-image-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                📷 Upload Image
              </button>
              
              <button 
                className="publish-btn"
                onClick={handlePublishToSwarm}
                disabled={loading || !title.trim() || !category.trim()}
              >
                {loading ? 'Publishing...' : mode === 'proposal' ? 'Submit Proposal' : 'Publish to Swarm'}
              </button>
            </div>
          </div>
        </aside>
        
        {/* Main Editor */}
        <main className="editor-main">
          {error && (
            <div className="message error-message">
              {error}
            </div>
          )}
          
          {success && (
            <div className="message success-message">
              {success}
            </div>
          )}
          
          <div className="editor-container">
            <MDEditor
              value={content}
              onChange={(value) => setContent(value || '')}
              height="calc(100vh - 200px)"
              data-color-mode="light"
              preview="edit"
            />
          </div>
        </main>
      </div>
    </div>
  );
};