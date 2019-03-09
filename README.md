# Pirate Redmine API Reverse Proxy Cache
early beta (big big bordel) stage

#### merging, filtering, sorting and autoupdating ability, experimental image proxy (resizing, minimizing)

Source data - Czech Pirate Party Redmine project management server JSON API<br/>
https://redmine.pirati.cz/projects/snemovna/issues.json

Output purpose - Czech Pirate Party webpage media results application (subpage)<br/>
https://pirati.cz/vysledky

### Based on hapi.js 18.1.0 - Server Framework for Node.js
Utilizes Wreck library for Redmine API and image requests<br/>
Utilizes Sharp library for image resizing and minimizing<br/>
Requires Node.js > 8.12

Handles requests from web application.<br/>
Merges and process requests to redmine API.<br/>
Fetching linked images, resizing and minimizing them.<br/>
Caching data in catbox-memory.

### Reason
1. Very slow response of Redmine API (e.g. more than 3 seconds for 100 records)
2. Paginated output of Redmine API (max. 100 records per request)
3. Data filtering
4. Data sorting by resorts
5. Images linked to issues are too big to load on slow connections (more than 5MB to download, overkill for slower connections)

### Win/Win
1. The JSON response is sorted and filtered (smaller payload by aprox. 25%)
2. Server keeps data cached in memory and automaticly reloads them every 30 minutes
3. JSON Response time is below 200ms
4. Cached resized and minimized images loads faster (reload every 24 hours)

| Optimisation overview                                        | Total page payload | Total images size | Page load time (Wifi) | Page load time (4G) |
|--------------------------------------------------------------|:------------------:|:-----------------:|:---------------------:|:-------------------:|
| Pirate Redmine API (limited to 100 records/aproximated)      |  6060 kB (8180 kB) |  4190 kB (5660kB) |     5.7 s (7.7 s)     |   13.9 s (18.8 s)   |
| Reverse cache API without image processing (135 records)     |       7980 kB      |      5800 kB      |         3.5 s         |        14.5 s       |
| Reverse cache API with image processing (JPG) (135 records)  |       3380 kB      |      1610 kB      |         2.0 s         |        5.5 s        |
| Reverse cache API with image processing (WebP) (135 records) |       2650 kB      |       920 kB      |         1.8 s         |        4.5 s        |

### Install
```
git clone https://github.com/madbeyk/pirate-redmine-api-reverse-cache-new.git
yarn install
```

### Set-up and configure

Only configuring options are IP address and PORT of running instance of server

process.env.HOST - IP adrress of server (default 0.0.0.0)<br/>
process.env.PORT - server port  (default 80)

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
- [x] Image processing (caching, resizing, minimizing ...) - *currently testing WebP support*
- [ ] Advanced external API error handling (outtages ...)


```
];()~~~~~
```
