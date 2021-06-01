'use strict';

var express = require('express');
var request = require('request');
var timeout = require('connect-timeout');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AV = require('leanengine');

AV.init({
  appId: process.env.LEANCLOUD_APP_ID || 'nxyzr8b8h1EU6jqinnvYhxdO-gzGzoHsz',
  appKey: process.env.LEANCLOUD_APP_KEY || 'pCb1NCrIuBGGhY4GLxebm6pe',
  serverURL: process.env.LEANCLOUD_SERVER_URL || 'https://admin.yichenk.com',
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY || 'NDzp1Vz88uouK0E5RNCuuNck'
});

// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

var app = express();

// 设置模板引擎
app.set('public', path.join(__dirname, 'public'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// 设置默认超时时间
app.use(timeout('15s'));

// 加载云引擎中间件
app.use(AV.express());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/', function (req, res) {
  res.render('index', { currentTime: new Date() });
});

app.use('/1.1', function (req, res) {
  const url = `https://admin.yichenk.com/1.1${req.url}`;
  req.pipe(request(url)).pipe(res);
});

app.use('/api', function (req, res) {
  res.send('这里什么都没有');
});

app.use(function (req, res, next) {
  // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
  if (!res.headersSent) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  }
});

// error handlers
app.use(function (err, req, res, next) { // jshint ignore:line
  var statusCode = err.status || 500;
  if (statusCode === 500) {
    console.error(err.stack || err);
  }
  if (req.timedout) {
    console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
  }
  res.status(statusCode);
  // 默认不输出异常详情
  var error = {}
  if (app.get('env') === 'development') {
    // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
    error = err;
  }
  res.render('error', {
    message: err.message,
    error: error
  });
});

// 端口一定要从环境变量 `LEANCLOUD_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || 3000);
app.listen(PORT, function () {
  console.log('Node app is running, port:', PORT);

  // 注册全局未捕获异常处理器
  process.on('uncaughtException', function (err) {
    console.error("Caught exception:", err.stack);
  });
  process.on('unhandledRejection', function (reason, p) {
    console.error("Unhandled Rejection at: Promise ", p, " reason: ", reason.stack);
  });
});
