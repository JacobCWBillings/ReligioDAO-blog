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
      qGov: string;
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
    defaultNetworkId: 1, // Ethereum Mainnet, change as needed
    
    networks: {
      // Ethereum Mainnet
      1: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY', // Replace with your Infura key
        blockExplorer: 'https://etherscan.io',
        contracts: {
          blogNFT: '0x0000000000000000000000000000000000000000', // Replace with actual contract address
          qGov: '0x0000000000000000000000000000000000000000', // Replace with actual contract address
        },
      },
      
      // Goerli Testnet
      5: {
        chainId: 5,
        name: 'Goerli Testnet',
        rpcUrl: 'https://goerli.infura.io/v3/YOUR_INFURA_KEY', // Replace with your Infura key
        blockExplorer: 'https://goerli.etherscan.io',
        contracts: {
          blogNFT: '0x0000000000000000000000000000000000000000', // Replace with actual contract address
          qGov: '0x0000000000000000000000000000000000000000', // Replace with actual contract address
        },
      },
      
      // Local development (hardhat)
      31337: {
        chainId: 31337,
        name: 'Localhost',
        rpcUrl: 'http://localhost:8545',
        blockExplorer: '',
        contracts: {
          blogNFT: '0x0000000000000000000000000000000000000000', // Replace with local deployment
          qGov: '0x0000000000000000000000000000000000000000', // Replace with local deployment
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