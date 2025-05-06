// src/services/SwarmContentService.ts - standardized approach
import { Bee } from '@ethersphere/bee-js';
import { getContentUrl } from '../config';
import { marked } from 'marked';

// Interface defining the structure of cached content
interface CachedContent {
  content: string;
  html: string;
  timestamp: number;
}

// List of backup gateways to try when primary fails
const BACKUP_GATEWAYS = [
  'https://api.gateway.ethswarm.org',
  'https://gateway.ethswarm.org', 
  'https://bee-8.gateway.ethswarm.org',
  'https://download.gateway.ethswarm.org'
];

// Standard file name for all markdown content
export const STANDARD_CONTENT_FILENAME = '';

/**
 * Service for retrieving and caching content from Swarm
 * Uses a standardized approach for content references
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
      const content = await this.fetchContent(contentReference);
      
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
      const content = await this.fetchContent(contentReference);
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
   * Clean any prefixes from a Swarm reference
   */
  private cleanReference(reference: string): string {
    return reference
      .replace('bzz://', '')
      .replace('bytes://', '')
      .trim();
  }
  
  /**
   * Fetch content from Swarm using the standardized path approach
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
    
    // Try each gateway
    for (const gateway of gateways) {
      try {
        // Use standard path pattern
        const url = `${gateway}/bzz/${cleanReference}/${STANDARD_CONTENT_FILENAME}`;
        console.log(`Trying URL: ${url}`);
        
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(5000),
          headers: {'Accept': 'text/markdown, text/plain, */*'}
        });
        
        if (response.ok) {
          const content = await response.text();
          console.log(`Successfully retrieved content from ${url}`);
          return content;
        } else {
          console.warn(`Failed to fetch from ${url} with status: ${response.status}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch from gateway ${gateway}: ${error}`);
        // Continue to next gateway
      }
    }
    
    // If we've exhausted all gateways, try one last approach with bee-js
    try {
      console.log(`Trying bee-js with localhost gateway`);
      const bee = new Bee('http://localhost:1633');
      const data = await bee.downloadData(cleanReference);
      const content = new TextDecoder().decode(data);
      return content;
    } catch (error) {
      console.warn(`bee-js approach failed: ${error}`);
    }
    
    throw new Error(`Failed to fetch content using reference ${contentReference} after trying all gateways`);
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
          const content = await this.fetchContent(reference);
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