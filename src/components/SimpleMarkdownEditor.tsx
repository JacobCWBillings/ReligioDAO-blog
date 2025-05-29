// src/components/SimpleMarkdownEditor.tsx
import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import './SimpleMarkdownEditor.css';

interface SimpleMarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  height?: string | number;
  placeholder?: string;
  readOnly?: boolean;
}

export const SimpleMarkdownEditor: React.FC<SimpleMarkdownEditorProps> = ({
  value,
  onChange,
  height = '400px',
  placeholder = 'Start writing...',
  readOnly = false
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Handle textarea changes
  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    onChange?.(newValue);
  };
  
  // Handle tab key in textarea for indentation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Insert tab character
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange?.(newValue);
      
      // Set cursor position after the inserted tab
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };
  
  // Configure marked options
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }, []);
  
  // Render markdown to HTML
  const renderMarkdown = (markdown: string): string => {
    try {
      return marked.parse(markdown);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return '<p>Error rendering markdown</p>';
    }
  };
  
  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (activeTab === 'edit' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeTab]);
  
  const containerHeight = typeof height === 'string' ? height : `${height}px`;
  
  return (
    <div className="simple-markdown-editor" style={{ height: containerHeight }}>
      {/* Tab Navigation */}
      <div className="editor-tabs">
        <button
          className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
          disabled={readOnly}
        >
          ✏️ Edit
        </button>
        <button
          className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          👁️ Preview
        </button>
        <div className="tab-indicator">
          {value.length} characters
        </div>
      </div>
      
      {/* Editor Content */}
      <div className="editor-content">
        {activeTab === 'edit' ? (
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        ) : (
          <div 
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
          />
        )}
      </div>
      
      {/* Quick Help */}
      {activeTab === 'edit' && (
        <div className="editor-help">
          <span className="help-item"><strong>**bold**</strong></span>
          <span className="help-item"><em>*italic*</em></span>
          <span className="help-item"># Header</span>
          <span className="help-item">[link](url)</span>
          <span className="help-item">![image](url)</span>
        </div>
      )}
    </div>
  );
};