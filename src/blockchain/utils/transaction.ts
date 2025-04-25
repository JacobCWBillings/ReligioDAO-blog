// src/blockchain/utils/transaction.ts
import { ethers } from 'ethers';
import { TransactionStatus, BlockchainError, BlockchainErrorType } from '../../types/blockchain';

/**
 * Interface matching ethers.js v6 ContractTransaction structure
 * This helps with TypeScript compatibility
 */
interface EthersTransaction {
  hash: string;
  wait: (confirmations?: number) => Promise<ethers.TransactionReceipt>;
}

/**
 * Sends a transaction and returns its status
 * @param transaction Transaction to send
 * @param confirmations Number of confirmations to wait for
 * @returns Promise resolving to transaction status
 */
export async function sendTransaction(
  transaction: EthersTransaction,
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
    
    // Update status
    status.status = receipt ? 'confirmed' : 'failed';
    status.confirmations = confirmations;
    status.receipt = receipt;
    
    return status;
  } catch (err) {
    console.error(`Transaction failed: ${transaction.hash}`, err);
    
    status.status = 'failed';
    status.error = err instanceof Error ? err : new Error(String(err));
    
    throw new BlockchainError(
      'Transaction failed',
      determineErrorType(err),
      err instanceof Error ? err : new Error(String(err))
    );
  }
}

/**
 * Determines the type of blockchain error
 * @param error Error object
 * @returns BlockchainErrorType
 */
export function determineErrorType(error: any): BlockchainErrorType {
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

/**
 * Formats blockchain error for user-friendly display
 * @param error BlockchainError or Error object
 * @returns User-friendly error message
 */
export function formatErrorForUser(error: BlockchainError | Error): string {
  if (error instanceof BlockchainError) {
    switch (error.type) {
      case BlockchainErrorType.UserRejected:
        return 'Transaction was rejected in your wallet';
      
      case BlockchainErrorType.InsufficientFunds:
        return 'Insufficient funds to complete this transaction';
      
      case BlockchainErrorType.GasLimitExceeded:
        return 'Transaction requires too much gas to execute';
      
      case BlockchainErrorType.NonceError:
        return 'Transaction nonce error. Please try again';
      
      case BlockchainErrorType.NetworkError:
        return 'Network connection error. Please check your internet connection';
      
      case BlockchainErrorType.ContractError:
        return 'Smart contract error. The transaction was reverted';
      
      case BlockchainErrorType.Timeout:
        return 'Transaction timed out. Please try again';
      
      case BlockchainErrorType.UnsupportedNetwork:
        return 'Unsupported network. Please switch to a supported network';
        
      default:
        return error.message || 'Unknown blockchain error';
    }
  }
  
  return error.message || 'An error occurred';
}

/**
 * Waits for a transaction receipt
 * @param provider Ethers provider
 * @param txHash Transaction hash
 * @param timeout Optional timeout in milliseconds
 * @returns Promise resolving to transaction receipt
 */
export async function waitForTransaction(
  provider: ethers.Provider,
  txHash: string,
  timeout: number = 120000
): Promise<ethers.TransactionReceipt> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
      
      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.warn(`Error checking transaction ${txHash}:`, err);
      // Continue trying
    }
  }
  
  throw new BlockchainError(
    `Transaction ${txHash} timed out after ${timeout}ms`,
    BlockchainErrorType.Timeout
  );
}

/**
 * Creates a TransactionStatus object from a transaction hash
 * Useful for returning status when you only have the hash (e.g., from another service)
 * 
 * @param txHash Transaction hash
 * @returns TransactionStatus object
 */
export function createPendingTransactionStatus(txHash: string): TransactionStatus {
  return {
    hash: txHash,
    status: 'pending',
    confirmations: 0
  };
}

/**
 * Estimates gas for a transaction - Updated for ethers.js v6 compatibility
 * 
 * @param contract Ethers contract
 * @param method Method name
 * @param args Method arguments
 * @param additionalMargin Additional gas margin (percentage as decimal, e.g., 0.1 for 10%)
 * @returns Promise resolving to gas limit as bigint
 */
export async function estimateGas(
  contract: ethers.Contract,
  method: string,
  args: any[],
  additionalMargin: number = 0.1
): Promise<bigint> {
  try {
    // In ethers v6, we need to use this approach to dynamically access contract methods
    // Use the function property to access the method safely
    const contractFunction = contract.getFunction(method);
    
    if (!contractFunction) {
      throw new Error(`Method ${method} not found on contract`);
    }
    
    // Estimate gas for the transaction
    const estimatedGas = await contractFunction.estimateGas(...args);
    
    // Add a safety margin (working with bigint)
    const margin = Number(estimatedGas) * additionalMargin;
    const gasLimit = BigInt(Math.floor(Number(estimatedGas) + margin));
    
    return gasLimit;
  } catch (err) {
    console.error(`Error estimating gas for ${method}:`, err);
    throw new BlockchainError(
      `Failed to estimate gas for ${method}`,
      determineErrorType(err),
      err instanceof Error ? err : new Error(String(err))
    );
  }
}