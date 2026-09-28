let socketServer;

const setSocketServer = (server) => {
  socketServer = server;
};

const notifyParkingChange = (lotId, event) => {
  if (!socketServer) return;
  socketServer.emit("parking:availability", {
    lotId: lotId.toString(),
    event,
    updatedAt: new Date().toISOString()
  });
};

module.exports = { setSocketServer, notifyParkingChange };
