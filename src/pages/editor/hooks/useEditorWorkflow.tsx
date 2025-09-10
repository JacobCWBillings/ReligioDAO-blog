// src/pages/editor/hooks/useEditorWorkflow.tsx - FIXED VERSION
// Better synchronization with draft state changes and initial state
import { useState, useCallback, useEffect } from 'react';
import { useSimpleApp } from '../../../contexts/SimpleAppContext';
import { EditorStep, EditorWorkflowState, EnhancedBlogDraft } from '../../../types/editorTypes';
import { enhancedDraftStorage } from '../../../utils/draftStorage';

interface UseEditorWorkflowProps {
  initialStep?: EditorStep;
  draft?: EnhancedBlogDraft | null;
  onStepChange?: (step: EditorStep, state: EditorWorkflowState) => void;
  ensureSavedForTransition?: (targetStep: EditorStep) => Promise<boolean>;
}

export const useEditorWorkflow = ({
  initialStep = 'draft',
  draft,
  onStepChange,
  ensureSavedForTransition
}: UseEditorWorkflowProps = {}) => {
  const { state: appState } = useSimpleApp();
  
  // Initialize with a more reasonable default state
  const [workflowState, setWorkflowState] = useState<EditorWorkflowState>(() => {
    // If we have a draft on initialization, use its state
    if (draft) {
      const stepStatus = draft.stepProgress || {
        draft: Boolean(draft.title && draft.content && draft.category),
        swarm: Boolean(draft.contentReference),
        governance: Boolean(draft.isPublished)
      };
      
      return {
        currentStep: initialStep,
        stepStatus,
        canProgress: false, // Will be calculated in effect
        isLoading: false,
        error: null
      };
    }
    
    // Default state for new drafts
    return {
      currentStep: initialStep,
      stepStatus: {
        draft: false,
        swarm: false,
        governance: false
      },
      canProgress: false,
      isLoading: false,
      error: null
    };
  });

  // ENHANCED: More robust draft synchronization
  useEffect(() => {
    if (draft) {
      console.log('Syncing workflow with draft:', {
        draftId: draft.id,
        hasContentReference: Boolean(draft.contentReference),
        stepProgress: draft.stepProgress
      });
      
      // Use the stepProgress from draft if available, otherwise calculate
      const stepStatus = draft.stepProgress || {
        draft: Boolean(draft.title && draft.content && draft.category),
        swarm: Boolean(draft.contentReference),
        governance: Boolean(draft.isPublished)
      };
      
      // ENHANCED: Force update even if the values appear the same
      setWorkflowState(prev => {
        const newState = {
          ...prev,
          stepStatus,
          canProgress: canProgressFromStep(prev.currentStep, stepStatus)
        };
        
        console.log('Workflow state updated:', {
          from: prev.stepStatus,
          to: stepStatus,
          canProgress: newState.canProgress,
          currentStep: prev.currentStep
        });
        
        return newState;
      });
    }
  }, [draft?.id, draft?.contentReference, draft?.stepProgress?.draft, draft?.stepProgress?.swarm, draft?.stepProgress?.governance]); // More specific dependencies

  const canProgressFromStep = useCallback((step: EditorStep, status: typeof workflowState.stepStatus): boolean => {
    const result = (() => {
      switch (step) {
        case 'draft':
          return status.draft;
        case 'review':
          return status.draft;
        case 'publish':
          return status.draft && appState.status?.beeNodeRunning;
        case 'governance':
          return status.swarm && appState.isInitialized;
        case 'success':
          return false;
        default:
          return false;
      }
    })();
    
    console.log('canProgressFromStep:', { step, status, result });
    return result;
  }, [appState]);

  // ENHANCED: More robust step transition with better error handling
  const goToStep = useCallback(async (targetStep: EditorStep, force: boolean = false) => {
    const stepOrder: EditorStep[] = ['draft', 'review', 'publish', 'governance', 'success'];
    const currentIndex = stepOrder.indexOf(workflowState.currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);
    
    console.log('goToStep requested:', { 
      from: workflowState.currentStep, 
      to: targetStep, 
      force,
      currentIndex,
      targetIndex 
    });
    
    // Allow going back freely, or enforce progression rules for forward movement
    const canNavigate = force || 
                       targetIndex <= currentIndex || 
                       canProgressFromStep(targetStep, workflowState.stepStatus);
    
    if (!canNavigate) {
      const error = `Cannot progress to ${targetStep} step. Current status: ${JSON.stringify(workflowState.stepStatus)}`;
      console.error(error);
      setWorkflowState(prev => ({ ...prev, error }));
      return false;
    }

    // ENHANCED: Ensure save before transition
    if (ensureSavedForTransition && targetIndex > currentIndex) {
      console.log(`Ensuring save before transitioning from ${workflowState.currentStep} to ${targetStep}`);
      setWorkflowState(prev => ({ ...prev, isLoading: true }));
      
      try {
        const saveSuccess = await ensureSavedForTransition(targetStep);
        if (!saveSuccess) {
          setWorkflowState(prev => ({
            ...prev,
            error: 'Failed to save current changes before step transition',
            isLoading: false
          }));
          return false;
        }
        
        // ENHANCED: Wait for save to propagate before continuing
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error('Error saving before step transition:', error);
        setWorkflowState(prev => ({
          ...prev,
          error: 'Failed to save current changes before step transition',
          isLoading: false
        }));
        return false;
      } finally {
        setWorkflowState(prev => ({ ...prev, isLoading: false }));
      }
    }
    
    setWorkflowState(prev => {
      const newState = {
        ...prev,
        currentStep: targetStep,
        error: null,
        canProgress: canProgressFromStep(targetStep, prev.stepStatus)
      };
      
      console.log('Step transition completed:', {
        newStep: targetStep,
        stepStatus: prev.stepStatus,
        canProgress: newState.canProgress
      });
      
      if (onStepChange) {
        setTimeout(() => onStepChange(targetStep, newState), 0);
      }
      
      return newState;
    });
    
    return true;
  }, [workflowState.stepStatus, workflowState.currentStep, canProgressFromStep, onStepChange, ensureSavedForTransition]);

  // ENHANCED: More robust status update with verification
  const updateStepStatus = useCallback((step: 'draft' | 'swarm' | 'governance', completed: boolean) => {
    console.log('updateStepStatus called:', { step, completed });
    
    setWorkflowState(prev => {
      const newStatus = { ...prev.stepStatus, [step]: completed };
      const newState = {
        ...prev,
        stepStatus: newStatus,
        canProgress: canProgressFromStep(prev.currentStep, newStatus)
      };
      
      console.log('Step status updated:', {
        step,
        completed,
        oldStatus: prev.stepStatus,
        newStatus,
        canProgress: newState.canProgress
      });
      
      return newState;
    });
    
    // Update draft storage if we have a draft
    if (draft?.id) {
      const stepMap: { [key: string]: EditorStep } = {
        draft: 'draft',
        swarm: 'publish',
        governance: 'governance'
      };
      
      setTimeout(() => {
        enhancedDraftStorage.updateWorkflowProgress(
          draft.id,
          stepMap[step],
          completed
        );
      }, 0);
    }
  }, [draft, canProgressFromStep]);

  // ENHANCED: Force refresh from draft (useful for debugging)
  const refreshFromDraft = useCallback(() => {
    if (draft) {
      console.log('Force refreshing workflow from draft...');
      const stepStatus = draft.stepProgress || {
        draft: Boolean(draft.title && draft.content && draft.category),
        swarm: Boolean(draft.contentReference),
        governance: Boolean(draft.isPublished)
      };
      
      setWorkflowState(prev => ({
        ...prev,
        stepStatus,
        canProgress: canProgressFromStep(prev.currentStep, stepStatus),
        error: null
      }));
    }
  }, [draft, canProgressFromStep]);

  // ENHANCED: Sync with draft function (for external calls)
  const syncWithDraft = useCallback((draftToSync: EnhancedBlogDraft) => {
    console.log('External sync with draft requested:', {
      draftId: draftToSync.id,
      hasContentReference: Boolean(draftToSync.contentReference)
    });
    
    const stepStatus = draftToSync.stepProgress || {
      draft: Boolean(draftToSync.title && draftToSync.content && draftToSync.category),
      swarm: Boolean(draftToSync.contentReference),
      governance: Boolean(draftToSync.isPublished)
    };
    
    setWorkflowState(prev => ({
      ...prev,
      stepStatus,
      canProgress: canProgressFromStep(prev.currentStep, stepStatus)
    }));
  }, [canProgressFromStep]);

  const setLoading = useCallback((loading: boolean) => {
    setWorkflowState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setWorkflowState(prev => ({ ...prev, error }));
  }, []);

  const getStepAccessibility = useCallback(() => {
    const { stepStatus } = workflowState;
    
    return {
      draft: { enabled: true, completed: stepStatus.draft },
      review: { enabled: stepStatus.draft, completed: stepStatus.draft },
      publish: { 
        enabled: stepStatus.draft && appState.status?.beeNodeRunning, 
        completed: stepStatus.swarm 
      },
      governance: { 
        enabled: stepStatus.swarm && appState.isInitialized, 
        completed: stepStatus.governance 
      },
      success: { enabled: stepStatus.governance, completed: stepStatus.governance }
    };
  }, [workflowState.stepStatus, appState]);

  // Initialize canProgress after mount
  useEffect(() => {
    setWorkflowState(prev => ({
      ...prev,
      canProgress: canProgressFromStep(prev.currentStep, prev.stepStatus)
    }));
  }, [canProgressFromStep]);

  return {
    workflowState,
    goToStep,
    updateStepStatus,
    setLoading,
    setError,
    getStepAccessibility,
    
    // ENHANCED: Additional helper methods
    refreshFromDraft,
    syncWithDraft,
    
    // Convenience getters
    currentStep: workflowState.currentStep,
    canProgress: workflowState.canProgress,
    isLoading: workflowState.isLoading,
    error: workflowState.error
  };
};