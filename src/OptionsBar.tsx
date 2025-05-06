// src/OptionsBar.tsx
import { Optional, Strings } from 'cafe-utility';
import { parse } from 'marked';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Article, Asset, GlobalState, createArticlePage, parseMarkdown } from './libetherjot';
import { save } from './Saver';
import './Sidebar.css';
import { Vertical } from './Vertical';
import { useWallet } from './contexts/WalletContext';
import React from 'react';
import { Swarm } from './libswarm';

interface Props {
    globalState: GlobalState;
    articleContent: string;
    articleTitle: string;
    setArticleTitle: (title: string) => void;
    articleBanner: string | null;
    setArticleBanner: (banner: string | null) => void;
    articleCategory: string;
    setArticleCategory: (category: string) => void;
    articleTags: string;
    setArticleTags: (tags: string) => void;
    editing: Article | false;
    setEditing: (editing: Article | false) => void;
    articleType: 'regular' | 'h1' | 'h2';
    setArticleType: (type: 'regular' | 'h1' | 'h2') => void;
    commentsFeed: string;
    articleDate: string;
    setArticleDate: (date: string) => void;
    setShowAssetPicker: (show: boolean) => void;
    setAssetPickerCallback: (callback: (asset: Optional<Asset>) => void) => void;
    contentReference?: string;
    setContentReference?: (reference: string) => void;
    mode?: 'standard' | 'proposal';
}

export function OptionsBar({
    globalState,
    articleContent,
    articleTitle,
    setArticleTitle,
    articleBanner,
    setArticleBanner,
    articleCategory,
    setArticleCategory,
    articleTags,
    setArticleTags,
    editing,
    setEditing,
    articleType,
    setArticleType,
    commentsFeed,
    articleDate,
    setArticleDate,
    setShowAssetPicker,
    setAssetPickerCallback,
    contentReference,
    setContentReference,
    mode = 'standard'
}: Props) {
    const navigate = useNavigate();
    const { account, isConnected } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const markdown = parseMarkdown(articleContent);

    // Handle saving a draft
    const handleSaveDraft = useCallback(async () => {
        if (!articleTitle) {
            setError("Please enter a title for your blog");
            return;
        }
        
        try {
            // Create a draft object
            const draftId = `draft-${Date.now()}`;
            const draft = {
                id: draftId,
                title: articleTitle,
                content: articleContent,
                preview: articleContent.substring(0, 200) + '...',
                banner: articleBanner,
                category: articleCategory,
                tags: articleTags.split(',').map(tag => tag.trim()).filter(tag => tag),
                authorAddress: account || '',
                lastModified: Date.now(),
                isAutoSaved: false,
                contentReference: contentReference || ''
            };
            
            // Save draft to localStorage
            localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(draft));
            
            setSuccess("Draft saved successfully!");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error saving draft:', err);
            setError('Failed to save draft');
        }
    }, [articleTitle, articleContent, articleBanner, articleCategory, articleTags, account, contentReference]);

    // Handle saving content to Swarm for proposal
    const handlePrepareForProposal = useCallback(async () => {
        if (!articleTitle || !articleContent || !articleCategory) {
            setError("Please fill in all required fields (title, content, category)");
            return;
        }
        
        if (!isConnected) {
            setError("Please connect your wallet to publish");
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            // Skip upload if we already have a content reference
            if (contentReference) {
                // Create a draft with the existing reference
                const draftId = `draft-${Date.now()}`;
                const draft = {
                    id: draftId,
                    title: articleTitle,
                    content: articleContent,
                    contentReference,
                    preview: articleBanner ? '' : String(articleContent).substring(0, 200) + '...',
                    banner: articleBanner,
                    category: articleCategory,
                    tags: articleTags
                        .split(',')
                        .map(x => Strings.shrinkTrim(x))
                        .filter(x => x),
                    authorAddress: account || '',
                    lastModified: Date.now(),
                };
                
                localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(draft));
                navigate(`/submit-proposal?draftId=${draftId}`);
                return;
            }
            
            // 1. Upload content to Swarm to get reference
            console.log('Uploading content to Swarm...');
            const swarm = new Swarm({
                beeApi: 'http://localhost:1633',
                postageBatchId: globalState.postageBatchId
            });
            
            // Upload blog content to Swarm with standardized filename
            const resource = await swarm.newResource(
                'content.md', // Standardized filename
                articleContent,
                'text/markdown'
            );
            
            const result = await resource.save();
            const newContentReference = result.hash;
            
            // Update content reference if available
            if (setContentReference) {
                setContentReference(newContentReference);
            }
            
            // 2. Create a draft with the content reference
            const draftId = `draft-${Date.now()}`;
            const draft = {
                id: draftId,
                title: articleTitle,
                content: articleContent,
                contentReference: newContentReference,
                preview: articleBanner ? '' : String(articleContent).substring(0, 200) + '...',
                banner: articleBanner,
                category: articleCategory,
                tags: articleTags
                    .split(',')
                    .map(x => Strings.shrinkTrim(x))
                    .filter(x => x),
                authorAddress: account || '',
                lastModified: Date.now(),
            };
            
            localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(draft));
            
            // 3. Navigate to proposal submission page
            navigate(`/submit-proposal?draftId=${draftId}`);
        } catch (err) {
            console.error('Error preparing for proposal:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [
        articleTitle, articleContent, articleCategory, articleBanner, articleTags,
        isConnected, account, contentReference, setContentReference, navigate, globalState
    ]);

    // Standard publish function (original Etherjot behavior)
    const handleStandardPublish = async () => {
        if (!articleTitle || !articleContent) {
            return;
        }
        setLoading(true);
        if (editing) {
            globalState.articles = globalState.articles.filter(x => x.html !== editing.html);
        }
        const results = await createArticlePage(
            articleTitle,
            markdown,
            globalState,
            articleCategory,
            articleTags
                .split(',')
                .map(x => Strings.shrinkTrim(x))
                .filter(x => x),
            articleBanner || '',
            articleDate,
            commentsFeed,
            articleType,
            parse
        );
        globalState.articles.push(results);
        await save(globalState);
        setEditing(false);
        setLoading(false);
        setSuccess("Article published successfully!");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    return (
        <aside className="sidebar options-bar">
            <Vertical left gap={2}>
                <label>
                    <strong>Title*</strong>
                </label>
                <input type="text" value={articleTitle} onChange={event => setArticleTitle(event.target.value)} />
            </Vertical>
            <Vertical left gap={2}>
                <label>
                    <strong>Category*</strong>
                </label>
                <input type="text" value={articleCategory} onChange={event => setArticleCategory(event.target.value)} />
            </Vertical>
            <Vertical left gap={2}>
                <label>
                    <strong>Date*</strong>
                </label>
                <input type="text" value={articleDate} onChange={event => setArticleDate(event.target.value)} />
            </Vertical>
            <Vertical left gap={2} full>
                <label>Banner image</label>
                {articleBanner && <img src={`http://localhost:1633/bytes/${articleBanner}`} alt="Banner preview" />}
                <button
                    onClick={() => {
                        setShowAssetPicker(true);
                        const callbackFn = (asset: Optional<Asset>) => {
                            asset.ifPresent(a => {
                                setArticleBanner(a.reference);
                            });
                            setShowAssetPicker(false);
                        };
                        setAssetPickerCallback(() => callbackFn);
                    }}
                >
                    Select
                </button>
            </Vertical>
            <Vertical left gap={2} full>
                <label>Type</label>
                <select
                    onChange={event => {
                        if (event.target.value === 'regular') {
                            setArticleType('regular');
                        }
                        if (event.target.value === 'h1') {
                            setArticleType('h1');
                        }
                        if (event.target.value === 'h2') {
                            setArticleType('h2');
                        }
                    }}
                    value={articleType}
                >
                    <option value="regular">Regular</option>
                    <option value="h1">Primary</option>
                    <option value="h2">Secondary</option>
                </select>
            </Vertical>
            <Vertical left gap={2}>
                <label>Tags (comma separated)</label>
                <input type="text" value={articleTags} onChange={event => setArticleTags(event.target.value)} />
            </Vertical>
            
            {/* Display error or success messages */}
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            {/* Different action buttons based on mode */}
            {mode === 'proposal' ? (
                <div className="button-group">
                    <button 
                        onClick={handleSaveDraft} 
                        disabled={loading}
                        className="save-draft-button"
                    >
                        {loading ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button 
                        onClick={handlePrepareForProposal} 
                        disabled={!articleTitle || !articleCategory || loading}
                        className="submit-proposal-button"
                    >
                        {loading ? 'Preparing...' : 'Submit Proposal'}
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleStandardPublish} 
                    disabled={!articleTitle || !articleCategory || loading}
                >
                    {loading ? 'Saving...' : editing ? 'Update' : 'Publish'}
                </button>
            )}
            
            {/* Content reference display */}
            {contentReference && (
                <div className="content-reference">
                    <label>Content Reference:</label>
                    <div className="reference-value">{contentReference}</div>
                </div>
            )}
        </aside>
    );
}