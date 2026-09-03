/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
  // anydoc 为 NAPI 原生模块，必须外部化，禁止 webpack 打包 .node 二进制
  serverExternalPackages: ['@firecrawl/anydoc'],
  eslint: {
    // 在构建过程中忽略ESLint错误
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // 处理PDF.js在SSR中的问题
    if (isServer) {
      config.externals.push({
        'pdfjs-dist': 'commonjs pdfjs-dist',
      });
    }
    
    // 处理canvas模块
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    
    return config;
  },
  /* config options here */
};

module.exports = nextConfig; 