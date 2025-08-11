// src/pages/editor/components/steps/GovernanceStep.tsx - FIXED VERSION
import React, { useState } from 'react';
import { useWallet } from '../../../../contexts/WalletContext';
import { useProposal } from '../../../../blockchain/hooks/useProposal';
import { enhancedDraftStorage } from '../../../../utils/draftStorage';
import { contentService } from '../../../../services';
// Import the existing BlogProposal type from blockchain types
import { BlogProposal } from '../../../../types/blockchain';

interface GovernanceStepProps {
  editorState: any;
  workflowState: any;
}

export const GovernanceStep: React.FC<GovernanceStepProps> = ({
  editorState,
  workflowState
}) => {
  const { isConnected, account } = useWallet();
  const { createBlogProposal, loading: proposalLoading, error: proposalError } = useProposal();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Validate governance requirements
  React.useEffect(() => {
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

    setValidationErrors(errors);
  }, [
    isConnected, 
    account, 
    editorState.formData.contentReference,
    editorState.formData.title,
    editorState.formData.content,
    editorState.formData.category,
    editorState.formData.description
  ]);

  const handleSubmitToGovernance = async () => {
    if (validationErrors.length > 0) {
      setSubmitError('Please fix validation errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    workflowState.setLoading(true);

    try {
      // FIXED: Save the draft with current form data first to ensure it includes the description
      console.log('Saving draft with current form data before governance submission...');
      const savedDraft = await editorState.saveDraft('Pre-governance save');
      
      if (!savedDraft) {
        throw new Error('Failed to save draft before governance submission');
      }

      // FIXED: Now use the freshly saved draft that includes all current form data
      const blogProposal: BlogProposal = enhancedDraftStorage.draftToProposal(savedDraft);

      console.log('Submitting governance proposal:', blogProposal.title);

      // Submit to blockchain
      const result = await createBlogProposal(blogProposal);

      if (result.status === 'confirmed') {
        console.log('Governance proposal submitted successfully');

        // Update workflow status
        workflowState.updateStepStatus('governance', true);
        
        // FIXED: Extract proposal ID correctly from transaction receipt
        if (result.receipt) {
          // The TransactionReceipt has a 'hash' property, not 'transactionHash'
          setProposalId(result.receipt.hash); // Use the transaction hash as proposal ID
        }

        // Mark draft as published in governance
        enhancedDraftStorage.saveDraft({
          ...savedDraft,
          isPublished: true,
          stepProgress: {
            ...savedDraft.stepProgress,
            governance: true
          },
          lastModified: Date.now()
        }, 'Submitted to governance');

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
    
    return contentService.getBlogUrls(editorState.formData.contentReference);
  };

  const blogUrls = getBlogUrls();

  return (
    <div className="governance-step">
      <div className="step-header">
        <h2>🗳️ Submit Governance Proposal</h2>
        <p>Submit your published content as a proposal for the DAO community to vote on.</p>
      </div>

      <div className="governance-container">
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
            {submitError && (
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
              !!proposalId // Disable if already submitted
            }
          >
            {isSubmitting || proposalLoading ? 
              '⏳ Submitting to Blockchain...' : 
              proposalId ? 
                '✅ Proposal Submitted' :
                '🗳️ Submit Governance Proposal'
            }
          </button>
        </div>
      </div>

      {/* Development info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info</summary>
            <div className="dev-content">
              <h5>Validation Errors:</h5>
              <pre>{JSON.stringify(validationErrors, null, 2)}</pre>
              <h5>Form Data Description:</h5>
              <pre>{JSON.stringify({
                description: editorState.formData.description,
                hasDescription: !!editorState.formData.description?.trim()
              }, null, 2)}</pre>
              <h5>Current Draft Description:</h5>
              <pre>{JSON.stringify({
                draftDescription: editorState.currentDraft?.description,
                hasDraftDescription: !!editorState.currentDraft?.description?.trim()
              }, null, 2)}</pre>
              <h5>Proposal Data:</h5>
              <pre>{JSON.stringify({
                title: editorState.formData.title,
                category: editorState.formData.category,
                contentReference: editorState.formData.contentReference
              }, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};