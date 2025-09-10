// src/pages/editor/hooks/useEditorWorkflow.tsx - SINGLE SOURCE OF TRUTH FIX
// Eliminates competing state systems by making draft.stepProgress the authoritative source
import { useState, useCallback, useEffect, useMemo } from 'react';
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
  
  // CRITICAL CHANGE: Only manage current step and UI state, not step status
  // Step status is now ALWAYS derived from draft.stepProgress
  const [currentStep, setCurrentStep] = useState<EditorStep>(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SINGLE SOURCE OF TRUTH: Always derive step status from current draft
  const stepStatus = useMemo(() => {
    if (!draft) {
      return {
        draft: false,
        swarm: false,
        governance: false
      };
    }

    // Use draft.stepProgress if available, otherwise calculate from draft properties
    const derivedStatus = draft.stepProgress || {
      draft: Boolean(draft.title && draft.content && draft.category),
      swarm: Boolean(draft.contentReference),
      governance: Boolean(draft.isPublished)
    };

    console.log('Step status derived from draft:', {
      draftId: draft.id,
      stepProgress: draft.stepProgress,
      derivedStatus,
      isPublished: draft.isPublished
    });

    return derivedStatus;
  }, [draft?.id, draft?.stepProgress, draft?.contentReference, draft?.isPublished, draft?.title, draft?.content, draft?.category]);

  const canProgressFromStep = useCallback((step: EditorStep, status: typeof stepStatus): boolean => {
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
          return status.governance; // FIXED: Check governance status
        default:
          return false;
      }
    })();
    
    console.log('canProgressFromStep:', { step, status, result, appStateInitialized: appState.isInitialized });
    return result;
  }, [appState]);

  // Derive canProgress from current step and status
  const canProgress = useMemo(() => {
    return canProgressFromStep(currentStep, stepStatus);
  }, [currentStep, stepStatus, canProgressFromStep]);

  // Compose workflow state from derived values
  const workflowState = useMemo((): EditorWorkflowState => ({
    currentStep,
    stepStatus,
    canProgress,
    isLoading,
    error
  }), [currentStep, stepStatus, canProgress, isLoading, error]);

  const goToStep = useCallback(async (targetStep: EditorStep, force: boolean = false) => {
    const stepOrder: EditorStep[] = ['draft', 'review', 'publish', 'governance', 'success'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);
    
    console.log('goToStep requested:', { 
      from: currentStep, 
      to: targetStep, 
      force,
      currentIndex,
      targetIndex,
      currentStatus: stepStatus
    });
    
    // Allow going back freely, or enforce progression rules for forward movement
    const canNavigate = force || 
                       targetIndex <= currentIndex || 
                       canProgressFromStep(targetStep, stepStatus);
    
    if (!canNavigate) {
      const errorMsg = `Cannot progress to ${targetStep} step. Current status: ${JSON.stringify(stepStatus)}`;
      console.error(errorMsg);
      setError(errorMsg);
      return false;
    }

    // Ensure save before transition if needed
    if (ensureSavedForTransition && targetIndex > currentIndex) {
      console.log(`Ensuring save before transitioning from ${currentStep} to ${targetStep}`);
      setIsLoading(true);
      
      try {
        const saveSuccess = await ensureSavedForTransition(targetStep);
        if (!saveSuccess) {
          setError('Failed to save current changes before step transition');
          setIsLoading(false);
          return false;
        }
        
        // Wait for save to propagate
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error('Error saving before step transition:', error);
        setError('Failed to save current changes before step transition');
        setIsLoading(false);
        return false;
      } finally {
        setIsLoading(false);
      }
    }
    
    // Update current step
    setCurrentStep(targetStep);
    setError(null);
    
    console.log('Step transition completed:', {
      newStep: targetStep,
      stepStatus,
      canProgress: canProgressFromStep(targetStep, stepStatus)
    });
    
    if (onStepChange) {
      setTimeout(() => onStepChange(targetStep, {
        currentStep: targetStep,
        stepStatus,
        canProgress: canProgressFromStep(targetStep, stepStatus),
        isLoading: false,
        error: null
      }), 0);
    }
    
    return true;
  }, [currentStep, stepStatus, canProgressFromStep, onStepChange, ensureSavedForTransition]);

  // ELIMINATED: updateStepStatus and batchUpdateStepStatus
  // These are replaced by updateDraftStepProgress which updates the draft directly

  // NEW: Update step progress in draft (single source of truth)
  const updateDraftStepProgress = useCallback(async (
    updates: Partial<{ draft: boolean; swarm: boolean; governance: boolean }>
  ) => {
    if (!draft?.id) {
      console.warn('Cannot update step progress - no draft available');
      return;
    }

    console.log('Updating draft step progress:', { draftId: draft.id, updates });

    try {
      // Get current draft from storage
      const currentDraft = enhancedDraftStorage.loadDraft(draft.id);
      if (!currentDraft) {
        console.error('Draft not found in storage:', draft.id);
        return;
      }

      // Merge updates with existing progress, ensuring all required properties are defined
      const currentProgress = currentDraft.stepProgress || { draft: false, swarm: false, governance: false };
      const updatedStepProgress = {
        draft: updates.draft ?? currentProgress.draft,
        swarm: updates.swarm ?? currentProgress.swarm,
        governance: updates.governance ?? currentProgress.governance
      };

      // Update draft in storage with new step progress
      const updatedDraft = enhancedDraftStorage.saveDraft({
        ...currentDraft,
        stepProgress: updatedStepProgress,
        isPublished: updatedStepProgress.governance || currentDraft.isPublished,
        lastModified: Date.now()
      }, `Step progress update: ${Object.keys(updates).join(', ')}`);

      console.log('Draft step progress updated:', {
        draftId: updatedDraft.id,
        oldProgress: currentDraft.stepProgress,
        newProgress: updatedDraft.stepProgress,
        isPublished: updatedDraft.isPublished
      });

      // The stepStatus will automatically update via useMemo when draft changes
      return updatedDraft;

    } catch (error) {
      console.error('Failed to update draft step progress:', error);
      setError('Failed to update progress');
    }
  }, [draft?.id]);

  const getStepAccessibility = useCallback(() => {
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
  }, [stepStatus, appState]);

  // Sync currentStep with draft on mount/draft change
  useEffect(() => {
    if (draft && draft.stepProgress) {
      // Determine the appropriate current step based on progress
      let appropriateStep: EditorStep = 'draft';
      
      if (draft.stepProgress.governance) {
        appropriateStep = 'success';
      } else if (draft.stepProgress.swarm) {
        appropriateStep = 'governance';
      } else if (draft.stepProgress.draft && draft.contentReference) {
        appropriateStep = 'publish';
      } else if (draft.stepProgress.draft) {
        appropriateStep = 'review';
      }

      if (appropriateStep !== currentStep) {
        console.log('Syncing current step with draft progress:', {
          draftId: draft.id,
          stepProgress: draft.stepProgress,
          oldStep: currentStep,
          newStep: appropriateStep
        });
        setCurrentStep(appropriateStep);
      }
    }
  }, [draft?.id, draft?.stepProgress, currentStep]);

  // COMPATIBILITY: Wrapper for old updateStepStatus interface
  const updateStepStatus = useCallback(async (step: 'draft' | 'swarm' | 'governance', completed: boolean) => {
    console.log('updateStepStatus called (compatibility wrapper):', { step, completed });
    
    // Map to the new single-source-of-truth method
    const updates: Partial<{ draft: boolean; swarm: boolean; governance: boolean }> = {};
    updates[step] = completed;
    
    return await updateDraftStepProgress(updates);
  }, [updateDraftStepProgress]);

  // COMPATIBILITY: Wrapper for old batchUpdateStepStatus interface  
  const batchUpdateStepStatus = useCallback(async (
    updates: Array<{ step: 'draft' | 'swarm' | 'governance', completed: boolean }>
  ) => {
    console.log('batchUpdateStepStatus called (compatibility wrapper):', updates);
    
    // Convert to the new interface
    const updateObject: Partial<{ draft: boolean; swarm: boolean; governance: boolean }> = {};
    updates.forEach(({ step, completed }) => {
      updateObject[step] = completed;
    });
    
    return await updateDraftStepProgress(updateObject);
  }, [updateDraftStepProgress]);

  return {
    workflowState,
    goToStep,
    updateDraftStepProgress, // NEW: Primary method for updating step progress
    updateStepStatus, // COMPATIBILITY: For existing components
    batchUpdateStepStatus, // COMPATIBILITY: For existing components
    setIsLoading,
    setError: useCallback((error: string | null) => setError(error), []),
    getStepAccessibility,
    
    // Convenience getters
    currentStep,
    canProgress,
    isLoading,
    error
  };
};