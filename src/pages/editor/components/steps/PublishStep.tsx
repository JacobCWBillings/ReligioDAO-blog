// src/pages/editor/components/steps/PublishStep.tsx - FIXED VERSION
import React, { useState } from 'react';
import { contentService, assetService, services } from '../../../../services';
import { enhancedDraftStorage } from '../../../../utils/draftStorage';

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
  const [serviceStatus, setServiceStatus] = useState<any>(null);

  // Load service status when component mounts
  React.useEffect(() => {
    const loadServiceStatus = async () => {
      try {
        const status = await services.getStatus();
        setServiceStatus(status);
      } catch (error) {
        console.error('Failed to load service status:', error);
        setServiceStatus({ nodeRunning: false, error: 'Failed to check service status' });
      }
    };

    loadServiceStatus();
  }, []);

  const handlePublishToSwarm = async () => {
    setIsPublishing(true);
    setPublishError(null);
    workflowState.setLoading(true);

    try {
      // Validate required fields
      if (!editorState.formData.title?.trim()) {
        throw new Error('Title is required');
      }

      if (!editorState.formData.content?.trim()) {
        throw new Error('Content is required');
      }

      if (!editorState.formData.category?.trim()) {
        throw new Error('Category is required');
      }

      if (!editorState.formData.authorAddress?.trim()) {
        throw new Error('Author address is required');
      }

      // Save current draft first
      const savedDraft = await editorState.saveDraft('Pre-publish save');
      
      // Process content for publication (convert local URLs to public)
      const processedContent = assetService.processMarkdownForPublication(editorState.formData.content);
      
      // Create blog content structure for ContentService
      const blogContent = {
        title: editorState.formData.title.trim(),
        content: processedContent,
        metadata: {
          author: editorState.formData.authorAddress,
          category: editorState.formData.category.trim(),
          tags: editorState.formData.tags || [],
          createdAt: editorState.formData.createdAt || Date.now(),
          banner: editorState.formData.banner || null
        }
      };
      
      console.log('Publishing blog content to Swarm:', blogContent.title);
      
      // Upload to Swarm using ContentService
      const contentReference = await contentService.uploadBlogContent(blogContent);
      
      console.log('Content published successfully:', contentReference);
      
      // Update form data with content reference
      editorState.updateContentReference(contentReference);
      
      // Update the draft with published content and reference
      if (savedDraft) {
        enhancedDraftStorage.saveDraft({
          ...savedDraft,
          content: processedContent, // Store the processed content
          contentReference,
          stepProgress: {
            ...savedDraft.stepProgress,
            swarm: true
          }
        }, 'Published to Swarm');
      }
      
      // Update workflow status
      workflowState.updateStepStatus('swarm', true);
      
      // Auto-advance to governance step
      setTimeout(() => {
        workflowState.goToStep('governance');
      }, 1500);
      
    } catch (error) {
      console.error('Publishing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish to Swarm';
      setPublishError(errorMessage);
      workflowState.setError(errorMessage);
    } finally {
      setIsPublishing(false);
      workflowState.setLoading(false);
    }
  };

  const isContentPublished = Boolean(editorState.formData.contentReference);

  // FIXED: Check form validity using the new method that doesn't trigger setState during render
  const canPublish = editorState.formValidation.isValidForStep('publish') &&
                     editorState.formData.title?.trim() &&
                     editorState.formData.content?.trim() &&
                     editorState.formData.category?.trim();

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
            <div className="reference-urls">
              <strong>Access URLs:</strong>
              <div className="url-list">
                <div className="url-item">
                  <span className="url-label">Public Web:</span>
                  <code>{contentService.getBlogUrl(editorState.formData.contentReference, true)}</code>
                </div>
                {serviceStatus?.nodeRunning && (
                  <div className="url-item">
                    <span className="url-label">Local Web:</span>
                    <code>{contentService.getBlogUrl(editorState.formData.contentReference, false)}</code>
                  </div>
                )}
              </div>
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
                <strong>Tags:</strong> {editorState.formData.tags?.join(', ') || 'None'}
              </div>
              <div className="detail-item">
                <strong>Content Length:</strong> {editorState.formData.content?.length || 0} characters
              </div>
              {editorState.formData.usedAssets && editorState.formData.usedAssets.length > 0 && (
                <div className="detail-item">
                  <strong>Assets:</strong> {editorState.formData.usedAssets.length} image(s)
                </div>
              )}
            </div>

            {/* Service Status Information */}
            <div className="service-status-info">
              <h4>🔧 Service Status</h4>
              {serviceStatus ? (
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">Local Bee Node:</span>
                    <span className={`status-value ${serviceStatus.nodeRunning ? 'online' : 'offline'}`}>
                      {serviceStatus.nodeRunning ? '🟢 Online' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Postage Stamp:</span>
                    <span className={`status-value ${serviceStatus.hasStamp ? 'available' : 'unavailable'}`}>
                      {serviceStatus.hasStamp ? '🟢 Available' : '🔴 Not Available'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Publishing Method:</span>
                    <span className="status-value">
                      {serviceStatus.nodeRunning && serviceStatus.hasStamp 
                        ? '🏠 Local Node' 
                        : '🌐 Public Gateway'
                      }
                    </span>
                  </div>
                </div>
              ) : (
                <div className="status-loading">⏳ Checking service status...</div>
              )}
            </div>
            
            <div className="publish-warning">
              <h4>📋 Publishing Information:</h4>
              <ul>
                <li>Content will be stored permanently on Swarm</li>
                <li>Images will use public gateway URLs for universal access</li>
                {serviceStatus?.nodeRunning ? (
                  <>
                    <li>Publishing through your local Bee node</li>
                    {!serviceStatus.hasStamp && (
                      <li className="warning">⚠️ No postage stamp - may fall back to public gateway</li>
                    )}
                  </>
                ) : (
                  <li className="info">ℹ️ Publishing through public gateway (local node offline)</li>
                )}
                <li>Publishing creates a permanent, immutable reference</li>
              </ul>
            </div>

            {/* Additional warnings based on service status */}
            {!serviceStatus?.nodeRunning && !serviceStatus?.error && (
              <div className="service-warning">
                <h4>🔴 Local Node Offline</h4>
                <p>
                  Your local Bee node is not running. Publishing will use the public gateway, 
                  which may be slower but ensures your content is still published successfully.
                </p>
              </div>
            )}

            {serviceStatus?.error && (
              <div className="service-error">
                <h4>⚠️ Service Error</h4>
                <p>{serviceStatus.error}</p>
                <p>You can still publish using the public gateway.</p>
              </div>
            )}
          </div>
        )}

        {publishError && (
          <div className="error-message">
            <strong>Publishing Failed:</strong> {publishError}
            <div className="error-actions">
              <button 
                className="retry-btn"
                onClick={handlePublishToSwarm}
                disabled={isPublishing}
              >
                Retry Publishing
              </button>
            </div>
          </div>
        )}

        {/* Show validation errors if any and not already published */}
        {!isContentPublished && !canPublish && Object.keys(editorState.formValidation.errors).length > 0 && (
          <div className="validation-warning">
            <h4>⚠️ Please fix the following issues before publishing:</h4>
            <ul>
              {Object.entries(editorState.formValidation.errors).map(([field, error]) => (
                <li key={field}>{error as string}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Step Actions */}
      <div className="step-actions">
        <div className="action-group">
          <button
            className="back-btn"
            onClick={() => workflowState.goToStep('review')}
            disabled={isPublishing}
          >
            ← Back to Review
          </button>
        </div>
        
        <div className="action-group">
          {!isContentPublished ? (
            <button
              className="publish-btn"
              onClick={handlePublishToSwarm}
              disabled={isPublishing || !canPublish}
            >
              {isPublishing ? '⏳ Publishing...' : '🚀 Publish to Swarm'}
            </button>
          ) : (
            <button
              className="continue-btn"
              onClick={() => workflowState.goToStep('governance')}
              disabled={isPublishing}
            >
              Continue to Governance →
            </button>
          )}
        </div>
      </div>

      {/* Development info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info</summary>
            <div className="dev-content">
              <h5>Service Status:</h5>
              <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
              <h5>Form Data:</h5>
              <pre>{JSON.stringify({
                title: editorState.formData.title,
                category: editorState.formData.category,
                contentLength: editorState.formData.content?.length,
                contentReference: editorState.formData.contentReference
              }, null, 2)}</pre>
              <h5>Validation:</h5>
              <pre>{JSON.stringify({
                canPublish,
                errors: editorState.formValidation.errors
              }, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};