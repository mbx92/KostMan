import { readFile } from 'fs/promises';
import { join } from 'path';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

// Configure marked with syntax highlighting
marked.use(markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
}));

// Configure marked options
marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
});

export default defineEventHandler(async (event) => {
    const name = getRouterParam(event, 'name');

    if (!name) {
        throw createError({
            statusCode: 400,
            message: 'Document name is required',
        });
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '');

    try {
        const docsDir = join(process.cwd(), 'docs');
        const filePath = join(docsDir, `${sanitizedName}.md`);

        // Read the markdown file
        const content = await readFile(filePath, 'utf-8');

        // Parse markdown to HTML
        const html = await marked.parse(content);

        // Extract metadata (if any frontmatter exists)
        const metadata: Record<string, any> = {};

        // Simple frontmatter extraction (YAML-like)
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1];
            frontmatter.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length > 0) {
                    metadata[key.trim()] = valueParts.join(':').trim();
                }
            });
        }

        return {
            content: html,
            metadata,
            raw: content,
        };
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw createError({
                statusCode: 404,
                message: 'Document not found',
            });
        }

        console.error('Error reading document:', error);
        throw createError({
            statusCode: 500,
            message: 'Failed to read document',
        });
    }
});
