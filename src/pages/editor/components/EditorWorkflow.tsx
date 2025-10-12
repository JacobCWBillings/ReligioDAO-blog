// src/pages/editor/components/EditorWorkflow.tsx
import React from 'react';
import { EditorStep, EditorWorkflowState } from '../../../types/editorTypes';

interface EditorWorkflowProps {
  workflowState: EditorWorkflowState;
  onStepClick: (step: EditorStep) => void;
  className?: string;
}

interface StepConfig {
  id: EditorStep;
  label: string;
  icon: string;
  description: string;
}

const WORKFLOW_STEPS: StepConfig[] = [
  {
    id: 'draft',
    label: 'Draft',
    icon: '📝',
    description: 'Write your blog content'
  },
  {
    id: 'review',
    label: 'Review',
    icon: '👀',
    description: 'Preview your content'
  },
  {
    id: 'publish',
    label: 'Publish',
    icon: '🌐',
    description: 'Store on Swarm network'
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: '🗳️',
    description: 'Submit DAO proposal'
  }
];

/**
 * EditorWorkflow component handles the step-by-step progress display
 * and navigation between different stages of the blog creation process.
 */
export const EditorWorkflow: React.FC<EditorWorkflowProps> = ({
  workflowState,
  onStepClick,
  className = ''
}) => {
  const { currentStep, stepStatus } = workflowState;

  const getStepState = (stepId: EditorStep): 'active' | 'completed' | 'enabled' | 'disabled' => {
    if (stepId === currentStep) return 'active';
    
    switch (stepId) {
      case 'draft':
        return stepStatus.draft ? 'completed' : 'enabled';
      case 'review':
        return stepStatus.draft ? (stepStatus.swarm ? 'completed' : 'enabled') : 'disabled';
      case 'publish':
        return stepStatus.swarm ? 'completed' : (stepStatus.draft ? 'enabled' : 'disabled');
      case 'governance':
        return stepStatus.governance ? 'completed' : (stepStatus.swarm ? 'enabled' : 'disabled');
      default:
        return 'disabled';
    }
  };

  const handleStepClick = (step: EditorStep) => {
    const stepState = getStepState(step);
    if (stepState !== 'disabled') {
      onStepClick(step);
    }
  };

  return (
    <div className={`editor-progress ${className}`}>
      <div className="progress-steps">
        {WORKFLOW_STEPS.map((step, index) => {
          const stepState = getStepState(step.id);
          const isClickable = stepState !== 'disabled';
          
          return (
            <div
              key={step.id}
              className={`progress-step ${stepState} ${isClickable ? 'clickable' : ''}`}
              onClick={() => handleStepClick(step.id)}
              role={isClickable ? 'button' : 'presentation'}
              tabIndex={isClickable ? 0 : -1}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleStepClick(step.id);
                }
              }}
              title={`${step.label}: ${step.description} ${stepState === 'disabled' ? '(Not available yet)' : ''}`}
            >
              <span className="step-icon">{step.icon}</span>
              <span className="step-label">{step.label}</span>
              
              {/* Show loading indicator if this step is loading */}
              {stepState === 'active' && workflowState.isLoading && (
                <div className="step-loading">⏳</div>
              )}
              
              {/* Arrow connector (except for last step) */}
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className="step-connector" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Error display */}
      {workflowState.error && (
        <div className="workflow-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{workflowState.error}</span>
        </div>
      )}
    </div>
  );
};
