
// src/pages/editor/hooks/useEditorWorkflow.tsx
import { useState, useCallback, useEffect } from 'react';
import { useSimpleApp } from '../../../contexts/SimpleAppContext';
import { EditorStep, EditorWorkflowState, EnhancedBlogDraft } from '../types/editorTypes';
import { enhancedDraftStorage } from '../utils/draftStorage';

interface UseEditorWorkflowProps {
  initialStep?: EditorStep;
  draft?: EnhancedBlogDraft | null;
  onStepChange?: (step: EditorStep, state: EditorWorkflowState) => void;
}

/**
 * Manages the editor workflow state and step transitions
 */
export const useEditorWorkflow = ({
  initialStep = 'draft',
  draft,
  onStepChange
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
      
      // Determine current step based on progress
      let currentStep: EditorStep = 'draft';
      if (draft.isPublished) {
        currentStep = 'success';
      } else if (draft.contentReference && draft.description) {
        currentStep = 'governance';
      } else if (draft.contentReference) {
        currentStep = 'publish';
      } else if (stepStatus.draft) {
        currentStep = 'review';
      }
      
      setWorkflowState(prev => ({
        ...prev,
        currentStep,
        stepStatus,
        canProgress: canProgressFromStep(currentStep, stepStatus)
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

  const goToStep = useCallback((targetStep: EditorStep, force: boolean = false) => {
    if (!force && !canProgressFromStep(targetStep, workflowState.stepStatus)) {
      setWorkflowState(prev => ({
        ...prev,
        error: `Cannot progress to ${targetStep} step. Please complete previous steps.`
      }));
      return false;
    }
    
    setWorkflowState(prev => {
      const newState = {
        ...prev,
        currentStep: targetStep,
        error: null,
        canProgress: canProgressFromStep(targetStep, prev.stepStatus)
      };
      
      if (onStepChange) {
        onStepChange(targetStep, newState);
      }
      
      return newState;
    });
    
    return true;
  }, [workflowState.stepStatus, canProgressFromStep, onStepChange]);

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
      
      enhancedDraftStorage.updateWorkflowProgress(
        draft.id,
        stepMap[step],
        completed
      );
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