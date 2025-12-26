// api/check-env.js
export default async function handler(req, res) {
    // Don't expose the full key, just check if it exists
    const hasApiKey = !!process.env.BROWSERLESS_API_KEY;
    const keyLength = process.env.BROWSERLESS_API_KEY?.length || 0;

    return res.status(200).json({
        hasBrowserlessApiKey: hasApiKey,
        apiKeyLength: keyLength,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        allEnvVars: Object.keys(process.env).filter(key =>
            key.includes('BROWSERLESS') || key.includes('VERCEL') || key.includes('NODE')
        )
    });
}