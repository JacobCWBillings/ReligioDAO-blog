// src/blockchain/types/IDAOVoting.ts

import { BigNumberish, BytesLike, AddressLike } from "ethers";
import { 
  ProposalStatus, 
} from '../../types/blockchain';

// Update the status mapping function
export function mapContractStatusToEnum(status: number): ProposalStatus {
  switch (status) {
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
      console.warn(`Unknown Q governance proposal status: ${status}`);
      return ProposalStatus.None;
  }
}

// Helper function to get user-friendly status names
export function getProposalStatusName(status: ProposalStatus): string {
  const statusNames: Record<ProposalStatus, string> = {
    [ProposalStatus.None]: 'None',
    [ProposalStatus.Pending]: 'Pending',
    [ProposalStatus.Rejected]: 'Rejected',
    [ProposalStatus.Accepted]: 'Approved', // User-friendly name
    [ProposalStatus.Passed]: 'Passed',
    [ProposalStatus.Executed]: 'Executed',
    [ProposalStatus.Expired]: 'Expired',
    [ProposalStatus.UnderReview]: 'Under Review',
    [ProposalStatus.UnderEvaluation]: 'Under Evaluation'
  };
  return statusNames[status] || 'Unknown';
}

// Helper function to get status colors for UI
export function getProposalStatusColor(status: ProposalStatus): string {
  switch (status) {
    case ProposalStatus.None:
      return 'gray';
    case ProposalStatus.Pending:
      return 'yellow';
    case ProposalStatus.Rejected:
      return 'red';
    case ProposalStatus.Accepted:
      return 'green';
    case ProposalStatus.Passed:
      return 'green';
    case ProposalStatus.Executed:
      return 'green';
    case ProposalStatus.Expired:
      return 'orange';
    case ProposalStatus.UnderReview:
      return 'blue';
    case ProposalStatus.UnderEvaluation:
      return 'blue';
    default:
      return 'gray';
  }
}

// Helper function to determine what actions are available
export function getProposalActionAvailability(status: ProposalStatus) {
  return {
    canVote: status === ProposalStatus.Pending, // Or might be different status for active voting
    canExecute: status === ProposalStatus.Accepted || status === ProposalStatus.Passed,
    isCompleted: status === ProposalStatus.Executed,
    isFinal: [
      ProposalStatus.Rejected, 
      ProposalStatus.Executed, 
      ProposalStatus.Expired
    ].includes(status)
  };
}

/**
 * Structure for voting parameters
 */
export interface VotingParams {
  votingType: number;
  votingStartTime: BigNumberish;
  votingEndTime: BigNumberish;
  vetoEndTime: BigNumberish;
  proposalExecutionPeriod: BigNumberish;
  requiredQuorum: BigNumberish;
  requiredMajority: BigNumberish;
  requiredVetoQuorum: BigNumberish;
}

/**
 * Structure for vote counters
 */
export interface VotingCounters {
  votedFor: BigNumberish;
  votedAgainst: BigNumberish;
  vetoesCount: BigNumberish;
}

/**
 * Structure for a DAO proposal
 */
export interface DAOProposal {
  id: BigNumberish;
  remark: string;
  relatedExpertPanel: string;
  relatedVotingSituation: string;
  callData: BytesLike;
  target: AddressLike;
  params: VotingParams;
  counters: VotingCounters;
  executed: boolean;
}

/**
 * Structure for voting situation configuration
 */
export interface DAOVotingValues {
  votingPeriod: BigNumberish;
  vetoPeriod: BigNumberish;
  proposalExecutionPeriod: BigNumberish;
  requiredQuorum: BigNumberish;
  requiredMajority: BigNumberish;
  requiredVetoQuorum: BigNumberish;
  votingType: BigNumberish;
  votingTarget: string;
  votingMinAmount: BigNumberish;
}

/**
 * Concise interface for interacting with the DAO voting contract
 */
export interface IDAOVoting {
  // Query functions
  getProposal(proposalId: BigNumberish): Promise<DAOProposal>;
  getProposalList(offset: BigNumberish, limit: BigNumberish): Promise<DAOProposal[]>;
  getProposalStatus(proposalId: BigNumberish): Promise<BigNumberish>;
  proposalCount(): Promise<BigNumberish>;
  hasUserVoted(proposalId: BigNumberish, user: AddressLike): Promise<boolean>;
  getVotingSituations(): Promise<string[]>;
  getVotingSituationInfo(situation: string): Promise<DAOVotingValues>;
  
  // Action functions
  createProposal(
    situation: string, 
    remark: string, 
    callData: BytesLike
  ): Promise<any>;
  
  voteFor(proposalId: BigNumberish): Promise<any>;
  voteAgainst(proposalId: BigNumberish): Promise<any>;
  executeProposal(proposalId: BigNumberish): Promise<any>;
  
  // Events
  filters: {
    ProposalCreated(id?: BigNumberish, proposer?: AddressLike, proposal?: DAOProposal): any;
    ProposalExecuted(id?: BigNumberish): any;
    UserVoted(id?: BigNumberish, voter?: AddressLike, votingPower?: BigNumberish, option?: BigNumberish): any;
  };
}
