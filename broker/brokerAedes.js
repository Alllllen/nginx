const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);

const { WSPORT, PORT } = process.env;
const port = PORT;
const wsPort = WSPORT;

server.listen(port, function () {
  console.log('Aedes Broker started and listening on port ', port);
});

const httpServer = require('http').createServer();
const ws = require('websocket-stream');
ws.createServer({ server: httpServer }, aedes.handle);

httpServer.listen(wsPort, function () {
  console.log('websocket server listening on wsPort ', wsPort);
});

// const agvs = {}; //store status && next two steps EX: { 'agv:635d0a8ea891b7cbba452e5a': { status: 'move', nextSteps: [ [Array], [Array], [Array] ] }, 'agv:635d0a8ea891b7cbba452e5f': { status: 'move', nextSteps: [ [Array], [Array], [Array] ] } }
// const doors = {}; //store status && entry points   EX: { door635d0a51a891b7cbba451ea6: { entries: [ [1,2], [2,3], [122,32], [12,32] ], status: 'close' },...}

//redis
const redis = require('./utils/redis');

aedes.on('publish', async function (packet, client) {
  if (client) {
    const topic = packet.topic;
    console.log(topic);

    if (topic.includes('route')) {
      let message = packet.payload.toString();
      message = JSON.parse(message);
      // console.log(topic, message);

      const currentStep = message['currentStep'];
      const agv = 'agv:' + topic.split(':')[1];
      const status = message['status'];
      const fullRoute = message['fullRoute'];

      let agvObj = {};
      let next = [
        fullRoute[currentStep],
        fullRoute[currentStep + 1],
        fullRoute[currentStep + 2],
      ];

      agvObj['status'] = status;
      agvObj['nextSteps'] = next;
      // agvs[agv] = agvObj;
      await redis.hset('agvs', agv, JSON.stringify(agvObj));
      // console.log(agvs);

      let stopToMove = true;
      let redisAgvs = await redis.hgetall('agvs');

      // for (let key in agvs) {
      for (let key in redisAgvs) {
        // const nextSteps = agvs[key]['nextSteps'];
        const redisAgv = JSON.parse(redisAgvs[key]);
        const nextSteps = redisAgv['nextSteps'];
        console.log(redisAgv, nextSteps);

        for (let i = 0; i < nextSteps.length; i++) {
          const thisStep = JSON.stringify(fullRoute[currentStep + 2]);
          const otherNextStep = JSON.stringify(nextSteps[i]);
          // const otherStatus = agvs[key]['status'];
          const otherStatus = redisAgv['status'];

          if (key === agv) continue;
          if (!fullRoute[currentStep + 2]) continue;
          if (thisStep !== otherNextStep) continue;

          //檢查的車子為停下狀態時 只要看他原地的就好 不然可能會造成deadLock
          if (
            (i === 0 || fullRoute[currentStep + 1] === otherNextStep) &&
            otherStatus === 'stop'
          ) {
            console.log('碰到停止的車stop agv -> ', agv);

            aedes.publish({
              topic: `${agv}:control`,
              payload: 'stop',
            });
          }

          //檢查的車子為移動狀態時
          if (otherStatus === 'move') {
            console.log('碰到移動的車stop agv -> ', agv);

            aedes.publish({
              topic: `${agv}:control`,
              payload: 'stop',
            });
          }

          //if自己是停下來的狀態，檢查是否可以變為移動狀態
          if (status === 'stop') stopToMove = false;
        }
      }

      if (stopToMove && status === 'stop') {
        console.log('move agv');

        aedes.publish({
          topic: `${agv}:control`,
          payload: 'move',
        });
      }

      const step = fullRoute[currentStep].toString();
      const redisDoors = await redis.hgetall('doors');

      for (let key in redisDoors) {
        // for (let key in doors) {
        // const entries = doors[key]['entries'];
        const entries = JSON.parse(redisDoors[key])['entries'];
        // console.log(entries.toString(), key);
        for (let entry of entries) {
          if (step === entry.toString()) {
            console.log('open door', entries);
            aedes.publish({
              topic: `${key}:control`,
              payload: 'open',
            });
          }
        }
      }
    }

    if (topic === 'allDoors') {
      let message = packet.payload.toString();
      message = JSON.parse(message);

      const doorObj = {};
      for (let i = 0; i < message.length; i++) {
        const doorKey = 'door:' + message[i]._id;
        const entriesArr = [];
        const entries = message[i]['entries'];

        for (let entry of entries)
          entriesArr.push([entry['entryX'], entry['entryY']]);

        doorObj['entries'] = JSON.parse(JSON.stringify(entriesArr));
        doorObj['status'] = message[i]['status'];
        // doors[doorKey] = { ...doorObj };
        await redis.hset('doors', doorKey, JSON.stringify(doorObj));
      }
    }

    if (topic.includes('complete') || topic.includes('control')) {
      redis.pub.publish(
        'topic',
        JSON.stringify({
          topic: packet.topic.toString(),
          payload: packet.payload.toString(),
        })
      );
    }
  }
});

redis.sub.subscribe('topic');
setTimeout(() => {
  redis.pub.publish('topic', `topic:${port}`);
}, 1000);

redis.sub.on('message', async (channel, message) => {
  if (channel === 'topic') {
    if (message !== `topic:${port}`) {
      console.log('SUBECRIBE', message);
      redis.sub.subscribe(message);
    }
  } else {
    message = JSON.parse(message);
    console.log(
      `channel: ${channel} / topic: ${message.topic} / payload: ${message.payload}`
    );
    aedes.publish({
      topic: message.topic,
      payload: JSON.stringify(message.payload),
    });
  }
});
