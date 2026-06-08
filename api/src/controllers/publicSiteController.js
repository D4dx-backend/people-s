const WebsiteSettings = require('../models/WebsiteSettings');
const Banner = require('../models/Banner');
const NewsEvent = require('../models/NewsEvent');
const Brochure = require('../models/Brochure');
const Partner = require('../models/Partner');
const Project = require('../models/Project');
const Scheme = require('../models/Scheme');
const FAQ = require('../models/Faq');
const GalleryAlbum = require('../models/GalleryAlbum');
const Video = require('../models/Video');
const Blog = require('../models/Blog');
const MediaCoverage = require('../models/MediaCoverage');
const { buildFranchiseReadFilter } = require('../utils/franchiseFilterHelper');

/**
 * Aggregated public home payload — one call returns every section needed
 * to render the public landing page for the resolved franchise (by hostname).
 * GET /api/website/home
 */
exports.getHome = async (req, res) => {
  try {
    const scope = buildFranchiseReadFilter(req);

    const [
      settings,
      banners,
      projects,
      schemes,
      news,
      blogs,
      gallery,
      videos,
      partners,
      brochures,
      faqs,
      media
    ] = await Promise.all([
      WebsiteSettings.findOne({ ...scope }).select('-updatedBy -__v').lean(),
      Banner.find({ status: 'active', ...scope }).sort({ order: 1, createdAt: -1 }).select('-createdBy -updatedBy').lean(),
      Project.find({ status: { $in: ['active', 'approved', 'draft'] }, ...scope }).sort({ createdAt: -1 })
        .select('name description category status').lean(),
      Scheme.find({ status: 'active', ...scope }).sort({ createdAt: -1 }).limit(8)
        .select('name title description category status').lean(),
      NewsEvent.find({ status: 'published', ...scope }).sort({ publishDate: -1, createdAt: -1 }).limit(6)
        .select('title description category imageUrl publishDate featured').lean(),
      Blog.find({ status: 'published', ...scope }).sort({ publishDate: -1 }).limit(3)
        .select('title slug excerpt author coverImageUrl category publishDate').lean(),
      GalleryAlbum.find({ status: 'active', ...scope }).sort({ order: 1, createdAt: -1 }).limit(8)
        .select('title category coverImageUrl images').lean(),
      Video.find({ status: 'active', ...scope }).sort({ order: 1, createdAt: -1 }).limit(6)
        .select('title description videoUrl thumbnailUrl category featured').lean(),
      Partner.find({ status: 'active', ...scope }).sort({ order: 1, createdAt: -1 }).select('name logoUrl link').lean(),
      Brochure.find({ status: 'active', ...scope }).sort({ createdAt: -1 }).limit(8)
        .select('title description fileUrl fileName category').lean(),
      FAQ.find({ status: 'active', ...scope }).sort({ order: 1, createdAt: -1 }).select('question answer category').lean(),
      MediaCoverage.find({ status: 'active', ...scope }).sort({ order: 1, publishDate: -1 }).limit(8)
        .select('title source link imageUrl publishDate').lean()
    ]);

    // Trim gallery image payload to cover thumbnails for the home grid
    const gallerySummary = (gallery || []).map(a => ({
      _id: a._id,
      title: a.title,
      category: a.category,
      coverImageUrl: a.coverImageUrl || (a.images && a.images[0] && a.images[0].imageUrl) || '',
      imageCount: (a.images || []).length
    }));

    res.json({
      success: true,
      data: {
        settings: settings || {},
        banners: banners || [],
        projects: projects || [],
        schemes: schemes || [],
        news: news || [],
        blogs: blogs || [],
        gallery: gallerySummary,
        videos: videos || [],
        partners: partners || [],
        brochures: brochures || [],
        faqs: faqs || [],
        media: media || []
      }
    });
  } catch (error) {
    console.error('Get public home error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch home content', error: error.message });
  }
};
