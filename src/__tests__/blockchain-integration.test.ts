// src/__tests__/blockchain-integration.test.ts

import { ethers } from 'ethers';
import QRC721PlusABI from '../blockchain/abis/QRC721Plus.json';
import GeneralDAOVotingABI from '../blockchain/abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../blockchain/abis/NFTMintingModulePlus.json';
import config from '../config';

// Test configuration for Q Testnet
const testConfig = {
  rpcUrl: config.networks[35443].rpcUrl,
  contracts: config.networks[35443].contracts
};

describe('ReligioDAO Blockchain Integration', () => {
  let provider: ethers.JsonRpcProvider;
  let nftContract: ethers.Contract;
  let votingContract: ethers.Contract;
  let mintingContract: ethers.Contract;
  
  beforeAll(async () => {
    // Connect to Q testnet
    console.log(`Connecting to ${testConfig.rpcUrl}...`);
    provider = new ethers.JsonRpcProvider(testConfig.rpcUrl);
    
    // Initialize contract instances
    console.log('Initializing contract instances...');
    nftContract = new ethers.Contract(
      testConfig.contracts.blogNFT, 
      QRC721PlusABI.abi, 
      provider
    );
    
    votingContract = new ethers.Contract(
      testConfig.contracts.generalDAOVoting,
      GeneralDAOVotingABI.abi,
      provider
    );
    
    mintingContract = new ethers.Contract(
      testConfig.contracts.nftMintingModule,
      NFTMintingModulePlusABI.abi,
      provider
    );
  });
  
  describe('Network Connection', () => {
    it('should connect to Q Testnet', async () => {
      const network = await provider.getNetwork();
      console.log(`Connected to network: ${network.name} (${network.chainId.toString()})`);
      expect(network.chainId.toString()).toBe('35443');
    });
    
    it('should have a valid block number', async () => {
      const blockNumber = await provider.getBlockNumber();
      console.log(`Current block number: ${blockNumber}`);
      expect(blockNumber).toBeGreaterThan(0);
    });
  });
  
  describe('NFT Contract Read Operations', () => {
    it('should read NFT contract info', async () => {
      try {
        const name = await nftContract.name();
        const symbol = await nftContract.symbol();
        console.log(`NFT contract: ${name} (${symbol})`);
        expect(name).toBeTruthy();
        expect(symbol).toBeTruthy();
      } catch (err) {
        console.error('Error reading NFT contract info:', err);
        throw err;
      }
    });
    
    it('should read NFT total supply', async () => {
      try {
        const totalSupply = await nftContract.totalSupply();
        console.log(`Total NFT supply: ${totalSupply.toString()}`);
        expect(totalSupply).toBeDefined();
      } catch (err) {
        console.error('Error reading total supply:', err);
        throw err;
      }
    });
    
    it('should fetch token metadata if any tokens exist', async () => {
      try {
        const totalSupply = await nftContract.totalSupply();
        if (totalSupply.toString() === '0') {
          console.log('No tokens minted yet, skipping metadata test');
          return;
        }
        
        // Get the first token
        const tokenId = await nftContract.tokenByIndex(0);
        console.log(`Token ID: ${tokenId.toString()}`);
        
        // Get token owner
        const owner = await nftContract.ownerOf(tokenId);
        console.log(`Token owner: ${owner}`);
        
        // Get token URI
        const tokenURI = await nftContract.tokenURI(tokenId);
        console.log(`Token URI: ${tokenURI.substring(0, 64)}...`);
        
        expect(tokenURI).toBeTruthy();
        
        // Try to parse metadata if possible
        if (tokenURI.startsWith('data:application/json;base64,')) {
          const base64Data = tokenURI.replace('data:application/json;base64,', '');
          const jsonString = atob(base64Data);
          const metadata = JSON.parse(jsonString);
          console.log(`Metadata name: ${metadata.name}`);
          console.log(`Content reference: ${metadata.properties?.contentReference}`);
          expect(metadata.name).toBeDefined();
        }
      } catch (err) {
        console.error('Error fetching token metadata:', err);
        throw err;
      }
    });
  });
  
  describe('Voting Contract Read Operations', () => {
    it('should read proposal count', async () => {
      try {
        const proposalCount = await votingContract.proposalCount();
        console.log(`Total proposals: ${proposalCount.toString()}`);
        expect(proposalCount).toBeDefined();
      } catch (err) {
        console.error('Error reading proposal count:', err);
        throw err;
      }
    });
    
    it('should fetch proposal details if any exist', async () => {
      try {
        const proposalCount = await votingContract.proposalCount();
        if (proposalCount.toString() === '0') {
          console.log('No proposals created yet, skipping proposal test');
          return;
        }
        
        // Try to get the first proposal
        const proposal = await votingContract.getProposal(1);
        console.log(`Proposal ID: ${proposal.id.toString()}`);
        console.log(`Proposal target: ${proposal.target}`);
        console.log(`Proposal executed: ${proposal.executed}`);
        
        expect(proposal.id).toBeDefined();
        
        // Get proposal status
        const status = await votingContract.getProposalStatus(1);
        console.log(`Proposal status: ${status}`);
        expect(status).toBeDefined();
        
        // Get proposal voting stats
        const stats = await votingContract.getProposalVotingStats(1);
        console.log(`Required quorum: ${stats.requiredQuorum.toString()}`);
        console.log(`Current quorum: ${stats.currentQuorum.toString()}`);
        console.log(`Required majority: ${stats.requiredMajority.toString()}`);
        expect(stats.requiredQuorum).toBeDefined();
      } catch (err) {
        console.error('Error fetching proposal details:', err);
        throw err;
      }
    });
  });
  
  describe('NFT Minting Module Read Operations', () => {
    it('should verify minting module configuration', async () => {
      try {
        const supportedNFT = await mintingContract.supportedNFT();
        console.log(`Supported NFT address: ${supportedNFT}`);
        expect(supportedNFT).toBeDefined();
        
        // Check if our NFT contract is the one supported by the minting module
        expect(supportedNFT.toLowerCase()).toBe(
          testConfig.contracts.blogNFT.toLowerCase()
        );
      } catch (err) {
        console.error('Error checking minting module:', err);
        throw err;
      }
    });
  });
});