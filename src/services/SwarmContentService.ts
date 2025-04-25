// src/services/SwarmContentService.ts
import { getContentUrl } from '../config';
import { marked } from 'marked';

// Interface defining the structure of cached content
interface CachedContent {
  content: string;
  html: string;
  timestamp: number;
}

/**
 * Service for retrieving and caching content from Swarm
 * Provides reliable content retrieval with local caching
 */
class SwarmContentService {
  private contentCache: Map<string, CachedContent>;
  private cacheExpiryTime: number; // Cache expiry time in milliseconds
  private retryAttempts: number;
  private retryDelay: number;
  
  constructor(
    cacheExpiryTimeInMinutes: number = 30,
    retryAttempts: number = 3,
    retryDelayInMs: number = 1000
  ) {
    // Initialize the cache
    this.contentCache = new Map<string, CachedContent>();
    this.cacheExpiryTime = cacheExpiryTimeInMinutes * 60 * 1000;
    this.retryAttempts = retryAttempts;
    this.retryDelay = retryDelayInMs;
  }
  
  /**
   * Retrieve content from Swarm with caching
   * @param contentReference Swarm content reference
   * @returns Promise resolving to the content string
   */
  public async getContent(contentReference: string): Promise<string> {
    // Check if content is in cache and not expired
    const cachedContent = this.contentCache.get(contentReference);
    const now = Date.now();
    
    if (cachedContent && (now - cachedContent.timestamp) < this.cacheExpiryTime) {
      return cachedContent.content;
    }
    
    // Content not in cache or expired, fetch from Swarm
    try {
      const content = await this.fetchContentWithRetry(contentReference);
      
      // Add to cache
      this.contentCache.set(contentReference, {
        content,
        html: marked(content),
        timestamp: now
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
      const content = await this.fetchContentWithRetry(contentReference);
      const html = marked(content);
      
      // Add to cache
      this.contentCache.set(contentReference, {
        content,
        html,
        timestamp: now
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
   * Fetch content from Swarm with retry logic
   * @param contentReference Swarm content reference
   * @returns Promise resolving to the content string
   */
  private async fetchContentWithRetry(contentReference: string): Promise<string> {
    let lastError: Error | null = null;
    let attempts = 0;
    
    while (attempts < this.retryAttempts) {
      try {
        const contentUrl = getContentUrl(contentReference);
        const response = await fetch(contentUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch from Swarm: ${response.status} ${response.statusText}`);
        }
        
        return await response.text();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        
        // If we have more attempts to go, wait before retrying
        if (attempts < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
        }
      }
    }
    
    // If we've exhausted all retry attempts, throw the last error
    throw new Error(`Failed to fetch content after ${this.retryAttempts} attempts: ${lastError?.message}`);
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
   * @param contentReferences Array of Swarm content references to pre-fetch
   */
  public async prefetchContent(contentReferences: string[]): Promise<void> {
    // Create an array of promises, but don't wait for them to complete
    const prefetchPromises = contentReferences.map(async (reference) => {
      try {
        // Only fetch if not already in cache or expired
        const cachedContent = this.contentCache.get(reference);
        const now = Date.now();
        
        if (!cachedContent || (now - cachedContent.timestamp) >= this.cacheExpiryTime) {
          const content = await this.fetchContentWithRetry(reference);
          this.contentCache.set(reference, {
            content,
            html: marked(content),
            timestamp: now
          });
        }
      } catch (error) {
        // Log error but don't fail the entire prefetch operation
        console.warn(`Failed to prefetch content for ${reference}:`, error);
      }
    });
    
    // Wait for all prefetch operations to complete
    await Promise.all(prefetchPromises);
  }
}

// Create and export a singleton instance
const swarmContentService = new SwarmContentService();
export default swarmContentService;