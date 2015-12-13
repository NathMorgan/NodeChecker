var Crawler = require("crawler");
var cron = require('cron');
var nodemailer = require("nodemailer");
var winston = require('winston');
var crypto = require('crypto');
var randomua = require('random-ua');

var config = require('./config');

var pageContents = [];

var c = new Crawler({
    maxConnections : 10,
    userAgent: function(){
        if(config.crawler.spoofUA)
            return randomua.generate();
    },
    callback : function (error, result, $) {

        var crawlInfo = config.crawler.urls[result.uri];

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
                        logger.info("mail sent");
                    }
                });
            }else{
                logger.info("No Changes.... On " + result.uri);
            }
        }

        pageContents[result.uri] = pageContent[result.uri];
    }
});

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            timestamp: function() {
                var time = new Date();

                var hour = time.getHours();
                var minutes = time.getMinutes();
                var seconds = time.getSeconds();

                return hour + ":" + minutes + ":" + seconds;
            },
            formatter: function(options) {
                // Return string will be passed to logger.
                return options.timestamp() +' : '+ (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
            }
        })
    ]
});

//Changing from console based logging to file
logger.add(winston.transports.File, { filename: config.log.fileName });
logger.remove(winston.transports.Console);

var job = new cron.CronJob({
    cronTime: config.cron.time,
    onTick: function(){
        Object.keys(config.crawler.urls).forEach(function(index) {
            c.queue(index);
        });
    },
    start: config.cron.autoStart,
    timeZone: config.cron.timezone,
});

job.start();
