// src/services/ContentService.ts - Enhanced version with caching
import { SwarmService } from './SwarmService';
import { marked } from 'marked';

export interface BlogContent {
  title: string;
  content: string;
  metadata: {
    author: string;
    category: string;
    tags: string[];
    createdAt: number;
    banner?: string | null;
  };
}

export interface ProcessedBlogContent extends BlogContent {
  version: string;
  type: string;
  uploadedAt: string;
  contentReference?: string;
}

// Interface for cached content
interface CachedContent {
  content: string;
  html: string;
  timestamp: number;
  contentType?: string;
}

/**
 * Enhanced ContentService with caching capabilities
 * Handles blog content formatting, processing, and Swarm operations
 * Bridges between editor data and distributed storage
 */
export class ContentService {
  private contentCache: Map<string, CachedContent>;
  private cacheExpiryTime: number; // Cache expiry time in milliseconds

  constructor(
    private swarmService: SwarmService, 
    cacheExpiryTimeInMinutes: number = 30
  ) {
    // Initialize the cache
    this.contentCache = new Map<string, CachedContent>();
    this.cacheExpiryTime = cacheExpiryTimeInMinutes * 60 * 1000;

    // FIXED: Configure marked for better HTML generation with correct options
    marked.setOptions({
      breaks: true,
      gfm: true
      // REMOVED: headerIds and sanitize - these are not valid options in current marked version
      // Note: sanitize was deprecated and removed - marked now expects manual sanitization if needed
    });
  }

  /**
   * Upload blog content as web-friendly HTML with embedded metadata
   */
  async uploadBlogContent(blogContent: BlogContent): Promise<string> {
    try {
      console.log('Uploading blog content:', blogContent.title);
      
      // Validate blog content
      this.validateBlogContent(blogContent);
      
      // Generate HTML content
      const htmlContent = this.generateBlogHtml(blogContent);
      
      // Upload to Swarm
      const result = await this.swarmService.uploadHtmlContent(htmlContent, 'index.html');
      
      console.log('Blog content uploaded successfully:', result.reference);
      return result.reference;
      
    } catch (error) {
      console.error('Error uploading blog content:', error);
      throw new Error(`Failed to upload blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download and parse blog content from Swarm
   */
  async downloadBlogContent(reference: string): Promise<ProcessedBlogContent> {
    try {
      console.log('Downloading blog content:', reference);
      
      const htmlContent = await this.swarmService.downloadText(reference);
      
      // Extract embedded JSON data
      const contentData = this.extractContentFromHtml(htmlContent);
      
      if (!contentData) {
        throw new Error('Could not parse blog content from HTML');
      }
      
      console.log('Blog content downloaded successfully:', contentData.title);
      return contentData;
      
    } catch (error) {
      console.error('Error downloading blog content:', error);
      throw new Error(`Failed to download blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get content as HTML with caching (replacement for SwarmContentService.getContentAsHtml)
   */
  async getContentAsHtml(contentReference: string, forceFresh: boolean = false): Promise<string> {
    // Check if content is in cache and not expired
    const cachedContent = this.contentCache.get(contentReference);
    const now = Date.now();
    
    if (!forceFresh && cachedContent && (now - cachedContent.timestamp) < this.cacheExpiryTime) {
      console.log('Returning cached content for:', contentReference);
      return cachedContent.html;
    }
    
    // Content not in cache, expired, or force fresh requested
    try {
      console.log('Fetching fresh content for:', contentReference);
      const content = await this.fetchContentWithFallback(contentReference);
      
      // Detect content type for better rendering
      const contentType = this.detectContentType(content);
      
      // Generate HTML
      let html: string;
      if (contentType === 'text/html') {
        // Content is already HTML
        html = content;
      } else if (contentType === 'application/json') {
        // Try to extract content from JSON and render that
        try {
          const jsonData = JSON.parse(content);
          if (jsonData.content && typeof jsonData.content === 'string') {
            html = marked.parse(jsonData.content);
          } else {
            // Fallback to rendering the JSON as code
            html = `<pre>${this.escapeHtml(content)}</pre>`;
          }
        } catch {
          html = marked.parse(content);
        }
      } else {
        // Assume markdown or plain text
        html = marked.parse(content);
      }
      
      // Add to cache
      this.contentCache.set(contentReference, {
        content,
        html,
        timestamp: now,
        contentType
      });
      
      console.log('Content cached successfully for:', contentReference);
      return html;
      
    } catch (error) {
      // If we have expired content in cache, return that instead of failing
      if (cachedContent) {
        console.warn(`Failed to fetch fresh content for ${contentReference}, using expired cache`);
        return cachedContent.html;
      }
      
      // No cached content available, rethrow the error
      throw error;
    }
  }

  /**
   * Get content as text with caching
   */
  async getContent(contentReference: string, forceFresh: boolean = false): Promise<string> {
    // Check if content is in cache and not expired
    const cachedContent = this.contentCache.get(contentReference);
    const now = Date.now();
    
    if (!forceFresh && cachedContent && (now - cachedContent.timestamp) < this.cacheExpiryTime) {
      return cachedContent.content;
    }
    
    // Content not in cache, expired, or force fresh requested
    try {
      const content = await this.fetchContentWithFallback(contentReference);
      
      // Detect content type for better rendering
      const contentType = this.detectContentType(content);
      
      // Add to cache
      this.contentCache.set(contentReference, {
        content,
        html: marked.parse(content),
        timestamp: now,
        contentType
      });
      
      return content;
    } catch (error) {
      // If we have expired content in cache, return that instead of failing
      if (cachedContent) {
        console.warn(`Failed to fetch fresh content for ${contentReference}, using expired cache`);
        return cachedContent.content;
      }
      
      // No cached content available, rethrow the error
      throw error;
    }
  }

  /**
   * Remove a specific reference from the cache
   */
  removeFromCache(contentReference: string): void {
    this.contentCache.delete(contentReference);
    console.log('Removed from cache:', contentReference);
  }

  /**
   * Clear the content cache
   */
  clearCache(): void {
    this.contentCache.clear();
    console.log('Content cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ reference: string; timestamp: number; contentType?: string; }>;
  } {
    const entries = Array.from(this.contentCache.entries()).map(([reference, data]) => ({
      reference,
      timestamp: data.timestamp,
      contentType: data.contentType
    }));

    return {
      size: this.contentCache.size,
      entries
    };
  }

  /**
   * Fetch content with fallback to multiple methods and gateways
   */
  private async fetchContentWithFallback(contentReference: string): Promise<string> {
    if (!contentReference || contentReference.trim() === '') {
      throw new Error('Invalid content reference: empty or undefined');
    }

    // Clean up the reference if it has any prefixes
    const cleanReference = contentReference
      .replace('bzz://', '')
      .replace('bytes://', '')
      .trim();

    console.log(`Fetching content for reference: ${cleanReference}`);

    try {
      // First try: Use SwarmService downloadText method
      return await this.swarmService.downloadText(cleanReference);
    } catch (error) {
      console.warn('SwarmService downloadText failed:', error);
      
      // Fallback: Try direct fetch to various endpoints
      const urls = this.swarmService.getContentUrls(cleanReference);
      const urlsToTry = [
        urls.localWeb,  // bzz endpoint for web content
        urls.local,     // bytes endpoint
        urls.publicWeb, // public bzz endpoint
        urls.public,    // public bytes endpoint
        ...urls.fallbacks // fallback gateways
      ];

      for (const url of urlsToTry) {
        try {
          console.log(`Trying fetch fallback: ${url}`);
          const response = await fetch(url, { 
            signal: AbortSignal.timeout(5000),
            headers: {'Accept': 'text/html, text/markdown, application/json, text/plain, */*'}
          });
          
          if (response.ok) {
            const content = await response.text();
            console.log(`Successfully retrieved content from ${url}`);
            return content;
          }
        } catch (fetchError) {
          console.warn(`Fetch fallback failed for ${url}:`, fetchError);
          continue;
        }
      }

      throw new Error(`Failed to fetch content using reference ${contentReference} after trying all methods`);
    }
  }

  /**
   * Detect content type from the content itself
   */
  private detectContentType(content: string): string {
    // Try to detect HTML
    if (content.trim().startsWith('<!DOCTYPE html>') || 
        content.trim().startsWith('<html') ||
        (content.includes('<body') && content.includes('</body>'))) {
      return 'text/html';
    }
    
    // Try to detect JSON
    try {
      JSON.parse(content);
      return 'application/json';
    } catch (e) {
      // Not JSON
    }
    
    // Check for markdown indicators
    if (content.match(/^#+ /m) || // Headers
        content.match(/\[.+\]\(.+\)/) || // Links
        content.match(/\*\*.+\*\*/) || // Bold
        content.match(/```[^`]*```/)) { // Code blocks
      return 'text/markdown';
    }
    
    // Default to plain text
    return 'text/plain';
  }

  /**
   * Process markdown content to use public gateway URLs for assets
   */
  processMarkdownForPublication(content: string): string {
    try {
      // Replace local asset URLs with public gateway URLs
      const processedContent = content.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bytes\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );

      // Also handle any other local gateway patterns
      return processedContent.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bzz\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );
      
    } catch (error) {
      console.error('Error processing markdown for publication:', error);
      return content; // Return original content if processing fails
    }
  }

  /**
   * Process markdown content to use local gateway URLs for development
   */
  processMarkdownForDevelopment(content: string): string {
    try {
      // Replace public gateway URLs with local gateway URLs
      const publicGatewayPattern = new RegExp(
        `!\\[([^\\]]*)\\]\\((https?://[^/]+)/(bytes|bzz)/([^)]+)\\)`,
        'g'
      );

      return content.replace(publicGatewayPattern, (match, alt, gateway, endpoint, reference) => {
        const localUrl = this.swarmService.getContentUrl(reference, false, 'bytes');
        return `![${alt}](${localUrl})`;
      });
      
    } catch (error) {
      console.error('Error processing markdown for development:', error);
      return content; // Return original content if processing fails
    }
  }

  /**
   * Generate blog URL for viewing
   */
  getBlogUrl(reference: string, usePublicGateway: boolean = true): string {
    return this.swarmService.getContentUrl(reference, usePublicGateway, 'bzz');
  }

  /**
   * Generate multiple URLs for blog viewing
   */
  getBlogUrls(reference: string): {
    local: string;
    public: string;
    fallbacks: string[];
  } {
    const urls = this.swarmService.getContentUrls(reference);
    return {
      local: urls.localWeb,
      public: urls.publicWeb,
      fallbacks: urls.fallbacks.map(url => url.replace('/bytes/', '/bzz/'))
    };
  }

  /**
   * Validate blog content before upload
   */
  private validateBlogContent(blogContent: BlogContent): void {
    if (!blogContent.title?.trim()) {
      throw new Error('Blog title is required');
    }

    if (!blogContent.content?.trim()) {
      throw new Error('Blog content is required');
    }

    if (!blogContent.metadata?.author?.trim()) {
      throw new Error('Blog author is required');
    }

    if (!blogContent.metadata?.category?.trim()) {
      throw new Error('Blog category is required');
    }

    if (!blogContent.metadata?.createdAt || blogContent.metadata.createdAt <= 0) {
      throw new Error('Valid creation date is required');
    }

    // Validate title length
    if (blogContent.title.length > 200) {
      throw new Error('Blog title is too long (max 200 characters)');
    }

    // Validate content size (rough estimate)
    if (blogContent.content.length > 1000000) { // 1MB text limit
      throw new Error('Blog content is too large (max ~1MB)');
    }

    // Validate category
    if (blogContent.metadata.category.length > 50) {
      throw new Error('Category name is too long (max 50 characters)');
    }

    // Validate tags
    if (blogContent.metadata.tags) {
      if (blogContent.metadata.tags.length > 10) {
        throw new Error('Too many tags (max 10)');
      }
      
      for (const tag of blogContent.metadata.tags) {
        if (tag.length > 30) {
          throw new Error('Tag is too long (max 30 characters)');
        }
      }
    }
  }

  /**
   * Generate web-friendly HTML with embedded JSON metadata
   */
  private generateBlogHtml(blogContent: BlogContent): string {
    const contentWithMetadata: ProcessedBlogContent = {
      version: '1.0',
      type: 'religiodao-blog-post',
      ...blogContent,
      uploadedAt: new Date().toISOString()
    };

    const contentJson = JSON.stringify(contentWithMetadata, null, 2);
    const processedMarkdown = this.processMarkdownForPublication(blogContent.content);
    const htmlContent = this.convertMarkdownToHtml(processedMarkdown);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(blogContent.title)}</title>
  <meta name="description" content="${this.escapeHtml(this.generateDescription(blogContent.content))}">
  <meta property="og:title" content="${this.escapeHtml(blogContent.title)}">
  <meta property="og:description" content="${this.escapeHtml(this.generateDescription(blogContent.content))}">
  <meta property="og:type" content="article">
  <meta name="author" content="${this.escapeHtml(blogContent.metadata.author)}">
  <meta name="category" content="${this.escapeHtml(blogContent.metadata.category)}">
  <meta name="created-date" content="${new Date(blogContent.metadata.createdAt).toISOString()}">
  ${blogContent.metadata.tags && blogContent.metadata.tags.length > 0 ? 
    `<meta name="keywords" content="${this.escapeHtml(blogContent.metadata.tags.join(', '))}">` : ''}
  ${blogContent.metadata.banner ? 
    `<meta property="og:image" content="${this.escapeHtml(blogContent.metadata.banner)}">` : ''}
  
  <!-- Embedded data for application use -->
  <script type="application/ld+json" id="religiodao-blog-data">
${contentJson}
  </script>
  
  <style>
    ${this.getBlogStyles()}
  </style>
</head>
<body>
  <div class="blog-container">
    <header class="blog-header">
      <h1 class="blog-title">${this.escapeHtml(blogContent.title)}</h1>
      <div class="blog-metadata">
        <div class="author">By: <span class="author-address">${this.formatAddress(blogContent.metadata.author)}</span></div>
        <div class="category">Category: <span class="category-name">${this.escapeHtml(blogContent.metadata.category)}</span></div>
        <div class="date">Published: <time datetime="${new Date(blogContent.metadata.createdAt).toISOString()}">${new Date(blogContent.metadata.createdAt).toLocaleDateString()}</time></div>
        ${blogContent.metadata.tags && blogContent.metadata.tags.length > 0 ? 
          `<div class="tags">Tags: ${blogContent.metadata.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join(', ')}</div>` : ''}
      </div>
      ${blogContent.metadata.banner ? 
        `<div class="banner-image"><img src="${this.escapeHtml(blogContent.metadata.banner)}" alt="Blog banner" /></div>` : ''}
    </header>
    
    <main class="blog-content">
      ${htmlContent}
    </main>
    
    <footer class="blog-footer">
      <div class="decentralized-notice">
        <p>📡 This content is stored on the decentralized Swarm network and part of the ReligioDAO blog collection.</p>
      </div>
      <div class="creation-info">
        <p>Created: ${new Date(blogContent.metadata.createdAt).toLocaleString()}</p>
        <p>Uploaded: ${new Date().toLocaleString()}</p>
      </div>
    </footer>
  </div>
  
  <!-- Original markdown source hidden for application use -->
  <script type="text/plain" id="religiodao-markdown-content">${this.escapeHtml(blogContent.content)}</script>
  
  <!-- Metadata extraction helper -->
  <script>
    // Helper function for applications to extract blog data
    window.getReligioDAOBlogData = function() {
      const scriptElement = document.getElementById('religiodao-blog-data');
      if (scriptElement) {
        try {
          return JSON.parse(scriptElement.textContent);
        } catch (e) {
          console.error('Failed to parse blog data:', e);
          return null;
        }
      }
      return null;
    };
    
    // Helper function to get original markdown
    window.getReligioDAOMarkdown = function() {
      const scriptElement = document.getElementById('religiodao-markdown-content');
      return scriptElement ? scriptElement.textContent : null;
    };
  </script>
</body>
</html>`;
  }

  /**
   * Extract content data from HTML
   */
  private extractContentFromHtml(htmlContent: string): ProcessedBlogContent | null {
    try {
      // Extract embedded JSON data
      const jsonMatch = htmlContent.match(/<script type="application\/ld\+json" id="religiodao-blog-data">([\s\S]*?)<\/script>/);
      
      if (jsonMatch && jsonMatch[1]) {
        const contentData = JSON.parse(jsonMatch[1].trim());
        
        // Validate required fields
        if (contentData.title && contentData.content && contentData.metadata) {
          return contentData as ProcessedBlogContent;
        }
      }
      
      // Fallback: try to extract from HTML structure
      return this.extractContentFromHtmlStructure(htmlContent);
      
    } catch (error) {
      console.error('Error extracting content from HTML:', error);
      return null;
    }
  }

  /**
   * Fallback extraction from HTML structure
   */
  private extractContentFromHtmlStructure(htmlContent: string): ProcessedBlogContent | null {
    try {
      // Extract title
      const titleMatch = htmlContent.match(/<h1 class="blog-title">(.*?)<\/h1>/);
      const title = titleMatch ? this.unescapeHtml(titleMatch[1]) : 'Untitled';
      
      // Extract markdown content
      const markdownMatch = htmlContent.match(/<script type="text\/plain" id="religiodao-markdown-content">([\s\S]*?)<\/script>/);
      const content = markdownMatch ? this.unescapeHtml(markdownMatch[1]) : '';
      
      // Extract basic metadata
      const authorMatch = htmlContent.match(/<span class="author-address">(.*?)<\/span>/);
      const categoryMatch = htmlContent.match(/<span class="category-name">(.*?)<\/span>/);
      const dateMatch = htmlContent.match(/<time datetime="(.*?)">/);
      
      return {
        version: '1.0',
        type: 'religiodao-blog-post',
        title,
        content,
        metadata: {
          author: authorMatch ? this.unescapeHtml(authorMatch[1]) : 'Unknown',
          category: categoryMatch ? this.unescapeHtml(categoryMatch[1]) : 'Uncategorized',
          tags: [],
          createdAt: dateMatch ? new Date(dateMatch[1]).getTime() : Date.now()
        },
        uploadedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error extracting from HTML structure:', error);
      return null;
    }
  }

  /**
   * Convert markdown to HTML using marked
   */
  private convertMarkdownToHtml(markdown: string): string {
    try {
      return marked.parse(markdown);
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      // Return formatted pre block as fallback
      return `<pre>${this.escapeHtml(markdown)}</pre>`;
    }
  }

  /**
   * Generate description from content
   */
  private generateDescription(content: string): string {
    // Remove markdown syntax
    const textContent = content
      .replace(/[#*_`-]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .trim();
    
    return textContent.length > 160 
      ? `${textContent.substring(0, 157)}...` 
      : textContent;
  }

  /**
   * Format wallet address for display
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Unescape HTML entities
   */
  private unescapeHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }

  /**
   * Get CSS styles for blog HTML
   */
  private getBlogStyles(): string {
    return `
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
        background-color: #ffffff;
      }
      
      .blog-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .blog-header {
        margin-bottom: 2rem;
      }
      
      .blog-title {
        font-size: 2.5rem;
        font-weight: 700;
        margin: 0 0 1rem 0;
        line-height: 1.2;
        color: #1a1a1a;
      }
      
      .blog-metadata {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 1.5rem;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #ff8a00;
      }
      
      .blog-metadata > div {
        margin-bottom: 0.5rem;
      }
      
      .blog-metadata > div:last-child {
        margin-bottom: 0;
      }
      
      .author-address {
        font-family: monospace;
        background-color: #e9ecef;
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      .category-name {
        font-weight: 600;
        color: #ff8a00;
      }
      
      .tag {
        display: inline-block;
        background-color: #e9ecef;
        color: #495057;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        margin-right: 0.5rem;
      }
      
      .banner-image {
        margin: 1.5rem 0;
        text-align: center;
      }
      
      .banner-image img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      .blog-content {
        font-size: 1.1rem;
        line-height: 1.7;
      }
      
      .blog-content h1,
      .blog-content h2,
      .blog-content h3,
      .blog-content h4,
      .blog-content h5,
      .blog-content h6 {
        margin: 2rem 0 1rem 0;
        font-weight: 600;
        line-height: 1.3;
        color: #1a1a1a;
      }
      
      .blog-content h1:first-child,
      .blog-content h2:first-child,
      .blog-content h3:first-child {
        margin-top: 0;
      }
      
      .blog-content h1 { font-size: 2rem; }
      .blog-content h2 { font-size: 1.7rem; }
      .blog-content h3 { font-size: 1.4rem; }
      .blog-content h4 { font-size: 1.2rem; }
      .blog-content h5 { font-size: 1.1rem; }
      .blog-content h6 { font-size: 1rem; }
      
      .blog-content p {
        margin: 1.2rem 0;
      }
      
      .blog-content img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 1.5rem 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      .blog-content a {
        color: #ff8a00;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
      }
      
      .blog-content a:hover {
        border-bottom-color: #ff8a00;
      }
      
      .blog-content blockquote {
        margin: 1.5rem 0;
        padding: 1rem 1.5rem;
        border-left: 4px solid #ff8a00;
        background-color: #fff3e0;
        color: #666;
        font-style: italic;
      }
      
      .blog-content ul,
      .blog-content ol {
        margin: 1.2rem 0;
        padding-left: 2rem;
      }
      
      .blog-content li {
        margin: 0.5rem 0;
      }
      
      .blog-content code {
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        padding: 2px 6px;
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', 'Source Code Pro', monospace;
        font-size: 0.9em;
      }
      
      .blog-content pre {
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 1rem;
        overflow-x: auto;
        margin: 1.5rem 0;
      }
      
      .blog-content pre code {
        background: none;
        border: none;
        padding: 0;
      }
      
      .blog-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 1.5rem 0;
      }
      
      .blog-content th,
      .blog-content td {
        border: 1px solid #e9ecef;
        padding: 0.75rem;
        text-align: left;
      }
      
      .blog-content th {
        background-color: #f8f9fa;
        font-weight: 600;
      }
      
      .blog-content hr {
        border: none;
        border-top: 2px solid #e9ecef;
        margin: 3rem 0;
      }
      
      .blog-footer {
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 1px solid #e9ecef;
        font-size: 0.9rem;
        color: #666;
      }
      
      .decentralized-notice {
        background-color: #e8f5e9;
        border: 1px solid #c3e6cb;
        border-radius: 6px;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      
      .decentralized-notice p {
        margin: 0;
        font-weight: 500;
        color: #155724;
      }
      
      .creation-info {
        text-align: center;
      }
      
      .creation-info p {
        margin: 0.25rem 0;
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .blog-container {
          padding: 15px;
        }
        
        .blog-title {
          font-size: 2rem;
        }
        
        .blog-content {
          font-size: 1rem;
        }
        
        .blog-content h1 { font-size: 1.7rem; }
        .blog-content h2 { font-size: 1.5rem; }
        .blog-content h3 { font-size: 1.3rem; }
      }
    `;
  }
}

// Export the class for dependency injection in services/index.ts
// The singleton instance is created there with proper dependency management
export default ContentService;