var request = require('request');

/**
 * Simple client for GitHub's REST API.
 */
class GitHubClient {
  /**
   * @param {Object}
   *  @param {String} accessToken - A GitHub access token. Must have the `repo:status` OAuth scope.
   *  @param {String} location - The full location (origin + path) of the testing middleware e.g.
   *    "https://example.com/humans".
   */
  constructor({ accessToken, location }) {
    this._accessToken = accessToken;
    this._location = location;
  }

  /**
   * Updates the status of a commit.
   *
   * @param {Object}
   *  @param {String} repo - The full name of the repo (owner/repo) for which to update a commit status.
   *  @param {String} sha - The Git SHA of the commit for which to update the status.
   *  @param {Boolean} tested - `true` if the commit has been tested, `false` otherwise.
   * @param {Function<Error>} done - Errback.
   */
  updateStatus({ repo, sha, tested }, done) {
    request.post(`https://api.github.com/repos/${repo}/statuses/${sha}`, {
      headers: {
        Authorization: `token ${this._accessToken}`,
        // https://developer.github.com/v3/#user-agent-required
        'User-Agent': 'Integration Testing for Humans'
      },
      json: {
        state: tested ? 'success' : 'pending',
        target_url: `${this._location}/test/${repo}/build/${sha}`,
        description: tested ? 'Tested' : 'Untested',
        context: 'Integration Testing for Humans'
      }
    }, (err, resp, body) => {
      if (err || (!(resp.statusCode >= 200 && resp.statusCode < 300))) {
        done(new Error(`${resp.statusCode}: ${JSON.stringify(resp.body)}`));
      } else {
        done();
      }
    });
  }
}

module.exports = GitHubClient;
