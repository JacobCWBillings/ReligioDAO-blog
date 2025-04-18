import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Dates, Optional, Strings } from 'cafe-utility';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { useWallet } from '../contexts/WalletContext';
import { Bee } from '@ethersphere/bee-js';
import { NewPostPage } from '../NewPostPage';
import { Sidebar } from '../Sidebar';
import { Asset, Article, createArticlePage, parseMarkdown } from '../libetherjot';
import { parse } from 'marked';
import { DEFAULT_CONTENT } from '../Constants';
import './BlogEditorPage.css';
import { AssetBrowser } from '../asset-browser/AssetBrowser';
import EditorAssetManager from '../components/editor/EditorAssetManager';

export const BlogEditorPage: React.FC = () => {
    const navigate = useNavigate();
    const { blogId } = useParams();
    const { 
        globalState, 
        updateGlobalState, 
        setShowAssetBrowser, 
        showAssetBrowser,
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
    const [assetInsertionHandler, setAssetInsertionHandler] = useState<((reference: string) => void) | null>(null);

    // Redirect if not connected
    useEffect(() => {
        if (!isConnected) {
            navigate('/');
        }
    }, [isConnected, navigate]);

    // Load article if editing existing one
    useEffect(() => {
        if (blogId && globalState.articles) {
            const article = globalState.articles.find(a => a.path.includes(blogId));
            if (article) {
                loadArticleForEditing(article);
            }
        }
    }, [blogId, globalState.articles]);

    // Function to handle asset insertion
    const handleInsertAsset = (reference: string) => {
        if (assetInsertionHandler) {
            assetInsertionHandler(reference);
        } else {
            // Fallback if the handler isn't set
            const imageMarkdown = `![Image](http://localhost:1633/bytes/${reference})`;
            setArticleContent(articleContent + '\n' + imageMarkdown);
        }
        
        // Close the asset browser
        setShowAssetBrowser(false);
    };

    // Expose asset insertion function globally for browser integration
    useEffect(() => {
        // @ts-ignore - Adding a property to window
        window.insertAssetIntoEditor = (reference: string) => {
            if (assetInsertionHandler) {
                assetInsertionHandler(reference);
            }
        };
        
        return () => {
            // Clean up when component unmounts
            // @ts-ignore - Removing a property from window
            delete window.insertAssetIntoEditor;
        };
    }, [assetInsertionHandler]);

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
            // Handle error - maybe show notification
        }
    };

    const handlePublish = async () => {
        if (!articleTitle || !articleContent) {
            return;
        }
        
        setLoading(true);
        
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
                // Upload to Swarm to get the content reference
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
                
                // Create a draft with the necessary information
                const draftId = `draft-${Date.now()}`;
                const draft = {
                    id: draftId,
                    title: articleTitle,
                    content: normalizedContent, // Use the normalized content with proper references
                    contentReference: results.markdown, // Swarm reference to the content
                    preview: results.preview,
                    banner: articleBanner,
                    category: articleCategory,
                    tags: articleTags
                        .split(',')
                        .map(x => Strings.shrinkTrim(x))
                        .filter(x => x),
                    authorAddress: account || '',
                    lastModified: Date.now(),
                };
                
                // Save the draft to local storage
                localStorage.setItem(`blog-draft-${draftId}`, JSON.stringify(draft));
                
                // Navigate to the proposal submission page with the draft ID
                navigate(`/submit-proposal?draftId=${draftId}`);
            }
        } catch (error) {
            console.error("Error publishing blog:", error);
            // Handle error - maybe show notification
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="blog-editor-page">
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
            
            <div className="editor-container">
                <EditorAssetManager onInsertAsset={handleInsertAsset} />
                <NewPostPage 
                    articleContent={articleContent} 
                    setArticleContent={setArticleContent}
                    onInsertAsset={(handler) => setAssetInsertionHandler(() => handler)}
                />
            </div>
            
            {/* Show AssetBrowser when needed */}
            {showAssetBrowser && (
                <AssetBrowser
                    globalState={globalState}
                    setGlobalState={(state) => updateGlobalState(() => state)}
                    setShowAssetBrowser={setShowAssetBrowser}
                    insertAsset={handleInsertAsset}
                />
            )}
            
            <div className="editor-options">
                <div className="editor-options-content">
                    <h2>{editing ? 'Edit Blog Post' : 'Create New Blog Post'}</h2>
                    
                    <div className="form-group">
                        <label htmlFor="title">Title*</label>
                        <input 
                            id="title"
                            type="text" 
                            value={articleTitle} 
                            onChange={e => setArticleTitle(e.target.value)} 
                            placeholder="Enter blog title"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="category">Category*</label>
                        <input 
                            id="category"
                            type="text" 
                            value={articleCategory} 
                            onChange={e => setArticleCategory(e.target.value)} 
                            placeholder="E.g. Technology, Philosophy, Art"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="tags">Tags (comma separated)</label>
                        <input 
                            id="tags"
                            type="text" 
                            value={articleTags} 
                            onChange={e => setArticleTags(e.target.value)} 
                            placeholder="E.g. blockchain, ethics, future"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="date">Publication Date</label>
                        <input 
                            id="date"
                            type="text" 
                            value={articleDate} 
                            onChange={e => setArticleDate(e.target.value)} 
                            placeholder="YYYY-MM-DD"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="type">Display Type</label>
                        <select 
                            id="type"
                            value={articleType}
                            onChange={e => setArticleType(e.target.value as 'regular' | 'h1' | 'h2')}
                        >
                            <option value="regular">Regular</option>
                            <option value="h1">Primary (Large)</option>
                            <option value="h2">Secondary (Medium)</option>
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label>Banner Image</label>
                        {articleBanner && (
                            <div className="image-preview">
                                <img src={`http://localhost:1633/bytes/${articleBanner}`} alt="Banner preview" />
                            </div>
                        )}
                        <button 
                            onClick={() => {
                                setAssetPickerCallback(() => (asset: Optional<Asset>) => {
                                    asset.ifPresent(a => {
                                        setArticleBanner(a.reference);
                                    });
                                    setShowAssetPicker(false);
                                });
                                setShowAssetPicker(true);
                            }}
                        >
                            Select Banner Image
                        </button>
                    </div>
                    
                    <div className="form-actions">
                        <button 
                            className="cancel-button"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </button>
                        <button 
                            className="publish-button"
                            onClick={handlePublish}
                            disabled={!articleTitle || !articleCategory || loading}
                        >
                            {loading ? 'Saving...' : editing ? 'Update Blog' : 'Submit Proposal'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};