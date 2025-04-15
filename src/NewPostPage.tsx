import React, { useRef, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { insertImageAtCursor } from './utils/markdownUtils';
import './NewPostPage.css';

interface Props {
    articleContent: string
    setArticleContent: (content: string) => void
    onInsertAsset?: (reference: string) => void
}

export function NewPostPage({ articleContent, setArticleContent, onInsertAsset }: Props) {
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
            const imageMarkdown = `![Image](http://localhost:1633/bytes/${reference})`;
            setArticleContent(articleContent + '\n' + imageMarkdown);
        }
        
        // Notify parent component if needed
        if (onInsertAsset) {
            onInsertAsset(reference);
        }
    }, [articleContent, setArticleContent, getTextAreaRef, onInsertAsset]);
    
    // Allow parent components to insert assets
    React.useEffect(() => {
        if (onInsertAsset) {
            onInsertAsset = handleInsertAsset;
        }
    }, [handleInsertAsset, onInsertAsset]);

    return (
        <MDEditor
            value={articleContent}
            onChange={x => setArticleContent(x || '')}
            className="editor"
            height="90vh"
            data-color-mode="light"
        />
    );
}