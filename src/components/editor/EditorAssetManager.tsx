// src/components/editor/EditorAssetManager.tsx
import React, { useRef } from 'react';
import { useGlobalState } from '../../contexts/GlobalStateContext';
import { Asset } from '../../libetherjot';
import './EditorAssetManager.css';

interface EditorAssetManagerProps {
  onInsertAsset: (reference: string) => void;
}

export const EditorAssetManager: React.FC<EditorAssetManagerProps> = ({ onInsertAsset }) => {
  const { globalState, setShowAssetBrowser } = useGlobalState();
  const recentlyUsedAssets = useRef<string[]>([]);
  
  // Keep track of recently used assets (up to 5)
  const trackAssetUsage = (reference: string) => {
    // Add to front of array and remove duplicates
    recentlyUsedAssets.current = [
      reference,
      ...recentlyUsedAssets.current.filter(ref => ref !== reference)
    ].slice(0, 5);
  };
  
  // Get recent assets from state
  const getRecentAssets = (): Asset[] => {
    return recentlyUsedAssets.current
      .map(ref => globalState.assets.find(asset => asset.reference === ref))
      .filter(Boolean) as Asset[];
  };
  
  const handleInsertAsset = (reference: string) => {
    trackAssetUsage(reference);
    onInsertAsset(reference);
  };
  
  const handleOpenAssetBrowser = () => {
    setShowAssetBrowser(true);
  };
  
  const recentAssets = getRecentAssets();
  
  return (
    <div className="editor-asset-manager">
      <div className="asset-manager-header">
        <h3>Insert Assets</h3>
        <button 
          className="browse-assets-button"
          onClick={handleOpenAssetBrowser}
        >
          Browse All Assets
        </button>
      </div>
      
      {recentAssets.length > 0 && (
        <div className="recent-assets">
          <h4>Recently Used</h4>
          <div className="recent-assets-list">
            {recentAssets.map(asset => (
              <div 
                key={asset.reference} 
                className="recent-asset"
                onClick={() => handleInsertAsset(asset.reference)}
              >
                <img 
                  src={`http://localhost:1633/bytes/${asset.reference}`} 
                  alt={asset.name}
                />
                <div className="asset-name">{asset.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="asset-types">
        <h4>Insert by Type</h4>
        <div className="asset-type-buttons">
          <button onClick={handleOpenAssetBrowser}>
            Image
          </button>
          <button onClick={handleOpenAssetBrowser}>
            Document
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorAssetManager;