const ContactMessage = require('../models/ContactMessage');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

// Public: submit a contact message
exports.submit = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, message: 'Name and message are required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Please provide an email or phone number' });
    }
    const doc = new ContactMessage({
      name,
      email: email || '',
      phone: phone || '',
      subject: subject || '',
      message,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      franchise: req.franchiseId || null
    });
    await doc.save();
    res.status(201).json({ success: true, message: 'Thank you! Your message has been received.' });
  } catch (error) {
    console.error('Submit contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit message', error: error.message });
  }
};

// Admin: list messages
exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('handledBy', 'name'),
      ContactMessage.countDocuments(filter)
    ]);
    res.json({ success: true, data: messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const doc = await ContactMessage.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!doc) return res.status(404).json({ success: false, message: 'Message not found' });
    if (req.body.status) doc.status = req.body.status;
    doc.handledBy = req.user.id;
    await doc.save();
    res.json({ success: true, data: doc, message: 'Message updated successfully' });
  } catch (error) {
    console.error('Update contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to update message', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const doc = await ContactMessage.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!doc) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
  }
};
