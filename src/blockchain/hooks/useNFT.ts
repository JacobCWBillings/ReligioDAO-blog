import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { BlogNFT, BlogNFTMetadata, BlockchainErrorType, BlockchainError, TransactionStatus } from '../../types/blockchain';
import config, { getContractAddresses } from '../../config';

// Define actual ABI or import from JSON file
// Just creating a placeholder if BlogNFT.json doesn't exist yet
const BlogNFTAbi = [
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getTokensOfOwner(address owner) view returns (uint256[])",
  "function mintBlogNFT(address to, string memory proposalId, string memory contentReference, string memory tokenURI) external returns (uint256)"
];

/**
 * Hook for interacting with the BlogNFT contract
 */
export const useNFT = () => {
  const { provider, signer, account, chainId, isConnected } = useWallet();
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [nfts, setNfts] = useState<BlogNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BlockchainError | null>(null);

  // Initialize contract when provider and signer are available
  useEffect(() => {
    if (!provider || !signer || !isConnected) return;

    try {
      // Fix: Convert chainId which could be null to undefined
      const addresses = getContractAddresses(chainId ?? undefined);
      
      // Fix: Use actual ABI instead of empty object
      const nftContract = new ethers.Contract(
        addresses.blogNFT,
        BlogNFTAbi,
        signer
      );
      
      setContract(nftContract);
      setError(null);
    } catch (err) {
      console.error('Error initializing NFT contract:', err);
      setError(new BlockchainError(
        'Failed to initialize NFT contract',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      ));
    }
  }, [provider, signer, chainId, isConnected]);

  // Get data for a specific token
  const getTokenData = useCallback(async (tokenId: number): Promise<BlogNFT | null> => {
    if (!contract) return null;

    try {
      // Get token owner
      const owner = await contract.ownerOf(tokenId);
      
      // Get token URI
      const tokenUri = await contract.tokenURI(tokenId);
      
      // Fetch metadata from URI
      let metadata: BlogNFTMetadata;
      
      if (tokenUri.startsWith('ipfs://')) {
        // Handle IPFS URI
        const ipfsHash = tokenUri.replace('ipfs://', '');
        const response = await fetch(`${config.ipfsGateway}${ipfsHash}`);
        metadata = await response.json();
      } else if (tokenUri.startsWith('data:application/json;base64,')) {
        // Handle base64 encoded JSON
        const base64Data = tokenUri.replace('data:application/json;base64,', '');
        const jsonString = atob(base64Data);
        metadata = JSON.parse(jsonString);
      } else {
        // Handle HTTP URI
        const response = await fetch(tokenUri);
        metadata = await response.json();
      }
      
      return {
        tokenId: tokenId.toString(),
        owner,
        metadata,
        contentReference: metadata.properties.contentReference,
        proposalId: metadata.properties.proposalId,
        createdAt: new Date(metadata.properties.approvalDate).getTime()
      };
    } catch (err) {
      console.error(`Error fetching token ${tokenId} data:`, err);
      return null;
    }
  }, [contract]);

  // Get all minted NFTs
  const getAllNFTs = useCallback(async (): Promise<BlogNFT[]> => {
    if (!contract) {
      throw new BlockchainError(
        'Contract not initialized',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Get total supply of tokens
      const totalSupply = await contract.totalSupply();
      const tokenCount = totalSupply.toNumber();
      
      // Create array of promises for parallel execution
      const tokenPromises = Array.from({ length: tokenCount }, (_, i) => getTokenData(i));
      
      // Wait for all promises to resolve at once
      const allResults = await Promise.all(tokenPromises);
      
      // Filter out null values with type predicate
      const nftResults = allResults.filter((nft): nft is BlogNFT => nft !== null);
      
      setNfts(nftResults);
      return nftResults;
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      const blockchainError = new BlockchainError(
        'Failed to fetch NFTs',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [contract, getTokenData]);

  // Get NFTs owned by the current account
  const getMyNFTs = useCallback(async (): Promise<BlogNFT[]> => {
    if (!contract || !account) {
      throw new BlockchainError(
        'Contract not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Get token IDs owned by the current account
      const tokenIds = await contract.getTokensOfOwner(account);
      
      // Create array of promises for parallel execution
      const tokenPromises = tokenIds.map(id => getTokenData(Number(id)));
      
      // Wait for all promises to resolve at once
      const allResults = await Promise.all(tokenPromises);
      
      // Filter out null values with type predicate
      const myNfts = allResults.filter((nft): nft is BlogNFT => nft !== null);
      
      return myNfts;
    } catch (err) {
      console.error('Error fetching owned NFTs:', err);
      const blockchainError = new BlockchainError(
        'Failed to fetch your NFTs',
        BlockchainErrorType.ContractError,
        err instanceof Error ? err : new Error(String(err))
      );
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [contract, account, getTokenData]);

  // Mint a new NFT
  const mintNFT = useCallback(async (
    proposalId: string,
    contentReference: string,
    metadata: BlogNFTMetadata
  ): Promise<TransactionStatus> => {
    if (!contract || !signer) {
      throw new BlockchainError(
        'Contract not initialized or wallet not connected',
        BlockchainErrorType.ContractError
      );
    }

    setLoading(true);
    setError(null);

    try {
      // Convert metadata to JSON and encode as base64
      const metadataString = JSON.stringify(metadata);
      const metadataBase64 = btoa(metadataString);
      const tokenUri = `data:application/json;base64,${metadataBase64}`;
      
      // Call the mint function on the contract
      const tx = await contract.mintBlogNFT(
        account,
        proposalId,
        contentReference,
        tokenUri
      );
      
      // Initial transaction status
      const status: TransactionStatus = {
        hash: tx.hash,
        status: 'pending',
        confirmations: 0
      };
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Update status with confirmation details
      status.status = receipt.status === 1 ? 'confirmed' : 'failed';
      status.confirmations = 1;
      status.receipt = receipt;
      
      // If successful, update NFTs list
      if (status.status === 'confirmed') {
        await getAllNFTs();
      }
      
      return status;
    } catch (err) {
      console.error('Error minting NFT:', err);
      
      // Determine error type
      let errorType = BlockchainErrorType.Unknown;
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          errorType = BlockchainErrorType.UserRejected;
        } else if (errorMessage.includes('insufficient funds')) {
          errorType = BlockchainErrorType.InsufficientFunds;
        }
      }
      
      const blockchainError = new BlockchainError(
        'Failed to mint NFT',
        errorType,
        err instanceof Error ? err : new Error(String(err))
      );
      
      setError(blockchainError);
      throw blockchainError;
    } finally {
      setLoading(false);
    }
  }, [contract, signer, account, getAllNFTs]);

  return {
    nfts,
    loading,
    error,
    getAllNFTs,
    getMyNFTs,
    getTokenData,
    mintNFT
  };
};

export default useNFT;