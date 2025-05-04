// src/blockchain/services/DAOVotingService.ts
import { ethers } from 'ethers';
import { BaseContractService } from './BaseContractService';
import { 
  BlockchainError, 
  BlockchainErrorType, 
  Proposal, 
  ProposalStatus, 
  TransactionStatus 
} from '../../types/blockchain';
import { IDAOVoting } from '../interfaces/IDAOVoting';
import { getContractAddresses, getVotingSituationName } from '../../config';
import { toNumber } from '../utils/blockchainUtils';
import { extractContentReference } from '../utils/contentHash';

import GeneralDAOVotingABI from '../abis/GeneralDAOVoting.json';

/**
 * Service for interacting with the DAO voting contract
 * Handles direct contract calls for proposals and voting
 */
export class DAOVotingService extends BaseContractService {
  private votingContract: ethers.Contract | null = null;
  private votingSituationName: string | undefined;

  /**
   * Initialize the DAO voting contract
   * @param chainId Optional chain ID for network-specific configuration
   */
  public async init(chainId?: number): Promise<void> {
    try {
      const addresses = getContractAddresses(chainId);
      this.votingSituationName = getVotingSituationName(chainId);
      
      // Determine the contract provider (signer preferred for transactions)
      const contractProvider = this.signer || this.provider;
      
      // Initialize contract with interface for typing
      this.votingContract = new ethers.Contract(
        addresses.generalDAOVoting,
        GeneralDAOVotingABI.abi,
        contractProvider
      ) as ethers.Contract & IDAOVoting;
      
      // Validate voting situation name if provided
      if (this.votingSituationName) {
        try {
          const situations = await this.votingContract.getVotingSituations();
          if (!situations.includes(this.votingSituationName)) {
            console.warn(`Voting situation "${this.votingSituationName}" not found in contract. Available situations: ${situations.join(', ')}`);
          }
        } catch (err) {
          console.warn("Could not validate voting situation name:", err);
        }
      }
      
      this.isInitialized = true;
    } catch (err) {
      console.error('Error initializing DAO voting contract:', err);
      throw new BlockchainError(
        'Failed to initialize DAO voting contract',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Create a proposal in the DAO
   * @param situationName Voting situation name
   * @param description Proposal description
   * @param callData Call data for the proposal execution
   * @returns Promise resolving to TransactionStatus with proposal ID
   */
  public async createProposal(
    situationName: string,
    description: string,
    callData: string
  ): Promise<TransactionStatus & { proposalId?: string }> {
    this.ensureInitialized();

    try {
      // Submit proposal to the contract
      const tx = await this.votingContract!.createProposal(
        situationName,
        description,
        callData
      );
      
      // Track transaction
      const status = await this.trackTransaction(tx);
      
      // Extract proposal ID from receipt events if available
      let proposalId: string | undefined = undefined;
      
      if (status.status === 'confirmed' && status.receipt) {
        // Look for ProposalCreated event
        const event = status.receipt.logs
          .map((log: ethers.Log) => {
            try {
              return this.votingContract!.interface.parseLog({
                topics: log.topics as string[],
                data: log.data
              });
            } catch (e) {
              return null;
            }
          })
          .find((evt: ethers.LogDescription | null) => evt?.name === 'ProposalCreated');
        
        if (event && event.args && event.args.id) {
          proposalId = event.args.id.toString();
        }
      }
      
      return {
        ...status,
        proposalId
      };
    } catch (err) {
      console.error('Error creating proposal:', err);
      throw new BlockchainError(
        'Failed to create proposal',
        this.determineErrorType(err),
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Vote in favor of a proposal
   * @param proposalId Blockchain proposal ID (0-based)
   * @returns Promise resolving to TransactionStatus
   */
  public async voteFor(proposalId: string): Promise<TransactionStatus> {
    this.ensureInitialized();

    try {
      const tx = await this.votingContract!.voteFor(proposalId);
      return await this.trackTransaction(tx);
    } catch (err) {
      console.error('Error voting for proposal:', err);
      throw new BlockchainError(
        'Failed to vote for proposal',
        this.determineErrorType(err),
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Vote against a proposal
   * @param proposalId Blockchain proposal ID (0-based)
   * @returns Promise resolving to TransactionStatus
   */
  public async voteAgainst(proposalId: string): Promise<TransactionStatus> {
    this.ensureInitialized();

    try {
      const tx = await this.votingContract!.voteAgainst(proposalId);
      return await this.trackTransaction(tx);
    } catch (err) {
      console.error('Error voting against proposal:', err);
      throw new BlockchainError(
        'Failed to vote against proposal',
        this.determineErrorType(err),
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Execute an approved proposal
   * @param proposalId Blockchain proposal ID (0-based)
   * @returns Promise resolving to TransactionStatus
   */
  public async executeProposal(proposalId: string): Promise<TransactionStatus> {
    this.ensureInitialized();

    try {
      const tx = await this.votingContract!.executeProposal(proposalId);
      return await this.trackTransaction(tx);
    } catch (err) {
      console.error('Error executing proposal:', err);
      throw new BlockchainError(
        'Failed to execute proposal',
        this.determineErrorType(err),
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get proposal details from contract
   * @param proposalId Blockchain proposal ID (0-based)
   * @returns Promise resolving to raw proposal data from contract
   */
  public async getRawProposal(proposalId: string): Promise<any> {
    this.ensureInitialized();

    try {
      return await this.votingContract!.getProposal(proposalId);
    } catch (err) {
      console.error('Error getting raw proposal:', err);
      throw new BlockchainError(
        'Failed to get proposal details',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get proposal status from contract
   * @param proposalId Blockchain proposal ID (0-based)
   * @returns Promise resolving to numeric status
   */
  public async getProposalStatus(proposalId: string): Promise<number> {
    this.ensureInitialized();

    try {
      const status = await this.votingContract!.getProposalStatus(proposalId);
      return toNumber(status);
    } catch (err) {
      console.error('Error getting proposal status:', err);
      throw new BlockchainError(
        'Failed to get proposal status',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get all proposal IDs from contract
   * @returns Promise resolving to array of proposal IDs (0-based)
   */
  public async getAllProposalIds(): Promise<string[]> {
    this.ensureInitialized();

    try {
      const proposalCount = await this.votingContract!.proposalCount();
      const count = toNumber(proposalCount);
      
      // Create an array of IDs from 0 to count-1 (blockchain IDs)
      return Array.from({ length: count }, (_, i) => i.toString());
    } catch (err) {
      console.error('Error getting all proposal IDs:', err);
      throw new BlockchainError(
        'Failed to get all proposal IDs',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get all proposals with pagination
   * @param offset Starting index
   * @param limit Maximum number of proposals to return
   * @returns Promise resolving to array of raw proposals
   */
  public async getProposalBatch(offset: number, limit: number): Promise<any[]> {
    this.ensureInitialized();

    try {
      return await this.votingContract!.getProposalList(offset, limit);
    } catch (err) {
      console.error('Error getting proposal batch:', err);
      throw new BlockchainError(
        'Failed to get proposal batch',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Check if a user has voted on a proposal
   * @param proposalId Blockchain proposal ID (0-based)
   * @param voter Voter address
   * @returns Promise resolving to boolean indicating if user has voted
   */
  public async hasUserVoted(proposalId: string, voter: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      return await this.votingContract!.hasUserVoted(proposalId, voter);
    } catch (err) {
      console.error('Error checking if user has voted:', err);
      return false; // Return false instead of throwing
    }
  }

  /**
   * Get information about a voting situation
   * @param situationName Name of the voting situation
   * @returns Promise resolving to voting situation info
   */
  public async getVotingSituationInfo(situationName?: string): Promise<any> {
    this.ensureInitialized();
    
    const situation = situationName || this.votingSituationName;
    if (!situation) {
      throw new BlockchainError(
        "Voting situation name not provided",
        BlockchainErrorType.ContractError
      );
    }
    
    try {
      return await this.votingContract!.getVotingSituationInfo(situation);
    } catch (err) {
      console.error(`Error getting voting situation info for ${situation}:`, err);
      throw new BlockchainError(
        `Failed to get voting situation info for ${situation}`,
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get the default voting situation name
   * @returns Voting situation name
   */
  public getVotingSituation(): string | undefined {
    return this.votingSituationName;
  }
}