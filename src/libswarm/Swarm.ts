import { Bee } from '@ethersphere/bee-js'
import { SwarmCollection } from './SwarmCollection'
import { SwarmHandle } from './SwarmHandle'
import { SwarmRawData } from './SwarmRawData'
import { SwarmResource } from './SwarmResource'
import { SwarmSettings } from './SwarmSettings'
import { SwarmWebsite } from './SwarmWebsite'

interface SwarmConstructorParameters {
    beeApi?: string
    postageBatchId?: string
}

export class Swarm {
    beeApi: string
    postageBatchId?: string

    constructor(params?: SwarmConstructorParameters) {
        this.beeApi = params?.beeApi || 'http://localhost:1633'
        this.postageBatchId = params?.postageBatchId
        if (this.postageBatchId === 'auto') {
            this.postageBatchId = '00'.repeat(32)
        }
    }

    async newHandle(name: string, hash: string, contentType: string) {
        return new SwarmHandle(await this.createSettings(), name, hash, contentType)
    }

    async newRawData(data: string | Uint8Array, contentType: string) {
        return new SwarmRawData(await this.createSettings(), data, contentType)
    }

    async newResource(name: string, data: string | Uint8Array, contentType: string) {
        return new SwarmResource(await this.createSettings(), name, data, contentType)
    }

    async newCollection() {
        return new SwarmCollection(await this.createSettings())
    }

    async newWebsite(privateKey: string, collection: SwarmCollection) {
        return new SwarmWebsite(await this.createSettings(), privateKey, collection)
    }

    async downloadRawData(hash: string, contentType: string) {
        return SwarmRawData.fromHash(await this.createSettings(), hash, contentType)
    }

    async getNodeAddress(): Promise<string> {
        const bee = new Bee(this.beeApi)
        return bee.getNodeAddresses().then(addresses => addresses.ethereum)
    }

    /**
     * Gets the highest capacity usable postage stamp
     * @returns The batchID of the usable stamp or null if none found
     */
    async getUsableStamp(): Promise<string | null> {
        if (this.postageBatchId) {
            return this.postageBatchId;
        }
        
        try {
            const bee = new Bee(this.beeApi);
            const postageBatches = await bee.getAllPostageBatch();
            const usableBatches = postageBatches.filter(batch => batch.usable);
            
            // Check if there are any usable batches before using reduce
            if (usableBatches.length === 0) {
                return null;
            }
            
            const highestCapacityBatch = usableBatches.reduce((a, b) => (a.depth > b.depth ? a : b));
            return highestCapacityBatch?.batchID || null;
        } catch (error) {
            console.warn("Error getting usable stamp:", error);
            return null;
        }
    }

    async mustGetUsableStamp(): Promise<string> {
        const stamp = await this.getUsableStamp();
        if (stamp === null) {
            // If we can't get a stamp, use a fallback for development/testing
            if (process.env.NODE_ENV !== 'production') {
                console.warn('No usable postage stamp found - using development fallback');
                return '0'.repeat(64); // Development fallback stamp
            }
            throw new Error('No usable postage stamp found');
        }
        return stamp;
    }   

    async createSettings(): Promise<SwarmSettings> {
        return {
            beeApi: this.beeApi,
            postageBatchId: this.postageBatchId || (await this.mustGetUsableStamp())
        }
    }
}
