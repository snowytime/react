module.exports = {
    extends: [require.resolve("@snowytime/standards/eslint")],
    env: {
        mocha: true,
    },
    rules: {
        "arrow-body-style": "off",
        "import/no-unresolved": "off",
        "import/extensions": "off",
        "no-plusplus": "off",
        "no-return-assign": "off",
        "import/no-extraneous-dependencies": "off",
        "no-continue": "off",
        "no-nested-ternary": "off",
        "lines-between-class-members": "off",
        "class-methods-use-this": "off",
        "no-bitwise": "off",
    },
};
