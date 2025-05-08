// src/EditorPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Dates, Optional, Strings } from 'cafe-utility';
import { useGlobalState } from './contexts/GlobalStateContext';
import { useWallet } from './contexts/WalletContext';
import { Bee } from '@ethersphere/bee-js';
import { NewPostPage } from './NewPostPage';
import { Sidebar } from './Sidebar';
import { OptionsBar } from './OptionsBar';
import { Article, Asset, GlobalState } from './libetherjot';
import { DEFAULT_CONTENT } from './Constants';
import { AssetBrowser } from './asset-browser/AssetBrowser';

// CSS styles will be merged from BlogEditorPage.css
import './EditorPage.css';

interface EditorPageProps {
    mode?: 'standard' | 'proposal';
}

export const EditorPage: React.FC<EditorPageProps> = ({ mode = 'standard' }) => {
    const navigate = useNavigate();
    const { blogId } = useParams();
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get('draftId');
    
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
    
    // For proposal mode - content reference
    const [contentReference, setContentReference] = useState<string>('');

    // Check if wallet is connected for proposal mode
    useEffect(() => {
        if (mode === 'proposal' && !isConnected) {
            // Redirect to connect wallet or home page
            navigate('/');
        }
    }, [mode, isConnected, navigate]);

    // Load article if editing existing one
    useEffect(() => {
        if (blogId && globalState.articles) {
            const article = globalState.articles.find(a => a.path === `blogs/${blogId}`);
            if (article) {
                loadArticleForEditing(article);
            }
        }
    }, [blogId, globalState.articles]);

    // Load draft if draftId is provided
    useEffect(() => {
        if (draftId) {
            const draftKey = `blog-draft-${draftId}`;
            const draftJson = localStorage.getItem(draftKey);
            
            if (draftJson) {
                try {
                    const draft = JSON.parse(draftJson);
                    setArticleTitle(draft.title || '');
                    setArticleContent(draft.content || DEFAULT_CONTENT);
                    setArticleBanner(draft.banner || null);
                    setArticleCategory(draft.category || '');
                    
                    // Handle tags - could be string or array
                    if (draft.tags) {
                        if (Array.isArray(draft.tags)) {
                            setArticleTags(draft.tags.join(', '));
                        } else if (typeof draft.tags === 'string') {
                            setArticleTags(draft.tags);
                        }
                    }
                    
                    // Set content reference if available (for proposal mode)
                    if (draft.contentReference) {
                        setContentReference(draft.contentReference);
                    }
                    
                    setArticleType(draft.type || 'regular');
                } catch (error) {
                    console.error("Error parsing draft:", error);
                    setError("Failed to load draft");
                }
            }
        }
    }, [draftId]);

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

    // Handle creating a new draft
    const handleNewDraft = () => {
        setArticleContent(DEFAULT_CONTENT);
        setArticleTitle('');
        setArticleBanner(null);
        setArticleCategory('');
        setArticleTags('');
        setArticleType('regular');
        setContentReference('');
        setEditing(false);
    };

    return (
        <div className="editor-page">
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
                    mode={mode}
                    onNewDraft={handleNewDraft}
                />
                
                <div className="editor-main">
                    <div className="editor-header">
                        <h1>
                            {editing 
                                ? 'Edit Blog Post' 
                                : mode === 'proposal' 
                                    ? 'Create Blog Proposal' 
                                    : 'Create New Blog Post'
                            }
                        </h1>
                        
                        {error && <div className="editor-error">{error}</div>}
                        {success && <div className="editor-success">{success}</div>}
                    </div>
                    
                    <div className="editor-content">
                        <NewPostPage 
                            articleContent={articleContent}
                            setArticleContent={setArticleContent}
                            contentReference={contentReference}
                            readOnly={!!contentReference} // Read-only if content has already been uploaded
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
                    contentReference={contentReference}
                    setContentReference={setContentReference}
                    mode={mode}
                />
            </div>
            
            {/* Show AssetBrowser when needed */}
            {showAssetBrowser && (
                <AssetBrowser
                    globalState={globalState}
                    setGlobalState={(state: GlobalState) => updateGlobalState(() => state)}
                    setShowAssetBrowser={setShowAssetBrowser}
                    insertAsset={(reference: string) => {
                        // Insert image at cursor in editor
                        const imageMarkdown = `![Image](https://gateway.ethswarm.org/bzz/${reference})`;
                        setArticleContent(articleContent + '\n' + imageMarkdown);
                    }}
                />
            )}
        </div>
    );
};