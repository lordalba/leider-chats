module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleFileExtensions: ["ts", "js"],
    testMatch: ["**/*.test.ts"], // Ensure it looks for .test.ts files
    testPathIgnorePatterns: ["/node_modules/", "/src/"],
    testTimeout: 30000,
    rootDir: ".", // Set root directory for tests
  };
