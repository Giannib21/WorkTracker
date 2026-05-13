'use strict';

// Carica tslib via main CJS (tslib.js), evitando modules/index.js e il default import rotto.
const tslib = require('tslib');

module.exports = tslib;
module.exports.default = tslib;
