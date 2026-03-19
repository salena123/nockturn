'use strict';

/**
 * event-list service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::event-list.event-list');
