// src/services/ContentService.ts - FIXED: Markdown-based storage to avoid index.html restrictions
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

// Interface for cache statistics
export interface CacheStats {
  size: number;
  entries: Array<{
    reference: string;
    timestamp: number;
    contentType?: string;
    isExpired: boolean;
    ageInMinutes: number;
  }>;
  totalSizeEstimate: number;
  expiredCount: number;
}

/**
 * Enhanced ContentService with markdown-based storage
 * FIXED: Uploads as markdown instead of index.html to avoid Swarm website restrictions
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

    // Configure marked for better HTML generation
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    // Auto-cleanup expired cache entries every 10 minutes
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.cleanExpiredCache();
      }, 10 * 60 * 1000); // 10 minutes
    }
  }

  /**
   * FIXED: Upload blog content as markdown instead of index.html
   * This avoids Swarm's website hosting restrictions
   */
  async uploadBlogContent(blogContent: BlogContent): Promise<string> {
    try {
      console.log('Uploading blog content:', blogContent.title);
      
      // Validate blog content
      this.validateBlogContent(blogContent);
      
      // Create structured content with metadata embedded in markdown
      const markdownWithMetadata = this.generateMarkdownWithMetadata(blogContent);
      
      // FIXED: Upload as .md file instead of index.html to avoid website restrictions
      const result = await this.swarmService.uploadMarkdownContent(markdownWithMetadata, 'blog-content.md');
      
      console.log('Blog content uploaded successfully:', result.reference);
      return result.reference;
      
    } catch (error) {
      console.error('Error uploading blog content:', error);
      throw new Error(`Failed to upload blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * FIXED: Download and process markdown content
   */
  async downloadBlogContent(reference: string): Promise<ProcessedBlogContent> {
    try {
      console.log('Downloading blog content:', reference);
      
      // Download markdown content using /bzz endpoint (still correct endpoint)
      const markdownContent = await this.swarmService.downloadText(reference);
      
      // Extract metadata and content from markdown
      const contentData = this.parseMarkdownWithMetadata(markdownContent);
      
      if (!contentData) {
        throw new Error('Could not parse blog content from markdown');
      }
      
      console.log('Blog content downloaded successfully:', contentData.title);
      return contentData;
      
    } catch (error) {
      console.error('Error downloading blog content:', error);
      throw new Error(`Failed to download blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * FIXED: Get content as HTML by downloading markdown and rendering it
   * Main method used by BlogDetailPage and ProposalDetailPage
   */
  async getContentAsHtml(contentReference: string, forceFresh: boolean = false): Promise<string> {
    // Validate content reference format
    if (!contentReference || contentReference.trim() === '') {
      throw new Error('Invalid content reference: empty or undefined');
    }

    const cleanReference = contentReference.trim();

    // Validate that it looks like a proper Swarm hash
    if (!/^[a-fA-F0-9]{64}$/.test(cleanReference)) {
      throw new Error(`Invalid content reference format: ${cleanReference}. Expected 64-character hex string (Swarm hash), but got ${cleanReference.length} characters.`);
    }

    // Check cache first (unless force refresh requested)
    if (!forceFresh) {
      const cachedContent = this.getCachedContent(cleanReference);
      if (cachedContent) {
        console.log(`Returning cached content for: ${cleanReference}`);
        return cachedContent.html;
      }
    }

    try {
      console.log(`Fetching fresh blog content for: ${cleanReference}`);
      
      // Try new markdown format first
      try {
        const blogData = await this.downloadBlogContent(cleanReference);
        
        // Process markdown content for display (handle asset URLs)
        const processedMarkdown = this.processMarkdownForDisplay(blogData.content);
        
        // Convert markdown to HTML
        const htmlContent = marked(processedMarkdown);
        
        // Create complete HTML document with metadata
        const fullHtml = this.generateHtmlFromBlogData(blogData, htmlContent);
        
        // Cache the result
        this.cacheContent(cleanReference, {
          content: blogData.content,
          html: fullHtml,
          timestamp: Date.now(),
          contentType: 'text/html'
        });
        
        console.log('Blog content cached successfully for:', cleanReference);
        return fullHtml;
        
      } catch (markdownError) {
        console.warn('Failed to parse as markdown, trying legacy HTML format...', markdownError);
        
        // Fallback: try legacy HTML format for backwards compatibility
        return await this.downloadLegacyHtmlContent(cleanReference);
      }
      
    } catch (error) {
      console.error('Error fetching blog content:', error);
      throw new Error(`Failed to fetch blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate markdown with embedded metadata using frontmatter
   */
  private generateMarkdownWithMetadata(blogContent: BlogContent): string {
    const frontmatter = {
      title: blogContent.title,
      author: blogContent.metadata.author,
      category: blogContent.metadata.category,
      tags: blogContent.metadata.tags,
      createdAt: blogContent.metadata.createdAt,
      banner: blogContent.metadata.banner || null,
      version: '2.0',
      type: 'religiodao-blog-post',
      uploadedAt: new Date().toISOString()
    };

    // Create frontmatter YAML
    const yamlFrontmatter = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
        } else if (value === null) {
          return `${key}: null`;
        } else if (typeof value === 'string') {
          return `${key}: "${value.replace(/"/g, '\\"')}"`;
        } else {
          return `${key}: ${value}`;
        }
      })
      .join('\n');

    return `---
${yamlFrontmatter}
---

${blogContent.content}`;
  }

  /**
   * Parse markdown with embedded metadata from frontmatter
   */
  private parseMarkdownWithMetadata(markdownContent: string): ProcessedBlogContent | null {
    try {
      // Check if content has frontmatter
      if (!markdownContent.startsWith('---')) {
        // Fallback: try to parse as legacy format or plain markdown
        return this.parseLegacyContent(markdownContent);
      }

      // Split frontmatter and content
      const parts = markdownContent.split('---');
      if (parts.length < 3) {
        throw new Error('Invalid frontmatter format');
      }

      const frontmatterText = parts[1].trim();
      const content = parts.slice(2).join('---').trim();

      // Parse YAML frontmatter (simple implementation)
      const metadata: any = {};
      frontmatterText.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          if (value.startsWith('[') && value.endsWith(']')) {
            // Parse array
            metadata[key] = value.slice(1, -1).split(', ').map(v => v.replace(/"/g, ''));
          } else if (value === 'null') {
            metadata[key] = null;
          } else if (value.startsWith('"') && value.endsWith('"')) {
            metadata[key] = value.slice(1, -1).replace(/\\"/g, '"');
          } else if (!isNaN(Number(value))) {
            metadata[key] = Number(value);
          } else {
            metadata[key] = value;
          }
        }
      });

      return {
        title: metadata.title,
        content: content,
        metadata: {
          author: metadata.author,
          category: metadata.category,
          tags: metadata.tags || [],
          createdAt: metadata.createdAt,
          banner: metadata.banner
        },
        version: metadata.version || '2.0',
        type: metadata.type || 'religiodao-blog-post',
        uploadedAt: metadata.uploadedAt || new Date().toISOString()
      };

    } catch (error) {
      console.error('Error parsing markdown with metadata:', error);
      return null;
    }
  }

  /**
   * Fallback parser for legacy content
   */
  private parseLegacyContent(content: string): ProcessedBlogContent | null {
    // Try to extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Untitled Blog Post';
    
    return {
      title,
      content,
      metadata: {
        author: 'Unknown',
        category: 'Uncategorized',
        tags: [],
        createdAt: Date.now(),
        banner: null
      },
      version: '1.0',
      type: 'legacy-blog-post',
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Legacy HTML content download for backwards compatibility
   */
  private async downloadLegacyHtmlContent(reference: string): Promise<string> {
    console.warn('Attempting legacy HTML download for reference:', reference);
    
    // Try to download as HTML and cache it
    const urls = this.swarmService.getContentUrls(reference);
    const urlsToTry = [
      urls.localWeb,    // http://localhost:1633/bzz/[hash]
      urls.publicWeb,   // https://api.gateway.ethswarm.org/bzz/[hash]
      ...urls.fallbacks.map(url => url.replace('/bytes/', '/bzz/'))
    ];

    for (const url of urlsToTry) {
      try {
        console.log(`Trying legacy HTML fetch from: ${url}`);
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(10000),
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        
        if (response.ok) {
          const content = await response.text();
          
          // Check if we got actual HTML or the approval page
          if (content.includes('Request Approval for This Hash')) {
            console.warn(`Got approval page from ${url}, trying next...`);
            continue;
          }
          
          if (content.trim().startsWith('<!DOCTYPE html>') || content.includes('<html')) {
            console.log(`Successfully retrieved legacy HTML from ${url}`);
            
            // Cache it
            this.cacheContent(reference, {
              content: content,
              html: content,
              timestamp: Date.now(),
              contentType: 'text/html'
            });
            
            return content;
          }
        }
      } catch (fetchError) {
        console.warn(`Legacy fetch failed for ${url}:`, fetchError);
        continue;
      }
    }

    throw new Error('Failed to download content in both markdown and legacy HTML formats');
  }

  /**
   * Generate complete HTML document from blog data and rendered content
   */
  private generateHtmlFromBlogData(blogData: ProcessedBlogContent, htmlContent: string): string {
    const title = this.escapeHtml(blogData.title);
    const author = this.formatAddress(blogData.metadata.author);
    const category = this.escapeHtml(blogData.metadata.category);
    const tags = blogData.metadata.tags.map(tag => this.escapeHtml(tag)).join(', ');
    const createdAt = new Date(blogData.metadata.createdAt).toLocaleDateString();
    const banner = blogData.metadata.banner || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${this.generateDescription(blogData.content)}">
  <meta name="author" content="${author}">
  <meta name="keywords" content="${tags}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #ffffff;
      color: #333;
    }
    .blog-header {
      margin-bottom: 30px;
      border-bottom: 2px solid #eee;
      padding-bottom: 20px;
    }
    .blog-title {
      font-size: 2.5em;
      margin: 0 0 10px 0;
      color: #2c3e50;
    }
    .blog-meta {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 15px;
    }
    .blog-banner {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      border-radius: 8px;
      margin: 20px 0;
    }
    .blog-content {
      font-size: 1.1em;
      line-height: 1.8;
    }
    .blog-content img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 15px 0;
    }
    .blog-content h1, .blog-content h2, .blog-content h3 {
      color: #2c3e50;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    .blog-content code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    .blog-content blockquote {
      border-left: 4px solid #3498db;
      padding-left: 20px;
      margin: 20px 0;
      font-style: italic;
      color: #555;
    }
  </style>
</head>
<body>
  <article class="blog-article">
    <header class="blog-header">
      <h1 class="blog-title">${title}</h1>
      <div class="blog-meta">
        <span>By ${author}</span> •
        <span>${createdAt}</span> •
        <span>${category}</span>
        ${tags ? ` • <span>Tags: ${tags}</span>` : ''}
      </div>
      ${banner ? `<img src="${banner}" alt="Blog banner" class="blog-banner">` : ''}
    </header>
    <main class="blog-content">
      ${htmlContent}
    </main>
  </article>
  
  <!-- Embedded blog data for processing -->
  <script type="application/json" id="blog-data">
    ${JSON.stringify(blogData, null, 2)}
  </script>
</body>
</html>`;
  }

  /**
   * Process markdown content for display (convert local asset URLs to public ones)
   */
  private processMarkdownForDisplay(content: string): string {
    try {
      // Convert localhost asset URLs to public gateway URLs
      let processedContent = content.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bytes\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );

      return processedContent.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bzz\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );
      
    } catch (error) {
      console.error('Error processing markdown for display:', error);
      return content;
    }
  }

  /**
   * Validate blog content structure
   */
  private validateBlogContent(blogContent: BlogContent): void {
    if (!blogContent.title || blogContent.title.trim() === '') {
      throw new Error('Blog title is required');
    }
    
    if (!blogContent.content || blogContent.content.trim() === '') {
      throw new Error('Blog content is required');
    }
    
    if (!blogContent.metadata) {
      throw new Error('Blog metadata is required');
    }
    
    if (!blogContent.metadata.author || blogContent.metadata.author.trim() === '') {
      throw new Error('Blog author is required');
    }
    
    if (!blogContent.metadata.category || blogContent.metadata.category.trim() === '') {
      throw new Error('Blog category is required');
    }
    
    if (!Array.isArray(blogContent.metadata.tags)) {
      throw new Error('Blog tags must be an array');
    }
    
    if (!blogContent.metadata.createdAt || isNaN(blogContent.metadata.createdAt)) {
      throw new Error('Blog creation date is required and must be a valid timestamp');
    }
  }

  // ==========================================
  // CACHING METHODS
  // ==========================================

  private getCachedContent(reference: string): CachedContent | null {
    const cached = this.contentCache.get(reference);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheExpiryTime) {
      this.contentCache.delete(reference);
      return null;
    }

    return cached;
  }

  private cacheContent(reference: string, content: CachedContent): void {
    this.contentCache.set(reference, content);
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [reference, content] of this.contentCache.entries()) {
      if (now - content.timestamp > this.cacheExpiryTime) {
        this.contentCache.delete(reference);
      }
    }
  }

  /**
   * Remove content from cache
   */
  removeFromCache(contentReference: string): void {
    this.contentCache.delete(contentReference);
    console.log('Content removed from cache:', contentReference);
  }

  /**
   * Force refresh content (bypass cache)
   */
  async forceRefreshContent(contentReference: string): Promise<string> {
    this.removeFromCache(contentReference);
    return this.getContentAsHtml(contentReference, true);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const entries = Array.from(this.contentCache.entries()).map(([reference, content]) => ({
      reference,
      timestamp: content.timestamp,
      contentType: content.contentType,
      isExpired: Date.now() - content.timestamp > this.cacheExpiryTime,
      ageInMinutes: Math.floor((Date.now() - content.timestamp) / (1000 * 60))
    }));

    const totalSize = Array.from(this.contentCache.values())
      .reduce((sum, content) => sum + content.html.length + content.content.length, 0);

    return {
      size: this.contentCache.size,
      entries,
      totalSizeEstimate: totalSize,
      expiredCount: entries.filter(e => e.isExpired).length
    };
  }

  /**
   * Clear all cached content
   */
  clearCache(): void {
    this.contentCache.clear();
    console.log('Content cache cleared');
  }

  /**
   * Process markdown content for publication (convert asset URLs)
   */
  processMarkdownForPublication(content: string): string {
    try {
      // Convert localhost asset URLs to public gateway URLs for publication
      let processedContent = content.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bytes\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );

      return processedContent.replace(
        /!\[([^\]]*)\]\((http:\/\/localhost:1633\/bzz\/([^)]+))\)/g,
        (match, alt, localUrl, reference) => {
          const publicUrl = this.swarmService.getContentUrl(reference, true, 'bytes');
          return `![${alt}](${publicUrl})`;
        }
      );
      
    } catch (error) {
      console.error('Error processing markdown for publication:', error);
      return content;
    }
  }

  /**
   * Generate blog URL for viewing (now points to the app, not direct Swarm)
   */
  getBlogUrl(reference: string, usePublicGateway: boolean = true): string {
    // Since we're storing as markdown, return the app URL for viewing
    return `/blogs/${reference}`;
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
      local: urls.local,  // bytes endpoint for raw content
      public: urls.public, // bytes endpoint for raw content
      fallbacks: urls.fallbacks // bytes endpoints
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private unescapeHtml(text: string): string {
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent || div.innerText || '';
  }

  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private generateDescription(content: string): string {
    const textContent = content
      .replace(/[#*_`-]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .trim();
    
    return textContent.length > 160 
      ? textContent.substring(0, 157) + '...'
      : textContent;
  }
}