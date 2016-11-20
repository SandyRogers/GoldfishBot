var Botkit = require('botkit');
var randomEmoji = require('random-emoji');
var timestamp = require('unix-timestamp');

var controller = Botkit.slackbot({
  debug: false,
  json_file_store: 'filestore.json'
  //include "log: false" to disable logging
  //or a "logLevel" integer from 0 to 7 to adjust logging verbosity
});

// connect the bot to a stream of messages
controller.spawn({
  token: process.env.SLACK_TOKEN,
}).startRTM()

// give the bot something to listen for.
controller.hears('hello',['direct_message','direct_mention','mention'],function(bot,message) {

  bot.reply(message,'Hello yourself.');

});

function montageIt(bot, channel_id, oldest, latest, count, authors, montage_channel) {
  bot.api.channels.history({
      channel: channel_id,
      oldest: oldest,
      latest: latest,
      count: count,
      inclusive: 0
    }, function(err, response) {
        if (authors.length > 0) {
            response.forEach(function(msg) {
              var messages = [];
              if (authors.indexOf(msg.user) !== -1) {
                messages.push(msg);
              }
            });
        }
        else {
            messages = response;
        }
        addToMontage(bot, messages.messages, montage_channel);
    });
}

function addToMontage(bot, messages, montage_channel) {
    var reply = {
            text: randomEmoji.random({count: 1})[0].character + ' ' + timestamp.toDate(timestamp.now()) ,
            attachments: [],
        }
        
    bot.api.users.list({}, function(err, response) {
        for (var x = 0; x < messages.length; x++) {
            var real_name = 'Somebody';
            var icon = ':simple_smile'
            for (var u = 0; u < response.members.length; u++) {
                if (response.members[u].id == messages[x].user) {
                    var profile = response.members[u].profile || {};
                    real_name = profile.real_name || 'Somebody';
                    icon  = profile.image_48 || ':simple_smile';
                    break;
                }
            }
            reply.attachments.push({
                'author_name': real_name,
                'author_icon': icon,
                'text': messages[x].text
            });
        }
        bot.say({channel: montage_channel, attachments: reply.attachments, text: reply.text});
    });
}

controller.hears('this is the montage channel', ['direct_mention'], function(bot, message) {
    controller.storage.teams.save({id: message.team, montage_channel: message.channel}, function(err) { console.log(err) });
    bot.reply(message, 
        ':ok_hand: this is the channel where your Montage will grow in awesomeness from now on. https://65.media.tumblr.com/5ca1877af250a437701589dac4dd0972/tumblr_mnyt7nWg4y1qcga5ro1_500.jpg');
});

controller.hears(['remember', 'save', 'add', 'store', 'record', 'montage'], ['direct_mention', 'mention'], function(bot, message) {
    
    controller.storage.teams.get(message.team, function(err, team_data) {
        if (err) {
            bot.reply(message, 'https://65.media.tumblr.com/5ca1877af250a437701589dac4dd0972/tumblr_mnyt7nWg4y1qcga5ro1_500.jpg :scream: I\'m afraid I don\'t know which channel to make your Montage in - sorry! Please make a new Slack channel (maybe call it #montage). Invite me to it and say "@monty this is the montage channel". Thanks!');
            return;
        }
        var montage_channel = team_data.montage_channel;
        var now = message.ts;
        
        // Did they specify any filters on what we should save?
        // How many previous messages?
        var r = / \d+/;
        var count = parseInt(message.text.match(r)) || 10;
        
        // Which message authors?
        var target_people = message.text.match(/(<@U[\w]{8,8}>)/g) || [];
        var target_people_who_arent_me = [];
        target_people.forEach(function(u) {
            var u_clean = u.substring(2, 11);
            if (u_clean !== bot.identity.id) {
                target_people_who_arent_me.push(u_clean);
            }
        });
        
        montageIt(bot, message.channel, 0, now, count, target_people_who_arent_me, montage_channel);
    });
});