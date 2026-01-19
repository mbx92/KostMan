export default defineEventHandler(async (event) => {
    // Get tenant from session
    const authHeader = getHeader(event, 'authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        });
    }

    const token = authHeader.substring(7);
    let session: any;
    
    try {
        session = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (e) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid token',
        });
    }

    return {
        success: true,
        tenant: {
            id: session.tenantId,
            name: session.name,
            contact: session.contact,
        },
        isDefaultPin: session.isDefaultPin,
    };
});
