const dashboardModel = require('../models/dashboard.model');

async function getStats(req, res) {
  try {
    const stats = await dashboardModel.getStats();
    return res.json({
      success: true,
      data: {
        total_beneficiaries: Number(stats.total_beneficiaries),
        total_funds_pkr: String(stats.total_funds_pkr),
        active_projects: Number(stats.active_projects),
        low_inventory_count: Number(stats.low_inventory_count),
        available_volunteers: Number(stats.available_volunteers),
        distributions_this_month: Number(stats.distributions_this_month),
      },
    });
  } catch (error) {
    console.error('getStats error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch stats.' });
  }
}

async function getRecentDistributions(req, res) {
  try {
    const distributions = await dashboardModel.getRecentDistributions();
    return res.json({
      success: true,
      count: distributions.length,
      data: distributions,
    });
  } catch (error) {
    console.error('getRecentDistributions error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch distributions.' });
  }
}

async function getBudgetSummary(req, res) {
  try {
    const projects = await dashboardModel.getBudgetSummary();
    
    const data = projects.map(p => ({
      project_id: p.project_id,
      project_name: p.project_name,
      sector: p.sector,
      db_status: p.db_status,
      budget: p.budget,
      budget_used: p.budget_used,
      usage_percent: p.usage_percent,
      display_status:
        p.usage_percent >= 90 ? 'Near Limit' :
        p.usage_percent >= 75 && p.db_status === 'Active' ? 'At Risk' :
        p.db_status,
      village_name: p.village_name,
      district: p.district,
    }));

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('getBudgetSummary error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch budget summary.' });
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  
  if (diff < 60) return `${diff} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)} days ago`;
}

async function getActivity(req, res) {
  try {
    const activities = await dashboardModel.getRecentActivity();
    
    const feed = activities.map(item => ({
      type: item.type,
      dot_color: item.dot_color,
      record_id: item.record_id,
      description: item.description,
      time_ago: getTimeAgo(item.created_at),
    }));

    return res.json({
      success: true,
      count: feed.length,
      data: feed,
    });
  } catch (error) {
    console.error('getActivity error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch activity feed.' });
  }
}

async function getCoverage(req, res) {
  try {
    const coverage = await dashboardModel.getCoverage();
    return res.json({
      success: true,
      data: {
        regions: coverage.regions,
        villages: coverage.villages,
      },
    });
  } catch (error) {
    console.error('getCoverage error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch coverage data.' });
  }
}

module.exports = {
  getStats,
  getRecentDistributions,
  getBudgetSummary,
  getActivity,
  getCoverage,
};
