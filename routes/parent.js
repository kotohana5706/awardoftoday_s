var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var mongo = require('../mongo');
var randomstring = require('randomstring');
var router = express.Router();
var gcm = require('node-gcm');
var fs = require('fs');
var server_api_key = 'AIzaSyB_pSJ2Ph6FRcd5TgS0foigWwaG8_C8L3o';
var sender = new gcm.Sender(server_api_key);
var registrationIds = [];
module.exports = router;


router.post('/findChild', function(req,res){
  mongo.User.findOne({id : req.body.id}, function(err, doc){
    console.log(doc);
    if(doc!=null) {
      if(doc.isParent==false){
        res.send({
          name : doc.name,
          id : doc.id,
          apikey : doc.apikey
        });
      } else res.sendStatus(400);
    } else res.sendStatus(400);
  });
});


router.post('/registerChild', function(req,res){
  var name = req.body.name;
  var apikey = req.body.apikey;
  var targetName = req.body.targetName;
  var targetApikey = req.body.targetApikey;
  mongo.User.update({apikey:apikey}, {targetApikey : targetApikey, targetName : targetName}, function(err, numAffected){
    if(!err){
      mongo.User.update({apikey:targetApikey}, {targetApikey : apikey, targetName : name}, function(err, numAffected){
        if(err) res.sendStatus(401);
        else mongo.User.findOne({apikey:targetApikey}, function(err, doc){
          res.send(doc);
        });
      });
    }
  });
});

router.post('/postArticle', function(req, res){
  var apikey = req.body.apikey;
  var title = req.body.title;
  var sticker = req.body.sticker;
  var reqDate = req.body.date; // 2015-01-01 12:30
  var articleKey = randomstring.generate();
  var content = req.body.content;

  var date = new Date(reqDate);
  var year = date.getFullYear();
  var month = date.getMonth()+1;
  var day = date.getDate();
  var hour = date.getHours();
  var minute = date.getMinutes();
  console.log(date);
  var article = new mongo.Article({
    title : title,
    date : date,
    dateType : {
      year : year,
      month : month,
      day : day,
      hour : hour,
      minute : minute
    },
    alertTime : undefined,
    apikey : apikey,
    content : content,
    sticker : sticker,
    articleKey : articleKey,
    status : 'working',
    waiting : false
  });
  article.save(function(err){
    if(err) res.sendStatus(400);
    else {
      console.log(article);
      res.send(article);
    }
  });
});

router.post('/listArticle', function(req, res){
  var nowStat = req.body.nowStat;
  var apikey = req.body.targetApikey;
  mongo.Article.find('{ status : nowStat }', function(err, docs){
    if(docs.length==0) res.sendStatus(400);
    else res.send(docs);
    });
});

router.post('/configureArticle', function(req, res){
  var targetApikey = req.body.targetApikey;
  var articleKey = req.body.articleKey;
  var confirm = req.body.confirm;
  var result = (confirm=='true')?"finished":"failed";
  var asdf = (confirm=='true')?"과제에 성공했습니다!":"과제에 실패했습니다!";
  console.log(confirm);
  console.log(typeof confirm);
  var token;
  mongo.Article.update({articleKey:articleKey}, {status:result}, function(err, numAffected){
    if(err) throw err;
    else {
      mongo.User.findOne({apikey:targetApikey}, function(err, doc){
        if(err) throw err;
        else {
          token = doc.token;
          var message = new gcm.Message({
              collapseKey: 'demo',
              delayWhileIdle: true,
              timeToLive: 10,
              data: {
                  type : "toChild",
                  title: asdf,
                  message: '알림을 눌러 확인해주세요.',
              }
          });
          registrationIds.push(token);
          sender.send(message, registrationIds, 4, function (err, result) {
              if(err) throw err;
              else{
                mongo.Article.update({articleKey : articleKey}, {status:result}, function(err, numAffected){
                  res.sendStatus(200);
                  console.log(result);
                })
              }
          });
        }
      });
    }
  });
});
