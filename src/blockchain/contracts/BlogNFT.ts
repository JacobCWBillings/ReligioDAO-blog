// src/blockchain/contracts/BlogNFT.ts
import { ethers } from 'ethers';
import QRC721PlusABI from '../abis/QRC721Plus.json';
import { getContractAddresses } from '../../config';
import { BlogNFT } from '../../types/blockchain';
import { parseMetadataFromURI } from '../utils/metadata';
import { toNumber } from '../utils/blockchainUtils';

/**
 * Class representing the BlogNFT contract interface
 * Wrapper around QRC721Plus contract for direct interaction
 */
export class BlogNFTContract {
  private contract: ethers.Contract;
  
  /**
   * Creates an instance of BlogNFTContract
   * @param provider Ethers provider
   * @param signerOrProvider Signer for write operations, or provider for read-only
   * @param chainId Optional chain ID, defaults to provider's network
   */
  constructor(
    private provider: ethers.Provider,
    signerOrProvider: ethers.Signer | ethers.Provider,
    private chainId?: number
  ) {
    const addresses = getContractAddresses(chainId);
    this.contract = new ethers.Contract(
      addresses.blogNFT,
      QRC721PlusABI.abi,
      signerOrProvider
    );
  }
  
  /**
   * Gets contract address
   * @returns Contract address
   */
  public getAddress(): string {
    return this.contract.target as string;
  }
  
  /**
   * Gets NFT name
   * @returns Promise resolving to NFT name
   */
  public async getName(): Promise<string> {
    return await this.contract.name();
  }
  
  /**
   * Gets NFT symbol
   * @returns Promise resolving to NFT symbol
   */
  public async getSymbol(): Promise<string> {
    return await this.contract.symbol();
  }
  
  /**
   * Gets total supply of NFTs
   * @returns Promise resolving to total supply
   */
  public async getTotalSupply(): Promise<number> {
    const totalSupply = await this.contract.totalSupply();
    return toNumber(totalSupply);
  }
  
  /**
   * Gets token URI for a specific token ID
   * @param tokenId Token ID
   * @returns Promise resolving to token URI
   */
  public async getTokenURI(tokenId: string): Promise<string> {
    return await this.contract.tokenURI(tokenId);
  }
  
  /**
   * Gets owner of a specific token
   * @param tokenId Token ID
   * @returns Promise resolving to owner address
   */
  public async getOwner(tokenId: string): Promise<string> {
    return await this.contract.ownerOf(tokenId);
  }
  
  /**
   * Gets token ID at a specific index
   * @param index Index position
   * @returns Promise resolving to token ID
   */
  public async getTokenAtIndex(index: number): Promise<string> {
    const tokenId = await this.contract.tokenByIndex(index);
    return tokenId.toString();
  }
  
  /**
   * Gets token ID owned by an address at a specific index
   * @param owner Owner address
   * @param index Index position
   * @returns Promise resolving to token ID
   */
  public async getTokenOfOwnerAtIndex(owner: string, index: number): Promise<string> {
    const tokenId = await this.contract.tokenOfOwnerByIndex(owner, index);
    return tokenId.toString();
  }
  
  /**
   * Gets number of tokens owned by an address
   * @param owner Owner address
   * @returns Promise resolving to balance
   */
  public async getBalanceOf(owner: string): Promise<number> {
    const balance = await this.contract.balanceOf(owner);
    return toNumber(balance);
  }
  
  /**
   * Mints a new token to a recipient with metadata
   * Note: This is typically done through governance, not directly
   * 
   * @param recipient Recipient address
   * @param tokenId Token ID to mint (or empty string to auto-assign)
   * @param tokenURI Token URI with metadata
   * @returns Promise resolving to transaction
   */
  public async mintToken(
    recipient: string,
    tokenId: string,
    tokenURI: string
  ): Promise<ethers.ContractTransaction> {
    return await this.contract.mintTo(recipient, tokenId, tokenURI);
  }
  
  /**
   * Gets full NFT data for a specific token
   * @param tokenId Token ID
   * @returns Promise resolving to BlogNFT object
   */
  public async getNFTData(tokenId: string): Promise<BlogNFT | null> {
    try {
      const [owner, tokenURI] = await Promise.all([
        this.getOwner(tokenId),
        this.getTokenURI(tokenId)
      ]);
      
      const metadata = await parseMetadataFromURI(tokenURI);
      
      return {
        tokenId,
        owner,
        metadata,
        contentReference: metadata.properties.contentReference,
        proposalId: metadata.properties.proposalId || "",
        createdAt: new Date(metadata.properties.approvalDate).getTime()
      };
    } catch (err) {
      console.error(`Error getting NFT data for token ${tokenId}:`, err);
      return null;
    }
  }
  
  /**
   * Gets all minted NFTs
   * @returns Promise resolving to array of BlogNFT objects
   */
  public async getAllNFTs(): Promise<BlogNFT[]> {
    try {
      const totalSupply = await this.getTotalSupply();
      
      const promises: Promise<BlogNFT | null>[] = [];
      for (let i = 0; i < totalSupply; i++) {
        const tokenId = await this.getTokenAtIndex(i);
        promises.push(this.getNFTData(tokenId));
      }
      
      const results = await Promise.all(promises);
      
      // Filter out null values
      return results.filter((nft): nft is BlogNFT => nft !== null);
    } catch (err) {
      console.error('Error getting all NFTs:', err);
      return [];
    }
  }
  
  /**
   * Gets all NFTs owned by a specific address
   * @param owner Owner address
   * @returns Promise resolving to array of BlogNFT objects
   */
  public async getNFTsByOwner(owner: string): Promise<BlogNFT[]> {
    try {
      const balance = await this.getBalanceOf(owner);
      
      const promises: Promise<BlogNFT | null>[] = [];
      for (let i = 0; i < balance; i++) {
        const tokenId = await this.getTokenOfOwnerAtIndex(owner, i);
        promises.push(this.getNFTData(tokenId));
      }
      
      const results = await Promise.all(promises);
      
      // Filter out null values
      return results.filter((nft): nft is BlogNFT => nft !== null);
    } catch (err) {
      console.error(`Error getting NFTs for owner ${owner}:`, err);
      return [];
    }
  }
}

export default BlogNFTContract;