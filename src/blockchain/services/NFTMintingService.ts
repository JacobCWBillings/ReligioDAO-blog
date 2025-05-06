// src/blockchain/services/NFTMintingService.ts
import { ethers } from 'ethers';
import { BaseContractService } from './BaseContractService';
import { 
  BlogNFTMetadata, 
  BlockchainError, 
  BlockchainErrorType, 
  TransactionStatus 
} from '../../types/blockchain';
import { getContractAddresses } from '../../config';
import { createBlogNFTMetadata, metadataToTokenURI } from '../utils/metadata';

import NFTMintingModulePlusABI from '../abis/NFTMintingModulePlus.json';
import QRC721PlusABI from '../abis/QRC721Plus.json';

/**
 * Service for interacting with the NFT minting module
 * Handles metadata creation and NFT minting operations
 */
export class NFTMintingService extends BaseContractService {
  private nftMintingModule: ethers.Contract | null = null;
  private nftContract: ethers.Contract | null = null;

  /**
   * Initialize the NFT minting contracts
   * @param chainId Optional chain ID for network-specific configuration
   */
  public async init(chainId?: number): Promise<void> {
    try {
      const addresses = getContractAddresses(chainId);
      
      // Determine the contract provider (signer preferred for transactions)
      const contractProvider = this.signer || this.provider;
      
      // Initialize minting module contract
      this.nftMintingModule = new ethers.Contract(
        addresses.nftMintingModule,
        NFTMintingModulePlusABI.abi,
        contractProvider
      );
      
      // Initialize NFT contract for reading metadata
      this.nftContract = new ethers.Contract(
        addresses.blogNFT,
        QRC721PlusABI.abi,
        contractProvider
      );
      
      this.isInitialized = true;
    } catch (err) {
      console.error('Error initializing NFT minting contracts:', err);
      throw new BlockchainError(
        'Failed to initialize NFT minting contracts',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Create NFT metadata for a blog
   * @param title Blog title
   * @param description Blog description
   * @param contentReference Swarm content reference
   * @param author Author's address
   * @param category Blog category
   * @param tags Blog tags
   * @param proposalId Optional proposal ID
   * @param previewImage Optional preview image reference
   * @returns BlogNFTMetadata object
   */
  public createBlogMetadata(
    title: string,
    description: string,
    contentReference: string,
    author: string,
    category: string,
    tags: string[] | string,
    proposalId?: string,
    previewImage?: string
  ): BlogNFTMetadata {
    return createBlogNFTMetadata(
      title,
      description,
      contentReference,
      author,
      category,
      tags,
      proposalId,
      previewImage
    );
  }

  /**
   * Create tokenURI from metadata
   * @param metadata BlogNFTMetadata object
   * @param method Storage method ('base64', 'swarm', or 'ipfs')
   * @param reference Optional reference for swarm or ipfs methods
   * @returns TokenURI string
   */
  public createTokenURI(
    metadata: BlogNFTMetadata,
    method: 'base64' | 'swarm' | 'ipfs' = 'base64',
    reference?: string
  ): string {
    return metadataToTokenURI(metadata, method, reference);
  }

  /**
   * Prepare mintTo calldata for the proposal
   * @param recipient Address to receive the NFT
   * @param tokenURI Token URI with metadata
   * @returns Encoded calldata
   */
  public prepareMintToCalldata(recipient: string, tokenURI: string): string {
    this.ensureInitialized();
    
    return this.nftMintingModule!.interface.encodeFunctionData(
      "mintTo",
      [recipient, tokenURI]
    );
  }

  /**
   * Mint NFT directly (without governance)
   * Only works if the minting module allows direct minting
   * @param recipient Address to receive the NFT
   * @param metadata Blog NFT metadata
   * @returns Promise resolving to TransactionStatus with token ID
   */
  public async mintNFT(
    recipient: string,
    metadata: BlogNFTMetadata
  ): Promise<TransactionStatus & { tokenId?: string }> {
    this.ensureInitialized();
    
    try {
      // Convert metadata to URI
      const tokenURI = this.createTokenURI(metadata, 'base64');
      
      // Call mintTo function directly
      const tx = await this.nftMintingModule!.mintTo(recipient, tokenURI);
      
      // Track transaction
      const status = await this.trackTransaction(tx);
      
      // Extract token ID from event
      let tokenId: string | undefined = undefined;
      
      if (status.status === 'confirmed' && status.receipt) {
        // Look for NFTMinted event
        const event = status.receipt.logs
          .map((log: ethers.Log) => {
            try {
              return this.nftMintingModule!.interface.parseLog({
                topics: log.topics as string[],
                data: log.data
              });
            } catch (e) {
              return null;
            }
          })
          .find((evt: ethers.LogDescription | null) => evt?.name === 'NFTMinted');
        
        if (event && event.args && event.args.tokenId) {
          tokenId = event.args.tokenId.toString();
        }
      }
      
      return {
        ...status,
        tokenId
      };
    } catch (err) {
      console.error('Error minting NFT:', err);
      throw new BlockchainError(
        'Failed to mint NFT',
        this.determineErrorType(err),
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Get the NFT contract address
   * @returns NFT contract address
   */
  public getNFTContractAddress(): string | null {
    return this.nftContract?.target.toString() || null;
  }

  /**
   * Get token URI for an NFT
   * @param tokenId Token ID
   * @returns Promise resolving to token URI
   */
  public async getTokenURI(tokenId: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      return await this.nftContract!.tokenURI(tokenId);
    } catch (err) {
      console.error(`Error getting token URI for ${tokenId}:`, err);
      throw new BlockchainError(
        `Failed to get token URI for ${tokenId}`,
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  /**
   * Check if the NFT with given ID exists
   * @param tokenId Token ID to check
   * @returns Promise resolving to boolean indicating if token exists
   */
  public async tokenExists(tokenId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      // Try to get the owner - will throw if token doesn't exist
      await this.nftContract!.ownerOf(tokenId);
      return true;
    } catch (err) {
      return false;
    }
  }
}