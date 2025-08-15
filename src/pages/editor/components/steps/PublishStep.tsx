// src/pages/editor/components/steps/PublishStep.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { services } from '../../../../swarm/services';
import { UnifiedBlogData } from '../../../../types/editorTypes';
import { PreparedContent } from '../../../../types/contentTypes';

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
  const [preparedContent, setPreparedContent] = useState<PreparedContent | null>(null);
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{
    available: boolean;
    error: string | null;
  }>({ available: false, error: null });

  // Load service status when component mounts
  useEffect(() => {
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

  // FIXED: Check pipeline availability safely
  useEffect(() => {
    const checkPipelineStatus = () => {
      try {
        // Use new safe method to check pipeline availability
        const hasPipeline = services.hasPipeline;
        const pipelineResult = services.tryGetPipeline();
        
        setPipelineStatus({
          available: hasPipeline && pipelineResult.pipeline !== null,
          error: pipelineResult.error
        });
        
        console.log('Pipeline status:', {
          hasBlockchainServices: services.hasBlockchainServices,
          hasPipeline: hasPipeline,
          available: hasPipeline && pipelineResult.pipeline !== null,
          error: pipelineResult.error
        });
      } catch (error) {
        console.error('Failed to check pipeline status:', error);
        setPipelineStatus({
          available: false,
          error: error instanceof Error ? error.message : 'Unknown pipeline error'
        });
      }
    };

    checkPipelineStatus();
  }, []);

  /**
   * Handle publishing using ContentPipeline
   */
  const handlePublishToSwarm = async () => {
    setIsPublishing(true);
    setPublishError(null);
    workflowState.setLoading(true);

    try {
      // Use current form data
      const currentFormData: UnifiedBlogData = editorState.formData;
      
      console.log('Publishing with current form data:', {
        title: currentFormData.title,
        contentLength: currentFormData.content.length,
        category: currentFormData.category,
        hasDescription: Boolean(currentFormData.description?.trim())
      });

      // Validate required fields
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

      // Process content using AssetService
      const processedContent = services.assets.processMarkdownForPublication(
        currentFormData.content
      );

      // Create blog content structure
      const blogContent = {
        title: currentFormData.title.trim(),
        content: processedContent,
        metadata: {
          author: currentFormData.authorAddress,
          category: currentFormData.category.trim(),
          tags: currentFormData.tags || [],
          createdAt: currentFormData.createdAt || Date.now(),
          banner: currentFormData.banner || null,
          description: currentFormData.description || undefined
        }
      };

      console.log('Uploading blog content to Swarm...');
      
      // Upload using ContentService
      const contentReference = await services.content.uploadBlogContent(blogContent);
      
      console.log('Content published successfully:', contentReference);
      
      // Update form data with content reference
      editorState.updateContentReference(contentReference);
      
      // FIXED: Safe pipeline usage - only try if available
      if (pipelineStatus.available) {
        try {
          const pipelineResult = services.tryGetPipeline();
          if (pipelineResult.pipeline) {
            console.log('Preparing content for NFT/Proposal with pipeline...');
            const prepared = await pipelineResult.pipeline.prepareForPublication(currentFormData);
            setPreparedContent(prepared);
            console.log('Content prepared for NFT/Proposal:', prepared);
          } else {
            console.log('Pipeline not available:', pipelineResult.error);
          }
        } catch (pipelineError) {
          console.warn('Pipeline preparation failed:', pipelineError);
          // This is non-critical, continue without it
        }
      } else {
        console.log('Pipeline not available - blockchain services not initialized');
      }
      
      // Save to draft storage
      if (editorState.saveDraft) {
        await editorState.saveDraft('Published to Swarm');
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

  // Check form validity
  const canPublish = editorState.formValidation.isValidForStep('publish') &&
                     editorState.formData.title?.trim() &&
                     editorState.formData.content?.trim() &&
                     editorState.formData.category?.trim();

  return (
    <div className="publish-step">
      <div className="step-header">
        <h2>🚀 Publish to Swarm Network</h2>
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
                  <span className="url-label">Public Gateway:</span>
                  <a 
                    href={services.swarm.getContentUrl(editorState.formData.contentReference, {
                      usePublicGateway: true,
                      forWebDisplay: true
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Swarm
                  </a>
                </div>
                {serviceStatus?.nodeRunning && (
                  <div className="url-item">
                    <span className="url-label">Local Node:</span>
                    <a 
                      href={services.swarm.getContentUrl(editorState.formData.contentReference, {
                        usePublicGateway: false,
                        forWebDisplay: true
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Locally
                    </a>
                  </div>
                )}
              </div>
            </div>
            {preparedContent && (
              <div className="prepared-content-info">
                <h4>📋 Content Prepared for Governance</h4>
                <p>NFT metadata and proposal data have been generated.</p>
                {preparedContent.tokenURI && (
                  <div className="token-uri">
                    <strong>Token URI Ready:</strong> ✅
                  </div>
                )}
              </div>
            )}
            <p className="reference-notice">
              Your content is now permanently stored on the decentralized web and accessible worldwide.
            </p>
          </div>
        ) : (
          <div className="publish-info">
            <h3>Ready to Publish</h3>
            
            {/* Current content summary */}
            <div className="current-content-summary">
              <h4>📄 Content to Publish:</h4>
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
                  <div className="status-item">
                    <span className="status-label">Content Pipeline:</span>
                    <span className={`status-value ${pipelineStatus.available ? 'available' : 'unavailable'}`}>
                      {pipelineStatus.available ? '🟢 Ready' : '🟡 Limited'}
                    </span>
                  </div>
                  {!pipelineStatus.available && pipelineStatus.error && (
                    <div className="status-item">
                      <span className="status-label">Pipeline Issue:</span>
                      <span className="status-value">{pipelineStatus.error}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="status-loading">⏳ Checking service status...</div>
              )}
            </div>
            
            <div className="publish-warning">
              <h4>📋 Publishing Information:</h4>
              <ul>
                <li>Content will be stored permanently on Swarm</li>
                <li>Images will automatically use the correct endpoints for web display</li>
                {pipelineStatus.available ? (
                  <li>NFT metadata will be generated for governance proposals</li>
                ) : (
                  <li className="info">ℹ️ NFT/Governance features require blockchain services (optional)</li>
                )}
                {serviceStatus?.nodeRunning ? (
                  <li>Publishing through your local Bee node for faster uploads</li>
                ) : (
                  <li className="info">ℹ️ Publishing through public gateway (local node offline)</li>
                )}
                <li>Publishing creates a permanent, immutable reference</li>
              </ul>
            </div>
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

        {/* Validation errors */}
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
    </div>
  );
};

export default PublishStep;