// src/config.ts
import { ethers } from 'ethers';
// import QRC721Plus from './blockchain/abis/QRC721Plus.json';
// import GeneralDAOVoting from './blockchain/abis/GeneralDAOVoting.json';
// import NFTMintingModulePlus from './blockchain/abis/NFTMintingModulePlus.json';

// Constants for voting parameters
export const FIVE_PERCENTAGE = '50000000000000000000000000';
export const TWO_PERCENTAGE = '20000000000000000000000000';
export const FIFTY_PERCENTAGE = '500000000000000000000000000';
export const THIRTY_PERCENTAGE = '300000000000000000000000000';

/**
 * Interface for blog platform app configuration
 */
interface AppConfig {
  name: string;
  defaultNetworkId: number;
  networks: Record<number, NetworkConfig>;
  swarm: SwarmConfig;
  ipfsGateway: string;
  placeholderImage: string;
}

/**
 * Interface for network-specific configuration
 */
interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  contracts: {
    blogNFT: string; // QRC721Plus address
    generalDAOVoting: string; // Voting contract
    nftMintingModule: string; // NFTMintingModulePlus address
  };
}

/**
 * Interface for Swarm configuration
 */
interface SwarmConfig {
  gateway: string;
  defaultPostageBatchTTL: number; // Time to live in seconds
  defaultDepth: number;
}

/**
 * Represents Q Network types
 */
export type QNetworkName = 'mainnet' | 'testnet' | 'devnet';

/**
 * Maps chainIds to Q network names
 */
export const chainIdToQNetworkMap: { [key: string]: QNetworkName } = {
  35441: 'mainnet',
  35442: 'devnet',
  35443: 'testnet',
  // 100: 'gnosis', // Adding Gnosis Chain support
  // 31337: 'local',  // Local development
};

/**
 * Main configuration object for the ReligioDAO application
 */
const config: AppConfig = {
  name: 'ReligioDAO',
  defaultNetworkId: 35443, // Q Testnet by default
  
  networks: {
    // Q Testnet
    35443: {
      chainId: 35443,
      name: 'Q Testnet',
      rpcUrl: 'https://rpc.qtestnet.org',
      blockExplorer: 'https://explorer.qtestnet.org',
      contracts: {
        blogNFT: '0x0000000000000000000000000000000000000000', // Replace with actual QRC721Plus contract address
        generalDAOVoting: '0x9b1Ab43e9d948358c93C6B89BEBD84434f112Af5', // Q Testnet voting contract
        nftMintingModule: '0x5d897fF501a9d322ae6c0d37a6b267B7bdaF719f', // NFT minting module on Q Testnet
      },
    },
    
    // Q Mainnet
    35441: {
      chainId: 35441,
      name: 'Q Mainnet',
      rpcUrl: 'https://rpc.q.org',
      blockExplorer: 'https://explorer.q.org',
      contracts: {
        blogNFT: '0x0000000000000000000000000000000000000000', // Replace with actual QRC721Plus contract address
        generalDAOVoting: '0x536061A4A6633d5A1AF99DE29B7cE82439e1e5c0', // Q Mainnet voting contract
        nftMintingModule: '0xc6E9F942fA51921e21eaE4DcF859944719D90A63', // NFT minting module on Q Mainnet
      },
    },
    
    // Q Devnet
    35442: {
      chainId: 35442,
      name: 'Q Devnet',
      rpcUrl: 'https://rpc.qdevnet.org',
      blockExplorer: 'https://explorer.qdevnet.org',
      contracts: {
        blogNFT: '0x0000000000000000000000000000000000000000', // Replace with actual QRC721Plus contract address
        generalDAOVoting: '0x536061A4A6633d5A1AF99DE29B7cE82439e1e5c0', // Q Devnet voting contract
        nftMintingModule: '0xAD92dbbe4709C64EBF9fB0b62720E15A33A2e426', // NFT minting module on Q Devnet
      },
    },
    
    // Gnosis Chain (previously xDai)
    100: {
      chainId: 100,
      name: 'Gnosis Chain',
      rpcUrl: 'https://rpc.gnosischain.com',
      blockExplorer: 'https://gnosisscan.io',
      contracts: {
        blogNFT: '0x0000000000000000000000000000000000000000', // Replace with actual contract on Gnosis
        generalDAOVoting: '0x0905589827e3860f22ab6d689572dd5ada90f642', // From the project spec
        nftMintingModule: '0x0000000000000000000000000000000000000000', // Replace with actual contract
      },
    },
    
    // Local development
    31337: {
      chainId: 31337,
      name: 'Local Dev Chain',
      rpcUrl: 'http://localhost:8545',
      blockExplorer: '',
      contracts: {
        blogNFT: '0x0000000000000000000000000000000000000000', // Replace with local deployment
        generalDAOVoting: '0x0000000000000000000000000000000000000000', // Replace with local deployment
        nftMintingModule: '0x0000000000000000000000000000000000000000', // Replace with local deployment
      },
    },
  },
  
  // Swarm configuration
  swarm: {
    gateway: 'http://localhost:1633', // Local Bee node
    defaultPostageBatchTTL: 31536000, // 1 year in seconds
    defaultDepth: 20,
  },
  
  // IPFS gateway for fallback
  ipfsGateway: 'https://ipfs.io/ipfs/',
  
  // Default placeholder image
  placeholderImage: '/etherjot/default.png',
};

export default config;

/**
 * Default voting parameters for Q networks
 */
export const qVotingParams = {
  testnet: {
    votingPeriod: 5 * 60, // 5 minutes
    appealPeriod: 24 * 60 * 60, // 1 day
    vetoPeriod: 5 * 60, // 5 minutes
    proposalExecutionPeriod: 14 * 24 * 60 * 60, // 2 weeks
    requiredQuorum: FIVE_PERCENTAGE,
    requiredMajority: FIFTY_PERCENTAGE,
    requiredVetoQuorum: FIFTY_PERCENTAGE,
    votingType: 0,
    votingMinAmount: '1',
  },
  mainnet: {
    votingPeriod: 3 * 24 * 60 * 60, // 3 days
    appealPeriod: 24 * 60 * 60, // 1 day
    vetoPeriod: 24 * 60 * 60, // 1 day
    proposalExecutionPeriod: 21 * 24 * 60 * 60, // 3 weeks
    requiredQuorum: TWO_PERCENTAGE,
    requiredMajority: FIFTY_PERCENTAGE,
    requiredVetoQuorum: THIRTY_PERCENTAGE,
    votingType: 0,
    votingMinAmount: '1',
  },
  devnet: {
    votingPeriod: 5 * 60, // 5 minutes
    appealPeriod: 24 * 60 * 60, // 1 day
    vetoPeriod: 5 * 60, // 5 minutes
    proposalExecutionPeriod: 14 * 24 * 60 * 60, // 2 weeks
    requiredQuorum: FIVE_PERCENTAGE,
    requiredMajority: FIFTY_PERCENTAGE,
    requiredVetoQuorum: FIFTY_PERCENTAGE,
    votingType: 0,
    votingMinAmount: '1',
  }
};

// Simple wallet connection parameters without external dependencies
export const walletConnectionInfo = Object.values(config.networks)
  .reduce((acc, network) => {
    acc[network.chainId] = {
      chainId: ethers.toBeHex(network.chainId),
      name: network.name,
      rpcUrl: network.rpcUrl,
      explorerUrl: network.blockExplorer,
      nativeCurrency: {
        name: network.chainId >= 35441 && network.chainId <= 35443 ? 'Q' : 'ETH',
        symbol: network.chainId >= 35441 && network.chainId <= 35443 ? 'Q' : 'ETH',
        decimals: 18,
      }
    };
    return acc;
  }, {} as Record<number, any>);

// Helper function to get current network configuration
export const getCurrentNetworkConfig = (chainId?: number): NetworkConfig => {
  // Use provided chainId, default network id, or fallback to localhost
  const id = chainId || config.defaultNetworkId || 31337;
  return config.networks[id] || config.networks[31337];
};

// Helper function to get contract addresses for current network
export const getContractAddresses = (chainId?: number) => {
  const network = getCurrentNetworkConfig(chainId);
  return network.contracts;
};

// Helper function to get Swarm gateway URL
export const getSwarmGateway = (): string => {
  return config.swarm.gateway;
};

// Helper to generate a Swarm URL
export const getSwarmUrl = (reference: string): string => {
  return `${config.swarm.gateway}/bzz/${reference}/`;
};

// Helper to generate a content reference URL
export const getContentUrl = (reference: string, gateway?: string): string => {
  return `${gateway || config.swarm.gateway}/bytes/${reference}`;
};