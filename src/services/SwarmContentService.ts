// src/services/SwarmContentService.ts
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

/**
 * Determines if a reference is likely a collection or file reference
 * (Heuristic approach based on common patterns)
 */
function isLikelyCollection(reference: string): boolean {
  // This is a simple heuristic - might need refinement based on your data
  if (reference.includes('bzz://')) return true;
  
  // More sophisticated checks could be added here
  return false;
}

/**
 * Service for retrieving and caching content from Swarm
 * Provides reliable content retrieval with local caching and gateway fallbacks
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
   * Clean any prefixes from a Swarm reference
   */
  private cleanReference(reference: string): string {
    return reference
      .replace('bzz://', '')
      .replace('bytes://', '')
      .trim();
  }
  
  /**
   * Fetch content from Swarm with retry logic and improved content type detection
   * 
   * @param contentReference Swarm content reference
   * @returns Promise resolving to the content string
   */
  private async fetchContentWithRetry(contentReference: string): Promise<string> {
    let lastError: Error | null = null;
    
    // Make sure content reference is valid
    if (!contentReference || contentReference.trim() === '') {
      throw new Error('Invalid content reference: empty or undefined');
    }
    
    // Clean up the reference if it has any prefixes
    const cleanReference = this.cleanReference(contentReference);
    console.log(`Fetching content for reference: ${cleanReference}`);
    
    // Try with primary gateway and then backup gateways
    const gateways = ['http://localhost:1633', ...BACKUP_GATEWAYS];
    
    for (const gateway of gateways) {
      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          console.log(`Trying gateway ${gateway}, attempt ${attempt + 1}/${this.retryAttempts}`);
          
          // Try downloading as raw bytes first (most common for content)
          try {
            console.log(`Using bee-js with gateway ${gateway}`);
            const bee = new Bee(gateway);
            
            // Try to download as raw data first
            const data = await bee.downloadData(cleanReference);
            console.log(`Downloaded data of size: ${data.length} bytes`);
            
            try {
              // Try to decode as text
              const content = new TextDecoder().decode(data);
              
              // Verify this is valid text and not binary data by checking for common text patterns
              // If it contains a lot of unprintable characters, it's likely binary data
              const nonPrintableChars = content.replace(/[\x20-\x7E\n\r\t]/g, '').length;
              const isPrintable = (nonPrintableChars / content.length) < 0.1; // Allow 10% non-printable chars
              
              if (isPrintable) {
                console.log(`Successfully retrieved content as text using bee-js from ${gateway}`);
                return content;
              } else {
                console.warn(`Retrieved data appears to be binary, not text`);
                throw new Error('Content appears to be binary, not text');
              }
            } catch (decodeError) {
              console.warn(`Error decoding data as text: ${decodeError}`);
              throw decodeError;
            }
          } catch (beeError) {
            console.warn(`bee-js download failed with ${gateway}: ${beeError}`);
          }
          
          // If this is likely a collection, try the /bzz/ endpoint
          try {
            console.log(`Trying /bzz/ endpoint with gateway ${gateway}`);
            
            // First try to get the index file if this is a collection
            const bzzUrl = `${gateway}/bzz/${cleanReference}/index.md`;
            console.log(`Trying to fetch index.md from collection: ${bzzUrl}`);
            
            const bzzResponse = await fetch(bzzUrl, { 
              signal: AbortSignal.timeout(5000),
              headers: {
                'Accept': 'text/markdown, text/plain, */*'
              }
            });
            
            if (bzzResponse.ok) {
              const contentType = bzzResponse.headers.get('Content-Type');
              console.log(`Response content type: ${contentType}`);
              
              const content = await bzzResponse.text();
              console.log(`Successfully retrieved content from ${bzzUrl}`);
              return content;
            } else {
              console.warn(`/bzz/index.md endpoint failed with status ${bzzResponse.status} at ${gateway}`);
              
              // Try without index.md in case the file is at the root
              const rootBzzUrl = `${gateway}/bzz/${cleanReference}/`;
              console.log(`Trying to fetch root content: ${rootBzzUrl}`);
              
              const rootResponse = await fetch(rootBzzUrl, { 
                signal: AbortSignal.timeout(5000),
                headers: {
                  'Accept': 'text/markdown, text/plain, */*'
                }
              });
              
              if (rootResponse.ok) {
                const content = await rootResponse.text();
                console.log(`Successfully retrieved content from ${rootBzzUrl}`);
                return content;
              } else {
                console.warn(`Root /bzz/ endpoint failed with status ${rootResponse.status} at ${gateway}`);
              }
            }
          } catch (bzzError) {
            console.warn(`/bzz/ endpoint request failed at ${gateway}: ${bzzError}`);
          }
          
          // As a last resort, try the raw bytes endpoint
          try {
            console.log(`Trying /bytes/ endpoint with gateway ${gateway}`);
            const bytesUrl = `${gateway}/bytes/${cleanReference}`;
            const bytesResponse = await fetch(bytesUrl, { 
              signal: AbortSignal.timeout(5000),
              headers: {
                'Accept': 'text/plain, */*'
              }
            });
            
            if (bytesResponse.ok) {
              const content = await bytesResponse.text();
              console.log(`Successfully retrieved content from ${bytesUrl}`);
              return content;
            } else {
              console.warn(`/bytes/ endpoint failed with status ${bytesResponse.status} at ${gateway}`);
            }
          } catch (bytesError) {
            console.warn(`/bytes/ endpoint request failed at ${gateway}: ${bytesError}`);
          }
          
          // All approaches failed for this attempt, delay before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`Error during attempt ${attempt + 1} with gateway ${gateway}: ${lastError.message}`);
          // Continue to next attempt
        }
      }
      
      // All attempts with this gateway failed, continue to next gateway
      console.warn(`All attempts with gateway ${gateway} failed`);
    }
    
    // If we've exhausted all gateways and retry attempts, throw the last error
    throw new Error(`Failed to fetch content using reference ${contentReference} after trying all gateways: ${lastError?.message}`);
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