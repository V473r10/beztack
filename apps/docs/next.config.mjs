import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import createJiti from "jiti";

const jiti = createJiti(fileURLToPath(import.meta.url));

// Import env here to validate during build
jiti("./env");

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        hostname: "env.t3.gg",
      },
    ],
  },
};

export default withMDX(config);
