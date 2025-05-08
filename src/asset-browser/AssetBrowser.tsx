// src/asset-browser/AssetBrowser.tsx
import { Binary, Strings, Types } from 'cafe-utility';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { GlobalState } from '../libetherjot';
import './AssetBrowser.css';
import { Thumbnail } from './Thumbnail';
import { Bee, FileUploadOptions } from '@ethersphere/bee-js';
import React from 'react';

interface Props {
    globalState: GlobalState;
    setGlobalState: (state: GlobalState) => void;
    setShowAssetBrowser: (show: boolean) => void;
    insertAsset: (reference: string) => void;
}

export function AssetBrowser({ globalState, setGlobalState, setShowAssetBrowser, insertAsset }: Props) {
    const [_, rerender] = useState(0);

    // Function to validate a Swarm postage batch ID
    const isValidPostageBatchId = (id: string): boolean => {
        // Batch ID should be a hex string of length 64
        return /^[0-9a-fA-F]{64}$/.test(id);
    };

    // Function to get a valid postage batch ID or throw an error
    const getValidPostageBatchId = async (bee: Bee, currentId: string): Promise<string> => {
        // If the current ID is valid, use it
        if (isValidPostageBatchId(currentId)) {
            return currentId;
        }
        
        // Try to get available stamps
        try {
            const stamps = await bee.getAllPostageBatch();
            const usableStamp = stamps.find(stamp => stamp.usable);
            
            if (usableStamp && isValidPostageBatchId(usableStamp.batchID)) {
                // If we found a usable stamp, update the global state
                globalState.postageBatchId = usableStamp.batchID;
                localStorage.setItem('state', JSON.stringify(globalState));
                return usableStamp.batchID;
            }
        } catch (error) {
            console.warn("Failed to fetch postage stamps:", error);
        }
        
        throw new Error("No valid postage batch ID available. Please create a postage stamp.");
    };

    async function onNewAsset() {
        await Swal.fire({
            title: 'Select Image File',
            input: 'file',
            inputAttributes: {
                accept: 'image/*',
                'aria-label': 'Select Image'
            },
            showLoaderOnConfirm: true,
            preConfirm: result => {
                const reader = new FileReader();
                reader.onload = event => {
                    if (!event.target) {
                        return;
                    }
                    const dataUri = Types.asString(event.target.result);
                    const contentType = Strings.betweenNarrow(dataUri, 'data:', ';');
                    if (!contentType) {
                        throw Error('Could not determine content type');
                    }
                    const base64String = Strings.after(dataUri, 'base64,');
                    if (!base64String) {
                        throw Error('Could not determine base64 string');
                    }
                    const byteArray = Binary.base64ToUint8Array(base64String);
                    
                    Swal.fire({
                        title: 'Uploading to Swarm...',
                        imageUrl: event.target.result as string,
                        imageHeight: 200,
                        imageWidth: 200,
                        imageAlt: 'The uploaded picture',
                        didOpen: async () => {
                            Swal.showLoading();
                            
                            try {
                                // Create a direct Bee instance to upload the file
                                const bee = new Bee('http://localhost:1633');
                                
                                // Try to get a valid postage batch ID
                                let postageBatchId;
                                try {
                                    postageBatchId = await getValidPostageBatchId(bee, globalState.postageBatchId || '');
                                } catch (error) {
                                    Swal.fire({
                                        title: 'Postage Batch Error',
                                        text: `${error instanceof Error ? error.message : String(error)}. Please make sure your Bee node has at least one usable postage stamp.`,
                                        icon: 'error'
                                    });
                                    return;
                                }

                                // Define the options object
                                const fileExtension = result.name.split('.').pop() || '';
                                const options: FileUploadOptions = {
                                    contentType: 'image/${fileExtension',
                                    pin: true // Ensure the data is pinned
                                };
                                
                                // Upload directly as bytes
                                const uploadResult = await bee.uploadFile(postageBatchId, byteArray, result.name, options);
                                // Extract the reference string from the upload result
                                const hashReference = uploadResult.reference;
                                console.log('asset sent to ${hashReference}')
                                console.log(uploadResult)
                                // Ensure unique name for the asset
                                const timestamp = Date.now();
                                const uniqueFileName = `${result.name.split('.')[0]}_${timestamp}.${fileExtension}`;
                                
                                // Add to global state assets
                                globalState.assets.push({
                                    reference: hashReference,
                                    contentType,
                                    name: uniqueFileName
                                });
                                
                                // Update local storage directly
                                localStorage.setItem('state', JSON.stringify(globalState));
                                
                                // Update the component state
                                setGlobalState({ ...globalState });
                                
                                Swal.close();
                                
                                // Show success message
                                Swal.fire({
                                    title: 'Success!',
                                    text: `Asset "${uniqueFileName}" uploaded successfully.`,
                                    icon: 'success',
                                    timer: 2000
                                });
                            } catch (error) {
                                console.error("Upload error:", error);
                                
                                Swal.fire({
                                    title: 'Upload Failed',
                                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                                    icon: 'error'
                                });
                            }
                        }
                    });
                };
                reader.readAsDataURL(result);
            }
        });
    }

    return (
        <div id="asset-browser-wrapper">
            <div id="asset-browser">
                <div className="asset-browser-header">
                    <button className="asset-browser-close" onClick={onNewAsset}>
                        Add New
                    </button>
                    <div className="asset-browser-title">Asset Browser</div>
                    <button className="asset-browser-close" onClick={() => setShowAssetBrowser(false)}>
                        Close
                    </button>
                </div>
                <div className="asset-browser-header">
                    <p>Click on an image to insert it in the article.</p>
                </div>
                <div className="thumbnail-container">
                    {globalState.assets.map(x => (
                        <Thumbnail
                            globalState={globalState}
                            key={x.reference}
                            contentType={x.contentType}
                            name={x.name}
                            reference={x.reference}
                            insertAsset={insertAsset}
                            rerender={rerender}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}