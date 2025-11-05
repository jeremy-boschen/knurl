# Documentation Fixtures

This directory contains pre-built collection fixtures used for documentation screenshot generation.

## github-api-collection.json

A comprehensive GitHub REST API v3 collection that mirrors the real GitHub API structure while all requests point to local mock server endpoints.

### Structure

```json
{
  "id": "github-api-collection",
  "name": "GitHub API",
  "description": "GitHub REST API v3 with mock endpoints",
  "folders": [
    {
      "id": "repos-folder",
      "name": "Repos",
      "requests": [
        {
          "id": "list-user-repos",
          "name": "List user repositories",
          "method": "GET",
          "url": "{{base_url}}/user/repos",
          "headers": [...],
          "params": [...]
        }
      ]
    }
  ],
  "environments": [
    {
      "id": "dev",
      "name": "Development",
      "variables": {
        "base_url": "http://localhost:3000/mock/github",
        "github_token": "ghp_dev_token_...",
        ...
      }
    }
  ]
}
```

### API Categories

The collection includes the following real GitHub API sections:

1. **Repos** (3 requests)
   - List user repositories
   - Get a repository
   - Create a repository

2. **Issues** (4 requests)
   - List repository issues
   - Get an issue
   - Create an issue
   - List issue comments

3. **Pulls** (2 requests)
   - List pull requests
   - Get a pull request

4. **Commits** (2 requests)
   - List commits
   - Get a commit

5. **Users** (3 requests)
   - Get authenticated user
   - Get a user
   - List user followers

6. **Search** (2 requests)
   - Search repositories
   - Search issues

7. **Gists** (2 requests)
   - List user's gists
   - Get a gist

### Mock Server Endpoints

All requests point to `http://localhost:3000/mock/github/*` where endpoints are defined in `scripts/oauth-mock-server.mjs`:

- `GET /mock/github/user` - Authenticated user info
- `GET /mock/github/user/repos` - User repositories
- `POST /mock/github/user/repos` - Create repository
- `GET /mock/github/repos/:owner/:repo` - Repository details
- `GET /mock/github/repos/:owner/:repo/issues` - Repository issues
- `POST /mock/github/repos/:owner/:repo/issues` - Create issue
- `GET /mock/github/repos/:owner/:repo/issues/:number` - Issue details
- `GET /mock/github/repos/:owner/:repo/issues/:number/comments` - Issue comments
- `GET /mock/github/repos/:owner/:repo/pulls` - Pull requests
- `GET /mock/github/repos/:owner/:repo/pulls/:number` - PR details
- `GET /mock/github/repos/:owner/:repo/commits` - Commits
- `GET /mock/github/repos/:owner/:repo/commits/:sha` - Commit details
- `GET /mock/github/users/:username` - User profile
- `GET /mock/github/users/:username/followers` - User followers
- `GET /mock/github/search/repositories` - Search repos
- `GET /mock/github/search/issues` - Search issues
- `GET /mock/github/user/gists` - User gists
- `GET /mock/github/gists/:id` - Gist details

### Updating the Fixture

When updating the fixture:

1. **Add a new request**:
   ```json
   {
     "id": "unique-id",
     "name": "Request Name",
     "method": "GET|POST|PUT|DELETE|PATCH",
     "url": "{{base_url}}/endpoint/path",
     "description": "What this request does",
     "headers": [
       {
         "key": "Authorization",
         "value": "Bearer {{github_token}}",
         "enabled": true
       }
     ],
     "params": [
       {
         "key": "parameter_name",
         "value": "default_value",
         "enabled": true,
         "description": "Optional description"
       }
     ],
     "body": {
       "type": "json|form|raw",
       "content": {...}
     }
   }
   ```

2. **Update variables in environments**:
   ```json
   "environments": [
     {
       "id": "dev",
       "name": "Development",
       "variables": {
         "base_url": "http://localhost:3000/mock/github",
         "github_token": "ghp_dev_token_123456789",
         "owner": "newty",
         "repo": "knurl",
         "username": "newty"
       }
     }
   ]
   ```

3. **Add mock server endpoint** (if new endpoint needed):
   Edit `scripts/oauth-mock-server.mjs` and add the endpoint handler:
   ```javascript
   app.get('/mock/github/new/endpoint', (req, res) => {
     res.setHeader('Content-Type', 'application/json');
     respondJson(res, 200, {
       // Mock response data
     });
   });
   ```

### Naming Conventions

- **IDs**: Use kebab-case (e.g., `list-user-repos`)
- **Names**: Use title case (e.g., "List user repositories")
- **Folders**: Use title case, plural (e.g., "Repos", "Issues")
- **Variables**: Use snake_case (e.g., `github_token`, `base_url`)

### Best Practices

- Keep the collection focused on common developer use cases
- Ensure all mock endpoints return realistic GitHub API response structures
- Update both the collection fixture AND the mock server when adding endpoints
- Include variable interpolation examples (using `{{variable}}` syntax)
- Document complex requests with descriptions
- Keep request count reasonable for screenshot generation performance (~30 requests)

### Versioning

This fixture is versioned with the application. When API changes occur:
1. Update the fixture to reflect new endpoint structure
2. Update corresponding mock server endpoints
3. Commit both changes together
4. Consider adding migration notes in commit message
