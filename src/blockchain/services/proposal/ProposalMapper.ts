// src/blockchain/services/proposal/ProposalMapper.ts - FIXED: Don't filter out proposal ID 0
import { ethers } from 'ethers';
import { Proposal, ProposalStatus } from '../../../types/blockchain';

// Contract data structures (matching the GeneralDAOVoting ABI)
export interface ContractDAOProposal {
  id: bigint;
  remark: string;
  relatedExpertPanel: string;
  relatedVotingSituation: string;
  callData: string;
  target: string;
  params: {
    votingType: number;
    votingStartTime: bigint;
    votingEndTime: bigint;
    vetoEndTime: bigint;
    proposalExecutionPeriod: bigint;
    requiredQuorum: bigint;
    requiredMajority: bigint;
    requiredVetoQuorum: bigint;
  };
  counters: {
    votedFor: bigint;
    votedAgainst: bigint;
    vetoesCount: bigint;
  };
  executed: boolean;
}

export class ProposalMapper {
  
  /**
   * Map contract proposal data to our Proposal interface
   */
  static mapContractProposalToProposal(
    contractProposal: ContractDAOProposal, 
    proposer?: string
  ): Proposal {
    // Enhanced validation with better error messages
    if (!contractProposal) {
      console.error('ProposalMapper: contractProposal is null or undefined');
      throw new Error('Invalid contract proposal data: proposal is null');
    }

    // Log the actual data we received for debugging
    console.log('ProposalMapper: Mapping contract proposal:', {
      hasId: !!contractProposal.id,
      id: contractProposal.id?.toString(),
      hasRemark: !!contractProposal.remark,
      remark: contractProposal.remark,
      hasParams: !!contractProposal.params,
      hasCounters: !!contractProposal.counters,
      executed: contractProposal.executed
    });

    // Check if ID exists and is valid
    if (contractProposal.id === undefined || contractProposal.id === null) {
      console.error('ProposalMapper: contractProposal.id is missing');
      throw new Error('Invalid contract proposal data: missing ID');
    }

    // FIXED: Don't automatically filter out proposal ID 0 - check if data is actually valid
    const proposalIdNumber = Number(contractProposal.id);
    
    // Instead of filtering out ID 0, check if the proposal data looks valid
    const hasValidData = this.isValidProposalData(contractProposal);
    if (!hasValidData) {
      console.warn(`ProposalMapper: Skipping proposal ${proposalIdNumber} due to invalid/empty data`);
      throw new Error(`Invalid contract proposal data: proposal ${proposalIdNumber} has no valid content`);
    }

    // Validate required fields with fallbacks
    const remark = contractProposal.remark || '';
    const params = contractProposal.params || {
      votingType: 0,
      votingStartTime: BigInt(0),
      votingEndTime: BigInt(0),
      vetoEndTime: BigInt(0),
      proposalExecutionPeriod: BigInt(0),
      requiredQuorum: BigInt(0),
      requiredMajority: BigInt(0),
      requiredVetoQuorum: BigInt(0)
    };
    const counters = contractProposal.counters || {
      votedFor: BigInt(0),
      votedAgainst: BigInt(0),
      vetoesCount: BigInt(0)
    };

    // Extract title from remark (first line) and description (rest)
    const remarkLines = remark.split('\n');
    const title = remarkLines[0]?.trim() || `Proposal ${contractProposal.id}`;
    const description = remarkLines.slice(1).join('\n').trim() || remark;

    // Calculate timestamps (convert from seconds to milliseconds)
    const votingStartTime = Number(params.votingStartTime);
    const votingEndTime = Number(params.votingEndTime);
    const createdAt = votingStartTime > 0 ? votingStartTime * 1000 : Date.now();
    const votingEnds = votingEndTime > 0 ? votingEndTime * 1000 : Date.now() + 86400000; // Default to 1 day from now

    // Calculate proposal status
    const status = this.calculateProposalStatus(contractProposal);

    // Extract vote counts
    const votesFor = Number(counters.votedFor);
    const votesAgainst = Number(counters.votedAgainst);

    // Try to extract content reference from callData
    const contentReference = this.extractContentReference(contractProposal.callData);

    const mappedProposal: Proposal = {
      id: contractProposal.id.toString(),
      title,
      description,
      proposer: proposer || 'Unknown',
      createdAt,
      votingEnds,
      votesFor,
      votesAgainst,
      status,
      executed: contractProposal.executed || false,
      contentReference
    };

    console.log('ProposalMapper: Successfully mapped proposal:', {
      id: mappedProposal.id,
      title: mappedProposal.title,
      status: mappedProposal.status,
      votesFor: mappedProposal.votesFor,
      votesAgainst: mappedProposal.votesAgainst
    });

    return mappedProposal;
  }

  /**
   * Check if proposal data appears valid (not an empty slot)
   * FIXED: Better validation logic instead of just checking ID 0
   */
  private static isValidProposalData(contractProposal: ContractDAOProposal): boolean {
    try {
      // Check if we have minimal required data
      // A valid proposal should have either a remark, callData, or have been executed
      const hasRemark = contractProposal.remark && contractProposal.remark.trim().length > 0;
      const hasCallData = contractProposal.callData && contractProposal.callData !== '0x';
      const isExecuted = contractProposal.executed;
      const hasVotes = contractProposal.counters && 
        (contractProposal.counters.votedFor > BigInt(0) || contractProposal.counters.votedAgainst > BigInt(0));

      // A proposal is valid if it has content OR has been interacted with (votes/execution)
      return hasRemark || hasCallData || isExecuted || hasVotes;
    } catch (error) {
      console.warn('ProposalMapper: Error checking proposal validity:', error);
      return false;
    }
  }

  /**
   * Calculate proposal status based on contract data and current time
   */
  private static calculateProposalStatus(contractProposal: ContractDAOProposal): ProposalStatus {
    try {
      const now = Math.floor(Date.now() / 1000);
      const params = contractProposal.params;
      
      if (!params) {
        console.warn('ProposalMapper: No params found, defaulting to None status');
        return ProposalStatus.None;
      }

      const votingStartTime = Number(params.votingStartTime);
      const votingEndTime = Number(params.votingEndTime);
      
      // If already executed, return executed status
      if (contractProposal.executed) {
        return ProposalStatus.Executed;
      }

      // If voting hasn't started yet
      if (votingStartTime > 0 && now < votingStartTime) {
        return ProposalStatus.Pending;
      }

      // If voting period has ended
      if (votingEndTime > 0 && now > votingEndTime) {
        return this.calculatePostVotingStatus(contractProposal);
      }

      // Currently in voting period
      return ProposalStatus.Pending;
    } catch (error) {
      console.error('ProposalMapper: Error calculating status:', error);
      return ProposalStatus.None;
    }
  }

  /**
   * Calculate status after voting period has ended
   */
  private static calculatePostVotingStatus(contractProposal: ContractDAOProposal): ProposalStatus {
    try {
      const counters = contractProposal.counters;
      if (!counters) {
        return ProposalStatus.Expired;
      }

      const votesFor = Number(counters.votedFor);
      const votesAgainst = Number(counters.votedAgainst);
      const totalVotes = votesFor + votesAgainst;
      
      // If no votes were cast, proposal expired
      if (totalVotes === 0) {
        return ProposalStatus.Expired;
      }

      const params = contractProposal.params;
      if (!params) {
        return ProposalStatus.Expired;
      }

      // Check if quorum was met (simplified check for now)
      const requiredQuorum = Number(params.requiredQuorum);
      
      // Check if majority was achieved
      const requiredMajority = Number(params.requiredMajority);
      
      // Calculate majority percentage (multiply by large number to match contract precision)
      const majorityThreshold = requiredMajority; // This is already in the correct format from contract
      const currentMajorityScore = totalVotes > 0 ? (votesFor * 1000000000000000000000000000) / totalVotes : 0;
      
      // Determine if proposal passed
      if (currentMajorityScore >= majorityThreshold) {
        return ProposalStatus.Accepted; // Ready for execution
      } else {
        return ProposalStatus.Rejected;
      }
    } catch (error) {
      console.error('ProposalMapper: Error calculating post-voting status:', error);
      return ProposalStatus.Expired;
    }
  }

  /**
   * Extract content reference from callData
   */
  private static extractContentReference(callData: string): string | undefined {
    if (!callData || callData === '0x') {
      return undefined;
    }

    try {
      // Try to decode as string (common case for blog proposals)
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], callData);
      const decodedString = decoded[0];
      
      // Validate that it looks like a Swarm hash (64 hex characters)
      if (typeof decodedString === 'string' && /^[a-fA-F0-9]{64}$/.test(decodedString)) {
        return decodedString;
      }
    } catch (error) {
      // If string decoding fails, try other formats
      try {
        // Try decoding as bytes32 (another common format)
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32'], callData);
        const bytes32Value = decoded[0];
        
        // Convert bytes32 to hex string without 0x prefix
        if (bytes32Value && typeof bytes32Value === 'string') {
          const hexString = bytes32Value.startsWith('0x') ? bytes32Value.slice(2) : bytes32Value;
          if (/^[a-fA-F0-9]{64}$/.test(hexString)) {
            return hexString;
          }
        }
      } catch (innerError) {
        // If all decoding attempts fail, log and continue
        console.warn('ProposalMapper: Failed to decode callData as content reference:', error);
      }
    }

    return undefined;
  }

  /**
   * Map contract status enum to our ProposalStatus enum
   * This is for cases where we get status directly from getProposalStatus()
   */
  static mapContractStatusToEnum(contractStatus: number): ProposalStatus {
    // Map based on the Q governance contract status values
    switch (contractStatus) {
      case 0: return ProposalStatus.None;
      case 1: return ProposalStatus.Pending;
      case 2: return ProposalStatus.Rejected;
      case 3: return ProposalStatus.Accepted;
      case 4: return ProposalStatus.Passed;
      case 5: return ProposalStatus.Executed;
      case 6: return ProposalStatus.Expired;
      case 7: return ProposalStatus.UnderReview;
      case 8: return ProposalStatus.UnderEvaluation;
      default: 
        console.warn(`ProposalMapper: Unknown Q governance proposal status: ${contractStatus}`);
        return ProposalStatus.None;
    }
  }

  /**
   * Create a user-friendly status description
   */
  static getProposalStatusDescription(status: ProposalStatus, proposal?: Partial<Proposal>): string {
    switch (status) {
      case ProposalStatus.None:
        return 'Not initialized';
      case ProposalStatus.Pending:
        if (proposal?.votingEnds && Date.now() < proposal.votingEnds) {
          return 'Active - accepting votes';
        }
        return 'Pending';
      case ProposalStatus.Rejected:
        return 'Rejected by voters';
      case ProposalStatus.Accepted:
        return 'Approved - ready for execution';
      case ProposalStatus.Passed:
        return 'Passed - ready for execution';
      case ProposalStatus.Executed:
        return 'Successfully executed';
      case ProposalStatus.Expired:
        return 'Voting period expired';
      case ProposalStatus.UnderReview:
        return 'Under review';
      case ProposalStatus.UnderEvaluation:
        return 'Under evaluation';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Determine available actions for a proposal
   */
  static getAvailableActions(proposal: Proposal, userAccount?: string): {
    canVote: boolean;
    canExecute: boolean;
    canView: boolean;
    isCompleted: boolean;
    votingTimeRemaining?: number;
  } {
    const now = Date.now();
    const votingActive = now >= (proposal.createdAt) && now <= proposal.votingEnds;
    
    return {
      canVote: votingActive && !proposal.executed && userAccount !== undefined,
      canExecute: (proposal.status === ProposalStatus.Accepted || proposal.status === ProposalStatus.Passed) && !proposal.executed,
      canView: true,
      isCompleted: proposal.executed,
      votingTimeRemaining: votingActive ? proposal.votingEnds - now : undefined
    };
  }

  /**
   * Validate proposal data integrity
   */
  static validateProposal(proposal: Proposal): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!proposal.id || proposal.id === '0') {
      // FIXED: Allow proposal ID 0, just check if it's defined
      if (!proposal.id && proposal.id !== '0') {
        errors.push('Invalid proposal ID');
      }
    }

    if (!proposal.title?.trim()) {
      errors.push('Missing proposal title');
    }

    if (proposal.createdAt <= 0) {
      errors.push('Invalid creation date');
    }

    if (proposal.votingEnds <= proposal.createdAt) {
      errors.push('Invalid voting period');
    }

    if (proposal.votesFor < 0 || proposal.votesAgainst < 0) {
      errors.push('Invalid vote counts');
    }

    if (!Object.values(ProposalStatus).includes(proposal.status)) {
      errors.push('Invalid proposal status');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a summary object for proposal lists
   */
  static createProposalSummary(proposal: Proposal) {
    const validation = this.validateProposal(proposal);
    const actions = this.getAvailableActions(proposal);
    const statusDescription = this.getProposalStatusDescription(proposal.status, proposal);
    
    return {
      ...proposal,
      summary: {
        statusDescription,
        totalVotes: proposal.votesFor + proposal.votesAgainst,
        supportPercentage: proposal.votesFor + proposal.votesAgainst > 0 
          ? Math.round((proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100)
          : 0,
        daysUntilVotingEnds: Math.max(0, Math.ceil((proposal.votingEnds - Date.now()) / (1000 * 60 * 60 * 24))),
        isValid: validation.isValid,
        validationErrors: validation.errors,
        availableActions: actions
      }
    };
  }

  /**
   * FIXED: Better filtering logic that doesn't exclude valid proposals
   */
  static filterValidProposals(contractProposals: ContractDAOProposal[]): ContractDAOProposal[] {
    return contractProposals.filter((proposal, index) => {
      try {
        // Check basic validity
        if (!proposal || proposal.id === undefined || proposal.id === null) {
          console.warn(`ProposalMapper: Filtering out invalid proposal at index ${index}:`, proposal);
          return false;
        }

        // FIXED: Use the new validation method instead of just checking ID 0
        if (!this.isValidProposalData(proposal)) {
          console.warn(`ProposalMapper: Filtering out proposal ${proposal.id} due to invalid data at index ${index}`);
          return false;
        }

        return true;
      } catch (error) {
        console.error(`ProposalMapper: Error validating proposal at index ${index}:`, error);
        return false;
      }
    });
  }
}