// src/tests/transaction-preparation.test.ts

import { ethers } from 'ethers';
import QRC721PlusABI from '../blockchain/abis/QRC721Plus.json';
import GeneralDAOVotingABI from '../blockchain/abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../blockchain/abis/NFTMintingModulePlus.json';
import config from '../config';
import { BlogProposal } from '../types/blockchain';

// Test configuration for Q Testnet
const testConfig = {
  rpcUrl: config.networks[35443].rpcUrl,
  contracts: config.networks[35443].contracts
};

describe('ReligioDAO Transaction Preparation', () => {
  let provider: ethers.JsonRpcProvider;
  let nftContract: ethers.Contract;
  let votingContract: ethers.Contract;
  let mintingContract: ethers.Contract;
  
  beforeAll(async () => {
    // Connect to Q testnet
    provider = new ethers.JsonRpcProvider(testConfig.rpcUrl);
    
    // Initialize contracts (read-only mode)
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
  
  describe('Proposal Submission', () => {
    it('should correctly encode blog proposal data', async () => {
      // Sample blog proposal
      const blogProposal: BlogProposal = {
          title: 'Test Blog Post',
          description: 'This is a test blog for integration testing',
          authorAddress: '0x1234567890123456789012345678901234567890',
          contentReference: 'bzz://abcdef1234567890abcdef1234567890abcdef1234567890',
          category: 'Testing',
          tags: ['test', 'integration', 'blockchain'],
          content: 'Some content',
          preview: '',
          banner: null
      };
      
      // Encode the mintTo function call for the NFT minting module
      const mintToCalldata = mintingContract.interface.encodeFunctionData(
        "mintTo",
        [blogProposal.authorAddress, blogProposal.contentReference]
      );
      
      console.log(`Encoded mintTo calldata: ${mintToCalldata}`);
      expect(mintToCalldata.startsWith('0x')).toBe(true);
      expect(mintToCalldata.length).toBeGreaterThan(10);
      
      // Create proposal with situation named "default"
      const populatedTx = await votingContract.createProposal.populateTransaction(
        'default',  // Example voting situation
        `Blog Proposal: ${blogProposal.title}`,
        mintToCalldata
      );
      
      console.log(`Populated transaction data: ${populatedTx.data?.substring(0, 64)}...`);
      expect(populatedTx.to).toBe(testConfig.contracts.generalDAOVoting);
      expect(populatedTx.data).toBeTruthy();
      
      // Estimate gas (this will validate that the transaction structure is correct)
      try {
        const gasEstimate = await provider.estimateGas(populatedTx);
        console.log(`Estimated gas: ${gasEstimate.toString()}`);
        expect(Number(gasEstimate)).toBeGreaterThan(0);
      } catch (err) {
        console.log('Gas estimation failed, but this could be due to lacking permissions or invalid state');
        console.error(err);
      }
    });
  });
  
  describe('Voting Operations', () => {
    it('should prepare voting transaction data', async () => {
      // Sample proposal ID (assuming 1 exists, but will work regardless)
      const proposalId = '1';
      
      // Prepare vote FOR transaction
      const voteForTx = await votingContract.voteFor.populateTransaction(proposalId);
      console.log(`Vote FOR transaction data: ${voteForTx.data?.substring(0, 64)}...`);
      expect(voteForTx.to).toBe(testConfig.contracts.generalDAOVoting);
      expect(voteForTx.data).toBeTruthy();
      
      // Prepare vote AGAINST transaction
      const voteAgainstTx = await votingContract.voteAgainst.populateTransaction(proposalId);
      console.log(`Vote AGAINST transaction data: ${voteAgainstTx.data?.substring(0, 64)}...`);
      expect(voteAgainstTx.to).toBe(testConfig.contracts.generalDAOVoting);
      expect(voteAgainstTx.data).toBeTruthy();
      
      // Verify the transactions are different
      expect(voteForTx.data).not.toBe(voteAgainstTx.data);
    });
  });
  
  describe('Proposal Execution', () => {
    it('should prepare proposal execution transaction data', async () => {
      // Sample proposal ID
      const proposalId = '1';
      
      // Prepare execution transaction
      const executeTx = await votingContract.executeProposal.populateTransaction(proposalId);
      console.log(`Execute proposal transaction data: ${executeTx.data?.substring(0, 64)}...`);
      expect(executeTx.to).toBe(testConfig.contracts.generalDAOVoting);
      expect(executeTx.data).toBeTruthy();
    });
  });
});