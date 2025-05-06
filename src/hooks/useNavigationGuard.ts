// src/hooks/useNavigationGuard.ts

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook to guard navigation to certain routes
 * 
 * @param shouldRedirect Function that determines if redirection is needed
 * @param redirectPath Path to redirect to if condition is met
 */
export const useNavigationGuard = (
  shouldRedirect: () => boolean,
  redirectPath: string
): void => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (shouldRedirect()) {
      navigate(redirectPath, { 
        replace: true,
        state: { from: location.pathname }
      });
    }
  }, [shouldRedirect, redirectPath, navigate, location]);
};

/**
 * Specific guard for ensuring proper proposal submission flow via the editor
 */
export const useProposalSubmissionGuard = (): void => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Get draftId from URL search params
    const searchParams = new URLSearchParams(location.search);
    const draftId = searchParams.get('draftId');
    
    // If we're on the proposal submission page without a draftId, redirect to editor
    if (location.pathname === '/submit-proposal' && !draftId) {
      console.log('Redirecting from proposal submission to editor - no draftId provided');
      navigate('/editor', { replace: true });
    }
  }, [navigate, location]);
};