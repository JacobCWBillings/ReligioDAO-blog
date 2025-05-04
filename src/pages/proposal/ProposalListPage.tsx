// src/pages/proposal/ProposalListPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { ProposalStatus } from '../../types/blockchain';
import { ProposalListSkeleton } from '../../components/skeletons/Skeleton';
import { ProposalCard } from '../../components/proposal/ProposalCard';
import './ProposalListPage.css';

export const ProposalListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { proposals, getAllProposals, loading, error } = useProposal();
  const { isConnected, account } = useWallet();
  
  // State for filtering
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || 'all'
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get('search') || ''
  );
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get('sort') || 'newest'
  );
  
  // UI state
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  
  // Load proposals when component mounts
  useEffect(() => {
    const loadProposals = async () => {
      try {
        if (isConnected) {
          await getAllProposals();
        }
      } catch (err) {
        console.error('Error loading proposals:', err);
      }
    };
    
    loadProposals();
  }, [getAllProposals, isConnected]);
  
  // Update URL search params when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    
    if (statusFilter !== 'all') {
      newParams.set('status', statusFilter);
    }
    
    if (searchTerm) {
      newParams.set('search', searchTerm);
    }
    
    if (sortBy !== 'newest') {
      newParams.set('sort', sortBy);
    }
    
    setSearchParams(newParams, { replace: true });
  }, [statusFilter, searchTerm, sortBy, setSearchParams]);
  
  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await getAllProposals();
    } catch (err) {
      console.error('Error refreshing proposals:', err);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Filter and sort proposals
  const filteredProposals = useMemo(() => {
    if (!proposals) return [];
    
    let filtered = [...proposals];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        // Special handling for executed proposals
        if (statusFilter === ProposalStatus.Executed && p.executed) {
          return true;
        }
        
        // Special handling for proposals ready for execution
        if (statusFilter === ProposalStatus.Approved) {
          return p.status === ProposalStatus.Approved && !p.executed;
        }
        
        return p.status === statusFilter;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term) ||
        p.proposer.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        filtered.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'mostVotes':
        filtered.sort((a, b) => (b.votesFor + b.votesAgainst) - (a.votesFor + a.votesAgainst));
        break;
      case 'endingSoon':
        filtered.sort((a, b) => {
          // Only sort active proposals by end time
          if (a.status === ProposalStatus.Active && b.status === ProposalStatus.Active) {
            return a.votingEnds - b.votingEnds;
          }
          // If one is active and the other isn't, prioritize active
          if (a.status === ProposalStatus.Active) return -1;
          if (b.status === ProposalStatus.Active) return 1;
          // Default to newest
          return b.createdAt - a.createdAt;
        });
        break;
      default:
        filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    return filtered;
  }, [proposals, statusFilter, searchTerm, sortBy]);
  
  // Determine if a proposal needs user attention
  const needsAttention = useCallback((proposal: any): boolean => {
    if (!isConnected || !account) return false;
    
    // Highlight active proposals that user can vote on
    return proposal.status === ProposalStatus.Active;
  }, [isConnected, account]);
  
  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setSearchTerm('');
    setSortBy('newest');
  };
  
  // Handle status filter click
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
  };
  
  // Handle search input
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };
  
  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };
  
  // Navigate to submit proposal page
  const handleSubmitProposal = () => {
    navigate('/submit-proposal');
  };

  // Handle download proposals
  const handleDownloadProposals = () => {
    if (!filteredProposals.length) return;
    
    setDownloading(true);
    
    try {
      // Format proposals for download - simplify and clean up data
      // const downloadData = filteredProposals.map(p => ({
      //   id: p.id,
      //   title: p.title,
      //   description: p.description,
      //   proposer: p.proposer,
      //   status: p.status,
      //   executed: p.executed,
      //   votesFor: p.votesFor,
      //   votesAgainst: p.votesAgainst,
      //   createdAt: p.createdAt,
      //   votingEnds: p.votingEnds,
      //   contentReference: p.contentReference || null
      // }));

      const downloadData = proposals
      
      // Convert to JSON string with proper formatting
      const jsonData = JSON.stringify(downloadData, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download element
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      let filename = `religiodao-proposals-${date}`;
      if (statusFilter !== 'all') {
        filename += `-${statusFilter}`;
      }
      filename += '.json';
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading proposal data:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="proposal-list-page">
      <div className="proposals-header">
        <h1>Governance Proposals</h1>
        <p>Review and vote on blog submissions from the ReligioDAO community</p>
      </div>
      
      <div className="filter-section">
        <div className="search-box">
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search proposals..."
              value={searchTerm}
              onChange={handleSearchInput}
              aria-label="Search proposals"
            />
            <button type="submit" className="search-button">
              <span className="search-icon">🔍</span>
            </button>
          </form>
        </div>
        
        <div className="filter-controls">
          <div className="status-filters">
            <button 
              className={`status-filter ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('all')}
            >
              All
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Active ? 'active' : ''}`}
              onClick={() => handleStatusFilter(ProposalStatus.Active)}
            >
              Active
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Pending ? 'active' : ''}`}
              onClick={() => handleStatusFilter(ProposalStatus.Pending)}
            >
              Pending
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Approved ? 'active' : ''}`}
              onClick={() => handleStatusFilter(ProposalStatus.Approved)}
            >
              Approved
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Executed ? 'active' : ''}`}
              onClick={() => handleStatusFilter(ProposalStatus.Executed)}
            >
              Executed
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Rejected ? 'active' : ''}`}
              onClick={() => handleStatusFilter(ProposalStatus.Rejected)}
            >
              Rejected
            </button>
          </div>
          
          <div className="sort-control">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select" 
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="mostVotes">Most votes</option>
              <option value="endingSoon">Ending soon</option>
            </select>
            
            <button 
              className="refresh-button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            
            <button 
              className="download-button"
              onClick={handleDownloadProposals}
              disabled={downloading || loading || !filteredProposals.length}
              title="Download proposals as JSON"
            >
              {downloading ? 'Downloading...' : 'Download JSON'}
            </button>
          </div>
        </div>
        
        {/* Stats summary */}
        {proposals && proposals.length > 0 && (
          <div className="proposal-stats">
            <div className="stat-item">
              <span className="stat-value">{proposals.length}</span>
              <span className="stat-label">Total Proposals</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {proposals.filter(p => p.status === ProposalStatus.Active).length}
              </span>
              <span className="stat-label">Active Votes</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {proposals.filter(p => p.executed).length}
              </span>
              <span className="stat-label">Executed</span>
            </div>
          </div>
        )}
      </div>
      
      {loading && !refreshing ? (
        <ProposalListSkeleton />
      ) : error ? (
        <div className="error-message">
          <h3>Error Loading Proposals</h3>
          <p>{error.message}</p>
          <button onClick={handleRefresh} className="retry-button">
            Try Again
          </button>
        </div>
      ) : (
        <>
          {filteredProposals.length > 0 ? (
            <>
              <div className="filter-summary">
                <p>
                  Showing {filteredProposals.length} {filteredProposals.length === 1 ? 'proposal' : 'proposals'}
                  {statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}
                  {searchTerm ? ` matching "${searchTerm}"` : ''}
                </p>
                {(statusFilter !== 'all' || searchTerm) && (
                  <button className="clear-filters-button" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
              
              <div className="proposals-container">
                {filteredProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    showVotingProgress={true}
                    needsAttention={needsAttention(proposal)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="no-proposals">
              <h3>No Proposals Found</h3>
              {(statusFilter !== 'all' || searchTerm) ? (
                <>
                  <p>No proposals match your current filters.</p>
                  <button className="clear-filters-button" onClick={clearFilters}>
                    Clear Filters
                  </button>
                </>
              ) : (
                <p>There are no proposals in the system yet. Be the first to submit one!</p>
              )}
            </div>
          )}
        </>
      )}
      
      {isConnected ? (
        <div className="proposal-actions">
          <button onClick={handleSubmitProposal} className="submit-proposal-button">
            Submit New Proposal
          </button>
        </div>
      ) : (
        <div className="connect-wallet-cta">
          <h3>Want to participate?</h3>
          <p>Connect your wallet to submit and vote on proposals.</p>
        </div>
      )}
    </div>
  );
};

export default ProposalListPage;