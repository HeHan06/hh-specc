// 页面路由集中声明；本期仅一个只读展示页，不配置 tabBar，也不申请任何隐私权限。
export default {
  pages: ['pages/quote/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '每日一句',
    navigationBarTextStyle: 'black',
  },
};
