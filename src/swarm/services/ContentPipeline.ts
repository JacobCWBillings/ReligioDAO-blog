// src/services/ContentPipeline.ts
import { ContentService } from './ContentService';
import { AssetService } from './AssetService';
import { NFTMintingService } from '../../blockchain/services/NFTMintingService';
import { ProposalService } from '../../blockchain/services/ProposalService';
import {
  BlogContent,
  PreparedContent,
  ContentReferences,
  ValidationResult
} from '../../types/contentTypes';
import { 
  BlogNFTMetadata, 
  BlogProposal 
} from '../../types/blockchainTypes';
import { UnifiedBlogData } from '../../types/editorTypes';

/**
 * Unified content pipeline for blog publication workflow
 * Coordinates content upload, NFT metadata, and proposal creation
 */
export class ContentPipeline {
  constructor(
    private contentService: ContentService,
    private assetService: AssetService,
    private nftMintingService: NFTMintingService,
    private proposalService: ProposalService
  ) {}

  /**
   * Prepare content for complete publication workflow
   */
  async prepareForPublication(
    draft: UnifiedBlogData
  ): Promise<PreparedContent> {
    try {
      // 1. Validate content
      const validation = this.validateDraft(draft);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // 2. Process markdown for publication
      const processedContent = this.assetService.processMarkdownForPublication(
        draft.content
      );
      
      // 3. Upload content to Swarm
      const contentReference = await this.contentService.uploadBlogContent({
        title: draft.title,
        content: processedContent,
        metadata: {
          author: draft.authorAddress,
          category: draft.category,
          tags: draft.tags,
          createdAt: draft.createdAt,
          banner: draft.banner,
          description: draft.description
        }
      });
      
      // 4. Generate NFT metadata
      const nftMetadata = this.nftMintingService.createBlogMetadata(
        draft.title,
        draft.description || this.generateDescription(draft.content),
        contentReference,
        draft.authorAddress,
        draft.category,
        draft.tags,
        undefined, // proposalId - filled later
        draft.banner || undefined
      );
      
      // 5. Upload metadata to Swarm
      const metadataReference = await this.uploadMetadata(nftMetadata);
      
      // 6. Create token URI
      const tokenURI = this.nftMintingService.createTokenURI(
        nftMetadata,
        'swarm',
        metadataReference
      );
      
      // 7. Prepare proposal calldata
      const proposalCalldata = this.nftMintingService.prepareMintToCalldata(
        draft.authorAddress,
        tokenURI
      );
      
      // 8. Create content references
      const references: ContentReferences = {
        content: {
          reference: contentReference,
          endpoint: 'bzz',
          filename: 'blog-content.md'
        },
        metadata: {
          reference: metadataReference,
          endpoint: 'bzz',
          filename: 'metadata.json'
        },
        assets: draft.usedAssets?.map(assetRef => ({
          reference: assetRef,
          endpoint: 'bzz' as const
        })) || []
      };
      
      // 9. Download and process content for preview
      const processedBlogContent = await this.contentService.downloadBlogContent(
        contentReference
      );
      
      return {
        content: processedBlogContent,
        metadata: nftMetadata,
        references,
        proposalCalldata,
        tokenURI
      };
      
    } catch (error) {
      console.error('Pipeline preparation failed:', error);
      throw new Error(`Failed to prepare content for publication: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`);
    }
  }

  /**
   * Create and submit a blog proposal
   */
  async createProposal(
    preparedContent: PreparedContent,
    proposalDescription: string
  ): Promise<string> {
    try {
      const proposal: BlogProposal = {
        title: preparedContent.content.title,
        content: preparedContent.content.content,
        contentReference: preparedContent.references.content.reference,
        preview: this.generateDescription(preparedContent.content.content),
        banner: preparedContent.content.metadata.banner || null,
        category: preparedContent.content.metadata.category,
        tags: preparedContent.content.metadata.tags,
        authorAddress: preparedContent.content.metadata.author,
        description: proposalDescription
      };
      
      const result = await this.proposalService.createBlogMintingProposal(proposal);
      
      if (result.status !== 'confirmed') {
        throw new Error('Proposal transaction failed');
      }
      
      // Extract proposal ID from transaction receipt
      // This would need implementation based on your contract events
      return 'proposal-id';
      
    } catch (error) {
      console.error('Proposal creation failed:', error);
      throw error;
    }
  }

  /**
   * Upload metadata to Swarm
   */
  private async uploadMetadata(metadata: BlogNFTMetadata): Promise<string> {
    const swarmService = (this.contentService as any).swarmService;
    const result = await swarmService.uploadJson(metadata, 'metadata.json');
    return result.reference;
  }

  /**
   * Validate draft for publication
   */
  private validateDraft(draft: UnifiedBlogData): ValidationResult {
    const errors: string[] = [];
    
    // Required fields
    if (!draft.title?.trim()) {
      errors.push('Title is required');
    } else if (draft.title.length > 100) {
      errors.push('Title must be 100 characters or less');
    }
    
    if (!draft.content?.trim()) {
      errors.push('Content is required');
    }
    
    if (!draft.category?.trim()) {
      errors.push('Category is required');
    }
    
    if (!draft.authorAddress?.trim()) {
      errors.push('Author address is required');
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(draft.authorAddress)) {
      errors.push('Invalid Ethereum address');
    }
    
    // Content size validation
    const contentSize = new TextEncoder().encode(draft.content).length;
    if (contentSize > 10 * 1024 * 1024) {
      errors.push('Content exceeds 10MB limit');
    }
    
    // Asset validation
    if (draft.usedAssets) {
      draft.usedAssets.forEach((ref: string, index: number) => {
        if (!/^[a-fA-F0-9]{64}$/.test(ref)) {
          errors.push(`Invalid asset reference at index ${index}`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate description from content
   */
  private generateDescription(content: string, maxLength: number = 160): string {
    const plainText = content
      .replace(/[#*_`\[\]()]/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    
    return plainText.length > maxLength
      ? plainText.substring(0, maxLength - 3) + '...'
      : plainText;
  }

  /**
   * Get pipeline status
   */
  async getStatus(): Promise<{
    servicesReady: boolean;
    hasLocalNode: boolean;
    hasPostageStamp: boolean;
  }> {
    const swarmService = (this.contentService as any).swarmService;
    const swarmStatus = await swarmService.getStatus();
    
    return {
      servicesReady: true,
      hasLocalNode: swarmStatus.nodeRunning,
      hasPostageStamp: swarmStatus.hasStamp
    };
  }
}