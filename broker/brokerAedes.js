const aedes = require("aedes")();
const server = require("net").createServer(aedes.handle);

const { WSPORT, PORT } = process.env;
const port = PORT;
const wsPort = WSPORT;

server.listen(port, function () {
  console.log("Aedes Broker started and listening on port ", port);
});

const httpServer = require("http").createServer();
const ws = require("websocket-stream");
ws.createServer({ server: httpServer }, aedes.handle);

httpServer.listen(wsPort, function () {
  console.log("websocket server listening on wsPort ", wsPort);
});

const agvs = {}; //store status && next two steps EX: { 'agv:635d0a8ea891b7cbba452e5a': { status: 'move', nextSteps: [ [Array], [Array], [Array] ] },
//                                                      'agv:635d0a8ea891b7cbba452e5f': { status: 'move', nextSteps: [ [Array], [Array], [Array] ] } }
const doors = {}; //store status && entry points   EX:  door635d0a51a891b7cbba451ea6: { entries: [ [1,2], [2,3], [122,32], [12,32] ], status: 'close' }

aedes.on("publish", function (packet, client) {
  if (client) {
    const topic = packet.topic;
    console.log(topic);

    if (topic.includes("route")) {
      let message = packet.payload.toString();
      message = JSON.parse(message);
      // console.log(topic, message);

      const currentStep = message["currentStep"];
      const agv = "agv:" + topic.split(":")[1];
      const status = message["status"];
      const fullRoute = message["fullRoute"];

      let agvObj = {};
      let next = [
        fullRoute[currentStep],
        fullRoute[currentStep + 1],
        fullRoute[currentStep + 2],
      ];

      agvObj["status"] = status;
      agvObj["nextSteps"] = next;
      agvs[agv] = agvObj;
      // console.log(agvs);

      let stopToMove = true;
      for (let key in agvs) {
        const nextSteps = agvs[key]["nextSteps"];

        for (let i = 0; i < nextSteps.length; i++) {
          const thisStep = JSON.stringify(fullRoute[currentStep + 2]);
          const otherNextStep = JSON.stringify(nextSteps[i]);
          const otherStatus = agvs[key]["status"];

          if (key === agv) continue;
          if (!fullRoute[currentStep + 2]) continue;
          if (thisStep !== otherNextStep) continue;

          //檢查的車子為停下狀態時 只要看他原地的就好 不然可能會造成deadLock
          if (
            (i === 0 || fullRoute[currentStep + 1] === otherNextStep) &&
            otherStatus === "stop"
          ) {
            console.log("碰到停止的車stop agv -> ", agv);

            aedes.publish({
              topic: `${agv}:control`,
              payload: "stop",
            });
          }

          //檢查的車子為移動狀態時
          if (otherStatus === "move") {
            console.log("碰到移動的車stop agv -> ", agv);

            aedes.publish({
              topic: `${agv}:control`,
              payload: "stop",
            });
          }

          //if自己是停下來的狀態，檢查是否可以變為移動狀態
          if (status === "stop") stopToMove = false;
        }
      }

      if (stopToMove && status === "stop") {
        console.log("move agv");

        aedes.publish({
          topic: `${agv}:control`,
          payload: "move",
        });
      }

      const step = fullRoute[currentStep].toString();
      for (let key in doors) {
        const entries = doors[key]["entries"];
        // console.log(entries.toString(), key);
        for (let entry of entries) {
          if (step === entry.toString()) {
            console.log("open door", entries);
            aedes.publish({
              topic: `${key}:control`,
              payload: "open",
            });
          }
        }
      }
    }

    if (topic === "allDoors") {
      let message = packet.payload.toString();
      message = JSON.parse(message);

      const doorObj = {};
      for (let i = 0; i < message.length; i++) {
        const doorKey = "door:" + message[i]._id;
        const entriesArr = [];
        const entries = message[i]["entries"];

        for (let entry of entries)
          entriesArr.push([entry["entryX"], entry["entryY"]]);

        doorObj["entries"] = JSON.parse(JSON.stringify(entriesArr));
        doorObj["status"] = message[i]["status"];
        doors[doorKey] = { ...doorObj };
      }
    }
  }
});
