
// src/pages/editor/components/steps/PublishStep.tsx
import React, { useState } from 'react';
import { beeBlogService } from '../../../../services/BeeBlogService';
import { assetService } from '../../../../services/AssetService';

interface PublishStepProps {
  editorState: any;
  workflowState: any;
}

export const PublishStep: React.FC<PublishStepProps> = ({
  editorState,
  workflowState
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const handlePublishToSwarm = async () => {
    setIsPublishing(true);
    setPublishError(null);
    workflowState.setLoading(true);

    try {
      // Save current draft first
      const savedDraft = await editorState.saveDraft('Pre-publish save');
      
      // Process content for publication (convert local URLs to public)
      const processedContent = assetService.processMarkdownForPublication(editorState.formData.content);
      
      // Create blog content structure for Swarm
      const blogContent = {
        title: editorState.formData.title,
        content: processedContent,
        metadata: {
          author: editorState.formData.authorAddress,
          category: editorState.formData.category,
          tags: editorState.formData.tags,
          createdAt: Date.now(),
          banner: editorState.formData.banner || undefined
        }
      };
      
      // Upload to Swarm
      const contentReference = await beeBlogService.uploadBlogContent(blogContent);
      
      // Update form data with content reference
      editorState.updateContentReference(contentReference);
      
      // Update workflow status
      workflowState.updateStepStatus('swarm', true);
      
      // Auto-advance to governance step
      setTimeout(() => {
        workflowState.goToStep('governance');
      }, 1000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish to Swarm';
      setPublishError(errorMessage);
      workflowState.setError(errorMessage);
    } finally {
      setIsPublishing(false);
      workflowState.setLoading(false);
    }
  };

  const isContentPublished = Boolean(editorState.formData.contentReference);

  return (
    <div className="publish-step">
      <div className="step-header">
        <h2>📡 Publish to Swarm Network</h2>
        <p>Store your content permanently on the decentralized Swarm network, making it censorship-resistant and always available.</p>
      </div>

      <div className="publish-container">
        {isContentPublished ? (
          <div className="content-reference-note">
            <h3>✅ Content Successfully Published!</h3>
            <p>Your blog post has been stored on the Swarm network:</p>
            <div className="reference-display">
              <strong>Content Reference:</strong>
              <code>{editorState.formData.contentReference}</code>
            </div>
            <p className="reference-notice">
              Your content is now permanently stored on the decentralized web and accessible worldwide.
            </p>
          </div>
        ) : (
          <div className="publish-info">
            <h3>Ready to Publish</h3>
            <div className="publish-details">
              <div className="detail-item">
                <strong>Title:</strong> {editorState.formData.title}
              </div>
              <div className="detail-item">
                <strong>Category:</strong> {editorState.formData.category}
              </div>
              <div className="detail-item">
                <strong>Tags:</strong> {editorState.formData.tags.join(', ') || 'None'}
              </div>
              <div className="detail-item">
                <strong>Content Length:</strong> {editorState.formData.content.length} characters
              </div>
              {editorState.formData.usedAssets && editorState.formData.usedAssets.length > 0 && (
                <div className="detail-item">
                  <strong>Assets:</strong> {editorState.formData.usedAssets.length} image(s)
                </div>
              )}
            </div>
            
            <div className="publish-warning">
              <h4>⚠️ Important:</h4>
              <ul>
                <li>Content will be stored permanently on Swarm</li>
                <li>Images will use public gateway URLs for universal access</li>
                <li>Your local Bee node must be running</li>
                <li>Publishing requires a postage stamp</li>
              </ul>
            </div>
          </div>
        )}

        {publishError && (
          <div className="error-message">
            <strong>Publishing Failed:</strong> {publishError}
          </div>
        )}
      </div>

      {/* Step Actions */}
      <div className="step-actions">
        <div className="action-group">
          <button
            className="back-btn"
            onClick={() => workflowState.goToStep('review')}
          >
            ← Back to Review
          </button>
        </div>
        
        <div className="action-group">
          {!isContentPublished ? (
            <button
              className="publish-btn"
              onClick={handlePublishToSwarm}
              disabled={isPublishing || !editorState.validateForm('publish')}
            >
              {isPublishing ? '⏳ Publishing...' : '🚀 Publish to Swarm'}
            </button>
          ) : (
            <button
              className="continue-btn"
              onClick={() => workflowState.goToStep('governance')}
            >
              Continue to Governance →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};