// src/contexts/GlobalStateContext.tsx
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Optional } from 'cafe-utility';
import { Article, Asset, GlobalState } from '../libetherjot';
import { save } from '../Saver';

interface GlobalStateContextType {
    globalState: GlobalState;
    setGlobalState: (state: GlobalState) => void;
    updateGlobalState: (updater: (state: GlobalState) => GlobalState) => Promise<void>;
    selectedArticle: Article | null;
    setSelectedArticle: (article: Article | null) => void;
    showAssetBrowser: boolean;
    setShowAssetBrowser: (show: boolean) => void;
    showAssetPicker: boolean;
    setShowAssetPicker: (show: boolean) => void;
    assetPickerCallback: (asset: Optional<Asset>) => void;
    setAssetPickerCallback: (callback: (asset: Optional<Asset>) => void) => void;
}

const defaultContext: GlobalStateContextType = {
    globalState: {} as GlobalState,
    setGlobalState: () => {},
    updateGlobalState: async () => {},
    selectedArticle: null,
    setSelectedArticle: () => {},
    showAssetBrowser: false,
    setShowAssetBrowser: () => {},
    showAssetPicker: false,
    setShowAssetPicker: () => {},
    assetPickerCallback: () => {},
    setAssetPickerCallback: () => {},
};

const GlobalStateContext = createContext<GlobalStateContextType>(defaultContext);

export const useGlobalState = () => useContext(GlobalStateContext);

interface GlobalStateProviderProps {
    initialState: GlobalState;
    setGlobalState: (state: GlobalState) => void;
    children: ReactNode;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({ 
    initialState, 
    setGlobalState: setAppGlobalState, 
    children 
}) => {
    const [globalState, setGlobalStateInternal] = useState<GlobalState>(initialState);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [showAssetBrowser, setShowAssetBrowser] = useState(false);
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [assetPickerCallback, setAssetPickerCallback] = useState<(asset: Optional<Asset>) => void>(() => () => {});

    // Update both the internal state and the App state
    const setGlobalState = (state: GlobalState) => {
        setGlobalStateInternal(state);
        setAppGlobalState(state);
    };

    // Helper function to update state with a function and save it
    const updateGlobalState = useCallback(async (updater: (state: GlobalState) => GlobalState) => {
        const updatedState = updater({ ...globalState });
        setGlobalState(updatedState);
        await save(updatedState);
    }, [globalState, setGlobalState]);

    const value = {
        globalState,
        setGlobalState,
        updateGlobalState,
        selectedArticle,
        setSelectedArticle,
        showAssetBrowser,
        setShowAssetBrowser,
        showAssetPicker, 
        setShowAssetPicker,
        assetPickerCallback,
        setAssetPickerCallback,
    };

    return (
        <GlobalStateContext.Provider value={value}>
            {children}
        </GlobalStateContext.Provider>
    );
};