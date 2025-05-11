// src/utils/platformInitializer.ts - with additional type fixes
import { ethers } from 'ethers';
import { Swarm } from '../libswarm/';
import { SwarmCollection } from '../libswarm/SwarmCollection';
import { GlobalStateOnDisk, getGlobalState } from '../libetherjot/engine/GlobalState';
import { createFrontPage } from '../libetherjot/page/FrontPage';

// Define our own collection type that correctly matches SwarmCollection's methods
interface CollectionLike {
  reference?: string;
  addRawData?: (path: string, data: any) => Promise<void>;
  // Fix Error #2 - save returns a string, not void
  save?: () => Promise<string>;
}

// Add diagnostic logging utility
const logDiagnostic = (phase: string, data: any) => {
  console.log(`[DIAGNOSTIC:${phase}]`, JSON.stringify(data, null, 2));
};

/**
 * Interface for configuration parameters when initializing ReligioDAO state
 */
interface ReligioDAOStateParams {
  beeApi?: string;
  postageBatchId?: string;
  useLocalBee?: boolean;
}

export async function createReligioDAOState(
    websiteName: string = "ReligioDAO Blog Platform",
    params?: ReligioDAOStateParams
): Promise<GlobalStateOnDisk> {
    console.log("=== STARTING PLATFORM INITIALIZATION ===");
    console.log("Environment:", process.env.NODE_ENV);
    console.log("Input parameters:", params);
    
    // Determine if we should use local Bee or public gateway
    const useLocalBee = params?.useLocalBee ?? false;
    
    // Set up BeeApi based on whether we're using local Bee
    const beeApi = params?.beeApi || 
        (useLocalBee ? 'http://localhost:1633' : 'https://download.gateway.ethswarm.org');
    
    const postageBatchId = params?.postageBatchId || '';
    
    console.log("Configuration:", { useLocalBee, beeApi, postageBatchId });
    
    try {
        console.log("Creating Swarm instance...");
        
        // Fix for diagnostic functions to avoid string indexing
        const swarmPrototype = Swarm.prototype;
        const swarmPrototypeMethods = typeof Swarm === 'function' ? 
            Object.getOwnPropertyNames(swarmPrototype)
              .filter(p => typeof swarmPrototype[p as keyof typeof swarmPrototype] === 'function') : [];
        
        logDiagnostic("SWARM_MODULE", {
            exists: !!Swarm,
            properties: Object.keys(swarmPrototype || {}),
            methods: swarmPrototypeMethods
        });
        
        const swarm = new Swarm({
            beeApi,
            postageBatchId
        });
        
        // Fix Error #1 - avoid string indexing on Swarm
        type SwarmKey = keyof typeof swarm;
        const swarmMethods = Object.keys(swarm)
            .filter(k => typeof swarm[k as unknown as SwarmKey] === 'function');

        console.log("Swarm instance created:", {
            isValid: !!swarm,
            methods: swarmMethods
        });
        
        // Create a deterministic wallet for the platform
        const PLATFORM_SEED = "ReligioDAO blog. Default seed.";
        const privateKeyBytes = ethers.keccak256(ethers.toUtf8Bytes(PLATFORM_SEED));
        const privateKey = privateKeyBytes.substring(2);
        const wallet = new ethers.Wallet(privateKey);
        
        console.log("Wallet created:", { address: wallet.address });
        
        // Collection creation
        console.log("=== CRITICAL POINT: STARTING COLLECTION CREATION ===");
        let collection: SwarmCollection | { reference: string } | null = null;
        try {
            console.log("swarm.newCollection exists:", typeof swarm.newCollection === "function");
            
            collection = await swarm.newCollection();
            
            // Safe way to get collection methods
            if (collection) {
                const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(collection))
                    .filter(m => typeof (collection as any)[m] === 'function');
                
                console.log("Collection created:", { 
                    isValid: !!collection,
                    methods
                });
            }
            
            // Type-safe checks for collection methods
            const hasAddRawData = collection && 'addRawData' in collection && 
                typeof collection.addRawData === 'function';
            
            console.log("collection.addRawData exists:", hasAddRawData);
            
            console.log("Testing swarm.newRawData...");
            const testRawData = await swarm.newRawData("Test content", "text/plain").catch(e => {
                console.error("swarm.newRawData failed:", e);
                return null;
            });
            console.log("Test raw data:", !!testRawData);
            
            // Only proceed if we have the right methods
            if (testRawData && hasAddRawData) {
                console.log("Adding raw data to collection...");
                await (collection as SwarmCollection).addRawData('index.html', 
                    await swarm.newRawData('ReligioDAO Blog Platform', 'text/html'));
                console.log("Raw data added to collection");
                
                const hasSave = collection && 'save' in collection && 
                    typeof collection.save === 'function';
                
                if (hasSave) {
                    console.log("Saving collection...");
                    const reference = await (collection as SwarmCollection).save();
                    console.log("Collection saved successfully with reference:", reference);
                } else {
                    console.warn("Collection has no save method");
                }
            } else {
                console.warn("Skipping collection operations due to newRawData failure or incomplete collection");
            }
        } catch (error) {
            const collectionError = error as Error;
            console.error("COLLECTION OPERATION ERROR:", collectionError);
            console.error("Error details:", {
                name: collectionError.name,
                message: collectionError.message,
                stack: collectionError.stack,
            });
            
            if (collectionError.message.includes("Reduce")) {
                console.error("FOUND REDUCE ERROR! This indicates an empty array is being operated on.");
                
                try {
                    // Type-safe version for examining arrays in the Swarm instance
                    const swarmArrayProps: {key: string; length: number; isEmpty: boolean}[] = [];
                    
                    // First check all keys of swarm
                    const swarmKeys = Object.keys(swarm);
                    for (const key of swarmKeys) {
                        // Only process keys that contain arrays
                        if (Array.isArray((swarm as any)[key])) {
                            const arr = (swarm as any)[key] as any[];
                            swarmArrayProps.push({
                                key,
                                length: arr.length,
                                isEmpty: arr.length === 0
                            });
                        }
                    }
                    
                    console.log("Swarm arrays:", swarmArrayProps);
                    
                    // Similarly for collection
                    if (collection && collection instanceof Object) {
                        const collectionArrayProps: {key: string; length: number; isEmpty: boolean}[] = [];
                        
                        const collectionKeys = Object.keys(collection);
                        for (const key of collectionKeys) {
                            // Only process keys that contain arrays
                            if (Array.isArray((collection as any)[key])) {
                                const arr = (collection as any)[key] as any[];
                                collectionArrayProps.push({
                                    key,
                                    length: arr.length,
                                    isEmpty: arr.length === 0
                                });
                            }
                        }
                        
                        console.log("Collection arrays:", collectionArrayProps);
                    }
                } catch (examErr) {
                    console.log("Error examining arrays:", examErr);
                }
            }
            
            console.log("Will continue with empty collection");
            collection = { reference: "empty-collection-reference-placeholder" };
        }
        
        // Create and publish the website
        console.log("=== CREATING WEBSITE ===");
        let feed = "";
        try {
            console.log("Creating website with collection:", collection);
            
            // Fix Error #3 - Use a proper check before casting
            // Only try to create a website if we have a real SwarmCollection
            if (collection && 'addRawData' in collection && 'save' in collection) {
                // This is a real SwarmCollection, so we can safely cast it
                const website = await swarm.newWebsite(wallet.privateKey, collection as SwarmCollection);
                console.log("Website created:", !!website);
                
                console.log("Generating feed address...");
                feed = await website.generateAddress();
                console.log("Feed address generated:", feed);
                
                // Only try to publish if we're using local Bee
                if (useLocalBee && postageBatchId) {
                    try {
                        console.log("Publishing website...");
                        await website.publish(0);
                        console.log("Website published successfully");
                    } catch (error) {
                        console.warn("Could not publish website, but continuing with initialization:", error);
                    }
                } else {
                    console.log("Skipping website publishing (no local bee or postage)");
                }
            } else {
                // We have a fallback collection, so we'll create a fallback feed
                console.log("Using fallback collection, skipping website creation");
                feed = `${wallet.address.toLowerCase()}-feed`;
            }
        } catch (websiteError) {
            console.error("WEBSITE CREATION ERROR:", websiteError);
            console.log("Using fallback feed address");
            
            // Fallback: use wallet address as feed
            feed = `${wallet.address.toLowerCase()}`;
        }
        
        // Create the global state
        console.log("=== CREATING GLOBAL STATE ===");
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
        
        // Add collection to globalState if it exists and has a reference
        if (collection && 'reference' in collection && collection.reference) {
            globalStateOnDisk.collections = { default: collection.reference };
            console.log("Added collection to global state:", collection.reference);
        } else {
            console.log("No valid collection to add to global state");
        }
        
        // Create front page
        console.log("=== CREATING FRONT PAGE ===");
        try {
            const state = await getGlobalState(globalStateOnDisk);
            console.log("Global state processed successfully");
            await createFrontPage(state);
            console.log("Front page created successfully");
        } catch (error: unknown) {
            console.warn("Error creating front page, but continuing:", 
                error instanceof Error ? error.message : String(error));
        }
        
        console.log("=== PLATFORM INITIALIZATION COMPLETED SUCCESSFULLY ===");
        return globalStateOnDisk;
    } catch (error: unknown) {
        console.error("=== FATAL ERROR IN PLATFORM INITIALIZATION ===");
        console.error("Error initializing ReligioDAO state:", 
            error instanceof Error ? error.message : String(error));
        if (error instanceof Error) {
            console.error("Stack trace:", error.stack);
        }
        throw new Error(`Failed to initialize ReligioDAO platform: ${
            error instanceof Error ? error.message : String(error)
        }`);
    }
}