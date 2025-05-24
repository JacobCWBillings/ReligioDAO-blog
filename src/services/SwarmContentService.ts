// src/services/SwarmContentService.ts - web-optimized approach
import { Bee } from '@ethersphere/bee-js';
import { getContentUrl } from '../config';
import { marked } from 'marked';

// Interface defining the structure of cached content
interface CachedContent {
  content: string;
  html: string;
  timestamp: number;
  contentType?: string;
}

// List of backup gateways to try when primary fails
const BACKUP_GATEWAYS = [
  'https://api.gateway.ethswarm.org',
  'https://gateway.ethswarm.org', 
  'https://bee-8.gateway.ethswarm.org',
  'https://download.gateway.ethswarm.org'
];

// Swarm endpoint types
export const ENDPOINTS = {
  BZZ: 'bzz',    // Web content endpoint (HTML, markdown, etc.)
  BYTES: 'bytes' // Raw data endpoint (binary files)
};

// Standard file names for different content types
export const STANDARD_CONTENT_FILENAME = 'index.html'; // Web content
export const STANDARD_MARKDOWN_FILENAME = 'content.md'; // Markdown content
export const STANDARD_JSON_FILENAME = 'content.json';   // JSON metadata

/**
 * Service for retrieving and caching content from Swarm
 * Uses a web-first approach that prioritizes bzz endpoint for blog content
 */
class SwarmContentService {
  private contentCache: Map<string, CachedContent>;
  private cacheExpiryTime: number; // Cache expiry time in milliseconds
  
  constructor(cacheExpiryTimeInMinutes: number = 30) {
    // Initialize the cache
    this.contentCache = new Map<string, CachedContent>();
    this.cacheExpiryTime = cacheExpiryTimeInMinutes * 60 * 1000;
  }
  
  /**
   * Retrieve content from Swarm with caching
   * Uses a web-first approach prioritizing bzz endpoint
   * 
   * @param contentReference Swarm content reference
   * @param forceFresh Whether to force a fresh fetch (bypass cache)
   * @returns Promise resolving to the content string
   */
  public async getContent(contentReference: string, forceFresh: boolean = false): Promise<string> {
    // Check if content is in cache and not expired
    const cachedContent = this.contentCache.get(contentReference);
    const now = Date.now();
    
    if (!forceFresh && cachedContent && (now - cachedContent.timestamp) < this.cacheExpiryTime) {
      return cachedContent.content;
    }
    
    // Content not in cache, expired, or force fresh requested
    try {
      const content = await this.fetchContent(contentReference);
      
      // Detect content type for better rendering
      const contentType = this.detectContentType(content);
      
      // Add to cache
      this.contentCache.set(contentReference, {
        content,
        html: marked(content),
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
   * Detect content type from the content itself
   * Helps determine how to best render the content
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
   * Retrieve content from Swarm and convert to HTML with caching
   * @param contentReference Swarm content reference
   * @returns Promise resolving to the HTML string
   */
  public async getContentAsHtml(contentReference: string): Promise<string> {
    // Check if content is in cache and not expired
    const cachedContent = this.contentCache.get(contentReference);
    const now = Date.now();
    
    if (cachedContent && (now - cachedContent.timestamp) < this.cacheExpiryTime) {
      return cachedContent.html;
    }
    
    // Content not in cache or expired, fetch from Swarm
    try {
      const content = await this.fetchContent(contentReference);
      
      // Determine if this is already HTML content
      const contentType = this.detectContentType(content);
      let html: string;
      
      if (contentType === 'text/html') {
        // Content is already HTML
        html = content;
      } else if (contentType === 'application/json') {
        // Try to extract content from JSON and render that
        try {
          const jsonData = JSON.parse(content);
          if (jsonData.content && typeof jsonData.content === 'string') {
            html = marked(jsonData.content);
          } else {
            // Fallback to rendering the JSON as code
            html = `<pre>${content}</pre>`;
          }
        } catch {
          html = marked(content);
        }
      } else {
        // Assume markdown or plain text
        html = marked(content);
      }
      
      // Add to cache
      this.contentCache.set(contentReference, {
        content,
        html,
        timestamp: now,
        contentType
      });
      
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
   * Clean any prefixes from a Swarm reference
   */
  private cleanReference(reference: string): string {
    return reference
      .replace('bzz://', '')
      .replace('bytes://', '')
      .trim();
  }
  
  /**
   * Fetch content from Swarm using web-first approach
   * Prioritizes bzz endpoint for web content with fallbacks
   * 
   * @param contentReference Swarm content reference
   * @returns Promise resolving to the content string
   */
  private async fetchContent(contentReference: string): Promise<string> {
    // Make sure content reference is valid
    if (!contentReference || contentReference.trim() === '') {
      throw new Error('Invalid content reference: empty or undefined');
    }
    
    // Clean up the reference if it has any prefixes
    const cleanReference = this.cleanReference(contentReference);
    console.log(`Fetching content for reference: ${cleanReference}`);
    
    // Try with primary gateway and then backup gateways
    const gateways = ['http://localhost:1633', ...BACKUP_GATEWAYS];
    
    // Try each gateway with multiple approaches
    for (const gateway of gateways) {
      try {
        // Create bee instance for this gateway
        const bee = new Bee(gateway);
        
        // First approach: Try downloadFile and access index.html
        try {
          console.log(`Trying to download as file from ${gateway}/bzz/${cleanReference}`);
          const file = await bee.downloadFile(cleanReference, STANDARD_CONTENT_FILENAME);
          if (file && file.data) {
            // Extract text content
            let content;
            if (file.data instanceof Blob) {
              content = await file.data.text();
            } else if (typeof file.data.text === 'function') {
              content = file.data.text();
            } else {
              throw new Error('Unsupported file data format');
            }
            console.log(`Successfully retrieved content from ${gateway}/bzz/${cleanReference}/${STANDARD_CONTENT_FILENAME}`);
            return content;
          }
        } catch (fileError) {
          console.warn(`Failed to download as file: ${fileError}`);
        }
        
        // Second approach: Try direct bytes download
        try {
          console.log(`Trying to download as raw data from ${gateway}/bytes/${cleanReference}`);
          const data = await bee.downloadData(cleanReference);
          const content = new TextDecoder().decode(data);
          console.log(`Successfully retrieved content as raw data`);
          return content;
        } catch (bytesError) {
          console.warn(`Failed to download as bytes: ${bytesError}`);
        }
        
        // If specific gateway approaches fail, continue to the next gateway
      } catch (gatewayError) {
        console.warn(`Failed to use gateway ${gateway}: ${gatewayError}`);
        // Continue to next gateway
      }
    }
    
    // If direct bee-js methods don't work, try regular fetch as fallback
    for (const gateway of gateways) {
      try {
        // Try different possible endpoints
        const endpointsToTry = [
          `${gateway}/bzz/${cleanReference}/${STANDARD_CONTENT_FILENAME}`,
          `${gateway}/bzz/${cleanReference}/${STANDARD_MARKDOWN_FILENAME}`,
          `${gateway}/bzz/${cleanReference}/${STANDARD_JSON_FILENAME}`,
          `${gateway}/bzz/${cleanReference}/`,
          `${gateway}/bytes/${cleanReference}`
        ];
        
        for (const url of endpointsToTry) {
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
            console.warn(`Fetch fallback failed for ${url}: ${fetchError}`);
            // Continue to next URL
          }
        }
      } catch (error) {
        // Continue to next gateway
      }
    }
    
    throw new Error(`Failed to fetch content using reference ${contentReference} after trying all methods`);
  }
  
  /**
   * Clear the content cache
   */
  public clearCache(): void {
    this.contentCache.clear();
  }
  
  /**
   * Remove a specific reference from the cache
   * @param contentReference Swarm content reference
   */
  public removeFromCache(contentReference: string): void {
    this.contentCache.delete(contentReference);
  }
  
  /**
   * Pre-fetch and cache content from Swarm
   * Uses web-first approach for better user experience
   * 
   * @param contentReferences Array of Swarm content references to pre-fetch
   * @param priority Optional priority order (references to fetch first)
   */
  public async prefetchContent(
    contentReferences: string[], 
    priority: string[] = []
  ): Promise<void> {
    if (!contentReferences || contentReferences.length === 0) {
      return;
    }
    
    // Process priority items first
    const priorityItems = contentReferences.filter(ref => priority.includes(ref));
    const regularItems = contentReferences.filter(ref => !priority.includes(ref));
    
    // Process items in priority order
    const orderedReferences = [...priorityItems, ...regularItems];
    
    // Track which references we successfully prefetched
    const prefetchResults: Record<string, boolean> = {};
    
    // Process in batches to avoid overwhelming the network
    const BATCH_SIZE = 3;
    for (let i = 0; i < orderedReferences.length; i += BATCH_SIZE) {
      const batch = orderedReferences.slice(i, i + BATCH_SIZE);
      
      // Create a batch of promises with error handling
      const batchPromises = batch.map(async (reference) => {
        if (!reference) return;
        
        try {
          // Only fetch if not already in cache or expired
          const cachedContent = this.contentCache.get(reference);
          const now = Date.now();
          
          if (!cachedContent || (now - cachedContent.timestamp) >= this.cacheExpiryTime) {
            try {
              const content = await this.fetchContent(reference);
              const contentType = this.detectContentType(content);
              
              this.contentCache.set(reference, {
                content,
                html: marked(content),
                timestamp: now,
                contentType
              });
              
              prefetchResults[reference] = true;
            } catch (fetchError) {
              console.warn(`Error fetching content for prefetch: ${fetchError}`);
              prefetchResults[reference] = false;
            }
          } else {
            // Already cached and valid
            prefetchResults[reference] = true;
          }
        } catch (error) {
          // Log error but don't fail the entire prefetch operation
          console.warn(`Failed to process prefetch for ${reference}:`, error);
          prefetchResults[reference] = false;
        }
      });
      
      try {
        // Wait for current batch to complete before starting the next
        await Promise.all(batchPromises);
      } catch (batchError) {
        console.error(`Error processing prefetch batch: ${batchError}`);
        // Continue with next batch even if this one had errors
      }
    }
    
    const successCount = Object.values(prefetchResults).filter(Boolean).length;
    console.log(`Prefetch completed: ${successCount}/${contentReferences.length} successful`);
  }
}

// Create and export a singleton instance
const swarmContentService = new SwarmContentService();
export default swarmContentService;