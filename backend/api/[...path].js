// Route all unmatched /api/* requests through the Express application.
// More specific API functions, such as api/cron/expire-reservations.js,
// keep their own routes.
module.exports = require("../server");
