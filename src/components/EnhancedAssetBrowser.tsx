// src/components/EnhancedAssetBrowser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { assetService, Asset } from '../services/AssetService';
import './EnhancedAssetBrowser.css';

interface AssetThumbnailProps {
  asset: Asset;
  onInsert: (asset: Asset) => void;
  onRename: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

const AssetThumbnail: React.FC<AssetThumbnailProps> = ({
  asset,
  onInsert,
  onRename,
  onDelete
}) => {
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Try to load image with fallback URLs
  useEffect(() => {
    const loadImageWithFallbacks = async () => {
      setIsLoading(true);
      setImageError(false);
      
      // Get all possible URLs for this asset
      const urls = assetService.getAssetUrls(asset);
      const allUrls = [urls.local, urls.public, ...urls.fallbacks];
      
      // Try each URL until one works
      for (const url of allUrls) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            setCurrentImageUrl(url);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          // Continue to next URL
          continue;
        }
      }
      
      // If no URL works, show error state
      setImageError(true);
      setIsLoading(false);
    };

    if (asset.contentType.startsWith('image/')) {
      loadImageWithFallbacks();
    } else {
      setIsLoading(false);
    }
  }, [asset]);

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleInsertAsset = () => {
    // Always use public gateway for inserted assets so they're viewable by everyone
    onInsert(asset);
  };

  return (
    <div className="asset-thumbnail">
      <div className="thumbnail-image">
        {isLoading ? (
          <div className="thumbnail-placeholder">
            <span className="file-icon">⏳</span>
            <span>Loading...</span>
          </div>
        ) : asset.contentType.startsWith('image/') && !imageError && currentImageUrl ? (
          <img 
            src={currentImageUrl}
            alt={asset.name}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="thumbnail-placeholder">
            <span className="file-icon">
              {asset.contentType.startsWith('image/') ? '🖼️' : '📄'}
            </span>
            <span className="file-extension">
              {asset.name.split('.').pop()?.toUpperCase() || 'FILE'}
            </span>
          </div>
        )}
      </div>
      
      <div className="thumbnail-info">
        <div className="thumbnail-name" title={asset.name}>
          {asset.name}
        </div>
        <div className="thumbnail-meta">
          <span className="file-size">{formatFileSize(asset.size)}</span>
          <span className="upload-date">
            {new Date(asset.uploadedAt).toLocaleDateString()}
          </span>
        </div>
        
        {/* Gateway status indicator */}
        <div className="gateway-status">
          <GatewayStatusIndicator asset={asset} />
        </div>
      </div>
      
      <div className="thumbnail-actions">
        <button 
          className="action-btn insert-btn"
          onClick={handleInsertAsset}
          title="Insert into editor (uses public gateway)"
        >
          📎
        </button>
        <button 
          className="action-btn rename-btn"
          onClick={() => onRename(asset)}
          title="Rename asset"
        >
          ✏️
        </button>
        <button 
          className="action-btn delete-btn"
          onClick={() => onDelete(asset)}
          title="Delete asset"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

/**
 * Component to show gateway accessibility status
 */
const GatewayStatusIndicator: React.FC<{ asset: Asset }> = ({ asset }) => {
  const [status, setStatus] = useState<{
    local: boolean;
    public: boolean;
    checking: boolean;
  }>({
    local: false,
    public: false,
    checking: false
  });

  const checkGatewayStatus = async () => {
    setStatus(prev => ({ ...prev, checking: true }));
    
    try {
      const validation = await assetService.validateAssetAccess(asset);
      const urls = assetService.getAssetUrls(asset);
      
      setStatus({
        local: validation.workingUrls.includes(urls.local),
        public: validation.workingUrls.includes(urls.public),
        checking: false
      });
    } catch (error) {
      setStatus({ local: false, public: false, checking: false });
    }
  };

  useEffect(() => {
    checkGatewayStatus();
  }, [asset.reference]);

  if (status.checking) {
    return <span className="status-checking" title="Checking accessibility">🔄</span>;
  }

  return (
    <div className="gateway-indicators">
      <span 
        className={`gateway-indicator ${status.local ? 'available' : 'unavailable'}`}
        title={`Local gateway: ${status.local ? 'Available' : 'Unavailable'}`}
      >
        {status.local ? '🟢' : '🔴'} Local
      </span>
      <span 
        className={`gateway-indicator ${status.public ? 'available' : 'unavailable'}`}
        title={`Public gateway: ${status.public ? 'Available' : 'Unavailable'}`}
      >
        {status.public ? '🟢' : '🔴'} Public
      </span>
    </div>
  );
};

interface EnhancedAssetBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertAsset: (markdownCode: string) => void;
}

export const EnhancedAssetBrowser: React.FC<EnhancedAssetBrowserProps> = ({
  isOpen,
  onClose,
  onInsertAsset
}) => {
  const { account, isConnected } = useWallet();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [gatewayMode, setGatewayMode] = useState<'local' | 'public'>('public');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load assets when browser opens or account changes
  useEffect(() => {
    if (isOpen && isConnected && account) {
      loadAssets();
    }
  }, [isOpen, isConnected, account]);

  // Load assets from localStorage
  const loadAssets = () => {
    if (!account) return;
    const userAssets = assetService.getAssets(account);
    setAssets(userAssets);
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !account) return;

    setLoading(true);
    setUploadError(null);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`);
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`${file.name} is too large (max 10MB)`);
        }

        return await assetService.uploadAsset(file, account);
      });

      const uploadedAssets = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${uploadedAssets.length} assets`);
      
      // Reload assets
      loadAssets();
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle asset insertion
  const handleInsertAsset = (asset: Asset) => {
    // Generate markdown with public gateway for published content
    const markdownCode = assetService.generateAssetMarkdown(
      asset, 
      undefined, // Use default alt text
      gatewayMode === 'public' // Use public gateway based on mode
    );
    
    onInsertAsset(markdownCode);
    onClose(); // Close browser after insertion
  };

  // Handle asset rename
  const handleRenameAsset = async (asset: Asset) => {
    const newName = prompt('Enter new name:', asset.name);
    if (!newName || newName === asset.name || !account) return;

    const success = assetService.updateAsset(asset.id, account, { name: newName });
    if (success) {
      loadAssets(); // Reload to show changes
    } else {
      alert('Failed to rename asset');
    }
  };

  // Handle asset deletion
  const handleDeleteAsset = async (asset: Asset) => {
    if (!window.confirm(`Are you sure you want to delete "${asset.name}"?\n\nThis will remove it from your asset library. The file may persist on Swarm.`)) {
      return;
    }

    if (!account) return;

    const success = assetService.deleteAsset(asset.id, account);
    if (success) {
      loadAssets(); // Reload to show changes
    } else {
      alert('Failed to delete asset');
    }
  };

  // Filter and sort assets
  const filteredAndSortedAssets = assets
    .filter(asset => 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.contentType.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'date':
        default:
          return b.uploadedAt - a.uploadedAt;
      }
    });

  // Get storage stats
  const stats = account ? assetService.getStorageStats(account) : null;

  if (!isOpen) return null;

  return (
    <div className="asset-browser-overlay">
      <div className="asset-browser-modal">
        <div className="asset-browser-header">
          <h2>Asset Library</h2>
          <button 
            className="close-btn"
            onClick={onClose}
            aria-label="Close asset browser"
          >
            ✕
          </button>
        </div>

        {!isConnected ? (
          <div className="browser-message">
            <p>Connect your wallet to access your asset library</p>
          </div>
        ) : (
          <>
            <div className="asset-browser-controls">
              <div className="upload-section">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button 
                  className="upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  {loading ? 'Uploading...' : '📤 Upload Images'}
                </button>
                {uploadError && (
                  <div className="error-message">{uploadError}</div>
                )}
              </div>

              <div className="browser-filters">
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                  className="sort-select"
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                </select>
                <select
                  value={gatewayMode}
                  onChange={(e) => setGatewayMode(e.target.value as 'local' | 'public')}
                  className="gateway-select"
                  title="Choose gateway for inserted URLs"
                >
                  <option value="public">🌐 Public Gateway</option>
                  <option value="local">🏠 Local Gateway</option>
                </select>
              </div>
            </div>

            {stats && (
              <div className="storage-stats">
                <span>{stats.totalAssets} assets</span>
                <span>•</span>
                <span>{(stats.totalSize / (1024 * 1024)).toFixed(1)} MB total</span>
                <span>•</span>
                <span className="gateway-mode-indicator">
                  Using {gatewayMode === 'public' ? 'public' : 'local'} gateway for insertions
                </span>
              </div>
            )}

            <div className="assets-grid">
              {filteredAndSortedAssets.length === 0 ? (
                <div className="no-assets">
                  {searchTerm ? (
                    <p>No assets match your search</p>
                  ) : (
                    <div>
                      <p>No assets uploaded yet</p>
                      <p>Click "Upload Images" to add your first asset</p>
                    </div>
                  )}
                </div>
              ) : (
                filteredAndSortedAssets.map(asset => (
                  <AssetThumbnail
                    key={asset.id}
                    asset={asset}
                    onInsert={handleInsertAsset}
                    onRename={handleRenameAsset}
                    onDelete={handleDeleteAsset}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};