// src/pages/editor/hooks/useUnifiedEditorState.tsx
// FIXED: Better governance step progression logic

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWallet } from '../../../contexts/WalletContext';
import { useSimpleApp } from '../../../contexts/SimpleAppContext';
import { 
  EditorStep, 
  UnifiedBlogData, 
  EditorFormErrors,
  EnhancedBlogDraft,
  EditorWorkflowState 
} from '../../../types/editorTypes';
import { enhancedDraftStorage } from '../../../utils/draftStorage';

interface UseUnifiedEditorStateProps {
  initialDraftId?: string;
  onDraftSaved?: (draft: EnhancedBlogDraft) => void;
  onStepChange?: (step: EditorStep) => void;
}

export const useUnifiedEditorState = ({
  initialDraftId,
  onDraftSaved,
  onStepChange
}: UseUnifiedEditorStateProps = {}) => {
  const { account, isConnected } = useWallet();
  const { state: appState } = useSimpleApp();
  
  // ==========================================
  // SINGLE SOURCE OF TRUTH: In-memory state
  // ==========================================
  
  // Form data state
  const [formData, setFormData] = useState<UnifiedBlogData>({
    title: '',
    content: '# Your Blog Title\n\nStart writing your blog post here...',
    category: '',
    tags: [],
    authorAddress: account || '',
    preview: '',
    banner: null,
    description: '',
    contentReference: '',
    createdAt: Date.now(),
    lastModified: Date.now()
  });

  // Workflow state - INDEPENDENT of drafts
  const [currentStep, setCurrentStep] = useState<EditorStep>('draft');
  const [stepStatus, setStepStatus] = useState({
    draft: false,
    swarm: false,  // Note: using 'swarm' to match existing interfaces
    governance: false
  });
  
  // FIXED: Add proposal tracking for better governance transition
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [governanceComplete, setGovernanceComplete] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<EditorFormErrors>({});
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Draft management (separate from workflow)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(initialDraftId || null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSaveHash = useRef<string>('');

  // ==========================================
  // Form field updaters (unchanged)
  // ==========================================
  
  const updateTitle = useCallback((title: string) => {
    setFormData(prev => ({ ...prev, title, lastModified: Date.now() }));
    setFormErrors(prev => ({ ...prev, title: undefined }));
    setHasUnsavedChanges(true);
  }, []);

  const updateContent = useCallback((content: string) => {
    const preview = generatePreview(content);
    setFormData(prev => ({ 
      ...prev, 
      content, 
      preview, 
      lastModified: Date.now() 
    }));
    setFormErrors(prev => ({ ...prev, content: undefined }));
    setHasUnsavedChanges(true);
  }, []);

  const updateCategory = useCallback((category: string) => {
    setFormData(prev => ({ ...prev, category, lastModified: Date.now() }));
    setFormErrors(prev => ({ ...prev, category: undefined }));
    setHasUnsavedChanges(true);
  }, []);

  const updateTags = useCallback((tags: string[]) => {
    setFormData(prev => ({ ...prev, tags, lastModified: Date.now() }));
    setFormErrors(prev => ({ ...prev, tags: undefined }));
    setHasUnsavedChanges(true);
  }, []);

  const updateBanner = useCallback((banner: string | null) => {
    setFormData(prev => ({ ...prev, banner, lastModified: Date.now() }));
    setHasUnsavedChanges(true);
  }, []);

  const updateDescription = useCallback((description: string) => {
    setFormData(prev => ({ ...prev, description, lastModified: Date.now() }));
    setFormErrors(prev => ({ ...prev, description: undefined }));
    setHasUnsavedChanges(true);
  }, []);

  const updateContentReference = useCallback((contentReference: string) => {
    setFormData(prev => ({ ...prev, contentReference, lastModified: Date.now() }));
    // Mark publish step as complete when we have a content reference
    setStepStatus(prev => ({ ...prev, swarm: true }));
  }, []);

  const updateFormData = useCallback((updates: Partial<UnifiedBlogData>) => {
    setFormData(prev => ({ 
      ...prev, 
      ...updates, 
      lastModified: Date.now() 
    }));
    setHasUnsavedChanges(true);
  }, []);

  // ==========================================
  // Form validation (unchanged)
  // ==========================================
  
  const validateForm = useCallback((targetStep?: EditorStep): boolean => {
    const errors: EditorFormErrors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    }
    
    if (!formData.category.trim()) {
      errors.category = 'Category is required';
    }
    
    // Additional validation for governance step
    if (targetStep === 'governance' && !formData.description?.trim()) {
      errors.description = 'Description is required for governance proposals';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const isValidForStep = useCallback((step: EditorStep): boolean => {
    switch (step) {
      case 'draft':
        return true; // Always valid for draft
      case 'review':
        return Boolean(formData.title.trim() && formData.content.trim() && formData.category.trim());
      case 'publish':
        return Boolean(formData.title.trim() && formData.content.trim() && formData.category.trim());
      case 'governance':
        return Boolean(formData.contentReference && formData.description?.trim());
      case 'success':
        return governanceComplete; // FIXED: Use explicit governance completion flag
      default:
        return false;
    }
  }, [formData, governanceComplete]); // FIXED: Add governanceComplete dependency

  // ==========================================
  // FIXED: Improved workflow management
  // ==========================================
  
  const canProgressFromStep = useCallback((fromStep: EditorStep): boolean => {
    switch (fromStep) {
      case 'draft':
        return isValidForStep('review');
      case 'review':
        return isValidForStep('publish');
      case 'publish':
        return Boolean(formData.contentReference) && appState.status?.beeNodeRunning;
      case 'governance':
        // FIXED: Use multiple conditions for more reliable governance completion check
        return governanceComplete || 
               (stepStatus.governance && Boolean(proposalId)) ||
               Boolean(formData.contentReference && stepStatus.governance);
      case 'success':
        return false; // Terminal step
      default:
        return false;
    }
  }, [formData, stepStatus, appState, isValidForStep, governanceComplete, proposalId]);

  const goToStep = useCallback(async (targetStep: EditorStep, force: boolean = false): Promise<boolean> => {
    const stepOrder: EditorStep[] = ['draft', 'review', 'publish', 'governance', 'success'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);
    
    // Allow going back freely
    if (targetIndex <= currentIndex) {
      setCurrentStep(targetStep);
      setError(null);
      onStepChange?.(targetStep);
      return true;
    }
    
    // FIXED: Special handling for governance -> success transition
    if (currentStep === 'governance' && targetStep === 'success') {
      // Allow transition if we have clear indicators of governance success
      if (governanceComplete || proposalId || force) {
        setCurrentStep(targetStep);
        setGovernanceComplete(true); // Ensure this is set
        setStepStatus(prev => ({ ...prev, governance: true }));
        setError(null);
        onStepChange?.(targetStep);
        return true;
      }
    }
    
    // Check if we can progress forward
    if (!force && !canProgressFromStep(currentStep)) {
      setError(`Cannot progress from ${currentStep} - form validation failed`);
      return false;
    }
    
    // Auto-save before forward progression
    if (hasUnsavedChanges && isConnected && account) {
      await handleAutoSave();
    }
    
    // Update step
    setCurrentStep(targetStep);
    setError(null);
    
    // Mark previous steps as complete
    if (targetIndex > currentIndex) {
      const updates = { ...stepStatus };
      if (currentStep === 'draft') updates.draft = true;
      if (currentStep === 'publish') updates.swarm = true;
      if (currentStep === 'governance') updates.governance = true;
      setStepStatus(updates);
    }
    
    onStepChange?.(targetStep);
    return true;
  }, [currentStep, canProgressFromStep, hasUnsavedChanges, isConnected, account, stepStatus, onStepChange, governanceComplete, proposalId]);

  const updateStepStatus = useCallback((step: 'draft' | 'swarm' | 'governance', completed: boolean) => {
    setStepStatus(prev => ({ ...prev, [step]: completed }));
  }, []);

  // FIXED: Enhanced governance completion with proposal tracking
  const markGovernanceComplete = useCallback((transactionHash?: string) => {
    setStepStatus(prev => ({ ...prev, governance: true }));
    setGovernanceComplete(true);
    if (transactionHash) {
      setProposalId(transactionHash);
    }
    // Don't automatically set step here - let the calling component handle it
  }, []);

  // FIXED: Add method to set proposal ID from governance step
  const setGovernanceProposalId = useCallback((proposalId: string) => {
    setProposalId(proposalId);
    setGovernanceComplete(true);
    setStepStatus(prev => ({ ...prev, governance: true }));
  }, []);

  // ==========================================
  // Draft persistence (mostly unchanged)
  // ==========================================
  
  const saveDraft = useCallback(async (
    action?: string,
    dataOverride?: Partial<UnifiedBlogData>
  ): Promise<EnhancedBlogDraft | null> => {
    if (!isConnected || !account) {
      throw new Error('Please connect your wallet to save drafts');
    }
    
    const dataToSave = dataOverride ? { ...formData, ...dataOverride } : formData;
    
    if (!dataToSave.title.trim()) {
      throw new Error('Please enter a title for your blog');
    }

    try {
      setIsAutoSaving(true);
      
      // Create draft object with current workflow state
      const draftToSave: Partial<EnhancedBlogDraft> & { title: string; content: string; authorAddress: string } = {
        ...dataToSave,
        id: currentDraftId || undefined,
        title: dataToSave.title,
        content: dataToSave.content,
        authorAddress: dataToSave.authorAddress,
        // Store step progress for loading later, but it's not the source of truth
        stepProgress: {
          draft: stepStatus.draft,
          swarm: stepStatus.swarm,
          governance: stepStatus.governance
        },
        isPublished: governanceComplete || stepStatus.governance // FIXED: Use governance completion flag
      };
      
      const savedDraft = enhancedDraftStorage.saveDraft(draftToSave, action || 'Manual save');
      
      // Update draft tracking
      if (!currentDraftId && savedDraft.id) {
        setCurrentDraftId(savedDraft.id);
      }
      
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      // Update hash
      lastSaveHash.current = JSON.stringify({
        title: dataToSave.title.trim(),
        content: dataToSave.content.trim(),
        category: dataToSave.category.trim(),
        tags: dataToSave.tags,
        description: dataToSave.description?.trim(),
        banner: dataToSave.banner,
        contentReference: dataToSave.contentReference
      });
      
      onDraftSaved?.(savedDraft);
      return savedDraft;
      
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    } finally {
      setIsAutoSaving(false);
    }
  }, [formData, currentDraftId, isConnected, account, stepStatus, governanceComplete, onDraftSaved]); // FIXED: Add governanceComplete dependency

  // Rest of the methods remain largely unchanged...
  const loadDraftIntoForm = useCallback((draft: EnhancedBlogDraft) => {
    // Load form data
    setFormData({
      title: draft.title,
      content: draft.content,
      category: draft.category,
      tags: draft.tags,
      authorAddress: draft.authorAddress,
      preview: draft.preview || '',
      banner: draft.banner,
      description: draft.description || '',
      contentReference: draft.contentReference || '',
      createdAt: draft.createdAt,
      lastModified: draft.lastModified
    });
    
    // Set draft tracking
    setCurrentDraftId(draft.id);
    setHasUnsavedChanges(false);
    setLastSaved(new Date(draft.lastModified));
    setFormErrors({});
    
    // Update workflow state based on loaded draft (but workflow remains independent)
    if (draft.stepProgress) {
      setStepStatus({
        draft: draft.stepProgress.draft || false,
        swarm: draft.stepProgress.swarm || false,
        governance: draft.stepProgress.governance || false
      });
      
      // FIXED: Update governance completion state
      const isGovernanceComplete = draft.isPublished || draft.stepProgress.governance;
      setGovernanceComplete(isGovernanceComplete);
      
      // Set appropriate step
      if (isGovernanceComplete) {
        setCurrentStep('success');
      } else if (draft.contentReference) {
        setCurrentStep('governance');
      } else if (draft.stepProgress.draft) {
        setCurrentStep('review');
      } else {
        setCurrentStep('draft');
      }
    }
    
    // Update hash
    lastSaveHash.current = JSON.stringify({
      title: draft.title.trim(),
      content: draft.content.trim(),
      category: draft.category.trim(),
      tags: draft.tags,
      description: draft.description?.trim(),
      banner: draft.banner,
      contentReference: draft.contentReference
    });
  }, []);

  const createNewDraft = useCallback(() => {
    setFormData({
      title: '',
      content: '# Your Blog Title\n\nStart writing your blog post here...',
      category: '',
      tags: [],
      authorAddress: account || '',
      preview: '',
      banner: null,
      description: '',
      contentReference: '',
      createdAt: Date.now(),
      lastModified: Date.now()
    });
    
    setCurrentDraftId(null);
    setCurrentStep('draft');
    setStepStatus({
      draft: false,
      swarm: false,
      governance: false
    });
    
    // FIXED: Reset governance completion state
    setGovernanceComplete(false);
    setProposalId(null);
    
    setHasUnsavedChanges(false);
    setLastSaved(null);
    setFormErrors({});
    lastSaveHash.current = '';
  }, [account]);

  // Auto-save handler (unchanged)
  const handleAutoSave = useCallback(async () => {
    if (!isConnected || !account || !formData.title.trim()) return;
    
    try {
      await saveDraft('Auto-save');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [saveDraft, isConnected, account, formData.title]);

  // Auto-save timer (unchanged)
  useEffect(() => {
    if (!hasUnsavedChanges || !isConnected || !account || !formData.title.trim()) {
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      handleAutoSave();
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [hasUnsavedChanges, formData, isConnected, account, handleAutoSave]);

  // Load initial draft if provided (unchanged)
  useEffect(() => {
    if (initialDraftId && !currentDraftId) {
      const draft = enhancedDraftStorage.loadDraft(initialDraftId);
      if (draft) {
        loadDraftIntoForm(draft);
      }
    }
  }, [initialDraftId, currentDraftId, loadDraftIntoForm]);

  // Update author address when account changes (unchanged)
  useEffect(() => {
    if (account && formData.authorAddress !== account) {
      setFormData(prev => ({ ...prev, authorAddress: account }));
    }
  }, [account, formData.authorAddress]);

  // Helper function
  const generatePreview = (content: string): string => {
    const textContent = content.replace(/[#*_`-]/g, '');
    return textContent.length > 150 
      ? `${textContent.substring(0, 150)}...` 
      : textContent;
  };

  // Build workflow state object
  const workflowState: EditorWorkflowState = {
    currentStep,
    stepStatus,
    canProgress: canProgressFromStep(currentStep),
    isLoading,
    error
  };

  // Create a minimal draft object for compatibility
  const currentDraft: EnhancedBlogDraft | null = currentDraftId ? {
    id: currentDraftId,
    title: formData.title,
    content: formData.content,
    category: formData.category,
    tags: formData.tags,
    authorAddress: formData.authorAddress,
    preview: formData.preview,
    banner: formData.banner,
    description: formData.description,
    contentReference: formData.contentReference,
    stepProgress: stepStatus,
    isPublished: governanceComplete || stepStatus.governance, // FIXED: Use governance completion flag
    createdAt: formData.createdAt,
    lastModified: formData.lastModified
  } : null;

  // ==========================================
  // Return unified state and controls
  // ==========================================
  
  return {
    // Form data
    formData,
    formErrors,
    
    // Workflow state (independent of drafts)
    currentStep,
    stepStatus,
    workflowState,
    
    // FIXED: Add governance-specific state
    proposalId,
    governanceComplete,
    
    // Form field updaters
    updateTitle,
    updateContent,
    updateCategory,
    updateTags,
    updateBanner,
    updateDescription,
    updateContentReference,
    updateFormData,
    
    // Workflow controls
    goToStep,
    updateStepStatus,
    markGovernanceComplete, // FIXED: Enhanced with transaction hash parameter
    setGovernanceProposalId, // FIXED: New method to set proposal ID
    canProgressFromStep,
    isValidForStep,
    
    // Validation
    validateForm,
    formValidation: {
      errors: formErrors,
      isValid: Object.keys(formErrors).length === 0,
      isValidForStep
    },
    
    // Draft operations (separate from workflow)
    saveDraft,
    loadDraftIntoForm,
    createNewDraft,
    currentDraft,
    
    // UI state
    isAutoSaving,
    lastSaved,
    hasUnsavedChanges,
    isLoading,
    error,
    setIsLoading,
    setError
  };
};