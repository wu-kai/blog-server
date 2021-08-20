const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const ueditor = require('ueditor');
const request = require('request');
const multipart = require('connect-multiparty');
const multiparty = require('multiparty');
const util = require('util');
const fs = require('fs');
const AV = require('leanengine');
const timeout = require('connect-timeout');

AV.init({
  appId: process.env.LEANCLOUD_APP_ID || 'nxyzr8b8h1EU6jqinnvYhxdO-gzGzoHsz',
  appKey: process.env.LEANCLOUD_APP_KEY || 'pCb1NCrIuBGGhY4GLxebm6pe',
  serverURL: process.env.LEANCLOUD_SERVER_URL || 'https://admin.yichenk.com',
  masterKey: process.env.LEANCLOUD_APP_MASTER_KEY || 'NDzp1Vz88uouK0E5RNCuuNck'
});
// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();

var multipartMiddleware = multipart();

const qiniu = require('./common/qiniu');
const weixin = require('./common/weixin');

const app = express();

const BODY_PARSER_MAX_BYTES = 1024 * 1024 * 10; // 10MB allowed to receive body content
const isPro = process.env.NODE_ENV === 'production';

//因为莫名其妙的请求路径是这样，所以只能进行适配
const uploadPath = isPro ? '/static/js/libStatic/ueditor-utf8-php/ue' : '/libStatic/ueditor-utf8-php/ue';
//本地运行用3000端口，线上环境用80端口
const port = 3000;

app.use(bodyParser.json({ limit: BODY_PARSER_MAX_BYTES }));
app.use(bodyParser.urlencoded({ extended: true, limit: BODY_PARSER_MAX_BYTES }));

//富文本编辑器图片上传配置
app.use(uploadPath, ueditor(path.join(__dirname, '/images'), function (req, res, next) {
  var date = new Date();
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  // ueditor 客户发起上传图片请求
  if (req.query.action === 'uploadimage') {
    var foo = req.ueditor;
    var imgname = req.ueditor.filename;
    var img_url = '/ueditor/' + y + '/' + m + '/' + d + '/';
    res.ue_up(img_url); //你只要输入要保存的地址 。保存操作交给ueditor来做
  }
  // 客户端发起图片列表请求
  else if (req.query.action === 'listimage') {
    var dir_url = '/ueditor/';
    res.ue_list(dir_url); // 客户端会列出 dir_url 目录下的所有图片
  }
  // 客户端发起其它请求
  else {
    res.setHeader('Content-Type', 'application/json');
    res.redirect('/libStatic/ueditor-utf8-php/php/config.json')  //这里的路径要加载对否则就不能上传图片。如果你下载的是JSP那就对应jsp目录
  }
}));
//图片上传配置

//提供静态资源的访问 例如：localhost:30000/static/demo.js 会直接返回src下的demo.js文件
//使用path模块的normalize可以将window和linux的路径进行统一
// 设置模板引擎
app.set('public', path.join(__dirname, 'public'));
app.use('/build', express.static(path.normalize(__dirname + '/../build')));
app.use('/libStatic', express.static(path.normalize(__dirname + '/lib')));
app.use('/ueditor', express.static(path.normalize(__dirname + '/images/ueditor')));
app.use('/static', express.static(path.normalize(__dirname + '/public/static')));
app.use('/', express.static(path.normalize(__dirname + '/')));

qiniu.getQiNiu(function (d) {
  console.log('d', d);
});

// 设置默认超时时间
app.use(timeout('15s'));

app.use(express.urlencoded());
app.use(express.json());
app.get('/wxJssdk/getJssdk', (req, res) => {
  weixin.getWeiXin(req, res)
});
app.post('/api/uploadFile_to_qiniu', multipartMiddleware, (req, res) => {
  /* 生成multiparty对象，并配置上传目标路径 */
  let form = new multiparty.IncomingForm();
  /* 设置编辑 */
  // form.encoding = 'utf-8';
  //设置文件存储路劲
  form.uploadDir = './test/files';
  //设置文件大小限制
  form.maxFilesSize = 2 * 1024 * 1024;
  form.parse(req, function (err, fields, files) {
    let filesTemp = JSON.stringify(files, null, 2);

    if (err) {
      console.log('parse error:' + err);
    } else {
      console.log('parse files:' + filesTemp);
      let inputFile = files.inputFile[0];
      let uploadedPath = inputFile.path;
      let dstPath = './test/files' + inputFile.originalFilename;
      //重命名为真实文件名
      fs.rename(uploadedPath, dstPath, function (err) {
        if (err) {
          console.log('rename error:' + err);
        } else {
          console.log('rename ok');
        }
      })
    }
    res.writeHead(200, { 'content-type': 'text/plain;charset=utf-8' });
    res.write('received upload:\n\n');
    res.end(util.inspect({ fields: fields, files: filesTemp }))
  })
});

app.all('/', function (req, res) {
  if (isPro) {
    res.sendFile(__dirname + '/public/index.html')
  } else {
    res.sendFile(__dirname + '/public/index.html')
  }
});

app.use('/1.1', function (req, res) {
  const url = `https://admin.yichenk.com/1.1${req.url}`;
  request({
    url: url,
    method: req.method,
    headers: {
      name: 'content-type',
      value: 'application/x-www-form-urlencoded',
      'X-LC-Id': req.headers['x-lc-id'],
      'X-LC-Key': req.headers['x-lc-key']
    },
    json: true,
    body: req.body,
  }, function (error, response, body) {
    res.send(error || body);
  })
});

app.use('/api/blog/validate', function (req, res) {
  const value = req.query.validateValue;
  if (value === 'manage') {
    res.jsonp({ result: true })
  } else {
    res.jsonp({ result: false })
  }
});

app.use('/api', function (req, res) {
  res.send('这里什么都没有');
});

app.use(function (req, res, next) {
  // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
  if (!res.headersSent) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  }
});

app.listen(port, function () {
  console.error('> Web server listen ' + port + '......');
});
