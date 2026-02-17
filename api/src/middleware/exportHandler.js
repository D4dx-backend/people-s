/**
 * Generic Export Handler Factory
 * 
 * Creates Express route handlers for exporting data from any Mongoose model.
 * Supports CSV and JSON export formats with configurable column definitions.
 * 
 * Usage:
 *   const { createExportHandler } = require('../middleware/exportHandler');
 *   router.get('/export', hasPermission('resource.export'), createExportHandler(Model, options));
 */

const { convertToCSV } = require('../utils/csvHelper');
const ResponseHelper = require('../utils/responseHelper');

/**
 * Create an export handler for a Mongoose model
 * 
 * @param {import('mongoose').Model} Model - Mongoose model to query
 * @param {Object} options - Configuration options
 * @param {Array<Object>} options.columns - Column definitions for CSV
 * @param {string} options.columns[].header - CSV column header
 * @param {string} options.columns[].accessor - Dot-notation field path
 * @param {string} [options.columns[].type] - Value type: 'date','datetime','currency','number','boolean','array'
 * @param {Function} [options.columns[].transform] - Custom transform: (value, row) => string
 * @param {Array<Object>} [options.populate] - Mongoose populate config
 * @param {string} options.populate[].path - Field to populate
 * @param {string} options.populate[].select - Fields to select
 * @param {Object} [options.defaultSort] - Default sort object, e.g. { createdAt: -1 }
 * @param {number} [options.maxLimit=10000] - Maximum records to export
 * @param {string} options.filenamePrefix - Filename prefix for CSV download
 * @param {Function} [options.filterBuilder] - Build query from req.query: (query) => mongooseFilter
 * @param {string} [options.selectFields] - Mongoose select string to limit fields fetched
 * @returns {Function} Express route handler (req, res)
 */
function createExportHandler(Model, options) {
  const {
    columns,
    populate = [],
    defaultSort = { createdAt: -1 },
    maxLimit = 10000,
    filenamePrefix = 'export',
    filterBuilder = null,
    selectFields = null
  } = options;

  return async (req, res) => {
    try {
      const { format = 'json', ...filters } = req.query;

      // Build query filter
      let query = {};
      if (filterBuilder && typeof filterBuilder === 'function') {
        query = filterBuilder(filters, req);
      }

      // Build the Mongoose query
      let dbQuery = Model.find(query);

      // Apply populate
      if (populate.length > 0) {
        for (const pop of populate) {
          dbQuery = dbQuery.populate(pop);
        }
      }

      // Apply field selection
      if (selectFields) {
        dbQuery = dbQuery.select(selectFields);
      }

      // Apply sort and limit
      dbQuery = dbQuery.sort(defaultSort).limit(maxLimit).lean();

      const data = await dbQuery;

      if (format === 'csv') {
        const csvString = convertToCSV(data, columns);

        if (!csvString) {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${filenamePrefix}_empty.csv`);
          return res.send(columns.map(c => `"${c.header}"`).join(','));
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `${filenamePrefix}_${dateStr}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        // Add BOM for Excel UTF-8 compatibility
        return res.send('\ufeff' + csvString);
      }

      // JSON format (default)
      return ResponseHelper.success(res, {
        records: data,
        total: data.length,
        exportedAt: new Date().toISOString()
      }, `${filenamePrefix} exported successfully`);

    } catch (error) {
      console.error(`❌ Export ${filenamePrefix} Error:`, error);
      return ResponseHelper.error(res, `Failed to export ${filenamePrefix}`, 500);
    }
  };
}

module.exports = { createExportHandler };
