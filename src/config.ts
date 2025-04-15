// src/config.ts
/**
 * ReligioDAO Configuration
 * 
 * This file contains environment-specific configuration values.
 * For production deployment, consider using environment variables.
 */

interface NetworkConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorer: string;
    contracts: {
      blogNFT: string;
      generalDAOVoting: string;
      nftMintingModule: string;
    };
  }
  
  interface SwarmConfig {
    gateway: string;
    defaultPostageBatchTTL: number; // Time to live in seconds
    defaultDepth: number;
  }
  
  interface AppConfig {
    name: string;
    defaultNetworkId: number;
    networks: Record<number, NetworkConfig>;
    swarm: SwarmConfig;
    ipfsGateway: string;
    placeholderImage: string;
  }
  
  // Main configuration object
  const config: AppConfig = {
    name: 'ReligioDAO',
    defaultNetworkId: 100, // xDai Chain (Gnosis Chain)
    
    networks: {
      // Gnosis Chain (formerly xDai)
      100: {
        chainId: 100,
        name: 'Gnosis Chain',
        rpcUrl: 'https://rpc.gnosischain.com',
        blockExplorer: 'https://gnosisscan.io',
        contracts: {
          // Replace these with your actual deployed contract addresses
          blogNFT: '0x0000000000000000000000000000000000000000', // QRC721Plus contract address
          generalDAOVoting: '0x0905589827e3860f22ab6d689572dd5ada90f642', // GeneralDAOVoting contract address
          nftMintingModule: '0x0000000000000000000000000000000000000000', // NFTMintingModulePlus contract address
        },
      },
      
      // Ethereum Mainnet
      1: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY', // Replace with your Infura key
        blockExplorer: 'https://etherscan.io',
        contracts: {
          blogNFT: '0x0000000000000000000000000000000000000000',
          generalDAOVoting: '0x0000000000000000000000000000000000000000',
          nftMintingModule: '0x0000000000000000000000000000000000000000',
        },
      },
      
      // Local development
      31337: {
        chainId: 31337,
        name: 'Localhost',
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