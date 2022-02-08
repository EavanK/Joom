// video & call
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

let myStream;
let muted = false;
let cameraOff = false;
let myPeerConnection;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) option.selected = true;
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };

  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) await getCameras();
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));

  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}

function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));

  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

//-------------------------------------video/audio connection--------------------------------//
//--------------------------------------------socket-----------------------------------------//

/* amazing thing on socket.io is that
socket.io can send function on an event.
it has to be the last argument.
Server can trigger the function which client sent.
*/
const socket = io();
const welcome = document.getElementById("welcome");
const room = document.getElementById("room");
const roomForm = welcome.querySelector("#roomName");
const nameForm = welcome.querySelector("#name");
const stream = document.getElementById("myStream");

room.hidden = true;
stream.hidden = true;

let roomName;
let count;

function addMessage(message) {
  const ul = room.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = message;
  ul.appendChild(li);
}

function handleMessageSubmit(e) {
  e.preventDefault();
  const input = room.querySelector("#msg input");
  const value = input.value;
  socket.emit("new_message", input.value, roomName, () => {
    addMessage(`You: ${value}`);
  });
  input.value = "";
}

function roomInfo(roomName, newCount) {
  const h3 = room.querySelector("h3");
  h3.innerText = `Room - ${roomName} (${newCount})`;
}

async function showRoom(newCount) {
  welcome.hidden = true;
  room.hidden = false;
  stream.hidden = false;
  roomInfo(roomName, newCount);
  const msgForm = room.querySelector("#msg");
  msgForm.addEventListener("submit", handleMessageSubmit);
  makeConnection();
}

async function handleRoomSubmit(e) {
  e.preventDefault();
  const input = welcome.querySelector("#roomName input");
  roomName = input.value;
  await getMedia();
  await showRoom(1);
  socket.emit("enter_room", roomName, showRoom);
  input.value = "";
}

function handleNicknameSubmit(e) {
  e.preventDefault();
  const input = welcome.querySelector("#name input");
  socket.emit("nickname", input.value);
  const h3 = nameForm.querySelector("h3");
  h3.innerText = `nickname: ${input.value}`;
  input.value = "";
}

roomForm.addEventListener("submit", handleRoomSubmit);
nameForm.addEventListener("submit", handleNicknameSubmit);

// Socket Code
/*
A = Browser A // B = Browser B
1. A creates RTCPeerConnection
2. A creates an offer
3. A saves the offer in A's LocalDescription (setLocalDescription)
4. A sends the offer to B (through server)
5. B creates RTCPeerConnection
6. B receives the offer (from A) save in B's RemoteDescription (setRemoteDescription)
7. B creates an answer
8. B saves the answer in B's LocalDescription (setLocalDescription)
9. B sends the answer to A (through server)
10. Both A and B send IceCandidate and add IceCandidate (addIceCandidate)
11. Add peer stream (addstream)
*/
socket.on("welcome", async (user, newCount) => {
  roomInfo(roomName, newCount);
  addMessage(`${user} joined!`);
  // RTC offer (sending invitation)
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  // will run peer A (Browser A)
  // console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

// will run peer B (Browser B)
socket.on("offer", async (offer) => {
  // RTC answer (sending answer)
  // console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  // console.log("sent the answer");
});

// will run peer A (Browswer A) again
socket.on("answer", (answer) => {
  // console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  // console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

socket.on("bye", (user, newCount) => {
  roomInfo(roomName, newCount);
  addMessage(`${user} left!`);
});

socket.on("new_message", addMessage);

socket.on("room_change", (rooms) => {
  const roomList = welcome.querySelector("ul");
  roomList.innerText = "";
  if (!rooms.length) {
    return;
  }
  rooms.forEach((room) => {
    const li = document.createElement("li");
    li.innerText = room;
    roomList.append(li);
  });
});

// RTC Code
function makeConnection() {
  myPeerConnection = new RTCPeerConnection();
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  // console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  // console.log("Peer's Stream", data.stream);
  // console.log("My Stream", myStream);
  const peersFace = document.getElementById("peersFace");
  peersFace.srcObject = data.stream;
}

/*
vanila JavaScript / WebSocket implementation

const messageList = document.querySelector("ul");
const messageForm = document.querySelector("#message");
const nickForm = document.querySelector("#nick");
const socket = new WebSocket(`ws://${window.location.host}`);

// socket.send takes only String
function makeMessage(type, payload) {
  const msg = { type, payload };
  return JSON.stringify(msg);
}

socket.addEventListener("open", () => console.log("Connected to Server ✅"));

socket.addEventListener("message", (message) => {
  const li = document.createElement("li");
  li.innerText = message.data;
  messageList.append(li);
});

socket.addEventListener("close", () => {
  console.log("Disconnected to Server ❌");
});

function handleSubmit(e) {
  e.preventDefault();
  const input = messageForm.querySelector("input");
  socket.send(makeMessage("new_message", input.value));
  const li = document.createElement("li");
  li.innerText = `You: ${input.value}`;
  messageList.append(li);
  input.value = "";
}

function handleNickSubmit(e) {
  e.preventDefault();
  const input = nickForm.querySelector("input");
  socket.send(makeMessage("nickname", input.value));
  input.value = "";
}

messageForm.addEventListener("submit", handleSubmit);
nickForm.addEventListener("submit", handleNickSubmit);
*/
