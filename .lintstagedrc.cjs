module.exports = {
    "**/*.{js,jsx,cjs,mjs}": [
        "eslint --max-warnings 0"
    ],
    "**/*.{ts,tsx}": [
        () => "npm run type-check"
    ]
};
