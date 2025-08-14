// src/services/ContentService.ts
import { SwarmService } from './SwarmService';
import { marked } from 'marked';
import {
  BlogContent,
  ProcessedBlogContent,
  CachedContent,
  ContentReferences,
  ValidationResult
} from '../../types/contentTypes';
import {
  STANDARD_MARKDOWN_FILENAME,
  STANDARD_METADATA_FILENAME,
  processMarkdownUrls
} from '../utils/swarmUtils';

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
 * Service for handling blog content storage and retrieval
 */
export class ContentService {
  private contentCache: Map<string, CachedContent>;
  private cacheExpiryTime: number;

  constructor(
    private swarmService: SwarmService,
    cacheExpiryTimeInMinutes: number = 30
  ) {
    this.contentCache = new Map();
    this.cacheExpiryTime = cacheExpiryTimeInMinutes * 60 * 1000;
    
    // Configure marked
    marked.setOptions({
      breaks: true,
      gfm: true,
      // headerIds: true,
      // mangle: false
    });
    
    // Auto-cleanup expired cache
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanExpiredCache(), 10 * 60 * 1000);
    }
  }

  /**
   * Upload blog content to Swarm
   */
  async uploadBlogContent(blogContent: BlogContent): Promise<string> {
    try {
      // Validate content
      const validation = this.validateBlogContent(blogContent);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      console.log('Uploading blog content:', blogContent.title);
      
      // Generate markdown with metadata
      const markdownWithMetadata = this.generateMarkdownWithMetadata(blogContent);
      
      // Upload to Swarm
      const result = await this.swarmService.uploadContent(
        markdownWithMetadata,
        STANDARD_MARKDOWN_FILENAME,
        'text/markdown'
      );
      
      console.log('Blog content uploaded successfully:', result.reference);
      return result.reference;
      
    } catch (error) {
      console.error('Error uploading blog content:', error);
      throw new Error(`Failed to upload blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download blog content from Swarm
   */
  async downloadBlogContent(reference: string): Promise<ProcessedBlogContent> {
    try {
      console.log('Downloading blog content:', reference);
      
      // Try to download with filename first (collection format)
      let markdownContent: string;
      
      try {
        markdownContent = await this.swarmService.downloadText(
          reference,
          STANDARD_MARKDOWN_FILENAME
        );
      } catch (error) {
        // Fallback: try without filename (single file format)
        console.log('Trying legacy single-file download...');
        markdownContent = await this.swarmService.downloadText(reference);
      }
      
      // Parse markdown with metadata
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
   * Get content as HTML (main method used by UI)
   */
  async getContentAsHtml(
    contentReference: string,
    forceFresh: boolean = false
  ): Promise<string> {
    // Validate reference
    if (!contentReference || !/^[a-fA-F0-9]{64}$/.test(contentReference.trim())) {
      throw new Error(`Invalid content reference: ${contentReference}`);
    }
    
    const cleanReference = contentReference.trim().toLowerCase();
    
    // Check cache first
    if (!forceFresh) {
      const cached = this.getCachedContent(cleanReference);
      if (cached) {
        console.log(`Returning cached content for: ${cleanReference}`);
        return cached.html;
      }
    }
    
    try {
      console.log(`Fetching fresh blog content for: ${cleanReference}`);
      
      // Download and parse content
      const blogData = await this.downloadBlogContent(cleanReference);
      
      // Process markdown for web display
      const processedMarkdown = processMarkdownUrls(blogData.content, true);
      
      // Convert to HTML
      const htmlContent = marked(processedMarkdown);
      
      // Generate full HTML document
      const fullHtml = this.generateHtmlDocument(blogData, htmlContent);
      
      // Cache the result
      this.cacheContent(cleanReference, {
        content: blogData.content,
        html: fullHtml,
        timestamp: Date.now(),
        contentType: 'text/html'
      });
      
      return fullHtml;
      
    } catch (error) {
      console.error('Error fetching blog content:', error);
      throw new Error(`Failed to fetch blog content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate markdown with frontmatter metadata
   */
  private generateMarkdownWithMetadata(blogContent: BlogContent): string {
    const frontmatter = {
      title: blogContent.title,
      author: blogContent.metadata.author,
      category: blogContent.metadata.category,
      tags: blogContent.metadata.tags,
      createdAt: blogContent.metadata.createdAt,
      banner: blogContent.metadata.banner || null,
      description: blogContent.metadata.description || null,
      version: '2.0',
      type: 'religiodao-blog-post',
      uploadedAt: new Date().toISOString()
    };
    
    // Create YAML frontmatter
    const yamlLines = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (value === null) {
          return `${key}: null`;
        } else if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
        } else if (typeof value === 'string') {
          return `${key}: "${value.replace(/"/g, '\\"')}"`;
        } else {
          return `${key}: ${value}`;
        }
      });
    
    return `---
${yamlLines.join('\n')}
---

${blogContent.content}`;
  }

  /**
   * Parse markdown with frontmatter
   */
  private parseMarkdownWithMetadata(markdownContent: string): ProcessedBlogContent | null {
    try {
      // Check for frontmatter
      if (!markdownContent.startsWith('---')) {
        return this.parseLegacyContent(markdownContent);
      }
      
      // Split frontmatter and content
      const parts = markdownContent.split(/^---$/m);
      if (parts.length < 3) {
        throw new Error('Invalid frontmatter format');
      }
      
      const frontmatterText = parts[1].trim();
      const content = parts.slice(2).join('---').trim();
      
      // Parse YAML (simple implementation)
      const metadata: any = {};
      frontmatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;
        
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        // Parse value based on format
        if (value === 'null') {
          metadata[key] = null;
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Array
          metadata[key] = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim().replace(/^"(.*)"$/, '$1'));
        } else if (value.startsWith('"') && value.endsWith('"')) {
          // String
          metadata[key] = value.slice(1, -1).replace(/\\"/g, '"');
        } else if (!isNaN(Number(value))) {
          // Number
          metadata[key] = Number(value);
        } else {
          // Raw string
          metadata[key] = value;
        }
      });
      
      return {
        title: metadata.title || 'Untitled',
        content: content,
        metadata: {
          author: metadata.author || 'Unknown',
          category: metadata.category || 'Uncategorized',
          tags: metadata.tags || [],
          createdAt: metadata.createdAt || Date.now(),
          banner: metadata.banner,
          description: metadata.description
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
   * Parse legacy content format
   */
  private parseLegacyContent(content: string): ProcessedBlogContent {
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
   * Generate HTML document
   */
  private generateHtmlDocument(
    blogData: ProcessedBlogContent,
    htmlContent: string
  ): string {
    const title = this.escapeHtml(blogData.title);
    const author = this.formatAddress(blogData.metadata.author);
    const category = this.escapeHtml(blogData.metadata.category);
    const tags = blogData.metadata.tags.map(tag => this.escapeHtml(tag)).join(', ');
    const createdAt = new Date(blogData.metadata.createdAt).toLocaleDateString();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="author" content="${author}">
  <meta name="keywords" content="${tags}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .blog-header {
      border-bottom: 2px solid #eee;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .blog-title {
      font-size: 2.5em;
      margin: 0 0 10px 0;
    }
    .blog-meta {
      color: #666;
      font-size: 0.9em;
    }
    .blog-content img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <article>
    <header class="blog-header">
      <h1 class="blog-title">${title}</h1>
      <div class="blog-meta">
        <span>By ${author}</span> • 
        <span>${createdAt}</span> • 
        <span>${category}</span>
        ${tags ? ` • <span>Tags: ${tags}</span>` : ''}
      </div>
    </header>
    <main class="blog-content">
      ${htmlContent}
    </main>
  </article>
</body>
</html>`;
  }

  /**
   * Validate blog content
   */
  validateBlogContent(blogContent: BlogContent): ValidationResult {
    const errors: string[] = [];
    
    if (!blogContent.title?.trim()) {
      errors.push('Title is required');
    }
    
    if (!blogContent.content?.trim()) {
      errors.push('Content is required');
    }
    
    if (!blogContent.metadata?.author?.trim()) {
      errors.push('Author is required');
    }
    
    if (!blogContent.metadata?.category?.trim()) {
      errors.push('Category is required');
    }
    
    const contentSize = new TextEncoder().encode(blogContent.content).length;
    if (contentSize > 10 * 1024 * 1024) {
      errors.push('Content exceeds 10MB limit');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Cache management
   */
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

  removeFromCache(reference: string): void {
    this.contentCache.delete(reference);
  }

  clearCache(): void {
    this.contentCache.clear();
  }

  private cleanExpiredCache(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [reference, content] of this.contentCache.entries()) {
      if (now - content.timestamp > this.cacheExpiryTime) {
        this.contentCache.delete(reference);
        removed++;
      }
    }
    
    return removed;
  }

  getCacheStats(): CacheStats {
    const now = Date.now();
    const entries = Array.from(this.contentCache.entries()).map(([reference, content]) => {
      const age = now - content.timestamp;
      return {
        reference,
        timestamp: content.timestamp,
        contentType: content.contentType,
        isExpired: age > this.cacheExpiryTime,
        ageInMinutes: Math.floor(age / 60000)
      };
    });
    
    return {
      size: this.contentCache.size,
      entries,
      totalSizeEstimate: entries.length * 1000, // Rough estimate
      expiredCount: entries.filter(e => e.isExpired).length
    };
  }

  /**
   * Force refresh content
   */
  async forceRefreshContent(reference: string): Promise<string> {
    this.removeFromCache(reference);
    return this.getContentAsHtml(reference, true);
  }

  /**
   * Utility methods
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}