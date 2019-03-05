# Pirate Redmine Api Reverse Proxy Cache
early beta (big bordel) stage

#### merging, filtering, sorting and autoupdating ability

Source data - Czech Pirate Party Redmine project management server JSON API<br/>
https://redmine.pirati.cz/projects/snemovna/issues.json

Output purpose - Czech Pirate Party webpage media results application (subpage)<br/>
https://pirati.cz/vysledky

### Based on hapi.js 18.1.0 - Server Framework for Node.js
Utilizes Wreck library for Redmine API requests<br/>
Requires Node.js > 8.12

Handles requests from web application.<br/>
Merges and process requests to redmine API.<br/>
Caching data in catbox-memory.

### Reason
1. Very slow response of Redmine API (e.g. more than 3 seconds for 100 records)
2. Paginated output of Redmine API (max. 100 records per request)
3. Data filtering
4. Data sorting

### Win/Win
1. Now the response is sorted and filtered (smaller payload by aprox. 25%)
2. Server keeps cached data in memory and automaticly reload them every 30 minutes
3. Response time is below 200ms

### Install
```
yarn install
```

### Set-up

process.env.HOST - IP adrress of server (default 0.0.0.0)<br/>
process.env.PORT - running port (default 80)

### Run
```
yarn run start2
```

### Todo

- [x] Caching
- [x] Filtering
- [x] Sorting by resorts and internal priority of each issue
- [x] Merge paginated requests to redmine (max. 100 results in one API response)
- [x] Automatic data update every 30 minutes
- [ ] Advanced external API error handling (outtages ...)
- [ ] Image processing (caching, resizing, minimizing ...)
