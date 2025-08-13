// src/pages/editor/components/steps/PublishStep.tsx - FIXED VERSION
// Ensures current form data is used for publishing, not outdated draft data
import React, { useState } from 'react';
import { contentService, assetService, services } from '../../../../swarm/services';
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

  // FIXED: Enhanced publish handler with guaranteed current data usage
  const handlePublishToSwarm = async () => {
    setIsPublishing(true);
    setPublishError(null);
    workflowState.setLoading(true);

    try {
      // CRITICAL FIX: Always use current formData, not stored draft
      const currentFormData = editorState.formData;
      
      console.log('Publishing with CURRENT form data:', {
        title: currentFormData.title,
        contentLength: currentFormData.content.length,
        category: currentFormData.category,
        hasDescription: Boolean(currentFormData.description?.trim())
      });

      // Validate required fields using current data
      if (!currentFormData.title?.trim()) {
        throw new Error('Title is required');
      }

      if (!currentFormData.content?.trim()) {
        throw new Error('Content is required');
      }

      if (!currentFormData.category?.trim()) {
        throw new Error('Category is required');
      }

      if (!currentFormData.authorAddress?.trim()) {
        throw new Error('Author address is required');
      }

      // FIXED: Save current state first to ensure draft storage is up-to-date
      // This ensures the saved draft matches what we're about to publish
      console.log('Saving current form data before publishing...');
      let savedDraft;
      try {
        savedDraft = await editorState.saveDraft('Pre-publish save with current data');
        console.log('Successfully saved current data to draft storage');
      } catch (saveError) {
        console.warn('Failed to save draft before publishing, continuing with current form data:', saveError);
        // Continue with publish even if save fails - we'll use current form data
      }
      
      // FIXED: Process content for publication using CURRENT form data
      const processedContent = assetService.processMarkdownForPublication(currentFormData.content);
      
      // FIXED: Create blog content structure using CURRENT form data (not saved draft)
      const blogContent = {
        title: currentFormData.title.trim(),
        content: processedContent,
        metadata: {
          author: currentFormData.authorAddress,
          category: currentFormData.category.trim(),
          tags: currentFormData.tags || [],
          createdAt: currentFormData.createdAt || Date.now(),
          banner: currentFormData.banner || null
        }
      };
      
      console.log('Publishing blog content to Swarm:', blogContent.title);
      
      // Upload to Swarm using ContentService
      const contentReference = await contentService.uploadBlogContent(blogContent);
      
      console.log('Content published successfully:', contentReference);
      
      // FIXED: Update CURRENT form data with content reference
      editorState.updateContentReference(contentReference);
      
      // FIXED: Update the draft with published content and reference using current data
      if (savedDraft) {
        enhancedDraftStorage.saveDraft({
          ...currentFormData,  // Use current form data, not saved draft
          id: savedDraft.id,   // Preserve the draft ID
          content: processedContent, // Store the processed content
          contentReference,
          stepProgress: {
            draft: true,
            swarm: true,  // Mark as published to Swarm
            governance: Boolean(savedDraft.stepProgress?.governance)
          }
        }, 'Published to Swarm with current data');
      } else {
        // If no saved draft, create a new one with current data
        enhancedDraftStorage.saveDraft({
          ...currentFormData,
          content: processedContent,
          contentReference,
          stepProgress: {
            draft: true,
            swarm: true,
            governance: false
          }
        }, 'Published to Swarm (new draft)');
      }
      
      // Update workflow status
      workflowState.updateStepStatus('swarm', true);
      
      console.log('Publish step completed successfully');
      
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

  // Check form validity using current form data
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
            
            {/* FIXED: Show current form data stats, not saved draft */}
            <div className="current-content-summary">
              <h4>📄 Current Content to Publish:</h4>
              <div className="publish-details">
                <div className="detail-item">
                  <strong>Title:</strong> {editorState.formData.title || 'No title'}
                </div>
                <div className="detail-item">
                  <strong>Category:</strong> {editorState.formData.category || 'No category'}
                </div>
                <div className="detail-item">
                  <strong>Tags:</strong> {editorState.formData.tags?.join(', ') || 'None'}
                </div>
                <div className="detail-item">
                  <strong>Content Length:</strong> {editorState.formData.content?.length || 0} characters
                </div>
                {editorState.formData.description && (
                  <div className="detail-item">
                    <strong>Description:</strong> {editorState.formData.description.substring(0, 100)}...
                  </div>
                )}
                {editorState.formData.usedAssets && editorState.formData.usedAssets.length > 0 && (
                  <div className="detail-item">
                    <strong>Assets:</strong> {editorState.formData.usedAssets.length} image(s)
                  </div>
                )}
              </div>
            </div>

            {/* Unsaved changes warning */}
            {editorState.hasUnsavedChanges && (
              <div className="unsaved-changes-warning">
                <h4>⚠️ Unsaved Changes Detected</h4>
                <p>
                  Your latest changes will be automatically saved and published. 
                  The content shown above represents your current work, including any unsaved edits.
                </p>
              </div>
            )}

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
                <li>Your current work (including any unsaved changes) will be published</li>
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
              {isPublishing ? '⏳ Publishing Current Content...' : '🚀 Publish to Swarm'}
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
              <h5>Current Form Data (What Will Be Published):</h5>
              <pre>{JSON.stringify({
                title: editorState.formData.title,
                category: editorState.formData.category,
                contentLength: editorState.formData.content?.length,
                hasDescription: Boolean(editorState.formData.description?.trim()),
                contentReference: editorState.formData.contentReference,
                hasUnsavedChanges: editorState.hasUnsavedChanges
              }, null, 2)}</pre>
              <h5>Validation:</h5>
              <pre>{JSON.stringify({
                canPublish,
                errors: editorState.formValidation.errors
              }, null, 2)}</pre>
              <h5>Current Draft ID:</h5>
              <pre>{editorState.currentDraft?.id || 'No current draft'}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};