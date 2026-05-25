const dashboardModel = require('../models/dashboard.model');

async function getOverview(req, res) {
  try {
    const [summary, recentDistributions, projectBudgets, coverage, activityFeed] = await Promise.all([
      dashboardModel.getDashboardSummary(),
      dashboardModel.getRecentAidDistributions(),
      dashboardModel.getProjectBudgets(),
      dashboardModel.getCoverageByRegion(),
      dashboardModel.getActivityFeed(),
    ]);

    return res.json({
      success: true,
      data: {
        summary,
        recentDistributions,
        projectBudgets,
        coverage,
        activityFeed,
      },
    });
  } catch (error) {
    console.error('getOverview error', error);
    return res.status(500).json({ success: false, message: 'Unable to load dashboard overview.' });
  }
}

module.exports = {
  getOverview,
};
