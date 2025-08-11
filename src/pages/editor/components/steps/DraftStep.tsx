// src/pages/editor/components/steps/DraftStep.tsx
import React, { useRef, useCallback } from 'react';
import { useWallet } from '../../../../contexts/WalletContext';
import { assetService } from '../../../../services';
import { SimpleMarkdownEditor } from '../../../../components/editor/SimpleMarkdownEditor';

interface DraftStepProps {
  editorState: any; // Type from useEditorState
  workflowState: any; // Type from useEditorWorkflow
  onShowAssetBrowser: () => void;
}

export const DraftStep: React.FC<DraftStepProps> = ({
  editorState,
  workflowState,
  onShowAssetBrowser
}) => {
  const { account, isConnected } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

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
      const asset = await assetService.uploadAsset(file, account);
      const imageMarkdown = assetService.generateAssetMarkdown(asset, undefined, false);
      
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
      await editorState.saveDraft('Manual save');
      workflowState.updateStepStatus('draft', true);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

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
            <div className="field">
              <label htmlFor="tags">Tags</label>
              <input
                id="tags"
                type="text"
                value={editorState.formData.tags.join(', ')}
                onChange={(e) => editorState.updateTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                placeholder="tag1, tag2, tag3"
              />
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
            placeholder="# Your Blog Title\n\nStart writing your blog post here..."
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
            onClick={() => workflowState.goToStep('review')}
            disabled={!canContinue}
          >
            Continue to Review →
          </button>
        </div>
      </div>
    </div>
  );
};
