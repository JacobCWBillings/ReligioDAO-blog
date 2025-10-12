
// src/pages/editor/components/steps/SuccessStep.tsx
import React from 'react';

interface SuccessStepProps {
  editorState: any;
  onNewPost: () => void;
  onViewProposals: () => void;
  onViewBlogs: () => void;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({
  editorState,
  onNewPost,
  onViewProposals,
  onViewBlogs
}) => {
  return (
    <div className="success-step">
      <div className="success-container">
        <div className="success-message">
          <div className="success-icon">🎉</div>
          <h2>Proposal Submitted Successfully!</h2>
          <p>Your blog proposal has been submitted to the DAO for community voting.</p>
          
          <div className="success-details">
            <div className="detail-item">
              <strong>Title:</strong> {editorState.formData.title}
            </div>
            <div className="detail-item">
              <strong>Category:</strong> {editorState.formData.category}
            </div>
            {editorState.formData.contentReference && (
              <div className="detail-item">
                <strong>Content Reference:</strong>
                <code>{editorState.formData.contentReference}</code>
              </div>
            )}
          </div>

          <div className="success-info">
            <h3>What happens next?</h3>
            <ul>
              <li>Community members will be able to view and vote on your proposal</li>
              <li>If approved, your blog will be added to the official collection</li>
              <li>You can track voting progress in the Proposals section</li>
              <li>Proposal details are permanently stored on the blockchain</li>
            </ul>
          </div>

          <div className="success-actions">
            <button 
              className="primary-button" 
              onClick={onViewProposals}
            >
              View All Proposals
            </button>
            <button 
              className="secondary-button" 
              onClick={onViewBlogs}
            >
              Browse Blog Collection
            </button>
            <button 
              className="secondary-button" 
              onClick={onNewPost}
            >
              Write Another Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
