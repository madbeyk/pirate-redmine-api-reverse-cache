'use strict';

const Hapi = require('hapi');
const Wreck = require('wreck');

var url = "https://redmine.pirati.cz/projects/snemovna/issues.json?utf8=%E2%9C%93&set_filter=1&sort=id%3Adesc%2C%2C&f%5B%5D=tracker_id&op%5Btracker_id%5D=%3D&v%5Btracker_id%5D%5B%5D=28&f%5B%5D=status_id&op%5Bstatus_id%5D=%21&v%5Bstatus_id%5D%5B%5D=6&f%5B%5D=&c%5B%5D=subject&c%5B%5D=tags_relations&group_by=project&t%5B%5D=";

const server = Hapi.server({
    port: 3001,
    host: 'localhost'
});




var handlers = {
  redmine: async function (request,h) {
    console.log('redmine handler ...');
    
    var search=true;
    var iter=0;
    var totalcount=0;
    var issues=[];
    while (search) {
      var acturl=url+"&offset="+(iter*100)+"&limit=100";
      const { res, payload } = await Wreck.get(acturl);
      var doc = JSON.parse(payload);
      if (iter==0) {
        totalcount=doc.total_count;
        console.log('Issues total:'+totalcount);
        }
      console.log('Actual issues:'+doc.issues.length);
      iter++;
      if (totalcount>(iter*100)) search=true; else search=false;
      for(var i in doc.issues) {
        issues.push(doc.issues[i]);
        }
      }
    const response = h.response('{"issues":'+JSON.stringify(issues)+'}').header('cache-control', 'no-cache').type('application/json');
    return(response);
  }
};    

server.route({
    method: 'GET',
    path: '/{name}',
    handler: (request, h) => {
       return `Hello, ${encodeURIComponent(request.params.name)}!`;
      }
  });





server.route({
    method: 'GET',
    path: '/',
    handler: handlers.redmine,
  });


const init = async () => {
  await server.start();
  console.log(`BQ API Server running at: ${server.info.uri}, server version ${server.version}`);
  };

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
  });

init();