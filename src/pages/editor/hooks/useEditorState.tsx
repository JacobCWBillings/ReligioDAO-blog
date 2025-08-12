// src/pages/editor/hooks/useEditorState.tsx - FIXED VERSION
// Comprehensive fix for state synchronization issues
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

/**
 * FIXED: Centralized state management for the editor with improved synchronization
 * Key fixes:
 * 1. Simplified and more reliable auto-save
 * 2. Automatic save before step transitions
 * 3. Better state tracking and error handling
 */
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
  
  // FIXED: Simplified auto-save tracking
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const lastSaveContentHash = useRef<string>('');

  // Load initial draft if provided
  useEffect(() => {
    if (initialDraftId && account && !isInitializedRef.current) {
      const draft = enhancedDraftStorage.loadDraft(initialDraftId);
      if (draft && draft.authorAddress.toLowerCase() === account.toLowerCase()) {
        loadDraftIntoForm(draft);
      }
      isInitializedRef.current = true;
    }
  }, [initialDraftId, account]);

  // Update author address when wallet changes
  useEffect(() => {
    if (account) {
      setFormData(prev => ({ ...prev, authorAddress: account }));
    }
  }, [account]);

  // FIXED: Simplified auto-save mechanism - more reliable and predictable
  useEffect(() => {
    if (!isInitializedRef.current || !isConnected || !account) return;

    // Create a simple hash of the important content
    const contentHash = JSON.stringify({
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category.trim(),
      tags: formData.tags,
      description: formData.description?.trim(),
      banner: formData.banner
    });

    // Check if content has actually changed
    const hasChanged = contentHash !== lastSaveContentHash.current;
    
    if (hasChanged) {
      setHasUnsavedChanges(true);
      
      // Only auto-save if we have minimum required content
      if (formData.title.trim() && formData.content.trim()) {
        // Clear existing timer
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current);
        }
        
        // Set new timer - simpler logic, just wait and save
        autoSaveTimer.current = setTimeout(async () => {
          try {
            await handleAutoSave();
            lastSaveContentHash.current = contentHash;
          } catch (error) {
            console.warn('Auto-save failed:', error);
            // Don't throw - auto-save failures shouldn't break the app
          }
        }, 2000); // Reduced to 2 seconds for better UX
      }
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [formData, isConnected, account]);

  // FIXED: Form field update functions with immediate state sync
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

  // FIXED: Create a validation function that only checks validity without setting state
  const checkFormValidity = useCallback((step: EditorStep = 'draft'): boolean => {
    if (!formData.title.trim()) return false;
    if (!formData.content.trim()) return false;
    if (!formData.category.trim()) return false;
    
    // Additional validation for governance step
    if (step === 'governance' && !formData.description?.trim()) return false;
    
    return true;
  }, [formData]);

  // FIXED: Memoized validation result to prevent unnecessary recalculation
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
    
    return {
      errors: errors as EditorFormErrors,
      isValid: Object.keys(errors).length === 0,
      isValidForStep: (step: EditorStep): boolean => {
        if (!formData.title.trim() || !formData.content.trim() || !formData.category.trim()) {
          return false;
        }
        if (step === 'governance' && !formData.description?.trim()) {
          return false;
        }
        return true;
      }
    };
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

  // FIXED: Enhanced saveDraft with better state management
  const saveDraft = useCallback(async (action?: string): Promise<EnhancedBlogDraft | null> => {
    if (!isConnected || !account) {
      throw new Error('Please connect your wallet to save drafts');
    }
    
    if (!formData.title.trim()) {
      throw new Error('Please enter a title for your blog');
    }

    try {
      // Always use current formData - this is the critical fix!
      const draftToSave = {
        ...formData,
        id: currentDraft?.id, // Preserve existing ID if available
        stepProgress: currentDraft?.stepProgress || {
          draft: true,
          swarm: Boolean(formData.contentReference),
          governance: false
        }
      };
      
      console.log('Saving draft with current form data:', {
        title: draftToSave.title.substring(0, 50) + '...',
        contentLength: draftToSave.content.length,
        category: draftToSave.category,
        hasDescription: Boolean(draftToSave.description?.trim())
      });
      
      const savedDraft = enhancedDraftStorage.saveDraft(draftToSave, action || 'Manual save');
      
      setCurrentDraft(savedDraft);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      // Update the hash to match what we just saved
      lastSaveContentHash.current = JSON.stringify({
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category.trim(),
        tags: formData.tags,
        description: formData.description?.trim(),
        banner: formData.banner
      });
      
      if (onDraftSaved) {
        setTimeout(() => onDraftSaved(savedDraft), 0);
      }
      
      return savedDraft;
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }, [formData, currentDraft, isConnected, account, onDraftSaved]);

  // FIXED: Simplified auto-save handler
  const handleAutoSave = useCallback(async () => {
    if (!isConnected || !account || !formData.title.trim()) return;
    
    setIsAutoSaving(true);
    try {
      await saveDraft('Auto-save');
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't throw on auto-save failure
    } finally {
      setIsAutoSaving(false);
    }
  }, [saveDraft, isConnected, account, formData.title]);

  // FIXED: New function to ensure save before step transition
  const ensureSavedForTransition = useCallback(async (targetStep: EditorStep): Promise<boolean> => {
    try {
      if (hasUnsavedChanges && formData.title.trim() && isConnected && account) {
        console.log(`Saving before transition to ${targetStep}`);
        await saveDraft(`Pre-${targetStep} save`);
      }
      return true;
    } catch (error) {
      console.error('Failed to save before step transition:', error);
      return false;
    }
  }, [hasUnsavedChanges, formData.title, isConnected, account, saveDraft]);

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
      banner: draft.banner
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
    ensureSavedForTransition, // NEW: Ensure save before step transition
    
    // UI state
    isAutoSaving,
    lastSaved,
    hasUnsavedChanges,
    
    // Helper methods
    generatePreview
  };
};