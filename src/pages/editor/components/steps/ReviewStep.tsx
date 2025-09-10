// src/pages/editor/components/steps/ReviewStep.tsx - MINIMAL COMPATIBILITY UPDATE
// Preserves all existing functionality, only adds single source of truth compatibility
import React, { useState, useCallback, useEffect } from 'react';
import { marked } from 'marked';
import { SimpleMarkdownEditor } from '../SimpleMarkdownEditor';

interface ReviewStepProps {
  editorState: any;
  workflowState: any;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  editorState,
  workflowState
}) => {
  const [showPreview, setShowPreview] = useState(true);

  // MINIMAL COMPATIBILITY ADDITION: Ensure draft status is marked complete when entering review
  useEffect(() => {
    const isDraftComplete = Boolean(
      editorState.formData.title?.trim() &&
      editorState.formData.content?.trim() &&
      editorState.formData.category?.trim()
    );

    if (isDraftComplete) {
      // Use the new single-source-of-truth update method if available
      if (workflowState.updateDraftStepProgress) {
        workflowState.updateDraftStepProgress({ draft: true });
      } else if (workflowState.updateStepStatus) {
        // Fallback to existing method
        workflowState.updateStepStatus('draft', true);
      }
    }
  }, [
    editorState.formData.title,
    editorState.formData.content,
    editorState.formData.category,
    workflowState
  ]);

  const renderMarkdown = (content: string): string => {
    try {
      return marked.parse(content);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return '<p>Error rendering markdown</p>';
    }
  };

  // FIXED: Use useCallback for event handlers to prevent recreating functions
  const handleBackToDraft = useCallback(() => {
    workflowState.goToStep('draft');
  }, [workflowState]);

  const handleContinueToPublish = useCallback(() => {
    workflowState.goToStep('publish');
  }, [workflowState]);

  const handleContentChange = useCallback((value: string) => {
    editorState.updateContent(value);
  }, [editorState]);

  // FIXED: Check form validity using the new method that doesn't trigger setState during render
  const canContinue = editorState.formValidation.isValidForStep('review');

  return (
    <div className="review-step">
      <div className="step-header">
        <h2>Review Your Blog Post</h2>
        <p>Preview your content and make final edits before publishing to Swarm.</p>
      </div>

      <div className="review-container">
        {/* Tab Navigation */}
        <div className="review-tabs">
          <button
            className={`tab-button ${!showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(false)}
          >
            ✏️ Edit
          </button>
          <button
            className={`tab-button ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(true)}
          >
            👁️ Preview
          </button>
        </div>

        {/* Content Area */}
        <div className="review-content">
          {showPreview ? (
            <div className="blog-preview">
              <div className="preview-header">
                <h1>{editorState.formData.title || 'Blog Title'}</h1>
                <div className="preview-metadata">
                  <span className="preview-category">{editorState.formData.category || 'Category'}</span>
                  <div className="preview-tags">
                    {editorState.formData.tags.map((tag: string, index: number) => (
                      <span key={index} className="preview-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div 
                className="preview-content"
                dangerouslySetInnerHTML={{ 
                  __html: renderMarkdown(editorState.formData.content) 
                }}
              />
              
              <div className="preview-footer">
                <div className="preview-author">
                  Author: {editorState.formData.authorAddress ? 
                    `${editorState.formData.authorAddress.substring(0, 6)}...${editorState.formData.authorAddress.substring(38)}` : 
                    'Your Address'
                  }
                </div>
              </div>
            </div>
          ) : (
            <div className="edit-mode">
              <SimpleMarkdownEditor
                value={editorState.formData.content}
                onChange={handleContentChange}
                height="calc(100vh - 300px)"
              />
            </div>
          )}
        </div>
      </div>

      {/* Step Actions */}
      <div className="step-actions">
        <div className="action-group">
          <button
            className="back-btn"
            onClick={handleBackToDraft}
          >
            ← Back to Edit
          </button>
        </div>
        
        <div className="action-group">
          <button
            className="continue-btn"
            onClick={handleContinueToPublish}
            disabled={!canContinue}
          >
            Continue to Publish →
          </button>
        </div>
      </div>

      {/* Show validation errors if any */}
      {!canContinue && Object.keys(editorState.formValidation.errors).length > 0 && (
        <div className="validation-warning">
          <h4>⚠️ Please fix the following issues before continuing:</h4>
          <ul>
            {Object.entries(editorState.formValidation.errors).map(([field, error]) => (
              <li key={field}>{error as string}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};