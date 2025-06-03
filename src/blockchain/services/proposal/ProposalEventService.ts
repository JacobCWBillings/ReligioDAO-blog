// src/blockchain/services/proposal/ProposalEventService.ts
import { ethers } from 'ethers';
import { Proposal, BlockchainError, BlockchainErrorType } from '../../../types/blockchain';
import { isEventLog, TypedCache, getBlockTimestamp, enrichEventsWithTimestamp } from './EventTypes';

export interface ProposalCreatedEvent {
  proposalId: string;
  proposer: string;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export interface ProposalExecutedEvent {
  proposalId: string;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export interface VoteEvent {
  proposalId: string;
  voter: string;
  support: boolean;
  votingPower: number;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export class ProposalEventService {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private eventCache: TypedCache<Record<string, string>>;

  constructor(provider: ethers.Provider, contract: ethers.Contract) {
    this.provider = provider;
    this.contract = contract;
    this.eventCache = new TypedCache<Record<string, string>>(2 * 60 * 1000); // 2 minutes
  }

  /**
   * Get proposer addresses for a list of proposals
   */
  async enrichProposalsWithProposerData(proposals: Proposal[]): Promise<void> {
    if (!proposals.length) return;

    try {
      const proposalIds = proposals.map(p => parseInt(p.id));
      const proposerMap = await this.getProposerMapping(proposalIds);
      
      // Update proposals with proposer data
      for (const proposal of proposals) {
        if (proposerMap[proposal.id]) {
          proposal.proposer = proposerMap[proposal.id];
        }
      }
    } catch (error) {
      console.warn('Failed to enrich proposals with proposer data:', error);
      // This is not critical, so we don't throw
    }
  }

  /**
   * Get mapping of proposal IDs to proposer addresses
   */
  private async getProposerMapping(proposalIds: number[]): Promise<Record<string, string>> {
    const cacheKey = `proposers_${proposalIds.join('_')}`;
    
    // Check cache first
    const cachedResult = this.eventCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Create filter for ProposalCreated events
      const filter = this.contract.filters.ProposalCreated();
      
      // Get events from recent blocks (adjust block range as needed)
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Last ~7 days on most chains
      
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);
      
      // Build proposer mapping
      const proposerMap: Record<string, string> = {};
      
      for (const event of events) {
        // Check if this is an EventLog (has args) vs a Log
        if (isEventLog(event)) {
          const proposalId = event.args.id.toString();
          const proposer = event.args.proposer;
          
          // Only include if we're looking for this proposal
          if (proposalIds.includes(parseInt(proposalId))) {
            proposerMap[proposalId] = proposer;
          }
        }
      }
      
      // Cache the result
      this.eventCache.set(cacheKey, proposerMap);
      
      return proposerMap;
    } catch (error) {
      console.error('Error fetching proposer mapping:', error);
      return {};
    }
  }

  /**
   * Get all ProposalCreated events for specific proposals
   */
  async getProposalCreatedEvents(proposalIds?: number[]): Promise<ProposalCreatedEvent[]> {
    try {
      const filter = this.contract.filters.ProposalCreated();
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
      
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);
      const results: ProposalCreatedEvent[] = [];
      
      // Enrich events with timestamps
      const enrichedEvents = await enrichEventsWithTimestamp(this.provider, events);
      
      for (const event of enrichedEvents) {
        // Check if this is an EventLog (has args) vs a Log
        if (isEventLog(event)) {
          const proposalId = event.args.id.toString();
          
          // Filter by specific proposal IDs if provided
          if (proposalIds && !proposalIds.includes(parseInt(proposalId))) {
            continue;
          }
          
          results.push({
            proposalId,
            proposer: event.args.proposer,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: event.blockTimestamp
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching ProposalCreated events:', error);
      throw new BlockchainError(
        'Failed to fetch proposal creation events',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get ProposalExecuted events
   */
  async getProposalExecutedEvents(proposalIds?: number[]): Promise<ProposalExecutedEvent[]> {
    try {
      const filter = this.contract.filters.ProposalExecuted();
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
      
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);
      const results: ProposalExecutedEvent[] = [];
      
      // Enrich events with timestamps
      const enrichedEvents = await enrichEventsWithTimestamp(this.provider, events);
      
      for (const event of enrichedEvents) {
        // Check if this is an EventLog (has args) vs a Log
        if (isEventLog(event)) {
          const proposalId = event.args.id.toString();
          
          // Filter by specific proposal IDs if provided
          if (proposalIds && !proposalIds.includes(parseInt(proposalId))) {
            continue;
          }
          
          results.push({
            proposalId,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: event.blockTimestamp
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching ProposalExecuted events:', error);
      throw new BlockchainError(
        'Failed to fetch proposal execution events',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get voting events for proposals
   */
  async getVoteEvents(proposalIds?: number[]): Promise<VoteEvent[]> {
    try {
      const filter = this.contract.filters.UserVoted();
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
      
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);
      const results: VoteEvent[] = [];
      
      // Enrich events with timestamps
      const enrichedEvents = await enrichEventsWithTimestamp(this.provider, events);
      
      for (const event of enrichedEvents) {
        // Check if this is an EventLog (has args) vs a Log
        if (isEventLog(event)) {
          const proposalId = event.args.id.toString();
          
          // Filter by specific proposal IDs if provided
          if (proposalIds && !proposalIds.includes(parseInt(proposalId))) {
            continue;
          }
          
          // Decode vote option (0 = against, 1 = for)
          const support = event.args.option === 1;
          
          results.push({
            proposalId,
            voter: event.args.voter,
            support,
            votingPower: Number(event.args.votingPower),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: event.blockTimestamp
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching vote events:', error);
      throw new BlockchainError(
        'Failed to fetch voting events',
        BlockchainErrorType.ContractError,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Extract NFT token ID from a transaction receipt
   */
  async extractTokenIdFromReceipt(receipt: ethers.TransactionReceipt): Promise<string | null> {
    try {
      // Look for Transfer events in the logs (ERC721 Transfer event signature)
      const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      
      for (const log of receipt.logs) {
        if (log.topics[0] === transferEventSignature && log.topics.length >= 4) {
          const fromAddress = log.topics[1];
          const zeroAddress = "0x" + "0".repeat(64);
          
          // Check if this is a mint (from zero address)
          if (fromAddress === zeroAddress && log.topics[3]) {
            try {
              const tokenId = ethers.getBigInt(log.topics[3]).toString();
              return tokenId;
            } catch (parseError) {
              console.warn('Failed to parse token ID from log:', parseError);
              continue;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting token ID from receipt:', error);
      return null;
    }
  }

  /**
   * Get comprehensive event data for a proposal
   */
  async getProposalEventSummary(proposalId: string): Promise<{
    created?: ProposalCreatedEvent;
    executed?: ProposalExecutedEvent;
    votes: VoteEvent[];
    totalVotes: number;
    uniqueVoters: number;
  }> {
    try {
      const proposalIdNum = parseInt(proposalId);
      
      // Get all relevant events
      const [createdEvents, executedEvents, voteEvents] = await Promise.all([
        this.getProposalCreatedEvents([proposalIdNum]),
        this.getProposalExecutedEvents([proposalIdNum]),
        this.getVoteEvents([proposalIdNum])
      ]);
      
      const uniqueVoters = new Set(voteEvents.map(v => v.voter)).size;
      
      return {
        created: createdEvents[0],
        executed: executedEvents[0],
        votes: voteEvents,
        totalVotes: voteEvents.length,
        uniqueVoters
      };
    } catch (error) {
      console.error(`Error getting event summary for proposal ${proposalId}:`, error);
      return {
        votes: [],
        totalVotes: 0,
        uniqueVoters: 0
      };
    }
  }

  /**
   * Clear event cache
   */
  clearCache(): void {
    this.eventCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    totalSize: number;
    oldestEntry?: Date;
  } {
    let totalSize = 0;
    let oldestTimestamp = Date.now();
    
    for (const [key, cacheEntry] of this.eventCache.entries()) {
      totalSize += JSON.stringify(cacheEntry.data).length;
      if (cacheEntry.timestamp < oldestTimestamp) {
        oldestTimestamp = cacheEntry.timestamp;
      }
    }
    
    return {
      entries: this.eventCache.size(),
      totalSize,
      oldestEntry: this.eventCache.size() > 0 ? new Date(oldestTimestamp) : undefined
    };
  }

  /**
   * Check if user has voted on a proposal by looking at events
   * This can be used as a fallback if the contract method fails
   */
  async hasUserVotedByEvents(proposalId: string, userAddress: string): Promise<boolean> {
    try {
      const voteEvents = await this.getVoteEvents([parseInt(proposalId)]);
      return voteEvents.some(event => 
        event.voter.toLowerCase() === userAddress.toLowerCase()
      );
    } catch (error) {
      console.error('Error checking vote status by events:', error);
      return false;
    }
  }
}