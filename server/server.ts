import WebSocket, { WebSocketServer } from "ws";
import crypto, { sign } from "node:crypto";
import * as fs from "node:fs/promises";
import * as syncFs from "node:fs";

const wss = new WebSocketServer({ port: 8080 });

const clients = new Map<string, Set<WebSocket>>();
const clientAndNames = new Map<string, string>();
const pairingCodes = new Map<string, string>();
const sessions = new Map<string, Set<string>>();

const authTokens = new Map<string, string>();

const publicKeys = new Map<string, string>();

const adjectives = (await fs.readFile("../src/names/adjectives.txt", "utf-8"))
	.split(/\r?\n/)
	.filter(Boolean);
const animals = (await fs.readFile("../src/names/animals.txt", "utf-8"))
	.split(/\r?\n/)
	.filter(Boolean);

//Create a pairing code for the client
function generatePairingCode() {
	let num = "000000" + Math.floor(Math.random() * 999999);
	return num.substring(num.length - 6);
}

//Create a name for the client
function generateName() {
	const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
	const animal = animals[Math.floor(Math.random() * animals.length)];

	return adjective + " " + animal;
	//   let name = "";
	//   for (var i = 0; i < 4; i++) {
	//     let num = Math.floor(Math.random() * 26) + 97;
	//     name += String.fromCharCode(num);
	//   }
	//   return name;
}

//Log the connection between two clients
function linkSession(id1: string, id2: string) {
	if (!sessions.has(id1)) {
		sessions.set(id1, new Set());
	}
	if (!sessions.has(id2)) {
		sessions.set(id2, new Set());
	}

	sessions.get(id1)?.add(id2);
	sessions.get(id2)?.add(id1);
}

async function loadData() {
	if (!syncFs.existsSync("../src/data/clients.json")) return;

	const data = await fs.readFile("../src/data/clients.json", "utf-8");

	const savedClients = data.trim() ? JSON.parse(data) : [];

	//Load data for each client
	for (const client of savedClients) {
		clientAndNames.set(client.id, client.name);
		sessions.set(client.id, new Set(client.contacts));
	}
}

async function saveData() {
	const savedClients = [];

	for (const [id, name] of clientAndNames) {
		savedClients.push({
			id,
			name,
			contacts: [...(sessions.get(id) ?? [])],
		});
	}

	await fs.writeFile(
		"../src/data/clients.json",
		JSON.stringify(savedClients, null, 2),
	);
}

await loadData();

/* 
When client is connected
*/
wss.on("connection", function connection(ws) {
	//Vars for file transfer
	let id = "";

	const outgoingTransfers = new Map<
		string,
		{ targetClientId: string; socket: WebSocket }
	>();

	console.log("Total clients: ", clients.size + 1);

	const decoder = new TextDecoder();

	/* 
    When client sends a message
    */
	ws.on("message", async (msg, isBinary) => {
		//Check for file data
		if (isBinary) {
			//Send the data to the first instance of the target client

			const bytes = new Uint8Array(msg as Buffer);

			const messageId = decoder.decode(bytes.subarray(0, 36));

			const transfer = outgoingTransfers.get(messageId);

			if (!transfer) return;

			if (transfer.socket.readyState == WebSocket.OPEN) {
				transfer.socket.send(msg);
			} else {
				ws.send(
					JSON.stringify({
						signal: "FILE_FAILED",
						messageId,
					}),
				);

				outgoingTransfers.delete(messageId);
			}

			return;
		}

		//Otherwise, parse the JSON message
		const parsedMessage = JSON.parse(msg.toString());

		/*
        Decide what to do with it
        */
		switch (parsedMessage.signal) {
			case "ON_CLIENT_CONNECT": {
				console.log(
					`MESSAGE RECEIVED: ON_CLIENT_CONNECT\n---------------------------------------\nClient ID: ${parsedMessage.targetClientId}`,
				);

				//Log the session that just connected
				if (parsedMessage.authToken != null) {
					for (const [clientId, token] of authTokens) {
						if (token == parsedMessage.authToken) {
							id = clientId;
							break;
						}
					}

					if (!id) {
						ws.close();
						break;
					}
				} else {
					//Generate user id and auth token
					const authToken = crypto.randomUUID();
					id = crypto.randomUUID();

					//Log this user id
					authTokens.set(id, authToken);

					//Generate a name for the new user
					const name = generateName();
					clientAndNames.set(id, name);

					await saveData();
				}

				if (!clients.has(id)) {
					clients.set(id, new Set());
				}
				clients.get(id)?.add(ws);

				ws.send(
					JSON.stringify({
						signal: "CLIENT_INFO",
						clientId: id,
						authToken: authTokens.get(id),
						name: clientAndNames.get(id),
					}),
				);

				//Log the client's public key
				publicKeys.set(id, parsedMessage.publicKey);

				//Send a list of all previously connected clients and their online statuses
				const contacts = [];

				const contactsForClient = sessions.get(id) ?? [];
				for (const connectedClientId of contactsForClient) {
					contacts.push({
						id: connectedClientId,
						name: clientAndNames.get(connectedClientId),
						online: clients.has(connectedClientId),
					});

					const sockets = clients.get(connectedClientId);

					if (sockets) {
						// Existing online status update
						for (const client of sockets) {
							client.send(
								JSON.stringify({
									signal: "CLIENT_STATUS_CHANGE",
									clientId: id,
									online: true,
								}),
							);
						}

						// Exchange public keys
						const myKey = publicKeys.get(id);
						const theirKey = publicKeys.get(connectedClientId);

						if (myKey) {
							for (const client of sockets) {
								client.send(
									JSON.stringify({
										signal: "PUBLIC_KEY",
										targetClientId: id,
										publicKey: myKey,
									}),
								);
							}
						}

						if (theirKey) {
							ws.send(
								JSON.stringify({
									signal: "PUBLIC_KEY",
									targetClientId: connectedClientId,
									publicKey: theirKey,
								}),
							);
						}
					}
				}

				ws.send(
					JSON.stringify({
						signal: "CONTACT_LIST",
						contacts: contacts,
					}),
				);

				break;
			}

			case "REQUEST_PAIRING_CODE": {
				console.log(
					`MESSAGE RECEIVED: REQUEST_PAIRING_CODE\n---------------------------------------`,
				);

				//Generate and send a pairing code
				let newPairingCode = generatePairingCode();
				ws.send(
					JSON.stringify({
						signal: "PAIRING_CODE",
						pairingCode: newPairingCode,
					}),
				);
				pairingCodes.set(newPairingCode, id);

				//Delete pairing code after 60 seconds
				setTimeout(() => {
					pairingCodes.delete(newPairingCode);
					console.log("Pairing code deleted");
				}, 60000);
				break;
			}

			case "CHANGE_NAME": {
				console.log(
					`MESSAGE RECEIVED: CHANGE_NAME\n---------------------------------------\nName: ${parsedMessage.name}`,
				);
				//Change the clients name to what they sent
				clientAndNames.set(id, parsedMessage.name);

				await saveData();

				const connectedClients = sessions.get(id);

				//Alert every connected client to the name change
				if (connectedClients) {
					for (const targetId of connectedClients) {
						//Each client could have multiple tabs associated with it, so loop through those and alert each tab to the name change
						const sockets = clients.get(targetId);

						if (!sockets) continue;

						for (const targetWs of sockets) {
							targetWs.send(
								JSON.stringify({
									signal: "CLIENT_NAME_CHANGED",
									clientId: id,
									name: parsedMessage.name,
								}),
							);
						}
					}
				}

				break;
			}

			case "CONNECT_WITH_CLIENT": {
				console.log(
					`MESSAGE RECEIVED: CONNECT_WITH_CLIENT\n---------------------------------------\nPairing code: ${parsedMessage.pairingCode}`,
				);
				//Check if valid pairing code
				if (pairingCodes.has(parsedMessage.pairingCode)) {
					console.log("Connected");

					//Get id of the target to pair with
					const targetId = pairingCodes.get(
						parsedMessage.pairingCode,
					)!;

					//Can't connect to yourself
					if (targetId == id) {
						ws.send(
							JSON.stringify({
								signal: "CONNECTED_CLIENT_INFO",
								clientId: null,
								clientName: null,
							}),
						);

						return;
					}

					//Link two clients by id
					linkSession(id, targetId);

					await saveData();

					//Send connection info to every client instance involved
					ws.send(
						JSON.stringify({
							signal: "CONNECTED_CLIENT_INFO",
							clientId: targetId,
							clientName: clientAndNames.get(targetId),
						}),
					);

					const sockets = clients.get(targetId);

					if (sockets) {
						for (const client of sockets) {
							client.send(
								JSON.stringify({
									signal: "CONNECTED_CLIENT_INFO",
									clientId: id,
									clientName: clientAndNames.get(id),
								}),
							);
						}

						//Exchange public keys
						const myKey = publicKeys.get(id);

						if (myKey) {
							for (const client of sockets) {
								console.log("Sending public key");
								client.send(
									JSON.stringify({
										signal: "PUBLIC_KEY",
										targetClientId: id,
										publicKey: myKey,
									}),
								);
							}
						}
					}

					const targetKey = publicKeys.get(targetId);

					if (targetKey) {
						ws.send(
							JSON.stringify({
								signal: "PUBLIC_KEY",
								targetClientId: targetId,
								publicKey: targetKey,
							}),
						);
					}
				} else {
					//Pairing code expired or does not exist
					console.log("Unsuccessful connection");
					ws.send(
						JSON.stringify({
							signal: "CONNECTED_CLIENT_INFO",
							clientId: null,
							clientName: null,
						}),
					);
				}
				break;
			}

			case "REMOVE_CLIENT": {
				console.log(
					`MESSAGE RECEIVED: REMOVE_CLIENT\n---------------------------------------\nClient ID: ${parsedMessage.clientId}`,
				);

				sessions.get(id)?.delete(parsedMessage.clientId);
				sessions.get(parsedMessage.clientId)?.delete(id);

				await saveData();

				const sockets = clients.get(parsedMessage.clientId);
				if (!sockets) break;

				for (const client of sockets) {
					client.send(
						JSON.stringify({
							signal: "CLIENT_REMOVED",
							clientId: id,
						}),
					);
				}

				break;
			}

			case "FILE_META": {
				console.log(
					`MESSAGE RECEIVED: FILE_META\n---------------------------------------\nTarget client ID: ${parsedMessage.targetClientId}\nFilename: ${parsedMessage.name}\nFile type: ${parsedMessage.type}\nTimestamp: ${parsedMessage.timestamp}\nFile size: ${parsedMessage.size}\nMessage ID: ${parsedMessage.messageId}`,
				);

				//Check if the clients are allowed to transfer files (connected)
				const contacts = sessions.get(id);
				if (!contacts?.has(parsedMessage.targetClientId)) {
					break;
				}

				//Send the file meta to the main instance of the target client

				const sockets = clients.get(parsedMessage.targetClientId);
				if (!sockets) break;

				const socket = sockets.values().next().value;
				if (!socket) break;

				outgoingTransfers.set(parsedMessage.messageId, {
					targetClientId: parsedMessage.targetClientId,
					socket,
				});

				socket.send(
					JSON.stringify({
						signal: "FILE_META",
						client: {
							id,
							name: clientAndNames.get(id),
						},
						iv: parsedMessage.iv,
						name: parsedMessage.name,
						type: parsedMessage.type,
						size: parsedMessage.size,
						messageId: parsedMessage.messageId,
					}),
				);

				break;
			}
		}
	});

	/* 
    When client is disconnected
    */
	ws.on("close", function close() {
		console.log("close received");

		//Delete the current tab connection
		const sockets = clients.get(id);

		if (sockets) {
			//Delete this instance of the client
			sockets.delete(ws);

			//If no other instances are open, alert every connection that this client is offline
			if (sockets.size == 0) {
				//Check if there are any ongoing transfers to the closing client, and stop them before it closes
				for (const [messageId, transfer] of outgoingTransfers) {
					if (transfer.targetClientId == id) {
						if (transfer.socket.readyState === WebSocket.OPEN) {
							transfer.socket.send(
								JSON.stringify({
									signal: "FILE_FAILED",
									messageId,
								}),
							);
						}

						outgoingTransfers.delete(messageId);
					}
				}

				//When this client goes offline, update all other connections with the new information
				const contactsForClient = sessions.get(id) ?? new Set();

				for (const connectedClientId of contactsForClient) {
					const connectedSockets = clients.get(connectedClientId);
					if (!connectedSockets) continue;

					for (const connectedClient of connectedSockets) {
						connectedClient.send(
							JSON.stringify({
								signal: "CLIENT_STATUS_CHANGE",
								clientId: id,
								online: false,
							}),
						);
					}
				}
				clients.delete(id);
			}
		}
	});
});
