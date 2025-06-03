// src/blockchain/services/proposal/EventTypes.ts
import { ethers } from 'ethers';

/**
 * Enhanced transaction status with better typing and token support
 */
export interface EnhancedTransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  error?: Error;
  receipt?: ethers.TransactionReceipt;
  tokenId?: string; // For NFT minting transactions
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  blockNumber?: number;
  timestamp?: number;
}

/**
 * Cache entry with expiration and metadata
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiry?: number;
  hits?: number;
  lastAccessed?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  entries: number;
  totalSize: number;
  hitRate: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  averageAge: number;
}

/**
 * Event log interfaces for type safety
 */
export interface ProposalCreatedEventArgs {
  id: bigint;
  proposer: string;
  proposal: any; // The full proposal struct
}

export interface ProposalExecutedEventArgs {
  id: bigint;
}

export interface UserVotedEventArgs {
  id: bigint;
  voter: string;
  votingPower: bigint;
  option: number; // 0 = against, 1 = for
}

export interface UserVetoedEventArgs {
  id: bigint;
  voter: string;
}

/**
 * Extended event log interface with optional blockTimestamp
 */
export interface ExtendedEventLog extends ethers.EventLog {
  blockTimestamp?: number;
}

export interface ExtendedLog extends ethers.Log {
  blockTimestamp?: number;
}

/**
 * Type guard to check if an event is an EventLog (has args)
 */
export function isEventLog(event: ethers.Log | ethers.EventLog): event is ethers.EventLog {
  return 'args' in event && event.args !== undefined;
}

/**
 * Type guard to check if an event has a specific signature
 */
export function hasEventSignature(event: ethers.Log | ethers.EventLog, signature: string): boolean {
  return event.topics[0] === signature;
}

/**
 * Safely extract event args with type checking
 */
export function getEventArgs<T = any>(event: ethers.Log | ethers.EventLog): T | undefined {
  if (isEventLog(event)) {
    return event.args as T;
  }
  return undefined;
}

/**
 * Extract specific event args with validation
 */
export function extractProposalCreatedArgs(event: ethers.EventLog): ProposalCreatedEventArgs | null {
  try {
    return {
      id: event.args.id,
      proposer: event.args.proposer,
      proposal: event.args.proposal
    };
  } catch (error) {
    console.warn('Failed to extract ProposalCreated args:', error);
    return null;
  }
}

export function extractUserVotedArgs(event: ethers.EventLog): UserVotedEventArgs | null {
  try {
    return {
      id: event.args.id,
      voter: event.args.voter,
      votingPower: event.args.votingPower,
      option: Number(event.args.option)
    };
  } catch (error) {
    console.warn('Failed to extract UserVoted args:', error);
    return null;
  }
}

/**
 * Create BigInt in a way compatible with older TypeScript versions
 */
export function createBigInt(value: number | string | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  
  if (typeof BigInt !== 'undefined') {
    return BigInt(value);
  }
  
  // Fallback for environments without BigInt support
  throw new Error('BigInt not supported in this environment');
}

/**
 * Safe number conversion for BigInt values with bounds checking
 */
export function safeNumberFromBigInt(value: bigint | number | string, maxSafeInteger: boolean = true): number {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert string "${value}" to number`);
    }
    return parsed;
  }
  
  // BigInt conversion
  const numValue = Number(value);
  
  if (maxSafeInteger && (numValue > Number.MAX_SAFE_INTEGER || numValue < Number.MIN_SAFE_INTEGER)) {
    throw new Error(`BigInt value ${value} exceeds safe integer bounds`);
  }
  
  return numValue;
}

/**
 * Format BigInt as human-readable string with units
 */
export function formatBigInt(value: bigint, decimals: number = 18, unit: string = ''): string {
  if (decimals === 0) {
    return value.toString() + (unit ? ` ${unit}` : '');
  }
  
  const divisor = createBigInt(10 ** decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;
  
  if (remainder === BigInt(0)) {
    return quotient.toString() + (unit ? ` ${unit}` : '');
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${quotient}.${remainderStr}${unit ? ` ${unit}` : ''}`;
}

/**
 * Type-safe cache with automatic expiry and statistics
 */
export class TypedCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;
  private maxSize: number;
  private totalHits: number = 0;
  private totalMisses: number = 0;

  constructor(defaultTTL: number = 5 * 60 * 1000, maxSize: number = 1000) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
  }

  /**
   * Set cache entry with optional TTL
   */
  set(key: string, data: T, ttl?: number): void {
    // Clean expired entries if we're at capacity
    if (this.cache.size >= this.maxSize) {
      this.cleanExpired();
      
      // If still at capacity, remove oldest entry
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.getOldestKey();
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
    }

    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry,
      hits: 0,
      lastAccessed: Date.now()
    });
  }

  /**
   * Get cache entry with automatic expiry check
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.totalMisses++;
      return undefined;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.totalMisses++;
      return undefined;
    }

    // Update access statistics
    entry.hits = (entry.hits || 0) + 1;
    entry.lastAccessed = Date.now();
    this.totalHits++;

    return entry.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Get current size (after cleaning expired entries)
   */
  size(): number {
    this.cleanExpired();
    return this.cache.size;
  }

  /**
   * Get all cache entries (non-expired)
   */
  entries(): IterableIterator<[string, CacheEntry<T>]> {
    this.cleanExpired();
    return this.cache.entries();
  }

  /**
   * Get cache keys (non-expired)
   */
  keys(): string[] {
    this.cleanExpired();
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.cleanExpired();
    
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    let totalSize = 0;
    let oldestTimestamp = now;
    let newestTimestamp = 0;
    let totalAge = 0;

    for (const entry of entries) {
      totalSize += JSON.stringify(entry.data).length;
      
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
      
      totalAge += (now - entry.timestamp);
    }

    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0;
    const averageAge = entries.length > 0 ? totalAge / entries.length : 0;

    return {
      entries: this.cache.size,
      totalSize,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry: entries.length > 0 ? new Date(oldestTimestamp) : undefined,
      newestEntry: entries.length > 0 ? new Date(newestTimestamp) : undefined,
      averageAge: Math.round(averageAge / 1000) // Convert to seconds
    };
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry && now > entry.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get oldest cache key by timestamp
   */
  private getOldestKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Update TTL for existing entry
   */
  touch(key: string, newTTL?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.expiry = Date.now() + (newTTL || this.defaultTTL);
    entry.lastAccessed = Date.now();
    return true;
  }

  /**
   * Get entry metadata without affecting hit stats
   */
  getMetadata(key: string): Omit<CacheEntry<T>, 'data'> | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const { data, ...metadata } = entry;
    return metadata;
  }
}

/**
 * Helper function to get block timestamp safely
 */
export async function getBlockTimestamp(
  provider: ethers.Provider, 
  blockNumber: number
): Promise<number | undefined> {
  try {
    const block = await provider.getBlock(blockNumber);
    return block ? block.timestamp : undefined;
  } catch (error) {
    console.warn(`Failed to get block timestamp for block ${blockNumber}:`, error);
    return undefined;
  }
}

/**
 * Add block timestamp to events safely
 */
export async function enrichEventsWithTimestamp<T extends ethers.Log | ethers.EventLog>(
  provider: ethers.Provider,
  events: T[]
): Promise<(T & { blockTimestamp?: number })[]> {
  const enrichedEvents = await Promise.all(
    events.map(async (event) => {
      try {
        const blockTimestamp = await getBlockTimestamp(provider, event.blockNumber);
        return { ...event, blockTimestamp };
      } catch (error) {
        console.warn(`Failed to enrich event with timestamp:`, error);
        return { ...event, blockTimestamp: undefined };
      }
    })
  );
  
  return enrichedEvents;
}

/**
 * Create enhanced transaction status from ethers transaction response
 */
export function createEnhancedTransactionStatus(
  tx: ethers.TransactionResponse,
  receipt?: ethers.TransactionReceipt
): EnhancedTransactionStatus {
  const status: EnhancedTransactionStatus = {
    hash: tx.hash,
    status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
    confirmations: 0
  };

  if (receipt) {
    status.receipt = receipt;
    status.gasUsed = receipt.gasUsed;
    status.effectiveGasPrice = receipt.gasPrice;
    status.blockNumber = receipt.blockNumber;
    
    // Handle confirmations properly for ethers v6
    // Note: In ethers v6, confirmations is a method, not a property
    // We'll handle this in the calling code
    status.confirmations = 0; // Will be updated by calling code
    
    // Try to get block timestamp
    if (receipt.blockNumber) {
      status.timestamp = Date.now(); // Placeholder - would need provider to get actual block timestamp
    }
  }

  return status;
}

/**
 * Common blockchain event signatures
 */
export const EVENT_SIGNATURES = {
  PROPOSAL_CREATED: '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0',
  PROPOSAL_EXECUTED: '0x712ae1383f79ac853f8d882153778e0260ef8f03b504e2866e0593e04d2b291f',
  USER_VOTED: '0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4',
  USER_VETOED: '0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267',
  TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
} as const;

/**
 * Event filtering utilities
 */
export class EventFilter {
  /**
   * Filter events by signature
   */
  static bySignature<T extends ethers.Log | ethers.EventLog>(
    events: T[], 
    signature: string
  ): T[] {
    return events.filter(event => hasEventSignature(event, signature));
  }

  /**
   * Filter events by block range
   */
  static byBlockRange<T extends ethers.Log | ethers.EventLog>(
    events: T[], 
    fromBlock: number, 
    toBlock: number
  ): T[] {
    return events.filter(event => 
      event.blockNumber >= fromBlock && event.blockNumber <= toBlock
    );
  }

  /**
   * Filter events by time range (requires block timestamps)
   */
  static byTimeRange<T extends ExtendedEventLog | ExtendedLog>(
    events: T[], 
    fromTime: number, 
    toTime: number
  ): T[] {
    return events.filter(event => {
      if (!event.blockTimestamp) return false;
      return event.blockTimestamp >= fromTime && event.blockTimestamp <= toTime;
    });
  }

  /**
   * Get unique addresses from events
   */
  static getUniqueAddresses<T extends ethers.Log | ethers.EventLog>(events: T[]): string[] {
    const addresses = new Set<string>();
    events.forEach(event => {
      addresses.add(event.address);
      if (isEventLog(event)) {
        // Extract addresses from indexed parameters
        event.topics.slice(1).forEach(topic => {
          if (topic.length === 66) { // 0x + 64 hex chars = address
            try {
              const address = ethers.getAddress('0x' + topic.slice(26));
              addresses.add(address);
            } catch {
              // Not a valid address
            }
          }
        });
      }
    });
    return Array.from(addresses);
  }
}

/**
 * Error handling utilities for blockchain operations
 */
export class BlockchainErrorHandler {
  /**
   * Extract revert reason from error
   */
  static extractRevertReason(error: any): string | undefined {
    if (typeof error === 'string') return error;
    
    if (error?.reason) return error.reason;
    if (error?.data?.message) return error.data.message;
    if (error?.error?.message) return error.error.message;
    if (error?.message) {
      // Try to extract revert reason from message
      const match = error.message.match(/revert (.+)/i);
      if (match) return match[1];
      return error.message;
    }
    
    return undefined;
  }

  /**
   * Classify error type for better UX
   */
  static classifyError(error: any): 'user_rejected' | 'insufficient_funds' | 'network_error' | 'contract_error' | 'unknown' {
    const message = (error?.message || '').toLowerCase();
    
    if (message.includes('user denied') || message.includes('user rejected')) {
      return 'user_rejected';
    }
    
    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
      return 'insufficient_funds';
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'network_error';
    }
    
    if (message.includes('revert') || message.includes('execution reverted')) {
      return 'contract_error';
    }
    
    return 'unknown';
  }
}

/**
 * Utility for batch processing with rate limiting
 */
export class BatchProcessor {
  /**
   * Process items in batches with delay
   */
  static async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10,
    delayMs: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < items.length && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`Batch processing failed for batch starting at index ${i}:`, error);
        // Continue with next batch rather than failing completely
      }
    }
    
    return results;
  }
}