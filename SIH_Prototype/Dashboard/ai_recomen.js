document.addEventListener('DOMContentLoaded', () => {

  const mockRecommendations = [
    {
      id: 'REC-001',
      title: 'Platform Reallocation for Express Service',
      description: 'Reallocate Platform 3 to accommodate delayed Express Train T-2847 to minimize passenger disruption',
      type: 'platform',
      priority: 'critical',
      confidence: 92,
      delayReduction: 8,
      affectedTrains: 3,
      throughputImprovement: 15,
      timestamp: '14:25:30',
    },
    {
      id: 'REC-002',
      title: 'Wrong-Line Routing for Freight Bypass',
      description: 'Route Freight Train F-5521 via wrong-line corridor to avoid passenger service conflicts',
      type: 'routing',
      priority: 'high',
      confidence: 87,
      delayReduction: 12,
      affectedTrains: 5,
      throughputImprovement: 22,
      timestamp: '14:22:15',
    },
    {
      id: 'REC-003',
      title: 'Speed Optimization for Schedule Recovery',
      description: 'Increase speed limits for delayed passenger services to recover lost time',
      type: 'speed',
      priority: 'medium',
      confidence: 81,
      delayReduction: 5,
      affectedTrains: 2,
      throughputImprovement: 8,
      timestamp: '14:20:45',
    },
    {
      id: 'REC-004',
      title: 'Holding Pattern for Conflict Resolution',
      description: 'Implement holding pattern for Local Train L-0934 to resolve junction conflict',
      type: 'holding',
      priority: 'low',
      confidence: 75,
      delayReduction: 3,
      affectedTrains: 1,
      throughputImprovement: 5,
      timestamp: '14:18:20',
    }
  ];

  const mockHistory = [
    {
      id: 'HIS-001',
      title: 'Platform Reallocation - Emergency Response',
      description: 'Successfully reallocated platforms during signal failure',
      status: 'accepted',
      timestamp: '2025-01-16T13:45:00',
    },
    {
      id: 'HIS-002',
      title: 'Wrong-Line Routing - Freight Bypass',
      description: 'Routed freight train through bypass corridor',
      status: 'accepted',
      timestamp: '2025-01-16T12:30:00',
    },
    {
      id: 'HIS-003',
      title: 'Speed Adjustment - Schedule Recovery',
      description: 'Increased speed limits for delayed passenger service',
      status: 'dismissed',
      timestamp: '2025-01-16T11:15:00',
    },
  ];

  const mockPolicy = {
    decisionMode: 'balanced',
    priorityWeight: 'punctuality-focused',
    minConfidenceThreshold: 75,
  };

  const tabsContainer = document.querySelector('.tab-nav');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const recommendationsList = document.getElementById('recommendations-list');
  const historyContent = document.getElementById('history-content');
  const policyContent = document.getElementById('policy-content');

  // Render Recommendations
  function renderRecommendations(recs) {
    recommendationsList.innerHTML = recs.map(rec => `
      <div class="rec-card">
        <div class="rec-header">
          <h4 class="rec-title">${rec.title}</h4>
          <span class="rec-priority priority-${rec.priority}">${rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}</span>
        </div>
        <p class="rec-description">${rec.description}</p>
        <div class="rec-details">
          <span class="rec-detail"><i class="fas fa-clock"></i> ${rec.delayReduction} min delay reduction</span>
          <span class="rec-detail"><i class="fas fa-train"></i> ${rec.affectedTrains} affected trains</span>
          <span class="rec-detail"><i class="fas fa-tachometer-alt"></i> ${rec.confidence}% confidence</span>
        </div>
        <div class="rec-actions">
          <button class="btn btn-accept">Accept</button>
          <button class="btn btn-dismiss">Dismiss</button>
        </div>
      </div>
    `).join('');
  }

  // Render History
  function renderHistory(history) {
    historyContent.innerHTML = `
      <div class="history-table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(item => `
              <tr>
                <td>${item.id}</td>
                <td>${item.title}</td>
                <td>${item.status}</td>
                <td>${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render Policy
  function renderPolicy(policy) {
    policyContent.innerHTML = `
      <div class="policy-config-form">
        <div class="policy-group">
          <label>Decision Mode</label>
          <input type="text" value="${policy.decisionMode}" readonly>
        </div>
        <div class="policy-group">
          <label>Priority Weight</label>
          <input type="text" value="${policy.priorityWeight}" readonly>
        </div>
        <div class="policy-group">
          <label>Min Confidence Threshold</label>
          <input type="number" value="${policy.minConfidenceThreshold}" readonly>
        </div>
        <div class="policy-actions">
          <button class="btn btn-save-policy">Save Changes</button>
          <button class="btn btn-revert-policy">Revert</button>
        </div>
      </div>
    `;
  }

  // Tab switching logic
  tabsContainer.addEventListener('click', (e) => {
    const tabButton = e.target.closest('.tab-btn');
    if (!tabButton) return;

    document.querySelector('.tab-btn.active').classList.remove('active');
    tabButton.classList.add('active');

    document.querySelector('.tab-pane.active')?.classList.remove('active');
    const targetTab = document.getElementById(`tab-${tabButton.dataset.tab}`);
    if (targetTab) {
      targetTab.classList.add('active');
    }
  });

  // Initial rendering
  renderRecommendations(mockRecommendations);
  renderHistory(mockHistory);
  renderPolicy(mockPolicy);

});