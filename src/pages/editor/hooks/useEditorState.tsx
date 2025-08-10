// src/pages/editor/hooks/useEditorState.tsx - FIXED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../../contexts/WalletContext';
import { 
  EnhancedBlogDraft, 
  EditorStep, 
  EditorWorkflowState, 
  EditorFormErrors,
  UnifiedBlogData 
} from '../types/editorTypes';
import { enhancedDraftStorage } from '../utils/draftStorage';

interface UseEditorStateProps {
  initialDraftId?: string;
  onDraftSaved?: (draft: EnhancedBlogDraft) => void;
  onWorkflowChange?: (step: EditorStep, state: EditorWorkflowState) => void;
}

/**
 * Centralized state management for the editor
 * FIXED: Prevents setState during render and ensures proper draft ID management
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
  
  // Auto-save timer and tracking
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const lastFormDataRef = useRef<string>('');
  const isInitializedRef = useRef(false);

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

  // FIXED: Track changes for auto-save without causing setState during render
  useEffect(() => {
    const currentFormJson = JSON.stringify(formData);
    const hasChanged = currentFormJson !== lastFormDataRef.current;
    
    if (hasChanged && isInitializedRef.current) {
      setHasUnsavedChanges(true);
      lastFormDataRef.current = currentFormJson;
      
      // FIXED: Schedule auto-save only if connected and has required fields
      // Use setTimeout to avoid setState during render
      if (isConnected && account && formData.title.trim() && formData.content.trim()) {
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current);
        }
        
        autoSaveTimer.current = setTimeout(() => {
          // Only auto-save if data is still current (user hasn't made more changes)
          const latestFormJson = JSON.stringify(formData);
          if (latestFormJson === currentFormJson) {
            handleAutoSave();
          }
        }, 3000); // Auto-save after 3 seconds of inactivity
      }
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [formData, isConnected, account]);

  // Form field update functions
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

  // Bulk update for external integrations (like SimpleBlogEditor)
  const updateFormData = useCallback((updates: Partial<UnifiedBlogData>) => {
    setFormData(prev => ({ 
      ...prev, 
      ...updates, 
      lastModified: Date.now() 
    }));
  }, []);

  // Validation
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

  // FIXED: Draft operations with proper ID management
  const saveDraft = useCallback(async (action?: string): Promise<EnhancedBlogDraft | null> => {
    if (!isConnected || !account) {
      throw new Error('Please connect your wallet to save drafts');
    }
    
    if (!formData.title.trim()) {
      throw new Error('Please enter a title for your blog');
    }

    try {
      // FIXED: Always use existing draft ID if available to prevent multiple versions
      const savedDraft = enhancedDraftStorage.saveDraft(
        {
          ...formData,
          id: currentDraft?.id, // This ensures we update existing draft instead of creating new one
          stepProgress: currentDraft?.stepProgress
        },
        action || 'Manual save'
      );
      
      setCurrentDraft(savedDraft);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      if (onDraftSaved) {
        // FIXED: Use setTimeout to avoid setState during render
        setTimeout(() => onDraftSaved(savedDraft), 0);
      }
      
      return savedDraft;
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }, [formData, currentDraft, isConnected, account, onDraftSaved]);

  const handleAutoSave = useCallback(async () => {
    if (!isConnected || !account || !formData.title.trim()) return;
    
    setIsAutoSaving(true);
    try {
      await saveDraft('Auto-save');
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't throw on auto-save failure to avoid disrupting user experience
    } finally {
      setIsAutoSaving(false);
    }
  }, [saveDraft, isConnected, account, formData.title]);

  const loadDraftIntoForm = useCallback((draft: EnhancedBlogDraft) => {
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
    
    // Update reference for auto-save tracking
    lastFormDataRef.current = JSON.stringify(formData);
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
    
    setCurrentDraft(null);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    setFormErrors({});
    
    // Reset tracking
    lastFormDataRef.current = '';
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
    validateForm,
    clearFieldError,
    
    // Draft operations
    saveDraft,
    loadDraftIntoForm,
    createNewDraft,
    
    // UI state
    isAutoSaving,
    lastSaved,
    hasUnsavedChanges,
    
    // Helper methods
    generatePreview
  };
};