// src/pages/proposal/ProposalListPage.tsx - FIXED: Load more button and sorting issues
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { ProposalStatus } from '../../types/blockchain';
import { ProposalListSkeleton } from '../../components/skeletons/Skeleton';
import { ProposalCard } from '../../components/proposal/ProposalCard';
import './ProposalListPage.css';

/**
 * Helper function to determine if proposal is actively accepting votes
 */
const isActiveVoting = (proposal: any): boolean => {
  return proposal.status === ProposalStatus.Pending && 
         Date.now() < proposal.votingEnds;
};

export const ProposalListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { 
    proposals, 
    totalCount,
    hasMore,
    loading, 
    loadingMore,
    error,
    initialLoaded,
    loadInitialProposals,
    loadMoreProposals,
    refreshProposals,
    searchProposals
  } = useProposal();
  
  const { isConnected, account } = useWallet();
  
  // State for filtering
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('status') || 'all'
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get('search') || ''
  );
  
  // UI state
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  
  // Load initial proposals when component mounts
  useEffect(() => {
    if (!initialLoaded) {
      loadInitialProposals();
    }
  }, [loadInitialProposals, initialLoaded]);
  
  // Update URL search params when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    
    if (statusFilter !== 'all') {
      newParams.set('status', statusFilter);
    }
    
    if (searchTerm) {
      newParams.set('search', searchTerm);
    }
    
    setSearchParams(newParams, { replace: true });
  }, [statusFilter, searchTerm, setSearchParams]);
  
  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProposals();
    } catch (err) {
      console.error('Error refreshing proposals:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle load more
  const handleLoadMore = async () => {
    if (!loadingMore && hasMore) {
      await loadMoreProposals();
    }
  };
  
  // Filter proposals - always sorted newest first
  const filteredProposals = useMemo(() => {
    let filtered = [...proposals];

    // Apply search filter first (use cached search if available)
    if (searchTerm) {
      const searchResults = searchProposals(searchTerm);
      // If search returns results, use those; otherwise filter the current proposals
      if (searchResults.length > 0) {
        filtered = searchResults;
      } else {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(p => 
          p.title.toLowerCase().includes(term) || 
          p.description.toLowerCase().includes(term) ||
          p.proposer.toLowerCase().includes(term)
        );
      }
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        // Special handling for active voting - check both status and timing
        if (statusFilter === 'active') {
          return isActiveVoting(p);
        }
        
        // Special handling for executed proposals
        if (statusFilter === 'executed') {
          return p.status === ProposalStatus.Executed;
        }
        
        // Special handling for proposals ready for execution (approved)
        if (statusFilter === 'approved') {
          return p.status === ProposalStatus.Accepted && !p.executed;
        }
        
        // Handle other status filters by converting status enum to string and comparing
        const statusString = ProposalStatus[p.status].toLowerCase();
        return statusString === statusFilter.toLowerCase();
      });
    }
    
    // Always sort newest first
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    
    return filtered;
  }, [proposals, statusFilter, searchTerm, searchProposals]);
  
  // Determine if a proposal needs user attention
  const needsAttention = useCallback((proposal: any): boolean => {
    if (!isConnected || !account) return false;
    
    // Highlight active proposals that user can vote on
    return isActiveVoting(proposal);
  }, [isConnected, account]);
  
  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setSearchTerm('');
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
      const downloadData = filteredProposals.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        proposer: p.proposer,
        status: ProposalStatus[p.status], // Convert enum to string
        statusCode: p.status,
        executed: p.executed,
        votesFor: p.votesFor,
        votesAgainst: p.votesAgainst,
        createdAt: p.createdAt,
        votingEnds: p.votingEnds,
        contentReference: p.contentReference || null,
        isActiveVoting: isActiveVoting(p)
      }));
      
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

  // Calculate statistics for display
  const proposalStats = useMemo(() => {
    const activeCount = proposals.filter(p => isActiveVoting(p)).length;
    const executedCount = proposals.filter(p => p.executed).length;
    
    return {
      total: totalCount,
      active: activeCount,
      executed: executedCount
    };
  }, [proposals, totalCount]);

  // FIXED: Simplified load more conditions - only check essential state
  const shouldShowLoadMore = useMemo(() => {
    // Only show if there are more proposals to load and we're not currently loading
    return hasMore && !loadingMore;
  }, [hasMore, loadingMore]);

  return (
    <div className="proposal-list-page">
      <div className="proposals-header">
        <h1>Governance Proposals</h1>
        <p>Review and vote on blog submissions from the ReligioDAO community</p>
        
        {/* Stats summary */}
        <div className="proposal-stats">
          <div className="stat-item">
            <span className="stat-value">{proposalStats.total}</span>
            <span className="stat-label">Total Proposals</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{proposalStats.active}</span>
            <span className="stat-label">Active Votes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{proposalStats.executed}</span>
            <span className="stat-label">Executed</span>
          </div>
        </div>
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
              className={`status-filter ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('active')}
            >
              Active
            </button>
            <button 
              className={`status-filter ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('pending')}
            >
              Pending
            </button>
            <button 
              className={`status-filter ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('approved')}
            >
              Approved
            </button>
            <button 
              className={`status-filter ${statusFilter === 'executed' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('executed')}
            >
              Executed
            </button>
            <button 
              className={`status-filter ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => handleStatusFilter('rejected')}
            >
              Rejected
            </button>
          </div>
          
          <div className="sort-control">
            <button 
              className="refresh-button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
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
      </div>
      
      {/* Loading indicator for initial load */}
      {loading && !isRefreshing && !initialLoaded ? (
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
                  {totalCount > proposals.length ? ` (${proposals.length} of ${totalCount} loaded)` : ''}
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

              {/* Show load more button when there are more proposals */}
              {shouldShowLoadMore && (
                <div className="load-more-section">
                  <button 
                    className="load-more-button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading more...' : `Load older proposals (${totalCount - proposals.length} remaining)`}
                  </button>
                </div>
              )}

              {/* Loading indicator for more proposals */}
              {loadingMore && (
                <div className="loading-more">
                  <ProposalListSkeleton />
                </div>
              )}
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
              ) : !initialLoaded ? (
                <p>Loading proposals...</p>
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