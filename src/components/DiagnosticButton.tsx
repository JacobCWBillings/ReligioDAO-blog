import React from 'react';
import { Link } from 'react-router-dom';
import './DiagnosticButton.css';

const DiagnosticButton: React.FC = () => {
  return (
    <Link to="/diagnostics" className="diagnostic-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.42 14.58a1 1 0 0 0-1.42 1.42 1 1 0 0 0 1.42-1.42zM4 12a8 8 0 0 1 8-8M12 4v4M4 12h4" />
        <line x1="2" y1="2" x2="22" y2="22" />
        <line x1="12" y1="12" x2="12" y2="12" />
      </svg>
      System Diagnostics
    </Link>
  );
};

export default DiagnosticButton;