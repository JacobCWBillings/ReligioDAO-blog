import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Bee } from '@ethersphere/bee-js';
import { useWallet } from '../contexts/WalletContext';
import { useChainConstraint } from '../blockchain/hooks/useChainConstraint';
import { getContractAddresses, getCurrentNetworkConfig } from '../config';
import QRC721PlusABI from '../blockchain/abis/QRC721Plus.json';
import GeneralDAOVotingABI from '../blockchain/abis/GeneralDAOVoting.json';
import NFTMintingModulePlusABI from '../blockchain/abis/NFTMintingModulePlus.json';
import './SystemDiagnostic.css';

// Define types for our diagnostic checks
interface DiagnosticCheck {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
  solution?: string;
}

// Initial state for all diagnostic checks
const initialChecks: DiagnosticCheck[] = [
  {
    name: 'Wallet Connection',
    status: 'pending',
    message: 'Checking wallet connection...'
  },
  {
    name: 'Network Connection',
    status: 'pending',
    message: 'Checking network connection...'
  },
  {
    name: 'NFT Contract',
    status: 'pending',
    message: 'Checking NFT contract...'
  },
  {
    name: 'DAO Voting Contract',
    status: 'pending',
    message: 'Checking DAO voting contract...'
  },
  {
    name: 'NFT Minting Module',
    status: 'pending',
    message: 'Checking NFT minting module...'
  },
  {
    name: 'Swarm Connection',
    status: 'pending',
    message: 'Checking Swarm connection...'
  },
  {
    name: 'Postage Stamp',
    status: 'pending',
    message: 'Checking Swarm postage stamp...'
  }
];

const SystemDiagnostic: React.FC = () => {
  const [checks, setChecks] = useState<DiagnosticCheck[]>(initialChecks);
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<'pending' | 'success' | 'error' | 'warning'>('pending');
  
  // Get wallet context, including read-only provider and signer
  const { 
    account, 
    isConnected, 
    provider, 
    readOnlyProvider,
    signer,
    readOnlySigner,
    chainId,
    balance
  } = useWallet();
  
  // Get chain constraint context
  const { 
    isCorrectChain, 
    appChainId, 
    chainError 
  } = useChainConstraint();

  // Set up active provider and signer for checks
  const activeProvider = provider || readOnlyProvider;
  const activeSigner = signer || readOnlySigner;

  // Update a specific check by name
  const updateCheck = useCallback((
    name: string, 
    status: DiagnosticCheck['status'], 
    message: string,
    details?: string,
    solution?: string
  ) => {
    setChecks(prevChecks => 
      prevChecks.map(check => 
        check.name === name 
          ? { ...check, status, message, details, solution }
          : check
      )
    );
  }, []);

  // Calculate overall status
  useEffect(() => {
    if (checks.some(check => check.status === 'error')) {
      setOverallStatus('error');
    } else if (checks.some(check => check.status === 'warning')) {
      setOverallStatus('warning');
    } else if (checks.every(check => check.status === 'success')) {
      setOverallStatus('success');
    } else {
      setOverallStatus('pending');
    }
  }, [checks]);

  // Check wallet connection
  const checkWalletConnection = useCallback(async () => {
    const checkName = 'Wallet Connection';
    
    // If we have a read-only provider but no connected wallet
    if (!isConnected && readOnlyProvider) {
      updateCheck(
        checkName,
        'warning',
        'Running in read-only mode',
        'Using read-only provider. Some features like submitting proposals and voting will be disabled.',
        'Connect your wallet to enable full functionality.'
      );
      return true; // This is a valid state, just with limitations
    }
    
    if (!window.ethereum) {
      updateCheck(
        checkName,
        'warning', // Changed from error to warning since we have read-only mode
        'No Web3 wallet detected',
        'Your browser does not have a Web3 wallet extension installed or enabled. Running in read-only mode.',
        'Install a wallet like MetaMask for full functionality.'
      );
      return true; // Still can use read-only mode
    }
    
    if (!isConnected || !account) {
      updateCheck(
        checkName,
        'warning',
        'Wallet not connected',
        'Your wallet is detected but not connected to the application. Running in read-only mode.',
        'Connect your wallet using the connect button in the header for full functionality.'
      );
      return true; // Still can use read-only mode
    }
    
    // Check if provider is valid
    if (!provider) {
      updateCheck(
        checkName,
        'error',
        'Provider not available',
        'Web3 provider is not properly initialized.',
        'Try refreshing the page or reconnecting your wallet.'
      );
      return false;
    }
    
    // Check if account has balance
    if (balance && parseFloat(balance) === 0) {
      updateCheck(
        checkName,
        'warning',
        'Connected wallet has zero balance',
        'Your wallet is connected but has no funds for transactions.',
        'Add funds to your wallet to perform blockchain transactions.'
      );
      return true; // Still consider this a success for diagnostic purposes
    }
    
    // All checks passed
    updateCheck(
      checkName,
      'success',
      'Wallet connected',
      `Connected to ${account} with balance ${balance || 'unknown'}`
    );
    return true;
  }, [account, isConnected, provider, readOnlyProvider, balance, updateCheck]);

  // Check network connection
  const checkNetworkConnection = useCallback(async () => {
    const checkName = 'Network Connection';
    
    if (!activeProvider) {
      updateCheck(
        checkName,
        'error',
        'Provider not available',
        'Cannot check network without any provider.',
        'Check your internet connection and refresh the page.'
      );
      return false;
    }
    
    // For read-only provider, we'll check the chain ID differently
    const currentChainId = chainId || (activeProvider instanceof ethers.JsonRpcProvider 
      ? Number((await activeProvider.getNetwork()).chainId) 
      : null);
    
    if (!currentChainId) {
      updateCheck(
        checkName,
        'error',
        'Chain ID not detected',
        'Unable to determine the current blockchain network.',
        'Check your internet connection or RPC endpoint configuration.'
      );
      return false;
    }
    
    // Only check for correct chain when wallet is connected
    if (isConnected && !isCorrectChain) {
      const networkConfig = getCurrentNetworkConfig(appChainId);
      updateCheck(
        checkName,
        'warning',
        'Connected to wrong network',
        `Currently connected to chain ID ${currentChainId}, but the application requires chain ID ${appChainId} (${networkConfig.name}).`,
        `Switch your wallet to the ${networkConfig.name} network.`
      );
      return false;
    }
    
    // Try to get the latest block to verify connection
    try {
      const blockNumber = await activeProvider.getBlockNumber();
      const networkConfig = getCurrentNetworkConfig(currentChainId);
      updateCheck(
        checkName,
        'success',
        isConnected ? 'Connected to correct network' : 'Read-only connection established',
        `Connected to ${networkConfig.name} (Chain ID ${currentChainId}) with latest block ${blockNumber}`
      );
      return true;
    } catch (error) {
      updateCheck(
        checkName,
        'error',
        'Network connection error',
        `Error querying blockchain: ${error instanceof Error ? error.message : String(error)}`,
        'Check your internet connection or try switching to a different RPC endpoint.'
      );
      return false;
    }
  }, [activeProvider, chainId, isConnected, isCorrectChain, appChainId, updateCheck]);

  // Check NFT contract
  const checkNFTContract = useCallback(async () => {
    const checkName = 'NFT Contract';
    
    if (!activeProvider) {
      updateCheck(
        checkName,
        'error',
        'Provider not available',
        'Cannot check NFT contract without a provider.',
        'Check your internet connection and refresh the page.'
      );
      return false;
    }
    
    try {
      // Use app chain ID for read-only mode
      const constrainedChainId = isConnected ? chainId : appChainId;
      const addresses = getContractAddresses(constrainedChainId);
      const nftAddress = addresses.blogNFT;
      
      // Check if contract address is valid
      if (!ethers.isAddress(nftAddress) || nftAddress === ethers.ZeroAddress) {
        updateCheck(
          checkName,
          'error',
          'Invalid NFT contract address',
          `The configured address ${nftAddress} is not valid.`,
          'Update the contract address in config.ts.'
        );
        return false;
      }
      
      // Check if contract exists on chain
      const code = await activeProvider.getCode(nftAddress);
      if (code === '0x' || code === '0x0') {
        updateCheck(
          checkName,
          'error',
          'NFT contract not deployed',
          `No contract code found at address ${nftAddress}.`,
          'Verify the contract address and network settings.'
        );
        return false;
      }
      
      // Create contract instance
      const nftContract = new ethers.Contract(
        nftAddress,
        QRC721PlusABI.abi,
        activeSigner || activeProvider // Use signer if available for better error messages
      );
      
      // Try to call a view function to check if interface is correct
      try {
        const name = await nftContract.name();
        const symbol = await nftContract.symbol();
        const totalSupply = await nftContract.totalSupply();
        
        updateCheck(
          checkName,
          'success',
          'NFT contract is accessible',
          `Contract ${name} (${symbol}) at ${nftAddress} with ${totalSupply.toString()} tokens`
        );
        return true;
      } catch (error) {
        updateCheck(
          checkName,
          'warning',
          'NFT contract interface mismatch',
          `Contract exists but may not match expected ABI: ${error instanceof Error ? error.message : String(error)}`,
          'Verify that the ABI matches the deployed contract.'
        );
        return false;
      }
    } catch (error) {
      updateCheck(
        checkName,
        'error',
        'Error checking NFT contract',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        'Check network connection and contract configuration.'
      );
      return false;
    }
  }, [activeProvider, activeSigner, chainId, isConnected, appChainId, updateCheck]);

  // Check DAO Voting contract
  const checkDAOVotingContract = useCallback(async () => {
    const checkName = 'DAO Voting Contract';
    
    if (!activeProvider) {
      updateCheck(
        checkName,
        'error',
        'Provider not available',
        'Cannot check DAO voting contract without a provider.',
        'Check your internet connection and refresh the page.'
      );
      return false;
    }
    
    try {
      // Use app chain ID for read-only mode
      const constrainedChainId = isConnected ? chainId : appChainId;
      const addresses = getContractAddresses(constrainedChainId);
      const votingAddress = addresses.generalDAOVoting;
      
      // Check if contract address is valid
      if (!ethers.isAddress(votingAddress) || votingAddress === ethers.ZeroAddress) {
        updateCheck(
          checkName,
          'error',
          'Invalid DAO voting contract address',
          `The configured address ${votingAddress} is not valid.`,
          'Update the contract address in config.ts.'
        );
        return false;
      }
      
      // Check if contract exists on chain
      const code = await activeProvider.getCode(votingAddress);
      if (code === '0x' || code === '0x0') {
        updateCheck(
          checkName,
          'error',
          'DAO voting contract not deployed',
          `No contract code found at address ${votingAddress}.`,
          'Verify the contract address and network settings.'
        );
        return false;
      }
      
      // Create contract instance
      const votingContract = new ethers.Contract(
        votingAddress,
        GeneralDAOVotingABI.abi,
        activeSigner || activeProvider // Use signer if available for better error messages
      );
      
      // Try to call a view function to check if interface is correct
      try {
        const proposalCount = await votingContract.proposalCount();
        const votingSituations = await votingContract.getVotingSituations();
        
        updateCheck(
          checkName,
          'success',
          'DAO voting contract is accessible',
          `Contract at ${votingAddress} with ${proposalCount.toString()} proposals and ${votingSituations.length} voting situations`
        );
        return true;
      } catch (error) {
        updateCheck(
          checkName,
          'warning',
          'DAO voting contract interface mismatch',
          `Contract exists but may not match expected ABI: ${error instanceof Error ? error.message : String(error)}`,
          'Verify that the ABI matches the deployed contract.'
        );
        return false;
      }
    } catch (error) {
      updateCheck(
        checkName,
        'error',
        'Error checking DAO voting contract',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        'Check network connection and contract configuration.'
      );
      return false;
    }
  }, [activeProvider, activeSigner, chainId, isConnected, appChainId, updateCheck]);

  // Check NFT Minting Module
  const checkNFTMintingModule = useCallback(async () => {
    const checkName = 'NFT Minting Module';
    
    if (!activeProvider) {
      updateCheck(
        checkName,
        'error',
        'Provider not available',
        'Cannot check NFT minting module without a provider.',
        'Check your internet connection and refresh the page.'
      );
      return false;
    }
    
    try {
      // Use app chain ID for read-only mode
      const constrainedChainId = isConnected ? chainId : appChainId;
      const addresses = getContractAddresses(constrainedChainId);
      const mintingAddress = addresses.nftMintingModule;
      
      // Check if contract address is valid
      if (!ethers.isAddress(mintingAddress) || mintingAddress === ethers.ZeroAddress) {
        updateCheck(
          checkName,
          'error',
          'Invalid NFT minting module address',
          `The configured address ${mintingAddress} is not valid.`,
          'Update the contract address in config.ts.'
        );
        return false;
      }
      
      // Check if contract exists on chain
      const code = await activeProvider.getCode(mintingAddress);
      if (code === '0x' || code === '0x0') {
        updateCheck(
          checkName,
          'error',
          'NFT minting module not deployed',
          `No contract code found at address ${mintingAddress}.`,
          'Verify the contract address and network settings.'
        );
        return false;
      }
      
      // Create contract instance
      const mintingContract = new ethers.Contract(
        mintingAddress,
        NFTMintingModulePlusABI.abi,
        activeSigner || activeProvider // Use signer if available for better error messages
      );
      
      // Try to call a view function to check if interface is correct
      try {
        const supportedNFT = await mintingContract.supportedNFT();
        
        updateCheck(
          checkName,
          'success',
          'NFT minting module is accessible',
          `Contract at ${mintingAddress} with supported NFT at ${supportedNFT}`
        );
        return true;
      } catch (error) {
        updateCheck(
          checkName,
          'warning',
          'NFT minting module interface mismatch',
          `Contract exists but may not match expected ABI: ${error instanceof Error ? error.message : String(error)}`,
          'Verify that the ABI matches the deployed contract.'
        );
        return false;
      }
    } catch (error) {
      updateCheck(
        checkName,
        'error',
        'Error checking NFT minting module',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        'Check network connection and contract configuration.'
      );
      return false;
    }
  }, [activeProvider, activeSigner, chainId, isConnected, appChainId, updateCheck]);


  // Check Swarm connection
  const checkSwarmConnection = useCallback(async () => {
    const checkName = 'Swarm Connection';
    
    try {
      // Try connecting to local Bee node first
      let bee = new Bee('http://localhost:1633');
      try {
        await bee.checkConnection();
        updateCheck(
          checkName,
          'success',
          'Connected to local Swarm node',
          'Local Bee node is running at http://localhost:1633'
        );
        return true;
      } catch (localError) {
        // Local node failed, try gateway
        try {
          bee = new Bee('https://gateway.ethswarm.org');
          await bee.checkConnection();
          updateCheck(
            checkName,
            'warning',
            'Connected to Swarm gateway',
            'Using public gateway instead of local Bee node',
            'For best results, run a local Bee node at http://localhost:1633'
          );
          return true;
        } catch (gatewayError) {
          updateCheck(
            checkName,
            'error',
            'Swarm connection failed',
            `Could not connect to local Bee node or gateway: ${gatewayError instanceof Error ? gatewayError.message : String(gatewayError)}`,
            'Start a local Bee node or check your internet connection for gateway access.'
          );
          return false;
        }
      }
    } catch (error) {
      updateCheck(
        checkName,
        'error',
        'Error checking Swarm connection',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        'Check if Bee node is running or if you can access the Swarm gateway.'
      );
      return false;
    }
  }, [updateCheck]);

  // Check Swarm postage stamp
  const checkPostageStamp = useCallback(async () => {
    const checkName = 'Postage Stamp';
    
    try {
      // Try connecting to local Bee node
      const bee = new Bee('http://localhost:1633');
      
      try {
        // Get all postage stamps
        const stamps = await bee.getAllPostageBatch();
        
        if (stamps.length === 0) {
          updateCheck(
            checkName,
            'warning',
            'No postage stamps found',
            'No postage stamps exist on the local Bee node.',
            'Create a new postage stamp using: curl -X POST http://localhost:1635/stamps/100000000/24'
          );
          return false;
        }
        
        // Check if any stamps are usable
        const usableStamps = stamps.filter(stamp => stamp.usable);
        
        if (usableStamps.length === 0) {
          updateCheck(
            checkName,
            'warning',
            'No usable postage stamps',
            'Postage stamps exist but none are usable.',
            'Create a new usable postage stamp.'
          );
          return false;
        }
        
        // Sort by remaining capacity and pick the one with most capacity
        const bestStamp = usableStamps.sort((a, b) => 
          parseInt(b.amount) - parseInt(a.amount)
        )[0];
        
        updateCheck(
          checkName,
          'success',
          'Usable postage stamp found',
          `Found usable stamp with ID: ${bestStamp.batchID.substring(0, 8)}... and capacity: ${bestStamp.amount}`
        );
        return true;
      } catch (error) {
        if (String(error).includes('connect')) {
          updateCheck(
            checkName,
            'warning',
            'Cannot check postage stamps',
            'Cannot connect to local Bee node to check postage stamps.',
            'Start a local Bee node to use postage stamps.'
          );
        } else {
          updateCheck(
            checkName,
            'error',
            'Error checking postage stamps',
            `Error: ${error instanceof Error ? error.message : String(error)}`,
            'Check if Bee debug API is accessible at http://localhost:1635'
          );
        }
        return false;
      }
    } catch (error) {
      updateCheck(
        checkName,
        'error',
        'Error initializing Swarm connection',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        'Check if Bee node is running.'
      );
      return false;
    }
  }, [updateCheck]);

  // Run all diagnostic checks
  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setChecks(initialChecks); // Reset checks
    
    // Run checks sequentially - some checks depend on others
    await checkWalletConnection();
    await checkNetworkConnection();
    await checkNFTContract();
    await checkDAOVotingContract();
    await checkNFTMintingModule();
    await checkSwarmConnection();
    await checkPostageStamp();
    
    setIsRunning(false);
  }, [
    checkWalletConnection, 
    checkNetworkConnection, 
    checkNFTContract, 
    checkDAOVotingContract, 
    checkNFTMintingModule, 
    checkSwarmConnection, 
    checkPostageStamp
  ]);

  // Run diagnostics when component mounts
  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  // Render status icon based on check status
  const renderStatusIcon = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success':
        return <span className="status-icon success">✓</span>;
      case 'error':
        return <span className="status-icon error">✗</span>;
      case 'warning':
        return <span className="status-icon warning">⚠</span>;
      case 'pending':
      default:
        return <span className="status-icon pending">⟳</span>;
    }
  };

  // Helper to display read-only mode notice
  const isReadOnlyMode = !isConnected && readOnlyProvider;

  return (
    <div className="system-diagnostic">
      <h2>System Diagnostic</h2>
      
      {isReadOnlyMode && (
        <div className="read-only-notice">
          Running in read-only mode. Connect your wallet for full functionality.
        </div>
      )}
      
      <div className="diagnostic-header">
        <div className={`overall-status ${overallStatus}`}>
          {overallStatus === 'success' && 'All systems operational'}
          {overallStatus === 'warning' && 'Some systems have warnings'}
          {overallStatus === 'error' && 'Some systems have errors'}
          {overallStatus === 'pending' && 'Running diagnostics...'}
        </div>
        
        <button 
          className="refresh-button"
          onClick={runDiagnostics}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </button>
      </div>
      
      <div className="diagnostic-checks">
        {checks.map((check) => (
          <div 
            key={check.name} 
            className={`diagnostic-check ${check.status}`}
          >
            <div className="check-header">
              {renderStatusIcon(check.status)}
              <h3>{check.name}</h3>
            </div>
            
            <div className="check-message">
              {check.message}
            </div>
            
            {check.details && (
              <div className="check-details">
                {check.details}
              </div>
            )}
            
            {check.solution && (
              <div className="check-solution">
                <strong>Solution:</strong> {check.solution}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemDiagnostic;