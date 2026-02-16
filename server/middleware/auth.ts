
import jwt from 'jsonwebtoken';

import { defineEventHandler, getCookie } from 'h3';

export default defineEventHandler((event) => {
    const token = getCookie(event, 'auth_token');

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.NUXT_SESSION_PASSWORD || 'default_secret');
            event.context.user = decoded;
        } catch (e) {
            // Token invalid or expired, clear the cookie and ignore
            // Don't throw error here - let individual routes handle auth requirements
            event.context.user = null;
        }
    }
});
