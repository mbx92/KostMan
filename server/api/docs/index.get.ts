import { readdir } from 'fs/promises';
import { join } from 'path';

export default defineEventHandler(async (event) => {
    try {
        const docsDir = join(process.cwd(), 'docs');
        const files = await readdir(docsDir);

        // Filter only markdown files
        const mdFiles = files.filter(file => file.endsWith('.md'));

        // Parse file names and create metadata
        const docs = mdFiles.map(file => {
            const name = file.replace('.md', '');

            // Extract title from filename (convert SNAKE_CASE to Title Case)
            const title = name
                .split(/[_-]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            // Categorize based on filename patterns
            let category = 'general';

            if (name.includes('BILLING') || name.includes('BILL')) {
                category = 'billing';
            } else if (name.includes('TEST')) {
                category = 'testing';
            } else if (name.includes('IMPLEMENTATION') || name.includes('PLAN')) {
                category = 'planning';
            } else if (name.includes('SETTINGS') || name.includes('PRORATION')) {
                category = 'configuration';
            } else if (name.includes('QUICK') || name.includes('REFERENCE') || name.includes('GUIDE')) {
                category = 'guides';
            }

            return {
                name,
                title,
                category,
            };
        });

        // Sort by category, then by title
        docs.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.title.localeCompare(b.title);
        });

        return docs;
    } catch (error) {
        console.error('Error reading docs directory:', error);
        throw createError({
            statusCode: 500,
            message: 'Failed to read documentation files',
        });
    }
});
