// src/pages/editor/components/steps/GovernanceStep.tsx
import React, { useState, useEffect } from 'react';
import { useWallet } from '../../../../contexts/WalletContext';
import { useProposal } from '../../../../blockchain/hooks/useProposal'; 
import { enhancedDraftStorage } from '../../../../utils/draftStorage';
import { services } from '../../../../swarm/services';
import { BlogProposal } from '../../../../types/blockchainTypes';

interface GovernanceStepProps {
  editorState: any;
  workflowState: any;
}

export const GovernanceStep: React.FC<GovernanceStepProps> = ({
  editorState,
  workflowState
}) => {
  const { isConnected, account } = useWallet();
  
  // SIMPLIFIED: Use only the existing useProposal hook (now enhanced with centralized services)
  const { 
    createBlogProposal, 
    loading: proposalLoading, 
    error: proposalError,
    serviceStatus 
  } = useProposal();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Get blockchain readiness from the enhanced useProposal hook
  const isBlockchainReady = serviceStatus.blockchainReady;
  const blockchainError = serviceStatus.contextError;

  // Validate governance requirements
  useEffect(() => {
    const errors: string[] = [];

    // Basic validation
    if (!isConnected) {
      errors.push('Wallet must be connected to submit governance proposals');
    }

    if (!account) {
      errors.push('No account address available');
    }

    if (!editorState.formData.contentReference) {
      errors.push('Content must be published to Swarm before submitting to governance');
    }

    if (!editorState.formData.title?.trim()) {
      errors.push('Title is required');
    }

    if (!editorState.formData.content?.trim()) {
      errors.push('Content is required');
    }

    if (!editorState.formData.category?.trim()) {
      errors.push('Category is required');
    }

    if (!editorState.formData.description?.trim()) {
      errors.push('Proposal description is required for governance submissions');
    }

    // Blockchain service validation
    if (!isBlockchainReady) {
      errors.push('Blockchain services are not available - governance proposals require blockchain connectivity');
    }

    setValidationErrors(errors);
  }, [
    isConnected, 
    account, 
    editorState.formData.contentReference,
    editorState.formData.title,
    editorState.formData.content,
    editorState.formData.category,
    editorState.formData.description,
    isBlockchainReady
  ]);

  const handleSubmitToGovernance = async () => {
    if (validationErrors.length > 0) {
      setSubmitError('Please fix validation errors before submitting');
      return;
    }

    if (!isBlockchainReady) {
      setSubmitError('Blockchain services are not available. Please ensure your blockchain connection is working.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    workflowState.setLoading(true);

    try {
      // Save the draft with current form data first
      console.log('Saving draft with current form data before governance submission...');
      const savedDraft = await editorState.saveDraft('Pre-governance save');
      
      if (!savedDraft) {
        throw new Error('Failed to save draft before governance submission');
      }

      // Create proposal from draft
      const blogProposal: BlogProposal = enhancedDraftStorage.draftToProposal(savedDraft);
      console.log('Submitting governance proposal:', blogProposal.title);

      // Enhanced pipeline usage if available (using centralized services)
      try {
        const pipelineResult = services.tryGetPipeline();
        if (pipelineResult.pipeline) {
          console.log('Using enhanced pipeline for proposal preparation...');
          const preparedContent = await pipelineResult.pipeline.prepareForPublication(savedDraft);
          console.log('Enhanced proposal preparation completed:', preparedContent);
        }
      } catch (pipelineError) {
        console.warn('Pipeline enhancement failed, continuing with standard proposal:', pipelineError);
      }

      // Submit to blockchain using the existing hook
      const result = await createBlogProposal(blogProposal);

      if (result.status === 'confirmed') {
        console.log('Governance proposal submitted successfully');

        // Update workflow status
        workflowState.updateStepStatus('governance', true);
        
        // Extract proposal ID from transaction receipt
        if (result.receipt) {
          setProposalId(result.receipt.hash);
        }

        // Mark draft as published in governance - ensure all steps are marked complete
        const updatedDraft = enhancedDraftStorage.saveDraft({
          ...savedDraft,
          isPublished: true,
          stepProgress: {
            draft: true,  // Ensure all previous steps are marked complete
            swarm: true,  // This should already be true from publish step
            governance: true
          },
          lastModified: Date.now()
        }, 'Submitted to governance');

        // Update workflow status with all steps complete
        workflowState.updateStepStatus('draft', true);
        workflowState.updateStepStatus('publish', true);  // Use 'publish' not 'swarm'
        workflowState.updateStepStatus('governance', true);

        // Force update the current draft in editor state to ensure sync
        if (editorState.updateCurrentDraft) {
          editorState.updateCurrentDraft(updatedDraft);
        }
        
        // Auto-advance to success step
        setTimeout(() => {
          workflowState.goToStep('success');
        }, 1500);

      } else {
        throw new Error(`Proposal submission failed: ${result.status}`);
      }

    } catch (error) {
      console.error('Governance submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit governance proposal';
      setSubmitError(errorMessage);
      workflowState.setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      workflowState.setLoading(false);
    }
  };

  const getBlogUrls = () => {
    if (!editorState.formData.contentReference) return null;
    
    try {
      return services.content.getBlogUrls(editorState.formData.contentReference);
    } catch (error) {
      console.error('Failed to get blog URLs:', error);
      return null;
    }
  };

  const blogUrls = getBlogUrls();

  return (
    <div className="governance-step">
      <div className="step-header">
        <h2>🗳️ Submit Governance Proposal</h2>
        <p>Submit your published content as a proposal for the DAO community to vote on.</p>
      </div>

      <div className="governance-container">
        {/* Service Status Display */}
        <div className="service-status-info">
          <h4>🔧 Service Status</h4>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Wallet:</span>
              <span className={`status-value ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Connected' : '🔴 Not Connected'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Blockchain Services:</span>
              <span className={`status-value ${isBlockchainReady ? 'available' : 'unavailable'}`}>
                {isBlockchainReady ? '🟢 Ready' : '🔴 Not Available'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Content:</span>
              <span className={`status-value ${editorState.formData.contentReference ? 'published' : 'unpublished'}`}>
                {editorState.formData.contentReference ? '🟢 Published' : '🔴 Not Published'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Enhanced Pipeline:</span>
              <span className={`status-value ${services.hasPipeline ? 'available' : 'unavailable'}`}>
                {services.hasPipeline ? '🟢 Available' : '🟡 Basic Mode'}
              </span>
            </div>
          </div>
          
          {/* Error display */}
          {blockchainError && (
            <div className="service-error-message">
              <span>⚠️ {blockchainError}</span>
            </div>
          )}
        </div>

        {/* Service warnings */}
        {!isBlockchainReady && (
          <div className="service-warning">
            <h4>⚠️ Blockchain Services Required</h4>
            <p>
              Governance proposals require blockchain connectivity.
              {blockchainError && ` Error: ${blockchainError}`}
            </p>
            <p>
              <strong>Note:</strong> Please connect your wallet and ensure blockchain services are initialized.
            </p>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <h4>⚠️ Please fix the following issues:</h4>
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Governance Form */}
        <div className="governance-form">
          <div className="field">
            <label htmlFor="description">Proposal Description *</label>
            <textarea
              id="description"
              value={editorState.formData.description || ''}
              onChange={(e) => editorState.updateDescription(e.target.value)}
              placeholder="Why should the DAO approve this blog? What value does it bring to the community? What makes this content unique or important?"
              rows={6}
              className={editorState.formErrors.description ? 'error' : ''}
              disabled={!isBlockchainReady}
            />
            {editorState.formErrors.description && (
              <span className="field-error">{editorState.formErrors.description}</span>
            )}
            <small className="field-hint">
              Provide a compelling description of why your blog deserves community approval. 
              Include the value it brings, its relevance to the DAO's mission, and any unique insights or perspectives.
            </small>
          </div>
        </div>

        {/* Content Preview */}
        {editorState.formData.contentReference && blogUrls && (
          <div className="content-preview">
            <h4>📖 Published Content Preview</h4>
            <div className="preview-links">
              <div className="link-item">
                <span className="link-label">Public Web View:</span>
                <a 
                  href={blogUrls.public} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="preview-link"
                >
                  {blogUrls.public} ↗
                </a>
              </div>
              {blogUrls.local && (
                <div className="link-item">
                  <span className="link-label">Local Web View:</span>
                  <a 
                    href={blogUrls.local} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="preview-link"
                  >
                    {blogUrls.local} ↗
                  </a>
                </div>
              )}
            </div>
            <p className="preview-note">
              Community members will be able to view your content at these URLs when voting on your proposal.
            </p>
          </div>
        )}

        {/* Proposal Summary */}
        <div className="proposal-summary">
          <h3>📋 Proposal Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <strong>Title:</strong>
              <span>{editorState.formData.title}</span>
            </div>
            <div className="summary-item">
              <strong>Category:</strong>
              <span>{editorState.formData.category}</span>
            </div>
            <div className="summary-item">
              <strong>Tags:</strong>
              <span>{editorState.formData.tags?.join(', ') || 'None'}</span>
            </div>
            <div className="summary-item">
              <strong>Content Reference:</strong>
              <code className="reference-code">{editorState.formData.contentReference}</code>
            </div>
            <div className="summary-item">
              <strong>Author:</strong>
              <code className="author-address">{account}</code>
            </div>
            <div className="summary-item">
              <strong>Content Length:</strong>
              <span>{editorState.formData.content?.length || 0} characters</span>
            </div>
            {editorState.formData.banner && (
              <div className="summary-item">
                <strong>Banner:</strong>
                <span className="banner-preview">
                  <img src={editorState.formData.banner} alt="Banner" />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Governance Information */}
        <div className="governance-info">
          <h4>📋 Governance Process</h4>
          <ul>
            <li>Your proposal will be created as an NFT on the blockchain</li>
            <li>Community members can view your published content and vote on your proposal</li>
            <li>Approved proposals become part of the official ReligioDAO blog collection</li>
            <li>The voting period and approval requirements are set by DAO governance</li>
            <li>Proposal submission requires blockchain transaction fees (gas)</li>
            {services.hasPipeline && (
              <li>✨ Enhanced pipeline features are available for this proposal</li>
            )}
          </ul>
        </div>

        {/* Submission Status */}
        {proposalId && (
          <div className="submission-success">
            <h4>✅ Proposal Submitted Successfully!</h4>
            <div className="proposal-details">
              <div className="detail-item">
                <strong>Transaction Hash:</strong>
                <code>{proposalId}</code>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {(submitError || proposalError) && (
          <div className="error-message">
            <strong>Submission Failed:</strong> 
            <p>{submitError || proposalError?.message}</p>
            {submitError && isBlockchainReady && (
              <div className="error-actions">
                <button 
                  className="retry-btn"
                  onClick={handleSubmitToGovernance}
                  disabled={isSubmitting || proposalLoading || validationErrors.length > 0}
                >
                  Retry Submission
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step Actions */}
      <div className="step-actions">
        <div className="action-group">
          <button
            className="back-btn"
            onClick={() => workflowState.goToStep('publish')}
            disabled={isSubmitting || proposalLoading}
          >
            ← Back to Publish
          </button>
        </div>
        
        <div className="action-group">
          <button
            className="submit-governance-btn"
            onClick={handleSubmitToGovernance}
            disabled={
              isSubmitting || 
              proposalLoading || 
              validationErrors.length > 0 ||
              !editorState.formData.description?.trim() ||
              !editorState.formData.contentReference ||
              !isBlockchainReady ||
              !!proposalId // Disable if already submitted
            }
          >
            {isSubmitting || proposalLoading ? 
              '⏳ Submitting to Blockchain...' : 
              proposalId ? 
                '✅ Proposal Submitted' :
                !isBlockchainReady ?
                  '🔴 Blockchain Required' :
                  '🗳️ Submit Governance Proposal'
            }
          </button>
        </div>
      </div>

      {/* Development info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info - Streamlined</summary>
            <div className="dev-content">
              <h5>Service Status (from useProposal):</h5>
              <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
              <h5>Validation Errors:</h5>
              <pre>{JSON.stringify(validationErrors, null, 2)}</pre>
              <h5>Form Data:</h5>
              <pre>{JSON.stringify({
                title: editorState.formData.title,
                category: editorState.formData.category,
                contentReference: editorState.formData.contentReference,
                hasDescription: !!editorState.formData.description?.trim()
              }, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};