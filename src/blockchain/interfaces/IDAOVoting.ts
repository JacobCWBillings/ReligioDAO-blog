// src/blockchain/types/DAOVotingTypes.ts

import { BigNumberish, BytesLike, AddressLike } from "ethers";

/**
 * Enum for proposal statuses that maps directly to contract values
 */
export enum ProposalStatus {
  Pending = 0,    // Created but voting hasn't started yet
  Active = 1,      // Voting is active
  Approved = 2,  // Voting finished with approval
  Rejected = 3,  // Voting finished with rejection
  Executed = 4,  // Proposal has been executed
  Canceled = 5   // Proposal was canceled
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

/**
 * Helper function for mapping contract status to enum
 */
export function mapContractStatusToEnum(status: number): ProposalStatus {
  switch (status) {
    case 0: return ProposalStatus.Pending;
    case 1: return ProposalStatus.Active;
    case 2: return ProposalStatus.Approved;
    case 3: return ProposalStatus.Rejected;
    case 4: return ProposalStatus.Executed;
    case 5: return ProposalStatus.Canceled;
    default: return ProposalStatus.Pending;
  }
}