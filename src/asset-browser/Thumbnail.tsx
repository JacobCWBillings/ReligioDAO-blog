// src/asset-browser/Thumbnail.tsx
import Swal from 'sweetalert2';
import { Horizontal } from '../Horizontal';
import { GlobalState } from '../libetherjot';
import React from 'react';

interface Props {
    globalState: GlobalState;
    name: string;
    contentType: string;
    reference: string;
    insertAsset: (reference: string) => void;
    rerender: (callback: (x: number) => number) => void;
}

export function Thumbnail({ globalState, name, contentType, reference, insertAsset, rerender }: Props) {
    // Function to generate image URL based on reference
    const getImageUrl = (ref: string): string => {
        // Clean any protocol prefixes
        const cleanRef = ref
            .replace('bzz://', '')
            .replace('bytes://', '')
            .trim();

        // Ensure we're using the correct endpoint format
        return `http://localhost:1633/bzz/${cleanRef}`;
    };

    console.log(reference)

    async function onRename() {
        const newName = await Swal.fire({
            title: 'New Name',
            input: 'text',
            inputValue: name,
            showCancelButton: true
        });
        if (!newName.value) {
            return;
        }
        const asset = globalState.assets.find(x => x.reference === reference);
        if (asset) {
            asset.name = newName.value;
            // Update localStorage directly to avoid problematic save
            localStorage.setItem('state', JSON.stringify(globalState));
            rerender(x => x + 1);
        }
    }

    async function onDelete() {
        const confirmed = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will remove the asset from your library, but it will still exist on Swarm.',
            showCancelButton: true
        });
        if (!confirmed.isConfirmed) {
            return;
        }
        globalState.assets = globalState.assets.filter(x => x.reference !== reference);
        // Update localStorage directly to avoid problematic save
        localStorage.setItem('state', JSON.stringify(globalState));
        rerender(x => x + 1);
    }

    function onInsert() {
        // Insert the asset reference
        insertAsset(reference);
        
        // Provide confirmation to the user
        Swal.fire({
            title: 'Asset Inserted',
            text: 'The asset has been inserted with its Swarm reference.',
            icon: 'success',
            timer: 1500
        });
    }

    return (
        <div className="thumbnail">
            <img 
                src={getImageUrl(reference)} 
                alt={name} 
                onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // Prevent infinite loop
                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
                    console.error(`Failed to load image with reference: ${reference}`);
                }}
            />
            <div className="thumbnail-name">{name}</div>
            <Horizontal gap={8}>
                <button className="button-xs" onClick={onInsert}>
                    Insert
                </button>
                <button className="button-xs" onClick={onRename}>
                    Rename
                </button>
                <button className="button-xs" onClick={onDelete}>
                    Delete
                </button>
            </Horizontal>
        </div>
    );
}