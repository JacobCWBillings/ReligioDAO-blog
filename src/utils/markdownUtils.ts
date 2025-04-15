// src/utils/markdownUtils.ts
/**
 * Utility functions for handling Markdown content and asset insertion 
 */

/**
 * Insert an image reference at the current cursor position in a text area
 * @param textAreaRef Reference to the textarea element
 * @param imageReference The Swarm hash reference for the image
 * @param altText Optional alt text for the image
 */
export const insertImageAtCursor = (
    textAreaRef: HTMLTextAreaElement | null,
    imageReference: string,
    altText: string = 'Image'
  ): void => {
    if (!textAreaRef) return;
    
    const swarmUrl = `http://localhost:1633/bytes/${imageReference}`;
    const markdownImage = `![${altText}](${swarmUrl})`;
    
    const startPos = textAreaRef.selectionStart;
    const endPos = textAreaRef.selectionEnd;
    const textBefore = textAreaRef.value.substring(0, startPos);
    const textAfter = textAreaRef.value.substring(endPos);
    
    // Update the text area value with the image markdown
    textAreaRef.value = textBefore + markdownImage + textAfter;
    
    // Move cursor after the inserted image
    const newCursorPos = startPos + markdownImage.length;
    textAreaRef.selectionStart = newCursorPos;
    textAreaRef.selectionEnd = newCursorPos;
    
    // Focus the text area
    textAreaRef.focus();
    
    // Trigger input event to ensure state updates
    const event = new Event('input', { bubbles: true });
    textAreaRef.dispatchEvent(event);
  };
  
  /**
   * Convert local image URLs to Swarm references in markdown content
   * @param markdown The markdown content string
   * @param assets Array of assets with references
   */
  export const replaceLocalImagesWithSwarmRefs = (
    markdown: string, 
    assets: Array<{ name: string; reference: string }>
  ): string => {
    // First, handle markdown image references: ![alt](url)
    let updatedMarkdown = markdown.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      (match, alt, url) => {
        // Only replace if it's a local URL
        if (url.startsWith('http://localhost:1633/bytes/')) {
          const reference = url.replace('http://localhost:1633/bytes/', '');
          return `![${alt}](http://localhost:1633/bytes/${reference})`;
        }
        return match;
      }
    );
    
    // Next, handle HTML img tags: <img src="url" />
    updatedMarkdown = updatedMarkdown.replace(
      /<img\s+[^>]*src="([^"]*)"[^>]*>/g,
      (match, url) => {
        if (url.startsWith('http://localhost:1633/bytes/')) {
          const reference = url.replace('http://localhost:1633/bytes/', '');
          return match.replace(url, `http://localhost:1633/bytes/${reference}`);
        }
        return match;
      }
    );
    
    return updatedMarkdown;
  };
  
  /**
   * Extracts all image references from markdown content
   * @param markdown The markdown content string
   * @returns Array of Swarm references found in the content
   */
  export const extractImageReferencesFromMarkdown = (markdown: string): string[] => {
    const references: string[] = [];
    
    // Extract from markdown format ![alt](url)
    const markdownPattern = /!\[.*?\]\(http:\/\/localhost:1633\/bytes\/(.*?)\)/g;
    let match;
    while ((match = markdownPattern.exec(markdown)) !== null) {
      if (match[1] && !references.includes(match[1])) {
        references.push(match[1]);
      }
    }
    
    // Extract from HTML img tags
    const htmlPattern = /<img\s+[^>]*src="http:\/\/localhost:1633\/bytes\/(.*?)"[^>]*>/g;
    while ((match = htmlPattern.exec(markdown)) !== null) {
      if (match[1] && !references.includes(match[1])) {
        references.push(match[1]);
      }
    }
    
    return references;
  };