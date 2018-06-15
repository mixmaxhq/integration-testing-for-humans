var createWebhookHandler = require('github-webhook-handler');
var EventEmitter = require('events');
var express = require('express');
var GitHubClient = require('./GitHubClient');

/**
 * Creates middleware to respond to pull request-related events by asking developers to test staging.
 *
 * Say that this middleware is mounted at the path '/humans' on a server with origin "https://example.com".
 * Then, register "https://example.com/humans/events" as a webhook for the repo whose pull requests
 * you wish to test. Select "Pull request" events to be sent to the webhook.
 *
 * The middleware is an event emitter. You should register an 'error' listener to respond to errors
 * arising from the GitHub API, since they will be emitted outside the Express request lifecycle.
 * If you don't register a listener, any errors will be thrown to the run loop and crash the server!
 *
 * @param {Object} options
 *  @param {String} githubAccessToken - A GitHub access token. Must have the `repo:status` OAuth scope.
 *  @param {String} githubWebhookSecret - The secret you specified for the webhook. If you want to
 *    monitor multiple repos just use the same secret for the webhook for each repo.
 *  @param {String} location - he full location (origin + path) of the middleware e.g.
 *    "https://example.com/humans".
 *  @param {String=} defaultTest - The name of the default test to run on staging before merging
 *    e.g. "Send an email". Can contain HTML (e.g. a link to a fuller description of your test).
 *  @param {String=} mergeBranch - (Optional) The name of a branch. If specified, only PRs targeting
 *    this branch will be monitored by this middleware.
 */
function createRouter(options) {
  var {
    githubAccessToken,
    githubWebhookSecret,
    location,
    defaultTest,
    mergeBranch
  } = options;

  var client = new GitHubClient({ accessToken: githubAccessToken, location });

  var router = express.Router();
  var eventEmitter = new EventEmitter();

  // Use a proxy to mix event emitter functionality into the router without making assumptions about
  // the event emitter's storage (whatever its constructor does).
  var routerProxy = new Proxy(router, {
    get(_, prop) {
      var obj = Reflect.has(router, prop) ? router : eventEmitter;
      var val = Reflect.get(obj, prop, obj);
      if (typeof val === 'function') {
        var origVal = val;
        val = function(...args) {
          var ret = origVal.apply(obj, args);
          // The result of `router.on(...)` should appear to be the router still.
          if (ret === eventEmitter) ret = routerProxy;
          return ret;
        };
      }
      return val;
    }
  });

  routerProxy.use(createWebhookHandler({
    path: '/events',
    secret: githubWebhookSecret
  }).on('pull_request', (data) => {
    // "synchronize" means that someone pushed to the PR branch.
    if (!/(re)?opened|synchronize/.test(data.payload.action)) return;
    if (mergeBranch && (data.payload.pull_request.base.ref !== mergeBranch)) return;

    client.updateStatus({
      repo: data.payload.pull_request.base.repo.full_name,
      sha: data.payload.pull_request.head.sha,
      tested: false
    }, (err) => {
      if (err) routerProxy.emit('error', err);
    });
  }).on('error', (err) => {
    routerProxy.emit('error', err);
  }));

  routerProxy.use('/test/:owner/:repo/build/:sha',
    express.Router({ mergeParams: true })
      .get('/', (req, res) => {
        var testAction = 'Then click this button.';
        if (defaultTest) testAction = `${defaultTest} on staging, ${testAction.toLowerCase()}`;
        res.send(`
          <h1>Test staging!</h1>
          <p>${testAction}</p>
          <form method="POST" action="${req.originalUrl}/tested">
            <button style="font-size: 14px;">I have tested staging.</button>
          </form>
        `);
      })
      .post('/tested', (req, res) => {
        client.updateStatus({
          repo: `${req.params.owner}/${req.params.repo}`,
          sha: req.params.sha,
          tested: true
        }, (err) => {
          if (err) {
            routerProxy.emit('error', err);
            res.status(500).send('An error occurred');
          } else {
            res.send('You may merge your PR now.');
          }
        });
      })
  );

  return routerProxy;
}

module.exports = createRouter;
