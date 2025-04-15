import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProposal } from '../../blockchain/hooks/useProposal';
import { useWallet } from '../../contexts/WalletContext';
import { ProposalStatus } from '../../types/blockchain';
import './ProposalListPage.css';

export const ProposalListPage: React.FC = () => {
  const { proposals, getAllProposals, loading, error } = useProposal();
  const { isConnected } = useWallet();
  
  // State for filtering
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  
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
  
  // Filter and sort proposals
  const getFilteredProposals = useCallback(() => {
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
        p.description.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === 'mostVotes') {
      filtered.sort((a, b) => (b.votesFor + b.votesAgainst) - (a.votesFor + a.votesAgainst));
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
  
  // Get status display details
  const getStatusDetails = (status: ProposalStatus) => {
    switch (status) {
      case ProposalStatus.Pending:
        return { label: 'Pending', className: 'status-pending' };
      case ProposalStatus.Active:
        return { label: 'Voting Active', className: 'status-active' };
      case ProposalStatus.Approved:
        return { label: 'Approved', className: 'status-approved' };
      case ProposalStatus.Rejected:
        return { label: 'Rejected', className: 'status-rejected' };
      case ProposalStatus.Executed:
        return { label: 'Executed', className: 'status-executed' };
      case ProposalStatus.Canceled:
        return { label: 'Canceled', className: 'status-canceled' };
      default:
        return { label: 'Unknown', className: 'status-unknown' };
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
  
  // Get filtered proposals
  const filteredProposals = getFilteredProposals();

  return (
    <div className="proposal-list-page">
      <div className="proposals-header">
        <h1>Governance Proposals</h1>
        <p>View and vote on blog proposals from the ReligioDAO community</p>
      </div>
      
      <div className="filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search proposals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <div className="status-filters">
            <button 
              className={`status-filter ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Pending ? 'active' : ''}`}
              onClick={() => setStatusFilter(ProposalStatus.Pending)}
            >
              Pending
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Active ? 'active' : ''}`}
              onClick={() => setStatusFilter(ProposalStatus.Active)}
            >
              Active
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Approved ? 'active' : ''}`}
              onClick={() => setStatusFilter(ProposalStatus.Approved)}
            >
              Approved
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Rejected ? 'active' : ''}`}
              onClick={() => setStatusFilter(ProposalStatus.Rejected)}
            >
              Rejected
            </button>
            <button 
              className={`status-filter ${statusFilter === ProposalStatus.Executed ? 'active' : ''}`}
              onClick={() => setStatusFilter(ProposalStatus.Executed)}
            >
              Executed
            </button>
          </div>
          
          <div className="sort-control">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select" 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="mostVotes">Most votes</option>
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-indicator">Loading proposals...</div>
      ) : error ? (
        <div className="error-message">
          <p>Error loading proposals: {error.message}</p>
          <button onClick={() => getAllProposals()} className="retry-button">
            Try Again
          </button>
        </div>
      ) : (
        <>
          {filteredProposals.length > 0 ? (
            <div className="proposals-container">
              {filteredProposals.map((proposal) => {
                const statusDetails = getStatusDetails(proposal.status);
                const progressPercentage = calculateProgress(proposal.votesFor, proposal.votesAgainst);
                
                return (
                  <Link 
                    to={`/proposals/${proposal.id}`} 
                    key={proposal.id}
                    className="proposal-card"
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
                          By: {proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(38)}
                        </span>
                        <span className="proposal-date">
                          Created: {formatDate(proposal.createdAt)}
                        </span>
                        {proposal.votingEnds > Date.now() ? (
                          <span className="voting-ends">
                            Voting ends: {formatDate(proposal.votingEnds)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="no-proposals">
              <p>No proposals found matching your criteria.</p>
              {(statusFilter !== 'all' || searchTerm) && (
                <button 
                  className="clear-filters-button"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </>
      )}
      
      {isConnected && (
        <div className="proposal-actions">
          <Link to="/submit-proposal" className="submit-proposal-button">
            Submit New Proposal
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProposalListPage;