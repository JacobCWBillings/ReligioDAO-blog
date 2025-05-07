import React from 'react';
import SystemDiagnostic from '../components/SystemDiagnostic';
import './DiagnosticPage.css';

const DiagnosticPage: React.FC = () => {
  return (
    <div className="diagnostic-page">
      <h1>ReligioDAO System Diagnostics</h1>
      <p className="page-description">
        This page helps you diagnose issues with your ReligioDAO blog platform setup.
        Check the status of all system components and find solutions to common problems.
      </p>
      
      <SystemDiagnostic />
      
      <div className="additional-resources">
        <h2>Additional Resources</h2>
        <ul>
          <li>
            <a href="https://github.com/ethersphere/etherjot-web" target="_blank" rel="noopener noreferrer">
              Etherjot Web Documentation
            </a>
          </li>
          <li>
            <a href="https://docs.q.org" target="_blank" rel="noopener noreferrer">
              Q Network Documentation
            </a>
          </li>
          <li>
            <a href="https://docs.ethswarm.org/docs/" target="_blank" rel="noopener noreferrer">
              Swarm Documentation
            </a>
          </li>
          <li>
            <a href="https://github.com/JacobCWBillings/ReligioDAO-blog" target="_blank" rel="noopener noreferrer">
              ReligioDAO Blog GitHub Repository
            </a>
          </li>
        </ul>
      </div>
      
      <div className="common-issues">
        <h2>Common Issues</h2>
        
        <div className="issue-card">
          <h3>Wallet Connection Issues</h3>
          <p>Make sure your wallet (like MetaMask) is installed and unlocked. If you're having trouble connecting, try refreshing the page or reconnecting your wallet.</p>
        </div>
        
        <div className="issue-card">
          <h3>Network Configuration</h3>
          <p>ReligioDAO requires connection to the Q Network. Make sure your wallet is connected to the correct network with chain ID 35443 (Q Testnet) or 35441 (Q Mainnet).</p>
        </div>
        
        <div className="issue-card">
          <h3>Swarm Storage</h3>
          <p>For local development, you need a running Bee node. Download it from <a href="https://github.com/ethersphere/bee/releases" target="_blank" rel="noopener noreferrer">GitHub</a> and run:</p>
          <pre>./bee dev --cors-allowed-origins="*"</pre>
          <p>After starting Bee, create a postage stamp:</p>
          <pre>curl -X POST http://localhost:1635/stamps/100000000/24</pre>
        </div>
        
        <div className="issue-card">
          <h3>Contract Interactions</h3>
          <p>If contract interactions are failing, check:</p>
          <ul>
            <li>Your wallet has sufficient funds</li>
            <li>You're connected to the correct network</li>
            <li>Contract addresses in config.ts are correct</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;