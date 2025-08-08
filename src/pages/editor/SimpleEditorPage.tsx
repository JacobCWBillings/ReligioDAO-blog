// src/pages/SimpleEditorPage.tsx - Unified Editor with Asset Browser Integration
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { PlatformStatusBanner, useSimpleApp } from '../../contexts/SimpleAppContext';
import { beeBlogService, BlogDraft } from '../../services/BeeBlogService';
import { assetService } from '../../services/AssetService';
import { BlogProposal } from '../../types/blockchain';
import { extractProposalIdFromReceipt } from '../../blockchain/utils/transactionUtils';
import { SimpleBlogEditor } from '../../components/editor/SimpleBlogEditor';
import { EnhancedAssetBrowser } from '../../components/EnhancedAssetBrowser';
import { marked } from 'marked';
import './SimpleEditorPage.css';

// Progress steps for the unified workflow
type EditorStep = 'draft' | 'review' | 'publish' | 'governance' | 'success';

interface StepStatus {
  draft: boolean;
  swarm: boolean;
  governance: boolean;
}

export const SimpleEditorPage: React.FC = () => {
  const { blogId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  
  const { state } = useSimpleApp();
  const { isConnected, account } = useWallet();
  const { createBlogProposal, loading: proposalLoading, error: proposalError } = useProposal();

  // Editor state
  const [currentStep, setCurrentStep] = useState<EditorStep>('draft');
  const [loadedDraft, setLoadedDraft] = useState<BlogDraft | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    draft: false,
    swarm: false,
    governance: false
  });

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [contentReference, setContentReference] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    content?: string;
    category?: string;
    description?: string;
  }>({});

  // Asset browser integration state
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FIXED: Move all useCallback hooks to the top level, before any early returns
  
  // Asset browser integration functions
  const handleQuickImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !account) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError('Image must be smaller than 5MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const asset = await assetService.uploadAsset(file, account);
      
      // Generate markdown with public gateway for published content
      const imageMarkdown = assetService.generateAssetMarkdown(
        asset, 
        undefined,
        currentStep === 'governance' || currentStep === 'publish' // Use public gateway for later steps
      );
      
      // Insert image markdown at cursor position
      setContent(prev => prev + '\n\n' + imageMarkdown);
      
      setSuccess('Image uploaded and inserted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [account, currentStep]);

  const handleQuickUploadClick = useCallback(() => {
    if (!account) {
      setUploadError('Please connect your wallet to upload images');
      return;
    }
    
    if (isUploading) return;
    
    setUploadError(null);
    
    try {
      fileInputRef.current?.click();
    } catch (err) {
      console.error('Failed to trigger file input:', err);
      setUploadError('Failed to open file dialog. Please try again.');
    }
  }, [account, isUploading]);

  const handleAssetInsertion = useCallback((markdownCode: string) => {
    setContent(prev => prev + '\n\n' + markdownCode);
    setSuccess('Asset inserted successfully!');
    setTimeout(() => setSuccess(null), 2000);
  }, []);

  // Handle editor content changes from SimpleBlogEditor
  const handleEditorChange = useCallback((newTitle: string, newContent: string, newCategory: string, newTags: string[], newBanner: string | null) => {
    setTitle(newTitle);
    setContent(newContent);
    setCategory(newCategory);
    setTags(newTags.join(', '));
    setBanner(newBanner);
  }, []);

  // Step navigation
  const goToStep = useCallback((step: EditorStep) => {
    if (step === 'review' && !stepStatus.draft) {
      if (!validateForm()) return;
      saveDraft();
    }
    setCurrentStep(step);
  }, [stepStatus.draft]); // Note: We'll need to move validateForm and saveDraft to useCallback too

  // Load draft if draftId is provided
  useEffect(() => {
    if (draftId) {
      const draft = beeBlogService.loadDraft(draftId);
      if (draft) {
        setLoadedDraft(draft);
        setTitle(draft.title);
        setContent(draft.content);
        setPreview(draft.preview);
        setCategory(draft.category);
        setBanner(draft.banner || null);
        setContentReference(draft.contentReference || '');
        
        // Handle tags
        if (draft.tags) {
          if (Array.isArray(draft.tags)) {
            setTags(draft.tags.join(', '));
          } else if (typeof draft.tags === 'string') {
            setTags(draft.tags);
          }
        }

        // Update step status based on draft state
        setStepStatus({
          draft: true,
          swarm: Boolean(draft.contentReference),
          governance: Boolean(draft.isPublished)
        });

        // Set current step based on draft progress
        if (draft.isPublished) {
          setCurrentStep('success');
        } else if (draft.contentReference) {
          setCurrentStep('governance');
        } else {
          setCurrentStep('review');
        }
      }
    }
  }, [draftId]);

  // Generate preview from content if not set
  useEffect(() => {
    if (content && !preview) {
      const textContent = content.replace(/[#*_`-]/g, '');
      const previewText = textContent.length > 150 
        ? `${textContent.substring(0, 150)}...` 
        : textContent;
      setPreview(previewText);
    }
  }, [content, preview]);

  // Generate default description
  useEffect(() => {
    if (!description && account && category) {
      setDescription(`A blog post about ${category} by ${account.substring(0, 6)}...${account.substring(38)}`);
    }
  }, [account, category, description]);

  // MOVED: Functions that were causing the issue are now properly defined with useCallback
  
  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: { title?: string; content?: string; category?: string; description?: string } = {};
    
    if (!title.trim()) errors.title = 'Title is required';
    if (!content.trim()) errors.content = 'Content is required';
    if (!category.trim()) errors.category = 'Category is required';
    if (currentStep === 'governance' && !description.trim()) {
      errors.description = 'Description is required for governance proposals';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [title, content, category, currentStep, description]);

  // Save draft
  const saveDraft = useCallback(async () => {
    if (!validateForm()) return;

    const draft: BlogDraft = {
      id: loadedDraft?.id || `draft_${Date.now()}`,
      title,
      content,
      preview,
      category,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      banner: banner || undefined,
      contentReference,
      authorAddress: account || '',
      isPublished: stepStatus.governance,
      lastModified: Date.now(),
      createdAt: loadedDraft?.createdAt || Date.now()
    };

    beeBlogService.saveDraft(draft);
    setLoadedDraft(draft);
    setStepStatus(prev => ({ ...prev, draft: true }));
    
    // Update URL with draftId if not already present
    if (!draftId) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('draftId', draft.id);
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [validateForm, loadedDraft, title, content, preview, category, tags, banner, contentReference, account, stepStatus.governance, draftId]);

  // Upload to Swarm
  const uploadToSwarm = useCallback(async (): Promise<string> => {
    if (contentReference) return contentReference;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const serviceStatus = await beeBlogService.getServiceStatus();
      if (!serviceStatus.nodeRunning) {
        throw new Error('Bee node is not running. Please start your local Bee node.');
      }
      
      const blogContent = {
        title,
        content,
        metadata: {
          author: account || '',
          category,
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
          createdAt: Date.now(),
          banner: banner || undefined
        }
      };
      
      const reference = await beeBlogService.uploadBlogContent(blogContent);
      setContentReference(reference);
      setStepStatus(prev => ({ ...prev, swarm: true }));
      
      // Update draft with reference
      if (loadedDraft) {
        const updatedDraft = { ...loadedDraft, contentReference: reference, lastModified: Date.now() };
        beeBlogService.saveDraft(updatedDraft);
        setLoadedDraft(updatedDraft);
      }
      
      return reference;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload content to Swarm';
      setUploadError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [contentReference, title, content, account, category, tags, banner, loadedDraft]);

  // Submit to governance
  const submitToGovernance = useCallback(async () => {
    if (!isConnected || !account) {
      alert('Please connect your wallet to submit a governance proposal');
      return;
    }
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setUploadError(null);
    
    try {
      // Ensure content is uploaded to Swarm first
      const reference = await uploadToSwarm();
      
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      
      const blogProposal: BlogProposal = {
        title,
        content,
        contentReference: reference,
        preview,
        banner,
        category,
        tags: tagsArray,
        authorAddress: account,
        description
      };
      
      const result = await createBlogProposal(blogProposal);
      
      if (result.status === 'confirmed') {
        setStepStatus(prev => ({ ...prev, governance: true }));
        setCurrentStep('success');
        
        // Extract proposal ID if available
        if (result.receipt) {
          const extractedProposalId = extractProposalIdFromReceipt(result.receipt);
          if (extractedProposalId) {
            setProposalId(extractedProposalId);
          }
        }
        
        // Mark draft as published
        if (loadedDraft) {
          const publishedDraft = {
            ...loadedDraft,
            isPublished: true,
            contentReference: reference,
            lastModified: Date.now()
          };
          beeBlogService.saveDraft(publishedDraft);
          setLoadedDraft(publishedDraft);
        }
      }
    } catch (err) {
      console.error('Error submitting governance proposal:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setUploadError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [isConnected, account, validateForm, uploadToSwarm, tags, title, content, preview, banner, category, description, createBlogProposal, loadedDraft]);

  // EARLY RETURNS NOW COME AFTER ALL HOOKS
  
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

  // Get platform readiness
  const isPlatformReady = state.isInitialized && state.status.beeNodeRunning;
  const canSubmitGovernance = isPlatformReady && isConnected && stepStatus.swarm;

  return (
    <div className="simple-editor-page">
      {/* Platform status banner */}
      <PlatformStatusBanner />
      
      {/* Connection warning for governance features */}
      {!isConnected && currentStep === 'governance' && (
        <div className="connection-warning">
          <div className="warning-content">
            <span className="warning-icon">🔐</span>
            <span>Connect your wallet to submit governance proposals</span>
          </div>
        </div>
      )}

      {/* Main content based on current step */}
      <div className="editor-content">
        {currentStep === 'success' ? (
          <div className="success-container">
            <div className="success-message">
              <h2>🎉 Proposal Submitted Successfully!</h2>
              <p>Your blog proposal has been submitted to the DAO for community voting.</p>
              {contentReference && (
                <p>Content Reference: <code>{contentReference}</code></p>
              )}
              <div className="success-actions">
                <button 
                  className="primary-button" 
                  onClick={() => proposalId ? navigate(`/proposals/${proposalId}`) : navigate('/proposals')}
                >
                  View Proposal
                </button>
                <button 
                  className="secondary-button" 
                  onClick={() => navigate('/blogs')}
                >
                  Back to Blogs
                </button>
                <button 
                  className="secondary-button" 
                  onClick={() => {
                    setCurrentStep('draft');
                    setTitle('');
                    setContent('');
                    setCategory('');
                    setTags('');
                    setDescription('');
                    setContentReference('');
                    setBanner(null);
                    setStepStatus({ draft: false, swarm: false, governance: false });
                    // Clear URL params
                    window.history.replaceState({}, '', '/editor');
                  }}
                >
                  New Post
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Progress Steps */}
            <div className="editor-progress">
              <div className="progress-steps">
                <div className={`progress-step ${currentStep === 'draft' ? 'active' : ''} ${stepStatus.draft ? 'completed' : ''}`}>
                  <span className="step-icon">📝</span>
                  <span className="step-label">Draft</span>
                </div>
                <div className={`progress-step ${currentStep === 'review' ? 'active' : ''} ${stepStatus.draft ? 'enabled' : 'disabled'}`}>
                  <span className="step-icon">👀</span>
                  <span className="step-label">Review</span>
                </div>
                <div className={`progress-step ${currentStep === 'publish' ? 'active' : ''} ${stepStatus.swarm ? 'completed' : stepStatus.draft ? 'enabled' : 'disabled'}`}>
                  <span className="step-icon">🌐</span>
                  <span className="step-label">Publish</span>
                </div>
                <div className={`progress-step ${currentStep === 'governance' ? 'active' : ''} ${stepStatus.governance ? 'completed' : stepStatus.swarm ? 'enabled' : 'disabled'}`}>
                  <span className="step-icon">🗳️</span>
                  <span className="step-label">Governance</span>
                </div>
              </div>
            </div>

            {/* Unified Asset Toolbar - Always visible */}
            <div className="unified-asset-toolbar">
              <div className="toolbar-content">
                <div className="toolbar-section">
                  <h4>📎 Asset Tools</h4>
                  <div className="toolbar-buttons">
                    {/* Hidden file input for quick upload */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={handleQuickImageUpload}
                      key={Date.now()}
                    />
                    
                    <button 
                      className="toolbar-btn quick-upload-btn"
                      onClick={handleQuickUploadClick}
                      disabled={isUploading || !isConnected}
                      title={!isConnected ? 'Connect wallet to upload images' : 'Upload image and insert into editor'}
                    >
                      {isUploading ? '⏳ Uploading...' : '📷 Quick Upload'}
                    </button>
                    
                    <button 
                      className="toolbar-btn asset-browser-btn"
                      onClick={() => setShowAssetBrowser(true)}
                      disabled={isUploading}
                      title="Open asset library"
                    >
                      🗂️ Asset Library
                    </button>
                  </div>
                </div>

                {/* Status messages in toolbar */}
                {(uploadError || success) && (
                  <div className="toolbar-messages">
                    {uploadError && (
                      <div className="toolbar-error">{uploadError}</div>
                    )}
                    {success && (
                      <div className="toolbar-success">{success}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Main Editor Interface */}
            {(currentStep === 'draft' || currentStep === 'review') && (
              <div className="editor-main-container">
                {currentStep === 'review' && (
                  <div className="editor-tabs">
                    <button 
                      className={!showPreview ? "active-tab" : ""} 
                      onClick={() => setShowPreview(false)}
                    >
                      Edit
                    </button>
                    <button 
                      className={showPreview ? "active-tab" : ""}
                      onClick={() => setShowPreview(true)}
                    >
                      Preview
                    </button>
                  </div>
                )}

                {showPreview && currentStep === 'review' ? (
                  <div className="blog-preview">
                    <h2>{title || 'Blog Title'}</h2>
                    <div className="preview-metadata">
                      <span className="preview-category">{category || 'Category'}</span>
                      <div className="preview-tags">
                        {tags.split(',').filter(Boolean).map((tag, index) => (
                          <span key={index} className="preview-tag">{tag.trim()}</span>
                        ))}
                      </div>
                    </div>
                    <div className="preview-content" dangerouslySetInnerHTML={{ __html: marked(content) }} />
                    <div className="preview-footer">
                      <div className="preview-author">
                        Author: {account ? `${account.substring(0, 6)}...${account.substring(38)}` : 'Your Address'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <SimpleBlogEditor
                    onContentPublished={() => {}} // Not used in unified flow
                    onChange={handleEditorChange}
                    initialTitle={title}
                    initialContent={content}
                    initialCategory={category}
                    initialTags={tags.split(',').map(t => t.trim()).filter(Boolean)}
                    initialBanner={banner}
                  />
                )}

                {/* Step Actions */}
                <div className="step-actions">
                  {currentStep === 'draft' && (
                    <div className="draft-actions">
                      <button 
                        className="save-draft-btn"
                        onClick={saveDraft}
                        disabled={!title.trim() || !content.trim()}
                      >
                        💾 Save Draft
                      </button>
                      <button 
                        className="continue-btn"
                        onClick={() => goToStep('review')}
                        disabled={!title.trim() || !content.trim()}
                      >
                        Continue to Review →
                      </button>
                    </div>
                  )}

                  {currentStep === 'review' && (
                    <div className="review-actions">
                      <button 
                        className="back-btn"
                        onClick={() => setCurrentStep('draft')}
                      >
                        ← Back to Edit
                      </button>
                      <button 
                        className="continue-btn"
                        onClick={() => setCurrentStep('publish')}
                        disabled={!validateForm()}
                      >
                        Continue to Publish →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Publish Step */}
            {currentStep === 'publish' && (
              <div className="publish-container">
                <div className="publish-content">
                  <h2>📡 Publish to Swarm Network</h2>
                  <p>Your content will be stored permanently on the decentralized Swarm network, making it censorship-resistant and always available.</p>
                  
                  {contentReference ? (
                    <div className="content-reference-note">
                      <p>✅ Content published to Swarm: <code>{contentReference}</code></p>
                      <p className="reference-notice">Your content is now permanently stored on the decentralized web.</p>
                    </div>
                  ) : (
                    <div className="publish-info">
                      <div className="publish-details">
                        <h3>What will be published:</h3>
                        <ul>
                          <li><strong>Title:</strong> {title}</li>
                          <li><strong>Category:</strong> {category}</li>
                          <li><strong>Tags:</strong> {tags || 'None'}</li>
                          <li><strong>Content:</strong> {content.length} characters</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <div className="error-message">{uploadError}</div>
                  )}

                  <div className="publish-actions">
                    <button 
                      className="back-btn"
                      onClick={() => setCurrentStep('review')}
                    >
                      ← Back to Review
                    </button>
                    {!contentReference ? (
                      <button 
                        className="publish-btn"
                        onClick={uploadToSwarm}
                        disabled={isUploading || !isPlatformReady}
                      >
                        {isUploading ? '⏳ Publishing...' : '🚀 Publish to Swarm'}
                      </button>
                    ) : (
                      <button 
                        className="continue-btn"
                        onClick={() => setCurrentStep('governance')}
                      >
                        Continue to Governance →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Governance Step */}
            {currentStep === 'governance' && (
              <div className="governance-container">
                <div className="governance-content">
                  <h2>🗳️ Submit Governance Proposal</h2>
                  <p>Submit your published content as a proposal for the DAO community to vote on.</p>
                  
                  <div className="governance-form">
                    <div className="form-group">
                      <label htmlFor="description">Proposal Description*</label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Why should the DAO approve this blog? What value does it bring to the community?"
                        rows={4}
                      />
                      {formErrors.description && (
                        <div className="error-message">{formErrors.description}</div>
                      )}
                    </div>

                    <div className="proposal-summary">
                      <h3>Proposal Summary:</h3>
                      <div className="summary-item"><strong>Title:</strong> {title}</div>
                      <div className="summary-item"><strong>Category:</strong> {category}</div>
                      <div className="summary-item"><strong>Content Reference:</strong> <code>{contentReference}</code></div>
                      <div className="summary-item"><strong>Author:</strong> {account}</div>
                    </div>
                  </div>

                  {(uploadError || proposalError) && (
                    <div className="error-message">
                      {uploadError || (proposalError && proposalError.message)}
                    </div>
                  )}

                  <div className="governance-actions">
                    <button 
                      className="back-btn"
                      onClick={() => setCurrentStep('publish')}
                    >
                      ← Back to Publish
                    </button>
                    <button 
                      className="submit-governance-btn"
                      onClick={submitToGovernance}
                      disabled={isSubmitting || !canSubmitGovernance || !description.trim()}
                    >
                      {isSubmitting ? '⏳ Submitting...' : '🗳️ Submit Governance Proposal'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Enhanced Asset Browser - Always available */}
      <EnhancedAssetBrowser
        isOpen={showAssetBrowser}
        onClose={() => setShowAssetBrowser(false)}
        onInsertAsset={handleAssetInsertion}
      />

      {/* Help section */}
      <div className="editor-help-section">
        <details className="help-accordion">
          <summary>Need Help? 📚</summary>
          <div className="help-content">
            <div className="help-section">
              <h4>Unified Workflow</h4>
              <ul>
                <li><strong>Draft:</strong> Write and edit your content using Markdown</li>
                <li><strong>Review:</strong> Preview how your post will look</li>
                <li><strong>Publish:</strong> Store permanently on Swarm network</li>
                <li><strong>Governance:</strong> Submit as DAO proposal for voting</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Asset Management</h4>
              <ul>
                <li>Upload images directly with Quick Upload button</li>
                <li>Browse and manage all assets in Asset Library</li>
                <li>Assets are available throughout all workflow steps</li>
                <li>Images use public URLs for proposals to ensure accessibility</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Platform Requirements</h4>
              <ul>
                <li>Local Bee node required for publishing to Swarm</li>
                <li>Wallet connection required for governance proposals</li>
                <li>Each step builds on the previous one</li>
                <li>All data is saved locally as you progress</li>
              </ul>
            </div>
            
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

export default SimpleEditorPage;