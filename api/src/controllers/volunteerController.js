const Volunteer = require('../models/Volunteer');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

// Public: submit a volunteer application
exports.submit = async (req, res) => {
  try {
    const { name, email, phone, area, interest, message } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }
    const doc = new Volunteer({
      name,
      email: email || '',
      phone,
      area: area || '',
      interest: interest || '',
      message: message || '',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      franchise: req.franchiseId || null
    });
    await doc.save();
    res.status(201).json({ success: true, message: 'Thank you for volunteering! We will contact you soon.' });
  } catch (error) {
    console.error('Submit volunteer error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application', error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [volunteers, total] = await Promise.all([
      Volunteer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('handledBy', 'name'),
      Volunteer.countDocuments(filter)
    ]);
    res.json({ success: true, data: volunteers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch volunteers', error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const doc = await Volunteer.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!doc) return res.status(404).json({ success: false, message: 'Volunteer not found' });
    if (req.body.status) doc.status = req.body.status;
    doc.handledBy = req.user.id;
    await doc.save();
    res.json({ success: true, data: doc, message: 'Volunteer updated successfully' });
  } catch (error) {
    console.error('Update volunteer error:', error);
    res.status(500).json({ success: false, message: 'Failed to update volunteer', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const doc = await Volunteer.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!doc) return res.status(404).json({ success: false, message: 'Volunteer not found' });
    res.json({ success: true, message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Delete volunteer error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete volunteer', error: error.message });
  }
};
