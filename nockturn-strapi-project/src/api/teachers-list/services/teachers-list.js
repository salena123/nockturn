'use strict';

/**
 * teachers-list service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::teachers-list.teachers-list');
