// src/pages/editor/hooks/useEditorWorkflow.tsx - FIXED VERSION
// Enhanced with automatic save before step transitions
import { useState, useCallback, useEffect } from 'react';
import { useSimpleApp } from '../../../contexts/SimpleAppContext';
import { EditorStep, EditorWorkflowState, EnhancedBlogDraft } from '../../../types/editorTypes';
import { enhancedDraftStorage } from '../../../utils/draftStorage';

interface UseEditorWorkflowProps {
  initialStep?: EditorStep;
  draft?: EnhancedBlogDraft | null;
  onStepChange?: (step: EditorStep, state: EditorWorkflowState) => void;
  ensureSavedForTransition?: (targetStep: EditorStep) => Promise<boolean>; // NEW: Save before transition
}

/**
 * FIXED: Enhanced workflow management with automatic save before step transitions
 */
export const useEditorWorkflow = ({
  initialStep = 'draft',
  draft,
  onStepChange,
  ensureSavedForTransition
}: UseEditorWorkflowProps = {}) => {
  const { state: appState } = useSimpleApp();
  
  const [workflowState, setWorkflowState] = useState<EditorWorkflowState>({
    currentStep: initialStep,
    stepStatus: {
      draft: false,
      swarm: false,
      governance: false
    },
    canProgress: false,
    isLoading: false,
    error: null
  });

  // Update workflow state based on draft changes
  useEffect(() => {
    if (draft) {
      const stepStatus = draft.stepProgress || {
        draft: Boolean(draft.title && draft.content),
        swarm: Boolean(draft.contentReference),
        governance: Boolean(draft.isPublished)
      };
      
      setWorkflowState(prev => ({
        ...prev,
        stepStatus,
        canProgress: canProgressFromStep(prev.currentStep, stepStatus)
      }));
    }
  }, [draft]);

  const canProgressFromStep = useCallback((step: EditorStep, status: typeof workflowState.stepStatus): boolean => {
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
  }, [appState]);

  // FIXED: Enhanced goToStep with automatic save before transition
  const goToStep = useCallback(async (targetStep: EditorStep, force: boolean = false) => {
    const stepOrder: EditorStep[] = ['draft', 'review', 'publish', 'governance', 'success'];
    const currentIndex = stepOrder.indexOf(workflowState.currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);
    
    // Allow going back freely, or enforce progression rules for forward movement
    const canNavigate = force || 
                       targetIndex <= currentIndex || 
                       canProgressFromStep(targetStep, workflowState.stepStatus);
    
    if (!canNavigate) {
      setWorkflowState(prev => ({
        ...prev,
        error: `Cannot progress to ${targetStep} step. Please complete previous steps.`
      }));
      return false;
    }

    // FIXED: Ensure save before transition if handler is provided
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
      
      if (onStepChange) {
        setTimeout(() => onStepChange(targetStep, newState), 0);
      }
      
      return newState;
    });
    
    return true;
  }, [workflowState.stepStatus, workflowState.currentStep, canProgressFromStep, onStepChange, ensureSavedForTransition]);

  const updateStepStatus = useCallback((step: 'draft' | 'swarm' | 'governance', completed: boolean) => {
    setWorkflowState(prev => {
      const newStatus = { ...prev.stepStatus, [step]: completed };
      return {
        ...prev,
        stepStatus: newStatus,
        canProgress: canProgressFromStep(prev.currentStep, newStatus)
      };
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

  return {
    workflowState,
    goToStep,
    updateStepStatus,
    setLoading,
    setError,
    getStepAccessibility,
    
    // Convenience getters
    currentStep: workflowState.currentStep,
    canProgress: workflowState.canProgress,
    isLoading: workflowState.isLoading,
    error: workflowState.error
  };
};