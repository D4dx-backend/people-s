const FAQ = require('../models/Faq');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

// Public: active FAQs
exports.getPublic = async (req, res) => {
  try {
    const filter = { status: 'active', ...buildFranchiseReadFilter(req) };
    const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: -1 }).select('-createdBy -updatedBy');
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error('Get public FAQs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch FAQs', error: error.message });
  }
};

// Admin: all FAQs
exports.getAll = async (req, res) => {
  try {
    const filter = buildFranchiseReadFilter(req);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error('Get all FAQs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch FAQs', error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { question, answer, category, order, status } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'Question and answer are required' });
    }
    const faq = new FAQ({
      question,
      answer,
      category: category || 'general',
      order: order || 0,
      status: status || 'active',
      createdBy: req.user.id,
      franchise: req.franchiseId || null
    });
    await faq.save();
    res.status(201).json({ success: true, data: faq, message: 'FAQ created successfully' });
  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to create FAQ', error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const faq = await FAQ.findOne({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
    const { question, answer, category, order, status } = req.body;
    if (question !== undefined) faq.question = question;
    if (answer !== undefined) faq.answer = answer;
    if (category !== undefined) faq.category = category;
    if (order !== undefined) faq.order = order;
    if (status !== undefined) faq.status = status;
    faq.updatedBy = req.user.id;
    await faq.save();
    res.json({ success: true, data: faq, message: 'FAQ updated successfully' });
  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to update FAQ', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const faq = await FAQ.findOneAndDelete({ _id: req.params.id, ...buildFranchiseReadFilter(req) });
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete FAQ', error: error.message });
  }
};
