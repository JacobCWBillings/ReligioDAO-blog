// src/pages/proposal/ProposalListPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { formatAddress } from '../../blockchain/utils/walletUtils';
import { ProposalStatus } from '../../types/blockchain';
import { ProposalListSkeleton } from '../../components/skeletons/Skeleton';
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
  
  // Load proposals when component mounts
  useEffect(() => {
    const loadProposals = async () => {
      try {
        await getAllProposals();
      } catch (err) {
        console.error('Error loading proposals:', err);
      }
    };
    
    loadProposals();
  }, [getAllProposals]);
  
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
      filtered = filtered.filter(p => p.status === statusFilter);
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
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diffInSeconds = Math.floor((timestamp - now) / 1000);
    
    if (diffInSeconds < 0) return 'Ended';
    
    const days = Math.floor(diffInSeconds / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m remaining`;
    } else {
      return 'Ending soon';
    }
  };
  
  // Get status display details with improved mapping
  const getStatusDetails = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.Pending:
        return { 
          label: 'Pending', 
          className: 'status-pending',
          description: 'Awaiting voting period to begin'
        };
      case ProposalStatus.Active:
        return { 
          label: 'Active', 
          className: 'status-active',
          description: 'Voting is currently active'
        };
      case ProposalStatus.Approved:
        return { 
          label: 'Approved', 
          className: 'status-approved',
          description: 'Proposal approved, awaiting execution'
        };
      case ProposalStatus.Rejected:
        return { 
          label: 'Rejected', 
          className: 'status-rejected',
          description: 'Proposal was rejected by vote'
        };
      case ProposalStatus.Executed:
        return { 
          label: 'Executed', 
          className: 'status-executed',
          description: 'Proposal was executed successfully'
        };
      case ProposalStatus.Canceled:
        return { 
          label: 'Canceled', 
          className: 'status-canceled',
          description: 'Proposal was canceled'
        };
      default:
        return { 
          label: 'Unknown', 
          className: 'status-unknown',
          description: 'Unknown status'
        };
    }
  };
  
  // Calculate voting progress percentage
  const calculateProgress = (votesFor: number, votesAgainst: number) => {
    const total = votesFor + votesAgainst;
    if (total === 0) return 0;
    return (votesFor / total) * 100;
  };
  
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
    // Current implementation just prevents page reload
    // Could add additional functionality here
  };
  
  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };
  
  // Navigate to submit proposal page
  const handleSubmitProposal = () => {
    navigate('/submit-proposal');
  };
  
  // Determine if a proposal needs user attention
  const needsAttention = (proposal: any): boolean => {
    if (!isConnected || !account) return false;
    
    // Highlight active proposals that user can vote on
    return proposal.status === ProposalStatus.Active;
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
                {proposals.filter(p => p.status === ProposalStatus.Executed).length}
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
                  {statusFilter !== 'all' ? ` with status "${getStatusDetails(statusFilter as ProposalStatus).label}"` : ''}
                  {searchTerm ? ` matching "${searchTerm}"` : ''}
                </p>
                {(statusFilter !== 'all' || searchTerm) && (
                  <button className="clear-filters-button" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
              
              <div className="proposals-container">
                {filteredProposals.map((proposal) => {
                  const statusDetails = getStatusDetails(proposal.status);
                  const progressPercentage = calculateProgress(proposal.votesFor, proposal.votesAgainst);
                  const attention = needsAttention(proposal);
                  
                  return (
                    <Link 
                      to={`/proposals/${proposal.id}`} 
                      key={proposal.id}
                      className={`proposal-card ${attention ? 'needs-attention' : ''}`}
                    >
                      <div className="proposal-header">
                        <h2 className="proposal-title">{proposal.title}</h2>
                        <span className={`proposal-status ${statusDetails.className}`}>
                          {statusDetails.label}
                        </span>
                      </div>
                      
                      <p className="proposal-description">
                        {proposal.description.length > 150 
                          ? `${proposal.description.substring(0, 150)}...` 
                          : proposal.description}
                      </p>
                      
                      {(proposal.status === ProposalStatus.Active || 
                        proposal.status === ProposalStatus.Approved || 
                        proposal.status === ProposalStatus.Rejected) && (
                        <div className="vote-progress">
                          <div className="vote-progress-bar" style={{ width: `${progressPercentage}%` }}></div>
                          <div className="vote-counts">
                            <span className="for">For: {proposal.votesFor}</span>
                            <span className="progress-percent">{progressPercentage.toFixed(1)}%</span>
                            <span className="against">Against: {proposal.votesAgainst}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="proposal-footer">
                        <div className="proposal-meta">
                          <span className="proposer">
                            By: {formatAddress(proposal.proposer, 6, 4)}
                          </span>
                          <span className="proposal-date">
                            Created: {formatDate(proposal.createdAt)}
                          </span>
                          {proposal.status === ProposalStatus.Active && (
                            <span className="voting-ends">
                              {formatRelativeTime(proposal.votingEnds)}
                            </span>
                          )}
                        </div>
                        
                        {proposal.status === ProposalStatus.Active && (
                          <div className="card-action-hint">
                            Click to vote
                          </div>
                        )}
                        
                        {proposal.status === ProposalStatus.Approved && !proposal.executed && (
                          <div className="card-action-hint">
                            Ready for execution
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
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