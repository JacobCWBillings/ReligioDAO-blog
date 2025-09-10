// src/pages/editor/components/steps/DraftStep.tsx - MINIMAL COMPATIBILITY UPDATE
// Preserves all existing functionality, only adds single source of truth compatibility
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useWallet } from '../../../../contexts/WalletContext';
import { services } from '../../../../swarm/services';
import { SimpleMarkdownEditor } from '../SimpleMarkdownEditor';
import { EditorStep, UnifiedBlogData } from '../../../../types/editorTypes';

interface EditorState {
  formData: UnifiedBlogData;
  formErrors: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string;
    description?: string;
  };
  isAutoSaving: boolean;
  updateTitle: (title: string) => void;
  updateContent: (content: string) => void;
  updateCategory: (category: string) => void;
  updateTags: (tags: string[]) => void;
  updateBanner: (banner: string | null) => void;
  saveDraft: (action?: string) => Promise<any>;
}

interface WorkflowState {
  updateStepStatus: (step: "draft" | "swarm" | "governance", completed: boolean) => void;
  updateDraftStepProgress?: (updates: Partial<{ draft: boolean; swarm: boolean; governance: boolean }>) => Promise<any>;
  goToStep: (targetStep: EditorStep, force?: boolean) => Promise<boolean>;
}

interface DraftStepProps {
  editorState: EditorState;
  workflowState: WorkflowState;
  onShowAssetBrowser: () => void;
}

export const DraftStep: React.FC<DraftStepProps> = ({
  editorState,
  workflowState,
  onShowAssetBrowser
}) => {
  const { account, isConnected } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // COMPLETELY SEPARATE tags text input - never syncs automatically
  const [rawTagsInput, setRawTagsInput] = useState('');
  const [isTagsInputFocused, setIsTagsInputFocused] = useState(false);

  // Only initialize rawTagsInput once when component mounts, never sync again
  useEffect(() => {
    if (editorState.formData.tags.length > 0 && !rawTagsInput) {
      setRawTagsInput(editorState.formData.tags.join(', '));
    }
  }, []); // Empty dependency array - only run once

  // MINIMAL COMPATIBILITY ADDITION: Update step status when draft requirements are met
  useEffect(() => {
    const isDraftComplete = Boolean(
      editorState.formData.title?.trim() &&
      editorState.formData.content?.trim() &&
      editorState.formData.category?.trim()
    );

    // Use the new single-source-of-truth update method if available
    if (workflowState.updateDraftStepProgress) {
      workflowState.updateDraftStepProgress({ draft: isDraftComplete });
    } else if (workflowState.updateStepStatus) {
      // Fallback to existing method
      workflowState.updateStepStatus('draft', isDraftComplete);
    }
  }, [
    editorState.formData.title,
    editorState.formData.content,
    editorState.formData.category,
    workflowState
  ]);

  // Process tags from raw input (only called when explicitly needed)
  const processTagsFromInput = useCallback(() => {
    const tags = rawTagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    editorState.updateTags(tags);
    return tags;
  }, [rawTagsInput, editorState]);

  // Preview what tags will be created (for UI feedback)
  const previewTags = useCallback(() => {
    if (!rawTagsInput.trim()) return [];
    return rawTagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }, [rawTagsInput]);

  // Quick image upload handler
  const handleQuickImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !account) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError('Image must be smaller than 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const asset = await services.assets.uploadAsset(file, account);
      const imageMarkdown = services.assets.generateAssetMarkdown(asset, undefined, false);
      
      // Insert image markdown into content
      const currentContent = editorState.formData.content;
      editorState.updateContent(currentContent + '\n\n' + imageMarkdown);
      
      setUploadSuccess('Image uploaded and inserted successfully!');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [account, editorState]);

  const handleQuickUploadClick = useCallback(() => {
    if (!account) {
      setUploadError('Please connect your wallet to upload images');
      return;
    }
    
    if (isUploading) return;
    
    setUploadError(null);
    fileInputRef.current?.click();
  }, [account, isUploading]);

  const handleSaveDraft = async () => {
    try {
      // Process tags before saving if they've been modified
      if (rawTagsInput !== editorState.formData.tags.join(', ')) {
        processTagsFromInput();
      }
      
      await editorState.saveDraft('Manual save');
      
      // MINIMAL COMPATIBILITY ADDITION: Use new method if available
      if (workflowState.updateDraftStepProgress) {
        workflowState.updateDraftStepProgress({ draft: true });
      } else {
        workflowState.updateStepStatus('draft', true);
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const handleContinueToReview = useCallback(async () => {
    // Process tags before moving to review
    processTagsFromInput();
    
    // Small delay to ensure tags are processed
    setTimeout(() => {
      workflowState.goToStep('review');
    }, 50);
  }, [processTagsFromInput, workflowState]);

  const canContinue = editorState.formData.title.trim() && 
                     editorState.formData.content.trim() && 
                     editorState.formData.category.trim();

  return (
    <div className="draft-step">
      <div className="step-header">
        <h2>Create Your Blog Post</h2>
        <p>Write your content using Markdown. Your work is automatically saved as you type.</p>
      </div>

      <div className="draft-editor-container">
        {/* Metadata Form */}
        <div className="draft-metadata">
          <div className="metadata-row">
            <div className="field">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                type="text"
                value={editorState.formData.title}
                onChange={(e) => editorState.updateTitle(e.target.value)}
                placeholder="Enter your blog title"
                className={editorState.formErrors.title ? 'error' : ''}
              />
              {editorState.formErrors.title && (
                <span className="field-error">{editorState.formErrors.title}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="category">Category *</label>
              <input
                id="category"
                type="text"
                value={editorState.formData.category}
                onChange={(e) => editorState.updateCategory(e.target.value)}
                placeholder="e.g., Technology, Opinion, Guide"
                className={editorState.formErrors.category ? 'error' : ''}
              />
              {editorState.formErrors.category && (
                <span className="field-error">{editorState.formErrors.category}</span>
              )}
            </div>
          </div>

          <div className="metadata-row">
            {/* COMPLETELY DECOUPLED TAGS INPUT */}
            <div className="field">
              <label htmlFor="tags">Tags</label>
              <input
                id="tags"
                type="text"
                value={rawTagsInput}
                onChange={(e) => setRawTagsInput(e.target.value)}
                onFocus={() => setIsTagsInputFocused(true)}
                onBlur={() => setIsTagsInputFocused(false)}
                placeholder="tag1, tag2, tag3"
                className={editorState.formErrors.tags ? 'error' : ''}
              />
              {editorState.formErrors.tags && (
                <span className="field-error">{editorState.formErrors.tags}</span>
              )}
              
              {/* Show live preview of tags while typing */}
              <div className="tags-preview">
                {isTagsInputFocused && rawTagsInput.trim() && (
                  <div className="preview-tags">
                    <span className="preview-label">Preview: </span>
                    {previewTags().map((tag, index) => (
                      <span key={index} className="preview-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Show current processed tags */}
                {!isTagsInputFocused && editorState.formData.tags.length > 0 && (
                  <div className="current-tags">
                    <span className="current-label">Current: </span>
                    {editorState.formData.tags.map((tag, index) => (
                      <span key={index} className="current-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <span className="field-hint">
                Type tags separated by commas. Tags will be processed when you save or continue to review.
              </span>
            </div>

            <div className="field">
              <label htmlFor="banner">Banner URL</label>
              <input
                id="banner"
                type="text"
                value={editorState.formData.banner || ''}
                onChange={(e) => editorState.updateBanner(e.target.value || null)}
                placeholder="https://example.com/banner.jpg"
              />
              <span className="field-hint">
                Optional image URL to display as a banner for your post.
              </span>
            </div>
          </div>
        </div>

        {/* Quick Asset Tools */}
        <div className="quick-asset-tools">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleQuickImageUpload}
            key={Date.now()}
          />
          
          <button
            className="quick-upload-btn"
            onClick={handleQuickUploadClick}
            disabled={isUploading || !isConnected}
            title={!isConnected ? 'Connect wallet to upload images' : 'Upload image and insert into editor'}
          >
            {isUploading ? '⏳ Uploading...' : '📷 Quick Upload'}
          </button>
          
          <button
            className="asset-browser-btn"
            onClick={onShowAssetBrowser}
            disabled={!isConnected}
            title="Open asset library"
          >
            🗂️ Browse Assets
          </button>

          {(uploadError || uploadSuccess) && (
            <div className="upload-messages">
              {uploadError && <div className="upload-error">{uploadError}</div>}
              {uploadSuccess && <div className="upload-success">{uploadSuccess}</div>}
            </div>
          )}
        </div>

        {/* Markdown Editor */}
        <div className="editor-container">
          <SimpleMarkdownEditor
            value={editorState.formData.content}
            onChange={editorState.updateContent}
            height="calc(100vh - 400px)"
            placeholder="# Your Blog Title

Start writing your blog post here..."
          />
        </div>
      </div>

      {/* Step Actions */}
      <div className="step-actions">
        <div className="action-group">
          <button
            className="save-draft-btn"
            onClick={handleSaveDraft}
            disabled={!editorState.formData.title.trim() || editorState.isAutoSaving}
          >
            {editorState.isAutoSaving ? '💾 Auto-saving...' : '💾 Save Draft'}
          </button>
        </div>
        
        <div className="action-group">
          <button
            className="continue-btn"
            onClick={handleContinueToReview}
            disabled={!canContinue}
            title={!canContinue ? 'Please fill in Title, Category, and Content to continue' : 'Continue to review your post'}
          >
            Continue to Review →
          </button>
        </div>
      </div>

      {/* Form validation feedback */}
      {!canContinue && (
        <div className="validation-info">
          <h4>Required fields:</h4>
          <ul>
            {!editorState.formData.title.trim() && <li>Title is required</li>}
            {!editorState.formData.content.trim() && <li>Content is required</li>}
            {!editorState.formData.category.trim() && <li>Category is required</li>}
          </ul>
        </div>
      )}

      {/* Development debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-debug-tags">
          <details>
            <summary>🔧 Debug: Fully Decoupled Tags</summary>
            <div className="debug-content">
              <h5>Tag States:</h5>
              <pre>{JSON.stringify({
                rawInput: rawTagsInput,
                savedTags: editorState.formData.tags,
                previewTags: previewTags(),
                inputFocused: isTagsInputFocused,
                inputChanged: rawTagsInput !== editorState.formData.tags.join(', ')
              }, null, 2)}</pre>
              <h5>Processing Info:</h5>
              <ul>
                <li><strong>Raw Input:</strong> "{rawTagsInput}"</li>
                <li><strong>Saved Tags:</strong> {JSON.stringify(editorState.formData.tags)}</li>
                <li><strong>Will Create:</strong> {JSON.stringify(previewTags())}</li>
                <li><strong>Processing Triggers:</strong> Save Draft, Continue to Review</li>
                <li><strong>NO auto-sync:</strong> Input is completely independent</li>
              </ul>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};