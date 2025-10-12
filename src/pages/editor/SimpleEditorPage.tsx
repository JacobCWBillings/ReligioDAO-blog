// src/pages/editor/SimpleEditorPage.tsx - FIXED VERSION
// Properly integrated with unified state management
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { PlatformStatusBanner, useSimpleApp } from '../../contexts/SimpleAppContext';

// Services
import { services } from '../../swarm/services';

// Import our NEW unified state hook
import { useUnifiedEditorState } from './hooks/useUnifiedEditorState';

// Import components
import { EditorWorkflow } from './components/EditorWorkflow';
import { DraftManager } from './components/DraftManager';
import { DraftStep } from './components/steps/DraftStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { PublishStep } from './components/steps/PublishStep';
import { GovernanceStep } from './components/steps/GovernanceStep';
import { SuccessStep } from './components/steps/SuccessStep';
import { EnhancedAssetBrowser } from './components/EnhancedAssetBrowser';

// Types
import { EditorStep, EnhancedBlogDraft } from '../../types/editorTypes';

// Styles
import './SimpleEditorPage.css';

export const SimpleEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId');
  
  const { state } = useSimpleApp();
  const { isConnected } = useWallet();
  
  // Service status monitoring
  const [serviceStatus, setServiceStatus] = useState({
    initialized: false,
    swarmHealthy: false,
    error: null as string | null
  });
  
  // Asset browser state
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [assetBrowserError, setAssetBrowserError] = useState<string | null>(null);
  const [assetBrowserSuccess, setAssetBrowserSuccess] = useState<string | null>(null);

  // Initialize services and monitor status
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('Initializing services...');
        await services.initialize();
        const swarmStatus = await services.getStatus();
        
        setServiceStatus({
          initialized: true,
          swarmHealthy: swarmStatus.nodeRunning || Boolean(swarmStatus.publicGateway),
          error: swarmStatus.error || null
        });
        
        console.log('Services initialized successfully:', swarmStatus);
        
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setServiceStatus({
          initialized: false,
          swarmHealthy: false,
          error: error instanceof Error ? error.message : 'Service initialization failed'
        });
      }
    };

    initializeServices();
    
    // Set up periodic health check
    const healthCheckInterval = setInterval(async () => {
      try {
        const swarmStatus = await services.getStatus();
        setServiceStatus(prev => ({
          ...prev,
          swarmHealthy: swarmStatus.nodeRunning || Boolean(swarmStatus.publicGateway),
          error: swarmStatus.error || null
        }));
      } catch (error) {
        console.warn('Health check failed:', error);
      }
    }, 30000);

    return () => clearInterval(healthCheckInterval);
  }, []);

  // Callback handlers
  const handleDraftSaved = useCallback((draft: EnhancedBlogDraft) => {
    // Update URL with draft ID if not already present
    if (!draftId && draft.id) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('draftId', draft.id);
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    console.log('Draft saved:', draft.title, 'Content length:', draft.content.length);
  }, [draftId]);

  const handleStepChange = useCallback((step: EditorStep) => {
    console.log('Step changed to:', step);
  }, []);

  // ==========================================
  // USE UNIFIED STATE MANAGEMENT
  // ==========================================
  const editorState = useUnifiedEditorState({
    initialDraftId: draftId || undefined,
    onDraftSaved: handleDraftSaved,
    onStepChange: handleStepChange
  });

  // Create compatibility wrappers for existing components
  // This maps the unified state to the interface expected by step components
  const editorStateCompat = {
    formData: editorState.formData,
    formErrors: editorState.formErrors,
    formValidation: editorState.formValidation,
    isAutoSaving: editorState.isAutoSaving,
    updateTitle: editorState.updateTitle,
    updateContent: editorState.updateContent,
    updateCategory: editorState.updateCategory,
    updateTags: editorState.updateTags,
    updateBanner: editorState.updateBanner,
    updateDescription: editorState.updateDescription,
    updateContentReference: editorState.updateContentReference,
    updateFormData: editorState.updateFormData,
    saveDraft: editorState.saveDraft,
    loadDraftIntoForm: editorState.loadDraftIntoForm,
    createNewDraft: editorState.createNewDraft,
    currentDraft: editorState.currentDraft,
    proposalId: editorState.proposalId,
    governanceComplete: editorState.governanceComplete,
    setGovernanceProposalId: editorState.setGovernanceProposalId,
    markGovernanceComplete: editorState.markGovernanceComplete
  };

  const workflowStateCompat = {
    currentStep: editorState.currentStep,
    stepStatus: editorState.stepStatus, // Use stepStatus, not stepCompletion
    workflowState: editorState.workflowState,
    goToStep: editorState.goToStep,
    
    // Map the step names correctly: "publish" step uses "swarm" status internally
    updateStepStatus: (step: 'draft' | 'swarm' | 'governance', completed: boolean) => {
      editorState.updateStepStatus(step, completed);
    },
    
    // Compatibility wrapper for components that might use updateDraftStepProgress
    updateDraftStepProgress: async (updates: any) => {
      // Map updates to the unified state
      if (updates.draft !== undefined) {
        editorState.updateStepStatus('draft', updates.draft);
      }
      if (updates.swarm !== undefined) {
        editorState.updateStepStatus('swarm', updates.swarm);
      }
      if (updates.governance !== undefined) {
        editorState.updateStepStatus('governance', updates.governance);
        if (updates.governance === true) {
          editorState.markGovernanceComplete();
        }
      }
      // Return current draft for compatibility
      return editorState.currentDraft;
    },
    
    setIsLoading: editorState.setIsLoading,
    setError: editorState.setError,
    isLoading: editorState.isLoading,
    error: editorState.error,
    canProgress: editorState.workflowState.canProgress
  };

  // Asset browser integration
  const handleAssetInsertion = useCallback((markdownCode: string) => {
    const currentContent = editorState.formData.content;
    editorState.updateContent(currentContent + '\n\n' + markdownCode);
    setAssetBrowserSuccess('Asset inserted successfully!');
    setTimeout(() => setAssetBrowserSuccess(null), 2000);
  }, [editorState]);

  // Service status display component
  const ServiceStatusIndicator: React.FC = () => {
    if (!serviceStatus.initialized) {
      return (
        <div className="service-status initializing">
          <span className="status-icon">⏳</span>
          <span>Initializing services...</span>
        </div>
      );
    }

    if (serviceStatus.error) {
      return (
        <div className="service-status error">
          <span className="status-icon">⚠️</span>
          <span>Service Error: {serviceStatus.error}</span>
        </div>
      );
    }

    if (!serviceStatus.swarmHealthy) {
      return (
        <div className="service-status warning">
          <span className="status-icon">🔴</span>
          <span>Swarm node offline - Publishing limited to public gateway</span>
        </div>
      );
    }

    return (
      <div className="service-status healthy">
        <span className="status-icon">🟢</span>
        <span>All services operational</span>
      </div>
    );
  };

  // Early return for platform initialization
  if (!state.isInitialized) {
    return (
      <div className="simple-editor-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Initializing ReligioDAO Blog Platform</h2>
          <p>Setting up your decentralized blogging environment...</p>
          <ServiceStatusIndicator />
        </div>
      </div>
    );
  }

  // Early return for critical platform errors
  if (state.error) {
    return (
      <div className="simple-editor-error">
        <div className="error-content">
          <h2>Platform Error</h2>
          <p>{state.error}</p>
          <ServiceStatusIndicator />
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

  // Render step content based on current workflow step
  const renderStepContent = () => {
    const { currentStep } = editorState;
    
    switch (currentStep) {
      case 'draft':
        return (
          <DraftStep
            editorState={editorStateCompat}
            workflowState={workflowStateCompat}
            onShowAssetBrowser={() => setShowAssetBrowser(true)}
          />
        );
        
      case 'review':
        return (
          <ReviewStep
            editorState={editorStateCompat}
            workflowState={workflowStateCompat}
          />
        );
        
      case 'publish':
        return (
          <PublishStep
            editorState={editorStateCompat}
            workflowState={workflowStateCompat}
          />
        );
        
      case 'governance':
        return (
          <GovernanceStep
            editorState={editorStateCompat}
            workflowState={workflowStateCompat}
          />
        );
        
      case 'success':
        return (
          <SuccessStep
            editorState={editorStateCompat}
            onNewPost={editorState.createNewDraft}
            onViewProposals={() => navigate('/proposals')}
            onViewBlogs={() => navigate('/blogs')}
          />
        );
        
      default:
        return (
          <div className="unknown-step">
            <h2>Unknown step: {currentStep}</h2>
            <p>Please refresh the page or contact support.</p>
          </div>
        );
    }
  };

  return (
    <div className="simple-editor-page" data-step={editorState.currentStep}>
      {/* Platform status banner */}
      <PlatformStatusBanner />
      
      {/* Service status indicator */}
      <ServiceStatusIndicator />
      
      {/* State sync status indicators */}
      {editorState.hasUnsavedChanges && editorState.currentStep !== 'draft' && (
        <div className="sync-warning">
          <div className="warning-content">
            <span className="warning-icon">💾</span>
            <span>Unsaved changes will be automatically saved before publishing</span>
          </div>
        </div>
      )}
      
      {/* Connection warning for governance features */}
      {!isConnected && editorState.currentStep === 'governance' && (
        <div className="connection-warning">
          <div className="warning-content">
            <span className="warning-icon">🔒</span>
            <span>Connect your wallet to submit governance proposals</span>
          </div>
        </div>
      )}

      {/* Swarm health warning */}
      {!serviceStatus.swarmHealthy && editorState.currentStep === 'publish' && (
        <div className="swarm-warning">
          <div className="warning-content">
            <span className="warning-icon">📡</span>
            <span>Local Bee node offline - Publishing will use public gateway</span>
          </div>
        </div>
      )}

      <div className="editor-content">
        {/* Workflow Progress - Always visible except on success */}
        {editorState.currentStep !== 'success' && (
          <EditorWorkflow
            workflowState={editorState.workflowState}
            onStepClick={editorState.goToStep}
          />
        )}

        {/* Main Content Area */}
        <div className="editor-main-content">
          {/* Sidebar with Draft Manager - Hidden on success step */}
          {editorState.currentStep !== 'success' && (
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
              
              {/* Save status indicators */}
              {editorState.isAutoSaving && (
                <div className="auto-save-indicator">
                  <span>💾 Auto-saving current work...</span>
                </div>
              )}
              
              {editorState.lastSaved && !editorState.hasUnsavedChanges && (
                <div className="last-saved-indicator">
                  <span>✅ Saved {editorState.lastSaved.toLocaleTimeString()}</span>
                </div>
              )}

              {editorState.hasUnsavedChanges && (
                <div className="unsaved-changes-indicator">
                  <span>⚠️ Unsaved changes - Auto-save in progress</span>
                </div>
              )}

              {/* Service status in sidebar */}
              <div className="sidebar-service-status">
                <h4>🔧 Service Status</h4>
                <div className="service-status-grid">
                  <div className="status-item">
                    <span className="status-label">Swarm:</span>
                    <span className={`status-value ${serviceStatus.swarmHealthy ? 'healthy' : 'warning'}`}>
                      {serviceStatus.swarmHealthy ? '🟢 Online' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Services:</span>
                    <span className={`status-value ${serviceStatus.initialized ? 'healthy' : 'warning'}`}>
                      {serviceStatus.initialized ? '🟢 Ready' : '🔴 Initializing'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Sync:</span>
                    <span className={`status-value ${!editorState.hasUnsavedChanges ? 'healthy' : 'warning'}`}>
                      {!editorState.hasUnsavedChanges ? '🟢 Synced' : '🔄 Saving'}
                    </span>
                  </div>
                </div>
              </div>
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

      {/* Development info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info - Unified State</summary>
            <div className="dev-content">
              <h5>Service Status:</h5>
              <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
              <h5>Editor State (Unified):</h5>
              <pre>{JSON.stringify({
                currentStep: editorState.currentStep,
                stepStatus: editorState.stepStatus, // Fixed: use stepStatus not stepCompletion
                canProgress: editorState.workflowState.canProgress,
                hasUnsavedChanges: editorState.hasUnsavedChanges,
                isAutoSaving: editorState.isAutoSaving,
                lastSaved: editorState.lastSaved?.toISOString(),
                formDataTitle: editorState.formData.title,
                formDataLength: editorState.formData.content.length,
                contentReference: editorState.formData.contentReference
              }, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};