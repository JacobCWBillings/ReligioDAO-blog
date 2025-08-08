// src/pages/editor/components/steps/GovernanceStep.tsx - Fixed version
import React, { useState } from 'react';
import { useWallet } from '../../../../contexts/WalletContext';
import { useProposal } from '../../../../blockchain/hooks/useProposal';
import { enhancedDraftStorage } from '../../utils/draftStorage';
// Import the existing BlogProposal type from the blockchain types
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

  const handleSubmitToGovernance = async () => {
    if (!isConnected || !account) {
      setSubmitError('Please connect your wallet to submit a governance proposal');
      return;
    }

    if (!editorState.validateForm('governance')) {
      return;
    }

    if (!editorState.formData.contentReference) {
      setSubmitError('Content must be published to Swarm before submitting to governance');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    workflowState.setLoading(true);

    try {
      // Create proposal using the existing blockchain BlogProposal type
      const blogProposal: BlogProposal = {
        title: editorState.formData.title,
        content: editorState.formData.content,
        contentReference: editorState.formData.contentReference,
        preview: editorState.formData.preview || editorState.generatePreview(editorState.formData.content),
        banner: editorState.formData.banner || null, // Ensure null, not undefined
        category: editorState.formData.category,
        tags: editorState.formData.tags,
        authorAddress: account,
        description: editorState.formData.description || ''
      };

      // Submit to blockchain
      const result = await createBlogProposal(blogProposal);

      if (result.status === 'confirmed') {
        // Update workflow status
        workflowState.updateStepStatus('governance', true);
        
        // Extract proposal ID if available
        if (result.receipt) {
          // You might need to implement extractProposalIdFromReceipt
          // const extractedProposalId = extractProposalIdFromReceipt(result.receipt);
          // setProposalId(extractedProposalId);
        }

        // Mark draft as published
        if (editorState.currentDraft) {
          enhancedDraftStorage.saveDraft({
            ...editorState.currentDraft,
            isPublished: true,
            lastModified: Date.now()
          }, 'Submitted to governance');
        }

        // Auto-advance to success step
        setTimeout(() => {
          workflowState.goToStep('success');
        }, 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit governance proposal';
      setSubmitError(errorMessage);
      workflowState.setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      workflowState.setLoading(false);
    }
  };

  return (
    <div className="governance-step">
      <div className="step-header">
        <h2>🗳️ Submit Governance Proposal</h2>
        <p>Submit your published content as a proposal for the DAO community to vote on.</p>
      </div>

      <div className="governance-container">
        <div className="governance-form">
          <div className="field">
            <label htmlFor="description">Proposal Description *</label>
            <textarea
              id="description"
              value={editorState.formData.description || ''}
              onChange={(e) => editorState.updateDescription(e.target.value)}
              placeholder="Why should the DAO approve this blog? What value does it bring to the community?"
              rows={4}
              className={editorState.formErrors.description ? 'error' : ''}
            />
            {editorState.formErrors.description && (
              <span className="field-error">{editorState.formErrors.description}</span>
            )}
            <small className="field-hint">
              Explain the value your blog brings to the community and why members should vote to approve it.
            </small>
          </div>
        </div>

        <div className="proposal-summary">
          <h3>Proposal Summary</h3>
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
              <span>{editorState.formData.tags.join(', ') || 'None'}</span>
            </div>
            <div className="summary-item">
              <strong>Content Reference:</strong>
              <code>{editorState.formData.contentReference}</code>
            </div>
            <div className="summary-item">
              <strong>Author:</strong>
              <code>{account}</code>
            </div>
          </div>
        </div>

        <div className="governance-info">
          <h4>📋 Governance Process</h4>
          <ul>
            <li>Your proposal will be created as an NFT on the blockchain</li>
            <li>Community members can vote on your proposal</li>
            <li>Approved proposals become part of the official blog collection</li>
            <li>The voting period and requirements are set by DAO governance</li>
          </ul>
        </div>

        {(submitError || proposalError) && (
          <div className="error-message">
            <strong>Submission Failed:</strong> {submitError || proposalError?.message}
          </div>
        )}
      </div>

      {/* Step Actions */}
      <div className="step-actions">
        <div className="action-group">
          <button
            className="back-btn"
            onClick={() => workflowState.goToStep('publish')}
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
              !isConnected || 
              !editorState.formData.description?.trim() ||
              !editorState.formData.contentReference
            }
          >
            {isSubmitting || proposalLoading ? '⏳ Submitting...' : '🗳️ Submit Governance Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
};