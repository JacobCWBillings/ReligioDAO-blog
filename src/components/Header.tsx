import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { SquareImage } from '../SquareImage';
import { Row } from '../Row';
import { WalletConnect } from './WalletConnect';
import './Header.css';

interface HeaderProps {
    isBeeRunning: boolean;
    hasPostageStamp: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isBeeRunning, hasPostageStamp }) => {
    const navigate = useNavigate();
    const { globalState } = useGlobalState();

    return (
        <header className="app-header">
            <div className="header-left">
                <Link to="/" className="logo-link">
                    <h1>{globalState.configuration.title || 'ReligioDAO'}</h1>
                </Link>
            </div>

            <nav className="header-nav">
                <Link to="/">Home</Link>
                <Link to="/blogs">Blogs</Link>
                <Link to="/editor">New Blog</Link>
                <Link to="/settings">Settings</Link>
            </nav>

            <div className="header-right">
                <Row gap={16}>
                    <Row gap={4}>
                        <span>Bee</span>
                        <SquareImage size={32} src={isBeeRunning ? '/etherjot/yes.png' : '/etherjot/no.png'} />
                    </Row>
                    <Row gap={4}>
                        <span>Stamp</span>
                        <SquareImage size={32} src={hasPostageStamp ? '/etherjot/yes.png' : '/etherjot/no.png'} />
                    </Row>

                    {/* Wallet Connection */}
                    <WalletConnect />
                </Row>

                <div>
                    <label>Swarm Hash</label>
                    <input type="text" value={globalState.feed} readOnly />
                    <a href={`http://localhost:1633/bzz/${globalState.feed}/`} target="_blank" rel="noopener noreferrer">
                        Open
                    </a>
                </div>
            </div>
        </header>
    );
};