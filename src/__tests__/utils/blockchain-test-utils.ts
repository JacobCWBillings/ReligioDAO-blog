// src/tests/utils/blockchain-test-utils.ts

import { ethers } from 'ethers';
import QRC721PlusABI from '../../blockchain/abis/QRC721Plus.json';
import GeneralDAOVotingABI from '../../blockchain/abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../../blockchain/abis/NFTMintingModulePlus.json';
import config from '../../config';
import { BlogNFT, BlogNFTMetadata, Proposal } from '../../types/blockchain';

/**
 * Creates blockchain test environment with contracts
 * @param chainId Chain ID to connect to (defaults to testnet)
 * @returns Test environment with provider and contracts
 */
export async function createTestEnvironment(chainId: number = 35443) {
  // Use chain ID to get network config
  const networkConfig = config.networks[chainId];
  if (!networkConfig) {
    throw new Error(`No network configuration found for chain ID ${chainId}`);
  }

  console.log(`Setting up test environment for ${networkConfig.name}...`);
  
  // Connect to specified network
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  
  // Initialize contract instances
  const nftContract = new ethers.Contract(
    networkConfig.contracts.blogNFT, 
    QRC721PlusABI.abi, 
    provider
  );
  
  const votingContract = new ethers.Contract(
    networkConfig.contracts.generalDAOVoting,
    GeneralDAOVotingABI.abi,
    provider
  );
  
  const mintingContract = new ethers.Contract(
    networkConfig.contracts.nftMintingModule,
    NFTMintingModulePlusABI.abi,
    provider
  );

  // Verify connection
  const network = await provider.getNetwork();
  console.log(`Connected to ${network.name} (Chain ID: ${network.chainId.toString()})`);
  
  return {
    provider,
    nftContract,
    votingContract,
    mintingContract,
    networkConfig
  };
}

/**
 * Fetches NFT data by token ID
 */
export async function fetchNFTData(
  nftContract: ethers.Contract, 
  tokenId: string
): Promise<BlogNFT | null> {
  try {
    // Check if token exists by getting owner
    const owner = await nftContract.ownerOf(tokenId);
    
    // Get token URI
    const tokenURI = await nftContract.tokenURI(tokenId);
    
    // Parse metadata
    const metadata = await parseMetadata(tokenURI);
    
    return {
      tokenId,
      owner,
      metadata,
      contentReference: metadata.properties.contentReference,
      proposalId: metadata.properties.proposalId,
      createdAt: new Date(metadata.properties.approvalDate).getTime()
    };
  } catch (err) {
    console.error(`Error fetching NFT data for token ${tokenId}:`, err);
    return null;
  }
}

/**
 * Fetches all minted NFTs
 */
export async function fetchAllNFTs(
  nftContract: ethers.Contract
): Promise<BlogNFT[]> {
  try {
    // Get total supply
    const totalSupply = await nftContract.totalSupply();
    console.log(`Total supply: ${totalSupply.toString()}`);
    
    // Create array of promises
    const promises: Promise<BlogNFT | null>[] = [];
    
    for (let i = 0; i < totalSupply.toNumber(); i++) {
      const tokenId = await nftContract.tokenByIndex(i);
      promises.push(fetchNFTData(nftContract, tokenId.toString()));
    }
    
    // Resolve all promises
    const results = await Promise.all(promises);
    
    // Filter out null values
    return results.filter((nft): nft is BlogNFT => nft !== null);
  } catch (err) {
    console.error('Error fetching all NFTs:', err);
    return [];
  }
}

/**
 * Fetches proposal by ID
 */
export async function fetchProposal(
  votingContract: ethers.Contract,
  proposalId: string
): Promise<Proposal | null> {
  try {
    const proposal = await votingContract.getProposal(proposalId);
    const status = await votingContract.getProposalStatus(proposalId);
    const [votesFor, votesAgainst] = [
      proposal.counters.votedFor,
      proposal.counters.votedAgainst
    ];
    
    return {
      id: proposal.id.toString(),
      title: proposal.remark,
      description: proposal.remark,
      proposer: "unknown", // This may not be directly accessible
      status,
      createdAt: Number(proposal.params.votingStartTime) * 1000,
      votingEnds: Number(proposal.params.votingEndTime) * 1000,
      votesFor: Number(votesFor),
      votesAgainst: Number(votesAgainst),
      executed: proposal.executed,
      contentReference: extractContentReference(proposal.callData)
    };
  } catch (err) {
    console.error(`Error fetching proposal ${proposalId}:`, err);
    return null;
  }
}

/**
 * Fetches all proposals
 */
export async function fetchAllProposals(
  votingContract: ethers.Contract
): Promise<Proposal[]> {
  try {
    const proposalCount = await votingContract.proposalCount();
    console.log(`Proposal count: ${proposalCount.toString()}`);
    
    const promises: Promise<Proposal | null>[] = [];
    
    // Proposals typically start from ID 1
    for (let i = 1; i <= proposalCount.toNumber(); i++) {
      promises.push(fetchProposal(votingContract, i.toString()));
    }
    
    const results = await Promise.all(promises);
    
    // Filter out null values
    return results.filter((proposal): proposal is Proposal => proposal !== null);
  } catch (err) {
    console.error('Error fetching all proposals:', err);
    return [];
  }
}

/**
 * Parse metadata from token URI
 */
export async function parseMetadata(tokenURI: string): Promise<BlogNFTMetadata> {
  try {
    // Handle different URI formats
    if (tokenURI.startsWith('data:application/json;base64,')) {
      // Base64 encoded JSON
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const jsonString = atob(base64Data);
      return JSON.parse(jsonString);
    } else if (tokenURI.startsWith('ipfs://')) {
      // IPFS URI
      const ipfsGateway = 'https://ipfs.io/ipfs/';
      const ipfsHash = tokenURI.replace('ipfs://', '');
      const response = await fetch(`${ipfsGateway}${ipfsHash}`);
      return await response.json();
    } else if (tokenURI.startsWith('http')) {
      // HTTP URI
      const response = await fetch(tokenURI);
      return await response.json();
    } else if (tokenURI.startsWith('bzz://')) {
      // Swarm URI
      const swarmGateway = config.swarm.gateway;
      const swarmRef = tokenURI.replace('bzz://', '');
      const response = await fetch(`${swarmGateway}/bzz/${swarmRef}`);
      return await response.json();
    } else {
      // Try to parse as direct JSON
      try {
        return JSON.parse(tokenURI);
      } catch {
        throw new Error(`Unsupported token URI format: ${tokenURI}`);
      }
    }
  } catch (err) {
    console.error(`Error parsing metadata from ${tokenURI}:`, err);
    // Return minimal valid metadata
    return {
      name: "Error fetching metadata",
      description: "Failed to load blog metadata",
      image: "",
      attributes: [],
      properties: {
        contentReference: "",
        proposalId: "",
        approvalDate: new Date().toISOString(),
        category: "",
        tags: [],
        authorAddress: ""
      }
    };
  }
}

/**
 * Extract content reference from calldata
 */
// Fix in src/__tests__/utils/blockchain-test-utils.ts
export function extractContentReference(callData: string): string {
  try {
    if (!callData || !callData.startsWith('0x')) return '';
    
    // Remove function selector
    const dataWithoutSelector = callData.slice(10);
    
    // In mintTo(address, string), the string comes after the address
    const stringDataStart = 128; // Skip offset to string (64 chars) + address param (64 chars)
    
    if (dataWithoutSelector.length < stringDataStart + 64) return '';
    
    // Get string length from first 32 bytes
    const lengthHex = dataWithoutSelector.slice(stringDataStart, stringDataStart + 64);
    const length = parseInt(lengthHex, 16);
    
    // Extract string data
    const stringStart = stringDataStart + 64;
    const stringEnd = stringStart + (Math.ceil(length / 32) * 64);
    
    if (dataWithoutSelector.length < stringEnd) return '';
    
    const contentHex = dataWithoutSelector.slice(stringStart, stringEnd);
    
    // Convert hex to UTF-8 string
    let result = '';
    for (let i = 0; i < contentHex.length; i += 2) {
      if (i + 2 <= 2 * length) {
        const hexChar = contentHex.substring(i, i + 2);
        const char = String.fromCharCode(parseInt(hexChar, 16));
        if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) {
          result += char;
        }
      }
    }
    
    // Look for Swarm reference - FIXED to include dashes
    const bzzMatch = result.match(/bzz:\/\/[a-zA-Z0-9\-_]+/);
    if (bzzMatch) {
      return bzzMatch[0];
    }
    
    return result;
  } catch (err) {
    console.error('Error extracting content reference:', err);
    return '';
  }
}