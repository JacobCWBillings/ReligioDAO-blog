// src/pages/proposal/ProposalSubmissionPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useSimpleApp } from '../../contexts/SimpleAppContext';
import { useProposalSubmissionGuard } from '../../hooks/useNavigationGuard';
import { beeBlogService, BlogDraft } from '../../services/BeeBlogService';
import { BlogProposal } from '../../types/blockchain';
import { extractProposalIdFromReceipt } from '../../blockchain/utils/transactionUtils';
import { marked } from 'marked';
import './ProposalSubmissionPage.css';

export const ProposalSubmissionPage: React.FC = () => {
  // Apply the navigation guard
  useProposalSubmissionGuard();
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  
  const { isConnected, account } = useWallet();
  const { createBlogProposal, loading, error } = useProposal();
  const { state: appState } = useSimpleApp();
  
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
  const [loadedDraft, setLoadedDraft] = useState<BlogDraft | null>(null);
  
  // Form validation
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    content?: string;
    category?: string;
    description?: string;
  }>({});
  
  const [showPreview, setShowPreview] = useState(false);

  // Validate draft exists and load it
  useEffect(() => {
    if (!draftId) {
      console.log('No draftId provided, redirecting to editor');
      navigate('/editor');
      return;
    }
    
    // Load draft using BeeBlogService
    const draft = beeBlogService.loadDraft(draftId);
    
    if (!draft) {
      console.log('Draft not found, redirecting to editor');
      navigate('/editor');
      return;
    }
    
    // Validate draft has required fields
    if (!draft.title || !draft.content) {
      console.warn('Draft is missing critical fields (title or content)');
      navigate('/editor');
      return;
    }
    
    setLoadedDraft(draft);
  }, [draftId, navigate]);

  // Populate form from loaded draft
  useEffect(() => {
    if (!loadedDraft) return;
    
    setTitle(loadedDraft.title);
    setContent(loadedDraft.content);
    setPreview(loadedDraft.preview);
    setBanner(loadedDraft.banner || null);
    setCategory(loadedDraft.category);
    setContentReference(loadedDraft.contentReference || '');
    
    // Handle tags - if it's an array, join it; if it's a string, use it
    if (loadedDraft.tags) {
      if (Array.isArray(loadedDraft.tags)) {
        setTags(loadedDraft.tags.join(', '));
      } else if (typeof loadedDraft.tags === 'string') {
        setTags(loadedDraft.tags);
      }
    }
    
    // Generate a default description if none exists
    if (!description && account) {
      setDescription(`A blog post about ${loadedDraft.category || 'various topics'} by ${account.substring(0, 6)}...${account.substring(38)}`);
    }
  }, [loadedDraft, account, description]);
  
  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      navigate('/');
    }
  }, [isConnected, navigate]);
  
  // Generate preview from content if not already set
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
    
    if (!content.trim()) {
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

  // Upload content to Swarm using BeeBlogService
  const uploadToSwarm = async (): Promise<string> => {
    // If we already have a content reference from the draft, use that
    if (contentReference) {
      return contentReference;
    }
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Check if BeeBlogService is ready
      const serviceStatus = await beeBlogService.getServiceStatus();
      if (!serviceStatus.nodeRunning) {
        throw new Error('Bee node is not running. Please start your local Bee node.');
      }
      
      // Create blog content object for upload
      const blogContent = {
        title,
        content,
        metadata: {
          author: account || '',
          category,
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
          createdAt: Date.now(),
          banner: banner || undefined
        }
      };
      
      // Upload using BeeBlogService
      const reference = await beeBlogService.uploadBlogContent(blogContent);
      
      // Update the draft with the content reference
      if (loadedDraft && draftId) {
        const updatedDraft = {
          ...loadedDraft,
          contentReference: reference,
          title,
          content,
          category,
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
          lastModified: Date.now()
        };
        
        beeBlogService.saveDraft(updatedDraft);
      }
      
      return reference;
    } catch (err) {
      console.error('Error uploading to Swarm:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload content to Swarm';
      setUploadError(errorMessage);
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
      // 1. Upload content to Swarm or use existing reference
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
        
        // Extract proposal ID from transaction receipt events if available
        if (result.receipt) {
          const extractedProposalId = extractProposalIdFromReceipt(result.receipt);
          if (extractedProposalId) {
            setProposalId(extractedProposalId);
          }
        }
        
        // Mark draft as published and remove from localStorage
        if (draftId) {
          // Update draft to mark as published
          if (loadedDraft) {
            const publishedDraft = {
              ...loadedDraft,
              isPublished: true,
              contentReference: reference,
              lastModified: Date.now()
            };
            beeBlogService.saveDraft(publishedDraft);
          }
          
          // Optionally remove the draft after successful submission
          // beeBlogService.deleteDraft(draftId);
        }
      }
    } catch (err) {
      console.error('Error submitting proposal:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setUploadError(errorMessage);
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
    } else {
      // If we don't have a proposal ID, just go to the proposals list
      navigate('/proposals');
    }
  };

  // Check if platform is ready for content upload
  const isPlatformReady = appState.isInitialized && appState.status.beeNodeRunning;

  return (
    <div className="proposal-submission-page">
      <h1>Submit Blog Proposal</h1>
      
      {!isPlatformReady && (
        <div className="platform-warning">
          <p>⚠️ Platform not ready for content upload. Please ensure your Bee node is running.</p>
        </div>
      )}
      
      {submitSuccess ? (
        <div className="success-message">
          <h2>Proposal Submitted Successfully!</h2>
          <p>Your blog proposal has been submitted to the DAO for voting.</p>
          <p>Content Reference: <code>{contentReference}</code></p>
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
                />
                {contentReference && (
                  <div className="content-reference-note">
                    <p>✅ Content uploaded to Swarm: <code>{contentReference}</code></p>
                    <p className="reference-notice">This reference ensures your content is permanently stored on the decentralized web.</p>
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
                  disabled={isUploading || loading || !isPlatformReady}
                >
                  {isUploading ? 'Uploading to Swarm...' : loading ? 'Submitting Proposal...' : 'Submit Proposal'}
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