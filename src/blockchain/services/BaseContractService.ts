// src/blockchain/services/BaseContractService.ts
import { ethers } from 'ethers';
import { BlockchainError, BlockchainErrorType, TransactionStatus } from '../../types/blockchain';

/**
 * Base class for contract interaction services
 * Provides common functionality for contract initialization and error handling
 */
export abstract class BaseContractService {
  protected provider: ethers.Provider;
  protected signer: ethers.Signer | null;
  protected isInitialized: boolean = false;
  protected isRealWalletConnected: boolean = false;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer || null;
    
    // Determine if we have a real wallet connected
    // Read-only signers will not have a private key that can sign transactions
    this.isRealWalletConnected = Boolean(signer && !(signer instanceof ethers.VoidSigner));
  }

  /**
   * Initialize the service
   * @param chainId Optional chain ID for network-specific configuration
   */
  public abstract init(chainId?: number): Promise<void>;

  /**
   * Ensure the service is initialized
   * @throws BlockchainError if not initialized
   */
  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new BlockchainError(
        `${this.constructor.name} is not initialized. Call init() first.`,
        BlockchainErrorType.ContractError
      );
    }
  }

  /**
   * Track a transaction through its lifecycle
   * @param transaction Ethers transaction
   * @param confirmations Number of confirmations to wait for
   * @returns Promise resolving to transaction status
   */
  protected async trackTransaction(
    transaction: ethers.ContractTransactionResponse,
    confirmations: number = 1
  ): Promise<TransactionStatus> {
    const status: TransactionStatus = {
      hash: transaction.hash,
      status: 'pending',
      confirmations: 0
    };

    try {
      // Wait for confirmation
      const receipt = await transaction.wait(confirmations);
      
      // Update status - handle ethers v6 confirmations method
      if (receipt) {
        status.status = receipt.status === 1 ? 'confirmed' : 'failed';
        
        // In ethers v6, confirmations is a method, not a property
        try {
          const confirmedCount = await receipt.confirmations();
          status.confirmations = confirmedCount;
        } catch {
          // Fallback if confirmations method fails
          status.confirmations = confirmations;
        }
        
        status.receipt = receipt;
      } else {
        status.status = 'failed';
        status.error = new Error('Transaction receipt is null');
      }
      
      return status;
    } catch (err) {
      console.error(`Transaction failed: ${transaction.hash}`, err);
      
      status.status = 'failed';
      status.error = err instanceof Error ? err : new Error(String(err));
      
      throw new BlockchainError(
        'Transaction failed',
        this.determineErrorType(err),
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Determine the type of blockchain error
   * @param error Error object
   * @returns BlockchainErrorType
   */
  protected determineErrorType(error: any): BlockchainErrorType {
    if (!error) return BlockchainErrorType.Unknown;
    
    const errorMessage = (error.message || '').toLowerCase();
    
    if (errorMessage.includes('user denied') || 
        errorMessage.includes('user rejected') || 
        errorMessage.includes('rejected transaction')) {
      return BlockchainErrorType.UserRejected;
    }
    
    if (errorMessage.includes('insufficient funds')) {
      return BlockchainErrorType.InsufficientFunds;
    }
    
    if (errorMessage.includes('gas required exceeds')) {
      return BlockchainErrorType.GasLimitExceeded;
    }
    
    if (errorMessage.includes('nonce too low') || 
        errorMessage.includes('replacement transaction underpriced')) {
      return BlockchainErrorType.NonceError;
    }
    
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('network error')) {
      return BlockchainErrorType.NetworkError;
    }
    
    if (errorMessage.includes('execution reverted')) {
      return BlockchainErrorType.ContractError;
    }
    
    return BlockchainErrorType.Unknown;
  }

  // Add a method to check if we're using a real wallet
  protected isUsingRealWallet(): boolean {
    return this.isRealWalletConnected;
  }
  
  // For methods that require a real signer, add a check
  protected ensureRealWallet(): void {
    if (!this.isRealWalletConnected) {
      throw new BlockchainError(
        'This operation requires a connected wallet',
        BlockchainErrorType.UserRejected
      );
    }
  }
}