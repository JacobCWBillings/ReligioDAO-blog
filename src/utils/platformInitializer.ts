// src/utils/platformInitializer.prod.ts - Use this for production builds
import { ethers } from 'ethers';
import { GlobalStateOnDisk } from '../libetherjot/engine/GlobalState';

/**
 * Production-safe version of createReligioDAOState that doesn't rely on Swarm
 */
export async function createReligioDAOState(
    websiteName: string = "ReligioDAO Blog Platform",
    params?: {},
): Promise<GlobalStateOnDisk> {
    // Create a deterministic wallet for consistent address
    const PLATFORM_SEED = "ReligioDAO blog. Default seed.";
    const privateKeyBytes = ethers.keccak256(ethers.toUtf8Bytes(PLATFORM_SEED));
    const privateKey = privateKeyBytes.substring(2);
    const wallet = new ethers.Wallet(privateKey);
    
    // Use wallet address as the feed identifier
    const feed = wallet.address.toLowerCase();
    
    // Create a minimal global state that doesn't depend on Swarm
    const globalStateOnDisk: GlobalStateOnDisk = {
        beeApi: 'https://api.gateway.ethswarm.org',
        postageBatchId: '',
        privateKey: wallet.privateKey,
        pages: [],
        articles: [],
        feed,
        configuration: {
            title: websiteName,
            header: {
                title: 'ReligioDAO',
                logo: '',
                description: 'A decentralized blogging platform governed by the ReligioDAO community',
                linkLabel: 'Governance',
                linkAddress: '/proposals'
            },
            main: {
                highlight: 'Featured'
            },
            footer: {
                description: 'Content on this platform is approved by ReligioDAO governance and stored on Swarm',
                links: {
                    discord: 'https://discord.gg/religiodao',
                    twitter: 'https://twitter.com/religiodao',
                    github: 'https://github.com/religiodao',
                    youtube: '',
                    reddit: ''
                }
            },
            extensions: {
                ethereumAddress: '',
                donations: false,
                comments: true
            }
        },
        collections: {},
        assets: []
    };
    
    return globalStateOnDisk;
}