// New function in src/utils/platformInitializer.ts
import { ethers } from 'ethers';
import { Swarm } from '../libswarm';
import { GlobalStateOnDisk, getGlobalState } from '../libetherjot/engine/GlobalState';
import { createFrontPage } from '../libetherjot/page/FrontPage';

interface ReligioDAOStateParams {
    beeApi?: string;
    postageBatchId?: string;
    useLocalBee?: boolean;
}

/**
 * Creates a default global state configured for the ReligioDAO platform
 * 
 * @param websiteName The name of the blog platform
 * @param params Optional parameters for customizing the state
 * @returns A promise that resolves to the global state on disk
 */
export async function createReligioDAOState(
    websiteName: string = "ReligioDAO Blog Platform",
    params?: ReligioDAOStateParams
): Promise<GlobalStateOnDisk> {
    // Determine if we should use local Bee or public gateway
    const useLocalBee = params?.useLocalBee ?? false;
    
    // Set up BeeApi based on whether we're using local Bee
    const beeApi = params?.beeApi || 
        (useLocalBee ? 'http://localhost:1633' : 'https://download.gateway.ethswarm.org');
    
    const postageBatchId = params?.postageBatchId || '';
    
    // Initialize Swarm with appropriate settings
    const swarm = new Swarm({
        beeApi,
        postageBatchId
    });
    
    // Create a deterministic wallet for the platform (instead of random)
    // This ensures all users get the same feed address
    const PLATFORM_SEED = "religiodao-platform-v1";
    const wallet = ethers.Wallet.fromPhrase(PLATFORM_SEED);
    
    try {
        // Create and initialize the collection
        const collection = await swarm.newCollection();
        await collection.addRawData('index.html', await swarm.newRawData('ReligioDAO Blog Platform', 'text/html'));
        await collection.save();
        
        // Create and publish the website
        const website = await swarm.newWebsite(wallet.privateKey, collection);
        const feed = await website.generateAddress();
        
        // Only try to publish if we're using local Bee
        if (useLocalBee && postageBatchId) {
            try {
                await website.publish(0);
            } catch (error) {
                console.warn("Could not publish website, but continuing with initialization:", error);
                // Don't fail initialization if publishing fails
            }
        }
        
        // Create the global state
        const globalStateOnDisk: GlobalStateOnDisk = {
            beeApi,
            postageBatchId,
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
        
        // Create front page
        try {
            const state = await getGlobalState(globalStateOnDisk);
            await createFrontPage(state);
        } catch (error: unknown) {
            console.warn("Error creating front page, but continuing:", 
                error instanceof Error ? error.message : String(error));
        }
        
        return globalStateOnDisk;
    } catch (error: unknown) {
        console.error("Error initializing ReligioDAO state:", 
            error instanceof Error ? error.message : String(error));
        throw new Error(`Failed to initialize ReligioDAO platform: ${
            error instanceof Error ? error.message : String(error)
        }`);
    }
}