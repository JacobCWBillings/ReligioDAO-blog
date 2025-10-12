// src/components/EnhancedAssetBrowser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../../../contexts/WalletContext';
import { services } from '../../../swarm/services'; // Use new unified service container
import { Asset, AssetUrls } from '../../../types/contentTypes';
import './EnhancedAssetBrowser.css';

interface AssetThumbnailProps {
  asset: Asset;
  isSelected: boolean;
  isDefaultSelected: boolean;
  onInsert: (asset: Asset) => void;
  onRename: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onSelect: (asset: Asset) => void;
}

const AssetThumbnail: React.FC<AssetThumbnailProps> = ({
  asset,
  isSelected,
  isDefaultSelected,
  onInsert,
  onRename,
  onDelete,
  onSelect
}) => {
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Load image with fallback URLs using new service
  useEffect(() => {
    const loadImageWithFallbacks = async () => {
      setIsLoading(true);
      setImageError(false);
      
      // Get URLs using new AssetService
      const urls = services.assets.getAssetUrls(asset);
      // All URLs now correctly use bzz endpoint for web display
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
    onInsert(asset);
  };

  const handleThumbnailClick = () => {
    onSelect(asset);
  };

  const showActions = isSelected || isDefaultSelected;

  return (
    <div 
      className={`asset-thumbnail ${isSelected ? 'selected' : ''} ${isDefaultSelected ? 'default-selected' : ''}`}
      onClick={handleThumbnailClick}
    >
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
        
        <div className="gateway-status">
          <GatewayStatusIndicator asset={asset} />
        </div>
      </div>
      
      <div className={`thumbnail-actions ${showActions ? 'visible' : ''}`}>
        <button 
          className="action-btn insert-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleInsertAsset();
          }}
          title="Insert into editor"
        >
          📎
        </button>
        <button 
          className="action-btn rename-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRename(asset);
          }}
          title="Rename asset"
        >
          ✏️
        </button>
        <button 
          className="action-btn delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(asset);
          }}
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
      // Use new service method for validation
      const validation = await services.assets.validateAssetAccess(asset);
      const urls = services.assets.getAssetUrls(asset);
      
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
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [defaultSelectedAsset, setDefaultSelectedAsset] = useState<Asset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load assets when browser opens or account changes
  useEffect(() => {
    if (isOpen && isConnected && account) {
      loadAssets();
    }
  }, [isOpen, isConnected, account]);

  // Set default selected asset when assets load
  useEffect(() => {
    if (assets.length > 0 && !defaultSelectedAsset) {
      const sortedAssets = [...assets].sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'size':
            return b.size - a.size;
          case 'date':
          default:
            return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
      });
      setDefaultSelectedAsset(sortedAssets[0]);
    }
  }, [assets, sortBy, defaultSelectedAsset]);

  // Load assets using new service
  const loadAssets = () => {
    if (!account) return;
    const userAssets = services.assets.getAssets(account);
    setAssets(userAssets);
  };

  // Handle file upload using new service
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

        // Use new AssetService for upload
        return await services.assets.uploadAsset(file, account);
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
      setUploadError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setLoading(false);
    }
  };

  // Handle asset insertion using new service
  const handleInsertAsset = (asset: Asset) => {
    // Generate markdown using new service (always uses bzz for web display)
    const markdownCode = services.assets.generateAssetMarkdown(
      asset,
      undefined, // Use default alt text
      true // Always use public gateway for maximum compatibility
    );
    onInsertAsset(markdownCode);
  };

  // Handle asset renaming using new service
  const handleRenameAsset = (asset: Asset) => {
    const newName = prompt('Enter new name for asset:', asset.name);
    if (newName && newName.trim() && newName !== asset.name) {
      try {
        services.assets.renameAsset(asset.id, newName.trim(), account!);
        loadAssets();
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Failed to rename asset');
      }
    }
  };

  // Handle asset deletion using new service
  const handleDeleteAsset = (asset: Asset) => {
    if (window.confirm(`Are you sure you want to delete "${asset.name}"?`)) {
      try {
        services.assets.deleteAsset(asset.id, account!);
        loadAssets();
        
        if (selectedAsset?.id === asset.id) {
          setSelectedAsset(null);
        }
        if (defaultSelectedAsset?.id === asset.id) {
          setDefaultSelectedAsset(null);
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Failed to delete asset');
      }
    }
  };

  // Handle asset selection
  const handleAssetSelect = (asset: Asset) => {
    setSelectedAsset(asset === selectedAsset ? null : asset);
    if (defaultSelectedAsset) {
      setDefaultSelectedAsset(null);
    }
  };

  // Filter and sort assets
  const filteredAndSortedAssets = assets
    .filter(asset => 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'date':
        default:
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });

  // Get storage statistics using new service
  const storageStats = account ? 
    services.assets.getStorageStats(account) : null;

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
                  {loading ? '⏳ Uploading...' : '📷 Upload Images'}
                </button>
                
                {uploadError && (
                  <div className="error-message">{uploadError}</div>
                )}
              </div>

              <div className="browser-filters">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                </select>
              </div>
            </div>

            {/* Storage stats */}
            {storageStats && (
              <div className="storage-stats">
                <span className="stats-info">
                  {storageStats.totalAssets} assets • 
                  {(storageStats.totalSize / (1024 * 1024)).toFixed(2)} MB total
                </span>
                <span className="endpoint-info">
                  Using bzz endpoint for web display
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
                    isSelected={selectedAsset?.id === asset.id}
                    isDefaultSelected={defaultSelectedAsset?.id === asset.id && !selectedAsset}
                    onInsert={handleInsertAsset}
                    onRename={handleRenameAsset}
                    onDelete={handleDeleteAsset}
                    onSelect={handleAssetSelect}
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

export default EnhancedAssetBrowser;