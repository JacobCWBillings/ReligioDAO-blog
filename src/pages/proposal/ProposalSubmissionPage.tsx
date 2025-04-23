// src/pages/proposal/ProposalSubmissionPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useGlobalState } from '../../contexts/GlobalStateContext';
import { Swarm } from '../../libswarm';
import { BlogProposal } from '../../types/blockchain';
import { marked } from 'marked';
import './ProposalSubmissionPage.css';

export const ProposalSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  
  const { isConnected, account } = useWallet();
  const { createBlogProposal, loading, error } = useProposal();
  const { globalState } = useGlobalState();
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [contentReference, setContentReference] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);
  
  // Form validation
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    content?: string;
    category?: string;
    description?: string;
  }>({});
  
  const [showPreview, setShowPreview] = useState(false);

  // Load draft if draftId is provided
  useEffect(() => {
    if (draftId) {
      const draftJson = localStorage.getItem(`blog-draft-${draftId}`);
      if (draftJson) {
        try {
          const draft = JSON.parse(draftJson);
          setTitle(draft.title || '');
          setContent(draft.content || '');
          setContentReference(draft.contentReference || '');
          setPreview(draft.preview || '');
          setBanner(draft.banner || null);
          setCategory(draft.category || '');
          
          // Handle tags - if it's an array, join it; if it's a string, use it
          if (draft.tags) {
            if (Array.isArray(draft.tags)) {
              setTags(draft.tags.join(', '));
            } else if (typeof draft.tags === 'string') {
              setTags(draft.tags);
            }
          }
          
          // Generate a default description if none exists
          if (!description) {
            setDescription(`A blog post about ${draft.category || 'various topics'} by ${account || 'a community member'}`);
          }
        } catch (err) {
          console.error('Error parsing draft:', err);
          setUploadError('Failed to load draft. Please try again or create a new proposal.');
        }
      }
    }
  }, [draftId, account, description]);

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      navigate('/');
    }
  }, [isConnected, navigate]);
  
  // Generate preview from content
  useEffect(() => {
    if (content && !preview) {
      // Generate a preview (first ~150 characters without markdown)
      const textContent = content.replace(/[#*_`-]/g, '');
      const previewText = textContent.length > 150 
        ? `${textContent.substring(0, 150)}...` 
        : textContent;
      setPreview(previewText);
    }
  }, [content, preview]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: { title?: string; content?: string; category?: string; description?: string } = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!content.trim() && !contentReference) {
      errors.content = 'Content is required';
    }
    
    if (!category.trim()) {
      errors.category = 'Category is required';
    }
    
    if (!description.trim()) {
      errors.description = 'Description is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Upload content to Swarm if we don't already have a content reference
  const uploadToSwarm = async (): Promise<string> => {
    // If we already have a content reference from the draft, use that
    if (contentReference) {
      return contentReference;
    }
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const swarm = new Swarm({
        beeApi: 'http://localhost:1633',
        postageBatchId: globalState.postageBatchId
      });
      
      // Upload blog content to Swarm
      const resource = await swarm.newResource(
        'blog.md',
        content,
        'text/markdown'
      );
      
      const result = await resource.save();
      
      return result.hash;
    } catch (err) {
      console.error('Error uploading to Swarm:', err);
      setUploadError('Failed to upload content to Swarm. Please try again.');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !account) {
      alert('Please connect your wallet to submit a proposal');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    try {
      // 1. Upload content to Swarm if needed
      const reference = await uploadToSwarm();
      setContentReference(reference);
      
      // 2. Create the blog proposal
      const tagsArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const blogProposal: BlogProposal = {
        title,
        content,
        contentReference: reference,
        preview,
        banner,
        category,
        tags: tagsArray,
        authorAddress: account,
        description
      };
      
      // 3. Submit the proposal to the DAO
      const result = await createBlogProposal(blogProposal);
      
      if (result.status === 'confirmed') {
        setSubmitSuccess(true);
        // Extract proposal ID from result if available
        // For now using a placeholder
        setProposalId('1');
        
        // Remove the draft from localStorage if it exists
        if (draftId) {
          localStorage.removeItem(`blog-draft-${draftId}`);
        }
      }
    } catch (err) {
      console.error('Error submitting proposal:', err);
      setUploadError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  // Handle cancel button
  const handleCancel = () => {
    navigate(-1);
  };

  // View proposal details
  const viewProposal = () => {
    if (proposalId) {
      navigate(`/proposals/${proposalId}`);
    }
  };

  return (
    <div className="proposal-submission-page">
      <h1>Submit Blog Proposal</h1>
      
      {submitSuccess ? (
        <div className="success-message">
          <h2>Proposal Submitted Successfully!</h2>
          <p>Your blog proposal has been submitted to the DAO for voting.</p>
          <button className="primary-button" onClick={viewProposal}>
            View Proposal
          </button>
          <button className="secondary-button" onClick={() => navigate('/blogs')}>
            Back to Blogs
          </button>
        </div>
      ) : (
        <div className="proposal-form-container">
          <div className="tabs">
            <button 
              className={!showPreview ? "active-tab" : ""} 
              onClick={() => setShowPreview(false)}
            >
              Edit
            </button>
            <button 
              className={showPreview ? "active-tab" : ""}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>
          </div>
          
          {showPreview ? (
            <div className="blog-preview">
              <h2>{title || 'Blog Title'}</h2>
              
              <div className="preview-metadata">
                <span className="preview-category">
                  {category || 'Category'}
                </span>
                <div className="preview-tags">
                  {tags.split(',').filter(Boolean).map((tag, index) => (
                    <span key={index} className="preview-tag">{tag.trim()}</span>
                  ))}
                </div>
              </div>
              
              <div 
                className="preview-content"
                dangerouslySetInnerHTML={{ __html: marked(content) }}
              />
              
              <div className="preview-footer">
                <div className="preview-author">
                  Author: {account ? `${account.substring(0, 6)}...${account.substring(38)}` : 'Your Address'}
                </div>
                <button 
                  className="preview-edit-button"
                  onClick={() => setShowPreview(false)}
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="title">Blog Title*</label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a title for your blog"
                  />
                  {formErrors.title && <div className="error-message">{formErrors.title}</div>}
                </div>
                
                <div className="form-row">
                  <div className="form-group half-width">
                    <label htmlFor="category">Category*</label>
                    <input
                      id="category"
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="E.g. Technology, Philosophy"
                    />
                    {formErrors.category && <div className="error-message">{formErrors.category}</div>}
                  </div>
                  
                  <div className="form-group half-width">
                    <label htmlFor="tags">Tags (comma separated)</label>
                    <input
                      id="tags"
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="E.g. blockchain, ethereum, dao"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">Proposal Description*</label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter a description for your proposal (why should the DAO approve this blog?)"
                    rows={3}
                  />
                  {formErrors.description && <div className="error-message">{formErrors.description}</div>}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="content">Blog Content*</label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your blog content in Markdown format..."
                  rows={15}
                  disabled={!!contentReference} // Disable if we have a content reference
                />
                {contentReference && (
                  <div className="content-reference-note">
                    <p>Your content has been uploaded to Swarm with reference: {contentReference}</p>
                  </div>
                )}
                {formErrors.content && <div className="error-message">{formErrors.content}</div>}
              </div>
              
              {(uploadError || error) && (
                <div className="error-message">
                  {uploadError || (error && error.message)}
                </div>
              )}
              
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-button"
                  disabled={isUploading || loading}
                >
                  {isUploading ? 'Uploading...' : loading ? 'Submitting...' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default ProposalSubmissionPage;