// src/blockchain/utils/transactionUtils.ts

import { ethers, TransactionReceipt } from 'ethers';

/**
 * Extracts the NFT token ID from a transaction receipt that minted an NFT
 * This is useful after executing a proposal that mints a blog NFT
 * 
 * @param receipt Transaction receipt from executing a proposal
 * @param nftContractAddress The address of the NFT contract
 * @returns The token ID as a string, or null if not found
 */
export const extractNFTTokenIdFromReceipt = (
  receipt: ethers.TransactionReceipt,
  nftContractAddress: string
): string | null => {
  // The Transfer event ABI for ERC721 tokens
  const transferEventSignature = 'Transfer(address,address,uint256)';
  const transferEvent = ethers.id(transferEventSignature);
  
  // Look for Transfer events in the logs
  for (const log of receipt.logs) {
    // Check if this log is from our NFT contract
    if (log.address.toLowerCase() === nftContractAddress.toLowerCase()) {
      // Check if this is a Transfer event (first topic is the event signature)
      if (log.topics[0] === transferEvent) {
        // The third topic is the token ID (indexed parameter)
        if (log.topics.length >= 3) {
          // Convert the hex value to a decimal string
          const tokenIdHex = log.topics[2];
          const tokenId = ethers.toBigInt(tokenIdHex).toString();
          return tokenId;
        }
      }
    }
  }
  
  // No matching Transfer event found
  return null;
};

/**
 * Extracts the NFT token ID from a transaction receipt,
 * specifically for the NFTMintingModulePlus contract
 * 
 * @param receipt Transaction receipt from executing a proposal
 * @returns The token ID as a string, or null if not found
 */
export const extractTokenIdFromMintingReceipt = (
  receipt: ethers.TransactionReceipt
): string | null => {
  // The event ABI for NFT minting in our contract
  const mintEventSignature = 'NFTMinted(address,uint256)';
  const mintEvent = ethers.id(mintEventSignature);
  
  // Look for NFTMinted events in the logs
  for (const log of receipt.logs) {
    // Check if this is an NFTMinted event
    if (log.topics[0] === mintEvent) {
      // The second topic is the token ID (indexed parameter)
      if (log.topics.length >= 2) {
        // Convert the hex value to a decimal string
        try {
          const tokenIdHex = log.topics[1];
          const tokenId = ethers.toBigInt(tokenIdHex).toString();
          return tokenId;
        } catch (err) {
          console.error('Error parsing token ID from event:', err);
        }
      }
    }
  }
  
  // If no NFTMinted event, fall back to looking for Transfer event
  return null;
};

/**
 * Extracts the proposal ID from a transaction receipt after proposal creation
 * 
 * @param receipt Transaction receipt from creating a proposal
 * @returns The proposal ID as a string, or null if not found
 */
export const extractProposalIdFromReceipt = (
  receipt: ethers.TransactionReceipt
): string | null => {
  // The ProposalCreated event signature
  const proposalEventSignature = 'ProposalCreated(uint256,address,(uint256,string,string,string,bytes,address,(uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256),bool))';
  const proposalCreatedHash = ethers.id(proposalEventSignature);
  
  // Simpler fallback signature if the full one doesn't match
  const simpleProposalEventSignature = 'ProposalCreated(uint256,address,tuple)'; 
  const simpleProposalCreatedHash = ethers.id(simpleProposalEventSignature);
  
  // Look for ProposalCreated events in the logs
  for (const log of receipt.logs) {
    // Check if this is a ProposalCreated event (first topic is the event signature)
    if (log.topics[0] === proposalCreatedHash || log.topics[0] === simpleProposalCreatedHash) {
      // The second topic is the proposal ID (indexed parameter)
      if (log.topics.length >= 2) {
        try {
          const proposalIdHex = log.topics[1];
          const proposalId = ethers.toBigInt(proposalIdHex).toString();
          return proposalId;
        } catch (err) {
          console.error('Error parsing proposal ID from event:', err);
        }
      }
    }
  }
  
  // No matching ProposalCreated event found
  return null;
};

/**
 * Tracks a transaction through its lifecycle and provides status updates
 * 
 * @param provider Ethers provider
 * @param txHash Transaction hash
 * @param confirmations Number of confirmations to wait for
 * @param callback Optional callback for transaction status updates
 * @returns Promise resolving to the transaction receipt
 */
export const trackTransaction = async (
  provider: ethers.Provider,
  txHash: string,
  confirmations: number = 1,
  callback?: (status: string, receipt?: ethers.TransactionReceipt) => void
): Promise<ethers.TransactionReceipt> => {
  // Initial status update
  callback?.('pending');
  
  try {
    // Wait for transaction receipt
    let receipt = await provider.getTransactionReceipt(txHash);
    
    // If receipt is null, transaction is pending
    while (!receipt) {
      // Wait for 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if transaction is mined
      receipt = await provider.getTransactionReceipt(txHash);
      
      // Still pending
      callback?.('pending');
    }
    
    // At this point, receipt is guaranteed to be non-null
    
    // Get confirmations
    const currentConfirmations = await receipt.confirmations();
    
    if (currentConfirmations >= confirmations) {
      // Transaction is already confirmed
      callback?.('confirmed', receipt);
      return receipt; // This is safe now because receipt is non-null
    } else {
      // Wait for confirmations
      callback?.('confirming', receipt);
      
      // Wait for specified confirmations
      // Handle the potential null return explicitly
      const finalReceipt = await provider.waitForTransaction(txHash, confirmations);
      
      // If somehow finalReceipt is null, throw an error instead of returning null
      if (!finalReceipt) {
        throw new Error('Transaction disappeared from the blockchain after waiting for confirmations');
      }
      
      // Transaction is confirmed
      callback?.('confirmed', finalReceipt);
      
      // Return the non-null finalReceipt
      return finalReceipt;
    }
  } catch (err) {
    // Transaction failed
    callback?.('failed');
    throw err;
  }
};