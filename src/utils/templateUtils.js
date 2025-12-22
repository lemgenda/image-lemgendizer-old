import { TEMPLATE_NAMES, PLATFORM_NAMES } from '../constants/sharedConstants.js';

/**
 * Gets template by ID.
 * @param {string} templateId - Template ID
 * @param {Array<Object>} templateConfigs - Template configurations
 * @returns {Object|null} Template object or null if not found
 */
export const getTemplateById = (templateId, templateConfigs) => {
    return templateConfigs.find(t => t.id === templateId) || null;
};

/**
 * Gets templates by category.
 * @param {string} category - Template category
 * @param {Array<Object>} templateConfigs - Template configurations
 * @returns {Array<Object>} Array of templates in the category
 */
export const getTemplatesByCategory = (category, templateConfigs) => {
    return templateConfigs.filter(t => t.category === category);
};

/**
 * Calculates total files generated from selected templates.
 * @param {Array<string>} selectedTemplates - Array of selected template IDs
 * @param {Array<Object>} SOCIAL_MEDIA_TEMPLATES - All available templates
 * @returns {number} Total number of files to generate
 */
export const calculateTotalTemplateFiles = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES) => {
    if (!selectedTemplates || selectedTemplates.length === 0) return 0;

    let totalFiles = 0;
    const templateIds = selectedTemplates;
    const templates = SOCIAL_MEDIA_TEMPLATES.filter(t => templateIds.includes(t.id));

    templates.forEach(template => {
        if (template.category === 'web') {
            totalFiles += 2;
        } else if (template.category === 'logo') {
            totalFiles += 1;
        } else {
            totalFiles += 1;
        }
    });

    return totalFiles;
};