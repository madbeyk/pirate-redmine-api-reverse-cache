'use strict';

const Hapi = require('hapi');
const Wreck = require('wreck');

// -----------------------------------------------------------------------------
// setup 
// -----------------------------------------------------------------------------

var url = "https://redmine.pirati.cz/projects/snemovna/issues.json?utf8=%E2%9C%93&set_filter=1&sort=id%3Adesc%2C%2C&f%5B%5D=tracker_id&op%5Btracker_id%5D=%3D&v%5Btracker_id%5D%5B%5D=28&f%5B%5D=status_id&op%5Bstatus_id%5D=%21&v%5Bstatus_id%5D%5B%5D=6&f%5B%5D=&c%5B%5D=subject&c%5B%5D=tags_relations&group_by=project&t%5B%5D=";

const pref={
'resort-doprava-a-logistika':4,
'resort-evropska-unie-zahranici-obrana':5,
'resort-finance':14,
'resort-informatika':13,
'resort-mistni-rozvoj':1,
'resort-prace-a-socialnich-veci':9,
'resort-prumysl-a-obchod':6,
'resort-spravedlnost':11,
'resort-vnitro-a-bezpecnost':12,
'resort-zdravotnictvi':3,
'resort-zemedelstvi':7,
'resort-zivotni-prostredi':8,
'resort-skolstvi':10,
'resort-kultura':2
};

const server = Hapi.server({
    port: 3001,
    host: '192.168.1.106'
});

const NS_PER_SEC = 1e9;

// -----------------------------------------------------------------------------
// support utilities
// -----------------------------------------------------------------------------

function sortJSON(data,pref) {
    return data.sort(function (a, b) {
        var x = pref[slug(a.project.name)]*10+a.priority.id;
        var y = pref[slug(b.project.name)]*10+b.priority.id;
        return ((x < y) ? 1 : ((x > y) ? -1 : 0));
    });
}

var slug = function(str) {
  str = str.replace(/^\s+|\s+$/g, ''); // trim
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  var from = "ÁÄÂÀÃÅČÇĆĎÉĚËÈÊẼĔȆÍÌÎÏŇÑÓÖÒÔÕØŘŔŠŤÚŮÜÙÛÝŸŽáäâàãåčçćďéěëèêẽĕȇíìîïňñóöòôõøðřŕšťúůüùûýÿžþÞĐđßÆa·/_,:;";
  var to   = "AAAAAACCCDEEEEEEEEIIIINNOOOOOORRSTUUUUUYYZaaaaaacccdeeeeeeeeiiiinnooooooorrstuuuuuyyzbBDdBAa------";
  for (var i=0, l=from.length ; i<l ; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};

const logmessages = [];
var log = console.log;

console.log = function () {
    var first_parameter = arguments[0];
    var other_parameters = Array.prototype.slice.call(arguments, 1);

    function formatConsoleDate (date) {
        var day = date.getDate();
        var month = date.getMonth()+1;
        var year = date.getFullYear();
        var hour = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var milliseconds = date.getMilliseconds();

        return '[' +
               year +
               '/' +
               ((month < 10) ? '0' + month: month) +
               '/' +
               ((day < 10) ? '0' + day: day) +
               ' ' +
               ((hour < 10) ? '0' + hour: hour) +
               ':' +
               ((minutes < 10) ? '0' + minutes: minutes) +
               ':' +
               ((seconds < 10) ? '0' + seconds: seconds) +
               '.' +
               ('00' + milliseconds).slice(-3) +
               '] ';
    }

    if (logmessages.length>50) logmessages.shift();
    logmessages.push([formatConsoleDate(new Date()) + first_parameter].concat(other_parameters));
    log.apply(console, [formatConsoleDate(new Date()) + first_parameter].concat(other_parameters));
};

function financial(x) {
  return Number.parseFloat(x).toFixed(2);
}



// -----------------------------------------------------------------------------
// global method (fetch, filter and sort)
// -----------------------------------------------------------------------------

const getRedmineData = async(id) => {
    console.log('Redmine data fetch ...');
    var ts1 = new Date().getTime();
    var search=true;
    var iter=0;
    var totalcount=0;
    var issues=[];
    var st=0;
    while (search) {
      var acturl=url+"&offset="+(iter*100)+"&limit=100";
      const { res, payload } = await Wreck.get(acturl);
      st+=Buffer.byteLength(payload);      
      var doc = JSON.parse(payload);
      if (iter==0) totalcount=doc.total_count;
      //console.log('Actual issues:'+doc.issues.length);
      iter++;
      if (totalcount>(iter*100)) search=true; else search=false;
      for(var i in doc.issues) {        
        //console.log('Processing '+i+' [id:'+doc.issues[i].id+'] of '+totalcount+' ...');
        var qq = new Object();
        qq.id=doc.issues[i].id;
        qq.priority={};
        qq.priority.id=doc.issues[i].priority.id;
        qq.project={};
        qq.project.name=doc.issues[i].project.name;
        if (doc.issues[i].hasOwnProperty('assigned_to')) {
          qq.assigned_to={};
          if (doc.issues[i].assigned_to.hasOwnProperty('name')) {
            qq.assigned_to.name=doc.issues[i].assigned_to.name;
            }
          }
        qq.subject=doc.issues[i].subject;
        qq.description=doc.issues[i].description;
        qq.custom_fields={};
        qq.custom_fields[0]={};
        qq.custom_fields[0].value=doc.issues[i].custom_fields[0].value;
        qq.custom_fields[0].id=doc.issues[i].custom_fields[0].id;
        // filtr na nesmysly
        if (qq.custom_fields[0].value.substr(0,22)=='https://mrak.pirati.cz') qq.custom_fields[0].value='';
        if (qq.custom_fields[0].value.substr(0,28)=='https://www.ceskatelevize.cz') qq.custom_fields[0].value='';
        issues.push(qq);
        }
      }
    console.log('Redmine data fetch - Issues total:'+totalcount+', ('+st+' bytes) in '+iter+' iterations.');
    issues = sortJSON(issues,pref);  
    console.log('Redmine data fetch - Sort complete.');
    var out=JSON.stringify(issues);
    var len=out.length;
    var ts2 = new Date().getTime();
    console.log('Redmine data fetch finished ('+len+' bytes) ['+financial((len/st)*100)+'% of original payload], time:'+(ts2-ts1)+'ms');
    return('{"issues":'+out+'}');
    };


// -----------------------------------------------------------------------------
// server method (caching)
// -----------------------------------------------------------------------------


var second = 1000;
var minute = 60 * second;

server.method('getRedmineData', getRedmineData, {
  cache: {
    expiresIn: 360 * minute,
    staleIn: 30 * minute,
    staleTimeout: 200,
    generateTimeout: 10000,
    getDecoratedValue: true
  }
});


// -----------------------------------------------------------------------------
// server routes
// -----------------------------------------------------------------------------

server.route({
    method: 'GET',
    path: '/{name}',
    handler: (request, h) => {
       var out='';
       for(var l in logmessages) { out+=logmessages[l]+"<br/>";} 
       return `
       <h2>PIRATE REDMINE API REVERSE PROXY CACHE (v.2019-02-25)</h2>
       <h3>running at: ${server.info.uri}, HAPI.JS server version ${server.version}</h3>
       <p>
       Reverse Cache, filter, sort of JSON data of Pirate Redmine for Media Results application - <a href='https://pirati.cz/vysledky'>https://pirati.cz/vysledky</a><br/>
       Created by Marek Förster (marek.forster@pirati.cz) using HAPI - <a href='https://hapijs.com'>https://hapijs.com</a><br/>
       </p>
       <p>
       Last log:
       <pre>`+out+`</pre>
       </p>
       `;
      }
  });

server.route({
    method: 'GET',
    path: '/',
    handler: async function (request, h) {
      const time = process.hrtime();
      const {value, cached} = await server.methods.getRedmineData(1);
      const ip = request.info.remoteAddress;
      const diff = process.hrtime(time);
      if (cached!=null) {
        console.log('Request IP:'+ip+', cached - ttl:'+cached.ttl+', processing time:'+financial((diff[0] * NS_PER_SEC + diff[1])/1000)+'µs');
        } else {
        console.log('Request IP:'+ip+', not cached, processing time:'+financial((diff[0] * NS_PER_SEC + diff[1])/1000)+'µs');
        }

      const lastModified = cached ? new Date(cached.stored) : new Date();
      const response = h.response(value).header('Last-modified', lastModified.toUTCString()).header('Access-Control-Allow-Origin','*').type('application/json');
      return (response);  
      },
    options: {
      cache: {
        expiresIn: 120 * 60 * 1000,
        privacy: 'private'
        }
      }
      
  });


// -----------------------------------------------------------------------------
// initial request injection data
// -----------------------------------------------------------------------------

const injectOptions = {
      method: 'GET',
      url: '/',
    }

// -----------------------------------------------------------------------------
// hapi server run
// -----------------------------------------------------------------------------


const init = async () => {

  console.log('PIRATE REDMINE API REVERSE PROXY CACHE (v.2019-02-25)');
  
  await server.start();
  console.log(`Running at: ${server.info.uri}, HAPI.JS server version ${server.version}`);
  console.log(`Initializing request - caching data ...`);
  const response = await server.inject(injectOptions);
  console.log(`System ready ...`);
  };

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
  });

init();