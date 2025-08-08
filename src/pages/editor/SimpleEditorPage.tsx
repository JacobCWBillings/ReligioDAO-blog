// src/pages/editor/SimpleEditorPage.tsx - Refactored and simplified
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { PlatformStatusBanner, useSimpleApp } from '../../contexts/SimpleAppContext';

// Import our new modular components and hooks
import { useEditorState } from './hooks/useEditorState';
import { useEditorWorkflow } from './hooks/useEditorWorkflow';
import { EditorWorkflow } from './components/EditorWorkflow';
import { DraftManager } from './components/DraftManager';
import { DraftStep } from './components/steps/DraftStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { PublishStep } from './components/steps/PublishStep';
import { GovernanceStep } from './components/steps/GovernanceStep';
import { SuccessStep } from './components/steps/SuccessStep';

// Import existing components that we'll integrate
import { EnhancedAssetBrowser } from '../../components/editor/EnhancedAssetBrowser';

// Types
import { EditorStep, EnhancedBlogDraft } from './types/editorTypes';

// Styles
import './SimpleEditorPage.css';

/**
 * Refactored SimpleEditorPage - Now acts as an orchestrator
 * Delegates specific responsibilities to focused components
 */
export const SimpleEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  
  const { state } = useSimpleApp();
  const { isConnected } = useWallet();
  
  // Asset browser state
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [assetBrowserError, setAssetBrowserError] = useState<string | null>(null);
  const [assetBrowserSuccess, setAssetBrowserSuccess] = useState<string | null>(null);

  // Initialize state management hooks
  const editorState = useEditorState({
    initialDraftId: draftId || undefined,
    onDraftSaved: handleDraftSaved,
    onWorkflowChange: handleWorkflowChange
  });

  const workflowState = useEditorWorkflow({
    draft: editorState.currentDraft,
    onStepChange: handleStepChange
  });

  // Early return for platform initialization
  if (!state.isInitialized) {
    return (
      <div className="simple-editor-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Initializing ReligioDAO Blog Platform</h2>
          <p>Setting up your decentralized blogging environment...</p>
        </div>
      </div>
    );
  }

  // Early return for critical errors
  if (state.error) {
    return (
      <div className="simple-editor-error">
        <div className="error-content">
          <h2>Platform Error</h2>
          <p>{state.error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Callback handlers
  function handleDraftSaved(draft: EnhancedBlogDraft) {
    // Update URL with draft ID if not already present
    if (!draftId) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('draftId', draft.id);
      window.history.replaceState({}, '', newUrl.toString());
    }
  }

  function handleWorkflowChange(step: EditorStep, workflowState: any) {
    // Handle global workflow state changes
    console.log('Workflow changed:', step, workflowState);
  }

  function handleStepChange(step: EditorStep, workflowState: any) {
    // Handle step navigation
    console.log('Step changed:', step, workflowState);
  }

  // Asset browser integration
  const handleAssetInsertion = useCallback((markdownCode: string) => {
    const currentContent = editorState.formData.content;
    editorState.updateContent(currentContent + '\n\n' + markdownCode);
    setAssetBrowserSuccess('Asset inserted successfully!');
    setTimeout(() => setAssetBrowserSuccess(null), 2000);
  }, [editorState]);

  // Render step content based on current workflow step
  const renderStepContent = () => {
    const { currentStep } = workflowState;
    
    switch (currentStep) {
      case 'draft':
        return (
          <DraftStep
            editorState={editorState}
            workflowState={workflowState}
            onShowAssetBrowser={() => setShowAssetBrowser(true)}
          />
        );
        
      case 'review':
        return (
          <ReviewStep
            editorState={editorState}
            workflowState={workflowState}
          />
        );
        
      case 'publish':
        return (
          <PublishStep
            editorState={editorState}
            workflowState={workflowState}
          />
        );
        
      case 'governance':
        return (
          <GovernanceStep
            editorState={editorState}
            workflowState={workflowState}
          />
        );
        
      case 'success':
        return (
          <SuccessStep
            editorState={editorState}
            onNewPost={editorState.createNewDraft}
            onViewProposals={() => navigate('/proposals')}
            onViewBlogs={() => navigate('/blogs')}
          />
        );
        
      default:
        return <div>Unknown step: {currentStep}</div>;
    }
  };

  return (
    <div className="simple-editor-page" data-step={workflowState.currentStep}>
      {/* Platform status banner */}
      <PlatformStatusBanner />
      
      {/* Connection warning for governance features */}
      {!isConnected && workflowState.currentStep === 'governance' && (
        <div className="connection-warning">
          <div className="warning-content">
            <span className="warning-icon">🔐</span>
            <span>Connect your wallet to submit governance proposals</span>
          </div>
        </div>
      )}

      <div className="editor-content">
        {/* Workflow Progress - Always visible except on success */}
        {workflowState.currentStep !== 'success' && (
          <EditorWorkflow
            workflowState={workflowState.workflowState}
            onStepClick={workflowState.goToStep}
          />
        )}

        {/* Unified Asset Toolbar - Available in draft and review steps */}
        {(workflowState.currentStep === 'draft' || workflowState.currentStep === 'review') && (
          <div className="unified-asset-toolbar">
            <div className="toolbar-content">
              <div className="toolbar-section">
                <h4>📎 Asset Tools</h4>
                <div className="toolbar-buttons">
                  <button 
                    className="toolbar-btn asset-browser-btn"
                    onClick={() => setShowAssetBrowser(true)}
                    disabled={!isConnected}
                    title={!isConnected ? 'Connect wallet to use assets' : 'Open asset library'}
                  >
                    🗂️ Asset Library
                  </button>
                </div>
              </div>

              {/* Status messages */}
              {(assetBrowserError || assetBrowserSuccess) && (
                <div className="toolbar-messages">
                  {assetBrowserError && (
                    <div className="toolbar-error">{assetBrowserError}</div>
                  )}
                  {assetBrowserSuccess && (
                    <div className="toolbar-success">{assetBrowserSuccess}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="editor-main-content">
          {/* Sidebar with Draft Manager - Hidden on success step */}
          {workflowState.currentStep !== 'success' && (
            <aside className="editor-sidebar">
              <DraftManager
                currentDraft={editorState.currentDraft}
                onLoadDraft={editorState.loadDraftIntoForm}
                onDeleteDraft={(draftId) => {
                  if (draftId === editorState.currentDraft?.id) {
                    editorState.createNewDraft();
                  }
                }}
                onNewDraft={editorState.createNewDraft}
              />
              
              {/* Show auto-save status */}
              {editorState.isAutoSaving && (
                <div className="auto-save-indicator">
                  <span>💾 Auto-saving...</span>
                </div>
              )}
              
              {editorState.lastSaved && (
                <div className="last-saved-indicator">
                  <span>✅ Saved {editorState.lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
            </aside>
          )}

          {/* Step Content */}
          <main className="step-content">
            {renderStepContent()}
          </main>
        </div>
      </div>

      {/* Enhanced Asset Browser */}
      <EnhancedAssetBrowser
        isOpen={showAssetBrowser}
        onClose={() => {
          setShowAssetBrowser(false);
          setAssetBrowserError(null);
          setAssetBrowserSuccess(null);
        }}
        onInsertAsset={handleAssetInsertion}
      />

      {/* Help section */}
      <div className="editor-help-section">
        <details className="help-accordion">
          <summary>Need Help? 📚</summary>
          <div className="help-content">
            <div className="help-section">
              <h4>Unified Workflow</h4>
              <ul>
                <li><strong>Draft:</strong> Write and edit your content using Markdown</li>
                <li><strong>Review:</strong> Preview how your post will look</li>
                <li><strong>Publish:</strong> Store permanently on Swarm network</li>
                <li><strong>Governance:</strong> Submit as DAO proposal for voting</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Enhanced Features</h4>
              <ul>
                <li>Auto-save keeps your work safe as you type</li>
                <li>Asset management tracks images used in your content</li>
                <li>Draft history shows your workflow progress</li>
                <li>Seamless integration between local and public gateways</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Data Flow</h4>
              <ul>
                <li>Drafts are stored locally in your browser</li>
                <li>Publishing uploads content to Swarm network</li>
                <li>Governance creates an NFT proposal on-chain</li>
                <li>All steps maintain data consistency</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};