// src/pages/editor/components/steps/GovernanceStep.tsx - FIXED VERSION
// Updated to work with unified state management and reliable success transition
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
  
  const { 
    createBlogProposal, 
    loading: proposalLoading, 
    error: proposalError,
    serviceStatus 
  } = useProposal();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Get blockchain readiness from the enhanced useProposal hook
  const isBlockchainReady = serviceStatus.blockchainReady;
  const blockchainError = serviceStatus.contextError;

  // Get proposal ID from unified state
  const proposalId = editorState.proposalId;

  // Validate governance requirements
  useEffect(() => {
    const errors: string[] = [];

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
    workflowState.setIsLoading(true);

    try {
      // STEP 1: Save the draft with current form data first
      console.log('Saving draft with current form data before governance submission...');
      const savedDraft = await editorState.saveDraft('Pre-governance save');
      
      if (!savedDraft) {
        throw new Error('Failed to save draft before governance submission');
      }

      // STEP 2: Create proposal from current form data
      const blogProposal: BlogProposal = {
        title: editorState.formData.title,
        content: editorState.formData.content,
        contentReference: editorState.formData.contentReference,
        preview: editorState.formData.preview || generatePreview(editorState.formData.content),
        banner: editorState.formData.banner || null,
        category: editorState.formData.category,
        tags: editorState.formData.tags,
        authorAddress: editorState.formData.authorAddress,
        description: editorState.formData.description
      };
      
      console.log('Submitting governance proposal:', blogProposal.title);

      // STEP 3: Enhanced pipeline usage if available
      try {
        const pipelineResult = services.tryGetPipeline();
        if (pipelineResult.pipeline) {
          console.log('Using enhanced pipeline for proposal preparation...');
          const preparedContent = await pipelineResult.pipeline.prepareForPublication(editorState.formData);
          console.log('Enhanced proposal preparation completed:', preparedContent);
        }
      } catch (pipelineError) {
        console.warn('Pipeline enhancement failed, continuing with standard proposal:', pipelineError);
      }

      // STEP 4: Submit to blockchain
      const result = await createBlogProposal(blogProposal);

      if (result.status === 'confirmed') {
        console.log('Governance proposal submitted successfully');

        // STEP 5: FIXED - Extract proposal ID and mark governance complete
        let transactionHash: string | undefined;
        if (result.receipt) {
          transactionHash = result.receipt.hash;
          console.log('Transaction confirmed with hash:', transactionHash);
          
          // Use the new unified state method to set proposal ID and mark complete
          editorState.setGovernanceProposalId(transactionHash);
        } else if (result.hash) {
          transactionHash = result.hash;
          editorState.setGovernanceProposalId(transactionHash);
        } else {
          // Mark as complete even without transaction hash
          editorState.markGovernanceComplete();
        }

        // STEP 6: Save final state to draft
        await editorState.saveDraft('Submitted to governance', {
          isPublished: true
        });
        
        // STEP 7: FIXED - Use the enhanced transition method
        console.log('Transitioning to success step with governance completion...');
        
        // Use force flag since we know governance is complete
        const transitionSuccess = await workflowState.goToStep('success', true);
        
        if (!transitionSuccess) {
          // Fallback: try direct step setting if goToStep fails
          console.warn('goToStep failed, using direct step transition');
          workflowState.currentStep = 'success';
        }

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
      workflowState.setIsLoading(false);
    }
  };

  const generatePreview = (content: string): string => {
    const textContent = content.replace(/[#*_`-]/g, '');
    return textContent.length > 150 
      ? `${textContent.substring(0, 150)}...` 
      : textContent;
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
            <div className="status-item">
              <span className="status-label">Governance:</span>
              <span className={`status-value ${editorState.governanceComplete ? 'complete' : 'pending'}`}>
                {editorState.governanceComplete ? '✅ Complete' : '⏳ Pending'}
              </span>
            </div>
          </div>
          
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
              disabled={!isBlockchainReady || editorState.governanceComplete}
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
            {proposalId && (
              <div className="summary-item">
                <strong>Proposal ID:</strong>
                <code className="proposal-id">{proposalId}</code>
              </div>
            )}
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
            <p>Your proposal has been submitted to the blockchain and is now available for community voting.</p>
          </div>
        )}

        {/* Error Display */}
        {(submitError || proposalError) && (
          <div className="error-message">
            <strong>Submission Failed:</strong> 
            <p>{submitError || proposalError?.message}</p>
            {submitError && isBlockchainReady && !proposalId && (
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
          {proposalId && editorState.governanceComplete ? (
            <button
              className="continue-btn"
              onClick={() => workflowState.goToStep('success', true)}
            >
              🎉 Continue to Success
            </button>
          ) : (
            <button
              className="submit-governance-btn"
              onClick={handleSubmitToGovernance}
              disabled={
                isSubmitting || 
                proposalLoading || 
                validationErrors.length > 0 ||
                !editorState.formData.description?.trim() ||
                !editorState.formData.contentReference ||
                !isBlockchainReady
              }
            >
              {isSubmitting || proposalLoading ? 
                '⏳ Submitting to Blockchain...' : 
                !isBlockchainReady ?
                  '🔴 Blockchain Required' :
                  '🗳️ Submit Governance Proposal'
              }
            </button>
          )}
        </div>
      </div>

      {/* Development info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info - Unified State</summary>
            <div className="dev-content">
              <h5>Service Status (from useProposal):</h5>
              <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
              <h5>Governance State (Unified):</h5>
              <pre>{JSON.stringify({
                proposalId: editorState.proposalId,
                governanceComplete: editorState.governanceComplete,
                stepStatus: workflowState.workflowState?.stepStatus,
                canProgress: workflowState.workflowState?.canProgress
              }, null, 2)}</pre>
              <h5>Validation Errors:</h5>
              <pre>{JSON.stringify(validationErrors, null, 2)}</pre>
              <h5>Form Data Summary:</h5>
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