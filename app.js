var Crawler = require("crawler");
var cron = require('cron');
var nodemailer = require("nodemailer");
var winston = require('winston');
var crypto = require('crypto');
var config = require('./config');

var pageContents = [];

var c = new Crawler({
    maxConnections : 10,
    callback : function (error, result, $) {

        var crawlInfo = config.track.urls[result.uri];

        var pageContent = [];
        pageContent[result.uri] = []

        Object.keys(crawlInfo.selectors).forEach(function(selector){
            pageContent[result.uri][selector] = crypto.createHash('sha1').update($(crawlInfo.selectors[selector]).html()).digest('hex');
        });

        if(typeof pageContents[result.uri] != 'undefined'){
            var currentContent = pageContent[result.uri];
            var prevContent = pageContents[result.uri];
            var diff = false;

            Object.keys(currentContent).forEach(function(selector){
                if(currentContent[selector] != prevContent[selector]){
                    diff = true;
                }
            });

            if(diff){
                var generator = require('xoauth2').createXOAuth2Generator({
                    user: config.mail.auth.gmailUsername,
                    clientId: config.mail.auth.clientID,
                    clientSecret: config.mail.auth.clientSecret,
                    refreshToken: config.mail.auth.refreshToken,
                    timeout: config.mail.auth.timeOut,
                });

                var transporter = nodemailer.createTransport(({
                    service: config.mail.service,
                    auth: {
                        xoauth2: generator
                    }
                }));

                transporter.sendMail({
                    from: config.mail.info.from,
                    to: config.mail.info.to,
                    subject: crawlInfo.mail.subject,
                    text: crawlInfo.mail.body,
                }, function(error, response) {
                    if (error) {
                        console.log(error);
                    } else {
                       console.log(Date.now() + " mail sent");
                    }
                });
            }else{
                console.log(Date.now() + " No Changes.... On " + result.uri);
            }
        }

        pageContents[result.uri] = pageContent[result.uri];
    }
});

//Changing from console based logging to file
winston.add(winston.transports.File, { filename: config.log.fileName });
winston.remove(winston.transports.Console);

var cron = cron.job("0 * * * * *", function(){
    Object.keys(config.track.urls).forEach(function(index) {
        c.queue(index);
    });
});

cron.start();