// src/pages/BlogEditorPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Dates, Optional, Strings } from 'cafe-utility';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useWallet } from '../contexts/WalletContext';
import { Bee } from '@ethersphere/bee-js';
import { NewPostPage } from '../NewPostPage';
import { Sidebar } from '../Sidebar';
import { OptionsBar } from '../OptionsBar';
import { Article, Asset, GlobalState, createArticlePage, parseMarkdown } from '../libetherjot';
import { parse } from 'marked';
import { DEFAULT_CONTENT } from '../Constants';
import './BlogEditorPage.css';
import { AssetBrowser } from '../asset-browser/AssetBrowser';

export const BlogEditorPage: React.FC = () => {
    const navigate = useNavigate();
    const { blogId } = useParams();
    const { 
        globalState, 
        updateGlobalState, 
        setShowAssetBrowser, 
        showAssetBrowser,
        showAssetPicker,
        setShowAssetPicker, 
        setAssetPickerCallback
    } = useGlobalState();
    
    const { isConnected, account } = useWallet();

    // Editor state
    const [articleTitle, setArticleTitle] = useState('');
    const [articleContent, setArticleContent] = useState(DEFAULT_CONTENT);
    const [articleBanner, setArticleBanner] = useState<string | null>(null);
    const [articleCategory, setArticleCategory] = useState<string>('');
    const [articleTags, setArticleTags] = useState<string>('');
    const [articleType, setArticleType] = useState<'regular' | 'h1' | 'h2'>('regular');
    const [articleDate, setArticleDate] = useState(Dates.isoDate());
    const [commentsFeed, setCommentsFeed] = useState<string>(Strings.randomHex(40));
    const [editing, setEditing] = useState<Article | false>(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Load article if editing existing one
    useEffect(() => {
        if (blogId && globalState.articles) {
            const article = globalState.articles.find(a => a.path === `blogs/${blogId}`);
            if (article) {
                loadArticleForEditing(article);
            }
        }
    }, [blogId, globalState.articles]);

    const loadArticleForEditing = async (article: Article) => {
        try {
            const bee = new Bee('http://localhost:1633');
            const raw = await bee.downloadFile(article.markdown);
            setEditing(article);
            setArticleTitle(article.title);
            setArticleContent(raw.data.text());
            setArticleBanner(article.banner);
            setArticleCategory(article.category);
            setArticleTags(article.tags.join(', '));
            setCommentsFeed(article.commentsFeed);
            
            let articleType: 'regular' | 'h1' | 'h2' = 'regular';
            if (article.kind === 'h1') {
                articleType = 'h1';
            }
            if (article.kind === 'h2') {
                articleType = 'h2';
            }
            setArticleType(articleType);
        } catch (error) {
            console.error("Error loading article:", error);
            setError("Failed to load article for editing");
        }
    };

    const handleSaveDraft = async () => {
        if (!articleTitle) {
            setError("Please enter a title for your blog");
            return;
        }
        
        setLoading(true);
        setError(null);
        
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
                isAutoSaved: false
            };
            
            // Save draft to localStorage
            localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(draft));
            
            setSuccess("Draft saved successfully!");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error saving draft:', err);
            setError('Failed to save draft');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!articleTitle || !articleContent || !articleCategory) {
            setError("Please fill in all required fields (title, content, category)");
            return;
        }
        
        if (!isConnected && !editing) {
            setError("Please connect your wallet to publish a new blog");
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            // Extract references to all images used in the content
            const { extractImageReferencesFromMarkdown } = await import('../utils/markdownUtils');
            const imageReferences = extractImageReferencesFromMarkdown(articleContent);
            
            // Make sure all referenced assets exist in the state
            const missingReferences = imageReferences.filter(
                ref => !globalState.assets.some(asset => asset.reference === ref)
            );
            
            if (missingReferences.length > 0) {
                console.warn('Some image references in content are not in the assets library:', missingReferences);
                // Optionally handle missing references - could show a warning to the user
            }
            
            // Ensure content uses permanent Swarm references
            const { replaceLocalImagesWithSwarmRefs } = await import('../utils/markdownUtils');
            const normalizedContent = replaceLocalImagesWithSwarmRefs(articleContent, globalState.assets);
            
            // Parse the normalized markdown
            const markdown = parseMarkdown(normalizedContent);
            
            // If editing an existing blog, update it
            if (editing) {
                // Remove the article being edited from the list
                await updateGlobalState(state => ({
                    ...state,
                    articles: state.articles.filter(x => x.html !== editing.html)
                }));
                
                // Create the new article
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
                
                // Add the new article to the global state
                await updateGlobalState(state => ({
                    ...state,
                    articles: [...state.articles, results]
                }));
                
                // Navigate to the new blog post
                navigate(`/blogs/${results.path}`);
            } else {
                // For new blogs, prepare for proposal submission
                
                // 1. CRITICAL: Upload to Swarm to get the content reference
                console.log('Uploading content to Swarm...');
                let contentReference: string;
                
                try {
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
                    
                    // Extract contentReference from results
                    contentReference = results.markdown;
                    
                    if (!contentReference) {
                        throw new Error('Failed to get content reference from Swarm upload');
                    }
                    
                    console.log(`Successfully uploaded to Swarm with reference: ${contentReference}`);
                } catch (error) {
                    console.error('Failed to upload content to Swarm:', error);
                    throw new Error('Content upload to Swarm failed');
                }
                
                // 2. Create a draft with the necessary information
                const draftId = `draft-${Date.now()}`;
                const draft = {
                    id: draftId,
                    title: articleTitle,
                    content: normalizedContent, // Use the normalized content with proper references
                    contentReference, // Swarm reference to the content
                    preview: articleBanner ? '' : String(markdown).substring(0, 200) + '...',
                    banner: articleBanner,
                    category: articleCategory,
                    tags: articleTags
                        .split(',')
                        .map(x => Strings.shrinkTrim(x))
                        .filter(x => x),
                    authorAddress: account || '',
                    lastModified: Date.now(),
                };
                
                // 3. Save the draft to local storage
                localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(draft));
                
                // 4. Navigate to the proposal submission page with the draft ID
                navigate(`/submit-proposal?draftId=${draftId}`);
            }
        } catch (err) {
            console.error("Error publishing blog:", err);
            setError(err instanceof Error ? err.message : 'Error publishing blog');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="blog-editor-page">
            <div className="editor-layout">
                <Sidebar
                    globalState={globalState}
                    setEditing={setEditing}
                    editing={editing}
                    articleContent={articleContent}
                    setArticleContent={setArticleContent}
                    setArticleTitle={setArticleTitle}
                    setArticleBanner={setArticleBanner}
                    setArticleCategory={setArticleCategory}
                    setArticleTags={setArticleTags}
                    setArticleCommentsFeed={setCommentsFeed}
                    setShowAssetBrowser={setShowAssetBrowser}
                    setArticleType={setArticleType}
                />
                
                <div className="editor-main">
                    <div className="editor-header">
                        <h1>{editing ? 'Edit Blog Post' : 'Create New Blog Post'}</h1>
                        
                        <div className="editor-toolbar">
                            <div className="editor-fields">
                                <div className="editor-field">
                                    <label htmlFor="title">Title<span className="required">*</span></label>
                                    <input 
                                        id="title"
                                        type="text" 
                                        value={articleTitle} 
                                        onChange={e => setArticleTitle(e.target.value)}
                                        placeholder="Enter blog title"
                                    />
                                </div>
                                
                                <div className="editor-field">
                                    <label htmlFor="category">Category<span className="required">*</span></label>
                                    <input 
                                        id="category"
                                        type="text" 
                                        value={articleCategory} 
                                        onChange={e => setArticleCategory(e.target.value)}
                                        placeholder="E.g. Technology, Philosophy"
                                    />
                                </div>
                            </div>
                            
                            <div className="editor-actions">
                                <button 
                                    className="draft-button"
                                    onClick={handleSaveDraft}
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Draft'}
                                </button>
                                
                                <button 
                                    className="publish-button"
                                    onClick={handlePublish}
                                    disabled={!articleTitle || !articleCategory || loading}
                                >
                                    {loading ? (editing ? 'Updating...' : 'Uploading...') : (editing ? 'Update Blog' : 'Submit Proposal')}
                                </button>
                            </div>
                        </div>
                        
                        {error && <div className="editor-error">{error}</div>}
                        {success && <div className="editor-success">{success}</div>}
                    </div>
                    
                    <div className="editor-content">
                        <NewPostPage 
                            articleContent={articleContent}
                            setArticleContent={setArticleContent}
                        />
                    </div>
                </div>
                
                <OptionsBar
                    globalState={globalState}
                    articleContent={articleContent}
                    articleTitle={articleTitle}
                    setArticleTitle={setArticleTitle}
                    articleBanner={articleBanner}
                    setArticleBanner={setArticleBanner}
                    articleCategory={articleCategory}
                    setArticleCategory={setArticleCategory}
                    articleTags={articleTags}
                    setArticleTags={setArticleTags}
                    editing={editing}
                    setEditing={setEditing}
                    articleType={articleType}
                    setArticleType={setArticleType}
                    commentsFeed={commentsFeed}
                    articleDate={articleDate}
                    setArticleDate={setArticleDate}
                    setShowAssetPicker={setShowAssetPicker}
                    setAssetPickerCallback={setAssetPickerCallback}
                />
            </div>
            
            {/* Show AssetBrowser when needed */}
            {showAssetBrowser && (
                <AssetBrowser
                    globalState={globalState}
                    setGlobalState={(state: GlobalState) => updateGlobalState(() => state)}
                    setShowAssetBrowser={setShowAssetBrowser} insertAsset={function (reference: string): void {
                        throw new Error('Function not implemented.');
                    } }                />
            )}
        </div>
    );
};