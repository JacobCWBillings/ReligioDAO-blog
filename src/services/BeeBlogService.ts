// src/services/BeeBlogService.ts
import { Bee } from '@ethersphere/bee-js';
import { ethers } from 'ethers';

/**
 * Blog draft interface for local storage
 */
export interface BlogDraft {
  id: string;
  title: string;
  content: string;
  preview: string;
  banner?: string;
  category: string;
  tags: string[];
  authorAddress: string;
  createdAt: number;
  lastModified: number;
  contentReference?: string;
  isPublished?: boolean;
}

/**
 * Blog content structure for Swarm storage
 */
export interface BlogContent {
  title: string;
  content: string;
  metadata: {
    author: string;
    category: string;
    tags: string[];
    createdAt: number;
    banner?: string;
  };
}

/**
 * Gateway configuration for different use cases
 */
export interface GatewayConfig {
  local: string;          // For uploads and development
  public: string;         // For public content viewing
  fallbacks: string[];    // Backup gateways
}

/**
 * Service for managing blog content using bee-js directly
 * Handles both local development and public gateway scenarios
 */
export class BeeBlogService {
  private bee: Bee;
  private postageBatchId: string;
  private gateways: GatewayConfig;
  
  constructor(
    gateways: GatewayConfig = {
      local: 'http://localhost:1633',
      public: 'https://download.gateway.ethswarm.org',
      fallbacks: [
        'https://api.gateway.ethswarm.org',
        'https://gateway.ethswarm.org'
      ]
    },
    postageBatchId?: string
  ) {
    this.gateways = gateways;
    this.bee = new Bee(gateways.local);
    this.postageBatchId = postageBatchId || '';
  }

  /**
   * Initialize the service by finding a usable postage stamp
   */
  async initialize(): Promise<void> {
    if (!this.postageBatchId) {
      try {
        const stamps = await this.bee.getAllPostageBatch();
        const usableStamp = stamps.find(stamp => stamp.usable);
        if (usableStamp) {
          this.postageBatchId = usableStamp.batchID;
        } else {
          console.warn('No usable postage stamp found - using fallback');
          this.postageBatchId = '0'.repeat(64); // Development fallback
        }
      } catch (error) {
        console.error('Failed to initialize postage stamp:', error);
        this.postageBatchId = '0'.repeat(64); // Development fallback
      }
    }
  }

  /**
   * Save a blog draft to localStorage
   */
  saveDraft(draft: Partial<BlogDraft> & { title: string; content: string }): BlogDraft {
    const draftId = draft.id || `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const fullDraft: BlogDraft = {
      id: draftId,
      title: draft.title,
      content: draft.content,
      preview: this.generatePreview(draft.content),
      banner: draft.banner,
      category: draft.category || '',
      tags: draft.tags || [],
      authorAddress: draft.authorAddress || '',
      createdAt: draft.createdAt || now,
      lastModified: now,
      contentReference: draft.contentReference,
      isPublished: draft.isPublished || false
    };

    localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(fullDraft));
    return fullDraft;
  }

  /**
   * Load a blog draft from localStorage
   */
  loadDraft(draftId: string): BlogDraft | null {
    try {
      const draftJson = localStorage.getItem(`blog-draft-${draftId}`);
      if (!draftJson) return null;
      
      return JSON.parse(draftJson) as BlogDraft;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  /**
   * Get all drafts for a specific author
   */
  getDrafts(authorAddress?: string): BlogDraft[] {
    const drafts: BlogDraft[] = [];
    
    // Get all keys that start with 'blog-draft-'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('blog-draft-')) {
        try {
          const draftJson = localStorage.getItem(key);
          if (draftJson) {
            const draft = JSON.parse(draftJson) as BlogDraft;
            
            // Filter by author if specified
            if (!authorAddress || draft.authorAddress.toLowerCase() === authorAddress.toLowerCase()) {
              drafts.push(draft);
            }
          }
        } catch (error) {
          console.error('Error parsing draft:', error);
        }
      }
    }
    
    // Sort by last modified (newest first)
    return drafts.sort((a, b) => b.lastModified - a.lastModified);
  }

  /**
   * Delete a blog draft
   */
  deleteDraft(draftId: string): boolean {
    try {
      localStorage.removeItem(`blog-draft-${draftId}`);
      return true;
    } catch (error) {
      console.error('Error deleting draft:', error);
      return false;
    }
  }

  /**
   * Upload blog content to Swarm as a web-friendly HTML file with embedded JSON metadata
   * Uses bzz endpoint for direct browser access
   */
  async uploadBlogContent(blogContent: BlogContent): Promise<string> {
    if (!this.postageBatchId) {
      await this.initialize();
    }

    try {
      // Create a comprehensive content object with metadata
      const contentWithMetadata = {
        version: '1.0',
        type: 'religiodao-blog-post',
        ...blogContent,
        uploadedAt: new Date().toISOString()
      };

      // Convert to JSON string for embedding
      const contentJson = JSON.stringify(contentWithMetadata, null, 2);
      
      // Create an HTML file that contains both the rendered content and embedded JSON data
      // This makes it both web-friendly and compatible with our app
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${blogContent.title}</title>
  <meta name="description" content="${blogContent.content.substring(0, 160).replace(/"/g, '&quot;')}">
  <meta property="og:title" content="${blogContent.title}">
  <meta property="og:type" content="article">
  <meta name="author" content="${blogContent.metadata.author}">
  <meta name="category" content="${blogContent.metadata.category}">
  <meta name="created-date" content="${new Date(blogContent.metadata.createdAt).toISOString()}">
  <!-- Embedded data for application use -->
  <script type="application/ld+json" id="religiodao-blog-data">
${contentJson}
  </script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    img { max-width: 100%; height: auto; }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    .metadata { color: #555; margin-bottom: 2em; font-size: 0.9em; }
    pre.markdown-source { display: none; }
  </style>
</head>
<body>
  <article>
    <h1>${blogContent.title}</h1>
    <div class="metadata">
      <div>By: ${blogContent.metadata.author}</div>
      <div>Category: ${blogContent.metadata.category}</div>
      <div>Date: ${new Date(blogContent.metadata.createdAt).toLocaleDateString()}</div>
      ${blogContent.metadata.tags && blogContent.metadata.tags.length > 0 ? 
        `<div>Tags: ${blogContent.metadata.tags.join(', ')}</div>` : ''}
    </div>
    <div class="content">
      ${this.processMarkdownToHtml(blogContent.content)}
    </div>
  </article>
  <!-- Original markdown source hidden for application use -->
  <pre class="markdown-source" id="religiodao-markdown-content">${blogContent.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
      
      // Convert HTML to bytes
      const htmlBytes = new TextEncoder().encode(htmlContent);
      
      // Upload as a single file with index.html name for web accessibility
      const uploadResult = await this.bee.uploadFile(
        this.postageBatchId, 
        new File([htmlBytes], 'index.html', { type: 'text/html' })
      );
      
      return uploadResult.reference;
    } catch (error) {
      console.error('Error uploading blog content:', error);
      throw new Error(`Failed to upload content to Swarm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Simple markdown to HTML converter for blog preview
   * For a full application, consider using a proper markdown library
   */
  private processMarkdownToHtml(markdown: string): string {
    // This is a very basic implementation - in a real app use a proper markdown parser
    return markdown
      .replace(/#{6}\s+(.*?)\n/g, '<h6>$1</h6>\n')
      .replace(/#{5}\s+(.*?)\n/g, '<h5>$1</h5>\n')
      .replace(/#{4}\s+(.*?)\n/g, '<h4>$1</h4>\n')
      .replace(/#{3}\s+(.*?)\n/g, '<h3>$1</h3>\n')
      .replace(/#{2}\s+(.*?)\n/g, '<h2>$1</h2>\n')
      .replace(/#{1}\s+(.*?)\n/g, '<h1>$1</h1>\n')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '<br><br>');
  }

  /**
   * Download blog content from Swarm using web-friendly approach
   * Extracts content from the HTML file with embedded metadata
   */
  async downloadBlogContent(reference: string): Promise<BlogContent> {
    try {
      // Try local gateway first, then public gateways
      const gateways = [this.gateways.local, this.gateways.public, ...this.gateways.fallbacks];
      
      for (const gateway of gateways) {
        try {
          const bee = new Bee(gateway);
          
          // Try to download the HTML file first (new format)
          try {
            console.log(`Trying to download HTML from ${gateway}/bzz/${reference}/`);
            
            // First try with bee-js
            try {
              const fileData = await bee.downloadFile(reference, 'index.html');
              
              if (fileData && fileData.data) {
                const htmlContent = await new Response(fileData.data).text();
                
                // Try to extract the embedded JSON data
                const jsonMatch = htmlContent.match(/<script type="application\/ld\+json" id="religiodao-blog-data">([\s\S]*?)<\/script>/);
                
                if (jsonMatch && jsonMatch[1]) {
                  const jsonData = JSON.parse(jsonMatch[1].trim());
                  
                  // Validate the content structure
                  if (jsonData.title && jsonData.content) {
                    return jsonData as BlogContent;
                  }
                }
                
                // If we couldn't find the JSON data, try to extract content from HTML structure
                const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
                const contentMatch = htmlContent.match(/<pre class="markdown-source" id="religiodao-markdown-content">([\s\S]*?)<\/pre>/);
                
                if (titleMatch && contentMatch) {
                  const title = titleMatch[1];
                  const content = contentMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                  
                  // Extract author from meta tag
                  const authorMatch = htmlContent.match(/<meta name="author" content="(.*?)">/);
                  const categoryMatch = htmlContent.match(/<meta name="category" content="(.*?)">/);
                  const dateMatch = htmlContent.match(/<meta name="created-date" content="(.*?)">/);
                  
                  return {
                    title,
                    content,
                    metadata: {
                      author: authorMatch ? authorMatch[1] : 'Unknown',
                      category: categoryMatch ? categoryMatch[1] : '',
                      tags: [],
                      createdAt: dateMatch ? new Date(dateMatch[1]).getTime() : Date.now()
                    }
                  };
                }
              }
            } catch (beeError) {
              console.warn(`Failed to download with bee-js: ${beeError}`);
              
              // Try direct fetch as fallback
              try {
                const response = await fetch(`${gateway}/bzz/${reference}/index.html`);
                if (response.ok) {
                  const htmlContent = await response.text();
                  
                  // Try to extract the embedded JSON data
                  const jsonMatch = htmlContent.match(/<script type="application\/ld\+json" id="religiodao-blog-data">([\s\S]*?)<\/script>/);
                  
                  if (jsonMatch && jsonMatch[1]) {
                    const jsonData = JSON.parse(jsonMatch[1].trim());
                    
                    // Validate the content structure
                    if (jsonData.title && jsonData.content) {
                      return jsonData as BlogContent;
                    }
                  }
                }
              } catch (fetchError) {
                console.warn(`Failed direct fetch: ${fetchError}`);
              }
            }
          } catch (htmlError) {
            console.warn(`Failed to parse HTML content: ${htmlError}`);
          }
          
          // Fall back to downloading raw data for backward compatibility
          try {
            const data = await bee.downloadData(reference);
            const contentJson = new TextDecoder().decode(data);
            const parsedContent = JSON.parse(contentJson);
            
            // Validate the content structure
            if (parsedContent.title && parsedContent.content) {
              return parsedContent as BlogContent;
            }
          } catch (dataError) {
            console.warn(`Failed to download raw data: ${dataError}`);
          }
        } catch (gatewayError) {
          console.warn(`Failed to use gateway ${gateway}: ${gatewayError}`);
          continue;
        }
      }
      
      throw new Error('Failed to download from all available gateways');
    } catch (error) {
      console.error('Error downloading blog content:', error);
      throw new Error(`Failed to download content from Swarm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a blog draft to Swarm and update the draft with the reference
   */
  async publishDraft(draftId: string): Promise<{ draft: BlogDraft; contentReference: string }> {
    const draft = this.loadDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    // Create blog content object
    const blogContent: BlogContent = {
      title: draft.title,
      content: draft.content,
      metadata: {
        author: draft.authorAddress,
        category: draft.category,
        tags: draft.tags,
        createdAt: draft.createdAt,
        banner: draft.banner
      }
    };

    // Upload to Swarm
    const contentReference = await this.uploadBlogContent(blogContent);

    // Update draft with content reference
    const updatedDraft = {
      ...draft,
      contentReference,
      isPublished: true,
      lastModified: Date.now()
    };

    // Save updated draft
    localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(updatedDraft));

    return { draft: updatedDraft, contentReference };
  }

  /**
   * Upload an asset (image, etc.) to Swarm using uploadFile
   */
  async uploadAsset(file: File): Promise<string> {
    if (!this.postageBatchId) {
      await this.initialize();
    }

    try {
      // Use uploadFile method as per bee-js API
      const uploadResult = await this.bee.uploadFile(
        this.postageBatchId,
        file
      );

      console.log(uploadResult)

      return uploadResult.reference;
    } catch (error) {
      console.error('Error uploading asset:', error);
      throw new Error(`Failed to upload asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a preview from blog content
   */
  private generatePreview(content: string, maxLength: number = 200): string {
    // Remove markdown formatting for preview
    const cleanContent = content
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .replace(/!\[(.*?)\]\(.*?\)/g, '') // Remove images
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .trim();

    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }

    return cleanContent.substring(0, maxLength).trim() + '...';
  }

  /**
   * Get a URL for accessing content through a specific gateway
   * Uses bzz endpoint for blog content and bytes for binary data
   * 
   * @param reference Swarm reference
   * @param usePublicGateway Whether to use public gateway (for public viewing)
   * @param contentType Optional content type to determine appropriate endpoint
   */
  getContentUrl(
    reference: string, 
    usePublicGateway: boolean = false,
    contentType?: string
  ): string {
    const gateway = usePublicGateway ? this.gateways.public : this.gateways.local;
    
    // Blog content (HTML, markdown, JSON) should use bzz endpoint for web access
    if (contentType && (
      contentType.includes('text/html') || 
      contentType.includes('text/markdown') ||
      contentType.includes('application/json') ||
      contentType.includes('image/')
    )) {
      return `${gateway}/bzz/${reference}/`;
    }
    
    // Default to bytes endpoint for binary content
    return `${gateway}/bytes/${reference}`;
  }
  
  /**
   * Get a web-friendly URL for blog content that can be shared and accessed directly
   * 
   * @param reference Swarm reference to the blog content
   * @param usePublicGateway Whether to use public gateway (recommended for sharing)
   */
  getBlogUrl(reference: string, usePublicGateway: boolean = true): string {
    const gateway = usePublicGateway ? this.gateways.public : this.gateways.local;
    // Always use bzz endpoint for blog content to ensure web accessibility
    return `${gateway}/bzz/${reference}/`;
  }

  /**
   * Get URLs for content with fallbacks for public viewing
   * Returns both local and public URLs for different use cases
   * 
   * @param reference Swarm reference
   * @param isBlogContent Whether this is blog content (uses bzz endpoint if true)
   */
  getContentUrls(
    reference: string,
    isBlogContent: boolean = false
  ): {
    local: string;
    public: string;
    fallbacks: string[];
    webAccessible: string; // Guaranteed web-accessible URL
  } {
    // Determine endpoint based on content type
    const endpoint = isBlogContent ? 'bzz' : 'bytes';
    const path = isBlogContent ? '/' : '';
    
    return {
      local: `${this.gateways.local}/${endpoint}/${reference}${path}`,
      public: `${this.gateways.public}/${endpoint}/${reference}${path}`,
      fallbacks: this.gateways.fallbacks.map(gateway => 
        `${gateway}/${endpoint}/${reference}${path}`
      ),
      // Always include a guaranteed web-accessible URL using bzz endpoint
      webAccessible: `${this.gateways.public}/bzz/${reference}/`
    };
  }

  /**
   * Process markdown content to optimize URLs for public viewing
   * - Replaces localhost URLs with public gateway URLs
   * - Uses appropriate endpoints based on content type
   * - Ensures content is viewable by anyone, not just local development
   */
  processMarkdownForPublicViewing(markdown: string): string {
    if (!markdown) return '';
    
    // Public gateway to use
    const publicGateway = this.gateways.public || 'https://gateway.ethswarm.org';
    
    // Replace localhost image URLs with public gateway URLs (keeping bytes endpoint for images)
    let processed = markdown.replace(
      /!\[(.*?)\]\(http:\/\/localhost:1633\/bytes\/(.*?)\)/g,
      (match, alt, reference) => {
        return `![${alt}](${publicGateway}/bytes/${reference})`;
      }
    ).replace(
      /<img\s+[^>]*src="http:\/\/localhost:1633\/bytes\/(.*?)"([^>]*)>/g,
      (match, reference, attrs) => {
        return `<img src="${publicGateway}/bytes/${reference}"${attrs}>`;
      }
    );
    
    // Replace localhost bzz URLs for blog content references
    processed = processed.replace(
      /\[(.*?)\]\(http:\/\/localhost:1633\/bzz\/(.*?)\)/g,
      (match, text, reference) => {
        return `[${text}](${publicGateway}/bzz/${reference}/)`;
      }
    ).replace(
      /\[(.*?)\]\(http:\/\/localhost:1633\/bytes\/(.*?)\)/g,
      (match, text, reference) => {
        // For non-image links, prefer bzz endpoint for web content
        if (!text.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
          return `[${text}](${publicGateway}/bzz/${reference}/)`;
        }
        return `[${text}](${publicGateway}/bytes/${reference})`;
      }
    );
    
    return processed;
  }

  /**
   * Check if the Bee node is running
   */
  async isNodeRunning(): Promise<boolean> {
    try {
      await this.bee.getNodeAddresses();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we have a usable postage stamp
   */
  async hasUsableStamp(): Promise<boolean> {
    try {
      const stamps = await this.bee.getAllPostageBatch();
      return stamps.some(stamp => stamp.usable);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status for diagnostics
   */
  async getServiceStatus(): Promise<{
    nodeRunning: boolean;
    hasStamp: boolean;
    gateway: string;
    postageBatchId: string;
    publicGateway: string;
  }> {
    const nodeRunning = await this.isNodeRunning();
    const hasStamp = nodeRunning ? await this.hasUsableStamp() : false;
    
    return {
      nodeRunning,
      hasStamp,
      gateway: this.gateways.local,
      postageBatchId: this.postageBatchId,
      publicGateway: this.gateways.public
    };
  }

  /**
   * Update gateway configuration
   */
  updateGateways(newGateways: Partial<GatewayConfig>): void {
    this.gateways = { ...this.gateways, ...newGateways };
    
    // Update the Bee instance to use the new local gateway
    if (newGateways.local) {
      this.bee = new Bee(newGateways.local);
    }
  }
}

// Create a singleton instance
export const beeBlogService = new BeeBlogService();