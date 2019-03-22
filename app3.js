'use strict';

const Hapi = require('hapi');
const Wreck = require('wreck');
//const fs = require('fs');
const { TaskTimer } = require('tasktimer');
const sharp = require('sharp');
const hapijsStatusMonitor = require('hapijs-status-monitor');
const csv = require('csv-parser'); 

// -----------------------------------------------------------------------------
// setup 
// -----------------------------------------------------------------------------

//var url = "https://redmine.pirati.cz/projects/snemovna/issues.json?utf8=%E2%9C%93&set_filter=1&sort=id%3Adesc%2C%2C&f%5B%5D=tracker_id&op%5Btracker_id%5D=%3D&v%5Btracker_id%5D%5B%5D=28&f%5B%5D=status_id&op%5Bstatus_id%5D=%21&v%5Bstatus_id%5D%5B%5D=6&f%5B%5D=&c%5B%5D=subject&c%5B%5D=tags_relations&group_by=project&t%5B%5D=";
var url = "https://redmine.pirati.cz/projects/snemovna/issues.json?utf8=%E2%9C%93&set_filter=1&sort=id%3Adesc&f%5B%5D=tracker_id&op%5Btracker_id%5D=%3D&v%5Btracker_id%5D%5B%5D=28&f%5B%5D=status_id&op%5Bstatus_id%5D=%3D&v%5Bstatus_id%5D%5B%5D=5&f%5B%5D=&c%5B%5D=subject&c%5B%5D=tags_relations&group_by=project&t%5B%5D=";
//var url_csv = "https://redmine.pirati.cz/projects/snemovna/issues.csv?utf8=%E2%9C%93&set_filter=1&sort=id%3Adesc%2C%2C&f[]=tracker_id&op[tracker_id]=%3D&v[tracker_id][]=28&f[]=status_id&op[status_id]=!&v[status_id][]=6&c[]=tags_relations";
var url_csv = "https://redmine.pirati.cz/projects/snemovna/issues.csv?utf8=%E2%9C%93&set_filter=1&f%5B%5D=tracker_id&op%5Btracker_id%5D=%3D&v%5Btracker_id%5D%5B%5D=28&f%5B%5D=status_id&op%5Bstatus_id%5D=%3D&v%5Bstatus_id%5D%5B%5D=5&c%5B%5D=tags_relations";

var gimages=[];
var lastping=0;

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
'resort-kultura':2,
'snemovna':0
};

const server = Hapi.server({
    port: process.env.PORT || 80,
    host: process.env.HOST || '0.0.0.0'
});

const NS_PER_SEC = 1e9;

const version='2019-03-22_testing';

const htmlinfo=`
       <html>
       <head>
       <title>Pirate Redmine API Reverse Proxy Cache</title> 
       </head>
       <style>
       body {font-family:sans-serif;}
       </style>
       <body>
       <div>
         <div style='float:left;'>
          <img src="https://www.pirati.cz/assets/img/brand/logo_napis.svg" alt="Pirátská strana">
         </div>
         <div style='float:left; padding-left:0.6em;'> 
          <h2 style='margin:0.1em 0;'>PIRATE REDMINE API REVERSE PROXY CACHE (v.${version})</h2>
          <h3 style='margin:0.1em 0;'>[${server.info.id}] running at: ${server.info.uri} (${server.info.address}), HAPI.JS server version ${server.version}</h3>
         </div>
         <div style='clear:both;'>
       </div>   
       <p>
       Advanced JSON Reverse Cache with merging, filtering, sorting and autoupdating ability, experimental image proxy (resizing, minimizing)<br/>
       Source data - Czech Pirate Party Redmine project management server JSON API - <a href='https://redmine.pirati.cz/projects/snemovna/issues.json'>https://redmine.pirati.cz/projects/snemovna/issues.json</a><br/>
       Output purpose - Czech Pirate Party webpage media results application (subpage) - <a href='https://pirati.cz/vysledky'>https://pirati.cz/vysledky</a><br/>
       Created by Marek Förster (marek.forster@pirati.cz) using HAPI.JS - <a href='https://hapijs.com'>https://hapijs.com</a><br/>
       GitHub repository - <a href='https://github.com/madbeyk/pirate-redmine-api-reverse-cache'>https://github.com/madbeyk/pirate-redmine-api-reverse-cache</a><br/>
       </p>
`;

// -----------------------------------------------------------------------------
// initial request injection data
// -----------------------------------------------------------------------------

const injectOptions = {
      method: 'GET',
      url: '/',
    }

const injectOptionsImgreload = {
      method: 'GET',
      url: '/imgreload',
    }

const injectOptionsReload = {
      method: 'GET',
      url: '/reload',
    }



// -----------------------------------------------------------------------------
// support utilities
// -----------------------------------------------------------------------------

function sortJSON(data,pref) {
    return data.sort(function (a, b) {
        var slgx=slug(a.project.name); 
        var slgy=slug(b.project.name);
        if (pref[slgx] !== undefined) var x = pref[slgx]*10+a.priority.id; else var x=a.priority.id;
        if (pref[slgy] !== undefined) var y = pref[slgy]*10+b.priority.id; else var y=b.priority.id;
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

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function Base64EncodeUrl(str){
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/, '');
}

function Base64DecodeUrl(str){
    str = (str + '===').slice(0, str.length + (str.length % 4));
    return str.replace(/-/g, '+').replace(/_/g, '/');
}



async function getcsv(url) {
  try {
    var ts1 = new Date().getTime();
    const { res2, payload } = await Wreck.get(url,{redirects: 5});
    var csv_size=Buffer.byteLength(payload);
    const str = await Wreck.toReadableStream(payload);
    return new Promise((resolve, reject) => {
      var outdata = [];
      outdata['size']=csv_size;
      outdata['items']=[];
      str.pipe(csv(['id', 'tags']))
      .on('data', (data) => {     
        if (isNumber(data.id)) {
          var rowdata=[];
          rowdata['id']=data.id;
          rowdata['tags']=data.tags;
          outdata['items'].push(rowdata);
          }
        })
      .on('error', e => {
        reject(e);
        })
      .on('end', () => {
        var ts2 = new Date().getTime();
        outdata['time']=(ts2-ts1)+'ms';
        resolve(outdata);          
        });
      });
    } catch (ex) {
    console.log('!! GetCSV error / '+ex.message);
    throw ex;      
    }
  }  



// -----------------------------------------------------------------------------
// global method (fetch, filter and sort)
// -----------------------------------------------------------------------------

const getRedmineData = async(id,flags) => {
    var ts1 = new Date().getTime();
    console.log('Redmine data fetch ...');
    var search=true;
    var iter=0;
    var totalcount=0;
    var issues=[];
    var st=0;
    var csv_size=0;
    
    
    try {
    
      // parse CSV tags data
      
      /*
      const { res, payload } = await Wreck.get(url_csv,{redirects: 5});
      var csv_size=Buffer.byteLength(payload);
      var csvstr=payload.toString().split("\n");
      var csvdata = [];
      //console.log('pocet:'+csvstr.length);
      for(var q in csvstr) {
        var poz=csvstr[q].indexOf(',');
        //console.log(q+'|'+poz);        
        if (poz>0) {
          var idd=csvstr[q].substr(0,poz);
          if (isNumber(idd)) {
            var ddata=csvstr[q].substr(poz+2,csvstr[q].length-poz-3);
            //console.log(idd+' -> '+ddata);
            var rowdata=[];
            rowdata['id']=idd;
            rowdata['tags']=ddata;
            csvdata.push(rowdata);
            }
          }
        }
      */  
      
      var csvdata = [];
      await getcsv(url_csv).then(function(outdata) {
        csvdata=outdata['items'];
        csv_size=outdata['size'];
        console.log('Redmine data fetch - CSV items:'+csvdata.length+', size:'+csv_size+' bytes, time:'+outdata['time']);
        });
        
      //console.log('*');
      var ts2 = new Date().getTime();
          
      while (search) {
        var acturl=url+"&offset="+(iter*100)+"&limit=100";
        const { res, payload } = await Wreck.get(acturl);
                
        const { statusCode } = res;
        //console.log('Status code:'+statusCode);
        let error;
        
        // error handling
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n'+`Status Code: ${statusCode}`);
          }
        if (error) {
          console.log(error.message);
          // consume response data to free up memory
          res.resume();
          throw(error);
          }
        
        st+=Buffer.byteLength(payload);      
        var doc = JSON.parse(payload);
        if (iter==0) totalcount=doc.total_count;
        //console.log('Actual issues:'+doc.issues.length);
        iter++;
        if (totalcount>(iter*100)) search=true; else search=false;
        for(var i in doc.issues) {        
          //console.log('Processing '+i+' [id:'+doc.issues[i].id+'] of '+totalcount+' ...');
          
          // filtering each issue
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
          // fix markdown url space issue 
          qq.description=doc.issues[i].description.replace(/(\[[^\[\]]+\])\s+(\([^)]+\))/g, '$1$2');
          
          // merge tags from CSV data
          for(var q in csvdata) {
            if (csvdata[q]['id']==qq.id) {
              qq.tags=csvdata[q]['tags'];
              }
            }
          
          // parse image
          if ((doc.issues[i].hasOwnProperty('custom_fields')) && (doc.issues[i].custom_fields[0].hasOwnProperty('value')) && (doc.issues[i].custom_fields[0].value!="")){
            qq.custom_fields={};
            qq.custom_fields[0]={};

            // remove fbclid parameters on image links
            var im = doc.issues[i].custom_fields[0].value;
            if (im.indexOf('fbclid=') !== -1) {
              var url2 = new URL(im);
              url2.searchParams.delete('fbclid');
              im = url2.href;
              }
            qq.custom_fields[0].value=im;
            qq.custom_fields[0].id=doc.issues[i].custom_fields[0].id;
            
            //var imenc=encodeURIComponent(im);
            //var imenc=slug(im);
            
            /*
            var b = new Buffer(im);
            var imenc = Base64EncodeUrl(b.toString('base64'));
            var b = new Buffer(Base64DecodeUrl(imenc), 'base64')
            var imenc2 = b.toString();
            */
            
            if (gimages.includes(im)==false) gimages.push(im);
            //console.log('Linked image '+im+' ['+imenc+'] ['+imenc2+']');
            
            // filtr na nesmysly v img
            //if (qq.custom_fields[0].value.substr(0,22)=='https://mrak.pirati.cz') qq.custom_fields[0].value='';
            //if (qq.custom_fields[0].value.substr(0,28)=='https://www.ceskatelevize.cz') qq.custom_fields[0].value='';
            }
          issues.push(qq);
          }
        }
      var ts3 = new Date().getTime();  
      console.log('Redmine data fetch - JSON Issues count total:'+totalcount+', ('+st+' bytes) in '+iter+' request(s), time:'+(ts3-ts2)+'ms');
      issues = sortJSON(issues,pref);  
      var ts4 = new Date().getTime();  
      console.log('Redmine data fetch - JSON Sort complete, time:'+(ts4-ts3)+'ms');
      var out=JSON.stringify(issues);
      var len=out.length;
      var ts5 = new Date().getTime();
      console.log('Redmine data fetch finished ('+len+' bytes) ['+financial((len/(st+csv_size))*100)+'% of original payload], images:'+gimages.length+', total time:'+(ts5-ts1)+'ms');
      //gimages=images;
      //url=url2;
      return('{"issues":'+out+'}');
    
    } catch (ex) {
      console.log('Fetch error / '+ex.message);
      throw ex;      
      }
      
    
    };

/*
// -----------------------------------------------------------------------------
// image method - get image data from net 
// -----------------------------------------------------------------------------

const getFileURL = async(id,flags) => {
      try {
      
        var acturl=id;
        var { res, payload } = await Wreck.get(acturl,{redirects: 5});
        if (payload instanceof Buffer) { 
          payload = payload.toString('hex');
          }
        return(payload);

      } catch (ex) {
        console.log('! Error: FileURL fetch ('+id+', '+size+' bytes) / '+ex.message);
        //console.log('! Error payload: '+payload);
        var payload = '';
        
        if (payload instanceof Buffer) { 
          payload = payload.toString('hex');
          }
        return(payload);  
        }

  };
*/

const cache = server.cache({ segment: 'images', expiresIn: 24 *60 * 60 * 1000 });

// -----------------------------------------------------------------------------
// global image method - get minimized image 
// -----------------------------------------------------------------------------

const getImageData = async(id,width,height,gtyp,flags) => {
    //console.log('Image data fetch ...');
    var ts1 = new Date().getTime();

    var id = decodeURIComponent(id);

    if (gimages.includes(id)) { 

      var size = 0;
      
      try {
      
        var acturl=id;
        
        var origimg = await cache.get(acturl);
        
        if (origimg==null) {
          console.log('*** original fetching - '+id);
          var { res, payload } = await Wreck.get(acturl,{redirects: 5});
          const { statusCode } = res;
          await cache.set(id,payload.toString('hex'));
          } else {
          payload=new Buffer.from(origimg, "hex");
          console.log('*** original from cache - '+id);
          //console.log('-> '+payload);
          }          
                
        //let error;
        
        // error handling
        /*
        if ((statusCode !== 200)  && (statusCode !== 301)) {
          error = new Error('Image request Failed.\n'+`Status Code: ${statusCode}`);
          }
        if (error) {
          console.log(error.message);
          res.resume();
          throw(error);
          }
        */  
        
        size=Buffer.byteLength(payload);
        if (gtyp=='webp') payload = await sharp(payload).resize(parseInt(width)).webp({lossless: false, quality: 65}).toBuffer();//.then(console.log('webp image resized'));
        if (gtyp=='jpg') payload = await sharp(payload).resize(parseInt(width)).jpeg({quality: 80}).toBuffer();//.then(console.log('jpg image resized'));
        if (gtyp=='png') payload = await sharp(payload).resize(parseInt(width)).png().toBuffer();//.then(console.log('png image resized'));
        //payload = await sharp(payload).resize(parseInt(width)).webp({ lossless: false, quality: 75 }).toBuffer().then(console.log('image resized'));        
              
        if (payload instanceof Buffer) { 
          payload = payload.toString('hex');
          }
                   
        var ts2 = new Date().getTime();
        console.log('Image data fetch finished '+id+' ('+size+' bytes), time:'+(ts2-ts1)+'ms');
        return(payload);
      
      } catch (ex) {
        console.log('! Error: Image fetch ('+id+', '+size+' bytes) / '+ex.message);
        //console.log('! Error payload: '+payload);
        var payload = 0;
        
        try {
          if (gtyp=='webp') payload = await sharp(null, {create: {width: 1,height: 1, channels: 3, background: { r: 255, g: 255, b: 255}}}).webp({lossless: false, quality: 1}).toBuffer();
          if (gtyp=='jpg') payload = await sharp(null, {create: {width: 1,height: 1, channels: 3, background: { r: 255, g: 255, b: 255}}}).jpeg({quality: 1}).toBuffer();
          if (gtyp=='png') payload = await sharp(null, {create: {width: 1,height: 1, channels: 3, background: { r: 255, g: 255, b: 255}}}).png().toBuffer();
          } catch (ex) {
          console.log('! Error create empty image ('+gtyp+') / '+ex.message);
          }
        
        if (payload instanceof Buffer) { 
          payload = payload.toString('hex');
          }
        //throw ex;      
        return(payload);  
        }
      
      } else {
      console.log('Image '+id+' not exists');
      return('');
      }
            
    
    };



// -----------------------------------------------------------------------------
// server methods (caching)
// -----------------------------------------------------------------------------


var second = 1000;
var minute = 60 * second;

// method for JSON data

server.method('getRedmineData', getRedmineData, {
  cache: {
    expiresIn: 360 * minute,
    staleIn: 31 * minute,
    staleTimeout: 200,
    generateTimeout: 10000,
    getDecoratedValue: true
  }
});

// method for image data

server.method('getImageData', getImageData, {
  cache: {
    //expiresIn: 20 * second,
    //staleIn: 15 * second,
    expiresIn: 24 * 60 * minute,
    staleIn: 241 * minute,
    staleTimeout: 200,
    generateTimeout: 10000,
    getDecoratedValue: true,
  }
});



// -----------------------------------------------------------------------------
// server routes
// -----------------------------------------------------------------------------

server.route({
    method: 'GET',
    path: '/log',
    handler: (request, h) => {
       var out='';
       for(var l in logmessages) { out+=logmessages[l]+"<br/>";} 
       return `
       `+htmlinfo+`
       <p>
       Last log:
       <pre>`+out+`</pre>
       </p>
       `;
      },
    options: {
      cache: {
        expiresIn: 0,
        privacy: 'private'
        }
      }
  });

server.route({
    method: 'GET',
    path: '/ping',
    handler: async function (request, h) {
      const ip = request.info.remoteAddress;
      const time = process.hrtime();
      var ts = new Date().getTime();
      var add=" (not processed)";
      if (ts-lastping>=60000) {
        const {value, cached} = await server.methods.getRedmineData(1);
        if (cached!=null) add=" (cached "+cached.ttl+")"; else add=" (not cached)";
        lastping=ts;
        }
      //add+=" ts:"+ts+", lastping:"+lastping+", diff:"+(ts-lastping);  
      const diff = process.hrtime(time);
      var ft=financial((diff[0] * NS_PER_SEC + diff[1])/1000);
      /*
      if (cached!=null) {
        console.log('Pinged from IP:'+ip+', cached - ttl:'+cached.ttl+', processing time:'+ft+'µs');
        } else {
        console.log('Pinged from IP:'+ip+', not cached, processing time:'+ft+'µs');
        }
      */
      return 'pinged in '+ft+'µs'+add;
      },
    options: {
      cache: {
        expiresIn: 0,
        privacy: 'private'
        }
      }
  });

server.route({
    method: 'GET',
    path: '/reload',
    handler: async (request, h) => {
       const ip = request.info.remoteAddress;
       console.log('Cache reload request - IP:'+ip);
       const time = process.hrtime();
       const delcache = await server.methods.getRedmineData.cache.drop(1);
       const response = await server.inject(injectOptions); 
       const diff = process.hrtime(time);
       return htmlinfo+'<p>reloaded in '+financial((diff[0] * NS_PER_SEC + diff[1])/1000000)+'ms</p>';       
      }
  });

server.route({
    method: 'GET',
    path: '/imgreload',
    handler: async (request, h) => {
        const ip = request.info.remoteAddress;
        console.log('Image cache reload request - IP:'+ip);
        const time = process.hrtime();
        var out="";    
        for(var i in gimages) {
            var acturl=gimages[i];
            out+=acturl+"<br/>";
            try {
                var { res, payload } = await Wreck.get(acturl,{redirects: 5});
                const { statusCode } = res;
                await cache.set(acturl,payload.toString('hex'));
                } catch (ex) {
                console.log('! Error: Image fetch ('+acturl+') / '+ex.message);
                }
            }
       const diff = process.hrtime(time);
       console.log('Image cache reloaded - '+financial((diff[0] * NS_PER_SEC + diff[1])/1000000)+'ms');
       return '<p>images reloaded in '+financial((diff[0] * NS_PER_SEC + diff[1])/1000000)+'ms</p><pre>'+out+'</pre>';       
      }
  });


server.route({
    method: 'GET',
    path: '/{other}',
    handler: async (request, h) => {
       return htmlinfo+`
       <strong>API endpoints:</strong>
       <ul>
       <li><strong><a href='/'>/</a></strong> - Get JSON data</li>
       <li><strong><a href='/log'>/log</a></strong> - last log info</li>
       <li><strong><a href='/ping'>/ping</a></strong> - ping a server, reloads internal data when too old</li>
       <li><strong><a href='/info'>/info</a></strong> - basic info</li>
       <li><strong><a href='/status'>/status</a></strong> - status info (CPU load, Memory usage, requests per second)</li>
       </ul>
       `;       
      }
  });


server.route({
    method: 'GET',
    path: '/',
    handler: async function (request, h) {
      //rheaders=JSON.stringify(request.headers);
      
      const time = process.hrtime();
      
      const {value, cached} = await server.methods.getRedmineData(1);
      //const ip = request.info.remoteAddress;
      
      ///*
      var ip = request.headers['trueip'];
      if (ip==undefined) ip=request.info.remoteAddress;
       
      const diff = process.hrtime(time);
      if (cached!=null) {
        console.log('Request IP:'+ip+', cached - ttl:'+cached.ttl+', processing time:'+financial((diff[0] * NS_PER_SEC + diff[1])/1000)+'µs');
        } else {
        console.log('Request IP:'+ip+', not cached, processing time:'+financial((diff[0] * NS_PER_SEC + diff[1])/1000)+'µs');
        }
      //*/

      const lastModified = cached ? new Date(cached.stored) : new Date();
      const response = h.response(value).header('Last-modified', lastModified.toUTCString()).header('Access-Control-Allow-Origin','*').type('application/json');
      return (response);  
      },
    options: {
      cache: {
        expiresIn: 360 * 60 * 1000,
        privacy: 'private'
        }
      }
      
  });

server.route({
    method: 'GET',
    path: '/img/{gid}',
    handler: async function (request, h) {
      //rheaders=JSON.stringify(request.headers);
      const fmts = ['jpg','webp','png'];
      const time = process.hrtime();
      const gid = decodeURIComponent(request.params.gid);
      const width = (((request.query.w<1025)&&(request.query.w>0))?request.query.w:(request.query.w>1024)?1024:240) || 240;
      const height = request.query.h<1025 || 240;
      const gtyp = ((fmts.includes(request.query.t))?request.query.t:'jpg') || "jpg";
      
      var {value, cached} = await server.methods.getImageData(gid,width,height,gtyp);
      
      //const ip = request.info.remoteAddress;
      var ip = request.headers['trueip'];
      if (ip==undefined)  ip = request.info.remoteAddress
      const diff = process.hrtime(time);
      if (cached!=null) {
        console.log('Image ('+gid+') request IP:'+ip+', cached - ttl:'+cached.ttl+', typ:'+gtyp+', size:'+width+'x'+height+'px, processing time:'+financial((diff[0] * NS_PER_SEC + diff[1])/1000)+'µs');
        } else {
        console.log('Image ('+gid+') request IP:'+ip+', not cached, typ:'+gtyp+', size:'+width+'x'+height+'px, processing time:'+financial((diff[0] * NS_PER_SEC + diff[1])/1000)+'µs');
        }

      var typ='image/jpeg';
      if (gtyp=='webp') typ='image/webp'; else if (gtyp=='jpg') typ='image/jpeg'; else if (gtyp=='png') typ='image/png';

      //var prip=gid.toLowerCase().substr(-4,4);
      //if (prip=='.png') typ = 'image/png';
      
      const lastModified = cached ? new Date(cached.stored) : new Date();

      var value2 = new Buffer.from(value, "hex");
      
      const response = h.response(value2).header('Last-modified', lastModified.toUTCString()).header('Access-Control-Allow-Origin','*').type(typ);
      return (response);  
      },
    options: {
      cache: {
        expiresIn: 24 * 60 * 60 * 1000,
        privacy: 'public'
        }
      }
      
  });


// -----------------------------------------------------------------------------
// hapi server run
// -----------------------------------------------------------------------------


const init = async () => {

  console.log('PIRATE REDMINE API REVERSE PROXY CACHE (v.'+version+')');

  await server.register({ plugin: hapijsStatusMonitor, options: {title: 'PIRATE REDMINE API REVERSE PROXY CACHE (v.'+version+')'}});
  await server.start();
  console.log(`Running at: ${server.info.uri}, HAPI.JS server version ${server.version}`);
  console.log(`Initializing request - caching data ...`);
  const response = await server.inject(injectOptions);
  console.log(`Initializing request - caching image data ...`);
  const response2 = await server.inject(injectOptionsImgreload);
  console.log(`System ready ...`);
  };

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
  });

init();


// -----------------------------------------------------------------------------
// timer for automatic data updates
// -----------------------------------------------------------------------------

const timer = new TaskTimer(60000);
 
timer.add([
    {
        id: 'Autoupdate',       
        tickInterval: 30,   
        totalRuns: 0,       
        async callback(task, done) {
          console.log(`${task.id} task has run ${task.currentRuns} times.`);
          await server.inject(injectOptionsReload);
          done();
        }
    },
    {
        id: 'Imageupdate',       
        tickInterval: 1439,   
        totalRuns: 0,       
        async callback(task, done) {
          console.log(`${task.id} task has run ${task.currentRuns} times.`);
          await server.inject(injectOptionsImgreload);
          done();
        }
    }

]);
 
 
timer.start();