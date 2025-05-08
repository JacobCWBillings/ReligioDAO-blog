// src/NewPostPage.tsx
import React, { useRef, useCallback, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { insertImageAtCursor } from './utils/markdownUtils';
import './NewPostPage.css';

interface Props {
    articleContent: string;
    setArticleContent: (content: string) => void;
    onInsertAsset?: (reference: string) => void;
    contentReference?: string;
    readOnly?: boolean;
}

export function NewPostPage({ 
    articleContent, 
    setArticleContent, 
    onInsertAsset,
    contentReference,
    readOnly = false 
}: Props) {
    const editorRef = useRef<HTMLTextAreaElement | null>(null);
    
    // Find the textarea within the MDEditor component
    const getTextAreaRef = useCallback(() => {
        if (!editorRef.current) {
            // Find the textarea in the MDEditor
            const textareas = document.querySelectorAll('textarea');
            for (let i = 0; i < textareas.length; i++) {
                if (textareas[i].value === articleContent) {
                    editorRef.current = textareas[i];
                    break;
                }
            }
        }
        return editorRef.current;
    }, [articleContent]);
    
    // Handler for inserting assets
    const handleInsertAsset = useCallback((reference: string) => {
        const textarea = getTextAreaRef();
        if (textarea) {
            // Insert image markdown at cursor position
            insertImageAtCursor(textarea, reference);
            
            // Update content state with the new content
            setArticleContent(textarea.value);
        } else {
            // Fallback if we can't find the textarea
            const imageMarkdown = `![Image](https://api.gateway.ethswarm.org/bZZ/${reference})`;
            setArticleContent(articleContent + '\n' + imageMarkdown);
        }
        
        // Notify parent component if needed
        if (onInsertAsset) {
            onInsertAsset(reference);
        }
    }, [articleContent, setArticleContent, getTextAreaRef, onInsertAsset]);
    
    // Allow parent components to insert assets
    useEffect(() => {
        if (onInsertAsset) {
            onInsertAsset = handleInsertAsset;
        }
    }, [handleInsertAsset, onInsertAsset]);

    // Display a read-only notice if content has already been uploaded to Swarm
    const readOnlyNotice = contentReference && (
        <div className="content-reference-note">
            <p>Your content has been uploaded to Swarm with reference: {contentReference}</p>
            <p className="reference-notice">
                This content is now preserved in the Swarm network. To modify it, you'll need to create a new proposal.
            </p>
        </div>
    );

    // Define onChange handler that respects read-only mode
    const handleChange = useCallback((value?: string) => {
        if (!readOnly) {
            setArticleContent(value || '');
        }
    }, [readOnly, setArticleContent]);

    return (
        <div className="editor-container">
            {readOnlyNotice}
            <MDEditor
                value={articleContent}
                onChange={handleChange}
                className="editor"
                height="90vh"
                data-color-mode="light"
                preview={readOnly ? 'preview' : 'edit'}
                textareaProps={{ 
                    readOnly: readOnly || !!contentReference,
                }}
            />
        </div>
    );
}