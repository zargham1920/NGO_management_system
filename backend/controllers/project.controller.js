const projectModel = require('../models/project.model');

async function getAll(req, res) {
  try {
    const projects = await projectModel.getAllProjects();
    return res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    console.error('getAll projects error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getAll,
};
