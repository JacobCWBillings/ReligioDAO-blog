// src/utils/platformInitializer.ts
import { ethers } from 'ethers';
import { Swarm } from '../libswarm';
import { GlobalStateOnDisk, getGlobalState } from '../libetherjot/engine/GlobalState';
import { createFrontPage } from '../libetherjot/page/FrontPage';

/**
 * Interface for configuration parameters when initializing ReligioDAO state
 */
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
    console.log("Initializing ReligioDAO platform with params:", params);
    
    // Determine if we should use local Bee or public gateway
    const useLocalBee = params?.useLocalBee ?? false;
    
    // Set up BeeApi based on whether we're using local Bee
    const beeApi = params?.beeApi || 
        (useLocalBee ? 'http://localhost:1633' : 'https://download.gateway.ethswarm.org');
    
    const postageBatchId = params?.postageBatchId || '';
    
    // Create a deterministic wallet for the platform (instead of random)
    // This ensures all users get the same feed address
    const PLATFORM_SEED = "ReligioDAO blog. Default seed.";
    // Generate a private key using keccak256 hash of the seed
    const privateKeyBytes = ethers.keccak256(ethers.toUtf8Bytes(PLATFORM_SEED));
    // Remove 0x prefix and ensure it's 64 chars (32 bytes) for a valid private key
    const privateKey = privateKeyBytes.substring(2);
    const wallet = new ethers.Wallet(privateKey);
    
    // Default feed and collection values
    let feed = wallet.address.toLowerCase();
    let collectionReference = "";
    
    try {
        // Initialize Swarm safely
        let swarm: Swarm | null = null;
        try {
            console.log("Creating Swarm instance with:", { beeApi, postageBatchId });
            swarm = new Swarm({
                beeApi,
                postageBatchId
            });
        } catch (error) {
            console.error("Failed to create Swarm instance:", error);
            swarm = null;
        }
        
        // Proceed with Swarm operations only if local Bee is available and Swarm was initialized
        if (useLocalBee && swarm) {
            console.log("Attempting to use local Bee node");
            
            // Safely get usable stamp (with error handling)
            // FIX: Initialize with empty string instead of null to match the expected string type
            let usableStamp: string = postageBatchId;
            if (!usableStamp) {
                try {
                    // Get stamp and ensure it's a string type
                    const stampResult = await swarm.getUsableStamp().catch(err => {
                        console.warn("Error getting usable stamp:", err);
                        return null;
                    });
                    // FIX: If stampResult is not null, use it, otherwise use empty string
                    usableStamp = stampResult || '';
                    console.log("Usable stamp:", usableStamp ? "Found" : "Not found");
                } catch (error) {
                    console.warn("Error getting usable stamp:", error);
                    // FIX: Use empty string instead of null
                    usableStamp = '';
                }
            }
            
            // Only proceed with collection creation if we have a usable stamp
            if (usableStamp) {
                console.log("Creating collection with usable stamp");
                let collection = null;
                
                try {
                    collection = await swarm.newCollection();
                    console.log("Collection created successfully");
                    
                    try {
                        console.log("Adding index.html to collection");
                        const rawData = await swarm.newRawData('ReligioDAO Blog Platform', 'text/html');
                        await collection.addRawData('index.html', rawData);
                        console.log("Data added to collection");
                        
                        try {
                            console.log("Saving collection");
                            collectionReference = await collection.save();
                            console.log("Collection saved with reference:", collectionReference);
                        } catch (error) {
                            console.warn("Failed to save collection:", error);
                        }
                    } catch (error) {
                        console.warn("Failed to add data to collection:", error);
                    }
                } catch (error) {
                    console.warn("Failed to create collection:", error);
                    if (error instanceof Error && error.message.includes("Reduce")) {
                        console.error("Reduce error detected - likely empty array issue");
                    }
                }
                
                // Create website only if collection was saved
                if (collection && collectionReference) {
                    try {
                        console.log("Creating website with collection");
                        const website = await swarm.newWebsite(wallet.privateKey, collection);
                        
                        try {
                            console.log("Generating feed address");
                            feed = await website.generateAddress();
                            console.log("Feed address generated:", feed);
                            
                            // Try to publish website
                            if (usableStamp) {
                                try {
                                    console.log("Publishing website");
                                    await website.publish(0);
                                    console.log("Website published successfully");
                                } catch (error) {
                                    console.warn("Could not publish website, but continuing:", error);
                                }
                            }
                        } catch (error) {
                            console.warn("Could not generate feed address:", error);
                        }
                    } catch (error) {
                        console.warn("Could not create website:", error);
                    }
                } else {
                    console.log("Skipping website creation (no valid collection)");
                }
            } else {
                console.log("Skipping collection creation (no usable stamp)");
            }
        } else {
            console.log("Using public gateway configuration (no local Bee)");
        }
    } catch (error) {
        console.error("Error in platform initialization:", error);
    }
    
    // Create the global state - this will work even if Swarm operations failed
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
    
    // Only add collection reference if it was successfully created
    if (collectionReference) {
        globalStateOnDisk.collections = { default: collectionReference };
    }
    
    // Create front page (with error handling)
    try {
        console.log("Creating front page");
        const state = await getGlobalState(globalStateOnDisk);
        await createFrontPage(state);
        console.log("Front page created successfully");
    } catch (error) {
        console.warn("Error creating front page, but continuing:", 
            error instanceof Error ? error.message : String(error));
    }
    
    console.log("Platform initialization completed successfully");
    return globalStateOnDisk;
}