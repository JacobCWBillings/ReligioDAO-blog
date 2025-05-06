// src/components/BeeWarningBanner.tsx
import React from 'react';
import './BeeWarningBanner.css';

interface BeeWarningBannerProps {
    isBeeRunning: boolean;
    hasPostageStamp: boolean;
}

export const BeeWarningBanner: React.FC<BeeWarningBannerProps> = ({ 
    isBeeRunning, 
    hasPostageStamp 
}) => {
    const getMissingRequirements = () => {
        const missing = [];
        if (!isBeeRunning) missing.push("Bee node");
        if (!hasPostageStamp) missing.push("Postage stamp");
        
        return missing;
    };
    
    const missingItems = getMissingRequirements();
    
    if (missingItems.length === 0) return null;
    
    return (
        <div className="bee-requirements-banner">
            <div className="bee-warning">
                <h3>⚠️ Setup Required for Content Creation</h3>
                <p>
                    To submit new blog content, you need to set up:
                </p>
                <ul>
                    {!isBeeRunning && (
                        <li><strong>Bee Node:</strong> Install and run a Bee node locally</li>
                    )}
                    {!hasPostageStamp && (
                        <li><strong>Postage Stamp:</strong> Create a postage stamp for content storage</li>
                    )}
                </ul>
                <p>
                    <a href="https://docs.ethswarm.org/docs/installation/quick-start" target="_blank" rel="noopener noreferrer">
                        Learn how to set up Swarm requirements →
                    </a>
                </p>
            </div>
        </div>
    );
};