# ReligioDAO Blog Platform

A decentralized blogging platform governed by the ReligioDAO community, where members vote on blog proposals through on-chain governance and content is stored on the Swarm decentralized storage network.

![ReligioDAO Blog Banner](./src/assets/images/default.jpg)

## Overview

ReligioDAO Blog is a fork of the [Etherjot Web](https://github.com/ethersphere/etherjot-web) blogging tool, extended with blockchain governance capabilities. It allows community members to propose blog content, vote on it through the Q.org governance stack, mint approved content as NFTs, and view published blogs in a decentralized manner.

### Key Features

- **DAO-Governed Content**: All blog posts require community approval through on-chain voting
- **Blockchain Integration**: Leverages Q.org voting contracts for governance
- **NFT Representation**: Approved blogs are minted as NFTs with on-chain metadata
- **Decentralized Storage**: Content is stored on Swarm for censorship resistance
- **User-Friendly Interface**: Easy-to-use editor with asset management
- **Category-Based Organization**: Content is organized by topics and tags
- **Wallet Integration**: Seamless connection with Web3 wallets
- **Metadata Durability**: Critical information stored directly on-chain

## Architecture

The platform consists of the following core components:

1. **Frontend Application**: React/TypeScript application built from Etherjot
2. **Blockchain Integration**: 
   - Ethereum transaction handling via ethers.js
   - QRC721Plus contract interface for NFT representation 
   - GeneralDAOVoting contract for proposal management
   - NFTMintingModulePlus for minting approved content as NFTs
3. **Decentralized Storage**:
   - Swarm network integration for blog content
   - Metadata durably stored on-chain with references to Swarm content

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Web3 wallet (MetaMask, WalletConnect, etc.)
- Access to Q Network (Testnet or Mainnet)
- Local Bee node (for development) or Swarm gateway access

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/JacobCWBillings/ReligioDAO-blog
   cd religiodao-blog
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment:
   Create a `.env.local` file based on `.env.example` with your Q Network RPC endpoints and contract addresses.

4. Start the development server:
   ```
   npm start
   ```

### Testing with Local Bee Node

For development with local Swarm storage:

1. Download Bee v1.16.1 from [releases](https://github.com/ethersphere/bee/releases/tag/v1.16.1)
2. Provide execution permissions: `chmod +x <downloaded_binary_name>`
3. Start Bee in dev mode: `./bee dev --cors-allowed-origins="*"`
4. Generate a postage batch: `curl -X POST http://localhost:1633/stamps/100000000/24`

## Workflow

### User Flow

1. **Connect Wallet**: Users connect their Web3 wallet
2. **Create Content**: Authors create blog content in the editor
3. **Submit Proposal**: Content is uploaded to Swarm and a governance proposal is created
4. **Community Voting**: DAO members vote on the proposal
5. **NFT Minting**: Approved proposals trigger minting of an NFT with metadata
6. **Content Discovery**: Users browse and read approved content via the blog viewer

### Blog Submission Process

1. Author creates blog in the editor
2. Content is stored on Swarm with unique reference
3. Metadata (including Swarm reference) is created and encoded
4. Proposal is submitted to GeneralDAOVoting contract
5. DAO members vote on the proposal
6. Approved proposals are executed, minting an NFT with on-chain metadata

## Contracts

ReligioDAO Blog interacts with three main Q Network contracts:

1. **QRC721Plus**: NFT contract for blog representation
2. **GeneralDAOVoting**: Handles governance proposals and voting
3. **NFTMintingModulePlus**: Executes NFT minting for approved content

## Configuration

Key configuration options are available in `src/config.ts`, including:

- Network settings for different chains (Q Testnet, Q Mainnet, etc.)
- Contract addresses
- Swarm gateway configuration
- Default settings for the platform

## Development

### Directory Structure

```
religiodao-blog/
├── src/
│   ├── blockchain/   # Blockchain interactions
│   ├── components/   # React components
│   ├── contexts/     # Context providers
│   ├── hooks/        # Custom React hooks
│   ├── libetherjot/  # Core Etherjot library
│   ├── libswarm/     # Swarm integration
│   ├── pages/        # App pages
│   ├── services/     # Service classes
│   ├── types/        # TypeScript types
│   └── utils/        # Utility functions
```

### Testing

Run the test suite with:

```
npm test
```

For specific test groups:

```
npm run test:blockchain    # Test blockchain integration
npm run test:transactions  # Test transaction preparation
npm run test:hooks         # Test blockchain hooks
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on [Etherjot Web](https://github.com/ethersphere/etherjot-web)
- Uses [Swarm](https://www.ethswarm.org/) for decentralized storage
- Governance powered by [Q.org](https://q.org/) stack