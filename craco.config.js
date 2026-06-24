module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 添加模块解析规则，解决缺少扩展名的导入问题
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false, // 禁用完全规范化导入模式
        },
      });

      return webpackConfig;
    },
  },
}; 