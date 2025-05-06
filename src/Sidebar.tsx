// src/Sidebar.tsx
import { Strings } from 'cafe-utility';
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { DEFAULT_CONTENT } from './Constants';
import { ExistingArticle } from './ExistingArticle';
import { Row } from './Row';
import './Sidebar.css';
import { Article, GlobalState } from './libetherjot';
import { useWallet } from './contexts/WalletContext';

interface Props {
    globalState: GlobalState;
    setTab?: (tab: string) => void;
    editing: Article | false;
    setEditing: (editing: Article | false) => void;
    articleContent: string;
    setArticleContent: (content: string) => void;
    setArticleTitle: (title: string) => void;
    setArticleBanner: (banner: string | null) => void;
    setArticleCategory: (category: string) => void;
    setArticleTags: (tags: string) => void;
    setArticleCommentsFeed: (commentsFeed: string) => void;
    setShowAssetBrowser: (show: boolean) => void;
    setArticleType: (type: 'regular' | 'h1' | 'h2') => void;
    mode?: 'standard' | 'proposal';
    onNewDraft?: () => void;
}

export function Sidebar({
    globalState,
    setTab = () => {},
    editing,
    setEditing,
    articleContent,
    setArticleContent,
    setArticleTitle,
    setArticleBanner,
    setArticleCategory,
    setArticleTags,
    setArticleCommentsFeed,
    setShowAssetBrowser,
    setArticleType,
    mode = 'standard',
    onNewDraft
}: Props) {
    const { account, isConnected } = useWallet();
    const [drafts, setDrafts] = useState<any[]>([]);
    const [showDrafts, setShowDrafts] = useState<boolean>(false);

    // Load drafts from localStorage
    useEffect(() => {
        if (mode === 'proposal' && isConnected) {
            loadDrafts();
        }
    }, [mode, isConnected]);

    const loadDrafts = () => {
        const draftKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('blog-draft-')
        );
        
        const loadedDrafts = draftKeys.map(key => {
            try {
                const draft = JSON.parse(localStorage.getItem(key) || '{}');
                // Filter by current user if connected
                if (account && draft.authorAddress && 
                    draft.authorAddress.toLowerCase() !== account.toLowerCase()) {
                    return null;
                }
                return { ...draft, storageKey: key };
            } catch (e) {
                console.error('Error parsing draft:', e);
                return null;
            }
        }).filter(Boolean);
        
        // Sort drafts by lastModified (newest first)
        loadedDrafts.sort((a, b) => b.lastModified - a.lastModified);
        
        setDrafts(loadedDrafts);
    };

    async function onReset() {
        const confirmed = await Swal.fire({
            title: 'Are you sure?',
            text: 'You will lose all your posts. You can export your blog from the settings page.',
            showCancelButton: true
        });
        if (!confirmed.isConfirmed) {
            return;
        }
        const confirmedAgain = await Swal.fire({
            title: 'Are you really sure?',
            text: 'Your blog will be reset. This cannot be undone.',
            showCancelButton: true
        });
        if (!confirmedAgain.isConfirmed) {
            return;
        }
        localStorage.clear();
        window.location.reload();
    }

    async function onNewArticle() {
        if (articleContent !== DEFAULT_CONTENT) {
            const confirmed = await Swal.fire({
                title: 'Are you sure?',
                text: 'You will lose unsaved changes',
                showCancelButton: true
            });
            if (!confirmed.isConfirmed) {
                return;
            }
        }
        setEditing(false);
        setArticleContent(DEFAULT_CONTENT);
        setArticleTitle('');
        setArticleBanner(null);
        setArticleCategory('');
        setArticleCommentsFeed(Strings.randomHex(40));
        setTab('new-post');
        setArticleType('regular');
        
        // Call the onNewDraft handler if provided (for proposal mode)
        if (mode === 'proposal' && onNewDraft) {
            onNewDraft();
        }
    }

    const onEditDraft = async (draft: any) => {
        if (articleContent !== DEFAULT_CONTENT) {
            const confirmed = await Swal.fire({
                title: 'Are you sure?',
                text: 'You will lose unsaved changes',
                showCancelButton: true
            });
            if (!confirmed.isConfirmed) {
                return;
            }
        }
        
        setArticleContent(draft.content || DEFAULT_CONTENT);
        setArticleTitle(draft.title || '');
        setArticleBanner(draft.banner || null);
        setArticleCategory(draft.category || '');
        
        // Handle tags - could be string or array
        if (draft.tags) {
            if (Array.isArray(draft.tags)) {
                setArticleTags(draft.tags.join(', '));
            } else if (typeof draft.tags === 'string') {
                setArticleTags(draft.tags);
            }
        } else {
            setArticleTags('');
        }
        
        setArticleType(draft.type || 'regular');
        
        // Remove the 'editing' state since we're working on a draft
        setEditing(false);
    };

    const onDeleteDraft = async (draft: any) => {
        const confirmed = await Swal.fire({
            title: 'Delete Draft?',
            text: 'This action cannot be undone',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Delete'
        });
        
        if (confirmed.isConfirmed && draft.storageKey) {
            localStorage.removeItem(draft.storageKey);
            loadDrafts();
        }
    };

    return (
        <aside className="sidebar">
            <Row>
                <p>{mode === 'proposal' ? 'Blog Drafts' : 'Posts'}</p>
                <button onClick={onNewArticle}>+</button>
            </Row>
            <button onClick={() => setShowAssetBrowser(true)}>Asset Browser</button>
            {editing && (
                <p className="editing">
                    <strong>Editing:</strong> {editing.title}
                </p>
            )}
            
            {/* Proposal mode shows drafts, standard mode shows published posts */}
            {mode === 'proposal' ? (
                <>
                    <div className="drafts-section">
                        <button 
                            className="toggle-drafts-button"
                            onClick={() => setShowDrafts(!showDrafts)}
                        >
                            {showDrafts ? 'Hide Drafts' : 'Show Drafts'} ({drafts.length})
                        </button>
                        
                        {showDrafts && (
                            <ul className="drafts-list">
                                {drafts.length === 0 && <p>No drafts yet</p>}
                                {drafts.map((draft, index) => (
                                    <li key={index} className="draft-item">
                                        <div className="draft-title">{draft.title || 'Untitled Draft'}</div>
                                        <div className="draft-date">
                                            {new Date(draft.lastModified).toLocaleDateString()}
                                        </div>
                                        <div className="draft-actions">
                                            <button 
                                                className="button-xs"
                                                onClick={() => onEditDraft(draft)}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                className="button-xs delete-button"
                                                onClick={() => onDeleteDraft(draft)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                <ul>
                    {!globalState.articles.length && <p>No posts yet</p>}
                    {globalState.articles.map((x, i) => (
                        <li key={i}>
                            <ExistingArticle
                                article={x}
                                globalState={globalState}
                                setTab={setTab}
                                setEditing={setEditing}
                                articleContent={articleContent}
                                setArticleContent={setArticleContent}
                                setArticleTitle={setArticleTitle}
                                setArticleBanner={setArticleBanner}
                                setArticleCategory={setArticleCategory}
                                setArticleTags={setArticleTags}
                                setArticleCommentsFeed={setArticleCommentsFeed}
                                setArticleType={setArticleType}
                            />
                        </li>
                    ))}
                </ul>
            )}
            <button onClick={onReset}>Reset</button>
        </aside>
    );
}