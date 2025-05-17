// src/asset-browser/PickableAsset.tsx
import { Optional, Strings } from 'cafe-utility';
import { Asset } from '../libetherjot';
import React from 'react';

interface Props {
    asset: Asset;
    callback: (asset: Optional<Asset>) => void;
}

export function PickableAsset({ asset, callback }: Props) {
    // Generate image URL directly inside the component
    const getImageUrl = (ref: string): string => {
        // Clean any protocol prefixes
        const cleanRef = ref
            .replace('bzz://', '')
            .replace('bytes://', '')
            .trim();

        // Build URL to access bytes directly
        return `http://localhost:1633/bzz/${cleanRef}`;
    };

    return (
        <div className="thumbnail" onClick={() => callback(Optional.of(asset))}>
            <img 
                src={getImageUrl(asset.reference)} 
                alt={asset.name}
                onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // Prevent infinite loop
                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
                }}
            />
            <div className="thumbnail-name">{asset.name}</div>
        </div>
    );
}