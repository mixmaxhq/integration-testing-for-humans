#! /usr/bin/env node

var express = require('express');
var humans = require('..');


var argv = require('yargs')
  .usage('Usage: $0 [options')
  .options({
    githubAccessToken: {
      describe: 'A GitHub access token with the `repo:status` OAuth scope. Can also be specified ' +
        'using the ITFH_GITHUB_ACCESS_TOKEN environment variable.',
      required: true,
    },
    githubWebhookSecret: {
      describe: 'The secret for the pull request webhook for the repo you want to test. If you want ' +
        'to monitor multiple repos just use the same secret for the webhook for each repo. Can also ' +
        'be specified using the ITFH_GITHUB_WEBHOOK_SECRET environment variable.',
      required: true
    },
    location: {
      describe: 'The origin of the server e.g. "https://example.com".',
      required: true
    },
    port: {
      describe: 'The port on which to run the pull request testing middleware.',
      type: 'number',
      required: true
    },
    defaultTest: {
      describe: 'The name of the default test to run on staging before merging e.g. "Send an email".',
      type: 'string'
    },
    mergeBranch: {
      describe: 'The name of a branch. If specified, only PRs targeting this branch will be updated ' +
        'by this middleware.'
    }
  })
  .env('ITFH')
  .example('ITFH_GITHUB_ACCESS_TOKEN="..." ITFH_GITHUB_WEBHOOK_SECRET="..." $0 --location="https://example.com" --port=3000')
  .help('h')
  .alias('h', 'help')
  .argv;


var app = express();

var middleware = humans({
  githubAccessToken: argv.githubAccessToken,
  githubWebhookSecret: argv.githubWebhookSecret,
  location: argv.location,
  defaultTest: argv.defaultTest,
  mergeBranch: argv.mergeBranch
});
middleware.on('error', (err) => console.error(err));
app.use(middleware);

app.listen(argv.port);
