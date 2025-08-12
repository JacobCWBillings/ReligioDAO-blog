// src/pages/editor/SimpleEditorPage.tsx - FIXED VERSION
// Updated to use enhanced state management with proper synchronization
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { PlatformStatusBanner, useSimpleApp } from '../../contexts/SimpleAppContext';

// Services
import { services, contentService, assetService } from '../../services';

// Import our enhanced components and hooks
import { useEditorState } from './hooks/useEditorState';
import { useEditorWorkflow } from './hooks/useEditorWorkflow';
import { EditorWorkflow } from './components/EditorWorkflow';
import { DraftManager } from './components/DraftManager';
import { DraftStep } from './components/steps/DraftStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { PublishStep } from './components/steps/PublishStep';
import { GovernanceStep } from './components/steps/GovernanceStep';
import { SuccessStep } from './components/steps/SuccessStep';

// Import existing components
import { EnhancedAssetBrowser } from '../../components/editor/EnhancedAssetBrowser';

// Types
import { EditorStep, EnhancedBlogDraft } from '../../types/editorTypes';

// Styles
import './SimpleEditorPage.css';

/**
 * FIXED: SimpleEditorPage with enhanced state synchronization
 * Key improvements:
 * 1. Automatic save before step transitions
 * 2. Guaranteed current data publishing
 * 3. Better error handling and state tracking
 */
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

  const handleWorkflowChange = useCallback((step: EditorStep, workflowState: any) => {
    console.log('Workflow changed:', step, workflowState);
  }, []);

  const handleStepChange = useCallback((step: EditorStep, workflowState: any) => {
    console.log('Step changed:', step, workflowState);
  }, []);

  // FIXED: Initialize enhanced state management with synchronization
  const editorState = useEditorState({
    initialDraftId: draftId || undefined,
    onDraftSaved: handleDraftSaved,
    onWorkflowChange: handleWorkflowChange
  });

  // FIXED: Initialize workflow with save-before-transition capability
  const workflowState = useEditorWorkflow({
    draft: editorState.currentDraft,
    onStepChange: handleStepChange,
    ensureSavedForTransition: editorState.ensureSavedForTransition // NEW: Pass the save function
  });

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

  // Early return for service initialization issues (non-blocking)
  if (!serviceStatus.initialized && serviceStatus.error) {
    return (
      <div className="simple-editor-page service-error">
        <div className="service-error-content">
          <h2>Service Initialization Error</h2>
          <p>{serviceStatus.error}</p>
          <div className="error-actions">
            <button 
              className="retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button 
              className="continue-button"
              onClick={() => setServiceStatus(prev => ({ ...prev, error: null, initialized: true }))}
            >
              Continue Anyway
            </button>
          </div>
          <p className="error-note">
            You can continue in offline mode, but publishing features will be limited.
          </p>
        </div>
      </div>
    );
  }

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
        return (
          <div className="unknown-step">
            <h2>Unknown step: {currentStep}</h2>
            <p>Please refresh the page or contact support.</p>
          </div>
        );
    }
  };

  return (
    <div className="simple-editor-page" data-step={workflowState.currentStep}>
      {/* Platform status banner */}
      <PlatformStatusBanner />
      
      {/* Service status indicator */}
      <ServiceStatusIndicator />
      
      {/* FIXED: Enhanced state synchronization indicators */}
      {editorState.hasUnsavedChanges && workflowState.currentStep !== 'draft' && (
        <div className="sync-warning">
          <div className="warning-content">
            <span className="warning-icon">💾</span>
            <span>Unsaved changes detected - they will be automatically saved before publishing</span>
          </div>
        </div>
      )}
      
      {/* Connection warning for governance features */}
      {!isConnected && workflowState.currentStep === 'governance' && (
        <div className="connection-warning">
          <div className="warning-content">
            <span className="warning-icon">🔐</span>
            <span>Connect your wallet to submit governance proposals</span>
          </div>
        </div>
      )}

      {/* Swarm health warning */}
      {!serviceStatus.swarmHealthy && workflowState.currentStep === 'publish' && (
        <div className="swarm-warning">
          <div className="warning-content">
            <span className="warning-icon">📡</span>
            <span>Local Bee node offline - Publishing will use public gateway</span>
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

        {/* Enhanced Asset Toolbar - Available in draft and review steps */}
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
                  
                  {serviceStatus.swarmHealthy && (
                    <span className="toolbar-status healthy">
                      🟢 Swarm Ready
                    </span>
                  )}
                  
                  {!serviceStatus.swarmHealthy && (
                    <span className="toolbar-status warning">
                      🔴 Local Node Offline
                    </span>
                  )}
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
              
              {/* FIXED: Enhanced save status indicators */}
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

      {/* Enhanced Help section with sync info */}
      <div className="editor-help-section">
        <details className="help-accordion">
          <summary>Need Help? 📚</summary>
          <div className="help-content">
            <div className="help-section">
              <h4>FIXED: Enhanced State Synchronization</h4>
              <ul>
                <li><strong>Auto-save:</strong> Your work is automatically saved every 2 seconds</li>
                <li><strong>Step transitions:</strong> Current changes are saved before moving to next step</li>
                <li><strong>Publishing:</strong> Always uses your latest content, including unsaved changes</li>
                <li><strong>Real-time sync:</strong> Status indicators show save progress and sync state</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Workflow Improvements</h4>
              <ul>
                <li><strong>Draft:</strong> Write and edit with automatic background saving</li>
                <li><strong>Review:</strong> Preview ensures all content is synced and saved</li>
                <li><strong>Publish:</strong> Guaranteed to publish your current work, not old drafts</li>
                <li><strong>Governance:</strong> All form data is preserved through the process</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Status Indicators</h4>
              <ul>
                <li><strong>🟢 Synced:</strong> All changes are saved</li>
                <li><strong>🔄 Saving:</strong> Auto-save in progress</li>
                <li><strong>⚠️ Unsaved:</strong> Changes detected, auto-save will trigger</li>
                <li><strong>💾 Auto-saving:</strong> Currently saving your work</li>
              </ul>
            </div>

            <div className="help-section">
              <h4>Troubleshooting</h4>
              <ul>
                <li>If auto-save fails, you can manually save in the Draft step</li>
                <li>Step transitions will attempt to save current work automatically</li>
                <li>Publishing always uses current form data, never old saved drafts</li>
                <li>Check the sync indicator in sidebar for current save status</li>
              </ul>
            </div>
          </div>
        </details>
      </div>

      {/* Development info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info - State Sync</summary>
            <div className="dev-content">
              <h5>Service Status:</h5>
              <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
              <h5>Editor State:</h5>
              <pre>{JSON.stringify({
                currentDraftId: editorState.currentDraft?.id || 'None',
                hasUnsavedChanges: editorState.hasUnsavedChanges,
                isAutoSaving: editorState.isAutoSaving,
                lastSaved: editorState.lastSaved?.toISOString(),
                formDataLength: editorState.formData.content.length,
                formDataTitle: editorState.formData.title
              }, null, 2)}</pre>
              <h5>Workflow State:</h5>
              <pre>{JSON.stringify({
                currentStep: workflowState.currentStep,
                stepStatus: workflowState.workflowState.stepStatus,
                canProgress: workflowState.canProgress,
                isLoading: workflowState.isLoading
              }, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};