import { Optional } from 'cafe-utility';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { Container } from '../Container';
import { Horizontal } from '../Horizontal';
import { save } from '../Saver';
import { Setting } from '../Setting';
import { Asset, GlobalState, getGlobalState, saveGlobalState } from '../libetherjot';
import { useGlobalState } from '../contexts/GlobalStateContext';
import React from 'react';

export function GlobalSettingsPage() {
    const { 
        globalState, 
        updateGlobalState, 
        setShowAssetPicker, 
        setAssetPickerCallback 
    } = useGlobalState();

    const [title, setTitle] = useState(globalState.configuration.title);
    const [headerTitle, setHeaderTitle] = useState(globalState.configuration.header.title);
    const [headerLogo, setHeaderLogo] = useState(globalState.configuration.header.logo);
    const [headerDescription, setHeaderDescription] = useState(globalState.configuration.header.description);
    const [headerLinkLabel, setHeaderLinkLabel] = useState(globalState.configuration.header.linkLabel);
    const [headerLinkAddress, setHeaderLinkAddress] = useState(globalState.configuration.header.linkAddress);
    const [mainHighlight, setMainHighlight] = useState(globalState.configuration.main.highlight);
    const [footerDescription, setFooterDescription] = useState(globalState.configuration.footer.description);
    const [footerDiscord, setFooterDiscord] = useState(globalState.configuration.footer.links.discord);
    const [footerTwitter, setFooterTwitter] = useState(globalState.configuration.footer.links.twitter);
    const [footerGitHub, setFooterGitHub] = useState(globalState.configuration.footer.links.github);
    const [footerYouTube, setFooterYouTube] = useState(globalState.configuration.footer.links.youtube);
    const [footerReddit, setFooterReddit] = useState(globalState.configuration.footer.links.reddit);
    const [ethereumAddress, setEthereumAddress] = useState(globalState.configuration.extensions.ethereumAddress);
    const [donations, setDonations] = useState(globalState.configuration.extensions.donations);
    const [comments, setComments] = useState(globalState.configuration.extensions.comments);

    async function onSave() {
        // Update the global state with all settings
        await updateGlobalState(state => {
            state.configuration.title = title;
            state.configuration.header.title = headerTitle;
            state.configuration.header.logo = headerLogo;
            state.configuration.header.description = headerDescription;
            state.configuration.header.linkLabel = headerLinkLabel;
            state.configuration.header.linkAddress = headerLinkAddress;
            state.configuration.main.highlight = mainHighlight;
            state.configuration.footer.description = footerDescription;
            state.configuration.footer.links.discord = footerDiscord;
            state.configuration.footer.links.twitter = footerTwitter;
            state.configuration.footer.links.github = footerGitHub;
            state.configuration.footer.links.youtube = footerYouTube;
            state.configuration.footer.links.reddit = footerReddit;
            state.configuration.extensions.ethereumAddress = ethereumAddress;
            state.configuration.extensions.donations = donations;
            state.configuration.extensions.comments = comments;
            return state;
        });

        Swal.fire({
            title: 'Saved!',
            icon: 'success',
            timer: 1500,
            timerProgressBar: true
        });
    }

    async function onExport() {
        // Export the current state to a JSON file
        const data = JSON.stringify(await saveGlobalState(globalState));
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
        element.setAttribute('download', 'religiodao-export.json');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        
        Swal.fire({
            title: 'Export Complete',
            text: 'Your blog settings have been exported to a JSON file',
            icon: 'success',
            timer: 1500
        });
    }

    async function onImport() {
        Swal.fire({
            title: 'Import Settings',
            input: 'textarea',
            inputPlaceholder: 'Paste your exported JSON here',
            showCancelButton: true,
            confirmButtonText: 'Import',
            showLoaderOnConfirm: true,
            preConfirm: (jsonData) => {
                try {
                    return JSON.parse(jsonData);
                } catch (error) {
                    Swal.showValidationMessage(`Invalid JSON: ${error}`);
                    return false;
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const newState = await getGlobalState(result.value);
                    
                    // Update all form fields with the new state
                    setTitle(newState.configuration.title);
                    setHeaderTitle(newState.configuration.header.title);
                    setHeaderLogo(newState.configuration.header.logo);
                    setHeaderDescription(newState.configuration.header.description);
                    setHeaderLinkLabel(newState.configuration.header.linkLabel);
                    setHeaderLinkAddress(newState.configuration.header.linkAddress);
                    setMainHighlight(newState.configuration.main.highlight);
                    setFooterDescription(newState.configuration.footer.description);
                    setFooterDiscord(newState.configuration.footer.links.discord);
                    setFooterTwitter(newState.configuration.footer.links.twitter);
                    setFooterGitHub(newState.configuration.footer.links.github);
                    setFooterYouTube(newState.configuration.footer.links.youtube);
                    setFooterReddit(newState.configuration.footer.links.reddit);
                    setEthereumAddress(newState.configuration.extensions.ethereumAddress);
                    setDonations(newState.configuration.extensions.donations);
                    setComments(newState.configuration.extensions.comments);
                    
                    // Update global state
                    await updateGlobalState(() => newState);
                    
                    Swal.fire({
                        title: 'Import Successful',
                        text: 'Your settings have been imported',
                        icon: 'success'
                    });
                } catch (error) {
                    Swal.fire({
                        title: 'Import Failed',
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                        icon: 'error'
                    });
                }
            }
        });
    }

    return (
        <div className="global-settings">
            <h2>Backup / Restore</h2>
            <Container>
                <p>Export your current settings or import a previously exported configuration.</p>
                <Horizontal gap={8}>
                    <button onClick={onExport}>Export Settings</button>
                    <button onClick={onImport}>Import Settings</button>
                </Horizontal>
            </Container>
            
            <h2>Website</h2>
            <Container>
                <Setting title="Title" value={title} onChange={setTitle} />
            </Container>
            
            <h2>Header</h2>
            <Container>
                <Setting title="Title" value={headerTitle} onChange={setHeaderTitle} />
                <Setting title="Link Label" value={headerLinkLabel} onChange={setHeaderLinkLabel} />
                <Setting title="Link Address" value={headerLinkAddress} onChange={setHeaderLinkAddress} />
                <div>
                    <p style={{ paddingLeft: '8px', paddingBottom: '8px' }}>Logo</p>
                    {headerLogo && (
                        <div>
                            <img
                                src={`http://localhost:1633/bytes/${headerLogo}`}
                                style={{ width: '48px', height: '48px' }}
                                alt="Header Logo"
                            />
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setAssetPickerCallback(() => (asset: Optional<Asset>) => {
                                asset.ifPresent(a => {
                                    setHeaderLogo(a.reference);
                                });
                                setShowAssetPicker(false);
                            });
                            setShowAssetPicker(true);
                        }}
                    >
                        Select Logo
                    </button>
                </div>
                <Setting
                    title="Description"
                    type="textarea"
                    value={headerDescription}
                    onChange={setHeaderDescription}
                />
            </Container>
            
            <h2>Front Page</h2>
            <Container>
                <Setting 
                    title="Highlight Category" 
                    value={mainHighlight} 
                    onChange={setMainHighlight} 
                />
                <p className="setting-help">
                    Articles from this category will be displayed in the highlight section on the homepage.
                </p>
            </Container>
            
            <h2>Footer</h2>
            <Container>
                <Setting
                    title="Description"
                    type="textarea"
                    value={footerDescription}
                    onChange={setFooterDescription}
                />
            </Container>
            
            <h2>Social Links</h2>
            <Container>
                <Setting title="Discord" value={footerDiscord} onChange={setFooterDiscord} />
                <Setting title="Twitter" value={footerTwitter} onChange={setFooterTwitter} />
                <Setting title="GitHub" value={footerGitHub} onChange={setFooterGitHub} />
                <Setting title="YouTube" value={footerYouTube} onChange={setFooterYouTube} />
                <Setting title="Reddit" value={footerReddit} onChange={setFooterReddit} />
            </Container>
            
            <h2>Extensions</h2>
            <Container>
                <Setting title="Ethereum Address" value={ethereumAddress} onChange={setEthereumAddress} />
                <p className="setting-help">
                    This address will be used for donation features if enabled.
                </p>
                
                <Horizontal gap={8}>
                    <input 
                        id="enable-donations"
                        onChange={event => setDonations(event.target.checked)} 
                        type="checkbox" 
                        checked={donations} 
                    />
                    <label htmlFor="enable-donations">Enable Donations</label>
                </Horizontal>
                
                <Horizontal gap={8}>
                    <input 
                        id="enable-comments"
                        onChange={event => setComments(event.target.checked)} 
                        type="checkbox" 
                        checked={comments} 
                    />
                    <label htmlFor="enable-comments">Enable Comments</label>
                </Horizontal>
            </Container>
            
            <h2>Apply Changes</h2>
            <button 
                className="save-button" 
                onClick={onSave}
            >
                Save Settings
            </button>
        </div>
    );
}