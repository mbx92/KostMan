
export default defineEventHandler((event) => {
    deleteCookie(event, 'auth_token');
    return { message: 'Logged out successfully' };
});
