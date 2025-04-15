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
        globalState.assets.find(x => x.reference === reference)!.name = newName.value!;
        rerender(x => x + 1);
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
        rerender(x => x + 1);
    }

    function onInsert() {
        // Insert the Swarm reference URL into the editor
        const swarmUrl = `http://localhost:1633/bytes/${reference}`;
        
        // Use the reference directly to ensure it works in the DAO context
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
            <img src={`http://localhost:1633/bytes/${reference}`} alt={name} />
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