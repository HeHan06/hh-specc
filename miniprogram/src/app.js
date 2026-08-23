import { Component } from 'react';

// 小程序应用入口：读者端无登录态、无全局状态，仅承载页面渲染。
class App extends Component {
  render() {
    return this.props.children;
  }
}

export default App;
