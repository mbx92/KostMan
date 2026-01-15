
import jwt from 'jsonwebtoken';

import { defineEventHandler, getCookie, createError } from 'h3';

export default defineEventHandler((event) => {
    const token = getCookie(event, 'auth_token');

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.NUXT_SESSION_PASSWORD || 'default_secret');
            event.context.user = decoded;
        } catch (e) {
            // Token invalid or expired, just ignore
            throw createError({
                statusCode: 403,
                statusMessage: 'Token invalid or expired',
            });
        }
    }
});
