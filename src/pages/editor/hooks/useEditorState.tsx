// src/pages/editor/hooks/useEditorState.tsx - FIXED VERSION
// Fixed to support passing complete data to saveDraft
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWallet } from '../../../contexts/WalletContext';
import { 
  EnhancedBlogDraft, 
  EditorStep, 
  EditorWorkflowState, 
  EditorFormErrors,
  UnifiedBlogData 
} from '../../../types/editorTypes';
import { enhancedDraftStorage } from '../../../utils/draftStorage';

interface UseEditorStateProps {
  initialDraftId?: string;
  onDraftSaved?: (draft: EnhancedBlogDraft) => void;
  onWorkflowChange?: (step: EditorStep, state: EditorWorkflowState) => void;
}

export const useEditorState = ({
  initialDraftId,
  onDraftSaved,
  onWorkflowChange
}: UseEditorStateProps = {}) => {
  const { account, isConnected } = useWallet();
  
  // Core form state
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

  // Current draft being edited
  const [currentDraft, setCurrentDraft] = useState<EnhancedBlogDraft | null>(null);
  
  // Form validation errors
  const [formErrors, setFormErrors] = useState<EditorFormErrors>({});
  
  // UI state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Auto-save tracking
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const lastSaveContentHash = useRef<string>('');

  // Initialize with account
  useEffect(() => {
    if (account && formData.authorAddress !== account) {
      setFormData(prev => ({ ...prev, authorAddress: account }));
    }
  }, [account]);

  // Load initial draft if provided
  useEffect(() => {
    if (initialDraftId && !isInitializedRef.current) {
      const draft = enhancedDraftStorage.loadDraft(initialDraftId);
      if (draft) {
        loadDraftIntoForm(draft);
      }
      isInitializedRef.current = true;
    }
  }, [initialDraftId]);

  // FIXED: More aggressive change detection for hasUnsavedChanges
  useEffect(() => {
    if (!isInitializedRef.current) {
      // Don't trigger on initial render
      return;
    }

    // Create hash of meaningful content
    const contentHash = JSON.stringify({
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category.trim(),
      tags: formData.tags,
      description: formData.description?.trim(),
      banner: formData.banner,
      contentReference: formData.contentReference
    });

    // Check if content has actually changed from last save
    const hasChanged = contentHash !== lastSaveContentHash.current;
    
    if (hasChanged) {
      console.log('Content changed detected:', {
        title: formData.title.trim(),
        contentLength: formData.content.trim().length,
        category: formData.category.trim(),
        hasContentReference: Boolean(formData.contentReference),
        hasChanged
      });
      setHasUnsavedChanges(true);
    }
  }, [formData.title, formData.content, formData.category, formData.tags, formData.description, formData.banner, formData.contentReference]);

  // Auto-save effect
  useEffect(() => {
    if (!hasUnsavedChanges || !isConnected || !account || !formData.title.trim()) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    // Set new auto-save timer (30 seconds)
    autoSaveTimer.current = setTimeout(() => {
      handleAutoSave();
    }, 30000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [hasUnsavedChanges, formData, isConnected, account]);

  // Field update methods
  const updateTitle = useCallback((title: string) => {
    setFormData(prev => ({ ...prev, title, lastModified: Date.now() }));
    clearFieldError('title');
  }, []);

  const updateContent = useCallback((content: string) => {
    const preview = generatePreview(content);
    setFormData(prev => ({ 
      ...prev, 
      content, 
      preview, 
      lastModified: Date.now() 
    }));
    clearFieldError('content');
  }, []);

  const updateCategory = useCallback((category: string) => {
    setFormData(prev => ({ ...prev, category, lastModified: Date.now() }));
    clearFieldError('category');
  }, []);

  const updateTags = useCallback((tags: string[]) => {
    setFormData(prev => ({ ...prev, tags, lastModified: Date.now() }));
    clearFieldError('tags');
  }, []);

  const updateBanner = useCallback((banner: string | null) => {
    setFormData(prev => ({ ...prev, banner, lastModified: Date.now() }));
  }, []);

  const updateDescription = useCallback((description: string) => {
    setFormData(prev => ({ ...prev, description, lastModified: Date.now() }));
    clearFieldError('description');
  }, []);

  const updateContentReference = useCallback((contentReference: string) => {
    setFormData(prev => ({ ...prev, contentReference, lastModified: Date.now() }));
  }, []);

  // Bulk update for external integrations
  const updateFormData = useCallback((updates: Partial<UnifiedBlogData>) => {
    setFormData(prev => ({ 
      ...prev, 
      ...updates, 
      lastModified: Date.now() 
    }));
  }, []);

  // FIXED: Real-time form validation that doesn't cause re-renders
  const formValidation = useMemo(() => {
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
    
    const isValid = Object.keys(errors).length === 0;
    
    // FIXED: Call workflow change notification when validity changes
    const isValidForStep = (step: EditorStep): boolean => {
      if (!formData.title.trim() || !formData.content.trim() || !formData.category.trim()) {
        return false;
      }
      if (step === 'governance' && !formData.description?.trim()) {
        return false;
      }
      return true;
    };

    // FIXED: Notify workflow of draft step completion status
    if (onWorkflowChange) {
      const isDraftComplete = isValidForStep('draft');
      // Use a timeout to prevent setState during render
      setTimeout(() => {
        onWorkflowChange('draft', {
          currentStep: 'draft',
          stepStatus: {
            draft: isDraftComplete,
            swarm: Boolean(formData.contentReference),
            governance: false
          },
          canProgress: isDraftComplete,
          isLoading: false,
          error: null
        });
      }, 0);
    }
    
    return {
      errors: errors as EditorFormErrors,
      isValid,
      isValidForStep
    };
  }, [formData.title, formData.content, formData.category, formData.description, formData.contentReference, onWorkflowChange]);

  // Check form validity without setting state
  const checkFormValidity = useCallback((step: EditorStep = 'draft'): boolean => {
    if (!formData.title.trim()) return false;
    if (!formData.content.trim()) return false;
    if (!formData.category.trim()) return false;
    
    // Additional validation for governance step
    if (step === 'governance' && !formData.description?.trim()) return false;
    
    return true;
  }, [formData]);

  // Validate and set form errors (for explicit validation like form submission)
  const validateForm = useCallback((step: EditorStep = 'draft'): boolean => {
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
    if (step === 'governance' && !formData.description?.trim()) {
      errors.description = 'Description is required for governance proposals';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const clearFieldError = useCallback((field: keyof EditorFormErrors) => {
    setFormErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  // CRITICAL FIX: Enhanced saveDraft with optional data override
  const saveDraft = useCallback(async (
    action?: string,
    dataOverride?: Partial<UnifiedBlogData>
  ): Promise<EnhancedBlogDraft | null> => {
    if (!isConnected || !account) {
      throw new Error('Please connect your wallet to save drafts');
    }
    
    // Use override data if provided, otherwise use current formData
    const dataToSave = dataOverride ? { ...formData, ...dataOverride } : formData;
    
    if (!dataToSave.title.trim()) {
      throw new Error('Please enter a title for your blog');
    }

    try {
      setIsAutoSaving(true);
      
      // Build the draft to save with proper stepProgress
      const draftToSave = {
        ...dataToSave,
        id: currentDraft?.id, // Preserve existing ID if available
        stepProgress: dataToSave.stepProgress || {
          draft: checkFormValidity('draft'),
          swarm: Boolean(dataToSave.contentReference),
          governance: Boolean(currentDraft?.isPublished)
        }
      };
      
      console.log('Saving draft with data:', {
        title: draftToSave.title.substring(0, 50) + '...',
        contentLength: draftToSave.content.length,
        category: draftToSave.category,
        hasDescription: Boolean(draftToSave.description?.trim()),
        hasContentReference: Boolean(draftToSave.contentReference),
        stepProgress: draftToSave.stepProgress
      });
      
      const savedDraft = enhancedDraftStorage.saveDraft(draftToSave, action || 'Manual save');
      
      // Update our state to match what was saved
      if (dataOverride) {
        setFormData(dataToSave);
      }
      
      setCurrentDraft(savedDraft);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      // Update the hash to match what we just saved
      lastSaveContentHash.current = JSON.stringify({
        title: dataToSave.title.trim(),
        content: dataToSave.content.trim(),
        category: dataToSave.category.trim(),
        tags: dataToSave.tags,
        description: dataToSave.description?.trim(),
        banner: dataToSave.banner,
        contentReference: dataToSave.contentReference
      });
      
      if (onDraftSaved) {
        setTimeout(() => onDraftSaved(savedDraft), 0);
      }
      
      return savedDraft;
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    } finally {
      setIsAutoSaving(false);
    }
  }, [formData, currentDraft, isConnected, account, onDraftSaved, checkFormValidity]);

  // Auto-save handler
  const handleAutoSave = useCallback(async () => {
    if (!isConnected || !account || !formData.title.trim()) return;
    
    try {
      await saveDraft('Auto-save');
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't throw on auto-save failure
    }
  }, [saveDraft, isConnected, account, formData.title]);

  // FIXED: Enhanced ensure save for transition with validation
  const ensureSavedForTransition = useCallback(async (targetStep: EditorStep): Promise<boolean> => {
    console.log('ensureSavedForTransition called:', {
      targetStep,
      hasUnsavedChanges,
      formValid: checkFormValidity(targetStep),
      title: formData.title.trim(),
      isConnected,
      account: Boolean(account)
    });

    try {
      // FIXED: Always save if we have valid content, regardless of unsaved changes flag
      if (formData.title.trim() && checkFormValidity(targetStep) && isConnected && account) {
        console.log(`Saving before transition to ${targetStep}`);
        const savedDraft = await saveDraft(`Pre-${targetStep} save`);
        
        // FIXED: Verify the save was successful
        if (!savedDraft) {
          console.error('Save failed - no draft returned');
          return false;
        }
        
        console.log('Save successful for transition:', savedDraft.id);
        return true;
      }
      
      // If we don't need to save, but form is valid, that's still success
      if (checkFormValidity(targetStep)) {
        console.log('Form valid, no save needed');
        return true;
      }
      
      console.log('Form not valid for transition:', {
        hasTitle: Boolean(formData.title.trim()),
        hasContent: Boolean(formData.content.trim()),
        hasCategory: Boolean(formData.category.trim()),
        needsDescription: targetStep === 'governance' && !formData.description?.trim()
      });
      return false;
      
    } catch (error) {
      console.error('Failed to save before step transition:', error);
      return false;
    }
  }, [hasUnsavedChanges, formData, isConnected, account, saveDraft, checkFormValidity]);

  const loadDraftIntoForm = useCallback((draft: EnhancedBlogDraft) => {
    console.log('Loading draft into form:', draft.title, 'Content length:', draft.content.length);
    
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
      usedAssets: draft.usedAssets,
      stepProgress: draft.stepProgress,
      createdAt: draft.createdAt,
      lastModified: draft.lastModified
    });
    
    setCurrentDraft(draft);
    setHasUnsavedChanges(false);
    setLastSaved(new Date(draft.lastModified));
    setFormErrors({});
    
    // Update hash to match loaded content
    lastSaveContentHash.current = JSON.stringify({
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
    console.log('Creating new draft');
    
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
    
    setCurrentDraft(null);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    setFormErrors({});
    
    // Reset tracking
    lastSaveContentHash.current = '';
  }, [account]);

  // Helper function to generate preview
  const generatePreview = (content: string): string => {
    const textContent = content.replace(/[#*_`-]/g, '');
    return textContent.length > 150 
      ? `${textContent.substring(0, 150)}...` 
      : textContent;
  };

  return {
    // Form data
    formData,
    currentDraft,
    
    // Form field updaters
    updateTitle,
    updateContent,
    updateCategory,
    updateTags,
    updateBanner,
    updateDescription,
    updateContentReference,
    updateFormData,
    
    // Validation
    formErrors,
    formValidation,
    checkFormValidity,
    validateForm,
    clearFieldError,
    
    // Draft operations
    saveDraft,
    loadDraftIntoForm,
    createNewDraft,
    ensureSavedForTransition,
    
    // UI state
    isAutoSaving,
    lastSaved,
    hasUnsavedChanges,
    
    // Helper methods
    generatePreview
  };
};