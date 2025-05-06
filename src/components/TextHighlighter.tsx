// src/components/TextHighlighter.tsx
import React from 'react';
import './TextHighlighter.css';

interface TextHighlighterProps {
  text: string;
  highlight: string;
  className?: string;
}

/**
 * Component to highlight matching text in search results
 * Renders text with highlighted portions that match the search term
 */
export const TextHighlighter: React.FC<TextHighlighterProps> = ({ 
  text, 
  highlight,
  className = ''
}) => {
  // If no highlight term, return the text as is
  if (!highlight.trim()) {
    return <span className={className}>{text}</span>;
  }
  
  // Case insensitive search
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <span className={className}>
      {parts.map((part, i) => {
        // Check if this part matches the highlight term (case insensitive)
        const isHighlight = part.toLowerCase() === highlight.toLowerCase();
        
        // Return either highlighted or normal text
        return isHighlight ? (
          <mark key={i} className="text-highlight">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </span>
  );
};

/**
 * A version of the highlighter specifically for blog titles
 */
export const HighlightedTitle: React.FC<{ title: string; highlight: string }> = ({ 
  title, 
  highlight 
}) => {
  return (
    <TextHighlighter 
      text={title} 
      highlight={highlight} 
      className="highlighted-title" 
    />
  );
};

/**
 * A version of the highlighter for blog previews/descriptions
 * Includes context around the matched text if the text is long
 */
export const HighlightedPreview: React.FC<{ 
  text: string; 
  highlight: string;
  maxLength?: number;
}> = ({ 
  text, 
  highlight,
  maxLength = 150
}) => {
  // If no highlight or short text, just use the normal highlighter with truncation
  if (!highlight.trim() || text.length <= maxLength) {
    const truncatedText = text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
    
    return (
      <TextHighlighter 
        text={truncatedText} 
        highlight={highlight}
        className="highlighted-preview" 
      />
    );
  }
  
  // For longer texts, try to center the preview around the first match
  const lowerText = text.toLowerCase();
  const lowerHighlight = highlight.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerHighlight);
  
  // If no match found, just truncate normally
  if (matchIndex === -1) {
    return (
      <TextHighlighter 
        text={text.substring(0, maxLength) + '...'} 
        highlight={highlight}
        className="highlighted-preview" 
      />
    );
  }
  
  // Calculate the start and end indices to show context around the match
  const contextSize = Math.floor((maxLength - highlight.length) / 2);
  let startIndex = Math.max(0, matchIndex - contextSize);
  let endIndex = Math.min(text.length, matchIndex + highlight.length + contextSize);
  
  // Adjust if we have space left
  if (startIndex > 0 && endIndex < text.length) {
    // Both ends are trimmed, distribute remaining space evenly
    const remainingSpace = maxLength - (endIndex - startIndex);
    startIndex = Math.max(0, startIndex - Math.floor(remainingSpace / 2));
    endIndex = Math.min(text.length, endIndex + Math.ceil(remainingSpace / 2));
  } else if (startIndex === 0 && endIndex < text.length) {
    // Only start is at the beginning, add more to the end
    endIndex = Math.min(text.length, startIndex + maxLength);
  } else if (startIndex > 0 && endIndex === text.length) {
    // Only end is at the end, add more to the start
    startIndex = Math.max(0, endIndex - maxLength);
  }
  
  // Extract the preview text
  let previewText = text.substring(startIndex, endIndex);
  
  // Add ellipsis if needed
  if (startIndex > 0) {
    previewText = '...' + previewText;
  }
  if (endIndex < text.length) {
    previewText = previewText + '...';
  }
  
  return (
    <TextHighlighter 
      text={previewText} 
      highlight={highlight}
      className="highlighted-preview" 
    />
  );
};

export default TextHighlighter;