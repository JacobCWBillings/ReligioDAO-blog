// src/pages/editor/SimpleEditorPage.tsx - Updated for new service architecture
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { PlatformStatusBanner, useSimpleApp } from '../../contexts/SimpleAppContext';

// New service architecture
import { services, contentService, assetService } from '../../services';

// Import our modular components and hooks (these remain the same)
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
import { EditorStep, EnhancedBlogDraft } from '../../types/editorTypes';

// Styles
import './SimpleEditorPage.css';

/**
 * Refactored SimpleEditorPage using new service architecture
 * - Uses new SwarmService, ContentService, AssetService
 * - Maintains existing enhanced draft storage
 * - Improved error handling and service status monitoring
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
        
        // Initialize the service container
        await services.initialize();
        
        // Check service health
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
    }, 30000); // Check every 30 seconds

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
  }, [draftId]);

  const handleWorkflowChange = useCallback((step: EditorStep, workflowState: any) => {
    // Handle global workflow state changes
    console.log('Workflow changed:', step, workflowState);
  }, []);

  const handleStepChange = useCallback((step: EditorStep, workflowState: any) => {
    // Handle step navigation
    console.log('Step changed:', step, workflowState);
  }, []);

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

      {/* Enhanced Help section with service info */}
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
              <h4>New Service Architecture</h4>
              <ul>
                <li><strong>SwarmService:</strong> Handles all Swarm network operations</li>
                <li><strong>ContentService:</strong> Formats and processes blog content</li>
                <li><strong>AssetService:</strong> Manages images and file uploads</li>
                <li><strong>DraftStorage:</strong> Saves your work locally in browser</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Enhanced Features</h4>
              <ul>
                <li>Auto-save keeps your work safe as you type</li>
                <li>Asset management tracks images used in your content</li>
                <li>Draft history shows your workflow progress</li>
                <li>Improved error handling and offline support</li>
                <li>Seamless integration between local and public gateways</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Service Status</h4>
              <ul>
                <li><strong>🟢 Online:</strong> Full functionality available</li>
                <li><strong>🔴 Offline:</strong> Limited to public gateway operations</li>
                <li><strong>⚠️ Warning:</strong> Some features may be unavailable</li>
                <li>Drafts are always stored locally regardless of service status</li>
              </ul>
            </div>

            <div className="help-section">
              <h4>Troubleshooting</h4>
              <ul>
                <li>If Swarm is offline, you can still write and save drafts</li>
                <li>Publishing will use public gateway when local node is unavailable</li>
                <li>Refresh the page if services fail to initialize</li>
                <li>Check browser console for detailed error messages</li>
              </ul>
            </div>
          </div>
        </details>
      </div>

      {/* Development info (only show in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-info">
          <details>
            <summary>🔧 Development Info</summary>
            <div className="dev-content">
              <h5>Service Status:</h5>
              <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
              <h5>Current Draft:</h5>
              <pre>{JSON.stringify(editorState.currentDraft?.id || 'None', null, 2)}</pre>
              <h5>Workflow Step:</h5>
              <pre>{workflowState.currentStep}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};